// Read-only access to a Lexora case's stored evidence, for the claim investigation tools.
// The data is the app's own case data (src/data/<case>/): the evidence packet, its checked
// analysis, and the stored text of every cited page. Nothing here writes or reaches the network.
//
// Every record has a case-scoped evidence id:
//   btk:STATE:p42    a stored page of a source document (source id + PDF page)
//   btk:CHURCH:p1    the archived church page (one "page")
//   btk:T15          a dated entry of the case timeline
//   btk:B-002        a cited observation of the packet
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const CLAIM_CASES = ['btk', 'rosales'] as const;
export type ClaimCaseId = (typeof CLAIM_CASES)[number];

const DATA = resolve(import.meta.dirname, '../../../src/data');

interface PacketSource {
  id: string;
  title: string;
  type: string;
  origin: string;
  url: string;
  note?: string;
  availability: string;
  filed_date?: string;
  hearing_date?: string;
  capture_timestamp_utc?: string;
  archive_creation_date?: string;
  acquisition_url?: string;
}
interface Citation { source_id: string; pdf_page?: number; pdf_page_end?: number; section?: string }
interface Packet {
  cases: {
    id: string;
    title: string;
    case_number: string;
    question: string;
    sources: PacketSource[];
    evidence: { id: string; type: string; description: string; limitation: string; citations: Citation[] }[];
    timeline: { id: string; date: string; end_date?: string; precision: string; event: string; date_note?: string; timestamp?: string; citations: Citation[]; evidence_ids: string[] }[];
    raw_artifact_gaps: { artifact: string; availability: string; why: string; evidence_ids: string[] }[];
  }[];
}

export interface StoredPage {
  evidenceId: string;
  sourceId: string;
  sourceTitle: string;
  page: number;
  /** Where the record sits, for people: "PDF p.42", "bodycam 8:00–9:00", "recorded metadata". */
  location: string;
  method: string;
  text: string;
  /** Where the original record can be opened. */
  url: string | null;
  /** A still for frame records. */
  frame?: string;
}

export interface CaseStore {
  caseId: ClaimCaseId;
  title: string;
  question: string;
  pages: Map<string, StoredPage>;
  sourceTitle(id: string): string;
  /** How observation ids look in this case, for the tool description. */
  observationHint: string;
  dated(): unknown;
  observation(id: string): ({ evidence_id: string; cited_pages: string[] } & Record<string, unknown>) | null;
  missing(): unknown;
}

const cache = new Map<ClaimCaseId, CaseStore>();

function pdfUrl(src: PacketSource | undefined, page: number): string | null {
  if (!src) return null;
  const base = src.acquisition_url?.endsWith('/file') ? src.acquisition_url : src.url;
  return /\.pdf|\/file$|-pdf$/.test(base) ? `${base.split('#')[0]}#page=${page}` : base;
}

export function loadCase(caseId: ClaimCaseId): CaseStore {
  const hit = cache.get(caseId);
  if (hit) return hit;
  const store = caseId === 'rosales' ? loadRosales() : loadBtk();
  cache.set(caseId, store);
  return store;
}

/** Rosales: the stored records built by scripts/evidence/rosales-store.py, and its analysis. */
function loadRosales(): CaseStore {
  const data = JSON.parse(readFileSync(resolve(DATA, 'rosales', 'evidence-store.json'), 'utf8')) as {
    title: string;
    question: string;
    records: StoredPage[];
    dated: unknown[];
    missing: unknown[];
  };
  const analysis = JSON.parse(readFileSync(resolve(DATA, 'rosales', 'analysis.json'), 'utf8')) as {
    claims: { id: string; origin: string; claim: string; exactQuote?: string; at: { source: string; page?: number; paragraph?: number; t?: number }; verification: { status: string; note?: string } }[];
  };
  const pages = new Map(data.records.map((r) => [r.evidenceId, r]));
  const recordFor = (c: (typeof analysis.claims)[number]) =>
    c.at.page !== undefined
      ? `rosales:${c.at.source.toUpperCase()}:p${c.at.page}`
      : c.origin === 'transcript'
        ? `rosales:BODYCAM:m${String(Math.floor((c.at.t ?? 0) / 60)).padStart(2, '0')}`
        : `rosales:${c.at.source.toUpperCase()}:t${String(Math.round(c.at.t ?? 0)).padStart(4, '0')}`;
  return {
    caseId: 'rosales',
    title: data.title,
    question: data.question,
    pages,
    sourceTitle: (id) => [...pages.values()].find((p) => p.sourceId === id)?.sourceTitle ?? id,
    observationHint: 'claim ids from the case analysis, e.g. complaint-016, opinion-045, bodycam-audio-052, dashcam-063',
    dated: () => ({ moments: data.dated, note: 'Each video has its own clock; the dashcam and bodycam are not synced. The filings give no clock times.' }),
    observation: (id) => {
      const c = analysis.claims.find((x) => x.id === id.replace(/^rosales:/, ''));
      if (!c) return null;
      return {
        evidence_id: `rosales:${c.id}`,
        kind: c.origin,
        claim: c.claim,
        quote: c.exactQuote ?? null,
        analysis_check: `${c.verification.status}${c.verification.note ? `: ${c.verification.note}` : ''}`,
        cited_pages: pages.has(recordFor(c)) ? [recordFor(c)] : [],
      };
    },
    missing: () => data.missing,
  };
}

/** BTK: the evidence packet, its analysis and the stored page text. */
function loadBtk(): CaseStore {
  const caseId = 'btk' as const;
  const packet = (JSON.parse(readFileSync(resolve(DATA, caseId, 'packet.json'), 'utf8')) as Packet).cases[0]!;
  const stored = JSON.parse(readFileSync(resolve(DATA, caseId, 'pages.json'), 'utf8')) as {
    pages: Record<string, Record<string, string>>;
    methods: Record<string, string>;
  };
  const sources = new Map(packet.sources.map((s) => [s.id, s]));
  const pages = new Map<string, StoredPage>();
  for (const [sourceId, byPage] of Object.entries(stored.pages))
    for (const [p, text] of Object.entries(byPage)) {
      const page = Number(p);
      const evidenceId = `${caseId}:${sourceId}:p${page}`;
      pages.set(evidenceId, {
        evidenceId,
        sourceId,
        sourceTitle: sources.get(sourceId)?.title ?? sourceId,
        page,
        location: sourceId === 'CHURCH' ? 'archived page' : sourceId === 'CAPTIONS_UNT' ? 'captions file' : `PDF p.${page}`,
        method: stored.methods[`${sourceId}:${page}`] ?? '',
        text,
        url: sourceId === 'CHURCH' || sourceId === 'CAPTIONS_UNT' ? (sources.get(sourceId)?.url ?? null) : pdfUrl(sources.get(sourceId), page),
      });
    }
  // Each source's recorded metadata (archive capture time, filing and hearing dates, creation
  // date), as one more stored record per source so it can be quoted and checked like a page.
  for (const s of packet.sources) {
    const lines = [
      `Source: ${s.title} (${s.type}), ${s.origin}.`,
      s.capture_timestamp_utc ? `Internet Archive capture timestamp (UTC): ${s.capture_timestamp_utc}.` : '',
      (s as PacketSource & { capture_header?: string }).capture_header ? `Capture header: ${(s as PacketSource & { capture_header?: string }).capture_header}.` : '',
      s.filed_date ? `Filed date: ${s.filed_date}.` : '',
      s.hearing_date ? `Hearing date: ${s.hearing_date}.` : '',
      s.archive_creation_date ? `Archive creation date: ${s.archive_creation_date}.` : '',
      s.note ? `Packet note: ${s.note}` : '',
      `Address: ${s.url}`,
    ].filter(Boolean);
    if (lines.length <= 2) continue;
    const evidenceId = `${caseId}:${s.id}:meta`;
    pages.set(evidenceId, { evidenceId, sourceId: s.id, sourceTitle: s.title, page: 0, location: 'recorded metadata', method: 'packet metadata', text: lines.join('\n'), url: s.url });
  }
  const store: CaseStore = {
    caseId,
    title: `${packet.title}, ${packet.case_number}`,
    question: packet.question,
    pages,
    sourceTitle: (id) => sources.get(id)?.title ?? id,
    observationHint: "the packet's observation ids, B-001 to B-023",
    dated: () => btkDated(store, packet),
    observation: (id) => btkObservation(store, packet, id),
    missing: () => packet.raw_artifact_gaps.map((g) => ({ artifact: g.artifact, availability: g.availability, why: g.why, related: g.evidence_ids.map((x) => `${caseId}:${x}`) })),
  };
  return store;
}

type BtkCase = Packet['cases'][number];

/** Evidence ids of the stored pages a packet citation points to. */
function pageIdsFor(store: CaseStore, c: Citation): string[] {
  if (!c.pdf_page) return store.pages.has(`${store.caseId}:${c.source_id}:p1`) ? [`${store.caseId}:${c.source_id}:p1`] : [];
  const out: string[] = [];
  for (let p = c.pdf_page; p <= (c.pdf_page_end ?? c.pdf_page); p++) {
    const id = `${store.caseId}:${c.source_id}:p${p}`;
    if (store.pages.has(id)) out.push(id);
  }
  return out;
}

const STOP = new Set(['the', 'and', 'was', 'were', 'that', 'this', 'with', 'from', 'for', 'before', 'after', 'his', 'her', 'its', 'are', 'did', 'does', 'has', 'have', 'had', 'into', 'than', 'then', 'what', 'when', 'which', 'who', 'whom']);
const terms = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

/** Keyword search over the stored records, ranked by how rare each matched term is (IDF). */
export function searchPages(store: CaseStore, query: string, limit = 6) {
  const q = [...new Set(terms(query))];
  if (q.length === 0) return [];
  const docs = [...store.pages.values()].map((p) => ({ p, hay: `${p.sourceTitle}\n${p.text}`.toLowerCase() }));
  const idf = new Map(q.map((t) => [t, Math.log((docs.length + 1) / (docs.filter((d) => d.hay.includes(t)).length + 0.5))]));
  const scored = docs
    .map(({ p, hay }) => {
      const hits = q.filter((t) => hay.includes(t));
      const score = hits.reduce((n, t) => n + idf.get(t)! * (1 + Math.min(3, hay.split(t).length - 2) * 0.1), 0);
      return { p, hits, score };
    })
    .filter((x) => x.hits.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map(({ p, hits }) => {
    const low = p.text.toLowerCase();
    const first = hits.filter((h) => low.includes(h)).sort((a, b) => idf.get(b)! - idf.get(a)!)[0] ?? '';
    const at = Math.max(0, low.indexOf(first) - 220);
    return {
      evidence_id: p.evidenceId,
      source: p.sourceTitle,
      page: p.page,
      matched_terms: hits,
      snippet: p.text.slice(at, at + 520).replace(/\s+/g, ' ').trim(),
    };
  });
}

/** Dated records for the case (BTK: its timeline plus the dates on the records themselves). */
export function datedRecords(store: CaseStore) {
  return store.dated();
}

function btkDated(store: CaseStore, packet: BtkCase) {
  const entries = packet.timeline.map((t) => ({
    evidence_id: `${store.caseId}:${t.id}`,
    date: t.date,
    end_date: t.end_date ?? null,
    precision: t.precision,
    kind: 'case timeline entry',
    event: t.event,
    note: t.date_note ?? null,
    timestamp: t.timestamp ?? null,
    cited_pages: t.citations.flatMap((c) => pageIdsFor(store, c)),
  }));
  const recordDates = packet.sources.flatMap((s) => {
    const out: { evidence_id: string; date: string; precision: string; kind: string; event: string }[] = [];
    const first = [...store.pages.values()].find((p) => p.sourceId === s.id);
    const id = first?.evidenceId ?? `${store.caseId}:${s.id}`;
    if (s.filed_date) out.push({ evidence_id: id, date: s.filed_date, precision: 'day', kind: 'filing date (packet metadata)', event: `${s.title} filed` });
    if (s.hearing_date) out.push({ evidence_id: id, date: s.hearing_date, precision: 'day', kind: 'hearing date (packet metadata)', event: `${s.title}: hearing` });
    if (s.capture_timestamp_utc) out.push({ evidence_id: id, date: s.capture_timestamp_utc, precision: 'second', kind: 'archive capture time (packet metadata)', event: `${s.title} captured by the Internet Archive` });
    if (s.archive_creation_date) out.push({ evidence_id: id, date: s.archive_creation_date, precision: 'day', kind: 'archive creation date (packet metadata)', event: `${s.title}: archive date` });
    return out;
  });
  return { entries, record_dates: recordDates };
}

export function observation(store: CaseStore, id: string) {
  return store.observation(id);
}

function btkObservation(store: CaseStore, packet: BtkCase, id: string) {
  const e = packet.evidence.find((x) => x.id === id.replace(/^btk:/, ''));
  if (!e) return null;
  return {
    evidence_id: `${store.caseId}:${e.id}`,
    type: e.type,
    description: e.description,
    limitation: e.limitation,
    cited_pages: e.citations.flatMap((c) => pageIdsFor(store, c)),
    other_sources: e.citations.filter((c) => pageIdsFor(store, c).length === 0).map((c) => `${store.sourceTitle(c.source_id)}${c.section ? ` (${c.section})` : ''}: no stored text`),
  };
}

export function missingRecords(store: CaseStore) {
  return store.missing();
}
