import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../99_backend-docs/10_support-contact/viewer-workspace-gas/', import.meta.url);
const bridge = readFileSync(new URL('MailBridge.gs', root), 'utf8');
const html = readFileSync(new URL('Index.html', root), 'utf8');
const caseId = '11111111-1111-4111-8111-111111111111';

test('mail service exposes only the authenticated business RPC surface', () => {
  const actual = [...bridge.matchAll(/^function ([a-zA-Z0-9_]+)\(/gm)].map((match) => match[1]).filter((name) => !name.endsWith('_')).sort();
  assert.deepEqual(actual, ['listContactMail', 'getContactMailMessage', 'getContactMailAttachmentChunk', 'markContactMailReviewed', 'resolveContactMailPending', 'getContactMailSyncStatus', 'reconcileContactMailPending', 'advanceContactMailSync', 'listContactMailIssues'].sort());
});

function bridgeRuntime({ actor = { email: 'reader@abroad-o.com', authMode: 'domain' }, ids = [caseId], dates, url = 'https://contact-mail-example.a.run.app' } = {}) {
  const calls = [];
  const reads = [];
  let response = () => ({ ok: true });
  const context = {
    requireViewer_() { if (!actor) throw new Error('権限がありません'); return actor; },
    findSubmission_(id) { reads.push(id); return ids.includes(id) ? { record: { submission_id: id } } : null; },
    getProperty_: () => url,
    getSheet_: () => ({ getDataRange: () => ({ getValues: () => [dates ? ['submission_id', 'submitted_at'] : ['submission_id'], ...ids.map((id, index) => dates ? [id, dates[index]] : [id])] }) }),
    ensureHeaders_: () => dates ? ['submission_id', 'submitted_at'] : ['submission_id'],
    ScriptApp: { getIdentityToken: () => 'server-only-google-identity-token' },
    Utilities: { getUuid: randomUUID, Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'SHA-256' }, computeDigest: (_kind, text) => [...createHash('sha256').update(text).digest()] },
    UrlFetchApp: { fetch(target, options) {
      const envelope = JSON.parse(options.payload);
      calls.push({ target, options, envelope });
      const value = response(envelope);
      return { getResponseCode: () => value.status || 200, getContentText: () => value.raw || JSON.stringify(value.body || value) };
    } },
  };
  vm.createContext(context);
  vm.runInContext(bridge, context, { filename: 'MailBridge.gs' });
  return { api: context, calls, reads, respond(fn) { response = fn; }, setActor(value) { actor = value; } };
}

test('every mail RPC authorizes before Sheet or service access', () => {
  const app = bridgeRuntime({ actor: null });
  for (const [name, args] of [
    ['listContactMail', [{ scope: 'case', caseId }]], ['getContactMailMessage', [{ scope: 'case', caseId, messageId: 'mail1' }]],
    ['getContactMailAttachmentChunk', [{ scope: 'case', caseId, messageId: 'mail1', partId: '0.1', offset: 0 }]],
    ['markContactMailReviewed', [{ scope: 'case', caseId, messageId: 'mail1', expectedVersion: 1 }]],
    ['resolveContactMailPending', [{ messageId: 'mail1', action: 'match', caseId, expectedVersion: 1, reason: '受付IDを確認' }]],
    ['getContactMailSyncStatus', []], ['advanceContactMailSync', [{}]], ['reconcileContactMailPending', [{}]], ['listContactMailIssues', [{ kind: 'failed' }]],
  ]) assert.throws(() => app.api[name](...args), /権限/);
  assert.equal(app.calls.length, 0);
  assert.equal(app.reads.length, 0);
});

test('mail bridge sends only server-verified actor to a fixed TLS endpoint', () => {
  const app = bridgeRuntime();
  const result = app.api.listContactMail({ scope: 'case', caseId, pageToken: '', actor: { email: 'spoof@example.com' }, url: 'https://evil.example' });
  assert.equal(result.ok, true);
  const call = app.calls[0];
  assert.equal(call.target, 'https://contact-mail-example.a.run.app/rpc');
  assert.equal(call.envelope.operation, 'listCaseMail');
  assert.deepEqual(call.envelope.actor, { email: 'reader@abroad-o.com', authMode: 'domain' });
  assert.deepEqual(call.envelope.payload, { scope: 'case', caseId, pageToken: '' });
  assert.equal(call.options.followRedirects, false);
  assert.equal(call.options.validateHttpsCertificates, true);
  assert.equal(call.options.headers.Authorization, 'Bearer server-only-google-identity-token');
  assert.doesNotMatch(JSON.stringify(result), /identity-token|spoof|evil/);
  app.setActor({ email: 'customer@speed-ad.com', authMode: 'google-oauth' });
  app.api.listContactMail({ scope: 'pending' });
  assert.equal(app.calls.at(-1).envelope.actor.authMode, 'customer-oauth');
});

test('mail configuration failures never look like a valid empty mailbox', () => {
  for (const url of ['', 'http://contact.run.app', 'https://evil.example', 'https://contact.run.app/path', 'https://contact.run.app?token=secret', 'https://contact.run.app:443']) {
    const app = bridgeRuntime({ url });
    assert.equal(app.api.getContactMailSyncStatus().error.code, 'MAIL_NOT_CONFIGURED');
    assert.equal(app.calls.length, 0);
  }
});

test('case/message/part/version validation stops invalid service operations', () => {
  const app = bridgeRuntime();
  assert.throws(() => app.api.listContactMail({ scope: 'case', caseId: 'missing' }), /見つかりません/);
  assert.throws(() => app.api.getContactMailMessage({ scope: 'case', caseId, messageId: '../other' }), /指定/);
  assert.throws(() => app.api.getContactMailAttachmentChunk({ scope: 'case', caseId, messageId: 'mail1', partId: '0/other', offset: 0 }), /添付/);
  assert.throws(() => app.api.getContactMailAttachmentChunk({ scope: 'case', caseId, messageId: 'mail1', partId: '0.1', offset: -1 }), /取得位置/);
  assert.throws(() => app.api.markContactMailReviewed({ scope: 'pending', messageId: 'mail1', expectedVersion: 1 }), /確定/);
  assert.throws(() => app.api.markContactMailReviewed({ scope: 'case', caseId, messageId: 'mail1', expectedVersion: 0 }), /版/);
  assert.throws(() => app.api.resolveContactMailPending({ messageId: 'mail1', action: 'exclude', expectedVersion: 1, reason: '' }), /入力/);
  assert.equal(app.calls.length, 0);
});

test('review and classification retain request identity and never accept caller actor', () => {
  const app = bridgeRuntime();
  const requestId = randomUUID();
  app.api.markContactMailReviewed({ scope: 'case', caseId, messageId: 'mail1', expectedVersion: 3, requestId, actor: 'spoof' });
  assert.equal(app.calls[0].envelope.requestId, requestId);
  assert.deepEqual(app.calls[0].envelope.payload, { scope: 'case', caseId, messageId: 'mail1', expectedVersion: 3 });
  app.api.resolveContactMailPending({ messageId: 'mail1', action: 'match', caseId, expectedVersion: 3, reason: '本文の受付IDを確認', requestId: randomUUID() });
  assert.equal(app.calls[1].envelope.payload.reason, '本文の受付IDを確認');
  assert.equal(app.calls[1].envelope.operation, 'resolvePending');
  assert.doesNotMatch(bridge, /setValue|handled_status|handled_by|handled_at|internal_note/);
});

test('service errors expose fixed codes without upstream bodies or secrets', () => {
  const app = bridgeRuntime();
  app.respond(() => ({ status: 409, body: { ok: false, error: { code: 'MAIL_MAPPING_CHANGED', message: 'secret upstream body' } } }));
  assert.deepEqual(JSON.parse(JSON.stringify(app.api.getContactMailSyncStatus())), { ok: false, error: { code: 'MAIL_MAPPING_CHANGED' } });
  app.respond(() => ({ status: 500, raw: 'secret server body' }));
  assert.equal(app.api.getContactMailSyncStatus().error.code, 'MAIL_SERVICE_UNAVAILABLE');
  app.respond(() => ({ status: 302, raw: 'secret redirect' }));
  assert.equal(app.api.getContactMailSyncStatus().error.code, 'MAIL_SERVICE_UNAVAILABLE');
  app.respond(() => ({ body: { ok: false, error: { code: 'token=secret' } } }));
  assert.equal(app.api.getContactMailSyncStatus().error.code, 'MAIL_SERVICE_UNAVAILABLE');
});

test('mail bridge retains allowlisted runtime 403 errors but hides IAM response bodies', () => {
  const app = bridgeRuntime();
  for (const code of ['MAIL_SCOPE_MISMATCH', 'MAIL_MAILBOX_MISMATCH', 'MAIL_FORBIDDEN']) {
    app.respond(() => ({ status: 403, body: { ok: false, error: { code, message: 'token=private' } } }));
    assert.deepEqual(JSON.parse(JSON.stringify(app.api.getContactMailSyncStatus())), { ok: false, error: { code } });
  }
  app.respond(() => ({ status: 403, raw: '<html>private IAM explanation</html>' }));
  assert.equal(app.api.getContactMailSyncStatus().error.code, 'MAIL_SERVICE_AUTH');
});

test('residual RPC validates kind and uses only verified actor', () => {
  const app = bridgeRuntime();
  app.api.listContactMailIssues({ kind: 'attachmentUnavailable', pageToken: 'next', actor: 'spoof' });
  assert.equal(app.calls[0].envelope.operation, 'listMailIssues');
  assert.deepEqual(app.calls[0].envelope.payload, { kind: 'attachmentUnavailable', pageToken: 'next' });
  assert.equal(app.calls[0].envelope.actor.email, 'reader@abroad-o.com');
  assert.throws(() => app.api.listContactMailIssues({ kind: 'allSecretData' }), /表示対象/);
});

test('catalog is authoritative, stable and bounded beyond 200 cases', () => {
  const ids = Array.from({ length: 1201 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
  const app = bridgeRuntime({ ids: ids.slice().reverse() });
  app.respond((envelope) => ({ ok: true, catalog: { complete: envelope.payload.pageIndex === envelope.payload.pageCount - 1 } }));
  const first = app.api.advanceContactMailSync({ caseIds: ['untrusted'] });
  assert.equal(first.catalog.complete, false);
  assert.equal(first.catalog.nextPageIndex, 5);
  assert.equal(app.calls.length, 5);
  assert.ok(app.calls.every((call) => call.envelope.payload.caseIds.length === 200));
  const second = app.api.advanceContactMailSync({ catalog: first.catalog });
  assert.equal(second.catalog.complete, true);
  assert.equal(app.calls.length, 7);
  assert.deepEqual(app.calls.flatMap((call) => call.envelope.payload.caseIds), ids);
  assert.equal(first.catalog.digest, createHash('sha256').update(ids.join('\n')).digest('hex'));
  assert.doesNotMatch(JSON.stringify(first), /caseIds|untrusted/);
  assert.ok(app.calls.every((call) => call.envelope.payload.snapshotId === first.catalog.snapshotId));
  const count = app.calls.length;
  assert.equal(app.api.advanceContactMailSync({ catalog: { ...first.catalog, digest: 'changed' } }).error.code, 'CONFLICT');
  assert.equal(app.calls.length, count);
});

test('only domain users can upload catalog or advance a bounded sync', () => {
  const app = bridgeRuntime({ actor: { email: 'customer@speed-ad.com', authMode: 'google-oauth' } });
  assert.throws(() => app.api.advanceContactMailSync({}), /権限/);
  assert.equal(app.calls.length, 0);
  app.setActor({ email: 'reader@abroad-o.com', authMode: 'domain' });
  app.respond(() => ({ ok: true, catalog: { complete: true } }));
  const catalog = app.api.advanceContactMailSync({}).catalog;
  app.calls.length = 0;
  const executionId = randomUUID();
  app.api.advanceContactMailSync({ executionId, mode: 'full', catalogSnapshotId: catalog.snapshotId, catalogDigest: catalog.digest, requestId: randomUUID() });
  assert.deepEqual(app.calls[0].envelope.payload, { executionId, mode: 'full', catalogSnapshotId: catalog.snapshotId, catalogDigest: catalog.digest });
});

test('full sync period comes from earliest authoritative date with whole-mailbox fallback', () => {
  for (const [date, expected] of [['2026-11-10T04:00:00Z', '2026-11-08T15:00:00.000Z'], [new Date('2026-11-10T23:00:00Z'), '2026-11-09T15:00:00.000Z'], ['', null], ['invalid', null], ['2026-02-30T00:00:00Z', null]]) {
    const app = bridgeRuntime({ dates: [date] });
    app.respond(() => ({ ok: true, catalog: { complete: true } }));
    const catalog = app.api.advanceContactMailSync({}).catalog;
    assert.equal(catalog.startAt, expected);
    app.api.advanceContactMailSync({ executionId: randomUUID(), mode: 'full', catalogSnapshotId: catalog.snapshotId, catalogDigest: catalog.digest, startAt: '2099-01-01T00:00:00Z' });
    assert.equal(app.calls.at(-1).envelope.payload.startAt || null, expected);
  }
});

const summary = (messageId = 'mail1', extra = {}) => ({ messageId, threadId: 'thread1', caseId, matchState: 'matched', version: 1, internalDate: '2026-11-10T00:00:00Z', subject: '件名', from: 'sender@example.com', to: 'customer@speed-ad.com', direction: 'received', attachmentCount: 0, firstReview: null, unavailable: false, ...extra });
const detail = (messageId = 'mail1', extra = {}) => ({ ...summary(messageId), bodyText: '本文', bodyAvailability: 'verified', reviewReady: true, attachments: [], ...extra });
const sync = { state: 'complete', lastSuccessAt: '2026-11-10T00:00:00Z', pendingCount: 0, failedCount: 0, unavailableCount: 0, remainingPages: false, bodyUnverifiedCount: 1, bodyUnavailableCount: 0, attachmentUnverifiedCount: 0, attachmentUnavailableCount: 0, acceptanceReady: false };
const list = (messages, page = {}) => ({ ok: true, messages, page: { nextPageToken: '', previousPageToken: '', pageSize: 50, ...page }, sync });

function uiRuntime(handlers = {}) {
  const elements = new Map();
  const calls = [];
  const revoked = [];
  let blobIndex = 0;
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      id, value: '', hidden: false, innerHTML: '', textContent: '', disabled: false, isConnected: true, children: [], dataset: {}, listeners: new Map(),
      classList: { add() {}, remove() {} }, options: [],
      addEventListener(name, fn) { this.listeners.set(name, fn); }, setAttribute() {}, removeAttribute() {}, focus() {},
      querySelector(selector) { return element(`${id}:${selector}`); }, querySelectorAll() { return []; }, appendChild(child) { this.children.push(child); },
    });
    return elements.get(id);
  }
  const run = { withSuccessHandler(success) { return { withFailureHandler(failure) { return new Proxy({}, { get(_target, name) { return (...args) => {
    calls.push({ name, args });
    Promise.resolve().then(() => handlers[name] ? handlers[name](...args) : { ok: false, error: { code: 'MAIL_NOT_CONFIGURED' } }).then(success, failure);
  }; } }); } }; } };
  class TestURL extends URL { static createObjectURL() { return `blob:test-${++blobIndex}`; } static revokeObjectURL(url) { revoked.push(url); } }
  const context = {
    window: { CONTACT_VIEWER_INITIAL_ID: '', CONTACT_VIEWER_CONTEXT: { allowed: true, email: 'reader@abroad-o.com', authMode: 'domain' }, sessionStorage: { getItem: () => '' }, crypto: webcrypto, confirm: () => true },
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {}, createElement: (tag) => element(`${tag}-${randomUUID()}`) },
    google: { script: { run } }, URL: TestURL, URLSearchParams, Blob, Uint8Array, atob,
  };
  vm.createContext(context);
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1].replace('    bootstrapViewer();', '');
  vm.runInContext(script, context, { filename: 'Index.html' });
  return { ui: context, calls, elements, element, revoked, mail: vm.runInContext('contactMailState', context), state: vm.runInContext('state', context) };
}

test('mail UI navigates individual messages across page boundaries and renders text safely', async () => {
  const app = uiRuntime({
    listContactMail: (options) => options.pageToken === 'next' ? list([summary('mail3')], { previousPageToken: 'previous' }) : list([summary('mail1'), summary('mail2')], { nextPageToken: 'next' }),
    getContactMailMessage: (options) => ({ ok: true, message: detail(options.messageId, { bodyText: '<script>bad()</script> https://old.example/#token=secret' }) }),
  });
  await app.ui.loadContactMailList('case', { caseId });
  assert.equal(app.mail.case.message.messageId, 'mail1');
  await app.ui.moveContactMail('case', 1);
  assert.equal(app.mail.case.message.messageId, 'mail2');
  await app.ui.moveContactMail('case', 1);
  assert.equal(app.mail.case.message.messageId, 'mail3');
  await app.ui.moveContactMail('case', -1);
  assert.equal(app.mail.case.message.messageId, 'mail2');
  const markup = app.element('caseMailSection').innerHTML;
  assert.match(markup, /&lt;script&gt;/);
  assert.doesNotMatch(markup, /<script>|token=secret/);
  assert.match(markup, /本文未検証 1件/);
  assert.match(markup, /全件確認に必要な処理が残っています/);
});

test('unconfigured or malformed mail responses never render as zero results', async () => {
  const app = uiRuntime();
  await app.ui.loadContactMailList('case', { caseId });
  assert.equal(app.mail.case.status, 'failed');
  assert.match(app.element('caseMailSection').innerHTML, /未設定/);
  assert.doesNotMatch(app.element('caseMailSection').innerHTML, /メールは0件/);
  const bad = uiRuntime({ listContactMail: () => ({ ok: true, messages: [] }) });
  await bad.ui.loadContactMailList('case', { caseId });
  assert.equal(bad.mail.case.status, 'failed');
});

test('newer mail list and auth loss invalidate late protected responses', async () => {
  let resolveOld;
  const app = uiRuntime({ listContactMail: (options) => options.caseId === caseId ? new Promise((resolve) => { resolveOld = resolve; }) : list([]) });
  const old = app.ui.loadContactMailList('case', { caseId });
  await Promise.resolve();
  await app.ui.loadContactMailList('case', { caseId: '22222222-2222-4222-8222-222222222222' });
  resolveOld(list([summary()]));
  await old;
  assert.equal(app.mail.case.messages.length, 0);
  app.mail.case.urls.push('blob:protected');
  app.ui.showDenied('認証失効');
  assert.equal(app.element('caseMailSection').innerHTML, '');
  assert.ok(app.revoked.includes('blob:protected'));
  assert.equal(app.element('mailQueueModal').hidden, true);
});

test('explicit review retries preserve request ID and never mutate case status', async () => {
  let attempts = 0;
  const app = uiRuntime({
    listContactMail: () => list([summary()]), getContactMailMessage: () => ({ ok: true, message: detail() }),
    markContactMailReviewed: () => ++attempts === 1 ? { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } } : { ok: true, message: summary('mail1', { firstReview: { email: 'reader@abroad-o.com', at: '2026-11-10T01:00:00Z' } }) },
  });
  app.state.detail = { submission_id: caseId, handled_status: '対応済み', internal_note: '保持' };
  await app.ui.loadContactMailList('case', { caseId });
  await app.ui.writeContactMail('case', 'review');
  await app.ui.writeContactMail('case', 'review');
  const writes = app.calls.filter((call) => call.name === 'markContactMailReviewed');
  assert.equal(writes[0].args[0].requestId, writes[1].args[0].requestId);
  assert.equal(app.mail.case.message.firstReview.email, 'reader@abroad-o.com');
  assert.equal(app.state.detail.handled_status, '対応済み');
  assert.equal(app.state.detail.internal_note, '保持');
  assert.ok(!app.calls.some((call) => call.name === 'updateContactSubmissionStatus'));
});

test('pending classification sends explicit reason, case and expected version', async () => {
  let resolved = false;
  const pending = summary('mail1', { caseId: null, matchState: 'pending', version: 4 });
  const app = uiRuntime({
    listContactMail: () => list(resolved ? [] : [pending]), getContactMailMessage: () => ({ ok: true, message: { ...pending, bodyText: '受付IDを確認', attachments: [] } }),
    resolveContactMailPending: () => { resolved = true; return { ok: true, message: summary('mail1', { version: 5 }) }; },
  });
  app.mail.queue.scope = 'pending';
  await app.ui.loadContactMailList('queue');
  app.element('mailQueueContent:[data-mail-case-id]').value = caseId;
  app.element('mailQueueContent:[data-mail-reason]').value = '本文と受付データを照合した';
  await app.ui.writeContactMail('queue', 'match');
  const call = app.calls.find((item) => item.name === 'resolveContactMailPending');
  assert.equal(call.args[0].caseId, caseId);
  assert.equal(call.args[0].expectedVersion, 4);
  assert.equal(call.args[0].reason, '本文と受付データを照合した');
  assert.equal(app.mail.queue.messages.length, 0);
});

test('attachment chunks validate ownership/offset and assemble safe text preview', async () => {
  const app = uiRuntime({ getContactMailAttachmentChunk: (options) => ({ ok: true, attachment: { partId: '0.1', name: 'note.txt', mimeType: 'text/plain', previewKind: 'text', availability: 'verified' }, reviewReady: true, offset: options.offset, nextOffset: 3, totalSize: 3, dataBase64: 'YWJj', done: true }) });
  app.mail.case.caseId = caseId;
  app.mail.case.message = detail('mail1', { attachments: [{ partId: '0.1', name: 'note.txt', mimeType: 'text/plain', size: 3 }] });
  const parent = app.element('attachment-parent');
  const button = app.element('attachment-button'); button.parentElement = parent;
  await app.ui.loadContactMailAttachment('case', '0.1', button);
  const panel = parent.querySelector('[data-mail-attachment-preview]');
  assert.match(panel.innerHTML, /download="note.txt"/);
  assert.equal(panel.children.at(-1).textContent, 'abc');
  assert.equal(app.mail.case.urls.length, 1);
  assert.equal(app.mail.case.message.attachments[0].availability, 'verified');
  assert.equal(app.mail.case.message.reviewReady, true);
  assert.throws(() => app.ui.validateContactMailChunk({ ok: true, attachment: { partId: '0.2' }, offset: 0 }, 0, '0.1'), /MAIL_INVALID_RESPONSE/);
  app.ui.clearContactMailView('case');
  assert.equal(app.revoked.length, 1);
});

test('mail text removes encoded secret URLs and technical readiness is not business acceptance', () => {
  const app = uiRuntime();
  for (const value of ['https://old.example/#token=secret', 'https://old.example/%23token%3Dsecret', 'https://old.example/?code=secret&state=secret', 'https%3A%2F%2Fold.example%2F%23token%3Dsecret', 'https://old.example/%ZZ']) {
    assert.doesNotMatch(app.ui.contactMailText(value), /secret|%ZZ/);
  }
  assert.equal(app.ui.validContactMailSummary(summary('mail1', { direction: 'unknown' })), true);
  const message = app.ui.renderContactMailSync({ ...sync, acceptanceReady: true, coverageUnverifiedCaseCount: 0 });
  assert.match(message, /技術残件は0件/);
  assert.match(message, /実受入は別途/);
  assert.doesNotMatch(message, /受入条件を満たしています/);
});

test('empty case mail is an observed mapping result with incomplete-work guidance', async () => {
  const app = uiRuntime({ listContactMail: () => list([]) });
  await app.ui.loadContactMailList('case', { caseId });
  assert.equal(app.mail.case.status, 'loaded');
  assert.match(app.element('caseMailSection').innerHTML, /現在紐付いているメールは0件/);
  assert.match(app.element('caseMailSection').innerHTML, /同期・照合の未完了/);
});

test('manual sync performs catalog and one page per click and retains unknown-result request ID', async () => {
  let advances = 0;
  const app = uiRuntime({ advanceContactMailSync: (options) => {
    if (!options.executionId) return { ok: true, catalog: { complete: true, nextPageIndex: 1, pageCount: 1, digest: 'digest', snapshotId: randomUUID() } };
    advances++;
    if (advances === 1) return { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } };
    return { ok: true, sync: { ...sync, state: advances === 2 ? 'running' : 'complete', executionId: options.executionId } };
  } });
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(advances, 1);
  assert.equal(app.mail.syncBusy, false);
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(advances, 2);
  const requests = app.calls.filter((call) => call.name === 'advanceContactMailSync' && call.args[0].executionId);
  assert.equal(requests[0].args[0].requestId, requests[1].args[0].requestId);
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(advances, 3);
  assert.equal(app.mail.syncProgress, null);
  assert.equal(app.calls.filter((call) => call.name === 'advanceContactMailSync' && !call.args[0].executionId).length, 1);
});

test('pending re-evaluation is explicit, bounded and domain-only', async () => {
  const app = uiRuntime({ listContactMail: () => list([]), reconcileContactMailPending: () => ({ ok: true, processedCount: 50, page: { nextPageToken: 'continue' }, sync }) });
  app.mail.queue.scope = 'pending';
  await app.ui.loadContactMailList('queue');
  await app.ui.reconcileContactMailPendingFromUi();
  assert.equal(app.calls.filter((call) => call.name === 'reconcileContactMailPending').length, 1);
  assert.equal(app.mail.queue.reconcilePageToken, 'continue');
  assert.match(app.mail.queue.reconcileMessage, /50件/);
  const bridgeApp = bridgeRuntime({ actor: { email: 'customer@speed-ad.com', authMode: 'google-oauth' } });
  assert.throws(() => bridgeApp.api.reconcileContactMailPending({}), /権限/);
});

test('residual UI pages empty scans and identifies unindexed failures without leaking markup', async () => {
  const app = uiRuntime({ listContactMailIssues: (options) => ({ ok: true, kind: options.kind,
    targets: options.pageToken ? [{ type: 'message', messageId: 'before-index', message: null }] : [],
    scannedCount: 50, page: { pageSize: 50, nextPageToken: options.pageToken ? '' : 'next' }, sync }) });
  app.mail.issues.kind = 'failed';
  await app.ui.loadContactMailIssues();
  assert.match(app.element('mailQueueContent').innerHTML, /このページの対象は0件/);
  app.element('mailQueueContent:[data-mail-issue-next]').listeners.get('click')();
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(app.element('mailQueueContent').innerHTML, /before-index/);
  assert.match(app.element('mailQueueContent').innerHTML, /本文取得前に同期が失敗/);
  assert.deepEqual(Array.from(app.mail.issues.history), ['']);
  app.element('mailQueueContent:[data-mail-issue-prev]').listeners.get('click')();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.mail.issues.pageToken, '');
  assert.throws(() => app.ui.validateContactMailIssues({ ok: true, kind: 'failed', targets: [{ type: 'message', messageId: '<script>' }], scannedCount: 1, page: { pageSize: 50, nextPageToken: '' } }, 'failed'), /MAIL_INVALID_RESPONSE/);
});

test('residual detail identifies unavailable attachment parts and auth loss invalidates late residuals', async () => {
  const app = uiRuntime({ getContactMailMessage: () => ({ ok: true, message: detail('missing', {
    unavailable: true, bodyAvailability: 'unavailable', attachments: [{ partId: '0.2', name: '<bad>.pdf', mimeType: 'application/pdf', size: 20, availability: 'unavailable' }]
  }) }) });
  Object.assign(app.mail.queue, { scope: 'issues', messages: [summary('missing')], page: { previousPageToken: '', nextPageToken: '' }, status: 'loaded' });
  await app.ui.selectContactMail('queue', 0);
  assert.match(app.element('mailQueueContent').innerHTML, /part 0.2 \/ <span data-mail-availability>取得不能/);
  assert.match(app.element('mailQueueContent').innerHTML, /&lt;bad&gt;.pdf/);
  assert.match(app.element('mailQueueContent').innerHTML, /残件一覧に戻る/);
  assert.match(app.element('mailQueueContent').innerHTML, /data-mail-attachment="0.2" disabled/);
  let release;
  const late = uiRuntime({ listContactMailIssues: () => new Promise((resolve) => { release = resolve; }) });
  const waiting = late.ui.loadContactMailIssues(); await Promise.resolve();
  late.ui.showDenied('認証失効');
  release({ ok: true, kind: 'pending', targets: [{ type: 'message', messageId: 'private', message: summary('private') }], scannedCount: 1, page: { pageSize: 50, nextPageToken: '' }, sync });
  await waiting;
  assert.equal(late.element('mailQueueContent').innerHTML, '');
});


test('review action stays unavailable until server confirms body and complete attachments', async () => {
  const app = uiRuntime({ getContactMailMessage: () => ({ ok: true, message: detail('partial', { reviewReady: false, bodyAvailability: 'unavailable',
    attachments: [{ partId: '0.1', name: 'part.bin', mimeType: 'application/octet-stream', size: 600000, availability: 'unverified' }] }) }) });
  Object.assign(app.mail.case, { caseId, messages: [summary('partial')], page: { previousPageToken: '', nextPageToken: '' }, status: 'loaded' });
  await app.ui.selectContactMail('case', 0);
  assert.doesNotMatch(app.element('caseMailSection').innerHTML, /data-mail-review /);
  assert.match(app.element('caseMailSection').innerHTML, /本文とすべての添付を取得/);
  await app.ui.writeContactMail('case', 'review');
  assert.equal(app.calls.filter((item) => item.name === 'markContactMailReviewed').length, 0);
});
