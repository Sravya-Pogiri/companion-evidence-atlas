// Server only. Reads case deadlines from calendar feeds (iCal / .ics links).
//
//   CASE_CALENDAR_ICS_URLS=<link>[,<link>...]
//
// Works with a Google Calendar's "Secret address in iCal format" (Calendar settings, Integrate
// calendar) and with any public court calendar that publishes an .ics or webcal link. Only events
// that mention the case by name or number count. The links are secrets: they are read from the
// environment here and are never sent to the page or written to a log.
import { DEMO_CASE } from "@/lib/case-data";
import { eventsForCase, nextEvent, parseIcs, type CalEvent } from "@/lib/deadlines";

export interface CaseDeadline {
  title: string;
  dueAt: string;
  allDay: boolean;
}

export interface CalendarResult {
  /** A feed link is set in the environment. */
  configured: boolean;
  /** The next deadline for this case that has not passed, if any feed has one. */
  next: CaseDeadline | null;
  /** The next few, soonest first. */
  upcoming: CaseDeadline[];
  /** Plain words about a feed that could not be read. Never includes the link. */
  error?: string;
  checkedAt: string;
}

const TTL_MS = 5 * 60_000;
const MAX_BYTES = 2_000_000;
const g = globalThis as { __caselensCal?: { at: number; value: CalendarResult } };

/** Words that tie an event to this case. */
export const CASE_KEYWORDS = [DEMO_CASE.id, ...DEMO_CASE.name.split(/\s+v\.?\s+/i)].filter(
  (k) => k.length >= 4,
);

function feedUrls(): URL[] {
  const raw = process.env["CASE_CALENDAR_ICS_URLS"] ?? "";
  const urls: URL[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().replace(/^webcal:\/\//i, "https://");
    if (!t) continue;
    try {
      const u = new URL(t);
      const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
      if (u.protocol === "https:" || (u.protocol === "http:" && local)) urls.push(u);
    } catch {
      // Ignore a malformed link rather than failing the whole page.
    }
  }
  return urls;
}

async function readFeed(url: URL): Promise<CalEvent[]> {
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`status ${response.status}`);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error("feed too large");
  return parseIcs(text);
}

const toDeadline = (e: CalEvent): CaseDeadline => ({
  title: e.summary,
  dueAt: e.start,
  allDay: e.allDay,
});

export async function loadCalendar(now: Date = new Date(), force = false): Promise<CalendarResult> {
  const cached = g.__caselensCal;
  if (!force && cached && now.getTime() - cached.at < TTL_MS) return cached.value;

  const urls = feedUrls();
  let value: CalendarResult;
  if (urls.length === 0) {
    value = { configured: false, next: null, upcoming: [], checkedAt: now.toISOString() };
  } else {
    const events: CalEvent[] = [];
    let failed = 0;
    for (const url of urls) {
      try {
        events.push(...(await readFeed(url)));
      } catch {
        failed += 1;
        console.error("calendar: a feed could not be read.");
      }
    }
    const mine = eventsForCase(events, CASE_KEYWORDS)
      .filter((e) => new Date(e.start).getTime() >= now.getTime())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const next = nextEvent(mine, now);
    value = {
      configured: true,
      next: next ? toDeadline(next) : null,
      upcoming: mine.slice(0, 3).map(toDeadline),
      ...(failed > 0
        ? {
            error:
              failed === urls.length
                ? "The calendar could not be read."
                : "One calendar could not be read.",
          }
        : {}),
      checkedAt: now.toISOString(),
    };
  }
  g.__caselensCal = { at: now.getTime(), value };
  return value;
}

/** The last result, without fetching. Used where the answer is needed synchronously. */
export function cachedCaseDeadline(): CaseDeadline | null {
  return g.__caselensCal?.value.next ?? null;
}
