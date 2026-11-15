import { useMemo, useSyncExternalStore } from "react";
import type { PipelineState } from "@/lib/agent/pipeline";
import { setItemDueOnServer } from "@/lib/deadlines.functions";
import { CONVERSATION, ITEMS, type ChatMessage, type TimelineItem } from "@/lib/sample-case";

// The live case: timeline items and the conversation. It starts from the sample data and
// grows as evidence arrives through the message pipeline. Like the review store it lives in
// memory, so a page reload goes back to the sample case.

export interface CaseState extends PipelineState {
  messages: ChatMessage[];
  /** True while the agent is working on a message. */
  busy: boolean;
  /** Who runs the conversation: this page (simulated) or the server (Photon). */
  mode: "simulated" | "photon";
}

const INITIAL: CaseState = {
  items: ITEMS,
  messages: CONVERSATION,
  pendingId: null,
  busy: false,
  mode: "simulated",
};
let state: CaseState = INITIAL;
const listeners = new Set<() => void>();

export function getCase(): CaseState {
  return state;
}

export function setCase(patch: Partial<CaseState>): void {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function subscribeCase(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function appendMessage(message: Omit<ChatMessage, "id">): void {
  setCase({
    messages: [
      ...state.messages,
      { ...message, id: `m${state.messages.length + 1}-${Date.now().toString(36)}` },
    ],
  });
}

/**
 * Set or clear an item's deadline. The page updates at once. In Photon mode the case lives on
 * the server (reminders are sent from there), so the change is sent up too.
 */
export async function setItemDue(id: string, dueAt: string | null): Promise<void> {
  setCase({
    items: state.items.map((i) => {
      if (i.id !== id) return i;
      const { dueAt: _old, ...rest } = i;
      return dueAt ? { ...rest, dueAt } : rest;
    }),
  });
  if (state.mode !== "photon") return;
  try {
    await setItemDueOnServer({ data: { id, dueAt } });
  } catch {
    // The next poll shows what the server really has.
  }
}

export function resetCase(): void {
  state = INITIAL;
  listeners.forEach((l) => l());
}

export function useCase(): CaseState {
  return useSyncExternalStore(subscribeCase, getCase, () => INITIAL);
}

/** Timeline, Review, and Handoff only show items a person has filed. */
export function useFiledItems(): TimelineItem[] {
  const { items } = useCase();
  return useMemo(() => items.filter((i) => i.status === "filed"), [items]);
}
