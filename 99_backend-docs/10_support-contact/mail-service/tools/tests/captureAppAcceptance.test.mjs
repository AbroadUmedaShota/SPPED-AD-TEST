import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { captureAppAcceptance, noMailEvidenceRows } from '../captureAppAcceptance.mjs';

const ROOT = 'contactMailboxes/customer-speed-ad';
const CASE = '00000000-0000-0000-0000-000000000001';
const START = '2026-11-10T00:00:00.000Z';
const END = '2026-11-10T12:00:00.000Z';
const NOW = '2026-11-11T00:00:00.000Z';
const KEY = Buffer.alloc(32, 7);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const hmac = (kind, value) => createHmac('sha256', KEY).update(`${kind}\0${value}`).digest('hex');

function fixture() {
  const row = { caseId: CASE, handledStatus: '未対応', closedAt: null };
  const catalogDigest = digest(JSON.stringify([CASE, row.handledStatus, row.closedAt]));
  const records = new Map([
    [`${ROOT}/meta/activeCatalog`, { snapshotId: 'snapshot', total: 1, digest: catalogDigest }],
    [`${ROOT}/catalogSnapshots/snapshot`, { complete: true, pageCount: 1, total: 1, digest: catalogDigest }],
    [`${ROOT}/catalogSnapshots/snapshot/pages/0000`, { pageIndex: 0, cases: [row] }],
    [`${ROOT}/meta/sync`, { state: 'complete', startAt: START, cutoffAt: END, failedCount: 0,
      historyId: '123', catalogSnapshotId: 'snapshot', pageToken: null, mode: 'full', executionId: 'sync-1', lastSuccessAt: END }],
    [`${ROOT}/messages/abc123`, { messageId: 'abc123', internalDate: START, matchState: 'matched', caseId: CASE,
      unavailable: false, bodyAvailability: 'verified', attachmentCount: 1,
      indexedGeneration: 'sync-1',
      subject: 'PRIVATE SUBJECT', from: 'private@example.com', bodyText: 'PRIVATE BODY',
      attachments: [{ name: 'PRIVATE FILE', availability: 'verified', transferVersion: 1, transferSize: 0, servedChunks: [0] }],
      firstReview: { email: 'reviewer@abroad-o.com', at: END } }]
  ]);
  const snap = (path) => ({ id: path.split('/').at(-1), exists: records.has(path), data: () => structuredClone(records.get(path)) });
  let transactions = 0;
  const db = {
    doc: (path) => ({ path }),
    collection: (path) => ({ path, query: true, select() { return this; } }),
    async runTransaction(operation, options) {
      transactions++;
      assert.deepEqual(options, { readOnly: true });
      return operation({ async get(ref) {
        if (!ref.query) return snap(ref.path);
        return { docs: [...records.keys()].filter((path) => path.startsWith(`${ref.path}/`) &&
          path.split('/').length === ref.path.split('/').length + 1).map(snap) };
      } });
    }
  };
  return { records, db, transactions: () => transactions,
    capture: (extra = {}) => captureAppAcceptance({ db, runId: 'acceptance-1', key: KEY, startAt: START, cutoffAt: END,
      now: () => new Date(NOW), ...extra }) };
}

test('captures one read-only snapshot with compatible hashes and no private text', async () => {
  const f = fixture(); const result = await f.capture();
  assert.equal(f.transactions(), 1); assert.equal(result.sourceComplete, true); assert.deepEqual(result.errors, []);
  assert.equal(result.hashKeyId, digest(KEY)); assert.equal(result.rows[0].messageHash, hmac('message', 'abc123'));
  assert.equal(result.catalog[0].caseHash, hmac('case', CASE));
  assert.deepEqual(result.rows[0].firstReview, { actorHash: hmac('actor', 'reviewer@abroad-o.com'), at: END });
  assert.deepEqual(result.pages, [{ index: 0, requestTokenHash: null, nextTokenHash: null, rowCount: 1 }]);
  const serialized = JSON.stringify(result);
  for (const secret of ['PRIVATE', 'private@example.com', 'reviewer@abroad-o.com', CASE, 'abc123']) assert.equal(serialized.includes(secret), false);
});

test('captures more than 200 messages without a client-side truncation', async () => {
  const f = fixture(); const original = f.records.get(`${ROOT}/messages/abc123`);
  for (let index = 0; index < 205; index++) f.records.set(`${ROOT}/messages/m${index}`, { ...original, messageId: `m${index}` });
  const result = await f.capture(); assert.equal(result.sourceComplete, true); assert.equal(result.rows.length, 206);
});

test('rejects incomplete/misnumbered catalog pages and digest corruption', async () => {
  for (const change of [
    (f) => { f.records.get(`${ROOT}/catalogSnapshots/snapshot`).pageCount = 2; },
    (f) => { f.records.get(`${ROOT}/catalogSnapshots/snapshot/pages/0000`).pageIndex = 1; },
    (f) => { f.records.get(`${ROOT}/meta/activeCatalog`).digest = 'a'.repeat(64); }
  ]) {
    const f = fixture(); change(f); const result = await f.capture();
    assert.equal(result.sourceComplete, false); assert.match(result.errors.join(','), /APP_CATALOG/);
  }
});

test('detects duplicate catalog cases before hashing and stale catalog pin', async () => {
  const f = fixture(); const page = f.records.get(`${ROOT}/catalogSnapshots/snapshot/pages/0000`);
  page.cases.push(structuredClone(page.cases[0]));
  f.records.get(`${ROOT}/meta/sync`).catalogSnapshotId = 'old';
  const result = await f.capture();
  assert.equal(result.sourceComplete, false); assert.ok(result.errors.includes('APP_CATALOG_INVALID'));
  assert.ok(result.errors.includes('APP_CATALOG_CHANGED'));
});

test('refuses active sync leases, purge, failed sync and cutoff mismatch', async () => {
  for (const change of [
    (f) => f.records.set(`${ROOT}/meta/syncLease`, { expiresAt: '2026-11-12T00:00:00.000Z' }),
    (f) => f.records.set(`${ROOT}/meta/purgeControl`, { active: true, generation: 1 }),
    (f) => { f.records.get(`${ROOT}/meta/sync`).failedCount = 1; },
    (f) => { f.records.get(`${ROOT}/meta/sync`).cutoffAt = START; }
  ]) { const f = fixture(); change(f); assert.equal((await f.capture()).sourceComplete, false); }
});

test('detects stored ID mismatch and malformed values without leaking them', async () => {
  const f = fixture(); f.records.get(`${ROOT}/messages/abc123`).messageId = 'PRIVATE-ID';
  let result = await f.capture(); assert.ok(result.errors.includes('APP_MESSAGE_INVALID')); assert.equal(result.rows.length, 0);
  f.records.get(`${ROOT}/messages/abc123`).messageId = 'abc123';
  f.records.get(`${ROOT}/messages/abc123`).attachments[0].servedChunks = [{ private: 'PRIVATE VALUE' }];
  result = await f.capture(); assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
  assert.ok(result.errors.includes('APP_MESSAGE_INVALID'));
});

test('full-sync generation mismatch and hidden failed IDs fail closed', async () => {
  const f = fixture(); f.records.get(`${ROOT}/messages/abc123`).indexedGeneration = 'old-sync';
  f.records.get(`${ROOT}/meta/sync`).failedMessageIds = ['hidden-failure'];
  const result = await f.capture(); assert.equal(result.sourceComplete, false);
  assert.ok(result.errors.includes('APP_MESSAGE_GENERATION_MISMATCH')); assert.ok(result.errors.includes('APP_SYNC_INCOMPLETE'));
});

test('suppression markers cannot make a retained case/message reachable', async () => {
  const f = fixture();
  f.records.set(`${ROOT}/suppressedCases/${digest(`customer-speed-ad\0case\0${CASE}`)}`, { version: 1 });
  f.records.set(`${ROOT}/suppressedMessages/${digest('customer-speed-ad\0message\0abc123')}`, { version: 1 });
  const result = await f.capture(); assert.equal(result.sourceComplete, false);
  assert.ok(result.errors.includes('APP_CASE_SUPPRESSED')); assert.ok(result.errors.includes('APP_MESSAGE_SUPPRESSED'));
});

test('unrelated pure-draft markers do not masquerade as reachable records', async () => {
  const f = fixture(); f.records.set(`${ROOT}/suppressedMessages/${digest('unrelated-draft')}`, { version: 1 });
  const result = await f.capture(); assert.equal(result.sourceComplete, true); assert.equal(result.rows.length, 1);
});

test('deletion diagnostics and failed reads fail closed with fixed codes', async () => {
  const f = fixture(); f.records.set(`${ROOT}/deletionDiagnostics/missing`, { messageId: 'missing' });
  let result = await f.capture(); assert.ok(result.errors.includes('APP_DELETION_UNRESOLVED')); assert.equal(result.residualCount, 1);
  f.db.runTransaction = async () => { throw new Error('PRIVATE CONNECTION DETAILS'); };
  result = await f.capture(); assert.deepEqual(result.errors, ['APP_CAPTURE_FAILED']); assert.equal(result.sourceComplete, false);
  assert.equal(JSON.stringify(result).includes('PRIVATE'), false);
});

test('invalid context cannot contact Firestore', async () => {
  const f = fixture(); await assert.rejects(f.capture({ cutoffAt: 'not-a-date' }), /MAIL_ACCEPTANCE_INPUT_INVALID/);
  assert.equal(f.transactions(), 0);
});

test('no-mail evidence requires the same context and hash-only exact rows', () => {
  const context = { runId: 'acceptance-1', hashKeyId: digest(KEY), startAt: START, cutoffAt: END };
  const input = { schemaVersion: 1, ...context, rows: [{ caseHash: hmac('case', CASE), evidenceHash: hmac('evidence', 'private-receipt-1') }] };
  assert.deepEqual(noMailEvidenceRows(input, context), input.rows);
  assert.throws(() => noMailEvidenceRows({ ...input, runId: 'other-run' }, context), /MAIL_ACCEPTANCE_INPUT_INVALID/);
  assert.throws(() => noMailEvidenceRows({ ...input, rows: [{ ...input.rows[0], note: 'PRIVATE TEXT' }] }, context), /MAIL_ACCEPTANCE_INPUT_INVALID/);
});

test('completion timestamp follows the snapshot read and retention unknowns remain incomplete', async () => {
  const f = fixture(); let calls = 0;
  const result = await f.capture({ now: () => new Date(calls++ === 0 ? END : NOW) });
  assert.equal(result.capturedAt, NOW); assert.equal(result.sourceComplete, true);
  const row = f.records.get(`${ROOT}/catalogSnapshots/snapshot/pages/0000`).cases[0]; row.handledStatus = '対応済み';
  const changed = digest(JSON.stringify([CASE, '対応済み', null]));
  f.records.get(`${ROOT}/meta/activeCatalog`).digest = changed;
  f.records.get(`${ROOT}/catalogSnapshots/snapshot`).digest = changed;
  assert.ok((await f.capture()).errors.includes('APP_CLOSURE_UNKNOWN'));
});

test('CLI plan does not require ADC or make a capture', () => {
  const result = spawnSync(process.execPath, ['tools/captureAppAcceptance.mjs'], { encoding: 'utf8', cwd: new URL('../..', import.meta.url) });
  assert.equal(result.status, 0); assert.deepEqual(JSON.parse(result.stdout), { execute: false, operation: 'readOnlyAppAcceptanceCapture' });
});
