import { findings } from "./case-data";

// Presentation notes augment, but never replace, the public-record sources.
export const reviewNotes = [
  { findingId: "f1", edgeId: "x1", title: "Signal visible before turn", label: "Stated reason vs footage", summary: "Stated reason: failure to signal. The footage appears to show the signal on.", explanation: "The complaint records the stated reason as failure to signal, while the bodycam appears to show the left signal already on as the Mustang comes into view. Watch the turn from about 0:45 before relying on this.", questions: ["What did you observe that led you to conclude the driver failed to signal?", "Was the left signal on when the vehicle first came into your view?", "Where were you positioned relative to the intersection?"], refs: ["Complaint p. 24, para. 208", "Bodycam ~0:45"] },
  { findingId: "f2", edgeId: "x2", title: "Activation point unresolved", label: "When did the signal start?", summary: "Nothing shows whether the signal ran for 100 feet before the turn.", explanation: "The footage starts with the signal already on, so it cannot show when it was switched on. The Fifth Circuit treats this as open; CaseLens does not draw a conclusion either way.", questions: ["At what point did you first see the vehicle?", "Could you see whether the signal was on 100 feet before the turn?", "Is there any other recording of the approach?"], refs: ["Fifth Circuit opinion p. 11"] },
] as const;

export function findingIndex(id: string | undefined) {
  const index = findings.findIndex((finding) => finding.id === id);
  return index < 0 ? 0 : index;
}

// Fixed concentric placement leaves clear lanes for source-to-source findings.
export const reviewPositions: Record<string, { x: number; y: number }> = {
  rosales: { x: 590, y: 390 }, terrell: { x: 850, y: 240 }, turn: { x: 600, y: 195 },
  intersection: { x: 350, y: 440 }, signal: { x: 350, y: 240 }, stmt: { x: 850, y: 600 },
  rule: { x: 380, y: 640 }, activation: { x: 600, y: 760 },
  complaint: { x: 1090, y: 420 }, bodycam: { x: 300, y: 20 }, dashcam: { x: 50, y: 300 }, opinion: { x: 930, y: 20 },
};