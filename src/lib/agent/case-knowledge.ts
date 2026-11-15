// The stored case files, cut into short passages that each carry the label a reply cites.
// Pure and offline: it reads the checked analysis and evidence store the app already ships
// (src/data/rosales), so a question is answered from those files and nothing else.
//
// Cite labels look like "Complaint p.24 ¶208" and "Dashcam 0:45".
import analysisJson from "@/data/rosales/analysis.json";
import storeJson from "@/data/rosales/evidence-store.json";

export type PassageKind = "finding" | "claim" | "moment" | "transcript" | "page" | "gap";

export interface Passage {
  /** What a reply puts in parentheses after the fact, e.g. "Complaint p.24 ¶208". */
  cite: string;
  text: string;
  kind: PassageKind;
}

export interface Scored extends Passage {
  score: number;
}

const SOURCE_NAME: Record<string, string> = {
  complaint: "Complaint",
  opinion: "5th Cir. opinion",
  dashcam: "Dashcam",
  bodycam: "Bodycam",
};
const name = (id: string) => SOURCE_NAME[id.toLowerCase()] ?? id;

export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Claim {
  claim: string;
  actor?: string;
  eventTime?: string;
  exactQuote?: string;
  at: { source: string; page?: number; paragraph?: number; t?: number };
}
interface Finding {
  kind: string;
  title: string;
  explanation: string;
}
interface StoreRecord {
  sourceId: string;
  sourceTitle: string;
  page: number;
  location: string;
  method: string;
  text: string;
}
interface Dated {
  time: string;
  event: string;
}
interface Missing {
  artifact: string;
  why: string;
}

const clip = (t: string, max: number) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t);
const tidy = (t: string) => t.replace(/\s+/g, " ").trim();

export function buildRosalesPassages(): Passage[] {
  const out: Passage[] = [];
  const analysis = analysisJson as unknown as { claims: Claim[]; findings: Finding[] };
  const store = storeJson as unknown as {
    records: StoreRecord[];
    dated: Dated[];
    missing: Missing[];
  };

  for (const f of analysis.findings) {
    out.push({
      kind: "finding",
      cite: `Finding: ${f.title}`,
      text: tidy(`${f.title}. ${f.explanation}`),
    });
  }

  for (const c of analysis.claims) {
    const at = c.at;
    const cite =
      at.t !== undefined
        ? `${name(at.source)} ${clock(at.t)}`
        : `${name(at.source)} p.${at.page ?? "?"}${at.paragraph !== undefined ? ` ¶${at.paragraph}` : ""}`;
    const quote = c.exactQuote ? ` Quote: "${clip(tidy(c.exactQuote), 220)}"` : "";
    out.push({ kind: "claim", cite, text: tidy(`${c.claim}${quote}`) });
  }

  for (const d of store.dated) {
    const m = /^(\w+)\s+(\d+:\d{2})/.exec(d.time);
    if (!m) continue;
    out.push({ kind: "moment", cite: `${name(m[1]!)} ${m[2]}`, text: tidy(d.event) });
  }

  for (const r of store.records) {
    if (/^pdf text/.test(r.method)) {
      // Split a page at numbered paragraphs ("208.") so a cite can name the paragraph.
      const parts = r.text.split(/\n\s*(?=\d{1,3}\.\s)/);
      for (const part of parts) {
        const body = tidy(part);
        if (body.length < 40) continue;
        const para = /^(\d{1,3})\.\s/.exec(body)?.[1];
        out.push({
          kind: "page",
          cite: `${name(r.sourceId)} p.${r.page}${para ? ` ¶${para}` : ""}`,
          text: clip(body, 700),
        });
      }
    } else if (/transcript/.test(r.method)) {
      const lines = r.text.split("\n").filter((l) => /^\[\d+:\d{2}\]/.test(l));
      for (let i = 0; i < lines.length; i += 3) {
        const chunk = lines.slice(i, i + 3);
        const t = /^\[(\d+:\d{2})\]/.exec(chunk[0]!)![1]!;
        out.push({
          kind: "transcript",
          cite: `${name(r.sourceId)} ${t}`,
          text: tidy(chunk.join(" ")),
        });
      }
    } else if (/frame description/.test(r.method)) {
      const t = /(\d+:\d{2})/.exec(r.location)?.[1];
      if (t) out.push({ kind: "moment", cite: `${name(r.sourceId)} ${t}`, text: tidy(r.text) });
    }
  }

  for (const m of store.missing) {
    out.push({
      kind: "gap",
      cite: `Not in the record: ${m.artifact}`,
      text: tidy(`${m.artifact} is not in the record. ${m.why}`),
    });
  }
  return out;
}

// ---------- retrieval ----------

const STOP = new Set(
  "the and for was were are did does what when where why how who whom that this with from about they them their his her him she has have had not any can you your tell say said been into out its than then there which also just would could should say mean means please give show me list".split(
    " ",
  ),
);

// A few plain-language words people use for what the files say another way.
const SYNONYM: Record<string, string[]> = {
  pulled: ["stop", "stopped"],
  pull: ["stop"],
  cop: ["officer"],
  cops: ["officer"],
  police: ["officer"],
  blinker: ["signal"],
  indicator: ["signal"],
  car: ["vehicle", "mustang"],
  vehicle: ["mustang"],
  reason: ["failure", "stated"],
  video: ["dashcam", "bodycam"],
  recording: ["dashcam", "bodycam"],
  camera: ["dashcam", "bodycam"],
  missing: ["not", "record"],
  phone: ["phone"],
  lawsuit: ["complaint"],
  court: ["opinion", "complaint"],
};

export function tokens(text: string): string[] {
  const out: string[] = [];
  for (const raw of text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .match(/[a-z0-9]+(?:'[a-z]+)?/g) ?? []) {
    if (STOP.has(raw)) continue;
    let w = raw.replace(/'s$/, "");
    if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
    else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
    else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
    if (w.length >= 2) out.push(w);
    for (const syn of SYNONYM[raw] ?? [])
      out.push(syn.length > 3 && syn.endsWith("s") ? syn.slice(0, -1) : syn);
  }
  return out;
}

const WEIGHT: Record<PassageKind, number> = {
  finding: 1.3,
  claim: 1.25,
  moment: 1.15,
  transcript: 1,
  page: 0.9,
  gap: 1.3,
};

interface Index {
  passages: Passage[];
  sets: Set<string>[];
  idf: Map<string, number>;
}

let cached: Index | null = null;

export function buildIndex(passages: Passage[]): Index {
  const sets = passages.map((p) => new Set(tokens(`${p.text} ${p.cite}`)));
  const df = new Map<string, number>();
  for (const s of sets) for (const w of s) df.set(w, (df.get(w) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [w, n] of df) idf.set(w, Math.log(1 + passages.length / n));
  return { passages, sets, idf };
}

export function rosalesIndex(): Index {
  cached ??= buildIndex(buildRosalesPassages());
  return cached;
}

/** Below this the files are treated as not containing an answer. */
export const MIN_SCORE = 2.2;

/** Sources a person can name ("what about the bodycam?"), and how their passages are cited. */
const NAMED_SOURCES: [RegExp, string][] = [
  [/\b(?:body ?cam|bwc)\b/i, "Bodycam"],
  [/\bdash ?cam\b/i, "Dashcam"],
  [/\bcomplaint\b/i, "Complaint"],
  [/\b(?:opinion|fifth circuit|5th circuit|the court)\b/i, "5th Cir. opinion"],
];

/**
 * `focus` is the newest question on its own. When it names a source, that source's passages come
 * first, so a follow-up like "what about the bodycam?" looks in the bodycam, not wherever the
 * earlier question matched.
 */
export function retrieve(
  query: string,
  index: Index = rosalesIndex(),
  k = 6,
  focus: string = query,
): Scored[] {
  const named = NAMED_SOURCES.filter(([re]) => re.test(focus)).map(([, cite]) => cite);
  const q = [...new Set(tokens(query))];
  if (q.length === 0) return [];
  const scored: Scored[] = [];
  index.passages.forEach((p, i) => {
    const set = index.sets[i]!;
    let score = 0;
    let rare = 0;
    for (const w of q) {
      if (!set.has(w)) continue;
      const weight = index.idf.get(w) ?? 0;
      score += weight;
      if (weight >= 2) rare += 1;
    }
    if (rare === 0) return;
    const boost = named.some((n) => p.cite.startsWith(n)) ? 1.8 : 1;
    scored.push({ ...p, score: (score * WEIGHT[p.kind] * boost) / (1 + p.text.length / 1500) });
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score >= MIN_SCORE).slice(0, k);
  // A named source gets its best passages up front, even when the words differ ("stop" and "pulled over").
  const fromNamed =
    named.length > 0
      ? scored
          .filter((s) => named.some((n) => s.cite.startsWith(n)) && s.score >= MIN_SCORE * 0.5)
          .slice(0, 3)
      : [];
  const merged = [...fromNamed, ...top];
  // One cite once: keep the best passage per cite label.
  const seen = new Set<string>();
  return merged.filter((s) => (seen.has(s.cite) ? false : (seen.add(s.cite), true))).slice(0, k);
}
