import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  CircleDashed,
  Columns2,
  Info,
  Layers,
  NotebookPen,
  TriangleAlert,
} from "lucide-react";
import { ChatPanel } from "@/components/caselens/chat-panel";
import { ConflictDialog } from "@/components/caselens/conflict-dialog";
import { LANE_ICON, LocalClip, PageThumb, PlayableStill } from "@/components/caselens/evidence-media";
import { Timeline } from "@/components/caselens/timeline";
import { DatedCaseLive } from "@/components/cases/dated-case-live";
import { getCase, useActiveCase, useFiledItems } from "@/lib/case-store";
import { startDemo } from "@/lib/demo";
import { mediaFor, nearestFrame } from "@/lib/media";
import { setNote, useNotes } from "@/lib/notes-store";
import { decide, useDecisions } from "@/lib/review-store";
import {
  FLAG_LABEL,
  LANES,
  SAMPLE_CASE,
  findItem,
  formatClock,
  formatTime,
  itemsAt,
  shortLabel,
  sourceTimeAt,
  type Flag,
  type TimelineItem,
} from "@/lib/sample-case";
import { seo } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_workspace/live")({
  // Keeps ?demo=1 (replay the demo) and ?case=<id> (which case to open).
  validateSearch: (search: Record<string, unknown>): { demo?: number; case?: string } => ({
    ...([1, "1", true].includes(search["demo"] as never) ? { demo: 1 } : {}),
    ...(typeof search["case"] === "string" ? { case: search["case"] } : {}),
  }),
  head: () =>
    seo("Live Case", "Text evidence to one number and watch it land on a live case timeline."),
  component: LivePage,
});

/** Where the case opens: the first verified video moment, or the BTK case's mailed disk. */
const OPEN_AT = SAMPLE_CASE.openAt;

function LivePage() {
  const meta = useActiveCase();
  return meta.kind === "dated" ? <DatedCaseLive caseId={meta.id} /> : <LiveCase />;
}

function LiveCase() {
  const { demo } = Route.useSearch();
  const [playhead, setPlayhead] = useState(OPEN_AT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compare, setCompare] = useState<{ claim: TimelineItem; footage: TimelineItem } | null>(
    null,
  );
  const [demoRunning, setDemoRunning] = useState(false);
  const items = useFiledItems();
  const decisions = useDecisions();

  useEffect(() => {
    if (!demo || getCase().mode === "photon") return;
    setDemoRunning(true);
    setSelectedId(null);
    setPlayhead(OPEN_AT);
    const controller = startDemo(() => setDemoRunning(false));
    return () => controller.stop();
  }, [demo]);

  const confirmedIds = useMemo(
    () =>
      new Set(
        Object.entries(decisions)
          .filter(([, d]) => d === "confirmed")
          .map(([id]) => id),
      ),
    [decisions],
  );

  const openCompare = (claim: TimelineItem) => {
    const footage = findItem(items, claim.relatedId);
    if (footage) setCompare({ claim, footage });
  };

  const select = (id: string) => {
    setSelectedId(id);
    const item = findItem(items, id);
    if (item && (playhead < item.start || playhead > item.end)) setPlayhead(item.start);
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <CaseHeader items={items} />

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <ChatPanel
          selectedId={selectedId}
          onSelect={select}
          locked={demoRunning}
          className="mx-auto h-[36rem] max-w-md xl:sticky xl:top-[4.75rem] xl:mx-0 xl:h-[calc(100vh-6.5rem)] xl:max-h-[46rem] xl:min-h-[32rem] xl:max-w-none"
        />

        <div className="min-w-0 space-y-5">
          <section className="rounded-xl border bg-card p-5" aria-label="Synchronized timeline">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <h2 className="font-serif text-lg font-medium">Timeline</h2>
                <p role="note" className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Info className="size-3.5 shrink-0 self-center" aria-hidden />
                  Findings are suggestions. Confirm before use.
                </p>
              </div>
              <ul
                className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground"
                aria-label="Legend"
              >
                <li className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-corroborate" /> Agrees
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-3.5 w-1.5 rounded-sm bg-contradiction/70" /> Possible conflict
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-3 w-5 rounded-sm border border-dashed border-missing bg-missing/10" />{" "}
                  Missing
                </li>
              </ul>
            </div>
            {/* On narrow screens the timeline scrolls inside its card rather than the page. */}
            <div className="max-lg:-mx-5 max-lg:overflow-x-auto max-lg:px-5">
              <div className="max-lg:min-w-[720px]">
                <Timeline
                  items={items}
                  playhead={playhead}
                  onPlayhead={setPlayhead}
                  selectedId={selectedId}
                  onSelect={select}
                  onOpenConflict={openCompare}
                  confirmedIds={confirmedIds}
                />
              </div>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {SAMPLE_CASE.axisNote}
            </p>
          </section>

          <MomentPanel
            items={items}
            playhead={playhead}
            selectedId={selectedId}
            onSelect={select}
            onCompare={(claim, footage) => setCompare({ claim, footage })}
            confirmedIds={confirmedIds}
          />
        </div>
      </div>

      <ConflictDialog
        claim={compare?.claim ?? null}
        footage={compare?.footage ?? null}
        onClose={() => setCompare(null)}
      />
    </div>
  );
}

function CaseHeader({ items }: { items: TimelineItem[] }) {
  const evidence = items.filter((i) => i.flag !== "missing").length;
  const conflicts = items.filter((i) => i.flag === "conflict").length;
  const gaps = items.filter((i) => i.flag === "missing").length;
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-serif text-[1.75rem] font-medium leading-tight">{SAMPLE_CASE.name}</h1>
        <span className="font-mono text-sm text-muted-foreground">{SAMPLE_CASE.number}</span>
        <span className="text-sm text-muted-foreground">{SAMPLE_CASE.label}</span>
      </div>
      <ul className="flex flex-wrap gap-2.5" aria-label="Case summary">
        <Stat icon={Layers} tone="text-corroborate" value={evidence} label="Evidence items" />
        <Stat
          icon={TriangleAlert}
          tone="text-contradiction"
          value={conflicts}
          label="Possible conflicts"
        />
        <Stat icon={CircleDashed} tone="text-missing" value={gaps} label="Gaps" />
      </ul>
    </div>
  );
}

function Stat({
  icon: Icon,
  tone,
  value,
  label,
}: {
  icon: typeof Layers;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2.5 rounded-lg border bg-card py-2 pl-3 pr-4">
      <Icon className={cn("size-4 shrink-0", tone)} aria-hidden />
      <span className="text-lg font-semibold tabular-nums leading-none">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </li>
  );
}

const PRIORITY: Record<string, number> = {
  dashcam: 0,
  bodycam: 1,
  documents: 2,
  events: 3,
  dispatch: 4,
};

function kindOf(item: TimelineItem): string {
  if (item.flag === "missing") return "Gap";
  if (item.lane === "dashcam" || item.lane === "bodycam") return "Observational";
  if (item.lane === "documents") return item.flag === "conflict" ? "As alleged" : "From the record";
  if (item.lane === "court") return "Court record";
  if (item.lane === "investigation") return "As reported";
  if (item.lane === "incidents") return "Charged incident";
  return "Observational";
}

const FLAG_TONE: Record<Flag, string> = {
  agrees: "border-corroborate/40 text-[#5fd39a]",
  conflict: "border-contradiction/50 text-[#ff8f92]",
  missing: "border-missing/50 text-[#ff9a5c]",
};

function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

function MomentPanel({
  items,
  playhead,
  selectedId,
  onSelect,
  onCompare,
  confirmedIds,
}: {
  items: TimelineItem[];
  playhead: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCompare: (claim: TimelineItem, footage: TimelineItem) => void;
  confirmedIds: Set<string>;
}) {
  const notes = useNotes();
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState("");

  const here = itemsAt(items, playhead).sort(
    (a, b) =>
      Number(a.end - a.start >= 80) - Number(b.end - b.start >= 80) ||
      (PRIORITY[a.lane] ?? 9) - (PRIORITY[b.lane] ?? 9) ||
      a.start - b.start,
  );
  const focus = here.find((i) => i.id === selectedId) ?? here[0];

  useEffect(() => {
    setNoteOpen(false);
  }, [focus?.id]);

  if (!focus) {
    return (
      <section className="rounded-xl border bg-card p-5" aria-live="polite">
        <h2 className="font-serif text-lg font-medium">At {formatTime(playhead)}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nothing is filed at this moment. Drag the playhead to a marked item.
        </p>
      </section>
    );
  }

  const media = mediaFor(focus);
  const lane = LANES.find((l) => l.id === focus.lane);
  const videoAt =
    media?.kind === "video"
      ? (sourceTimeAt(playhead, media.video) ??
        media.at + Math.min(Math.max(playhead - focus.start, 0), focus.end - focus.start))
      : null;
  const conflict = items.find(
    (i) => i.flag === "conflict" && (i.id === focus.id || i.relatedId === focus.id),
  );
  const pairClaim = conflict ?? (focus.relatedId ? focus : undefined);
  const pairFootage = pairClaim ? findItem(items, pairClaim.relatedId) : undefined;
  const target = conflict ?? focus;
  const confirmed = confirmedIds.has(target.id);
  const note = notes[focus.id];
  const others = here.filter((i) => i.id !== focus.id);
  const LaneIcon = LANE_ICON[focus.lane];

  return (
    <section
      className="rounded-xl border bg-card p-5"
      aria-live="polite"
      aria-label="Moment detail"
    >
      <div
        key={`${focus.id}:${media?.kind === "video" && videoAt !== null ? nearestFrame(media.video, videoAt).src : ""}`}
        className="lx-fade grid gap-5 md:grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)] min-[1400px]:grid-cols-[minmax(15rem,19rem)_minmax(0,1fr)_auto]"
      >
        {/* Media */}
        <div className="min-w-0">
          {media?.kind === "video" && videoAt !== null ? (
            <PlayableStill video={media.video} at={videoAt} />
          ) : media?.kind === "page" ? (
            <a
              href={focus.sourceLink ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="relative block aspect-video overflow-hidden rounded-md ring-1 ring-white/10"
              aria-label={`Open ${focus.sourceLabel}`}
            >
              <PageThumb page={media.page} highlight focusTop className="size-full" />
              <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-px font-mono text-[13px] text-white">
                p.{media.page.page}
              </span>
            </a>
          ) : media?.kind === "clip" ? (
            <LocalClip src={media.src} href={media.href} label={media.file} />
          ) : focus.flag !== "missing" ? (
            <a
              href={focus.sourceLink ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="grid aspect-video place-items-center rounded-md border border-white/10 text-sm text-muted-foreground hover:border-white/25"
            >
              <span className="flex items-center gap-2">
                <LaneIcon className="size-4" aria-hidden /> No preview · open the source
              </span>
            </a>
          ) : (
            <div className="grid aspect-video place-items-center rounded-md border border-dashed border-missing/70 bg-missing/[0.05] text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CircleDashed className="size-4 text-missing" aria-hidden /> Not in the record
              </span>
            </div>
          )}
        </div>

        {/* Observation */}
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-serif text-xl font-medium">
            <LaneIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            At {formatTime(playhead)} — {lane?.label}
          </h2>
          {conflict && conflict.id !== focus.id && (
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-[#ff8f92]">
              <span className="size-1.5 rounded-full bg-contradiction" aria-hidden />
              Possible conflict with {conflict.sourceLabel}: “
              {conflict.label.replace(/^Stated reason:\s*/i, "")}”
            </p>
          )}
          <p className="mt-2 text-base leading-relaxed">{firstSentence(focus.extractedText)}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5 text-sm">
            <li className="rounded-full border border-white/10 px-2.5 py-0.5 text-muted-foreground">
              {kindOf(focus)}
            </li>
            {(focus.flag !== "agrees" || focus.relatedId) && (
              <li className={cn("rounded-full border px-2.5 py-0.5", FLAG_TONE[focus.flag])}>
                {FLAG_LABEL[focus.flag]}
              </li>
            )}
            <li
              className="max-w-full truncate rounded-full border border-white/10 px-2.5 py-0.5 text-muted-foreground"
              title={focus.sourceLabel}
            >
              {media?.kind === "video" || media?.kind === "clip"
                ? media.file
                : media?.kind === "page"
                  ? media.page.file
                  : focus.sourceLabel}
            </li>
            <li className="rounded-full border border-white/10 px-2.5 py-0.5 font-mono text-[13px] leading-6 text-muted-foreground">
              {videoAt !== null
                ? formatClock(videoAt)
                : media?.kind === "page"
                  ? `p.${media.page.page}`
                  : `~${formatTime(focus.start)}`}
            </li>
          </ul>
          {note && !noteOpen && (
            <p className="mt-3 border-l-2 border-white/15 pl-3 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Note:</span> {note}
            </p>
          )}
          {noteOpen && (
            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setNote(focus.id, draft);
                setNoteOpen(false);
              }}
            >
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={2}
                aria-label="Note"
                placeholder="Add a note for the review"
                className="w-full resize-none rounded-md border border-white/10 bg-background px-3 py-2 text-sm outline-none focus:border-white/25"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-md border border-white/15 px-3 py-1 text-sm hover:bg-white/5"
                >
                  Save note
                </button>
                <button
                  type="button"
                  onClick={() => setNoteOpen(false)}
                  className="px-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {others.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Also here:</span>
              {others.map((i) => {
                const Icon = LANE_ICON[i.lane];
                return (
                  <button
                    key={i.id}
                    type="button"
                    onClick={() => onSelect(i.id)}
                    title={i.label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-0.5 text-muted-foreground transition-colors hover:border-white/25 hover:text-foreground"
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {shortLabel(i, 24)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-row flex-wrap gap-2 md:col-span-2 min-[1400px]:col-span-1 min-[1400px]:w-44 min-[1400px]:flex-col">
          <button
            type="button"
            onClick={() => decide(target.id, "confirmed")}
            aria-pressed={confirmed}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              confirmed
                ? "border border-gold/50 text-gold hover:bg-gold/10"
                : "bg-gold text-[#14120d] hover:bg-[#d6b77c]",
            )}
          >
            {confirmed ? (
              <>
                <Check className="size-4" /> Confirmed
              </>
            ) : (
              "Confirm finding"
            )}
          </button>
          <button
            type="button"
            disabled={!pairClaim || !pairFootage}
            onClick={() => pairClaim && pairFootage && onCompare(pairClaim, pairFootage)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5 disabled:opacity-40"
          >
            <Columns2 className="size-4" /> Compare sources
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(note ?? "");
              setNoteOpen((o) => !o);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/5"
          >
            <NotebookPen className="size-4" /> {note ? "Edit note" : "Add note"}
          </button>
        </div>
      </div>
    </section>
  );
}
