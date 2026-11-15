// Analyze an ingested case with the Lovable AI gateway, then verify every citation.
//
//   npx tsx --env-file=.env scripts/evidence/analyze.ts scripts/evidence/rosales.case.json \
//     --media DIR [--dry] [--concurrency 4]
//
// Reads cache/<caseId>/ (from ingest.py). Model answers are cached in cache/<caseId>/model/ by a
// hash of their input, so a rerun is free and a crash resumes. Writes:
//   src/data/<caseId>/analysis.json      claims, findings, verification, timings (used by the app)
//   public/frames/analysis/*.jpg         the cited frame for every video claim that passed
//   cache/<caseId>/report.md             a readable report, including what failed and why
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import {
  CLAIMS_TASK,
  DOC_SYSTEM,
  TRANSCRIBE_SYSTEM,
  TRANSCRIBE_TASK,
  VISION_SYSTEM,
  XCHECK_SYSTEM,
} from "./prompts";
import {
  askJsonParts,
  providerStats,
  transcribeAudio,
  type InputPart,
} from "../../src/lib/ai/provider.server";
import type {
  CaseAnalysis,
  Claim,
  Finding,
  Locator,
  SourceMeta,
} from "../../src/lib/evidence/types";
import { checkQuote, inTranscript, type PageText } from "../../src/lib/evidence/verify";

// ---------- setup ----------

const args = process.argv.slice(2);
const casePath = args[0]!;
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: string) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1]! : d;
};
const DRY = flag("--dry");
const MEDIA = opt("--media", "");
const CONCURRENCY = Number(opt("--concurrency", "4"));
// "auto" lets the provider pick (Gemini Flash with fallback, or the Lovable gateway).
const TEXT_MODEL = process.env["EVIDENCE_MODEL"] ?? "auto";
const VISION_MODEL = process.env["EVIDENCE_VISION_MODEL"] ?? TEXT_MODEL;
const AUDIO_MODEL = process.env["EVIDENCE_AUDIO_MODEL"] ?? TEXT_MODEL;
const modelOpt = (m: string) => (m === "auto" ? {} : { model: m });

// Limits for a small run on a free-tier key:
//   --pages complaint=24,opinion=10-11   only these PDF pages
//   --sheets dashcam=2-3                 only these contact sheets (1-based)
//   --videos dashcam                     only these videos
//   --skip-audio                         no transcription
//   --max-vchecks 4                      at most N second-pass frame checks
function ranges(spec: string): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const part of spec.split(",").filter(Boolean)) {
    const [id, r] = part.split("=");
    const [a, b] = r!.split("-").map(Number);
    const set = out.get(id!) ?? new Set<number>();
    for (let n = a!; n <= (b ?? a!); n++) set.add(n);
    out.set(id!, set);
  }
  return out;
}
const PAGES = ranges(opt("--pages", ""));
const SHEETS = ranges(opt("--sheets", ""));
const ONLY_VIDEOS = opt("--videos", "").split(",").filter(Boolean);
const SKIP_AUDIO = flag("--skip-audio");
const MAX_VCHECKS = Number(opt("--max-vchecks", "1000"));
const FFMPEG = process.env["FFMPEG"] ?? "ffmpeg";

interface CaseFile {
  caseId: string;
  sources: { id: string; kind: "pdf" | "video"; file: string; label: string; url: string }[];
  expected: { id: string; label: string; why: string }[];
}
const caseFile = JSON.parse(readFileSync(casePath, "utf8")) as CaseFile;
const CACHE = join("cache", caseFile.caseId);
const MODEL_CACHE = join(CACHE, "model");
const FRAMES_OUT = join("public", "frames", "analysis");
const DATA_OUT = join("src", "data", caseFile.caseId);
mkdirSync(MODEL_CACHE, { recursive: true });
mkdirSync(FRAMES_OUT, { recursive: true });
mkdirSync(DATA_OUT, { recursive: true });

const manifest = JSON.parse(readFileSync(join(CACHE, "manifest.json"), "utf8")) as {
  sources: Record<string, { status: string; sha256: string; pages?: number; duration?: number }>;
};
const log: string[] = [];
const say = (s: string) => {
  log.push(s);
  console.log(s);
};
const timings: Record<string, number> = {};
const stats = { calls: 0, cached: 0, failed: 0 };

async function timed<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  const r = await fn();
  timings[name] = Math.round((Date.now() - t) / 100) / 10;
  say(`  ${name}: ${timings[name]}s`);
  return r;
}

/** Cached model call. In --dry mode returns the fallback and records what would be sent. */
async function cached<T>(key: string, fallback: T, call: () => Promise<unknown>): Promise<T> {
  const file = join(MODEL_CACHE, `${createHash("sha256").update(key).digest("hex").slice(0, 24)}.json`);
  if (existsSync(file)) {
    stats.cached++;
    return JSON.parse(readFileSync(file, "utf8")) as T;
  }
  if (DRY) {
    stats.calls++;
    return fallback;
  }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      stats.calls++;
      const value = await call();
      writeFileSync(file, JSON.stringify(value, null, 1));
      return value as T;
    } catch (e) {
      if (attempt === 3) {
        stats.failed++;
        say(`  ! model call failed (${(e as Error).message}); key ${key.slice(0, 60)}`);
        return fallback;
      }
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  return fallback;
}

async function pool<T, R>(items: T[], fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    }),
  );
  return out;
}

const dataUrl = (path: string) => `data:image/jpeg;base64,${readFileSync(path).toString("base64")}`;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t) % 60).padStart(2, "0")}`;
const asArray = <T>(v: unknown, key: string): T[] =>
  Array.isArray((v as Record<string, unknown> | null)?.[key]) ? ((v as Record<string, T[]>)[key] as T[]) : [];

// ---------- steps ----------

interface Line {
  t: number;
  speaker: string;
  text: string;
}

async function transcribe(sourceId: string): Promise<Line[]> {
  const audioDir = join(CACHE, sourceId, "audio");
  const speech = JSON.parse(readFileSync(join(audioDir, "speech.json"), "utf8")) as {
    segments: { file: string; start: number; end: number }[];
  };
  if (speech.segments.length === 0) {
    say(`  ${sourceId}: no speech above the energy gate, nothing sent for transcription`);
    return [];
  }
  const parts = await pool(speech.segments, async (seg) => {
    const b64 = readFileSync(join(audioDir, seg.file)).toString("base64");
    const res = await cached(`transcribe:${AUDIO_MODEL}:${sourceId}:${seg.file}:${b64.length}`, { lines: [] }, () =>
      transcribeAudio(TRANSCRIBE_SYSTEM, TRANSCRIBE_TASK, b64, "mp3", modelOpt(AUDIO_MODEL)),
    );
    return asArray<Line>(res, "lines")
      .filter((l) => typeof l.text === "string" && l.text.trim() && Number.isFinite(Number(l.t)))
      .map((l) => ({ t: Math.round((seg.start + Number(l.t)) * 10) / 10, speaker: String(l.speaker ?? ""), text: l.text.trim() }));
  });
  const lines = parts.flat().sort((a, b) => a.t - b.t);
  writeFileSync(join(CACHE, sourceId, "transcript.json"), JSON.stringify(lines, null, 1));
  return lines;
}

interface Observation {
  t: number;
  text: string;
}

async function observe(sourceId: string): Promise<Observation[]> {
  const sheets = JSON.parse(readFileSync(join(CACHE, sourceId, "sheets.json"), "utf8")) as {
    file: string;
    grid: number;
    times: number[];
  }[];
  const wanted = SHEETS.get(sourceId);
  const chosen = wanted ? sheets.filter((_, i) => wanted.has(i + 1)) : sheets;
  const res = await pool(chosen, async (sheet) => {
    const path = join(CACHE, sourceId, "sheets", sheet.file);
    const legend = sheet.times.map((t, i) => `cell ${i + 1}: ${mmss(t)} (${t}s)`).join("; ");
    const parts: InputPart[] = [
      {
        type: "input_text",
        text: `This is a ${sheet.grid}x${sheet.grid} grid of frames from "${sourceId}", read left to right, top to bottom. ${legend}.
List what visibly changes or happens, at most 6 entries, citing the time of the cell where you see it.
Return {"observations":[{"t": seconds, "text": "what is visible, hedged"}]}.`,
      },
      { type: "input_image", image_url: dataUrl(path) },
    ];
    const r = await cached(`observe:${VISION_MODEL}:${sourceId}:${sheet.file}:${manifest.sources[sourceId]?.sha256}`, { observations: [] }, () =>
      askJsonParts(VISION_SYSTEM, parts, { ...modelOpt(VISION_MODEL), timeoutMs: 90_000 }),
    );
    return asArray<Observation>(r, "observations").filter((o) => sheet.times.includes(Number(o.t)) && o.text);
  });
  const all = res.flat().map((o) => ({ t: Number(o.t), text: String(o.text) }));
  writeFileSync(join(CACHE, sourceId, "observations.json"), JSON.stringify(all, null, 1));
  return all;
}

interface RawClaim {
  claim: string;
  eventTime?: string | null;
  actor?: string | null;
  location?: string | null;
  page?: number;
  paragraph?: number | null;
  exactQuote?: string;
  t?: number;
}

let nextClaim = 0;
const newId = (p: string) => `${p}-${String(++nextClaim).padStart(3, "0")}`;
const clean = (v: unknown) => (typeof v === "string" && v.trim() && v !== "null" ? v.trim() : undefined);

async function documentClaims(sourceId: string, pages: PageText[]): Promise<Claim[]> {
  const chunks: PageText[][] = [];
  const wantedPages = PAGES.get(sourceId);
  const use = wantedPages ? pages.filter((p) => wantedPages.has(p.page)) : pages;
  for (let i = 0; i < use.length; i += 6) chunks.push(use.slice(i, i + 6));
  const res = await pool(chunks, async (chunk) => {
    const text = chunk.map((p) => `[PAGE ${p.page}]\n${p.text}`).join("\n\n");
    const r = await cached(`claims:${TEXT_MODEL}:${sourceId}:${createHash("sha256").update(text).digest("hex")}`, { claims: [] }, () =>
      askJsonParts(DOC_SYSTEM, [{ type: "input_text", text: `${CLAIMS_TASK}\n\nSOURCE: ${sourceId}\n\n${text}` }], {
        ...modelOpt(TEXT_MODEL),
        timeoutMs: 120_000,
      }),
    );
    return asArray<RawClaim>(r, "claims");
  });
  return res.flat().filter((c) => clean(c.claim) && clean(c.exactQuote)).map((c) => ({
    id: newId(sourceId),
    origin: "document" as const,
    claim: c.claim.trim(),
    ...(clean(c.eventTime) ? { eventTime: clean(c.eventTime)! } : {}),
    ...(clean(c.actor) ? { actor: clean(c.actor)! } : {}),
    ...(clean(c.location) ? { location: clean(c.location)! } : {}),
    at: { source: sourceId, page: Number(c.page), ...(Number.isFinite(Number(c.paragraph)) && c.paragraph !== null ? { paragraph: Number(c.paragraph) } : {}) },
    exactQuote: c.exactQuote!.trim(),
    verification: { status: "unchecked", method: "none" },
  }));
}

async function transcriptClaims(sourceId: string, lines: Line[]): Promise<Claim[]> {
  if (lines.length === 0) return [];
  const text = lines.map((l) => `[${l.t}s] ${l.speaker}: ${l.text}`).join("\n");
  const r = await cached(`tclaims:${TEXT_MODEL}:${sourceId}:${createHash("sha256").update(text).digest("hex")}`, { claims: [] }, () =>
    askJsonParts(
      DOC_SYSTEM,
      [
        {
          type: "input_text",
          text: `This is a machine transcript of the officer's body camera. Extract what is SAID about the stop (reasons given, signals, turns, recording, tickets, phones).
For each: claim (hedged, "a speaker appears to say ..."), t (seconds, from the [..s] marker), actor (Speaker label), exactQuote (copied exactly from that line).
Return {"claims":[...]}. At most 20.\n\n${text}`,
        },
      ],
      { ...modelOpt(TEXT_MODEL), timeoutMs: 120_000 },
    ),
  );
  return asArray<RawClaim>(r, "claims").filter((c) => clean(c.claim) && clean(c.exactQuote) && Number.isFinite(Number(c.t))).map((c) => ({
    id: newId(`${sourceId}-audio`),
    origin: "transcript" as const,
    claim: c.claim.trim(),
    ...(clean(c.actor) ? { actor: clean(c.actor)! } : {}),
    at: { source: sourceId, t: Number(c.t) },
    exactQuote: c.exactQuote!.trim(),
    verification: { status: "unchecked", method: "none" },
  }));
}

async function videoClaims(sourceId: string, obs: Observation[]): Promise<Claim[]> {
  if (obs.length === 0) return [];
  const text = obs.map((o) => `[${o.t}s] ${o.text}`).join("\n");
  const r = await cached(`vclaims:${TEXT_MODEL}:${sourceId}:${createHash("sha256").update(text).digest("hex")}`, { claims: [] }, () =>
    askJsonParts(
      VISION_SYSTEM,
      [
        {
          type: "input_text",
          text: `These are timestamped observations of "${sourceId}". Pick the ones that matter for the stop (vehicles ahead, signals or lamps, lane changes, the turn, emergency lights, the stop, people approaching). Merge duplicates.
For each: claim (only what is visible, hedged), t (seconds, one of the given times). Return {"claims":[...]}. At most 15.\n\n${text}`,
        },
      ],
      { ...modelOpt(TEXT_MODEL), timeoutMs: 120_000 },
    ),
  );
  const times = new Set(obs.map((o) => o.t));
  return asArray<RawClaim>(r, "claims").filter((c) => clean(c.claim) && times.has(Number(c.t))).map((c) => ({
    id: newId(sourceId),
    origin: "video" as const,
    claim: c.claim.trim(),
    at: { source: sourceId, t: Number(c.t) },
    verification: { status: "unchecked", method: "none" },
  }));
}

interface RawFinding {
  kind: string;
  title: string;
  explanation: string;
  claimIds: string[];
}

async function crossCheck(claims: Claim[]): Promise<Finding[]> {
  const list = claims
    .map((c) => {
      const where = "page" in c.at ? `p.${c.at.page}${c.at.paragraph ? ` ¶${c.at.paragraph}` : ""}` : `${mmss(c.at.t)}`;
      return `${c.id} | ${c.at.source} ${where} | ${c.claim}${c.exactQuote ? ` | "${c.exactQuote}"` : ""}`;
    })
    .join("\n");
  const expected = caseFile.expected.map((e) => `${e.id}: ${e.label} (${e.why})`).join("\n");
  const r = await cached(`xcheck:${TEXT_MODEL}:${createHash("sha256").update(list + expected).digest("hex")}`, { findings: [] }, () =>
    askJsonParts(
      XCHECK_SYSTEM,
      [
        {
          type: "input_text",
          text: `CLAIMS (id | source and location | claim | quote):\n${list}\n\nEXPECTED RECORDS (may be missing):\n${expected}\n
Return {"findings":[{"kind":"conflict|agrees|missing","title":"short","explanation":"one or two hedged sentences","claimIds":["..."]}]}.
Cite only ids from the list (for a missing record you may also cite its expected id). At most 10 findings, most important first.`,
        },
      ],
      { ...modelOpt(TEXT_MODEL), timeoutMs: 180_000, effort: "medium" },
    ),
  );
  return asArray<RawFinding>(r, "findings")
    .filter((f) => ["conflict", "agrees", "missing"].includes(f.kind) && clean(f.title))
    .map((f, i) => ({
      id: `finding-${i + 1}`,
      kind: f.kind as Finding["kind"],
      title: f.title.trim(),
      explanation: String(f.explanation ?? "").trim(),
      claimIds: Array.isArray(f.claimIds) ? f.claimIds.map(String) : [],
      status: "verified" as const,
    }));
}

// ---------- verification ----------

function grabFrame(sourceId: string, t: number, out: string) {
  const file = caseFile.sources.find((s) => s.id === sourceId)!.file;
  execFileSync(FFMPEG, ["-v", "error", "-y", "-ss", String(t), "-i", join(MEDIA, file), "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "3", out]);
}

let vchecks = 0;

async function verifyClaims(claims: Claim[], pagesBySource: Record<string, PageText[]>, transcripts: Record<string, Line[]>) {
  await pool(claims, async (c) => {
    if (c.origin === "document" && "page" in c.at) {
      const check = checkQuote(pagesBySource[c.at.source] ?? [], c.exactQuote ?? "", c.at.page);
      if (check.status === "exact") c.verification = { status: "passed", method: "quote-on-page" };
      else if (check.status === "moved") {
        c.verification = { status: "fixed", method: "quote-on-page", note: `quote is on p.${check.page}, not p.${c.at.page}` };
        c.at = { source: c.at.source, page: check.page };
      } else c.verification = { status: "failed", method: "quote-on-page", note: "quote not found in the extracted text" };
      return;
    }
    if (c.origin === "transcript" && "t" in c.at) {
      const near = (transcripts[c.at.source] ?? []).filter((l) => Math.abs(l.t - (c.at as { t: number }).t) <= 60);
      const ok = inTranscript(near.map((l) => l.text).join(" "), c.exactQuote ?? "");
      c.verification = ok
        ? { status: "passed", method: "quote-in-transcript", note: "matches the machine transcript; not checked against the audio by a person" }
        : { status: "failed", method: "quote-in-transcript", note: "quote not in the transcript near that time" };
      return;
    }
    if (c.origin === "video" && "t" in c.at) {
      if (vchecks >= MAX_VCHECKS) {
        c.verification = { status: "unchecked", method: "none", note: "not checked in this run (over the --max-vchecks limit); not used in any finding" };
        return;
      }
      vchecks++;
      const name = `${c.at.source}-${String(Math.round(c.at.t)).padStart(4, "0")}.jpg`;
      const out = join(FRAMES_OUT, name);
      if (!DRY && MEDIA) grabFrame(c.at.source, c.at.t, out);
      const r = await cached<{ verdict?: string; reason?: string }>(
        `vcheck:${VISION_MODEL}:${c.at.source}:${c.at.t}:${c.claim}`,
        { verdict: "unclear", reason: "dry run" },
        () =>
          askJsonParts(
            VISION_SYSTEM,
            [
              {
                type: "input_text",
                text: `Statement about this single frame: "${c.claim}". Judge only from what is visible in the frame.
Return {"verdict":"holds|does-not-hold|unclear","reason":"one sentence"}.`,
              },
              { type: "input_image", image_url: existsSync(out) ? dataUrl(out) : "data:," },
            ],
            { ...modelOpt(VISION_MODEL), timeoutMs: 60_000 },
          ),
      );
      if (r.verdict === "holds") {
        c.frameRef = `/frames/analysis/${name}`;
        c.verification = { status: "passed", method: "second-vision-check", note: r.reason ?? "" };
      } else {
        c.verification = { status: "failed", method: "second-vision-check", note: `${r.verdict}: ${r.reason ?? ""}` };
        if (existsSync(out)) rmSync(out);
      }
    }
  });
}

const CONCLUSIVE = /\b(guilty|innocent|illegal(ly)?|unlawful(ly)?|lied|lying|fabricat\w*|proves?|violat\w*|unconstitutional)\b/i;

function verifyFindings(findings: Finding[], claims: Claim[]) {
  const byId = new Map(claims.map((c) => [c.id, c]));
  const expected = new Set(caseFile.expected.map((e) => e.id));
  for (const f of findings) {
    const cited = f.claimIds.filter((id) => !expected.has(id));
    const unknown = cited.filter((id) => !byId.has(id));
    const failed = cited.filter((id) => ["failed", "unchecked"].includes(byId.get(id)?.verification.status ?? "failed"));
    const sources = new Set(cited.map((id) => byId.get(id)?.at.source));
    let reason: string | undefined;
    if (unknown.length) reason = `cites unknown claims ${unknown.join(", ")}`;
    else if (failed.length) reason = `cited claims failed verification: ${failed.join(", ")}`;
    else if (f.kind !== "missing" && sources.size < 2) reason = "needs claims from two different sources";
    else if (f.kind === "missing" && cited.length === 0 && !f.claimIds.some((id) => expected.has(id))) reason = "cites nothing";
    else if (CONCLUSIVE.test(`${f.title} ${f.explanation}`)) reason = "uses conclusive language";
    if (reason) {
      f.status = "dropped";
      f.droppedBecause = reason;
    }
  }
}

// ---------- run ----------

async function main() {
  const t0 = Date.now();
  say(`analyze ${caseFile.caseId}${DRY ? " (dry run: no model calls)" : ""}`);
  const sources: SourceMeta[] = caseFile.sources
    .filter((s) => manifest.sources[s.id]?.status === "ok")
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      label: s.label,
      url: s.url,
      sha256: manifest.sources[s.id]!.sha256,
      ...(manifest.sources[s.id]!.pages ? { pages: manifest.sources[s.id]!.pages! } : {}),
      ...(manifest.sources[s.id]!.duration ? { duration: manifest.sources[s.id]!.duration! } : {}),
    }));

  const pagesBySource: Record<string, PageText[]> = {};
  for (const s of sources.filter((x) => x.kind === "pdf")) {
    pagesBySource[s.id] = (JSON.parse(readFileSync(join(CACHE, s.id, "pages.json"), "utf8")) as PageText[]).map((p) => ({ page: p.page, text: p.text }));
  }
  const videos = sources
    .filter((x) => x.kind === "video" && (ONLY_VIDEOS.length === 0 || ONLY_VIDEOS.includes(x.id)))
    .map((x) => x.id);

  const transcripts: Record<string, Line[]> = {};
  await timed("transcription", async () => {
    for (const v of videos) transcripts[v] = SKIP_AUDIO ? [] : await transcribe(v);
    if (SKIP_AUDIO) say("  transcription skipped (--skip-audio)");
  });
  const observations: Record<string, Observation[]> = {};
  await timed("frame description", async () => {
    for (const v of videos) observations[v] = await observe(v);
  });

  const claims: Claim[] = [];
  await timed("claim extraction", async () => {
    for (const [id, pages] of Object.entries(pagesBySource)) claims.push(...(await documentClaims(id, pages)));
    for (const v of videos) claims.push(...(await transcriptClaims(v, transcripts[v] ?? [])));
    for (const v of videos) claims.push(...(await videoClaims(v, observations[v] ?? [])));
  });
  await timed("claim verification", () => verifyClaims(claims, pagesBySource, transcripts));
  const findings = await timed("cross-check", () => crossCheck(claims.filter((c) => c.verification.status === "passed" || c.verification.status === "fixed")));
  verifyFindings(findings, claims);
  timings["total"] = Math.round((Date.now() - t0) / 100) / 10;

  const analysis: CaseAnalysis = {
    caseId: caseFile.caseId,
    generatedAt: new Date().toISOString(),
    models: { text: TEXT_MODEL, vision: VISION_MODEL, audio: AUDIO_MODEL },
    timings,
    sources,
    claims,
    findings,
    log,
  };
  if (!DRY) writeFileSync(join(DATA_OUT, "analysis.json"), JSON.stringify(analysis, null, 1));
  writeFileSync(join(CACHE, "report.md"), report(analysis));

  const count = (s: string) => claims.filter((c) => c.verification.status === s).length;
  say(
    `claims: ${claims.length} (passed ${count("passed")}, fixed ${count("fixed")}, failed ${count("failed")}) | findings: ${findings.length} (verified ${findings.filter((f) => f.status === "verified").length}) | model calls: ${stats.calls} new, ${stats.cached} cached, ${stats.failed} failed | ${timings["total"]}s`,
  );
  say(`provider: ${JSON.stringify(providerStats())}`);
  // Remove frames no claim uses (from earlier runs).
  const used = new Set(claims.map((c) => c.frameRef && basename(c.frameRef)).filter(Boolean));
  if (!DRY) for (const f of readdirSync(FRAMES_OUT)) if (!used.has(f)) rmSync(join(FRAMES_OUT, f));
}

function where(at: Locator) {
  return "page" in at ? `${at.source} p.${at.page}${at.paragraph ? ` ¶${at.paragraph}` : ""}` : `${at.source} ${mmss(at.t)}`;
}

function report(a: CaseAnalysis): string {
  const lines = [`# ${a.caseId} analysis`, "", `Generated ${a.generatedAt}. Models: ${a.models.text} (text), ${a.models.vision} (vision), ${a.models.audio} (audio).`, ""];
  lines.push("## Timings (s)", "", ...Object.entries(a.timings).map(([k, v]) => `- ${k}: ${v}`), "");
  lines.push("## Findings", "");
  for (const f of a.findings) {
    lines.push(`### [${f.status}] ${f.kind}: ${f.title}`, f.explanation, ...(f.droppedBecause ? [`Dropped: ${f.droppedBecause}`] : []));
    for (const id of f.claimIds) {
      const c = a.claims.find((x) => x.id === id);
      lines.push(c ? `- ${id} (${where(c.at)}, ${c.verification.status}): ${c.claim}${c.exactQuote ? ` — "${c.exactQuote}"` : ""}` : `- ${id}`);
    }
    lines.push("");
  }
  lines.push("## Claims by source", "");
  for (const s of a.sources) {
    lines.push(`### ${s.label}`, "");
    for (const c of a.claims.filter((x) => x.at.source === s.id)) {
      lines.push(`- **${c.verification.status}** ${where(c.at)} — ${c.claim}${c.exactQuote ? ` — "${c.exactQuote}"` : ""}${c.verification.note ? ` _(${c.verification.note})_` : ""}`);
    }
    lines.push("");
  }
  lines.push("## Log", "", ...a.log.map((l) => `    ${l}`));
  return lines.join("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
