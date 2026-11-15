import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/caselens/shared";
import { useActiveCase, useFiledItems } from "@/lib/case-store";
import { useDecisions } from "@/lib/review-store";
import { seo } from "@/lib/seo";
import {
  FLAG_LABEL,
  LANES,
  findItem,
  formatRange,
  handoffItems,
  type TimelineItem,
} from "@/lib/sample-case";

export const Route = createFileRoute("/_workspace/handoff")({
  head: () =>
    seo("Handoff", "One-page summary of confirmed items with sources, ready for an attorney."),
  component: Handoff,
});

function Handoff() {
  const decisions = useDecisions();
  const items = useFiledItems();
  const activeCase = useActiveCase();
  const confirmed = handoffItems(items, decisions);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={activeCase.label}
        title="Handoff"
        desc={`${activeCase.name}, ${activeCase.sub}. Items a person confirmed, each with its source.`}
      >
        <Button type="button" onClick={() => window.print()} className="print:hidden">
          <Printer className="size-4" /> Print or save as PDF
        </Button>
      </PageHeader>

      {confirmed.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-base text-muted-foreground">
          Nothing is confirmed yet. Confirm items on the Review page and they appear here.
        </p>
      ) : (
        <ol className="space-y-4">
          {confirmed.map((item, n) => (
            <HandoffItem key={item.id} item={item} items={items} n={n + 1} />
          ))}
        </ol>
      )}

      <p className="text-sm text-muted-foreground">
        Potential findings for attorney review. They are suggestions from public sources and are not
        legal conclusions.
      </p>
    </div>
  );
}

function HandoffItem({ item, items, n }: { item: TimelineItem; items: TimelineItem[]; n: number }) {
  const related = findItem(items, item.relatedId);
  const lane = LANES.find((l) => l.id === item.lane)?.label;
  const sources = [item, ...(related ? [related] : [])];

  return (
    <li className="break-inside-avoid rounded-lg border bg-card p-5">
      <p className="font-mono text-sm text-muted-foreground">
        {n}. {FLAG_LABEL[item.flag]} · {lane} · {formatRange(item)}
      </p>
      <h2 className="mt-1 font-serif text-xl">{item.label}</h2>
      <p className="mt-2 text-base leading-relaxed">{item.extractedText}</p>
      <ul className="mt-3 space-y-1 text-sm">
        {sources.map((s) => (
          <li key={s.id}>
            {s.sourceLink ? (
              <a
                href={s.sourceLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex flex-wrap items-center gap-1 text-gold hover:underline"
              >
                Source: {s.sourceLabel} <ExternalLink className="size-4 print:hidden" />
                <span className="hidden break-all text-muted-foreground print:inline">
                  ({s.sourceLink})
                </span>
              </a>
            ) : (
              <span className="text-muted-foreground">Source: {s.sourceLabel}</span>
            )}
          </li>
        ))}
      </ul>
    </li>
  );
}
