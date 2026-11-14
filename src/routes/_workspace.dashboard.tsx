import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, Briefcase, FileStack, GitCompare, SearchX, ArrowRight, Check, Gavel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { activity, findings, type Finding } from "@/lib/case-data";
import { crossExamDrafts, findingTone } from "@/lib/overview-data";
import { PageHeader, SimBadge, StatusPill, DraftNotice } from "@/components/caselens/shared";
import { CasesTable } from "@/components/caselens/cases-table";
import { seo } from "@/lib/seo";
import { toast } from "sonner";
import { InvestigationCommand } from "@/components/caselens/dashboard-command";
import { LiveEvidenceBoard } from "@/components/caselens/live-evidence-board";
export const Route = createFileRoute("/_workspace/dashboard")({ head: () => seo("Attorney Dashboard", "Active cases, evidence processing, and findings awaiting verification."), component: Dashboard });
const stats = [
  { l: "Active cases", v: "1", i: Briefcase, tone: "text-gold" },
  { l: "Evidence files processed", v: "57", i: FileStack, tone: "text-related" },
  { l: "Potential contradictions", v: "2", i: GitCompare, tone: "text-contradiction" },
  { l: "Missing evidence references", v: "4", i: SearchX, tone: "text-missing" },
];
function Dashboard() {
  const reduced = useReducedMotion();
  const [verified, setVerified] = useState<string[]>([]);
  const [draft, setDraft] = useState<Finding | null>(null);
  return <motion.div className="overview-page mx-auto max-w-7xl" initial="hidden" animate="visible" variants={{ hidden: {}, visible: { transition: { staggerChildren: reduced ? 0 : .08 } } }}>
    <motion.div className="overview-header" variants={{ hidden: { opacity: 0, y: reduced ? 0 : 12 }, visible: { opacity: 1, y: 0 } }}><span className="case-ink-stamp" aria-hidden="true">CASE FILE CR-2026-04817<br />STATE v. ALEX MORGAN</span><PageHeader eyebrow="Good morning, J. Ramirez" title="Investigative priorities" desc="Your caseload at a glance, with findings that need your review."><Button onClick={() => toast("New case flow is simulated in this prototype")}><Plus /> New Case</Button></PageHeader></motion.div>
    <motion.div variants={{ hidden: { opacity: 0, y: reduced ? 0 : 12 }, visible: { opacity: 1, y: 0 } }}><InvestigationCommand /></motion.div>
    <motion.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" variants={{ hidden: { opacity: 0, y: reduced ? 0 : 12 }, visible: { opacity: 1, y: 0 } }}>{stats.map((s) => <Card key={s.l} className="stat-exhibit gap-2 p-5"><div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">{s.l}<s.i className={`h-4 w-4 shrink-0 ${s.tone}`} /></div><div className="font-serif text-3xl font-semibold text-foreground">{s.v}</div></Card>)}</motion.div>
    <motion.div className="mt-8 grid gap-7 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]" variants={{ hidden: { opacity: 0, y: reduced ? 0 : 12 }, visible: { opacity: 1, y: 0 } }}><LiveEvidenceBoard /><section className="activity-section"><div className="section-heading"><h2 className="font-serif text-2xl">Recent activity</h2><span className="font-mono text-[10px] text-gold">CASE LOG</span></div><ol className="activity-timeline">{activity.map((a, i) => <li key={i} className={`evidence-${["related", "contradiction", "corroborate", "missing", "related"][i]}`}><span className="activity-node" /><p className="font-mono text-[10px] text-muted-foreground">{a.t}</p><p className="my-1.5 text-sm leading-relaxed">{a.text}</p><p className="text-[11px] text-muted-foreground">{a.case}</p></li>)}</ol></section></motion.div>
    <section className="mt-9"><div className="section-heading"><div><p className="console-label">POTENTIAL FINDINGS / ATTORNEY REVIEW</p><h2 className="mt-1 font-serif text-2xl">Findings awaiting attorney verification</h2></div><Button variant="link" asChild className="h-auto p-0 text-gold"><Link to="/rosales">Open walkthrough <ArrowRight size={14} /></Link></Button></div><div className="space-y-3">{findings.map((f) => <Card key={f.id} className={`finding-exhibit evidence-${findingTone(f.id)}`}><div className="min-w-0 flex-1"><p className="text-sm font-medium leading-relaxed">{f.title}</p><div className="exhibit-sources"><span>{f.a.source} · {f.a.loc}</span>{f.b && <><b>↔</b><span>{f.b.source} · {f.b.loc}</span></>}</div></div><div className="finding-actions"><StatusPill status={verified.includes(f.id) ? "verified" : f.status} /><Button variant="outline" size="sm" className="verify-action" disabled={verified.includes(f.id)} onClick={() => { setVerified((p) => [...p, f.id]); toast("Marked verified for this simulated review session"); }}><Check size={14} />{verified.includes(f.id) ? "Verified" : "Verify"}</Button><Button variant="ghost" size="sm" className="text-gold" onClick={() => setDraft(f)}>Generate cross-exam <ArrowRight size={14} /></Button></div></Card>)}</div></section>
    <section className="mt-9"><div className="section-heading"><h2 className="font-serif text-2xl">Active cases</h2><SimBadge /></div><div className="overview-cases"><CasesTable /></div></section>
    <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}><DialogContent className="workspace-draft-dialog"><DialogHeader><DialogTitle className="flex items-center gap-2 font-serif"><Gavel size={18} />Draft cross-examination</DialogTitle><DialogDescription>{draft?.title}</DialogDescription></DialogHeader><SimBadge /><DraftNotice /><ol className="list-decimal space-y-4 pl-5 text-sm">{(draft ? crossExamDrafts[draft.id] ?? [] : []).map((q) => <li key={q}>{q}</li>)}</ol><p className="font-mono text-xs text-muted-foreground">{draft?.a.source} · {draft?.a.loc}{draft?.b ? ` ↔ ${draft.b.source} · ${draft.b.loc}` : ""}</p><Button asChild><Link to="/assistant">Open Defense Assistant <ArrowRight /></Link></Button></DialogContent></Dialog>
  </motion.div>;
}
