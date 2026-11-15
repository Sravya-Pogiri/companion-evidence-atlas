import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The provider keeps per-process state (cache, spent models), so each test loads a fresh copy.
async function load() {
  vi.resetModules();
  return import("@/lib/ai/provider.server");
}

const ok = (obj: unknown) =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] }), {
    status: 200,
  });
const quota = (kind: "PerDay" | "PerMinute", retry = "0.01s") =>
  new Response(
    JSON.stringify({
      error: {
        code: 429,
        details: [
          { violations: [{ quotaId: `GenerateRequests${kind}PerProjectPerModel-FreeTier` }] },
          { retryDelay: retry },
        ],
      },
    }),
    { status: 429 },
  );

describe("AI provider (Gemini)", () => {
  const env = { ...process.env };
  let calls: { url: string; body: Record<string, unknown> | null }[];

  beforeEach(() => {
    process.env["GEMINI_API_KEY"] = "test-key";
    delete process.env["LOVABLE_API_KEY"];
    process.env["GEMINI_MODELS"] = "model-a,model-b";
    process.env["GEMINI_RPM"] = "60000";
    process.env["GEMINI_MAX_REQUESTS"] = "10";
    calls = [];
  });
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  function stub(responses: Response[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null });
        const r = responses.shift();
        if (!r) throw new Error("unexpected call");
        return r;
      }),
    );
  }

  it("sends the system prompt and JSON mode, and parses the JSON answer", async () => {
    stub([ok({ verdict: "agrees" })]);
    const { askJson } = await load();
    expect(await askJson("SYSTEM", "USER")).toEqual({ verdict: "agrees" });
    expect(calls[0]!.url).toContain("/models/model-a:generateContent");
    expect(calls[0]!.body).toMatchObject({
      systemInstruction: { parts: [{ text: "SYSTEM" }] },
      generationConfig: { responseMimeType: "application/json" },
    });
  });

  it("sends data-URL images as inline data", async () => {
    stub([ok({ observations: [] })]);
    const { askJsonParts } = await load();
    await askJsonParts("S", [
      { type: "input_text", text: "describe" },
      { type: "input_image", image_url: "data:image/jpeg;base64,QUJD" },
    ]);
    const parts = (calls[0]!.body!["contents"] as { parts: unknown[] }[])[0]!.parts;
    expect(parts[1]).toEqual({ inlineData: { mimeType: "image/jpeg", data: "QUJD" } });
  });

  it("moves to the next model when a model's daily quota is spent, and remembers it", async () => {
    stub([quota("PerDay"), ok({ a: 1 }), ok({ b: 2 })]);
    const { askJson, providerStats } = await load();
    expect(await askJson("S", "one")).toEqual({ a: 1 });
    expect(await askJson("S", "two")).toEqual({ b: 2 });
    expect(calls.map((c) => c.url.split("/models/")[1])).toEqual([
      "model-a:generateContent",
      "model-b:generateContent",
      "model-b:generateContent",
    ]);
    expect(providerStats().exhaustedModels).toEqual(["model-a"]);
  });

  it("waits and retries the same model on a per-minute limit", async () => {
    stub([quota("PerMinute"), ok({ ok: true })]);
    const { askJson } = await load();
    expect(await askJson("S", "u")).toEqual({ ok: true });
    expect(calls.every((c) => c.url.includes("model-a"))).toBe(true);
  });

  it("gives a plain-words error when every model is spent", async () => {
    stub([quota("PerDay"), quota("PerDay")]);
    const { askJson } = await load();
    await expect(askJson("S", "u")).rejects.toThrow(/reached its limit/);
  });

  it("answers repeated requests from the cache", async () => {
    stub([ok({ n: 1 })]);
    const { askJson, providerStats } = await load();
    await askJson("S", "same");
    await askJson("S", "same");
    expect(calls).toHaveLength(1);
    expect(providerStats().requests).toBe(1);
  });

  it("stops at the request budget", async () => {
    process.env["GEMINI_MAX_REQUESTS"] = "1";
    stub([ok({ n: 1 })]);
    const { askJson } = await load();
    await askJson("S", "first");
    await expect(askJson("S", "second")).rejects.toThrow(/request limit/);
  });

  it("falls back to the Lovable gateway when only its key is set", async () => {
    delete process.env["GEMINI_API_KEY"];
    process.env["LOVABLE_API_KEY"] = "lovable";
    stub([new Response(JSON.stringify({ output_text: '{"x":1}' }), { status: 200 })]);
    const { askJson, activeProvider } = await load();
    expect(activeProvider()).toBe("lovable");
    expect(await askJson("S", "u")).toEqual({ x: 1 });
    expect(calls[0]!.url).toContain("ai.gateway.lovable.dev");
  });

  it("refuses clearly when no key is set", async () => {
    delete process.env["GEMINI_API_KEY"];
    const { askJson } = await load();
    await expect(askJson("S", "u")).rejects.toThrow(/not set up/);
  });
});
