import { useEffect, useRef } from "react";
import { Check, Columns2 } from "lucide-react";
import { decide } from "@/lib/review-store";
import {
  DECISION_LABEL,
  findItem,
  type ReviewDecision,
  type TimelineItem,
} from "@/lib/sample-case";
import { SOURCES } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { citationsFor, useWorkspace } from "./context";
import { Citations } from "./source-citation";

const CATEGORY = {
  conflict: { label: "Possible conflict", tone: "text-contradiction" },
  missing: { label: "Possible gap", tone: "text-[#9a6614]" },
  agrees: { label: "Corroborates", tone: "text-corroborate" },
  pending: { label: "Awaiting filing", tone: "text-muted-foreground" },
} satisfies Record<string, { label: string; tone: string }>;

function categoryOf(item: TimelineItem) {
  if (item.status === "pending") return CATEGORY.pending;
  return CATEGORY[item.flag];
}

/** The exact words a finding rests on, when the source text has them. */
function quoteFor(itemId: string): string | null {
  for (const s of SOURCES)
    for (const b of s.blocks ?? [])
      for (const p of b.paragraphs) {
        const m = p.marks?.find((x) => x.itemId === itemId);
        if (m) return m.phrase;
      }
  return null;
}

/** Brings the card into view when it becomes focused later (not on first render). */
function useScrollWhenFocused(focused: boolean) {
  const ref = useRef<HTMLElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current && focused)
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    mounted.current = true;
  }, [focused]);
  return ref;
}

function StatusPill({
  decision,
  pendingText,
}: {
  decision: ReviewDecision | undefined;
  pendingText: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px]",
        decision === "confirmed"
          ? "text-corroborate"
          : decision === "dismissed"
            ? "text-muted-foreground line-through decoration-1"
            : decision === "follow-up"
              ? "text-[#9a6614]"
              : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          decision === "confirmed"
            ? "bg-corroborate"
            : decision === "follow-up"
              ? "bg-[#c89426]"
              : "bg-[#b9bfcb]",
        )}
      />
      {decision ? DECISION_LABEL[decision] : pendingText}
    </span>
  );
}

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors";
const primaryBtn = `${btn} bg-foreground text-white hover:bg-[#1d2a4f]`;
const secondaryBtn = `${btn} border border-border bg-white text-foreground hover:bg-muted`;

export function FindingCard({
  item,
  onCompare,
}: {
  item: TimelineItem;
  onCompare: (claim: TimelineItem, footage: TimelineItem) => void;
}) {
  const { focusId, focusItem, items, decisions } = useWorkspace();
  const related = findItem(items, item.relatedId);
  const focused = focusId === item.id;
  const ref = useScrollWhenFocused(focused);
  const cat = categoryOf(item);
  const decision = decisions[item.id];
  const quote = quoteFor(item.id);

  return (
    <article
      ref={ref}
      onClick={() => focusItem(item.id)}
      className={cn(
        "lx-fade scroll-mt-4 rounded-xl border bg-white p-5 transition-colors",
        focused ? "border-[#9fb4f8] shadow-[0_0_0_3px_#eef2fe]" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={cn("font-mono text-[12px] uppercase tracking-[0.08em]", cat.tone)}>
          {cat.label}
        </p>
        <StatusPill decision={decision} pendingText="Unverified" />
      </div>
      <h3 className="mt-2 font-serif text-[24px] leading-tight">{item.label}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[#38425c]">{item.extractedText}</p>

      {related && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Evidence
            label={item.sourceLabel}
            text={quote ? `“${quote}”` : item.extractedText}
            item={item}
          />
          <Evidence
            label={related.sourceLabel}
            text={quoteFor(related.id) ? `“${quoteFor(related.id)}”` : related.extractedText}
            item={related}
          />
        </div>
      )}
      {!related && (
        <div className="mt-3">
          <Citations cites={citationsFor(item)} />
        </div>
      )}

      <div
        className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={primaryBtn}
          aria-pressed={decision === "confirmed"}
          onClick={() => decide(item.id, "confirmed")}
        >
          <Check className="size-3.5" /> {decision === "confirmed" ? "Verified" : "Verify"}
        </button>
        <button
          type="button"
          className={secondaryBtn}
          aria-pressed={decision === "follow-up"}
          onClick={() => decide(item.id, "follow-up")}
        >
          Needs follow-up
        </button>
        <button
          type="button"
          className={secondaryBtn}
          aria-pressed={decision === "dismissed"}
          onClick={() => decide(item.id, "dismissed")}
        >
          Dismiss
        </button>
        {related && item.flag === "conflict" && (
          <button
            type="button"
            className={cn(secondaryBtn, "ml-auto")}
            onClick={() => onCompare(item, related)}
          >
            <Columns2 className="size-3.5" /> Compare
          </button>
        )}
      </div>
    </article>
  );
}

function Evidence({ label, text, item }: { label: string; text: string; item: TimelineItem }) {
  return (
    <div className="rounded-lg border border-border bg-[#fbfbf9] p-3">
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-serif text-[19px] leading-snug">{text}</p>
      <Citations cites={citationsFor(item).slice(0, 1)} className="mt-2" />
    </div>
  );
}

export function DraftReviewCard({ item }: { item: TimelineItem }) {
  const { focusId, focusItem, decisions } = useWorkspace();
  const focused = focusId === item.id;
  const ref = useScrollWhenFocused(focused);
  const cat = categoryOf(item);
  const decision = decisions[item.id];
  const statusText: Record<ReviewDecision, string> = {
    confirmed: "Approved for handoff",
    "follow-up": "Edit requested",
    dismissed: "Dismissed",
  };

  return (
    <article
      ref={ref}
      onClick={() => focusItem(item.id)}
      className={cn(
        "lx-fade scroll-mt-4 rounded-xl border bg-white p-5 transition-colors",
        focused ? "border-[#9fb4f8] shadow-[0_0_0_3px_#eef2fe]" : "border-border",
        decision === "dismissed" && "opacity-60",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={cn("font-mono text-[12px] uppercase tracking-[0.08em]", cat.tone)}>
          {cat.label}
        </p>
        <span className="text-[13px] text-muted-foreground">
          {decision ? statusText[decision] : "Draft · awaiting review"}
        </span>
      </div>
      <p className="mt-3 font-serif text-[23px] leading-[1.4] text-foreground">
        {item.extractedText}
      </p>
      <Citations cites={citationsFor(item)} className="mt-3" />
      <div className="mt-4 flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={primaryBtn}
          aria-pressed={decision === "confirmed"}
          onClick={() => decide(item.id, "confirmed")}
        >
          {decision === "confirmed" ? (
            <>
              <Check className="size-3.5" /> Approved
            </>
          ) : (
            "Approve"
          )}
        </button>
        <button
          type="button"
          className={secondaryBtn}
          aria-pressed={decision === "follow-up"}
          onClick={() => decide(item.id, "follow-up")}
        >
          Request edit
        </button>
        <button
          type="button"
          className={secondaryBtn}
          aria-pressed={decision === "dismissed"}
          onClick={() => decide(item.id, "dismissed")}
        >
          Dismiss
        </button>
      </div>
    </article>
  );
}
