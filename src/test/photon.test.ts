import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parseInboundEvent, verifyWebhook } from "@/lib/channel/photon-events";
import { PhotonChannel } from "@/lib/channel/photon.server";
import type { InboundMessage } from "@/lib/channel/types";

const KEY_BYTES = Buffer.from("a-test-signing-key-32-bytes-long!");
const SECRET = `whsec_${KEY_BYTES.toString("base64")}`;
const NOW = 1_800_000_000_000;
const TS = String(NOW / 1000);

function sign(id: string, ts: string, body: string): string {
  return `v1,${createHmac("sha256", KEY_BYTES).update(`${id}.${ts}.${body}`).digest("base64")}`;
}

describe("Photon webhook signature", () => {
  const body = '{"id":"evt_1","type":"message.received"}';

  it("accepts a correct signature, including among several", async () => {
    const good = sign("evt_1", TS, body);
    expect(
      await verifyWebhook(body, { id: "evt_1", timestamp: TS, signature: good }, SECRET, NOW),
    ).toBe(true);
    expect(
      await verifyWebhook(
        body,
        { id: "evt_1", timestamp: TS, signature: `v1,AAAA ${good}` },
        SECRET,
        NOW,
      ),
    ).toBe(true);
  });

  it("rejects a changed body, wrong secret, wrong id, and missing headers", async () => {
    const good = sign("evt_1", TS, body);
    expect(
      await verifyWebhook(body + " ", { id: "evt_1", timestamp: TS, signature: good }, SECRET, NOW),
    ).toBe(false);
    const other = `whsec_${Buffer.from("another-key").toString("base64")}`;
    expect(
      await verifyWebhook(body, { id: "evt_1", timestamp: TS, signature: good }, other, NOW),
    ).toBe(false);
    expect(
      await verifyWebhook(body, { id: "evt_2", timestamp: TS, signature: good }, SECRET, NOW),
    ).toBe(false);
    expect(
      await verifyWebhook(body, { id: null, timestamp: TS, signature: good }, SECRET, NOW),
    ).toBe(false);
    expect(
      await verifyWebhook(body, { id: "evt_1", timestamp: TS, signature: null }, SECRET, NOW),
    ).toBe(false);
  });

  it("rejects a timestamp more than five minutes off, either way", async () => {
    for (const offset of [-301, 301]) {
      const ts = String(NOW / 1000 + offset);
      expect(
        await verifyWebhook(
          body,
          { id: "evt_1", timestamp: ts, signature: sign("evt_1", ts, body) },
          SECRET,
          NOW,
        ),
      ).toBe(false);
    }
  });

  it("rejects a v2 signature and a malformed secret", async () => {
    const good = sign("evt_1", TS, body).replace("v1,", "v2,");
    expect(
      await verifyWebhook(body, { id: "evt_1", timestamp: TS, signature: good }, SECRET, NOW),
    ).toBe(false);
    expect(
      await verifyWebhook(
        body,
        { id: "evt_1", timestamp: TS, signature: sign("evt_1", TS, body) },
        "%%%",
        NOW,
      ),
    ).toBe(false);
  });
});

const human = (content: unknown, over: Record<string, unknown> = {}) => ({
  id: "msg_1",
  platform: "imessage",
  status: "received",
  sentBy: { id: "usr_1", kind: "human", handle: "+15550001111" },
  receivedBy: { id: "agt_1", kind: "agent" },
  space: { id: "spc_1", kind: "direct" },
  content,
  ...over,
});

describe("Photon inbound event mapping", () => {
  it("maps a text message and keeps where to reply", () => {
    const r = parseInboundEvent({
      id: "e1",
      type: "message.received",
      data: human({ type: "text", format: "plain", text: "Y" }),
    });
    expect(r).toEqual({
      ok: true,
      message: { text: "Y", attachments: [] },
      context: { spaceId: "spc_1", senderId: "agt_1", parentMessageId: "msg_1" },
    });
  });

  it("maps the real Beta envelope, where the message is at data.object", () => {
    const r = parseInboundEvent({
      id: "evt_01",
      apiVersion: "2026-07-01",
      type: "message.received",
      source: "imessage.photon",
      timestamp: "2026-11-14T19:54:32.223Z",
      data: {
        projectId: "pho_prj_1",
        object: {
          id: "msg_real",
          platform: "imessage",
          status: "received",
          content: { format: "plain", text: "Hello", type: "text" },
          sentBy: { kind: "human", handle: "+15550001111", id: "usr_1", details: {}, metadata: {} },
          receivedBy: {
            kind: "agent",
            handle: "+15550002222",
            id: "agt_1",
            details: { type: "shared" },
          },
          space: { kind: "direct", id: "spc_1", participantIds: ["usr_1"] },
          timestamps: { receivedAt: "2026-11-14T19:54:32.223Z" },
        },
      },
    });
    expect(r).toEqual({
      ok: true,
      message: { text: "Hello", attachments: [] },
      context: { spaceId: "spc_1", senderId: "agt_1", parentMessageId: "msg_real" },
    });
  });

  it("finds the message in the other likely places", () => {
    const content = { type: "text", format: "plain", text: "hi" };
    expect(parseInboundEvent({ data: { message: human(content) } })).toMatchObject({ ok: true });
    expect(parseInboundEvent(human(content))).toMatchObject({ ok: true });
  });

  it("passes an image on as an attachment with no extracted text", () => {
    const r = parseInboundEvent({ data: human({ type: "attachment", attachmentId: "pho_att_1" }) });
    expect(r).toMatchObject({
      ok: true,
      message: { text: "", attachments: [{ id: "pho_att_1", kind: "image" }] },
    });
    if (r.ok) expect(r.message.attachments[0]?.extractedText).toBeUndefined();
  });

  it("skips the agent's own messages, non-inbound status, other content, and non-messages", () => {
    const text = { type: "text", format: "plain", text: "x" };
    const agent = human(text, { sentBy: { id: "agt_1", kind: "agent" } });
    expect(parseInboundEvent({ data: agent })).toEqual({ ok: false, reason: "not from a person" });
    expect(parseInboundEvent({ data: human(text, { status: "accepted" }) })).toEqual({
      ok: false,
      reason: "not an inbound message",
    });
    expect(parseInboundEvent({ data: human({ type: "message.read" }) })).toMatchObject({
      ok: false,
    });
    expect(parseInboundEvent({ type: "webhook.ping", data: {} })).toEqual({
      ok: false,
      reason: "not a message event",
    });
    expect(parseInboundEvent("nonsense")).toMatchObject({ ok: false });
  });

  it("still processes a message with no reply context, but reports none", () => {
    const r = parseInboundEvent({
      data: human({ type: "text", format: "plain", text: "hi" }, { space: {} }),
    });
    expect(r).toMatchObject({ ok: true, context: null });
  });
});

describe("PhotonChannel", () => {
  const config = { apiKey: "pho_sk_test", projectId: "pho_prj_1", webhookSecret: SECRET };
  const event = { data: human({ type: "text", format: "plain", text: "What's missing?" }) };

  function setup(fetchImpl: typeof fetch) {
    const log: unknown[] = [];
    const channel = new PhotonChannel(config, (m) => log.push(m), fetchImpl);
    const received: InboundMessage[] = [];
    channel.onMessage(async (m) => {
      received.push(m);
    });
    return { channel, log, received };
  }

  it("hands an inbound text to the agent and records it in the conversation", async () => {
    const { channel, log, received } = setup(vi.fn() as unknown as typeof fetch);
    expect(await channel.handleInbound(event)).toEqual({});
    expect(received).toEqual([{ text: "What's missing?", attachments: [] }]);
    expect(log).toEqual([{ from: "team", text: "What's missing?" }]);
  });

  it("reports why an event was skipped without calling the agent", async () => {
    const { channel, received } = setup(vi.fn() as unknown as typeof fetch);
    expect(await channel.handleInbound({ data: {} })).toEqual({ skipped: "not a message event" });
    expect(received).toEqual([]);
  });

  it("sends a reply to the Photon messages endpoint with auth and an idempotency key", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const { channel, log } = setup(fetchMock as unknown as typeof fetch);
    await channel.handleInbound(event);
    await channel.sendReply("Possible gaps: none.", { itemId: "item-1" });

    expect(log.at(-1)).toEqual({ from: "agent", text: "Possible gaps: none.", itemId: "item-1" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.photon.codes/v1/projects/pho_prj_1/messages");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer pho_sk_test");
    expect(headers["idempotency-key"]).toMatch(/^caselens-/);
    expect(JSON.parse(init.body as string)).toEqual({
      spaceId: "spc_1",
      senderId: "agt_1",
      parentMessageId: "msg_1",
      content: { type: "text", format: "plain", text: "Possible gaps: none." },
    });
  });

  it("uses a new idempotency key for each reply", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const { channel } = setup(fetchMock as unknown as typeof fetch);
    await channel.handleInbound(event);
    await channel.sendReply("one");
    await channel.sendReply("two");
    const keys = fetchMock.mock.calls.map(
      (c) =>
        ((c as unknown as [string, RequestInit])[1].headers as Record<string, string>)[
          "idempotency-key"
        ],
    );
    expect(new Set(keys).size).toBe(2);
  });

  it("does not throw when sending fails, and still records the reply", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const bad = setup(
      vi.fn(async () => new Response("no", { status: 403 })) as unknown as typeof fetch,
    );
    await bad.channel.handleInbound(event);
    await expect(bad.channel.sendReply("hi")).resolves.toBeUndefined();
    const down = setup(
      vi.fn(async () => {
        throw new Error("network");
      }) as unknown as typeof fetch,
    );
    await down.channel.handleInbound(event);
    await expect(down.channel.sendReply("hi")).resolves.toBeUndefined();
    expect(bad.log.at(-1)).toMatchObject({ from: "agent", text: "hi" });
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it("does not call Photon when there is no conversation to reply to", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn();
    const { channel } = setup(fetchMock as unknown as typeof fetch);
    await channel.sendReply("hello?");
    expect(fetchMock).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
