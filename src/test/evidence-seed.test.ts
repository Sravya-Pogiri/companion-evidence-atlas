import { describe, expect, it } from "vitest";
import { seedFromAnalysis } from "@/lib/evidence/seed";
import type { CaseAnalysis, Claim } from "@/lib/evidence/types";

const ok = { status: "passed", method: "quote-on-page" } as const;
const claim = (over: Partial<Claim> & Pick<Claim, "id" | "at">): Claim => ({
  origin: "document",
  claim: "A claim.",
  verification: ok,
  ...over,
});

function analysis(over: Partial<CaseAnalysis> = {}): CaseAnalysis {
  return {
    caseId: "t",
    generatedAt: "2026-11-15T00:00:00Z",
    models: { text: "m", vision: "m", audio: "m" },
    timings: {},
    sources: [
      { id: "complaint", kind: "pdf", label: "Complaint", url: "https://x.test/Complaint.pdf", sha256: "a" },
      { id: "dashcam", kind: "video", label: "Dashcam", url: "https://www.youtube.com/watch?v=abc", sha256: "b" },
    ],
    claims: [
      claim({ id: "c1", claim: "The officer gave failure to signal as the reason.", at: { source: "complaint", page: 24, paragraph: 208 }, exactQuote: "Failure to signal." }),
      claim({ id: "v1", origin: "video", claim: "The car's left lamp appears lit.", at: { source: "dashcam", t: 46 }, frameRef: "/frames/analysis/dashcam-0046.jpg", verification: { status: "passed", method: "second-vision-check" } }),
      claim({ id: "v2", origin: "video", claim: "Late moment.", at: { source: "dashcam", t: 600 }, verification: { status: "passed", method: "second-vision-check" } }),
      claim({ id: "bad", origin: "video", claim: "Unverified.", at: { source: "dashcam", t: 50 }, verification: { status: "failed", method: "second-vision-check" } }),
    ],
    findings: [
      { id: "f1", kind: "conflict", title: "Signal", explanation: "The complaint quotes failure to signal; the dashcam appears to show a lit lamp.", claimIds: ["c1", "v1"], status: "verified" },
      { id: "f2", kind: "agrees", title: "Uses bad claim", explanation: "x", claimIds: ["c1", "bad"], status: "verified" },
      { id: "f3", kind: "missing", title: "No dispatch audio", explanation: "No dispatch recording is in the record.", claimIds: ["dispatch"], status: "verified" },
      { id: "f4", kind: "agrees", title: "Dropped", explanation: "x", claimIds: ["c1", "v1"], status: "dropped", droppedBecause: "test" },
      { id: "f5", kind: "agrees", title: "Too late for the axis", explanation: "x", claimIds: ["c1", "v2"], status: "verified" },
    ],
    log: [],
    ...over,
  };
}

describe("seeding the app from a verified analysis", () => {
  const seed = seedFromAnalysis(analysis(), 90)!;
  const byId = Object.fromEntries(seed.items.map((i) => [i.id, i]));

  it("places a conflict at the video moment and links the document to it", () => {
    expect(byId["claim-v1"]).toMatchObject({ lane: "dashcam", start: 46, frame: "/frames/analysis/dashcam-0046.jpg" });
    expect(byId["claim-c1"]).toMatchObject({
      lane: "documents",
      start: 46,
      flag: "conflict",
      relatedId: "claim-v1",
      sourceLink: "https://x.test/Complaint.pdf#page=24",
      sourceLabel: "Complaint, page 24, ¶208",
    });
  });

  it("leaves out findings that cite an unverified claim, dropped findings and off-axis moments", () => {
    expect(byId["claim-bad"]).toBeUndefined();
    expect(byId["claim-v2"]).toBeUndefined();
  });

  it("turns a missing expected record into a gap across the timeline", () => {
    expect(byId["missing-dispatch"]).toMatchObject({ lane: "dispatch", flag: "missing", start: 0, end: 90 });
  });

  it("writes a conversation whose replies point at the items, with hedged wording", () => {
    const agent = seed.conversation.filter((m) => m.from === "agent");
    expect(agent.map((m) => m.itemId)).toEqual(["claim-c1", "missing-dispatch"]);
    expect(agent[0]!.text).toMatch(/^AI finding: Filed\. Possible conflict: /);
    expect(seed.claimsByItem["claim-c1"]![0]!.id).toBe("c1");
  });

  it("returns nothing when no finding survives, so the app keeps its sample", () => {
    expect(seedFromAnalysis(analysis({ findings: [] }), 90)).toBeNull();
  });
});
