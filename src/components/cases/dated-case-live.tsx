import { useEffect, useRef, useState } from "react";
import { Columns2, ExternalLink, TriangleAlert } from "lucide-react";
import { ChatPanel } from "@/components/caselens/chat-panel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFiledItems } from "@/lib/case-store";
import { caseMeta, publicCase } from "@/lib/cases";
import type { CaseFinding } from "@/lib/case-library";
import { cn } from "@/lib/utils";

/**
 * Live Case for a public-record case. There is no video clip to scrub, so the timeline is the
 * case's own dated events, and the findings are the contradictions its public sources describe.
 */
export function DatedCaseLive({ caseId }: { caseId: string }) {
  const meta = caseMeta(caseId);
  const data = publicCase(caseId);
  const items = useFiledItems();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compare, setCompare] = useState<CaseFinding | null>(null);
  const flaggedRef = useRef<HTMLDivElement>(null);

  // A different case starts with nothing selected.
  useEffect(() => setSelectedId(null), [caseId]);

  if (!data) return null;

  const events = items.filter((i) => i.lane === "events");
  const flagged = items.filter((i) => i.flag !== "agrees");
  const conflicts = flagged.filter((i) => i.flag === "conflict").length;
  const gaps = flagged.filter((i) => i.flag === "missing").length;

  function select(id: string) {
    setSelectedId(id);
    flaggedRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 font-mono text-sm text-gold">{meta.label}</p>
          <h1 className="font-serif text-[1.75rem] font-medium leading-tight">{data.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.location} · {data.category}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Case summary counts">
          <li className="rounded-lg border bg-card px-3 py-1.5">{events.length} dated events</li>
          <li className="flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5">
            <TriangleAlert className="size-4 text-contradiction" aria-hidden /> {conflicts} possible
            conflict{conflicts === 1 ? "" : "s"}
          </li>
          <li className="rounded-lg border border-dashed border-missing/60 bg-card px-3 py-1.5">
            {gaps} open prompt{gaps === 1 ? "" : "s"}
          </li>
        </ul>
      </div>

      <div className="grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <ChatPanel
          readOnly
          selectedId={selectedId}
          onSelect={select}
          className="mx-auto max-h-[34rem] max-w-sm xl:mx-0"
        />

        <div className="min-w-0 space-y-6">
          <section ref={flaggedRef} className="rounded-lg border bg-card p-5" aria-label="Findings">
            <h2 className="font-serif text-xl">Findings to review</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Findings are suggestions. Confirm before use. They come from what the linked public
              sources say, not from the original records.
            </p>
            <ul className="mt-4 space-y-3">
              {flagged.map((item) => {
                const n = /-f(\d+)(?:-s\d+)?$/.exec(item.id)?.[1];
                const finding = n ? data.findings[Number(n) - 1] : undefined;
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "rounded-lg border p-4",
                      item.flag === "conflict"
                        ? "border-contradiction/60"
                        : "border-dashed border-missing/70",
                      selectedId === item.id && "ring-2 ring-foreground",
                    )}
                  >
                    <p className="font-mono text-sm text-muted-foreground">
                      {item.flag === "conflict" ? "Possible conflict" : "Open prompts"}
                    </p>
                    <h3 className="mt-1 font-serif text-lg">{item.label}</h3>
                    <p className="mt-1 text-base leading-relaxed">{item.extractedText}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                      {item.sourceLink && (
                        <a
                          href={item.sourceLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-gold hover:underline"
                        >
                          {item.sourceLabel} <ExternalLink className="size-4" />
                        </a>
                      )}
                      {finding && (
                        <button
                          type="button"
                          onClick={() => setCompare(finding)}
                          className="inline-flex items-center gap-1.5 rounded-md border bg-muted px-3 py-1.5 hover:border-gold"
                        >
                          <Columns2 className="size-4" aria-hidden /> Compare sources
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-lg border bg-card p-5" aria-label="Timeline">
            <h2 className="font-serif text-xl">Timeline</h2>
            <ol className="mt-4 space-y-4 border-l border-border pl-5">
              {events.map((e) => (
                <li key={e.id} className="relative">
                  <span
                    className="absolute -left-[1.62rem] top-1.5 size-2.5 rounded-full border border-border bg-muted-foreground/60"
                    aria-hidden
                  />
                  <p className="font-mono text-sm text-gold">{e.when}</p>
                  <p className="mt-0.5 text-base leading-relaxed">{e.extractedText}</p>
                </li>
              ))}
            </ol>
            {data.timelineSource && (
              <p className="mt-4 text-sm text-muted-foreground">
                Source:{" "}
                <a
                  href={data.timelineSource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold hover:underline"
                >
                  {data.timelineSource.label}
                </a>
              </p>
            )}
          </section>
        </div>
      </div>

      <Dialog open={compare !== null} onOpenChange={(o) => !o && setCompare(null)}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl font-medium">
              {compare?.title.replace(/\.$/, "") || "Compare sources"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              A possible conflict, not a conclusion. Read each side and decide for yourself.
            </DialogDescription>
          </DialogHeader>
          <div
            className={cn(
              "grid gap-3",
              (compare?.sides.length ?? 0) > 2 ? "md:grid-cols-3" : "md:grid-cols-2",
            )}
          >
            {compare?.sides.map((s) => (
              <div key={s.label} className="rounded-lg border bg-background p-4">
                <p className="font-mono text-sm text-muted-foreground">{s.label}</p>
                <p className="mt-2 font-serif text-lg leading-snug">{s.text}</p>
                <p className="mt-3 text-sm text-muted-foreground">{s.cite}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{compare?.explanation}</p>
          <a
            href={data.primarySource.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-gold hover:underline"
          >
            {data.primarySource.label} <ExternalLink className="size-4" />
          </a>
        </DialogContent>
      </Dialog>
    </div>
  );
}
