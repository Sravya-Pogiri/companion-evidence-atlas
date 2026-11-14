import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { ChatPanel } from "@/components/caselens/chat-panel";
import { ConflictDialog } from "@/components/caselens/conflict-dialog";
import { PageHeader } from "@/components/caselens/shared";
import { Timeline } from "@/components/caselens/timeline";
import { seo } from "@/lib/seo";
import {
  FLAG_LABEL,
  ITEMS,
  LANES,
  SAMPLE_CASE,
  findItem,
  formatRange,
  formatTime,
  itemsAt,
  type TimelineItem,
} from "@/lib/sample-case";

export const Route = createFileRoute("/_workspace/")({
  head: () => seo("Live Case", "Text evidence to one number and watch it land on a live case timeline."),
  component: LiveCase,
});

function LiveCase() {
  const [playhead, setPlayhead] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conflict, setConflict] = useState<TimelineItem | null>(null);

  const selected = findItem(ITEMS, selectedId ?? undefined);
  const related = findItem(ITEMS, selected?.relatedId);
  const here = itemsAt(ITEMS, playhead);
  const footage = findItem(ITEMS, conflict?.relatedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={SAMPLE_CASE.label}
        title="Live Case"
        desc={`${SAMPLE_CASE.name}, ${SAMPLE_CASE.number}. Text evidence in, and it lands on the timeline with a link to its source.`}
      />
      <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <ChatPanel selectedId={selectedId} onSelect={setSelectedId} />

        <div className="min-w-0 space-y-6">
          <section className="rounded-lg border bg-card p-5" aria-label="Synchronized timeline">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-xl">Timeline</h2>
              <ul className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground" aria-label="Legend">
                <li className="flex items-center gap-2">
                  <span className="inline-block h-3 w-6 rounded-sm border border-border bg-muted" /> Agrees
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-4 w-0.5 bg-contradiction" /> Possible conflict
                </li>
                <li className="flex items-center gap-2">
                  <span className="inline-block h-3 w-6 rounded-sm border-2 border-dashed border-missing bg-missing/10" /> Missing
                </li>
              </ul>
            </div>
            <Timeline
              items={ITEMS}
              playhead={playhead}
              onPlayhead={setPlayhead}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onOpenConflict={setConflict}
            />
            <p className="mt-4 text-sm text-muted-foreground">
              Drag the playhead. Click the red line to compare the claim with the footage. Times on the public sample are approximate.
            </p>
          </section>

          <section className="rounded-lg border bg-card p-5" aria-live="polite">
            <h2 className="font-serif text-xl">At {formatTime(playhead)}</h2>
            {here.length === 0 ? (
              <p className="mt-2 text-base text-muted-foreground">Nothing is filed at this moment.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {here.map((i) => (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(i.id)}
                      className="rounded-full border bg-muted px-3 py-1 text-sm hover:border-gold"
                    >
                      {LANES.find((l) => l.id === i.lane)?.label}: {i.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selected && (
            <section className="rounded-lg border border-gold/50 bg-card p-5">
              <p className="font-mono text-sm text-muted-foreground">
                {LANES.find((l) => l.id === selected.lane)?.label} · {formatRange(selected)} · {FLAG_LABEL[selected.flag]}
              </p>
              <h2 className="mt-1 font-serif text-xl">{selected.label}</h2>
              <p className="mt-2 text-base leading-relaxed">{selected.extractedText}</p>
              <ul className="mt-3 space-y-1 text-sm">
                <SourceLink item={selected} />
                {related && <SourceLink item={related} />}
              </ul>
            </section>
          )}
        </div>
      </div>

      <ConflictDialog claim={conflict} footage={footage} onClose={() => setConflict(null)} />
    </div>
  );
}

function SourceLink({ item }: { item: TimelineItem }) {
  if (!item.sourceLink) return <li className="text-muted-foreground">Source: {item.sourceLabel}</li>;
  return (
    <li>
      <a href={item.sourceLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-gold hover:underline">
        {item.sourceLabel} <ExternalLink className="size-4" />
      </a>
    </li>
  );
}
