// Server only. The model calls behind the pipeline, shared by the browser's server functions
// (agent.functions.ts) and the Photon webhook, which runs the pipeline on the server.
import { ANSWER_SYSTEM, COMPARE_SYSTEM, DESCRIBE_SYSTEM } from "@/lib/agent/gateway.server";
import { askJson } from "@/lib/ai/provider.server";
import { answerQuestion, QaMemory, type AnswerFn } from "@/lib/agent/qa";
import type {
  AgentLlm,
  CompareInput,
  CompareOutput,
  DescribeInput,
  DescribeOutput,
  ItemBrief,
} from "@/lib/agent/pipeline";

export const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";
export const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Cap sizes on anything that ends up in a prompt. */
export function clampBrief(v: unknown): ItemBrief {
  const o = (v ?? {}) as Record<string, unknown>;
  return {
    id: str(o["id"], 80),
    lane: str(o["lane"], 20) as ItemBrief["lane"],
    start: num(o["start"]) ?? 0,
    end: num(o["end"]) ?? 0,
    label: str(o["label"], 120),
    text: str(o["text"], 700),
    source: str(o["source"], 120),
  };
}

export function clampDescribeInput(input: unknown): DescribeInput {
  const o = (input ?? {}) as Record<string, unknown>;
  return {
    attachmentKind: str(o["attachmentKind"], 20),
    attachmentName: str(o["attachmentName"], 120),
    caption: str(o["caption"], 500),
    extractedText: str(o["extractedText"], 4000),
  };
}

export function clampCompareInput(input: unknown): CompareInput {
  const o = (input ?? {}) as Record<string, unknown>;
  const others = Array.isArray(o["others"]) ? o["others"].slice(0, 30).map(clampBrief) : [];
  return { item: clampBrief(o["item"]), others };
}

/** Throws GatewayError (plain-words message) when the gateway cannot answer. */
export async function describeWithGateway(data: DescribeInput): Promise<DescribeOutput> {
  const user = `Attachment kind: ${data.attachmentKind}\nName: ${data.attachmentName}\nCaption from sender: ${data.caption || "(none)"}\nText read from the attachment:\n"""\n${data.extractedText || "(none)"}\n"""`;
  const a = (await askJson(DESCRIBE_SYSTEM, user)) as Record<string, unknown>;
  return {
    description: str(a["description"], 200),
    lane: str(a["lane"], 20),
    start: num(a["start"]),
    end: num(a["end"]),
    confidence: num(a["confidence"]) ?? 0,
  };
}

export async function compareWithGateway(data: CompareInput): Promise<CompareOutput> {
  const fmt = (i: ItemBrief) =>
    `- id: ${i.id}\n  lane: ${i.lane}, about ${i.start}s to ${i.end}s\n  source: ${i.source}\n  text: """${i.text}"""`;
  const user = `NEW item:\n${fmt(data.item)}\n\nOTHER filed items:\n${data.others.map(fmt).join("\n")}`;
  const a = (await askJson(COMPARE_SYSTEM, user)) as Record<string, unknown>;
  return {
    verdict: str(a["verdict"], 20),
    relatedId: typeof a["relatedId"] === "string" ? a["relatedId"] : null,
    reason: str(a["reason"], 400),
    confidence: num(a["confidence"]) ?? 0,
  };
}

/** Words an answer from the retrieved passages. Throws GatewayError when the model cannot answer. */
export const answerWithGateway: AnswerFn = async (input) => {
  const passages = input.passages
    .map((p, i) => `[${p.cite}]\n${str(p.text, 900)}`.replace(/^/, `${i + 1}. `))
    .join("\n\n");
  const history = input.history.length
    ? `Earlier questions from this person:\n${input.history.map((t) => `- ${str(t.question, 200)}`).join("\n")}\n\n`
    : "";
  const user = `${history}Question: ${str(input.question, 400)}\n\nPassages:\n${passages}`;
  // The model now and then returns something that is not valid JSON. Ask once more before giving up.
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const a = (await askJson(ANSWER_SYSTEM, `${user}${" ".repeat(attempt)}`)) as Record<
        string,
        unknown
      >;
      return str(a["answer"], 800);
    } catch (e) {
      lastError = e;
      if (!(e instanceof Error) || !/could not read/.test(e.message)) break;
    }
  }
  throw lastError;
};

const g = globalThis as { __caselensQa?: QaMemory };
const qaMemory = (g.__caselensQa ??= new QaMemory());

/** The pipeline's model, used where the pipeline runs on the server. */
export const gatewayLlm: AgentLlm = {
  describe: (input) => describeWithGateway(clampDescribeInput(input)),
  compare: (input) => compareWithGateway(clampCompareInput(input)),
  ask: (question, who) => answerQuestion(question, who, qaMemory, answerWithGateway),
};
