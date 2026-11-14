import { evidence, findings, missing } from "./case-data";

export const sidebarEvidenceCounts: Record<string, number> = { "/contradictions": findings.filter((f) => f.kind !== "missing").length, "/missing": missing.length };
export const commandSuggestions = ["Compare officer statements vs bodycam", "What evidence is missing?", "Draft cross-exam questions"];
export const workflowSteps = [
  { n: 1, title: "Collect", status: "Complete", detail: "5 discovery files ingested for State v. Alex Morgan." },
  { n: 2, title: "Process", status: "Active", detail: "Bodycam analysis and 911 transcription in progress." },
  { n: 3, title: "Review", status: "Active", detail: "3 potential findings awaiting attorney verification." },
  { n: 4, title: "Investigate", status: "Waiting", detail: "4 missing evidence requests to send." },
  { n: 5, title: "Prepare", status: "Waiting", detail: "Draft case brief not yet exported." },
];
export const boardEvidence = [evidence[0], evidence[2], evidence[1], evidence[3], evidence[4]].filter((e) => e !== undefined);
export const boardConnections = [
  { from: "e1", to: "e3", tone: "contradiction" },
  { from: "e2", to: "e4", tone: "contradiction" },
  { from: "e1", to: "missing", tone: "missing" },
  { from: "e5", to: "e3", tone: "corroborate" },
  { from: "e1", to: "e4", tone: "related" },
];
// The Overview uses a red review cue for discrepancies, without changing the underlying lead classification.
export const findingTone = (id: string) => findings.find((f) => f.id === id)?.kind === "missing" ? "missing" : "contradiction";
export const crossExamDrafts: Record<string, string[]> = {
  f1: ["How did you determine the incident time of 20:30 in your report?", "Was the surveillance camera clock checked against an authoritative time source?"],
  f2: ["Describe the lighting and distance when you observed the jacket.", "Could lighting or camera settings account for the apparent color difference?"],
  f3: ["What lineup procedure was used, and who administered it?", "Where are the photo array, instructions, and witness confidence statement recorded?"],
};