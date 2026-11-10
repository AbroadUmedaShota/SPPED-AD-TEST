import { createRequestId } from '../requestIdentity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { createGoogleVerifier } from '../auth.mjs';
import { createMailService, catalogDigest, MAX_MAIL_DETAIL_JSON_CHARS } from '../service.mjs';
import { MailError } from '../errors.mjs';
import { createMailHttpServer } from '../http.mjs';
import { createGmailAdapter } from '../googleAdapters.mjs';
import { createFirestoreStore } from '../firestoreStore.mjs';
import { fakeStore } from './fakeStore.mjs';
import { memoryFirestore } from './memoryFirestore.mjs';
import { retentionPolicy } from '../caseRetention.mjs';
import { suppressionKey } from '../purgeGate.mjs';

const coreRoot = process.env.MAIL_CORE_DIR ? pathToFileURL(`${resolve(process.env.MAIL_CORE_DIR)}/`) : new URL('../../', import.meta.url);
const modules = await Promise.all(['classification', 'mime', 'review', 'safeMail'].map((name) => import(new URL(`${name}.mjs`, coreRoot))));
const core = Object.assign({}, ...modules);
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const caseEntries = (ids) => ids.map((caseId) => ({ caseId, handledStatus: '未対応', closedAt: null }));
const NOW = '2026-11-10T09:00:00.000Z';
const START = '2026-01-01T00:00:00.000Z';
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
  const store = fakeStore(ids, { state: 'not_started', startAt: START });
  const messages = new Map();
  const calls = [];
  const metadataCalls = [];
  const gmail = {
    async getProfile() { return { emailAddress: 'customer@speed-ad.com', historyId: '100' }; },
    async getMessageMetadata(id) {
      metadataCalls.push(id);
      if (!messages.has(id)) throw new MailError('MAIL_CONTENT_UNAVAILABLE', 410);
      const { internalDate, labelIds } = messages.get(id);
      return structuredClone({ id, internalDate, labelIds });
    },
    async getMessage(id) { calls.push(id); if (!messages.has(id)) throw new MailError('MAIL_CONTENT_UNAVAILABLE', 410); return structuredClone(messages.get(id)); },
    async getAttachment() { throw new Error('unexpected external attachment'); },
    async listMessages() { return { messageIds: [...messages.keys()] }; },
    async listHistory() { return { messageIds: [], historyId: '200' }; }
  };
  const execute = createMailService({ store, gmail, core, now });
  const envelope = (operation, payload = {}, changes = {}) => ({ contractVersion: 1, operation,
    requestId: createRequestId(now()), issuedAt: now().toISOString(), actor,
    payload: operation === 'advanceSync' && payload.mode ? { startAt: START, ...payload } : payload, ...changes });
  return { store, messages, calls, metadataCalls, gmail, execute, envelope };
}

async function setIssuePeriod(f) {
  const lease = await f.store.acquireSyncLease('issue-period');
  await f.store.setSyncState({ ...await f.store.getSyncState(), cutoffAt: NOW }, lease);
  await f.store.releaseSyncLease(lease);
}

test('suppressed original Gmail IDs are never fetched or restored by full or history sync', async () => {
  const f = fixture([A]);
  f.store.isMessageSuppressed = async (id) => id === 'purged-original';
  f.messages.set('purged-original', gmailMessage('purged-original'));
  const executionId = randomUUID();
  let result = await f.execute(f.envelope('advanceSync', { executionId, mode: 'full' }));
  while (result.sync.state === 'running') result = await f.execute(f.envelope('advanceSync', { executionId }));
  assert(!f.calls.includes('purged-original'));
  assert.equal(await f.store.getMessage('purged-original'), null);
  f.gmail.listHistory = async () => ({ messageIds: ['purged-original'], historyId: '200' });
  result = await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  assert(!f.calls.includes('purged-original'));
  assert.equal(await f.store.getMessage('purged-original'), null);
});

test('manual exclusion anchors retention at the verified server time', async () => {
  const f = fixture([A]);
  f.store.seed(record('excluded', { matchState: 'pending', caseId: null }));
  await f.execute(f.envelope('resolvePending', { messageId: 'excluded', action: 'exclude', expectedVersion: 1, reason: 'unrelated' }));
  assert.equal((await f.store.getMessage('excluded')).excludedAt, NOW);
});

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

test('expired mutation IDs fail before storage even when the envelope timestamp is renewed', async () => {
  const f = fixture();
  let accesses = 0;
  f.store.withAccess = async () => { accesses++; throw new Error('storage must not be reached'); };
  const requestId = createRequestId(new Date('2026-11-03T09:00:00.000Z'));
  for (const operation of ['markReviewed', 'resolvePending', 'confirmCaseNoMail', 'uploadCaseCatalog', 'advanceSync', 'reconcilePending']) {
    await assert.rejects(f.execute(f.envelope(operation, {}, { requestId })), { code: 'MAIL_REQUEST_EXPIRED' });
  }
  assert.equal(accesses, 0);
  const read = fixture();
  assert.equal((await read.execute(read.envelope('getSyncStatus', {}, { requestId }))).ok, true);
  let at = new Date('2026-11-10T08:59:59.999Z');
  const delayed = fixture([A], () => at);
  delayed.store.withAccess = async (operation) => { at = new Date(NOW); return operation(); };
  await assert.rejects(delayed.execute(delayed.envelope('markReviewed', {},
    { requestId: createRequestId(new Date('2026-11-03T09:00:00.000Z')) })), { code: 'MAIL_REQUEST_EXPIRED' });
});

test('sync request confirmation is read-only, actor-bound and returns historical receipt plus current status', async () => {
  const f = fixture([A]);
  for (let index = 0; index < 12; index++) f.messages.set(`lookup-${index}`, gmailMessage(`lookup-${index}`));
  const original = f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full', startAt: '2026-01-01T00:00:00.000Z' });
  const first = await f.execute(original);
  assert.equal(first.sync.processedCount, 5);
  const later = await f.execute(f.envelope('advanceSync', { executionId: original.payload.executionId }, { actor: { email: 'other@abroad-o.com', authMode: 'domain' } }));
  assert.equal(later.sync.processedCount, 10);
  const calls = f.calls.length;
  const before = await f.store.getSyncState();
  const payload = { requestId: original.requestId, requestPayload: original.payload };
  const result = await f.execute(f.envelope('getSyncRequestResult', payload));
  assert.equal(result.found, true);
  assert.equal(result.receipt.sync.processedCount, 5);
  assert.equal(result.sync.processedCount, 10);
  assert.equal(f.calls.length, calls);
  assert.deepEqual(await f.store.getSyncState(), before);
  await assert.rejects(() => f.execute(f.envelope('getSyncRequestResult', payload, { actor: { email: 'other@abroad-o.com', authMode: 'domain' } })), { code: 'MAIL_REQUEST_CONFLICT' });
  await assert.rejects(() => f.execute(f.envelope('getSyncRequestResult', payload, { actor: { email: 'customer@speed-ad.com', authMode: 'customer-oauth' } })), { code: 'MAIL_FORBIDDEN' });
  await assert.rejects(() => f.execute(f.envelope('getSyncRequestResult', { ...payload, requestPayload: { ...original.payload, executionId: randomUUID() } })), { code: 'MAIL_REQUEST_CONFLICT' });
  const missing = await f.execute(f.envelope('getSyncRequestResult', { ...payload, requestId: randomUUID() }));
  assert.equal(missing.found, false);
  assert.equal(missing.receipt, null);
  assert.equal(missing.sync.processedCount, 10);
  assert.equal(f.calls.length, calls);
  assert.deepEqual(await f.store.getSyncState(), before);
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

test('mail body observation includes independent HTML beside plain text', async () => {
  const f = fixture([A]);
  const mail = gmailMessage('mixed', 'plain introduction');
  const html = '<span>independent inquiry</span>';
  mail.payload.parts.push({ mimeType: 'text/html', body: { size: Buffer.byteLength(html), data: encode(html) } });
  f.messages.set('mixed', mail);
  f.store.seed(record('mixed', { bodyAvailability: 'unverified' }));
  const detail = await f.execute(f.envelope('getMail', { scope: 'case', caseId: A, messageId: 'mixed' }));
  assert.equal(detail.message.bodyText, 'plain introduction\nindependent inquiry');
  assert.equal(detail.message.bodyAvailability, 'verified');
});

test('sync and detail never verify a body whose complete JSON cannot pass the GAS detail ceiling', async () => {
  for (const tooLarge of ['\t'.repeat(MAX_MAIL_DETAIL_JSON_CHARS / 2), 'あ'.repeat(11 * 1024 * 1024)]) {
    const f = fixture([A]);
    const guardedCore = { ...core, readMessageText: async () => tooLarge,
      classifyMessage: () => ({ matchState: 'matched', caseId: A, reason: 'trusted_current_case_id', evidence: { bodyCaseIds: [A], currentCaseIds: [A], parentMessageIds: [] } }) };
    const execute = createMailService({ store: f.store, gmail: f.gmail, core: guardedCore, now: () => new Date(NOW) });
    f.messages.set('oversized', gmailMessage('oversized'));
    await execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full' }));
    assert.equal((await f.store.getMessage('oversized')).bodyAvailability, 'unavailable');
    f.store.seed(record('oversized', { bodyAvailability: 'verified' }));
    const result = await execute(f.envelope('getMail', { scope: 'case', caseId: A, messageId: 'oversized' }));
    assert.equal(result.message.bodyAvailability, 'unavailable');
    assert.equal(result.message.bodyText, '');
    assert.equal(result.message.reviewReady, false);
    assert.equal((await f.store.getMessage('oversized')).bodyAvailability, 'unavailable');
    assert.ok(JSON.stringify(result).length <= MAX_MAIL_DETAIL_JSON_CHARS);
  }
});

test('forwarded attachment child content cannot be acknowledged as an empty transfer', async () => {
  const f = fixture([A]);
  const mail = gmailMessage('forwarded', 'current body');
  mail.payload.parts.push({ mimeType: 'message/rfc822', filename: 'forward.eml', body: { size: 0 }, parts: [plainPart('forwarded content')] });
  f.messages.set('forwarded', mail);
  f.store.seed(record('forwarded', { attachmentCount: 1, unverifiedAttachmentCount: 1,
    attachments: [{ partId: '0.1', name: 'forward.eml', mimeType: 'message/rfc822', size: 0, availability: 'unverified' }] }));
  const detail = await f.execute(f.envelope('getMail', { scope: 'case', caseId: A, messageId: 'forwarded' }));
  assert.equal(detail.message.bodyText, 'current body');
  assert.equal(detail.message.reviewReady, false);
  await assert.rejects(() => f.execute(f.envelope('getAttachmentChunk', { scope: 'case', caseId: A, messageId: 'forwarded', partId: '0.1', offset: 0 })), { code: 'MAIL_ATTACHMENT_UNAVAILABLE' });
  assert.equal((await f.store.getMessage('forwarded')).attachments[0].availability, 'unavailable');
  await assert.rejects(() => f.execute(f.envelope('markReviewed', { scope: 'case', caseId: A, messageId: 'forwarded', expectedVersion: 1 })), { code: 'MAIL_CONTENT_UNAVAILABLE' });
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
  const cases = caseEntries(ids).map((item, index) => index % 2 ? { ...item, handledStatus: '対応済み', closedAt: '2026-11-09T00:00:00.000Z' } : item);
  const common = { snapshotId, pageCount: 2, total: ids.length, digest: catalogDigest(cases) };
  const first = await f.execute(f.envelope('uploadCaseCatalog', { ...common, pageIndex: 0, cases: cases.slice(0, 200) }));
  assert.equal(first.catalog.complete, false); assert.deepEqual((await f.store.getCatalog()).caseIds, [B]);
  const last = await f.execute(f.envelope('uploadCaseCatalog', { ...common, pageIndex: 1, cases: cases.slice(200) }));
  assert.equal(last.catalog.complete, true); assert.equal((await f.store.getCatalog()).caseIds.length, 201); assert.deepEqual((await f.store.getCatalog()).cases, cases);
  await assert.rejects(() => f.execute(f.envelope('uploadCaseCatalog', { ...common, pageIndex: 1, cases: caseEntries([A]) })), { code: 'MAIL_REQUEST_CONFLICT' });
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

test('missing or invalid periods fail before Gmail profile or enumeration, including legacy running state', async () => {
  for (const startAt of [undefined, null, '', 'invalid']) {
    const f = fixture();
    let gmailCalls = 0;
    f.gmail.getProfile = f.gmail.listMessages = async () => { gmailCalls++; throw new Error('must not access Gmail'); };
    const request = f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full' });
    if (startAt === undefined) delete request.payload.startAt;
    else request.payload.startAt = startAt;
    await assert.rejects(() => f.execute(request), { code: 'MAIL_PERIOD_REQUIRED' });
    assert.equal(gmailCalls, 0);
  }
  const f = fixture();
  const executionId = randomUUID();
  const lease = await f.store.acquireSyncLease('legacy');
  await f.store.setSyncState({ executionId, state: 'running', mode: 'full' }, lease);
  await f.store.releaseSyncLease(lease);
  let lists = 0;
  f.gmail.listMessages = async () => { lists++; throw new Error('must not enumerate'); };
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId })), { code: 'MAIL_PERIOD_REQUIRED' });
  assert.equal(lists, 0);
  f.store.seed(record('legacy'));
  await assert.rejects(() => f.execute(f.envelope('getMail', { scope: 'case', caseId: A, messageId: 'legacy' })), { code: 'MAIL_PERIOD_REQUIRED' });
  const status = await f.execute(f.envelope('getSyncStatus'));
  assert.equal(status.sync.acceptanceReady, false);
  assert.equal(status.sync.unreviewedCount, null);
  assert.equal(status.sync.state, 'needs_full_sync');
  assert.equal(status.sync.errorCode, 'MAIL_PERIOD_REQUIRED');
});

test('narrowed period hides old mail from all queues and direct operations while retaining audit records', async () => {
  const f = fixture();
  const oldAt = '2026-02-01T00:00:00.000Z';
  const recentStart = '2026-11-01T00:00:00.000Z';
  for (const id of ['old-reviewed', 'old-unreviewed', 'old-pending']) {
    const message = gmailMessage(id, `受付ID: ${A}`, [], id === 'old-reviewed' ? { bytes: Buffer.from('old attachment') } : null);
    message.internalDate = String(Date.parse(oldAt));
    f.messages.set(id, message);
  }
  for (let index = 0; index < 53; index++) f.messages.set(`recent-${String(index).padStart(3, '0')}`, gmailMessage(`recent-${String(index).padStart(3, '0')}`));
  async function run(startAt, mode = 'full') {
    const executionId = randomUUID();
    let result = await f.execute(f.envelope('advanceSync', { executionId, mode, startAt }));
    while (result.sync.state === 'running') result = await f.execute(f.envelope('advanceSync', { executionId }));
    assert.equal(result.sync.state, 'complete');
    return result;
  }
  await run(START);
  for (const [id, target] of [['old-reviewed', B], ['old-unreviewed', A]]) await f.execute(f.envelope('resolvePending', {
    messageId: id, expectedVersion: 1, action: 'match', caseId: target, reason: '本文を照合'
  }));
  await f.execute(f.envelope('getMail', { scope: 'case', caseId: B, messageId: 'old-reviewed' }));
  await f.execute(f.envelope('getAttachmentChunk', { scope: 'case', caseId: B, messageId: 'old-reviewed', partId: '0.1', offset: 0 }));
  const review = f.envelope('markReviewed', { scope: 'case', caseId: B, messageId: 'old-reviewed', expectedVersion: 2 });
  await f.execute(review);
  await f.store.markUnavailable('old-unreviewed', NOW);
  const oldRecords = ['old-reviewed', 'old-unreviewed', 'old-pending'].map((id) => structuredClone(f.store.records.get(id)));
  const events = structuredClone(f.store.events);
  const broadPage = await f.execute(f.envelope('listPendingMail'));
  const broadIssues = await f.execute(f.envelope('listMailIssues', { kind: 'pending' }));
  assert.ok(broadPage.page.nextPageToken);
  const narrowed = await run(recentStart, 'history');
  assert.equal(narrowed.sync.mode, 'full');
  assert.equal(narrowed.sync.startAt, recentStart);
  assert.equal(narrowed.sync.pendingCount, 53);
  assert.equal(narrowed.sync.unreviewedCount, 0);
  assert.equal(narrowed.sync.unavailableCount, 0);
  assert.equal(narrowed.sync.coverageUnverifiedCaseCount, 2);
  assert.deepEqual(['old-reviewed', 'old-unreviewed', 'old-pending'].map((id) => f.store.records.get(id)), oldRecords);
  assert.deepEqual(f.store.events, events);
  await assert.rejects(() => f.execute(f.envelope('listPendingMail', { pageToken: broadPage.page.nextPageToken })), { code: 'MAIL_INVALID_REQUEST' });
  await assert.rejects(() => f.execute(f.envelope('listMailIssues', { kind: 'pending', pageToken: broadIssues.page.nextPageToken })), { code: 'MAIL_INVALID_REQUEST' });
  const ids = [];
  let pageToken = '';
  do {
    const result = await f.execute(f.envelope('listPendingMail', { pageToken }));
    ids.push(...result.messages.map((item) => item.messageId));
    pageToken = result.page.nextPageToken;
  } while (pageToken);
  assert.equal(ids.length, 53); assert.equal(new Set(ids).size, 53);
  assert.ok(ids.every((id) => id.startsWith('recent-')));
  assert.deepEqual((await f.execute(f.envelope('listCaseMail', { caseId: A }))).messages, []);
  assert.deepEqual((await f.execute(f.envelope('listUnreviewedMail'))).messages, []);
  for (const kind of ['pending', 'unreviewed', 'unavailable', 'bodyUnverified', 'bodyUnavailable', 'attachmentUnverified', 'attachmentUnavailable']) {
    const issues = await f.execute(f.envelope('listMailIssues', { kind }));
    assert.ok(issues.targets.every((item) => item.messageId.startsWith('recent-')));
  }
  const calls = f.calls.length;
  for (const [operation, payload] of [
    ['getMail', { scope: 'case', caseId: B, messageId: 'old-reviewed' }],
    ['getMail', { scope: 'pending', messageId: 'old-pending' }],
    ['getAttachmentChunk', { scope: 'case', caseId: B, messageId: 'old-reviewed', partId: '0.1', offset: 0 }],
    ['resolvePending', { messageId: 'old-pending', action: 'exclude', expectedVersion: 1, reason: '対象外' }]
  ]) await assert.rejects(() => f.execute(f.envelope(operation, payload)), { code: 'MAIL_NOT_FOUND' });
  await assert.rejects(() => f.execute(review), { code: 'MAIL_NOT_FOUND' });
  assert.equal(f.calls.length, calls);
  const visible = await f.execute(f.envelope('getMail', { scope: 'pending', messageId: 'recent-000' }));
  assert.match(visible.message.bodyText, /受付ID/);
});

test('a period change between write preflight and transaction prevents review or receipt replay', async () => {
  const f = fixture([A]);
  f.store.seed(record('old', { internalDate: '2026-02-01T00:00:00.000Z' }));
  const mutate = f.store.mutate.bind(f.store);
  f.store.mutate = async (...args) => {
    const lease = await f.store.acquireSyncLease('narrow');
    await f.store.setSyncState({ state: 'complete', startAt: '2026-11-01T00:00:00.000Z' }, lease);
    await f.store.releaseSyncLease(lease);
    return mutate(...args);
  };
  await assert.rejects(() => f.execute(f.envelope('markReviewed', { scope: 'case', caseId: A, messageId: 'old', expectedVersion: 1 })), { code: 'MAIL_MAPPING_CHANGED' });
  assert.equal((await f.store.getMessage('old')).firstReview, null);
  assert.equal(f.store.events.length, 0);
  assert.equal(f.store.receipts.size, 0);
});

test('Firestore query boundary applies the active period to lists, counts and case coverage', async () => {
  const rows = [record('old', { internalDate: START, caseId: B, unavailable: true, unverifiedAttachmentCount: 4 }),
    record('recent'), record('pending', { matchState: 'pending', caseId: null })];
  class Query {
    constructor(filters = [], fields = null) { this.filters = filters; this.fields = fields; }
    doc() { return this; }
    collection() { return this; }
    where(field, operator, value) { return new Query([...this.filters, [field, operator, value]], this.fields); }
    select(...fields) { return new Query(this.filters, fields); }
    orderBy() { return this; }
    limit() { return this; }
    startAfter() { return this; }
    matching() { return rows.filter((row) => this.filters.every(([field, operator, value]) => operator === '>=' ? row[field] >= value : operator === 'in' ? value.includes(row[field]) : row[field] === value)); }
    async get() { return { docs: this.matching().map((row) => ({ id: row.messageId, data: () => this.fields ? Object.fromEntries(this.fields.map((field) => [field, row[field]])) : row })) }; }
    count() { return { get: async () => ({ data: () => ({ count: this.matching().length }) }) }; }
    aggregate() { return { get: async () => ({ data: () => ({ unverified: this.matching().reduce((sum, row) => sum + row.unverifiedAttachmentCount, 0), unavailable: this.matching().reduce((sum, row) => sum + row.unavailableAttachmentCount, 0) }) }) }; }
  }
  const store = createFirestoreStore({ collection: () => new Query() });
  const startAt = '2026-11-01T00:00:00.000Z';
  assert.deepEqual((await store.listMessages({ mode: 'case', caseId: A, startAt, limit: 51 })).map((row) => row.messageId), ['recent']);
  assert.deepEqual(await store.getCoveredCaseIds({ startAt }), [A]);
  const counts = await store.countMessages({ startAt });
  assert.equal(counts.pending, 1); assert.equal(counts.unreviewed, 1); assert.equal(counts.unavailable, 0); assert.equal(counts.attachmentUnverified, 0);
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
  const result = await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history', startAt: '2026-11-01T00:00:00.000Z' }));
  assert.equal(result.sync.startAt, '2026-11-01T00:00:00.000Z');
  assert.equal(await f.store.getMessage('old'), null);
  assert.equal((await f.store.getMessage('sent')).direction, 'sent');
  assert.equal((await f.store.getMessage('spoofed')).direction, 'received');
});

test('history filters old label changes and draft edits before requesting body or attachment data', async () => {
  const f = fixture([A]);
  const run = randomUUID();
  await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  const file = { name: 'private.txt', bytes: Buffer.from('private attachment') };
  const old = gmailMessage('old-label-change', 'private old body', [], file);
  old.internalDate = String(Date.parse(START) - 1); old.labelIds = ['STARRED'];
  const draft = gmailMessage('draft-edit', 'private unsent body', [], file); draft.labelIds = ['DRAFT'];
  const eligible = gmailMessage('eligible', `受付ID: ${A}`);
  f.messages.set(old.id, old); f.messages.set(draft.id, draft); f.messages.set(eligible.id, eligible);
  let attachmentCalls = 0;
  f.gmail.getAttachment = async () => { attachmentCalls++; throw new Error('unexpected attachment fetch'); };
  f.gmail.listHistory = async () => ({ messageIds: [old.id, draft.id, eligible.id], historyId: '200' });
  const result = await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  assert.equal(result.sync.state, 'complete');
  assert.deepEqual(f.metadataCalls, [old.id, draft.id, eligible.id]);
  assert.deepEqual(f.calls, [eligible.id]);
  assert.equal(attachmentCalls, 0);
  assert.equal(await f.store.getMessage(old.id), null);
  assert.equal(await f.store.getMessage(draft.id), null);
  assert.deepEqual(f.store.suppressedMessages.get(suppressionKey('message', draft.id)), { version: 1 });
  assert.equal(f.store.records.has(draft.id), false);
  assert.equal((await f.store.getMessage(eligible.id)).bodyAvailability, 'verified');
});

test('full sync filters period boundaries and rejects invalid metadata before full-message retrieval', async () => {
  const f = fixture([A]);
  const old = gmailMessage('before-start'); old.internalDate = String(Date.parse(START) - 1);
  const future = gmailMessage('after-cutoff'); future.internalDate = String(Date.parse(NOW) + 1);
  const boundary = gmailMessage('at-start'); boundary.internalDate = String(Date.parse(START));
  f.messages.set(old.id, old); f.messages.set(future.id, future); f.messages.set(boundary.id, boundary);
  await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full' }));
  assert.deepEqual(f.calls, [boundary.id]);
  const state = await f.store.getSyncState();
  await f.execute(f.envelope('advanceSync', { executionId: state.executionId }));
  const metadata = f.gmail.getMessageMetadata.bind(f.gmail);
  f.gmail.getMessageMetadata = async (id) => ({ ...(await metadata(id)), internalDate: undefined });
  const before = f.calls.length;
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full' })), { code: 'MAIL_INVALID_UPSTREAM' });
  assert.equal(f.calls.length, before);
  assert.equal((await f.store.getSyncState()).state, 'failed');
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
  assert.equal(status.sync.state, 'failed'); assert.equal(status.sync.failedCount, 1);
  assert.equal(Object.hasOwn(status.sync, 'failedMessageIds'), false);
  assert.equal((await f.execute(f.envelope('listMailIssues', { kind: 'failed' }))).targets[0].messageId, 'm1');
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId })), { code: 'MAIL_FULL_SYNC_REQUIRED' });
  fail = false;
  await f.execute(f.envelope('advanceSync', { executionId, resume: true }));
  const result = await f.execute(f.envelope('advanceSync', { executionId }));
  assert.equal(result.sync.enumerationComplete, true);
});

test('a draft failure target is not copied into reconciliation receipts and disappears after resume', async () => {
  const f = fixture([A]);
  const id = 'draft-before-classification';
  const draft = gmailMessage(id, 'private unsent'); draft.labelIds = ['DRAFT']; f.messages.set(id, draft);
  const metadata = f.gmail.getMessageMetadata;
  f.gmail.getMessageMetadata = async () => { throw new MailError('MAIL_UPSTREAM_TIMEOUT', 504); };
  const executionId = randomUUID();
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId, mode: 'full' })), { code: 'MAIL_UPSTREAM_TIMEOUT' });
  assert.deepEqual((await f.store.getSyncState()).failedMessageIds, [id]);
  const reconciliation = f.envelope('reconcilePending');
  const result = await f.execute(reconciliation);
  assert.equal(result.sync.failedCount, 1);
  assert.equal(Object.hasOwn(result.sync, 'failedMessageIds'), false);
  assert.equal(JSON.stringify([...f.store.receipts]).includes(id), false);
  f.gmail.getMessageMetadata = metadata;
  await f.execute(f.envelope('advanceSync', { executionId, resume: true }));
  await f.execute(f.envelope('advanceSync', { executionId }));
  const state = await f.store.getSyncState();
  assert.equal(state.state, 'complete'); assert.equal(state.inFlightPage, null);
  assert.deepEqual(state.failedMessageIds, []);
  const persisted = { records: [...f.store.records], receipts: [...f.store.receipts], events: f.store.events,
    markers: [...f.store.suppressedMessages], state, deletions: await f.store.listUnobservedDeletions({ limit: 50 }) };
  assert.equal(JSON.stringify(persisted).includes(id), false);
  assert.equal(f.calls.length, 0);
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
      if (new URL(url).searchParams.has('fields')) return { id: 'a', labelIds: [], internalDate: String(Date.parse(NOW)) };
      return String(url).endsWith('/profile') ? { emailAddress: 'customer@speed-ad.com', historyId: '3' } : { messages: [{ id: 'a' }], nextPageToken: 'next' };
    } }; }
  });
  await assert.rejects(() => adapter.listMessages({ pageToken: 'page2', cutoffAt: NOW }), { code: 'MAIL_PERIOD_REQUIRED' });
  assert.equal(calls.length, 0);
  const result = await adapter.listMessages({ pageToken: 'page2', startAt: START, cutoffAt: NOW });
  assert.deepEqual(result.messageIds, ['a']); assert.equal(result.nextPageToken, 'next');
  assert.equal(calls.length, 2); assert.ok(calls[1].url.includes('includeSpamTrash=true'));
  assert.ok(new URL(calls[1].url).searchParams.get('q').includes('-in:drafts'));
  assert.ok(calls[1].url.includes('pageToken=page2')); assert.equal(calls[1].options.redirect, 'error');
  const metadata = await adapter.getMessageMetadata('a');
  assert.deepEqual(metadata, { id: 'a', labelIds: [], internalDate: String(Date.parse(NOW)) });
  const metadataUrl = new URL(calls[2].url);
  assert.equal(metadataUrl.searchParams.get('format'), 'full');
  assert.equal(metadataUrl.searchParams.get('fields'), 'id,labelIds,internalDate');
  assert.deepEqual([...metadataUrl.searchParams.keys()].sort(), ['fields', 'format']);
});

test('Gmail scope prefilter rejects malformed or overbroad partial responses', async () => {
  const valid = { id: 'm1', labelIds: ['INBOX'], internalDate: String(Date.parse(NOW)) };
  let response = valid;
  const adapter = await createGmailAdapter({ secretVersion: 'projects/test/secrets/mail/versions/1',
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })) } }]; } },
    createOAuthClient: () => ({ setCredentials() {}, async getAccessToken() { return { token: 'opaque' }; },
      async getTokenInfo() { return { scopes: ['https://www.googleapis.com/auth/gmail.readonly'] }; } }),
    fetchImpl: async (url) => ({ ok: true, async json() {
      return String(url).endsWith('/profile') ? { emailAddress: 'customer@speed-ad.com' } : response;
    } })
  });
  for (const invalid of [null, [], { ...valid, id: 'other' }, { ...valid, labelIds: 'DRAFT' },
    { ...valid, internalDate: undefined }, { ...valid, internalDate: 'invalid' },
    { ...valid, payload: {} }, { ...valid, snippet: 'private content' }]) {
    response = invalid;
    await assert.rejects(() => adapter.getMessageMetadata('m1'), { code: 'MAIL_INVALID_UPSTREAM' });
  }
  response = valid;
  assert.deepEqual(await adapter.getMessageMetadata('m1'), valid);
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
  assert.equal(await f.store.getMessage('draft-1'), null);
  assert.deepEqual(f.store.suppressedMessages.get(suppressionKey('message', 'draft-1')), { version: 1 });
  assert.equal((await f.execute(f.envelope('listCaseMail', { caseId: A }))).messages.some((item) => item.messageId === 'draft-1'), false);
  const edit = gmailMessage('draft-2', 'edited reply', [{ name: 'In-Reply-To', value: '<parent@test.example>' }]);
  edit.labelIds = ['DRAFT']; f.messages.delete('draft-1'); f.messages.set('draft-2', edit);
  f.gmail.listHistory = async ({ pageToken }) => pageToken ?
    { messageIds: ['sent-1'], deletedIds: ['draft-2'], historyId: '202' } :
    { messageIds: ['draft-2'], deletedIds: ['draft-1'], nextPageToken: 'draft-page-2', historyId: '201' };
  const historyRun = randomUUID();
  const firstPage = f.envelope('advanceSync', { executionId: historyRun, mode: 'history' });
  let result = await f.execute(firstPage);
  assert.equal(result.sync.state, 'running');
  assert.deepEqual(await f.execute(firstPage), result);
  assert.equal(result.sync.unobservedDeletedCount, 0);
  assert.equal(await f.store.getMessage('draft-1'), null);
  f.messages.delete('draft-2');
  const sent = gmailMessage('sent-1', 'sent reply', [{ name: 'In-Reply-To', value: '<parent@test.example>' }]);
  sent.labelIds = ['SENT']; f.messages.set('sent-1', sent);
  result = await f.execute(f.envelope('advanceSync', { executionId: historyRun }));
  assert.equal(result.sync.unavailableCount, 0);
  assert.equal(result.sync.unobservedDeletedCount, 0);
  assert.equal((await f.store.getMessage('sent-1')).direction, 'sent');
  assert.equal(f.calls.filter((id) => id === 'sent-1').length, 1);
  assert.equal(await f.store.getMessage('draft-2'), null);
  assert.equal(f.store.records.has('draft-1'), false);
  assert.equal(f.store.records.has('draft-2'), false);
  assert.deepEqual([...f.store.suppressedMessages.values()], [{ version: 1 }, { version: 1 }]);
  assert.equal(f.calls.some((id) => id.startsWith('draft-')), false);
  assert.equal((await f.execute(f.envelope('listUnreviewedMail'))).messages.filter((item) => item.messageId === 'sent-1').length, 1);
});

test('draft guard clears stale mapped rows and never exposes draft bodies or attachments', async () => {
  const f = fixture([A]); const draft = gmailMessage('old-draft', 'private unsent text'); draft.labelIds = ['DRAFT'];
  const firstReview = { email: actor.email, at: NOW };
  f.messages.set('old-draft', draft); f.store.seed(record('old-draft', { firstReview }));
  await assert.rejects(() => f.execute(f.envelope('getMail', { scope: 'case', caseId: A, messageId: 'old-draft' })), { code: 'MAIL_MAPPING_CHANGED' });
  const saved = await f.store.getMessage('old-draft');
  assert.equal(saved.matchState, 'pending');
  assert.equal(saved.caseId, null); assert.equal(saved.reason, 'current_draft_conflict');
  assert.deepEqual(saved.firstReview, firstReview);
  assert.equal(f.calls.length, 0);
  assert.equal((await f.store.getCoveredCaseIds()).length, 0);
  assert.equal(f.store.events.at(-1).reason, 'current_draft_conflict');
  assert.equal((await f.store.countMessages()).unreviewed, 0);
  assert.equal((await f.store.countMessages()).unavailable, 1);
  const run = randomUUID(); await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  assert.equal((await f.store.getMessage('old-draft')).reason, 'current_draft_conflict');
  assert.equal(f.calls.length, 0);
});

test('a manual exclusion of a draft conflict keeps its retention anchor and audit through later draft observations', async () => {
  const f = fixture([A]); const id = 'excluded-draft-conflict';
  const draft = gmailMessage(id, 'unsent'); draft.labelIds = ['DRAFT']; f.messages.set(id, draft);
  const firstReview = { email: actor.email, at: NOW };
  f.store.seed(record(id, { firstReview }));
  await assert.rejects(() => f.execute(f.envelope('getMail', { scope: 'case', caseId: A, messageId: id })), { code: 'MAIL_MAPPING_CHANGED' });
  const conflict = await f.store.getMessage(id);
  await f.execute(f.envelope('resolvePending', { messageId: id, expectedVersion: conflict.version,
    action: 'exclude', reason: '下書きと確認したため対象外' }));
  const excluded = await f.store.getMessage(id);
  assert.equal(excluded.matchState, 'excluded'); assert.equal(excluded.excludedAt, NOW);
  assert.equal(excluded.manualClassification, true); assert.deepEqual(excluded.firstReview, firstReview);
  const events = structuredClone(f.store.events);
  const run = randomUUID(); await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  f.gmail.listHistory = async () => ({ messageIds: [id], draftIds: [id], historyId: '201' });
  await f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' }));
  assert.deepEqual(await f.store.getMessage(id), excluded);
  assert.deepEqual(f.store.events, events);
  assert.equal(await f.store.isMessageSuppressed(id), false);
  assert.equal(f.calls.length, 0);

  const root = 'contactMailboxes/customer-speed-ad';
  const db = memoryFirestore({ [`${root}/messages/${id}`]: excluded });
  const store = createFirestoreStore(db);
  await store.excludeDraft(id, NOW);
  await store.excludeDraft(id, NOW, { current: false });
  assert.deepEqual(db.records.get(`${root}/messages/${id}`), excluded);
  assert.equal([...db.records.keys()].some((path) => path.startsWith(`${root}/events/`)), false);
  assert.equal([...db.records.keys()].some((path) => path.startsWith(`${root}/suppressedMessages/`)), false);
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

test('discarded drafts leave only a hash and never become unknown deletion diagnostics', async () => {
  const f = fixture([A]);
  const draft = gmailMessage('discarded-draft', 'never sent'); draft.labelIds = ['DRAFT'];
  f.messages.set(draft.id, draft);
  const run = randomUUID(); await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  f.messages.delete(draft.id);
  f.gmail.listHistory = async () => ({ messageIds: [], deletedIds: [draft.id], draftIds: [draft.id], historyId: '201' });
  const request = f.envelope('advanceSync', { executionId: randomUUID(), mode: 'history' });
  const result = await f.execute(request);
  await f.execute(request);
  assert.equal(result.sync.unobservedDeletedCount, 0);
  assert.equal(f.store.records.has(draft.id), false);
  assert.deepEqual([...f.store.suppressedMessages], [[suppressionKey('message', draft.id), { version: 1 }]]);
  assert.equal(f.calls.length, 0);
});

test('legacy pure draft records migrate to hashes while prior mail evidence remains a pending conflict', async () => {
  const f = fixture([A]);
  f.store.seed({ messageId: 'legacy-pure', sourceKind: 'draft', version: 1, matchState: 'excluded',
    caseId: null, internalDate: NOW, threadId: '', subject: '', from: '', to: '', attachmentCount: 0, firstReview: null });
  f.gmail.listMessages = async () => ({ messageIds: [] });
  const run = randomUUID(); await f.execute(f.envelope('advanceSync', { executionId: run, mode: 'full' }));
  await f.execute(f.envelope('advanceSync', { executionId: run }));
  assert.equal(f.store.records.has('legacy-pure'), false);
  assert.equal(await f.store.isMessageSuppressed('legacy-pure'), true);

  const root = 'contactMailboxes/customer-speed-ad';
  const prior = record('prior-mail', { firstReview: { email: actor.email, at: NOW } });
  const db = memoryFirestore({
    [`${root}/messages/legacy-pure`]: { messageId: 'legacy-pure', sourceKind: 'draft', version: 1, matchState: 'excluded', caseId: null },
    [`${root}/deletionDiagnostics/legacy-pure`]: { messageId: 'legacy-pure', detectedAt: NOW },
    [`${root}/messages/prior-mail`]: prior,
    [`${root}/receipts/kept-request`]: { result: { message: prior } }
  });
  const store = createFirestoreStore(db);
  await store.excludeDraft('legacy-pure', NOW, { current: false });
  assert.equal(db.records.has(`${root}/messages/legacy-pure`), false);
  assert.equal(db.records.has(`${root}/deletionDiagnostics/legacy-pure`), false);
  assert.deepEqual(db.records.get(`${root}/suppressedMessages/${suppressionKey('message', 'legacy-pure')}`), { version: 1 });
  await store.excludeDraft('prior-mail', NOW, { current: false });
  assert.deepEqual(db.records.get(`${root}/messages/prior-mail`), prior);
  await store.excludeDraft('prior-mail', NOW);
  const conflict = db.records.get(`${root}/messages/prior-mail`);
  assert.equal(conflict.matchState, 'pending'); assert.equal(conflict.caseId, null);
  assert.equal(conflict.reason, 'current_draft_conflict'); assert.equal(conflict.unavailable, true);
  assert.deepEqual(conflict.firstReview, prior.firstReview);
  assert.deepEqual(db.records.get(`${root}/receipts/kept-request`), { result: { message: prior } });
  assert.equal(db.records.has(`${root}/suppressedMessages/${suppressionKey('message', 'prior-mail')}`), false);
  assert.equal(db.records.get(`${root}/events/generated`).previous.caseId, A);
  assert(db.records.has(`${root}/caseCoverage/${A}`));
  await store.upsertIndexedMessage({ ...prior, sourceKind: 'mail', indexedAt: NOW, reason: 'body_id' });
  assert.deepEqual(db.records.get(`${root}/messages/prior-mail`), conflict);
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
  assert.equal(await f.store.getMessage('proven-draft'), null);
  assert.equal(await f.store.isMessageSuppressed('proven-draft'), true);
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
  await f.store.setSyncState({ state: 'failed', startAt: START, cutoffAt: NOW, executionId: 'run', failedMessageIds: failedIds, failedCount: failedIds.length }, lease);
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
  await setIssuePeriod(f);
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

test('cached Gmail attachment chunks still verify message and scope on every request', async () => {
  const f = fixture([A]); let reads = 0;
  const bytes = Buffer.alloc(512 * 1024 + 1, 7);
  const message = gmailMessage('cached', 'body', [], { bytes, mimeType: 'application/octet-stream', name: 'cached.bin' });
  message.payload.parts[1].body = { size: bytes.length, attachmentId: 'external' };
  f.messages.set('cached', message);
  f.store.seed(record('cached', { attachmentCount: 1, unverifiedAttachmentCount: 1,
    attachments: [{ partId: '0.1', name: 'cached.bin', mimeType: 'application/octet-stream', size: bytes.length, availability: 'unverified' }] }));
  const adapter = await createGmailAdapter({ secretVersion: 'projects/test/secrets/mail/versions/1',
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })) } }]; } },
    createOAuthClient: () => ({ setCredentials() {}, async getAccessToken() { return { token: 'opaque' }; },
      async getTokenInfo() { return { scopes: ['https://www.googleapis.com/auth/gmail.readonly'] }; } }),
    fetchImpl: async (url) => ({ ok: true, async json() {
      if (String(url).endsWith('/profile')) return { emailAddress: 'customer@speed-ad.com' };
      reads++; return { size: bytes.length, data: bytes.toString('base64url') };
    } })
  });
  f.gmail.getAttachment = adapter.getAttachment.bind(adapter);
  const read = (offset, changes = {}) => f.execute(f.envelope('getAttachmentChunk', { scope: 'case', caseId: A, messageId: 'cached', partId: '0.1', offset, ...changes }));
  assert.equal((await read(0)).reviewReady, false);
  assert.equal((await read(512 * 1024)).reviewReady, true);
  assert.equal(reads, 1); assert.equal(f.calls.length, 2);
  await assert.rejects(() => read(0, { caseId: B }), { code: 'MAIL_MAPPING_CHANGED' });
  f.messages.get('cached').labelIds = ['DRAFT'];
  await assert.rejects(() => read(0), { code: 'MAIL_MAPPING_CHANGED' });
  assert.equal(reads, 1);
  f.store.seed(record('cached', { attachmentCount: 1, attachments: [{ partId: '0.1', availability: 'unverified' }] }));
  f.messages.delete('cached');
  await assert.rejects(() => read(0), { code: 'MAIL_CONTENT_UNAVAILABLE' });
});

test('temporary attachment busy does not record unavailable or allow review', async () => {
  const f = fixture([A]); const bytes = Buffer.from('file');
  const message = gmailMessage('busy', 'body', [], { bytes, name: 'file.txt' });
  message.payload.parts[1].body = { size: bytes.length, attachmentId: 'busy' };
  f.messages.set('busy', message);
  f.store.seed(record('busy', { attachmentCount: 1, unverifiedAttachmentCount: 1,
    attachments: [{ partId: '0.1', name: 'file.txt', mimeType: 'text/plain', size: bytes.length, availability: 'unverified' }] }));
  f.gmail.getAttachment = async () => { throw new MailError('MAIL_ATTACHMENT_BUSY', 503); };
  await assert.rejects(() => f.execute(f.envelope('getAttachmentChunk', { scope: 'case', caseId: A, messageId: 'busy', partId: '0.1', offset: 0 })), { code: 'MAIL_ATTACHMENT_BUSY' });
  assert.equal((await f.store.getMessage('busy')).attachments[0].availability, 'unverified');
  await assert.rejects(() => f.execute(f.envelope('markReviewed', { scope: 'case', caseId: A, messageId: 'busy', expectedVersion: 1 })), { code: 'MAIL_CONTENT_UNAVAILABLE' });
});


test('closure metadata changes the immutable catalog and unknown or expired cases remain residuals', async () => {
  const f = fixture([A, B]);
  await setIssuePeriod(f);
  const cases = [{ caseId: A, handledStatus: '対応済み', closedAt: null }, { caseId: B, handledStatus: '対応済み', closedAt: '2023-11-10T09:00:00.000Z' }];
  assert.notEqual(catalogDigest(cases), catalogDigest(caseEntries([A, B])));
  const snapshotId = randomUUID();
  const page = { snapshotId, pageIndex: 0, pageCount: 1, total: 2, digest: catalogDigest(cases), cases };
  await f.execute(f.envelope('uploadCaseCatalog', page));
  assert.deepEqual((await f.store.getCatalog()).cases, cases);
  await assert.rejects(() => f.execute(f.envelope('uploadCaseCatalog', { ...page, cases: caseEntries([A, B]) })), { code: 'MAIL_REQUEST_CONFLICT' });
  const status = (await f.execute(f.envelope('getSyncStatus'))).sync;
  assert.equal(status.unknownClosureCaseCount, 1); assert.equal(status.expiredCaseCount, 1); assert.equal(status.acceptanceReady, false);
  const unknown = await f.execute(f.envelope('listMailIssues', { kind: 'unknownClosure' }));
  const expired = await f.execute(f.envelope('listMailIssues', { kind: 'expiredRetention' }));
  assert.deepEqual(unknown.targets, [{ type: 'case', caseId: A }]);
  assert.deepEqual(expired.targets, [{ type: 'case', caseId: B }]);
  await assert.rejects(() => f.execute(f.envelope('listCaseMail', { caseId: B })), { code: 'MAIL_RETENTION_EXPIRED' });
  await assert.rejects(() => f.execute(f.envelope('uploadCaseCatalog', { ...page, cases: undefined, caseIds: [A, B] })), { code: 'MAIL_INVALID_REQUEST' });
});

test('expired case mail is never newly indexed or manually confirmed and old direct content is blocked', async () => {
  const f = fixture([A]);
  f.store.setCatalog({ complete: true, caseIds: [A], cases: [{ caseId: A, handledStatus: '対応済み', closedAt: '2023-01-01T00:00:00.000Z' }] });
  f.messages.set('expired', gmailMessage('expired'));
  const execute = createMailService({ store: f.store, gmail: f.gmail, core, now: () => new Date(NOW), trustedAnchor: () => true });
  await assert.rejects(() => execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full' })), { code: 'MAIL_RETENTION_EXPIRED' });
  assert.equal((await execute(f.envelope('getSyncStatus'))).sync.state, 'failed');
  assert.equal(f.store.records.has('expired'), false);
  f.store.seed(record('old')); f.messages.set('old', gmailMessage('old'));
  for (const operation of ['getMail', 'getAttachmentChunk', 'markReviewed']) {
    await assert.rejects(() => execute(f.envelope(operation, { scope: 'case', caseId: A, messageId: 'old', partId: '0.1', expectedVersion: 1 })), { code: 'MAIL_RETENTION_EXPIRED' });
  }
  f.store.seed(record('pending', { matchState: 'pending', caseId: null }));
  await assert.rejects(() => execute(f.envelope('resolvePending', { messageId: 'pending', action: 'match', caseId: A, expectedVersion: 1, reason: 'confirmed' })), { code: 'MAIL_RETENTION_EXPIRED' });
  assert.equal(f.store.events.length, 0);
});


test('Firestore catalog read requires complete closure metadata and verifies its immutable digest', async () => {
  const cases = caseEntries([A, B]);
  let page = { cases };
  const metadata = { snapshotId: 'snapshot', total: 2, digest: catalogDigest(cases) };
  const node = (path = '') => ({
    collection(name) { return node(`${path}/${name}`); }, doc(name) { return node(`${path}/${name}`); }, orderBy() { return this; },
    async get() { return path.endsWith('/suppressedCases') ? { docs: [] } : path.endsWith('/pages') ? { docs: [{ data: () => page }] } : { exists: true, data: () => metadata }; }
  });
  const store = createFirestoreStore(node());
  assert.deepEqual((await store.getCatalog()).cases, cases);
  page = { caseIds: [A, B] };
  await assert.rejects(() => store.getCatalog(), { code: 'MAIL_CATALOG_INVALID' });
  page = { cases: [{ ...cases[0], handledStatus: '対応済み', closedAt: null }, cases[1]] };
  await assert.rejects(() => store.getCatalog(), { code: 'MAIL_CATALOG_INVALID' });
});


test('catalog changes between preflight and commit reject review and indexing atomically', async () => {
  const f = fixture([A]);
  const first = { complete: true, cases: caseEntries([A]), caseIds: [A], digest: 'a'.repeat(64) };
  f.store.setCatalog(first); f.store.seed(record('review'));
  const mutate = f.store.mutate;
  f.store.mutate = (...args) => { f.store.setCatalog({ ...first, digest: 'b'.repeat(64) }); return mutate(...args); };
  await assert.rejects(() => f.execute(f.envelope('markReviewed', { messageId: 'review', scope: 'case', caseId: A, expectedVersion: 1 })), { code: 'MAIL_CATALOG_CHANGED' });
  assert.equal(f.store.records.get('review').firstReview, null); assert.equal(f.store.receipts.size, 0);
  f.store.setCatalog(first); f.messages.set('indexed', gmailMessage('indexed'));
  const upsert = f.store.upsertIndexedMessage;
  f.store.upsertIndexedMessage = (...args) => { f.store.setCatalog({ ...first, digest: 'c'.repeat(64) }); return upsert(...args); };
  await assert.rejects(() => f.execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full' })), { code: 'MAIL_CATALOG_CHANGED' });
  assert.equal(f.store.records.has('indexed'), false);
});

test('Firestore transactions reject stale catalog digest before any record write', async () => {
  const node = (path = '') => ({ path, collection(name) { return node(`${path}/${name}`); }, doc(name) { return node(`${path}/${name}`); } });
  let writes = 0;
  const db = { ...node(), async runTransaction(fn) { return fn({
    async get(ref) { return { exists: !ref.path.includes('/suppressed'), data: () => ref.path.endsWith('/activeCatalog') ? { digest: 'new' } : { startAt: START } }; },
    set() { writes++; }, update() { writes++; }, delete() { writes++; }
  }); } };
  const store = createFirestoreStore(db);
  await assert.rejects(() => store.mutate('request', 'fingerprint', () => { throw new Error('must not run'); }, START, 'old'), { code: 'MAIL_CATALOG_CHANGED' });
  await assert.rejects(() => store.upsertIndexedMessage(record('new'), 'old'), { code: 'MAIL_CATALOG_CHANGED' });
  assert.equal(writes, 0);
});


test('review rechecks expiry in the exact catalog pinned for its transaction', async () => {
  const f = fixture([A]); f.store.seed(record('review'));
  const original = await f.store.getCatalog(); let reads = 0;
  f.store.getCatalog = async () => ++reads === 1 ? original : { complete: true, caseIds: [A], digest: 'changed',
    cases: [{ caseId: A, handledStatus: '対応済み', closedAt: '2020-01-01T00:00:00.000Z' }] };
  await assert.rejects(() => f.execute(f.envelope('markReviewed', { messageId: 'review', scope: 'case', caseId: A, expectedVersion: 1 })), { code: 'MAIL_RETENTION_EXPIRED' });
  assert.equal(f.store.records.get('review').firstReview, null); assert.equal(f.store.receipts.size, 0);
});


test('a catalog removed during sync cannot authorize an old match or expose its existing mail', async () => {
  const f = fixture([A]);
  const first = { complete: true, cases: caseEntries([A]), caseIds: [A], digest: catalogDigest(caseEntries([A])) };
  const second = { complete: true, cases: caseEntries([B]), caseIds: [B], digest: catalogDigest(caseEntries([B])) };
  f.store.setCatalog(first);
  f.messages.set('removed', gmailMessage('removed'));
  const getMessage = f.gmail.getMessage;
  f.gmail.getMessage = async (id) => { const mail = await getMessage(id); f.store.setCatalog(second); return mail; };
  const execute = createMailService({ store: f.store, gmail: f.gmail, core, now: () => new Date(NOW), trustedAnchor: () => true });
  await assert.rejects(execute(f.envelope('advanceSync', { executionId: randomUUID(), mode: 'full' })), { code: 'MAIL_CATALOG_CHANGED' });
  assert.equal(f.store.records.has('removed'), false);
  f.store.seed(record('old-removed'));
  for (const operation of ['getMail', 'markReviewed']) await assert.rejects(execute(f.envelope(operation,
    { scope: 'case', caseId: A, messageId: 'old-removed', expectedVersion: 1 })), { code: 'MAIL_CASE_NOT_FOUND' });
});

test('Firestore final merged manual record cannot restore an expired or removed case', async () => {
  const root = 'contactMailboxes/customer-speed-ad';
  for (const removed of [false, true]) {
    const cases = removed ? caseEntries([B]) : [{ caseId: A, handledStatus: '対応済み', closedAt: '2020-01-01T00:00:00.000Z' }];
    const catalog = { complete: true, cases, caseIds: cases.map((item) => item.caseId), digest: catalogDigest(cases) };
    const original = record('manual-old', { manualClassification: true, reason: 'manual', firstReview: { email: 'reviewer@abroad-o.com', at: NOW } });
    const db = memoryFirestore({ [`${root}/meta/activeCatalog`]: { digest: catalog.digest }, [`${root}/messages/manual-old`]: original });
    const before = JSON.stringify([...db.records]);
    await assert.rejects(createFirestoreStore(db).upsertIndexedMessage(record('manual-old', { matchState: 'pending', caseId: null }), catalog.digest,
      retentionPolicy(catalog, new Date(NOW))), { code: removed ? 'MAIL_CASE_NOT_FOUND' : 'MAIL_RETENTION_EXPIRED' });
    assert.equal(JSON.stringify([...db.records]), before);
  }
});

test('expired metadata is hidden in cross-case and failed lists while empty pages retain navigation', async () => {
  const f = fixture([A, B]);
  await setIssuePeriod(f);
  const cases = [{ caseId: A, handledStatus: '対応済み', closedAt: '2020-01-01T00:00:00.000Z' }, ...caseEntries([B])];
  f.store.setCatalog({ complete: true, cases, caseIds: [A, B], digest: catalogDigest(cases) });
  for (let index = 0; index < 50; index++) f.store.seed(record(`expired-${String(index).padStart(3, '0')}`));
  f.store.seed(record('visible', { caseId: B, internalDate: '2026-11-09T00:00:00.000Z' }));
  const page = await f.execute(f.envelope('listUnreviewedMail'));
  assert.deepEqual(page.messages, []); assert(page.page.nextPageToken);
  assert.deepEqual((await f.execute(f.envelope('listUnreviewedMail', { pageToken: page.page.nextPageToken }))).messages.map((item) => item.messageId), ['visible']);
  const issues = await f.execute(f.envelope('listMailIssues', { kind: 'unreviewed' }));
  assert.deepEqual(issues.targets, []); assert(issues.page.nextPageToken);
  assert.equal((await f.execute(f.envelope('listMailIssues', { kind: 'unreviewed', pageToken: issues.page.nextPageToken }))).targets[0].messageId, 'visible');
  const state = await f.store.getSyncState();
  const lease = await f.store.acquireSyncLease('test');
  await f.store.setSyncState({ ...state, state: 'failed', failedMessageIds: ['expired-000'] }, lease);
  const failed = await f.execute(f.envelope('listMailIssues', { kind: 'failed' }));
  assert.equal(failed.targets[0].message, null);
});


test('purged cases show a deletion result and no longer remain coverage or retention residuals', async () => {
  const f = fixture([A]);
  f.store.setCatalog({ complete: true, caseIds: [], suppressedCaseIds: [A],
    cases: [{ caseId: A, handledStatus: '対応済み', closedAt: '2020-01-01T00:00:00.000Z' }] });
  const status = (await f.execute(f.envelope('getSyncStatus'))).sync;
  assert.equal(status.expiredCaseCount, 0); assert.equal(status.coverageUnverifiedCaseCount, 0);
  await assert.rejects(f.execute(f.envelope('listCaseMail', { caseId: A })), { code: 'MAIL_RECORDS_DELETED' });
});
