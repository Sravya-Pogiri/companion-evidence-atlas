import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CircleDashed } from "lucide-react";
import { FrameThumb, LANE_ICON } from "@/components/caselens/evidence-media";
import { mediaFor } from "@/lib/media";
import {
  AXIS_END,
  LANES,
  TICKS,
  findItem,
  formatTick,
  formatTime,
  shortLabel,
  type Lane,
  type TimelineItem,
} from "@/lib/sample-case";
import { cn } from "@/lib/utils";

const ROW_H = 44;
const ITEM_H = 36;
const LANE_PAD = 8;
const TICK_H = 34;
const GAP = 6;
const MAX_W = 280;
const BAND_S = 1.6; // half-width of the conflict band, in seconds

const pct = (t: number) => `${(t / AXIS_END) * 100}%`;

interface TimelineProps {
  items: TimelineItem[];
  playhead: number;
  onPlayhead: (t: number) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenConflict: (item: TimelineItem) => void;
  /** Ids of conflicts a person has confirmed; those stop pulsing. */
  confirmedIds: Set<string>;
}

interface Placed {
  left: number;
  width: number;
  row: number;
}

/**
 * Shared time axis, one lane per source. Items are as wide as their label needs (never cut
 * off) and stack into extra rows when they would overlap. A possible conflict draws a soft
 * red band at its moment and a curved connector between the two sources.
 */
export function Timeline({
  items,
  playhead,
  onPlayhead,
  selectedId,
  onSelect,
  onOpenConflict,
  confirmedIds,
}: TimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const dragging = useRef(false);
  const [trackW, setTrackW] = useState(0);
  const [placed, setPlaced] = useState<Record<string, Placed>>({});
  const known = useRef<Set<string> | null>(null);

  // Items added after the first render slide in.
  const prior = known.current;
  const fresh = new Set(prior ? items.filter((i) => !prior.has(i.id)).map((i) => i.id) : []);
  useEffect(() => {
    known.current = new Set(items.map((i) => i.id));
  }, [items]);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(
      ([entry]) => entry && setTrackW(Math.round(entry.contentRect.width)),
    );
    ro.observe(el);
    setTrackW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);

  // Measure each item's natural width, then place it and stack collisions within its lane.
  useLayoutEffect(() => {
    if (trackW === 0) return;
    const next: Record<string, Placed> = {};
    for (const lane of LANES) {
      const laneItems = items
        .filter((i) => i.lane === lane.id)
        .map((i) => {
          const el = itemRefs.current.get(i.id);
          let natural = 120;
          if (el) {
            const prev = el.style.width;
            el.style.width = "max-content";
            natural = Math.ceil(el.getBoundingClientRect().width);
            el.style.width = prev;
          }
          const span = ((i.end - i.start) / AXIS_END) * trackW;
          const width = Math.min(Math.max(natural, span), Math.max(span, MAX_W), trackW);
          const left = Math.max(0, Math.min((i.start / AXIS_END) * trackW, trackW - width));
          return { id: i.id, left, width };
        })
        .sort((a, b) => a.left - b.left || a.id.localeCompare(b.id));
      const rowEnds: number[] = [];
      for (const p of laneItems) {
        let row = rowEnds.findIndex((end) => end + GAP <= p.left);
        if (row === -1) row = rowEnds.length;
        rowEnds[row] = p.left + p.width;
        next[p.id] = { left: p.left, width: p.width, row };
      }
    }
    setPlaced((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [items, trackW]);

  const ready = trackW > 0 && items.every((i) => placed[i.id]);

  let y = TICK_H;
  const lanes = LANES.map((lane) => {
    const laneItems = items.filter((i) => i.lane === lane.id);
    const rows = Math.max(1, ...laneItems.map((i) => (placed[i.id]?.row ?? 0) + 1));
    const height = rows * ROW_H + LANE_PAD * 2;
    const top = y;
    y += height;
    return { lane, laneItems, height, top };
  });
  const laneOf = Object.fromEntries(lanes.map((l) => [l.lane.id, l])) as Record<
    Lane,
    (typeof lanes)[number]
  >;
  const itemBox = (i: TimelineItem) => {
    const p = placed[i.id];
    if (!p) return null;
    const top = laneOf[i.lane].top + LANE_PAD + p.row * ROW_H;
    return { left: p.left, top, mid: top + ITEM_H / 2 };
  };

  // Each possible conflict with the item it is compared against, plus the connector geometry.
  const conflicts = ready
    ? items
        .filter((i) => i.flag === "conflict")
        .flatMap((c) => {
          const r = findItem(items, c.relatedId);
          if (!r) return [];
          const a = itemBox(c)!;
          const b = itemBox(r)!;
          const bulge = a.left > 90 ? -64 : 64;
          const top = Math.min(laneOf[c.lane].top, laneOf[r.lane].top);
          const bottom = Math.max(
            laneOf[c.lane].top + laneOf[c.lane].height,
            laneOf[r.lane].top + laneOf[r.lane].height,
          );
          return [
            {
              c,
              path: `M ${a.left} ${a.mid} C ${a.left + bulge} ${a.mid}, ${b.left + bulge} ${b.mid}, ${b.left} ${b.mid}`,
              pillX: Math.min(Math.max((a.left + b.left) / 2 + 0.75 * bulge, 72), trackW - 72),
              pillY: (a.mid + b.mid) / 2,
              bandTop: top,
              bandH: bottom - top,
              pulsing: !confirmedIds.has(c.id),
            },
          ];
        })
    : [];

  const timeFromPointer = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return playhead;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(ratio * AXIS_END * 2) / 2;
  };
  const step = (delta: number) => onPlayhead(Math.min(AXIS_END, Math.max(0, playhead + delta)));

  return (
    <div className="grid grid-cols-[8.5rem_minmax(0,1fr)]">
      <div>
        <div style={{ height: TICK_H }} />
        {lanes.map(({ lane, height }) => {
          const Icon = LANE_ICON[lane.id];
          return (
            <div
              key={lane.id}
              style={{ height }}
              className="flex items-center gap-2 border-t border-border pr-3 text-sm font-medium text-muted-foreground"
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {lane.label}
            </div>
          );
        })}
      </div>

      <div
        ref={trackRef}
        className="relative touch-none select-none"
        style={{ height: y }}
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
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        {/* Ticks, grid lines and lane rules */}
        <div className="absolute inset-x-0 top-0" style={{ height: TICK_H }} aria-hidden>
          {TICKS.map((t, i) => (
            <span
              key={t}
              className={cn(
                "absolute bottom-2 whitespace-nowrap font-mono text-[13px] text-muted-foreground",
                i === 0 ? "" : i === TICKS.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: pct(t) }}
            >
              {formatTick(t)}
            </span>
          ))}
        </div>
        {TICKS.slice(1, -1).map((t) => (
          <span
            key={t}
            aria-hidden
            className="absolute bottom-0 w-px bg-white/[0.04]"
            style={{ left: pct(t), top: TICK_H }}
          />
        ))}
        {lanes.map(({ lane, height, top }) => (
          <div
            key={lane.id}
            aria-hidden
            className="absolute inset-x-0 border-t border-border"
            style={{ top, height }}
          />
        ))}

        {/* Conflict bands, under the items */}
        {conflicts.map(({ c, bandTop, bandH, pulsing }) => (
          <button
            key={`band-${c.id}`}
            type="button"
            data-no-scrub
            onClick={() => onOpenConflict(c)}
            aria-label={`Possible conflict at about ${formatTime(c.start)}. Compare the sources side by side.`}
            className={cn(
              "absolute z-0 rounded-sm bg-contradiction/[0.12] ring-1 ring-inset ring-contradiction/25",
              pulsing && "lx-pulse",
            )}
            style={{
              left: pct(Math.max(0, c.start - BAND_S)),
              width: pct(BAND_S * 2),
              top: bandTop + 1,
              height: bandH - 1,
            }}
          />
        ))}

        {/* Items */}
        {lanes.map(({ lane, laneItems }) =>
          laneItems.map((item) => {
            const p = placed[item.id];
            const media = mediaFor(item);
            const label = shortLabel(item);
            const clipped = label !== item.label;
            const Icon = LANE_ICON[lane.id];
            const box = itemBox(item);
            return (
              <button
                key={item.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(item.id, el);
                  else itemRefs.current.delete(item.id);
                }}
                type="button"
                data-no-scrub
                onClick={() => onSelect(item.id)}
                aria-label={`${lane.label}: ${item.label}${item.flag === "missing" ? " (missing)" : ""}`}
                className={cn(
                  "group absolute z-10 flex items-center gap-2 whitespace-nowrap rounded-md pr-3 text-left text-sm transition-[box-shadow,background-color]",
                  media?.kind === "video" ? "pl-1" : "pl-2.5",
                  item.flag === "missing"
                    ? "border border-dashed border-missing/80 bg-missing/[0.08] text-foreground"
                    : "border border-white/10 bg-[#22222a] text-foreground hover:bg-[#292932]",
                  item.flag === "conflict" && "border-contradiction/60",
                  selectedId === item.id && "ring-2 ring-gold/80",
                  fresh.has(item.id) && "lx-slide-in",
                  !ready && "invisible",
                )}
                style={{
                  left: p ? p.left : pct(item.start),
                  width: p ? p.width : undefined,
                  top: box ? box.top : laneOf[item.lane].top + LANE_PAD,
                  height: ITEM_H,
                }}
              >
                {media?.kind === "video" ? (
                  <FrameThumb src={media.frame} className="h-7 w-12 shrink-0 rounded-[4px]" />
                ) : item.flag === "missing" ? (
                  <CircleDashed className="size-4 shrink-0 text-missing" aria-hidden />
                ) : (
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      item.flag === "conflict" ? "text-contradiction" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                )}
                <span>{label}</span>
                {item.flag === "agrees" && item.relatedId && (
                  <span
                    className="ml-auto size-1.5 shrink-0 rounded-full bg-corroborate"
                    aria-hidden
                  />
                )}
                {clipped && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-0 z-40 mb-1.5 hidden w-max max-w-[22rem] whitespace-normal rounded-md border bg-popover px-2.5 py-1.5 text-sm text-popover-foreground shadow-lg group-hover:block group-focus-visible:block"
                  >
                    {item.label}
                  </span>
                )}
              </button>
            );
          }),
        )}

        {/* Conflict connectors and their pills, over the items */}
        {conflicts.length > 0 && (
          <svg
            className="pointer-events-none absolute inset-0 z-20 overflow-visible"
            width={trackW}
            height={y}
            aria-hidden
          >
            {conflicts.map(({ c, path }) => (
              <path
                key={`line-${c.id}`}
                d={path}
                fill="none"
                stroke="var(--contradiction)"
                strokeWidth={1.75}
                strokeLinecap="round"
                pathLength={1}
                className="lx-draw"
                style={{ ["--len" as string]: 1 }}
              />
            ))}
          </svg>
        )}
        {conflicts.map(({ c, pillX, pillY, pulsing }) => (
          <button
            key={`pill-${c.id}`}
            type="button"
            data-no-scrub
            onClick={() => onOpenConflict(c)}
            className="absolute z-30 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-contradiction/60 bg-[#2a1517] px-2.5 py-0.5 text-sm font-medium text-[#ff8f92] shadow-md transition-colors hover:bg-[#3a1b1e]"
            style={{ left: pillX, top: pillY, animation: "lx-fade .3s ease-out .7s both" }}
          >
            {pulsing && (
              <span
                className="lx-pulse mr-1.5 inline-block size-1.5 rounded-full bg-contradiction align-middle"
                aria-hidden
              />
            )}
            Possible conflict
          </button>
        ))}

        {/* Playhead */}
        <div
          className="pointer-events-none absolute inset-y-0 z-30 w-0"
          style={{ left: pct(playhead) }}
        >
          <span
            className="absolute bottom-0 left-0 w-px -translate-x-1/2 bg-gold"
            style={{ top: TICK_H - 6 }}
          />
          <button
            type="button"
            role="slider"
            aria-label="Playhead"
            aria-valuemin={0}
            aria-valuemax={AXIS_END}
            aria-valuenow={playhead}
            aria-valuetext={formatTime(playhead)}
            className="pointer-events-auto absolute top-0 -translate-x-1/2 cursor-grab rounded bg-gold px-1.5 py-px font-mono text-[13px] font-semibold leading-5 text-[#14120d] active:cursor-grabbing"
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
