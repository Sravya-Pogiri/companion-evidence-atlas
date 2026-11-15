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
  label: "Sample case · public footage",
} as const;

// Times on the shared axis follow the public dashcam (the approach is at about 0:45 and the
// turn at about 0:58 in that video). The bodycam starts after the stop, so it sits later.
export const ITEMS: TimelineItem[] = [
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
export const CONVERSATION: ChatMessage[] = [
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
