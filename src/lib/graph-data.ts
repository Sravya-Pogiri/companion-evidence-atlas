import type { Edge, Node } from "@xyflow/react";
export type NodeKind = "person" | "witness" | "officer" | "document" | "location" | "event" | "object" | "statement" | "missing";
export interface GNodeData extends Record<string, unknown> { label: string; kind: NodeKind; source: string; excerpt: string; status: string; url?: string; }
export type Rel = "related" | "corroborate" | "contradiction" | "missing";
export interface GEdgeData extends Record<string, unknown> { rel: Rel; explanation: string; source: string; excerpt: string; status: string; }

// Rosales v. Terrell: every node cites one of the four public sources the user supplied. Linked, not machine-analyzed.
const COMPLAINT = "Filed complaint (p. 24, para. 208)", BODYCAM = "Officer bodycam (YouTube)", DASHCAM = "Dashcam (YouTube)", OPINION = "Fifth Circuit opinion (p. 11)";
const n = (id: string, x: number, y: number, label: string, kind: NodeKind, source: string, excerpt: string, status = "From public record · unverified"): Node<GNodeData> =>
  ({ id, position: { x, y }, type: "evidence", data: { label, kind, source, excerpt, status } });

export const graphNodes: Node<GNodeData>[] = [
  n("rosales", 420, 260, "Mario Rosales", "person", COMPLAINT, "Driver of the Mustang; plaintiff."),
  n("terrell", 760, 120, "Officer Terrell", "officer", COMPLAINT, "Officer who made the stop; defendant."),
  n("complaint", 620, 0, COMPLAINT, "document", COMPLAINT, "Records the officer's stated reason for the stop."),
  n("bodycam", 260, -80, BODYCAM, "document", BODYCAM, "Approach and left turn, from about 0:45."),
  n("dashcam", 100, -60, DASHCAM, "document", DASHCAM, "Second angle of the approach and turn, from about 0:45."),
  n("opinion", 820, 380, OPINION, "document", OPINION, "Court's independent description of the footage."),
  n("intersection", 120, 420, "Intersection, Alexandria, LA", "location", COMPLAINT, "Where the Mustang turned left (2022)."),
  n("turn", 300, 140, "Left turn", "event", BODYCAM, "The Mustang approaches and turns left."),
  n("signal", -60, 140, "Left turn signal", "object", BODYCAM, "Appears on when the car comes into view."),
  n("stmt", 260, 560, "Stated reason: failure to signal", "statement", COMPLAINT, "Officer's stated reason for the stop (p. 24, para. 208)."),
  n("rule", 900, 250, "100-foot signal question", "statement", OPINION, "Whether the signal ran at least 100 feet before the turn."),
  n("activation", 460, 470, "Signal activation point", "missing", OPINION, "Not shown in the footage; unresolved.", "Not established"),
];

const e = (id: string, source: string, target: string, rel: Rel, explanation: string, src: string, excerpt: string): Edge<GEdgeData> => ({
  id, source, target, type: "default", animated: rel === "contradiction",
  data: { rel, explanation, source: src, excerpt, status: "Unverified" },
});

export const graphEdges: Edge<GEdgeData>[] = [
  e("x1", "stmt", "signal", "contradiction", "Potential discrepancy: the stated reason is failure to signal, but the footage appears to show the left signal already on.", "Complaint p. 24 / Bodycam ~0:45", "'failure to signal' vs signal visibly on"),
  e("x2", "rule", "activation", "missing", "The footage does not show when the signal was switched on, so the 100-foot question stays unresolved.", "Fifth Circuit opinion p. 11", "Activation point not shown"),
  e("x3", "opinion", "activation", "missing", "Court notes the activation point is not established.", "Fifth Circuit opinion p. 11", "Unresolved"),
  e("c1", "opinion", "signal", "corroborate", "Court independently describes the signal as on when the car came into view.", "Fifth Circuit opinion p. 11", "Signal already on"),
  e("c2", "dashcam", "turn", "corroborate", "Second angle shows the same turn.", "Dashcam ~0:45", "Left turn"),
  e("r1", "bodycam", "turn", "related", "Footage of the turn.", "Bodycam ~0:45", "Left turn"),
  e("r2", "turn", "signal", "related", "Signal visible during approach.", "Bodycam ~0:45", "Left signal"),
  e("r3", "terrell", "complaint", "related", "Officer's stated reason is recorded here.", "Complaint p. 24", "para. 208"),
  e("r4", "terrell", "stmt", "related", "Officer gave this reason.", "Complaint p. 24", "Failure to signal"),
  e("r5", "terrell", "bodycam", "related", "Officer's body-worn camera.", "Bodycam", "Officer bodycam"),
  e("r6", "rosales", "turn", "related", "Driver who made the turn.", "Complaint", "Mustang"),
  e("r7", "turn", "intersection", "related", "Location of the turn.", "Complaint", "Alexandria, LA"),
  e("r8", "complaint", "stmt", "related", "Source of the statement.", "Complaint p. 24", "para. 208"),
  e("r9", "rule", "turn", "related", "Legal question about the turn.", "Fifth Circuit opinion p. 11", "100 feet"),
];

export const relColor: Record<Rel, string> = { related: "var(--related)", corroborate: "var(--corroborate)", contradiction: "var(--contradiction)", missing: "var(--missing)" };

const satelliteSpec: Record<string, string[]> = { complaint: ["p. 24, para. 208"], bodycam: ["~0:45"], dashcam: ["~0:45"], opinion: ["p. 11"] };
export const satelliteNodes: Node<GNodeData>[] = [];
export const satelliteEdges: Edge<GEdgeData>[] = [];
for (const [parent, labels] of Object.entries(satelliteSpec)) {
  const p = graphNodes.find((x) => x.id === parent)!;
  labels.forEach((l, i) => {
    const id = `${parent}-s${i}`;
    satelliteNodes.push({ id, position: { x: p.position.x + 120, y: p.position.y + 60 }, type: "satellite",
      data: { label: l, kind: "document", source: p.data.label, excerpt: `Reference at ${l} in ${p.data.label}.`, status: "Public record", minor: true } });
    satelliteEdges.push({ id: `${id}-e`, source: parent, target: id, data: { rel: "related", explanation: "Reference in source.", source: p.data.label, excerpt: l, status: "Public record" } });
  });
}
