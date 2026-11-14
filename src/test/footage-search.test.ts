import { describe, expect, it } from 'vitest';
import { authorizedFootage, FOOTAGE_MODEL, footageIndexName, footageMatches, footageSearchForm, footageUploadForm } from '@/lib/footage-search-protocol';

describe('live footage search protocol', () => {
  it('uses the supported Marengo model', () => { expect(FOOTAGE_MODEL).toBe('marengo3.0'); });
  it('uploads the actual HTTPS source with case metadata', () => {
    const form = footageUploadForm('index', 'fresh', 'https://cdn.example.org/fresh.mp4');
    expect(form.get('video_url')).toBe('https://cdn.example.org/fresh.mp4');
    expect(JSON.parse(String(form.get('user_metadata')))).toEqual({ caselens_case: 'fresh', caselens_source: 'https://cdn.example.org/fresh.mp4' });
  });
  it('filters a multipart search to exactly one video', () => {
    const form = footageSearchForm('index', 'video', ' trunk opening ');
    expect(form.get('query_text')).toBe('trunk opening');
    expect(JSON.parse(String(form.get('filter')))).toEqual({ id: ['video'] });
    expect(form.getAll('search_options')).toEqual(['visual']);
  });
  it('uploads clip bytes rather than sending a relative asset URL', () => {
    const form = footageUploadForm('index', 'fresh', '/clip.mp4', new Blob(['clip'], { type: 'video/mp4' }));
    expect(form.get('video_url')).toBeNull();
    expect(form.get('video_file')).toBeInstanceOf(Blob);
  });
  it('rejects a recording from another case or source', () => {
    const metadata = { caselens_case: 'fresh', caselens_source: 'https://cdn.example.org/fresh.mp4' };
    expect(authorizedFootage(metadata, 'fresh', metadata.caselens_source)).toBe(true);
    expect(authorizedFootage(metadata, 'conflicting', metadata.caselens_source)).toBe(false);
    expect(authorizedFootage(metadata, 'fresh', 'https://cdn.example.org/private.mp4')).toBe(false);
    expect(authorizedFootage(undefined, 'fresh', metadata.caselens_source)).toBe(false);
    expect(footageIndexName('fresh')).not.toBe(footageIndexName('conflicting'));
  });
  it('excludes other videos and offsets truncated clip hits without verifying them', () => {
    expect(footageMatches([{ video_id: 'allowed', start: 2, end: 4, score: 0.8 }, { video_id: 'private', start: 2, end: 4 }, { video_id: 'allowed', start: 4, end: 2 }], 'allowed', 10)).toEqual([{ start: 12, end: 14, score: 0.8, verified: false }]);
  });
  it('leaves no hits empty rather than inventing evidence', () => { expect(footageMatches([], 'allowed', 0)).toEqual([]); });
});