import assert from 'node:assert/strict';
import test from 'node:test';
import { createMailPurge } from '../mailPurge.mjs';
import { parsePurgeArguments, runPurgeCli } from '../purgeMailMetadata.mjs';
import { memoryFirestore } from '../../runtime/tests/memoryFirestore.mjs';
import { catalogDigest } from '../../runtime/service.mjs';
import { createFirestoreStore } from '../../runtime/firestoreStore.mjs';
import { suppressionKey } from '../../runtime/purgeGate.mjs';

const root = 'contactMailboxes/customer-speed-ad';
const target = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
function fixture(extra = {}) {
  const cases = [target, other].map((caseId) => ({ caseId, handledStatus: '未対応', closedAt: null }));
  const db = memoryFirestore({
    [`${root}/messages/mailA`]: { messageId: 'mailA', caseId: target, matchState: 'matched', subject: 'private subject', from: 'private@example.com', version: 2, evidence: { bodyCaseIds: [target] }, attachments: [] },
    [`${root}/messages/mailB`]: { messageId: 'mailB', caseId: other, matchState: 'matched', threadId: 'shared-thread', version: 1 },
    [`${root}/events/eventA`]: { messageId: 'mailA', actor: 'reviewer@example.com', previous: { caseId: target } },
    [`${root}/receipts/request-aaaaaaaaaaaa`]: { fingerprint: 'fingerprint', result: { message: { messageId: 'mailA', caseId: target, subject: 'private subject' } } },
    [`${root}/caseCoverage/${target}`]: { count: 1 },
    [`${root}/deletionDiagnostics/mailA`]: { messageId: 'mailA' },
    [`${root}/meta/sync`]: { state: 'complete', failedMessageIds: ['mailA'], startAt: '2026-01-01T00:00:00.000Z' },
    [`${root}/meta/activeCatalog`]: { snapshotId: 'snapshot', total: cases.length, digest: catalogDigest(cases) },
    [`${root}/catalogSnapshots/snapshot/pages/0000`]: { pageIndex: 0, cases },
    ...extra
  });
  return { db, purge: createMailPurge({ db, projectId: 'test-project' }) };
}

test('case purge is dry-run first, deletes all linked records and persists only minimal hashes', async () => {
  const { db, purge } = fixture();
  const before = JSON.stringify([...db.records]);
  const plan = await purge.plan(target, 'deletion-123');
  assert.equal(plan.messageCount, 1);
  assert.equal(JSON.stringify([...db.records]), before);
  assert.doesNotMatch(JSON.stringify(plan), /private|reviewer|mailA/);
  await assert.rejects(purge.apply(target, 'deletion-123', '0'.repeat(64)), { code: 'MAIL_PURGE_PLAN_CHANGED' });
  const result = await purge.apply(target, 'deletion-123', plan.planHash);
  assert.equal(result.mode, 'applied');
  assert(db.records.has(`${root}/messages/mailB`));
  assert(db.records.has(`${root}/suppressedMessages/${suppressionKey('message', 'mailA')}`));
  assert(db.records.has(`${root}/suppressedCases/${suppressionKey('case', target)}`));
  assert(db.records.has(`${root}/suppressedRequests/${suppressionKey('request', 'request-aaaaaaaaaaaa')}`));
  const privateRecords = [...db.records].filter(([path]) => !path.includes('/catalogSnapshots/'));
  assert.doesNotMatch(JSON.stringify(privateRecords), /private|reviewer|mailA|11111111/);
  const catalog = await createFirestoreStore(db).getCatalog();
  assert.deepEqual(catalog.caseIds, [other]);
  assert.deepEqual(catalog.suppressedCaseIds, [target]);
});

test('changed plans, unresolved references, shared history and active sync fail before deletion', async () => {
  for (const extra of [
    { [`${root}/messages/pending`]: { messageId: 'pending', caseId: null, evidence: { bodyCaseIds: [target] } } },
    { [`${root}/messages/mailB`]: { messageId: 'mailB', caseId: other, evidence: { parentMessageIds: ['mailA'] } } },
    { [`${root}/events/mixed`]: { messageId: 'mailA', previous: { caseId: target }, next: { caseId: other } } }
  ]) {
    const { db, purge } = fixture(extra);
    await assert.rejects(purge.plan(target, 'request'), { code: extra[`${root}/events/mixed`] ? 'MAIL_PURGE_SHARED_EVENT' : 'MAIL_PURGE_AMBIGUOUS' });
    assert(db.records.has(`${root}/messages/mailA`));
  }
  const { db, purge } = fixture();
  const plan = await purge.plan(target, 'request');
  db.records.get(`${root}/messages/mailA`).version++;
  await assert.rejects(purge.apply(target, 'request', plan.planHash), { code: 'MAIL_PURGE_PLAN_CHANGED' });
  db.records.set(`${root}/meta/sync`, { state: 'running' });
  const busyPlan = await purge.plan(target, 'request');
  await assert.rejects(purge.apply(target, 'request', busyPlan.planHash), { code: 'MAIL_PURGE_BUSY' });
});

test('partial purge keeps mailbox closed and the same immutable plan resumes', async () => {
  const extra = Object.fromEntries(Array.from({ length: 105 }, (_, index) => [`${root}/events/extra-${index}`, { messageId: 'mailA' }]));
  const { db, purge } = fixture(extra);
  const plan = await purge.plan(target, 'request');
  db.failBatch(2);
  await assert.rejects(purge.apply(target, 'request', plan.planHash));
  assert([...db.records.keys()].filter((key) => key.startsWith(`${root}/events/`)).length < 106);
  const store = createFirestoreStore(db);
  await assert.rejects(store.withAccess(() => store.getMessage('mailB')), { code: 'MAIL_MAINTENANCE' });
  assert.equal((await purge.plan(target, 'request')).mode, 'resume-required');
  await assert.rejects(purge.apply(target, 'different', plan.planHash), { code: 'MAIL_PURGE_PLAN_CHANGED' });
  db.failBatch(0);
  await purge.apply(target, 'request', plan.planHash);
  assert.equal((await store.withAccess(() => store.getMessage('mailB'))).caseId, other);
});

test('Firestore adapter rejects late reads/writes, exact reimport and deleted receipt replay', async () => {
  const { db, purge } = fixture();
  const store = createFirestoreStore(db);
  let resume;
  const delayed = store.withAccess(async () => { await new Promise((resolve) => { resume = resolve; }); return store.getMessage('mailB'); });
  let resumeWrite;
  const delayedWrite = store.withAccess(async () => { await new Promise((resolve) => { resumeWrite = resolve; }); return store.recordBodyObservation('mailB', 'verified', new Date().toISOString()); });
  await new Promise((resolve) => setImmediate(resolve));
  const plan = await purge.plan(target, 'request');
  await purge.apply(target, 'request', plan.planHash);
  resume();
  resumeWrite();
  await assert.rejects(delayed, { code: 'MAIL_MAINTENANCE' });
  await assert.rejects(delayedWrite, { code: 'MAIL_MAINTENANCE' });
  assert.equal(db.records.get(`${root}/messages/mailB`).bodyAvailability, undefined);
  await store.withAccess(async () => {
    await store.upsertIndexedMessage({ messageId: 'mailA', caseId: target, matchState: 'matched', attachments: [], evidence: {}, version: 1 });
    await store.excludeDraft('mailA', new Date().toISOString());
    await store.recordUnobservedDeletion('mailA', new Date().toISOString());
    await assert.rejects(store.recordBodyObservation('mailA', 'verified', new Date().toISOString()), { code: 'MAIL_NOT_FOUND' });
    await assert.rejects(store.getReceipt('request-aaaaaaaaaaaa', 'fingerprint'), { code: 'MAIL_REQUEST_CONFLICT' });
    await assert.rejects(store.saveReceipt('request-aaaaaaaaaaaa', 'fingerprint', {}), { code: 'MAIL_REQUEST_CONFLICT' });
  });
  assert.equal(await store.getMessage('mailA'), null);
  assert(!db.records.has(`${root}/deletionDiagnostics/mailA`));
  await store.upsertIndexedMessage({ messageId: 'newReply', caseId: target, matchState: 'matched', attachments: [], evidence: {}, version: 1 });
  assert.equal((await store.getMessage('newReply')).matchState, 'pending');
  assert.equal((await store.getMessage('mailB')).caseId, other);
});

test('expired exclusions use the server exclusion timestamp, preserve recent and unknown records', async () => {
  const db = memoryFirestore({
    [`${root}/messages/expired`]: { messageId: 'expired', matchState: 'excluded', sourceKind: 'mail', excludedAt: '2023-11-10T09:00:00.000Z' },
    [`${root}/messages/recent`]: { messageId: 'recent', matchState: 'excluded', sourceKind: 'mail', excludedAt: '2023-11-10T09:00:00.001Z' },
    [`${root}/messages/unknown`]: { messageId: 'unknown', matchState: 'excluded', sourceKind: 'mail' },
    [`${root}/messages/draft`]: { messageId: 'draft', matchState: 'excluded', sourceKind: 'draft' },
    [`${root}/events/excluded`]: { messageId: 'expired', actor: 'private@example.com', at: '2023-11-10T09:00:00.000Z' }
  });
  const purge = createMailPurge({ db, projectId: 'test-project', now: () => new Date('2026-11-10T09:00:00.000Z') });
  const plan = await purge.planExpiredExclusions('expiry-20261110');
  assert.equal(plan.messageCount, 1);
  assert.equal(plan.unknownExclusionCount, 1);
  await purge.applyExpiredExclusions('expiry-20261110', plan.planHash);
  assert(!db.records.has(`${root}/messages/expired`));
  for (const id of ['recent', 'unknown', 'draft']) assert(db.records.has(`${root}/messages/${id}`));
  assert(![...db.records.keys()].some((key) => key.startsWith(`${root}/suppressedCases/`)));
});

test('unknown collections and nested data block a partial deletion', async () => {
  for (const extra of [{ [`${root}/future/private`]: { messageId: 'mailA' } }, { [`${root}/messages/mailA/attachments/private`]: { secret: 'private' } }]) {
    const { purge } = fixture(extra);
    await assert.rejects(purge.plan(target, 'request'), { code: 'MAIL_PURGE_UNSUPPORTED_COLLECTION' });
  }
});

test('CLI requires exact target, request reference and apply plan before connecting', async () => {
  let connections = 0;
  await assert.rejects(runPurgeCli(['--apply'], { createDatabase: async () => { connections++; } }), /MAIL_PURGE_INPUT_INVALID/);
  assert.equal(connections, 0);
  assert.throws(() => parsePurgeArguments(['--project', 'test-project', '--confirm-project', 'other-project']), /MAIL_PURGE_INPUT_INVALID/);
});


test('expired-case purge binds the current closure catalog and excludes purged cases from residuals', async () => {
  const cases = [{ caseId: target, handledStatus: '対応済み', closedAt: '2023-11-10T09:00:00.000Z' },
    { caseId: other, handledStatus: '未対応', closedAt: null }];
  const { db } = fixture({ [`${root}/meta/activeCatalog`]: { snapshotId: 'snapshot', total: 2, digest: catalogDigest(cases) },
    [`${root}/catalogSnapshots/snapshot/pages/0000`]: { pageIndex: 0, cases } });
  const purge = createMailPurge({ db, projectId: 'test-project', now: () => new Date('2026-11-10T09:00:00.000Z') });
  const plan = await purge.planExpiredCase(target, 'expiry');
  const reopened = cases.map((item) => item.caseId === target ? { ...item, handledStatus: '未対応', closedAt: null } : item);
  db.records.set(`${root}/meta/activeCatalog`, { snapshotId: 'snapshot', total: 2, digest: catalogDigest(reopened) });
  db.records.set(`${root}/catalogSnapshots/snapshot/pages/0000`, { pageIndex: 0, cases: reopened });
  await assert.rejects(purge.applyExpiredCase(target, 'expiry', plan.planHash), { code: 'MAIL_PURGE_NOT_EXPIRED' });
  assert(db.records.has(`${root}/messages/mailA`));
  db.records.set(`${root}/meta/activeCatalog`, { snapshotId: 'snapshot', total: 2, digest: catalogDigest(cases) });
  db.records.set(`${root}/catalogSnapshots/snapshot/pages/0000`, { pageIndex: 0, cases });
  await purge.applyExpiredCase(target, 'expiry', plan.planHash);
  const catalog = await createFirestoreStore(db).getCatalog();
  assert.deepEqual(catalog.caseIds, [other]);
  assert.deepEqual(catalog.cases, cases);
  assert.deepEqual(catalog.suppressedCaseIds, [target]);
});
