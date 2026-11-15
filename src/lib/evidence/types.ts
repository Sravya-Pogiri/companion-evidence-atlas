// Shapes for the evidence analysis: claims pulled from each source, findings that compare them,
// and how each was verified. Produced offline by scripts/evidence/analyze.ts.

export type SourceKind = "pdf" | "video";

export interface SourceMeta {
  id: string;
  kind: SourceKind;
  label: string;
  url: string;
  sha256: string;
  pages?: number;
  duration?: number;
}

/** Where a claim comes from. Documents cite a page (and paragraph); media cite a second. */
export type Locator =
  | { source: string; page: number; paragraph?: number }
  | { source: string; t: number };

export type ClaimOrigin = "document" | "transcript" | "video";

export interface Claim {
  id: string;
  origin: ClaimOrigin;
  claim: string;
  /** Event time as the source states it, if any (e.g. "about 0:45", "Feb 2022"). */
  eventTime?: string;
  actor?: string;
  location?: string;
  at: Locator;
  /** Documents and transcripts: the words, exactly as they appear. */
  exactQuote?: string;
  /** Video: the cited frame, under /public. */
  frameRef?: string;
  verification: Verification;
}

export type VerificationStatus = "passed" | "fixed" | "failed" | "unchecked";

export interface Verification {
  status: VerificationStatus;
  method: "quote-on-page" | "quote-in-transcript" | "second-vision-check" | "none";
  note?: string;
}

export type FindingKind = "conflict" | "agrees" | "missing";

export interface Finding {
  id: string;
  kind: FindingKind;
  title: string;
  /** Hedged, one or two sentences. Never a legal conclusion. */
  explanation: string;
  claimIds: string[];
  status: "verified" | "dropped";
  droppedBecause?: string;
}

export interface CaseAnalysis {
  caseId: string;
  generatedAt: string;
  models: { text: string; vision: string; audio: string };
  timings: Record<string, number>;
  sources: SourceMeta[];
  claims: Claim[];
  findings: Finding[];
  log: string[];
}
