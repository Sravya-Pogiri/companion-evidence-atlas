import { beforeEach, describe, expect, it } from "vitest";
import { PUBLIC_CASES } from "@/lib/case-library";
import { buildBundle } from "@/lib/case-sources";
import { getCase, resetCase, selectCase } from "@/lib/case-store";
import { buildItems } from "@/lib/cases";
import { ENTITIES, HOME, SOURCES, findSource, type Citation, type Source } from "@/lib/sources";

const paragraphs = (sources: Source[]) =>
  sources.flatMap((s) => (s.blocks ?? []).flatMap((b) => b.paragraphs.map((p) => ({ s, p }))));
const resolves = (sources: Source[], c: Citation) =>
  "para" in c
    ? paragraphs(sources).some(({ s, p }) => s.id === c.source && p.id === c.para)
    : sources.some((s) => s.id === c.source);

describe.each(PUBLIC_CASES)("Case Analysis documents for $name", (c) => {
  const bundle = buildBundle(c);
  const items = buildItems(c);
  const itemIds = new Set(items.map((i) => i.id));

  it("has a summary, a timeline, a statement per side of each finding, and the open prompts", () => {
    const ids = bundle.sources.map((s) => s.id);
    expect(ids.slice(0, 2)).toEqual(["summary", "timeline"]);
    expect(ids.at(-1)).toBe("prompts");
    expect(new Set(ids).size).toBe(ids.length);
    const sides = c.findings.reduce((n, f) => n + f.sides.length, 0);
    expect(ids).toHaveLength(2 + sides + 1);
  });

  it("keeps the case's own text in the documents, and says they are not original text", () => {
    const text = paragraphs(bundle.sources).map(({ p }) => p.text);
    expect(text).toContain(c.summary);
    for (const t of c.timeline) expect(text.some((x) => x.includes(t.text))).toBe(true);
    for (const s of bundle.sources) {
      expect(s.provenance).toBe("paraphrase");
      expect(s.subtitle).toMatch(
        /Not original text|Each is a prompt|generic disclosure categories/i,
      );
      expect(s.available).toBe(true);
    }
  });

  it("has unique paragraph ids inside each document and no HTML in any text", () => {
    for (const s of bundle.sources) {
      const ps = (s.blocks ?? []).flatMap((b) => b.paragraphs);
      expect(new Set(ps.map((p) => p.id)).size, s.id).toBe(ps.length);
      for (const p of ps) expect(p.text, `${s.id}/${p.id}`).not.toMatch(/<[^>]+>/);
    }
  });

  it("cites every item, and every citation lands on a real document and paragraph", () => {
    for (const i of items) {
      const cites = bundle.itemCitations[i.id];
      expect(cites?.length, i.id).toBeGreaterThan(0);
      for (const cite of cites ?? [])
        expect(resolves(bundle.sources, cite), `${i.id} -> ${JSON.stringify(cite)}`).toBe(true);
    }
    for (const id of Object.keys(bundle.itemCitations)) expect(itemIds.has(id), id).toBe(true);
  });

  it("highlights only words that are really in the paragraph, for items that exist", () => {
    for (const { s, p } of paragraphs(bundle.sources)) {
      for (const m of p.marks ?? []) {
        expect(p.text, `${s.id}/${p.id}`).toContain(m.phrase);
        expect(itemIds.has(m.itemId), m.itemId).toBe(true);
      }
    }
  });

  it("gives every side of a finding a quote, so the comparison cards can show the exact words", () => {
    const marked = new Set(
      paragraphs(bundle.sources).flatMap(({ p }) => (p.marks ?? []).map((m) => m.itemId)),
    );
    for (const i of items.filter((x) => x.id.includes("-f")))
      expect(marked.has(i.id), i.id).toBe(true);
  });

  it("links each flagged comparison to a real counterpart", () => {
    for (const i of items.filter((x) => x.flag === "conflict")) {
      expect(itemIds.has(i.relatedId ?? ""), i.id).toBe(true);
      expect(i.relatedId).not.toBe(i.id);
    }
  });

  it("lists only people, places and dates whose words appear in the documents", () => {
    const all = paragraphs(bundle.sources).map(({ p }) => p.text);
    expect(bundle.entities.length).toBeGreaterThan(0);
    expect(bundle.entities.some((e) => e.type === "Person")).toBe(true);
    for (const e of bundle.entities) {
      expect(e.mentions.length, e.name).toBeGreaterThan(0);
      for (const m of e.mentions)
        expect(
          all.some((t) => t.includes(m)),
          `${e.name}: ${m}`,
        ).toBe(true);
      for (const cite of e.cites) expect(resolves(bundle.sources, cite), e.name).toBe(true);
    }
  });

  it("opens on a real document and the first flagged comparison", () => {
    expect(bundle.sources.some((s) => s.id === bundle.home.sourceId)).toBe(true);
    const focus = items.find((i) => i.id === bundle.home.focusId);
    expect(focus?.flag).toBe("conflict");
  });
});

describe("the Case Analysis documents follow the chosen case", () => {
  beforeEach(() => resetCase());

  it("start as the Rosales documents", () => {
    expect(findSource("complaint")).toBeDefined();
    expect(HOME.sourceId).toBe("complaint");
    expect(ENTITIES.some((e) => e.name === "Mario Rosales")).toBe(true);
  });

  it("switch to a case's own documents and back", () => {
    selectCase("benitez");
    expect(getCase().caseId).toBe("benitez");
    expect(findSource("complaint")).toBeUndefined();
    expect(SOURCES.map((s) => s.id)).toContain("timeline");
    expect(HOME.sourceId).toBe("benitez-f1-s0");
    expect(ENTITIES.some((e) => e.name === "Ricardo Benitez")).toBe(true);

    selectCase("rosales");
    expect(findSource("complaint")).toBeDefined();
    expect(HOME.focusId).toBe("complaint-reason");
  });
});
