import { createFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SimBadge } from "@/components/caselens/shared";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_workspace/settings")({
  head: () => seo("Settings & Privacy", "Data retention, access permissions, deletion, and audit logs."),
  component: Settings,
});

const log = [
  ["Nov 14, 01:42", "J. Ramirez", "Viewed Police_Report.pdf"], ["Nov 13, 18:10", "J. Ramirez", "Verified finding 1"],
  ["Nov 12, 09:31", "M. Osei (investigator)", "Uploaded Emergency_Call.mp3"], ["Nov 11, 16:02", "J. Ramirez", "Exported case brief draft"],
];

function Settings() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Privacy center" title="Settings & Privacy" desc="Controls shown here are a prototype. Security features such as encryption are not yet implemented."><SimBadge /></PageHeader>
      <Card className="gap-4 p-6">
        <h2 className="font-semibold">Data retention</h2>
        <div className="flex items-center justify-between text-sm"><span>Automatically delete evidence after case closure</span>
          <Select defaultValue="90"><SelectTrigger className="w-36" aria-label="Retention"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="30">30 days</SelectItem><SelectItem value="90">90 days</SelectItem><SelectItem value="365">1 year</SelectItem><SelectItem value="never">Manual only</SelectItem></SelectContent></Select></div>
      </Card>
      <Card className="gap-4 p-6">
        <h2 className="font-semibold">Access permissions</h2>
        {[["Investigators can upload evidence", true], ["Investigators can view AI findings", true], ["Paralegals can export case briefs", false]].map(([l, d]) => (
          <div key={l as string} className="flex items-center justify-between text-sm"><span>{l as string}</span><Switch defaultChecked={d as boolean} /></div>
        ))}
      </Card>
      <Card className="gap-3 border-contradiction/30 p-6">
        <h2 className="font-semibold">Evidence deletion</h2>
        <p className="text-sm text-muted-foreground">Permanently remove all evidence for the selected case.</p>
        <Button variant="destructive" className="w-fit" onClick={() => toast("Deletion is simulated in this demo")}><Trash2 /> Delete case evidence</Button>
      </Card>
      <Card className="gap-3 p-6">
        <h2 className="font-semibold">Audit log</h2>
        <div className="divide-y text-sm">{log.map(([t, u, a]) => <div key={t} className="grid grid-cols-[130px_180px_1fr] py-2"><span className="font-mono text-xs text-muted-foreground">{t}</span><span>{u}</span><span>{a}</span></div>)}</div>
      </Card>
    </div>
  );
}
