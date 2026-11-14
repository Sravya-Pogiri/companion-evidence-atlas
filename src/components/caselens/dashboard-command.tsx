import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { animate, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, LoaderCircle, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { commandSuggestions, workflowSteps } from "@/lib/overview-data";
import { findings } from "@/lib/case-data";
import { DraftNotice, SimBadge } from "./shared";

function Ring({ pct, tone, label, sub, desc }: { pct: number; tone: string; label: string; sub: string; desc: string }) {
  const [value, setValue] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => { if (reduced) { setValue(pct); return; } const a = animate(0, pct, { duration: 1.1, onUpdate: (v) => setValue(Math.round(v)) }); return () => a.stop(); }, [pct, reduced]);
  const c = 2 * Math.PI * 42;
  return <div className={`evidence-gauge evidence-${tone}`}><div className="gauge-dial"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" className="gauge-track" /><motion.circle cx="50" cy="50" r="42" className="gauge-fill" strokeDasharray={c} initial={false} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: reduced ? 0 : 1.1 }} /></svg><span className="gauge-number">{value}<small>%</small></span></div><div><p className="font-mono text-xs uppercase text-foreground">{label}</p><p className="mt-1 font-mono text-xs text-muted-foreground">{sub}</p><p className="mt-1 text-[11px] text-muted-foreground">{desc}</p></div></div>;
}
export function InvestigationCommand() {
  const [q, setQ] = useState("");
  const [ctx, setCtx] = useState("Identify inconsistencies between officer accounts and recorded footage.");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); } };
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("keydown", key); if (timer.current) clearTimeout(timer.current); };
  }, []);
  const run = () => { if (!q.trim() || analyzing) return; const query = q.trim(); setCtx(query); setQ(""); setResult(null); setAnalyzing(true); timer.current = setTimeout(() => { setAnalyzing(false); setResult(query); }, reduced ? 100 : 1100); };
  return <>
    <Card className={`command-console ${analyzing ? "is-analyzing" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="console-label flex items-center gap-2"><ScanLine size={14} /> INVESTIGATION COMMAND</p><SimBadge /></div>
      <h2 className="font-serif text-2xl">Search, analyze, or command the case</h2>
      <form className="command-form" onSubmit={(e) => { e.preventDefault(); run(); }}><div className="command-input-wrap"><span className="command-caret" aria-hidden="true" /><input ref={input} aria-label="Investigation query" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Describe the investigation query…" className="command-input" /><kbd>⌘K</kbd></div><Button type="submit" disabled={!q.trim() || analyzing}>{analyzing ? <LoaderCircle className="animate-spin" /> : <ArrowRight />}{analyzing ? "Analyzing" : "Run"}</Button></form>
      <div className="flex flex-wrap gap-2">{commandSuggestions.map((s) => <Button key={s} variant="outline" size="sm" className="suggestion-chip" disabled={analyzing} onClick={() => { setQ(s); input.current?.focus(); }}>{s}<ArrowRight size={12} /></Button>)}</div>
      <div className="command-context"><div><p className="font-mono text-[10px] text-muted-foreground">ACTIVE CONTEXT</p><p className="mt-1 text-sm">{ctx}</p></div><span className="font-mono text-[10px] text-gold">QUERY #4 · 3 FINDINGS</span></div>
      {analyzing && <div className="command-scan" aria-hidden="true" />}
      {result && <motion.div role="status" className="command-results" initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}><DraftNotice />{findings.filter((f) => !result.toLowerCase().includes("missing") || f.kind === "missing").map((f) => <p key={f.id} className="mt-2 text-sm"><span className="text-gold">↳</span> Potential finding: {f.title}</p>)}<Button variant="link" asChild className="h-auto p-0 pt-3 text-gold"><Link to={result.toLowerCase().includes("cross") ? "/assistant" : result.toLowerCase().includes("missing") ? "/missing" : "/contradictions"}>Review {result.toLowerCase().includes("cross") ? "draft questions" : "sources"}<ArrowRight /></Link></Button></motion.div>}
    </Card>
    <section className="workflow-section-overview"><div className="section-heading"><p className="console-label">CASE WORKFLOW</p><span className="font-mono text-[10px] text-muted-foreground">STATE v. ALEX MORGAN</span></div><div className="workflow-overflow"><div className="case-pipeline"><div className="pipeline-track"><span /></div>{workflowSteps.map((s) => <div key={s.n} className={`pipeline-folder pipeline-${s.status.toLowerCase()}`}><span className="pipeline-tab">{s.status === "Complete" ? <Check size={12} /> : `0${s.n}`} {s.status}</span><div className="pipeline-folder-body"><p className="font-serif text-lg">{s.title}</p><p className="mt-2 text-[11px] leading-relaxed">{s.detail}</p></div></div>)}</div></div></section>
    <div className="overview-gauges"><Ring pct={68} tone="corroborate" label="Reviewed" sub="34 / 50 items" desc="Excerpts reviewed by attorney" /><Ring pct={33} tone="related" label="Verified" sub="1 / 3 findings" desc="Findings confirmed for use" /><Ring pct={25} tone="missing" label="Requested" sub="1 / 4 items" desc="Missing evidence requested" /></div>
  </>;
}
