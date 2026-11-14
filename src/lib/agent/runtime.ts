import { compareItem, describeAttachment } from "@/lib/agent.functions";
import { getCase, setCase } from "@/lib/case-store";
import { SimulatedChannel } from "@/lib/channel/simulated";
import type { ChannelAdapter } from "@/lib/channel/types";
import type { AgentLlm } from "./pipeline";
import { connectAgent } from "./runner";

// The simulated channel in the page, wired to the pipeline with state in the browser case store.
// When the server runs Photon instead (see channel.server.ts), the page only mirrors the
// server's case state and this channel goes unused.

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

export const channel: ChannelAdapter = new SimulatedChannel();
connectAgent(channel, serverLlm, {
  get: getCase,
  update: setCase,
});
