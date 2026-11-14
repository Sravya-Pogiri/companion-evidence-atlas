import type { InboundMessage } from "./types";

// Pure helpers for Photon 2.0 (Beta) webhooks: signature check and mapping an inbound event
// to an InboundMessage. No env and no network, so they can be tested without Photon.
//
// Confirmed against a real event from the Beta API (2026-07-01): the envelope is
//   { id, apiVersion, type: "message.received", source: "imessage.photon", timestamp,
//     data: { object: <message>, projectId } }
// and the message has id, platform, status ("received"), content, sentBy { kind: "human" },
// receivedBy { id, kind: "agent" } and space { id }. Text content is { type: "text", text }.
// Not yet seen: how an image arrives. Docs say { type: "attachment", attachmentId }.
// The mapper still checks a few other places for the message so a version change fails soft.

const TOLERANCE_SECONDS = 5 * 60;

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface WebhookHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

/**
 * Standard Webhooks: HMAC-SHA256 over `${id}.${timestamp}.${rawBody}` with the base64-decoded
 * secret (after the `whsec_` prefix). The signature header holds space-separated `v1,<base64>`.
 * The raw body must be the exact text Photon sent.
 */
export async function verifyWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  nowMs: number = Date.now(),
): Promise<boolean> {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > TOLERANCE_SECONDS) return false;

  let key: Uint8Array<ArrayBuffer>;
  try {
    key = base64ToBytes(secret.replace(/^whsec_/, ""));
  } catch {
    return false;
  }
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`),
  );
  const expected = bytesToBase64(new Uint8Array(mac));

  return signature
    .split(" ")
    .map((part) => part.split(","))
    .some(([version, sig]) => version === "v1" && sig !== undefined && safeEqual(sig, expected));
}

/** Where to send the reply. */
export interface ReplyContext {
  spaceId: string;
  /** The agent's own id (the message's receivedBy.id). */
  senderId: string;
  parentMessageId: string;
}

export type ParsedEvent =
  | { ok: true; message: InboundMessage; context: ReplyContext | null }
  | { ok: false; reason: string };

type Rec = Record<string, unknown>;
const rec = (v: unknown): Rec =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {};
const text = (v: unknown): string => (typeof v === "string" ? v : "");

const looksLikeMessage = (o: Rec) => "content" in o && "sentBy" in o;

export function parseInboundEvent(event: unknown): ParsedEvent {
  const e = rec(event);
  const data = rec(e["data"]);
  const found = [rec(data["object"]), data, rec(data["message"]), e].find(looksLikeMessage);
  if (!found) return { ok: false, reason: "not a message event" };

  // Only messages from a person. Messages the agent sent can come back through the same feed.
  if (text(rec(found["sentBy"])["kind"]) !== "human")
    return { ok: false, reason: "not from a person" };
  const status = text(found["status"]);
  if (status && status !== "received") return { ok: false, reason: "not an inbound message" };

  const content = rec(found["content"]);
  const kind = text(content["type"]);
  let message: InboundMessage;
  if (kind === "text") {
    message = { text: text(content["text"]), attachments: [] };
  } else if (kind === "attachment") {
    // Beta iMessage carries text and images only, and the docs don't say how to read an
    // image yet. Pass it on as an attachment with no extracted text, so the agent says so.
    message = {
      text: "",
      attachments: [
        {
          id: text(content["attachmentId"]) || text(found["id"]),
          kind: "image",
          name: "Image from iMessage",
        },
      ],
    };
  } else {
    return { ok: false, reason: `unsupported content type "${kind}"` };
  }

  const spaceId = text(rec(found["space"])["id"]);
  const senderId = text(rec(found["receivedBy"])["id"]);
  const parentMessageId = text(found["id"]);
  const context =
    spaceId && senderId && parentMessageId ? { spaceId, senderId, parentMessageId } : null;
  return { ok: true, message, context };
}
