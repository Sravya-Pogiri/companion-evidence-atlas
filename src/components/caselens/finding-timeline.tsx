import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Check, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { establishedGap, formatClipTime, type CandidateMatch, type FindingEventSet } from '@/lib/finding-events';
import { timelineThumbs } from '@/lib/investigation-thumbs';

interface Props {
  set: FindingEventSet;
  videoRef: RefObject<HTMLVideoElement | null>;
  onSeek: (seconds: number) => void;
  matches: CandidateMatch[];
  onVerifyMatch: (index: number) => void;
}

/** Video-editor style timeline: thumbnail strip, lanes, playhead bound to the real player. */
export function FindingTimeline({ set, videoRef, onSeek, matches, onVerifyMatch }: Props) {
  const [now, setNow] = useState(set.coverageStart);
  const [view, setView] = useState<{ start: number; end: number }>({ start: set.coverageStart, end: set.coverageEnd });
  const trackRef = useRef<HTMLDivElement>(null);
  const gap = establishedGap(set);
  const thumbs = timelineThumbs[set.caseId] ?? [];
  const duration = set.coverageEnd - set.coverageStart;

  useEffect(() => {
    setView({ start: set.coverageStart, end: set.coverageEnd });
    setNow(set.coverageStart);
  }, [set]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () => setNow(set.coverageStart + video.currentTime);
    video.addEventListener('timeupdate', update);
    video.addEventListener('loadedmetadata', update);
    update();
    return () => { video.removeEventListener('timeupdate', update); video.removeEventListener('loadedmetadata', update); };
  }, [videoRef, set]);

  const span = view.end - view.start;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - view.start) / span) * 100));

  const zoomToFinding = () => {
    const timed = set.events.filter((e) => e.start !== null);
    if (timed.length === 0) return;
    const start = Math.max(set.coverageStart, Math.min(...timed.map((e) => e.start ?? 0)) - 4);
    const end = Math.min(set.coverageEnd, Math.max(...timed.map((e) => e.end ?? 0)) + 4);
    setView({ start, end });
  };
  const resetZoom = () => setView({ start: set.coverageStart, end: set.coverageEnd });

  const scrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = view.start + ((e.clientX - r.left) / r.width) * span;
    onSeek(Math.min(set.coverageEnd, Math.max(set.coverageStart, t)));
  };

  const videoEvents = set.events.filter((e) => e.start !== null && (e.source === 'video' || e.source === 'transcript'));
  const audioEvents = set.events.filter((e) => e.source === 'transcript' && e.start !== null);
  const zoomed = view.start !== set.coverageStart || view.end !== set.coverageEnd;

  const playhead = useMemo(() => pct(now), [now, view.start, view.end]);

  return (
    <section className="finding-timeline" aria-label="Evidence timeline">
      <div className="timeline-heading">
        <h3>Timeline</h3>
        <span className="timeline-clock font-mono" aria-live="polite">Elapsed {formatClipTime(Math.max(0, now - set.coverageStart))} / {formatClipTime(duration)}</span>
        <div className="timeline-actions">
          <Button size="sm" variant="outline" onClick={zoomToFinding}><ZoomIn />Zoom to finding</Button>
          {zoomed && <Button size="sm" variant="ghost" onClick={resetZoom}><ZoomOut />Full clip</Button>}
        </div>
      </div>
      <div className="timeline-body" ref={trackRef}>
        <div className="timeline-lane">
          <span className="lane-label">Video</span>
          <div className="lane-track lane-video" onClick={scrub} role="slider" aria-label="Scrub video" aria-valuemin={0} aria-valuemax={duration} aria-valuenow={Math.round(now - set.coverageStart)} tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'ArrowRight') onSeek(Math.min(set.coverageEnd, now + 1)); if (e.key === 'ArrowLeft') onSeek(Math.max(set.coverageStart, now - 1)); }}>
            {thumbs.filter((t) => t.sec >= view.start && t.sec <= view.end).map((t) => (
              <img key={t.sec} src={t.url} alt={`Frame at ${formatClipTime(t.sec)}`} className="lane-thumb" style={{ left: `${pct(t.sec)}%` }} />
            ))}
            {gap && <div className="lane-gap" style={{ left: `${pct(gap.start)}%`, width: `${pct(gap.end) - pct(gap.start)}%` }} title={gap.label}><span>{gap.start === set.coverageStart ? 'Lead-up unavailable' : 'Not recorded'}</span></div>}
            {videoEvents.map((e) => (
              <button key={e.id} type="button" className={`lane-event source-${e.source}`} style={{ left: `${pct(e.start ?? 0)}%` }} onClick={(ev) => { ev.stopPropagation(); onSeek(e.start ?? 0); }} title={`${e.label} · ${formatClipTime(e.start ?? 0)}`}>
                <span>{e.label}</span>
              </button>
            ))}
            {matches.map((m, i) => (
              <button key={`match-${i}`} type="button" className={`lane-match ${m.verified ? 'is-verified' : ''}`} style={{ left: `${pct(m.start)}%`, width: `${Math.max(1.5, pct(m.end) - pct(m.start))}%` }} onClick={(ev) => { ev.stopPropagation(); onSeek(m.start); }} title={`Candidate match ${formatClipTime(m.start)}–${formatClipTime(m.end)}`}>
                <span>Candidate {formatClipTime(m.start)}</span>
              </button>
            ))}
            <div className="timeline-playhead" style={{ left: `${playhead}%` }} aria-hidden="true" />
          </div>
        </div>
        <div className="timeline-lane">
          <span className="lane-label">Audio</span>
          <div className="lane-track" onClick={scrub}>
            {audioEvents.length > 0 ? audioEvents.map((e) => (
              <button key={e.id} type="button" className="lane-block" style={{ left: `${pct(e.start ?? 0)}%`, width: `${Math.max(2, pct(e.end ?? 0) - pct(e.start ?? 0))}%` }} onClick={(ev) => { ev.stopPropagation(); onSeek(e.start ?? 0); }} title={e.excerpt}>
                <span>{e.label}</span>
              </button>
            )) : <span className="lane-empty">No speech segments in coverage</span>}
            <div className="timeline-playhead" style={{ left: `${playhead}%` }} aria-hidden="true" />
          </div>
        </div>
        <div className="timeline-lane">
          <span className="lane-label">Dispatch</span>
          <div className="lane-track">
            {set.clockAnchor ? (
              <div className="lane-anchor" style={{ left: `${pct(set.coverageStart)}%` }} title={`${set.clockAnchor.rowId} · ${set.clockAnchor.time}`}>
                <span>{set.clockAnchor.rowId} · camera synchronized (shared clock anchor)</span>
              </div>
            ) : (
              <span className="lane-empty">No cited shared-clock anchor — dispatch not aligned to video time</span>
            )}
            <div className="timeline-playhead" style={{ left: `${playhead}%` }} aria-hidden="true" />
          </div>
        </div>
      </div>
      {matches.length > 0 && (
        <div className="timeline-matches">
          <h4>Candidate matches — reviewer verification required</h4>
          {matches.map((m, i) => (
            <div key={i} className="match-row">
              <Button size="sm" variant="ghost" onClick={() => onSeek(m.start)}>{formatClipTime(m.start)}–{formatClipTime(m.end)}{m.score !== null && <small> · score {m.score.toFixed(2)}</small>}</Button>
              {m.verified ? <span className="match-verified"><Check /> Verified by reviewer</span> : <Button size="sm" variant="outline" onClick={() => onVerifyMatch(i)}>Mark verified</Button>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
