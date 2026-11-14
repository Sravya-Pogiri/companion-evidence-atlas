export type EvidenceTone = "contradiction" | "support" | "missing" | "related";
export const landingEvidence = [
  { id: "report", title: "Police Report", meta: "EXHIBIT A · PAGE 04", text: '“The suspect fled on foot at 9:42 PM.”', bates: "CL-000142", tone: "contradiction", x: 5, y: 12, rotation: -5, icon: "file" },
  { id: "bodycam", title: "Bodycam Footage", meta: "BODYCAM 00:14:32", text: "Subject seated on the curb. 9:44 PM.", bates: "CL-000218", tone: "contradiction", x: 54, y: 6, rotation: 4, icon: "video" },
  { id: "witness", title: "Witness Statement", meta: "J. DOE · PAGE 02", text: '“He stayed there until the officers arrived.”', bates: "CL-000086", tone: "support", x: 3, y: 52, rotation: -3, icon: "file" },
  { id: "officer", title: "Officer R. Davis", meta: "RESPONDING OFFICER", text: "Badge #0417 · First on scene", bates: "ENTITY / 003", tone: "related", x: 35, y: 34, rotation: 2, icon: "person" },
  { id: "call", title: "911 Call Transcript", meta: "AUDIO 00:02:18", text: '“Someone is sitting outside the store.”', bates: "CL-000304", tone: "support", x: 67, y: 44, rotation: 5, icon: "audio" },
  { id: "location", title: "5th & Main", meta: "INCIDENT LOCATION", text: "Intersection · Camera coverage", bates: "LOCATION / 001", tone: "related", x: 35, y: 73, rotation: -3, icon: "location" },
  { id: "dashcam", title: "Dashcam Footage", meta: "REFERENCED, NOT FOUND", text: "Mentioned in report. Not in discovery.", bates: "MISSING / 001", tone: "missing", x: 70, y: 78, rotation: 3, icon: "missing" },
] as const;
export const landingConnections: { from: string; to: string; tone: EvidenceTone }[] = [
  { from: "report", to: "bodycam", tone: "contradiction" },
  { from: "report", to: "officer", tone: "related" },
  { from: "bodycam", to: "witness", tone: "support" },
  { from: "witness", to: "call", tone: "support" },
  { from: "officer", to: "location", tone: "related" },
  { from: "report", to: "dashcam", tone: "missing" },
  { from: "bodycam", to: "dashcam", tone: "missing" },
];
export const landingFeatures = [
  { title: "Contradiction Detection", text: "Two accounts. One incident. See exactly where the stories diverge.", tone: "contradiction", icon: "compare", number: "01" },
  { title: "Investigation Board", text: "Follow the connections between people, places, and every piece of evidence.", tone: "related", icon: "network", number: "02" },
  { title: "Missing Evidence Detector", text: "Find the footage and documents mentioned, but never produced.", tone: "missing", icon: "missing", number: "03" },
  { title: "Incident Timeline", text: "Reconstruct what happened, moment by moment, across every source.", tone: "related", icon: "clock", number: "04" },
  { title: "Defense Prep Assistant", text: "Turn investigative leads into draft questions for your next cross-examination.", tone: "support", icon: "scale", number: "05" },
  { title: "Source-Linked Answers", text: "No dead ends. Every potential finding leads back to a page or timestamp.", tone: "support", icon: "link", number: "06" },
] as const;
export const demoSteps = [
  { title: "01 / Collect the evidence", text: "A synthetic discovery packet brings together reports, statements, and recordings.", source: "5 linked sources" },
  { title: "02 / Compare the claims", text: "The report places a fleeing suspect at 9:42 PM. Bodycam shows the subject seated at 9:44 PM. This is a potential inconsistency, not a conclusion.", source: "Police Report p.4 ↔ Bodycam 00:14:32" },
  { title: "03 / Follow the missing footage", text: "The police report references dashcam footage that is not included in the synthetic discovery packet.", source: "Police Report p.4" },
  { title: "04 / Prepare and verify", text: "Review source-linked draft questions, then verify each potential finding before using it in court.", source: "AI draft — requires attorney verification" },
];