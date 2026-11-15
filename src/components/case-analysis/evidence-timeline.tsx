import { useEffect, useRef } from "react";
import { LANES, findItem, formatTime, type TimelineItem } from "@/lib/sample-case";
import { cn } from "@/lib/utils";
import { citationsFor, useWorkspace } from "./context";
import { Citations } from "./source-citation";

function markerClass(item: TimelineItem): string {
  if (item.flag === "conflict") return "border-contradiction bg-contradiction";
  if (item.flag === "missing") return "border-[#c89426] bg-white border-dashed";
  if (item.relatedId) return "border-corroborate bg-corroborate";
  return "border-[#9aa2b4] bg-white";
}

/** Vertical evidence timeline. New events slide in; events tied to the focused finding stand out. */
export function EvidenceTimeline() {
  const { items, focusId, focusItem } = useWorkspace();
  const sorted = [...items].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const focus = findItem(items, focusId ?? undefined);
  const linked = new Set(
    focus
      ? [
          focus.id,
          focus.relatedId,
          ...items.filter((i) => i.relatedId === focus.id).map((i) => i.id),
        ].filter(Boolean)
      : [],
  );

  const known = useRef<Set<string> | null>(null);
  const prior = known.current;
  useEffect(() => {
    known.current = new Set(items.map((i) => i.id));
  }, [items]);

  if (sorted.length === 0) {
    return (
      <p className="text-[15px] text-muted-foreground">
        Nothing is on the timeline yet. Text evidence to the case line to start.
      </p>
    );
  }

  return (
    <ol className="relative">
      <span className="absolute bottom-3 left-[5.75rem] top-3 w-px bg-border" aria-hidden />
      {sorted.map((item) => {
        const lane = LANES.find((l) => l.id === item.lane)?.label;
        const on = linked.has(item.id);
        return (
          <li
            key={item.id}
            className={cn("relative", prior && !prior.has(item.id) && "lx-slide-in")}
          >
            <div
              onClick={() => focusItem(item.id)}
              className={cn(
                "grid w-full cursor-pointer grid-cols-[5rem_1.5rem_minmax(0,1fr)] items-start gap-0 rounded-lg py-3 pr-3 text-left transition-colors",
                on ? "bg-accent/70" : "hover:bg-muted/60",
              )}
            >
              <span className="pl-2 pt-1 font-mono text-[12px] text-muted-foreground">
                {item.when ??
                  (item.end - item.start >= 80 ? "throughout" : `~${formatTime(item.start)}`)}
              </span>
              <span className="flex justify-center pt-[7px]">
                <span
                  className={cn(
                    "relative z-10 size-2.5 rounded-full border-[1.5px]",
                    markerClass(item),
                  )}
                />
              </span>
              <span className="min-w-0">
                <span className="text-[12px] text-muted-foreground">
                  {lane}
                  {item.flag === "conflict" && (
                    <span className="text-contradiction"> · possible conflict</span>
                  )}
                  {item.flag === "missing" && (
                    <span className="text-[#9a6614]"> · possible gap</span>
                  )}
                  {item.status === "pending" && " · awaiting filing"}
                </span>
                <button
                  type="button"
                  onClick={() => focusItem(item.id)}
                  className="block text-left font-serif text-[21px] leading-snug text-foreground"
                >
                  {item.label}
                </button>
                <Citations cites={citationsFor(item)} className="mt-1.5" />
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
