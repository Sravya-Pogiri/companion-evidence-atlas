import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, Check, Clock, FileText, GitCompare, Link2, Network, Scale, SearchX, ShieldCheck, Upload, Film } from "lucide-react";
import { landingFeatures } from "@/lib/landing-mockData";

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={reduced ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.6 }}>{children}</motion.div>;
}
function Counter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduced = useReducedMotion();
  const [count, setCount] = useState(value);
  useEffect(() => {
    if (!inView || reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / 1100, 1);
      setCount(Math.round(value * (1 - (1 - p) ** 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, reduced]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}
export function ProblemSection() {
  const stackRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: stackRef, offset: ["start end", "center center"] });
  const spread = useTransform(scrollYProgress, [0, 1], [0, 1]);
  return <section id="the-problem" className="landing-section problem-section"><div className="landing-inner">
    <div className="section-topline"><span className="section-kicker">01 / THE WEIGHT OF THE WORK</span><span className="meta-note">ILLUSTRATIVE PLACEHOLDERS</span></div>
    <Reveal className="stat-strip"><div><strong><Counter value={100} suffix="+" /></strong><span>active cases per attorney</span></div><div><strong><Counter value={1000} suffix="s" /></strong><span>pages in a single case</span></div><div><strong>Hours</strong><span>of bodycam footage</span></div></Reveal>
    <div className="problem-bottom"><Reveal><h2>A person’s future.<br />Buried in a paper trail.</h2><p>Public defenders protect people who can’t afford a lawyer, with a fraction of the time and resources. The evidence that could change a case often sits unread.</p></Reveal><motion.div ref={stackRef} className="document-stack" style={reduced ? {} : { "--stack-spread": spread } as import("framer-motion").MotionStyle}><div className="stack-page stack-back"><span>DISCOVERY / 142</span><i /><i /><i /></div><div className="stack-page stack-mid"><span>WITNESS STATEMENT</span><i /><i /><i /><i /></div><div className="stack-page stack-front"><span>STATE v. ALEX MORGAN</span><b>One detail can change everything.</b><i /><i /><i /><em>EXHIBIT A</em></div></motion.div></div>
  </div></section>;
}
export function Timeline() {
  return <div className="mini-timeline"><div className="timeline-track" />{[["21:42", "Report", FileText], ["21:44", "Bodycam", Film], ["21:46", "Statement", FileText]].map(([time, source, I], i) => { const Icon = I as typeof FileText; return <div key={String(time)} className={i === 1 ? "timeline-conflict" : ""}><span>{String(time)}</span><i /><small><Icon size={12} />{String(source)}</small></div>; })}</div>;
}
export function WorkflowSection() {
  return <section id="how-it-works" className="landing-section workflow-section"><div className="landing-inner">
    <Reveal><span className="section-kicker">02 / FROM DISCOVERY TO DEFENSE</span><h2>Follow the evidence.<br /><span className="subtle-heading">Not the assumptions.</span></h2></Reveal>
    <div className="workflow-grid">
      <Reveal className="workflow-step"><span className="step-number">01</span><div className="workflow-visual upload-visual"><FileText /><FileText /><div className="manila-folder"><Upload size={22} /><span>DISCOVERY PACKET</span></div></div><h3>Upload evidence.</h3><p>Reports, statements, transcripts, and recordings. One case. Nothing scattered.</p></Reveal>
      <Reveal className="workflow-step"><span className="step-number">02</span><div className="workflow-visual compare-visual"><div><span>REPORT · P.4</span><i /><mark>“fled at 9:42 PM”</mark><i /></div><div><span>BODYCAM · 14:32</span><i /><mark>seated at 9:44 PM</mark><i /></div></div><h3>Compare claims.</h3><p>See potential inconsistencies side by side, with the exact source attached.</p></Reveal>
      <Reveal className="workflow-step"><span className="step-number">03</span><div className="workflow-visual"><Timeline /></div><h3>Reconstruct the incident.</h3><p>Bring every account onto the same timeline. See what fits, and what doesn’t.</p></Reveal>
      <Reveal className="workflow-step"><span className="step-number">04</span><div className="workflow-visual prep-visual"><span>AI DRAFT / CROSS-EXAMINATION</span><p>“When did you first see the subject leave the scene?”</p><Link to="/contradictions">View source · p.4 <ArrowUpRight size={11} /></Link></div><h3>Prep for court.</h3><p>Start with source-linked draft questions. Your judgment makes them ready.</p></Reveal>
    </div>
  </div></section>;
}
const featureIcons = { compare: GitCompare, network: Network, missing: SearchX, clock: Clock, scale: Scale, link: Link2 };
export function FeatureFolder({ feature }: { feature: (typeof landingFeatures)[number] }) {
  const Icon = featureIcons[feature.icon];
  return <Reveal className={`feature-folder tone-${feature.tone}`}><div className="folder-tab">FILE / {feature.number}</div><div className="folder-content"><Icon size={24} /><span className="folder-number">CL / {feature.number}</span><h3>{feature.title}</h3><p>{feature.text}</p></div></Reveal>;
}
export function FeaturesSection() {
  return <section id="capabilities" className="landing-section"><div className="landing-inner"><Reveal className="features-heading"><div><span className="section-kicker">03 / YOUR INVESTIGATION TOOLKIT</span><h2>Leave no page unturned.</h2></div><p>Six ways to see the full picture.<br />One place to connect it all.</p></Reveal><div className="feature-grid">{landingFeatures.map((f) => <FeatureFolder key={f.number} feature={f} />)}</div></div></section>;
}
export function TrustSection() {
  return <section id="attorney-control" className="landing-section trust-section"><div className="landing-inner trust-grid"><Reveal><span className="section-kicker">04 / YOUR CASE. YOUR CALL.</span><h2>Attorney stays<br />in control.</h2><div className="trust-points"><div><Link2 /><span><strong>Every output cites its source.</strong><p>Trace a potential finding back to the original page or timestamp.</p></span></div><div><ShieldCheck /><span><strong>Privacy-first principles.</strong><p>This prototype uses synthetic evidence only. No real client information is processed.</p></span></div><div><Scale /><span><strong>AI suggests. You decide.</strong><p>Every AI output is a draft requiring attorney verification.</p></span></div></div></Reveal><Reveal className="redacted-document"><div className="redacted-header"><ShieldCheck size={20} /><span>ATTORNEY REVIEW COPY<br /><small>CL–000142 / PRIVILEGED</small></span></div><h3>The record speaks.<br />You make the argument.</h3><div className="redaction"><span>Every claim is linked to its source.</span></div><div className="redaction"><span>Every potential finding is yours to verify.</span></div><div className="redaction"><span>Your judgment stays at the center.</span></div><div className="review-stamp"><Check size={15} /> REQUIRES ATTORNEY VERIFICATION</div><small>SYNTHETIC DEMONSTRATION · NOT LEGAL ADVICE</small></Reveal></div></section>;
}