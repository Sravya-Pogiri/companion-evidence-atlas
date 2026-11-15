import { sourceLinks } from "@/lib/case-data";
import { normalizeText } from "@/lib/evidence/verify";
import type { VideoId } from "@/lib/media";
import { ANALYSIS_CLAIMS, BTK, ITEMS, ROSALES_DOC_FINDINGS } from "@/lib/sample-case";
import type { Claim } from "@/lib/evidence/types";

// The sources of the public sample case and the text the workspace shows for them.
// Document text is copied from the public PDFs (complaint page 24; opinion pages 1 and 11),
// joined across line breaks only. The case summary is our own paraphrase and says so.

export type SourceKind = "summary" | "document" | "video" | "audio";

/** A place in a source: a paragraph of a document, or a second of a video. */
export type Citation =
  { source: string; para: string } | { source: string; t: number } | { source: string };

export interface Paragraph {
  id: string;
  /** What the gutter shows, e.g. "¶208". */
  label: string;
  text: string;
  /** Exact phrases in `text` tied to a timeline item. */
  marks?: { phrase: string; itemId: string }[];
  /** Citations shown after a paraphrased paragraph. */
  cites?: Citation[];
}

export interface Block {
  /** A heading inside the document, such as a page marker or section title. */
  heading?: string;
  paragraphs: Paragraph[];
  /** An editor's note that is not part of the source text. */
  note?: string;
}

export interface Source {
  id: string;
  kind: SourceKind;
  title: string;
  /** Short line for the sidebar. */
  meta: string;
  /** Document type and provenance, under the title. */
  subtitle: string;
  /** "public-record" for original text or footage, "paraphrase" for our summary. */
  provenance: "public-record" | "paraphrase";
  available: boolean;
  url: string | null;
  blocks?: Block[];
  video?: VideoId;
  /** A local copy of a video that is not on YouTube (under /public/media). */
  localVideo?: string;
}

const ROSALES_SOURCES: Source[] = [
  {
    id: "summary",
    kind: "summary",
    title: "Case summary",
    meta: "Prepared overview",
    subtitle: "Paraphrased from the public filings below. Not original text.",
    provenance: "paraphrase",
    available: true,
    url: null,
    blocks: [
      {
        paragraphs: [
          {
            id: "s1",
            label: "¶1",
            text: "Mario Rosales and Gracie Lasyone sued Officers Jim Lewis and Samuel Terrell over a traffic stop, claiming violations of their First and Fourth Amendment rights.",
            cites: [{ source: "opinion", para: "p1-2" }],
          },
          {
            id: "s2",
            label: "¶2",
            text: "The officers appealed the denial of their motion for judgment on the pleadings to the Fifth Circuit (No. 25-30650), asserting qualified immunity.",
            cites: [{ source: "opinion", para: "p1-2" }],
          },
          {
            id: "s3",
            label: "¶3",
            text: "This sample follows one question that appears in both filings: whether the Mustang’s left turn signal was on before the turn. The complaint quotes the officer giving failure to signal as the reason for the stop; the opinion describes what the video shows.",
            cites: [
              { source: "complaint", para: "208" },
              { source: "opinion", para: "p11-2" },
            ],
          },
          {
            id: "s4",
            label: "¶4",
            text: "Public dashcam and bodycam footage is linked. No dispatch audio is in the sample record.",
            cites: [{ source: "dashcam", t: 45 }, { source: "dispatch" }],
          },
        ],
      },
    ],
  },
  {
    id: "complaint",
    kind: "document",
    title: "Complaint, page 24",
    meta: "Filed 11/01/22 · ¶205–210",
    subtitle: "No. 1:22-cv-05838 (W.D. La.), Document 1, filed by the plaintiffs. Original text.",
    provenance: "public-record",
    available: true,
    url: sourceLinks.complaint,
    blocks: [
      {
        heading: "Officer Terrell interrogates Mario and prohibits recording.",
        paragraphs: [
          {
            id: "205",
            label: "¶205",
            text: "While Officer Lewis was interrogating Gracie, Officer Terrell was interrogating Mario. But before Officer Terrell began asking Mario questions, Mario asked Officer Terrell if he had Mario’s phone.",
          },
          {
            id: "206",
            label: "¶206",
            text: "Officer Terrell initially said that he did not, but later said he did have Mario’s phone in the police vehicle.",
          },
          {
            id: "207",
            label: "¶207",
            text: "Mario then asked, “So, can you be honest with me? Why am I being stopped?”",
          },
          {
            id: "208",
            label: "¶208",
            text: "Officer Terrell responded, “Failure to signal. That’s straight, pure and straight honest answer. You failed to signal, so we stopped you. And we’re just talking to people after we stop them, okay. That’s all it is, okay. So I don’t know what all he talked to you about. I will probably have some of the same questions.”",
            marks: [{ phrase: "Failure to signal.", itemId: "complaint-reason" }],
          },
          {
            id: "209",
            label: "¶209",
            text: "Officer Terrell asked Mario about where he lives. Mario reiterated what he had told Officer Lewis.",
          },
          {
            id: "210",
            label: "¶210",
            text: "Meanwhile, Officer Lewis was once again peering into Mario’s car:",
          },
        ],
        note: "A photograph follows in the original and is not reproduced here.",
      },
    ],
  },
  {
    id: "opinion",
    kind: "document",
    title: "Fifth Circuit opinion",
    meta: "No. 25-30650 · pp. 1, 11",
    subtitle: "No. 25-30650 (5th Cir.), per curiam, not designated for publication. Original text.",
    provenance: "public-record",
    available: true,
    url: sourceLinks.opinion,
    blocks: [
      {
        heading: "Page 1",
        paragraphs: [
          {
            id: "p1-1",
            label: "¶1",
            text: "Mario Rosales; Gracie Lasyone, Plaintiffs—Appellees, versus Jim Lewis, sued in his individual and official capacity; Samuel Terrell, sued in his individual and official capacity, Defendants—Appellants.",
          },
          {
            id: "p1-2",
            label: "¶2",
            text: "Officers Jim Lewis and Samuel Terrell appeal the denial of their motion for judgment on the pleadings, asserting entitlement to qualified immunity from claims that they violated the First and Fourth Amendment rights of Mario Rosales and Gracie Lasyone during a traffic stop. We AFFIRM in part and REVERSE in part.",
          },
        ],
      },
      {
        heading: "Page 11",
        paragraphs: [
          {
            id: "p11-1",
            label: "¶3",
            text: "… to pull [the Mustang] over” because they had no “particularized and objective basis to suspect [Appellees] of criminal activity.” The complaint also asserts that Officers “concoct[ed] a baseless traffic infraction after the fact to support their actions,” and issued Rosales an “invalid traffic ticket.” These alleged facts, coupled with the “video depictions” that must be viewed “in the light most favorable to [Appellees],” support a reasonable inference that Rosales changed lanes legally.",
          },
          {
            id: "p11-2",
            label: "¶4",
            text: "As for the left turn shortly before Officers initiated the traffic stop, Appellees allege that Rosales used his blinker to indicate a left turn and “legally turned left” at an intersection. Although the complaint does not explicitly state that the left turn was signaled at least 100 feet before the turn, again, it may be reasonably inferred from these allegations that Rosales used his turn signal to execute a “legal” left turn and that Officers fabricated a traffic violation. This version of events is not “‘blatantly contradicted’ by the video recording.” It shows Officers pull behind the Mustang as it approached an intersection, and the left turn signal was already activated as the Mustang’s lights come into view. It is not clear from the video when Rosales activated the signal—i.e., whether it was activated at least one hundred feet before the turn. But we view the video “in the light most favorable to the [Appellees],” which supports the inference that the left turn signal was activated in accordance with Louisiana law.",
            marks: [
              {
                phrase:
                  "the left turn signal was already activated as the Mustang’s lights come into view",
                itemId: "opinion-signal",
              },
              {
                phrase:
                  "It is not clear from the video when Rosales activated the signal—i.e., whether it was activated at least one hundred feet before the turn.",
                itemId: "activation-missing",
              },
            ],
          },
        ],
        note: "Case citations within ¶3 and ¶4 and footnote 7 are omitted here; open the source for the full page.",
      },
    ],
  },
  {
    id: "dashcam",
    kind: "video",
    title: "Patrol dashcam",
    meta: "Video · approach and turn",
    subtitle: "Public video of the stop, from the patrol car’s dashboard camera.",
    provenance: "public-record",
    available: true,
    url: sourceLinks.dashcam,
    video: "dashcam",
  },
  {
    id: "bodycam",
    kind: "video",
    title: "Officer bodycam",
    meta: "Video · after the stop",
    subtitle: "Public video from the officer’s body-worn camera. Starts after the stop.",
    provenance: "public-record",
    available: true,
    url: sourceLinks.bodycam,
    video: "bodycam",
  },
  {
    id: "dispatch",
    kind: "audio",
    title: "Dispatch audio",
    meta: "Not in the record",
    subtitle: "No dispatch recording is linked for this sample case.",
    provenance: "public-record",
    available: false,
    url: null,
  },
];

/** Where each sample timeline item is found. Items filed from messages cite the message. */
const SAMPLE_CITATIONS: Record<string, Citation[]> = {
  "dashcam-approach": [{ source: "dashcam", t: 45 }],
  "turn-left": [{ source: "dashcam", t: 58 }],
  "bodycam-after-stop": [{ source: "bodycam", t: 80 }],
  "complaint-reason": [
    { source: "complaint", para: "208" },
    { source: "dashcam", t: 45 },
  ],
  "opinion-signal": [{ source: "opinion", para: "p11-2" }],
  "activation-missing": [{ source: "opinion", para: "p11-2" }],
  "dispatch-missing": [{ source: "dispatch" }],
};

/**
 * Citations for items from the evidence analysis: video claims cite their second; document
 * claims cite the paragraph shown in the viewer that contains the verified quote (and mark the
 * quote there), or the document as a whole when the viewer does not include that passage.
 */
function analysisCitations(): Record<string, Citation[]> {
  const out: Record<string, Citation[]> = {};
  for (const [itemId, claims] of Object.entries(ANALYSIS_CLAIMS)) {
    out[itemId] = claims.map((c): Citation => {
      if ("t" in c.at) return { source: c.at.source, t: c.at.t };
      const quote = c.exactQuote ?? "";
      const paragraphs = ROSALES_SOURCES.find((s) => s.id === c.at.source)?.blocks?.flatMap((b) => b.paragraphs) ?? [];
      const hit = quote ? paragraphs.find((p) => normalizeText(p.text).includes(normalizeText(quote))) : undefined;
      if (!hit) return { source: c.at.source };
      if (hit.text.includes(quote)) hit.marks = [...(hit.marks ?? []), { phrase: quote, itemId }];
      return { source: c.at.source, para: hit.id };
    });
  }
  // A missing record cites the referenced-but-absent source when the viewer lists it.
  for (const item of ITEMS) {
    const id = item.id.startsWith("missing-") ? item.id.slice("missing-".length) : null;
    if (id && ROSALES_SOURCES.some((s) => s.id === id)) out[item.id] = [{ source: id }];
  }
  return out;
}

/**
 * Verified quotes from the analysis that the hand-copied pages above do not include: each is
 * added to its document as its own passage under "Page N", so every citation can open it.
 * Complaint passages keep their paragraph number; opinion passages are labelled by page.
 */
function addVerifiedQuotes(claims: Claim[]): void {
  for (const c of claims) {
    if (!("page" in c.at) || !c.exactQuote) continue;
    const src = ROSALES_SOURCES.find((s) => s.id === c.at.source);
    if (!src?.blocks) continue;
    const all = src.blocks.flatMap((b) => b.paragraphs);
    if (all.some((p) => normalizeText(p.text).includes(normalizeText(c.exactQuote!)))) continue;
    const page = c.at.page;
    const para = c.at.paragraph;
    const id = src.id === "complaint" && para && !all.some((p) => p.id === String(para)) ? String(para) : `p${page}-${c.id}`;
    if (all.some((p) => p.id === id)) continue;
    const heading = `Page ${page} (verified quote)`;
    let block = src.blocks.find((b) => b.heading === heading);
    if (!block) {
      block = { heading, paragraphs: [], note: "A passage the analysis quoted and found on this page. The rest of the page is in the original." };
      src.blocks.push(block);
    }
    block.paragraphs.push({ id, label: src.id === "complaint" && para ? `¶${para}` : `p.${page}`, text: c.exactQuote });
  }
}
if (!BTK) addVerifiedQuotes([...Object.values(ANALYSIS_CLAIMS).flat(), ...ROSALES_DOC_FINDINGS.flatMap((f) => f.claims)]);

/** Where each document-only finding's claims are, for clickable citation chips. */
export const DOC_FINDING_CITATIONS: Record<string, Citation[]> = BTK ? BTK.findingCitations : Object.fromEntries(
  ROSALES_DOC_FINDINGS.map((f) => [
    f.id,
    f.claims.map((c): Citation => {
      const paragraphs = ROSALES_SOURCES.find((s) => s.id === c.at.source)?.blocks?.flatMap((b) => b.paragraphs) ?? [];
      const hit = c.exactQuote ? paragraphs.find((p) => normalizeText(p.text).includes(normalizeText(c.exactQuote!))) : undefined;
      if (hit && c.exactQuote && hit.text.includes(c.exactQuote)) hit.marks = [...(hit.marks ?? []).filter((m) => m.phrase !== c.exactQuote), { phrase: c.exactQuote, itemId: `finding:${f.id}` }];
      return hit ? { source: c.at.source, para: hit.id } : { source: c.at.source };
    }),
  ]),
);

/** The open case's sources (see active-case.ts). Live bindings: setSourceBundle can replace them. */
const OWN_SOURCES: Source[] = BTK?.sources ?? ROSALES_SOURCES;
const OWN_CITATIONS: Record<string, Citation[]> = BTK ? BTK.citations : { ...SAMPLE_CITATIONS, ...analysisCitations() };
const OWN_HOME = BTK ? { sourceId: "STATE", focusId: null } : { sourceId: "complaint", focusId: "complaint-reason" };
export let SOURCES: Source[] = OWN_SOURCES;
export let ITEM_CITATIONS: Record<string, Citation[]> = OWN_CITATIONS;

export type EntityType = "Person" | "Place" | "Date" | "Organization";

export interface Entity {
  name: string;
  type: EntityType;
  role: string;
  /** Words to mark in the documents while the Extract step is open. */
  mentions: string[];
  cites: Citation[];
}

/** A small index of names that appear in the sample documents, curated by hand. */
const ROSALES_ENTITIES: Entity[] = [
  {
    name: "Mario Rosales",
    type: "Person",
    role: "Plaintiff–appellee; driver of the Mustang",
    mentions: ["Mario Rosales", "Mario", "Rosales"],
    cites: [
      { source: "opinion", para: "p1-1" },
      { source: "complaint", para: "207" },
    ],
  },
  {
    name: "Gracie Lasyone",
    type: "Person",
    role: "Plaintiff–appellee",
    mentions: ["Gracie Lasyone", "Gracie"],
    cites: [
      { source: "opinion", para: "p1-1" },
      { source: "complaint", para: "205" },
    ],
  },
  {
    name: "Samuel Terrell",
    type: "Person",
    role: "Officer; defendant–appellant",
    mentions: ["Samuel Terrell", "Terrell"],
    cites: [
      { source: "opinion", para: "p1-1" },
      { source: "complaint", para: "208" },
    ],
  },
  {
    name: "Jim Lewis",
    type: "Person",
    role: "Officer; defendant–appellant",
    mentions: ["Jim Lewis", "Lewis"],
    cites: [
      { source: "opinion", para: "p1-1" },
      { source: "complaint", para: "210" },
    ],
  },
  {
    name: "An intersection",
    type: "Place",
    role: "Where the left turn was made",
    mentions: ["intersection"],
    cites: [{ source: "opinion", para: "p11-2" }],
  },
  {
    name: "Louisiana",
    type: "Place",
    role: "State law that governs the signal",
    mentions: ["Louisiana"],
    cites: [{ source: "opinion", para: "p11-2" }],
  },
  {
    name: "11/01/22",
    type: "Date",
    role: "Complaint filed",
    mentions: [],
    cites: [{ source: "complaint" }],
  },
  {
    name: "U.S. Court of Appeals for the Fifth Circuit",
    type: "Organization",
    role: "Court that decided the appeal",
    mentions: [],
    cites: [{ source: "opinion", para: "p1-2" }],
  },
];

const OWN_ENTITIES: Entity[] = BTK?.entities ?? ROSALES_ENTITIES;
export let ENTITIES: Entity[] = OWN_ENTITIES;

/** Where the Case Analysis tab opens: a document, and the finding in focus. */
export let HOME: { sourceId: string; focusId: string | null } = OWN_HOME;

/**
 * Show a public-record case's documents (src/lib/case-sources.ts builds them), or this case's
 * own again (null). Used by the dated cases from the landing page's case library.
 */
export function setSourceBundle(
  b: {
    sources: Source[];
    itemCitations: Record<string, Citation[]>;
    entities: Entity[];
    home: { sourceId: string; focusId: string | null };
  } | null,
): void {
  SOURCES = b?.sources ?? OWN_SOURCES;
  ITEM_CITATIONS = b?.itemCitations ?? OWN_CITATIONS;
  ENTITIES = b?.entities ?? OWN_ENTITIES;
  HOME = b?.home ?? OWN_HOME;
}

export function findSource(id: string | undefined): Source | undefined {
  return id ? SOURCES.find((s) => s.id === id) : undefined;
}

export function findParagraph(sourceId: string, paraId: string): Paragraph | undefined {
  return findSource(sourceId)
    ?.blocks?.flatMap((b) => b.paragraphs)
    .find((p) => p.id === paraId);
}

function mmss(t: number): string {
  const s = Math.max(0, Math.round(t));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** The chip text for a citation: "¶208", "p.11 ¶4", "00:45", "Page 24", or "ref". */
export function citationLabel(c: Citation): string {
  const source = findSource(c.source);
  if ("t" in c) return mmss(c.t);
  if ("para" in c) {
    const p = findParagraph(c.source, c.para);
    if (!p) return c.para;
    if (c.source === "opinion") return p.label.startsWith("p.") ? p.label : `p.${c.para.split("-")[0]!.slice(1)} ${p.label}`;
    return p.label;
  }
  if (source && !source.available) return "ref";
  if (c.source === "complaint") return "Page 24";
  return source?.title ?? c.source;
}

export function citationKey(c: Citation): string {
  return `${c.source}:${"para" in c ? c.para : "t" in c ? c.t : ""}`;
}
