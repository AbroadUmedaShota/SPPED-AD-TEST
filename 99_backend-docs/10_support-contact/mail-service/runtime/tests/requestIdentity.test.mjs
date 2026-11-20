import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestId, requestExpiresAt, assertCurrentRequestId } from '../requestIdentity.mjs';

test('request identity fixes creation time across renewed envelopes and expires after seven days', () => {
  const created = new Date('2026-11-10T09:00:00.000Z');
  const id = createRequestId(created);
  assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.equal(requestExpiresAt(id), '2026-11-17T09:00:00.000Z');
  assertCurrentRequestId(id, new Date('2026-11-17T08:59:59.999Z'));
  assert.throws(() => assertCurrentRequestId(id, new Date('2026-11-17T09:00:00.000Z')), { code: 'MAIL_REQUEST_EXPIRED' });
  assert.throws(() => assertCurrentRequestId(id, new Date('2026-11-10T08:57:59.999Z')), { code: 'MAIL_INVALID_REQUEST' });
  assert.equal(requestExpiresAt('00000000-0000-4000-8000-000000000001'), null);
  assert.throws(() => assertCurrentRequestId('00000000-0000-4000-8000-000000000001', created), { code: 'MAIL_INVALID_REQUEST' });
});
