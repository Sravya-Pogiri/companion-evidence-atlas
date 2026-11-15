// Which model the investigator uses. Gemini (GEMINI_API_KEY) through its OpenAI-compatible
// endpoint when set, otherwise the Lovable AI gateway (LOVABLE_API_KEY). Server-side only.
export const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai/';
export type ModelConfig =
  | { provider: 'gemini'; apiKey: string; model: string; baseURL: string }
  | { provider: 'lovable'; apiKey: string; model: string; baseURL: string };

export function modelConfig(): ModelConfig | null {
  const gemini = process.env['GEMINI_API_KEY'];
  if (gemini) return { provider: 'gemini', apiKey: gemini, model: process.env['GEMINI_MODEL'] ?? 'gemini-3.5-flash', baseURL: GEMINI_OPENAI_BASE };
  const lovable = process.env['LOVABLE_API_KEY'];
  if (lovable) return { provider: 'lovable', apiKey: lovable, model: 'openai/gpt-6-astra', baseURL: 'https://ai.gateway.lovable.dev/v1' };
  return null;
}
