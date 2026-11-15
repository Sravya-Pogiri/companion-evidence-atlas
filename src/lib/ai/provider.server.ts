// Server only. One model provider for the whole app: Google Gemini (GEMINI_API_KEY) when set,
// otherwise the Lovable AI gateway (LOVABLE_API_KEY) as an optional fallback. Keys are read from
// the server environment and never reach the browser; only plain-words errors leave this file.
//
// Built for the Gemini free tier, where limits are per model and small:
//  - Models come from GEMINI_MODELS (comma list) or, if unset, from the models.list endpoint,
//    preferring Flash models. A model whose daily quota is spent is skipped for the rest of the
//    process and the next one is tried (a per-day 429 is never retried on the same model).
//  - Per-minute 429s wait for the server's retry hint, bounded, then retry.
//  - GEMINI_RPM (default 4) spaces requests per model; GEMINI_MAX_REQUESTS (default 200) caps the
//    requests one process may send; identical requests are answered from an in-memory cache.
import { GatewayError, lovableAskJsonParts, type AskOptions, type InputPart } from "@/lib/agent/gateway.server";

export type { AskOptions, InputPart };

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-3.5-flash-lite"];
const MAX_WAIT_MS = 65_000;

type Provider = "gemini" | "lovable";

export function activeProvider(): Provider | null {
  if (process.env["GEMINI_API_KEY"]) return "gemini";
  if (process.env["LOVABLE_API_KEY"]) return "lovable";
  return null;
}

// ---------- shared limits and cache ----------

const state = {
  requests: 0,
  exhausted: new Set<string>(),
  lastCall: new Map<string, number>(),
  models: null as string[] | null,
  cache: new Map<string, unknown>(),
  used: new Map<string, number>(),
};

const envInt = (name: string, fallback: number) => {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
};

/** What the provider has done in this process (for logs and reports). */
export function providerStats() {
  return {
    provider: activeProvider(),
    requests: state.requests,
    exhaustedModels: [...state.exhausted],
    requestsByModel: Object.fromEntries(state.used),
  };
}

async function hashKey(s: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function takeBudget() {
  const max = envInt("GEMINI_MAX_REQUESTS", 200);
  if (state.requests >= max) {
    throw new GatewayError("The analysis request limit for this run has been reached.");
  }
  state.requests++;
}

async function pace(model: string) {
  const rpm = envInt("GEMINI_RPM", 4);
  const gap = Math.ceil(60_000 / rpm);
  const last = state.lastCall.get(model) ?? 0;
  const wait = last + gap - Date.now();
  state.lastCall.set(model, Math.max(Date.now(), last + gap));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
}

// ---------- public API ----------

/** Ask for one JSON object, with text and image parts. Same contract as before. */
export async function askJsonParts(system: string, parts: InputPart[], opts: AskOptions = {}): Promise<unknown> {
  const provider = activeProvider();
  if (!provider) {
    console.error("ai: neither GEMINI_API_KEY nor LOVABLE_API_KEY is set on the server.");
    throw new GatewayError("The analysis service is not set up yet.");
  }
  const key = await hashKey(JSON.stringify([provider, opts.model ?? "", system, parts]));
  if (state.cache.has(key)) return state.cache.get(key);
  takeBudget();
  const value =
    provider === "gemini"
      ? await geminiGenerate(system, parts.map(toGeminiPart), opts)
      : await lovableAskJsonParts(system, parts, opts);
  if (state.cache.size > 200) state.cache.delete(state.cache.keys().next().value as string);
  state.cache.set(key, value);
  return value;
}

export async function askJson(system: string, user: string, opts: AskOptions = {}): Promise<unknown> {
  return askJsonParts(system, [{ type: "input_text", text: user }], opts);
}

/** Transcribe a short audio clip (base64). Gemini only; returns the model's JSON. */
export async function transcribeAudio(
  system: string,
  instruction: string,
  audioBase64: string,
  format: "mp3" | "wav",
  opts: AskOptions = {},
): Promise<unknown> {
  if (activeProvider() !== "gemini") {
    throw new GatewayError("Audio transcription needs GEMINI_API_KEY.");
  }
  takeBudget();
  return geminiGenerate(
    system,
    [{ text: instruction }, { inlineData: { mimeType: format === "mp3" ? "audio/mpeg" : "audio/wav", data: audioBase64 } }],
    { timeoutMs: 120_000, ...opts },
  );
}

/** Which model the next Gemini call would use (probing the list if needed). */
export async function currentGeminiModel(): Promise<string | null> {
  const models = await geminiModels();
  return models.find((m) => !state.exhausted.has(m)) ?? null;
}

// ---------- Gemini ----------

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } } | { fileData: { mimeType: string; fileUri: string } };

function toGeminiPart(p: InputPart): GeminiPart {
  if (p.type === "input_text") return { text: p.text };
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(p.image_url);
  if (m) return { inlineData: { mimeType: m[1]!, data: m[2]! } };
  return { fileData: { mimeType: "image/jpeg", fileUri: p.image_url } };
}

async function geminiModels(): Promise<string[]> {
  if (state.models) return state.models;
  const configured = (process.env["GEMINI_MODELS"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (configured.length) return (state.models = configured);
  try {
    const r = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
      headers: { "x-goog-api-key": process.env["GEMINI_API_KEY"]! },
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) {
      const body = (await r.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
      const available = new Set(
        (body.models ?? [])
          .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
          .map((m) => m.name.replace(/^models\//, "")),
      );
      // Preferred order first, then any other stable Flash model the key can use.
      const ordered = [
        ...DEFAULT_MODELS.filter((m) => available.has(m)),
        ...[...available].filter((m) => /flash/.test(m) && !/(preview|exp|tts|image|live|audio|thinking)/.test(m) && !DEFAULT_MODELS.includes(m)).sort().reverse(),
      ];
      if (ordered.length) return (state.models = ordered);
    }
  } catch {
    // Fall through to the defaults.
  }
  return (state.models = DEFAULT_MODELS);
}

function quotaKind(body: string): "day" | "minute" | "unknown" {
  if (/PerDay/i.test(body)) return "day";
  if (/PerMinute/i.test(body)) return "minute";
  return "unknown";
}

function retryDelayMs(body: string): number {
  const m = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  return m ? Math.ceil(Number(m[1]) * 1000) + 500 : 20_000;
}

async function geminiGenerate(system: string, parts: GeminiPart[], opts: AskOptions): Promise<unknown> {
  const key = process.env["GEMINI_API_KEY"]!;
  const candidates = opts.model && !opts.model.includes("/") ? [opts.model] : await geminiModels();
  let minuteRetries = 0;

  for (let i = 0; i < candidates.length; ) {
    const model = candidates[i]!;
    if (state.exhausted.has(model)) {
      i++;
      continue;
    }
    await pace(model);
    let response: Response;
    try {
      response = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
      });
    } catch {
      throw new GatewayError("The analysis service did not answer in time.");
    }
    state.used.set(model, (state.used.get(model) ?? 0) + 1);

    if (response.status === 429) {
      const body = await response.text();
      const kind = quotaKind(body);
      if (kind === "minute" && minuteRetries < 2 && retryDelayMs(body) <= MAX_WAIT_MS) {
        minuteRetries++;
        console.warn(`ai: ${model} per-minute limit; waiting ${Math.round(retryDelayMs(body) / 1000)}s`);
        await new Promise((r) => setTimeout(r, retryDelayMs(body)));
        continue;
      }
      console.warn(`ai: ${model} quota spent (${kind}); trying the next model`);
      state.exhausted.add(model);
      minuteRetries = 0;
      i++;
      continue;
    }
    if (response.status === 404) {
      console.warn(`ai: ${model} is not available to this key; trying the next model`);
      state.exhausted.add(model);
      i++;
      continue;
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`ai: Gemini returned ${response.status}: ${detail.slice(0, 300)}`);
      if ([400, 401, 403].includes(response.status) && /API key/i.test(detail)) {
        throw new GatewayError("The analysis service rejected the request. Its key needs attention.");
      }
      if (response.status >= 500 && minuteRetries < 2) {
        minuteRetries++;
        await new Promise((r) => setTimeout(r, 2000 * minuteRetries));
        continue;
      }
      throw new GatewayError("The analysis service had a problem.");
    }

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    if (body.promptFeedback?.blockReason) {
      throw new GatewayError("The analysis service declined to read this material.");
    }
    const text = (body.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    try {
      return JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      throw new GatewayError("The analysis service gave an answer I could not read.");
    }
  }
  throw new GatewayError("The analysis service is busy. Every available model has reached its limit for now.");
}
