import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Fingerprint, Play, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { InvestigationBoard } from "@/components/caselens/landing/investigation-board";
import { FeaturesSection, ProblemSection, TrustSection, WorkflowSection } from "@/components/caselens/landing/landing-sections";
import { demoSteps } from "@/lib/landing-mockData";
import { seo } from "@/lib/seo";
import warRoom from "@/assets/caselens-war-room.jpg";

export const Route = createFileRoute("/")({
  head: () => seo("CaseLens — Every contradiction. Every missing page. Found.", "Source-linked AI evidence analysis for public defenders. Explore potential contradictions, missing evidence, and draft defense preparation in a synthetic investigation."),
  component: Landing,
});

function Landing() {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const boardY = useTransform(scrollY, [0, 800], [0, 30]);
  const [word, setWord] = useState("Found.");
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (reduced) return;
    setWord("");
    let i = 0;
    const timer = setInterval(() => { i += 1; setWord("Found.".slice(0, i)); if (i >= 6) clearInterval(timer); }, 160);
    return () => clearInterval(timer);
  }, [reduced]);
  useEffect(() => {
    if (!playing || !demoOpen) return;
    const timer = setInterval(() => setDemoStep((s) => { if (s >= demoSteps.length - 1) { setPlaying(false); return s; } return s + 1; }), 30000);
    return () => clearInterval(timer);
  }, [playing, demoOpen]);
  const step = demoSteps[demoStep];
  return <main className="landing-noir">
    <section className="noir-hero">
      <img className="war-room-image" src={warRoom} alt="An attorney reviewing case files beneath a desk lamp late at night" width={1536} height={1024} />
      <div className="hero-texture" />
      <nav className="landing-nav landing-inner" aria-label="Main navigation">
        <Link to="/" className="noir-logo"><ScanLine /><span>CaseLens<span className="logo-period">.</span></span></Link>
        <div className="landing-nav-links"><a href="#how-it-works">The process</a><a href="#capabilities">The toolkit</a><a href="#attorney-control">Our principles</a></div>
        <Button asChild variant="ghost" className="workspace-link"><Link to="/dashboard">Open workspace <ArrowUpRight /></Link></Button>
      </nav>
      <div className="hero-content landing-inner">
        <motion.div className="hero-copy" initial={reduced ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div className="hero-eyebrow"><span className="status-dot" /> THE DEFENSE IS IN THE DETAILS</div>
          <h1>Every contradiction.<br />Every missing page.<br /><span className="typed-word" aria-label="Found.">{word}<span className="type-caret" aria-hidden="true" /></span></h1>
          <p>CaseLens reads the police reports, witness statements, bodycam transcripts and 911 calls, then shows public defenders what doesn’t add up — with a link to the exact page or timestamp for every finding.</p>
          <div className="hero-actions"><Button asChild size="lg"><Link to="/cases">Open a Case <ArrowUpRight /></Link></Button><Button variant="ghost" size="lg" onClick={() => { setDemoOpen(true); setDemoStep(0); setPlaying(true); }}><Play />Watch the 2-min demo</Button></div>
          <div className="hero-footnote"><Fingerprint size={15} /><span>BUILT FOR PUBLIC DEFENDERS.<br /><b>BECAUSE EVERY DETAIL DESERVES A DEFENSE.</b></span></div>
        </motion.div>
        <motion.div className="hero-board-wrap" style={reduced ? {} : { y: boardY }} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.2 }}><InvestigationBoard /></motion.div>
      </div>
      <div className="hero-bottom landing-inner"><span>LESS SEARCHING. MORE SEEING.</span><a href="#the-problem">FOLLOW THE EVIDENCE <ArrowRight size={13} /></a><span>ALL EVIDENCE SHOWN IS SYNTHETIC</span></div>
    </section>
    <ProblemSection /><WorkflowSection /><FeaturesSection /><TrustSection />
    <section className="footer-cta landing-inner"><span className="section-kicker">A STRONGER DEFENSE STARTS WITH A CLEARER PICTURE.</span><h2>Equal justice shouldn’t<br />depend on caseload.</h2><Button asChild size="lg"><Link to="/cases">Open a Case <ArrowUpRight /></Link></Button><p>Synthetic demonstration. Potential findings, never established facts.</p></section>
    <footer className="noir-footer landing-inner"><Link to="/" className="noir-logo"><ScanLine /><span>CaseLens.</span></Link><span>Built at HackPrinceton 2026.</span><span>EVERY PAGE. EVERY PERSON.</span></footer>
    <Dialog open={demoOpen} onOpenChange={(open) => { setDemoOpen(open); if (!open) setPlaying(false); }}><DialogContent className="landing-noir demo-dialog"><DialogTitle>Inside a CaseLens investigation</DialogTitle><DialogDescription>A two-minute synthetic walkthrough — not a recorded video.</DialogDescription><div className="demo-stage"><span className="section-kicker">{step?.title}</span><h3>{step?.text}</h3><span className="demo-source">{step?.source}</span></div><div className="demo-progress">{demoSteps.map((_, i) => <span key={i} className={i <= demoStep ? "complete" : ""} />)}</div><div className="demo-controls"><Button variant="ghost" size="icon" disabled={demoStep === 0} aria-label="Previous demo step" onClick={() => setDemoStep((s) => s - 1)}><ChevronLeft /></Button><Button variant="outline" onClick={() => { if (demoStep === 3) setDemoStep(0); setPlaying((p) => !p); }}>{playing ? "Pause" : "Play"}</Button><span>{demoStep + 1} / 4</span><Button variant="ghost" size="icon" aria-label="Next demo step" disabled={demoStep === 3} onClick={() => setDemoStep((s) => s + 1)}><ChevronRight /></Button></div><Button asChild><Link to="/graph">Explore the demo case <ArrowUpRight /></Link></Button></DialogContent></Dialog>
  </main>;
}
