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
  log: string[];
}
