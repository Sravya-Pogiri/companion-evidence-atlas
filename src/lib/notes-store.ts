import { useSyncExternalStore } from "react";

// Reviewer notes on timeline items. Like review decisions, they live in memory and in this
// browser's localStorage, so a reload keeps them during a demo.

export type Notes = Record<string, string>;

const KEY = "lexora-notes-v1";
const EMPTY: Notes = {};
let notes: Notes = EMPTY;
let hydrated = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) notes = parsed as Notes;
  } catch {
    // Ignore unreadable saved data.
  }
}

export function setNote(id: string, text: string): void {
  hydrate();
  const next = { ...notes };
  if (text.trim()) next[id] = text.trim();
  else delete next[id];
  notes = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(notes));
  } catch {
    // Storage can be missing or blocked; notes still work in memory.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!hydrated) {
    hydrate();
    queueMicrotask(emit);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function useNotes(): Notes {
  return useSyncExternalStore(
    subscribe,
    () => notes,
    () => EMPTY,
  );
}
