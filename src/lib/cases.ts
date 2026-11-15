import { PUBLIC_CASES, type PublicCase } from "@/lib/case-library";
import {
  CONVERSATION,
  ITEMS,
  SAMPLE_CASE,
  type ChatMessage,
  type TimelineItem,
} from "@/lib/sample-case";

// The cases the app can show. Rosales v. Terrell is the footage case, where text evidence is
// filed onto a video timeline. The others come from the landing page: public-record cases with a
// dated timeline, contradictions that the public sources describe, and open questions. Their
// items are built from that data only, so nothing here is invented.

export type CaseKind = "footage" | "dated";

export interface CaseMeta {
  id: string;
  name: string;
  /** Case number for the footage case, place for the others. */
  sub: string;
  label: string;
  kind: CaseKind;
}

export const DEFAULT_CASE_ID = "rosales";

export const ROSALES: CaseMeta = {
  id: DEFAULT_CASE_ID,
  name: SAMPLE_CASE.name,
  sub: SAMPLE_CASE.number,
  label: SAMPLE_CASE.label,
  kind: "footage",
};

const PUBLIC_LABEL = "Public record · summarized from linked sources";

export const CASE_LIST: CaseMeta[] = [
  ROSALES,
  ...PUBLIC_CASES.map((c) => ({
    id: c.id,
    name: c.name,
    sub: c.location,
    label: PUBLIC_LABEL,
    kind: "dated" as const,
  })),
];

export function caseMeta(id: string | null | undefined): CaseMeta {
  return CASE_LIST.find((c) => c.id === id) ?? ROSALES;
}

export function isCaseId(id: string | null | undefined): id is string {
  return !!id && CASE_LIST.some((c) => c.id === id);
}

export function publicCase(id: string): PublicCase | undefined {
  return PUBLIC_CASES.find((c) => c.id === id);
}

// ---------- building the app's data from a public case ----------

/** The first sentence, cut to a length that fits a timeline row. */
function headline(text: string, max = 96): string {
  const first = text.split(/(?<=[.!?])\s/)[0] ?? text;
  const base = first.replace(/[.!?]+$/, "");
  if (base.length <= max) return base;
  const cut = base.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "")}…`;
}

const STEP = 10;

/** Dated events first (in order), then the findings a person should look at. All filed. */
export function buildItems(c: PublicCase): TimelineItem[] {
  const events: TimelineItem[] = c.timeline.map((t, i) => ({
    id: `${c.id}-t${i + 1}`,
    lane: "events",
    start: i * STEP,
    end: i * STEP + STEP - 2,
    label: headline(t.text),
    extractedText: t.text,
    sourceLink: c.timelineSource.url,
    sourceLabel: c.timelineSource.label,
    status: "filed",
    flag: "agrees",
    when: t.date,
  }));

  const findings: TimelineItem[] = c.findings.map((f, i) => ({
    id: `${c.id}-f${i + 1}`,
    lane: "documents",
    start: i * STEP,
    end: i * STEP + STEP - 2,
    label: f.title.replace(/[.]+$/, "") || "Sources differ",
    extractedText: [f.explanation, ...f.sides.map((s) => `${s.label}: ${s.text}`)].join(" "),
    sourceLink: c.primarySource.url,
    sourceLabel: c.primarySource.label,
    status: "filed",
    flag: "conflict",
    when: "From the public sources",
  }));

  const list = c.checklist.length > 0 ? c.checklist : c.questions;
  const gap: TimelineItem = {
    id: `${c.id}-gap`,
    lane: "documents",
    start: 0,
    end: STEP - 2,
    label: c.checklistTitle ?? "Open questions for the defense team",
    extractedText: [
      // Only the checklist cases carry a note about the checklist itself.
      c.checklist.length > 0 && c.note
        ? c.note
        : "Questions the public sources leave open. Each is a prompt for the team, not a finding.",
      ...list.map((q, i) => `${i + 1}. ${q}`),
    ].join(" "),
    sourceLink: c.primarySource.url,
    sourceLabel: c.primarySource.label,
    status: "filed",
    flag: "missing",
    when: "Prompts, not findings",
  };
  return [...events, ...findings, gap];
}

const ATTACHMENT: Record<string, NonNullable<ChatMessage["attachment"]>> = {
  video: "video",
  mic: "voice",
  eye: "image",
};

/** A sample conversation that walks through the case: evidence in, findings out. */
export function buildConversation(c: PublicCase): ChatMessage[] {
  const out: ChatMessage[] = [];
  let n = 0;
  const add = (m: Omit<ChatMessage, "id">) => out.push({ ...m, id: `${c.id}-m${++n}` });

  for (const e of c.evidence.slice(0, 2)) {
    add({ from: "team", attachment: ATTACHMENT[e.icon] ?? "document", text: e.name });
    add({ from: "agent", text: `File this as ${e.name}: ${e.desc} Reply Y.` });
    add({ from: "team", text: "Y" });
    add({ from: "agent", text: "Filed." });
  }
  c.findings.forEach((f, i) => {
    const who = f.sides.map((s) => s.label).join(" and ");
    add({
      from: "agent",
      text: `Possible conflict: ${f.title} ${f.explanation} Compare: ${who}. Review?`,
      itemId: `${c.id}-f${i + 1}`,
    });
  });
  add({ from: "team", text: "What's missing?" });
  add({
    from: "agent",
    text: `Possible gaps: ${c.checklistTitle ?? "open questions for the defense team"}. See Review.`,
    itemId: `${c.id}-gap`,
  });
  return out;
}

/** The app's starting items and conversation for a case. */
export function caseData(id: string): { items: TimelineItem[]; messages: ChatMessage[] } {
  const c = publicCase(id);
  if (!c) return { items: ITEMS, messages: CONVERSATION };
  return { items: buildItems(c), messages: buildConversation(c) };
}
