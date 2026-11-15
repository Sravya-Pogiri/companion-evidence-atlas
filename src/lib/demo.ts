import { getCase, setCase } from "@/lib/case-store";
import { CONVERSATION, ITEMS, type ChatMessage } from "@/lib/sample-case";

// The demo replays the seed conversation one message at a time. Each item lands on the
// timeline when the agent files it. It only touches the in-page case store, and it can be
// paused and resumed.

interface Step {
  message: string;
  /** Items that land on the timeline with this message. */
  file?: string[];
}

/**
 * The script follows the loaded conversation: each agent reply files the item it is about and
 * the items compared with it; anything left is filed with the last reply. So the demo shows the
 * same findings as the case, whether they come from the evidence analysis or the sample.
 */
function buildScript(): Step[] {
  const filed = new Set<string>();
  const steps: Step[] = CONVERSATION.map((m) => {
    if (m.from !== "agent" || !m.itemId) return { message: m.id };
    const item = ITEMS.find((i) => i.id === m.itemId);
    const ids = ITEMS.filter(
      (i) => !filed.has(i.id) && (i.id === m.itemId || i.relatedId === m.itemId || i.id === item?.relatedId),
    ).map((i) => i.id);
    ids.forEach((id) => filed.add(id));
    return { message: m.id, file: ids };
  });
  const rest = ITEMS.filter((i) => !filed.has(i.id)).map((i) => i.id);
  const last = [...steps].reverse().find((s) => s.file);
  if (rest.length) {
    if (last) last.file = [...(last.file ?? []), ...rest];
    else if (steps.length) steps[steps.length - 1]!.file = rest;
  }
  return steps;
}

const TEAM_GAP = 1300;
const TYPING = 1100;

export interface DemoController {
  pause(): void;
  resume(): void;
  /** Stops for good. Unless the demo finished, the full sample case is put back. */
  stop(): void;
}

interface Event {
  at: number;
  run: () => void;
}

function buildEvents(onDone: () => void): Event[] {
  const byId = new Map<string, ChatMessage>(CONVERSATION.map((m) => [m.id, m]));
  const order = new Map(ITEMS.map((i, n) => [i.id, n]));
  const events: Event[] = [];
  let at = 700;
  for (const step of buildScript()) {
    const message = byId.get(step.message);
    if (!message) continue;
    if (message.from === "agent") {
      events.push({ at, run: () => setCase({ busy: true }) });
      at += TYPING;
    }
    events.push({
      at,
      run: () => {
        const s = getCase();
        const filed = step.file ? ITEMS.filter((i) => step.file!.includes(i.id)) : [];
        const items = [...s.items, ...filed].sort(
          (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0),
        );
        setCase({ messages: [...s.messages, message], items, busy: false });
      },
    });
    at += message.from === "agent" ? TEAM_GAP + 400 : TEAM_GAP;
  }
  events.push({ at, run: onDone });
  return events;
}

export function startDemo(onDone: () => void): DemoController {
  let finished = false;
  const events = buildEvents(() => {
    finished = true;
    onDone();
  });
  let next = 0;
  let elapsed = 0;
  let startedAt = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];

  const schedule = () => {
    startedAt = Date.now();
    timers = events.slice(next).map((e) =>
      setTimeout(
        () => {
          next += 1;
          e.run();
        },
        Math.max(0, e.at - elapsed),
      ),
    );
  };
  const clear = () => {
    timers.forEach(clearTimeout);
    timers = [];
  };

  setCase({ items: [], messages: [], pendingId: null, busy: false });
  schedule();

  return {
    pause() {
      if (timers.length === 0) return;
      clear();
      elapsed += Date.now() - startedAt;
    },
    resume() {
      if (timers.length > 0 || finished) return;
      schedule();
    },
    stop() {
      clear();
      if (!finished) {
        setCase({ items: ITEMS, messages: CONVERSATION, pendingId: null, busy: false });
      }
    },
  };
}
