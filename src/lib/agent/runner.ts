import type { ChannelAdapter, InboundMessage, ReplyMeta } from "@/lib/channel/types";
import { handleMessage, type AgentLlm, type PipelineState } from "./pipeline";

/** Where the case state lives: the browser store for the simulated channel, a server store for Photon. */
export interface CaseStateStore {
  get(): PipelineState;
  update(patch: Partial<PipelineState> & { busy?: boolean }): void;
}

/** Wires a channel to the pipeline. Messages are handled one at a time, in order. */
export function connectAgent(channel: ChannelAdapter, llm: AgentLlm, store: CaseStateStore): void {
  let queue: Promise<void> = Promise.resolve();

  const run = async (message: InboundMessage) => {
    // Every reply goes back to the conversation the message came from, not to whoever texted last.
    const to: ReplyMeta = message.conversationId ? { conversationId: message.conversationId } : {};
    store.update({ busy: true });
    try {
      const { items, pendingId, pendingFor } = store.get();
      const result = await handleMessage(
        { items, pendingId, pendingFor: pendingFor ?? null },
        message,
        llm,
      );
      store.update({
        items: result.state.items,
        pendingId: result.state.pendingId,
        pendingFor: result.state.pendingFor ?? null,
      });
      for (const reply of result.replies) {
        await channel.sendReply(reply.text, {
          ...to,
          ...(reply.itemId ? { itemId: reply.itemId } : {}),
        });
      }
    } catch {
      await channel.sendReply(
        "Something went wrong on my side. Nothing was filed from that message.",
        to,
      );
    } finally {
      store.update({ busy: false });
    }
  };

  // A "Y" never overtakes the attachment it answers.
  channel.onMessage((message) => {
    queue = queue.then(() => run(message));
    return queue;
  });
}
