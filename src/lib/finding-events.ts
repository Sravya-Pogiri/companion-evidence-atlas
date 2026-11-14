import type { Citation, ScenarioId } from './investigation-types';

// Shared event model for the selected finding. Sequence Compare, the Connections
// graph, and the editor timeline all read from this one source so events,
// citations, and selection stay in sync. Times are absolute clip seconds.

export type VisualCaseId = ScenarioId | 'fresh' | 'fresh-truncated';

export type EventSource = 'report' | 'video' | 'transcript' | 'dispatch';

export interface FindingEvent {
  id: string;
  label: string;
  source: EventSource;
  citation: Citation;
  /** Position in the report's claimed sequence, null when the report does not claim it. */
  reportOrder: number | null;
  /** Position in the recorded sequence, null when the recording does not show it. */
  recordedOrder: number | null;
  start: number | null;
  end: number | null;
  excerpt: string;
}

export interface CoverageGap {
  start: number;
  end: number;
  label: string;
  /** True only when the sources establish both boundaries of the missing interval. */
  established: boolean;
}

export interface CandidateMatch {
  start: number;
  end: number;
  score: number | null;
  verified: boolean;
}

export interface FindingEventSet {
  caseId: VisualCaseId;
  title: string;
  outcome: 'Possible discrepancy' | 'Records agree on this claim' | 'Insufficient evidence';
  events: FindingEvent[];
  gap: CoverageGap | null;
  /** Cited shared-clock anchor; dispatch aligns to video time only when present. */
  clockAnchor: { rowId: string; time: string } | null;
  coverageStart: number;
  coverageEnd: number;
  /** Staged candidate matches for the "Find in footage" demo path (labeled in UI). */
  stagedMatches: CandidateMatch[];
}

const cite = (c: Partial<Citation> & Pick<Citation, 'sourceId'>): Citation => ({
  page: null, start: null, end: null, rowId: null, ...c,
});

export const findingEventSets: Record<VisualCaseId, FindingEventSet> = {
  conflicting: {
    caseId: 'conflicting',
    title: 'Trunk request vs. trunk opening',
    outcome: 'Possible discrepancy',
    coverageStart: 0,
    coverageEnd: 26,
    gap: null,
    clockAnchor: { rowId: 'CAD-001', time: '2026-11-02T20:40:00Z' },
    stagedMatches: [{ start: 8, end: 10, score: 0.91, verified: false }],
    events: [
      { id: 'approach', label: 'Officer approaches', source: 'video', citation: cite({ sourceId: 'video', start: 0, end: 2 }), reportOrder: 1, recordedOrder: 1, start: 0, end: 2, excerpt: 'Officer approaches vehicle.' },
      { id: 'request', label: 'Trunk request', source: 'transcript', citation: cite({ sourceId: 'transcript', start: 18, end: 20 }), reportOrder: 2, recordedOrder: 3, start: 18, end: 20, excerpt: 'Can you open the trunk, please?' },
      { id: 'open', label: 'Trunk opens', source: 'video', citation: cite({ sourceId: 'video', start: 8, end: 10 }), reportOrder: 3, recordedOrder: 2, start: 8, end: 10, excerpt: '[Trunk opening visible; no speech.]' },
      { id: 'anchor', label: 'Camera sync', source: 'dispatch', citation: cite({ sourceId: 'dispatch', rowId: 'CAD-001' }), reportOrder: null, recordedOrder: null, start: null, end: null, excerpt: 'Unit Patel begins vehicle check; body camera synchronized.' },
    ],
  },
  matching: {
    caseId: 'matching',
    title: 'Trunk request vs. trunk opening',
    outcome: 'Records agree on this claim',
    coverageStart: 0,
    coverageEnd: 26,
    gap: null,
    clockAnchor: { rowId: 'CAD-001', time: '2026-11-02T20:40:00Z' },
    stagedMatches: [{ start: 12, end: 14, score: 0.93, verified: false }],
    events: [
      { id: 'approach', label: 'Officer approaches', source: 'video', citation: cite({ sourceId: 'video', start: 0, end: 2 }), reportOrder: 1, recordedOrder: 1, start: 0, end: 2, excerpt: 'Officer approaches vehicle.' },
      { id: 'request', label: 'Trunk request', source: 'transcript', citation: cite({ sourceId: 'transcript', start: 6, end: 8 }), reportOrder: 2, recordedOrder: 2, start: 6, end: 8, excerpt: 'Please open the trunk.' },
      { id: 'open', label: 'Trunk opens', source: 'video', citation: cite({ sourceId: 'video', start: 12, end: 14 }), reportOrder: 3, recordedOrder: 3, start: 12, end: 14, excerpt: '[Trunk opening visible; no speech.]' },
      { id: 'request-2', label: 'Second request', source: 'transcript', citation: cite({ sourceId: 'transcript', start: 18, end: 20 }), reportOrder: 4, recordedOrder: 4, start: 18, end: 20, excerpt: 'Can you open the trunk, please?' },
      { id: 'anchor', label: 'Camera sync', source: 'dispatch', citation: cite({ sourceId: 'dispatch', rowId: 'CAD-001' }), reportOrder: null, recordedOrder: null, start: null, end: null, excerpt: 'Unit Patel begins vehicle check; body camera synchronized.' },
    ],
  },
  incomplete: {
    caseId: 'incomplete',
    title: 'Trunk request vs. trunk opening',
    outcome: 'Insufficient evidence',
    coverageStart: 10,
    coverageEnd: 26,
    gap: { start: 0, end: 10, label: 'Lead-up unavailable — the recording starts at 0:10, so the trunk request and opening cannot be checked.', established: true },
    clockAnchor: { rowId: 'CAD-001', time: '2026-11-02T20:40:00Z' },
    stagedMatches: [],
    events: [
      { id: 'request', label: 'Trunk request', source: 'report', citation: cite({ sourceId: 'report', page: 3 }), reportOrder: 1, recordedOrder: null, start: null, end: null, excerpt: 'I asked Morgan to open the trunk before the trunk was opened.' },
      { id: 'open', label: 'Trunk opens', source: 'report', citation: cite({ sourceId: 'report', page: 3 }), reportOrder: 2, recordedOrder: null, start: null, end: null, excerpt: 'The request was made during the initial vehicle check.' },
      { id: 'resume', label: 'Recording resumes', source: 'video', citation: cite({ sourceId: 'video', start: 10, end: 12 }), reportOrder: null, recordedOrder: 1, start: 10, end: 12, excerpt: 'Recording resumes. Trunk is already open.' },
      { id: 'request-heard', label: 'Request heard', source: 'transcript', citation: cite({ sourceId: 'transcript', start: 18, end: 20 }), reportOrder: null, recordedOrder: 2, start: 18, end: 20, excerpt: 'Can you open the trunk, please?' },
      { id: 'anchor', label: 'Camera sync', source: 'dispatch', citation: cite({ sourceId: 'dispatch', rowId: 'CAD-001' }), reportOrder: null, recordedOrder: null, start: null, end: null, excerpt: 'Unit Patel begins vehicle check; body camera synchronized.' },
    ],
  },
  fresh: {
    caseId: 'fresh',
    title: 'Fresh staged upload — trunk opens at 0:20',
    outcome: 'Records agree on this claim',
    coverageStart: 0,
    coverageEnd: 26,
    gap: null,
    clockAnchor: null,
    stagedMatches: [{ start: 20, end: 22, score: 0.9, verified: false }],
    events: [
      { id: 'approach', label: 'Officer approaches', source: 'video', citation: cite({ sourceId: 'video', start: 0, end: 2 }), reportOrder: null, recordedOrder: 1, start: 0, end: 2, excerpt: 'Officer approaches vehicle.' },
      { id: 'request', label: 'Trunk request', source: 'video', citation: cite({ sourceId: 'video', start: 14, end: 16 }), reportOrder: null, recordedOrder: 2, start: 14, end: 16, excerpt: 'Please open the trunk.' },
      { id: 'open', label: 'Trunk opens', source: 'video', citation: cite({ sourceId: 'video', start: 20, end: 22 }), reportOrder: null, recordedOrder: 3, start: 20, end: 22, excerpt: '[Trunk opening visible; no speech.]' },
    ],
  },
  'fresh-truncated': {
    caseId: 'fresh-truncated',
    title: 'Fresh staged upload — truncated at 0:14',
    outcome: 'Insufficient evidence',
    coverageStart: 0,
    coverageEnd: 14,
    gap: { start: 14, end: 26, label: 'Recording ends at 0:14 — the trunk opening is not captured.', established: true },
    clockAnchor: null,
    stagedMatches: [],
    events: [
      { id: 'approach', label: 'Officer approaches', source: 'video', citation: cite({ sourceId: 'video', start: 0, end: 2 }), reportOrder: null, recordedOrder: 1, start: 0, end: 2, excerpt: 'Officer approaches vehicle.' },
    ],
  },
};

export const visualCaseIds = Object.keys(findingEventSets) as VisualCaseId[];

/** Events claimed in both sequences, paired for the comparison connectors. */
export function matchedEvents(set: FindingEventSet): FindingEvent[] {
  return set.events.filter((e) => e.reportOrder !== null && e.recordedOrder !== null);
}

/** Pairs whose relative order flips between the report and the recording. */
export function reversedPairs(set: FindingEventSet): [FindingEvent, FindingEvent][] {
  const matched = matchedEvents(set);
  const pairs: [FindingEvent, FindingEvent][] = [];
  for (let i = 0; i < matched.length; i++) {
    for (let j = i + 1; j < matched.length; j++) {
      const a = matched[i]!, b = matched[j]!;
      const reportDelta = (a.reportOrder ?? 0) - (b.reportOrder ?? 0);
      const recordedDelta = (a.recordedOrder ?? 0) - (b.recordedOrder ?? 0);
      if (reportDelta * recordedDelta < 0) pairs.push([a, b]);
    }
  }
  return pairs;
}

export function hasReversal(set: FindingEventSet): boolean {
  return reversedPairs(set).length > 0;
}

/** Exact missing interval, only when the sources establish its boundaries. */
export function establishedGap(set: FindingEventSet): CoverageGap | null {
  return set.gap && set.gap.established ? set.gap : null;
}

export function formatClipTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
