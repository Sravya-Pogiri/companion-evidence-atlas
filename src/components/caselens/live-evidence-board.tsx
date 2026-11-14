import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, FileQuestion, FileText, Film, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { boardConnections, boardEvidence } from "@/lib/overview-data";
import { SimBadge } from "./shared";

type Point = { x: number; y: number };
export function LiveEvidenceBoard() {
  const root = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLDivElement>());
  const [points, setPoints] = useState<Record<string, Point>>({});
  const [hover, setHover] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const measure = useCallback(() => {
    const bounds = root.current?.getBoundingClientRect();
    if (!bounds || !bounds.width || !bounds.height) return;
    const next: Record<string, Point> = {};
    nodes.current.forEach((node, id) => {
      const b = node.getBoundingClientRect();
      next[id] = { x: (b.left + b.width / 2 - bounds.left) / bounds.width * 100, y: (b.top + b.height / 2 - bounds.top) / bounds.height * 100 };
    });
    setPoints(next);
  }, []);
  useEffect(() => {
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    nodes.current.forEach((node) => observer.observe(node));
    measure();
    window.addEventListener("resize", measure);
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure]);
  return <section className="live-board-section">
    <div className="section-heading"><div><p className="console-label">CONNECTIONS / CR-2026-04817</p><h2 className="font-serif text-2xl">Live Evidence Board</h2></div><SimBadge /></div>
    <div className="live-board" ref={root}>
      <svg className="live-strings" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {boardConnections.map((c) => { const a = points[c.from]; const b = points[c.to]; if (!a || !b) return null;
          return <motion.path key={`${c.from}-${c.to}`} d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`} className={`board-string evidence-${c.tone} ${hover === c.from || hover === c.to ? "string-highlight" : ""}`} initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 1.4 }} />;
        })}
      </svg>
      {boardEvidence.map((e, i) => { const Icon = e.type === "pdf" ? FileText : e.type === "video" ? Film : Mic;
        return <motion.div key={e.id} className={`live-exhibit exhibit-${i} evidence-${i < 4 ? "contradiction" : "corroborate"}`} ref={(node) => { if (node) nodes.current.set(e.id, node); else nodes.current.delete(e.id); }} animate={{ y: hover === e.id ? -7 : 0 }} transition={{ duration: reduced ? 0 : .2 }} onUpdate={measure} onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(e.id)} onBlur={() => setHover(null)}>
          <Button variant="ghost" asChild className="exhibit-link"><Link to="/evidence"><span className="exhibit-pin" /><span className="exhibit-meta"><Icon size={13} /> EXHIBIT 0{i + 1}</span><span className="exhibit-name">{e.name}</span>
            {e.type === "pdf" ? <span className="exhibit-document"><i /><i /><i /><i /></span> : e.type === "video" ? <span className="exhibit-video"><Film size={22} /><span>{e.duration}</span></span> : <span className="exhibit-audio">▂ ▅ ▃ ▇ ▄ ▂ ▆ ▃ ▅ ▂ ▆ ▃</span>}
            <span className="exhibit-footer">{e.pages ? `${e.pages} PAGES` : e.type.toUpperCase()}<span>{e.status.toUpperCase()}</span></span>
          </Link></Button>
        </motion.div>;
      })}
      <motion.div className="live-exhibit exhibit-5 evidence-missing" ref={(node) => { if (node) nodes.current.set("missing", node); else nodes.current.delete("missing"); }} animate={{ y: hover === "missing" ? -7 : 0 }} onUpdate={measure} onMouseEnter={() => setHover("missing")} onMouseLeave={() => setHover(null)} onFocus={() => setHover("missing")} onBlur={() => setHover(null)}>
        <Button variant="ghost" asChild className="exhibit-link missing-exhibit"><Link to="/missing"><span className="exhibit-pin" /><span className="exhibit-meta"><FileQuestion size={13} /> REFERENCED / NOT PRODUCED</span><span className="exhibit-name">Lineup Documentation</span><span className="missing-stamp">MISSING</span><span className="exhibit-footer">Police_Report.pdf · p.7</span></Link></Button>
      </motion.div>
    </div>
    <div className="board-bottom"><span className="font-mono text-[10px] text-muted-foreground">5 SOURCES · 1 DOCUMENTATION GAP</span><Button variant="link" asChild className="h-auto p-0 text-gold"><Link to="/graph">Open full board <ArrowRight size={14} /></Link></Button></div>
  </section>;
}
