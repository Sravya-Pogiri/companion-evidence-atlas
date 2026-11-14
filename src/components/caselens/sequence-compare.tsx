import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Citation } from '@/lib/investigation-types';
import { establishedGap, formatClipTime, hasReversal, matchedEvents, reversedPairs, type FindingEvent, type FindingEventSet } from '@/lib/finding-events';

interface Props {
  set: FindingEventSet;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCitation: (c: Citation) => void;
}

interface Line { ax: number; ay: number; bx: number; by: number; reversed: boolean; key: string }

/** Compact two-row comparison: reported order vs. recorded order, with matched events connected. */
export function SequenceCompare({ set, selectedId, onSelect, onCitation }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const chips = useRef(new Map<string, HTMLButtonElement>());
  const [lines, setLines] = useState<Line[]>([]);
  const reported = set.events.filter((e) => e.reportOrder !== null).sort((a, b) => (a.reportOrder ?? 0) - (b.reportOrder ?? 0));
  const recorded = set.events.filter((e) => e.recordedOrder !== null).sort((a, b) => (a.recordedOrder ?? 0) - (b.recordedOrder ?? 0));
  const matched = matchedEvents(set);
  const reversed = reversedPairs(set);
  const gap = establishedGap(set);
  const discrepancy = hasReversal(set);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      const next: Line[] = [];
      for (const e of matched) {
        const a = chips.current.get(`${e.id}:report`);
        const b = chips.current.get(`${e.id}:recorded`);
        if (!a || !b) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        next.push({
          key: e.id,
          ax: ra.left - r.left + ra.width / 2,
          ay: ra.bottom - r.top,
          bx: rb.left - r.left + rb.width / 2,
          by: rb.top - r.top,
          reversed: reversed.some(([x, y]) => x.id === e.id || y.id === e.id),
        });
      }
      setLines(next);
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    const frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); window.removeEventListener('resize', update); };
  }, [set, matched, reversed]);

  const chip = (e: FindingEvent, row: 'report' | 'recorded') => (
    <Button
      key={`${e.id}:${row}`}
      ref={(el) => { if (el) chips.current.set(`${e.id}:${row}`, el); else chips.current.delete(`${e.id}:${row}`); }}
      variant="ghost"
      size="sm"
      className={`sequence-chip source-${e.source} ${selectedId === e.id ? 'is-selected' : ''}`}
      aria-pressed={selectedId === e.id}
      onClick={() => { onSelect(selectedId === e.id ? null : e.id); onCitation(e.citation); }}
    >
      <span>{e.label}</span>
      <small>{row === 'report' ? 'Report · p. 3' : e.source === 'report' ? `Report · p. ${e.citation.page ?? 3}` : e.source === 'dispatch' ? `Dispatch · ${e.citation.rowId}` : `Video · ${formatClipTime(e.start ?? 0)}`}</small>
    </Button>
  );

  return (
    <section className="sequence-compare" aria-label="Sequence comparison">
      <div className="sequence-heading">
        <h3>Sequence compare</h3>
        {discrepancy && <span className="sequence-flag discrepancy">Possible discrepancy — order reverses between report and recording</span>}
        {set.outcome === 'Records agree on this claim' && !discrepancy && <span className="sequence-flag agree">Records agree on this claim</span>}
        {gap && <span className="sequence-flag gap">Lead-up unavailable</span>}
      </div>
      <div className="sequence-rows" ref={root}>
        <div className="sequence-row">
          <span className="sequence-row-label">Reported order</span>
          <div className="sequence-track">{reported.length > 0 ? reported.map((e) => chip(e, 'report')) : <span className="sequence-empty">No report sequence for this upload</span>}</div>
        </div>
        <svg className="sequence-connectors" aria-hidden="true">
          {lines.map((l) => (
            <path key={l.key} className={l.reversed ? 'is-reversed' : ''} d={`M ${l.ax} ${l.ay} C ${l.ax} ${l.ay + 26}, ${l.bx} ${l.by - 26}, ${l.bx} ${l.by}`} />
          ))}
        </svg>
        <div className="sequence-row">
          <span className="sequence-row-label">Recorded order</span>
          <div className="sequence-track">{recorded.length > 0 ? recorded.map((e) => chip(e, 'recorded')) : <span className="sequence-empty">No recorded events</span>}</div>
        </div>
      </div>
      {gap && (
        <div className="sequence-gap" role="note">
          <FileWarning aria-hidden="true" />
          <p><strong>Lead-up unavailable.</strong> {gap.label} Missing interval: {formatClipTime(gap.start)}–{formatClipTime(gap.end)}.</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/court-prep" search={{ case: set.caseId === 'incomplete' ? 'incomplete' : 'conflicting', run: '', kind: 'request', evidence: JSON.stringify(set.events.map((e) => e.citation)), explanation: gap.label }}>
              Draft evidence request<ArrowRight />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
