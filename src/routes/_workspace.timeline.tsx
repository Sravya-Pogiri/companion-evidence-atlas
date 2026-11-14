import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { evidence, timeline, type TimelineEvent } from "@/lib/case-data";
import { PageHeader, SimBadge, typeIcon } from "@/components/caselens/shared";
import { seo } from "@/lib/seo";
import { Swimlane } from "@/components/caselens/swimlane";

export const Route = createFileRoute("/_workspace/timeline")({
  head: () => seo("Incident Timeline", "Chronological reconstruction from documents, recordings, and statements."),
  component: Timeline,
});

const typeColor = { incident: "bg-navy-2", police: "bg-related", call: "bg-corroborate", statement: "bg-gold" };
const people = Array.from(new Set(timeline.flatMap((t) => t.people)));

function Timeline() {
  const [person, setPerson] = useState("all"); const [type, setType] = useState("all"); const [src, setSrc] = useState("all"); const [after, setAfter] = useState("all");
  const [open, setOpen] = useState<TimelineEvent | null>(null);
  const shown = timeline.filter((t) => (person === "all" || t.people.includes(person)) && (type === "all" || t.type === type) && (src === "all" || t.source === src) && (after === "all" || t.time >= after));
  const F = ({ v, set, label, opts }: { v: string; set: (s: string) => void; label: string; opts: [string, string][] }) => (
    <Select value={v} onValueChange={set}><SelectTrigger className="w-48" aria-label={label}><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="all">{label}: all</SelectItem>{opts.map(([a, b]) => <SelectItem key={a} value={a}>{b}</SelectItem>)}</SelectContent></Select>
  );
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="State v. Alex Morgan" title="Incident Timeline" desc="Events extracted across sources. Conflicting and uncertain events are flagged."><SimBadge /></PageHeader>
      <div className="mb-6 flex flex-wrap gap-2">
        <F v={person} set={setPerson} label="Person" opts={people.map((p) => [p, p])} />
        <F v={type} set={setType} label="Event type" opts={[["incident", "Incident"], ["police", "Police"], ["call", "911 call"], ["statement", "Statement"]]} />
        <F v={src} set={setSrc} label="Source" opts={evidence.map((e) => [e.name, e.name])} />
        <F v={after} set={setAfter} label="From time" opts={[["20:15", "After 20:15"], ["20:30", "After 20:30"]]} />
      </div>
      <Swimlane events={shown} onOpen={setOpen} />
      <h2 className="mb-4 font-semibold">Chronological reconstruction</h2>
      <div className="relative pl-24">
        <div className="absolute bottom-0 left-[4.6rem] top-0 w-px bg-border" />
        {shown.map((t) => {
          const I = typeIcon[t.sourceType];
          return (
            <button key={t.id} onClick={() => setOpen(t)} className="relative mb-4 block w-full text-left">
              <span className="absolute -left-24 top-4 w-16 text-right font-mono text-sm text-muted-foreground">{t.time}</span>
              <span className={`absolute -left-[1.85rem] top-4 h-3 w-3 rounded-full ring-4 ring-background ${t.conflict ? "bg-contradiction" : typeColor[t.type]}`} />
              <Card className={`gap-1 p-4 transition hover:shadow-md ${t.conflict ? "border-contradiction/50" : ""} ${t.uncertain ? "border-dashed border-missing" : ""}`}>
                <div className="flex items-center gap-2"><I className="h-4 w-4 text-gold" /><span className="font-medium">{t.label}</span>
                  {t.conflict && <span className="ml-auto flex items-center gap-1 text-xs text-contradiction"><AlertTriangle className="h-3.5 w-3.5" />Conflicting timestamp</span>}
                  {t.uncertain && <span className="ml-auto flex items-center gap-1 text-xs text-foreground"><HelpCircle className="h-3.5 w-3.5 text-missing" />Uncertain ordering</span>}
                </div>
                <p className="text-xs text-muted-foreground">{t.source} · {t.people.join(", ")}</p>
              </Card>
            </button>
          );
        })}
      </div>
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>{open?.label}</SheetTitle><SheetDescription>{open?.time} · {open?.source}</SheetDescription></SheetHeader>
          <div className="space-y-3 px-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Supporting evidence</p>
            <blockquote className="border-l-2 border-gold pl-3 font-serif text-sm">{open?.detail}</blockquote>
            <p className="text-sm">{evidence.find((e) => e.name === open?.source)?.excerpt}</p>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
