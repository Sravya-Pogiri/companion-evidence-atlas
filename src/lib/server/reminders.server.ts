// Server only. Deadline reminders over Photon.
//
// Every minute (while the server runs in Photon mode) it looks for flagged items that are still
// waiting on a person and are due within a day or overdue, and texts everyone on the line once
// per item. "Text reminders now" on the Review page does the same on demand.
import { composeReminder, remindersFor, type Decisions } from "@/lib/deadlines";
import type { TimelineItem } from "@/lib/sample-case";
import { loadCalendar } from "./calendar.server";

/** What the reminder logic needs from the Photon runtime. */
export interface ReminderHost {
  channel: { notifyAll(text: string): Promise<{ recipients: number; accepted: number }> };
  state: { items: TimelineItem[] };
  decisions: Decisions;
  /** Keys of reminders already sent, so each goes out once. */
  sent: Set<string>;
}

export interface ReminderResult {
  /** Flagged items that were due. */
  count: number;
  recipients: number;
  accepted: number;
  text: string | null;
}

export async function runReminderCheck(
  host: ReminderHost,
  opts: { now?: Date; includeAlreadySent?: boolean } = {},
): Promise<ReminderResult> {
  const now = opts.now ?? new Date();
  const calendar = await loadCalendar(now);
  const due = remindersFor(host.state.items, host.decisions, calendar.next?.dueAt, now);
  const fresh = opts.includeAlreadySent ? due : due.filter((r) => !host.sent.has(r.key));
  if (fresh.length === 0) return { count: 0, recipients: 0, accepted: 0, text: null };

  const text = composeReminder(fresh, now);
  const { recipients, accepted } = await host.channel.notifyAll(text);
  // Only count it as sent once someone actually got it. With nobody on the line yet, try again later.
  if (accepted > 0) for (const r of fresh) host.sent.add(r.key);
  return { count: fresh.length, recipients, accepted, text };
}

const g = globalThis as { __caselensReminderTimer?: ReturnType<typeof setInterval> };

export function startReminderLoop(host: ReminderHost, everyMs = 60_000): void {
  if (g.__caselensReminderTimer) clearInterval(g.__caselensReminderTimer);
  const timer = setInterval(() => {
    runReminderCheck(host).catch(() => console.error("reminders: a check failed."));
  }, everyMs);
  timer.unref?.();
  g.__caselensReminderTimer = timer;
}
