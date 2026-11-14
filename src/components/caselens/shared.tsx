import { FileText, Film, Mic, Image as ImageIcon } from "lucide-react";
import type { EvidenceType } from "@/lib/case-data";
import { cn } from "@/lib/utils";

export const typeIcon: Record<EvidenceType, typeof FileText> = { pdf: FileText, video: Film, audio: Mic, image: ImageIcon };

export function PageHeader({ eyebrow, title, desc, children }: { eyebrow?: string; title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-gold">{eyebrow}</p>}
        <h1 className="font-serif text-3xl font-semibold text-navy">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{desc}</p>}
      </div>
      <div className="flex items-center gap-3">{children}</div>
    </div>
  );
}

export function SimBadge({ className }: { className?: string }) {
  return <span className={cn("inline-flex items-center rounded border border-dashed border-gold px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground", className)}>Simulated</span>;
}

export function DraftNotice({ children }: { children?: React.ReactNode }) {
  return (
    <div className="rounded-md border border-missing/40 bg-missing/10 px-3 py-2 text-xs text-foreground">
      <strong>AI draft — requires attorney verification.</strong> {children ?? "Potential findings are not established facts."}
    </div>
  );
}

export function Highlight({ text, mark, tone }: { text: string; mark: string; tone: "red" | "amber" | "blue" }) {
  const i = text.indexOf(mark);
  if (i < 0) return <>{text}</>;
  const cls = tone === "red" ? "bg-contradiction/15 text-contradiction" : tone === "amber" ? "bg-missing/20" : "bg-related/15 text-related";
  return <>{text.slice(0, i)}<mark className={cn("rounded px-1 font-medium", cls)}>{mark}</mark>{text.slice(i + mark.length)}</>;
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    completed: "bg-corroborate/15 text-corroborate", failed: "bg-contradiction/15 text-contradiction",
    verified: "bg-corroborate/15 text-corroborate", dismissed: "bg-muted text-muted-foreground", unverified: "bg-missing/20 text-foreground",
    requested: "bg-related/15 text-related", received: "bg-corroborate/15 text-corroborate", "not requested": "bg-missing/20 text-foreground",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize", map[status] ?? "bg-related/15 text-related")}>{status}</span>;
}
