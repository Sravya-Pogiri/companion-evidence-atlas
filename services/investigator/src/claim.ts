// "Test this claim": a Deep Agents investigation of a user's claim against one Lexora case.
//
// A lead investigator plans (write_todos) and delegates through the Deep Agents task tool to two
// subagents with read-only, case-scoped tools over the stored evidence:
//   timeline-researcher  finds the dated records and exact passages, and labels each time's type
//   evidence-reviewer    challenges the claim: contrary records, ambiguous times, missing records
// The lead compares their reports and returns a structured finding. Afterwards every quote is
// checked in code against the stored page it cites, and every cited record must have been
// returned by a tool during the run. Activity is reported as it happens, from the agents' own
// plan, delegations and tool calls; nothing is simulated.
import { createDeepAgent } from 'deepagents';
import { ChatOpenAI } from '@langchain/openai';
import { tool } from '@langchain/core/tools';
import { ToolMessage } from '@langchain/core/messages';
import { createMiddleware, todoListMiddleware, toolStrategy } from 'langchain';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { checkScannedQuote } from '../../../src/lib/evidence/verify.ts';
import { CLAIM_CASES, datedRecords, loadCase, missingRecords, observation, searchPages, type CaseStore } from './evidence-store.ts';
import { modelConfig } from './provider.ts';

export const claimRequest = z
  .object({
    caseId: z.enum(CLAIM_CASES),
    claim: z.string().trim().min(8, 'Write the claim as a full sentence.').max(400),
  })
  .strict();

export const TIME_TYPES = ['incident', 'collection', 'receipt_or_log', 'examination_or_test', 'report_issued', 'filing', 'hearing', 'arrest', 'announcement', 'archive_capture', 'seen_in_video', 'spoken_on_recording', 'other'] as const;

const findingSchema = z.object({
  finding: z.enum(['supported', 'challenged', 'ambiguous', 'insufficient_evidence']),
  explanation: z.string().describe('Two to four hedged sentences grounded in the cited passages.'),
  timeline_events: z
    .array(
      z.object({
        evidence_id: z.string().describe('Evidence id of the stored page the quote is from, e.g. btk:STATE:p42'),
        date: z.string().describe('The date as the record gives it, ISO form where possible (YYYY-MM-DD or YYYY-MM); for a video, the camera and time, e.g. "bodycam 8:00"'),
        time_type: z.enum(TIME_TYPES),
        label: z.string().describe('What happened at this time, in a few words'),
        quote: z.string().describe('Exact words from that page that give this date'),
        discrepancy: z.string().nullable().describe('If this time appears to sit badly with another record, say how; else null'),
      }),
    )
    .describe('The dated records that bear on the claim'),
  citations: z.array(
    z.object({
      evidence_id: z.string(),
      quote: z.string().describe('Exact words copied from that stored page'),
      role: z.enum(['supports', 'challenges', 'context']),
    }),
  ),
  open_questions: z.array(z.string()).describe('What the stored evidence cannot settle'),
});
type AgentFinding = z.infer<typeof findingSchema>;

export type AgentName = 'Lead Investigator' | 'Timeline Researcher' | 'Evidence Reviewer' | 'Verifier' | 'System';
export interface Activity {
  id: string;
  at: number;
  agent: AgentName;
  kind: 'plan' | 'delegate' | 'tool' | 'report' | 'verify' | 'finding' | 'model' | 'error';
  title: string;
  detail?: string;
  status: 'running' | 'done' | 'failed';
  evidenceIds?: string[];
  /** For tool and delegation events: the id that ties the start and the end together. */
  ref?: string;
}

export interface VerifiedCitation {
  evidence_id: string;
  source_id: string;
  source_title: string;
  page: number;
  /** Where the record sits, for people: "PDF p.42", "bodycam 8:00–9:00", "recorded metadata". */
  location: string;
  quote: string;
  role: 'supports' | 'challenges' | 'context';
  verified: boolean;
  check: string;
  /** The stored page text around the quote, so the viewer can show it in context. */
  context: string;
  url: string | null;
  method: string;
  frame: string | null;
}

export interface ClaimResult {
  investigation_id: string;
  case_id: string;
  claim: string;
  finding: AgentFinding['finding'];
  explanation: string;
  timeline_events: (AgentFinding['timeline_events'][number] & { verified: boolean; check: string; source_title: string; page: number | null; location: string | null })[];
  citations: VerifiedCitation[];
  open_questions: string[];
  agent_activity: Activity[];
  verification: { citations: number; verified: number; events: number; events_verified: number; note: string };
  model: string;
  duration_s: number;
}

/** Every evidence_id inside a tool result, for the record of what the tools returned. */
function idsIn(value: unknown): string[] {
  const out: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === 'evidence_id' && typeof x === 'string') out.push(x);
        else walk(x);
      }
  };
  walk(value);
  return [...new Set(out)];
}

// ---------- model access: paced, with daily-quota fallback ----------

const DEFAULT_MODELS = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];

function pacedGeminiFetch(models: string[], rpm: number, onModel: (m: string, why: string) => void) {
  let index = 0;
  let chain: Promise<void> = Promise.resolve();
  let last = 0;
  const gap = 60_000 / Math.max(1, rpm);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const slot = () => {
    const mine = chain.then(async () => {
      const wait = last + gap - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
    });
    chain = mine.catch(() => {});
    return mine;
  };
  // Gemini 3 returns a thought signature with each tool call and requires it back on that call in
  // later requests; LangChain's OpenAI client drops it. Keep them by tool call id and put them
  // back. A call made by a different model (after a switch) gets Google's documented placeholder.
  const signatures = new Map<string, { sig: string; model: string }>();
  type ToolCall = { id?: string; extra_content?: { google?: { thought_signature?: string } } };
  const f = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    for (let attempt = 0; attempt < 8; attempt++) {
      await slot();
      let body = init?.body;
      if (typeof body === 'string') {
        const parsed = JSON.parse(body) as { model?: string; messages?: { role: string; tool_calls?: ToolCall[] }[] };
        parsed.model = models[index];
        for (const m of parsed.messages ?? [])
          for (const tc of m.role === 'assistant' ? (m.tool_calls ?? []) : []) {
            if (tc.extra_content?.google?.thought_signature) continue;
            const kept = tc.id ? signatures.get(tc.id) : undefined;
            tc.extra_content = { google: { thought_signature: kept && kept.model === models[index] ? kept.sig : 'skip_thought_signature_validator' } };
          }
        body = JSON.stringify(parsed);
      }
      const res = await fetch(input, { ...init, body });
      if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) {
        const text = await res.text();
        try {
          const json = JSON.parse(text) as { choices?: { message?: { tool_calls?: ToolCall[] } }[] };
          for (const ch of json.choices ?? [])
            for (const tc of ch.message?.tool_calls ?? [])
              if (tc.id && tc.extra_content?.google?.thought_signature) signatures.set(tc.id, { sig: tc.extra_content.google.thought_signature, model: models[index]! });
        } catch {
          // Not JSON after all: pass it through unchanged.
        }
        return new Response(text, { status: res.status, statusText: res.statusText, headers: res.headers });
      }
      if (res.status === 429) {
        const text = await res.text();
        if (/PerDay|per day|daily/i.test(text) && index < models.length - 1) {
          index++;
          onModel(models[index]!, `${models[index - 1]} reached its daily limit`);
          continue;
        }
        const hint = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(text);
        await sleep(Math.min(65_000, (hint ? Number(hint[1]) : 20) * 1000 + 500));
        continue;
      }
      if (res.status === 503 || res.status === 500) {
        await sleep(4000 * (attempt + 1));
        continue;
      }
      return res;
    }
    throw new Error('The model service kept refusing requests (rate limit or overload). Try again in a minute.');
  };
  return { fetch: f, current: () => models[index]! };
}

// ---------- the investigation ----------

export async function investigateClaim(
  input: z.infer<typeof claimRequest>,
  emit: (a: Activity) => void,
  signal?: AbortSignal,
): Promise<ClaimResult> {
  input = claimRequest.parse(input);
  const t0 = Date.now();
  const cfg = modelConfig();
  if (!cfg || cfg.provider !== 'gemini') throw new Error('Setup required: set GEMINI_API_KEY for the investigator service.');
  const store = loadCase(input.caseId);
  const activity: Activity[] = [];
  const push = (a: Omit<Activity, 'id' | 'at'> & { id?: string }) => {
    const ev: Activity = { id: a.id ?? randomUUID(), at: Math.round((Date.now() - t0) / 100) / 10, ...a };
    activity.push(ev);
    emit(ev);
    return ev;
  };
  const models = (process.env['GEMINI_MODELS'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const paced = pacedGeminiFetch(models.length ? models : DEFAULT_MODELS, Number(process.env['GEMINI_RPM'] ?? 8), (m, why) =>
    push({ agent: 'System', kind: 'model', title: `Switched to ${m}`, detail: why, status: 'done' }),
  );
  const model = new ChatOpenAI({ model: paced.current(), apiKey: cfg.apiKey, maxRetries: 0, temperature: 0, configuration: { baseURL: cfg.baseURL, fetch: paced.fetch as typeof fetch } });

  // Records each tool returned during the run: citations must come from these.
  const returned = new Set<string>();
  // Each subagent gets a tool budget per run, and an identical repeated call is not run again:
  // a weaker model can otherwise keep searching without ever reporting.
  const TOOL_BUDGET = Number(process.env['INVESTIGATOR_TOOL_BUDGET'] ?? 10);
  const toolsFor = (agent: AgentName) => {
    let used = 0;
    const done = new Set<string>();
    const run = async <T>(title: string, args: unknown, fn: () => T, ids: (r: T) => string[]): Promise<string> => {
      const key = `${title}|${JSON.stringify(args)}`;
      if (done.has(key)) {
        push({ agent, kind: 'tool', title: `${title} (repeat, not run again)`, status: 'done' });
        return JSON.stringify({ note: 'You already ran this exact call; use its earlier result. If you have enough, write your report now.' });
      }
      if (used >= TOOL_BUDGET) {
        push({ agent, kind: 'tool', title: `Tool budget reached (${TOOL_BUDGET} calls)`, detail: `${agent} was told to report with what it has.`, status: 'done' });
        return JSON.stringify({ note: `Tool budget reached (${TOOL_BUDGET} calls). Stop searching and write your report now from what you have found, with exact quotes and evidence ids.` });
      }
      used++;
      done.add(key);
      const ref = randomUUID();
      push({ agent, kind: 'tool', title, detail: JSON.stringify(args), status: 'running', ref });
      try {
        const r = fn();
        const got = ids(r);
        got.forEach((id) => returned.add(id));
        push({ agent, kind: 'tool', title, detail: got.length ? `Returned ${got.length}: ${got.slice(0, 6).join(', ')}${got.length > 6 ? ', …' : ''}` : 'Nothing found', status: 'done', ref, evidenceIds: got });
        return JSON.stringify(r);
      } catch (e) {
        // A wrong lookup is the agent's to correct: it gets the message back as the tool result,
        // and the run goes on.
        push({ agent, kind: 'tool', title, detail: (e as Error).message, status: 'failed', ref });
        return JSON.stringify({ error: (e as Error).message });
      }
    };
    return [
      tool(async ({ query }) => run(`Searched evidence: “${query}”`, { query }, () => searchPages(store, query), (r) => r.map((h) => h.evidence_id)), {
        name: 'search_evidence',
        description: `Keyword search over the stored text of every cited page in case ${store.caseId}. Returns evidence ids, page numbers and short snippets. Read a page before quoting it.`,
        schema: z.object({ query: z.string().min(2).max(200) }).strict(),
      }),
      tool(
        async ({ evidence_id }) =>
          run(`Read ${evidence_id}`, { evidence_id }, () => {
            const p = store.pages.get(evidence_id);
            if (!p) {
              const src = /^[a-z]+:([A-Z0-9_]+):/.exec(evidence_id)?.[1];
              const stored = src ? [...store.pages.keys()].filter((k) => k.startsWith(`${store.caseId}:${src}:`)) : [];
              throw new Error(`No stored page ${evidence_id} in this case.${stored.length ? ` Stored records of ${src}: ${stored.join(', ')}.` : ' Use search_evidence to find evidence ids.'}`);
            }
            return { evidence_id, source: p.sourceTitle, page: p.page, text_method: p.method, text: p.text.slice(0, 7000) };
          }, (r) => [r.evidence_id]),
        {
          name: 'read_evidence_page',
          description: 'Read the full stored text of one record by evidence id: a page (e.g. btk:STATE:p42) or a source\'s recorded metadata such as an archive capture time or filing date (e.g. btk:CHURCH:meta). Quotes must be copied exactly from this text.',
          schema: z.object({ evidence_id: z.string() }).strict(),
        },
      ),
      tool(async () => run('Listed dated records', {}, () => datedRecords(store), (r) => idsIn(r)), {
        name: 'list_dated_records',
        description: "The case's dated records: timeline entries and the dates on the records (filing, hearing, archive capture), or for a video case the checked moments on each camera's clock. These are summaries: confirm a date or moment on its record before quoting it.",
        schema: z.object({}).strict(),
      }),
      tool(
        async ({ id }) =>
          run(`Opened observation ${id}`, { id }, () => {
            const o = observation(store, id.replace(/^[a-z]+:/, ''));
            if (!o) throw new Error(`No observation ${id}. Observation ids look like B-002.`);
            return o;
          }, (r) => [r.evidence_id, ...r.cited_pages]),
        {
          name: 'get_observation',
          description: `One observation of this case (${store.observationHint}): what it says, its check, and the stored records it rests on.`,
          schema: z.object({ id: z.string() }).strict(),
        },
      ),
      tool(async () => run('Listed records not in the packet', {}, () => missingRecords(store), () => []), {
        name: 'list_missing_records',
        description: 'Records the packet lists as not located (raw files, logs, lab reports). Use to report what the evidence cannot settle.',
        schema: z.object({}).strict(),
      }),
    ];
  };

  const rules = `Rules: use only the tools; they read stored public records of ${store.title}. Quote only words copied exactly from read_evidence_page text (OCR mistakes included). Give every date with its type: the date something happened, the date it was received or logged, the date of a test or report, a filing or hearing date, an archive capture time; a moment seen in a video or spoken on a recording with its camera time. Each video has its own clock: never treat a dashcam time and a bodycam time as the same clock. Transcript and frame records are machine-generated; the PDF pages are the filings' own text. A report or filing date is not the date of the event it describes. list_dated_records and search snippets are summaries: to quote a date, read the page, or the source's recorded metadata (evidence ids ending in :meta, e.g. an archive capture time or a filing date). Never state conclusions about guilt, legality or case strategy; describe what the records say. Be concise.`;
  const timelineResearcher = {
    name: 'timeline-researcher',
    description: 'Finds the dated records that bear on a claim, with exact passages and the type of each time (event, receipt/log, test/report, filing, capture). Give it the claim and what to look for.',
    systemPrompt: `You are the Timeline Researcher. ${rules}
Find every record whose date bears on the claim. For each: evidence id of the page, the date as written, its time type, and the exact quote that gives it. Read the pages; do not rely on snippets or packet dates alone. Report a list, then one sentence on what the dates show.`,
    tools: toolsFor('Timeline Researcher'),
  };
  const evidenceReviewer = {
    name: 'evidence-reviewer',
    description: 'Independently challenges a claim: looks for records that contradict it, times that are ambiguous (day vs month precision, report date vs event date), other explanations, and missing records. Give it the claim.',
    systemPrompt: `You are the Evidence Reviewer. ${rules}
Try to show the claim is wrong or unsettled. Search for contrary records, ambiguous or differently typed times, and records that are missing (list_missing_records). Quote exactly. Report: contrary evidence (with quotes and evidence ids), ambiguities, missing records, and whether the claim survives your review.`,
    tools: toolsFor('Evidence Reviewer'),
  };

  const allowed = new Set(['search_evidence', 'read_evidence_page', 'list_dated_records', 'get_observation', 'list_missing_records', 'task', 'write_todos']);
  const readOnly = createMiddleware({
    name: 'case_scoped_read_only',
    wrapToolCall: async (request, handler) => {
      if (!allowed.has(request.toolCall.name) && !request.toolCall.name.startsWith('extract')) {
        // Refuse without ending the run: the agent is told what it may use instead.
        push({ agent: 'System', kind: 'tool', title: `Refused tool: ${request.toolCall.name}`, detail: 'Only the case evidence tools, write_todos and task are permitted.', status: 'failed' });
        return new ToolMessage({
          content: `Tool not permitted: ${request.toolCall.name}. Use only write_todos and task (lead), or the case evidence tools (subagents).`,
          tool_call_id: request.toolCall.id ?? '',
          name: request.toolCall.name,
        });
      }
      return handler(request);
    },
  });

  const agent = createDeepAgent({
    model,
    tools: [],
    subagents: [timelineResearcher, evidenceReviewer],
    middleware: [todoListMiddleware(), readOnly],
    permissions: [{ operations: ['read', 'write'], paths: ['/**'], mode: 'deny' }],
    responseFormat: toolStrategy(findingSchema),
    systemPrompt: `You are the Lead Investigator for ${store.title}. ${rules}
Your only tools are write_todos and task; the evidence tools belong to your subagents.
Steps:
1. Call write_todos with a short plan for testing the claim.
2. Delegate with the task tool: give the timeline-researcher the claim and the dates to find; give the evidence-reviewer the claim to challenge. You may delegate both at once. Only these two subagent types exist.
3. Compare their reports. If something is unresolved and the stored evidence might settle it, delegate one follow-up search.
4. Return the structured finding: supported (the dated records back the claim), challenged (they contradict it), ambiguous (they point both ways or the times are of different types/precision), insufficient_evidence (the stored records cannot settle it). Cite only evidence ids and exact quotes your subagents reported from pages they read.`,
  });

  push({ agent: 'Lead Investigator', kind: 'plan', title: 'Investigation started', detail: `Claim: ${input.claim}`, status: 'done' });

  // Stream the run: the lead's plan and delegations come from its own tool calls.
  let final: { structuredResponse?: AgentFinding; messages?: unknown[] } | undefined;
  const taskRefs = new Map<string, string>();
  const delegatedTo = new Set<AgentName>();
  // Later updates can repeat earlier messages: report each tool call and each reply once.
  const seenCalls = new Set<string>();
  const seenReplies = new Set<string>();
  const pass = async (messages: unknown[]) => {
    const stream = await agent.stream({ messages } as never, { streamMode: ['updates', 'values'], subgraphs: true, recursionLimit: 80, ...(signal ? { signal } : {}) });
    for await (const chunk of stream as AsyncIterable<[string[], string, Record<string, unknown>]>) {
      const [namespace, mode, data] = chunk;
      if (mode === 'values' && namespace.length === 0) {
        final = data as typeof final;
        continue;
      }
      if (mode !== 'updates' || namespace.length > 0) continue;
      for (const update of Object.values(data ?? {})) {
        const msgs = (update as { messages?: { tool_calls?: { id?: string; name: string; args: Record<string, unknown> }[]; tool_call_id?: string; content?: unknown }[] })?.messages ?? [];
        for (const m of msgs) {
          for (const call of m.tool_calls ?? []) {
            if (call.id) {
              if (seenCalls.has(call.id)) continue;
              seenCalls.add(call.id);
            }
            if (call.name === 'write_todos') {
              const todos = (call.args['todos'] as { content: string; status: string }[] | undefined) ?? [];
              push({ agent: 'Lead Investigator', kind: 'plan', title: 'Updated the plan', detail: todos.map((t) => `${t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '…' : '○'} ${t.content}`).join('\n'), status: 'done' });
            } else if (call.name === 'task') {
              const who: AgentName = call.args['subagent_type'] === 'evidence-reviewer' ? 'Evidence Reviewer' : call.args['subagent_type'] === 'timeline-researcher' ? 'Timeline Researcher' : 'System';
              const ref = call.id ?? randomUUID();
              taskRefs.set(ref, who);
              delegatedTo.add(who);
              push({ agent: 'Lead Investigator', kind: 'delegate', title: `Delegated to ${who}`, detail: String(call.args['description'] ?? ''), status: 'running', ref });
            }
          }
          if (m.tool_call_id && taskRefs.has(m.tool_call_id) && !seenReplies.has(m.tool_call_id)) {
            seenReplies.add(m.tool_call_id);
            const who = taskRefs.get(m.tool_call_id) as AgentName;
            const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
            push({ agent: who, kind: 'report', title: `${who} reported back`, detail: text.slice(0, 1200), status: 'done', ref: m.tool_call_id });
          }
        }
      }
    }
  };
  await pass([{ role: 'user', content: `Test this claim against the case evidence: "${input.claim}"` }]);
  // Both subagents are part of the method. If the lead finished without one, it is sent back
  // once, with that instruction recorded here, to delegate before it decides.
  const missing = (['Timeline Researcher', 'Evidence Reviewer'] as const).filter((a) => !delegatedTo.has(a));
  if (missing.length && final?.messages) {
    const names = missing.map((a) => (a === 'Evidence Reviewer' ? 'evidence-reviewer' : 'timeline-researcher')).join(' and ');
    push({ agent: 'System', kind: 'plan', title: `Sent back to the lead: ${missing.join(' and ')} not yet consulted`, detail: `The method requires both subagents. The lead was asked to delegate to the ${names} before returning its finding.`, status: 'done' });
    await pass([...final.messages, { role: 'user', content: `Before deciding, delegate to the ${names} with the task tool (the method requires an independent ${missing.includes('Evidence Reviewer') ? 'review that challenges the claim' : 'timeline search'}), compare, then return the structured finding again.` }]);
  }
  const out = final?.structuredResponse;
  if (!out) throw new Error('The lead investigator did not return a structured finding. Try again.');
  push({ agent: 'Lead Investigator', kind: 'finding', title: `Proposed finding: ${out.finding.replace('_', ' ')}`, detail: out.explanation, status: 'done' });

  // ---------- server-side verification ----------
  const vref = randomUUID();
  push({ agent: 'Verifier', kind: 'verify', title: 'Checking every quote against the stored evidence', status: 'running', ref: vref });
  const check = (evidenceId: string, quote: string) => {
    const page = store.pages.get(evidenceId);
    if (!page) return { ok: false, why: `${evidenceId} is not a stored page of this case`, page };
    if (!returned.has(evidenceId)) return { ok: false, why: `${evidenceId} was not returned by any tool during this run`, page };
    const sameSource = [...store.pages.values()].filter((p) => p.sourceId === page.sourceId).map((p) => ({ page: p.page, text: p.text }));
    // A quote with omissions ("A … B", or a trailing "...") passes only if every piece is on the page.
    const pieces = quote.split(/\s*(?:\.{3}|…)\s*/).map((x) => x.trim()).filter((x) => x.length > 0);
    if (pieces.length > 1 || /(\.{3}|…)\s*$/.test(quote.trim())) {
      if (pieces.some((x) => x.length < 8)) return { ok: false, why: 'A quoted piece is too short to check', page };
      const missing = pieces.filter((x) => checkScannedQuote(sameSource, x, page.page).status !== 'exact');
      return missing.length
        ? { ok: false, why: `Part of the quote is not on the stored page: “${missing[0]!.slice(0, 60)}”`, page }
        : { ok: true, why: `Quote found on ${page.sourceTitle}, ${page.location} (with omissions marked)`, page };
    }
    const r = checkScannedQuote(sameSource, quote, page.page);
    if (r.status === 'exact') return { ok: true, why: `Quote found on ${page.sourceTitle}, ${page.location}${'loose' in r && r.loose ? ' (spacing ignored)' : ''}`, page };
    if (r.status === 'moved') return { ok: false, why: `Quote is in another record of this source, not ${page.location}`, page };
    return { ok: false, why: 'Quote not found on the stored page', page };
  };
  const around = (text: string, quote: string) => {
    const i = text.toLowerCase().replace(/\s+/g, ' ').indexOf(quote.toLowerCase().replace(/\s+/g, ' ').slice(0, 40));
    const flat = text.replace(/\s+/g, ' ');
    const at = i >= 0 ? Math.max(0, i - 500) : 0;
    return flat.slice(at, at + 1600);
  };
  const citations: VerifiedCitation[] = out.citations.map((c) => {
    const r = check(c.evidence_id, c.quote);
    return {
      evidence_id: c.evidence_id,
      source_id: r.page?.sourceId ?? '',
      source_title: r.page?.sourceTitle ?? c.evidence_id,
      page: r.page?.page ?? 0,
      location: r.page?.location ?? '',
      quote: c.quote,
      role: c.role,
      verified: r.ok,
      check: r.why,
      context: r.page ? around(r.page.text, c.quote) : '',
      url: r.page?.url ?? null,
      method: r.page?.method ?? '',
      frame: r.page?.frame ?? null,
    };
  });
  const events = out.timeline_events.map((e) => {
    const r = check(e.evidence_id, e.quote);
    const year = /\d{4}/.exec(e.date)?.[0];
    const dated = !year || e.quote.includes(year) || (r.page?.text ?? '').includes(year);
    return {
      ...e,
      verified: r.ok && dated,
      check: r.ok && !dated ? `Quote found, but the year ${year} is not on that page` : r.why,
      source_title: r.page?.sourceTitle ?? e.evidence_id,
      page: r.page?.page ?? null,
      location: r.page?.location ?? null,
    };
  });
  const verified = citations.filter((c) => c.verified).length;
  const eventsVerified = events.filter((e) => e.verified).length;
  let finding = out.finding;
  let note = `${verified} of ${citations.length} citations and ${eventsVerified} of ${events.length} dated events were found on their stored pages.`;
  const decisive = finding === 'supported' ? 'supports' : finding === 'challenged' ? 'challenges' : null;
  const failedDecisive = decisive ? citations.filter((c) => c.role === decisive && !c.verified) : [];
  if (verified === 0 && finding !== 'insufficient_evidence') {
    note += ` The proposed finding (${finding.replace('_', ' ')}) had no verified citation, so it is reported as insufficient evidence.`;
    finding = 'insufficient_evidence';
  } else if (decisive && (failedDecisive.length > 0 || !citations.some((c) => c.role === decisive && c.verified))) {
    note += ` The proposed finding (${finding.replace('_', ' ')}) rests partly on passages that could not be verified (${failedDecisive.map((c) => c.evidence_id).join(', ') || 'none of its kind verified'}), so it is reported as insufficient evidence.`;
    finding = 'insufficient_evidence';
  }
  push({ agent: 'Verifier', kind: 'verify', title: 'Verification complete', detail: note, status: 'done', ref: vref, evidenceIds: citations.filter((c) => c.verified).map((c) => c.evidence_id) });

  return {
    investigation_id: randomUUID(),
    case_id: input.caseId,
    claim: input.claim,
    finding,
    explanation: out.explanation,
    timeline_events: events,
    citations,
    open_questions: out.open_questions,
    agent_activity: activity,
    verification: { citations: citations.length, verified, events: events.length, events_verified: eventsVerified, note },
    model: paced.current(),
    duration_s: Math.round((Date.now() - t0) / 1000),
  };
}

export type { CaseStore };
