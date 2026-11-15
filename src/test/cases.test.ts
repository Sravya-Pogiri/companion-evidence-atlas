import { beforeEach, describe, expect, it } from "vitest";
import { PUBLIC_CASES } from "@/lib/case-library";
import { getCase, resetCase, selectCase } from "@/lib/case-store";
import {
  CASE_LIST,
  DEFAULT_CASE_ID,
  buildConversation,
  buildItems,
  caseData,
  caseMeta,
  isCaseId,
} from "@/lib/cases";
import { AXIS_END, ITEMS, formatRange, reviewQueue } from "@/lib/sample-case";

describe("the case list", () => {
  it("has the Rosales footage case first and the three public-record cases after it", () => {
    expect(CASE_LIST.map((c) => c.id)).toEqual(["rosales", "benitez", "mcmillian", "hinton"]);
    expect(CASE_LIST[0]?.kind).toBe("footage");
    expect(CASE_LIST.slice(1).every((c) => c.kind === "dated")).toBe(true);
  });

  it("falls back to Rosales for an unknown or missing id", () => {
    expect(caseMeta("nope").id).toBe(DEFAULT_CASE_ID);
    expect(caseMeta(null).id).toBe(DEFAULT_CASE_ID);
    expect(isCaseId("hinton")).toBe(true);
    expect(isCaseId("nope")).toBe(false);
    expect(isCaseId(null)).toBe(false);
  });
});

describe.each(PUBLIC_CASES)("items built from $name", (c) => {
  const items = buildItems(c);

  it("has the dated events, the findings and one open-prompts item, all filed", () => {
    expect(items.filter((i) => i.lane === "events")).toHaveLength(c.timeline.length);
    expect(items.filter((i) => i.flag === "conflict")).toHaveLength(c.findings.length);
    expect(items.filter((i) => i.flag === "missing")).toHaveLength(1);
    expect(items.every((i) => i.status === "filed")).toBe(true);
  });

  it("has unique ids, a source link and a date on every item, and stays on the axis", () => {
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const i of items) {
      expect(i.sourceLink, i.id).toMatch(/^https:\/\//);
      expect(i.when, i.id).toBeTruthy();
      expect(i.start).toBeGreaterThanOrEqual(0);
      expect(i.end).toBeLessThanOrEqual(AXIS_END);
      expect(i.end).toBeGreaterThan(i.start);
    }
  });

  it("keeps each event's own date and text, in order, with nothing added", () => {
    const events = items.filter((i) => i.lane === "events");
    expect(events.map((e) => e.when)).toEqual(c.timeline.map((t) => t.date));
    expect(events.map((e) => e.extractedText)).toEqual(c.timeline.map((t) => t.text));
  });

  it("puts the findings and open prompts on Review, and not the plain events", () => {
    const queue = reviewQueue(items);
    expect(queue).toHaveLength(c.findings.length + 1);
    expect(queue[0]?.flag).toBe("conflict");
  });

  it("has no leftover HTML in any text", () => {
    for (const i of items) expect(`${i.label} ${i.extractedText}`, i.id).not.toMatch(/<[^>]+>/);
  });

  it("shows the date, not a clip time, where a range would go", () => {
    for (const i of items) expect(formatRange(i)).toBe(i.when);
  });
});

describe.each(PUBLIC_CASES)("conversation built from $name", (c) => {
  const items = buildItems(c);
  const messages = buildConversation(c);

  it("links its messages only to items that exist, and walks evidence in then findings out", () => {
    const ids = new Set(items.map((i) => i.id));
    for (const m of messages) if (m.itemId) expect(ids.has(m.itemId), m.itemId).toBe(true);
    expect(messages.some((m) => /^File this as /.test(m.text))).toBe(true);
    expect(messages.filter((m) => m.text.startsWith("Possible conflict"))).toHaveLength(
      c.findings.length,
    );
    expect(new Set(messages.map((m) => m.id)).size).toBe(messages.length);
  });
});

describe("the generated library matches the landing page", () => {
  it("has every case, timeline and source the landing page has", () => {
    expect(PUBLIC_CASES.map((c) => c.id)).toEqual(["benitez", "mcmillian", "hinton"]);
    for (const c of PUBLIC_CASES) {
      expect(c.timeline).toHaveLength(8);
      expect(c.sources.length).toBeGreaterThan(0);
      expect(c.facts.length).toBeGreaterThan(0);
    }
  });
});

describe("choosing a case", () => {
  beforeEach(() => resetCase());

  it("starts on Rosales with its sample data", () => {
    expect(getCase().caseId).toBe("rosales");
    expect(getCase().items).toBe(ITEMS);
  });

  it("switches the items and conversation, and clears anything pending", () => {
    selectCase("benitez");
    const s = getCase();
    expect(s.caseId).toBe("benitez");
    expect(s.items.every((i) => i.id.startsWith("benitez-"))).toBe(true);
    expect(s.messages.every((m) => m.id.startsWith("benitez-"))).toBe(true);
    expect(s.pendingId).toBeNull();
  });

  it("comes back to the Rosales data, and ignores an unknown id or the same case again", () => {
    selectCase("hinton");
    selectCase("rosales");
    expect(getCase().items).toBe(caseData("rosales").items);
    selectCase("nope");
    expect(getCase().caseId).toBe("rosales");
    const before = getCase();
    selectCase("rosales");
    expect(getCase()).toBe(before);
  });
});
