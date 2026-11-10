import { createRequestId } from '../requestIdentity.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import * as classification from '../../classification.mjs';
import * as mime from '../../mime.mjs';
import * as review from '../../review.mjs';
import * as safeMail from '../../safeMail.mjs';
import { createMailService } from '../service.mjs';
import { fakeStore } from './fakeStore.mjs';

for (const [kind, html] of [
  ['source tag count', '<br>'.repeat(20001)],
  ['parser-generated formatting clones', '<p>start' + Array.from({ length: 256 }, (_, index) => `<b id=b${index}>`).join('') + '<p>x</p>'.repeat(256)]
]) test(`HTML beyond ${kind} budget stays a visible unavailable residual and cannot be reviewed`, async () => {
  const caseId = '11111111-1111-4111-8111-111111111111';
  const at = '2026-11-10T09:00:00.000Z';
  const store = fakeStore([caseId], { state: 'complete', startAt: '2026-01-01T00:00:00.000Z', cutoffAt: at });
  store.seed({ messageId: 'complex', threadId: 'thread', caseId, matchState: 'matched', version: 1,
    internalDate: at, subject: 'test', from: 'a', to: 'b', direction: 'received', firstReview: null,
    unavailable: false, bodyAvailability: 'unverified', attachmentCount: 0, attachments: [],
    unverifiedAttachmentCount: 0, unavailableAttachmentCount: 0 });
  assert.throws(() => safeMail.htmlToPlainText(html), /MAIL_HTML_STRUCTURE_LIMIT/);
  const bytes = Buffer.from(html);
  const gmail = { async getAttachment() { throw new Error('unexpected attachment fetch'); },
    async getMessageMetadata() { return { id: 'complex', internalDate: String(Date.parse(at)), labelIds: [] }; },
    async getMessage() { return { id: 'complex', threadId: 'thread', internalDate: String(Date.parse(at)),
      payload: { mimeType: 'text/html', body: { size: bytes.length, data: bytes.toString('base64url') } } }; } };
  const execute = createMailService({ store, gmail, core: { ...classification, ...mime, ...review, ...safeMail }, now: () => new Date(at) });
  const envelope = (operation, payload = {}) => ({ contractVersion: 1, operation, requestId: createRequestId(new Date(at)), issuedAt: at,
    actor: { email: 'staff@abroad-o.com', authMode: 'domain' }, payload });
  const target = { scope: 'case', caseId, messageId: 'complex' };
  const detail = await execute(envelope('getMail', target));
  assert.equal(detail.message.bodyAvailability, 'unavailable');
  assert.equal(detail.message.bodyText, '');
  assert.equal(detail.message.reviewReady, false);
  assert.equal((await store.getMessage('complex')).bodyAvailability, 'unavailable');
  const status = (await execute(envelope('getSyncStatus'))).sync;
  assert.equal(status.bodyUnavailableCount, 1);
  assert.equal(status.acceptanceReady, false);
  const issues = await execute(envelope('listMailIssues', { kind: 'bodyUnavailable' }));
  assert.equal(issues.targets[0].messageId, 'complex');
  await assert.rejects(execute(envelope('markReviewed', { ...target, expectedVersion: 1 })), { code: 'MAIL_CONTENT_UNAVAILABLE' });
});
