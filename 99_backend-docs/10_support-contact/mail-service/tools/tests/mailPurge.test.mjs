import assert from 'node:assert/strict';
import test from 'node:test';
import { createMailPurge } from '../mailPurge.mjs';
import { parsePurgeArguments, runPurgeCli } from '../purgeMailMetadata.mjs';
import { memoryFirestore } from '../../runtime/tests/memoryFirestore.mjs';
import { catalogDigest } from '../../runtime/service.mjs';
import { createFirestoreStore } from '../../runtime/firestoreStore.mjs';
import { suppressionKey } from '../../runtime/purgeGate.mjs';
import { createRequestId } from '../../runtime/requestIdentity.mjs';

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

test('purged recent request IDs keep only their fixed expiry while expired IDs need no tombstone', async () => {
  const recent = createRequestId(new Date('2026-11-10T00:00:00.000Z'));
  const expired = createRequestId(new Date('2026-11-01T00:00:00.000Z'));
  const { db } = fixture({
    [`${root}/receipts/${recent}`]: { result: { caseId: target } },
    [`${root}/receipts/${expired}`]: { result: { caseId: target } }
  });
  const purge = createMailPurge({ db, projectId: 'test-project', now: () => new Date('2026-11-11T00:00:00.000Z') });
  const plan = await purge.plan(target, 'finite-request-markers');
  await purge.apply(target, 'finite-request-markers', plan.planHash);
  assert.deepEqual(db.records.get(`${root}/suppressedRequests/${suppressionKey('request', recent)}`),
    { version: 2, expiresAt: '2026-11-17T00:00:00.000Z' });
  assert.equal(db.records.has(`${root}/suppressedRequests/${suppressionKey('request', expired)}`), false);
});

test('case purge removes no-mail confirmation actor, event and receipt from the existing coverage scope', async () => {
  const confirmation = { caseId: target, email: 'no-mail-reviewer@abroad-o.com', at: '2026-11-11T00:00:00.000Z',
    requestId: 'no-mail-request-111111', context: { executionId: 'sync-1' } };
  const { db, purge } = fixture({
    [`${root}/caseCoverage/${target}`]: { count: 0, noMailConfirmed: true, noMailConfirmation: confirmation },
    [`${root}/events/no-mail-event`]: { type: 'case.no_mail_confirmed', caseId: target, actor: confirmation.email },
    [`${root}/receipts/no-mail-request-111111`]: { fingerprint: 'no-mail', result: { confirmation } },
    [`${root}/meta/mappingRevision`]: { token: '00000000-0000-4000-8000-000000000001' }
  });
  const plan = await purge.plan(target, 'no-mail-deletion');
  await purge.apply(target, 'no-mail-deletion', plan.planHash);
  assert.equal(db.records.has(`${root}/caseCoverage/${target}`), false);
  assert.equal(db.records.has(`${root}/events/no-mail-event`), false);
  assert.equal(db.records.has(`${root}/receipts/no-mail-request-111111`), false);
  assert.equal(JSON.stringify([...db.records]).includes(confirmation.email), false);
  assert.equal(db.records.has(`${root}/meta/mappingRevision`), true);
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
  const runTransaction = db.runTransaction.bind(db);
  let transactions = 0;
  db.runTransaction = (operation) => ++transactions === 4 ? Promise.reject(new Error('synthetic transaction failure')) : runTransaction(operation);
  await assert.rejects(purge.apply(target, 'request', plan.planHash));
  assert([...db.records.keys()].filter((key) => key.startsWith(`${root}/events/`)).length < 106);
  const store = createFirestoreStore(db);
  await assert.rejects(store.withAccess(() => store.getMessage('mailB')), { code: 'MAIL_MAINTENANCE' });
  assert.equal((await purge.plan(target, 'request')).mode, 'resume-required');
  await assert.rejects(purge.apply(target, 'different', plan.planHash), { code: 'MAIL_PURGE_PLAN_CHANGED' });
  await assert.rejects(purge.cancelUnvalidated(target, 'request', plan.planHash), { code: 'MAIL_PURGE_CANCEL_UNSAFE' });
  db.runTransaction = runTransaction;
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
    [`${root}/events/excluded`]: { messageId: 'expired', actor: 'private@example.com', at: '2023-11-10T09:00:00.000Z', requestId: other }
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

test('review request UUIDs are not case references, while actual shared event cases still block', async () => {
  const { db, purge } = fixture({ [`${root}/events/eventA`]: { type: 'mail.reviewed', messageId: 'mailA', requestId: other } });
  const plan = await purge.plan(target, 'reviewed-case');
  await purge.apply(target, 'reviewed-case', plan.planHash);
  assert(!db.records.has(`${root}/events/eventA`));
  const shared = fixture({ [`${root}/events/eventA`]: { messageId: 'mailA', requestId: target, next: { caseId: other } } });
  await assert.rejects(shared.purge.plan(target, 'shared'), { code: 'MAIL_PURGE_SHARED_EVENT' });
});

test('unsafe expired exclusions remain residuals without blocking independent safe deletions', async () => {
  const expired = (messageId) => ({ messageId, matchState: 'excluded', sourceKind: 'mail', excludedAt: '2023-11-10T09:00:00.000Z' });
  const db = memoryFirestore({
    [`${root}/messages/safe`]: expired('safe'),
    [`${root}/messages/unsafe`]: expired('unsafe'),
    [`${root}/messages/shared`]: expired('shared'),
    [`${root}/messages/another`]: expired('another'),
    [`${root}/messages/recent`]: { ...expired('recent'), excludedAt: '2026-11-10T09:00:00.000Z' },
    [`${root}/events/safe-event`]: { messageId: 'safe', requestId: other },
    [`${root}/events/unsafe-event`]: { messageId: 'unsafe', previous: { caseId: target }, next: { caseId: null } },
    [`${root}/events/recent-shared-event`]: { messageId: 'another', related: { messageId: 'recent' } },
    [`${root}/receipts/request-shared-uuid`]: { result: { messages: [{ messageId: 'unsafe' }, { messageId: 'shared' }] } },
    [`${root}/meta/sync`]: { state: 'complete', failedMessageIds: ['safe', 'unsafe'] }
  });
  const purge = createMailPurge({ db, projectId: 'test-project', now: () => new Date('2026-11-10T09:00:00.000Z') });
  const before = JSON.stringify([...db.records]);
  const plan = await purge.planExpiredExclusions('partial-exclusions');
  assert.equal(plan.messageCount, 1);
  assert.equal(plan.unsafeExclusionCount, 3);
  assert.equal(JSON.stringify([...db.records]), before);
  await purge.applyExpiredExclusions('partial-exclusions', plan.planHash);
  assert(!db.records.has(`${root}/messages/safe`));
  assert(!db.records.has(`${root}/events/safe-event`));
  for (const path of ['messages/unsafe', 'messages/shared', 'messages/another', 'messages/recent', 'events/unsafe-event', 'events/recent-shared-event', 'receipts/request-shared-uuid']) {
    assert(db.records.has(`${root}/${path}`));
  }
  const residual = await purge.planExpiredExclusions('remaining-exclusions');
  assert.equal(residual.messageCount, 0);
  assert.equal(residual.unsafeExclusionCount, 3);
});

test('an expired excluded child can delete its own evidence and review while retaining its parent', async () => {
  for (const unsafeExpiredParent of [false, true]) {
    const parent = unsafeExpiredParent ? { messageId: 'parent', matchState: 'excluded', sourceKind: 'mail', excludedAt: '2023-11-10T09:00:00.000Z' } :
      { messageId: 'parent', matchState: 'matched', caseId: target, sourceKind: 'mail' };
    const db = memoryFirestore({
      [`${root}/messages/parent`]: parent,
      [`${root}/messages/child`]: { messageId: 'child', matchState: 'excluded', sourceKind: 'mail', excludedAt: '2023-11-10T09:00:00.000Z',
        evidence: { parentMessageIds: ['parent'] }, firstReview: { actor: 'reviewer@example.com', at: '2023-10-01T00:00:00.000Z' } },
      [`${root}/events/child-review`]: { type: 'mail.reviewed', messageId: 'child', requestId: other },
      [`${root}/receipts/request-child-review`]: { result: { message: { messageId: 'child', evidence: { parentMessageIds: ['parent'] } } } },
      ...(unsafeExpiredParent ? { [`${root}/events/parent-case`]: { messageId: 'parent', previous: { caseId: target } } } : {})
    });
    const purge = createMailPurge({ db, projectId: 'test-project', now: () => new Date('2026-11-10T09:00:00.000Z') });
    const plan = await purge.planExpiredExclusions('child-expiry');
    assert.equal(plan.messageCount, 1);
    assert.equal(plan.unsafeExclusionCount, unsafeExpiredParent ? 1 : 0);
    await purge.applyExpiredExclusions('child-expiry', plan.planHash);
    assert.deepEqual(db.records.get(`${root}/messages/parent`), parent);
    for (const path of ['messages/child', 'events/child-review', 'receipts/request-child-review']) assert(!db.records.has(`${root}/${path}`));
    assert(db.records.has(`${root}/suppressedMessages/${suppressionKey('message', 'child')}`));
  }
});

test('an incoming reference from a retained reply still protects an expired excluded parent', async () => {
  const db = memoryFirestore({
    [`${root}/messages/parent`]: { messageId: 'parent', matchState: 'excluded', sourceKind: 'mail', excludedAt: '2023-11-10T09:00:00.000Z' },
    [`${root}/messages/retained`]: { messageId: 'retained', matchState: 'pending', evidence: { parentMessageIds: ['parent'] } }
  });
  const purge = createMailPurge({ db, projectId: 'test-project', now: () => new Date('2026-11-10T09:00:00.000Z') });
  const plan = await purge.planExpiredExclusions('incoming-expiry');
  assert.equal(plan.messageCount, 0);
  assert.equal(plan.unsafeExclusionCount, 1);
  await purge.applyExpiredExclusions('incoming-expiry', plan.planHash);
  assert(db.records.has(`${root}/messages/parent`));
  assert(db.records.has(`${root}/messages/retained`));
});

test('unvalidated jobs recheck expiry after reopening, validation failure and interruption', async () => {
  for (const scenario of ['reopened', 'validation-error', 'interrupted']) {
    const cases = [{ caseId: target, handledStatus: '対応済み', closedAt: '2023-11-10T09:00:00.000Z' },
      { caseId: other, handledStatus: '未対応', closedAt: null }];
    const { db } = fixture({ [`${root}/meta/activeCatalog`]: { snapshotId: 'snapshot', total: 2, digest: catalogDigest(cases) },
      [`${root}/catalogSnapshots/snapshot/pages/0000`]: { pageIndex: 0, cases } });
    const purge = createMailPurge({ db, projectId: 'test-project', now: () => new Date('2026-11-10T09:00:00.000Z') });
    const plan = await purge.planExpiredCase(target, scenario);
    const reopen = () => {
      const reopened = cases.map((item) => item.caseId === target ? { ...item, handledStatus: '未対応', closedAt: null } : item);
      db.records.set(`${root}/meta/activeCatalog`, { snapshotId: 'snapshot', total: 2, digest: catalogDigest(reopened) });
      db.records.set(`${root}/catalogSnapshots/snapshot/pages/0000`, { pageIndex: 0, cases: reopened });
    };
    const originalTransaction = db.runTransaction.bind(db);
    const originalGetAll = db.getAll;
    let transactions = 0;
    db.runTransaction = async (operation) => {
      const result = await originalTransaction(operation);
      if (++transactions === 1) {
        if (scenario === 'reopened') reopen();
        if (scenario === 'validation-error') db.getAll = async () => { throw new Error('synthetic scan failure'); };
        if (scenario === 'interrupted') throw new Error('synthetic process interruption');
      }
      return result;
    };
    await assert.rejects(purge.applyExpiredCase(target, scenario, plan.planHash));
    assert.equal(db.records.get(`${root}/meta/purgeControl`).active.stage, 'validating');
    assert(db.records.has(`${root}/messages/mailA`));
    db.runTransaction = originalTransaction;
    db.getAll = originalGetAll;
    reopen();
    await assert.rejects(purge.applyExpiredCase(target, scenario, plan.planHash), { code: 'MAIL_PURGE_NOT_EXPIRED' });
    assert(db.records.has(`${root}/messages/mailA`));
    assert(!db.records.has(`${root}/suppressedCases/${suppressionKey('case', target)}`));
    await assert.rejects(purge.cancelUnvalidated(target, 'wrong', plan.planHash, false, true), { code: 'MAIL_PURGE_PLAN_CHANGED' });
    assert.equal((await purge.cancelUnvalidated(target, scenario, plan.planHash, false, true)).mode, 'cancelled-unvalidated');
    assert.equal(db.records.get(`${root}/meta/purgeControl`).active, undefined);
    assert(!db.records.has(`${root}/meta/purgeJob`));
    assert(db.records.has(`${root}/messages/mailA`));
  }
});

test('a delayed duplicate purge cannot delete data created after the completed generation', async () => {
  const { db, purge } = fixture();
  const plan = await purge.plan(target, 'duplicate');
  const originalTransaction = db.runTransaction.bind(db);
  let transactions = 0;
  let release;
  let paused;
  const waiting = new Promise((resolve) => { paused = resolve; });
  db.runTransaction = async (operation) => {
    if (++transactions === 3) {
      paused();
      await new Promise((resolve) => { release = resolve; });
    }
    return originalTransaction(operation);
  };
  const first = purge.apply(target, 'duplicate', plan.planHash);
  await waiting;
  const rejected = assert.rejects(first, { code: 'MAIL_MAINTENANCE' });
  await purge.apply(target, 'duplicate', plan.planHash);
  const newSync = { state: 'complete', historyId: 'new-generation' };
  db.records.set(`${root}/meta/sync`, newSync);
  release();
  await rejected;
  assert.deepEqual(db.records.get(`${root}/meta/sync`), newSync);
});

test('a stale pre-lock scan cannot acquire a new job after another purge completes', async () => {
  const { db, purge } = fixture();
  const plan = await purge.plan(target, 'stale-lock');
  const originalTransaction = db.runTransaction.bind(db);
  let transactions = 0;
  let release;
  let paused;
  const waiting = new Promise((resolve) => { paused = resolve; });
  db.runTransaction = async (operation) => {
    if (++transactions === 1) {
      paused();
      await new Promise((resolve) => { release = resolve; });
    }
    return originalTransaction(operation);
  };
  const stale = purge.apply(target, 'stale-lock', plan.planHash);
  await waiting;
  const rejected = assert.rejects(stale, { code: 'MAIL_PURGE_PLAN_CHANGED' });
  await purge.apply(target, 'stale-lock', plan.planHash);
  const newSync = { state: 'complete', historyId: 'after-completion' };
  db.records.set(`${root}/meta/sync`, newSync);
  release();
  await rejected;
  assert.deepEqual(db.records.get(`${root}/meta/sync`), newSync);
  assert.equal(db.records.get(`${root}/meta/purgeControl`).active, undefined);
  assert(!db.records.has(`${root}/meta/purgeJob`));
  const store = createFirestoreStore(db);
  assert.equal((await store.withAccess(() => store.getMessage('mailB'))).caseId, other);
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
  const cancellation = ['--project', 'test-project', '--confirm-project', 'test-project', '--database', '(default)',
    '--case-id', target, '--request-reference', 'request', '--cancel-unvalidated', '--plan-hash', 'a'.repeat(64)];
  assert.equal(parsePurgeArguments(cancellation)['--cancel-unvalidated'], true);
  assert.throws(() => parsePurgeArguments([...cancellation, '--apply']), /MAIL_PURGE_INPUT_INVALID/);
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
