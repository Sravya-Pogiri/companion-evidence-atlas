import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { investigationAssets } from './investigation-assets';
import { authorizedFootage, FOOTAGE_MODEL, footageIndexName, footageMatches, footageSearchForm, footageUploadForm } from './footage-search-protocol';

// "Find in footage" via the TwelveLabs v1.3 search API (Marengo index).
// Staged synthetic uploads only: the case allowlist below restricts every
// index/search call to the authorized clip for the current case.

const API = 'https://api.twelvelabs.io/v1.3';

const stagedClips = {
  conflicting: { video: investigationAssets.conflicting.video },
  matching: { video: investigationAssets.matching.video },
  incomplete: { video: investigationAssets.incomplete.video },
  fresh: { video: investigationAssets.fresh.video },
  'fresh-truncated': { video: investigationAssets['fresh-truncated'].video },
} as const;

type StagedCase = keyof typeof stagedClips;
const caseSchema = z.enum(Object.keys(stagedClips) as [StagedCase, ...StagedCase[]]);

const setupError = { ok: false as const, setup: true as const, error: 'Setup required: add TWELVELABS_API_KEY as a server-side secret to enable live footage search.' };

async function api(apiKey: string, path: string, init: RequestInit): Promise<{ status: number; body: any }> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'x-api-key': apiKey, ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { status: response.status, body };
}

function failure(operation: string, response: { status: number; body: any }) {
  const code = typeof response.body?.code === 'string' ? response.body.code : 'unknown';
  console.error(`TwelveLabs ${operation} failed: ${response.status} (${code})`);
  const guidance = response.status === 401 ? ' Re-enter a valid TwelveLabs key in Secrets.' : response.status === 429 ? ' Wait before retrying.' : response.status === 402 || response.status === 422 ? ' Check your TwelveLabs allowance and billing.' : '';
  return { ok: false as const, setup: false as const, error: `TwelveLabs ${operation} failed (${response.status}; ${code}).${guidance}` };
}

/** Start asynchronous indexing of the authorized staged clip for a case. */
export const startFootageIndexing = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ caseId: caseSchema }).parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env['TWELVELABS_API_KEY'];
    if (!apiKey) return setupError;
    try {
      const name = footageIndexName(data.caseId);
      const listed = await api(apiKey, `/indexes?index_name=${encodeURIComponent(name)}`, { method: 'GET' });
      if (listed.status >= 400) return failure('index lookup', listed);
      let indexId = String(listed.body?.data?.find((item: { index_name: string }) => item.index_name === name)?._id ?? '');
      if (!indexId) {
        const created = await api(apiKey, '/indexes', {
          method: 'POST',
          body: JSON.stringify({ index_name: name, models: [{ model_name: FOOTAGE_MODEL, model_options: ['visual', 'audio'] }] }),
        });
        if (created.status >= 400) return failure('index creation', created);
        indexId = String((created.body as { _id?: string })?._id ?? '');
      }
      if (!indexId) throw new Error('TwelveLabs returned no index identifier.');
      const videoUrl = stagedClips[data.caseId].video;
      const tasks = await api(apiKey, `/tasks?index_id=${encodeURIComponent(indexId)}&page_limit=50`, { method: 'GET' });
      if (tasks.status >= 400) return failure('task lookup', tasks);
      const existing = tasks.body?.data?.find((item: { status: string }) => item.status !== 'failed');
      if (existing?._id) return { ok: true as const, setup: false as const, indexId, taskId: String(existing._id), status: String(existing.status) };
      // Asset pointers may be relative and preview links may be gated. Upload
      // the allowlisted clip bytes, never a caller-supplied URL or file.
      const clipResponse = await fetch(new URL(videoUrl, getRequest().url), { signal: AbortSignal.timeout(30000) });
      if (!clipResponse.ok || !clipResponse.headers.get('content-type')?.startsWith('video/')) throw new Error('Staged recording unavailable');
      const clip = await clipResponse.blob();
      if (clip.size > 20 * 1024 * 1024) throw new Error('Staged recording exceeds upload limit');
      const task = await api(apiKey, '/tasks', { method: 'POST', body: footageUploadForm(indexId, data.caseId, videoUrl, clip) });
      if (task.status >= 400) return failure('indexing task', task);
      const taskId = String((task.body as { _id?: string })?._id ?? '');
      return { ok: true as const, setup: false as const, indexId, taskId, status: 'pending' as const };
    } catch (e) {
      return { ok: false as const, setup: false as const, error: 'Footage indexing unavailable. Please retry.' };
    }
  });

/** Poll the actual processing state of an indexing task. */
export const footageIndexingStatus = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ caseId: caseSchema, taskId: z.string().regex(/^[a-f0-9]{24}$/) }).parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env['TWELVELABS_API_KEY'];
    if (!apiKey) return setupError;
    try {
      const task = await api(apiKey, `/tasks/${data.taskId}`, { method: 'GET' });
      if (task.status >= 400) return failure('status check', task);
      const index = await api(apiKey, `/indexes/${task.body?.index_id}`, { method: 'GET' });
      if (index.status >= 400 || index.body?.index_name !== footageIndexName(data.caseId)) return { ok: false as const, setup: false as const, error: 'This indexing task is not authorized for this staged case.' };
      const body = task.body as { status?: string; video_id?: string };
      return { ok: true as const, setup: false as const, status: String(body.status ?? 'unknown'), videoId: body.video_id ?? null };
    } catch (e) {
      return { ok: false as const, setup: false as const, error: 'Footage status unavailable. Please retry.' };
    }
  });

/** Search only the authorized indexed video for the current case. */
export const searchFootage = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ caseId: caseSchema, indexId: z.string().regex(/^[a-f0-9]{24}$/), videoId: z.string().regex(/^[a-f0-9]{24}$/), query: z.string().trim().min(2).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env['TWELVELABS_API_KEY'];
    if (!apiKey) return setupError;
    try {
      const index = await api(apiKey, `/indexes/${data.indexId}`, { method: 'GET' });
      if (index.status >= 400 || index.body?.index_name !== footageIndexName(data.caseId)) return { ok: false as const, setup: false as const, error: 'This index is not authorized for this staged case.' };
      const video = await api(apiKey, `/indexes/${data.indexId}/videos/${data.videoId}`, { method: 'GET' });
      if (video.status >= 400 || !authorizedFootage(video.body?.user_metadata, data.caseId, stagedClips[data.caseId].video)) return { ok: false as const, setup: false as const, error: 'This recording is not authorized for this staged case.' };
      const response = await api(apiKey, '/search', {
        method: 'POST',
        body: footageSearchForm(data.indexId, data.videoId, data.query),
      });
      if (response.status >= 400) return failure('search', response);
      const body = response.body as { data?: { start?: number; end?: number; score?: number; video_id?: string }[] };
      const matches = footageMatches(body.data ?? [], data.videoId, investigationAssets[data.caseId].start);
      return { ok: true as const, setup: false as const, matches };
    } catch (e) {
      return { ok: false as const, setup: false as const, error: 'Footage search unavailable. Please retry.' };
    }
  });
