// The claim investigation's wire format (services/investigator/src/claim.ts), for the browser.
// The service validates requests with zod and checks every quote against the stored evidence.

export type Finding = "supported" | "challenged" | "ambiguous" | "insufficient_evidence";
export type AgentName = "Lead Investigator" | "Timeline Researcher" | "Evidence Reviewer" | "Verifier" | "System";

export interface Activity {
  id: string;
  /** Seconds since the investigation started. */
  at: number;
  agent: AgentName;
  kind: "plan" | "delegate" | "tool" | "report" | "verify" | "finding" | "model" | "error";
  title: string;
  detail?: string;
  status: "running" | "done" | "failed";
  evidenceIds?: string[];
  ref?: string;
}

export interface ClaimCitation {
  evidence_id: string;
  source_id: string;
  source_title: string;
  page: number;
  /** Where the record sits: "PDF p.42", "bodycam 8:00–9:00", "recorded metadata". */
  location: string;
  quote: string;
  role: "supports" | "challenges" | "context";
  verified: boolean;
  check: string;
  context: string;
  url: string | null;
  method: string;
  /** A still, for frame records. */
  frame: string | null;
}

export interface TimelineEvent {
  evidence_id: string;
  date: string;
  time_type: string;
  label: string;
  quote: string;
  discrepancy: string | null;
  verified: boolean;
  check: string;
  source_title: string;
  page: number | null;
  location: string | null;
}

export interface ClaimResult {
  investigation_id: string;
  case_id: string;
  claim: string;
  finding: Finding;
  explanation: string;
  timeline_events: TimelineEvent[];
  citations: ClaimCitation[];
  open_questions: string[];
  agent_activity: Activity[];
  verification: { citations: number; verified: number; events: number; events_verified: number; note: string };
  model: string;
  duration_s: number;
}

export type StreamLine =
  | { type: "activity"; event: Activity }
  | { type: "result"; result: ClaimResult }
  | { type: "error"; message: string };
