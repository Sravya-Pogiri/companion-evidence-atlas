import { useRef } from "react";
import {
  AXIS_END,
  LANES,
  formatTime,
  layoutLane,
  type TimelineItem,
} from "@/lib/sample-case";
import { cn } from "@/lib/utils";

const ROW_H = 38;
const LANE_PAD = 6;
const TICK_H = 46;
const TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

const pct = (t: number) => `${(t / AXIS_END) * 100}%`;

interface TimelineProps {
  items: TimelineItem[];
  playhead: number;
  onPlayhead: (t: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenConflict: (item: TimelineItem) => void;
}

/**
 * Shared time axis with one lane per source. Three visual states only:
 * agrees (neutral block), conflict (red vertical line), missing (dashed amber block).
 */
export function Timeline({ items, playhead, onPlayhead, selectedId, onSelect, onOpenConflict }: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const lanes = LANES.map((lane) => {
    const laneItems = items.filter((i) => i.lane === lane.id);
    const { rows, rowOf } = layoutLane(laneItems);
    return { lane, laneItems, rowOf, height: rows * ROW_H + LANE_PAD * 2 };
  });

  const timeFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return playhead;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * AXIS_END * 2) / 2;
  };

  const step = (delta: number) => onPlayhead(Math.min(AXIS_END, Math.max(0, playhead + delta)));

  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)]">
      <div>
        <div style={{ height: TICK_H }} />
        {lanes.map(({ lane, height }) => (
          <div
            key={lane.id}
            style={{ height }}
            className="flex items-center border-t border-border/60 pr-2 text-sm font-medium text-muted-foreground"
          >
            {lane.label}
          </div>
        ))}
      </div>

      <div
        ref={trackRef}
        className="relative touch-none select-none"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("[data-no-scrub]")) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          onPlayhead(timeFromPointer(e.clientX));
        }}
        onPointerMove={(e) => {
          if (dragging.current) onPlayhead(timeFromPointer(e.clientX));
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <div className="relative" style={{ height: TICK_H }} aria-hidden>
          {TICKS.map((t, i) => (
            <span
              key={t}
              className={cn(
                "absolute bottom-1 whitespace-nowrap font-mono text-xs text-muted-foreground",
                t % 30 !== 0 && "hidden sm:inline",
                i === 0 ? "" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: pct(t) }}
            >
              {formatTime(t)}
            </span>
          ))}
        </div>

        {lanes.map(({ lane, laneItems, rowOf, height }) => (
          <div key={lane.id} style={{ height }} className="relative border-t border-border/60">
            {laneItems.map((item) => (
              <button
                key={item.id}
                type="button"
                data-no-scrub
                onClick={() => onSelect(item.id)}
                title={item.label}
                aria-label={`${lane.label}: ${item.label}${item.flag === "missing" ? " (missing)" : ""}`}
                className={cn(
                  "absolute flex items-center overflow-hidden rounded-md px-2 text-left text-sm",
                  item.flag === "missing"
                    ? "border-2 border-dashed border-missing bg-missing/10 text-foreground"
                    : "border border-border bg-muted text-foreground",
                  selectedId === item.id && "ring-2 ring-gold",
                )}
                style={{
                  left: pct(item.start),
                  width: pct(item.end - item.start),
                  minWidth: 28,
                  top: LANE_PAD + (rowOf[item.id] ?? 0) * ROW_H,
                  height: ROW_H - 6,
                }}
              >
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        ))}

        {items
          .filter((i) => i.flag === "conflict")
          .map((item) => (
            <button
              key={item.id}
              type="button"
              data-no-scrub
              onClick={() => onOpenConflict(item)}
              aria-label={`Possible conflict at about ${formatTime(item.start)}. Open the claim and the video side by side.`}
              className="absolute z-10 w-5 -translate-x-1/2 cursor-pointer"
              style={{ left: pct(item.start), top: TICK_H, bottom: 0 }}
            >
              <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-contradiction" />
            </button>
          ))}

        <div className="pointer-events-none absolute inset-y-0 z-20 w-0" style={{ left: pct(playhead) }}>
          <span className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-gold" />
          <button
            type="button"
            role="slider"
            aria-label="Playhead"
            aria-valuemin={0}
            aria-valuemax={AXIS_END}
            aria-valuenow={playhead}
            aria-valuetext={`${formatTime(playhead)}`}
            className="pointer-events-auto absolute top-0 -translate-x-1/2 cursor-grab rounded bg-gold px-2 py-0.5 font-mono text-xs font-semibold text-black active:cursor-grabbing"
            onKeyDown={(e) => {
              const big = e.shiftKey ? 10 : 1;
              if (e.key === "ArrowRight") step(big);
              else if (e.key === "ArrowLeft") step(-big);
              else if (e.key === "Home") onPlayhead(0);
              else if (e.key === "End") onPlayhead(AXIS_END);
              else return;
              e.preventDefault();
            }}
          >
            {formatTime(playhead)}
          </button>
        </div>
      </div>
    </div>
  );
}
