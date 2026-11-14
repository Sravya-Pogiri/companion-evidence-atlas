import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UploadCloud, Search, Loader2, CheckCircle2, XCircle, Eye, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { evidence as seed, type Evidence, type EvidenceType, type ProcessingStatus } from "@/lib/case-data";
import { PageHeader, SimBadge, typeIcon } from "@/components/caselens/shared";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_workspace/evidence")({
  head: () => seo("Evidence Vault", "Upload, process, and preview case evidence."),
  component: Vault,
});

const statusLabel: Record<ProcessingStatus, string> = { uploading: "Uploading", extracting: "Extracting text", transcribing: "Transcribing audio", analyzing: "Analyzing evidence", completed: "Completed", failed: "Failed", linked: "Linked · not analyzed" };
const flow: ProcessingStatus[] = ["uploading", "extracting", "analyzing", "completed"];

function typeFrom(name: string): EvidenceType {
  if (/\.(mp4|mov|webm)$/i.test(name)) return "video";
  if (/\.(mp3|wav|m4a)$/i.test(name)) return "audio";
  if (/\.(png|jpe?g|webp)$/i.test(name)) return "image";
  return "pdf";
}

function Vault() {
  const [files, setFiles] = useState<Evidence[]>(seed);
  const [q, setQ] = useState(""); const [type, setType] = useState("all"); const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState<Evidence | null>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach((f) => {
      const id = crypto.randomUUID();
      const t = typeFrom(f.name);
      setFiles((p) => [{ id, name: f.name, type: t, size: `${(f.size / 1048576).toFixed(1)} MB`, uploaded: "Just now", status: "uploading", category: "Uncategorized", excerpt: "Simulated processing — real extraction not yet connected." }, ...p]);
      const steps = t === "audio" || t === "video" ? ["uploading", "transcribing", "analyzing", "completed"] as ProcessingStatus[] : flow;
      steps.forEach((s, i) => setTimeout(() => setFiles((p) => p.map((x) => (x.id === id ? { ...x, status: s } : x))), i * 1400));
    });
  };

  const shown = files.filter((f) => f.name.toLowerCase().includes(q.toLowerCase()) && (type === "all" || f.type === type));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="State v. Alex Morgan" title="Evidence Vault" desc="PDFs, images, audio, and video in one place."><SimBadge /></PageHeader>
      <label onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center transition ${drag ? "border-gold bg-accent" : "border-border bg-card hover:border-gold/60"}`}>
        <UploadCloud className="h-8 w-8 text-gold" />
        <p className="mt-3 font-medium">Drop evidence files here or click to browse</p>
        <p className="text-sm text-muted-foreground">PDF, images, audio, video · processing is simulated in this demo</p>
        <input type="file" multiple className="hidden" accept=".pdf,image/*,audio/*,video/*" onChange={(e) => add(e.target.files)} />
      </label>
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search files" className="pl-8" /></div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-44" aria-label="Filter type"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="all">All types</SelectItem><SelectItem value="pdf">Documents</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="audio">Audio</SelectItem><SelectItem value="image">Images</SelectItem></SelectContent>
        </Select>
      </div>
      <Card className="mt-4 divide-y p-0">
        {shown.map((f) => {
          const I = typeIcon[f.type];
          return (
            <div key={f.id} className="flex items-center gap-4 px-5 py-3">
              <span className="grid h-9 w-9 place-items-center rounded bg-navy text-gold"><I className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1"><p className="truncate font-medium">{f.name}</p><p className="text-xs text-muted-foreground">{f.category} · {f.size} · {f.pages ? `${f.pages} pages` : f.duration ?? "—"} · {f.uploaded}</p></div>
              <span className="flex w-40 items-center gap-1.5 text-xs">
                {f.status === "completed" ? <CheckCircle2 className="h-4 w-4 text-corroborate" /> : f.status === "linked" ? <FileText className="h-4 w-4 text-gold" /> : f.status === "failed" ? <XCircle className="h-4 w-4 text-contradiction" /> : <Loader2 className="h-4 w-4 animate-spin text-related" />}
                {statusLabel[f.status]}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setPreview(f)}><Eye /> Preview</Button>
            </div>
          );
        })}
        {shown.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No files match.</p>}
      </Card>
      <Sheet open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <SheetContent>
          <SheetHeader><SheetTitle>{preview?.name}</SheetTitle><SheetDescription>{preview?.category} · {preview && statusLabel[preview.status]}</SheetDescription></SheetHeader>
          <div className="space-y-3 px-4">
            <div className="grid aspect-video place-items-center rounded-md bg-navy text-xs text-ivory/60">Source preview placeholder</div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Extracted excerpt</p>
            <blockquote className="border-l-2 border-gold pl-3 text-sm">{preview?.excerpt}</blockquote>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
