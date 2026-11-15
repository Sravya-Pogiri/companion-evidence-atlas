// The Rosales analysis timeline: one axis in two parts, each on its own camera's clock.
//   left   the dashcam approach and turn, dashcam 0:30 to 1:50
//   right  the whole bodycam, bodycam 0:00 to 21:21
// The two clocks are not synced (the bodycam starts after the stop and nothing in the record
// gives the offset), so the parts sit side by side instead of on one invented clock.

export interface Segment {
  source: string;
  label: string;
  /** Axis units covered. */
  from: number;
  to: number;
  /** Seconds of the source video covered. */
  t0: number;
  t1: number;
}

export const SPLIT_END = 120;

export const SEGMENTS: Segment[] = [
  { source: "dashcam", label: "Dashcam", from: 0, to: 40, t0: 30, t1: 110 },
  { source: "bodycam", label: "Bodycam", from: 44, to: 120, t0: 0, t1: 1281 },
];

/** Where a moment of a video sits on the axis, or null when that part does not cover it. */
export function toAxis(source: string, t: number): number | null {
  const s = SEGMENTS.find((x) => x.source === source);
  if (!s || t < s.t0 || t > s.t1) return null;
  return Math.round((s.from + ((t - s.t0) / (s.t1 - s.t0)) * (s.to - s.from)) * 10) / 10;
}

/** The video and second at a point on the axis; null in the gap between the parts. */
export function fromAxis(x: number): { source: string; t: number } | null {
  const s = SEGMENTS.find((seg) => x >= seg.from && x <= seg.to);
  if (!s) return null;
  return { source: s.source, t: s.t0 + ((x - s.from) / (s.to - s.from)) * (s.t1 - s.t0) };
}

const mmss = (t: number) => {
  const s = Math.max(0, Math.round(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** A point on the axis as its camera's time ("8:40"); a dash in the gap. */
export function splitLabel(x: number): string {
  const at = fromAxis(x);
  return at ? mmss(at.t) : "–";
}

/** Tick positions: two in the dashcam part, five in the bodycam part. */
export const SPLIT_TICKS = [0, 20, 44, 63, 82, 101, 120];

/** Tick labels name the camera at the start of each part. */
export function splitTick(x: number): string {
  const s = SEGMENTS.find((seg) => seg.from === x);
  return s ? `${s.label} ${splitLabel(x)}` : splitLabel(x);
}
