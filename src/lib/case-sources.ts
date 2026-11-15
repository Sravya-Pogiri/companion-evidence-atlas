import type { PublicCase } from "@/lib/case-library";
import { eventId, gapId, sideId } from "@/lib/case-ids";
import type { Citation, Entity, Paragraph, Source } from "@/lib/sources";

// The documents, citations and entities the Case Analysis tab reads for a public-record case.
// Everything is built from that case's data and nothing else: the summary and timeline text, and
// each side of every contradiction the public sources describe, as a short "statement" document.
// None of it is original court text, and each document says so.

export interface SourceBundle {
  sources: Source[];
  itemCitations: Record<string, Citation[]>;
  entities: Entity[];
  /** What the tab opens on: a document, and the finding in focus. */
  home: { sourceId: string; focusId: string | null };
}

const para = (
  id: string,
  label: string,
  text: string,
  extra: Partial<Paragraph> = {},
): Paragraph => ({
  id,
  label,
  text,
  ...extra,
});

/** What introduces the open prompts. A case's own note counts only when it is about the checklist. */
export function promptIntro(c: PublicCase): string {
  if (c.checklist.length > 0 && c.note && /\bgeneric\b|\bnot a claim\b/i.test(c.note))
    return c.note;
  return "Questions the public sources leave open. Each is a prompt for the team, not a finding.";
}

export function sideSourceId(caseId: string, finding: number, side: number): string {
  return sideId(caseId, finding, side);
}

export function buildBundle(c: PublicCase): SourceBundle {
  const note = "Summarized from the linked public sources. Not original text.";

  // ----- the case summary -----
  const summary: Source = {
    id: "summary",
    kind: "summary",
    title: "Case summary",
    meta: "Prepared overview",
    subtitle: `Paraphrased from ${c.primarySource.label}. Not original text.`,
    provenance: "paraphrase",
    available: true,
    url: c.primarySource.url,
    blocks: [
      {
        paragraphs: [para("s1", "¶1", c.overview), para("s2", "¶2", c.summary)],
      },
      {
        heading: "Key facts",
        paragraphs: c.facts.map(([k, v], i) => para(`f${i + 1}`, `¶${i + 3}`, `${k}: ${v}`)),
      },
    ],
  };

  // ----- the dated timeline -----
  const timeline: Source = {
    id: "timeline",
    kind: "document",
    title: "Timeline of events",
    meta: "Dated, in order",
    subtitle: `Events in order, as summarized by ${c.timelineSource.label}. Not original text.`,
    provenance: "paraphrase",
    available: true,
    url: c.timelineSource.url,
    blocks: [
      {
        paragraphs: c.timeline.map((t, i) =>
          para(`t${i + 1}`, `¶${i + 1}`, `${t.date}. ${t.text}`),
        ),
      },
    ],
  };

  // ----- one short statement document per side of each contradiction -----
  const sideSources: Source[] = c.findings.flatMap((f, fi) =>
    f.sides.map((side, si): Source => {
      const itemId = sideId(c.id, fi + 1, si);
      return {
        id: sideSourceId(c.id, fi + 1, si),
        kind: "document",
        title: side.label,
        meta: side.cite,
        subtitle: `A statement as summarized by ${c.primarySource.label}. ${note}`,
        provenance: "paraphrase",
        available: true,
        url: c.primarySource.url,
        blocks: [
          {
            ...(f.title
              ? { note: `Compared in the finding “${f.title.replace(/\.$/, "")}”.` }
              : {}),
            paragraphs: [para("p1", "¶1", side.text, { marks: [{ phrase: side.text, itemId }] })],
          },
        ],
      };
    }),
  );

  // ----- the open prompts -----
  const prompts = c.checklist.length > 0 ? c.checklist : c.questions;
  const promptSource: Source = {
    id: "prompts",
    kind: "document",
    title: c.checklistTitle ?? "Open questions for the defense team",
    meta: "Prompts, not findings",
    subtitle: promptIntro(c),
    provenance: "paraphrase",
    available: true,
    url: c.primarySource.url,
    blocks: [{ paragraphs: prompts.map((q, i) => para(`q${i + 1}`, `${i + 1}`, q)) }],
  };

  const sources = [summary, timeline, ...sideSources, promptSource];

  // ----- where each item is found -----
  const itemCitations: Record<string, Citation[]> = {};
  c.timeline.forEach((_, i) => {
    itemCitations[eventId(c.id, i + 1)] = [{ source: "timeline", para: `t${i + 1}` }];
  });
  c.findings.forEach((f, fi) => {
    f.sides.forEach((_, si) => {
      const own: Citation = { source: sideSourceId(c.id, fi + 1, si), para: "p1" };
      const other: Citation = {
        source: sideSourceId(c.id, fi + 1, si === 0 ? 1 : 0),
        para: "p1",
      };
      itemCitations[sideId(c.id, fi + 1, si)] = si === 1 ? [own] : [own, other];
    });
  });
  itemCitations[gapId(c.id)] = [{ source: "prompts", para: "q1" }];

  // ----- people, places and dates that literally appear in the texts -----
  const allParas = sources.flatMap((s) =>
    (s.blocks ?? []).flatMap((b) => b.paragraphs.map((p) => ({ source: s.id, p }))),
  );
  const firstCite = (phrase: string): Citation | null => {
    const hit = allParas.find(({ p }) => p.text.includes(phrase));
    return hit ? { source: hit.source, para: hit.p.id } : null;
  };
  const present = (phrases: string[]) => phrases.filter((ph) => firstCite(ph) !== null);

  const entities: Entity[] = [];
  const surname = c.name.split(" ").slice(-1)[0] ?? c.name;
  const person = present([c.name, surname]);
  if (person.length > 0) {
    entities.push({
      name: c.name,
      type: "Person",
      role: "Subject of this public-record case",
      mentions: person,
      cites: person
        .map(firstCite)
        .filter((x): x is Citation => x !== null)
        .slice(0, 2),
    });
  }
  const placeWords = present([c.location, ...c.location.split(", ")]);
  if (placeWords.length > 0) {
    entities.push({
      name: c.location,
      type: "Place",
      role: "Location given in the public record",
      mentions: placeWords,
      cites: placeWords
        .map(firstCite)
        .filter((x): x is Citation => x !== null)
        .slice(0, 2),
    });
  }
  c.timeline.forEach((t, i) => {
    if (!/\b(19|20)\d{2}\b/.test(t.date)) return;
    entities.push({
      name: t.date,
      type: "Date",
      role: t.text.split(/(?<=[.!?])\s/)[0] ?? t.text,
      mentions: [t.date],
      cites: [{ source: "timeline", para: `t${i + 1}` }],
    });
  });

  const firstFinding = c.findings.length > 0 ? sideId(c.id, 1, 0) : null;
  return {
    sources,
    itemCitations,
    entities,
    home: { sourceId: firstFinding ? sideSourceId(c.id, 1, 0) : "summary", focusId: firstFinding },
  };
}
