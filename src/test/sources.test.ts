import { describe, expect, it } from "vitest";
import { segment } from "@/lib/highlight";
import { ITEMS } from "@/lib/sample-case";
import {
  ENTITIES,
  ITEM_CITATIONS,
  SOURCES,
  citationLabel,
  findParagraph,
  findSource,
} from "@/lib/sources";

describe("source text and citations", () => {
  it("finds every finding phrase in its paragraph", () => {
    for (const s of SOURCES)
      for (const b of s.blocks ?? [])
        for (const p of b.paragraphs)
          for (const m of p.marks ?? []) expect(p.text, `${s.id} ${p.id}`).toContain(m.phrase);
  });

  it("points every citation at a real source and paragraph", () => {
    const all = [...Object.values(ITEM_CITATIONS).flat(), ...ENTITIES.flatMap((e) => e.cites)];
    for (const s of SOURCES)
      for (const b of s.blocks ?? []) for (const p of b.paragraphs) all.push(...(p.cites ?? []));
    for (const c of all) {
      expect(findSource(c.source), c.source).toBeDefined();
      if ("para" in c)
        expect(findParagraph(c.source, c.para), `${c.source} ${c.para}`).toBeDefined();
    }
  });

  it("cites every sample item", () => {
    for (const item of ITEMS) expect(ITEM_CITATIONS[item.id], item.id).toBeDefined();
  });

  it("labels citations the way the chips show them", () => {
    expect(citationLabel({ source: "complaint", para: "208" })).toBe("¶208");
    expect(citationLabel({ source: "opinion", para: "p11-2" })).toBe("p.11 ¶4");
    expect(citationLabel({ source: "dashcam", t: 45 })).toBe("00:45");
    expect(citationLabel({ source: "dispatch" })).toBe("ref");
  });
});

describe("segment", () => {
  it("marks an exact phrase and keeps the rest of the text", () => {
    const runs = segment("He said, “Failure to signal. That’s all.”", [
      { phrase: "Failure to signal.", kind: "finding", id: "a" },
    ]);
    expect(runs.map((r) => r.text).join("")).toBe("He said, “Failure to signal. That’s all.”");
    expect(runs.find((r) => r.mark)?.text).toBe("Failure to signal.");
  });

  it("prefers findings over entity mentions and whole words over parts", () => {
    const runs = segment("Mario Rosales met Marion. Rosales signaled.", [
      { phrase: "Rosales signaled.", kind: "finding", id: "f" },
      { phrase: "Mario Rosales", kind: "entity", id: "e1" },
      { phrase: "Mario", kind: "entity", id: "e1" },
      { phrase: "Rosales", kind: "entity", id: "e1" },
    ]);
    const marked = runs.filter((r) => r.mark).map((r) => [r.text, r.mark!.kind]);
    expect(marked).toEqual([
      ["Mario Rosales", "entity"],
      ["Rosales signaled.", "finding"],
    ]);
  });
});
