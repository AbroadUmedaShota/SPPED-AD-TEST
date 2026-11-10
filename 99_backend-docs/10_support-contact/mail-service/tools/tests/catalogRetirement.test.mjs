import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogRetirement } from '../catalogRetirement.mjs';
import { parseCatalogRetirementArguments, runCatalogRetirementCli } from '../retireMailCatalogs.mjs';
import { memoryFirestore } from '../../runtime/tests/memoryFirestore.mjs';
import { createPurgeGate } from '../../runtime/purgeGate.mjs';
import { createFirestoreStore } from '../../runtime/firestoreStore.mjs';
import { catalogDigest } from '../../runtime/service.mjs';
import { captureAppAcceptance } from '../captureAppAcceptance.mjs';

const ROOT = 'contactMailboxes/customer-speed-ad';
const path = (id) => `${ROOT}/catalogSnapshots/${id}`;
const NOW = '2026-11-11T00:00:00.000Z';
const row = { caseId: '00000000-0000-0000-0000-000000000001', handledStatus: '未対応', closedAt: null };
function fixture(extra = {}) {
  const digest = catalogDigest([row]);
  const db = memoryFirestore({
    [`${ROOT}/meta/activeCatalog`]: { snapshotId: 'active', total: 1, digest },
    [`${ROOT}/meta/sync`]: { state: 'complete', catalogSnapshotId: 'old' },
    [path('active')]: { complete: true, total: 1, pageCount: 1, digest },
    [`${path('active')}/pages/0000`]: { pageIndex: 0, cases: [row] },
    [path('old')]: { complete: true, total: 1, pageCount: 1, digest },
    [`${path('old')}/pages/0000`]: { pageIndex: 0, cases: [row] },
    ...extra
  });
  return { db, cleanup: createCatalogRetirement({ db, projectId: 'test-project', now: () => new Date(NOW) }) };
}

test('dry-run is read-only and retired pages leave the active catalog usable', async () => {
  const { db, cleanup } = fixture();
  const before = JSON.stringify([...db.records]);
  const plan = await cleanup.plan('reference');
  assert.equal(JSON.stringify([...db.records]), before);
  assert.equal(plan.snapshotCount, 1);
  assert.equal(plan.documentCount, 2);
  assert.equal(JSON.stringify(plan).includes(row.caseId), false);
  assert.equal((await cleanup.apply('reference', plan.planHash)).mode, 'complete');
  assert(!db.records.has(path('old')));
  assert(!db.records.has(`${path('old')}/pages/0000`));
  assert.deepEqual((await createFirestoreStore(db).getCatalog()).cases, [row]);
  assert.equal((await cleanup.status('reference', plan.planHash)).mode, 'idle');
});

test('running and failed sync pins survive even after lease expiry', async () => {
  for (const state of ['running', 'failed']) {
    const { db, cleanup } = fixture({
      [`${ROOT}/meta/sync`]: { state, catalogSnapshotId: 'old' },
      [`${ROOT}/meta/syncLease`]: { expiresAt: '2026-11-10T00:00:00.000Z' },
      [path('orphan')]: { complete: false },
      [`${path('orphan')}/pages/0000`]: { cases: [] }
    });
    const plan = await cleanup.plan('reference');
    assert.equal(plan.retainedSnapshotCount, 2);
    await cleanup.apply('reference', plan.planHash);
    assert(db.records.has(path('active')));
    assert(db.records.has(path('old')));
    assert(!db.records.has(path('orphan')));
  }
});

test('independent app capture remains complete after inactive snapshot retirement', async () => {
  const startAt = '2026-11-10T00:00:00.000Z';
  const cutoffAt = '2026-11-10T12:00:00.000Z';
  const { db, cleanup } = fixture({
    [`${ROOT}/meta/sync`]: { state: 'complete', catalogSnapshotId: 'active', startAt, cutoffAt, failedCount: 0,
      historyId: '123', mode: 'full', executionId: 'synthetic-sync', lastSuccessAt: cutoffAt },
    [`${ROOT}/messages/mail1`]: { messageId: 'mail1', internalDate: startAt, matchState: 'matched', caseId: row.caseId,
      unavailable: false, bodyAvailability: 'verified', attachmentCount: 0, attachments: [], indexedGeneration: 'synthetic-sync',
      firstReview: { email: 'reviewer@abroad-o.com', at: cutoffAt } }
  });
  const capture = () => captureAppAcceptance({ db, runId: 'synthetic', key: Buffer.alloc(32, 7), startAt, cutoffAt, now: () => new Date(NOW) });
  const before = await capture();
  assert.equal(before.sourceComplete, true);
  const plan = await cleanup.plan('reference');
  await cleanup.apply('reference', plan.planHash);
  const after = await capture();
  assert.equal(after.sourceComplete, true);
  assert.deepEqual(after.catalog, before.catalog);
  assert.deepEqual(after.rows, before.rows);
});

test('partial deletion keeps the gate closed and resumes from the same pinned plan', async () => {
  const pages = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`${path('old')}/pages/${String(index).padStart(4, '0')}`, { cases: [row] }]));
  const { db, cleanup } = fixture(pages);
  const plan = await cleanup.plan('reference');
  const partial = await cleanup.apply('reference', plan.planHash);
  assert.equal(partial.mode, 'deleting');
  assert.equal(partial.deletedCount, 25);
  assert(db.records.has(path('old')));
  const gate = createPurgeGate(async () => db.records.get(`${ROOT}/meta/purgeControl`));
  await assert.rejects(gate.withAccess(async () => {}), { code: 'MAIL_MAINTENANCE' });
  assert.equal((await cleanup.status('reference', plan.planHash)).deletedCount, 25);
  assert.equal((await cleanup.apply('reference', plan.planHash)).mode, 'complete');
  await gate.withAccess(async () => {});
  assert(![...db.records.keys()].some((key) => key.startsWith(`${path('old')}/`)));
});

test('changed source or target before apply prevents all deletion', async () => {
  for (const change of [
    (db) => { db.records.get(`${ROOT}/meta/activeCatalog`).snapshotId = 'old'; },
    (db) => { db.records.get(`${path('old')}/pages/0000`).cases = []; },
    (db) => { db.records.delete(`${path('old')}/pages/0000`); }
  ]) {
    const { db, cleanup } = fixture();
    const plan = await cleanup.plan('reference');
    change(db);
    await assert.rejects(cleanup.apply('reference', plan.planHash), { code: 'MAIL_CATALOG_RETIRE_PLAN_CHANGED' });
    assert(db.records.has(path('old')));
    assert(!db.records.has(`${ROOT}/meta/catalogRetirementJob`));
  }
});

test('an interrupted deletion transaction rolls back its batch and resumes the locked job', async () => {
  const { db, cleanup } = fixture();
  const plan = await cleanup.plan('reference');
  const transaction = db.runTransaction;
  let interrupt = true;
  db.runTransaction = (operation) => transaction(async (tx) => {
    const result = await operation(tx);
    if (interrupt && result?.mode === 'complete') { interrupt = false; throw new Error('synthetic interruption'); }
    return result;
  });
  await assert.rejects(cleanup.apply('reference', plan.planHash), /synthetic interruption/);
  assert(db.records.has(path('old')));
  assert.equal((await cleanup.status('reference', plan.planHash)).deletedCount, 0);
  assert.equal((await cleanup.apply('reference', plan.planHash)).mode, 'complete');
  assert(!db.records.has(path('old')));
});

test('source or remaining target changes during a partial run stop and permit cancellation', async () => {
  for (const kind of ['active', 'page', 'new-page']) {
    const pages = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`${path('old')}/pages/${String(index).padStart(4, '0')}`, { cases: [row] }]));
    const { db, cleanup } = fixture(pages);
    const plan = await cleanup.plan('reference');
    await cleanup.apply('reference', plan.planHash);
    if (kind === 'active') db.records.get(`${ROOT}/meta/activeCatalog`).snapshotId = 'old';
    if (kind === 'page') db.records.get(`${path('old')}/pages/0029`).cases = [];
    if (kind === 'new-page') db.records.set(`${path('old')}/pages/extra`, { cases: [] });
    await assert.rejects(cleanup.apply('reference', plan.planHash));
    assert(db.records.has(path('old')));
    assert.equal((await cleanup.cancel('reference', plan.planHash)).deletedCount, 25);
    assert(!db.records.get(`${ROOT}/meta/purgeControl`).active);
  }
});

test('abandoned incomplete and absent-parent snapshots are retired, unknown nested data is preserved', async () => {
  const f = fixture({ [`${path('orphan')}/pages/0000`]: { cases: [] }, [path('incomplete')]: { complete: false } });
  const plan = await f.cleanup.plan('reference');
  await f.cleanup.apply('reference', plan.planHash);
  assert(!f.db.records.has(`${path('orphan')}/pages/0000`));
  assert(!f.db.records.has(path('incomplete')));
  for (const extra of [
    { [`${path('old')}/unknown/data`]: { private: true } },
    { [`${path('old')}/pages/0000/nested/data`]: { private: true } }
  ]) {
    const current = fixture(extra);
    await assert.rejects(current.cleanup.plan('reference'), { code: 'MAIL_CATALOG_RETIRE_UNSUPPORTED_DATA' });
    assert(current.db.records.has(path('old')));
  }
});

test('live leases, maintenance jobs and malformed pins block cleanup', async () => {
  for (const extra of [
    { [`${ROOT}/meta/syncLease`]: { expiresAt: '2999-01-01T00:00:00.000Z' } },
    { [`${ROOT}/meta/purgeControl`]: { generation: 1, active: { kind: 'purge' } } },
    { [`${ROOT}/meta/purgeJob`]: { version: 1 } },
    { [`${ROOT}/meta/anotherCleanupJob`]: { version: 1 } },
    { [`${ROOT}/meta/sync`]: { state: 'failed' } }
  ]) {
    const { db, cleanup } = fixture(extra);
    await assert.rejects(cleanup.plan('reference'));
    assert(db.records.has(path('old')));
  }
});

test('snapshot cursor bounds each plan without including protected snapshots', async () => {
  const extra = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [path(`s${String(index).padStart(2, '0')}`), { complete: false }]));
  const { db, cleanup } = fixture(extra);
  const first = await cleanup.plan('reference');
  assert.equal(first.snapshotCount, 25);
  let result;
  do { result = await cleanup.apply('reference', first.planHash); } while (result.mode !== 'complete');
  const next = await cleanup.plan('reference', first.nextSnapshot);
  assert.equal(next.snapshotCount, 6);
  await cleanup.apply('reference', next.planHash, first.nextSnapshot);
  assert.deepEqual([...db.records.keys()].filter((key) => key.startsWith(`${ROOT}/catalogSnapshots/`)), [path('active'), `${path('active')}/pages/0000`]);
});

test('CLI validates explicit project confirmation before connecting', async () => {
  const args = ['--project', 'test-project', '--confirm-project', 'test-project', '--database', '(default)', '--request-reference', 'reference', '--operation', 'plan'];
  assert.equal(parseCatalogRetirementArguments(args)['--operation'], 'plan');
  let called = false;
  await assert.rejects(runCatalogRetirementCli([...args, '--plan-hash', 'a'.repeat(64)], { createDatabase: async () => { called = true; } }), /MAIL_CATALOG_RETIRE_INPUT_INVALID/);
  assert.equal(called, false);
  const f = fixture();
  const output = [];
  const result = await runCatalogRetirementCli(args, { createDatabase: async () => f.db, write: (value) => output.push(value) });
  assert.equal(result.mode, 'dry-run');
  assert.equal(output.length, 1);
});
