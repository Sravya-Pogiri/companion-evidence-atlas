import { describe, expect, it } from "vitest";
import { findingIndex, reviewNotes, reviewPositions } from "@/lib/review-data";
import { graphNodes, graphEdges } from "@/lib/graph-data";
import { findings, missing } from "@/lib/case-data";
describe("Evidence review rules",()=>{
  it("graph covers only the four Rosales sources",()=>{expect(graphNodes.filter(n=>n.data.kind==="document").map(n=>n.id)).toEqual(["complaint","bodycam","dashcam","opinion"]);graphNodes.forEach(n=>expect(reviewPositions[n.id]).toBeDefined());});
  it("flags one discrepancy and leaves activation unresolved",()=>{expect(graphEdges.filter(e=>e.data?.rel==="contradiction").map(e=>e.id)).toEqual(["x1"]);expect(reviewNotes.map(n=>n.findingId)).toEqual(["f1","f2"]);});
  it("opens the requested finding, defaulting unknown requests to the first",()=>{expect(findingIndex("unknown")).toBe(0);});
  it("supplies three preparation questions for each finding",()=>{reviewNotes.forEach(n=>expect(n.questions).toHaveLength(3));});
  it("has the two Rosales findings and two open requests",()=>{expect(findings.map(f=>f.title)).toEqual(["Signal visible before turn","Activation point unresolved"]);expect(missing).toHaveLength(2);});
});
