import test from 'node:test';
import assert from 'node:assert/strict';
import { createAttachmentCache } from '../attachmentCache.mjs';
import { createGmailAdapter } from '../googleAdapters.mjs';

const content = (text) => ({ size: Buffer.byteLength(text), data: Buffer.from(text).toString('base64url') });
function clock() {
  let at = 0;
  let sequence = 0;
  const timers = new Map();
  return { now: () => at,
    setTimer(callback, delay) { const id = ++sequence; timers.set(id, { callback, at: at + delay }); return id; },
    clearTimer(id) { timers.delete(id); },
    advance(ms) { at += ms; for (const [id, timer] of [...timers]) if (timer.at <= at) { timers.delete(id); timer.callback(); } },
    size: () => timers.size };
}

test('attachment cache shares one in-flight read and keeps different-key concurrency bounded', async () => {
  const time = clock(); const cache = createAttachmentCache(time);
  let resolve; let reads = 0;
  const load = () => { reads++; return new Promise((done) => { resolve = done; }); };
  const first = cache.get('mail/a', load);
  const same = cache.get('mail/a', load);
  await assert.rejects(() => cache.get('mail/b', load), { code: 'MAIL_ATTACHMENT_BUSY' });
  assert.equal(reads, 1);
  resolve(content('first'));
  assert.deepEqual(await first, await same);
  assert.deepEqual(await cache.get('mail/a', load), content('first'));
  assert.equal(reads, 1);
  assert.deepEqual(await cache.get('mail/b', async () => { reads++; return content('second'); }), content('second'));
  assert.deepEqual(await cache.get('mail/a', async () => { reads++; return content('new first'); }), content('new first'));
  assert.equal(reads, 3); assert.equal(time.size(), 1);
});

test('attachment cache actively evicts idle data and never extends absolute lifetime', async () => {
  const time = clock(); const cache = createAttachmentCache(time); let reads = 0;
  const load = async () => { reads++; return content('bytes'); };
  await cache.get('a', load);
  time.advance(119000); await cache.get('a', load);
  time.advance(119000); await cache.get('a', load);
  assert.equal(reads, 1);
  time.advance(62000); assert.equal(time.size(), 0);
  await cache.get('a', load); assert.equal(reads, 2);
  time.advance(120000); assert.equal(time.size(), 0);
  await cache.get('a', load); assert.equal(reads, 3);
});

test('failed, oversized and malformed attachment reads are not cached', async () => {
  const cache = createAttachmentCache({ ...clock(), maxBytes: 3 });
  await assert.rejects(() => cache.get('a', async () => { throw new Error('upstream'); }), /upstream/);
  await assert.rejects(() => cache.get('a', async () => content('four')), { code: 'MAIL_SIZE_LIMIT' });
  await assert.rejects(() => cache.get('a', async () => ({ size: 2, data: '!' })), { code: 'MAIL_INVALID_UPSTREAM' });
  await assert.rejects(() => cache.get('a', async () => ({ size: 3, data: 'YQ' })), { code: 'MAIL_INVALID_UPSTREAM' });
  await assert.rejects(() => cache.get('a', async () => ({ size: 0, data: 'A=' })), { code: 'MAIL_INVALID_UPSTREAM' });
  assert.deepEqual(await cache.get('a', async () => content('yes')), content('yes'));
  assert.deepEqual(await cache.get('empty', async () => ({ size: 0 })), content(''));
});

test('Gmail attachment cache is message-specific and checks current OAuth scope on cache hits', async () => {
  const time = clock(); let token = 'readonly'; const calls = [];
  const adapter = await createGmailAdapter({ attachmentCache: createAttachmentCache(time),
    secretVersion: 'projects/test/secrets/mail/versions/1',
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({ clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh' })) } }]; } },
    createOAuthClient: () => ({ setCredentials() {}, async getAccessToken() { return { token }; },
      async getTokenInfo() { return { scopes: token === 'readonly' ? ['https://www.googleapis.com/auth/gmail.readonly'] : ['https://mail.google.com/'] }; } }),
    fetchImpl: async (url) => { calls.push(String(url)); return { ok: true, async json() {
      return String(url).endsWith('/profile') ? { emailAddress: 'customer@speed-ad.com' } : content(new URL(url).pathname.includes('/m1/') ? 'one' : 'two');
    } }; }
  });
  assert.deepEqual(await adapter.getAttachment('m1', 'same'), content('one'));
  assert.deepEqual(await adapter.getAttachment('m1', 'same'), content('one'));
  assert.equal(calls.filter((url) => url.includes('/attachments/')).length, 1);
  token = 'broader';
  await assert.rejects(() => adapter.getAttachment('m1', 'same'), { code: 'MAIL_SCOPE_MISMATCH' });
  assert.equal(calls.filter((url) => url.includes('/attachments/')).length, 1);
  token = 'readonly';
  assert.deepEqual(await adapter.getAttachment('m2', 'same'), content('two'));
  time.advance(120000); await adapter.getAttachment('m2', 'same');
  assert.equal(calls.filter((url) => url.includes('/attachments/')).length, 3);
  await adapter.getAttachment('m2', 'body', { cache: false });
  await adapter.getAttachment('m2', 'body', { cache: false });
  assert.equal(calls.filter((url) => url.includes('/attachments/')).length, 5);
});
