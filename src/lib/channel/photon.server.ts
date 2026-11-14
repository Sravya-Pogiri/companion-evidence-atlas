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
  private context: ReplyContext | null = null;

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
    if (parsed.context) this.context = parsed.context;
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

    const ctx = this.context;
    if (!ctx) {
      console.error("photon: no conversation to reply to yet; the reply was not sent.");
      return;
    }
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
            parentMessageId: ctx.parentMessageId,
            content: { type: "text", format: "plain", text },
          }),
          signal: AbortSignal.timeout(10_000),
        },
      );
      // Accepted means queued for dispatch, not delivered.
      if (!response.ok) console.error(`photon: send failed with status ${response.status}.`);
    } catch {
      console.error("photon: send failed (no response).");
    }
  }
}
