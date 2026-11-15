import type { ReviewDecision, TimelineItem } from "@/lib/sample-case";

// Deadlines: how urgent an item is, in what order Review shows things, which items to remind
// people about, and how to read a calendar feed (iCal). No browser or server imports, so the
// page, the server and the tests all use the same rules.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// ---------- urgency ----------

export type DueKind = "overdue" | "today" | "soon" | "later" | "none";
export interface DueInfo {
  kind: DueKind;
  /** Short words for a badge, e.g. "Due tomorrow". */
  label: string;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Calendar days from today to the due day (0 = today), in the local time zone. */
function dayDiff(due: Date, now: Date): number {
  const a = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / DAY);
}

export function dueInfo(dueAt: string | undefined | null, now: Date): DueInfo {
  if (!dueAt) return { kind: "none", label: "No deadline" };
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { kind: "none", label: "No deadline" };

  if (due.getTime() < now.getTime()) {
    const days = Math.max(1, Math.round((now.getTime() - due.getTime()) / DAY));
    const late = sameDay(due, now)
      ? "Overdue today"
      : `Overdue by ${days} ${days === 1 ? "day" : "days"}`;
    return { kind: "overdue", label: late };
  }
  const d = dayDiff(due, now);
  if (d === 0) return { kind: "today", label: "Due today" };
  if (d === 1) return { kind: "soon", label: "Due tomorrow" };
  if (d <= 3) return { kind: "soon", label: `Due in ${d} days` };
  return { kind: "later", label: `Due in ${d} days` };
}

export function isUrgent(info: DueInfo): boolean {
  return info.kind === "overdue" || info.kind === "today" || info.kind === "soon";
}

/** "Sun, Nov 15, 3:00 PM", or "Sun, Nov 15" for an all-day deadline. */
export function formatDueDate(dueAt: string, allDay = false): string {
  const d = new Date(dueAt);
  const date = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  if (allDay) return date;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** An item's own deadline wins; otherwise it inherits the case's. */
export function effectiveDue(
  item: Pick<TimelineItem, "dueAt">,
  caseDueAt?: string | null,
): string | undefined {
  return item.dueAt ?? caseDueAt ?? undefined;
}

// ---------- order on Review ----------

export type Decisions = Record<string, ReviewDecision>;

const FLAG_RANK = { conflict: 0, missing: 1, agrees: 2 } as const;
const isResolved = (d: ReviewDecision | undefined) => d === "confirmed" || d === "dismissed";

/**
 * Most urgent first: things still waiting for a person, soonest deadline first (overdue at the
 * top), then conflicts before gaps. Items someone already confirmed or dismissed sink to the end.
 */
export function prioritize<T extends TimelineItem>(
  items: T[],
  decisions: Decisions,
  caseDueAt: string | null | undefined,
): T[] {
  const dueMs = (i: T) => {
    const d = effectiveDue(i, caseDueAt);
    return d ? new Date(d).getTime() : Number.POSITIVE_INFINITY;
  };
  return [...items].sort((a, b) => {
    const ra = isResolved(decisions[a.id]) ? 1 : 0;
    const rb = isResolved(decisions[b.id]) ? 1 : 0;
    return (
      ra - rb ||
      dueMs(a) - dueMs(b) ||
      FLAG_RANK[a.flag] - FLAG_RANK[b.flag] ||
      a.start - b.start ||
      a.id.localeCompare(b.id)
    );
  });
}

// ---------- reminders ----------

export interface Reminder {
  item: TimelineItem;
  dueAt: string;
  kind: "overdue" | "soon";
  /** Stable key, so each reminder is sent once. */
  key: string;
}

/** Remind when a deadline is within a day, or has passed. */
const REMIND_WITHIN = DAY;

/**
 * Flagged, filed items still waiting on a person whose deadline is within a day or past.
 * Items someone confirmed or dismissed are left alone.
 */
export function remindersFor(
  items: TimelineItem[],
  decisions: Decisions,
  caseDueAt: string | null | undefined,
  now: Date,
): Reminder[] {
  const out: Reminder[] = [];
  for (const item of items) {
    if (item.status !== "filed" || item.flag === "agrees" || isResolved(decisions[item.id]))
      continue;
    const dueAt = effectiveDue(item, caseDueAt);
    if (!dueAt) continue;
    const ms = new Date(dueAt).getTime() - now.getTime();
    if (Number.isNaN(ms) || ms > REMIND_WITHIN) continue;
    const kind = ms < 0 ? "overdue" : "soon";
    out.push({ item, dueAt, kind, key: `${item.id}|${kind}|${dueAt}` });
  }
  return out.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

/** The text sent to the team. Neutral: it says what needs a look and when, never what it means. */
export function composeReminder(reminders: Reminder[], now: Date): string {
  if (reminders.length === 0) return "Nothing flagged is due soon.";
  const lines = reminders.slice(0, 5).map((r) => {
    const info = dueInfo(r.dueAt, now);
    return `- ${r.item.label} (${info.label.toLowerCase()}, ${formatDueDate(r.dueAt)})`;
  });
  const more = reminders.length > 5 ? `\n...and ${reminders.length - 5} more.` : "";
  const head =
    reminders.length === 1
      ? "Reminder: 1 flagged item needs a person to look at it."
      : `Reminder: ${reminders.length} flagged items need a person to look at them.`;
  return `${head}\n${lines.join("\n")}${more}\nOpen Review to confirm, dismiss, or mark for follow-up.`;
}

// ---------- calendar feeds (iCal) ----------

export interface CalEvent {
  uid: string;
  summary: string;
  description: string;
  /** ISO time of the start (the deadline). */
  start: string;
  allDay: boolean;
}

function unescapeText(s: string): string {
  return s.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");
}

/** Lines in iCal can be folded: a line starting with a space or tab continues the one before. */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

/** Offset (ms) of a time zone from UTC at a given moment. */
function zoneOffset(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return asUtc - utcMs;
}

interface Stamp {
  iso: string;
  allDay: boolean;
}

function parseStamp(params: string, value: string): Stamp | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]) - 1, Number(m[3])];
  if (m[4] === undefined) {
    // All-day: due by the end of that day, local time.
    return { iso: new Date(y, mo, d, 23, 59, 0).toISOString(), allDay: true };
  }
  const [h, mi, s] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  if (m[7]) return { iso: new Date(Date.UTC(y, mo, d, h, mi, s)).toISOString(), allDay: false };

  const tz = /TZID=([^;:]+)/i.exec(params)?.[1];
  if (tz) {
    try {
      const guess = Date.UTC(y, mo, d, h, mi, s);
      let utc = guess - zoneOffset(guess, tz);
      utc = guess - zoneOffset(utc, tz); // settle across a daylight-saving change
      return { iso: new Date(utc).toISOString(), allDay: false };
    } catch {
      // Unknown zone name: fall through to local time.
    }
  }
  return { iso: new Date(y, mo, d, h, mi, s).toISOString(), allDay: false };
}

/** Events in an iCal (.ics) feed. Repeating events are read as their first occurrence only. */
export function parseIcs(text: string): CalEvent[] {
  const events: CalEvent[] = [];
  let cur: Partial<CalEvent> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      cur = { summary: "", description: "", uid: "" };
    } else if (line === "END:VEVENT") {
      if (cur?.start) {
        events.push({
          uid: cur.uid || `${cur.summary}|${cur.start}`,
          summary: cur.summary ?? "",
          description: cur.description ?? "",
          start: cur.start,
          allDay: cur.allDay ?? false,
        });
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const [name = "", ...rest] = line.slice(0, i).split(";");
      const value = line.slice(i + 1);
      const key = name.toUpperCase();
      if (key === "SUMMARY") cur.summary = unescapeText(value);
      else if (key === "DESCRIPTION") cur.description = unescapeText(value);
      else if (key === "UID") cur.uid = value.trim();
      else if (key === "DTSTART") {
        const stamp = parseStamp(rest.join(";"), value);
        if (stamp) {
          cur.start = stamp.iso;
          cur.allDay = stamp.allDay;
        }
      }
    }
  }
  return events;
}

/** Events that mention the case (its name or number) in the title or notes. */
export function eventsForCase(events: CalEvent[], keywords: string[]): CalEvent[] {
  const words = keywords.map((k) => k.toLowerCase()).filter(Boolean);
  return events.filter((e) => {
    const hay = `${e.summary}\n${e.description}`.toLowerCase();
    return words.some((w) => hay.includes(w));
  });
}

/** The soonest event that has not started yet. */
export function nextEvent(events: CalEvent[], now: Date): CalEvent | undefined {
  return [...events]
    .filter((e) => new Date(e.start).getTime() >= now.getTime())
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0];
}
