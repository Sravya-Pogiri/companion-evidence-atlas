// Simulates the case team texting the Photon line, with no phone and no network to Photon.
//
//   node --env-file=.env scripts/run-ts.mjs scripts/simulate-photon.ts   (uses your model key if one is set)
//   node scripts/run-ts.mjs scripts/simulate-photon.ts                   (stub model; offline)
//
// It runs the real code: the webhook event parser, the team allowlist, attachment download and
// reading, 5-second-style batching, the pipeline and the case-file Q&A. Only Photon's HTTP API
// is faked (sends are captured and printed; attachments are served from services/investigator/fixtures),
// and the model is faked when no key is set. Nothing is sent to anyone.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readAttachment } from "@/lib/agent/extract.server";
import { gatewayLlm } from "@/lib/agent/llm.server";
import type { AgentLlm, PipelineState } from "@/lib/agent/pipeline";
import { answerQuestion, QaMemory } from "@/lib/agent/qa";
import { connectAgent } from "@/lib/agent/runner";
import { parseTeamNumbers } from "@/lib/channel/allowlist";
import { PhotonChannel, type AttachmentReader } from "@/lib/channel/photon.server";
import { activeProvider } from "@/lib/ai/provider.server";
import { ITEMS } from "@/lib/sample-case";

const TEAM_PHONE = "+15555550100";
const STRANGER = "+19995550123";
const BATCH_MS = 400; // the real line uses 5000
const FIXTURES = resolve(import.meta.dirname ?? ".", "../services/investigator/fixtures");
const PHOTO = readFileSync(resolve(FIXTURES, "conflicting/frames/010.png"));

const live = activeProvider() !== null;
console.log(
  live
    ? `Model: LIVE (${activeProvider()}) for reading photos, describing, comparing and answering.\n`
    : "Model: STUB. No GEMINI_API_KEY or LOVABLE_API_KEY is set, so photo reading, describing and\n" +
        "comparing are canned, and answers quote the closest passage from the case files.\n" +
        "(Retrieval, citations, the allowlist, batching and the confirm flow are the real code.)\n",
);

// ---------- fake Photon API ----------
const outbox: { to: string; text: string }[] = [];
let downloads = 0;
const fakePhoton = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
  const u = String(url);
  if (u.endsWith("/messages")) {
    const body = JSON.parse(String(init?.body));
    outbox.push({ to: body.spaceId, text: body.content.text });
    return new Response("{}", { status: 200 });
  }
  downloads += 1;
  if (u.endsWith("/content")) {
    return new Response(PHOTO, { headers: { "content-type": "image/png" } });
  }
  return Response.json({
    filename: "IMG_0145.png",
    contentType: "image/png",
    sizeBytes: PHOTO.length,
  });
};

// ---------- models (stub only when there is no key) ----------
const stubReader: AttachmentReader = async () => ({
  text: "[stub reader] Bodycam still, on-screen time 1:45. An officer stands at the driver's window of a red car.",
  kind: "image",
});
const stubLlm: AgentLlm = {
  describe: async (i) => {
    const m = /(\d+):(\d{2})/.exec(i.extractedText);
    const t = m ? Number(m[1]) * 60 + Number(m[2]) : 105;
    return {
      description: "Bodycam: officer at the driver's window",
      lane: "bodycam",
      start: t,
      end: t + 5,
      confidence: 0.85,
    };
  },
  compare: async (i) => ({
    verdict: "conflict",
    relatedId: (i.others.find((o) => o.lane === "bodycam") ?? i.others[0])?.id ?? null,
    reason:
      "[stub] The new still and the existing item appear to describe the same moment differently.",
    confidence: 0.75,
  }),
  ask: (q, who) => answerQuestion(q, who, memory),
};
const memory = new QaMemory();
const llm: AgentLlm = live ? gatewayLlm : stubLlm;

// ---------- the line ----------
const log: { from: string; text: string }[] = [];
const channel = new PhotonChannel(
  { apiKey: "pho_sk_simulated", projectId: "pho_prj_simulated", webhookSecret: "whsec_unused" },
  (m) => log.push(m),
  fakePhoton as unknown as typeof fetch,
  {
    team: parseTeamNumbers(TEAM_PHONE),
    batchMs: BATCH_MS,
    reader: live ? readAttachment : stubReader,
  },
);
let state: PipelineState = { items: ITEMS, pendingId: null };
connectAgent(channel, llm, {
  get: () => state,
  update: (patch) => {
    state = { ...state, ...patch };
  },
});

// ---------- helpers that build Photon webhook events ----------
let n = 0;
const event = (content: unknown, from = TEAM_PHONE, space = "spc_sim") => ({
  id: `evt_${++n}`,
  type: "message.received",
  data: {
    object: {
      id: `msg_${n}`,
      platform: "imessage",
      status: "received",
      content,
      sentBy: { kind: "human", id: `usr_${from}`, handle: from },
      receivedBy: { kind: "agent", id: "agt_sim" },
      space: { id: space },
    },
  },
});
const text = (t: string, from?: string, space?: string) =>
  event({ type: "text", format: "plain", text: t }, from, space);
const photo = () => event({ type: "attachment", attachmentId: "pho_att_0145" });

async function step(label: string, events: unknown[]) {
  console.log(`\n=== ${label}`);
  const before = outbox.length;
  for (const e of events) {
    const data = (
      e as {
        data: { object: { content: { type: string; text?: string }; sentBy: { handle: string } } };
      }
    ).data.object;
    const who = data.sentBy.handle === TEAM_PHONE ? "team" : `stranger ${data.sentBy.handle}`;
    const what = data.content.type === "text" ? `"${data.content.text}"` : `[${data.content.type}]`;
    console.log(`  → ${who}: ${what}`);
    await channel.handleInbound(e);
  }
  await new Promise((r) => setTimeout(r, BATCH_MS + 150));
  await channel.flush();
  const replies = outbox.slice(before);
  if (replies.length === 0) console.log("  ← (no reply)");
  for (const r of replies) console.log(`  ← ${r.text.replace(/\n/g, "\n    ")}`);
}

await step("1. Unknown number texts the line", [
  text("hi, who is this? send me the case files", STRANGER, "spc_x"),
]);
await step("1b. The same unknown number texts again (no second reply)", [
  text("hello?", STRANGER, "spc_x"),
]);
await step("2. A question", [text("Why were they pulled over?")]);
await step("3. A follow-up that needs memory", [text("what about the bodycam?")]);
await step("4. A question the files don't cover", [text("What is the capital of France?")]);
await step("5. A photo", [photo()]);
await step('6. "confirm"', [text("confirm")]);
await step('7. "what\'s missing" (fuzzy spelling)', [text("whats mising?")]);
await step("8. A burst: three texts within the batch window -> one reply", [
  text("what's missing"),
  text("what changed since yesterday?"),
  text("is there any dispatch audio"),
]);
await step("9. A photo, then DISMISS", [photo()]);
await step("9b.", [text("DISMISS")]);

const pending = state.items.filter((i) => i.status === "pending").length;
console.log(
  `\nSummary: ${outbox.length} texts sent, ${downloads} attachment requests, ` +
    `${log.length} events shown in the page's chat, ${pending} items left pending.`,
);
