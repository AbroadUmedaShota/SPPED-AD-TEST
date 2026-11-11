import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestMarkerCleanup, runRequestMarkerCli } from '../cleanupRequestMarkers.mjs';
import { memoryFirestore } from '../../runtime/tests/memoryFirestore.mjs';
import { createPurgeGate, suppressionKey } from '../../runtime/purgeGate.mjs';
import { createRequestId } from '../../runtime/requestIdentity.mjs';
import { createMailService } from '../../runtime/service.mjs';

const root = 'contactMailboxes/customer-speed-ad';
const id = (value) => value.toString(16).padStart(64, '0');
const at = new Date('2026-11-18T00:00:00.000Z');
const marker = (expiresAt) => ({ version: 2, expiresAt });
function fixture(extra = {}) {
  const db = memoryFirestore({
    [`${root}/suppressedRequests/${id(1)}`]: marker('2026-11-18T00:00:00.000Z'),
    [`${root}/suppressedRequests/${id(2)}`]: marker('2026-11-18T00:00:00.001Z'),
    [`${root}/suppressedRequests/${id(3)}`]: { version: 1 },
    ...extra
  });
  return { db, cleanup: createRequestMarkerCleanup({ db, projectId: 'test-project', now: () => at }) };
}

test('request cleanup is dry-run/hash guarded and atomically deletes only expired version-2 hashes', async () => {
  const { db, cleanup } = fixture();
  const before = JSON.stringify([...db.records]);
  const plan = await cleanup.plan('manual-1');
  assert.equal(plan.candidateCount, 1);
  assert.equal(plan.legacyCount, 1);
  assert.equal(JSON.stringify([...db.records]), before);
  await assert.rejects(cleanup.apply('manual-1', '0'.repeat(64)), { code: 'MAIL_PURGE_PLAN_CHANGED' });
  const gate = createPurgeGate(async () => db.records.get(`${root}/meta/purgeControl`));
  await assert.rejects(gate.withAccess(async () => cleanup.apply('manual-1', plan.planHash)), { code: 'MAIL_MAINTENANCE' });
  assert.equal(db.records.has(`${root}/suppressedRequests/${id(1)}`), false);
  assert.equal(db.records.has(`${root}/suppressedRequests/${id(2)}`), true);
  assert.equal(db.records.has(`${root}/suppressedRequests/${id(3)}`), true);
  assert.deepEqual(db.records.get(`${root}/meta/purgeControl`), { generation: 1 });
});

test('changed markers, maintenance, running sync, and invalid leases fail before deletion', async () => {
  const f = fixture();
  const plan = await f.cleanup.plan('manual-2');
  f.db.records.set(`${root}/suppressedRequests/${id(1)}`, marker('2026-11-19T00:00:00.000Z'));
  await assert.rejects(f.cleanup.apply('manual-2', plan.planHash), { code: 'MAIL_PURGE_PLAN_CHANGED' });
  for (const extra of [
    { [`${root}/meta/purgeControl`]: { generation: 1, active: {} } },
    { [`${root}/meta/purgeJob`]: { version: 1 } },
    { [`${root}/meta/sync`]: { state: 'running' } },
    { [`${root}/meta/syncLease`]: { expiresAt: 'unknown' } }
  ]) {
    const { cleanup, db } = fixture(extra);
    await assert.rejects(cleanup.plan('manual-2'));
    assert.equal(db.records.has(`${root}/suppressedRequests/${id(1)}`), true);
  }
  const racing = fixture();
  const pinned = await racing.cleanup.plan('racing');
  const transact = racing.db.runTransaction;
  racing.db.runTransaction = (operation) => {
    racing.db.records.set(`${root}/suppressedRequests/${id(1)}`, marker('2026-11-20T00:00:00.000Z'));
    return transact(operation);
  };
  await assert.rejects(racing.cleanup.apply('racing', pinned.planHash), { code: 'MAIL_PURGE_PLAN_CHANGED' });
  assert.equal(racing.db.records.has(`${root}/suppressedRequests/${id(1)}`), true);
});

test('a cleaned request hash cannot revive its expired operation with a fresh envelope', async () => {
  const requestId = createRequestId(new Date('2026-11-11T00:00:00.000Z'));
  const path = `${root}/suppressedRequests/${suppressionKey('request', requestId)}`;
  const db = memoryFirestore({ [path]: marker(at.toISOString()) });
  const cleanup = createRequestMarkerCleanup({ db, projectId: 'test-project', now: () => at });
  const plan = await cleanup.plan('expired-replay');
  await cleanup.apply('expired-replay', plan.planHash);
  assert.equal(db.records.has(path), false);
  let accessed = false;
  const execute = createMailService({ store: { withAccess: async () => { accessed = true; } }, gmail: {}, core: {}, now: () => at });
  await assert.rejects(execute({ contractVersion: 1, operation: 'markReviewed', requestId, issuedAt: at.toISOString(),
    actor: { email: 'staff@abroad-o.com', authMode: 'domain' }, payload: {} }), { code: 'MAIL_REQUEST_EXPIRED' });
  assert.equal(accessed, false);
});

test('request cleanup scans bounded pages and rejects invalid CLI before opening a database', async () => {
  const extra = {};
  for (let index = 4; index <= 253; index++) extra[`${root}/suppressedRequests/${id(index)}`] = marker('2026-11-17T00:00:00.000Z');
  const { cleanup } = fixture(extra);
  const first = await cleanup.plan('manual-3');
  assert.equal(first.scannedCount, 250);
  assert.equal(first.nextMarker, id(250));
  const last = await cleanup.plan('manual-3', first.nextMarker);
  assert.equal(last.scannedCount, 3);
  assert.equal(last.nextMarker, null);
  let opened = false;
  await assert.rejects(runRequestMarkerCli(['--project', 'test-project', '--confirm-project', 'other-project', '--operation', 'plan'],
    { createDatabase: async () => { opened = true; } }), { code: 'MAIL_MARKER_INPUT_INVALID' });
  assert.equal(opened, false);
});
