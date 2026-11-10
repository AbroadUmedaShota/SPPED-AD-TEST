import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID, webcrypto } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import { createMailService, MAX_MAIL_DETAIL_JSON_CHARS } from '../99_backend-docs/10_support-contact/mail-service/runtime/service.mjs';
import { fakeStore } from '../99_backend-docs/10_support-contact/mail-service/runtime/tests/fakeStore.mjs';
import * as mime from '../99_backend-docs/10_support-contact/mail-service/mime.mjs';
import { createRequestId, requestExpiresAt } from '../99_backend-docs/10_support-contact/mail-service/runtime/requestIdentity.mjs';

const root = new URL('../99_backend-docs/10_support-contact/viewer-workspace-gas/', import.meta.url);
const bridge = readFileSync(new URL('MailBridge.gs', root), 'utf8');
const html = readFileSync(new URL('Index.html', root), 'utf8');
const caseId = '11111111-1111-4111-8111-111111111111';

test('mail service exposes only the authenticated business RPC surface', () => {
  const actual = [...bridge.matchAll(/^function ([a-zA-Z0-9_]+)\(/gm)].map((match) => match[1]).filter((name) => !name.endsWith('_')).sort();
  assert.deepEqual(actual, ['listContactMail', 'getContactMailMessage', 'getContactMailAttachmentChunk', 'markContactMailReviewed', 'confirmContactCaseNoMail', 'resolveContactMailPending', 'getContactMailSyncStatus', 'reconcileContactMailPending', 'advanceContactMailSync', 'listContactMailIssues'].sort());
});

function bridgeRuntime({ actor = { email: 'reader@abroad-o.com', authMode: 'domain' }, ids = [caseId], dates, statuses, closedDates, historyStartAt = '2026-11-08T15:00:00.000Z', url = 'https://contact-mail-example.a.run.app' } = {}) {
  const calls = [];
  const reads = [];
  const sourceDates = () => dates === undefined ? ids.map(() => '2026-11-10T00:00:00.000Z') : dates;
  let response = () => ({ ok: true });
  const context = {
    requireViewer_() { if (!actor) throw new Error('権限がありません'); return actor; },
    findSubmission_(id) { reads.push(id); return ids.includes(id) ? { record: { submission_id: id } } : null; },
    getProperty_: (key) => key === 'MAIL_HISTORY_START_AT' ? historyStartAt : url,
    getSheet_: () => ({ getDataRange: () => ({ getValues: () => { const values = sourceDates(); return [values ? ['submission_id', 'submitted_at', 'handled_status', 'closed_at'] : ['submission_id', 'handled_status', 'closed_at'], ...ids.map((id, index) => values ? [id, values[index], statuses?.[index] || '未対応', closedDates?.[index] || ''] : [id, statuses?.[index] || '未対応', closedDates?.[index] || ''])]; } }) }),
    ensureHeaders_: () => sourceDates() ? ['submission_id', 'submitted_at', 'handled_status', 'closed_at'] : ['submission_id', 'handled_status', 'closed_at'],
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
  return { api: context, calls, reads, respond(fn) { response = fn; }, setActor(value) { actor = value; }, setUrl(value) { url = value; }, setHistoryStartAt(value) { historyStartAt = value; } };
}

test('every mail RPC authorizes before Sheet or service access', () => {
  const app = bridgeRuntime({ actor: null });
  for (const [name, args] of [
    ['listContactMail', [{ scope: 'case', caseId }]], ['getContactMailMessage', [{ scope: 'case', caseId, messageId: 'mail1' }]],
    ['getContactMailAttachmentChunk', [{ scope: 'case', caseId, messageId: 'mail1', partId: '0.1', offset: 0 }]],
    ['markContactMailReviewed', [{ scope: 'case', caseId, messageId: 'mail1', expectedVersion: 1 }]],
    ['confirmContactCaseNoMail', [{ caseId, contextToken: 'a'.repeat(64), requestId: randomUUID() }]],
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
  assert.match(call.envelope.requestId, /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  const createdAt = Number.parseInt(call.envelope.requestId.slice(0, 8) + call.envelope.requestId.slice(9, 13), 16);
  assert.ok(Math.abs(Date.parse(call.envelope.issuedAt) - createdAt) < 1000);
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

test('no-mail bridge validates case, fixed context and explicit request identity before dispatch', () => {
  const app = bridgeRuntime();
  const requestId = randomUUID();
  app.api.confirmContactCaseNoMail({ caseId, contextToken: 'a'.repeat(64), requestId, actor: { email: 'spoof@example.com' } });
  const envelope = app.calls[0].envelope;
  assert.equal(envelope.operation, 'confirmCaseNoMail');
  assert.equal(envelope.requestId, requestId);
  assert.deepEqual(envelope.payload, { caseId, contextToken: 'a'.repeat(64) });
  assert.deepEqual(envelope.actor, { email: 'reader@abroad-o.com', authMode: 'domain' });
  for (const options of [{ caseId, contextToken: 'A'.repeat(64), requestId }, { caseId, contextToken: 'a'.repeat(64) },
    { caseId: 'missing', contextToken: 'a'.repeat(64), requestId }, { caseId, contextToken: 'a'.repeat(64), requestId: '../unsafe' }]) {
    assert.throws(() => app.api.confirmContactCaseNoMail(options));
  }
  assert.equal(app.calls.length, 1);
  app.setActor({ email: 'customer@speed-ad.com', authMode: 'google-oauth' });
  app.api.confirmContactCaseNoMail({ caseId, contextToken: 'b'.repeat(64), requestId: randomUUID() });
  assert.equal(app.calls.at(-1).envelope.actor.authMode, 'customer-oauth');
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
  assert.doesNotMatch(bridge, /setValue|handled_by|handled_at|internal_note/);
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
  const plan = app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }).catalog;
  assert.equal(app.calls.length, 0);
  const first = app.api.advanceContactMailSync({ catalog: plan, caseIds: ['untrusted'] });
  assert.equal(first.catalog.complete, false);
  assert.equal(first.catalog.nextPageIndex, 5);
  assert.equal(app.calls.length, 5);
  assert.ok(app.calls.every((call) => call.envelope.payload.cases.length === 200));
  const second = app.api.advanceContactMailSync({ catalog: first.catalog });
  assert.equal(second.catalog.complete, true);
  assert.equal(app.calls.length, 7);
  assert.deepEqual(app.calls.flatMap((call) => call.envelope.payload.cases.map((item) => item.caseId)), ids);
  assert.equal(first.catalog.digest, createHash('sha256').update(ids.map((id) => JSON.stringify([id, '未対応', null])).join('\n')).digest('hex'));
  assert.doesNotMatch(JSON.stringify(first), /caseIds|untrusted/);
  assert.ok(app.calls.every((call) => call.envelope.payload.snapshotId === first.catalog.snapshotId));
  const count = app.calls.length;
  assert.equal(app.api.advanceContactMailSync({ catalog: { ...first.catalog, digest: 'changed' } }).error.code, 'CONFLICT');
  assert.equal(app.calls.length, count);
});

test('catalog preparation never uploads and retry preserves snapshot pages while source changes conflict', () => {
  const ids = Array.from({ length: 401 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
  const app = bridgeRuntime({ ids });
  const snapshotId = randomUUID();
  const plan = app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId } }).catalog;
  assert.equal(app.calls.length, 0);
  assert.equal(plan.snapshotId, snapshotId);
  assert.equal(plan.nextPageIndex, 0);
  app.respond((envelope) => app.calls.length === 2 ? { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } } : { ok: true, catalog: { complete: envelope.payload.pageIndex === 2 } });
  assert.equal(app.api.advanceContactMailSync({ catalog: plan }).error.code, 'MAIL_UPSTREAM_TIMEOUT');
  const firstPages = app.calls.map((call) => call.envelope.payload);
  assert.equal(app.api.advanceContactMailSync({ catalog: plan }).catalog.complete, true);
  assert.deepEqual(app.calls.slice(2, 4).map((call) => call.envelope.payload), firstPages);
  assert.ok(app.calls.every((call) => call.envelope.payload.snapshotId === snapshotId && call.envelope.payload.digest === plan.digest));
  const before = app.calls.length;
  ids.push('00000000-0000-4000-8000-999999999999');
  assert.equal(app.api.advanceContactMailSync({ catalog: plan }).error.code, 'CONFLICT');
  assert.equal(app.calls.length, before);
  assert.throws(() => app.api.advanceContactMailSync({}), /同期ID/);
});

test('only domain users can upload catalog or advance a bounded sync', () => {
  const app = bridgeRuntime({ actor: { email: 'customer@speed-ad.com', authMode: 'google-oauth' } });
  assert.throws(() => app.api.advanceContactMailSync({}), /権限/);
  assert.equal(app.calls.length, 0);
  app.setActor({ email: 'reader@abroad-o.com', authMode: 'domain' });
  app.respond(() => ({ ok: true, catalog: { complete: true } }));
  const catalog = app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }).catalog;
  app.calls.length = 0;
  const executionId = randomUUID();
  app.api.advanceContactMailSync({ executionId, mode: 'full', catalogSnapshotId: catalog.snapshotId, catalogDigest: catalog.digest, catalogStartAt: catalog.startAt, requestId: randomUUID() });
  assert.deepEqual(app.calls[0].envelope.payload, { executionId, mode: 'full', catalogSnapshotId: catalog.snapshotId, catalogDigest: catalog.digest, startAt: catalog.startAt });
});

test('explicit sync period is bounded by authoritative dates and sent for full and history starts', () => {
  for (const [date, expected] of [['2026-11-10T04:00:00Z', '2026-11-08T15:00:00.000Z'], [new Date('2026-11-10T23:00:00Z'), '2026-11-09T15:00:00.000Z']]) {
    const app = bridgeRuntime({ dates: [date], historyStartAt: expected });
    app.respond(() => ({ ok: true, catalog: { complete: true } }));
    const catalog = app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }).catalog;
    assert.equal(catalog.startAt, expected);
    app.api.advanceContactMailSync({ executionId: randomUUID(), mode: 'full', catalogSnapshotId: catalog.snapshotId, catalogDigest: catalog.digest, catalogStartAt: catalog.startAt, startAt: '2099-01-01T00:00:00Z' });
    assert.equal(app.calls.at(-1).envelope.payload.startAt || null, expected);
    app.api.advanceContactMailSync({ executionId: randomUUID(), mode: 'history', catalogSnapshotId: catalog.snapshotId, catalogDigest: catalog.digest, catalogStartAt: catalog.startAt });
    assert.equal(app.calls.at(-1).envelope.payload.startAt, expected);
  }
});

test('unknown period stops empty, missing and invalid Sheet dates before any service or Gmail request', () => {
  for (const options of [{ ids: [] }, { dates: null }, { dates: [''] }, { dates: ['invalid'] }, { dates: ['2026-02-30T00:00:00Z'] }, { ids: [caseId, '22222222-2222-4222-8222-222222222222'], dates: ['2026-11-10T00:00:00Z', ''] }]) {
    const app = bridgeRuntime(options);
    assert.throws(() => app.api.advanceContactMailSync({}), /MAIL_PERIOD_REQUIRED/);
    assert.throws(() => app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }), /MAIL_PERIOD_REQUIRED/);
    assert.equal(app.calls.length, 0);
  }
});

test('sync requires an explicit canonical JST-midnight start no later than the Sheet safety bound', () => {
  for (const historyStartAt of ['', null, 'invalid', '2026-11-08T15:00:00Z', '2026-11-08T15:00:00.001Z',
    '2026-11-08T00:00:00.000Z', '2026-11-09T15:00:00.000Z', '2026-02-30T15:00:00.000Z']) {
    const app = bridgeRuntime({ historyStartAt });
    assert.throws(() => app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }), /MAIL_PERIOD_REQUIRED/);
    assert.equal(app.calls.length, 0);
  }
  const app = bridgeRuntime({ historyStartAt: '2026-01-01T15:00:00.000Z' });
  const plan = app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }).catalog;
  assert.equal(plan.startAt, '2026-01-01T15:00:00.000Z');
});

test('Sheet date corrections and earliest-row removal never move the configured beginning later', () => {
  const ids = [caseId, '22222222-2222-4222-8222-222222222222'];
  const dates = ['2026-10-01T00:00:00.000Z', '2026-11-10T00:00:00.000Z'];
  const app = bridgeRuntime({ ids, dates, historyStartAt: '2026-09-29T15:00:00.000Z' });
  const prepare = () => app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }).catalog;
  assert.equal(prepare().startAt, '2026-09-29T15:00:00.000Z');
  ids.shift(); dates.shift();
  assert.equal(prepare().startAt, '2026-09-29T15:00:00.000Z');
  dates[0] = '2026-09-01T00:00:00.000Z';
  assert.throws(prepare, /MAIL_PERIOD_REQUIRED/);
  assert.equal(app.calls.length, 0);
});

test('changing the configured beginning invalidates prepared uploads before dispatch', () => {
  const app = bridgeRuntime();
  const catalog = app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }).catalog;
  app.setHistoryStartAt('2026-10-01T15:00:00.000Z');
  assert.equal(app.api.advanceContactMailSync({ catalog }).error.code, 'CONFLICT');
  assert.equal(app.calls.length, 0);
});

test('unknown first-sync confirmation preserves the original plan after Sheet dates, IDs or period setting change', () => {
  for (const change of ['date', 'new-case', 'period']) {
    const ids = [caseId];
    const dates = ['2026-11-10T04:00:00Z'];
    const app = bridgeRuntime({ ids, dates });
    const catalog = app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }).catalog;
    const options = { executionId: randomUUID(), mode: 'full', catalogSnapshotId: catalog.snapshotId, catalogDigest: catalog.digest, catalogStartAt: catalog.startAt, requestId: randomUUID() };
    app.api.advanceContactMailSync(options);
    const original = JSON.parse(JSON.stringify(app.calls.at(-1).envelope.payload));
    if (change === 'date') dates[0] = '2026-10-01T04:00:00Z';
    else if (change === 'new-case') { ids.push('22222222-2222-4222-8222-222222222222'); dates.push('2026-11-10T04:00:00Z'); }
    else app.setHistoryStartAt('2026-10-01T15:00:00.000Z');
    app.api.advanceContactMailSync({ ...options, confirmOnly: true });
    const confirmation = app.calls.at(-1).envelope;
    assert.equal(confirmation.operation, 'getSyncRequestResult');
    assert.equal(confirmation.payload.requestId, options.requestId);
    assert.deepEqual(confirmation.payload.requestPayload, original);
    const count = app.calls.length;
    const notSent = app.api.advanceContactMailSync(options);
    assert.equal(notSent.error.code, 'MAIL_SYNC_NOT_DISPATCHED');
    assert.deepEqual(JSON.parse(JSON.stringify(notSent.dispatch)), { sent: false, operation: 'advanceSync', requestId: options.requestId, executionId: options.executionId });
    assert.equal(app.calls.length, count);
  }
});

test('upstream responses cannot manufacture the GAS-only definite-not-dispatched outcome', () => {
  for (const cause of ['MAIL_CATALOG_CHANGED', 'MAIL_NOT_CONFIGURED', 'MAIL_SERVICE_AUTH']) {
  const app = bridgeRuntime();
  const options = { executionId: randomUUID(), requestId: randomUUID() };
  app.respond(() => ({ ok: false, error: { code: 'MAIL_SYNC_NOT_DISPATCHED', cause }, dispatch: { sent: false, operation: 'advanceSync', ...options } }));
  const result = app.api.advanceContactMailSync(options);
  assert.equal(result.error.code, 'MAIL_SERVICE_UNAVAILABLE');
  assert.equal(result.dispatch, undefined);
  }
});

test('GAS advance pre-dispatch config and identity failures carry exact not-sent identity without fetching', () => {
  for (const failure of ['missing-url', 'invalid-url', 'empty-token', 'token-exception']) {
    const app = bridgeRuntime();
    if (failure === 'missing-url') app.setUrl('');
    if (failure === 'invalid-url') app.setUrl('http://invalid.example');
    if (failure === 'empty-token') app.api.ScriptApp.getIdentityToken = () => '';
    if (failure === 'token-exception') app.api.ScriptApp.getIdentityToken = () => { throw new Error('private token error'); };
    const options = { executionId: randomUUID(), requestId: randomUUID() };
    const result = app.api.advanceContactMailSync(options);
    assert.equal(result.error.code, 'MAIL_SYNC_NOT_DISPATCHED');
    assert.equal(result.error.cause, failure.includes('url') ? 'MAIL_NOT_CONFIGURED' : 'MAIL_SERVICE_AUTH');
    assert.deepEqual(JSON.parse(JSON.stringify(result.dispatch)), { sent: false, operation: 'advanceSync', ...options });
    assert.equal(app.calls.length, 0);
    assert.doesNotMatch(JSON.stringify(result), /private token error/);
  }
});

const summary = (messageId = 'mail1', extra = {}) => ({ messageId, threadId: 'thread1', caseId, matchState: 'matched', version: 1, internalDate: '2026-11-10T00:00:00Z', subject: '件名', from: 'sender@example.com', to: 'customer@speed-ad.com', direction: 'received', attachmentCount: 0, firstReview: null, unavailable: false, ...extra });
const detail = (messageId = 'mail1', extra = {}) => ({ ...summary(messageId), bodyText: '本文', bodyAvailability: 'verified', reviewReady: true, attachments: [], ...extra });
const sync = { unknownClosureCaseCount: 0, expiredCaseCount: 0, executionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', state: 'complete', lastSuccessAt: '2026-11-10T00:00:00Z', pendingCount: 0, unreviewedCount: 0, failedCount: 0, unavailableCount: 0, remainingPages: false, bodyUnverifiedCount: 1, bodyUnavailableCount: 0, attachmentUnverifiedCount: 0, attachmentUnavailableCount: 0, acceptanceReady: false, processedCount: 0, phase: 'enumerate', mode: 'full', cutoffAt: '2026-11-10T00:00:00Z', startAt: '2026-11-01T00:00:00.000Z', historyAvailable: true, enumerationComplete: true, coverageUnverifiedCaseCount: 0, unobservedDeletedCount: 0 };
sync.noMailContextToken = 'a'.repeat(64);
const syncResponse = (executionId, state = 'running', extra = {}) => ({ ok: true, sync: { ...sync, executionId, state, remainingPages: state === 'running', enumerationComplete: state === 'complete', noMailContextToken: state === 'complete' ? sync.noMailContextToken : null, ...extra } });
const syncCallResponse = (options, state = 'running', extra = {}) => {
  const result = syncResponse(options.executionId, state, extra);
  return options.confirmOnly ? { ...result, found: true, receipt: { sync: result.sync } } : result;
};
const catalogResponse = (options, total = 1) => {
  const catalog = { ...options.catalog, digest: 'a'.repeat(64), pageCount: Math.max(1, Math.ceil(total / 200)), total, startAt: '2026-11-01T00:00:00.000Z' };
  catalog.nextPageIndex = options.prepareCatalog ? 0 : Math.min(catalog.nextPageIndex + 5, catalog.pageCount);
  catalog.complete = !options.prepareCatalog && catalog.nextPageIndex === catalog.pageCount;
  return { ok: true, catalog };
};
const noMail = (extra = {}) => ({ eligible: false, contextToken: sync.noMailContextToken, confirmation: null, stale: false, ...extra });
const noMailConfirmation = { email: 'reader@abroad-o.com', at: '2026-11-10T01:00:00.000Z', startAt: '2026-11-01T00:00:00.000Z', cutoffAt: '2026-11-10T00:00:00.000Z' };
const list = (messages, page = {}) => ({ ok: true, messages, page: { nextPageToken: '', previousPageToken: '', pageSize: 50, ...page }, sync, noMail: noMail() });

function uiRuntime(handlers = {}) {
  const elements = new Map();
  const calls = [];
  const revoked = [];
  const timers = new Map();
  let timerIndex = 0;
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
    window: { CONTACT_VIEWER_INITIAL_ID: '', CONTACT_VIEWER_CONTEXT: { allowed: true, email: 'reader@abroad-o.com', authMode: 'domain' }, sessionStorage: { getItem: () => '' }, crypto: webcrypto, confirm: () => true,
      setTimeout(fn, delay) { const id = ++timerIndex; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); } },
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {}, createElement: (tag) => element(`${tag}-${randomUUID()}`) },
    google: { script: { run } }, URL: TestURL, URLSearchParams, Blob, Uint8Array, atob,
  };
  vm.createContext(context);
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1].replace('    bootstrapViewer();', '');
  vm.runInContext(script, context, { filename: 'Index.html' });
  return { ui: context, calls, elements, element, revoked, timers, mail: vm.runInContext('contactMailState', context), state: vm.runInContext('state', context),
    expireSyncCall() { const entry = [...timers].find(([, timer]) => timer.delay === 120000); assert.ok(entry); timers.delete(entry[0]); entry[1].fn(); } };
}

test('a changed configured period projects old status as unverified without rewriting its receipt', () => {
  const startAt = '2026-11-08T15:00:00.000Z';
  const completed = { ...sync, startAt, bodyUnverifiedCount: 0, acceptanceReady: true, noMailContextToken: 'a'.repeat(64) };
  const confirmation = { email: 'reader@abroad-o.com', at: '2026-11-10T01:00:00.000Z', startAt, cutoffAt: completed.cutoffAt };
  const app = bridgeRuntime({ historyStartAt: startAt });
  app.respond(() => ({ ok: true, sync: completed, receipt: { sync: completed },
    noMail: { eligible: true, contextToken: 'a'.repeat(64), confirmation, stale: false } }));
  assert.equal(app.api.getContactMailSyncStatus().sync.acceptanceReady, true);
  app.setHistoryStartAt('2026-10-01T15:00:00.000Z');
  const result = app.api.getContactMailSyncStatus();
  assert.equal(result.sync.startAt, startAt);
  assert.equal(result.sync.state, 'needs_full_sync');
  assert.equal(result.sync.acceptanceReady, false);
  assert.equal(result.sync.enumerationComplete, false);
  assert.equal(result.sync.errorCode, 'MAIL_PERIOD_REQUIRED');
  assert.equal(result.receipt.sync.state, 'complete');
  assert.equal(result.receipt.sync.acceptanceReady, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.noMail)), { eligible: false, contextToken: null, confirmation: null, stale: true });
  const ui = uiRuntime();
  ui.ui.validateContactMailSync(result.sync);
  ui.ui.validateContactCaseNoMail(result.noMail, result.sync);
  app.setHistoryStartAt('');
  assert.equal(app.api.getContactMailSyncStatus().sync.acceptanceReady, false);
});

test('an earlier corrected Sheet receipt invalidates old readiness and no-mail confirmation', () => {
  const startAt = '2026-11-08T15:00:00.000Z';
  const dates = ['2026-11-10T00:00:00.000Z'];
  const app = bridgeRuntime({ dates, historyStartAt: startAt });
  app.respond(() => ({ ok: true, sync: { ...sync, startAt, bodyUnverifiedCount: 0, acceptanceReady: true },
    noMail: { eligible: true, contextToken: sync.noMailContextToken,
      confirmation: { ...noMailConfirmation, startAt }, stale: false } }));
  assert.equal(app.api.getContactMailSyncStatus().sync.acceptanceReady, true);
  dates[0] = '2026-10-01T00:00:00.000Z';
  const result = app.api.getContactMailSyncStatus();
  assert.equal(result.sync.startAt, startAt);
  assert.equal(result.sync.state, 'needs_full_sync');
  assert.equal(result.sync.acceptanceReady, false);
  assert.equal(result.noMail.eligible, false);
  assert.equal(result.noMail.confirmation, null);
  assert.equal(result.noMail.stale, true);
  const ui = uiRuntime();
  ui.ui.validateContactMailSync(result.sync);
  ui.ui.validateContactCaseNoMail(result.noMail, result.sync);
});

test('changed period preserves old running batches across reload and permits a new full sync after completion', async () => {
  for (const reload of [false, true]) {
    const oldStartAt = '2026-11-08T15:00:00.000Z';
    const newStartAt = '2026-10-01T15:00:00.000Z';
    const executionId = randomUUID();
    const bridgeApp = bridgeRuntime({ historyStartAt: oldStartAt });
    let batches = 0;
    const status = () => syncResponse(executionId, batches < 3 ? 'running' : 'complete', {
      startAt: oldStartAt, processedCount: batches * 5, bodyUnverifiedCount: 0, acceptanceReady: batches === 3
    });
    bridgeApp.respond((envelope) => {
      if (envelope.operation === 'getSyncStatus') return status();
      if (envelope.operation === 'uploadCaseCatalog') return { ok: true, catalog: { complete: true } };
      assert.equal(envelope.operation, 'advanceSync');
      if (envelope.payload.executionId === executionId) {
        assert.equal(envelope.payload.mode, undefined);
        batches++;
        return status();
      }
      assert.equal(batches, 3);
      assert.equal(envelope.payload.mode, 'full');
      assert.equal(envelope.payload.startAt, newStartAt);
      return syncResponse(envelope.payload.executionId, 'complete', {
        startAt: newStartAt, processedCount: 15, bodyUnverifiedCount: 0, acceptanceReady: true
      });
    });
    bridgeApp.setHistoryStartAt(newStartAt);
    const app = uiRuntime({
      getContactMailSyncStatus: () => bridgeApp.api.getContactMailSyncStatus(),
      advanceContactMailSync: (options) => bridgeApp.api.advanceContactMailSync(options)
    });
    if (!reload) app.mail.syncProgress = { executionId, started: true };
    await app.ui.loadContactMailSyncStatus();
    assert.equal(app.mail.sync.state, 'running');
    assert.equal(app.mail.sync.acceptanceReady, false);
    if (!reload) assert.equal(app.mail.syncProgress.executionId, executionId);
    await app.ui.advanceContactMailSyncFromUi();
    assert.equal(batches, 3);
    assert.equal(app.mail.sync.state, 'needs_full_sync');
    assert.equal(app.mail.sync.acceptanceReady, false);
    assert.equal(app.mail.syncProgress, null);
    assert.equal(bridgeApp.calls.filter((call) => call.envelope.operation === 'uploadCaseCatalog').length, 0);
    await app.ui.advanceContactMailSyncFromUi();
    assert.equal(app.mail.sync.state, 'complete');
    assert.equal(app.mail.sync.startAt, newStartAt);
    assert.equal(app.mail.sync.acceptanceReady, true);
  }
});

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

test('maximum decoded bodies survive runtime JSON, GAS bridge and UI without truncation', async () => {
  const tail = 'END-OF-COMPLETE-BODY';
  for (const unit of ['a', '"\\\t\r\n']) {
    const bodyText = unit.repeat(Math.ceil((2 * 1024 * 1024 - tail.length) / unit.length)).slice(0, 2 * 1024 * 1024 - tail.length) + tail;
    const at = '2026-11-10T00:00:00.000Z';
    const attachments = Array.from({ length: 498 }, (_, index) => ({ partId: `0.${index + 1}`,
      name: '"'.repeat(255), mimeType: `application/x-${'m'.repeat(240)}`, size: 0,
      availability: 'verified', transferVersion: 1 }));
    const stored = { ...detail(), subject: '"'.repeat(4096), from: '"'.repeat(4096), to: '"'.repeat(4096),
      bodyAvailability: 'unverified', attachmentCount: attachments.length, attachments };
    delete stored.bodyText;
    const store = fakeStore([caseId], { state: 'complete', startAt: '2026-11-01T00:00:00.000Z' });
    store.seed(stored);
    const message = { id: 'mail1', internalDate: String(Date.parse(at)), labelIds: [], payload: {
      mimeType: 'multipart/mixed', parts: [{ mimeType: 'text/plain', body: { size: Buffer.byteLength(bodyText), data: Buffer.from(bodyText).toString('base64url') } },
        ...attachments.map((item) => ({ mimeType: item.mimeType, filename: item.name, body: { size: 0, data: '' } }))]
    } };
    const service = createMailService({ store, gmail: {
      getMessageMetadata: async () => ({ id: 'mail1', internalDate: message.internalDate, labelIds: [] }),
      getMessage: async () => message, getAttachment: async () => { throw new Error('unexpected attachment'); }
    }, core: mime, now: () => new Date(at) });
    const result = await service({ contractVersion: 1, operation: 'getMail', requestId: randomUUID(), issuedAt: at,
      actor: { email: 'reader@abroad-o.com', authMode: 'domain' }, payload: { scope: 'case', caseId, messageId: 'mail1' } });
    assert.equal(result.message.bodyAvailability, 'verified');
    assert.equal(result.message.bodyText, bodyText);
    assert.ok(JSON.stringify(result).length > 2097152);
    assert.ok(JSON.stringify(result).length < MAX_MAIL_DETAIL_JSON_CHARS);
    const gas = bridgeRuntime();
    assert.equal(gas.api.MAIL_DETAIL_RESPONSE_CHARS, MAX_MAIL_DETAIL_JSON_CHARS);
    gas.respond(() => result);
    const app = uiRuntime({ listContactMail: () => list([summary()]),
      getContactMailMessage: (options) => JSON.parse(JSON.stringify(gas.api.getContactMailMessage(options))) });
    await app.ui.loadContactMailList('case', { caseId });
    assert.equal(app.mail.case.message.bodyText, bodyText);
    assert.match(app.element('caseMailSection').innerHTML, /END-OF-COMPLETE-BODY<\/div>/);
    assert.equal(app.mail.case.message.reviewReady, true);
    gas.respond(() => ({ raw: ' '.repeat(MAX_MAIL_DETAIL_JSON_CHARS + 1) }));
    assert.equal(gas.api.getContactMailMessage({ scope: 'case', caseId, messageId: 'mail1' }).error.code, 'MAIL_INVALID_RESPONSE');
    gas.respond(() => ({ raw: ' '.repeat(2097153) }));
    assert.equal(gas.api.getContactMailSyncStatus().error.code, 'MAIL_INVALID_RESPONSE');
  }
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

test('observed period shrink clears open mail, revokes previews and discards a pending attachment response', async () => {
  const broad = { ...sync, startAt: '2026-01-01T00:00:00.000Z' };
  const narrow = { ...sync, executionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', startAt: '2026-11-01T00:00:00.000Z' };
  let resolveAttachment;
  const chunk = (partId) => ({ ok: true, attachment: { partId, name: 'note.txt', mimeType: 'text/plain', previewKind: 'text', availability: 'verified' }, reviewReady: false, offset: 0, nextOffset: 3, totalSize: 3, dataBase64: 'YWJj', done: true });
  const app = uiRuntime({
    listContactMail: () => ({ ...list([summary()]), sync: broad }),
    getContactMailMessage: () => ({ ok: true, message: detail('mail1', { bodyText: 'old protected body', attachments: ['0.1', '0.2'].map((partId) => ({ partId, name: 'note.txt', mimeType: 'text/plain', size: 3 })) }) }),
    getContactMailSyncStatus: () => ({ ok: true, sync: narrow }),
    getContactMailAttachmentChunk: (options) => options.partId === '0.1' ? chunk('0.1') : new Promise((resolve) => { resolveAttachment = resolve; }),
  });
  await app.ui.loadContactMailList('case', { caseId });
  await app.ui.loadContactMailList('queue');
  assert.match(app.element('caseMailSection').innerHTML, /old protected body/);
  const previewParent = app.element('preview-parent');
  const previewButton = app.element('preview-button'); previewButton.parentElement = previewParent;
  await app.ui.loadContactMailAttachment('case', '0.1', previewButton);
  const previewUrl = app.mail.case.urls[0];
  assert.ok(previewUrl);
  const pendingParent = app.element('pending-parent');
  const pendingButton = app.element('pending-button'); pendingButton.parentElement = pendingParent;
  const pending = app.ui.loadContactMailAttachment('case', '0.2', pendingButton);
  await Promise.resolve();
  app.mail.issues.history.push('old-page');
  await app.ui.loadContactMailSyncStatus();
  assert.equal(app.mail.case.message, null); assert.equal(app.mail.queue.message, null);
  assert.equal(app.mail.case.messages.length, 0); assert.equal(app.mail.queue.messages.length, 0);
  assert.equal(app.mail.case.caseId, caseId);
  assert.equal(app.mail.issues.history.length, 0);
  assert.ok(app.revoked.includes(previewUrl));
  assert.doesNotMatch(app.element('caseMailSection').innerHTML, /old protected body/);
  assert.doesNotMatch(app.element('mailQueueContent').innerHTML, /old protected body/);
  assert.match(app.element('caseMailSection').innerHTML, /同期対象期間が変わりました/);
  resolveAttachment(chunk('0.2'));
  await pending;
  assert.equal(app.mail.case.urls.length, 0);
  assert.equal(pendingParent.querySelector('[data-mail-attachment-preview]').children.length, 0);
  assert.equal(app.mail.periodStartAt, narrow.startAt);
});

test('sync advance with a new period invalidates old list and detail responses before they can restore content', async () => {
  const broad = { ...sync, startAt: '2026-01-01T00:00:00.000Z' };
  const narrow = { ...sync, executionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', startAt: '2026-11-01T00:00:00.000Z' };
  let resolveList;
  let resolveDetail;
  let detailCalls = 0;
  const app = uiRuntime({
    listContactMail: (options) => options.scope === 'pending' ? new Promise((resolve) => { resolveList = resolve; }) : { ...list([summary()]), sync: broad },
    getContactMailMessage: () => ++detailCalls === 1 ? { ok: true, message: detail('mail1', { bodyText: 'old open body' }) } : new Promise((resolve) => { resolveDetail = resolve; }),
    advanceContactMailSync: (options) => !options.executionId ? catalogResponse(options) : syncCallResponse(options, 'complete', { startAt: narrow.startAt }),
  });
  await app.ui.loadContactMailList('case', { caseId });
  const oldDetail = app.ui.selectContactMail('case', 0);
  app.mail.queue.scope = 'pending';
  const oldList = app.ui.loadContactMailList('queue');
  await Promise.resolve();
  await app.ui.advanceContactMailSyncFromUi();
  resolveDetail({ ok: true, message: detail('mail1', { bodyText: 'late old body' }) });
  resolveList({ ...list([summary('old-pending', { caseId: null, matchState: 'pending' })]), sync: broad });
  await Promise.all([oldDetail, oldList]);
  assert.equal(app.mail.periodStartAt, narrow.startAt);
  assert.equal(app.mail.case.message, null); assert.equal(app.mail.queue.messages.length, 0);
  assert.doesNotMatch(app.element('caseMailSection').innerHTML, /old open body|late old body/);
  assert.doesNotMatch(app.element('mailQueueContent').innerHTML, /old-pending/);
  assert.match(app.element('mailQueueContent').innerHTML, /同期対象期間が変わりました/);
});

test('an older sync-status success or failure cannot overwrite a newer list period and counts', async () => {
  for (const outcome of ['success', 'failure']) {
    const broad = { ...sync, startAt: '2026-01-01T00:00:00.000Z', pendingCount: 99 };
    const narrow = { ...sync, executionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', startAt: '2026-11-01T00:00:00.000Z', pendingCount: 2 };
    let resolveStatus;
    let rejectStatus;
    const app = uiRuntime({
      getContactMailSyncStatus: () => new Promise((resolve, reject) => { resolveStatus = resolve; rejectStatus = reject; }),
      listContactMail: () => ({ ...list([]), sync: narrow }),
    });
    app.ui.observeContactMailSync(broad);
    const oldStatus = app.ui.loadContactMailSyncStatus();
    await Promise.resolve();
    await app.ui.loadContactMailList('case', { caseId });
    const latestHeader = app.element('mailSyncSummary').textContent;
    assert.equal(app.mail.sync.startAt, narrow.startAt);
    assert.match(latestHeader, /照合待ち 2件/);
    if (outcome === 'success') resolveStatus({ ok: true, sync: broad });
    else rejectStatus(new Error('MAIL_SERVICE_UNAVAILABLE'));
    await oldStatus;
    assert.equal(app.mail.sync.startAt, narrow.startAt);
    assert.equal(app.mail.sync.pendingCount, 2);
    assert.equal(app.element('mailSyncSummary').textContent, latestHeader);
    assert.equal(app.element('pendingMailButton').textContent, '照合待ち 2件');
  }
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

test('expired review and no-mail requests retain identity and require saved-state reconciliation', async () => {
  const app = uiRuntime({
    listContactMail: () => list([summary()]), getContactMailMessage: () => ({ ok: true, message: detail() }),
    markContactMailReviewed: () => ({ ok: false, error: { code: 'MAIL_REQUEST_EXPIRED' } }),
  });
  await app.ui.loadContactMailList('case', { caseId });
  await app.ui.writeContactMail('case', 'review');
  const id = app.mail.case.pendingWrite.requestId;
  assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.match(app.mail.case.writeError, /7日.*自動では再送しません/);
  await app.ui.writeContactMail('case', 'review');
  assert.equal(app.calls.filter((call) => call.name === 'markContactMailReviewed')[1].args[0].requestId, id);
  assert.equal(app.mail.case.message.firstReview, null);

  const absent = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: noMail({ eligible: true }) }),
    confirmContactCaseNoMail: () => ({ ok: false, error: { code: 'MAIL_REQUEST_EXPIRED' } }) });
  await absent.ui.loadContactMailList('case', { caseId });
  await absent.ui.confirmContactCaseNoMailFromUi('case');
  const pending = absent.mail.case.pendingNoMail.requestId;
  await absent.ui.confirmContactCaseNoMailFromUi('case');
  assert.equal(absent.mail.case.pendingNoMail.requestId, pending);
  assert.match(absent.mail.case.noMailError, /7日.*自動では再送しません/);
  assert.equal(absent.mail.case.noMail.confirmation, null);
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

test('attachment bridge and UI agree on the 64MiB transfer boundary', () => {
  const limit = 64 * 1024 * 1024;
  const bridgeApp = bridgeRuntime();
  assert.equal(bridgeApp.api.getContactMailAttachmentChunk({ scope: 'case', caseId, messageId: 'mail1', partId: '0.1', offset: limit - 524288 }).ok, true);
  assert.throws(() => bridgeApp.api.getContactMailAttachmentChunk({ scope: 'case', caseId, messageId: 'mail1', partId: '0.1', offset: limit + 1 }), /取得位置/);
  const app = uiRuntime();
  const chunk = { ok: true, attachment: { partId: '0.1', name: 'large.bin', mimeType: 'application/octet-stream', previewKind: 'download', availability: 'verified' },
    reviewReady: true, offset: limit - 524288, nextOffset: limit, totalSize: limit, dataBase64: Buffer.alloc(524288).toString('base64'), done: true };
  assert.equal(app.ui.validateContactMailChunk(chunk, chunk.offset, '0.1').length, 524288);
  assert.throws(() => app.ui.validateContactMailChunk({ ...chunk, totalSize: limit + 1, done: false }, chunk.offset, '0.1'), /MAIL_INVALID_RESPONSE/);
});

test('temporary attachment busy reaches the UI without retry or verified state', async () => {
  const bridgeApp = bridgeRuntime();
  bridgeApp.respond(() => ({ ok: false, error: { code: 'MAIL_ATTACHMENT_BUSY' } }));
  assert.equal(bridgeApp.api.getContactMailAttachmentChunk({ scope: 'case', caseId, messageId: 'mail1', partId: '0.1', offset: 0 }).error.code, 'MAIL_ATTACHMENT_BUSY');
  const app = uiRuntime({ getContactMailAttachmentChunk: () => ({ ok: false, error: { code: 'MAIL_ATTACHMENT_BUSY' } }) });
  app.mail.case.caseId = caseId;
  app.mail.case.message = detail('mail1', { reviewReady: false,
    attachments: [{ partId: '0.1', name: 'note.txt', mimeType: 'text/plain', size: 3, availability: 'unverified' }] });
  const parent = app.element('busy-parent');
  const button = app.element('busy-button'); button.parentElement = parent;
  await app.ui.loadContactMailAttachment('case', '0.1', button);
  assert.equal(app.calls.filter((call) => call.name === 'getContactMailAttachmentChunk').length, 1);
  assert.match(parent.querySelector('[data-mail-attachment-preview]').textContent, /別の添付を取得中/);
  assert.equal(app.mail.case.message.reviewReady, false);
  assert.equal(app.mail.case.message.attachments[0].availability, 'unverified');
  assert.equal(button.disabled, false);
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
  assert.doesNotMatch(app.element('caseMailSection').innerHTML, /data-mail-no-mail-confirm/);
});

test('case no-mail confirmation is explicit and reads back the server actor and fixed period', async () => {
  const eligible = noMail({ eligible: true, contextToken: 'a'.repeat(64) });
  const app = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: eligible }),
    confirmContactCaseNoMail: () => ({ ok: true, noMail: noMail({ confirmation: noMailConfirmation }), sync }) });
  await app.ui.loadContactMailList('case', { caseId });
  assert.match(app.element('caseMailSection').innerHTML, /この対象期間に関連メールなしと確認/);
  const receiptDetail = { submission_id: caseId, handled_status: '未対応', internal_note: '保持するメモ' };
  app.state.detail = receiptDetail;
  await app.ui.confirmContactCaseNoMailFromUi('case');
  assert.equal(app.mail.case.caseId, caseId);
  assert.equal(app.mail.case.pendingNoMail, null);
  assert.equal(app.mail.case.noMail.confirmation.email, 'reader@abroad-o.com');
  assert.match(app.element('caseMailSection').innerHTML, /関連メールなし確認済み.*確認者: reader@abroad-o\.com/s);
  assert.match(app.element('caseMailSection').innerHTML, /確認日時:.*対象期間:/s);
  assert.doesNotMatch(app.element('caseMailSection').innerHTML, /data-mail-no-mail-confirm/);
  assert.equal(app.state.detail, receiptDetail);
  assert.deepEqual(app.calls.filter((call) => call.name !== 'listContactMail').map((call) => call.name), ['confirmContactCaseNoMail']);
  const readback = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: noMail({ confirmation: { ...noMailConfirmation, email: 'first@abroad-o.com' } }) }) });
  await readback.ui.loadContactMailList('case', { caseId });
  assert.match(readback.element('caseMailSection').innerHTML, /確認者: first@abroad-o\.com/);
  const cancelled = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: eligible }) });
  await cancelled.ui.loadContactMailList('case', { caseId });
  cancelled.ui.window.confirm = () => false;
  await cancelled.ui.confirmContactCaseNoMailFromUi('case');
  assert.equal(cancelled.calls.filter((call) => call.name === 'confirmContactCaseNoMail').length, 0);
  assert.equal(Object.keys(cancelled.mail.noMailRequests).length, 0);
});

test('post-cutoff case mail stays visible beside fixed-period no-mail confirmation across pages', async () => {
  let confirmed = false;
  const dates = { later: '2026-11-10T00:00:00.002Z', earlier: '2026-11-10T00:00:00.001Z' };
  const app = uiRuntime({ listContactMail: (options) => ({ ...list([summary(options.pageToken === 'next' ? 'earlier' : 'later', {
    internalDate: dates[options.pageToken === 'next' ? 'earlier' : 'later'] })], options.pageToken === 'next' ? { previousPageToken: 'previous' } : { nextPageToken: 'next' }),
  noMail: confirmed ? noMail({ confirmation: noMailConfirmation }) : noMail({ eligible: true }) }),
  getContactMailMessage: (options) => ({ ok: true, message: detail(options.messageId, { internalDate: dates[options.messageId], bodyText: '基準日時後の本文' }) }),
  confirmContactCaseNoMail: () => { confirmed = true; return { ok: true, noMail: noMail({ confirmation: noMailConfirmation }), sync }; } });
  await app.ui.loadContactMailList('case', { caseId });
  assert.match(app.element('caseMailSection').innerHTML, /基準日時後の本文/);
  assert.match(app.element('caseMailSection').innerHTML, /この対象期間に関連メールなしと確認/);
  assert.match(app.element('caseMailSection').innerHTML, /基準日時より後のメールは「関連メールなし」確認の対象外/);
  await app.ui.confirmContactCaseNoMailFromUi('case');
  assert.match(app.element('caseMailSection').innerHTML, /関連メールなし確認済み/);
  assert.match(app.element('caseMailSection').innerHTML, /基準日時後の本文/);
  assert.equal(app.mail.case.message.messageId, 'later');
  await app.ui.moveContactMail('case', 1);
  assert.equal(app.mail.case.message.messageId, 'earlier');
  assert.match(app.element('caseMailSection').innerHTML, /関連メールなし確認済み/);
  await app.ui.moveContactMail('case', -1);
  assert.equal(app.mail.case.message.messageId, 'later');
  assert.equal(app.calls.filter((call) => call.name === 'confirmContactCaseNoMail').length, 1);
});

test('in-period or malformed listed mail cannot accompany no-mail eligibility or confirmation', async () => {
  for (const at of [sync.startAt, sync.cutoffAt, '2026-11-05T00:00:00.000Z', 'invalid']) {
    for (const state of [noMail({ eligible: true }), noMail({ confirmation: noMailConfirmation })]) {
      const app = uiRuntime({ listContactMail: () => ({ ...list([summary('mail1', { internalDate: at })]), noMail: state }) });
      await app.ui.loadContactMailList('case', { caseId });
      assert.equal(app.mail.case.status, 'failed');
      assert.doesNotMatch(app.element('caseMailSection').innerHTML, /関連メールなし確認済み|data-mail-no-mail-confirm/);
    }
  }
  const contradictory = uiRuntime({ listContactMail: () => ({ ...list([summary('mail1', { internalDate: '2026-11-10T00:00:00.001Z' })]), noMail: noMail({ eligible: true }) }),
    getContactMailMessage: () => ({ ok: true, message: detail('mail1', { internalDate: sync.cutoffAt }) }) });
  await contradictory.ui.loadContactMailList('case', { caseId });
  assert.equal(contradictory.mail.case.noMail.eligible, false);
  assert.match(contradictory.mail.case.detailError, /応答を確認できません/);
});

test('unknown no-mail operation survives post-cutoff mail and page-boundary readback with the same identity', async () => {
  let attempts = 0;
  const after = '2026-11-10T00:00:00.001Z';
  const app = uiRuntime({ listContactMail: (options) => ({ ...list([summary(options.pageToken === 'next' ? 'after2' : 'after1', { internalDate: after })],
    options.pageToken === 'next' ? { previousPageToken: 'previous' } : { nextPageToken: 'next' }), noMail: noMail({ eligible: true }) }),
  getContactMailMessage: (options) => ({ ok: true, message: detail(options.messageId, { internalDate: after }) }),
  confirmContactCaseNoMail: () => ++attempts === 1 ? { ok: false, error: { code: 'MAIL_SERVICE_UNAVAILABLE' } } :
    { ok: true, noMail: noMail({ confirmation: noMailConfirmation }), sync } });
  await app.ui.loadContactMailList('case', { caseId });
  await app.ui.confirmContactCaseNoMailFromUi('case');
  const requestId = app.mail.case.pendingNoMail.requestId;
  await app.ui.moveContactMail('case', 1);
  assert.equal(app.mail.case.message.messageId, 'after2');
  assert.equal(app.mail.case.pendingNoMail.requestId, requestId);
  assert.match(app.element('caseMailSection').innerHTML, /前の確認操作を再確認/);
  await app.ui.confirmContactCaseNoMailFromUi('case');
  const writes = app.calls.filter((call) => call.name === 'confirmContactCaseNoMail');
  assert.deepEqual(writes[0].args[0], writes[1].args[0]);
  assert.equal(app.mail.case.pendingNoMail, null);
  assert.equal(app.mail.case.message.messageId, 'after2');
  assert.match(app.element('caseMailSection').innerHTML, /関連メールなし確認済み/);
});

test('no-mail UI rejects malformed eligibility and shows stale confirmation as requiring review', async () => {
  const stale = uiRuntime({ listContactMail: () => ({ ...list([]), sync: { ...sync, noMailContextToken: 'b'.repeat(64) }, noMail: noMail({ stale: true, eligible: true, contextToken: 'b'.repeat(64) }) }) });
  await stale.ui.loadContactMailList('case', { caseId });
  assert.match(stale.element('caseMailSection').innerHTML, /失効しています。再確認が必要/);
  for (const value of [undefined, noMail({ eligible: true, contextToken: null }), noMail({ confirmation: { ...noMailConfirmation, email: 'other@example.com' } }),
    noMail({ confirmation: { ...noMailConfirmation, cutoffAt: '2026-11-09T00:00:00.000Z' } }), noMail({ unexpected: true })]) {
    const app = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: value }) });
    await app.ui.loadContactMailList('case', { caseId });
    assert.equal(app.mail.case.status, 'failed');
    assert.doesNotMatch(app.element('caseMailSection').innerHTML, /data-mail-no-mail-confirm/);
  }
  const nonempty = uiRuntime({ listContactMail: () => ({ ...list([summary()]), noMail: noMail({ eligible: true, contextToken: 'a'.repeat(64) }) }) });
  await nonempty.ui.loadContactMailList('case', { caseId });
  assert.equal(nonempty.mail.case.status, 'failed');
});

test('unknown no-mail result retains the same operation through timeout, late reply and explicit reload', async () => {
  let completeFirst; let attempts = 0;
  const eligible = noMail({ eligible: true, contextToken: 'a'.repeat(64) });
  const success = { ok: true, noMail: noMail({ confirmation: noMailConfirmation }), sync };
  const app = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: eligible }),
    confirmContactCaseNoMail: () => ++attempts === 1 ? new Promise((resolve) => { completeFirst = resolve; }) : success });
  await app.ui.loadContactMailList('case', { caseId });
  const first = app.ui.confirmContactCaseNoMailFromUi('case');
  await new Promise((resolve) => setImmediate(resolve));
  app.expireSyncCall(); await first;
  const pendingId = app.mail.case.pendingNoMail.requestId;
  assert.equal(attempts, 1); assert.equal(app.mail.case.writing, false);
  assert.match(app.element('caseMailSection').innerHTML, /確認結果は未確認/);
  completeFirst(success); await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.mail.case.noMail.confirmation, null);
  app.ui.clearContactMailView('case');
  await app.ui.loadContactMailList('case', { caseId: '22222222-2222-4222-8222-222222222222' });
  await app.ui.loadContactMailList('case', { caseId });
  assert.equal(app.mail.case.pendingNoMail.requestId, pendingId);
  await app.ui.loadContactMailList('case');
  assert.equal(app.mail.case.pendingNoMail.requestId, pendingId);
  await app.ui.confirmContactCaseNoMailFromUi('case');
  const writes = app.calls.filter((call) => call.name === 'confirmContactCaseNoMail');
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0].args[0], writes[1].args[0]);
  assert.equal(app.mail.case.pendingNoMail, null);
});

test('definite stale-context rejection requires readback before a new no-mail action', async () => {
  const app = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: noMail({ eligible: true, contextToken: 'a'.repeat(64) }) }),
    confirmContactCaseNoMail: () => ({ ok: false, error: { code: 'MAIL_MAPPING_CHANGED' } }) });
  await app.ui.loadContactMailList('case', { caseId });
  await app.ui.confirmContactCaseNoMailFromUi('case');
  assert.equal(app.mail.case.pendingNoMail, null);
  assert.equal(app.mail.case.noMail.eligible, false);
  assert.match(app.element('caseMailSection').innerHTML, /更新して現在の確認状態/);
  await app.ui.confirmContactCaseNoMailFromUi('case');
  assert.equal(app.calls.filter((call) => call.name === 'confirmContactCaseNoMail').length, 1);
});

test('new sync observation and auth loss prevent a late no-mail confirmation from restoring old data', async () => {
  for (const authLoss of [false, true]) {
    let complete;
    const app = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: noMail({ eligible: true, contextToken: 'a'.repeat(64) }) }),
      confirmContactCaseNoMail: () => new Promise((resolve) => { complete = resolve; }) });
    await app.ui.loadContactMailList('case', { caseId });
    const operation = app.ui.confirmContactCaseNoMailFromUi('case');
    await new Promise((resolve) => setImmediate(resolve));
    if (authLoss) app.ui.showDenied('認証失効');
    else app.ui.observeContactMailSync({ ...sync, executionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    complete({ ok: true, noMail: noMail({ confirmation: noMailConfirmation }), sync }); await operation;
    if (authLoss) { assert.equal(app.element('caseMailSection').innerHTML, ''); assert.equal(app.mail.case.pendingNoMail, null); assert.equal(Object.keys(app.mail.noMailRequests).length, 0); }
    else { assert.equal(app.mail.case.noMail.confirmation, null); assert.ok(app.mail.case.pendingNoMail); assert.match(app.element('caseMailSection').innerHTML, /同期の状態が変わりました/); }
  }
});

test('late case list cannot restore an old no-mail confirmation after a newer sync observation', async () => {
  let completeOld; let first = true;
  const latest = { ...sync, noMailContextToken: 'b'.repeat(64) };
  const app = uiRuntime({ listContactMail: () => first ? (first = false, new Promise((resolve) => { completeOld = resolve; })) :
    { ...list([]), sync: latest, noMail: noMail({ eligible: true, contextToken: latest.noMailContextToken, stale: true }) },
  getContactMailSyncStatus: () => ({ ok: true, sync: latest }) });
  const waiting = app.ui.loadContactMailList('case', { caseId });
  await new Promise((resolve) => setImmediate(resolve));
  await app.ui.loadContactMailSyncStatus();
  completeOld({ ...list([]), noMail: noMail({ confirmation: noMailConfirmation }) }); await waiting;
  assert.equal(app.mail.sync, latest);
  assert.equal(app.mail.case.status, 'failed');
  assert.equal(app.mail.case.noMail, null);
  assert.doesNotMatch(app.element('caseMailSection').innerHTML, /関連メールなし確認済み|reader@abroad-o\.com/);
  assert.match(app.element('caseMailSection').innerHTML, /前の応答を破棄.*更新して現在の条件/s);
  assert.equal(app.calls.filter((call) => call.name === 'listContactMail').length, 1);
  await app.ui.loadContactMailList('case');
  assert.equal(app.mail.case.status, 'loaded');
  assert.equal(app.mail.case.noMail.contextToken, latest.noMailContextToken);
  assert.equal(app.mail.case.noMail.confirmation, null);
});

test('mapping or purge context changes invalidate displayed no-mail confirmation within the same sync', async () => {
  for (const token of ['b'.repeat(64), null]) {
    const app = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: noMail({ confirmation: noMailConfirmation }) }) });
    await app.ui.loadContactMailList('case', { caseId });
    assert.match(app.element('caseMailSection').innerHTML, /関連メールなし確認済み/);
    const latest = { ...sync, noMailContextToken: token };
    app.ui.observeContactMailSync(latest);
    assert.equal(app.mail.case.noMail.confirmation, null);
    assert.equal(app.mail.case.noMail.eligible, false);
    assert.equal(app.mail.case.sync, latest);
    assert.match(app.element('caseMailSection').innerHTML, /失効しています。再確認が必要/);
    assert.doesNotMatch(app.element('caseMailSection').innerHTML, /確認者: reader@abroad-o\.com|data-mail-no-mail-confirm/);
  }
});

test('late residual and reconciliation responses cannot regress the observed no-mail context', async () => {
  for (const operation of ['issues', 'reconcile']) {
    let complete;
    const latest = { ...sync, noMailContextToken: 'b'.repeat(64) };
    const app = uiRuntime({ listContactMail: () => list([]),
      listContactMailIssues: () => new Promise((resolve) => { complete = resolve; }),
      reconcileContactMailPending: () => new Promise((resolve) => { complete = resolve; }) });
    await app.ui.loadContactMailList('case', { caseId });
    let waiting;
    if (operation === 'issues') waiting = app.ui.loadContactMailIssues();
    else { app.mail.queue.scope = 'pending'; app.mail.queue.status = 'loaded'; app.mail.queue.messages = []; app.mail.queue.page = list([]).page; app.mail.queue.sync = sync; waiting = app.ui.reconcileContactMailPendingFromUi(); }
    await new Promise((resolve) => setImmediate(resolve));
    app.ui.observeContactMailSync(latest);
    complete(operation === 'issues' ? { ok: true, kind: 'pending', targets: [], scannedCount: 0, page: { pageSize: 50, nextPageToken: '' }, sync } :
      { ok: true, processedCount: 0, page: { nextPageToken: '' }, sync });
    await waiting;
    assert.equal(app.mail.sync, latest);
    if (operation === 'issues') assert.equal(app.mail.issues.result, null);
    else { assert.ok(app.mail.queue.reconcileRequestId); assert.equal(app.mail.queue.writing, false); }
    assert.match(app.element('mailQueueContent').innerHTML, /前の応答を破棄/);
  }
});

test('no-mail context tokens are mandatory scalar values and must agree across case and sync observations', async () => {
  for (const token of [undefined, ['a'.repeat(64)], 'A'.repeat(64)]) {
    const app = uiRuntime();
    assert.throws(() => app.ui.validateContactMailSync({ ...sync, noMailContextToken: token }), /MAIL_INVALID_RESPONSE/);
  }
  const app = uiRuntime({ listContactMail: () => ({ ...list([]), noMail: noMail({ contextToken: 'b'.repeat(64) }) }) });
  await app.ui.loadContactMailList('case', { caseId });
  assert.equal(app.mail.case.status, 'failed');
  const blocked = uiRuntime({ listContactMail: () => ({ ...list([]), sync: { ...sync, pendingCount: 1 }, noMail: noMail({ eligible: true }) }) });
  await blocked.ui.loadContactMailList('case', { caseId });
  assert.equal(blocked.mail.case.status, 'failed');
});

test('foreground sync continues successful batches and retains unknown-result request ID for manual retry', async () => {
  let advances = 0;
  const app = uiRuntime({ advanceContactMailSync: (options) => {
    if (!options.executionId) return catalogResponse(options);
    advances++;
    if (advances === 1) return { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } };
    return syncCallResponse(options, advances === 2 ? 'running' : 'complete');
  } });
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(advances, 1);
  assert.equal(app.mail.syncBusy, false);
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(advances, 3);
  const requests = app.calls.filter((call) => call.name === 'advanceContactMailSync' && call.args[0].executionId);
  assert.equal(requests[0].args[0].requestId, requests[1].args[0].requestId);
  assert.equal(requests[1].args[0].confirmOnly, true);
  assert.notEqual(requests[1].args[0].requestId, requests[2].args[0].requestId);
  assert.equal(app.mail.syncProgress, null);
  assert.equal(app.calls.filter((call) => call.name === 'advanceContactMailSync' && !call.args[0].executionId).length, 2);
});

test('foreground sync yields after 20 successful batches and preserves case detail', async () => {
  const app = uiRuntime({ advanceContactMailSync: (options) => syncResponse(options.executionId) });
  const executionId = randomUUID();
  app.mail.sync = { ...sync, state: 'running', executionId };
  app.state.detail = { submission_id: caseId, internal_note: '編集中' };
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(app.calls.length, 20);
  assert.equal(new Set(app.calls.map((call) => call.args[0].requestId)).size, 20);
  assert.equal(app.mail.syncBusy, false);
  assert.match(app.element('mailSyncSummary').textContent, /上限.*続行ボタン/);
  assert.equal(app.element('syncMailButton').textContent, 'メール同期を続行');
  assert.equal(app.state.detail.internal_note, '編集中');
});

test('catalog upload remains bounded and failed execution resumes only until success', async () => {
  const catalogApp = uiRuntime({ advanceContactMailSync: (options) => catalogResponse(options, 1201) });
  await catalogApp.ui.advanceContactMailSyncFromUi();
  assert.equal(catalogApp.calls.length, 2);
  assert.equal(catalogApp.mail.syncProgress.catalog.nextPageIndex, 5);
  const app = uiRuntime({ advanceContactMailSync: (options) => syncResponse(options.executionId, options.resume ? 'running' : 'complete') });
  app.mail.sync = { ...sync, state: 'failed', executionId: randomUUID() };
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(app.calls.length, 2);
  assert.equal(app.calls[0].args[0].resume, true);
  assert.equal(app.calls[1].args[0].resume, undefined);
});

test('stop control waits for the current result and prevents further foreground requests', async () => {
  let finish;
  const app = uiRuntime({ advanceContactMailSync: (options) => new Promise((resolve) => { finish = () => resolve(syncResponse(options.executionId)); }) });
  app.mail.sync = { ...sync, state: 'running', executionId: randomUUID() };
  const pending = app.ui.advanceContactMailSyncFromUi();
  await new Promise(setImmediate);
  assert.equal(app.element('syncMailButton').textContent, 'メール同期中...');
  assert.equal(app.element('stopMailSyncButton').hidden, false);
  app.ui.stopContactMailSyncFromUi();
  assert.match(app.element('mailSyncSummary').textContent, /送信済みの処理は中止せず/);
  finish();
  await pending;
  assert.equal(app.calls.length, 1);
  assert.equal(app.mail.syncBusy, false);
  assert.equal(app.mail.syncProgress.requestId, '');
  assert.match(app.element('mailSyncSummary').textContent, /続行を停止/);
});

test('sync observation timeout stops without retry and ignores late response', async () => {
  let finish;
  const handlers = { advanceContactMailSync: (options) => new Promise((resolve) => { finish = () => resolve(syncResponse(options.executionId, 'complete')); }) };
  const app = uiRuntime(handlers);
  app.mail.sync = { ...sync, state: 'running', executionId: randomUUID() };
  const pending = app.ui.advanceContactMailSyncFromUi();
  await new Promise(setImmediate);
  app.expireSyncCall();
  await pending;
  const requestId = app.mail.syncProgress.requestId;
  assert.equal(app.calls.length, 1);
  assert.ok(requestId);
  assert.equal(app.mail.syncBusy, false);
  assert.match(app.element('mailSyncSummary').textContent, /自動では再試行しません.*終了したとは限りません/);
  finish();
  await new Promise(setImmediate);
  assert.equal(app.mail.sync.state, 'running');
  assert.equal(app.mail.syncProgress.requestId, requestId);
  handlers.advanceContactMailSync = (options) => syncCallResponse(options, 'complete');
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(app.calls[1].args[0].requestId, requestId);
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls[1].args[0])), { ...JSON.parse(JSON.stringify(app.calls[0].args[0])), confirmOnly: true });
  assert.equal(app.mail.syncProgress, null);
});

test('explicit failed-status observation starts a distinct resume request after unknown result', async () => {
  const executionId = randomUUID();
  let advances = 0;
  const app = uiRuntime({
    advanceContactMailSync: (options) => ++advances === 1 ? { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } } : syncResponse(executionId, 'complete'),
    getContactMailSyncStatus: () => syncResponse(executionId, 'failed'),
  });
  app.mail.sync = { ...sync, state: 'running', executionId };
  await app.ui.advanceContactMailSyncFromUi();
  const unknownRequest = app.calls[0].args[0];
  await app.ui.loadContactMailSyncStatus();
  await app.ui.advanceContactMailSyncFromUi();
  const resumed = app.calls.at(-1).args[0];
  assert.equal(resumed.executionId, executionId);
  assert.notEqual(resumed.requestId, unknownRequest.requestId);
  assert.equal(resumed.resume, true);
  assert.equal(resumed.mode, undefined);
  assert.equal(app.mail.syncProgress, null);
});

test('successful full-sync-required response stops foreground continuation', async () => {
  const app = uiRuntime({ advanceContactMailSync: (options) => syncResponse(options.executionId, 'needs_full_sync') });
  app.mail.sync = { ...sync, state: 'running', executionId: randomUUID() };
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(app.calls.length, 1);
  assert.equal(app.mail.syncProgress, null);
  assert.match(app.element('mailSyncSummary').textContent, /全件同期が必要/);
});

test('malformed sync responses stop continuation and retain unresolved request identity', async () => {
  for (const response of [{ ok: true }, { ok: true, sync: { state: 'running', executionId: 'other' } }]) {
    const app = uiRuntime({ advanceContactMailSync: () => response });
    app.mail.sync = { ...sync, state: 'running', executionId: randomUUID() };
    await app.ui.advanceContactMailSyncFromUi();
    assert.equal(app.calls.length, 1);
    assert.ok(app.mail.syncProgress.requestId);
    assert.match(app.element('mailSyncSummary').textContent, /応答を確認できません/);
  }
});

test('auth loss invalidates in-flight sync results and clears continuation controls', async () => {
  let finish;
  const app = uiRuntime({ advanceContactMailSync: (options) => new Promise((resolve) => { finish = () => resolve(syncResponse(options.executionId)); }) });
  app.mail.sync = { ...sync, state: 'running', executionId: randomUUID() };
  const pending = app.ui.advanceContactMailSyncFromUi();
  await new Promise(setImmediate);
  app.ui.showDenied('認証し直してください');
  finish();
  await pending;
  assert.equal(app.calls.length, 1);
  assert.equal(app.mail.sync, null);
  assert.equal(app.mail.syncProgress, null);
  assert.equal(app.mail.syncBusy, false);
  assert.equal(app.element('stopMailSyncButton').hidden, true);
  assert.equal(app.element('restartMailCatalogButton').hidden, true);
  assert.equal(app.element('mailSyncSummary').textContent, '');
});

test('busy or source-change response after unknown outcome retains the exact pending request for confirmation', async () => {
  for (const code of ['MAIL_SYNC_BUSY', 'MAIL_CATALOG_CHANGED']) {
  let attempts = 0;
  const app = uiRuntime({ advanceContactMailSync: (options) => {
    attempts++;
    if (attempts < 3) return { ok: false, error: { code: attempts === 1 ? 'MAIL_UPSTREAM_TIMEOUT' : code } };
    return syncCallResponse(options, 'complete');
  } });
  app.mail.sync = syncResponse(randomUUID()).sync;
  await app.ui.advanceContactMailSyncFromUi();
  const original = JSON.parse(JSON.stringify(app.calls[0].args[0]));
  await app.ui.advanceContactMailSyncFromUi();
  assert.ok(app.mail.syncProgress);
  assert.equal(app.mail.syncProgress.requestId, original.requestId);
  assert.deepEqual(JSON.parse(JSON.stringify(app.mail.syncProgress.requestPayload)), { executionId: original.executionId });
  await app.ui.advanceContactMailSyncFromUi();
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls[2].args[0])), { ...original, confirmOnly: true });
  assert.equal(app.mail.syncProgress, null);
  }
});

test('historical sync receipt confirms pending request without regressing a newer observed execution', async () => {
  const executionId = randomUUID();
  let actualAdvances = 0;
  let app;
  app = uiRuntime({
    advanceContactMailSync: (options) => {
      if (options.confirmOnly) return { ok: true, found: true, receipt: { sync: syncResponse(executionId, 'running', { processedCount: 5 }).sync }, sync: syncResponse(executionId, 'running', { processedCount: 10 }).sync };
      actualAdvances++;
      if (actualAdvances === 1) return { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } };
      assert.equal(app.mail.sync.processedCount, 10);
      return syncResponse(executionId, 'complete', { processedCount: 15 });
    },
    getContactMailSyncStatus: () => syncResponse(executionId, 'running', { processedCount: 10 }),
  });
  app.mail.sync = syncResponse(executionId).sync;
  await app.ui.advanceContactMailSyncFromUi();
  const pendingId = app.mail.syncProgress.requestId;
  await app.ui.loadContactMailSyncStatus();
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(app.calls[2].args[0].confirmOnly, true);
  assert.equal(app.calls[2].args[0].requestId, pendingId);
  assert.notEqual(app.calls[3].args[0].requestId, pendingId);
  assert.equal(app.mail.sync.processedCount, 15);
  assert.equal(app.mail.syncProgress, null);
});

test('missing or malformed sync receipt stays unresolved without performing another advance', async () => {
  for (const receipt of [null, { sync: { state: 'running' } }]) {
    const executionId = randomUUID();
    const app = uiRuntime({ advanceContactMailSync: (options) => options.confirmOnly ? { ...syncResponse(executionId), found: receipt !== null, receipt } : { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } } });
    app.mail.sync = syncResponse(executionId).sync;
    await app.ui.advanceContactMailSyncFromUi();
    const pendingId = app.mail.syncProgress.requestId;
    await app.ui.advanceContactMailSyncFromUi();
    assert.equal(app.calls.length, 2);
    assert.equal(app.calls[1].args[0].confirmOnly, true);
    assert.equal(app.mail.syncProgress.requestId, pendingId);
    assert.equal(app.mail.syncProgress.requestPending, true);
  }
});

test('first catalog preparation has a client snapshot and retries unknown upload with identical plan', async () => {
  let uploads = 0;
  const digest = 'a'.repeat(64);
  const app = uiRuntime({ advanceContactMailSync: (options) => {
    if (options.prepareCatalog) return { ok: true, catalog: { ...options.catalog, digest, pageCount: 1, total: 1, complete: false, nextPageIndex: 0, startAt: '2026-11-01T00:00:00.000Z' } };
    if (!options.executionId) {
      uploads++;
      if (uploads === 1) return { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } };
      return { ok: true, catalog: { ...options.catalog, complete: true, nextPageIndex: 1 } };
    }
    return syncResponse(options.executionId, 'complete');
  } });
  await app.ui.advanceContactMailSyncFromUi();
  assert.match(app.calls[0].args[0].catalog.snapshotId, /^[a-f0-9-]{36}$/);
  assert.equal(app.calls[0].args[0].prepareCatalog, true);
  const firstUpload = JSON.parse(JSON.stringify(app.calls[1].args[0]));
  assert.equal(firstUpload.catalog.digest, digest);
  await app.ui.advanceContactMailSyncFromUi();
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls[2].args[0])), firstUpload);
  assert.equal(app.mail.syncProgress, null);
});

test('unknown catalog preparation retains the same client snapshot before any write', async () => {
  let preparations = 0;
  const app = uiRuntime({ advanceContactMailSync: (options) => {
    if (options.prepareCatalog && ++preparations === 1) return { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } };
    return options.executionId ? syncResponse(options.executionId, 'complete') : catalogResponse(options);
  } });
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(app.calls.length, 1);
  const first = JSON.parse(JSON.stringify(app.calls[0].args[0]));
  await app.ui.advanceContactMailSyncFromUi();
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls[1].args[0])), first);
  assert.equal(app.calls[2].args[0].catalog.snapshotId, first.catalog.snapshotId);
  assert.equal(app.mail.syncProgress, null);
});

test('unknown catalog upload plus changed Sheet retains the plan until an explicit discard', async () => {
  const ids = [caseId];
  const bridgeApp = bridgeRuntime({ ids });
  let firstUpload = true;
  bridgeApp.respond((envelope) => {
    if (envelope.operation === 'uploadCaseCatalog') {
      if (firstUpload) { firstUpload = false; return { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } }; }
      return { ok: true, catalog: { complete: true } };
    }
    return syncResponse(envelope.payload.executionId, 'complete');
  });
  const app = uiRuntime({ advanceContactMailSync: (options) => bridgeApp.api.advanceContactMailSync(options) });
  await app.ui.advanceContactMailSyncFromUi();
  const originalPlan = JSON.parse(JSON.stringify(app.mail.syncProgress.catalog));
  assert.equal(app.mail.syncProgress.catalogPending, true);
  ids.push('22222222-2222-4222-8222-222222222222');
  await app.ui.advanceContactMailSyncFromUi();
  assert.deepEqual(JSON.parse(JSON.stringify(app.mail.syncProgress.catalog)), originalPlan);
  assert.equal(app.calls.filter((call) => call.args[0].prepareCatalog).length, 1);
  assert.equal(app.calls.some((call) => call.args[0].executionId), false);
  assert.equal(bridgeApp.calls.length, 1);
  assert.equal(app.element('restartMailCatalogButton').hidden, false);
  app.ui.window.confirm = () => false;
  app.ui.discardContactMailCatalogFromUi();
  assert.equal(app.mail.syncProgress.catalog.snapshotId, originalPlan.snapshotId);
  app.ui.window.confirm = () => true;
  app.ui.discardContactMailCatalogFromUi();
  assert.equal(app.mail.syncProgress, null);
  assert.equal(bridgeApp.calls.length, 1);
  await app.ui.advanceContactMailSyncFromUi();
  const plans = app.calls.filter((call) => call.args[0].prepareCatalog);
  assert.equal(plans.length, 2);
  assert.notEqual(plans[1].args[0].catalog.snapshotId, originalPlan.snapshotId);
  assert.equal(app.mail.syncProgress, null);
});

test('GAS local preflight not-sent outcome clears only the unsent request and waits for explicit rebuild', async () => {
  const ids = [caseId];
  const bridgeApp = bridgeRuntime({ ids });
  let changed = false;
  bridgeApp.respond((envelope) => {
    if (envelope.operation === 'uploadCaseCatalog') {
      if (!changed) { changed = true; ids.push('22222222-2222-4222-8222-222222222222'); }
      return { ok: true, catalog: { complete: true } };
    }
    return syncResponse(envelope.payload.executionId, 'complete');
  });
  const app = uiRuntime({ advanceContactMailSync: (options) => bridgeApp.api.advanceContactMailSync(options) });
  await app.ui.advanceContactMailSyncFromUi();
  const first = app.calls.find((call) => call.args[0].executionId).args[0];
  assert.equal(app.mail.syncProgress, null);
  assert.match(app.element('mailSyncSummary').textContent, /Cloudへ送信していません/);
  assert.equal(bridgeApp.calls.length, 1);
  assert.equal(bridgeApp.calls.some((call) => call.envelope.operation === 'getSyncRequestResult'), false);
  await app.ui.advanceContactMailSyncFromUi();
  const next = app.calls.filter((call) => call.args[0].executionId).at(-1).args[0];
  assert.notEqual(next.requestId, first.requestId);
  assert.notEqual(next.executionId, first.executionId);
  assert.equal(app.mail.syncProgress, null);
  assert.equal(bridgeApp.calls.filter((call) => call.envelope.operation === 'advanceSync').length, 1);
});

test('mismatched not-sent metadata cannot clear a pending network-unknown request', async () => {
  const app = uiRuntime({ advanceContactMailSync: (options) => ({ ok: false, error: { code: 'MAIL_SYNC_NOT_DISPATCHED', cause: 'MAIL_CATALOG_CHANGED' }, dispatch: { sent: false, operation: 'advanceSync', executionId: options.executionId, requestId: 'other-request-id' } }) });
  app.mail.sync = syncResponse(randomUUID()).sync;
  await app.ui.advanceContactMailSyncFromUi();
  assert.ok(app.mail.syncProgress.requestId);
  assert.equal(app.mail.syncProgress.requestPending, true);
  assert.equal(app.calls.length, 1);
});

test('recovered GAS token or config resumes the same definitely-unsent request without receipt lookup', async () => {
  for (const failure of ['empty-token', 'token-exception', 'missing-url']) {
    const bridgeApp = bridgeRuntime();
    const originalToken = bridgeApp.api.ScriptApp.getIdentityToken;
    if (failure === 'empty-token') bridgeApp.api.ScriptApp.getIdentityToken = () => '';
    if (failure === 'token-exception') bridgeApp.api.ScriptApp.getIdentityToken = () => { throw new Error('token unavailable'); };
    if (failure === 'missing-url') bridgeApp.setUrl('');
    bridgeApp.respond((envelope) => syncResponse(envelope.payload.executionId, 'complete'));
    const app = uiRuntime({ advanceContactMailSync: (options) => bridgeApp.api.advanceContactMailSync(options) });
    app.mail.sync = syncResponse(randomUUID()).sync;
    await app.ui.advanceContactMailSyncFromUi();
    const request = JSON.parse(JSON.stringify(app.calls[0].args[0]));
    assert.equal(app.mail.syncProgress.requestPending, false);
    assert.equal(app.mail.syncProgress.requestId, request.requestId);
    assert.match(app.element('mailSyncSummary').textContent, /Cloudへ送信していません/);
    assert.equal(bridgeApp.calls.length, 0);
    bridgeApp.api.ScriptApp.getIdentityToken = originalToken;
    bridgeApp.setUrl('https://contact-mail-example.a.run.app');
    await app.ui.advanceContactMailSyncFromUi();
    assert.deepEqual(JSON.parse(JSON.stringify(app.calls[1].args[0])), request);
    assert.equal(bridgeApp.calls.length, 1);
    assert.equal(bridgeApp.calls[0].envelope.operation, 'advanceSync');
    assert.equal(app.mail.syncProgress, null);
  }
});

test('post-dispatch auth failure or timeout remains unknown and uses only receipt confirmation', async () => {
  for (const failure of ['auth', 'timeout']) {
    const bridgeApp = bridgeRuntime();
    bridgeApp.respond((envelope) => {
      if (envelope.operation === 'advanceSync') return failure === 'auth' ? { status: 403, raw: '<html>IAM denied</html>' } : { status: 504, body: { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } } };
      const current = syncResponse(envelope.payload.requestPayload.executionId, 'complete').sync;
      return { ok: true, found: true, receipt: { sync: current }, sync: current };
    });
    const app = uiRuntime({ advanceContactMailSync: (options) => bridgeApp.api.advanceContactMailSync(options) });
    app.mail.sync = syncResponse(randomUUID()).sync;
    await app.ui.advanceContactMailSyncFromUi();
    const requestId = app.mail.syncProgress.requestId;
    assert.equal(app.mail.syncProgress.requestPending, true);
    assert.doesNotMatch(app.element('mailSyncSummary').textContent, /Cloudへ送信していません/);
    const originalToken = bridgeApp.api.ScriptApp.getIdentityToken;
    bridgeApp.api.ScriptApp.getIdentityToken = () => '';
    await app.ui.advanceContactMailSyncFromUi();
    assert.equal(app.calls[1].args[0].confirmOnly, true);
    assert.equal(app.calls[1].args[0].requestId, requestId);
    assert.equal(app.mail.syncProgress.requestPending, true);
    assert.equal(bridgeApp.calls.length, 1);
    assert.doesNotMatch(app.element('mailSyncSummary').textContent, /Cloudへ送信していません/);
    bridgeApp.api.ScriptApp.getIdentityToken = originalToken;
    await app.ui.advanceContactMailSyncFromUi();
    assert.equal(app.calls[2].args[0].confirmOnly, true);
    assert.equal(app.calls[2].args[0].requestId, requestId);
    assert.deepEqual(bridgeApp.calls.map((call) => call.envelope.operation), ['advanceSync', 'getSyncRequestResult']);
    assert.equal(app.mail.syncProgress, null);
  }
});

test('well-formed initial not-started sync status remains observable', async () => {
  const initial = { ...sync, ...Object.fromEntries(['pendingCount', 'unreviewedCount', 'failedCount', 'unavailableCount', 'bodyUnverifiedCount', 'bodyUnavailableCount', 'attachmentUnverifiedCount', 'attachmentUnavailableCount', 'unobservedDeletedCount', 'coverageUnverifiedCaseCount'].map((key) => [key, null])), state: 'not_started', executionId: null, mode: null, cutoffAt: null, startAt: null, lastSuccessAt: null, historyAvailable: false, enumerationComplete: false, noMailContextToken: null };
  const app = uiRuntime({ getContactMailSyncStatus: () => ({ ok: true, sync: initial }) });
  await app.ui.loadContactMailSyncStatus();
  assert.equal(app.mail.sync, initial);
  assert.match(app.element('mailSyncSummary').textContent, /未同期/);
});

test('minimal running sync response is rejected before foreground continuation', async () => {
  const app = uiRuntime({ advanceContactMailSync: (options) => ({ ok: true, sync: { state: 'running', executionId: options.executionId } }) });
  app.mail.sync = syncResponse(randomUUID()).sync;
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(app.calls.length, 1);
  assert.ok(app.mail.syncProgress.requestId);
  assert.match(app.element('mailSyncSummary').textContent, /応答を確認できません/);
});

test('inconsistent sync progress fields stop without adopting or advancing the response', async () => {
  for (const change of [
    { remainingPages: false }, { processedCount: undefined }, { processedCount: NaN }, { processedCount: Infinity }, { processedCount: -1 },
    { enumerationComplete: true }, { phase: 'unknown' }, { mode: 'unknown' }, { cutoffAt: 'invalid' }, { cutoffAt: '2026-02-30T00:00:00Z' },
    { pendingCount: -1 }, { bodyUnverifiedCount: undefined }, { coverageUnverifiedCaseCount: Infinity }, { acceptanceReady: true },
    { processedCount: 3 }, { cutoffAt: '2026-11-11T00:00:00Z' }, { startAt: '2026-11-01T00:00:00Z' }, { mode: 'history' },
  ]) {
    const executionId = randomUUID();
    const app = uiRuntime({ advanceContactMailSync: () => syncResponse(executionId, 'running', change) });
    const previous = syncResponse(executionId, 'running', { processedCount: 4 }).sync;
    app.mail.sync = previous;
    await app.ui.advanceContactMailSyncFromUi();
    assert.equal(app.calls.length, 1, JSON.stringify(change));
    assert.equal(app.mail.sync, previous);
    assert.ok(app.mail.syncProgress.requestId);
    assert.match(app.element('mailSyncSummary').textContent, /応答を確認できません/);
  }
});

test('malformed status observation cannot replace a pending unknown-result request', async () => {
  const executionId = randomUUID();
  const app = uiRuntime({
    advanceContactMailSync: () => ({ ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } }),
    getContactMailSyncStatus: () => ({ ok: true, sync: { state: 'failed', executionId } }),
  });
  app.mail.sync = syncResponse(executionId).sync;
  await app.ui.advanceContactMailSyncFromUi();
  const requestId = app.mail.syncProgress.requestId;
  await app.ui.loadContactMailSyncStatus();
  assert.equal(app.mail.syncProgress.requestId, requestId);
  assert.equal(app.mail.sync.state, 'running');
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

test('validated pending refresh recovers expired re-evaluation without resending an unknown request', async () => {
  for (const code of ['MAIL_REQUEST_EXPIRED', 'MAIL_UPSTREAM_TIMEOUT']) {
    let readback = 'valid';
    let writes = 0;
    const app = uiRuntime({
      listContactMail: () => readback === 'failed' ? { ok: false, error: { code: 'MAIL_SERVICE_UNAVAILABLE' } } :
        readback === 'invalid' ? { ...list([]), page: null } : list([]),
      reconcileContactMailPending: () => ++writes === 1 ? { ok: false, error: { code } } :
        { ok: true, processedCount: 0, page: { nextPageToken: '' }, sync },
    });
    app.mail.queue.scope = 'pending';
    await app.ui.loadContactMailList('queue');
    app.mail.queue.reconcilePageToken = 'old-page';
    await app.ui.reconcileContactMailPendingFromUi();
    const originalId = app.mail.queue.reconcileRequestId;
    assert.ok(originalId);
    for (readback of ['failed', 'invalid']) {
      await app.ui.loadContactMailList('queue');
      assert.equal(app.mail.queue.reconcileRequestId, originalId);
      assert.equal(app.mail.queue.reconcilePageToken, 'old-page');
      assert.equal(writes, 1);
    }
    readback = 'valid';
    await app.ui.loadContactMailList('queue');
    assert.equal(writes, 1);
    assert.equal(app.mail.queue.reconcileRequestId, code === 'MAIL_REQUEST_EXPIRED' ? '' : originalId);
    assert.equal(app.mail.queue.reconcilePageToken, code === 'MAIL_REQUEST_EXPIRED' ? '' : 'old-page');
    await app.ui.reconcileContactMailPendingFromUi();
    const requests = app.calls.filter((call) => call.name === 'reconcileContactMailPending');
    assert.equal(writes, 2);
    assert.equal(requests[1].args[0].pageToken, code === 'MAIL_REQUEST_EXPIRED' ? '' : 'old-page');
    if (code === 'MAIL_REQUEST_EXPIRED') assert.notEqual(requests[1].args[0].requestId, originalId);
    else assert.equal(requests[1].args[0].requestId, originalId);
  }
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

test('unscoped initial and legacy sync status keeps unknown counts and permits an explicit full start', async () => {
  const unknownCounts = Object.fromEntries(['pendingCount', 'unreviewedCount', 'failedCount', 'unavailableCount', 'bodyUnverifiedCount', 'bodyUnavailableCount', 'attachmentUnverifiedCount', 'attachmentUnavailableCount', 'unobservedDeletedCount', 'coverageUnverifiedCaseCount'].map((key) => [key, null]));
  for (const state of ['not_started', 'needs_full_sync']) {
    const stopped = { ...sync, ...unknownCounts, state, startAt: null, historyAvailable: false, enumerationComplete: false, acceptanceReady: false, noMailContextToken: null,
      ...(state === 'not_started' ? { executionId: null, mode: null, cutoffAt: null, lastSuccessAt: null } : {}) };
    const app = uiRuntime({ getContactMailSyncStatus: () => ({ ok: true, sync: stopped }),
      advanceContactMailSync: (options) => !options.executionId ? catalogResponse(options) : syncCallResponse(options, 'complete') });
    await app.ui.loadContactMailSyncStatus();
    assert.equal(app.mail.sync.state, state);
    assert.match(app.element('mailSyncSummary').textContent, /照合待ち 不明件/);
    assert.doesNotMatch(app.element('mailSyncSummary').textContent, /技術残件は0件|応答形式/);
    await app.ui.advanceContactMailSyncFromUi();
    const request = app.calls.find((call) => call.args[0]?.executionId).args[0];
    assert.equal(request.mode, 'full');
    assert.equal(app.mail.sync.state, 'complete');
  }
});

test('catalog preparation without a valid period never advances to an upload or sync', async () => {
  const app = uiRuntime({ advanceContactMailSync: (options) => ({ ...catalogResponse(options), catalog: { ...catalogResponse(options).catalog, startAt: null } }) });
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].args[0].prepareCatalog, true);
  assert.match(app.element('mailSyncSummary').textContent, /メールの応答を確認できません/);
});

test('invalid authoritative dates after catalog upload are definitely unsent and recover with the original request', async () => {
  const dates = ['2026-11-10T00:00:00.000Z'];
  const bridgeApp = bridgeRuntime({ dates });
  bridgeApp.respond((envelope) => {
    if (envelope.operation === 'uploadCaseCatalog') { dates[0] = ''; return { ok: true, catalog: { complete: true } }; }
    return syncResponse(envelope.payload.executionId, 'complete');
  });
  const app = uiRuntime({ advanceContactMailSync: (options) => bridgeApp.api.advanceContactMailSync(options) });
  await app.ui.advanceContactMailSyncFromUi();
  const original = JSON.parse(JSON.stringify(app.calls.find((call) => call.args[0].executionId).args[0]));
  assert.equal(bridgeApp.calls.some((call) => call.envelope.operation === 'advanceSync'), false);
  assert.equal(app.mail.syncProgress.requestPending, false);
  assert.match(app.element('mailSyncSummary').textContent, /Cloudへ送信していません/);
  dates[0] = '2026-11-10T00:00:00.000Z';
  await app.ui.advanceContactMailSyncFromUi();
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls.at(-1).args[0])), original);
  assert.equal(bridgeApp.calls.filter((call) => call.envelope.operation === 'advanceSync').length, 1);
  assert.equal(bridgeApp.calls.some((call) => call.envelope.operation === 'getSyncRequestResult'), false);
  assert.equal(app.mail.syncProgress, null);
});


test('catalog source failure before dispatch requires an explicit rebuild without a phantom receipt', async () => {
  const ids = [caseId];
  const bridgeApp = bridgeRuntime({ ids });
  let firstUpload = true;
  bridgeApp.respond((envelope) => {
    if (envelope.operation === 'uploadCaseCatalog') {
      if (firstUpload) { firstUpload = false; ids.push(caseId); }
      return { ok: true, catalog: { complete: true } };
    }
    return syncResponse(envelope.payload.executionId, 'complete');
  });
  const app = uiRuntime({ advanceContactMailSync: (options) => bridgeApp.api.advanceContactMailSync(options) });
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(app.mail.syncProgress, null);
  assert.equal(bridgeApp.calls.some((call) => ['advanceSync', 'getSyncRequestResult'].includes(call.envelope.operation)), false);
  assert.match(app.element('mailSyncSummary').textContent, /Cloudへ送信していません/);
  ids.pop();
  await app.ui.advanceContactMailSyncFromUi();
  assert.equal(bridgeApp.calls.filter((call) => call.envelope.operation === 'advanceSync').length, 1);
  assert.equal(bridgeApp.calls.some((call) => call.envelope.operation === 'getSyncRequestResult'), false);
  assert.equal(app.mail.syncProgress, null);
});


test('late advance and receipt responses preserve a newer observed period and the immutable pending request', async () => {
  for (const receipt of [false, true]) for (const changedPeriod of [false, true]) {
    const oldStartAt = '2026-01-01T00:00:00.000Z';
    const broad = { ...sync, startAt: oldStartAt, pendingCount: 99 };
    const narrow = { ...sync, executionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', startAt: changedPeriod ? sync.startAt : oldStartAt, pendingCount: 2 };
    let useNarrow = false;
    let resolveSync;
    let advanceCount = 0;
    const app = uiRuntime({
      listContactMail: () => ({ ...list([]), sync: useNarrow ? narrow : broad }),
      advanceContactMailSync: (options) => {
        if (!options.executionId) return { ...catalogResponse(options), catalog: { ...catalogResponse(options).catalog, startAt: oldStartAt } };
        advanceCount++;
        if (receipt && advanceCount === 1) return { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } };
        return new Promise((resolve) => { resolveSync = () => resolve(syncCallResponse(options, 'complete', { startAt: oldStartAt, pendingCount: 99 })); });
      },
    });
    await app.ui.loadContactMailList('case', { caseId });
    if (receipt) await app.ui.advanceContactMailSyncFromUi();
    const waiting = app.ui.advanceContactMailSyncFromUi();
    for (let turn = 0; !resolveSync && turn < 20; turn++) await Promise.resolve();
    assert.ok(resolveSync);
    const requestId = app.mail.syncProgress.requestId;
    const requestPayload = JSON.parse(JSON.stringify(app.mail.syncProgress.requestPayload));
    useNarrow = true;
    await app.ui.loadContactMailList('case', { caseId });
    resolveSync();
    await waiting;
    assert.equal(app.mail.sync, narrow);
    assert.equal(app.mail.periodStartAt, narrow.startAt);
    assert.equal(app.mail.syncProgress.requestId, requestId);
    assert.deepEqual(JSON.parse(JSON.stringify(app.mail.syncProgress.requestPayload)), requestPayload);
    assert.equal(app.mail.syncProgress.requestPending, true);
    assert.equal(advanceCount, receipt ? 2 : 1);
    assert.match(app.element('mailSyncSummary').textContent, /照合待ち 2件/);
    assert.doesNotMatch(app.element('mailSyncSummary').textContent, /照合待ち 99件/);
    assert.match(app.element('mailSyncSummary').textContent, /元の要求IDと内容を保持/);
    assert.equal(app.mail.syncBusy, false);
  }
});

test('list, issue and reconcile reject partial or inconsistent sync state before adoption', async () => {
  const malformed = [
    { state: 'complete', startAt: sync.startAt, pendingCount: 8, acceptanceReady: true },
    { ...sync, pendingCount: 8, bodyUnverifiedCount: 0, acceptanceReady: true },
  ];
  for (const operation of ['list', 'issues', 'reconcile']) for (const invalid of malformed) {
    let invalidResponse = false;
    const app = uiRuntime({
      listContactMail: () => ({ ...list([]), sync: invalidResponse ? invalid : sync }),
      listContactMailIssues: (options) => ({ ok: true, kind: options.kind, targets: [], scannedCount: 0, page: { pageSize: 50, nextPageToken: '' }, sync: invalid }),
      reconcileContactMailPending: () => ({ ok: true, processedCount: 0, page: { nextPageToken: '' }, sync: invalid }),
    });
    app.mail.queue.scope = 'pending';
    await app.ui.loadContactMailList('queue');
    const observationSerial = app.mail.syncObservationSerial;
    invalidResponse = true;
    if (operation === 'list') await app.ui.loadContactMailList('queue');
    else if (operation === 'issues') await app.ui.loadContactMailIssues();
    else await app.ui.reconcileContactMailPendingFromUi();
    assert.equal(app.mail.sync, sync);
    assert.equal(app.mail.syncObservationSerial, observationSerial);
    assert.equal(app.mail.sync.acceptanceReady, false);
    assert.doesNotMatch(app.element('mailSyncSummary').textContent, /技術残件は0件/);
    assert.match(app.element('mailQueueContent').innerHTML, /メールの応答を確認できません/);
    if (operation === 'reconcile') assert.ok(app.mail.queue.reconcileRequestId);
  }
});


test('newer observed counts cannot hide definite non-dispatch while post-dispatch timeout stays receipt-only', async () => {
  for (const failure of ['not-sent', 'post-dispatch-timeout']) {
    const executionId = randomUUID();
    const newer = syncResponse(executionId, 'running', { processedCount: 1, pendingCount: 2 }).sync;
    const completed = syncResponse(executionId, 'complete', { processedCount: 2, pendingCount: 2 }).sync;
    const bridgeApp = bridgeRuntime();
    const originalToken = bridgeApp.api.ScriptApp.getIdentityToken;
    if (failure === 'not-sent') bridgeApp.api.ScriptApp.getIdentityToken = () => '';
    bridgeApp.respond((envelope) => envelope.operation === 'advanceSync' && failure === 'post-dispatch-timeout' ?
      { status: 504, body: { ok: false, error: { code: 'MAIL_UPSTREAM_TIMEOUT' } } } :
      envelope.operation === 'getSyncRequestResult' ? { ok: true, found: true, receipt: { sync: completed }, sync: completed } : { ok: true, sync: completed });
    let release;
    let first = true;
    const app = uiRuntime({
      listContactMail: () => ({ ...list([]), sync: newer, noMail: noMail({ contextToken: newer.noMailContextToken }) }),
      advanceContactMailSync: (options) => {
        const result = bridgeApp.api.advanceContactMailSync(options);
        if (!first) return result;
        first = false;
        return new Promise((resolve) => { release = () => resolve(result); });
      },
    });
    app.mail.sync = syncResponse(executionId).sync;
    const waiting = app.ui.advanceContactMailSyncFromUi();
    for (let turn = 0; !release && turn < 20; turn++) await Promise.resolve();
    assert.ok(release);
    const original = JSON.parse(JSON.stringify(app.calls.find((call) => call.name === 'advanceContactMailSync').args[0]));
    await app.ui.loadContactMailList('case', { caseId });
    release();
    await waiting;
    assert.equal(app.mail.sync, newer);
    assert.match(app.element('mailSyncSummary').textContent, /照合待ち 2件/);
    assert.equal(app.mail.syncProgress.requestId, original.requestId);
    assert.equal(app.mail.syncProgress.requestPending, failure !== 'not-sent');
    if (failure === 'not-sent') assert.match(app.element('mailSyncSummary').textContent, /Cloudへ送信していません/);
    else assert.doesNotMatch(app.element('mailSyncSummary').textContent, /Cloudへ送信していません/);
    bridgeApp.api.ScriptApp.getIdentityToken = originalToken;
    await app.ui.advanceContactMailSyncFromUi();
    const retry = app.calls.filter((call) => call.name === 'advanceContactMailSync').at(-1).args[0];
    assert.equal(retry.requestId, original.requestId);
    if (failure === 'not-sent') assert.deepEqual(JSON.parse(JSON.stringify(retry)), original);
    else assert.equal(retry.confirmOnly, true);
    assert.deepEqual(bridgeApp.calls.map((call) => call.envelope.operation), failure === 'not-sent' ? ['advanceSync'] : ['advanceSync', 'getSyncRequestResult']);
    assert.equal(app.mail.syncProgress, null);
  }
});


test('definite catalog non-dispatch clears an obsolete plan without replacing a newer period', async () => {
  for (const cause of ['MAIL_CATALOG_CHANGED', 'MAIL_CATALOG_INVALID']) {
    const executionId = randomUUID();
    const newer = { ...sync, executionId: randomUUID(), startAt: '2026-11-05T00:00:00.000Z', pendingCount: 2 };
    let release;
    const app = uiRuntime({ listContactMail: () => ({ ...list([]), sync: newer }),
      advanceContactMailSync: (options) => new Promise((resolve) => { release = () => resolve({ ok: false,
        error: { code: 'MAIL_SYNC_NOT_DISPATCHED', cause },
        dispatch: { sent: false, operation: 'advanceSync', requestId: options.requestId, executionId: options.executionId } }); }) });
    app.mail.sync = syncResponse(executionId).sync;
    const waiting = app.ui.advanceContactMailSyncFromUi();
    for (let turn = 0; !release && turn < 20; turn++) await Promise.resolve();
    assert.ok(release);
    await app.ui.loadContactMailList('case', { caseId });
    release();
    await waiting;
    assert.equal(app.mail.sync, newer);
    assert.equal(app.mail.periodStartAt, newer.startAt);
    assert.equal(app.mail.syncProgress, null);
    assert.match(app.element('mailSyncSummary').textContent, /照合待ち 2件/);
    assert.match(app.element('mailSyncSummary').textContent, /Cloudへ送信していません/);
    assert.equal(app.calls.filter((call) => call.name === 'advanceContactMailSync').length, 1);
  }
});


test('authoritative closure metadata is paged and changing only closure invalidates an upload plan', () => {
  const statuses = ['対応済み']; const closedDates = [''];
  const app = bridgeRuntime({ statuses, closedDates });
  app.respond(() => ({ ok: true, catalog: { complete: true } }));
  const plan = app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }).catalog;
  app.api.advanceContactMailSync({ catalog: plan });
  assert.deepEqual(JSON.parse(JSON.stringify(app.calls[0].envelope.payload.cases)), [{ caseId, handledStatus: '対応済み', closedAt: null }]);
  closedDates[0] = '2026-11-10T00:00:00.000Z';
  assert.equal(app.api.advanceContactMailSync({ catalog: plan }).error.code, 'CONFLICT');
  const revised = app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }).catalog;
  assert.notEqual(revised.digest, plan.digest);
  statuses[0] = '未対応';
  assert.throws(() => app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } }), /MAIL_CATALOG_INVALID/);
});

test('retention residual counts are visible and can never accompany technical readiness', () => {
  const app = uiRuntime();
  const value = { ...sync, unknownClosureCaseCount: 2, expiredCaseCount: 3 };
  app.ui.validateContactMailSync(value);
  assert.match(app.ui.renderContactMailSync(value), /終了日未確認 2件・保存期限到来 3件/);
  assert.throws(() => app.ui.validateContactMailSync({ ...value, acceptanceReady: true }), /MAIL_INVALID_RESPONSE/);
  assert.throws(() => app.ui.validateContactMailSync({ ...sync, unknownClosureCaseCount: undefined }), /MAIL_INVALID_RESPONSE/);
});


test('closure before receipt fails closed while equal and later receipt times are allowed', () => {
  const submitted = '2026-01-01T00:00:00.000Z';
  for (const closedAt of ['2025-12-31T23:59:59.999Z', submitted, '2026-01-01T00:00:00.001Z']) {
    const app = bridgeRuntime({ dates: [submitted], statuses: ['対応済み'], closedDates: [closedAt], historyStartAt: '2025-12-30T15:00:00.000Z' });
    const operation = () => app.api.advanceContactMailSync({ prepareCatalog: true, catalog: { snapshotId: randomUUID() } });
    if (closedAt < submitted) assert.throws(operation, /MAIL_CATALOG_INVALID/);
    else assert.equal(operation().ok, true);
    assert.equal(app.calls.length, 0);
  }
});


test('catalog page identities survive a lost response and cannot be renewed after the planned deadline', async () => {
  const at = '2026-11-10T09:00:00.000Z';
  const ids = Array.from({ length: 201 }, (_, index) => `${index.toString(16).padStart(8, '0')}-1111-4111-8111-111111111111`);
  const app = bridgeRuntime({ ids });
  app.respond(() => ({ ok: true, catalog: { complete: true } }));
  const plan = app.api.advanceContactMailSync({ prepareCatalog: true,
    catalog: { snapshotId: randomUUID(), requestId: createRequestId(new Date(at)) } }).catalog;
  app.api.advanceContactMailSync({ catalog: plan });
  const first = app.calls.map((call) => call.envelope);
  app.api.advanceContactMailSync({ catalog: plan });
  const retry = app.calls.slice(2).map((call) => call.envelope);
  assert.equal(first.length, 2);
  assert.notEqual(first[0].requestId, first[1].requestId);
  assert.deepEqual(first.map((item) => item.requestId), retry.map((item) => item.requestId));
  assert.equal(requestExpiresAt(first[0].requestId), '2026-11-17T09:00:00.000Z');
  assert.equal(requestExpiresAt(first[1].requestId), '2026-11-17T09:00:00.000Z');
  let clock = new Date(at);
  const store = fakeStore();
  const execute = createMailService({ store, gmail: {}, core: {}, now: () => clock });
  for (const envelope of first) await execute({ ...envelope, issuedAt: clock.toISOString() });
  const committed = await store.getCatalog();
  clock = new Date('2026-11-17T08:59:59.999Z');
  for (const envelope of retry) await execute({ ...envelope, issuedAt: clock.toISOString() });
  assert.deepEqual(await store.getCatalog(), committed);
  clock = new Date('2026-11-17T09:00:00.000Z');
  await assert.rejects(execute({ ...retry[0], issuedAt: clock.toISOString() }), { code: 'MAIL_REQUEST_EXPIRED' });
  assert.deepEqual(await store.getCatalog(), committed);
  let attempts = 0;
  const pending = uiRuntime({ advanceContactMailSync: (options) => options.prepareCatalog ? catalogResponse(options) :
    { ok: false, error: { code: ++attempts === 1 ? 'MAIL_UPSTREAM_TIMEOUT' : 'MAIL_REQUEST_EXPIRED' } } });
  await pending.ui.advanceContactMailSyncFromUi();
  const lost = JSON.parse(JSON.stringify(pending.mail.syncProgress.catalog));
  await pending.ui.advanceContactMailSyncFromUi();
  assert.deepEqual(JSON.parse(JSON.stringify(pending.mail.syncProgress.catalog)), lost);
  assert.equal(pending.mail.syncProgress.catalogPending, true);
  assert.equal(pending.mail.syncProgress.executionId, undefined);
  assert.equal(pending.calls.filter((call) => call.args[0].prepareCatalog).length, 1);
  assert.match(pending.element('mailSyncSummary').textContent, /7日.*自動では再送しません/);
});

test('validated no-mail refresh resolves an expired operation before a new explicit confirmation', async () => {
  for (const committed of [false, true]) {
    let refreshed = false;
    let writes = 0;
    const app = uiRuntime({
      listContactMail: () => ({ ...list([]), noMail: noMail(committed && refreshed ? { confirmation: noMailConfirmation } : { eligible: true }) }),
      confirmContactCaseNoMail: () => ++writes === 1 ? { ok: false, error: { code: 'MAIL_REQUEST_EXPIRED' } } :
        { ok: true, noMail: noMail({ confirmation: noMailConfirmation }), sync },
    });
    await app.ui.loadContactMailList('case', { caseId });
    await app.ui.confirmContactCaseNoMailFromUi('case');
    const expiredId = app.mail.case.pendingNoMail.requestId;
    assert.equal(app.mail.case.pendingNoMail.expired, true);
    refreshed = true;
    await app.ui.loadContactMailList('case', { caseId });
    assert.equal(writes, 1);
    assert.equal(app.mail.case.pendingNoMail, null);
    await app.ui.confirmContactCaseNoMailFromUi('case');
    if (committed) {
      assert.equal(writes, 1);
      assert.equal(app.mail.case.noMail.confirmation.email, noMailConfirmation.email);
    } else {
      assert.equal(writes, 2);
      const requests = app.calls.filter((call) => call.name === 'confirmContactCaseNoMail');
      assert.notEqual(requests[1].args[0].requestId, expiredId);
      assert.equal(app.mail.case.noMail.confirmation.email, noMailConfirmation.email);
    }
  }
});
