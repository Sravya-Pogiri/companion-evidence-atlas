import { DEMO_CASE, sourceLinks } from "@/lib/case-data";

// One data set feeds Live Case, Review, and Handoff. Public sample only:
// Rosales v. Terrell (public footage and filings). Times on the shared axis are
// approximate because the exact second of each moment is not pinned.

export type Lane = "bodycam" | "dashcam" | "dispatch" | "documents" | "events";
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
  extractedText: string;
  sourceLink: string | null;
  sourceLabel: string;
  status: ItemStatus;
  flag: Flag;
  /** The item this one is compared against. */
  relatedId?: string;
}

export interface ChatMessage {
  id: string;
  from: "team" | "agent";
  text: string;
  attachment?: "video" | "document" | "voice" | "image";
  itemId?: string;
}

export const AXIS_END = 90;

export const LANES: { id: Lane; label: string }[] = [
  { id: "bodycam", label: "Bodycam" },
  { id: "dashcam", label: "Dashcam" },
  { id: "dispatch", label: "Dispatch audio" },
  { id: "documents", label: "Documents" },
  { id: "events", label: "Events" },
];

export const VIDEOS = {
  bodycam: { id: "Z6z35SUVpdQ", label: "Officer bodycam" },
  dashcam: { id: "xqvFJ8yzDfw", label: "Dashcam" },
} as const;

export const SAMPLE_CASE = {
  name: DEMO_CASE.name,
  number: DEMO_CASE.id,
  label: "Sample case, public footage.",
} as const;

export const ITEMS: TimelineItem[] = [
  {
    id: "bodycam-approach", lane: "bodycam", start: 45, end: 60, status: "filed", flag: "agrees",
    label: "Mustang approaches, left signal appears on",
    extractedText: "The Mustang's left signal appears to be on as it approaches the intersection and turns left. Time is approximate.",
    sourceLink: sourceLinks.bodycam, sourceLabel: "Officer bodycam (public video, from about 0:45)",
  },
  {
    id: "dashcam-approach", lane: "dashcam", start: 45, end: 60, status: "filed", flag: "agrees", relatedId: "bodycam-approach",
    label: "Second angle of the approach and turn",
    extractedText: "Second angle of the approach and turn. It appears consistent with the bodycam on the approach. Time is approximate.",
    sourceLink: sourceLinks.dashcam, sourceLabel: "Dashcam (public video, from about 0:45)",
  },
  {
    id: "dispatch-missing", lane: "dispatch", start: 0, end: AXIS_END, status: "filed", flag: "missing",
    label: "No dispatch audio in the sample record",
    extractedText: "No dispatch audio is linked for this sample case, so call timing cannot be compared with the footage.",
    sourceLink: null, sourceLabel: "Not in the sample record",
  },
  {
    id: "complaint-reason", lane: "documents", start: 45, end: 60, status: "filed", flag: "conflict", relatedId: "bodycam-approach",
    label: "Stated reason: failure to signal",
    extractedText: "Officer's stated reason for the stop: failure to signal. (Filed complaint, page 24, para. 208, as alleged.)",
    sourceLink: sourceLinks.complaint, sourceLabel: "Filed complaint, page 24",
  },
  {
    id: "opinion-signal", lane: "documents", start: 45, end: 60, status: "filed", flag: "agrees", relatedId: "bodycam-approach",
    label: "Court: signal visible, activation not shown",
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
    id: "turn-left", lane: "events", start: 55, end: 60, status: "filed", flag: "agrees", relatedId: "dashcam-approach",
    label: "Mustang turns left",
    extractedText: "The Mustang turns left at the intersection. Time is approximate.",
    sourceLink: sourceLinks.dashcam, sourceLabel: "Dashcam (public video)",
  },
];

// Simulated until Phase 3: the transcript the team and the agent would have had.
export const CONVERSATION: ChatMessage[] = [
  { id: "m1", from: "team", attachment: "video", text: "Bodycam clip, from 0:45", itemId: "bodycam-approach" },
  { id: "m2", from: "agent", text: "File this as Bodycam: Mustang approaches, left signal appears on? Reply Y.", itemId: "bodycam-approach" },
  { id: "m3", from: "team", text: "Y" },
  { id: "m4", from: "team", attachment: "document", text: "Complaint, page 24", itemId: "complaint-reason" },
  { id: "m5", from: "agent", text: "Filed. Possible conflict: the complaint says failure to signal, and the bodycam appears to show the left signal on at about 0:45. Review?", itemId: "complaint-reason" },
  { id: "m6", from: "team", attachment: "video", text: "Dashcam clip, from 0:45", itemId: "dashcam-approach" },
  { id: "m7", from: "agent", text: "Filed. The dashcam appears consistent with the bodycam on the approach.", itemId: "dashcam-approach" },
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

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatRange(item: Pick<TimelineItem, "start" | "end">): string {
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

export function findItem(items: TimelineItem[], id: string | undefined): TimelineItem | undefined {
  return id ? items.find((i) => i.id === id) : undefined;
}
