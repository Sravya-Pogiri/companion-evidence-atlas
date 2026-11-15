import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { FrameThumb, LocalClip, PlayableStill } from "@/components/caselens/evidence-media";
import { useCase } from "@/lib/case-store";
import { segment, type Mark } from "@/lib/highlight";
import { FRAMES } from "@/lib/media";
import { FLAG_LABEL, findItem, type TimelineItem } from "@/lib/sample-case";
import { ENTITIES, ITEM_CITATIONS, findSource, type Paragraph, type Source } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { useWorkspace } from "./context";
import { Citations } from "./source-citation";

const mmss = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.round(t) % 60).padStart(2, "0")}`;

function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** The center column: whichever source is open, typeset for reading. */
export function EvidenceDocumentViewer() {
  const { sourceId, flash } = useWorkspace();
  const scroller = useRef<HTMLDivElement>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);

  // Scroll to a cited passage and briefly emphasise it.
  useEffect(() => {
    if (!flash || flash.source !== sourceId) return;
    const id = flash.anchor ? `anchor-${flash.source}-${flash.anchor}` : null;
    const run = () => {
      const el = id ? document.getElementById(id) : null;
      if (el) el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "center" });
      else scroller.current?.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
      setFlashKey(`${flash.anchor}#${flash.nonce}`);
    };
    const raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [flash, sourceId]);

  const flashAnchor = flashKey?.split("#")[0] ?? null;

  return (
    <div ref={scroller} className="lx-scroll h-full overflow-y-auto bg-card">
      <div
        key={sourceId}
        className="lx-fade mx-auto max-w-[46rem] px-6 pb-24 pt-9 sm:px-10 xl:px-14"
      >
        {sourceId.startsWith("msg:") ? (
          <MessageSource itemId={sourceId.slice(4)} />
        ) : (
          <SourceBody source={findSource(sourceId)} flashAnchor={flashAnchor} flashKey={flashKey} />
        )}
      </div>
    </div>
  );
}

function DocHeader({
  label,
  title,
  subtitle,
  url,
}: {
  label: string;
  title: string;
  subtitle: string;
  url?: string | null;
}) {
  return (
    <header className="border-b border-border pb-6">
      <p className="font-mono text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <h1 className="mt-2 font-serif text-3xl leading-[1.1] text-foreground">{title}</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Open original <ExternalLink className="size-3.5" />
        </a>
      )}
    </header>
  );
}

function SourceBody({
  source,
  flashAnchor,
  flashKey,
}: {
  source: Source | undefined;
  flashAnchor: string | null;
  flashKey: string | null;
}) {
  if (!source) return <p className="text-muted-foreground">This source is not in the case.</p>;
  if (source.kind === "video" && !source.video) return <ClipSource source={source} />;
  if (source.kind === "video")
    return <VideoSource source={source} flashAnchor={flashAnchor} flashKey={flashKey} />;
  if (!source.available) return <MissingSource source={source} />;

  const label =
    source.provenance === "paraphrase" ? "Summary · Paraphrased" : "Source · Public record";
  return (
    <article>
      <DocHeader label={label} title={source.title} subtitle={source.subtitle} url={source.url} />
      {source.blocks?.map((block, bi) => (
        <section key={bi} className="mt-7">
          {block.heading &&
            (/^Page \d+$/.test(block.heading) ? (
              <p className="mb-4 font-mono text-[13px] uppercase tracking-[0.1em] text-muted-foreground">
                {block.heading}
              </p>
            ) : (
              <h2 className="mb-5 font-serif text-[28px] italic leading-snug text-foreground">
                {block.heading}
              </h2>
            ))}
          <div className="space-y-5">
            {block.paragraphs.map((p) => (
              <DocParagraph
                key={`${p.id}-${flashAnchor === p.id ? flashKey : ""}`}
                sourceId={source.id}
                p={p}
                flashing={flashAnchor === p.id}
              />
            ))}
          </div>
          {block.note && (
            <p className="mt-6 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium">Editor’s note.</span> {block.note}
            </p>
          )}
        </section>
      ))}
    </article>
  );
}

function DocParagraph({
  sourceId,
  p,
  flashing,
}: {
  sourceId: string;
  p: Paragraph;
  flashing: boolean;
}) {
  const { items, view, focusId, focusItem, setView } = useWorkspace();
  const filed = new Set(items.map((i) => i.id));
  const marks: Mark[] = [
    ...(p.marks ?? [])
      // Passages behind timeline items, and behind document-only findings ("finding:<id>").
      .filter((m) => filed.has(m.itemId) || m.itemId.startsWith("finding:"))
      .map((m) => ({ phrase: m.phrase, kind: "finding" as const, id: m.itemId })),
    ...(view === "entities"
      ? ENTITIES.flatMap((e) =>
          e.mentions.map((phrase) => ({ phrase, kind: "entity" as const, id: e.name })),
        )
      : []),
  ];
  const runs = segment(p.text, marks);

  return (
    <div
      id={`anchor-${sourceId}-${p.id}`}
      className={cn("grid scroll-mt-24 grid-cols-[3.25rem_minmax(0,1fr)]", flashing && "lx-flash")}
    >
      <span className="select-none pt-[0.55rem] font-mono text-[13px] text-[color:var(--lx-faint)]">
        {p.label}
      </span>
      <p className="font-serif text-xl leading-[1.5] text-[color:var(--lx-ink)]">
        {runs.map((r, i) =>
          !r.mark ? (
            <span key={i}>{r.text}</span>
          ) : r.mark.kind === "finding" ? (
            <EvidenceHighlight
              key={i}
              text={r.text}
              active={focusId === r.mark.id}
              item={findItem(items, r.mark.id)}
              onOpen={() => focusItem(r.mark!.id, { view: "findings" })}
            />
          ) : (
            <button
              key={i}
              type="button"
              onClick={() => setView("entities")}
              className="decoration-primary/50 underline decoration-dotted decoration-[1.5px] underline-offset-[5px] hover:decoration-primary"
            >
              {r.text}
            </button>
          ),
        )}
        {p.cites && <Citations cites={p.cites} className="ml-2 align-[0.2em]" />}
      </p>
    </div>
  );
}

/** A passage tied to a finding: soft amber with a thin gold underline. */
export function EvidenceHighlight({
  text,
  active,
  item,
  onOpen,
}: {
  text: string;
  active: boolean;
  item: TimelineItem | undefined;
  onOpen: () => void;
}) {
  return (
    <mark
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      title={item ? `${FLAG_LABEL[item.flag]}: ${item.label}` : undefined}
      className={cn(
        "cursor-pointer rounded-[2px] border-b-[1.5px] border-[var(--underline)] bg-[var(--highlight)] px-0.5 text-inherit transition-colors [box-decoration-break:clone]",
        active
          ? "bg-[var(--lx-hilite)] shadow-[0_0_0_2px_var(--lx-hilite-ring)]"
          : "hover:bg-[var(--lx-hilite-hover)]",
      )}
    >
      {text}
    </mark>
  );
}

/** A video that is not on YouTube: its local copy, or a link to it, and what cites it. */
function ClipSource({ source }: { source: Source }) {
  const { items, focusItem } = useWorkspace();
  const citing = items.filter((i) => (ITEM_CITATIONS[i.id] ?? []).some((c) => c.source === source.id));
  return (
    <article>
      <DocHeader label="Source · Public record · Video" title={source.title} subtitle={source.subtitle} url={source.url} />
      <div className="mt-7">
        {source.localVideo ? (
          <LocalClip src={source.localVideo} href={source.url} label={source.title} className="rounded-lg" />
        ) : (
          <p className="text-[15px] text-muted-foreground">No copy of this video is in the packet. Open it from the link above.</p>
        )}
      </div>
      {citing.length > 0 && (
        <section className="mt-9">
          <h2 className="font-serif text-[26px] leading-snug">Cited by</h2>
          <ul className="mt-3 space-y-2">
            {citing.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => focusItem(i.id)} className="text-left text-[17px] text-primary hover:underline">
                  {i.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

function VideoSource({
  source,
  flashAnchor,
  flashKey,
}: {
  source: Source;
  flashAnchor: string | null;
  flashKey: string | null;
}) {
  const { videoTime, setVideoTime, items, focusId, focusItem } = useWorkspace();
  const video = source.video!;
  const t = videoTime[video] ?? 0;
  const observations = items
    .map((item) => ({
      item,
      at: (ITEM_CITATIONS[item.id] ?? []).find((c) => c.source === source.id && "t" in c),
    }))
    .filter((o): o is { item: TimelineItem; at: { source: string; t: number } } => !!o.at)
    .sort((a, b) => a.at.t - b.at.t);
  const marks = [
    ...new Set([
      ...FRAMES.filter((f) => f.video === video).map((f) => f.at),
      ...observations.map((o) => o.at.t),
    ]),
  ].sort((a, b) => a - b);

  return (
    <article>
      <DocHeader
        label="Source · Public record · Video"
        title={source.title}
        subtitle={source.subtitle}
        url={source.url}
      />
      <div className="mt-7">
        <PlayableStill
          key={`${video}-${t}`}
          video={video}
          at={t}
          badge={`${source.title.toUpperCase()} · ${mmss(t)}`}
          className="rounded-lg"
        />
        <div
          className="mt-3 flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Jump to a moment"
        >
          <span className="mr-1 text-sm text-muted-foreground">Jump to</span>
          {marks.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setVideoTime(video, m)}
              aria-pressed={m === t}
              className={cn(
                "h-7 rounded-md border px-2 font-mono text-[13px] transition-colors",
                m === t
                  ? "border-primary bg-accent text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {mmss(m)}
            </button>
          ))}
        </div>
      </div>

      <section className="mt-9">
        <h2 className="font-serif text-[28px] leading-snug">Observations</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paraphrased descriptions of what the footage shows, not a transcript. Times are
          approximate.
        </p>
        {observations.length === 0 ? (
          <p className="mt-5 text-base text-muted-foreground">
            Nothing from this video is on the timeline yet.
          </p>
        ) : (
          <ol className="mt-5 space-y-3">
            {observations.map(({ item, at }) => {
              const anchor = `t:${at.t}`;
              return (
                <li
                  key={`${item.id}-${flashAnchor === anchor ? flashKey : ""}`}
                  id={`anchor-${source.id}-${anchor}`}
                  className={cn("scroll-mt-24", flashAnchor === anchor && "lx-flash")}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setVideoTime(video, at.t);
                      focusItem(item.id);
                    }}
                    className={cn(
                      "grid w-full grid-cols-[5.5rem_3.25rem_minmax(0,1fr)] items-start gap-3 rounded-lg border p-2.5 text-left transition-colors",
                      focusId === item.id
                        ? "border-[var(--lx-link-border)] bg-accent/60"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <FrameThumb
                      src={
                        FRAMES.find((f) => f.video === video && f.at === at.t)?.src ??
                        FRAMES.find((f) => f.video === video)!.src
                      }
                      className="aspect-video w-full rounded"
                    />
                    <span className="pt-0.5 font-mono text-[13px] text-muted-foreground">
                      {mmss(at.t)}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-serif text-[22px] leading-snug">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block text-[15px] leading-relaxed text-muted-foreground">
                        {item.extractedText}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </article>
  );
}

function MissingSource({ source }: { source: Source }) {
  const { items } = useWorkspace();
  const gap = items.find((i) => (ITEM_CITATIONS[i.id] ?? []).some((c) => c.source === source.id));
  return (
    <article>
      <DocHeader
        label="Source · Referenced, not received"
        title={source.title}
        subtitle={source.subtitle}
      />
      <div className="mt-7 rounded-lg border border-dashed border-[var(--lx-amber-border)] bg-[var(--lx-amber-bg)] p-5">
        <p className="font-serif text-xl leading-[1.45]">
          {gap?.extractedText ?? "This source is referenced but no file is in the record."}
        </p>
        <p className="mt-3 text-sm text-[color:var(--lx-amber-text)]">
          Possible gap. Request the recording if it exists.
        </p>
      </div>
    </article>
  );
}

function MessageSource({ itemId }: { itemId: string }) {
  const { items } = useWorkspace();
  const { messages } = useCase();
  const item = findItem(items, itemId);
  if (!item)
    return <p className="text-muted-foreground">This attachment is not on the timeline.</p>;
  const preview = messages.find((m) => m.preview && m.text.startsWith(item.sourceLabel))?.preview;
  return (
    <article>
      <DocHeader
        label="Source · Text message"
        title={item.sourceLabel}
        subtitle="Received on the case line. The text below was read from the attachment; it is not the original file."
        url={item.sourceLink}
      />
      {preview && <FrameThumb src={preview} className="mt-7 aspect-video w-full rounded-lg" />}
      <div className="mt-7 grid grid-cols-[3.25rem_minmax(0,1fr)]">
        <span className="pt-[0.55rem] font-mono text-[13px] text-[color:var(--lx-faint)]">¶1</span>
        <p className="font-serif text-xl leading-[1.5] text-[color:var(--lx-ink)]">
          {item.extractedText || item.label}
        </p>
      </div>
    </article>
  );
}
