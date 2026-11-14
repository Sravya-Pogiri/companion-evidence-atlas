import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Film, Pause, Play } from "lucide-react";
import { evidence, timeline, type TimelineEvent } from "@/lib/case-data";
import { typeIcon } from "./shared";
import { cn } from "@/lib/utils";

const START = 20 * 60, END = 21 * 60 + 30;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
const pct = (m: number) => ((m - START) / (END - START)) * 100;
const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const ticks = Array.from({ length: 10 }, (_, i) => START + i * 10);
// Recording coverage windows per source (simulated)
const coverage: Record<string, [number, number][]> = {
  "Surveillance_Footage.mp4": [[START, START + 42]], "Bodycam_Officer_01.mp4": [[20 * 60 + 25, 21 * 60 + 33]], "Emergency_Call.mp3": [[20 * 60 + 17, 20 * 60 + 22]],
};

export function Swimlane({ events, onOpen }: { events: TimelineEvent[]; onOpen: (e: TimelineEvent) => void }) {
  const [head, setHead] = useState(20 * 60 + 15);
  const [playing, setPlaying] = useState(false);
  const track = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const seek = (clientX: number) => { const r = track.current!.getBoundingClientRect(); setHead(Math.max(START, Math.min(END, START + ((clientX - r.left) / r.width) * (END - START)))); };
  const play = () => {
    if (playing) { if (timer.current) clearInterval(timer.current); setPlaying(false); return; }
    setPlaying(true); timer.current = setInterval(() => setHead((h) => (h >= END ? START : h + 0.5)), 120);
  };
  const near = [...timeline].sort((a, b) => Math.abs(toMin(a.time) - head) - Math.abs(toMin(b.time) - head))[0]!;
  const step = (d: 1 | -1) => { const sorted = timeline.map((t) => toMin(t.time)).sort((a, b) => a - b); const n = d > 0 ? sorted.find((m) => m > head + 0.1) : [...sorted].reverse().find((m) => m < head - 0.1); if (n !== undefined) setHead(n); };
  const I = typeIcon[near.sourceType];

  return (
    <div className="mb-8 overflow-hidden rounded-lg border bg-navy text-ivory">
      <div className="grid lg:grid-cols-[1fr_300px]">
        <div className="relative aspect-[16/5] border-b border-ivory/10 bg-navy-2/40 lg:border-r">
          <div className="absolute inset-0 grid-bg opacity-60" />
          <div className="absolute left-3 top-3 rounded border border-gold/60 px-2 py-0.5 font-mono text-[11px] text-gold">{near.source} · {fmt(head)}</div>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div><Film className="mx-auto h-8 w-8 text-ivory/30" /><p className="mt-2 text-sm text-ivory/50">Source preview placeholder</p><p className="font-serif text-lg">{near.label}</p></div>
          </div>
          {near.conflict && <div className="absolute bottom-3 left-3 rounded bg-contradiction px-2 py-0.5 text-[11px] font-medium">Conflicting timestamp — see Finding 1</div>}
        </div>
        <div className="space-y-3 p-4 text-sm">
          <p className="text-[10px] uppercase tracking-[0.2em] text-gold">Nearest event</p>
          <div className="flex items-center gap-2"><I className="h-4 w-4 text-gold" /><span className="font-semibold">{near.label}</span></div>
          <p className="text-ivory/70">{near.detail}</p>
          <p className="text-xs text-ivory/50">{near.people.join(", ")}</p>
          <button onClick={() => onOpen(near)} className="rounded border border-gold/60 px-3 py-1.5 text-xs text-gold hover:bg-gold hover:text-navy">Open supporting evidence</button>
        </div>
      </div>
      <div className="flex items-center gap-3 border-b border-ivory/10 px-4 py-2 text-sm">
        <span className="font-semibold">Timeline</span>
        <button aria-label="Previous event" onClick={() => step(-1)} className="rounded p-1 hover:bg-ivory/10"><ChevronLeft className="h-4 w-4" /></button>
        <button aria-label={playing ? "Pause" : "Play"} onClick={play} className="rounded p-1 hover:bg-ivory/10">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</button>
        <button aria-label="Next event" onClick={() => step(1)} className="rounded p-1 hover:bg-ivory/10"><ChevronRight className="h-4 w-4" /></button>
        <span className="ml-auto font-mono text-xs text-gold">{fmt(head)}</span>
      </div>
      <div className="flex">
        <div className="w-48 shrink-0 border-r border-ivory/10 pt-7 text-xs">
          {evidence.map((e) => { const EI = typeIcon[e.type]; return <div key={e.id} className="flex h-9 items-center gap-2 px-3"><EI className="h-3.5 w-3.5 text-gold" /><span className="truncate">{e.name}</span></div>; })}
        </div>
        <div ref={track} className="relative flex-1 cursor-crosshair select-none" onMouseDown={(e) => seek(e.clientX)} onMouseMove={(e) => e.buttons === 1 && seek(e.clientX)}>
          <div className="relative h-7 border-b border-ivory/10">
            {ticks.map((t) => <span key={t} className="absolute top-1.5 -translate-x-1/2 font-mono text-[10px] text-ivory/50" style={{ left: `${pct(t)}%` }}>{fmt(t)}</span>)}
          </div>
          {evidence.map((e) => (
            <div key={e.id} className="relative h-9 border-b border-ivory/5">
              {(coverage[e.name] ?? []).map(([a, b], i) => <div key={i} className="absolute top-2 h-5 rounded-sm bg-corroborate/25" style={{ left: `${pct(a)}%`, width: `${pct(Math.min(b, END)) - pct(a)}%` }} />)}
              {events.filter((t) => t.source === e.name).map((t) => (
                <button key={t.id} title={`${t.time} · ${t.label}`} onMouseDown={(ev) => ev.stopPropagation()} onClick={() => { setHead(toMin(t.time)); onOpen(t); }}
                  className={cn("absolute top-1.5 h-6 w-2.5 -translate-x-1/2 rounded-sm ring-1 ring-navy hover:scale-125", t.conflict ? "bg-contradiction" : t.uncertain ? "border border-dashed border-missing bg-missing/40" : "bg-gold")}
                  style={{ left: `${pct(toMin(t.time))}%` }} />
              ))}
            </div>
          ))}
          <div className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-gold" style={{ left: `${pct(head)}%` }}><span className="absolute -left-1.5 top-0 h-3 w-3.5 rounded-b bg-gold" /></div>
        </div>
      </div>
      <div className="flex gap-4 px-4 py-2 text-[11px] text-ivory/60">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-gold" />Event</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-contradiction" />Conflicting timestamp</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm border border-dashed border-missing" />Uncertain ordering</span>
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-corroborate/40" />Recording coverage (simulated)</span>
      </div>
    </div>
  );
}
