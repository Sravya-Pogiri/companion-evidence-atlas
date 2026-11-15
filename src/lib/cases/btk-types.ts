// Shapes of the BTK public evidence packet (CaseLens_BTK_Case_Packet.json) and of the checked
// analysis built from it (scripts/evidence/btk-analyze.ts -> src/data/btk/packet-analysis.json).

export interface PacketCitation {
  source_id: string;
  pdf_page?: number;
  pdf_page_end?: number;
  section?: string;
}

export interface PacketSource {
  id: string;
  title: string;
  type: string;
  origin: string;
  url: string;
  note?: string;
  path?: string;
  availability: "included" | "external_link";
  pages?: number;
}

export interface Packet {
  cases: {
    id: string;
    title: string;
    case_number: string;
    jurisdiction: string;
    question: string;
    sources: PacketSource[];
    entities: { id: string; type: string; label: string }[];
    evidence: {
      id: string;
      type: string;
      description: string;
      limitation: string;
      citations: PacketCitation[];
      entity_ids: string[];
    }[];
    timeline: {
      id: string;
      date: string;
      end_date?: string;
      precision: string;
      event: string;
      date_note?: string;
      citations: PacketCitation[];
      evidence_ids: string[];
      entity_ids: string[];
    }[];
    relationships: { from: string; type: string; to: string; evidence_ids: string[]; qualification?: string }[];
    hypotheses: { id: string; statement: string; status: string; evidence_ids: string[]; limitation: string }[];
    raw_artifact_gaps: { artifact: string; availability: string; why: string; request_via: string[]; evidence_ids: string[] }[];
  }[];
}

export interface CheckedCitation {
  source: string;
  page?: number;
  pageEnd?: number;
  section?: string;
  /** Quotes found, in code, on the cited page's text. */
  quotes: { text: string; page: number; method: string }[];
  /** passed: a supporting quote was found on the page; partial: it backs part of the statement;
   * failed: no quote could be found there; unchecked: the packet has no text for this source. */
  status: "passed" | "partial" | "failed" | "unchecked";
  note?: string;
}

export type CheckStatus = "verified" | "partial" | "unverified";

export interface BtkAnalysis {
  caseId: "btk";
  generatedAt: string;
  model: string;
  observations: {
    id: string;
    type: string;
    description: string;
    limitation: string;
    entityIds: string[];
    citations: CheckedCitation[];
    status: CheckStatus;
  }[];
  events: {
    id: string;
    date: string;
    endDate?: string;
    precision: string;
    event: string;
    dateNote?: string;
    evidenceIds: string[];
    citations: CheckedCitation[];
    status: CheckStatus;
  }[];
  /** Observations backed by verified quotes from two or more different sources. */
  agreements: { observationId: string; sources: string[] }[];
  gaps: { artifact: string; availability: string; why: string; evidenceIds: string[] }[];
  hypotheses: { id: string; statement: string; status: string; evidence_ids: string[]; limitation: string }[];
  /** The packet's test: with the disk-metadata lead turned off, which links remain. */
  attribution: {
    disabled: string[];
    streams: { from: string; type: string; to: string; evidenceIds: string[] }[];
    lost: { from: string; type: string; to: string; evidenceIds: string[] }[];
  };
  /** Contradictions and agreements across the evidence, each quote found on its page in code. */
  findings?: {
    id: string;
    kind: "conflict" | "agrees";
    title: string;
    explanation: string;
    cites: { source: string; page: number; quote: string }[];
    status: "verified" | "dropped";
    droppedBecause?: string;
    /** What the second check (quotes only, read literally) said. */
    check?: string;
  }[];
  /** Page images cut from a filing: does their text match the page they come from? */
  derivedChecks?: { id: string; parent: string; page: number; share: number; status: "passed" | "failed" }[];
  /** Checks of the records themselves (dates, stamps, file names), with what was found. */
  recordChecks?: { title: string; detail: string; source: string; page: number; quote: string }[];
  /** Evidence not analyzed, and why. */
  notAnalyzed?: { id: string; why: string }[];
  log: string[];
}
