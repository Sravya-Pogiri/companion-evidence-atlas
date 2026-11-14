import type { Attachment, InboundMessage } from "@/lib/channel/types";
import {
  AXIS_END,
  FLAG_LABEL,
  LANES,
  type Flag,
  type Lane,
  type TimelineItem,
} from "@/lib/sample-case";

// The message pipeline. It takes the current case state and one inbound message and
// returns the next state plus what to text back. It has no browser or server imports,
// so the same code runs behind the simulated channel now and Photon later.
//
// The model only suggests. Code checks every model answer (lane, ids, confidence,
// wording) before anything is filed or said, and a person still confirms on Review.

/** Below this the agent says it can't tell instead of guessing. */
export const MIN_CONFIDENCE = 0.6;

export interface ItemBrief {
  id: string;
  lane: Lane;
  start: number;
  end: number;
  label: string;
  text: string;
  source: string;
}

export interface DescribeInput {
  attachmentKind: string;
  attachmentName: string;
  caption: string;
  extractedText: string;
}
export interface DescribeOutput {
  description: string;
  lane: string;
  start: number | null;
  end: number | null;
  confidence: number;
}
export interface CompareInput {
  item: ItemBrief;
  others: ItemBrief[];
}
export interface CompareOutput {
  verdict: string;
  relatedId: string | null;
  reason: string;
  confidence: number;
}

/** What the pipeline needs from a model. A failure throws an Error with a plain-words message. */
export interface AgentLlm {
  describe(input: DescribeInput): Promise<DescribeOutput>;
  compare(input: CompareInput): Promise<CompareOutput>;
}

export interface PipelineState {
  items: TimelineItem[];
  /** The item waiting for a Y. */
  pendingId: string | null;
  /** Who it is waiting on (the conversation that proposed it). Empty or missing when there is one conversation. */
  pendingFor?: string | null;
}
export interface Reply {
  text: string;
  itemId?: string;
}
export interface PipelineResult {
  state: PipelineState;
  replies: Reply[];
}

// ---------- wording guard ----------

// The agent never states conclusions on guilt, legality, or case strategy. The prompts say
// so, and this is the backstop: model-written text that trips it is replaced with a neutral line.
const CONCLUSION_WORDS =
  /\b(guilt\w*|innocen\w*|illegal\w*|unlawful\w*|lawful\w*|violat\w*|liab\w*|negligen\w*|unconstitutional\w*|misconduct|perjur\w*|lied|lying|liar|fabricat\w*|probable cause|reasonable suspicion|strategy|strategic|should (?:argue|file|move|sue|plead|settle|appeal)|win (?:the|this) case|strong case|weak case|case is (?:strong|weak)|prove[sd]?|proof that)\b/i;

export function hasConclusion(text: string): boolean {
  return CONCLUSION_WORDS.test(text);
}

function sentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

// ---------- helpers ----------

const laneIds = new Set<string>(LANES.map((l) => l.id));
const laneLabel = (lane: Lane) => LANES.find((l) => l.id === lane)?.label ?? lane;

export function filedItems(items: TimelineItem[]): TimelineItem[] {
  return items.filter((i) => i.status === "filed");
}

export function toBrief(item: TimelineItem): ItemBrief {
  return {
    id: item.id,
    lane: item.lane,
    start: item.start,
    end: item.end,
    label: item.label,
    text: item.extractedText,
    source: item.sourceLabel,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function norm(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      // Phones type curly quotes ("What’s missing?"); match them like straight ones.
      .replace(/[\u2018\u2019\u02bc]/g, "'")
      .replace(/[.!?\s]+$/, "")
  );
}

function cleanLabel(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[?.]+$/, "")
    .slice(0, 90);
}

function replaceItem(items: TimelineItem[], next: TimelineItem): TimelineItem[] {
  return items.map((i) => (i.id === next.id ? next : i));
}

function say(state: PipelineState, ...replies: Reply[]): PipelineResult {
  return { state, replies };
}

function errorText(e: unknown): string {
  return e instanceof Error && e.message
    ? sentence(e.message)
    : "The analysis service did not answer.";
}

// ---------- entry point ----------

export async function handleMessage(
  state: PipelineState,
  message: InboundMessage,
  llm: AgentLlm,
  now: Date = new Date(),
): Promise<PipelineResult> {
  const who = message.conversationId ?? "";
  const attachment = message.attachments[0];
  if (attachment) return proposeFiling(state, message, attachment, llm, who);

  const t = norm(message.text);
  if (/^(y|yes|yep|yeah)$/.test(t)) return confirmFiling(state, llm, now, who);
  if (/^(n|no|nope)$/.test(t)) return skipFiling(state, who);
  if (/\bwhat(?:'s|s| is| are)?\s+missing\b/.test(t))
    return say(state, { text: whatsMissing(state.items) });
  if (/\bwhat(?:'s| has| have)?\s+changed\b/.test(t))
    return say(state, { text: whatsChanged(state.items, now) });

  // A longer statement (not a question) is evidence in its own right: a note from the case
  // team, filed through the same propose-then-Y flow as an attachment. Over a text-only
  // channel this is the way to get evidence in.
  if (isNote(message.text)) {
    const note: Attachment = {
      id: `note-${now.getTime().toString(36)}-${shortHash(message.text)}`,
      kind: "document",
      name: "Text note from the case team",
      extractedText: message.text.trim(),
    };
    return proposeFiling(state, { text: "", attachments: [note] }, note, llm, who);
  }

  const pending = ownPending(state, who);
  if (pending) {
    return say(state, {
      text: `I'm still waiting on "${pending.label}". Reply Y to file it, or N to skip it.`,
      itemId: pending.id,
    });
  }
  return say(state, {
    text: `Send me evidence, or a short note with a time like "dashcam shows the signal at 0:55", and I'll suggest where it goes on the timeline. You can also ask "What's missing?" or "What changed since yesterday?"`,
  });
}

const NOTE_MIN_WORDS = 4;

/** A short, stable fingerprint of a text, so two notes never share an id. */
function shortHash(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/** The pending item, if it is waiting on this person. */
function ownPending(state: PipelineState, who: string): TimelineItem | undefined {
  if ((state.pendingFor ?? "") !== who) return undefined;
  return state.items.find((i) => i.id === state.pendingId && i.status === "pending");
}

const NOT_YOURS = "That one is waiting on someone else's reply, so I haven't changed it.";

function isNote(text: string): boolean {
  const t = text.trim();
  return !t.endsWith("?") && t.split(/\s+/).length >= NOTE_MIN_WORDS;
}

// ---------- attachment in: describe and propose ----------

async function proposeFiling(
  state: PipelineState,
  message: InboundMessage,
  attachment: Attachment,
  llm: AgentLlm,
  who: string,
): Promise<PipelineResult> {
  // There is one pending proposal at a time. An unconfirmed one is dropped when something new arrives.
  const items = state.items.filter((i) => i.id !== state.pendingId);
  const base: PipelineState = { items, pendingId: null, pendingFor: null };
  const extra =
    message.attachments.length > 1
      ? " I only looked at the first attachment; send the others one at a time."
      : "";

  const extracted = [attachment.extractedText?.trim(), message.text.trim()]
    .filter(Boolean)
    .join("\n");
  if (!extracted) {
    return say(base, {
      text: `I can't read "${attachment.name}" yet, so I can't tell what it shows. Nothing was filed. Add a short note saying what it is and when.${extra}`,
    });
  }

  let described: DescribeOutput;
  try {
    described = await llm.describe({
      attachmentKind: attachment.kind,
      attachmentName: attachment.name,
      caption: message.text.trim(),
      extractedText: attachment.extractedText?.trim() ?? "",
    });
  } catch (e) {
    return say(base, {
      text: `I can't tell what "${attachment.name}" shows right now. ${errorText(e)} Nothing was filed.${extra}`,
    });
  }

  const lane = laneIds.has(described.lane) ? (described.lane as Lane) : null;
  const placed = Number.isFinite(described.start);
  if (
    !lane ||
    !placed ||
    !(described.confidence >= MIN_CONFIDENCE) ||
    !cleanLabel(described.description)
  ) {
    return say(base, {
      text: `I can't tell what "${attachment.name}" shows or where it belongs on the timeline. Nothing was filed. Try sending it again with a short note on what it is and when.${extra}`,
    });
  }

  const start = clamp(Math.round(described.start as number), 0, AXIS_END - 1);
  const rawEnd = Number.isFinite(described.end) ? Math.round(described.end as number) : start + 5;
  const end = clamp(rawEnd > start ? rawEnd : start + 5, start + 1, AXIS_END);
  const label = hasConclusion(described.description)
    ? cleanLabel(attachment.name)
    : cleanLabel(described.description);

  const item: TimelineItem = {
    id: `item-${attachment.id}`,
    lane,
    start,
    end,
    label,
    extractedText: extracted.slice(0, 600),
    sourceLink: attachment.url ?? null,
    sourceLabel: attachment.name,
    status: "pending",
    flag: "agrees",
  };
  return say(
    { items: [...items, item], pendingId: item.id, pendingFor: who },
    { text: `File this as ${label}? Reply Y.${extra}`, itemId: item.id },
  );
}

// ---------- Y / N ----------

function skipFiling(state: PipelineState, who: string): PipelineResult {
  const pending = ownPending(state, who);
  if (!pending) {
    const other = state.pendingId !== null && (state.pendingFor ?? "") !== who;
    return say(state, { text: other ? NOT_YOURS : "There is nothing waiting to be filed." });
  }
  return say(
    {
      items: state.items.filter((i) => i.id !== pending.id),
      pendingId: null,
      pendingFor: null,
    },
    { text: "Okay, I did not file it." },
  );
}

const VERDICTS = new Set<string>(["agrees", "conflict", "missing", "unclear"]);

async function confirmFiling(
  state: PipelineState,
  llm: AgentLlm,
  now: Date,
  who: string,
): Promise<PipelineResult> {
  const pending = ownPending(state, who);
  if (!pending) {
    const other = state.pendingId !== null && (state.pendingFor ?? "") !== who;
    return say(state, { text: other ? NOT_YOURS : "There is nothing waiting to be filed." });
  }

  const filed: TimelineItem = { ...pending, status: "filed", filedAt: now.toISOString() };
  const others = filedItems(state.items).filter((i) => i.id !== filed.id);
  let next: PipelineState = {
    items: replaceItem(state.items, filed),
    pendingId: null,
    pendingFor: null,
  };

  if (others.length === 0) {
    return say(next, {
      text: "Filed. There is nothing else on the timeline to compare it with yet.",
      itemId: filed.id,
    });
  }

  let result: CompareOutput;
  try {
    result = await llm.compare({ item: toBrief(filed), others: others.map(toBrief) });
  } catch (e) {
    return say(next, {
      text: `Filed. I couldn't check it against the other items just now. ${errorText(e)} It is not flagged, so a person should compare it.`,
      itemId: filed.id,
    });
  }

  const related = others.find((i) => i.id === result.relatedId);
  const verdict = VERDICTS.has(result.verdict) ? (result.verdict as Flag | "unclear") : "unclear";
  const confident = result.confidence >= MIN_CONFIDENCE;
  // Agrees and conflict need a real related item. A gap may stand alone.
  const usable =
    confident && verdict !== "unclear" && (verdict === "missing" || related !== undefined);

  if (!usable) {
    return say(next, {
      text: "Filed. I can't tell whether it agrees with or conflicts with the other items, so I haven't flagged it. A person should take a look.",
      itemId: filed.id,
    });
  }

  const flag = verdict as Flag;
  next = {
    ...next,
    items: replaceItem(next.items, {
      ...filed,
      flag,
      ...(related ? { relatedId: related.id } : {}),
    }),
  };

  const neutral: Record<Flag, string> = {
    conflict: "The two sources may describe this differently.",
    agrees: "The two sources appear to line up.",
    missing: "Something the sources refer to may not be in the record.",
  };
  const reason =
    hasConclusion(result.reason) || !result.reason.trim() ? neutral[flag] : sentence(result.reason);
  const both = related ? `${filed.sourceLabel} and ${related.sourceLabel}` : filed.sourceLabel;

  const text =
    flag === "conflict"
      ? `Filed. Possible conflict: ${reason} Compare ${both}. Review?`
      : flag === "missing"
        ? `Filed. Possible gap: ${reason} See ${both}.`
        : `Filed. It appears consistent with ${related!.sourceLabel}. ${reason}`;
  return say(next, { text, itemId: filed.id });
}

// ---------- commands ----------

export function whatsMissing(items: TimelineItem[]): string {
  const filed = filedItems(items);
  const gaps = filed
    .filter((i) => i.flag === "missing")
    .map((i) => (i.sourceLink ? `${i.label} (${i.sourceLabel})` : i.label));
  for (const lane of LANES) {
    if (!filed.some((i) => i.lane === lane.id)) gaps.push(`nothing filed in ${lane.label}`);
  }
  if (gaps.length === 0) {
    return "I don't see anything flagged as missing. That doesn't mean nothing is missing, so a person should still check.";
  }
  return `Possible gaps: ${gaps.join("; ")}.`;
}

export function whatsChanged(items: TimelineItem[], now: Date): string {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(0, 0, 0, 0);
  const recent = filedItems(items).filter((i) => i.filedAt && new Date(i.filedAt) >= cutoff);
  if (recent.length === 0) return "Nothing new has been filed since yesterday.";

  const lines = recent.map((i) =>
    i.flag === "agrees"
      ? i.label
      : `${i.label} (${FLAG_LABEL[i.flag].toLowerCase()}, ${laneLabel(i.lane)})`,
  );
  const flagged = recent.some((i) => i.flag !== "agrees");
  return `Since yesterday, ${recent.length} ${recent.length === 1 ? "item was" : "items were"} filed: ${lines.join("; ")}.${flagged ? " Flagged ones are on the Review page." : ""}`;
}
