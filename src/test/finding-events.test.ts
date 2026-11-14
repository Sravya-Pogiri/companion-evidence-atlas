import { describe, expect, it } from 'vitest';
import { establishedGap, findingEventSets, formatClipTime, hasReversal, matchedEvents, reversedPairs } from '@/lib/finding-events';

describe('finding events model', () => {
  it('detects the reversed trunk request/opening order only in the conflicting case', () => {
    expect(hasReversal(findingEventSets.conflicting)).toBe(true);
    expect(reversedPairs(findingEventSets.conflicting).map(([a, b]) => [a.id, b.id])).toEqual([['request', 'open']]);
    expect(hasReversal(findingEventSets.matching)).toBe(false);
    expect(hasReversal(findingEventSets.incomplete)).toBe(false);
  });

  it('pairs only events claimed in both sequences', () => {
    expect(matchedEvents(findingEventSets.conflicting).map((e) => e.id)).toEqual(['approach', 'request', 'open']);
    expect(matchedEvents(findingEventSets.incomplete).map((e) => e.id)).toEqual([]);
    expect(matchedEvents(findingEventSets.fresh).map((e) => e.id)).toEqual([]);
  });

  it('exposes an exact missing interval only when sources establish its boundaries', () => {
    expect(establishedGap(findingEventSets.incomplete)).toMatchObject({ start: 0, end: 10, established: true });
    expect(establishedGap(findingEventSets['fresh-truncated'])).toMatchObject({ start: 14, end: 26, established: true });
    expect(establishedGap(findingEventSets.conflicting)).toBeNull();
  });

  it('aligns dispatch to video time only with a cited shared-clock anchor', () => {
    expect(findingEventSets.conflicting.clockAnchor?.rowId).toBe('CAD-001');
    expect(findingEventSets.fresh.clockAnchor).toBeNull();
    expect(findingEventSets['fresh-truncated'].clockAnchor).toBeNull();
  });

  it('keeps every timed event inside the declared coverage window', () => {
    for (const set of Object.values(findingEventSets)) {
      for (const e of set.events) {
        if (e.start === null) continue;
        expect(e.start).toBeGreaterThanOrEqual(set.coverageStart);
        expect(e.end ?? e.start).toBeLessThanOrEqual(set.coverageEnd);
      }
    }
  });

  it('marks the fresh truncated upload as unresolved with no staged hits', () => {
    expect(findingEventSets['fresh-truncated'].outcome).toBe('Insufficient evidence');
    expect(findingEventSets['fresh-truncated'].stagedMatches).toEqual([]);
    expect(findingEventSets.fresh.stagedMatches[0]).toMatchObject({ start: 20, end: 22 });
  });

  it('formats clip times as mm:ss', () => {
    expect(formatClipTime(8)).toBe('00:08');
    expect(formatClipTime(134)).toBe('02:14');
  });
});
