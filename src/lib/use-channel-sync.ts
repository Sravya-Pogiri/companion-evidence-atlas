import { useEffect } from "react";
import { getChannelState } from "@/lib/channel.functions";
import { ACTIVE_CASE } from "@/lib/active-case";
import { getCase, setCase } from "@/lib/case-store";

const POLL_MS = 2000;

/**
 * Asks the server which channel is active. In Photon mode the conversation happens on the
 * server, so this keeps the page's case state in step with it. In simulated mode it asks once.
 */
export function useChannelSync(): void {
  useEffect(() => {
    // The server and the Photon channel hold the Rosales case only.
    if (ACTIVE_CASE !== "rosales") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      let again = false;
      try {
        const s = await getChannelState();
        if (stopped) return;
        if (s.mode === "photon") {
          setCase({
            mode: "photon",
            items: s.items,
            messages: s.messages,
            pendingId: s.pendingId,
            busy: s.busy,
          });
          again = true;
        } else if (getCase().mode !== "simulated") {
          setCase({ mode: "simulated" });
        }
      } catch {
        again = getCase().mode === "photon"; // a blip: keep trying while mirroring the server
      }
      if (again && !stopped) timer = setTimeout(tick, POLL_MS);
    };
    void tick();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
}
