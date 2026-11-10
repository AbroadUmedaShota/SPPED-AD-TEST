import { createRequestId } from '../requestIdentity.mjs';
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
    requestId: createRequestId(new Date(NOW)), issuedAt: NOW, actor, ...changes });
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

test('active catalog identity invalidates old completion and absence until a new full sync', async () => {
  const f = fixture();
  const before = await f.execute(f.envelope('listCaseMail', { caseId: A }));
  await f.execute(f.envelope('confirmCaseNoMail', { caseId: A, contextToken: before.noMail.contextToken }));
  assert.equal((await f.execute(f.envelope('getSyncStatus'))).sync.acceptanceReady, true);
  const entries = [{ caseId: A, handledStatus: '対応中', closedAt: null }];
  const snapshotId = randomUUID(); const digest = catalogDigest(entries);
  await f.execute(f.envelope('uploadCaseCatalog', { snapshotId, pageIndex: 0, pageCount: 1, total: 1, digest, cases: entries }));
  const stale = await f.execute(f.envelope('listCaseMail', { caseId: A }));
  assert.equal(stale.sync.catalogDigest, digest);
  assert.equal(stale.sync.catalogSnapshotId, snapshotId);
  assert.equal(stale.sync.state, 'needs_full_sync');
  assert.equal(stale.sync.acceptanceReady, false);
  assert.equal(stale.noMail.eligible, false);
  assert.equal(stale.noMail.confirmation, null);
  await assert.rejects(f.execute(f.envelope('confirmCaseNoMail', { caseId: A, contextToken: before.noMail.contextToken })), { code: 'MAIL_MAPPING_CHANGED' });
  const execute = createMailService({ store: f.store, gmail: {
    async getProfile() { return { emailAddress: 'customer@speed-ad.com', historyId: '456' }; },
    async listMessages() { return { messageIds: [] }; },
    async listHistory() { throw new Error('changed catalog must use full sync'); }
  }, core: {}, now: () => new Date(NOW) });
  const executionId = randomUUID();
  let result = await execute(f.envelope('advanceSync', { executionId, mode: 'history', startAt: START, catalogSnapshotId: snapshotId, catalogDigest: digest }));
  while (result.sync.state === 'running') result = await execute(f.envelope('advanceSync', { executionId }));
  assert.equal(result.sync.mode, 'full');
  assert.equal(result.sync.catalogDigest, digest);
  const current = await execute(f.envelope('listCaseMail', { caseId: A }));
  assert.equal(current.noMail.eligible, true);
  assert.notEqual(current.noMail.contextToken, before.noMail.contextToken);
  const confirmed = await execute(f.envelope('confirmCaseNoMail', { caseId: A, contextToken: current.noMail.contextToken }));
  assert.equal(confirmed.sync.acceptanceReady, true);
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

test('fixed-cutoff absence ignores later history arrivals without hiding them from mail queues', async () => {
  const f = fixture(); const after = '2026-11-10T00:00:00.001Z';
  f.store.seed({ messageId: 'later-match', internalDate: after, matchState: 'matched', caseId: A, firstReview: null });
  f.store.seed({ messageId: 'later-pending', internalDate: after, matchState: 'pending', caseId: null, firstReview: null });
  const listed = await f.execute(f.envelope('listCaseMail', { caseId: A }));
  assert.deepEqual(listed.messages.map((item) => item.messageId), ['later-match']);
  assert.equal(listed.noMail.eligible, true); assert.equal(listed.sync.pendingCount, 0);
  assert.equal(listed.sync.coverageUnverifiedCaseCount, 1);
  const issues = await f.execute(f.envelope('listMailIssues', { kind: 'coverage' }));
  assert.deepEqual(issues.targets.map((item) => item.caseId), [A]);
  const confirmed = await f.execute(f.envelope('confirmCaseNoMail', { caseId: A, contextToken: listed.noMail.contextToken }));
  assert.equal(confirmed.sync.acceptanceReady, true);
  assert.equal((await f.execute(f.envelope('listPendingMail'))).messages[0].messageId, 'later-pending');
  assert.equal((await f.execute(f.envelope('listCaseMail', { caseId: A }))).messages[0].messageId, 'later-match');
  f.store.seed({ messageId: 'at-cutoff', internalDate: END, matchState: 'pending', caseId: null, firstReview: null });
  const blocked = await f.execute(f.envelope('listCaseMail', { caseId: A }));
  assert.equal(blocked.noMail.eligible, false); assert.equal(blocked.sync.pendingCount, 1);
  assert.equal(blocked.noMail.confirmation, null);
});

test('Firestore confirmation queries include cutoff exactly and exclude its immediate successor', async () => {
  const root = 'contactMailboxes/customer-speed-ad'; const entries = cases([A]); const digest = catalogDigest(entries); const state = fixture().state;
  const db = memoryFirestore({ [`${root}/meta/activeCatalog`]: { snapshotId: 'catalog-1', total: 1, digest },
    [`${root}/catalogSnapshots/catalog-1/pages/0000`]: { pageIndex: 0, cases: entries }, [`${root}/meta/sync`]: state,
    [`${root}/messages/later-match`]: { caseId: A, matchState: 'matched', internalDate: '2026-11-10T00:00:00.001Z' },
    [`${root}/messages/later-pending`]: { caseId: null, matchState: 'pending', internalDate: '2026-11-10T00:00:00.001Z' } });
  const store = createFirestoreStore(db); const context = noMailContext({ complete: true, snapshotId: 'catalog-1', digest }, state);
  const input = { caseId: A, caseEntry: entries[0], contextToken: noMailContextToken(context), email: actor.email, at: NOW,
    requestId: '00000000-0000-4000-8000-000000000001', fingerprint: 'cutoff' };
  assert.equal((await store.confirmCaseNoMail(input)).confirmation.email, actor.email);
  assert.deepEqual(await store.getCoveredCaseIds({ startAt: START, cutoffAt: END }), []);
  for (const matchState of ['matched', 'pending']) {
    db.records.set(`${root}/messages/exact`, { caseId: matchState === 'matched' ? A : null, matchState, internalDate: END });
    await assert.rejects(store.confirmCaseNoMail({ ...input, requestId: randomUUID(), fingerprint: matchState }), { code: 'MAIL_MAPPING_CHANGED' });
  }
});

test('revoked or inconsistent stored absence is hidden and a fresh action records the new actor', async () => {
  for (const invalid of ['flag', 'case', 'time', 'context']) {
    const root = 'contactMailboxes/customer-speed-ad'; const entries = cases([A]); const digest = catalogDigest(entries); const state = fixture().state;
    const context = noMailContext({ complete: true, snapshotId: 'catalog-1', digest }, state);
    const old = { caseId: A, email: 'old@abroad-o.com', at: END, requestId: randomUUID(), context };
    const value = { noMailConfirmed: true, noMailConfirmation: old };
    if (invalid === 'flag') value.noMailConfirmed = false;
    if (invalid === 'case') old.caseId = '22222222-2222-4222-8222-222222222222';
    if (invalid === 'time') old.at = '2026-11-12T00:00:00.000Z';
    if (invalid === 'context') old.context = { ...context, executionId: 'old-sync' };
    const db = memoryFirestore({ [`${root}/meta/activeCatalog`]: { snapshotId: 'catalog-1', total: 1, digest },
      [`${root}/catalogSnapshots/catalog-1/pages/0000`]: { pageIndex: 0, cases: entries }, [`${root}/meta/sync`]: state,
      [`${root}/caseCoverage/${A}`]: value });
    const store = createFirestoreStore(db);
    store.countMessages = async () => ({ pending: 0, unreviewed: 0, unavailable: 0, bodyUnverified: 0, bodyUnavailable: 0, attachmentUnverified: 0, attachmentUnavailable: 0 });
    store.countUnobservedDeletions = async () => 0;
    const execute = createMailService({ store, gmail: {}, core: {}, now: () => new Date(NOW) });
    const envelope = (operation, payload) => ({ contractVersion: 1, operation, payload, actor, issuedAt: NOW, requestId: createRequestId(new Date(NOW)) });
    const before = await execute(envelope('listCaseMail', { caseId: A }));
    assert.equal(before.noMail.confirmation, null, invalid);
    const result = await execute(envelope('confirmCaseNoMail', { caseId: A, contextToken: before.noMail.contextToken }));
    assert.equal(result.noMail.confirmation.email, actor.email, invalid);
    assert.equal(db.records.get(`${root}/caseCoverage/${A}`).noMailConfirmed, true);
    assert.equal(db.records.get(`${root}/events/generated`).actor, actor.email);
  }
});

test('acceptance residual lists match fixed-cutoff counts while ordinary queues retain later mail', async () => {
  const f = fixture(); const after = '2026-11-10T00:00:00.001Z';
  for (const [suffix, internalDate] of [['exact', END], ['later', after]]) {
    for (const matchState of ['pending', 'matched']) f.store.seed({ messageId: `${matchState}-${suffix}`, internalDate,
      matchState, caseId: matchState === 'matched' ? A : null, firstReview: null, unavailable: true,
      bodyAvailability: matchState === 'pending' ? 'unverified' : 'unavailable', unverifiedAttachmentCount: 1, unavailableAttachmentCount: 1 });
  }
  const status = (await f.execute(f.envelope('getSyncStatus'))).sync;
  for (const [kind, countField] of [['pending', 'pendingCount'], ['unreviewed', 'unreviewedCount'],
    ['unavailable', 'unavailableCount'], ['bodyUnverified', 'bodyUnverifiedCount'], ['bodyUnavailable', 'bodyUnavailableCount'],
    ['attachmentUnverified', 'attachmentUnverifiedCount'], ['attachmentUnavailable', 'attachmentUnavailableCount']]) {
    const result = await f.execute(f.envelope('listMailIssues', { kind }));
    assert.equal(result.targets.length, status[countField], kind);
    assert.ok(result.targets.every((item) => item.message.internalDate === END), kind);
  }
  assert.deepEqual((await f.execute(f.envelope('listPendingMail'))).messages.map((item) => item.messageId), ['pending-later', 'pending-exact']);
  assert.deepEqual((await f.execute(f.envelope('listUnreviewedMail'))).messages.map((item) => item.messageId), ['matched-later', 'matched-exact']);
});

test('acceptance residual cursors and snapshots cannot survive a changed cutoff', async () => {
  const ids = Array.from({ length: 55 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
  const f = fixture(ids);
  for (let index = 0; index < 55; index++) f.store.seed({ messageId: `pending-${String(index).padStart(3, '0')}`,
    internalDate: END, matchState: 'pending', caseId: null, firstReview: null });
  const tokens = new Map();
  for (const kind of ['pending', 'coverage']) tokens.set(kind, (await f.execute(f.envelope('listMailIssues', { kind }))).page.nextPageToken);
  assert.ok([...tokens.values()].every(Boolean));
  const lease = await f.store.acquireSyncLease('cutoff-change');
  await f.store.setSyncState({ ...f.state, cutoffAt: '2026-11-10T00:00:00.001Z' }, lease); await f.store.releaseSyncLease(lease);
  for (const [kind, pageToken] of tokens) await assert.rejects(f.execute(f.envelope('listMailIssues', { kind, pageToken })), { code: 'MAIL_INVALID_REQUEST' });
  const unknown = await f.store.acquireSyncLease('missing-cutoff');
  await f.store.setSyncState({ ...f.state, cutoffAt: null }, unknown); await f.store.releaseSyncLease(unknown);
  await assert.rejects(f.execute(f.envelope('listMailIssues', { kind: 'pending' })), { code: 'MAIL_PERIOD_REQUIRED' });
  assert.equal((await f.execute(f.envelope('listPendingMail'))).messages.length, 50);
});
