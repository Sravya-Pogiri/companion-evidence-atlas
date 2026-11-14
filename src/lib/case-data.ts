// Centralized, strongly typed SIMULATED demo data. Replace with API calls later.
export type EvidenceType = "pdf" | "video" | "audio" | "image";
export type ProcessingStatus = "uploading" | "extracting" | "transcribing" | "analyzing" | "completed" | "failed" | "linked";
export type Verification = "unverified" | "verified" | "dismissed";

export interface Evidence {
  id: string; name: string; type: EvidenceType; size: string; uploaded: string;
  status: ProcessingStatus; category: string; pages?: number; duration?: string; excerpt: string;
}
export interface Finding {
  id: string; kind: "contradiction" | "lead" | "missing"; title: string; description: string;
  a: { source: string; loc: string; text: string; highlight: string };
  b?: { source: string; loc: string; text: string; highlight: string };
  status: Verification; severity: "high" | "medium" | "low";
}
export interface TimelineEvent {
  id: string; time: string; label: string; source: string; sourceType: EvidenceType;
  people: string[]; type: "incident" | "police" | "call" | "statement"; conflict?: boolean; uncertain?: boolean; detail: string;
}
export interface MissingItem {
  id: string; title: string; referencedBy: string; relevance: string; action: string;
  status: "not requested" | "requested" | "received"; notes: string;
}
export interface CaseSummary { id: string; name: string; evidence: number; progress: number; status: "Active" | "Review" | "Discovery" | "Trial prep"; nextCourtDate: string; courtType: "Arraignment" | "Suppression hearing" | "Trial" | "Pretrial conference"; filingDeadline: string; filingDescription: string; outstandingRequests: number; unverifiedFindings: number; openTasks: number; }

export const DEMO_CASE = { id: "5CIR-25-30650", name: "Rosales v. Terrell", charge: "Civil-rights claim (traffic stop, 2022)", court: "U.S. Court of Appeals, Fifth Circuit" };

const COMPLAINT = "https://ij.org/wp-content/uploads/2022/10/LA-Rosales-Traffic-Stop-Complaint.pdf#page=24";
const OPINION = "https://www.govinfo.gov/content/pkg/USCOURTS-ca5-25-30650/pdf/USCOURTS-ca5-25-30650-0.pdf#page=11";
export const sourceLinks = {
  complaint: COMPLAINT, opinion: OPINION,
  bodycam: "https://www.youtube.com/watch?v=Z6z35SUVpdQ&t=45s",
  dashcam: "https://www.youtube.com/watch?v=xqvFJ8yzDfw&t=45s",
} as const;

export interface CaseRecord {
  id: string; name: string; kind: "public-record"; summary: string; question: string;
  sources: number; status: "Public-record walkthrough"; to: "/rosales"; cta: string;
}

// Only the real public-record case. Users add further cases one by one.
export const cases: CaseRecord[] = [
  { id: "5CIR-25-30650", name: "Rosales v. Terrell", kind: "public-record", sources: 4, status: "Public-record walkthrough", to: "/rosales", cta: "Open walkthrough",
    summary: "2022 traffic stop in Alexandria, Louisiana. Officer stated the reason as failure to signal.",
    question: "Was the left signal on at least 100 feet before the turn?" },
];

// Public sources linked by the user. Not uploaded or analyzed by CaseLens; reviewed by link.
export const evidence: Evidence[] = [
  { id: "e1", name: "Filed complaint (p. 24, para. 208)", type: "pdf", size: "Public link", uploaded: "Linked Nov 14, 2026", status: "linked", category: "Court filing", pages: 1, excerpt: "Officer's stated reason for the stop: failure to signal. Source: " + COMPLAINT },
  { id: "e2", name: "Officer bodycam (YouTube)", type: "video", size: "Public link", uploaded: "Linked Nov 14, 2026", status: "linked", category: "Video", duration: "from 0:45", excerpt: "The Mustang approaches and turns left. Review the intersection from about 0:45 (exact second not yet pinned)." },
  { id: "e3", name: "Dashcam (YouTube)", type: "video", size: "Public link", uploaded: "Linked Nov 14, 2026", status: "linked", category: "Video", duration: "from 0:45", excerpt: "Second angle of the approach and turn. Review from about 0:45 (exact second not yet pinned)." },
  { id: "e4", name: "Fifth Circuit opinion (p. 11)", type: "pdf", size: "Public link", uploaded: "Linked Nov 14, 2026", status: "linked", category: "Court opinion", pages: 1, excerpt: "The court describes the left signal as already on when the Mustang came into view, and leaves open when it was activated. Source: " + OPINION },
];

export const findings: Finding[] = [
  { id: "f1", kind: "contradiction", severity: "high", status: "unverified", title: "Signal visible before turn",
    description: "The officer's stated reason was failure to signal, while the footage appears to show the left signal already on when the car comes into view. Potential discrepancy; requires attorney review of the footage.",
    a: { source: "Filed complaint", loc: "Page 24, para. 208", text: "Officer's stated reason for the stop: failure to signal.", highlight: "failure to signal" },
    b: { source: "Officer bodycam", loc: "From about 0:45", text: "The Mustang's left signal appears to be on as it approaches the intersection and turns left.", highlight: "left signal appears to be on" } },
  { id: "f2", kind: "missing", severity: "high", status: "unverified", title: "Activation point unresolved",
    description: "The footage does not show when the signal was switched on, so it cannot establish whether it was on for at least 100 feet before the turn. CaseLens treats this as unresolved, not as a finding either way.",
    a: { source: "Fifth Circuit opinion", loc: "Page 11", text: "The signal is visible when the car comes into view; the point at which it was activated is not shown.", highlight: "not shown" } },
];

export const timeline: TimelineEvent[] = [
  { id: "t1", time: "Unknown", label: "Left signal activated", source: "Fifth Circuit opinion", sourceType: "pdf", people: ["Mario Rosales"], type: "incident", uncertain: true, detail: "Not shown in the footage; activation point unresolved (p. 11)." },
  { id: "t2", time: "~0:45", label: "Mustang comes into view, signal on", source: "Officer bodycam", sourceType: "video", people: ["Mario Rosales"], type: "incident", detail: "Approximate video time; exact second not yet pinned." },
  { id: "t3", time: "~0:45+", label: "Mustang turns left", source: "Dashcam", sourceType: "video", people: ["Mario Rosales"], type: "incident", detail: "Approximate video time; exact second not yet pinned." },
  { id: "t4", time: "After turn", label: "Stop for failure to signal", source: "Filed complaint", sourceType: "pdf", people: ["Mario Rosales", "Officer Terrell"], type: "police", conflict: true, detail: "Stated reason, complaint p. 24, para. 208." },
];

export const missing: MissingItem[] = [
  { id: "m1", title: "Footage showing the signal activation point", referencedBy: "Fifth Circuit opinion · p. 11", relevance: "Only evidence of when the signal turned on can show whether it ran for 100 feet before the turn.", action: "Check whether any other camera or the full-length recordings cover the approach.", status: "not requested", notes: "" },
  { id: "m2", title: "Original video files", referencedBy: "Bodycam and dashcam links", relevance: "CaseLens can only analyze downloadable files, not YouTube links.", action: "Obtain the original files to run them through CaseLens.", status: "not requested", notes: "" },
];

export const activity = [
  { t: "Today", text: "Fifth Circuit opinion linked (p. 11)", case: "Rosales v. Terrell" },
  { t: "Today", text: "Bodycam and dashcam linked", case: "Rosales v. Terrell" },
  { t: "Today", text: "Filed complaint linked (p. 24)", case: "Rosales v. Terrell" },
];

export const reviewProgress = [
  { day: "Mon", reviewed: 0, flagged: 0 }, { day: "Tue", reviewed: 0, flagged: 0 }, { day: "Wed", reviewed: 0, flagged: 0 },
  { day: "Thu", reviewed: 0, flagged: 0 }, { day: "Fri", reviewed: 0, flagged: 0 }, { day: "Sat", reviewed: 4, flagged: 2 },
];

export const sources: Record<string, { source: string; loc: string; text: string }> = {
  "1": { source: "Filed complaint", loc: "Page 24, para. 208", text: "Officer's stated reason for the stop: failure to signal." },
  "2": { source: "Officer bodycam", loc: "From about 0:45", text: "The Mustang approaches with the left signal on and turns left." },
  "3": { source: "Dashcam", loc: "From about 0:45", text: "Second angle of the approach and turn." },
  "4": { source: "Fifth Circuit opinion", loc: "Page 11", text: "The signal is visible when the car comes into view; the activation point is unresolved." },
};

