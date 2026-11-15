import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CircleDashed,
  ExternalLink,
  FileSearch,
  HelpCircle,
  Loader2,
  Play,
  ShieldCheck,
  Square,
  X,
} from "lucide-react";
import { segment } from "@/lib/highlight";
import type { Activity, AgentName, ClaimCitation, ClaimResult, Finding, StreamLine, TimelineEvent } from "@/lib/investigation/types";
import { cn } from "@/lib/utils";

// Test this claim: a Deep Agents investigation of a written claim against the open case.
// Everything shown comes from the investigator's stream: its plan, delegations, tool calls and
// verification. Quotes are shown as evidence only when the service found them on the stored page.

const SUGGESTIONS: Record<string, string[]> = {
  btk: [
    "The church web page naming Dennis Rader was online before the disk was mailed to KSAS.",
    "Rader's DNA was compared with crime-scene evidence before his arrest.",
    "The sentence was imposed on the same day the judgment was filed.",
    "The mailed diskette was logged into evidence before its recorded collection time.",
  ],
  rosales: [
    "The officer told Rosales the stop was for failure to signal.",
    "The Mustang's left turn signal was on before it turned.",
    "The passenger was allowed to record the stop on her phone.",
    "A dispatch audio recording of the stop is in the record.",
  ],
};

const AGENTS: { name: AgentName; role: string; tone: string }[] = [
  { name: "Lead Investigator", role: "Plans, delegates, compares, decides", tone: "text-gold border-gold/40" },
  { name: "Timeline Researcher", role: "Finds dated records and exact passages", tone: "text-[#8fb3ff] border-[#8fb3ff]/40" },
  { name: "Evidence Reviewer", role: "Challenges the claim, finds gaps", tone: "text-[#c4a1ff] border-[#c4a1ff]/40" },
  { name: "Verifier", role: "Checks quotes against stored pages (code)", tone: "text-[#5fd39a] border-[#5fd39a]/40" },
];
const TONE: Record<string, string> = Object.fromEntries(AGENTS.map((a) => [a.name, a.tone]));

const FINDING: Record<Finding, { label: string; tone: string; icon: typeof Check; text: string }> = {
  supported: { label: "Supported", tone: "border-[#30a46c]/50 bg-[#30a46c]/10 text-[#5fd39a]", icon: Check, text: "The dated records back the claim." },
  challenged: { label: "Challenged", tone: "border-[#e5484d]/50 bg-[#e5484d]/10 text-[#ff8f92]", icon: X, text: "The dated records contradict the claim." },
  ambiguous: { label: "Ambiguous", tone: "border-[#f76b15]/50 bg-[#f76b15]/10 text-[#ff9a5c]", icon: HelpCircle, text: "The records point both ways or use different kinds of time." },
  insufficient_evidence: { label: "Insufficient evidence", tone: "border-white/20 bg-white/[0.04] text-muted-foreground", icon: CircleDashed, text: "The stored records cannot settle it." },
};

const TIME_TYPE: Record<string, { label: string; tone: string }> = {
  incident: { label: "Incident", tone: "bg-[#e5484d]/15 text-[#ff8f92]" },
  collection: { label: "Collection", tone: "bg-[#30a46c]/15 text-[#5fd39a]" },
  receipt_or_log: { label: "Received / logged", tone: "bg-[#8fb3ff]/15 text-[#8fb3ff]" },
  examination_or_test: { label: "Examined / tested", tone: "bg-[#c4a1ff]/15 text-[#c4a1ff]" },
  report_issued: { label: "Report issued", tone: "bg-[#c4a1ff]/10 text-[#c4a1ff]" },
  filing: { label: "Filed", tone: "bg-gold/15 text-gold" },
  hearing: { label: "Hearing", tone: "bg-gold/10 text-gold" },
  arrest: { label: "Arrest", tone: "bg-[#f76b15]/15 text-[#ff9a5c]" },
  announcement: { label: "Announced", tone: "bg-white/10 text-foreground" },
  archive_capture: { label: "Archive capture", tone: "bg-[#5fd3c9]/15 text-[#5fd3c9]" },
  other: { label: "Other", tone: "bg-white/10 text-muted-foreground" },
};

type Phase = "idle" | "running" | "done" | "error";

export function InvestigationStudio({ caseId, caseName }: { caseId: string; caseName: string }) {
  const suggestions = SUGGESTIONS[caseId] ?? [];
  const [claim, setClaim] = useState(suggestions[0] ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [events, setEvents] = useState<Activity[]>([]);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ClaimCitation | null>(null);
  const abort = useRef<AbortController | null>(null);
  const ranClaim = useRef("");

  const run = async () => {
    const text = claim.trim();
    if (text.length < 8 || phase === "running") return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    ranClaim.current = text;
    setPhase("running");
    setEvents([]);
    setResult(null);
    setError(null);
    setSelected(null);
    try {
      const res = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, claim: text }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `The investigation could not start (${res.status}).`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line) as StreamLine;
          if (msg.type === "activity") setEvents((prev) => [...prev, msg.event]);
          else if (msg.type === "result") {
            finished = true;
            setResult(msg.result);
            setPhase("done");
            setSelected(msg.result.citations.find((c) => c.verified && c.role !== "context") ?? msg.result.citations.find((c) => c.verified) ?? null);
          } else if (msg.type === "error") {
            finished = true;
            setError(msg.message);
            setPhase("error");
          }
        }
      }
      if (!finished) throw new Error("The investigation stopped before it returned a finding.");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setPhase("idle");
        setError("Investigation stopped.");
        return;
      }
      setError((e as Error).message);
      setPhase("error");
    }
  };

  const stop = () => abort.current?.abort();
  const changed = phase === "done" && claim.trim() !== ranClaim.current;

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[12px] uppercase tracking-[0.14em] text-gold">Investigation studio</p>
          <h1 className="mt-1 font-serif text-[1.9rem] font-medium leading-tight">Test a claim</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {caseName} · a lead investigator and two subagents built with LangChain Deep Agents research the stored records
            {caseId === "rosales" ? " (filings, bodycam transcript, checked video frames)" : ""}; every quote is checked against them.
          </p>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Agents">
          {AGENTS.map((a) => {
            const state = agentState(events, a.name, phase);
            return (
              <li key={a.name} title={a.role} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-[13px]", a.tone)}>
                {state === "working" ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : state === "done" ? <Check className="size-3.5" aria-hidden /> : <span className="size-1.5 rounded-full bg-current opacity-50" aria-hidden />}
                {a.name}
                <span className="sr-only">: {state}</span>
              </li>
            );
          })}
        </ul>
      </header>

      {/* A. Claim bar */}
      <section className="rounded-xl border bg-card p-5" aria-label="Claim">
        <label htmlFor="claim" className="text-sm font-medium text-muted-foreground">
          Claim to test
        </label>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row">
          <textarea
            id="claim"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run();
            }}
            rows={2}
            maxLength={400}
            placeholder="e.g. Was this evidence item logged before its recorded collection time?"
            className="min-h-[4.5rem] flex-1 resize-none rounded-lg border border-white/12 bg-background px-4 py-3 font-serif text-[1.15rem] leading-snug outline-none placeholder:text-muted-foreground/60 focus:border-gold/60"
          />
          {phase === "running" ? (
            <button type="button" onClick={stop} className="inline-flex h-12 items-center justify-center gap-2 self-stretch rounded-lg border border-white/15 px-6 text-sm font-semibold hover:bg-white/5 lg:self-auto lg:h-auto">
              <Square className="size-4" /> Stop
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void run()}
              disabled={claim.trim().length < 8}
              className="inline-flex h-12 items-center justify-center gap-2 self-stretch rounded-lg bg-gold px-6 text-sm font-semibold text-[#14120d] transition-colors hover:bg-[#d6b77c] disabled:opacity-40 lg:self-auto lg:h-auto"
            >
              <Play className="size-4 fill-current" /> {phase === "done" ? (changed ? "Run new claim" : "Run again") : "Run investigation"}
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Try:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={phase === "running"}
              onClick={() => setClaim(s)}
              className={cn("max-w-full truncate rounded-full border px-3 py-1 text-left transition-colors hover:border-white/30 disabled:opacity-50", claim === s ? "border-gold/50 text-gold" : "border-white/10 text-muted-foreground")}
            >
              {s}
            </button>
          ))}
        </div>
        <p role="status" className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          {phase === "running" && (
            <>
              <Loader2 className="size-4 animate-spin text-gold" aria-hidden /> Investigating. Free-tier model limits pace the agents, so a run takes a few minutes.
            </>
          )}
          {phase === "done" && result && (
            <>
              <ShieldCheck className="size-4 text-[#5fd39a]" aria-hidden /> Completed in {result.duration_s}s on {result.model}. {result.verification.note}
            </>
          )}
          {phase === "error" && error && (
            <span className="flex items-center gap-2 text-[#ff8f92]">
              <AlertTriangle className="size-4" aria-hidden /> {error}
            </span>
          )}
          {phase === "idle" && (error ?? "Findings are suggestions. Confirm before use.")}
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(19rem,22rem)_minmax(0,1fr)_minmax(22rem,27rem)]">
        {/* B. Live agent activity */}
        <ActivityPanel events={events} phase={phase} />

        <div className="min-w-0 space-y-5">
          {/* D. Findings */}
          <FindingsPanel result={result} phase={phase} selected={selected} onSelect={setSelected} />
          {/* C. Timeline */}
          <TimelinePanel result={result} onSelect={(e) => setSelected(citationForEvent(result, e))} selected={selected} />
        </div>

        {/* E. Source viewer */}
        <SourceViewer citation={selected} />
      </div>
    </div>
  );
}

function agentState(events: Activity[], name: AgentName, phase: Phase): "idle" | "working" | "done" {
  const mine = events.filter((e) => e.agent === name || (e.kind === "delegate" && e.title.endsWith(name)));
  if (mine.length === 0) return "idle";
  if (name === "Lead Investigator") return phase === "running" ? "working" : "done";
  if (name === "Verifier") return mine.some((e) => e.status === "done" && e.title === "Verification complete") ? "done" : "working";
  const delegated = events.filter((e) => e.kind === "delegate" && e.title.endsWith(name)).length;
  const reported = events.filter((e) => e.kind === "report" && e.agent === name).length;
  return delegated > reported ? "working" : "done";
}

/** Tool and delegation events come as a start and an end with the same ref: show one row each. */
function collapse(events: Activity[]): Activity[] {
  const out: Activity[] = [];
  const at = new Map<string, number>();
  for (const e of events) {
    if (e.ref && e.kind !== "report" && at.has(e.ref)) {
      out[at.get(e.ref)!] = { ...e, at: out[at.get(e.ref)!]!.at };
      continue;
    }
    if (e.ref && e.kind !== "report") at.set(e.ref, out.length);
    out.push(e);
  }
  return out;
}

function ActivityPanel({ events, phase }: { events: Activity[]; phase: Phase }) {
  const rows = useMemo(() => collapse(events), [events]);
  return (
    <section className="rounded-xl border bg-card p-5 xl:sticky xl:top-[4.75rem] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto" aria-label="Agent activity" aria-live="polite">
      <h2 className="font-serif text-lg font-medium">Agent activity</h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">Live from the agents: their plan, delegations, evidence tool calls and verification.</p>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">{phase === "running" ? "Starting the investigation…" : "Run an investigation to see the agents work."}</p>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {rows.map((e) => (
            <li key={e.id} className="lx-fade rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("rounded-full border px-2 py-px text-[11px] font-medium", TONE[e.agent] ?? "border-white/15 text-muted-foreground")}>{e.agent}</span>
                <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                  {e.status === "running" ? <Loader2 className="size-3 animate-spin" aria-label="running" /> : e.status === "failed" ? <X className="size-3 text-[#ff8f92]" aria-label="failed" /> : <Check className="size-3 text-[#5fd39a]" aria-label="done" />}
                  {e.at.toFixed(1)}s
                </span>
              </div>
              <p className="mt-1.5 text-[14px] font-medium leading-snug">{e.title}</p>
              {e.detail && <Detail kind={e.kind} text={e.detail} />}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function Detail({ kind, text }: { kind: Activity["kind"]; text: string }) {
  const [open, setOpen] = useState(kind === "plan" || kind === "verify" || kind === "finding");
  const long = text.length > 160;
  const body = (
    <p className={cn("mt-1 whitespace-pre-line break-words text-[12.5px] leading-relaxed text-muted-foreground", kind === "tool" && "font-mono text-[11.5px]")}>
      {open || !long ? text : `${text.slice(0, 150)}…`}
    </p>
  );
  return (
    <>
      {body}
      {long && (
        <button type="button" onClick={() => setOpen((o) => !o)} className="mt-1 text-[12px] text-gold hover:underline">
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}

function FindingsPanel({
  result,
  phase,
  selected,
  onSelect,
}: {
  result: ClaimResult | null;
  phase: Phase;
  selected: ClaimCitation | null;
  onSelect: (c: ClaimCitation) => void;
}) {
  if (!result)
    return (
      <section className="rounded-xl border bg-card p-5" aria-label="Finding">
        <h2 className="font-serif text-lg font-medium">Finding</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(FINDING) as Finding[]).map((f) => {
            const F = FINDING[f];
            return (
              <div key={f} className={cn("rounded-lg border p-3 opacity-60", F.tone)}>
                <F.icon className="size-4" aria-hidden />
                <p className="mt-1.5 text-sm font-semibold">{F.label}</p>
                <p className="mt-0.5 text-[12px] leading-snug opacity-80">{F.text}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{phase === "running" ? "The finding appears when the agents finish and the quotes are checked." : "The lead investigator chooses one of these four, from the verified passages."}</p>
      </section>
    );
  const F = FINDING[result.finding];
  const verified = result.citations.filter((c) => c.verified);
  const unverified = result.citations.filter((c) => !c.verified);
  const group = (role: ClaimCitation["role"]) => verified.filter((c) => c.role === role);
  return (
    <section className="lx-fade rounded-xl border bg-card p-5" aria-label="Finding">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-lg font-medium">Finding</h2>
        <span className="font-mono text-[12px] text-muted-foreground">{result.verification.verified} of {result.verification.citations} citations verified</span>
      </div>
      <div className={cn("mt-3 flex items-start gap-3 rounded-lg border p-4", F.tone)}>
        <F.icon className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="text-lg font-semibold">{F.label}</p>
          <p className="text-[13px] opacity-80">{F.text}</p>
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed">{result.explanation}</p>
      <p className="mt-1 text-[12px] text-muted-foreground">Written by the lead investigator (model text). The quoted passages below are the evidence.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <CitationList title="Supporting" items={group("supports")} selected={selected} onSelect={onSelect} empty="No verified passage supports the claim." />
        <CitationList title="Challenging" items={group("challenges")} selected={selected} onSelect={onSelect} empty="No verified passage challenges the claim." />
      </div>
      {group("context").length > 0 && (
        <div className="mt-4">
          <CitationList title="Context" items={group("context")} selected={selected} onSelect={onSelect} empty="" />
        </div>
      )}
      {result.open_questions.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold">Open questions</h3>
          <ul className="mt-2 space-y-1.5 text-[14px] text-muted-foreground">
            {result.open_questions.map((q) => (
              <li key={q} className="flex gap-2">
                <HelpCircle className="mt-0.5 size-4 shrink-0 text-[#ff9a5c]" aria-hidden /> {q}
              </li>
            ))}
          </ul>
        </div>
      )}
      {unverified.length > 0 && (
        <details className="mt-5 rounded-lg border border-white/[0.06] p-3 text-[13px]">
          <summary className="cursor-pointer text-muted-foreground">{unverified.length} cited passage{unverified.length > 1 ? "s" : ""} not verified (not used as evidence)</summary>
          <ul className="mt-2 space-y-2">
            {unverified.map((c, i) => (
              <li key={`${c.evidence_id}-${i}`} className="text-muted-foreground">
                <span className="font-mono text-[12px]">{c.evidence_id}</span>: “{c.quote.slice(0, 140)}{c.quote.length > 140 ? "…" : ""}” <span className="text-[#ff9a5c]">({c.check})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function CitationList({
  title,
  items,
  selected,
  onSelect,
  empty,
}: {
  title: string;
  items: ClaimCitation[];
  selected: ClaimCitation | null;
  onSelect: (c: ClaimCitation) => void;
  empty: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-[13px] text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((c, i) => (
            <li key={`${c.evidence_id}-${i}`}>
              <button
                type="button"
                onClick={() => onSelect(c)}
                aria-pressed={selected === c}
                className={cn("w-full rounded-lg border p-3 text-left transition-colors hover:border-white/25", selected === c ? "border-gold/60 bg-gold/[0.06]" : "border-white/[0.08]")}
              >
                <span className="flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                  <span className="truncate">{c.source_title} · {c.location || where(c.page)}</span>
                  <ShieldCheck className="size-3.5 shrink-0 text-[#5fd39a]" aria-label="verified" />
                </span>
                <span className="mt-1 block font-serif text-[15px] leading-snug">“{c.quote}”</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function citationForEvent(result: ClaimResult | null, e: TimelineEvent): ClaimCitation | null {
  if (!result) return null;
  const found = result.citations.find((c) => c.evidence_id === e.evidence_id && c.quote === e.quote);
  if (found) return found;
  const page = result.citations.find((c) => c.evidence_id === e.evidence_id);
  return {
    evidence_id: e.evidence_id,
    source_id: page?.source_id ?? "",
    source_title: e.source_title,
    page: e.page ?? 0,
    quote: e.quote,
    role: "context",
    verified: e.verified,
    check: e.check,
    context: page?.context.includes(e.quote) ? page.context : e.quote,
    url: page?.url ?? null,
    method: page?.method ?? "",
    location: e.location ?? "",
    frame: page?.frame ?? null,
  };
}

/** Page 0 is a source's recorded metadata (archive capture time, filing date), not a PDF page. */
const where = (page: number) => (page > 0 ? `PDF p.${page}` : "recorded metadata");

const sortKey = (d: string) => (/^\d{4}(-\d{2}){0,2}/.exec(d)?.[0] ?? d).padEnd(10, "0");

function TimelinePanel({ result, onSelect, selected }: { result: ClaimResult | null; onSelect: (e: TimelineEvent) => void; selected: ClaimCitation | null }) {
  const events = useMemo(() => [...(result?.timeline_events ?? [])].sort((a, b) => sortKey(a.date).localeCompare(sortKey(b.date))), [result]);
  return (
    <section className="rounded-xl border bg-card p-5" aria-label="Evidence timeline">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-lg font-medium">Evidence timeline</h2>
        <p className="text-[12px] text-muted-foreground">Each time labelled by its type: when it happened, was received, tested, filed or captured.</p>
      </div>
      {!result ? (
        <p className="mt-4 text-sm text-muted-foreground">The dated records the agents find appear here, in date order.</p>
      ) : events.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">The agents returned no dated records for this claim.</p>
      ) : (
        <ol className="relative mt-5 space-y-3 border-l border-white/10 pl-5">
          {events.map((e, i) => {
            const t = TIME_TYPE[e.time_type] ?? TIME_TYPE["other"]!;
            const active = selected?.evidence_id === e.evidence_id && selected.quote === e.quote;
            const flagged = e.verified && e.discrepancy;
            return (
              <li key={`${e.evidence_id}-${i}`} className="relative">
                <span className={cn("absolute -left-[1.6rem] top-3 size-2.5 rounded-full ring-4 ring-card", flagged ? "bg-[#f76b15]" : e.verified ? "bg-gold" : "bg-white/25")} aria-hidden />
                <button
                  type="button"
                  onClick={() => onSelect(e)}
                  aria-pressed={active}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors hover:border-white/25",
                    active ? "border-gold/60 bg-gold/[0.06]" : flagged ? "border-[#f76b15]/50" : "border-white/[0.08]",
                    !e.verified && "opacity-60",
                  )}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-semibold">{e.date}</span>
                    <span className={cn("rounded px-1.5 py-px text-[11px] font-medium", t.tone)}>{t.label}</span>
                    {!e.verified && <span className="rounded border border-white/15 px-1.5 py-px text-[11px] text-muted-foreground">not verified</span>}
                  </span>
                  <span className="mt-1 block text-[14px]">{e.label}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">{e.source_title}{e.location ? ` · ${e.location}` : e.page !== null ? ` · ${where(e.page)}` : ""}</span>
                  {flagged && (
                    <span className="mt-1.5 flex items-start gap-1.5 text-[12.5px] text-[#ff9a5c]">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {e.discrepancy}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function SourceViewer({ citation }: { citation: ClaimCitation | null }) {
  const [imgOk, setImgOk] = useState(true);
  if (!citation)
    return (
      <section className="rounded-xl border bg-card p-5 xl:sticky xl:top-[4.75rem]" aria-label="Source">
        <h2 className="flex items-center gap-2 font-serif text-lg font-medium">
          <FileSearch className="size-4 text-muted-foreground" aria-hidden /> Source
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">Select a citation or a timeline entry to open its stored page with the quoted passage marked.</p>
      </section>
    );
  const runs = segment(citation.context, [{ phrase: citation.quote, kind: "finding", id: "q" }]);
  const exact = runs.some((r) => r.mark);
  // A frame record shows its still; a BTK page shows its rendered page image when there is one.
  const image = citation.frame
    ? citation.frame
    : citation.evidence_id.startsWith("btk:") && citation.page > 0
      ? `/pages/btk/${citation.source_id.toLowerCase()}-p${citation.page}.jpg`
      : null;
  return (
    <section key={`${citation.evidence_id}-${citation.quote}`} className="lx-fade rounded-xl border bg-card p-5 xl:sticky xl:top-[4.75rem] xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto" aria-label="Source">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Source · stored record</p>
      <h2 className="mt-1 font-serif text-lg font-medium leading-snug">{citation.source_title}</h2>
      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <span className="font-mono">{citation.evidence_id}</span>
        <span>{citation.location || where(citation.page)}</span>
        {citation.method && <span className="rounded border border-white/10 px-1.5">{citation.method.replace(/-/g, " ")}</span>}
      </p>
      <p className={cn("mt-3 flex items-start gap-1.5 text-[12.5px]", citation.verified ? "text-[#5fd39a]" : "text-[#ff9a5c]")}>
        {citation.verified ? <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
        {citation.verified ? `Verified: ${citation.check}` : `Not verified: ${citation.check}`}
      </p>
      <blockquote className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 font-serif text-[15px] leading-relaxed text-foreground/85">
        {runs.map((r, i) =>
          r.mark ? (
            <mark key={i} className="rounded-[2px] bg-gold/30 px-0.5 text-foreground">
              {r.text}
            </mark>
          ) : (
            <span key={i}>{r.text}</span>
          ),
        )}
      </blockquote>
      {!exact && <p className="mt-2 text-[12px] text-muted-foreground">The quote matches the page with spacing ignored, so it is not marked in this excerpt.</p>}
      {/(ocr)/i.test(citation.method) && <p className="mt-2 text-[12px] text-muted-foreground">This page’s text is OCR of a scan. Check the scan before quoting.</p>}
      {image && imgOk && (
        <a href={citation.url ?? undefined} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-md ring-1 ring-white/10" aria-label="Open the original page">
          <img src={image} alt={`${citation.source_title}, page ${citation.page}`} loading="lazy" onError={() => setImgOk(false)} className="block max-h-80 w-full bg-[var(--paper)] object-cover object-top" />
        </a>
      )}
      {citation.url && (
        <a href={citation.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gold hover:underline">
          Open the original record <ExternalLink className="size-3.5" aria-hidden />
        </a>
      )}
    </section>
  );
}
