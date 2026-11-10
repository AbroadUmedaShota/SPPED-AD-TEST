import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarkerCleanup } from '../markerCleanup.mjs';
import { parseMarkerArguments, runMarkerCli } from '../cleanupMailMarkers.mjs';
import { memoryFirestore } from '../../runtime/tests/memoryFirestore.mjs';
import { createPurgeGate, suppressionKey } from '../../runtime/purgeGate.mjs';
import { createGmailAdapter } from '../../runtime/googleAdapters.mjs';

const root = 'contactMailboxes/customer-speed-ad';
const marker = (id) => `${root}/suppressedMessages/${suppressionKey('message', id)}`;
function fixture(ids = ['present', 'absent']) {
  const db = memoryFirestore({ [`${root}/meta/sync`]: { state: 'complete', startAt: '2026-01-01T00:00:00.000Z' },
    ...Object.fromEntries(ids.map((id) => [marker(id), { version: 1 }])) });
  const state = { historyId: '1234', pages: [{ messageIds: ['present'], nextPageToken: null }], calls: [] };
  const gmail = {
    async getProfile() { return { emailAddress: 'customer@speed-ad.com', historyId: state.historyId }; },
    async listAllMessageIds({ pageToken }) {
      state.calls.push(pageToken);
      const value = state.pages[pageToken ? Number(pageToken) : 0];
      if (value instanceof Error) throw value;
      return structuredClone(value);
    }
  };
  return { db, state, gmail, cleanup: createMarkerCleanup({ db, gmail, projectId: 'test-project' }) };
}

test('complete stable enumeration requires explicit deletion approval and keeps originals present anywhere in Gmail', async () => {
  const { db, state, cleanup } = fixture();
  state.pages = [{ messageIds: ['unrelated'], nextPageToken: '1' }, { messageIds: ['present'], nextPageToken: null }];
  const before = JSON.stringify([...db.records]);
  const plan = await cleanup.plan('reference');
  assert.equal(JSON.stringify([...db.records]), before);
  assert.doesNotMatch(JSON.stringify(plan), /present|absent|2026|customer@/);
  await cleanup.advance('reference', plan.planHash);
  assert(db.records.has(marker('absent')));
  const gate = createPurgeGate(async () => db.records.get(`${root}/meta/purgeControl`));
  await assert.rejects(gate.withAccess(async () => {}), { code: 'MAIL_MAINTENANCE' });
  const ready = await cleanup.advance('reference', plan.planHash);
  assert.equal(ready.absentCount, 1);
  assert.equal(ready.mode, 'ready');
  assert(db.records.has(marker('absent')));
  await assert.rejects(cleanup.apply('reference', plan.planHash, '0'.repeat(64)), { code: 'MAIL_MARKER_PLAN_CHANGED' });
  assert.equal((await cleanup.apply('reference', plan.planHash, ready.deletionHash)).mode, 'complete');
  assert(db.records.has(marker('present')));
  assert(!db.records.has(marker('absent')));
  assert(!db.records.has(`${root}/meta/markerCleanupJob`));
  await gate.withAccess(async () => {});
});

test('failed pages preserve markers and the same job can resume without approving partial absence', async () => {
  const { db, state, cleanup } = fixture();
  state.pages = [{ messageIds: ['present'], nextPageToken: '1' }, new Error('synthetic')];
  const plan = await cleanup.plan('reference');
  await cleanup.advance('reference', plan.planHash);
  await assert.rejects(cleanup.advance('reference', plan.planHash), /synthetic/);
  assert.equal((await cleanup.status('reference', plan.planHash)).mode, 'enumerating');
  assert(db.records.has(marker('absent')));
  state.pages[1] = { messageIds: [], nextPageToken: null };
  const ready = await cleanup.advance('reference', plan.planHash);
  assert.deepEqual(state.calls, [null, '1', '1']);
  await cleanup.apply('reference', plan.planHash, ready.deletionHash);
  assert(!db.records.has(marker('absent')));
});

test('mailbox changes, malformed pages and repeated tokens never establish absence', async () => {
  for (const kind of ['history', 'malformed', 'cycle']) {
    const { db, state, cleanup } = fixture();
    state.pages = [{ messageIds: ['present'], nextPageToken: '1' }, { messageIds: [], nextPageToken: null }];
    const plan = await cleanup.plan('reference');
    await cleanup.advance('reference', plan.planHash);
    if (kind === 'history') state.historyId = '1235';
    if (kind === 'malformed') state.pages[1] = { messageIds: ['invalid/id'], nextPageToken: null };
    if (kind === 'cycle') state.pages[1] = { messageIds: ['present'], nextPageToken: '1' };
    await assert.rejects(cleanup.advance('reference', plan.planHash));
    assert(db.records.has(marker('absent')));
    assert.equal((await cleanup.status('reference', plan.planHash)).mode, 'enumerating');
    await cleanup.cancel('reference', plan.planHash);
    assert(!db.records.get(`${root}/meta/purgeControl`).active);
  }
});

test('a mailbox change during the final page cannot produce a deletion approval', async () => {
  const { db, cleanup, gmail, state } = fixture();
  gmail.listAllMessageIds = async () => { state.historyId = '1235'; return { messageIds: [], nextPageToken: null }; };
  const plan = await cleanup.plan('reference');
  await assert.rejects(cleanup.advance('reference', plan.planHash), { code: 'MAIL_MARKER_MAILBOX_CHANGED' });
  assert.equal((await cleanup.status('reference', plan.planHash)).mode, 'enumerating');
  assert(db.records.has(marker('absent')));
});

test('changed plans, malformed marker documents and unknown nested data fail before deletion', async () => {
  const { db, cleanup } = fixture();
  const plan = await cleanup.plan('reference');
  db.records.get(`${root}/meta/sync`).historyId = 'changed';
  await assert.rejects(cleanup.advance('reference', plan.planHash), { code: 'MAIL_MARKER_PLAN_CHANGED' });
  assert(!db.records.has(`${root}/meta/markerCleanupJob`));
  for (const extra of [
    { [marker('absent')]: { version: 1, unexpected: 'private' } },
    { [`${marker('absent')}/nested/data`]: { unexpected: 'private' } }
  ]) {
    const current = fixture();
    Object.entries(extra).forEach(([path, value]) => current.db.records.set(path, value));
    await assert.rejects(current.cleanup.plan('reference'), { code: 'MAIL_MARKER_JOB_INVALID' });
  }
});

test('running sync, live lease, purge and changed period block cleanup, while cancellation remains possible', async () => {
  for (const extra of [
    { [`${root}/meta/sync`]: { state: 'running', startAt: '2026-01-01T00:00:00.000Z' } },
    { [`${root}/meta/syncLease`]: { expiresAt: '2999-01-01T00:00:00.000Z' } },
    { [`${root}/meta/purgeControl`]: { generation: 1, active: { planHash: 'other' } } },
    { [`${root}/meta/purgeJob`]: { version: 1 } }
  ]) {
    const { db, cleanup } = fixture();
    Object.entries(extra).forEach(([path, value]) => db.records.set(path, value));
    await assert.rejects(cleanup.plan('reference'));
    assert(db.records.has(marker('absent')));
  }
  const { db, cleanup } = fixture();
  const plan = await cleanup.plan('reference');
  const ready = await cleanup.advance('reference', plan.planHash);
  db.records.get(`${root}/meta/sync`).startAt = '2025-01-01T00:00:00.000Z';
  await assert.rejects(cleanup.apply('reference', plan.planHash, ready.deletionHash), { code: 'MAIL_MARKER_STATE_CHANGED' });
  await cleanup.cancel('reference', plan.planHash);
  assert(db.records.has(marker('absent')));
});

test('deletion batches resume only while Gmail remains stable and retain the unprocessed markers on change', async () => {
  const ids = Array.from({ length: 30 }, (_, index) => `gone-${index}`);
  const { db, state, cleanup } = fixture(ids);
  state.pages = [{ messageIds: [], nextPageToken: null }];
  const plan = await cleanup.plan('reference');
  const ready = await cleanup.advance('reference', plan.planHash);
  const partial = await cleanup.apply('reference', plan.planHash, ready.deletionHash);
  assert.equal(partial.deletedCount, 25);
  state.historyId = '9999';
  await assert.rejects(cleanup.apply('reference', plan.planHash, ready.deletionHash), { code: 'MAIL_MARKER_MAILBOX_CHANGED' });
  assert.equal(ids.filter((id) => db.records.has(marker(id))).length, 5);
  await cleanup.cancel('reference', plan.planHash);
});

test('a stable partial deletion resumes in the next explicit batch', async () => {
  const ids = Array.from({ length: 30 }, (_, index) => `gone-${index}`);
  const { db, state, cleanup } = fixture(ids);
  state.pages = [{ messageIds: [], nextPageToken: null }];
  const plan = await cleanup.plan('reference');
  const ready = await cleanup.advance('reference', plan.planHash);
  await cleanup.apply('reference', plan.planHash, ready.deletionHash);
  assert.equal((await cleanup.status('reference', plan.planHash)).deletedCount, 25);
  const result = await cleanup.apply('reference', plan.planHash, ready.deletionHash);
  assert.equal(result.mode, 'complete');
  assert.equal(result.deletedCount, 30);
  assert(ids.every((id) => !db.records.has(marker(id))));
});

test('candidate cursor reaches more than 250 markers without skipping retained originals', async () => {
  const ids = Array.from({ length: 253 }, (_, index) => `present-${index}`);
  const { cleanup, state } = fixture(ids);
  state.pages = Array.from({ length: 6 }, (_, index) => ({ messageIds: ids.slice(index * 50, index * 50 + 50), nextPageToken: index === 5 ? null : String(index + 1) }));
  const first = await cleanup.plan('first');
  assert.equal(first.candidateCount, 250);
  let ready;
  for (let index = 0; index < 6; index++) ready = await cleanup.advance('first', first.planHash);
  await cleanup.apply('first', first.planHash, ready.deletionHash);
  const next = await cleanup.plan('next', first.nextMarker);
  assert.equal(next.candidateCount, 3);
  assert.equal(next.nextMarker, null);
});

test('concurrent page advances cannot commit a stale page over newer progress', async () => {
  const { cleanup, gmail, state, db } = fixture();
  state.pages = [{ messageIds: ['present'], nextPageToken: '1' }, { messageIds: [], nextPageToken: null }];
  const plan = await cleanup.plan('reference');
  await cleanup.advance('reference', plan.planHash);
  let release;
  const waiting = new Promise((resolve) => { release = resolve; });
  let arrived = 0;
  const original = gmail.listAllMessageIds;
  gmail.listAllMessageIds = async (options) => { arrived++; if (arrived === 2) release(); await waiting; return original(options); };
  const results = await Promise.allSettled([cleanup.advance('reference', plan.planHash), cleanup.advance('reference', plan.planHash)]);
  assert.equal(results.filter((value) => value.status === 'fulfilled').length, 1);
  assert(db.records.has(marker('absent')));
});

test('CLI validates target and explicit operation before connecting and outputs only counts and hashes', async () => {
  const args = ['--project', 'test-project', '--confirm-project', 'test-project', '--database', '(default)', '--request-reference', 'reference', '--operation', 'plan'];
  assert.equal(parseMarkerArguments(args)['--operation'], 'plan');
  for (const extra of [['--secret-version', 'secret'], ['--plan-hash', '0'.repeat(64)], ['--operation', 'apply']]) {
    await assert.rejects(runMarkerCli([...args, ...extra], { createDatabase: () => { throw new Error('must not connect'); } }), /MAIL_MARKER_INPUT_INVALID/);
  }
  const { db } = fixture();
  const outputs = [];
  await runMarkerCli(args, { createDatabase: async () => db, write: (value) => outputs.push(value) });
  assert.doesNotMatch(JSON.stringify(outputs), /customer@|present|absent|2026/);
});

test('all-mail ID enumeration includes Spam and Trash without period, label or draft filters', async () => {
  const urls = [];
  const gmail = await createGmailAdapter({ secretVersion: 'projects/test-project/secrets/mail/versions/1',
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })) } }]; } },
    createOAuthClient: () => ({ setCredentials() {}, async getAccessToken() { return { token: 'synthetic' }; }, async getTokenInfo() { return { scopes: ['https://www.googleapis.com/auth/gmail.readonly'] }; } }),
    fetchImpl: async (url) => { urls.push(new URL(url)); return { ok: true, async json() { return url.pathname.endsWith('profile') ? { emailAddress: 'customer@speed-ad.com', historyId: '123' } : { messages: [{ id: 'draft-or-trash' }] }; } }; }
  });
  assert.deepEqual(await gmail.listAllMessageIds(), { messageIds: ['draft-or-trash'], nextPageToken: null });
  const query = urls.at(-1).searchParams;
  assert.equal(query.get('includeSpamTrash'), 'true');
  assert.equal(query.get('maxResults'), '50');
  assert.equal(query.has('q'), false);
  assert.equal(query.has('labelIds'), false);
});
