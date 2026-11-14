import { useMemo, useState } from 'react';
import { ReactFlow, Background, Handle, Position, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ExternalLink, Layers, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Citation } from '@/lib/investigation-types';
import { formatClipTime, type FindingEvent, type FindingEventSet } from '@/lib/finding-events';
import { timelineThumbs } from '@/lib/investigation-thumbs';

interface Props {
  set: FindingEventSet;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onCitation: (c: Citation) => void;
}

type Layer = 'written' | 'recording' | 'dispatch';

function layerOf(e: FindingEvent): Layer {
  if (e.source === 'dispatch') return 'dispatch';
  if (e.source === 'report') return 'written';
  return 'recording';
}

function nodeCitation(e: FindingEvent): string {
  if (e.source === 'report') return `Report · p. ${e.citation.page ?? 3}`;
  if (e.source === 'dispatch') return `Dispatch · ${e.citation.rowId}`;
  return `Video · ${formatClipTime(e.start ?? 0)}`;
}

type FindingNodeData = { label: string; citation: string; layer: Layer; kind: 'finding' | 'event'; tilt: boolean; selected: boolean };

function FindingNode({ data }: NodeProps<Node<FindingNodeData>>) {
  return (
    <div className={`connection-node layer-${data.layer} kind-${data.kind} ${data.selected ? 'is-selected' : ''}`} style={data.tilt ? { transform: `translateZ(${data.layer === 'written' ? 46 : data.layer === 'recording' ? 0 : -46}px)` } : undefined}>
      <Handle type="target" position={Position.Top} />
      <strong>{data.label}</strong>
      {data.citation && <small>{data.citation}</small>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { finding: FindingNode };

/** Connections graph: the selected finding and only its directly related sources and events. */
export function FindingConnections({ set, selectedId, onSelect, onCitation }: Props) {
  const [tilt, setTilt] = useState(false);
  const [panel, setPanel] = useState<FindingEvent | null>(null);
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const { nodes, edges } = useMemo(() => {
    const events = set.events;
    const nodes: Node<FindingNodeData>[] = [
      { id: 'finding', type: 'finding', position: { x: 260, y: 0 }, data: { label: set.title, citation: set.outcome, layer: 'written', kind: 'finding', tilt, selected: false } },
    ];
    const edges: Edge[] = [];
    const colX = (layer: Layer) => (layer === 'written' ? 40 : layer === 'recording' ? 300 : 560);
    const perLayer: Record<Layer, number> = { written: 0, recording: 0, dispatch: 0 };
    for (const e of events) {
      const layer = layerOf(e);
      const row = perLayer[layer]++;
      nodes.push({
        id: e.id,
        type: 'finding',
        position: { x: colX(layer), y: 130 + row * 92 },
        data: { label: e.label, citation: nodeCitation(e), layer, kind: 'event', tilt, selected: selectedId === e.id },
      });
      edges.push({ id: `f-${e.id}`, source: 'finding', target: e.id, label: e.reportOrder !== null ? 'reported in claim' : 'related evidence', labelBgStyle: { fill: 'transparent' }, style: { stroke: 'var(--border)' } });
    }
    const reported = events.filter((e) => e.reportOrder !== null).sort((a, b) => (a.reportOrder ?? 0) - (b.reportOrder ?? 0));
    for (let i = 0; i + 1 < reported.length; i++) {
      edges.push({ id: `r-${i}`, source: reported[i]!.id, target: reported[i + 1]!.id, label: 'reported before', animated: false, style: { stroke: 'var(--gold, #c9a227)' } });
    }
    const recorded = events.filter((e) => e.recordedOrder !== null).sort((a, b) => (a.recordedOrder ?? 0) - (b.recordedOrder ?? 0));
    for (let i = 0; i + 1 < recorded.length; i++) {
      edges.push({ id: `o-${i}`, source: recorded[i]!.id, target: recorded[i + 1]!.id, label: 'observed before', style: { stroke: 'var(--corroborate, #5fa88f)' } });
    }
    const anchor = events.find((e) => e.source === 'dispatch');
    if (anchor && set.clockAnchor) {
      for (const e of recorded) {
        edges.push({ id: `a-${e.id}`, source: anchor.id, target: e.id, label: 'anchors recording time', style: { strokeDasharray: '4 3', stroke: 'var(--border)' } });
      }
    }
    return { nodes, edges };
  }, [set, tilt, selectedId]);

  const active = panel ?? set.events.find((e) => e.id === selectedId) ?? null;

  return (
    <section className="finding-connections" aria-label="Connections graph">
      <div className="connections-heading">
        <h3>Connections</h3>
        <Button size="sm" variant={tilt ? 'secondary' : 'outline'} className="layers-toggle" aria-pressed={tilt} onClick={() => setTilt((t) => !t)} disabled={reducedMotion}>
          {tilt ? <Square /> : <Layers />}{tilt ? 'Return to 2D' : '3D layers'}
        </Button>
      </div>
      <div className="connections-body">
        <div className={`connections-canvas ${tilt ? 'is-tilted' : ''}`}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.4}
            maxZoom={1.4}
            nodesDraggable={false}
            nodesConnectable={false}
            proOptions={{ hideAttribution: true }}
            onNodeClick={(_, node) => {
              if (node.id === 'finding') return;
              const e = set.events.find((x) => x.id === node.id) ?? null;
              setPanel(e);
              onSelect(e?.id ?? null);
            }}
          >
            <Background gap={18} size={1} />
          </ReactFlow>
        </div>
        <aside className="connections-panel" aria-live="polite">
          {active ? (
            <>
              <h4>{active.label}</h4>
              <p className="connections-citation">{nodeCitation(active)}</p>
              <p>{active.excerpt}</p>
              {active.source !== 'report' && active.start !== null && (
                <FramePreview caseId={set.caseId} sec={active.start} />
              )}
              <Button size="sm" variant="outline" onClick={() => onCitation(active.citation)}>
                <ExternalLink />Open source
              </Button>
            </>
          ) : (
            <p className="connections-hint">Select a node to read its excerpt and open the cited source.</p>
          )}
        </aside>
      </div>
    </section>
  );
}

function FramePreview({ caseId, sec }: { caseId: string; sec: number }) {
  const thumbs = timelineThumbs[caseId] ?? [];
  const nearest = thumbs.reduce<{ sec: number; url: string } | null>((best, t) => (!best || Math.abs(t.sec - sec) < Math.abs(best.sec - sec) ? t : best), null);
  if (!nearest) return null;
  return <img className="connections-frame" src={nearest.url} alt={`Video frame near ${formatClipTime(sec)}`} />;
}
