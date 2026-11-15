// Turns a verified case analysis (src/data/<case>/analysis.json, from scripts/evidence/analyze.ts)
// into the app's existing data: timeline items and the seed conversation. Only findings whose
// every citation passed verification are used. Without an analysis file the app keeps its
// hand-written sample (see sample-case.ts).
import type { CaseAnalysis, Claim, Finding } from "@/lib/evidence/types";
import type { ChatMessage, Flag, Lane, TimelineItem } from "@/lib/sample-case";

const files = import.meta.glob<CaseAnalysis>("../../data/*/analysis.json", {
  eager: true,
  import: "default",
});

export function loadAnalysis(caseId: string): CaseAnalysis | null {
  const hit = Object.entries(files).find(([path]) => path.includes(`/data/${caseId}/`));
  return hit ? hit[1] : null;
}

export interface Seed {
  items: TimelineItem[];
  conversation: ChatMessage[];
  /** Per item: the claims it rests on, for citation chips and document highlights. */
  claimsByItem: Record<string, Claim[]>;
}

const VIDEO_LANES: Record<string, Lane> = { dashcam: "dashcam", bodycam: "bodycam" };

function laneFor(c: Claim): Lane {
  return VIDEO_LANES[c.at.source] ?? "documents";
}

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t) % 60).padStart(2, "0")}`;

function sourceLink(a: CaseAnalysis, c: Claim): string | null {
  const src = a.sources.find((s) => s.id === c.at.source);
  if (!src) return null;
  if ("page" in c.at) return `${src.url.split("#")[0]}#page=${c.at.page}`;
  return src.url.includes("youtube.com") ? `${src.url.split("&t=")[0]}&t=${Math.floor(c.at.t)}s` : src.url;
}

function sourceLabel(a: CaseAnalysis, c: Claim): string {
  const label = a.sources.find((s) => s.id === c.at.source)?.label ?? c.at.source;
  if ("page" in c.at) return `${label}, page ${c.at.page}${c.at.paragraph ? `, ¶${c.at.paragraph}` : ""}`;
  return `${label}, about ${mmss(c.at.t)}`;
}

function shortOf(text: string, max = 28): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > 12 ? cut.slice(0, space) : text.slice(0, max)).replace(/[,;:.\s]+$/, "")}…`;
}

const passed = (c: Claim | undefined) => !!c && (c.verification.status === "passed" || c.verification.status === "fixed");

/**
 * Build timeline items from verified findings. Video claims sit at their own timestamp; document
 * claims sit at the moment of the video claim they are compared with. Items outside the axis
 * (0..axisEnd seconds) are left off the timeline rather than squeezed onto it.
 */
export function seedFromAnalysis(a: CaseAnalysis, axisEnd: number): Seed | null {
  const claims = new Map(a.claims.map((c) => [c.id, c]));
  const findings = a.findings.filter(
    (f) => f.status === "verified" && f.claimIds.every((id) => !claims.has(id) || passed(claims.get(id))),
  );
  if (findings.length === 0) return null;

  const items = new Map<string, TimelineItem>();
  const claimsByItem: Record<string, Claim[]> = {};
  const conversation: ChatMessage[] = [];
  let m = 0;
  const say = (msg: Omit<ChatMessage, "id">) =>
    conversation.push({ ...msg, ...(msg.from === "agent" ? { text: `AI finding: ${msg.text}` } : {}), id: `a${++m}` });

  const itemFor = (c: Claim, at: number, flag: Flag): TimelineItem | null => {
    if (at < 0 || at > axisEnd) return null;
    const id = `claim-${c.id}`;
    const existing = items.get(id);
    if (existing) {
      // A claim can sit in several findings; a conflict or gap outranks agreement.
      if (flag !== "agrees") existing.flag = flag;
      return existing;
    }
    const start = Math.max(0, Math.min(axisEnd - 5, Math.round(at)));
    const item: TimelineItem = {
      id,
      lane: laneFor(c),
      start,
      end: Math.min(axisEnd, start + ("t" in c.at ? 6 : 8)),
      label: c.claim.replace(/\.$/, ""),
      short: shortOf(c.claim.replace(/\.$/, "")),
      extractedText: `AI-generated, verified. ${c.exactQuote ? `${c.claim} ("${c.exactQuote}")` : c.claim}`,
      sourceLink: sourceLink(a, c),
      sourceLabel: sourceLabel(a, c),
      status: "filed",
      flag,
      ...(c.frameRef ? { frame: c.frameRef } : {}),
    };
    items.set(id, item);
    claimsByItem[id] = [c];
    return item;
  };

  for (const f of findings) {
    const cited = f.claimIds.map((id) => claims.get(id)).filter((c): c is Claim => passed(c));
    const video = cited.find((c) => "t" in c.at);
    const anchor = video && "t" in video.at ? video.at.t : undefined;

    if (f.kind === "missing") {
      const expected = f.claimIds.find((id) => !claims.has(id));
      if (expected) {
        const id = `missing-${expected}`;
        if (!items.has(id)) {
          items.set(id, {
            id,
            lane: expected === "dispatch" ? "dispatch" : "events",
            start: 0,
            end: axisEnd,
            label: f.title,
            short: shortOf(f.title),
            extractedText: `AI-generated. A record listed as expected for this case is not in it; there is nothing to cite, so this is a gap to confirm, not a verified finding. ${f.explanation}`,
            sourceLink: null,
            sourceLabel: "Not in the record",
            status: "filed",
            flag: "missing",
          });
        }
        say({ from: "agent", text: `Possible gap: ${f.explanation}`, itemId: id });
        continue;
      }
      const target = cited[0];
      const at = anchor ?? (target && "t" in target.at ? target.at.t : undefined);
      if (target && at !== undefined) {
        const item = itemFor(target, at, "missing");
        if (item) say({ from: "agent", text: `Possible gap: ${f.explanation}`, itemId: item.id });
      }
      continue;
    }

    if (anchor === undefined) {
      // Documents only: no moment to place on the time axis, so it is reported in the conversation.
      const cites = cited.map((c) => sourceLabel(a, c)).join("; ");
      say({ from: "agent", text: `${f.kind === "conflict" ? "Possible conflict" : "Documents agree"} (no video time): ${f.explanation} Sources: ${cites}.` });
      continue;
    }
    const placed = cited.map((c) => ({ c, item: itemFor(c, "t" in c.at ? c.at.t : anchor, "agrees") }));
    const doc = placed.find((p) => p.item && p.item.lane === "documents");
    const vid = placed.find((p) => p.item && p.c === video);
    if (!vid?.item) continue;

    if (doc?.item) {
      doc.item.relatedId = vid.item.id;
      if (f.kind === "conflict") doc.item.flag = "conflict";
      if (vid.c.frameRef) say({ from: "team", attachment: "video", text: `${vid.item.sourceLabel}`, itemId: vid.item.id });
      say({ from: "team", attachment: "document", text: doc.item.sourceLabel, itemId: doc.item.id });
      say({
        from: "agent",
        text: f.kind === "conflict" ? `Filed. Possible conflict: ${f.explanation}` : `Filed. ${f.explanation}`,
        itemId: doc.item.id,
      });
    } else {
      for (const p of placed) if (p.item && p.item !== vid.item) p.item.relatedId = vid.item.id;
      say({ from: "agent", text: f.kind === "conflict" ? `Possible conflict: ${f.explanation}` : f.explanation, itemId: vid.item.id });
    }
  }

  if (items.size === 0) return null;
  return { items: [...items.values()], conversation, claimsByItem };
}
