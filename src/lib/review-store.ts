import { useSyncExternalStore } from "react";
import type { ReviewDecision } from "@/lib/sample-case";

// Review decisions are shared by the Review and Handoff pages. They live in memory
// and in this browser's localStorage so a reload keeps them during a demo.

export type Decisions = Record<string, ReviewDecision>;

const KEY = "caselens-review-v1";
const EMPTY: Decisions = {};
let decisions: Decisions = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(decisions));
  } catch {
    // Storage can be missing or blocked; decisions still work in memory.
  }
}

export function getDecisions(): Decisions {
  return decisions;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Choose a decision for an item; choosing the same one again clears it. */
export function decide(id: string, decision: ReviewDecision): void {
  const next = { ...decisions };
  if (next[id] === decision) delete next[id];
  else next[id] = decision;
  decisions = next;
  persist();
  emit();
}

/** Load saved decisions after the first client render so server and client markup match. */
export function hydrateDecisions(): void {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      decisions = parsed as Decisions;
      emit();
    }
  } catch {
    // Ignore unreadable saved data.
  }
}

export function resetDecisions(): void {
  decisions = EMPTY;
  persist();
  emit();
}

export function useDecisions(): Decisions {
  return useSyncExternalStore(subscribe, getDecisions, () => EMPTY);
}
