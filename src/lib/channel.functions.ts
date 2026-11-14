import { createServerFn } from "@tanstack/react-start";
import type { ChatMessage, TimelineItem } from "@/lib/sample-case";

export type ChannelState =
  | { mode: "simulated"; note?: string }
  | {
      mode: "photon";
      items: TimelineItem[];
      messages: ChatMessage[];
      pendingId: string | null;
      busy: boolean;
    };

/**
 * Which channel is active, and for Photon the server's case state. The page calls this on a
 * timer in Photon mode so texts that arrive on the server show up on the timeline.
 */
export const getChannelState = createServerFn({ method: "GET" }).handler(
  async (): Promise<ChannelState> => {
    const { channelInfo, getPhotonRuntime } = await import("@/lib/server/channel.server");
    const info = channelInfo();
    const runtime = getPhotonRuntime();
    if (!runtime) return info.note ? { mode: "simulated", note: info.note } : { mode: "simulated" };
    const { items, messages, pendingId, busy } = runtime.state;
    return { mode: "photon", items, messages, pendingId, busy };
  },
);
