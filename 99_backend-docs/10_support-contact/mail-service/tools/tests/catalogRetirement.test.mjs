import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalogRetirement, createCatalogDocumentPager } from '../catalogRetirement.mjs';
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
    [`${ROOT}/meta/activeCatalog`]: { snapshotId: 'zzactive', total: 1, digest },
    [`${ROOT}/meta/sync`]: { state: 'complete', catalogSnapshotId: 'old' },
    [path('zzactive')]: { complete: true, total: 1, pageCount: 1, digest },
    [`${path('zzactive')}/pages/0000`]: { pageIndex: 0, cases: [row] },
    [path('old')]: { complete: true, total: 1, pageCount: 1, digest },
    [`${path('old')}/pages/0000`]: { pageIndex: 0, cases: [row] },
    ...extra
  });
  const listCatalogPage = async (token = '', snapshotId = null) => {
    const prefix = snapshotId === null ? ROOT + '/catalogSnapshots/' : path(snapshotId) + '/pages/';
    const ids = [...new Set([...db.records.keys()].filter((key) => key.startsWith(prefix)).map((key) => key.slice(prefix.length).split('/')[0]))].filter((id) => id > token).sort();
    const selected = ids.slice(0, snapshotId === null ? 1 : 25);
    return { ids: selected, nextPageToken: ids.length > selected.length ? selected.at(-1) : null };
  };
  return { db, listCatalogPage, cleanup: createCatalogRetirement({ db, listCatalogPage, projectId: 'test-project', now: () => new Date(NOW) }) };
}

async function nextPlan(cleanup, token = '') {
  let plan;
  do { plan = await cleanup.plan('reference', token); token = plan.nextPageToken; } while (plan.snapshotCount === 0 && token);
  return plan;
}

async function drain(cleanup) {
  let token = '';
  do {
    const plan = await cleanup.plan('reference', token);
    let result;
    do { result = await cleanup.apply('reference', plan.planHash, token); } while (result.mode !== 'complete');
    token = plan.nextPageToken;
  } while (token);
}

test('dry-run is read-only and retired pages leave the active catalog usable', async () => {
  const { db, cleanup } = fixture();
  const before = JSON.stringify([...db.records]);
  const plan = await nextPlan(cleanup);
  assert.equal(JSON.stringify([...db.records]), before);
  assert.equal(plan.snapshotCount, 1);
  assert.equal(plan.documentCount, 2);
  assert.equal(JSON.stringify(plan).includes(row.caseId), false);
  assert.equal((await cleanup.apply('reference', plan.planHash, plan.pageToken)).mode, 'complete');
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
    const plan = await nextPlan(cleanup);
    assert.equal(plan.retainedSnapshotCount, 2);
    await cleanup.apply('reference', plan.planHash, plan.pageToken);
    assert(db.records.has(path('zzactive')));
    assert(db.records.has(path('old')));
    assert(!db.records.has(path('orphan')));
  }
});

test('independent app capture remains complete after inactive snapshot retirement', async () => {
  const startAt = '2026-11-10T00:00:00.000Z';
  const cutoffAt = '2026-11-10T12:00:00.000Z';
  const { db, cleanup } = fixture({
    [`${ROOT}/meta/sync`]: { state: 'complete', catalogSnapshotId: 'zzactive', startAt, cutoffAt, failedCount: 0,
      historyId: '123', mode: 'full', executionId: 'synthetic-sync', lastSuccessAt: cutoffAt },
    [`${ROOT}/messages/mail1`]: { messageId: 'mail1', internalDate: startAt, matchState: 'matched', caseId: row.caseId,
      unavailable: false, bodyAvailability: 'verified', attachmentCount: 0, attachments: [], indexedGeneration: 'synthetic-sync',
      firstReview: { email: 'reviewer@abroad-o.com', at: cutoffAt } }
  });
  const capture = () => captureAppAcceptance({ db, runId: 'synthetic', key: Buffer.alloc(32, 7), startAt, cutoffAt, now: () => new Date(NOW) });
  const before = await capture();
  assert.equal(before.sourceComplete, true);
  const plan = await nextPlan(cleanup);
  await cleanup.apply('reference', plan.planHash, plan.pageToken);
  const after = await capture();
  assert.equal(after.sourceComplete, true);
  assert.deepEqual(after.catalog, before.catalog);
  assert.deepEqual(after.rows, before.rows);
});

test('partial deletion keeps the gate closed and resumes from the same pinned plan', async () => {
  const pages = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`${path('old')}/pages/${String(index).padStart(4, '0')}`, { cases: [row] }]));
  const { db, cleanup } = fixture(pages);
  const plan = await nextPlan(cleanup);
  const partial = await cleanup.apply('reference', plan.planHash, plan.pageToken);
  assert.equal(partial.mode, 'deleting');
  assert.equal(partial.deletedCount, 5);
  assert(db.records.has(path('old')));
  const gate = createPurgeGate(async () => db.records.get(`${ROOT}/meta/purgeControl`));
  await assert.rejects(gate.withAccess(async () => {}), { code: 'MAIL_MAINTENANCE' });
  assert.equal((await cleanup.status('reference', plan.planHash)).deletedCount, 5);
  let result;
  do { result = await cleanup.apply('reference', plan.planHash, plan.pageToken); } while (result.mode !== 'complete');
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
    const plan = await nextPlan(cleanup);
    change(db);
    await assert.rejects(cleanup.apply('reference', plan.planHash, plan.pageToken), { code: 'MAIL_CATALOG_RETIRE_PLAN_CHANGED' });
    assert(db.records.has(path('old')));
    assert(!db.records.has(`${ROOT}/meta/catalogRetirementJob`));
  }
});

test('an interrupted deletion transaction rolls back its batch and resumes the locked job', async () => {
  const { db, cleanup } = fixture();
  const plan = await nextPlan(cleanup);
  const transaction = db.runTransaction;
  let interrupt = true;
  db.runTransaction = (operation) => transaction(async (tx) => {
    const result = await operation(tx);
    if (interrupt && result?.mode === 'complete') { interrupt = false; throw new Error('synthetic interruption'); }
    return result;
  });
  await assert.rejects(cleanup.apply('reference', plan.planHash, plan.pageToken), /synthetic interruption/);
  assert(db.records.has(path('old')));
  assert.equal((await cleanup.status('reference', plan.planHash)).deletedCount, 0);
  assert.equal((await cleanup.apply('reference', plan.planHash, plan.pageToken)).mode, 'complete');
  assert(!db.records.has(path('old')));
});

test('changed target stops deletion, while a changed active pointer cannot release a damaged source', async () => {
  for (const kind of ['active', 'page', 'new-page']) {
    const pages = Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`${path('old')}/pages/${String(index).padStart(4, '0')}`, { cases: [row] }]));
    const { db, cleanup } = fixture(pages);
    const plan = await nextPlan(cleanup);
    await cleanup.apply('reference', plan.planHash, plan.pageToken);
    if (kind === 'active') db.records.get(`${ROOT}/meta/activeCatalog`).snapshotId = 'old';
    if (kind === 'page') db.records.get(`${path('old')}/pages/0029`).cases = [];
    if (kind === 'new-page') db.records.set(`${path('old')}/pages/extra`, { cases: [] });
    await assert.rejects(async () => { for (let index = 0; index < 10; index++) await cleanup.apply('reference', plan.planHash, plan.pageToken); });
    assert(db.records.has(path('old')));
    if (kind === 'active') {
      assert.equal((await cleanup.status('reference', plan.planHash)).sourceState, 'unsafe');
      await assert.rejects(cleanup.cancel('reference', plan.planHash));
      assert(db.records.get(`${ROOT}/meta/purgeControl`).active);
      db.records.get(`${ROOT}/meta/activeCatalog`).snapshotId = 'zzactive';
    }
    assert((await cleanup.cancel('reference', plan.planHash)).deletedCount > 0);
    assert(!db.records.get(`${ROOT}/meta/purgeControl`).active);
  }
});

test('abandoned incomplete and absent-parent snapshots are retired, unknown nested data is preserved', async () => {
  const f = fixture({ [`${path('orphan')}/pages/0000`]: { cases: [] }, [path('incomplete')]: { complete: false } });
  await drain(f.cleanup);
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

test('paginated discovery reaches 1001 snapshots and missing parent documents', async () => {
  const extra = Object.fromEntries(Array.from({ length: 1001 }, (_, index) => [path(`s${String(index).padStart(4, '0')}`), { complete: false }]));
  extra[`${path('orphan')}/pages/0000`] = { cases: [] };
  const { db, cleanup } = fixture(extra);
  await drain(cleanup);
  assert.deepEqual([...db.records.keys()].filter((key) => key.startsWith(`${ROOT}/catalogSnapshots/`)), [path('zzactive'), `${path('zzactive')}/pages/0000`]);
});

test('one snapshot larger than 5MiB is hashed incrementally and retired in bounded batches', async () => {
  const extra = Object.fromEntries(Array.from({ length: 7 }, (_, index) => [`${path('old')}/pages/${String(index).padStart(4, '0')}`, { padding: 'x'.repeat(900000) }]));
  const { db, cleanup } = fixture(extra);
  const plan = await nextPlan(cleanup);
  assert.equal(plan.documentCount, 8);
  assert.equal((await cleanup.apply('reference', plan.planHash, plan.pageToken)).deletedCount, 5);
  assert.equal((await cleanup.apply('reference', plan.planHash, plan.pageToken)).mode, 'complete');
  assert(!db.records.has(path('old')));
});

test('protected catalogs must exist with complete numbered pages and matching declared content', async () => {
  for (const change of [
    (db) => db.records.delete(path('zzactive')),
    (db) => db.records.delete(`${path('zzactive')}/pages/0000`),
    (db) => { db.records.get(path('zzactive')).digest = 'a'.repeat(64); },
    (db) => { db.records.get(path('zzactive')).total = 2; },
    (db) => { db.records.get(`${path('zzactive')}/pages/0000`).pageIndex = 1; },
    (db) => { db.records.get(`${ROOT}/meta/sync`).state = 'failed'; db.records.delete(path('old')); }
  ]) {
    const { db, cleanup } = fixture();
    change(db);
    await assert.rejects(cleanup.plan('reference'));
    assert(db.records.has(`${path('old')}/pages/0000`));
    assert(!db.records.has(`${ROOT}/meta/catalogRetirementJob`));
  }
});

test('official pager uses bounded non-automatic showMissing discovery', async () => {
  const calls = [];
  const base = 'projects/test-project/databases/(default)/documents/' + ROOT;
  const pager = createCatalogDocumentPager({ projectId: 'test-project', client: { async listDocuments(request, options) {
    calls.push({ request, options });
    return [[{ name: base + '/catalogSnapshots/orphan' }], null, { nextPageToken: 'next' }];
  } } });
  assert.deepEqual(await pager(), { ids: ['orphan'], nextPageToken: 'next' });
  assert.equal(calls[0].request.showMissing, true);
  assert.equal(calls[0].request.pageSize, 1);
  assert.equal(calls[0].request.orderBy, undefined);
  assert.deepEqual(calls[0].options, { autoPaginate: false });
});

test('CLI validates explicit project confirmation before connecting', async () => {
  const args = ['--project', 'test-project', '--confirm-project', 'test-project', '--database', '(default)', '--request-reference', 'reference', '--operation', 'plan'];
  assert.equal(parseCatalogRetirementArguments(args)['--operation'], 'plan');
  let called = false;
  await assert.rejects(runCatalogRetirementCli([...args, '--plan-hash', 'a'.repeat(64)], { createDatabase: async () => { called = true; } }), /MAIL_CATALOG_RETIRE_INPUT_INVALID/);
  assert.equal(called, false);
  const f = fixture();
  const output = [];
  const result = await runCatalogRetirementCli(args, { createDatabase: async () => f.db, createPager: async () => ({ listCatalogPage: f.listCatalogPage }), write: (value) => output.push(value) });
  assert.equal(result.mode, 'dry-run');
  assert.equal(output.length, 1);
  let terminated = false;
  await assert.rejects(runCatalogRetirementCli(args, { createDatabase: async () => ({ terminate: async () => { terminated = true; } }),
    createPager: async () => { throw new Error('synthetic pager failure'); } }), /synthetic pager failure/);
  assert.equal(terminated, true);
});
