import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MessageSquare } from "lucide-react";
import { ConflictDialog } from "@/components/caselens/conflict-dialog";
import { useCase } from "@/lib/case-store";
import { CASE_LINE } from "@/lib/config";
import { DOC_FINDINGS, FLAG_LABEL, type TimelineItem } from "@/lib/sample-case";
import { DOC_FINDING_CITATIONS, ENTITIES, SOURCES, type EntityType } from "@/lib/sources";
import { cn } from "@/lib/utils";
import { useWorkspace, type View } from "./context";
import { EvidenceTimeline } from "./evidence-timeline";
import { MessagingPanel } from "./messaging-panel";
import { DraftReviewCard, FindingCard } from "./review-cards";
import { Citations } from "./source-citation";

const HEAD: Record<View, { stage: string; title: string }> = {
  ingest: { stage: "Step 1 · Ingest", title: "Sources received" },
  entities: { stage: "Step 2 · Extract", title: "People, places and dates" },
  timeline: { stage: "Step 3 · Timeline", title: "Events in order" },
  findings: { stage: "Step 4 · Flag", title: "Possible conflicts and gaps" },
  drafts: { stage: "Step 5 · Draft", title: "Drafts for attorney review" },
  messages: { stage: "Case line", title: "Messages" },
};

/** The right column. What it shows follows the selected step or workspace item. */
export function IntelligencePanel() {
  const { view } = useWorkspace();
  const [compare, setCompare] = useState<{ claim: TimelineItem; footage: TimelineItem } | null>(
    null,
  );
  const head = HEAD[view];
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [view]);

  return (
    <div
      ref={scroller}
      className={cn("flex h-full flex-col", view !== "messages" && "lx-scroll overflow-y-auto")}
    >
      <div
        key={view}
        className={cn(
          "lx-fade flex flex-col px-5 pb-8 pt-7 sm:px-7",
          view === "messages" && "min-h-0 flex-1 pb-5",
        )}
      >
        <p className="font-mono text-[12px] uppercase tracking-[0.1em] text-primary">
          {head.stage}
        </p>
        <h2 className="mt-1.5 font-serif text-[30px] leading-[1.1] text-foreground">
          {head.title}
        </h2>
        <div className={cn("mt-6", view === "messages" && "flex min-h-0 flex-1 flex-col")}>
          {view === "ingest" && <IngestView />}
          {view === "entities" && <EntitiesView />}
          {view === "timeline" && <EvidenceTimeline />}
          {view === "findings" && (
            <FindingsView onCompare={(claim, footage) => setCompare({ claim, footage })} />
          )}
          {view === "drafts" && <DraftsView />}
          {view === "messages" && <MessagingPanel />}
        </div>
      </div>
      <ConflictDialog
        claim={compare?.claim ?? null}
        footage={compare?.footage ?? null}
        onClose={() => setCompare(null)}
        className="lx-analysis"
      />
    </div>
  );
}

function IngestView() {
  const { openSource, setView, items } = useWorkspace();
  const { busy, mode, messages } = useCase();
  const available = SOURCES.filter((s) => s.available);
  const missing = SOURCES.filter((s) => !s.available);
  const attachments = items.filter((i) => i.id.startsWith("item-"));
  const kind: Record<string, string> = {
    summary: "Summary",
    document: "Court filing",
    video: "Video",
    audio: "Audio",
  };

  return (
    <div className="space-y-6">
      <p className="text-[15px] text-muted-foreground">
        {available.length + attachments.length} indexed · {missing.length} referenced but not
        received
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border bg-white">
        {[...available, ...missing].map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => openSource(s.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[20px] leading-tight">{s.title}</span>
                <span className="text-[13px] text-muted-foreground">{kind[s.kind]}</span>
              </span>
              {s.available ? (
                <span className="text-[13px] text-corroborate">Indexed</span>
              ) : (
                <span className="rounded border border-[#e6c98c] bg-[#fbf3e1] px-1.5 text-[12px] text-[#8a5a12]">
                  Referenced, not received
                </span>
              )}
            </button>
          </li>
        ))}
        {attachments.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => openSource(`msg:${i.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-serif text-[20px] leading-tight">
                  {i.sourceLabel}
                </span>
                <span className="text-[13px] text-muted-foreground">Text message attachment</span>
              </span>
              <span className="text-[13px] text-corroborate">Indexed</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-xl border border-border bg-white p-4">
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
          Message intake
        </p>
        <p className="mt-2 text-[15px] leading-relaxed">
          The team texts photos, pages and voice notes to{" "}
          <span className="font-mono">{CASE_LINE}</span>
          {mode === "photon"
            ? " over iMessage, through Photon."
            : ". This demo runs a simulated line in the page."}
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {busy ? "Reading a new message…" : `${messages.length} messages on the line.`}
        </p>
        <button
          type="button"
          onClick={() => setView("messages")}
          className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-[13px] font-medium hover:bg-muted"
        >
          <MessageSquare className="size-3.5" /> Open messages
        </button>
      </div>
    </div>
  );
}

const TYPES: EntityType[] = ["Person", "Place", "Date", "Organization"];

function EntitiesView() {
  return (
    <div className="space-y-6">
      <p className="text-[14px] leading-relaxed text-muted-foreground">
        A small index of names that appear in the sample documents, prepared by hand. Mentions are
        marked in the open document while this step is selected.
      </p>
      {TYPES.map((type) => {
        const list = ENTITIES.filter((e) => e.type === type);
        if (list.length === 0) return null;
        return (
          <section key={type}>
            <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
              {type === "Person"
                ? "People"
                : type === "Place"
                  ? "Places"
                  : type === "Date"
                    ? "Dates"
                    : "Organizations"}
            </p>
            <ul className="divide-y divide-border rounded-xl border border-border bg-white">
              {list.map((e) => (
                <li key={e.name} className="flex items-start justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-serif text-[21px] leading-tight">{e.name}</span>
                    <span className="text-[13px] text-muted-foreground">{e.role}</span>
                  </span>
                  <Citations cites={e.cites} className="shrink-0 justify-end pt-1" />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

const RANK: Record<string, number> = { conflict: 0, missing: 1, agrees: 2 };

function FindingsView({
  onCompare,
}: {
  onCompare: (claim: TimelineItem, footage: TimelineItem) => void;
}) {
  const { items } = useWorkspace();
  const findings = items
    .filter((i) => i.flag !== "agrees" || i.relatedId)
    .sort((a, b) => (RANK[a.flag] ?? 9) - (RANK[b.flag] ?? 9) || a.start - b.start);
  if (findings.length === 0 && DOC_FINDINGS.length === 0)
    return (
      <p className="text-[15px] text-muted-foreground">No conflicts or gaps are flagged yet.</p>
    );
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted-foreground">
        Suggestions only. Each one stays unverified until a person checks the sources.
      </p>
      {findings.map((i) => (
        <FindingCard key={i.id} item={i} onCompare={onCompare} />
      ))}
      {DOC_FINDINGS.map((f) => (
        <article key={f.id} className="lx-fade rounded-xl border border-border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <p
              className={cn(
                "font-mono text-[12px] uppercase tracking-[0.08em]",
                f.kind === "conflict" ? "text-[#b4232a]" : "text-[#1f7a4d]",
              )}
            >
              {FLAG_LABEL[f.kind]} · documents only
            </p>
            <span className="text-[13px] text-muted-foreground">No video time</span>
          </div>
          <h3 className="mt-2 font-serif text-[24px] leading-tight">{f.title}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-[#38425c]">AI finding: {f.explanation}</p>
          <Citations cites={DOC_FINDING_CITATIONS[f.id] ?? []} className="mt-3" />
        </article>
      ))}
    </div>
  );
}

function DraftsView() {
  const { queue, decisions } = useWorkspace();
  const approved = queue.filter((i) => decisions[i.id] === "confirmed").length;
  if (queue.length === 0)
    return <p className="text-[15px] text-muted-foreground">Nothing is waiting for review.</p>;
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted-foreground">
        Approving adds a finding to the attorney handoff. Nothing is sent or filed from here.
      </p>
      {queue.map((i) => (
        <DraftReviewCard key={i.id} item={i} />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[14px]">
        <span className="text-muted-foreground">
          {approved} of {queue.length} approved
        </span>
        <Link
          to="/handoff"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Open handoff <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
