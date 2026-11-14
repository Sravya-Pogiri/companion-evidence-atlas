import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Loader2, Search, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { footageIndexingStatus, searchFootage, startFootageIndexing } from '@/lib/footage-search.functions';
import type { CandidateMatch, FindingEventSet } from '@/lib/finding-events';

interface Props {
  set: FindingEventSet;
  onMatches: (matches: CandidateMatch[], staged: boolean) => void;
}

/** "Find in footage": live TwelveLabs search when configured, clearly labeled staged result otherwise. */
export function FindInFootage({ set, onMatches }: Props) {
  const [query, setQuery] = useState('trunk opening');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const start = useServerFn(startFootageIndexing);
  const poll = useServerFn(footageIndexingStatus);
  const search = useServerFn(searchFootage);

  const runLive = async () => {
    setBusy(true);
    setError('');
    setStatus('Starting indexing…');
    try {
      const started = await start({ data: { caseId: set.caseId } });
      if (!started.ok) { setError(started.error); setStatus(''); return; }
      let videoId: string | null = null;
      for (let attempt = 0; attempt < 120; attempt++) {
        setStatus(`Indexing — actual processing state: ${started.status}`);
        const state = await poll({ data: { caseId: set.caseId, taskId: started.taskId } });
        if (!state.ok) { setError(state.error); setStatus(''); return; }
        setStatus(`Indexing — actual processing state: ${state.status}`);
        if (state.status === 'ready') { videoId = state.videoId; break; }
        if (state.status === 'failed') { setError('TwelveLabs reported the indexing task as failed.'); setStatus(''); return; }
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      if (!videoId) { setError('Indexing did not finish within the polling window. Try again shortly.'); setStatus(''); return; }
      setStatus('Searching the authorized clip…');
      const found = await search({ data: { caseId: set.caseId, indexId: started.indexId, videoId, query } });
      if (!found.ok) { setError(found.error); setStatus(''); return; }
      onMatches(found.matches, false);
      setStatus(found.matches.length > 0 ? `Live search returned ${found.matches.length} candidate match${found.matches.length === 1 ? '' : 'es'}.` : 'Live search returned no hits — the question remains unresolved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Footage search unavailable');
      setStatus('');
    } finally {
      setBusy(false);
    }
  };

  const runStaged = () => {
    setError('');
    setStatus(set.stagedMatches.length > 0 ? 'Staged result (demo) — not a live search.' : 'Staged result (demo) — no hits; the question remains unresolved.');
    onMatches(set.stagedMatches.map((m) => ({ ...m })), true);
  };

  return (
    <section className="find-footage" aria-label="Find in footage">
      <div className="find-footage-heading">
        <h3><Film />Find in footage</h3>
        <span>Search is restricted to the authorized clip for this case.</span>
      </div>
      <div className="find-footage-controls">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Footage search query"
          placeholder="Describe what to find, e.g. trunk opening"
          disabled={busy}
        />
        <Button size="sm" variant="secondary" disabled={busy || query.trim().length < 2} onClick={runLive}>
          {busy ? <Loader2 className="animate-spin" /> : <Search />}Find in footage
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={runStaged}>Staged result (demo)</Button>
      </div>
      {status && <p className="find-footage-status" aria-live="polite">{status}</p>}
      {error && <p className="find-footage-error" role="alert">{error}</p>}
    </section>
  );
}
