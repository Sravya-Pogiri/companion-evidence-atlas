import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, FileText, Film, Fingerprint, MapPin, Mic, Search, User, X, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { landingEvidence, landingConnections, type EvidenceTone } from "@/lib/landing-mockData";
import { cn } from "@/lib/utils";

type Evidence = (typeof landingEvidence)[number];
const icons = { file: FileText, video: Film, audio: Mic, person: User, location: MapPin, missing: AlertTriangle };
export function EvidenceCard({ evidence, active, onFocus, onSelect }: { evidence: Evidence; active: boolean; onFocus: (id: string | null) => void; onSelect: () => void }) {
  const Icon = icons[evidence.icon];
  return <Button variant="ghost" className={cn("evidence-card", `tone-${evidence.tone}`, active && "evidence-active")} onMouseEnter={() => onFocus(evidence.id)} onMouseLeave={() => onFocus(null)} onFocus={() => onFocus(evidence.id)} onBlur={() => onFocus(null)} onClick={onSelect} aria-label={`Inspect ${evidence.title}`}>
    <span className="evidence-pin" />
    <span className="evidence-meta"><Icon size={12} />{evidence.meta}</span>
    <span className="evidence-title">{evidence.title}</span>
    {evidence.icon === "video" && <span className="bodycam-frame"><span className="bodycam-person" /><span className="bodycam-rec">● REC <span>21:44:02</span></span></span>}
    {evidence.icon === "audio" && <span className="audio-wave" aria-hidden="true">{Array.from({ length: 27 }, (_, i) => <i key={i} className={`wave-${i % 5}`} />)}</span>}
    <span className="evidence-excerpt">{evidence.text}</span>
    {evidence.icon === "file" && <span className="document-lines" aria-hidden="true"><i /><i /><i /></span>}
    <span className="evidence-bates">{evidence.bates}<Search size={10} /></span>
  </Button>;
}

export function ConnectionString({ from, to, tone, highlighted, onSelect }: { from: Evidence; to: Evidence; tone: EvidenceTone; highlighted: boolean; onSelect: () => void }) {
  const reduce = useReducedMotion();
  const d = `M ${from.x + 14} ${from.y + 10} L ${to.x + 14} ${to.y + 10}`;
  return <g className={cn(`tone-${tone}`, "connection", highlighted && "connection-active")}>
    <motion.path d={d} className="connection-line" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.5, delay: 0.3 }} />
    {tone === "contradiction" && <path d={d} className="connection-hit" role="button" aria-label="Inspect potential contradiction" tabIndex={0} onClick={onSelect} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); } }} />}
  </g>;
}

export function InvestigationBoard() {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedEvidence = landingEvidence.find((e) => e.id === selected);
  const contradiction = selected === "contradiction" || selected === "report" || selected === "bodycam";
  return <div className="investigation-scene">
    <div className="board-caption"><span><Fingerprint size={14} /> CASE CL–2026–0142</span><span>SYNTHETIC EVIDENCE</span></div>
    <div className="investigation-board">
      <svg className="board-strings" viewBox="0 0 100 110" preserveAspectRatio="none" aria-label="Evidence connections">
        {landingConnections.map((connection, i) => {
          const from = landingEvidence.find((e) => e.id === connection.from);
          const to = landingEvidence.find((e) => e.id === connection.to);
          if (!from || !to) return null;
          return <ConnectionString key={i} from={from} to={to} tone={connection.tone} highlighted={hovered === from.id || hovered === to.id} onSelect={() => setSelected("contradiction")} />;
        })}
      </svg>
      {landingEvidence.map((evidence) => <div key={evidence.id} className={cn("evidence-position", `position-${evidence.id}`)}><EvidenceCard evidence={evidence} active={hovered === evidence.id} onFocus={setHovered} onSelect={() => setSelected(evidence.id)} /></div>)}
      <Button className="finding-tag" variant="ghost" onClick={() => setSelected("contradiction")}><span className="status-dot" /> 01 POTENTIAL CONTRADICTION <ArrowUpRight size={12} /></Button>
      {selected && <div className="board-popover" role="dialog" aria-label="Evidence detail">
        <Button variant="ghost" size="icon" className="popover-close" onClick={() => setSelected(null)} aria-label="Close evidence detail"><X /></Button>
        <p className="section-kicker">{contradiction ? "POTENTIAL CONTRADICTION" : selectedEvidence?.meta}</p>
        <h3>{contradiction ? "Two minutes. Two different accounts." : selectedEvidence?.title}</h3>
        <p>{contradiction ? "Report says suspect fled at 9:42 PM. Bodycam shows subject seated at 9:44 PM." : selectedEvidence?.text}</p>
        <div className="source-links">{contradiction ? <><Link to="/contradictions">Police Report · p.4 <ArrowUpRight size={12} /></Link><Link to="/timeline">Bodycam · 00:14:32 <ArrowUpRight size={12} /></Link></> : <Link to={selected === "dashcam" ? "/missing" : "/evidence"}>View synthetic source <ArrowUpRight size={12} /></Link>}</div>
        <small>AI draft — requires attorney verification.</small>
      </div>}
    </div>
    <div className="board-legend">{([["contradiction", "Potential contradiction"], ["support", "Supporting"], ["missing", "Missing"], ["related", "Related"]] as const).map(([tone, label]) => <span key={tone} className={`tone-${tone}`}><i />{label}</span>)}</div>
  </div>;
}