import { describe, expect, it, vi } from "vitest";
import { buildRosalesPassages, retrieve } from "@/lib/agent/case-knowledge";
import { handleMessage, type AgentLlm, type PipelineState } from "@/lib/agent/pipeline";
import {
  answerQuestion,
  extractiveAnswer,
  NOT_IN_FILES,
  QaMemory,
  validateAnswer,
} from "@/lib/agent/qa";
import { connectAgent } from "@/lib/agent/runner";
import {
  isTeamMember,
  normalizePhone,
  NOT_ON_TEAM,
  parseTeamNumbers,
} from "@/lib/channel/allowlist";
import { mergeBatch } from "@/lib/channel/batch";
import { parseInboundEvent } from "@/lib/channel/photon-events";
import { PhotonChannel } from "@/lib/channel/photon.server";
import { PlainError } from "@/lib/channel/types";
import { SAMPLE_ITEMS as ITEMS } from "@/lib/sample-case";

const ME = "+17207224393";

describe("team allowlist", () => {
  it("matches a number in any common format", () => {
    const team = parseTeamNumbers("(720) 722-4393, +1 415 555 0101");
    for (const h of ["+17207224393", "720-722-4393", "7207224393", "+1 (415) 555-0101"]) {
      expect(isTeamMember(h, team), h).toBe(true);
    }
    expect(isTeamMember("+17207224394", team)).toBe(false);
    expect(isTeamMember("", team)).toBe(false);
    expect(isTeamMember(undefined, team)).toBe(false);
  });

  it("accepts a space-separated list and iMessage emails", () => {
    const team = parseTeamNumbers("7207224393 4155550101\nAnna@Example.com");
    expect(team.size).toBe(3);
    expect(isTeamMember("anna@example.com", team)).toBe(true);
  });

  it("lets nobody in when the list is empty", () => {
    expect(isTeamMember(ME, parseTeamNumbers(""))).toBe(false);
    expect(isTeamMember(ME, parseTeamNumbers(undefined))).toBe(false);
    expect(normalizePhone("12")).toBeNull();
  });
});

describe("message batches", () => {
  const m = (text: string, attachments: InboundMessageAttachments = []) => ({
    text,
    attachments,
    conversationId: "spc_1",
    sender: ME,
  });
  type InboundMessageAttachments = { id: string; kind: "image"; name: string }[];
  const photo = [{ id: "a1", kind: "image" as const, name: "Photo" }];

  it("turns texts before a photo into its caption", () => {
    const out = mergeBatch([m("this is from the bodycam"), m("", photo)]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ text: "this is from the bodycam", conversationId: "spc_1" });
    expect(out[0]?.attachments).toHaveLength(1);
  });

  it("attaches a caption that arrives after its photo", () => {
    const out = mergeBatch([m("", photo), m("Dashcam, from 0:45")]);
    expect(out).toHaveLength(1);
    expect(out[0]?.text).toBe("Dashcam, from 0:45");
    expect(out[0]?.attachments).toHaveLength(1);
  });

  it("does not take a question as a caption", () => {
    const out = mergeBatch([m("", photo), m("why were they pulled over?")]);
    expect(out.map((x) => [x.text, x.attachments.length])).toEqual([
      ["", 1],
      ["why were they pulled over?", 0],
    ]);
  });

  it("joins neighbouring free texts, and keeps questions and commands apart, in order", () => {
    const out = mergeBatch([
      m("Dashcam shows the left signal"),
      m("coming on at 0:55"),
      m("what about the bodycam?"),
      m("and the dashcam?"),
      m("confirm"),
      m("what's missing"),
    ]);
    expect(out.map((x) => x.text)).toEqual([
      "Dashcam shows the left signal coming on at 0:55",
      "what about the bodycam?",
      "and the dashcam?",
      "confirm",
      "what's missing",
    ]);
  });
});

describe("Photon voice, group and sender mapping", () => {
  const base = {
    id: "msg_1",
    status: "received",
    sentBy: { kind: "human", id: "u", handle: ME },
    receivedBy: { kind: "agent", id: "agt" },
    space: { id: "spc_1" },
  };

  it("maps a voice note to an audio attachment", () => {
    const r = parseInboundEvent({
      data: { ...base, content: { type: "voice", attachmentId: "pho_att_v" } },
    });
    expect(r).toMatchObject({
      ok: true,
      message: { sender: ME, attachments: [{ id: "pho_att_v", kind: "audio" }] },
    });
  });

  it("maps a group of text and photos", () => {
    const r = parseInboundEvent({
      data: {
        ...base,
        content: {
          type: "group",
          parts: [
            { type: "text", text: "two photos" },
            { type: "attachment", attachmentId: "pho_att_1" },
            { content: { type: "attachment", attachmentId: "pho_att_2" } },
          ],
        },
      },
    });
    expect(r).toMatchObject({ ok: true, message: { text: "two photos" } });
    if (r.ok) expect(r.message.attachments.map((a) => a.id)).toEqual(["pho_att_1", "pho_att_2"]);
  });
});

describe("case files", () => {
  it("cuts the Rosales files into cited passages", () => {
    const cites = new Set(buildRosalesPassages().map((p) => p.cite));
    expect(cites.has("Complaint p.24 ¶208")).toBe(true);
    expect([...cites].some((c) => /^Dashcam \d+:\d{2}$/.test(c))).toBe(true);
    expect([...cites].some((c) => /^Bodycam \d+:\d{2}$/.test(c))).toBe(true);
  });

  it("finds the stated reason for the stop and the missing dispatch audio", () => {
    expect(
      retrieve("Why were they pulled over?")
        .map((p) => p.text.toLowerCase())
        .join(" "),
    ).toContain("failed to signal");
    expect(retrieve("is there dispatch audio?")[0]?.cite).toMatch(/dispatch audio/i);
  });

  it("looks in the source a follow-up names", () => {
    const q = "Why were they pulled over? what about the bodycam?";
    const hits = retrieve(q, undefined, 6, "what about the bodycam?");
    expect(hits[0]?.cite).toMatch(/^Bodycam /);
    expect(hits.filter((h) => h.cite.startsWith("Bodycam")).length).toBeGreaterThanOrEqual(2);
  });

  it("finds nothing for a question the files do not cover", () => {
    expect(retrieve("What is the capital of France?")).toEqual([]);
  });
});

describe("answering from the case files", () => {
  const cites = ["Complaint p.24 ¶208", "Dashcam 0:45"];

  it("accepts a short, cited, hedged answer", () => {
    const a =
      "The complaint says the stop was for failure to signal (Complaint p.24 ¶208). The dashcam appears to show the signal on (Dashcam 0:45).";
    expect(validateAnswer(a, cites)).toBe(a);
  });

  it("accepts the model saying the files do not have it", () => {
    expect(validateAnswer("I don't see that in the case files.", cites)).toBe(NOT_IN_FILES);
  });

  it.each([
    [
      "a sentence with no citation",
      "The stop was for failure to signal (Complaint p.24 ¶208). It may be more.",
    ],
    [
      "a citation that was not retrieved",
      "The stop was for failure to signal (Complaint p.99 ¶1).",
    ],
    ["a legal conclusion", "The stop was illegal (Complaint p.24 ¶208)."],
    ["too many sentences", Array(5).fill("It appears so (Dashcam 0:45).").join(" ")],
    ["an empty answer", "  "],
  ])("rejects %s", (_why, answer) => {
    expect(validateAnswer(answer, cites)).toBeNull();
  });

  it("uses a valid model answer, and quotes the files when it breaks a rule", async () => {
    const memory = new QaMemory();
    const good = vi.fn(
      async () => "The stop appears to have been for failure to signal (Complaint p.21 ¶168).",
    );
    expect(await answerQuestion("Why were they pulled over?", "A", memory, good)).toContain(
      "(Complaint p.21 ¶168)",
    );
    const bad = vi.fn(async () => "They were pulled over illegally.");
    expect(await answerQuestion("Why were they pulled over?", "A", memory, bad)).toMatch(
      /^Closest match in the files:/,
    );
    const down = vi.fn(async () => {
      throw new Error("down");
    });
    expect(await answerQuestion("Why were they pulled over?", "A", memory, down)).toMatch(
      /^Closest match/,
    );
  });

  it("says it does not see it, without calling the model, when nothing matches", async () => {
    const ask = vi.fn();
    expect(await answerQuestion("What is the capital of France?", "A", new QaMemory(), ask)).toBe(
      NOT_IN_FILES,
    );
    expect(ask).not.toHaveBeenCalled();
  });

  it("keeps a short memory per person so a follow-up works", async () => {
    const memory = new QaMemory();
    const seen: string[] = [];
    const ask = async (i: {
      question: string;
      history: { question: string }[];
      passages: { cite: string }[];
    }) => {
      seen.push(`${i.history.map((h) => h.question).join("|")} => ${i.question}`);
      return `It appears so (${i.passages[0]!.cite}).`;
    };
    await answerQuestion("Did the dashcam show the left signal?", "A", memory, ask);
    await answerQuestion("what about the bodycam?", "A", memory, ask);
    await answerQuestion("Did the dashcam show the left signal?", "B", memory, ask);
    expect(seen[1]).toBe("Did the dashcam show the left signal? => what about the bodycam?");
    // B has asked nothing before, so A's questions are not in B's history.
    expect(seen[2]).toBe(" => Did the dashcam show the left signal?");
  });

  it("skips passages that state conclusions when quoting", () => {
    const text = extractiveAnswer([
      { cite: "X", text: "The stop was unlawful.", kind: "claim", score: 3 },
      { cite: "Y", text: "The signal appears on.", kind: "claim", score: 2 },
    ]);
    expect(text).toContain("(Y)");
    expect(text).not.toContain("unlawful");
  });
});

// ---------- the whole line, with Photon and the model faked ----------

const SPACE = "spc_1";
const inbound = (content: unknown, over: Record<string, unknown> = {}) => ({
  data: {
    object: {
      id: `msg_${Math.random().toString(36).slice(2, 8)}`,
      platform: "imessage",
      status: "received",
      sentBy: { kind: "human", id: "usr_1", handle: ME },
      receivedBy: { kind: "agent", id: "agt_1" },
      space: { id: SPACE },
      content,
      ...over,
    },
  },
});
const text = (t: string, over?: Record<string, unknown>) =>
  inbound({ type: "text", format: "plain", text: t }, over);

function line(opts: { batchMs?: number; attachmentStatus?: number; reader?: boolean } = {}) {
  const sent: string[] = [];
  const downloads: string[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.endsWith("/messages")) {
      sent.push(JSON.parse(init!.body as string).content.text);
      return new Response("{}", { status: 200 });
    }
    downloads.push(u);
    if (opts.attachmentStatus && opts.attachmentStatus !== 200) {
      return new Response("{}", { status: opts.attachmentStatus });
    }
    if (u.endsWith("/content")) {
      return new Response(new Uint8Array([1, 2, 3]), { headers: { "content-type": "image/png" } });
    }
    return Response.json({ filename: "bodycam-0145.png", contentType: "image/png", sizeBytes: 3 });
  });
  const log: { from: string; text: string }[] = [];
  const channel = new PhotonChannel(
    { apiKey: "pho_sk_test", projectId: "pho_prj_1", webhookSecret: "whsec_x" },
    (m) => log.push(m),
    fetchMock as unknown as typeof fetch,
    {
      team: parseTeamNumbers(ME),
      batchMs: opts.batchMs ?? 0,
      ...(opts.reader === false
        ? {}
        : {
            reader: async () => ({
              text: "Bodycam still, timestamp 1:45: an officer at the driver's window.",
              kind: "image" as const,
            }),
          }),
    },
  );
  const model: AgentLlm = {
    describe: async () => ({
      description: "Bodycam: officer at the window",
      lane: "bodycam",
      start: 105,
      end: 110,
      confidence: 0.9,
    }),
    compare: async () => ({
      verdict: "conflict",
      relatedId: "dashcam-approach",
      reason:
        "The still shows the officer at the window while the dashcam appears to show the approach.",
      confidence: 0.8,
    }),
    ask: (q, who) => answerQuestion(q, who, new QaMemory()),
  };
  let state: PipelineState = { items: ITEMS, pendingId: null };
  connectAgent(channel, model, {
    get: () => state,
    update: (patch) => {
      state = { ...state, ...patch };
    },
  });
  return { channel, sent, downloads, fetchMock, log, state: () => state };
}

describe("the case line, end to end", () => {
  it("turns away a number that is not on the team once, and reads nothing from it", async () => {
    const t = line();
    const stranger = {
      sentBy: { kind: "human", id: "usr_9", handle: "+19995550100" },
      space: { id: "spc_9" },
    };
    expect(await t.channel.handleInbound(text("show me the case", stranger))).toEqual({
      skipped: "not on the team",
    });
    await t.channel.handleInbound(
      inbound({ type: "attachment", attachmentId: "pho_att_x" }, stranger),
    );
    await t.channel.flush();
    expect(t.sent).toEqual([NOT_ON_TEAM]);
    expect(t.downloads).toEqual([]);
    expect(JSON.stringify(t.log)).not.toContain("show me the case");
  });

  it("downloads a photo, reads it, proposes it with the cross-check, and files it on CONFIRM", async () => {
    const t = line();
    await t.channel.handleInbound(inbound({ type: "attachment", attachmentId: "pho_att_01" }));
    await t.channel.flush();
    expect(t.downloads).toEqual([
      "https://api.photon.codes/v1/projects/pho_prj_1/attachments/pho_att_01",
      "https://api.photon.codes/v1/projects/pho_prj_1/attachments/pho_att_01/content",
    ]);
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toMatch(/^Found: Bodycam: officer at the window\. Possible conflict:/);
    expect(t.sent[0]).toMatch(/Reply CONFIRM or DISMISS\.$/);
    expect(t.state().items.find((i) => i.id === "item-pho_att_01")?.status).toBe("pending");

    await t.channel.handleInbound(text("confirm"));
    await t.channel.flush();
    expect(t.sent[1]).toBe("Added to the case record.");
    expect(t.state().items.find((i) => i.id === "item-pho_att_01")).toMatchObject({
      status: "filed",
      flag: "conflict",
    });
  });

  it("answers a fuzzy 'what's missing' and a question, citing the files", async () => {
    const t = line();
    await t.channel.handleInbound(text("whats mising?"));
    await t.channel.flush();
    expect(t.sent[0]).toMatch(/^Possible gaps:/);

    await t.channel.handleInbound(text("is there any dispatch audio"));
    await t.channel.flush();
    expect(t.sent[1]).toMatch(/dispatch audio/i);
    expect(t.sent[1]).toMatch(/\(.+\)/);

    await t.channel.handleInbound(text("what is the capital of France"));
    await t.channel.flush();
    expect(t.sent[2]).toBe(NOT_IN_FILES);
  });

  it("sends one combined reply for messages that arrive within the window", async () => {
    const t = line({ batchMs: 30 });
    await t.channel.handleInbound(text("what's missing"));
    await t.channel.handleInbound(text("what changed since yesterday?"));
    await t.channel.handleInbound(text("is there any dispatch audio"));
    expect(t.sent).toEqual([]);
    await new Promise((r) => setTimeout(r, 120));
    await t.channel.flush();
    expect(t.sent).toHaveLength(1);
    expect(t.sent[0]).toContain("Possible gaps:");
    expect(t.sent[0]).toContain("Nothing new has been filed since yesterday.");
    expect(t.sent[0]?.split("\n\n")).toHaveLength(3);
  });

  it("shows every inbound and outbound message in the page's conversation", async () => {
    const t = line();
    await t.channel.handleInbound(text("what's missing"));
    await t.channel.flush();
    expect(t.log.map((m) => m.from)).toEqual(["team", "agent"]);
  });

  it("tells the sender when a file cannot be fetched or read, and files nothing", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const t = line({ attachmentStatus: 404 });
    await t.channel.handleInbound(inbound({ type: "attachment", attachmentId: "pho_att_gone" }));
    await t.channel.flush();
    expect(t.sent[0]).toContain("I couldn't download that file from iMessage.");
    expect(t.sent[0]).toContain("Nothing was added");
    expect(t.state().pendingId).toBeNull();

    const noReader = line({ reader: false });
    await noReader.channel.handleInbound(inbound({ type: "voice", attachmentId: "pho_att_v" }));
    await noReader.channel.flush();
    expect(noReader.sent[0]).toContain("I can't read files on this line yet.");
    errors.mockRestore();
  });

  it("waits and retries while Photon is still fetching a file (409)", async () => {
    let calls = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/messages")) return new Response("{}", { status: 200 });
      if (u.endsWith("/content")) {
        calls += 1;
        return calls < 2
          ? new Response("{}", { status: 409, headers: { "retry-after": "0" } })
          : new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } });
      }
      return Response.json({ filename: "a.png", contentType: "image/png", sizeBytes: 1 });
    });
    const channel = new PhotonChannel(
      { apiKey: "k", projectId: "pho_prj_1", webhookSecret: "s" },
      () => {},
      fetchMock as unknown as typeof fetch,
      {
        team: parseTeamNumbers(ME),
        batchMs: 0,
        reader: async () => ({ text: "ok", kind: "image" }),
      },
    );
    const seen: string[] = [];
    channel.onMessage(async (m) => {
      seen.push(m.attachments[0]?.extractedText ?? m.attachments[0]?.readError ?? "");
    });
    await channel.handleInbound(inbound({ type: "attachment", attachmentId: "pho_att_slow" }));
    await channel.flush();
    expect(seen).toEqual(["ok"]);
    expect(calls).toBe(2);
  });

  it("only surfaces plain-words errors from the reader", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("/messages")
        ? new Response("{}")
        : String(url).endsWith("/content")
          ? new Response(new Uint8Array([1]), { headers: { "content-type": "image/png" } })
          : Response.json({}),
    );
    const make = (reader: () => Promise<never>) =>
      new PhotonChannel(
        { apiKey: "k", projectId: "p", webhookSecret: "s" },
        () => {},
        fetchMock as unknown as typeof fetch,
        { team: parseTeamNumbers(ME), batchMs: 0, reader },
      );
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [thrown, expected] of [
      [new PlainError("That file is odd."), "That file is odd."],
      [new Error("ECONNRESET 10.0.0.1:443 secret-token"), "I couldn't download or read that file."],
    ] as const) {
      const channel = make(async () => {
        throw thrown;
      });
      const seen: string[] = [];
      channel.onMessage(async (m) => {
        seen.push(m.attachments[0]?.readError ?? "");
      });
      await channel.handleInbound(inbound({ type: "attachment", attachmentId: "pho_att_1" }));
      await channel.flush();
      expect(seen).toEqual([expected]);
    }
    errors.mockRestore();
  });

  it("still answers a direct handleMessage question with the help text when there is no model", async () => {
    const r = await handleMessage(
      { items: ITEMS, pendingId: null },
      { text: "what about the bodycam?", attachments: [] },
      {
        describe: async () => Promise.reject(new Error("x")),
        compare: async () => Promise.reject(new Error("x")),
      },
    );
    expect(r.replies[0]?.text).toContain("Send me evidence");
  });
});
