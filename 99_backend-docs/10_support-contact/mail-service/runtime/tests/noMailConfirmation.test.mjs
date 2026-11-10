import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createMailService, catalogDigest } from '../service.mjs';
import { createFirestoreStore } from '../firestoreStore.mjs';
import { noMailContext, noMailContextToken, validNoMailConfirmation } from '../noMailConfirmation.mjs';
import { fakeStore } from './fakeStore.mjs';
import { memoryFirestore } from './memoryFirestore.mjs';

const A = '11111111-1111-4111-8111-111111111111';
const START = '2026-11-01T00:00:00.000Z';
const END = '2026-11-10T00:00:00.000Z';
const NOW = '2026-11-11T00:00:00.000Z';
const actor = { email: 'staff@abroad-o.com', authMode: 'domain' };
const cases = (ids) => ids.map((caseId) => ({ caseId, handledStatus: '未対応', closedAt: null }));
function fixture(ids = [A]) {
  const catalog = { complete: true, snapshotId: 'catalog-1', cases: cases(ids), caseIds: ids, digest: catalogDigest(cases(ids)) };
  const state = { state: 'complete', startAt: START, cutoffAt: END, catalogSnapshotId: 'catalog-1', executionId: 'sync-1',
    mode: 'full', failedCount: 0, historyId: '123', lastSuccessAt: END };
  const store = fakeStore(ids, state); store.setCatalog(catalog);
  const execute = createMailService({ store, gmail: {}, core: {}, now: () => new Date(NOW) });
  const envelope = (operation, payload = {}, changes = {}) => ({ contractVersion: 1, operation, payload,
    requestId: randomUUID(), issuedAt: NOW, actor, ...changes });
  return { store, catalog, state, execute, envelope };
}

test('in-app no-mail confirmation is audited, idempotent and readable by another user', async () => {
  const f = fixture(); const before = await f.execute(f.envelope('listCaseMail', { caseId: A }));
  assert.equal(before.noMail.eligible, true); assert.equal(before.noMail.confirmation, null);
  const request = f.envelope('confirmCaseNoMail', { caseId: A, contextToken: before.noMail.contextToken });
  const confirmed = await f.execute(request); const again = await f.execute(request);
  assert.deepEqual(again.noMail, confirmed.noMail);
  assert.deepEqual(confirmed.noMail.confirmation, { email: actor.email, at: NOW, startAt: START, cutoffAt: END });
  assert.equal(confirmed.sync.acceptanceReady, true); assert.equal(f.store.events.length, 1);
  const other = await f.execute(f.envelope('listCaseMail', { caseId: A }, { actor: { email: 'other@abroad-o.com', authMode: 'domain' } }));
  assert.deepEqual(other.noMail.confirmation, confirmed.noMail.confirmation);
  await assert.rejects(f.execute({ ...request, actor: { email: 'other@abroad-o.com', authMode: 'domain' } }), { code: 'MAIL_REQUEST_CONFLICT' });
  assert.deepEqual((await f.store.getCatalog()).cases, cases([A]));
  assert.equal((await f.execute(f.envelope('listMailIssues', { kind: 'coverage' }))).targets.length, 0);
});

test('pending mail, source failures, active lease and a current case match prohibit confirmation', async () => {
  for (const reason of ['pending', 'matched', 'failed', 'deleted', 'lease', 'running']) {
    const f = fixture(); const token = (await f.execute(f.envelope('listCaseMail', { caseId: A }))).noMail.contextToken;
    if (reason === 'pending' || reason === 'matched') f.store.seed({ messageId: 'mail', internalDate: END,
      matchState: reason, caseId: reason === 'matched' ? A : null, firstReview: null, unavailable: false });
    if (reason === 'failed' || reason === 'running') {
      const lease = await f.store.acquireSyncLease('change');
      await f.store.setSyncState({ ...f.state, ...(reason === 'failed' ? { failedCount: 1 } : { state: 'running' }) }, lease);
      await f.store.releaseSyncLease(lease);
    }
    if (reason === 'deleted') await f.store.recordUnobservedDeletion('missing', NOW);
    if (reason === 'lease') await f.store.acquireSyncLease('active');
    await assert.rejects(f.execute(f.envelope('confirmCaseNoMail', { caseId: A, contextToken: token })), { code: 'MAIL_MAPPING_CHANGED' });
    assert.equal(f.store.events.length, 0);
  }
});

test('sync, catalog and unrelated classification changes invalidate old absence and receipt replay', async () => {
  for (const kind of ['sync', 'catalog', 'classification']) {
    const f = fixture(); const token = (await f.execute(f.envelope('listCaseMail', { caseId: A }))).noMail.contextToken;
    const request = f.envelope('confirmCaseNoMail', { caseId: A, contextToken: token }); await f.execute(request);
    if (kind === 'sync') {
      const lease = await f.store.acquireSyncLease('change');
      await f.store.setSyncState({ ...f.state, executionId: 'sync-2' }, lease); await f.store.releaseSyncLease(lease);
    } else if (kind === 'catalog') f.store.setCatalog({ ...f.catalog, digest: 'a'.repeat(64) });
    else f.store.seed({ messageId: 'excluded', internalDate: END, matchState: 'excluded', caseId: null });
    const current = await f.execute(f.envelope('listCaseMail', { caseId: A }));
    assert.equal(current.noMail.confirmation, null); assert.equal(current.noMail.stale, true);
    await assert.rejects(f.execute(request), { code: 'MAIL_MAPPING_CHANGED' });
  }
});

test('no-mail coverage reaches every case beyond 200 without truncating residuals', async () => {
  const ids = Array.from({ length: 203 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
  const f = fixture(ids);
  for (const caseId of ids) {
    const current = await f.execute(f.envelope('listCaseMail', { caseId }));
    await f.execute(f.envelope('confirmCaseNoMail', { caseId, contextToken: current.noMail.contextToken }));
  }
  const status = await f.execute(f.envelope('getSyncStatus'));
  assert.equal(status.sync.coverageUnverifiedCaseCount, 0); assert.equal(status.sync.acceptanceReady, true);
});

test('Firestore serializes absence against a competing match and preserves no stale confirmation', async () => {
  const root = 'contactMailboxes/customer-speed-ad'; const entries = cases([A]); const digest = catalogDigest(entries);
  const state = fixture().state;
  const db = memoryFirestore({ [`${root}/meta/activeCatalog`]: { snapshotId: 'catalog-1', total: 1, digest },
    [`${root}/catalogSnapshots/catalog-1/pages/0000`]: { pageIndex: 0, cases: entries }, [`${root}/meta/sync`]: state });
  const store = createFirestoreStore(db);
  const context = noMailContext({ complete: true, snapshotId: 'catalog-1', digest }, state);
  const input = { caseId: A, caseEntry: entries[0], contextToken: noMailContextToken(context), email: actor.email, at: NOW,
    requestId: '00000000-0000-4000-8000-000000000001', fingerprint: 'fingerprint' };
  await Promise.all([store.confirmCaseNoMail(input), store.upsertIndexedMessage({ messageId: 'new-match', caseId: A,
    matchState: 'matched', version: 1, internalDate: END, indexedAt: NOW }, digest)]);
  assert.equal(await store.getCaseNoMailConfirmation(A), null);
  const latest = noMailContext({ complete: true, snapshotId: 'catalog-1', digest }, state, await store.getMappingRevision());
  assert.equal(validNoMailConfirmation(await store.getCaseNoMailConfirmation(A), latest), false);
  await assert.rejects(store.confirmCaseNoMail(input), { code: 'MAIL_MAPPING_CHANGED' });
  db.records.delete(`${root}/messages/new-match`);
  db.records.set(`${root}/meta/mappingRevision`, {});
  await assert.rejects(store.confirmCaseNoMail(input), { code: 'MAIL_MAPPING_CHANGED' });
  db.records.delete(`${root}/meta/mappingRevision`);
  db.records.set(`${root}/meta/syncLease`, { expiresAt: '1' });
  await assert.rejects(store.confirmCaseNoMail(input), { code: 'MAIL_SYNC_BUSY' });
});

test('stored map field order cannot invalidate a current record and purge generation cannot revive it', () => {
  const f = fixture(); const context = noMailContext(f.catalog, f.state);
  const reordered = Object.fromEntries(Object.entries(context).reverse());
  const record = { caseId: A, email: actor.email, at: NOW, requestId: '00000000-0000-4000-8000-000000000001', context: reordered };
  assert.equal(validNoMailConfirmation(record, context), true);
  assert.equal(validNoMailConfirmation(record, { ...context, purgeGeneration: 1 }), false);
});
