// The BTK case (State of Kansas v. Rader, 05 CR 498) in the app's existing shapes: timeline
// items, the seed conversation, the sources shown in Case Analysis, entities and citations.
// Everything here comes from the public evidence packet (src/data/btk/packet.json) and its
// checked analysis (src/data/btk/packet-analysis.json, scripts/evidence/btk-analyze.ts). Only
// quotes found on the cited page in code are shown as quotes; the rest says it is unchecked.
//
// The packet's dates run from 1974 to 2005, so the shared 0-90 axis shows the events in date
// order, evenly spaced and not to scale.
import analysisJson from "@/data/btk/packet-analysis.json";
import packetJson from "@/data/btk/packet.json";
import type { BtkAnalysis, CheckedCitation, Packet, PacketSource } from "@/lib/cases/btk-types";
import type { ChatMessage, Lane, TimelineItem } from "@/lib/sample-case";
import type { Citation, Entity, Paragraph, Source } from "@/lib/sources";

const packet = packetJson as unknown as Packet;
const analysis = analysisJson as unknown as BtkAnalysis;
const c = packet.cases[0]!;
const SOURCES_BY_ID = new Map(c.sources.map((s) => [s.id, s]));

export const BTK_LANES: { id: Lane; label: string }[] = [
  { id: "incidents", label: "Incidents" },
  { id: "investigation", label: "Investigation" },
  { id: "court", label: "Court record" },
  { id: "gaps", label: "Not in the packet" },
];

/** Short source names for chips and labels. */
const SHORT: Record<string, string> = {
  VAULT: "FBI Vault release",
  RCFL: "RCFL annual report 2005",
  STATE: "State’s Summary of the Evidence",
  PLEA: "Plea transcript",
  JUDGMENT: "Journal entry of judgment",
  COMPLAINT: "Complaint/Information",
  PLEA_MINUTE: "Record of plea",
  DISPOSITION: "Order on evidence",
  VALADEZ: "Valadez v. Emmis (Kan.)",
  FBI_CASE_STUDY: "FBI serial murder study",
  METHOD: "Digital evidence field guide",
  CHURCH: "Church page, archived 2005-02-06",
  VIDEO_UNT: "KXAS news clip (UNT archive)",
  CAPTIONS_UNT: "UNT automated captions",
};
const shortName = (id: string) => SHORT[id] ?? SOURCES_BY_ID.get(id)?.title ?? id;

const TIMELINE_SHORT: Record<string, string> = {
  T01: "Otero case",
  T02: "Bright case",
  T03: "1974 letter",
  T04: "Vian case",
  T05: "Fox case",
  T06: "Hedge case",
  T07: "Wegerle case",
  T08: "Davis case",
  T09: "Letters resume",
  T10: "Lab links 3 cases",
  T11: "Other lead cleared",
  T12: "Q184 DNA negative",
  T13: "Store video (SUV)",
  T14: "Church page archived",
  T15: "Disk mailed to KSAS",
  T16: "Family reference",
  T17: "Arrest, swabs",
  T18: "Arrest announced",
  T19: "Complaint filed",
  T20: "Arraignment clip",
  T21: "Pleas accepted",
  T22: "Sentencing begins",
  T23: "Sentences imposed",
  T24: "Judgment filed",
};

function laneOf(id: string): Lane {
  if (["T01", "T02", "T04", "T05", "T06", "T07", "T08"].includes(id)) return "incidents";
  if (id >= "T19") return "court";
  return "investigation";
}

// Evenly spaced slots on the 0-90 axis, one per timeline entry, in date order.
const events = analysis.events;
const STEP = 86 / Math.max(1, events.length - 1);
const HALF = STEP / 2 - 0.05;
const slot = (i: number) => 2 + i * STEP;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateLabel(date: string, precision = "day"): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!m) return String(y);
  if (precision === "month" || !d) return `${MONTHS[m - 1]} ${y}`;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

function nearestEvent(t: number) {
  const i = Math.max(0, Math.min(events.length - 1, Math.round((t - 2) / STEP)));
  return events[i]!;
}

/** The date at a point on the axis (the nearest entry's date). */
export function btkAxisLabel(t: number): string {
  const e = nearestEvent(t);
  return dateLabel(e.date, e.precision);
}

/** Tick labels (every 10 on the axis): the nearest entry's year, shown where the year changes. */
export function btkTickLabel(t: number): string {
  const year = nearestEvent(t).date.slice(0, 4);
  return t >= 10 && nearestEvent(t - 10).date.slice(0, 4) === year ? "" : year;
}

function pdfLink(src: PacketSource | undefined, page?: number): string | null {
  if (!src) return null;
  const base = (src as PacketSource & { acquisition_url?: string }).acquisition_url?.endsWith("/file")
    ? (src as PacketSource & { acquisition_url?: string }).acquisition_url!
    : src.url;
  return page && /\.pdf|\/file$|-pdf$/.test(base) ? `${base.split("#")[0]}#page=${page}` : base;
}

const where = (x: CheckedCitation) =>
  x.page ? `${shortName(x.source)}, PDF p.${x.page}${x.pageEnd ? `–${x.pageEnd}` : ""}` : shortName(x.source);

/** Cut at a word boundary, with an ellipsis when shortened. */
function wordCut(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max + 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 12)).replace(/[,;:\s]+$/, "")}…`;
}

function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/);
  return (m ? m[0] : s).trim();
}

// Rendered page images (public/pages/btk) exist for the investigative and court pages only.
const PAGE_IMAGES = new Set([
  "complaint-p1", "complaint-p2", "complaint-p3", "complaint-p4", "complaint-p5", "disposition-p1",
  "disposition-p2", "fbi_case_study-p50", "judgment-p1", "judgment-p2", "judgment-p3", "judgment-p4",
  "plea-p74", "plea_minute-p1", "rcfl-p13", "state-p28", "state-p42", "state-p43", "state-p44",
  "state-p45", "state-p46", "valadez-p4", "valadez-p5", "vault-p11", "vault-p110", "vault-p111",
  "vault-p114", "vault-p115",
]);
function pageImage(x: CheckedCitation | undefined) {
  if (!x?.page) return undefined;
  const key = `${x.source.toLowerCase()}-p${x.page}`;
  if (!PAGE_IMAGES.has(key)) return undefined;
  const file = SOURCES_BY_ID.get(x.source)?.path?.split("/").pop() ?? x.source;
  return { src: `/pages/btk/${key}.jpg`, page: x.page, file };
}

/** Local copies of packet videos under public/media (git-ignored: third-party broadcast rights). */
const LOCAL_CLIPS: Record<string, string> = {
  VIDEO_UNT: "/media/btk-kxas-arraignment-2005-05-03.mp4",
};
function clipFor(cits: CheckedCitation[]) {
  const id = cits.map((x) => x.source).find((sid) => LOCAL_CLIPS[sid]);
  return id ? { src: LOCAL_CLIPS[id]!, file: SOURCES_BY_ID.get(id)?.path?.split("/").pop() ?? id } : undefined;
}

/** Cross-check findings that passed the quote check, the second check and any review. */
const verifiedFindings = (analysis.findings ?? []).filter((f) => f.status === "verified");

const obsById = new Map(analysis.observations.map((o) => [o.id, o]));
const itemId = (eventId: string) => `btk-${eventId}`;

function statusLine(cits: CheckedCitation[]): string {
  const passed = cits.filter((x) => x.status === "passed" || x.status === "partial");
  const open = cits.filter((x) => x.status === "unchecked" || x.status === "failed");
  const parts: string[] = [];
  if (passed.length) parts.push(`Quote found on the cited page: ${passed.map(where).join("; ")}.`);
  if (open.length)
    parts.push(
      `Not verified: ${open.map((x) => `${where(x)}${x.status === "unchecked" ? " (no text in the packet)" : " (no matching quote found)"}`).join("; ")}.`,
    );
  return parts.join(" ");
}

function buildItems(): TimelineItem[] {
  const items: TimelineItem[] = events.map((e, i) => {
    const obs = e.evidenceIds.map((id) => obsById.get(id)).filter((o) => !!o);
    const lead = obs.find((o) => o.status === "verified") ?? obs[0];
    const cits = e.citations;
    const quote = [...cits, ...(lead?.citations ?? [])].flatMap((x) => x.quotes)[0];
    const primary = cits.find((x) => x.quotes.length) ?? cits[0];
    const image = pageImage(cits.find((x) => pageImage(x))) ?? pageImage(lead?.citations.find((x) => pageImage(x)));
    const date = `${dateLabel(e.date, e.precision)}${e.endDate ? ` to ${dateLabel(e.endDate)}` : ""}`;
    const text = [
      `${e.event} (${date}).`,
      lead && laneOf(e.id) !== "incidents" ? firstSentence(lead.description) : "",
      quote ? `The record reads: “${quote.text}”` : "",
      statusLine(cits),
      lead?.limitation ? `Limitation: ${lead.limitation}` : "",
      e.dateNote ?? "",
    ]
      .filter(Boolean)
      .join(" ");
    return {
      id: itemId(e.id),
      lane: laneOf(e.id),
      start: Math.max(0, slot(i) - HALF),
      end: Math.min(90, slot(i) + HALF),
      label: e.event,
      ...(TIMELINE_SHORT[e.id] ? { short: TIMELINE_SHORT[e.id]! } : {}),
      extractedText: text,
      sourceLink: pdfLink(SOURCES_BY_ID.get(primary?.source ?? ""), primary?.page),
      sourceLabel: primary ? where(primary) : "Packet",
      status: "filed",
      flag: "agrees",
      ...(image ? { page: image } : {}),
      ...(clipFor(cits) ? { clip: clipFor(cits)! } : {}),
    };
  });

  // Records the packet lists as not located, at the first entry that relies on them.
  analysis.gaps.forEach((g, n) => {
    const at = events.findIndex((e) => e.evidenceIds.some((id) => g.evidenceIds.includes(id)));
    const i = at >= 0 ? at : events.length - 1;
    const note =
      n === 0
        ? " The sources describe this artifact differently (the State’s filing: document properties; the FBI field office history: a deleted file). That history page is an external link with no text in the packet, so the difference is not checked."
        : "";
    items.push({
      id: `btk-gap-${n + 1}`,
      lane: "gaps",
      start: Math.max(0, slot(i) - HALF),
      end: Math.min(90, slot(i) + HALF),
      label: `Not in the packet: ${g.artifact}`,
      short: wordCut(g.artifact.split(/[,(]/)[0]!, 26),
      extractedText: `The packet lists this as ${g.availability.replace(/_/g, " ")}: ${g.artifact}. Needed for: ${g.why}${note} Request through the Sedgwick County court records office or Wichita Police records, case 05 CR 498.`,
      sourceLink: null,
      sourceLabel: "Not in the packet",
      status: "filed",
      flag: "missing",
      relatedId: itemId(events[i]!.id),
    });
  });
  return items;
}

function buildConversation(items: TimelineItem[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  const add = (m: Omit<ChatMessage, "id">) => out.push({ ...m, id: `b${out.length + 1}` });
  const has = (id: string) => items.some((i) => i.id === id);
  const firstQuote = (oid: string, source?: string) =>
    obsById.get(oid)?.citations.find((x) => (!source || x.source === source) && x.quotes.length)?.quotes[0];

  const disk = firstQuote("B-001", "STATE");
  if (has("btk-T15")) {
    add({ from: "team", attachment: "document", text: "State’s Summary of the Evidence, PDF p.42", preview: "/pages/btk/state-p42.jpg", itemId: "btk-T15" });
    add({
      from: "agent",
      text: `AI finding: Filed. The filing describes KSAS receiving the February 16, 2005 mailing with the diskette${disk ? `: “${disk.text}”` : "."} The quote was found on PDF p.42; the RCFL annual report (PDF p.13) describes the same mailing.`,
      itemId: "btk-T15",
    });
  }
  const props = firstQuote("B-002", "STATE");
  if (props && has("btk-gap-1")) {
    add({
      from: "agent",
      text: `AI finding: The filing reports what the examiner saw in the file’s properties: “${props.text}” Possible gap: the disk image and the file’s bytes are not in the packet, so where those words sat in the disk data cannot be checked.`,
      itemId: "btk-gap-1",
    });
  }
  if (has("btk-T14")) {
    add({ from: "team", attachment: "document", text: "Christ Lutheran Church page, archived Feb 6, 2005", itemId: "btk-T14" });
    add({
      from: "agent",
      text: "AI finding: Filed. The archived page lists “President: Dennis Rader” under the congregation council officers; the capture predates the mailing. On its own this names a church officer; it does not identify who edited the document or sent it.",
      itemId: "btk-T14",
    });
  }
  const a = analysis.attribution;
  const kinds = [
    a.streams.some((s) => s.evidenceIds.some((id) => ["B-006", "B-007", "B-008"].includes(id))) && "DNA comparisons described in the State’s filing (B-006 to B-008)",
    a.streams.some((s) => s.evidenceIds.includes("B-010")) && "the recorded interview (B-010)",
    a.streams.some((s) => s.evidenceIds.includes("B-016")) && "the accepted pleas (B-016)",
    a.streams.some((s) => s.evidenceIds.includes("B-017")) && "the sentence (B-017)",
  ].filter(Boolean);
  add({
    from: "agent",
    text: `AI finding: Attribution test from the packet. With the disk-metadata lead turned off (${a.disabled.join(", ")}), ${a.streams.length} links in the packet graph still connect the record to Rader, through ${kinds.join(", ")}. ${a.lost.length} links drop out. The DNA links rest on the filing’s description; the signed lab reports are not in the packet.`,
    ...(has("btk-T17") ? { itemId: "btk-T17" } : {}),
  });
  const plea = firstQuote("B-016", "PLEA");
  if (has("btk-T21")) {
    add({ from: "team", attachment: "document", text: "Plea transcript, PDF p.74", preview: "/pages/btk/plea-p74.jpg", itemId: "btk-T21" });
    add({
      from: "agent",
      text: `AI finding: Filed. The court record and the judgment agree on the June 27, 2005 plea hearing${plea ? `. The transcript reads: “${plea.text}”` : "."} This is the court’s record, not a finding of ours.`,
      itemId: "btk-T21",
    });
  }
  for (const f of verifiedFindings)
    add({
      from: "agent",
      text: `${/Corrected in review/.test(f.check ?? "") ? "Reviewed finding" : "AI finding"}: ${f.kind === "conflict" ? "Possible conflict" : "Sources agree"}: ${f.explanation} Sources: ${f.cites.map((q) => `${shortName(q.source)}, PDF p.${q.page}`).join("; ")}.`,
    });
  for (const r of analysis.recordChecks ?? []) add({ from: "agent", text: `AI finding: Records check. ${r.title}: ${r.detail}` });
  const derived = analysis.derivedChecks ?? [];
  if (derived.length)
    add({
      from: "agent",
      text: `AI finding: The page images cut from the filings match their pages (${derived.map((d) => `${d.id} ${Math.round(d.share * 100)}% on ${shortName(d.parent)} p.${d.page}`).join("; ")}). The two photos of a person were not analyzed: faces are not compared.`,
    });
  const n = (s: string) => analysis.observations.filter((o) => o.status === s).length;
  const open = analysis.observations.filter((o) => o.status === "unverified").map((o) => o.id);
  add({
    from: "agent",
    text: `AI finding: Citation check done. ${n("verified")} of ${analysis.observations.length} observations have a quote found on the cited page, ${n("partial")} only partly${open.length ? `, and ${open.length} could not be checked (${open.join(", ")}: no text or copy in the packet)` : ""}. No contradiction between the packet's own sources survived the checks. Confirm before use.`,
  });
  return out;
}

function sourceKind(s: PacketSource): Source["kind"] {
  if (s.type.includes("video") || s.type.includes("footage")) return "video";
  return "document";
}

/** Sources for Case Analysis: each document shows the verified quotes from its cited pages. */
function buildSources(itemsByQuote: Map<string, string>): Source[] {
  const quotesBySource = new Map<string, Map<number, Set<string>>>();
  for (const x of [...analysis.observations, ...analysis.events].flatMap((o) => o.citations))
    for (const q of x.quotes) {
      const pages = quotesBySource.get(x.source) ?? new Map<number, Set<string>>();
      const set = pages.get(q.page) ?? new Set<string>();
      set.add(q.text);
      pages.set(q.page, set);
      quotesBySource.set(x.source, pages);
    }
  // Quotes behind the cross-check findings and the records checks, found on their pages in code.
  for (const q of [...verifiedFindings.flatMap((f) => f.cites), ...(analysis.recordChecks ?? [])]) {
    const pages = quotesBySource.get(q.source) ?? new Map<number, Set<string>>();
    const set = pages.get(q.page) ?? new Set<string>();
    set.add(q.quote);
    pages.set(q.page, set);
    quotesBySource.set(q.source, pages);
  }
  const n = (s: string) => analysis.observations.filter((o) => o.status === s).length;
  const summary: Source = {
    id: "summary",
    kind: "summary",
    title: "Case summary",
    meta: "Prepared overview",
    subtitle: "Paraphrased from the packet and its sources. Not original text.",
    provenance: "paraphrase",
    available: true,
    url: null,
    blocks: [
      {
        paragraphs: [
          { id: "s1", label: "¶1", text: `${c.title}, ${c.case_number}, ${c.jurisdiction}. A historical public record.` },
          { id: "s2", label: "¶2", text: `The packet’s question: ${c.question}` },
          {
            id: "s3",
            label: "¶3",
            text: `Citation check: ${n("verified")} of ${analysis.observations.length} observations have a quote found on the cited page; ${n("partial")} partly; ${n("unverified")} have no checkable text in the packet.`,
          },
          {
            id: "s4",
            label: "¶4",
            text: `Attribution test: with the disk-metadata lead turned off, ${analysis.attribution.streams.length} links in the packet graph remain and ${analysis.attribution.lost.length} drop out.`,
          },
          {
            id: "s5",
            label: "¶5",
            text: `Cross-check of all texts in the packet: ${verifiedFindings.filter((f) => f.kind === "conflict").length} possible conflicts and ${verifiedFindings.filter((f) => f.kind === "agrees").length} agreements survived the quote and second checks; ${(analysis.findings ?? []).filter((f) => f.status === "dropped").length} suggested findings were dropped.`,
          },
          ...(analysis.recordChecks ?? []).map((r, i) => ({ id: `r${i + 1}`, label: "Record", text: `${r.title}: ${r.detail}` })),
          ...(analysis.derivedChecks ?? []).map((d, i) => ({
            id: `d${i + 1}`,
            label: "Image",
            text: `${d.id}: ${Math.round(d.share * 100)}% of the words read from this page image are on ${d.parent} PDF p.${d.page}, the page it was cut from (${d.status === "passed" ? "it matches" : "it does not match"}).`,
          })),
          ...(analysis.notAnalyzed ?? [])
            .filter((x) => x.id.startsWith("PHOTO_"))
            .map((x, i) => ({ id: `na${i + 1}`, label: "Not analyzed", text: `${x.id}: ${x.why}` })),
          ...analysis.hypotheses.map((h, i) => ({
            id: `h${i + 1}`,
            label: h.id,
            text: `${h.statement} Packet status: ${h.status.replace(/_/g, " ")}. ${h.limitation}`,
          })),
        ],
      },
    ],
  };
  const docs = c.sources
    .filter((s) => s.availability === "included" && !s.id.startsWith("SCAN_") && !s.id.startsWith("PHOTO_"))
    .map((s): Source => {
      const pages = [...(quotesBySource.get(s.id) ?? new Map<number, Set<string>>()).entries()].sort((a, b) => a[0] - b[0]);
      const ocr = ["STATE", "VAULT", "COMPLAINT", "JUDGMENT", "DISPOSITION", "PLEA_MINUTE"].includes(s.id);
      return {
        id: s.id,
        kind: sourceKind(s),
        title: SHORT[s.id] ?? s.title,
        meta: s.pages ? `${s.pages} pages · ${pages.length} cited with checked quotes` : s.type.replace(/_/g, " "),
        subtitle: `${s.title}. ${s.origin}. ${s.note ?? ""}`.trim(),
        provenance: "public-record",
        available: pages.length > 0 || !!LOCAL_CLIPS[s.id],
        url: pdfLink(s),
        ...(LOCAL_CLIPS[s.id] ? { localVideo: LOCAL_CLIPS[s.id]! } : {}),
        blocks: pages.map(([page, quotes]) => ({
          heading: s.id === "CHURCH" ? "Congregation council officers" : `PDF page ${page}`,
          paragraphs: [...quotes].map((q, k): Paragraph => {
            const id = `p${page}-${k + 1}`;
            const owner = itemsByQuote.get(q);
            return { id, label: s.id === "CHURCH" ? "HTML" : `p.${page}`, text: q, ...(owner ? { marks: [{ phrase: q, itemId: owner }] } : {}) };
          }),
          ...(ocr ? { note: "Checked against OCR of the scan. Look at the scan before quoting." } : {}),
        })),
      };
    });
  const external = c.sources
    .filter((s) => s.availability === "external_link")
    .map(
      (s): Source => ({
        id: s.id,
        kind: sourceKind(s),
        title: s.title,
        meta: "External link · not in the packet",
        subtitle: `${s.origin}. ${s.note ?? ""}`.trim(),
        provenance: "public-record",
        available: false,
        url: s.url,
      }),
    );
  return [summary, ...docs, ...external];
}

const ENTITY_IDS: { id: string; type: Entity["type"]; role: string; mentions: string[] }[] = [
  { id: "RADER", type: "Person", role: "Defendant, 05 CR 498", mentions: ["Dennis L. Rader", "Dennis Rader", "Rader"] },
  { id: "KSAS", type: "Organization", role: "TV station that received the February 2005 mailing", mentions: ["KSAS"] },
  { id: "WPD", type: "Organization", role: "Investigating agency", mentions: ["Wichita Police", "Detective"] },
  { id: "KBI", type: "Organization", role: "State laboratory (family reference comparison)", mentions: ["KBI"] },
  { id: "FBI_LAB", type: "Organization", role: "FBI Laboratory (Q184 report)", mentions: ["FBI", "Laboratory"] },
  { id: "CHURCH_ENTITY", type: "Organization", role: "Named in the reported document properties", mentions: ["Christ Lutheran", "Lutheran"] },
  { id: "COURT", type: "Organization", role: "Eighteenth Judicial District Court", mentions: ["Judicial District", "District Court"] },
  { id: "EAGLE", type: "Organization", role: "Newspaper that passed on the 2004 correspondence", mentions: ["Eagle"] },
];

function buildEntities(sources: Source[]): Entity[] {
  const paras = sources.flatMap((s) => (s.blocks ?? []).flatMap((b) => b.paragraphs.map((p) => ({ source: s.id, p }))));
  return ENTITY_IDS.map((e) => ({
    name: c.entities.find((x) => x.id === e.id)?.label ?? e.id,
    type: e.type,
    role: e.role,
    mentions: e.mentions,
    cites: paras
      .filter(({ source, p }) => source !== "summary" && e.mentions.some((m) => p.text.includes(m)))
      .slice(0, 4)
      .map(({ source, p }) => ({ source, para: p.id })),
  })).filter((e) => e.cites.length > 0);
}

export interface BtkCase {
  /** Cross-check findings that survived every check, for the Flag step. */
  findings: { id: string; kind: "conflict" | "agrees"; title: string; explanation: string; reviewed?: string }[];
  findingCitations: Record<string, Citation[]>;
  items: TimelineItem[];
  conversation: ChatMessage[];
  sources: Source[];
  entities: Entity[];
  citations: Record<string, Citation[]>;
  /** Where the Live Case opens: the mailed disk, the case's digital lead. */
  openAt: number;
}

export function buildBtkCase(): BtkCase {
  const items = buildItems();
  // Each verified quote belongs to the first timeline item that cites it.
  const itemsByQuote = new Map<string, string>();
  const citationsFor = new Map<string, CheckedCitation[]>();
  events.forEach((e) => {
    const cits = [...e.citations, ...e.evidenceIds.flatMap((id) => obsById.get(id)?.citations ?? [])];
    citationsFor.set(itemId(e.id), cits);
    for (const q of cits.flatMap((x) => x.quotes)) if (!itemsByQuote.has(q.text)) itemsByQuote.set(q.text, itemId(e.id));
  });
  const sources = buildSources(itemsByQuote);
  const citations: Record<string, Citation[]> = {};
  for (const [id, cits] of citationsFor) {
    const seen = new Set<string>();
    citations[id] = cits.flatMap((x): Citation[] => {
      const src = sources.find((s) => s.id === x.source);
      const paras = (src?.blocks ?? []).flatMap((b) => b.paragraphs);
      const hits = x.quotes.map((q) => paras.find((p) => p.text === q.text)).filter((p) => !!p);
      const list: Citation[] = hits.length ? hits.map((p) => ({ source: x.source, para: p.id })) : [{ source: x.source }];
      return list.filter((l) => {
        const k = JSON.stringify(l);
        return seen.has(k) ? false : (seen.add(k), true);
      });
    });
  }
  for (const it of items) if (it.lane === "gaps") citations[it.id] = [{ source: "COURT_RECORDS" }, { source: "WPD_RECORDS" }];
  const disk = items.find((i) => i.id === "btk-T15");
  const findingCitations: Record<string, Citation[]> = Object.fromEntries(
    verifiedFindings.map((f) => [
      f.id,
      f.cites.map((q): Citation => {
        const p = sources.find((s) => s.id === q.source)?.blocks?.flatMap((b) => b.paragraphs).find((x) => x.text === q.quote);
        if (p) p.marks = [...(p.marks ?? []).filter((m) => m.phrase !== q.quote), { phrase: q.quote, itemId: `finding:${f.id}` }];
        return p ? { source: q.source, para: p.id } : { source: q.source };
      }),
    ]),
  );
  return {
    findings: verifiedFindings.map((f) => {
      const review = /Corrected in review: (.*)$/.exec(f.check ?? "")?.[1];
      return { id: f.id, kind: f.kind, title: f.title, explanation: f.explanation, ...(review ? { reviewed: review } : {}) };
    }),
    findingCitations,
    items,
    conversation: buildConversation(items),
    sources,
    entities: buildEntities(sources),
    citations,
    openAt: disk ? (disk.start + disk.end) / 2 : 45,
  };
}
