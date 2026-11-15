import { useEffect } from "react";
import { getChannelState } from "@/lib/channel.functions";
import { ACTIVE_CASE } from "@/lib/active-case";
import { getCase, setCase } from "@/lib/case-store";
import { DEFAULT_CASE_ID } from "@/lib/cases";
import { syncDecisions } from "@/lib/deadlines.functions";
import { getDecisions, subscribe } from "@/lib/review-store";

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
          // The server holds the Rosales case, so only mirror it while that case is on screen.
          if (getCase().caseId === DEFAULT_CASE_ID) {
            setCase({
              mode: "photon",
              items: s.items,
              messages: s.messages,
              pendingId: s.pendingId,
              busy: s.busy,
            });
          } else if (getCase().mode !== "photon") {
            setCase({ mode: "photon" });
          }
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

    // In Photon mode the server sends deadline reminders, so it needs to know which items a
    // person already confirmed or dismissed. Send the decisions up when they change.
    let push: ReturnType<typeof setTimeout> | undefined;
    const pushDecisions = () => {
      if (getCase().mode !== "photon") return;
      syncDecisions({ data: getDecisions() }).catch(() => {});
    };
    const unsubscribe = subscribe(() => {
      if (push) clearTimeout(push);
      push = setTimeout(pushDecisions, 300);
    });
    const first = setTimeout(pushDecisions, 2500); // once the mode is known

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      if (push) clearTimeout(push);
      clearTimeout(first);
      unsubscribe();
    };
  }, []);
}
