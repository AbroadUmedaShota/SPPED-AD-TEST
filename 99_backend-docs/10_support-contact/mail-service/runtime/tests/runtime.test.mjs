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
function fixture(ids = [A, B]) {
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
  const execute = createMailService({ store, gmail, core, now: () => new Date(NOW) });
  const envelope = (operation, payload = {}, changes = {}) => ({ contractVersion: 1, operation,
    requestId: randomUUID(), issuedAt: NOW, actor, payload, ...changes });
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
  assert.ok(calls[1].url.includes('pageToken=page2')); assert.equal(calls[1].options.redirect, 'error');
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
