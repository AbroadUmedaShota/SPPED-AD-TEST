import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { captureAppAcceptance, parseAppCaptureArguments, runAppCaptureCli } from '../captureAppAcceptance.mjs';
import { prepareCaptureFiles } from '../privateCaptureFiles.mjs';
import { noMailContext } from '../../runtime/noMailConfirmation.mjs';

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

test('no-mail evidence is projected only from current audited Firestore confirmations', async () => {
  const f = fixture(); f.records.delete(`${ROOT}/messages/abc123`);
  const active = f.records.get(`${ROOT}/meta/activeCatalog`);
  const context = noMailContext({ ...active, complete: true }, f.records.get(`${ROOT}/meta/sync`));
  const confirmation = { caseId: CASE, email: 'staff@abroad-o.com', at: END, requestId: '00000000-0000-4000-8000-000000000001', context };
  f.records.set(`${ROOT}/caseCoverage/${CASE}`, { noMailConfirmed: true, noMailConfirmation: confirmation });
  let result = await f.capture();
  assert.equal(result.sourceComplete, true); assert.equal(result.noMailConfirmations.length, 1);
  assert.equal(result.noMailConfirmations[0].caseHash, hmac('case', CASE));
  assert.equal(JSON.stringify(result).includes('staff@abroad-o.com'), false);
  f.records.get(`${ROOT}/meta/sync`).executionId = 'new-sync';
  result = await f.capture(); assert.deepEqual(result.noMailConfirmations, []);
  confirmation.email = 'arbitrary@example.test';
  result = await f.capture(); assert.ok(result.errors.includes('APP_NO_MAIL_CONFIRMATION_INVALID'));
});

test('captures audited absence confirmations for more than 200 cases from all catalog pages', async () => {
  const f = fixture(); f.records.delete(`${ROOT}/messages/abc123`);
  const rows = Array.from({ length: 203 }, (_, index) => ({ caseId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, handledStatus: '未対応', closedAt: null }));
  const catalogDigest = digest(rows.map((row) => JSON.stringify([row.caseId, row.handledStatus, row.closedAt])).join('\n'));
  f.records.set(`${ROOT}/meta/activeCatalog`, { snapshotId: 'snapshot', total: rows.length, digest: catalogDigest });
  f.records.set(`${ROOT}/catalogSnapshots/snapshot`, { complete: true, pageCount: 2, total: rows.length, digest: catalogDigest });
  f.records.set(`${ROOT}/catalogSnapshots/snapshot/pages/0000`, { pageIndex: 0, cases: rows.slice(0, 200) });
  f.records.set(`${ROOT}/catalogSnapshots/snapshot/pages/0001`, { pageIndex: 1, cases: rows.slice(200) });
  const context = noMailContext({ complete: true, snapshotId: 'snapshot', digest: catalogDigest }, f.records.get(`${ROOT}/meta/sync`));
  for (const row of rows) f.records.set(`${ROOT}/caseCoverage/${row.caseId}`, { noMailConfirmed: true,
    noMailConfirmation: { caseId: row.caseId, email: 'staff@abroad-o.com', at: END, requestId: row.caseId, context } });
  const result = await f.capture(); assert.equal(result.sourceComplete, true); assert.equal(result.catalog.length, 203);
  assert.equal(result.noMailConfirmations.length, 203); assert.equal(new Set(result.noMailConfirmations.map((row) => row.caseHash)).size, 203);
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

const cliArgs = (folder = resolve('private-capture')) => ['--project', 'test-project', '--database', '(default)',
  '--run-id', 'acceptance-1', '--start-at', START, '--cutoff-at', END,
  '--private-dir', folder, '--key-file', join(folder, 'run.key'), '--out', join(folder, 'app.json')];

test('App CLI requires complete context and absolute private paths before preparing output', () => {
  assert.equal(parseAppCaptureArguments(cliArgs(), new Date(NOW)).execute, false);
  for (const [name, value] of [['--run-id', '../bad'], ['--cutoff-at', '2026-11-12T00:00:00.000Z'],
    ['--private-dir', 'relative'], ['--key-file', 'relative.key'], ['--out', 'relative.json']]) {
    const values = cliArgs(); values[values.indexOf(name) + 1] = value;
    assert.throws(() => parseAppCaptureArguments(values, new Date(NOW)), /MAIL_ACCEPTANCE_INPUT_INVALID/);
  }
  for (const values of [['--execute'], [...cliArgs(), '--execute', '--execute'], [...cliArgs(), '--unknown', 'private'],
    [...cliArgs(), '--no-mail-confirmations', resolve('handcrafted.json')]]) {
    assert.throws(() => parseAppCaptureArguments(values, new Date(NOW)), /MAIL_ACCEPTANCE_INPUT_INVALID/);
  }
});

test('App CLI dry-run checks local boundaries without constructing Firestore or reading evidence', async () => {
  let prepared = 0; let closed = 0;
  const io = { now: () => new Date(NOW), prepare: async () => { prepared++; return { close: async () => { closed++; } }; },
    createDb: async () => { throw new Error('must not construct Firestore'); },
    readEvidence: async () => { throw new Error('must not read evidence'); }, write: () => {} };
  await runAppCaptureCli([], io); assert.equal(prepared, 0);
  await runAppCaptureCli(cliArgs(), io); assert.equal(prepared, 1); assert.equal(closed, 1);
});

test('App CLI rejects broad, existing and outside output boundaries before Firestore access', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'app-private-boundary-'));
  const keyFile = join(folder, 'run.key'); const outputFile = join(folder, 'app.json');
  let cloudCalls = 0;
  try {
    await writeFile(keyFile, Buffer.alloc(32, 7), { mode: 0o600 });
    await writeFile(outputFile, 'existing private output', { mode: 0o600 });
    const io = { now: () => new Date(NOW), createDb: async () => { cloudCalls++; }, write: () => {},
      prepare: (options) => prepareCaptureFiles({ ...options, ...(process.platform === 'win32' ? { inspectWindows: async () => {} } : {}) }) };
    await assert.rejects(runAppCaptureCli([...cliArgs(folder), '--execute'], io));
    assert.equal(await readFile(outputFile, 'utf8'), 'existing private output');
    const outside = cliArgs(folder); outside[outside.indexOf('--out') + 1] = join(tmpdir(), 'outside-app.json');
    await assert.rejects(runAppCaptureCli([...outside, '--execute'], io), /MAIL_ACCEPTANCE_PRIVATE_PATH_REQUIRED/);
    await assert.rejects(runAppCaptureCli([...cliArgs(folder), '--execute'], { ...io,
      prepare: (options) => prepareCaptureFiles({ ...options, platform: 'win32', inspectWindows: async () => { throw new Error('MAIL_ACCEPTANCE_PRIVATE_PATH_REQUIRED'); } })
    }), /MAIL_ACCEPTANCE_PRIVATE_PATH_REQUIRED/);
    assert.equal(cloudCalls, 0);
  } finally { await Promise.all([keyFile, outputFile].map((path) => rm(path, { force: true }))); await rmdir(folder); }
});

test('App CLI reserves private output before Firestore and zeroes key on completion and construction failure', async () => {
  for (const fail of [false, true]) {
    const folder = await mkdtemp(join(tmpdir(), 'app-private-capture-'));
    const keyFile = join(folder, 'run.key'); const outputFile = join(folder, 'app.json');
    let key; let terminated = 0; const logs = [];
    try {
      await writeFile(keyFile, Buffer.alloc(32, 7), { mode: 0o600 });
      const f = fixture(); f.db.terminate = async () => { terminated++; };
      const invocation = runAppCaptureCli([...cliArgs(folder), '--execute'], { now: () => new Date(NOW),
        prepare: async (options) => {
          const files = await prepareCaptureFiles({ ...options, ...(process.platform === 'win32' ? { inspectWindows: async () => {} } : {}) });
          key = files.key; return files;
        }, createDb: async () => {
          assert.equal(await readFile(outputFile, 'utf8'), '');
          if (fail) throw new Error('PRIVATE ADC FAILURE');
          return f.db;
        }, write: (value) => logs.push(value) });
      if (fail) await assert.rejects(invocation, /PRIVATE ADC FAILURE/);
      else {
        const result = await invocation;
        assert.equal(result.sourceComplete, true); assert.equal(f.transactions(), 1); assert.equal(terminated, 1);
        const manifest = JSON.parse(await readFile(outputFile, 'utf8'));
        assert.equal(manifest.catalog[0].caseHash, hmac('case', CASE));
        assert.equal(JSON.stringify(logs).includes(CASE), false);
      }
      assert.equal(key.every((value) => value === 0), true);
    } finally { await Promise.all([keyFile, outputFile].map((path) => rm(path, { force: true }))); await rmdir(folder); }
  }
});

test('App CLI real argument failures emit only a fixed code without paths or environment key', () => {
  const result = spawnSync(process.execPath, ['tools/captureAppAcceptance.mjs', '--out', 'private-sensitive.json', '--execute'], {
    encoding: 'utf8', cwd: new URL('../..', import.meta.url), env: { ...process.env, MAIL_ACCEPTANCE_HASH_KEY: 'private-sensitive-key' }
  });
  assert.equal(result.status, 2); assert.equal(result.stdout, ''); assert.equal(result.stderr, 'MAIL_ACCEPTANCE_INPUT_INVALID\n');
});

test('App CLI closes files and erases key after output and database cleanup failures', async () => {
  for (const stage of ['output', 'terminate']) {
    const folder = await mkdtemp(join(tmpdir(), 'app-private-failure-'));
    const keyFile = join(folder, 'run.key'); const outputFile = join(folder, 'app.json');
    let key; let constructed = 0;
    try {
      await writeFile(keyFile, Buffer.alloc(32, 7), { mode: 0o600 });
      const args = [...cliArgs(folder), '--execute'];
      const f = fixture(); f.db.terminate = async () => { if (stage === 'terminate') throw new Error('private cleanup failure'); };
      await assert.rejects(runAppCaptureCli(args, { now: () => new Date(NOW), write: () => {},
        prepare: async (options) => {
          const files = await prepareCaptureFiles({ ...options, ...(process.platform === 'win32' ? { inspectWindows: async () => {} } : {}) });
          key = files.key;
          return { ...files, write: stage === 'output' ? async () => { throw new Error('private output failure'); } : files.write };
        },
        createDb: async () => { constructed++; return f.db; }
      }), /private (?:output|cleanup) failure/);
      assert.equal(constructed, 1);
      assert.equal(key.every((value) => value === 0), true);
    } finally { await Promise.all([keyFile, outputFile].map((path) => rm(path, { force: true }))); await rmdir(folder); }
  }
});
