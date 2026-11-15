import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimRequest } from './claim.ts';
import { datedRecords, loadCase, observation, searchPages } from './evidence-store.ts';

const store = loadCase('btk');

test('every stored record has a case-scoped evidence id and text', () => {
  assert.ok(store.pages.size > 49);
  for (const [id, p] of store.pages) {
    assert.match(id, /^btk:[A-Z0-9_]+:(p\d+|meta)$/);
    assert.ok(p.text.length > 20, id);
  }
});

test('the archive capture time is a stored, quotable record', () => {
  assert.match(store.pages.get('btk:CHURCH:meta')!.text, /2005-02-06T04:47:29Z/);
});

test('search ranks the record a query names first', () => {
  assert.equal(searchPages(store, 'church web page Dennis Rader')[0]!.evidence_id, 'btk:CHURCH:meta');
  assert.equal(searchPages(store, 'disk mailed KSAS')[0]!.evidence_id, 'btk:STATE:p42');
  assert.deepEqual(searchPages(store, 'the and was'), []);
});

test('dated records and observations point at stored pages', () => {
  const d = datedRecords(store);
  assert.equal(d.entries.length, 24);
  assert.ok(d.entries.find((e) => e.evidence_id === 'btk:T15')!.cited_pages.includes('btk:STATE:p42'));
  assert.ok(observation(store, 'B-002')!.cited_pages.includes('btk:STATE:p42'));
  assert.equal(observation(store, 'B-999'), null);
});

test('claim requests are validated', () => {
  assert.equal(claimRequest.safeParse({ caseId: 'btk', claim: 'short' }).success, false);
  assert.equal(claimRequest.safeParse({ caseId: 'other', claim: 'A full sentence claim.' }).success, false);
  assert.equal(claimRequest.safeParse({ caseId: 'btk', claim: 'A full sentence claim.', extra: 1 }).success, false);
  assert.equal(claimRequest.safeParse({ caseId: 'btk', claim: 'A full sentence claim.' }).success, true);
});
