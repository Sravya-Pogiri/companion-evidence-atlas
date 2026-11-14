import { compareItem, describeAttachment } from "@/lib/agent.functions";
import { getCase, setCase } from "@/lib/case-store";
import { SimulatedChannel } from "@/lib/channel/simulated";
import type { ChannelAdapter, InboundMessage } from "@/lib/channel/types";
import { handleMessage, type AgentLlm } from "./pipeline";

// Wires a channel to the pipeline in the page: one message at a time, state kept in the case store.

/** The model, reached through server functions so the gateway key stays on the server. */
export const serverLlm: AgentLlm = {
  async describe(input) {
    const r = await describeAttachment({ data: input });
    if (!r.ok) throw new Error(r.error);
    return r.result;
  },
  async compare(input) {
    const r = await compareItem({ data: input });
    if (!r.ok) throw new Error(r.error);
    return r.result;
  },
};

export function connectAgent(channel: ChannelAdapter, llm: AgentLlm): void {
  let queue: Promise<void> = Promise.resolve();

  const run = async (message: InboundMessage) => {
    setCase({ busy: true });
    try {
      const { items, pendingId } = getCase();
      const result = await handleMessage({ items, pendingId }, message, llm);
      setCase({ items: result.state.items, pendingId: result.state.pendingId });
      for (const reply of result.replies)
        await channel.sendReply(reply.text, reply.itemId ? { itemId: reply.itemId } : undefined);
    } catch {
      await channel.sendReply(
        "Something went wrong on my side. Nothing was filed from that message.",
      );
    } finally {
      setCase({ busy: false });
    }
  };

  // Messages are handled in order, so a "Y" never overtakes the attachment it answers.
  channel.onMessage((message) => {
    queue = queue.then(() => run(message));
    return queue;
  });
}

/** The channel the Live Case page uses. Phase 4 adds Photon behind an env var. */
export const channel: ChannelAdapter = new SimulatedChannel();
connectAgent(channel, serverLlm);
