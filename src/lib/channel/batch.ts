import { isCommand } from "@/lib/agent/pipeline";
import type { InboundMessage } from "./types";

// People send a photo and then a caption, or two questions in a row, a second apart. Messages that
// arrive close together are handled as one batch and answered with one text.
//
// This turns a batch (in arrival order) into the messages the pipeline should see:
//   - plain texts that come before an attachment become that attachment's caption,
//   - other plain texts next to each other become one message,
//   - commands (CONFIRM, DISMISS, "what's missing") stay on their own, in order.

export function mergeBatch(batch: InboundMessage[]): InboundMessage[] {
  const out: InboundMessage[] = [];
  let pending: string[] = [];
  const base = batch[0];
  if (!base) return out;
  const carry = {
    ...(base.conversationId ? { conversationId: base.conversationId } : {}),
    ...(base.sender ? { sender: base.sender } : {}),
  };

  const flushText = () => {
    if (pending.length > 0) out.push({ ...carry, text: pending.join(" "), attachments: [] });
    pending = [];
  };

  for (const m of batch) {
    const text = m.text.trim();
    if (m.attachments.length > 0) {
      const caption = [...pending, text].filter(Boolean).join(" ");
      pending = [];
      out.push({ ...carry, text: caption, attachments: m.attachments });
    } else if (!text) {
      continue;
    } else if (isCommand(text)) {
      flushText();
      out.push({ ...carry, text, attachments: [] });
    } else {
      pending.push(text);
    }
  }
  flushText();
  return out;
}

/** Collects messages per key and releases them together after a short wait. */
export class Batcher<T> {
  private readonly open = new Map<string, { items: T[]; timer: ReturnType<typeof setTimeout> }>();

  constructor(
    private readonly windowMs: number,
    private readonly onFlush: (key: string, items: T[]) => void | Promise<void>,
  ) {}

  /** Adds an item. The window starts at the first item of a batch and is not extended. */
  add(key: string, item: T): void {
    const existing = this.open.get(key);
    if (existing) {
      existing.items.push(item);
      return;
    }
    const entry = {
      items: [item],
      timer: setTimeout(() => {
        this.open.delete(key);
        void this.onFlush(key, entry.items);
      }, this.windowMs),
    };
    this.open.set(key, entry);
  }

  /** Releases everything now (tests, shutdown). */
  flushAll(): void {
    for (const [key, entry] of [...this.open]) {
      clearTimeout(entry.timer);
      this.open.delete(key);
      void this.onFlush(key, entry.items);
    }
  }
}
