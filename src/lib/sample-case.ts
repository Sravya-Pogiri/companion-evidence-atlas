import { DEMO_CASE, sourceLinks } from "@/lib/case-data";
import { ACTIVE_CASE } from "@/lib/active-case";
import { btkAxisLabel, btkTickLabel, buildBtkCase, BTK_LANES } from "@/lib/cases/btk";
import { loadAnalysis, seedFromAnalysis } from "@/lib/evidence/seed";
import { SPLIT_END, SPLIT_TICKS, fromAxis, splitLabel, splitTick, toAxis } from "@/lib/split-axis";

// One data set feeds Live Case, Review, and Handoff. Public sample only:
// Rosales v. Terrell (public footage and filings). Times on the shared axis are
// approximate because the exact second of each moment is not pinned.

export type Lane =
  | "bodycam"
  | "dashcam"
  | "dispatch"
  | "documents"
  | "events"
  // Lanes of the BTK case (dates, not seconds).
  | "incidents"
  | "investigation"
  | "court"
  | "gaps";
export type Flag = "agrees" | "conflict" | "missing";
export type ItemStatus = "pending" | "filed";
export type ReviewDecision = "confirmed" | "dismissed" | "follow-up";

export interface TimelineItem {
  id: string;
  lane: Lane;
  /** Seconds on the shared axis. */
  start: number;
  end: number;
  label: string;
  /** Up to about 28 characters for the timeline. Falls back to a shortened label. */
  short?: string;
  extractedText: string;
  sourceLink: string | null;
  sourceLabel: string;
  status: ItemStatus;
  flag: Flag;
  /** The item this one is compared against. */
  relatedId?: string;
  /** When it was filed through the message pipeline (ISO). Sample items have none. */
  filedAt?: string;
  /** When a person needs to have dealt with it by (ISO). Set by a person on Review. */
  dueAt?: string;
  /** A date in words ("Aug 2014"), for cases whose timeline is dated and not a video clip. */
  when?: string;
  /** A verified still for this item (from the evidence analysis), under /public. */
  frame?: string;
  /** A rendered image of the cited page, under /public. */
  page?: { src: string; page: number; file: string };
  /** For video items: the second in the source video (the axis may not be its clock). */
  videoAt?: number;
  /** A video clip that is not on YouTube (a local file under /public/media). */
  clip?: { src: string; file: string };
}

export interface ChatMessage {
  id: string;
  from: "team" | "agent";
  text: string;
  attachment?: "video" | "document" | "voice" | "image";
  /** Thumbnail for the attachment, when one exists (a frame or a rendered page). */
  preview?: string;
  itemId?: string;
}


/** The BTK case, when it is the open case (see active-case.ts). */
export const BTK = ACTIVE_CASE === "btk" ? buildBtkCase() : null;

const ROSALES_LANES: { id: Lane; label: string }[] = [
  { id: "bodycam", label: "Bodycam" },
  { id: "dashcam", label: "Dashcam" },
  { id: "dispatch", label: "Dispatch audio" },
  { id: "documents", label: "Documents" },
  { id: "events", label: "Events" },
];

export const LANES: { id: Lane; label: string }[] = BTK ? BTK_LANES : ROSALES_LANES;

export const VIDEOS = {
  bodycam: { id: "Z6z35SUVpdQ", label: "Officer bodycam" },
  dashcam: { id: "xqvFJ8yzDfw", label: "Dashcam" },
} as const;

const ANALYSIS_AXIS_END = SPLIT_END;

// The case the app opens with: verified findings from the evidence analysis when there are any
// (scripts/evidence/analyze.ts -> src/data/rosales/analysis.json), else the hand-written sample.
const SEED = (() => {
  const analysis = loadAnalysis("rosales");
  return analysis ? seedFromAnalysis(analysis, ANALYSIS_AXIS_END, toAxis) : null;
})();
/**
 * The shared axis. Hand-written sample: the dashcam clock, 0:00-1:30. Analysis: a split axis,
 * the dashcam approach then the whole bodycam, each on its own clock (split-axis.ts). BTK:
 * 0-90 as evenly spaced slots.
 */
const SPLIT = !BTK && SEED !== null;
export const AXIS_END = SPLIT ? ANALYSIS_AXIS_END : 90;
/** Where the axis ticks go. */
export const TICKS: number[] = SPLIT ? SPLIT_TICKS : [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

/** The second in `video` at a point on the axis, when the axis is split and that part is its. */
export function sourceTimeAt(axis: number, video: string): number | null {
  if (!SPLIT) return null;
  const at = fromAxis(axis);
  return at && at.source === video ? at.t : null;
}
export const FROM_ANALYSIS = SEED !== null;
// The first verified video moment, where the Live Case opens (else the approach at 0:45).
const FIRST_VIDEO = SEED?.items
  .filter((i) => (i.lane === "dashcam" || i.lane === "bodycam") && i.frame)
  .sort((a, b) => a.start - b.start)[0];
export const SAMPLE_CASE: {
  name: string;
  number: string;
  label: string;
  /** Where the playhead starts. */
  openAt: number;
  /** The line under the timeline about what the axis means. */
  axisNote: string;
} = BTK
  ? {
      name: "State of Kansas v. Rader",
      number: "05 CR 498",
      label: "Public evidence packet · citations checked",
      openAt: BTK.openAt,
      axisNote: "Drag the playhead to move through the case. Entries are in date order, evenly spaced and not to scale (1974 to 2005).",
    }
  : {
      name: DEMO_CASE.name,
      number: DEMO_CASE.id,
      // Says where the case data comes from: verified AI analysis, or the hand-written demo.
      label: FROM_ANALYSIS ? "AI analysis (verified) · public sources" : "Hand-written demo · public footage",
      openAt: FIRST_VIDEO?.start ?? 45,
      axisNote: SEED
        ? "Drag the playhead to move through the case. Left: the dashcam approach on the dashcam clock. Right: the whole bodycam on its own clock. The two clocks are not synced."
        : "Drag the playhead to move through the case. Times on the public sample are approximate.",
    };

// Times on the shared axis follow the public dashcam (the approach is at about 0:45 and the
// turn at about 0:58 in that video). The bodycam starts after the stop, so it sits later.
/** The hand-written sample, used when there is no verified analysis. */
export const SAMPLE_ITEMS: TimelineItem[] = [
  {
    id: "dashcam-approach", lane: "dashcam", start: 45, end: 55, status: "filed", flag: "agrees",
    label: "Mustang approaches, left signal appears on", short: "Mustang approaches",
    extractedText: "The red Mustang approaches the intersection ahead of the patrol car; the left signal appears to be on. Time is approximate.",
    sourceLink: sourceLinks.dashcam, sourceLabel: "Dashcam (public video, from about 0:45)",
  },
  {
    id: "bodycam-after-stop", lane: "bodycam", start: 64, end: 90, status: "filed", flag: "agrees",
    label: "Bodycam starts after the stop", short: "Starts after the stop",
    extractedText: "The bodycam shows the roadside scene after the stop. It does not show the approach or the turn, so it cannot speak to the signal either way.",
    sourceLink: sourceLinks.bodycam, sourceLabel: "Officer bodycam (public video, about 1:20)",
  },
  {
    id: "dispatch-missing", lane: "dispatch", start: 0, end: AXIS_END, status: "filed", flag: "missing",
    label: "No dispatch audio in the sample record", short: "No dispatch audio in record",
    extractedText: "No dispatch audio is linked for this sample case, so call timing cannot be compared with the footage.",
    sourceLink: null, sourceLabel: "Not in the sample record",
  },
  {
    id: "complaint-reason", lane: "documents", start: 45, end: 55, status: "filed", flag: "conflict", relatedId: "dashcam-approach",
    label: "Stated reason: failure to signal", short: "Stated reason: failure to signal",
    extractedText: "Officer's stated reason for the stop: failure to signal. (Filed complaint, page 24, para. 208, as alleged.)",
    sourceLink: sourceLinks.complaint, sourceLabel: "Filed complaint, page 24",
  },
  {
    id: "opinion-signal", lane: "documents", start: 45, end: 55, status: "filed", flag: "agrees", relatedId: "dashcam-approach",
    label: "Court: signal visible, activation not shown", short: "Court: signal visible",
    extractedText: "The signal is visible when the car comes into view; the point at which it was activated is not shown.",
    sourceLink: sourceLinks.opinion, sourceLabel: "Fifth Circuit opinion, page 11",
  },
  {
    id: "activation-missing", lane: "events", start: 30, end: 45, status: "filed", flag: "missing",
    label: "Signal activation not shown",
    extractedText: "The footage does not show when the signal was switched on, so it cannot show whether it was on for at least 100 feet before the turn. The interval is approximate.",
    sourceLink: sourceLinks.opinion, sourceLabel: "Fifth Circuit opinion, page 11",
  },
  {
    id: "turn-left", lane: "events", start: 56, end: 62, status: "filed", flag: "agrees", relatedId: "dashcam-approach",
    label: "Mustang turns left",
    extractedText: "The Mustang turns left at the intersection. Time is approximate.",
    sourceLink: `${sourceLinks.dashcam.split("&t=")[0]}&t=58s`, sourceLabel: "Dashcam (public video, about 0:58)",
  },
];

// Seed transcript: what the team and the agent already said before the live demo starts.
export const SAMPLE_CONVERSATION: ChatMessage[] = [
  { id: "m1", from: "team", attachment: "video", text: "Dashcam clip, from 0:45", itemId: "dashcam-approach" },
  { id: "m2", from: "agent", text: "File this as Dashcam: Mustang approaches, left signal appears on? Reply Y.", itemId: "dashcam-approach" },
  { id: "m3", from: "team", text: "Y" },
  { id: "m4", from: "team", attachment: "document", text: "Complaint, page 24", itemId: "complaint-reason" },
  { id: "m5", from: "agent", text: "Filed. Possible conflict: the complaint says failure to signal, and the dashcam appears to show the left signal on at about 0:45. Review?", itemId: "complaint-reason" },
  { id: "m6", from: "team", attachment: "video", text: "Bodycam clip, from 1:20", itemId: "bodycam-after-stop" },
  { id: "m7", from: "agent", text: "Filed. The bodycam starts after the stop, so it does not show the approach or the turn.", itemId: "bodycam-after-stop" },
  { id: "m8", from: "team", text: "What's missing?" },
  { id: "m9", from: "agent", text: "Possible gaps: no dispatch audio in the record, and the signal activation point is not shown (opinion, page 11).", itemId: "activation-missing" },
];




export const FLAG_LABEL: Record<Flag, string> = {
  agrees: "Agrees",
  conflict: "Possible conflict",
  missing: "Possible gap",
};

export const DECISION_LABEL: Record<ReviewDecision, string> = {
  confirmed: "Confirmed",
  dismissed: "Dismissed",
  "follow-up": "Needs follow-up",
};

/** A point on the shared axis: m:ss for the video case, the entry's date for the BTK case. */
export function formatTime(seconds: number): string {
  if (BTK) return btkAxisLabel(seconds);
  if (SPLIT) return splitLabel(seconds);
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Seconds in a source video as m:ss (not an axis position). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** A tick label on the axis. */
export function formatTick(seconds: number): string {
  return BTK ? btkTickLabel(seconds) : SPLIT ? splitTick(seconds) : formatTime(seconds);
}

export function formatRange(item: Pick<TimelineItem, "start" | "end"> & { when?: string }): string {
  // Dated cases (the landing page's case library) carry their date in words.
  if (item.when) return item.when;
  if (BTK) return formatTime((item.start + item.end) / 2);
  return `~${formatTime(item.start)} to ~${formatTime(item.end)}`;
}

export function itemsAt(items: TimelineItem[], t: number): TimelineItem[] {
  return items.filter((i) => t >= i.start && t <= i.end);
}

/** Stack overlapping items in one lane into rows. */
export function layoutLane(items: TimelineItem[]): { rows: number; rowOf: Record<string, number> } {
  const rowEnds: number[] = [];
  const rowOf: Record<string, number> = {};
  for (const item of [...items].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
    let row = rowEnds.findIndex((end) => end <= item.start);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = item.end;
    rowOf[item.id] = row;
  }
  return { rows: Math.max(1, rowEnds.length), rowOf };
}

const FLAG_RANK: Record<Flag, number> = { conflict: 0, missing: 1, agrees: 2 };

/** Items a person needs to look at: conflicts, gaps, and anything still pending. */
export function reviewQueue(items: TimelineItem[]): TimelineItem[] {
  return items
    .filter((i) => i.flag !== "agrees" || i.status === "pending")
    .sort((a, b) => FLAG_RANK[a.flag] - FLAG_RANK[b.flag] || a.start - b.start || a.id.localeCompare(b.id));
}

/** Only items a person confirmed go to the attorney. */
export function handoffItems(items: TimelineItem[], decisions: Record<string, ReviewDecision>): TimelineItem[] {
  return items
    .filter((i) => decisions[i.id] === "confirmed")
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}

/** The timeline label: the short form, or the label cut at a word boundary. */
export function shortLabel(item: Pick<TimelineItem, "label" | "short">, max = 28): string {
  if (item.short) return item.short;
  if (item.label.length <= max) return item.label;
  const cut = item.label.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 12 ? cut.slice(0, space) : item.label.slice(0, max)).replace(/[,;:\s]+$/, "")}…`;
}

export function findItem(items: TimelineItem[], id: string | undefined): TimelineItem | undefined {
  return id ? items.find((i) => i.id === id) : undefined;
}

export const ITEMS: TimelineItem[] = BTK?.items ?? SEED?.items ?? SAMPLE_ITEMS;
export const CONVERSATION: ChatMessage[] = BTK?.conversation ?? SEED?.conversation ?? SAMPLE_CONVERSATION;
export const ANALYSIS_CLAIMS = BTK ? {} : (SEED?.claimsByItem ?? {});
/** Verified findings between documents only (no video moment), shown in the Flag step. */
export const DOC_FINDINGS: { id: string; kind: "conflict" | "agrees" | "missing"; title: string; explanation: string; reviewed?: string }[] = BTK
  ? BTK.findings
  : (SEED?.docFindings ?? []);
/** The Rosales document-only findings with the claims they rest on. */
export const ROSALES_DOC_FINDINGS = BTK ? [] : (SEED?.docFindings ?? []);
