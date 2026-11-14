// Server only. Chooses the channel from env and, for Photon, holds the case state the page mirrors.
//
//   CASELENS_CHANNEL=simulated   (default) the page runs the conversation itself.
//   CASELENS_CHANNEL=photon      iMessage through Photon. Needs PHOTON_API_KEY, PHOTON_PROJECT_ID
//                                and PHOTON_WEBHOOK_SECRET. If any is missing it falls back to simulated.
//
// The state is in this server process's memory (kept across dev reloads). It is lost on restart,
// and a serverless host may run more than one copy. That is fine for a demo, not for production.
import { gatewayLlm } from "@/lib/agent/llm.server";
import type { PipelineState } from "@/lib/agent/pipeline";
import { connectAgent } from "@/lib/agent/runner";
import { PhotonChannel } from "@/lib/channel/photon.server";
import { CONVERSATION, ITEMS, type ChatMessage } from "@/lib/sample-case";

export type ChannelMode = "simulated" | "photon";

export interface ServerCaseState extends PipelineState {
  messages: ChatMessage[];
  busy: boolean;
}

interface PhotonRuntime {
  channel: PhotonChannel;
  webhookSecret: string;
  state: ServerCaseState;
  seenWebhookIds: Set<string>;
}

const g = globalThis as { __caselensPhoton?: PhotonRuntime | null };

export function channelInfo(): { mode: ChannelMode; note?: string } {
  const wanted = (process.env["CASELENS_CHANNEL"] ?? "simulated").trim().toLowerCase();
  if (wanted !== "photon") return { mode: "simulated" };
  const missing = ["PHOTON_API_KEY", "PHOTON_PROJECT_ID", "PHOTON_WEBHOOK_SECRET"].filter(
    (k) => !process.env[k],
  );
  if (missing.length > 0) return { mode: "simulated", note: `Photon needs ${missing.join(", ")}.` };
  return { mode: "photon" };
}

/** The Photon runtime, or null when the simulated channel is in use. */
export function getPhotonRuntime(): PhotonRuntime | null {
  if (channelInfo().mode !== "photon") return null;
  if (g.__caselensPhoton) return g.__caselensPhoton;

  const state: ServerCaseState = {
    items: ITEMS,
    messages: CONVERSATION,
    pendingId: null,
    busy: false,
  };
  const channel = new PhotonChannel(
    {
      apiKey: process.env["PHOTON_API_KEY"]!,
      projectId: process.env["PHOTON_PROJECT_ID"]!,
      webhookSecret: process.env["PHOTON_WEBHOOK_SECRET"]!,
      ...(process.env["PHOTON_API_URL"] ? { baseUrl: process.env["PHOTON_API_URL"] } : {}),
    },
    (m) => {
      state.messages = [
        ...state.messages,
        { ...m, id: `s${state.messages.length + 1}-${Date.now().toString(36)}` },
      ];
    },
  );
  connectAgent(channel, gatewayLlm, {
    get: () => ({ items: state.items, pendingId: state.pendingId }),
    update: (patch) => Object.assign(state, patch),
  });
  g.__caselensPhoton = {
    channel,
    webhookSecret: process.env["PHOTON_WEBHOOK_SECRET"]!,
    state,
    seenWebhookIds: new Set(),
  };
  return g.__caselensPhoton;
}
