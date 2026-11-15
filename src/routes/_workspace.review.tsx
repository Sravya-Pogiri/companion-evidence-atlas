import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell, CalendarClock, ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/caselens/shared";
import { setItemDue, useCase, useFiledItems } from "@/lib/case-store";
import {
  dueInfo,
  effectiveDue,
  formatDueDate,
  isUrgent,
  prioritize,
  type DueInfo,
} from "@/lib/deadlines";
import {
  getCaseCalendar,
  sendRemindersNow,
  type CaseCalendar,
  type RemindersNow,
} from "@/lib/deadlines.functions";
import { decide, useDecisions } from "@/lib/review-store";
import { seo } from "@/lib/seo";
import {
  DECISION_LABEL,
  FLAG_LABEL,
  LANES,
  SAMPLE_CASE,
  findItem,
  formatRange,
  reviewQueue,
  type ReviewDecision,
  type TimelineItem,
} from "@/lib/sample-case";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workspace/review")({
  head: () =>
    seo("Review", "Flagged items waiting for a person to confirm, dismiss, or follow up."),
  component: Review,
});

const ACTIONS: ReviewDecision[] = ["confirmed", "dismissed", "follow-up"];
const ACTION_BUTTON: Record<ReviewDecision, string> = {
  confirmed: "Confirm",
  dismissed: "Dismiss",
  "follow-up": "Needs follow-up",
};

/** The time now, set after the first render so server and browser markup match. */
function useNow(everyMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** The case's next deadline from a connected calendar, refreshed every few minutes. */
function useCaseCalendar(): CaseCalendar | null {
  const [calendar, setCalendar] = useState<CaseCalendar | null>(null);
  useEffect(() => {
    let stopped = false;
    const load = () =>
      getCaseCalendar()
        .then((c) => !stopped && setCalendar(c))
        .catch(() => {});
    void load();
    const t = setInterval(load, 5 * 60_000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, []);
  return calendar;
}

function Review() {
  const decisions = useDecisions();
  const items = useFiledItems();
  const { mode } = useCase();
  const now = useNow();
  const calendar = useCaseCalendar();
  const caseDueAt = calendar?.next?.dueAt ?? null;

  const flagged = reviewQueue(items);
  const queue = prioritize(flagged, decisions, caseDueAt);
  const reviewed = flagged.filter((i) => decisions[i.id]).length;
  const urgent = now
    ? flagged.filter(
        (i) =>
          !["confirmed", "dismissed"].includes(decisions[i.id] ?? "") &&
          isUrgent(dueInfo(effectiveDue(i, caseDueAt), now)),
      ).length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={SAMPLE_CASE.label}
        title="Review"
        desc="Nothing is filed for an attorney until a person confirms it. These are suggestions, not conclusions."
      >
        <div className="text-right">
          <p className="font-mono text-sm text-muted-foreground">
            {reviewed} of {flagged.length} reviewed
          </p>
          {urgent > 0 && (
            <p className="font-mono text-sm text-missing">{urgent} due within 3 days or overdue</p>
          )}
        </div>
      </PageHeader>

      <DeadlineBanner calendar={calendar} now={now} mode={mode} />

      <ul className="space-y-4">
        {queue.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            items={items}
            decision={decisions[item.id]}
            caseDueAt={caseDueAt}
            now={now}
          />
        ))}
      </ul>
    </div>
  );
}

// ---------- calendar banner and reminders ----------

function DeadlineBanner({
  calendar,
  now,
  mode,
}: {
  calendar: CaseCalendar | null;
  now: Date | null;
  mode: "simulated" | "photon";
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function remind() {
    setBusy(true);
    setNote(null);
    try {
      setNote(describeReminders(await sendRemindersNow()));
    } catch {
      setNote("Could not send reminders. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  const next = calendar?.next ?? null;
  const info = next && now ? dueInfo(next.dueAt, now) : null;

  return (
    <section className="rounded-lg border bg-card p-4" aria-label="Deadlines and reminders">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-sm text-muted-foreground">
            <CalendarClock className="size-4" aria-hidden /> Case deadline
          </p>
          {!calendar ? (
            <p className="mt-1 text-base text-muted-foreground">Checking your calendar…</p>
          ) : next ? (
            <>
              <p className="mt-1 text-base">
                {next.title} · {formatDueDate(next.dueAt, next.allDay)}
                {info && <span className={cn("ml-2", badgeText(info))}>{info.label}</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                From your calendar. Items without their own deadline use this one.
              </p>
            </>
          ) : calendar.configured ? (
            <p className="mt-1 text-base">
              Your calendar has no upcoming event for this case. Set a deadline on any item below.
            </p>
          ) : (
            <p className="mt-1 text-base">
              No calendar is connected. Set a deadline on any item below. A Google Calendar or court
              calendar feed link can be connected in the server settings (see the README).
            </p>
          )}
          {calendar?.error && <p className="mt-1 text-sm text-missing">{calendar.error}</p>}
        </div>

        <div className="text-right">
          {mode === "photon" ? (
            <button
              type="button"
              onClick={remind}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md border bg-muted px-4 py-2 text-base font-medium hover:border-gold disabled:opacity-50"
            >
              <Bell className="size-4" aria-hidden /> {busy ? "Sending…" : "Text reminders now"}
            </button>
          ) : (
            <p className="max-w-[16rem] text-sm text-muted-foreground">
              Text reminders go out through the Photon channel.
            </p>
          )}
        </div>
      </div>
      {note && (
        <p role="status" className="mt-3 border-t pt-3 text-sm">
          {note}
        </p>
      )}
    </section>
  );
}

function describeReminders(r: RemindersNow): string {
  if (!r.ok) return "Text reminders go out through the Photon channel, which is not on.";
  if (r.count === 0) return "Nothing flagged is due within a day, so there was nothing to send.";
  if (r.recipients === 0) {
    return "Nobody has texted the line yet, so there was no one to notify. A shared line can only message people who texted it first.";
  }
  const items = `${r.count} flagged ${r.count === 1 ? "item" : "items"}`;
  const people = `${r.accepted} of ${r.recipients} ${r.recipients === 1 ? "person" : "people"}`;
  return `Sent a reminder about ${items} to ${people}.`;
}

// ---------- deadlines on a card ----------

function badgeText(info: DueInfo): string {
  if (info.kind === "overdue") return "text-contradiction";
  if (info.kind === "today" || info.kind === "soon") return "text-missing";
  return "text-muted-foreground";
}

/** A deadline at the end of a chosen day. "Today" runs to the end of the day, others to 5 PM. */
function atDay(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  if (offsetDays === 0) d.setHours(23, 59, 0, 0);
  else d.setHours(17, 0, 0, 0);
  return d.toISOString();
}

function fromDateInput(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 17, 0, 0).toISOString();
}

function toDateInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const QUICK: { label: string; days: number }[] = [
  { label: "Today", days: 0 },
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
];

function DueControl({ item }: { item: TimelineItem }) {
  return (
    <div
      className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4"
      role="group"
      aria-label={`Deadline for ${item.label}`}
    >
      <span className="font-mono text-sm text-muted-foreground">Deadline</span>
      {QUICK.map((q) => (
        <button
          key={q.label}
          type="button"
          onClick={() => void setItemDue(item.id, atDay(q.days))}
          className="rounded-md border bg-muted px-3 py-1.5 text-sm hover:border-gold"
        >
          {q.label}
        </button>
      ))}
      <input
        type="date"
        aria-label={`Pick a deadline date for ${item.label}`}
        value={toDateInput(item.dueAt)}
        onChange={(e) => {
          const iso = fromDateInput(e.target.value);
          if (iso) void setItemDue(item.id, iso);
        }}
        className="rounded-md border bg-background px-2 py-1 text-sm"
      />
      {item.dueAt && (
        <button
          type="button"
          onClick={() => void setItemDue(item.id, null)}
          className="rounded-md px-2 py-1.5 text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function ReviewCard({
  item,
  items,
  decision,
  caseDueAt,
  now,
}: {
  item: TimelineItem;
  items: TimelineItem[];
  decision: ReviewDecision | undefined;
  caseDueAt: string | null;
  now: Date | null;
}) {
  const related = findItem(items, item.relatedId);
  const lane = LANES.find((l) => l.id === item.lane)?.label;
  const kind = item.status === "pending" ? "Waiting for confirmation" : FLAG_LABEL[item.flag];
  const sources = [item, ...(related ? [related] : [])].filter((s) => s.sourceLink);

  const due = effectiveDue(item, caseDueAt);
  const info = now ? dueInfo(due, now) : null;
  const settled = decision === "confirmed" || decision === "dismissed";
  const showUrgency = info && info.kind !== "none" && !settled;

  return (
    <li
      className={cn(
        "rounded-lg border bg-card p-5",
        item.flag === "conflict" && "border-contradiction/60",
        item.flag === "missing" && "border-dashed border-missing/70",
        showUrgency && info.kind === "overdue" && "ring-1 ring-contradiction/60",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm text-muted-foreground">
          {kind} · {lane} · {formatRange(item)}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {due && info && info.kind !== "none" && (
            <span
              className={cn(
                "rounded-full border px-3 py-0.5 text-sm",
                settled ? "text-muted-foreground" : badgeText(info),
              )}
            >
              {info.label} · {formatDueDate(due)}
              {!item.dueAt && " (calendar)"}
            </span>
          )}
          {decision && (
            <span className="rounded-full border border-gold px-3 py-0.5 text-sm text-gold">
              {DECISION_LABEL[decision]}
            </span>
          )}
        </div>
      </div>
      <h2 className="mt-1 font-serif text-xl">{item.label}</h2>
      <p className="mt-2 text-base leading-relaxed">{item.extractedText}</p>

      <ul className="mt-3 space-y-1 text-sm">
        {sources.length === 0 && (
          <li className="text-muted-foreground">Source: {item.sourceLabel}</li>
        )}
        {sources.map((s) => (
          <li key={s.id}>
            <a
              href={s.sourceLink!}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-gold hover:underline"
            >
              {s.sourceLabel} <ExternalLink className="size-4" />
            </a>
          </li>
        ))}
      </ul>

      <div
        className="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label={`Decision for ${item.label}`}
      >
        {ACTIONS.map((action) => (
          <button
            key={action}
            type="button"
            aria-pressed={decision === action}
            onClick={() => decide(item.id, action)}
            className={cn(
              "rounded-md border px-4 py-2 text-base font-medium transition-colors",
              decision === action ? "border-gold bg-gold text-black" : "bg-muted hover:border-gold",
            )}
          >
            {ACTION_BUTTON[action]}
          </button>
        ))}
      </div>

      <DueControl item={item} />
    </li>
  );
}
