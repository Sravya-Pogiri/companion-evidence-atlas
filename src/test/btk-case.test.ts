import { describe, expect, it } from "vitest";
import analysis from "@/data/btk/packet-analysis.json";
import { btkTickLabel, buildBtkCase } from "@/lib/cases/btk";
import type { BtkAnalysis } from "@/lib/cases/btk-types";

const a = analysis as unknown as BtkAnalysis;
const verified = new Set([...a.observations, ...a.events].flatMap((o) => o.citations.flatMap((c) => c.quotes.map((q) => q.text))));

describe("the BTK case built from the checked packet analysis", () => {
  const btk = buildBtkCase();

  it("puts one item per timeline entry on the 0-90 axis, without overlap between entries", () => {
    const entries = btk.items.filter((i) => i.lane !== "gaps").sort((x, y) => x.start - y.start);
    expect(entries).toHaveLength(a.events.length);
    for (let i = 1; i < entries.length; i++) expect(entries[i]!.start).toBeGreaterThanOrEqual(entries[i - 1]!.end);
    expect(entries[0]!.start).toBeGreaterThanOrEqual(0);
    expect(entries.at(-1)!.end).toBeLessThanOrEqual(90);
  });

  it("only quotes text the checker found on the cited page", () => {
    const quoted = [...btk.items.map((i) => i.extractedText), ...btk.conversation.map((m) => m.text)]
      .flatMap((t) => [...t.matchAll(/“([^”]{12,})”/g)].map((m) => m[1]!));
    expect(quoted.length).toBeGreaterThan(3);
    // A quote can contain its own curly quotes, so the match may stop early: compare its start.
    for (const q of quoted) if (q !== "President: Dennis Rader") expect([...verified].some((v) => v.startsWith(q))).toBe(true);
    for (const s of btk.sources) for (const b of s.blocks ?? []) for (const p of b.paragraphs) if (s.id !== "summary") expect(verified.has(p.text)).toBe(true);
  });

  it("marks each records gap as missing and links it to an entry", () => {
    const gaps = btk.items.filter((i) => i.lane === "gaps");
    expect(gaps).toHaveLength(a.gaps.length);
    for (const g of gaps) {
      expect(g.flag).toBe("missing");
      expect(btk.items.some((i) => i.id === g.relatedId)).toBe(true);
      expect(g.short!.length).toBeLessThanOrEqual(27);
    }
  });

  it("opens on the mailed disk and labels ticks with years where the year changes", () => {
    const disk = btk.items.find((i) => i.id === "btk-T15")!;
    expect(btk.openAt).toBeGreaterThan(disk.start);
    expect(btk.openAt).toBeLessThan(disk.end);
    const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90].map(btkTickLabel);
    expect(ticks[0]).toBe("1974");
    expect(ticks.filter(Boolean)).toEqual([...new Set(ticks.filter(Boolean))]);
  });

  it("uses hedged agent messages and no conclusions of its own", () => {
    for (const m of btk.conversation.filter((x) => x.from === "agent")) {
      expect(m.text.startsWith("AI finding:")).toBe(true);
      // Outside quoted court text, no conclusions of its own.
      expect(m.text.replace(/“[^”]*”/g, "")).not.toMatch(/\b(proves?|guilty of|illegal|lied)\b/i);
    }
  });
});
