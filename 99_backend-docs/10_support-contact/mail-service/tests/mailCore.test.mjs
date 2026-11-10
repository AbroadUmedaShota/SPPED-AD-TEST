import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMessage } from '../classification.mjs';
import { inspectMime, readMailAttachment, readMessageText } from '../mime.mjs';
import { classifyManually, recordFirstReview } from '../review.mjs';
import { applySyncPage, beginSync, buildReconciliationReport, failSync } from '../sync.mjs';
import { htmlToPlainText, scrubSecretUrls } from '../safeMail.mjs';

const caseA = '11111111-1111-4111-8111-111111111111';
const caseB = '22222222-2222-4222-8222-222222222222';
const caseIds = [caseA, caseB];
const actor = { email: 'operator@example.com', verified: true };
const at = '2026-11-10T09:00:00.000Z';
const part = (text, mimeType = 'text/plain', extra = {}) => {
  const bytes = Buffer.from(text);
  return { mimeType, body: { data: bytes.toString('base64url'), size: bytes.length }, ...extra };
};
const message = (payload, id = 'mail1') => ({ id, payload });
const matched = { messageId: 'mail1', caseId: caseA, matchState: 'matched', version: 0 };

test('only a trusted current-body case anchor automatically matches', () => {
  const data = { bodyText: `受付ID: ${caseA}` };
  assert.equal(classifyMessage(data, caseIds).matchState, 'pending');
  assert.equal(classifyMessage({ ...data, trustedAnchor: true }, caseIds).caseId, caseA);
  assert.equal(classifyMessage({ bodyText: `件名: ${caseA}`, headers: [{ name: 'From', value: 'customer@example.com' }] }, caseIds).matchState, 'pending');
});

test('quoted-only, multiple, unknown and mixed cases remain pending', () => {
  for (const bodyText of [`返信します\n> 受付ID: ${caseA}`, `On Monday, someone wrote:\n受付ID: ${caseA}`, `受付ID: ${caseA}\n> ${caseB}`, '受付ID: 33333333-3333-4333-8333-333333333333']) {
    assert.equal(classifyMessage({ bodyText, trustedAnchor: true }, caseIds).matchState, 'pending');
  }
});

test('verified RFC reply ancestry resolves an individual message, never a thread alone', () => {
  const headers = [{ name: 'In-Reply-To', value: '<parent@example.com>' }];
  const parent = { ...matched, rfcMessageId: '<parent@example.com>' };
  assert.equal(classifyMessage({ headers }, caseIds, [parent]).caseId, caseA);
  assert.equal(classifyMessage({ threadId: 'same-thread' }, caseIds, [parent]).matchState, 'pending');
  assert.equal(classifyMessage({ headers, bodyText: caseB }, caseIds, [parent]).reason, 'conflicting_reply_case');
  assert.equal(classifyMessage({ headers }, caseIds, [{ ...parent, matchState: 'pending' }]).reason, 'unresolved_reply_parent');
});

test('mixed reply ancestors remain pending even if a current anchor exists', () => {
  const headers = [{ name: 'References', value: '<parent@example.com> <other@example.com>' }];
  const parents = [{ ...matched, rfcMessageId: '<parent@example.com>' }, { ...matched, messageId: 'mail2', caseId: caseB, rfcMessageId: '<other@example.com>' }];
  assert.equal(classifyMessage({ headers, bodyText: caseA, trustedAnchor: true }, caseIds, parents).reason, 'multiple_cases');
});

test('an unknown immediate parent cannot inherit an older matched ancestor', () => {
  const headers = [{ name: 'In-Reply-To', value: '<unknown@example.com>' }, { name: 'References', value: '<parent@example.com> <unknown@example.com>' }];
  const parents = [{ ...matched, rfcMessageId: '<parent@example.com>' }];
  assert.equal(classifyMessage({ headers }, caseIds, parents).reason, 'unresolved_reply_parent');
});

test('nested multipart resolves plain body and image attachment ownership', async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const mail = message({ mimeType: 'multipart/mixed', parts: [{ mimeType: 'multipart/alternative', parts: [part('<p>HTML</p>', 'text/html'), part('本文')] }, { mimeType: 'image/png', filename: 'picture.png', body: { attachmentId: 'att1', size: png.length } }] });
  assert.equal(await readMessageText(mail), '本文');
  const attachment = inspectMime(mail).attachments[0];
  assert.equal(attachment.partId, '0.1');
  const observed = [];
  const content = await readMailAttachment(mail, '0.1', async (...args) => {
    observed.push(args);
    return { data: png.toString('base64url') };
  });
  assert.deepEqual(observed, [['mail1', 'att1']]);
  assert.equal(content.previewKind, 'image');
  assert.deepEqual(content.bytes, png);
  await assert.rejects(readMailAttachment(mail, '0.0.1'), /MAIL_ATTACHMENT_NOT_FOUND/);
});

test('body stored behind attachmentId is fetched but is not a form attachment', async () => {
  const mail = message({ mimeType: 'text/plain', body: { attachmentId: 'body1', size: 4 } });
  assert.equal(inspectMime(mail).attachments.length, 0);
  assert.equal(await readMessageText(mail, async () => ({ data: Buffer.from('body').toString('base64url') })), 'body');
  await assert.rejects(readMessageText(mail), /MAIL_CONTENT_UNAVAILABLE/);
});

test('an attached forwarded message never becomes the current message body', async () => {
  const mail = message({ mimeType: 'multipart/mixed', parts: [part('current'), { mimeType: 'message/rfc822', filename: 'forward.eml', body: { size: 0 }, parts: [part('quoted attachment body')] }] });
  assert.equal(await readMessageText(mail), 'current');
  assert.equal(inspectMime(mail).attachments.length, 1);
});

test('HTML is rendered as inert text and secret links are removed', async () => {
  const mail = message(part('<script>alert(1)</script><p>A &amp; B</p><a href="https://example.com/#token=secret">open</a>', 'text/html'));
  const text = await readMessageText(mail);
  assert.equal(text.includes('alert'), false);
  assert.equal(text.includes('secret'), false);
  assert.match(text, /A & B/);
  assert.equal(htmlToPlainText('<img src=x onerror="bad()">hello'), 'hello');
  for (const url of ['https://example.com/#token=secret', 'https://example.com/?id=x&token=secret', 'https://example.com/%23token%3Dsecret']) {
    assert.equal(scrubSecretUrls(url), '[リンクを非表示]');
  }
  assert.equal(scrubSecretUrls('https://example.com/?id=123'), 'https://example.com/?id=123');
});

test('encoded secret URLs are scrubbed without changing surrounding text or safe URL spelling', () => {
  const raw = 'https://example.com/view#token=TEST_SECRET';
  const variants = [raw, encodeURIComponent(raw), encodeURIComponent(encodeURIComponent(raw)),
    'https&#58;&#47;&#47;example.com/view&#35;token&#61;TEST_SECRET',
    'https&colon;&sol;&sol;example.com/view&num;token&equals;TEST_SECRET',
    'https&amp;colon;&amp;sol;&amp;sol;example.com/view&amp;num;token&amp;equals;TEST_SECRET'];
  for (const url of variants) assert.equal(scrubSecretUrls(`前 ${url} 後`), '前 [リンクを非表示] 後');
  const safe = encodeURIComponent('https://example.com/?id=123&label=日本語');
  assert.equal(scrubSecretUrls(`前 ${safe} 後`), `前 ${safe} 後`);
  const percent = 'https://example.com/?label=100%25';
  assert.equal(scrubSecretUrls(`前 ${percent} 後`), `前 ${percent} 後`);
  const deep = encodeURIComponent(encodeURIComponent(encodeURIComponent(encodeURIComponent(raw))));
  assert.equal(scrubSecretUrls(`前 ${deep} 後`), '前 [リンクを非表示] 後');
  assert.equal(scrubSecretUrls('https の説明と 100% の文章'), 'https の説明と 100% の文章');
});

test('inline CID image and zero byte text attachment are preserved', async () => {
  const mail = message({ mimeType: 'multipart/mixed', parts: [{ mimeType: 'image/png', headers: [{ name: 'Content-ID', value: '<img1>' }], body: { data: '', size: 0 } }, part('', 'text/plain', { filename: 'empty.txt' })] });
  const attachments = inspectMime(mail).attachments;
  assert.equal(attachments[0].inline, true);
  const empty = await readMailAttachment(mail, '0.1');
  assert.equal(empty.previewKind, 'text');
  assert.equal(empty.bytes.length, 0);
});

test('unsafe or mislabelled content is downloadable only and cannot become active HTML', async () => {
  for (const mimeType of ['image/svg+xml', 'image/png', 'text/html', 'application/pdf']) {
    const result = await readMailAttachment(message(part('<script>bad()</script>', mimeType, { filename: '../unsafe.html' })), '0');
    assert.equal(result.previewKind, 'download');
    assert.equal(result.mimeType, 'application/octet-stream');
    assert.equal(result.name.includes('/'), false);
  }
});

test('MIME limits and byte mismatches fail closed', async () => {
  assert.throws(() => inspectMime(message({ mimeType: 'multipart/mixed', parts: [part('x')] }), { maxParts: 1 }), /MIME_STRUCTURE_LIMIT/);
  const wrongSize = message(part('x'));
  wrongSize.payload.body.size = 2;
  await assert.rejects(readMessageText(wrongSize), /MIME_SIZE_MISMATCH/);
  await assert.rejects(readMessageText(message(part('large')), null, { maxTextBytes: 2 }), /MAIL_SIZE_LIMIT/);
  const invalid = message(part('x'));
  invalid.payload.body.data = 'invalid$';
  await assert.rejects(readMessageText(invalid), /INVALID_MIME_DATA/);
});

test('default attachment limit admits 32MiB metadata and excess remains an acceptance blocker', async () => {
  const limit = 32 * 1024 * 1024;
  const mail = message({ mimeType: 'application/octet-stream', filename: 'large.bin', body: { attachmentId: 'large1', size: limit } });
  let fetchCount = 0;
  const fetchAttachment = async () => {
    fetchCount += 1;
    throw new Error('TEST_FETCH_REACHED');
  };
  await assert.rejects(readMailAttachment(mail, '0', fetchAttachment), /TEST_FETCH_REACHED/);
  mail.payload.body.size = limit + 1;
  await assert.rejects(readMailAttachment(mail, '0', fetchAttachment), /MAIL_SIZE_LIMIT/);
  assert.equal(fetchCount, 1);
  const synced = applySyncPage(beginSync({ cutoffAt: at }), { messages: [{ id: mail.id }] });
  const report = buildReconciliationReport(synced, [{ ...matched, unavailableAttachmentCount: 1 }], [caseA]);
  assert.equal(report.counts.unavailableAttachments, 1);
  assert.equal(report.complete, false);
});

test('first explicit review is immutable and uses verified server actor and time', () => {
  const first = recordFirstReview(matched, actor, at);
  assert.deepEqual(first.record.firstReview, { email: actor.email, at });
  assert.equal(first.created, true);
  const second = recordFirstReview(first.record, { email: 'other@example.com', verified: true }, '2026-11-11');
  assert.equal(second.record, first.record);
  assert.equal(second.created, false);
  assert.equal(second.event, null);
  assert.throws(() => recordFirstReview(matched, { email: 'spoof@example.com' }, at), /VERIFIED_ACTOR_REQUIRED/);
  assert.throws(() => recordFirstReview({ ...matched, matchState: 'pending' }, actor, at), /MATCHED_MAIL_REQUIRED/);
});

test('manual match and exclusion require current version, known case and auditable reason', () => {
  const result = classifyManually({ ...matched, matchState: 'pending', caseId: null }, { matchState: 'matched', caseId: caseB, expectedVersion: 0, reason: '受付内容と照合' }, actor, at, caseIds);
  assert.equal(result.record.caseId, caseB);
  assert.equal(result.event.previous.matchState, 'pending');
  assert.equal(result.event.actor, actor.email);
  assert.throws(() => classifyManually(result.record, { matchState: 'excluded', expectedVersion: 0, reason: '対象外' }, actor, at, caseIds), /MAIL_VERSION_CONFLICT/);
  assert.throws(() => classifyManually(matched, { matchState: 'matched', caseId: 'missing', expectedVersion: 0, reason: '理由' }, actor, at, caseIds), /CASE_NOT_FOUND/);
  const excluded = classifyManually(matched, { matchState: 'excluded', expectedVersion: 0, reason: 'https://example.com/#token=secret' }, actor, at, caseIds);
  assert.equal(excluded.event.reason.includes('secret'), false);
  assert.equal(excluded.record.caseId, null);
  assert.equal('handled_status' in excluded.record, false);
});

test('sync pages are deterministic, deduplicated and only complete after last page', () => {
  const initial = beginSync({ cutoffAt: at, historyId: '100' });
  const first = applySyncPage(initial, { messages: [{ id: 'b' }, { id: 'a' }], nextPageToken: 'page2' });
  assert.equal(first.complete, false);
  assert.equal(first.committedHistoryId, null);
  const last = applySyncPage(first, { messages: [{ id: 'a' }, { id: 'c' }] }, 'page2');
  assert.deepEqual(last.messageIds, ['a', 'b', 'c']);
  assert.equal(last.complete, true);
  assert.equal(last.committedHistoryId, '100');
  assert.throws(() => applySyncPage(first, { nextPageToken: 'page2' }, 'page2'), /SYNC_PAGE_CYCLE/);
  assert.throws(() => applySyncPage(first, {}, null), /SYNC_PAGE_OUT_OF_ORDER/);
  assert.throws(() => applySyncPage(initial, { messages: '' }), /SYNC_PAGE_INVALID/);
  assert.throws(() => beginSync({ cutoffAt: null }), /INVALID_SYNC_CUTOFF/);
});

test('history gaps and failed pages never advance committed sync position', () => {
  const initial = beginSync({ mode: 'history', cutoffAt: at, historyId: '100' });
  const first = applySyncPage(initial, { history: [{ id: '101', messagesAdded: [{ message: { id: 'a' } }], messagesDeleted: [{ message: { id: 'b' } }] }], historyId: '103', nextPageToken: 'next' });
  assert.deepEqual(first.deletedMessageIds, ['b']);
  assert.equal(first.committedHistoryId, null);
  const gap = failSync(first, 'HISTORY_EXPIRED');
  assert.equal(gap.requiresFullSync, true);
  assert.equal(gap.complete, false);
  assert.equal(gap.committedHistoryId, null);
  assert.equal(failSync(first, 'raw secret exception').errorCode, 'GMAIL_UNAVAILABLE');
  const done = applySyncPage(first, { historyId: '104' }, 'next');
  assert.equal(done.committedHistoryId, '104');
  assert.throws(() => applySyncPage(first, { historyId: '99' }, 'next'), /SYNC_PAGE_INVALID/);
  assert.throws(() => applySyncPage(first, {}, 'next'), /SYNC_PAGE_INVALID/);
});

test('reconciliation exposes pending, unavailable, unindexed and uncovered cases', () => {
  const done = applySyncPage(beginSync({ cutoffAt: at }), { messages: [{ id: 'mail1' }, { id: 'mail2' }] });
  const incomplete = buildReconciliationReport(done, [{ ...matched, unavailableAttachmentCount: 1 }], caseIds);
  assert.equal(incomplete.complete, false);
  assert.deepEqual(incomplete.unindexedMessageIds, ['mail2']);
  assert.deepEqual(incomplete.unresolvedCaseIds, [caseB]);
  const pending = buildReconciliationReport(done, [matched, { messageId: 'mail2', matchState: 'pending' }], caseIds, [caseB]);
  assert.equal(pending.counts.pending, 1);
  assert.equal(pending.complete, false);
  const complete = buildReconciliationReport(done, [matched, { messageId: 'mail2', matchState: 'excluded' }], caseIds, [caseB]);
  assert.equal(complete.complete, true);
  assert.equal(complete.counts.unreviewed, 1);
});


test('a reply to one parent stays pending when another case exists in the same thread', () => {
  const parent = { ...matched, rfcMessageId: '<parent@example.com>', reason: 'manual' };
  const other = { ...matched, messageId: 'other', caseId: caseB, reason: 'manual' };
  for (const thread of [[parent, other], [other, parent]]) {
    const result = classifyMessage({ headers: [{ name: 'In-Reply-To', value: '<parent@example.com>' }] }, caseIds, [parent], thread);
    assert.equal(result.matchState, 'pending');
    assert.equal(result.reason, 'mixed_thread');
  }
});
