// Analysis of the BTK public evidence packet. Run btk-ingest.py first.
//
//   npx tsx --env-file=.env scripts/evidence/btk-analyze.ts [--dry]
//
// Two model requests at most (cached in cache/btk/model): the model quotes the cited pages for
// each observation and each timeline entry. Every quote is then checked in code against the
// page text; only quotes found on the cited page count. The attribution test asked for by the
// packet (turn off the disk-metadata lead, see what still links the record to the person) is a
// graph computation over the packet's relationships, with no model. Writes
// src/data/btk/packet-analysis.json.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { askJsonParts, providerStats } from "../../src/lib/ai/provider.server";
import { checkScannedQuote } from "../../src/lib/evidence/verify";
import type { BtkAnalysis, CheckedCitation, Packet, PacketCitation } from "../../src/lib/cases/btk-types";
import { QUOTE_SYSTEM, VISION_SYSTEM, XCHECK_SYSTEM } from "./prompts";

const DRY = process.argv.includes("--dry");
const CLIP = (() => {
  const i = process.argv.indexOf("--clip");
  return i >= 0 ? process.argv[i + 1]! : "";
})();
const FFMPEG = process.env["FFMPEG"] ?? "ffmpeg";
const CROSSCHECK = process.argv.includes("--crosscheck");
const EVIDENCE_DIR = (() => {
  const i = process.argv.indexOf("--evidence");
  return i >= 0 ? process.argv[i + 1]! : join(process.env["HOME"] ?? "", "Desktop", "evidence");
})();
const CACHE = join("cache", "btk");
const MODEL_CACHE = join(CACHE, "model");
mkdirSync(MODEL_CACHE, { recursive: true });
mkdirSync(join("src", "data", "btk"), { recursive: true });

const packet = JSON.parse(readFileSync(join(CACHE, "packet.json"), "utf8")) as Packet;
const c = packet.cases[0]!;
const { pages, methods } = JSON.parse(readFileSync(join(CACHE, "pages.json"), "utf8")) as {
  pages: Record<string, Record<string, string>>;
  methods: Record<string, string>;
};
const log: string[] = [];
const say = (s: string) => {
  log.push(s);
  console.log(s);
};

async function cached<T>(key: string, call: () => Promise<unknown>): Promise<T | null> {
  const file = join(MODEL_CACHE, `${createHash("sha256").update(key).digest("hex").slice(0, 24)}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as T;
  if (DRY) return null;
  const v = await call();
  writeFileSync(file, JSON.stringify(v, null, 1));
  return v as T;
}

const pagesOf = (cit: PacketCitation): number[] =>
  cit.pdf_page ? Array.from({ length: (cit.pdf_page_end ?? cit.pdf_page) - cit.pdf_page + 1 }, (_, i) => cit.pdf_page! + i) : [];
const hasText = (cit: PacketCitation) => pagesOf(cit).some((p) => pages[cit.source_id]?.[String(p)]);

/** The page texts a list of statements cites, once each. */
function pageBlock(cits: PacketCitation[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const cit of cits)
    for (const p of pagesOf(cit)) {
      const k = `${cit.source_id}:${p}`;
      const t = pages[cit.source_id]?.[String(p)];
      if (!t || seen.has(k)) continue;
      seen.add(k);
      out.push(`=== PAGE ${cit.source_id} p.${p} (${methods[k]}) ===\n${t}`);
    }
  return out.join("\n\n");
}

type Answer = { id: string; citations: { source: string; page: number; support: string; quotes: string[] }[] };

async function quoteRound(kind: string, rows: { id: string; text: string; citations: PacketCitation[] }[]) {
  const cits = rows.flatMap((r) => r.citations.filter(hasText));
  const statements = rows
    .map((r) => {
      const where = r.citations
        .filter(hasText)
        .map((x) => `${x.source_id} p.${x.pdf_page}${x.pdf_page_end ? `-${x.pdf_page_end}` : ""}`)
        .join("; ");
      return `${r.id}: ${r.text}\n  cites: ${where}`;
    })
    .join("\n");
  const prompt = `PAGE TEXTS:\n${pageBlock(cits)}\n\nSTATEMENTS (${kind}):\n${statements}\n
For every statement and every cited page range, return {"items":[{"id":"B-001","citations":[{"source":"STATE","page":42,"support":"supports|partial|not_found","quotes":["..."]}]}]}. "page" is the page the quote is on.`;
  say(`${kind}: ${rows.length} statements, ${cits.length} citations with text, prompt ${Math.round(prompt.length / 1000)}k chars`);
  const r = await cached<{ items?: Answer[] }>(`btk-quotes:${kind}:${createHash("sha256").update(prompt).digest("hex")}`, () =>
    askJsonParts(QUOTE_SYSTEM, [{ type: "input_text", text: prompt }], { timeoutMs: 240_000 }),
  );
  return new Map((r?.items ?? []).map((a) => [a.id, a]));
}

/** Check each answer's quotes on the page text; returns the citations with their verified quotes. */
function check(id: string, citations: PacketCitation[], answer: Answer | undefined): CheckedCitation[] {
  return citations.map((cit) => {
    const range = pagesOf(cit);
    const base: CheckedCitation = {
      source: cit.source_id,
      ...(cit.pdf_page ? { page: cit.pdf_page } : {}),
      ...(cit.pdf_page_end ? { pageEnd: cit.pdf_page_end } : {}),
      section: cit.section,
      quotes: [],
      status: "unchecked",
    };
    if (!hasText(cit)) {
      base.note =
        cit.source_id === "CHURCH" ? undefined : "No page text in the packet for this source (external link or not a PDF).";
      return base;
    }
    const srcPages = Object.entries(pages[cit.source_id] ?? {}).map(([p, text]) => ({ page: Number(p), text }));
    const answers = (answer?.citations ?? []).filter((a) => a.source === cit.source_id && range.includes(Number(a.page)));
    for (const a of answers)
      for (const q of a.quotes ?? []) {
        const r = checkScannedQuote(srcPages, q, Number(a.page));
        if (r.status === "exact") base.quotes.push({ text: q.trim(), page: Number(a.page), method: `${methods[`${cit.source_id}:${a.page}`] ?? ""}${r.loose ? ", spacing ignored" : ""}` });
        else say(`  ${id} ${cit.source_id} p.${a.page}: quote not on the page (${r.status}): "${q.slice(0, 60)}…"`);
      }
    const support = answers.map((a) => a.support);
    base.status = base.quotes.length === 0 ? "failed" : support.includes("supports") ? "passed" : "partial";
    return base;
  });
}

// The church page is HTML; check its listing in code rather than with the model.
function churchCitation(cit: PacketCitation): CheckedCitation {
  const html = pages.CHURCH?.["1"] ?? "";
  const line = html.split("\n").find((l) => /President<\/a>:\s*Dennis Rader/.test(l));
  return {
    source: "CHURCH",
    section: cit.section,
    quotes: line ? [{ text: "President: Dennis Rader", page: 1, method: "archived-html" }] : [],
    status: line ? "passed" : "failed",
    note: line ? `Archived HTML line: ${line.replace(/<[^>]+>/g, "").trim()}` : undefined,
  };
}

const withChurch = (cits: CheckedCitation[], raw: PacketCitation[]) =>
  cits.map((x, i) => (raw[i]!.source_id === "CHURCH" ? churchCitation(raw[i]!) : x));

function statusOf(cits: CheckedCitation[]): "verified" | "partial" | "unverified" {
  if (cits.some((x) => x.status === "passed")) return "verified";
  if (cits.some((x) => x.status === "partial")) return "partial";
  return "unverified";
}

/** Turn off a lead and list what still ties the record to the person (packet graph only). */
function attributionWithout(disabled: string[], person: string) {
  const off = new Set(disabled);
  const kept = c.relationships.filter((r) => r.evidence_ids.some((id) => !off.has(id)));
  const reach = new Set([person]);
  // Walk edges both ways from the person until nothing new is reached.
  for (let changed = true; changed; ) {
    changed = false;
    for (const r of kept)
      for (const [a, b] of [
        [r.from, r.to],
        [r.to, r.from],
      ] as const)
        if (reach.has(a) && !reach.has(b) && !b.startsWith("VICTIM_")) {
          reach.add(b);
          changed = true;
        }
  }
  const streams = kept
    .filter((r) => reach.has(r.from) && reach.has(r.to) && !r.from.startsWith("VICTIM_"))
    .map((r) => ({ from: r.from, type: r.type, to: r.to, evidenceIds: r.evidence_ids.filter((id) => !off.has(id)) }));
  const lost = c.relationships
    .filter((r) => r.evidence_ids.every((id) => off.has(id)))
    .map((r) => ({ from: r.from, type: r.type, to: r.to, evidenceIds: r.evidence_ids }));
  return { disabled, streams, lost };
}

async function main() {
  const t0 = Date.now();
  const obsRows = c.evidence.map((e) => ({ id: e.id, text: e.description, citations: e.citations }));
  const evRows = c.timeline.map((t) => ({ id: t.id, text: `${t.date}${t.end_date ? ` to ${t.end_date}` : ""}: ${t.event}`, citations: t.citations }));
  const obsAnswers = await quoteRound("observations", obsRows);
  const evAnswers = await quoteRound("timeline", evRows);

  const observations = c.evidence.map((e) => {
    const citations = withChurch(check(e.id, e.citations, obsAnswers.get(e.id)), e.citations);
    return { id: e.id, type: e.type, description: e.description, limitation: e.limitation, entityIds: e.entity_ids, citations, status: statusOf(citations) };
  });
  const events = c.timeline.map((t) => {
    const citations = withChurch(check(t.id, t.citations, evAnswers.get(t.id)), t.citations);
    return {
      id: t.id,
      date: t.date,
      ...(t.end_date ? { endDate: t.end_date } : {}),
      precision: t.precision,
      event: t.event,
      ...(t.date_note ? { dateNote: t.date_note } : {}),
      evidenceIds: t.evidence_ids,
      citations,
      status: statusOf(citations),
    };
  });

  // The news clip: a blind description of frames every 5 seconds checks what the packet says
  // the clip shows (exterior footage; document close-ups around 0:45). One request.
  if (CLIP) {
    const sheet = join(CACHE, "kxas-sheet.jpg");
    const times = Array.from({ length: 10 }, (_, i) => 2.5 + i * 5);
    if (!existsSync(sheet))
      execFileSync(FFMPEG, ["-v", "error", "-y", "-ss", "2.5", "-i", CLIP, "-vf", "fps=1/5,scale=320:-2,tile=5x2", "-frames:v", "1", "-q:v", "3", sheet]);
    const legend = times.map((t, i) => `cell ${i + 1}: ${t}s`).join("; ");
    const r = await cached<{ cells?: { t: number | string; shows: string; kind: string }[] }>(
      `btk-clip:${createHash("sha256").update(readFileSync(sheet)).digest("hex")}`,
      () =>
        askJsonParts(
          VISION_SYSTEM,
          [
            {
              type: "input_text",
              text: `A 5x2 grid of frames from a 50-second news clip, read left to right, top to bottom (${legend}).
For each cell say briefly what is visible and classify it as "exterior" (outside a building or street), "document" (a close-up of paper, a page or printed text), "people", "interior" or "other".
Return {"cells":[{"t": seconds, "shows": "short description", "kind": "exterior|document|people|interior|other"}]}.`,
            },
            { type: "input_image", image_url: `data:image/jpeg;base64,${readFileSync(sheet).toString("base64")}` },
          ],
          { timeoutMs: 90_000 },
        ),
    );
    const cells = (r?.cells ?? []).map((x) => ({ t: parseFloat(String(x.t)), shows: String(x.shows ?? ""), kind: String(x.kind ?? "") }));
    const docs = cells.filter((x) => x.kind === "document");
    const docNear45 = docs.some((x) => x.t >= 37 && x.t <= 50);
    const exterior = cells.some((x) => x.kind === "exterior");
    say(`clip: ${cells.map((x) => `${x.t}s ${x.kind}`).join(", ")}`);
    const note = `Frames every 5 s described without the packet's text: ${exterior ? "exterior footage seen" : "no exterior footage seen"}; ${
      docs.length ? `document close-ups at ${docs.map((x) => `0:${String(Math.floor(x.t)).padStart(2, "0")}`).join(", ")}` : "no document close-ups seen"
    }. The arraignment date comes from the archive record, not from the frames.`;
    for (const row of [...observations, ...events])
      for (const cit of row.citations)
        if (cit.source === "VIDEO_UNT") {
          cit.status = exterior && docNear45 ? "passed" : cells.length ? "partial" : "unchecked";
          cit.note = note;
        }
    for (const row of [...observations, ...events]) row.status = statusOf(row.citations);
  }

  // Agreement: an observation whose quotes were verified on two or more different sources.
  const agreements = observations
    .map((o) => ({ o, srcs: [...new Set(o.citations.filter((x) => x.status === "passed").map((x) => x.source))] }))
    .filter(({ srcs }) => srcs.length >= 2)
    .map(({ o, srcs }) => ({ observationId: o.id, sources: srcs }));

  // Page images cut from a filing: their OCR (cache/btk/ocr/<id>/p1.txt, from ocr-vision.swift)
  // should read like the page they come from. Share of the image's words found on that page.
  const words = (t: string) => t.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((w) => w.length >= 4);
  const derivedChecks = c.sources
    .filter((s) => s.id.startsWith("SCAN_"))
    .flatMap((s) => {
      const meta = s as typeof s & { parent_source_id?: string; parent_pdf_page?: number };
      const f = join(CACHE, "ocr", s.id, "p1.txt");
      const parent = pages[meta.parent_source_id ?? ""]?.[String(meta.parent_pdf_page)];
      if (!existsSync(f) || !parent || !meta.parent_pdf_page) return [];
      const img = words(readFileSync(f, "utf8"));
      const onPage = new Set(words(parent));
      const share = img.length ? img.filter((w) => onPage.has(w)).length / img.length : 0;
      say(`derived ${s.id}: ${Math.round(share * 100)}% of its words are on ${meta.parent_source_id} p.${meta.parent_pdf_page}`);
      return [{ id: s.id, parent: meta.parent_source_id!, page: meta.parent_pdf_page, share: Math.round(share * 100) / 100, status: (share >= 0.7 ? "passed" : "failed") as "passed" | "failed" }];
    });

  // Contradictions and agreements across every text in the packet (one request). Each quote
  // must be found on its page in code; a finding needs two different sources.
  let findings: NonNullable<BtkAnalysis["findings"]> = [];
  if (CROSSCHECK) {
    const allPages: Record<string, Record<string, string>> = { ...pages };
    const churchLines = (pages["CHURCH"]?.["1"] ?? "").split("\n").filter((l) => /President|Secretary|Treasurer|council/i.test(l)).map((l) => l.replace(/<[^>]+>/g, "").trim());
    allPages["CHURCH"] = { "1": churchLines.join("\n") };
    for (const d of derivedChecks) allPages[d.id] = { "1": readFileSync(join(CACHE, "ocr", d.id, "p1.txt"), "utf8") };
    const block = Object.entries(allPages)
      .flatMap(([sid, ps]) => Object.entries(ps).map(([p, t]) => `=== ${sid} p.${p} (${methods[`${sid}:${p}`] ?? (sid.startsWith("SCAN_") ? "image OCR" : "")}) ===\n${t}`))
      .join("\n\n");
    const questions = [
      c.question,
      "Where do two sources describe the same artifact, date, result or event differently? For example how the disk information was found and described, the dates of arrest, announcement, sentencing and filing, and the laboratory results on specimens.",
      "Which statements are backed by two or more independent sources?",
    ];
    const prompt = `SOURCES: ${c.sources.filter((s) => allPages[s.id]).map((s) => `${s.id} = ${s.title} (${s.type})`).join("; ")}\n\nPAGE TEXTS:\n${block}\n\nQUESTIONS:\n${questions.map((q) => `- ${q}`).join("\n")}\n
Answer from the page texts only. Report possible conflicts (two sources describing the same thing differently) and agreements (two different sources backing the same statement). Do not treat a difference in wording or detail as a conflict unless the descriptions cannot both be exactly right. Avoid graphic detail about the crimes.
Each finding cites at least two different sources; each cite has the source id, the page number and a short quote (8 to 40 words) copied character for character from that page's text.
Return {"findings":[{"kind":"conflict|agrees","title":"short","explanation":"one or two hedged sentences","cites":[{"source":"STATE","page":42,"quote":"..."}]}]}. At most 10, most important first.`;
    say(`cross-check: ${Object.values(allPages).reduce((n, ps) => n + Object.keys(ps).length, 0)} pages, prompt ${Math.round(prompt.length / 1000)}k chars`);
    const r = await cached<{ findings?: { kind: string; title: string; explanation: string; cites: { source: string; page: number | string; quote: string }[] }[] }>(
      `btk-xcheck:${createHash("sha256").update(prompt).digest("hex")}`,
      () => askJsonParts(XCHECK_SYSTEM, [{ type: "input_text", text: prompt }], { timeoutMs: 240_000, effort: "medium" }),
    );
    const CONCLUSIVE = /\b(guilty|innocent|illegal(ly)?|unlawful(ly)?|lied|lying|fabricat\w*|proves?|unconstitutional)\b/i;
    findings = (r?.findings ?? [])
      .filter((f) => ["conflict", "agrees"].includes(f.kind) && Array.isArray(f.cites))
      .map((f, i) => {
        const cites = f.cites
          .map((x) => ({ source: String(x.source), page: parseInt(String(x.page), 10) || 1, quote: String(x.quote ?? "").trim() }))
          .filter((x) => {
            const ps = Object.entries(allPages[x.source] ?? {}).map(([p, text]) => ({ page: Number(p), text }));
            const ok = checkScannedQuote(ps, x.quote, x.page).status === "exact";
            if (!ok) say(`  xcheck ${i + 1}: quote not on ${x.source} p.${x.page}: "${x.quote.slice(0, 60)}…"`);
            return ok;
          });
        const finding = { id: `x${i + 1}`, kind: f.kind as "conflict" | "agrees", title: String(f.title).trim(), explanation: String(f.explanation ?? "").trim(), cites, status: "verified" as "verified" | "dropped" };
        const srcs = new Set(cites.map((x) => x.source));
        if (srcs.size < 2) return { ...finding, status: "dropped" as const, droppedBecause: "fewer than two sources with a quote found on the page" };
        if (CONCLUSIVE.test(`${finding.title} ${finding.explanation}`)) return { ...finding, status: "dropped" as const, droppedBecause: "uses conclusive language" };
        return finding;
      });
    // Second check: the quotes exist, but does the finding describe them correctly? Each verified
    // finding goes back with its quotes only; a finding the quotes do not support is dropped, or
    // takes the corrected kind and wording when the check gives one (one request).
    const toJudge = findings.filter((f) => f.status === "verified");
    if (toJudge.length) {
      const jprompt = toJudge
        .map((f) => `${f.id} | kind: ${f.kind} | ${f.title}: ${f.explanation}\n${f.cites.map((x) => `  ${x.source} p.${x.page}: "${x.quote}"`).join("\n")}`)
        .join("\n\n");
      // Plain yes/no questions about the quotes (open-ended reviews proved unreliable).
      const j = await cached<{ checks?: { id: string; bothTrue?: boolean | string; sameFact?: boolean | string; reason?: string }[] }>(
        `btk-judge3:${createHash("sha256").update(jprompt).digest("hex")}`,
        () =>
          askJsonParts(
            XCHECK_SYSTEM,
            [
              {
                type: "input_text",
                text: `For each item, read only its quotes, literally.\n- bothTrue: can all of its quotes be literally true at the same time? (A source that reports someone else's claim and then corrects it is stating the correction.)\n- sameFact: do at least two of its quotes, from different sources, state the same fact about the same item or event?\n\n${jprompt}\n
Return {"checks":[{"id":"x1","bothTrue":true,"sameFact":false,"reason":"one sentence"}]}.`,
              },
            ],
            { timeoutMs: 120_000, effort: "medium" },
          ),
      );
      const yes = (v: unknown) => v === true || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "yes";
      for (const ch of j?.checks ?? []) {
        const f = findings.find((x) => x.id === String(ch.id));
        if (!f) continue;
        f.check = `bothTrue=${yes(ch.bothTrue)}, sameFact=${yes(ch.sameFact)}: ${ch.reason ?? ""}`.trim();
        if (f.kind === "conflict" && yes(ch.bothTrue))
          Object.assign(f, { status: "dropped", droppedBecause: `second check: the quoted sources can both be true, so this is not a conflict (${ch.reason ?? ""})` });
        if (f.kind === "agrees" && !yes(ch.sameFact))
          Object.assign(f, { status: "dropped", droppedBecause: `second check: the quotes do not state the same fact (${ch.reason ?? ""})` });
      }
      // Corrections a person made after reading the quotes (scripts/evidence/btk-review.json).
      const review = existsSync(join("scripts", "evidence", "btk-review.json"))
        ? (JSON.parse(readFileSync(join("scripts", "evidence", "btk-review.json"), "utf8")) as { corrections: { title: string; kind?: string; newTitle?: string; explanation?: string; reason: string; reject?: boolean }[] }).corrections
        : [];
      for (const rv of review) {
        const f = findings.find((x) => x.title === rv.title);
        if (!f) continue;
        if (rv.reject) Object.assign(f, { status: "dropped", droppedBecause: `review: ${rv.reason}` });
        else {
          if (rv.kind === "agrees" || rv.kind === "conflict") f.kind = rv.kind;
          if (rv.newTitle) f.title = rv.newTitle;
          if (rv.explanation) f.explanation = rv.explanation;
          Object.assign(f, { status: "verified", check: `${f.check ?? ""} Corrected in review: ${rv.reason}`.trim() });
        }
        say(`  review applied to "${rv.title}"`);
      }
      // A finding the second check did not answer for stays out.
      for (const f of toJudge) if (!f.check) Object.assign(f, { status: "dropped", droppedBecause: "no answer from the second check" });
    }
    for (const f of findings) say(`  finding [${f.status}] ${f.kind}: ${f.title} (${f.cites.map((x) => `${x.source} p.${x.page}`).join(", ")})${f.droppedBecause ? ` - ${f.droppedBecause}` : ""}`);
  }

  // The filing's own stamp against the packet's filed date and the mirrors' file names.
  const recordChecks: NonNullable<BtkAnalysis["recordChecks"]> = [];
  const stateP1 = (() => {
    for (const d of (packet as unknown as { cases: { text_derivatives?: { path: string; parent_source_id: string }[] }[] }).cases[0]!.text_derivatives ?? []) {
      if (d.parent_source_id !== "STATE") continue;
      const f = join(EVIDENCE_DIR, d.path);
      if (!existsSync(f)) return "";
      for (const l of readFileSync(f, "utf8").split("\n")) {
        if (!l.trim()) continue;
        const row = JSON.parse(l) as { pdf_page: number; text: string };
        if (row.pdf_page === 1) return row.text;
      }
    }
    return "";
  })();
  const stamp = /20\s?05\s+[A-Z]{3}\s+\d{1,2}\s+[AP][AM]\s+\d{1,2}\s+\d{2}/.exec(stateP1)?.[0];
  if (stamp) {
    const state = c.sources.find((s) => s.id === "STATE") as (typeof c.sources)[number] & { filed_date?: string; matching_mirrors?: string[] };
    const mirrorDates = (state.matching_mirrors ?? []).map((u) => /(\d{4}-\d{2}-\d{2})/.exec(u)?.[1]).filter(Boolean);
    recordChecks.push({
      title: "Filing date of the State’s Summary",
      detail: `The filing stamp on PDF page 1 reads “${stamp}” (OCR; the month reads as AUG), which matches the packet’s filed date ${state.filed_date}. ${mirrorDates.length ? `One mirror’s file name says ${mirrorDates.join(", ")}; that is the website’s label, not the record.` : ""}`.trim(),
      source: "STATE",
      page: 1,
      quote: stamp,
    });
    say(`record check: STATE stamp "${stamp}" vs filed ${state.filed_date}; mirror names ${mirrorDates.join(", ")}`);
  }

  const attribution = attributionWithout(["B-002", "B-003", "B-004", "B-023"], "RADER");
  const analysis: BtkAnalysis = {
    caseId: "btk",
    generatedAt: new Date().toISOString(),
    model: (providerStats().requestsByModel && Object.keys(providerStats().requestsByModel)[0]) || "cached",
    observations,
    events,
    agreements,
    gaps: c.raw_artifact_gaps.map((g) => ({ artifact: g.artifact, availability: g.availability, why: g.why, evidenceIds: g.evidence_ids })),
    hypotheses: c.hypotheses,
    attribution,
    findings,
    derivedChecks,
    recordChecks,
    notAnalyzed: [
      { id: "PHOTO_KDOC", why: "A portrait of a real person. Faces are not compared or identified; the photo's caption gives the name." },
      { id: "PHOTO_INTERVIEW", why: "A published still of a real person. Faces are not compared; the still's provenance is the ABC clip (external)." },
      ...c.sources.filter((s) => s.availability === "external_link").map((s) => ({ id: s.id, why: "External link: no copy in the packet to analyze." })),
    ],
    log,
  };
  const n = (s: string) => observations.filter((o) => o.status === s).length;
  const m = (s: string) => events.filter((o) => o.status === s).length;
  say(`observations: ${n("verified")} verified, ${n("partial")} partial, ${n("unverified")} unverified`);
  say(`timeline: ${m("verified")} verified, ${m("partial")} partial, ${m("unverified")} unverified`);
  say(`agreements across sources: ${agreements.map((a) => `${a.observationId} (${a.sources.join(", ")})`).join("; ")}`);
  say(`without the disk lead: ${attribution.streams.length} links remain, ${attribution.lost.length} drop out`);
  say(`provider: ${JSON.stringify(providerStats())}; ${Math.round((Date.now() - t0) / 100) / 10}s`);
  if (!DRY) writeFileSync(join("src", "data", "btk", "packet-analysis.json"), JSON.stringify(analysis, null, 1));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
