// Server only. PhotonChannel: iMessage through Photon 2.0 (Beta).
//
// Inbound: Photon POSTs events to /api/photon/webhook, which calls handleInbound(). Only people on
// the team list (TEAM_NUMBERS) get an answer. Messages that arrive close together are batched and
// answered with one text. Photos, files and voice notes are downloaded with
// GET /v1/projects/{id}/attachments/{attachmentId}/content and read before the pipeline sees them.
// Outbound: sendReply() calls POST /v1/projects/{id}/messages, the endpoint the @photon-ai/api
// client wraps. Both are called with fetch so the app needs no new dependency.
import type { ChatMessage } from "@/lib/sample-case";
import { isTeamMember, NOT_ON_TEAM, normalizePhone } from "./allowlist";
import { Batcher, mergeBatch } from "./batch";
import { parseInboundEvent, type ReplyContext } from "./photon-events";
import {
  PlainError,
  type Attachment,
  type AttachmentKind,
  type ChannelAdapter,
  type InboundMessage,
  type MessageHandler,
  type ReplyMeta,
} from "./types";

const DEFAULT_BASE_URL = "https://api.photon.codes";
/** Files larger than this are not downloaded. */
const MAX_DOWNLOAD_BYTES = 12 * 1024 * 1024;

export interface PhotonConfig {
  apiKey: string;
  projectId: string;
  webhookSecret: string;
  baseUrl?: string;
}

/** Reads a downloaded file (vision, transcription). Throws a PlainError when it cannot. */
export type AttachmentReader = (
  bytes: Uint8Array,
  contentType: string,
  filename: string,
) => Promise<{ text: string; kind: AttachmentKind }>;

export interface PhotonOptions {
  /** The allowlist from TEAM_NUMBERS (see allowlist.ts). Empty lets nobody in. */
  team: Set<string>;
  /** How long to wait for more messages before answering, in ms. Default 5000. */
  batchMs?: number;
  reader?: AttachmentReader;
}

/** Where the server records the conversation, so the page can show it. */
export type ConversationLog = (message: Omit<ChatMessage, "id">) => void;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class PhotonChannel implements ChannelAdapter {
  readonly name = "photon";
  private handler: MessageHandler | null = null;
  /** Where to reply, per conversation (space), so two people never get each other's replies. */
  private readonly contexts = new Map<string, ReplyContext>();
  /** Numbers already told they are not on the team. They get that once, then silence. */
  private readonly strangers = new Set<string>();
  private readonly batcher: Batcher<InboundMessage>;
  private readonly inflight = new Set<Promise<void>>();
  /** While a batch is being answered, its replies collect here and go out as one text. */
  private readonly buffers = new Map<string, { texts: string[]; itemId?: string }>();

  constructor(
    private readonly config: PhotonConfig,
    private readonly log: ConversationLog,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly options: PhotonOptions = { team: new Set() },
  ) {
    this.batcher = new Batcher<InboundMessage>(this.options.batchMs ?? 5000, (key, items) => {
      const run = this.flush(key, items).finally(() => this.inflight.delete(run));
      this.inflight.add(run);
    });
  }

  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  /** Called by the webhook route with a verified event body. Returns why it was skipped, if it was. */
  async handleInbound(event: unknown): Promise<{ skipped?: string }> {
    const parsed = parseInboundEvent(event);
    if (!parsed.ok) return { skipped: parsed.reason };
    const { message, context } = parsed;

    if (!isTeamMember(message.sender, this.options.team)) {
      await this.turnAway(message, context);
      return { skipped: "not on the team" };
    }

    if (context) {
      this.contexts.set(context.spaceId, context);
      message.conversationId = context.spaceId;
    }
    this.logInbound(message);
    // Answer after the batch window, so the webhook itself returns at once.
    this.batcher.add(message.conversationId ?? message.sender ?? "line", message);
    return {};
  }

  /** Releases every waiting batch now and waits for the replies to be sent (tests, scripts, shutdown). */
  async flush(): Promise<void>;
  /** @internal */
  async flush(key: string, items: InboundMessage[]): Promise<void>;
  async flush(key?: string, items?: InboundMessage[]): Promise<void> {
    if (key === undefined || items === undefined) {
      this.batcher.flushAll();
      await Promise.all([...this.inflight]);
      return;
    }
    await this.answerBatch(key, items);
  }

  /** Not on the team: one polite refusal, then nothing. Nothing is downloaded, read or shown. */
  private async turnAway(message: InboundMessage, context: ReplyContext | null): Promise<void> {
    const who = (message.sender && normalizePhone(message.sender)) || message.sender || "";
    const key = who || context?.spaceId || "";
    if (!context || !key || this.strangers.has(key)) return;
    this.strangers.add(key);
    this.log({
      from: "team",
      text: "A message from a number that is not on the team list was ignored.",
    });
    this.log({ from: "agent", text: NOT_ON_TEAM });
    await this.post(context, NOT_ON_TEAM, true);
  }

  private logInbound(message: InboundMessage): void {
    const attachment = message.attachments[0];
    const text = attachment
      ? [attachment.name, message.text.trim()].filter(Boolean).join(": ")
      : message.text.trim();
    this.log({
      from: "team",
      text,
      ...(attachment
        ? { attachment: attachment.kind === "audio" ? ("voice" as const) : ("image" as const) }
        : {}),
    });
  }

  /** The ChannelAdapter entry point: log and handle one message straight away, with no batching. */
  async receiveMessage(message: InboundMessage): Promise<void> {
    this.logInbound(message);
    await this.handler?.(message);
  }

  private async answerBatch(key: string, items: InboundMessage[]): Promise<void> {
    const buffer: { texts: string[]; itemId?: string } = { texts: [] };
    this.buffers.set(key, buffer);
    try {
      for (const m of items) await this.readAttachments(m);
      for (const m of mergeBatch(items)) await this.handler?.(m);
    } catch {
      buffer.texts.push("Something went wrong on my side. Nothing was added from that message.");
    } finally {
      this.buffers.delete(key);
    }
    if (buffer.texts.length === 0) return;
    const text = buffer.texts.join("\n\n");
    this.log({ from: "agent", text, ...(buffer.itemId ? { itemId: buffer.itemId } : {}) });
    const ctx = this.contexts.get(key);
    if (!ctx) {
      console.error("photon: no conversation to send this reply to; it was not sent.");
      return;
    }
    await this.post(ctx, text, true);
  }

  async sendReply(text: string, meta?: ReplyMeta): Promise<void> {
    const buffer = meta?.conversationId ? this.buffers.get(meta.conversationId) : undefined;
    if (buffer) {
      buffer.texts.push(text);
      if (meta?.itemId) buffer.itemId = meta.itemId;
      return;
    }
    this.log({ from: "agent", text, ...(meta?.itemId ? { itemId: meta.itemId } : {}) });

    const ctx = meta?.conversationId ? this.contexts.get(meta.conversationId) : undefined;
    if (!ctx) {
      console.error("photon: no conversation to send this reply to; it was not sent.");
      return;
    }
    await this.post(ctx, text, true);
  }

  /**
   * Text everyone on the team who has texted the line, for example a deadline reminder. A shared
   * line can only message people who have texted it first, and who they are is remembered only
   * while the server runs, so after a restart this reaches nobody until they text again.
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

  // ---------- attachments ----------

  /** Downloads and reads each attachment. A failure is kept on the attachment in plain words. */
  private async readAttachments(message: InboundMessage): Promise<void> {
    for (const a of message.attachments) {
      if (a.extractedText) continue;
      if (!this.options.reader) {
        a.readError = "I can't read files on this line yet.";
        continue;
      }
      try {
        const file = await this.download(a.id);
        if (file.filename) a.name = file.filename;
        a.mimeType = file.contentType;
        const read = await this.options.reader(file.bytes, file.contentType, a.name);
        a.extractedText = read.text;
        a.kind = read.kind;
      } catch (e) {
        a.readError =
          e instanceof PlainError ? e.message : "I couldn't download or read that file.";
        console.error(`photon: could not read an attachment (${a.readError})`);
      }
    }
  }

  private async download(
    attachmentId: string,
  ): Promise<{ bytes: Uint8Array; contentType: string; filename: string | null }> {
    const base = `${this.config.baseUrl ?? DEFAULT_BASE_URL}/v1/projects/${encodeURIComponent(
      this.config.projectId,
    )}/attachments/${encodeURIComponent(attachmentId)}`;

    // Metadata first (name, type, size). It is optional: the content response has a type too.
    let filename: string | null = null;
    let contentType: string | null = null;
    try {
      const meta = (await (await this.get(base, 10_000)).json()) as {
        filename?: unknown;
        contentType?: unknown;
        sizeBytes?: unknown;
      };
      if (typeof meta.filename === "string") filename = meta.filename;
      if (typeof meta.contentType === "string") contentType = meta.contentType;
      if (typeof meta.sizeBytes === "number" && meta.sizeBytes > MAX_DOWNLOAD_BYTES) {
        throw new PlainError("That file is too large for me to read (over 12 MB).");
      }
    } catch (e) {
      if (e instanceof PlainError && /too large/.test(e.message)) throw e;
    }

    const response = await this.get(`${base}/content`, 30_000);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_DOWNLOAD_BYTES) {
      throw new PlainError("That file is too large for me to read (over 12 MB).");
    }
    return {
      bytes,
      contentType:
        response.headers.get("content-type")?.split(";")[0]?.trim() ||
        contentType ||
        "application/octet-stream",
      filename,
    };
  }

  /** GET with auth. Photon answers 409 while it is still fetching a file, so wait and retry. */
  private async get(url: string, timeoutMs: number): Promise<Response> {
    for (let attempt = 0; attempt < 4; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          headers: { Authorization: `Bearer ${this.config.apiKey}` },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new PlainError("I couldn't reach iMessage to download that file.");
      }
      if (response.ok) return response;
      if (response.status === 409 && attempt < 3) {
        const wait = Number(response.headers.get("retry-after"));
        await sleep(Math.min(Number.isFinite(wait) && wait > 0 ? wait * 1000 : 1000, 3000));
        continue;
      }
      console.error(`photon: attachment request failed with status ${response.status}.`);
      throw new PlainError(
        response.status === 409
          ? "iMessage hadn't finished receiving that file. Please send it again."
          : "I couldn't download that file from iMessage.",
      );
    }
    throw new PlainError("I couldn't download that file from iMessage.");
  }

  // ---------- sending ----------

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

export type { Attachment };
