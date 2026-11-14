import { describe, expect, it } from "vitest";
import { sidebarEvidenceCounts, boardEvidence, boardConnections, findingTone, workflowSteps } from "@/lib/overview-data";
import { findings } from "@/lib/case-data";
describe("Overview evidence rules", () => {
  it("retains the requested contradiction count", () => expect(sidebarEvidenceCounts["/contradictions"]).toBe(1));
  it("retains the requested missing count", () => expect(sidebarEvidenceCounts["/missing"]).toBe(2));
  it("shows the incident-time discrepancy as contradiction", () => expect(findingTone("f1")).toBe("contradiction"));
  it("treats the unresolved activation point as missing, not a finding",()=>expect(findingTone("f2")).toBe("missing"));
  it("preserves the five workflow steps and their current state", () => expect(workflowSteps.map((s) => s.status)).toEqual(["Complete", "Active", "Active", "Waiting", "Waiting"]));
});

describe("Rosales case lineup",()=>{it("lists only the real case",async()=>{const {cases}=await import("@/lib/case-data");expect(cases.map(c=>c.name)).toEqual(["Rosales v. Terrell"]);});});
