export const FOOTAGE_MODEL = 'marengo3.0';
export function footageIndexName(caseId: string) { return `caselens-staged-v3-${caseId}`; }
export function footageUploadForm(indexId: string, caseId: string, sourceUrl: string, clip?: Blob) {
  const form = new FormData();
  form.set('index_id', indexId);
  if (clip) form.set('video_file', clip, `${caseId}.mp4`);
  else form.set('video_url', sourceUrl);
  form.set('user_metadata', JSON.stringify({ caselens_case: caseId, caselens_source: sourceUrl }));
  return form;
}
export function footageSearchForm(indexId: string, videoId: string, query: string) {
  const form = new FormData();
  form.set('index_id', indexId);
  form.set('query_text', query.trim());
  form.append('search_options', 'visual');
  form.set('filter', JSON.stringify({ id: [videoId] }));
  form.set('page_limit', '50');
  return form;
}
export function authorizedFootage(metadata: Record<string, unknown> | undefined, caseId: string, sourceUrl: string) {
  return metadata?.['caselens_case'] === caseId && metadata?.['caselens_source'] === sourceUrl;
}
export function footageMatches(rows: { start?: number; end?: number; score?: number; video_id?: string }[], videoId: string, offset: number) {
  return rows.filter(m => m.video_id === videoId && typeof m.start === 'number' && typeof m.end === 'number' && Number.isFinite(m.start) && Number.isFinite(m.end) && m.start >= 0 && m.end > m.start)
    .map(m => ({ start: Number(m.start) + offset, end: Number(m.end) + offset, score: typeof m.score === 'number' ? m.score : null, verified: false }));
}