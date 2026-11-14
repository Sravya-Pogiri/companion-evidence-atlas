import { createServerFn } from "@tanstack/react-start";
import { COMPARE_SYSTEM, DESCRIBE_SYSTEM, GatewayError, askJson } from "@/lib/agent/gateway.server";
import type {
  CompareInput,
  CompareOutput,
  DescribeInput,
  DescribeOutput,
  ItemBrief,
} from "@/lib/agent/pipeline";

// Server functions the message pipeline calls. They run on the server so the gateway key
// stays there. Inputs are size-limited and checked by hand; model answers are checked again
// by the pipeline before anything is filed.

type Result<T> = { ok: true; result: T } | { ok: false; error: string };

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function brief(v: unknown): ItemBrief {
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

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof GatewayError) return { ok: false, error: e.message };
  console.error("agent: unexpected error", e);
  return { ok: false, error: "The analysis service had a problem." };
}

export const describeAttachment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): DescribeInput => {
    const o = (input ?? {}) as Record<string, unknown>;
    return {
      attachmentKind: str(o["attachmentKind"], 20),
      attachmentName: str(o["attachmentName"], 120),
      caption: str(o["caption"], 500),
      extractedText: str(o["extractedText"], 4000),
    };
  })
  .handler(async ({ data }): Promise<Result<DescribeOutput>> => {
    try {
      const user = `Attachment kind: ${data.attachmentKind}\nName: ${data.attachmentName}\nCaption from sender: ${data.caption || "(none)"}\nText read from the attachment:\n"""\n${data.extractedText || "(none)"}\n"""`;
      const a = (await askJson(DESCRIBE_SYSTEM, user)) as Record<string, unknown>;
      return {
        ok: true,
        result: {
          description: str(a["description"], 200),
          lane: str(a["lane"], 20),
          start: num(a["start"]),
          end: num(a["end"]),
          confidence: num(a["confidence"]) ?? 0,
        },
      };
    } catch (e) {
      return fail(e);
    }
  });

export const compareItem = createServerFn({ method: "POST" })
  .inputValidator((input: unknown): CompareInput => {
    const o = (input ?? {}) as Record<string, unknown>;
    const others = Array.isArray(o["others"]) ? o["others"].slice(0, 30).map(brief) : [];
    return { item: brief(o["item"]), others };
  })
  .handler(async ({ data }): Promise<Result<CompareOutput>> => {
    try {
      const fmt = (i: ItemBrief) =>
        `- id: ${i.id}\n  lane: ${i.lane}, about ${i.start}s to ${i.end}s\n  source: ${i.source}\n  text: """${i.text}"""`;
      const user = `NEW item:\n${fmt(data.item)}\n\nOTHER filed items:\n${data.others.map(fmt).join("\n")}`;
      const a = (await askJson(COMPARE_SYSTEM, user)) as Record<string, unknown>;
      return {
        ok: true,
        result: {
          verdict: str(a["verdict"], 20),
          relatedId: typeof a["relatedId"] === "string" ? a["relatedId"] : null,
          reason: str(a["reason"], 400),
          confidence: num(a["confidence"]) ?? 0,
        },
      };
    } catch (e) {
      return fail(e);
    }
  });
