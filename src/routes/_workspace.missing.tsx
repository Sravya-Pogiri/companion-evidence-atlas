import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, SearchX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { missing as seed, type MissingItem } from "@/lib/case-data";
import { PageHeader, SimBadge } from "@/components/caselens/shared";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_workspace/missing")({
  head: () => seo("Missing Evidence", "Documentation referenced in evidence but not found in discovery."),
  component: Missing,
});

function Missing() {
  const [items, setItems] = useState(seed);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const upd = (id: string, patch: Partial<MissingItem>) => setItems((p) => p.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const exportList = () => {
    const txt = ["CaseLens — Missing Evidence Checklist", "State v. Alex Morgan (fictional)", "DRAFT — requires attorney verification", "",
      ...items.map((m) => `[${done[m.id] ? "x" : " "}] ${m.title}\n    Referenced by: ${m.referencedBy}\n    Action: ${m.action}\n    Status: ${m.status}\n    Notes: ${m.notes || "—"}`)].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" })); a.download = "missing-evidence-checklist.txt"; a.click();
  };
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="State v. Alex Morgan" title="Missing Evidence" desc="Items referenced in existing evidence that were not found in uploaded files.">
        <SimBadge /><Button onClick={exportList}><Download /> Export checklist</Button>
      </PageHeader>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {items.map((m) => (
            <Card key={m.id} className="gap-3 border-l-4 border-l-missing p-5">
              <div className="flex items-start gap-3"><SearchX className="mt-0.5 h-5 w-5 text-missing" />
                <div className="flex-1"><h3 className="font-semibold">{m.title}</h3><p className="text-xs text-muted-foreground">Referenced by {m.referencedBy}</p></div>
                <Select value={m.status} onValueChange={(v) => upd(m.id, { status: v as MissingItem["status"] })}>
                  <SelectTrigger className="h-8 w-40" aria-label="Request status"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="not requested">Not requested</SelectItem><SelectItem value="requested">Requested</SelectItem><SelectItem value="received">Received</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2">
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Why it may be relevant</p><p>{m.relevance}</p></div>
                <div><p className="text-xs font-medium uppercase text-muted-foreground">Suggested follow-up</p><p>{m.action}</p></div>
              </div>
              <Textarea value={m.notes} onChange={(e) => upd(m.id, { notes: e.target.value })} placeholder="Attorney notes…" className="min-h-16" />
            </Card>
          ))}
        </div>
        <Card className="h-fit gap-3 p-5">
          <h3 className="font-semibold">Investigation checklist</h3>
          {items.map((m) => (
            <label key={m.id} className="flex items-start gap-2 text-sm">
              <Checkbox checked={!!done[m.id]} onCheckedChange={(v) => setDone((p) => ({ ...p, [m.id]: !!v }))} className="mt-0.5" />
              <span className={done[m.id] ? "text-muted-foreground line-through" : ""}>{m.action}</span>
            </label>
          ))}
          <p className="text-xs text-muted-foreground">{Object.values(done).filter(Boolean).length} of {items.length} complete</p>
        </Card>
      </div>
    </div>
  );
}
