import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createGoogleVerifier } from '../auth.mjs';
import { createMailService, catalogDigest } from '../service.mjs';
import { MailError } from '../errors.mjs';
import { createMailHttpServer } from '../http.mjs';
import { createGmailAdapter } from '../googleAdapters.mjs';
import { fakeStore } from './fakeStore.mjs';

const coreRoot = process.env.MAIL_CORE_DIR ? pathToFileURL(`${resolve(process.env.MAIL_CORE_DIR)}/`) : new URL('../../', import.meta.url);
const modules = await Promise.all(['classification', 'mime', 'review', 'safeMail'].map((name) => import(new URL(`${name}.mjs`, coreRoot))));
const core = Object.assign({}, ...modules);
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-11-10T09:00:00.000Z';
const actor = { email: 'staff@abroad-o.com', authMode: 'domain' };
const encode = (text) => Buffer.from(text).toString('base64url');
const plainPart = (text) => ({ mimeType: 'text/plain', body: { size: Buffer.byteLength(text), data: encode(text) } });
function gmailMessage(id, text = `受付ID: ${A}`, headers = [], file = null) {
  return { id, threadId: `thread-${id}`, internalDate: String(Date.parse(NOW) - 1000), labelIds: [],
    payload: { mimeType: 'multipart/mixed', headers: [{ name: 'Message-ID', value: `<${id}@test.example>` },
      { name: 'From', value: 'Customer <external@example.test>' }, { name: 'To', value: 'customer@speed-ad.com' }, ...headers],
    parts: [plainPart(text), ...(file ? [{ mimeType: file.mimeType || 'text/plain', filename: file.name || 'memo.txt',
      body: { size: file.bytes.length, data: file.bytes.toString('base64url') } }] : [])] } };
}
function record(id, changes = {}) {
  return { messageId: id, threadId: `thread-${id}`, caseId: A, matchState: 'matched', version: 1,
    internalDate: NOW, subject: 'test', from: 'a', to: 'b', direction: 'received', attachmentCount: 0,
    firstReview: null, unavailable: false, bodyAvailability: 'verified', attachments: [],
    unverifiedAttachmentCount: 0, unavailableAttachmentCount: 0, ...changes };
}
function fixture(ids = [A, B], now = () => new Date(NOW)) {
  const store = fakeStore(ids);
  const messages = new Map();
  const calls = [];
  const gmail = {
    async getProfile() { return { emailAddress: 'customer@speed-ad.com', historyId: '100' }; },
    async getMessage(id) { calls.push(id); if (!messages.has(id)) throw new MailError('MAIL_CONTENT_UNAVAILABLE', 410); return structuredClone(messages.get(id)); },
    async getAttachment() { throw new Error('unexpected external attachment'); },
    async listMessages() { return { messageIds: [...messages.keys()] }; },
    async listHistory() { return { messageIds: [], historyId: '200' }; }
  };
  const execute = createMailService({ store, gmail, core, now });
  const envelope = (operation, payload = {}, changes = {}) => ({ contractVersion: 1, operation,
    requestId: randomUUID(), issuedAt: now().toISOString(), actor, payload, ...changes });
  return { store, messages, calls, gmail, execute, envelope };
}

test('OIDC verifies exact script audience and deployer, including azp', async () => {
  const claims = { iss: 'https://accounts.google.com', aud: 'script-client', sub: 'deployer-sub', email: 'owner@abroad-o.com', email_verified: true };
  const verifier = createGoogleVerifier({ client: { async verifyIdToken() { return { getPayload: () => claims }; } },
    audience: 'script-client', deployerEmail: 'owner@abroad-o.com', deployerSubject: 'deployer-sub' });
  await assert.rejects(() => verifier(''), { code: 'MAIL_AUTH_REQUIRED' });
  await verifier('Bearer opaque-token');
  for (const [key, value] of [['aud', 'other'], ['sub', 'other'], ['email', 'other@abroad-o.com'], ['email_verified', false], ['azp', 'other']]) {
    const previous = claims[key]; claims[key] = value;
    await assert.rejects(() => verifier('Bearer opaque-token'), { code: 'MAIL_FORBIDDEN' });
    if (previous === undefined) delete claims[key]; else claims[key] = previous;
  }
});

test('rejects unsupported actor, operation, stale envelope and customer sync', async () => {
  const f = fixture();
  await assert.rejects(() => f.execute(f.envelope('getSyncStatus', {}, { actor: { email: 'fake@example.test', authMode: 'domain' } })), { code: 'MAIL_FORBIDDEN' });
  await assert.rejects(() => f.execute(f.envelope('deleteMail')), { code: 'MAIL_INVALID_REQUEST' });
  await assert.rejects(() => f.execute(f.envelope('getSyncStatus', {}, { issuedAt: '2020-01-01T00:00:00Z' })), { code: 'MAIL_INVALID_REQUEST' });
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full' },
    { actor: { email: 'customer@speed-ad.com', authMode: 'customer-oauth' } })), { code: 'MAIL_FORBIDDEN' });
});

test('stable pagination reaches 253 equal-date messages and previous page', async () => {
  const f = fixture([A]);
  for (let i = 0; i < 253; i++) f.store.seed(record(`mail-${String(i).padStart(4, '0')}`));
  const ids = [];
  const pages = [];
  let token = '';
  do {
    const result = await f.execute(f.envelope('listCaseMail', { caseId: A, pageToken: token }));
    ids.push(...result.messages.map((item) => item.messageId)); pages.push(result); token = result.page.nextPageToken;
  } while (token);
  assert.equal(new Set(ids).size, 253); assert.equal(ids.length, 253);
  const previous = await f.execute(f.envelope('listCaseMail', { caseId: A, pageToken: pages[1].page.previousPageToken }));
  assert.deepEqual(previous.messages.map((item) => item.messageId), pages[0].messages.map((item) => item.messageId));
  await assert.rejects(() => f.execute(f.envelope('listPendingMail', { pageToken: pages[0].page.nextPageToken })), { code: 'MAIL_INVALID_REQUEST' });
  f.store.setCatalog({ complete: false, caseIds: [] });
  await assert.rejects(() => f.execute(f.envelope('listCaseMail', { caseId: A })), { code: 'MAIL_CATALOG_INCOMPLETE' });
});

test('mail and attachment enforce mapping and scrub notification secrets', async () => {
  const f = fixture([A]);
  const body = 'hello https://script.google.com/macros/s/test/exec#token=secret-value';
  const bytes = Buffer.from(`memo ${body}`);
  f.messages.set('m1', gmailMessage('m1', body, [], { bytes }));
  f.store.seed(record('m1', { attachmentCount: 1, attachments: [{ partId: '0.1', name: 'memo.txt', mimeType: 'text/plain', size: bytes.length, availability: 'unverified' }], unverifiedAttachmentCount: 1 }));
  await assert.rejects(() => f.execute(f.envelope('getMail', { scope: 'case', caseId: B, messageId: 'm1' })), { code: 'MAIL_MAPPING_CHANGED' });
  assert.equal(f.calls.length, 0);
  const detail = await f.execute(f.envelope('getMail', { scope: 'case', caseId: A, messageId: 'm1' }));
  assert.ok(!detail.message.bodyText.includes('secret-value'));
  const chunk = await f.execute(f.envelope('getAttachmentChunk', { scope: 'case', caseId: A, messageId: 'm1', partId: '0.1', offset: 0 }));
  assert.ok(!Buffer.from(chunk.dataBase64, 'base64').toString().includes('secret-value'));
  assert.equal(chunk.done, true); assert.equal(chunk.attachment.previewKind, 'text');
  assert.equal((await f.store.getMessage('m1')).unverifiedAttachmentCount, 0);
  await assert.rejects(() => f.execute(f.envelope('getAttachmentChunk', { scope: 'case', caseId: A, messageId: 'm1', partId: '0.8', offset: 0 })), { code: 'MAIL_ATTACHMENT_NOT_FOUND' });
});

test('encoded secret links never reach stored metadata, body RPC or text attachment bytes', async () => {
  const raw = 'https://script.google.com/macros/s/test/exec#token=TEST_ENCODED_SECRET';
  const variants = [encodeURIComponent(raw), encodeURIComponent(encodeURIComponent(raw)),
    'https&#58;&#47;&#47;script.google.com/macros/s/test/exec&#35;token&#61;TEST_ENCODED_SECRET'];
  for (const [index, url] of variants.entries()) {
    const f = fixture([A]);
    const id = `encoded-${index}`;
    const bytes = Buffer.from(`添付 ${url} 終わり`);
    f.messages.set(id, gmailMessage(id, `受付ID: ${A}\n本文 ${url} 終わり`, [
      { name: 'Subject', value: `件名 ${url}` }, { name: 'From', value: `sender@example.test ${url}` },
      { name: 'To', value: `customer@speed-ad.com ${url}` }
    ], { bytes, name: `memo-${url}.txt` }));
    await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full' }));
    const stored = await f.store.getMessage(id);
    assert.ok(!JSON.stringify(stored).includes('TEST_ENCODED_SECRET'));
    assert.match(stored.subject, /\[リンクを非表示\]/);
    const detail = await f.execute(f.envelope('getMail', { scope: 'pending', messageId: id }));
    assert.ok(!JSON.stringify(detail).includes('TEST_ENCODED_SECRET'));
    assert.match(detail.message.bodyText, /本文 \[リンクを非表示\] 終わり/);
    const chunk = await f.execute(f.envelope('getAttachmentChunk', { scope: 'pending', messageId: id, partId: '0.1', offset: 0 }));
    assert.ok(!JSON.stringify(chunk).includes('TEST_ENCODED_SECRET'));
    assert.equal(Buffer.from(chunk.dataBase64, 'base64').toString(), '添付 [リンクを非表示] 終わり');
  }
});

test('first reviewer is transactional, write-once, idempotent and never changes case status', async () => {
  const f = fixture([A]); f.store.seed(record('m1'));
  const sheetStatus = { [A]: '対応済み' };
  const first = f.envelope('markReviewed', { scope: 'case', caseId: A, messageId: 'm1', expectedVersion: 1 });
  const second = f.envelope('markReviewed', { scope: 'case', caseId: A, messageId: 'm1', expectedVersion: 1 }, { actor: { email: 'second@abroad-o.com', authMode: 'domain' } });
  const [one, two] = await Promise.all([f.execute(first), f.execute(second)]);
  assert.equal(one.message.firstReview.email, 'staff@abroad-o.com');
  assert.deepEqual(two.message.firstReview, one.message.firstReview);
  assert.deepEqual(await f.execute(first), one); assert.equal(f.store.events.length, 1);
  await assert.rejects(() => f.execute({ ...first, payload: { ...first.payload, expectedVersion: 2 } }), { code: 'MAIL_REQUEST_CONFLICT' });
  assert.deepEqual(sheetStatus, { [A]: '対応済み' });
});

test('pending resolution validates existing case and expected version', async () => {
  const f = fixture([A]); f.store.seed(record('m1', { caseId: null, matchState: 'pending' }));
  await assert.rejects(() => f.execute(f.envelope('resolvePending', { messageId: 'm1', action: 'match', caseId: A, expectedVersion: 3, reason: '受付照合' })), { code: 'MAIL_MAPPING_CHANGED' });
  const result = await f.execute(f.envelope('resolvePending', { messageId: 'm1', action: 'match', caseId: A, expectedVersion: 1, reason: '受付照合' }));
  assert.equal(result.message.caseId, A); assert.equal(result.message.version, 2);
  assert.equal(f.store.events[0].reason, '受付照合');
});

test('catalog activates only after all immutable pages and digest match', async () => {
  const f = fixture([B]);
  const ids = Array.from({ length: 201 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
  const snapshotId = randomUUID();
  const common = { snapshotId, pageCount: 2, total: ids.length, digest: catalogDigest(ids) };
  const first = await f.execute(f.envelope('uploadCaseCatalog', { ...common, pageIndex: 0, caseIds: ids.slice(0, 200) }));
  assert.equal(first.catalog.complete, false); assert.deepEqual((await f.store.getCatalog()).caseIds, [B]);
  const last = await f.execute(f.envelope('uploadCaseCatalog', { ...common, pageIndex: 1, caseIds: ids.slice(200) }));
  assert.equal(last.catalog.complete, true); assert.equal((await f.store.getCatalog()).caseIds.length, 201);
  await assert.rejects(() => f.execute(f.envelope('uploadCaseCatalog', { ...common, pageIndex: 1, caseIds: [A] })), { code: 'MAIL_REQUEST_CONFLICT' });
});

test('full sync advances one page, replays same request, finalizes stale records, and keeps initial history', async () => {
  const f = fixture([A]); f.messages.set('m1', gmailMessage('m1')); f.messages.set('m2', gmailMessage('m2'));
  f.store.seed(record('deleted', { internalDate: '2026-11-01T00:00:00.000Z' }));
  const pages = [];
  f.gmail.listMessages = async ({ pageToken }) => { pages.push(pageToken); return pageToken ? { messageIds: ['m2'] } : { messageIds: ['m1'], nextPageToken: 'next' }; };
  const executionId = randomUUID(); const start = f.envelope('advanceSync', { executionId, mode: 'full' });
  const first = await f.execute(start); assert.equal(first.sync.state, 'running'); assert.equal(first.sync.acceptanceReady, false);
  assert.deepEqual(await f.execute(start), first); assert.equal(pages.length, 1);
  await f.execute(f.envelope('advanceSync', { executionId }));
  const done = await f.execute(f.envelope('advanceSync', { executionId }));
  assert.equal(done.sync.enumerationComplete, true); assert.equal(done.sync.unavailableCount, 1);
  assert.equal((await f.store.getSyncState()).historyId, '100');
  assert.equal((await f.store.getMessage('m1')).matchState, 'pending');
  assert.equal((await f.store.getMessage('deleted')).unavailable, true);
});

test('explicit pending reconciliation promotes only proven descendants after manual mapping', async () => {
  const f = fixture([A]);
  f.messages.set('parent', gmailMessage('parent'));
  f.messages.set('child', gmailMessage('child', 'reply', [{ name: 'In-Reply-To', value: '<parent@test.example>' }]));
  f.store.seed(record('parent', { rfcMessageId: '<parent@test.example>', reason: 'manual' }));
  f.store.seed(record('child', { caseId: null, matchState: 'pending', rfcMessageId: '<child@test.example>' }));
  await f.execute(f.envelope('reconcilePending'));
  assert.equal((await f.store.getMessage('child')).caseId, A);
  assert.equal((await f.store.getMessage('child')).reason, 'verified_reply_ancestry');
});

test('one Gmail page is processed in bounded batches without repeating successful IDs', async () => {
  const f = fixture([A]);
  for (let index = 0; index < 11; index++) f.messages.set(`m${index}`, gmailMessage(`m${index}`));
  let lists = 0;
  f.gmail.listMessages = async () => { lists++; return { messageIds: [...f.messages.keys()] }; };
  const executionId = randomUUID();
  await f.execute(f.envelope('advanceSync', { executionId, mode: 'full' }));
  assert.equal(f.calls.length, 5); assert.equal(lists, 1);
  await f.execute(f.envelope('advanceSync', { executionId }));
  assert.equal(f.calls.length, 10); assert.equal(lists, 1);
  await f.execute(f.envelope('advanceSync', { executionId }));
  assert.equal(f.calls.length, 11); assert.equal(lists, 1);
  const result = await f.execute(f.envelope('advanceSync', { executionId }));
  assert.equal(result.sync.enumerationComplete, true);
  assert.equal(result.sync.processedCount, 11);
});

test('pending reconciliation limits each request to five and cursor reaches all descendants', async () => {
  const f = fixture([A]);
  f.store.seed(record('parent', { rfcMessageId: '<parent@test.example>', reason: 'manual' }));
  for (let index = 0; index < 12; index++) {
    const id = `child-${String(index).padStart(2, '0')}`;
    f.messages.set(id, gmailMessage(id, 'reply', [{ name: 'In-Reply-To', value: '<parent@test.example>' }]));
    f.store.seed(record(id, { caseId: null, matchState: 'pending' }));
  }
  let pageToken = '';
  const seen = [];
  do {
    const before = f.calls.length;
    const result = await f.execute(f.envelope('reconcilePending', { pageToken }));
    assert.ok(f.calls.length - before <= 5);
    assert.equal(result.page.pageSize, 5);
    seen.push(...f.calls.slice(before));
    pageToken = result.page.nextPageToken;
  } while (pageToken);
  assert.equal(seen.length, 12); assert.equal(new Set(seen).size, 12);
  assert.equal((await f.store.countMessages()).pending, 0);
});

test('history retains the original period and direction comes from Gmail SENT labels', async () => {
  const f = fixture([A]);
  const run = randomUUID();
  await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full', startAt: '2026-11-01T00:00:00.000Z' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  const old = gmailMessage('old'); old.internalDate = String(Date.parse('2020-01-01T00:00:00Z'));
  const sent = gmailMessage('sent'); sent.labelIds = ['SENT'];
  const spoofed = gmailMessage('spoofed', 'reply', [{ name: 'From', value: 'customer@speed-ad.com' }]);
  f.messages.set('old', old); f.messages.set('sent', sent); f.messages.set('spoofed', spoofed);
  f.gmail.listHistory = async () => ({ messageIds: ['old', 'sent', 'spoofed'], historyId: '200' });
  const result = await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  assert.equal(result.sync.startAt, '2026-11-01T00:00:00.000Z');
  assert.equal(await f.store.getMessage('old'), null);
  assert.equal((await f.store.getMessage('sent')).direction, 'sent');
  assert.equal((await f.store.getMessage('spoofed')).direction, 'received');
});

test('history cutoff survives delayed processing and resume while the next run captures interim arrivals', async () => {
  let time = Date.parse(NOW);
  const f = fixture([A], () => new Date(time));
  let snapshotHistoryId = '100'; let profileCalls = 0;
  f.gmail.getProfile = async () => {
    profileCalls++;
    time += 5000;
    return { emailAddress: 'customer@speed-ad.com', historyId: snapshotHistoryId };
  };
  const full = randomUUID();
  const enumerated = await f.execute(f.envelope('advanceSync', { executionId: full, mode: 'full' }));
  const fullCutoff = enumerated.sync.cutoffAt;
  time += 15 * 60000;
  const finalized = await f.execute(f.envelope('advanceSync', { executionId: full }));
  assert.equal(finalized.sync.cutoffAt, fullCutoff);
  assert.equal(finalized.sync.lastSuccessAt, new Date(time).toISOString());

  time = Date.parse('2026-11-10T10:00:00.000Z'); snapshotHistoryId = '200';
  const batch = Array.from({ length: 6 }, (_, i) => `batch-${i}`);
  batch.forEach((id) => f.messages.set(id, gmailMessage(id)));
  const starts = [];
  f.gmail.listHistory = async ({ startHistoryId }) => {
    starts.push(startHistoryId);
    return startHistoryId === '100' ? { messageIds: batch, historyId: '200' } : { messageIds: ['interim'], historyId: '300' };
  };
  const history = randomUUID();
  const first = await f.execute(f.envelope('advanceSync', { executionId: history, mode: 'history' }));
  assert.equal(first.sync.cutoffAt, '2026-11-10T10:00:00.000Z');
  assert.equal(first.sync.state, 'running');
  const interim = gmailMessage('interim'); interim.internalDate = String(Date.parse('2026-11-10T10:05:00.000Z'));
  f.messages.set('interim', interim);
  const getMessage = f.gmail.getMessage;
  let fail = true;
  f.gmail.getMessage = async (id) => {
    if (id === 'batch-5' && fail) throw new MailError('MAIL_UPSTREAM_TIMEOUT', 504);
    return getMessage(id);
  };
  time = Date.parse('2026-11-10T10:15:00.000Z');
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId: history })), { code: 'MAIL_UPSTREAM_TIMEOUT' });
  const failed = await f.store.getSyncState();
  assert.equal(failed.cutoffAt, first.sync.cutoffAt); assert.equal(failed.initialHistoryId, '200');
  const profilesBeforeResume = profileCalls;
  time = Date.parse('2026-11-10T10:20:00.000Z'); fail = false; snapshotHistoryId = '300';
  const completed = await f.execute(f.envelope('advanceSync', { executionId: history, resume: true }));
  assert.equal(profileCalls, profilesBeforeResume);
  assert.equal(completed.sync.cutoffAt, first.sync.cutoffAt);
  assert.equal(completed.sync.lastSuccessAt, '2026-11-10T10:20:00.000Z');
  assert.equal((await f.store.getSyncState()).historyId, '200');
  assert.equal(await f.store.getMessage('interim'), null);
  const next = await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  assert.equal(next.sync.cutoffAt, '2026-11-10T10:20:00.000Z');
  assert.deepEqual(starts, ['100', '200']);
  assert.equal((await f.store.getMessage('interim')).messageId, 'interim');
  assert.equal((await f.store.getSyncState()).historyId, '300');
});

test('history cannot complete below its initial snapshot watermark even after resume', async () => {
  const f = fixture();
  const full = randomUUID();
  await f.execute(f.envelope('advanceSync', { executionId: full, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: full }));
  f.gmail.getProfile = async () => ({ emailAddress: 'customer@speed-ad.com', historyId: '300' });
  f.gmail.listHistory = async () => ({ messageIds: [], historyId: '200' });
  const history = randomUUID();
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId: history, mode: 'history' })), { code: 'MAIL_INVALID_UPSTREAM' });
  const failed = await f.store.getSyncState();
  assert.equal(failed.state, 'failed'); assert.equal(failed.historyId, '100'); assert.equal(failed.initialHistoryId, '300');
  f.gmail.getProfile = async () => { throw new Error('resume must retain the original snapshot'); };
  f.gmail.listHistory = async () => ({ messageIds: [], historyId: '300' });
  const resumed = await f.execute(f.envelope('advanceSync', { executionId: history, resume: true }));
  assert.equal(resumed.sync.state, 'complete'); assert.equal(resumed.sync.cutoffAt, failed.cutoffAt);
  assert.equal((await f.store.getSyncState()).initialHistoryId, '300');
  assert.equal((await f.store.getSyncState()).historyId, '300');
});

test('failed sync requires explicit resume and keeps the failing target', async () => {
  const f = fixture([A]); f.messages.set('m1', gmailMessage('m1'));
  const original = f.gmail.getMessage;
  let fail = true;
  f.gmail.getMessage = async (id) => { if (fail) throw new MailError('MAIL_UPSTREAM_TIMEOUT', 504); return original(id); };
  const executionId = randomUUID();
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId, mode: 'full' })), { code: 'MAIL_UPSTREAM_TIMEOUT' });
  const status = await f.execute(f.envelope('getSyncStatus'));
  assert.equal(status.sync.state, 'failed'); assert.deepEqual(status.sync.failedMessageIds, ['m1']);
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId })), { code: 'MAIL_FULL_SYNC_REQUIRED' });
  fail = false;
  await f.execute(f.envelope('advanceSync', { executionId, resume: true }));
  const result = await f.execute(f.envelope('advanceSync', { executionId }));
  assert.equal(result.sync.enumerationComplete, true);
});

test('body failure cannot inherit a matched parent and incomplete history stays incomplete', async () => {
  const f = fixture([A]);
  const broken = gmailMessage('child', 'text', [{ name: 'In-Reply-To', value: '<parent@test.example>' }]);
  broken.payload.parts[0].body.data = 'not valid base64!'; f.messages.set('child', broken);
  f.store.seed(record('parent', { rfcMessageId: '<parent@test.example>' }));
  f.store.seed(record('child', { matchState: 'pending', caseId: null }));
  await f.execute(f.envelope('reconcilePending'));
  assert.equal((await f.store.getMessage('child')).matchState, 'pending');
  assert.equal((await f.store.getMessage('child')).bodyAvailability, 'unavailable');
  const run = randomUUID(); await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  f.gmail.listHistory = async () => { throw new MailError('MAIL_HISTORY_EXPIRED', 409); };
  const expired = await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  assert.equal(expired.sync.state, 'needs_full_sync'); assert.equal(expired.sync.acceptanceReady, false);
});

test('Gmail adapter verifies mailbox before fixed GET endpoints and preserves list paging', async () => {
  const calls = [];
  const adapter = await createGmailAdapter({ secretVersion: 'projects/test/secrets/mail/versions/1',
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })) } }]; } },
    createOAuthClient: () => ({ setCredentials() {}, async getAccessToken() { return { token: 'opaque' }; },
      async getTokenInfo() { return { scopes: ['https://www.googleapis.com/auth/gmail.readonly'] }; } }),
    fetchImpl: async (url, options) => { calls.push({ url: String(url), options }); return { ok: true, async json() {
      return String(url).endsWith('/profile') ? { emailAddress: 'customer@speed-ad.com', historyId: '3' } : { messages: [{ id: 'a' }], nextPageToken: 'next' };
    } }; }
  });
  const result = await adapter.listMessages({ pageToken: 'page2', cutoffAt: NOW });
  assert.deepEqual(result.messageIds, ['a']); assert.equal(result.nextPageToken, 'next');
  assert.equal(calls.length, 2); assert.ok(calls[1].url.includes('includeSpamTrash=true'));
  assert.ok(new URL(calls[1].url).searchParams.get('q').includes('-in:drafts'));
  assert.ok(calls[1].url.includes('pageToken=page2')); assert.equal(calls[1].options.redirect, 'error');
});

test('drafts stay outside mail queues through full sync, edit, delete and send history', async () => {
  const f = fixture([A]);
  f.store.seed(record('parent', { rfcMessageId: '<parent@test.example>', reason: 'manual' }));
  f.messages.set('parent', gmailMessage('parent'));
  const draft = gmailMessage('draft-1', 'unsent reply', [{ name: 'In-Reply-To', value: '<parent@test.example>' }]);
  draft.labelIds = ['DRAFT']; f.messages.set('draft-1', draft);
  const run = randomUUID();
  await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  assert.equal((await f.store.getMessage('draft-1')).sourceKind, 'draft');
  assert.equal((await f.store.getMessage('draft-1')).matchState, 'excluded');
  assert.equal((await f.execute(f.envelope('listCaseMail', { caseId: A }))).messages.some((item) => item.messageId === 'draft-1'), false);
  const edit = gmailMessage('draft-2', 'edited reply', [{ name: 'In-Reply-To', value: '<parent@test.example>' }]);
  edit.labelIds = ['DRAFT']; f.messages.delete('draft-1'); f.messages.set('draft-2', edit);
  f.gmail.listHistory = async () => ({ messageIds: ['draft-2'], deletedIds: ['draft-1'], historyId: '201' });
  let result = await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  assert.equal(result.sync.unobservedDeletedCount, 0);
  assert.equal((await f.store.getMessage('draft-1')).unavailable, false);
  f.messages.delete('draft-2');
  const sent = gmailMessage('sent-1', 'sent reply', [{ name: 'In-Reply-To', value: '<parent@test.example>' }]);
  sent.labelIds = ['SENT']; f.messages.set('sent-1', sent);
  f.gmail.listHistory = async () => ({ messageIds: ['sent-1', 'sent-1'], deletedIds: ['draft-2'], historyId: '202' });
  result = await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  assert.equal(result.sync.unavailableCount, 0);
  assert.equal(result.sync.unobservedDeletedCount, 0);
  assert.equal((await f.store.getMessage('sent-1')).direction, 'sent');
  assert.equal(f.calls.filter((id) => id === 'sent-1').length, 1);
  assert.equal((await f.store.getMessage('draft-2')).unavailable, false);
  assert.equal((await f.execute(f.envelope('listUnreviewedMail'))).messages.filter((item) => item.messageId === 'sent-1').length, 1);
});

test('draft guard clears stale mapped rows and never exposes draft bodies or attachments', async () => {
  const f = fixture([A]); const draft = gmailMessage('old-draft', 'private unsent text'); draft.labelIds = ['DRAFT'];
  f.messages.set('old-draft', draft); f.store.seed(record('old-draft'));
  await assert.rejects(() => f.execute(f.envelope('getMail', { scope: 'case', caseId: A, messageId: 'old-draft' })), { code: 'MAIL_MAPPING_CHANGED' });
  assert.equal((await f.store.getMessage('old-draft')).matchState, 'excluded');
  assert.equal((await f.store.countMessages()).unreviewed, 0);
  assert.equal((await f.store.countMessages()).unavailable, 0);
});

test('historical draft evidence never erases a current sent message classification', async () => {
  const f = fixture([A]);
  const run = randomUUID(); await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  const firstReview = { email: 'reviewer@abroad-o.com', at: NOW };
  f.store.seed(record('sent', { sourceKind: 'mail', version: 4, reason: 'manual', firstReview }));
  const sent = gmailMessage('sent'); sent.labelIds = ['SENT']; f.messages.set('sent', sent);
  f.gmail.listHistory = async () => ({ messageIds: ['sent'], draftIds: ['sent'], historyId: '201' });
  await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  const saved = await f.store.getMessage('sent');
  assert.equal(saved.matchState, 'matched'); assert.equal(saved.caseId, A); assert.equal(saved.version, 4);
  assert.deepEqual(saved.firstReview, firstReview); assert.equal(saved.direction, 'sent');
});

test('unavailable sent mail with older draft evidence remains a mail residual', async () => {
  const f = fixture([A]);
  const run = randomUUID(); await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  f.store.seed(record('sent-deleted', { sourceKind: 'mail', direction: 'sent', version: 3 }));
  f.gmail.getMessage = async () => { throw new MailError('MAIL_CONTENT_UNAVAILABLE', 410); };
  f.gmail.listHistory = async () => ({ messageIds: ['sent-deleted'], draftIds: ['sent-deleted'], historyId: '201' });
  await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  const saved = await f.store.getMessage('sent-deleted');
  assert.equal(saved.sourceKind, 'mail'); assert.equal(saved.matchState, 'matched');
  assert.equal(saved.unavailable, true); assert.equal((await f.store.countMessages()).unavailable, 1);
});

test('unknown deleted history IDs remain diagnostics without phantom received mail rows', async () => {
  const f = fixture([A]);
  const run = randomUUID(); await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  f.store.seed(record('known'));
  f.gmail.listHistory = async () => ({ messageIds: [], deletedIds: ['unknown', 'known'], draftIds: ['proven-draft'], historyId: '201' });
  const result = await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  assert.equal(await f.store.getMessage('unknown'), null);
  assert.equal(result.sync.unobservedDeletedCount, 1); assert.equal(result.sync.acceptanceReady, false);
  assert.equal(result.sync.unavailableCount, 1); assert.equal((await f.store.getMessage('known')).unavailable, true);
  assert.equal((await f.store.getMessage('proven-draft')).sourceKind, 'draft');
  assert.deepEqual(await f.store.listUnobservedDeletions({ limit: 50 }), [{ messageId: 'unknown', detectedAt: NOW }]);
  for (let index = 0; index < 73; index++) await f.store.recordUnobservedDeletion(`unknown-${String(index).padStart(2, '0')}`, NOW);
  const first = await f.store.listUnobservedDeletions({ limit: 50 });
  const second = await f.store.listUnobservedDeletions({ cursor: { at: first.at(-1).detectedAt, id: first.at(-1).messageId }, limit: 50 });
  assert.equal(new Set([...first, ...second].map((item) => item.messageId)).size, 74);
});

test('Gmail history observes draft evidence and label-only sent updates', async () => {
  const adapter = await createGmailAdapter({ secretVersion: 'projects/test/secrets/mail/versions/1',
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })) } }]; } },
    createOAuthClient: () => ({ setCredentials() {}, async getAccessToken() { return { token: 'opaque' }; },
      async getTokenInfo() { return { scopes: ['https://www.googleapis.com/auth/gmail.readonly'] }; } }),
    fetchImpl: async (url) => ({ ok: true, async json() {
      if (String(url).endsWith('/profile')) return { emailAddress: 'customer@speed-ad.com', historyId: '100' };
      return { historyId: '200', history: [
        { messagesAdded: [{ message: { id: 'draft-old', labelIds: ['DRAFT'] } }], messagesDeleted: [{ message: { id: 'draft-old' } }] },
        { messagesDeleted: [{ message: { id: 'unknown' } }] },
        { labelsAdded: [{ message: { id: 'sent' }, labelIds: ['SENT'] }], labelsRemoved: [{ message: { id: 'sent' }, labelIds: ['DRAFT'] }] },
        { labelsAdded: [{ message: { id: 'sent-deleted' }, labelIds: ['SENT'] }], labelsRemoved: [{ message: { id: 'sent-deleted' }, labelIds: ['DRAFT'] }],
          messagesDeleted: [{ message: { id: 'sent-deleted' } }] }
      ] };
    } })
  });
  const page = await adapter.listHistory({ startHistoryId: '100' });
  assert.deepEqual(page.messageIds, ['sent']); assert.deepEqual(page.deletedIds, ['unknown', 'sent-deleted']);
  assert.deepEqual(page.draftIds, ['draft-old']);
});

test('Gmail adapter rejects any scope other than exactly readonly before Gmail GET', async () => {
  const readonly = 'https://www.googleapis.com/auth/gmail.readonly';
  for (const scopes of [undefined, [], [readonly, 'https://www.googleapis.com/auth/gmail.modify'], ['https://mail.google.com/'], `${readonly}`]) {
    let gets = 0;
    const adapter = await createGmailAdapter({ secretVersion: 'projects/test/secrets/mail/versions/1',
      secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })) } }]; } },
      createOAuthClient: () => ({ setCredentials() {}, async getAccessToken() { return { token: 'opaque' }; },
        async getTokenInfo() { return { scopes }; } }),
      fetchImpl: async () => { gets++; throw new Error('must not call Gmail'); }
    });
    await assert.rejects(() => adapter.getMessage('m1'), { code: 'MAIL_SCOPE_MISMATCH' });
    assert.equal(gets, 0);
  }
});

test('Gmail adapter rechecks a refreshed token and fails closed when tokenInfo fails', async () => {
  const readonly = 'https://www.googleapis.com/auth/gmail.readonly';
  let token = 'first'; let gets = 0; let checks = 0;
  const adapter = await createGmailAdapter({ secretVersion: 'projects/test/secrets/mail/versions/1',
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })) } }]; } },
    createOAuthClient: () => ({ setCredentials() {}, async getAccessToken() { return { token }; },
      async getTokenInfo(value) { checks++; if (value === 'broken') throw new Error('private tokenInfo response'); return { scopes: value === 'first' ? [readonly] : [readonly, 'openid'] }; } }),
    fetchImpl: async () => { gets++; return { ok: true, async json() { return { emailAddress: 'customer@speed-ad.com', historyId: '100' }; } }; }
  });
  await adapter.getProfile(); await adapter.getProfile();
  assert.equal(checks, 1); assert.equal(gets, 2);
  token = 'broader';
  await assert.rejects(() => adapter.getMessage('m1'), { code: 'MAIL_SCOPE_MISMATCH' });
  assert.equal(checks, 2); assert.equal(gets, 2);
  token = 'broken';
  await assert.rejects(() => adapter.getMessage('m1'), { code: 'MAIL_AUTH_REQUIRED', message: 'MAIL_AUTH_REQUIRED' });
  assert.equal(gets, 2);
});

test('HTTP authenticates before dispatch and never echoes arbitrary failures', async (t) => {
  const logs = []; let called = 0;
  const server = createMailHttpServer({ verify: async (value) => { if (value !== 'Bearer test') throw new MailError('MAIL_AUTH_REQUIRED', 401); },
    execute: async () => { called++; throw new Error('secret token Gmail body'); }, log: (entry) => logs.push(entry) });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/rpc`;
  const denied = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(denied.status, 401); assert.equal(called, 0);
  const failed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' }, body: '{}' });
  assert.equal(failed.status, 503); assert.equal((await failed.json()).error.code, 'MAIL_UNAVAILABLE');
  assert.ok(!JSON.stringify(logs).includes('Gmail body')); assert.ok(!JSON.stringify(logs).includes('Bearer'));
});

test('later manual conflicts withdraw inherited links in either case order and preserve explicit decisions', async () => {
  for (const [firstCase, secondCase] of [[A, B], [B, A]]) {
    const f = fixture();
    const sharedThread = 'mixed-thread';
    const firstReview = { email: 'first@abroad-o.com', at: NOW };
    f.store.seed(record('first', { threadId: sharedThread, matchState: 'pending', caseId: null, rfcMessageId: '<first@test.example>' }));
    const first = await f.execute(f.envelope('resolvePending', { messageId: 'first', action: 'match', caseId: firstCase, expectedVersion: 1, reason: 'receipt checked' }));
    assert.equal((await f.store.getMessage('first')).manualClassification, true);
    f.store.seed(record('reply', { threadId: sharedThread, matchState: 'pending', caseId: null }));
    const reply = gmailMessage('reply', 'reply', [{ name: 'In-Reply-To', value: '<first@test.example>' }]);
    reply.threadId = sharedThread; f.messages.set('reply', reply);
    await f.execute(f.envelope('reconcilePending'));
    const inherited = await f.store.getMessage('reply');
    assert.equal(inherited.caseId, firstCase);
    f.store.seed({ ...inherited, firstReview });
    f.store.seed(record('second', { threadId: sharedThread, matchState: 'pending', caseId: null }));
    await f.execute(f.envelope('resolvePending', { messageId: 'second', action: 'match', caseId: secondCase, expectedVersion: 1, reason: 'another receipt checked' }));
    const withdrawn = await f.store.getMessage('reply');
    assert.equal(withdrawn.matchState, 'pending'); assert.equal(withdrawn.caseId, null);
    assert.equal(withdrawn.reason, 'mixed_thread'); assert.equal(withdrawn.version, inherited.version + 1);
    assert.deepEqual(withdrawn.firstReview, firstReview);
    assert.equal((await f.store.getMessage('first')).caseId, firstCase);
    assert.equal((await f.store.getMessage('first')).version, first.message.version);
    assert.equal((await f.store.getMessage('second')).caseId, secondCase);
    assert.ok(f.store.events.some((event) => event.type === 'mail.auto_match_withdrawn' && event.messageId === 'reply'));
    await f.execute(f.envelope('reconcilePending'));
    assert.equal((await f.store.getMessage('reply')).matchState, 'pending');
    assert.deepEqual(new Set(await f.store.getCoveredCaseIds()), new Set([A, B]));
  }
});

test('new indexed case evidence withdraws older auto links and reindex preserves manual mappings', async () => {
  for (const order of [['parent', 'reply', 'other', 'excluded'], ['excluded', 'other', 'reply', 'parent']]) {
    const f = fixture();
    const sharedThread = 'indexed-mixed-thread';
    f.store.seed(record('parent', { threadId: sharedThread, reason: 'manual', manualClassification: true, rfcMessageId: '<parent@test.example>' }));
    f.store.seed(record('reply', { threadId: sharedThread, reason: 'verified_reply_ancestry', version: 4 }));
    f.store.seed(record('excluded', { threadId: sharedThread, caseId: null, matchState: 'excluded', reason: 'manual', manualClassification: true }));
    for (const [id, body, headers] of [['parent', `受付ID: ${A}`, []], ['reply', 'reply', [{ name: 'In-Reply-To', value: '<parent@test.example>' }]], ['other', `受付ID: ${B}`, []], ['excluded', `受付ID: ${B}`, []]]) {
      const message = gmailMessage(id, body, headers); message.threadId = sharedThread; f.messages.set(id, message);
    }
    f.gmail.listMessages = async () => ({ messageIds: order });
    const executionId = randomUUID();
    await f.execute(f.envelope('advanceSync', { executionId, mode: 'full' }));
    assert.equal((await f.store.getMessage('reply')).matchState, 'pending');
    assert.equal((await f.store.getMessage('reply')).caseId, null);
    const parent = await f.store.getMessage('parent');
    assert.equal(parent.caseId, A); assert.equal(parent.reason, 'manual'); assert.equal(parent.manualClassification, true);
    assert.equal((await f.store.getMessage('other')).matchState, 'pending');
    assert.equal((await f.store.getMessage('excluded')).matchState, 'excluded');
    assert.ok(f.store.events.some((event) => event.messageId === 'reply' && event.next.matchState === 'pending'));
  }
});

test('residual list pages identify unindexed failures, unavailable attachments and uncovered cases', async () => {
  const f = fixture(Array.from({ length: 121 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`));
  for (let i = 0; i < 123; i++) f.store.seed(record(`issue-${String(i).padStart(4, '0')}`, {
    matchState: 'pending', caseId: null, unavailable: i % 2 === 0, bodyAvailability: 'unavailable',
    unavailableAttachmentCount: 1, attachmentCount: 1,
    attachments: [{ partId: '0.1', name: 'missing.pdf', mimeType: 'application/pdf', size: 12, availability: 'unavailable' }]
  }));
  const failedIds = Array.from({ length: 121 }, (_, i) => `unindexed-${i}`);
  const lease = await f.store.acquireSyncLease('test');
  await f.store.setSyncState({ state: 'failed', executionId: 'run', failedMessageIds: failedIds, failedCount: failedIds.length }, lease);
  await f.store.releaseSyncLease(lease);
  for (const [kind, expected] of [['pending', 123], ['unavailable', 62], ['bodyUnavailable', 123], ['attachmentUnavailable', 123], ['failed', 121], ['coverage', 121]]) {
    const targets = []; let pageToken = ''; let pages = 0;
    do {
      const result = await f.execute(f.envelope('listMailIssues', { kind, pageToken }));
      assert.ok(result.scannedCount <= 50 && result.targets.length <= 50);
      targets.push(...result.targets); pageToken = result.page.nextPageToken; pages++;
    } while (pageToken);
    assert.equal(targets.length, expected, kind);
    assert.equal(new Set(targets.map((item) => item.messageId || item.caseId)).size, expected, kind);
    assert.equal(pages, 3, kind);
    if (kind === 'failed') assert.ok(targets.every((item) => item.message === null));
  }
  const first = await f.execute(f.envelope('listMailIssues', { kind: 'pending' }));
  await assert.rejects(() => f.execute(f.envelope('listMailIssues', { kind: 'failed', pageToken: first.page.nextPageToken })), { code: 'MAIL_INVALID_REQUEST' });
});

test('residual deletion diagnostics are reachable beyond the first 50 IDs', async () => {
  const f = fixture();
  const rows = Array.from({ length: 111 }, (_, i) => ({ messageId: `deleted-${String(i).padStart(3, '0')}`, detectedAt: NOW })).reverse();
  f.store.listUnobservedDeletions = async ({ cursor, limit }) => rows.filter((row) => !cursor || row.messageId < cursor.id).slice(0, limit);
  let pageToken = ''; const ids = [];
  do {
    const result = await f.execute(f.envelope('listMailIssues', { kind: 'deleted', pageToken }));
    ids.push(...result.targets.map((item) => item.messageId)); pageToken = result.page.nextPageToken;
  } while (pageToken);
  assert.equal(ids.length, 111); assert.equal(new Set(ids).size, 111);
});

test('unavailable mail retains safe metadata and attachment targets in issue detail', async () => {
  const f = fixture();
  f.store.seed(record('gone', { unavailable: true, attachments: [{ partId: '0.2', name: 'missing.pdf', mimeType: 'application/pdf', size: 25, availability: 'unavailable' }] }));
  const gone = await f.execute(f.envelope('getMail', { scope: 'issues', messageId: 'gone' }));
  assert.equal(gone.message.bodyAvailability, 'unavailable');
  assert.equal(gone.message.attachments[0].partId, '0.2');
  assert.equal(gone.message.attachments[0].availability, 'unavailable');
  assert.equal(f.calls.length, 0);
  const broken = gmailMessage('broken'); broken.payload.parts[0].body.data = '!invalid';
  f.messages.set('broken', broken); f.store.seed(record('broken'));
  const detail = await f.execute(f.envelope('getMail', { scope: 'issues', messageId: 'broken' }));
  assert.equal(detail.message.bodyAvailability, 'unavailable'); assert.equal(detail.message.bodyText, '');
});


test('attachment coverage survives retries, out-of-order chunks and reindex before review', async () => {
  const f = fixture([A]);
  const bytes = Buffer.alloc(1024 * 1024 + 1, 7);
  f.messages.set('large', gmailMessage('large', 'body', [], { bytes, mimeType: 'application/octet-stream', name: 'large.bin' }));
  const attachment = { partId: '0.1', name: 'large.bin', mimeType: 'application/octet-stream', size: bytes.length, availability: 'unverified' };
  f.store.seed(record('large', { attachments: [attachment], attachmentCount: 1, unverifiedAttachmentCount: 1, reason: 'manual' }));
  const read = (offset) => f.execute(f.envelope('getAttachmentChunk', { scope: 'case', caseId: A, messageId: 'large', partId: '0.1', offset }));
  const review = () => f.execute(f.envelope('markReviewed', { scope: 'case', caseId: A, messageId: 'large', expectedVersion: 1 }));
  await assert.rejects(review, { code: 'MAIL_CONTENT_UNAVAILABLE' });
  const tail = await read(1024 * 1024);
  assert.equal(tail.done, true); assert.equal(tail.attachment.availability, 'unverified'); assert.equal(tail.reviewReady, false);
  await Promise.all([read(0), read(0)]);
  assert.equal((await f.store.countMessages()).attachmentUnverified, 1);
  await f.store.upsertIndexedMessage(record('large', { attachments: [attachment], attachmentCount: 1, reason: 'manual', indexedAt: NOW }));
  assert.deepEqual((await f.store.getMessage('large')).attachments[0].servedChunks, [0, 1024 * 1024]);
  const complete = await read(512 * 1024);
  assert.equal(complete.attachment.availability, 'verified'); assert.equal(complete.reviewReady, true);
  assert.equal((await f.store.countMessages()).attachmentUnverified, 0);
  assert.equal((await review()).message.firstReview.email, actor.email);
});

test('zero-byte attachments require a successful transfer and body failures prevent review', async () => {
  const f = fixture([A]);
  f.messages.set('empty', gmailMessage('empty', 'body', [], { bytes: Buffer.alloc(0), name: 'empty.txt' }));
  f.store.seed(record('empty', { attachmentCount: 1, unverifiedAttachmentCount: 1,
    attachments: [{ partId: '0.1', name: 'empty.txt', mimeType: 'text/plain', size: 0, availability: 'unverified' }] }));
  const result = await f.execute(f.envelope('getAttachmentChunk', { scope: 'case', caseId: A, messageId: 'empty', partId: '0.1', offset: 0 }));
  assert.equal(result.done, true); assert.equal(result.attachment.availability, 'verified'); assert.equal(result.reviewReady, true);
  for (const availability of ['unverified', 'unavailable']) {
    f.store.seed(record(`body-${availability}`, { bodyAvailability: availability }));
    await assert.rejects(() => f.execute(f.envelope('markReviewed', { scope: 'case', caseId: A, messageId: `body-${availability}`, expectedVersion: 1 })), { code: 'MAIL_CONTENT_UNAVAILABLE' });
  }
});
