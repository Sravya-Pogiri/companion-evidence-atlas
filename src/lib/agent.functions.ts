import { createServerFn } from "@tanstack/react-start";
import { GatewayError } from "@/lib/agent/gateway.server";
import {
  clampCompareInput,
  clampDescribeInput,
  compareWithGateway,
  describeWithGateway,
} from "@/lib/agent/llm.server";
import type { CompareOutput, DescribeOutput } from "@/lib/agent/pipeline";

// Server functions the in-page (simulated) pipeline calls. They run on the server so the
// gateway key stays there. Inputs are size-limited; model answers are checked again by the
// pipeline before anything is filed.

type Result<T> = { ok: true; result: T } | { ok: false; error: string };

function fail(e: unknown): { ok: false; error: string } {
  if (e instanceof GatewayError) return { ok: false, error: e.message };
  console.error("agent: unexpected error", e);
  return { ok: false, error: "The analysis service had a problem." };
}

export const describeAttachment = createServerFn({ method: "POST" })
  .inputValidator(clampDescribeInput)
  .handler(async ({ data }): Promise<Result<DescribeOutput>> => {
    try {
      return { ok: true, result: await describeWithGateway(data) };
    } catch (e) {
      return fail(e);
    }
  });

export const compareItem = createServerFn({ method: "POST" })
  .inputValidator(clampCompareInput)
  .handler(async ({ data }): Promise<Result<CompareOutput>> => {
    try {
      return { ok: true, result: await compareWithGateway(data) };
    } catch (e) {
      return fail(e);
    }
  });
