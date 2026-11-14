import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/caselens/shared";
import { decide, useDecisions } from "@/lib/review-store";
import { seo } from "@/lib/seo";
import {
  DECISION_LABEL,
  FLAG_LABEL,
  ITEMS,
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
  head: () => seo("Review", "Flagged items waiting for a person to confirm, dismiss, or follow up."),
  component: Review,
});

const ACTIONS: ReviewDecision[] = ["confirmed", "dismissed", "follow-up"];
const ACTION_BUTTON: Record<ReviewDecision, string> = {
  confirmed: "Confirm",
  dismissed: "Dismiss",
  "follow-up": "Needs follow-up",
};

function Review() {
  const decisions = useDecisions();
  const queue = reviewQueue(ITEMS);
  const reviewed = queue.filter((i) => decisions[i.id]).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={SAMPLE_CASE.label}
        title="Review"
        desc="Nothing is filed for an attorney until a person confirms it. These are suggestions, not conclusions."
      >
        <p className="font-mono text-sm text-muted-foreground">
          {reviewed} of {queue.length} reviewed
        </p>
      </PageHeader>

      <ul className="space-y-4">
        {queue.map((item) => (
          <ReviewCard key={item.id} item={item} decision={decisions[item.id]} />
        ))}
      </ul>
    </div>
  );
}

function ReviewCard({ item, decision }: { item: TimelineItem; decision: ReviewDecision | undefined }) {
  const related = findItem(ITEMS, item.relatedId);
  const lane = LANES.find((l) => l.id === item.lane)?.label;
  const kind = item.status === "pending" ? "Waiting for confirmation" : FLAG_LABEL[item.flag];
  const sources = [item, ...(related ? [related] : [])].filter((s) => s.sourceLink);

  return (
    <li
      className={cn(
        "rounded-lg border bg-card p-5",
        item.flag === "conflict" && "border-contradiction/60",
        item.flag === "missing" && "border-dashed border-missing/70",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm text-muted-foreground">
          {kind} · {lane} · {formatRange(item)}
        </p>
        {decision && (
          <span className="rounded-full border border-gold px-3 py-0.5 text-sm text-gold">{DECISION_LABEL[decision]}</span>
        )}
      </div>
      <h2 className="mt-1 font-serif text-xl">{item.label}</h2>
      <p className="mt-2 text-base leading-relaxed">{item.extractedText}</p>

      <ul className="mt-3 space-y-1 text-sm">
        {sources.length === 0 && <li className="text-muted-foreground">Source: {item.sourceLabel}</li>}
        {sources.map((s) => (
          <li key={s.id}>
            <a href={s.sourceLink!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold hover:underline">
              {s.sourceLabel} <ExternalLink className="size-4" />
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`Decision for ${item.label}`}>
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
    </li>
  );
}
