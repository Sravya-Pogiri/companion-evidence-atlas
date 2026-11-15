// Server only. PhotonChannel: iMessage through Photon 2.0 (Beta).
//
// Inbound: Photon POSTs events to /api/photon/webhook, which calls handleInbound().
// Outbound: sendReply() calls Photon's send-message endpoint, POST /v1/projects/{id}/messages,
// the same endpoint the @photon-ai/api client wraps (src/generated/sdk.gen.ts in v0.6.0). It is
// called with fetch so the app needs no new dependency; swapping in the client is a one-function change.
import type { ChatMessage } from "@/lib/sample-case";
import { parseInboundEvent, type ReplyContext } from "./photon-events";
import type { ChannelAdapter, InboundMessage, MessageHandler, ReplyMeta } from "./types";

const DEFAULT_BASE_URL = "https://api.photon.codes";

export interface PhotonConfig {
  apiKey: string;
  projectId: string;
  webhookSecret: string;
  baseUrl?: string;
}

/** Where the server records the conversation, so the page can show it. */
export type ConversationLog = (message: Omit<ChatMessage, "id">) => void;

export class PhotonChannel implements ChannelAdapter {
  readonly name = "photon";
  private handler: MessageHandler | null = null;
  /** Where to reply, per conversation (space), so two people never get each other's replies. */
  private readonly contexts = new Map<string, ReplyContext>();

  constructor(
    private readonly config: PhotonConfig,
    private readonly log: ConversationLog,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  /** Called by the webhook route with a verified event body. Returns why it was skipped, if it was. */
  async handleInbound(event: unknown): Promise<{ skipped?: string }> {
    const parsed = parseInboundEvent(event);
    if (!parsed.ok) return { skipped: parsed.reason };
    if (parsed.context) {
      this.contexts.set(parsed.context.spaceId, parsed.context);
      parsed.message.conversationId = parsed.context.spaceId;
    }
    await this.receiveMessage(parsed.message);
    return {};
  }

  async receiveMessage(message: InboundMessage): Promise<void> {
    const attachment = message.attachments[0];
    const text = attachment
      ? [attachment.name, message.text.trim()].filter(Boolean).join(": ")
      : message.text.trim();
    this.log({ from: "team", text, ...(attachment ? { attachment: "image" as const } : {}) });
    await this.handler?.(message);
  }

  async sendReply(text: string, meta?: ReplyMeta): Promise<void> {
    this.log({ from: "agent", text, ...(meta?.itemId ? { itemId: meta.itemId } : {}) });

    const ctx = meta?.conversationId ? this.contexts.get(meta.conversationId) : undefined;
    if (!ctx) {
      console.error("photon: no conversation to send this reply to; it was not sent.");
      return;
    }
    await this.post(ctx, text, true);
  }

  /**
   * Text everyone who has texted the line, for example a deadline reminder. A shared line can
   * only message people who have texted it first, and who they are is remembered only while the
   * server runs, so after a restart this reaches nobody until they text again.
   */
  async notifyAll(text: string): Promise<{ recipients: number; accepted: number }> {
    const contexts = [...this.contexts.values()];
    if (contexts.length === 0) return { recipients: 0, accepted: 0 };
    this.log({ from: "agent", text });
    let accepted = 0;
    for (const ctx of contexts) {
      if (await this.post(ctx, text, false)) accepted += 1;
    }
    return { recipients: contexts.length, accepted };
  }

  /** Send one text to one conversation. Returns whether Photon accepted it (queued, not delivered). */
  private async post(ctx: ReplyContext, text: string, threaded: boolean): Promise<boolean> {
    try {
      const response = await this.fetchImpl(
        `${this.config.baseUrl ?? DEFAULT_BASE_URL}/v1/projects/${encodeURIComponent(this.config.projectId)}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.apiKey}`,
            "idempotency-key": `caselens-${crypto.randomUUID()}`,
          },
          body: JSON.stringify({
            spaceId: ctx.spaceId,
            senderId: ctx.senderId,
            ...(threaded ? { parentMessageId: ctx.parentMessageId } : {}),
            content: { type: "text", format: "plain", text },
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      if (!response.ok) console.error(`photon: send failed with status ${response.status}.`);
      return response.ok;
    } catch {
      console.error("photon: send failed (no response).");
      return false;
    }
  }
}
