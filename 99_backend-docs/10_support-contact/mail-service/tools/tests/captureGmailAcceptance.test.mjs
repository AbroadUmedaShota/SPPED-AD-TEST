import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { captureGmailAcceptance } from '../captureGmailAcceptance.mjs';

const key = Buffer.alloc(32, 17);
function fixture() {
  let pageCalls = 0; let profileCalls = 0;
  const gmail = {
    getProfile: async () => { profileCalls++; return { emailAddress: 'customer@speed-ad.com', historyId: '123', messagesTotal: 2 }; },
    listAllMessageIds: async ({ pageToken }) => { pageCalls++; return pageToken ? { messageIds: ['last'], nextPageToken: null } : { messageIds: ['first'], nextPageToken: 'page2' }; },
    getMessageMetadata: async (id) => ({ id, internalDate: '1794355200000', labelIds: id === 'last' ? ['DRAFT'] : ['SPAM'] })
  };
  return { gmail, options: { gmail, key, hashKeyId: createHash('sha256').update(key).digest('hex'), runId: 'synthetic',
    startAt: '2026-11-01T00:00:00.000Z', cutoffAt: '2026-11-11T00:00:00.000Z', now: () => new Date('2026-11-11T01:00:00.000Z') },
    calls: () => ({ pageCalls, profileCalls }) };
}

test('independent full enumeration preserves drafts for scope filter and emits hashes only', async () => {
  const f = fixture(); const m = await captureGmailAcceptance(f.options);
  assert.equal(m.sourceComplete, true); assert.equal(m.rows.length, 2); assert.equal(m.rows[1].draft, true);
  assert.equal(m.pages[1].requestTokenHash, m.pages[0].nextTokenHash);
  assert.deepEqual(f.calls(), { pageCalls: 2, profileCalls: 2 });
  assert.ok(!JSON.stringify(m).includes('page2')); assert.ok(!JSON.stringify(m).includes('"first"'));
});

test('duplicate IDs, repeated tokens, metadata failure, profile drift, and count mismatch fail closed without retries', async () => {
  const mutations = [
    (f) => { f.gmail.listAllMessageIds = async () => ({ messageIds: ['same', 'same'], nextPageToken: null }); },
    (f) => { f.gmail.listAllMessageIds = async () => ({ messageIds: [], nextPageToken: 'loop' }); },
    (f) => { f.gmail.getMessageMetadata = async () => { throw new Error('sensitive upstream'); }; },
    (f) => { let n = 0; f.gmail.getProfile = async () => ({ emailAddress: 'customer@speed-ad.com', historyId: String(++n), messagesTotal: 2 }); },
    (f) => { f.gmail.getProfile = async () => ({ emailAddress: 'customer@speed-ad.com', historyId: '123', messagesTotal: 3 }); }
  ];
  for (const mutate of mutations) {
    const f = fixture(); mutate(f); const m = await captureGmailAcceptance(f.options);
    assert.equal(m.sourceComplete, false); assert.ok(m.errors.length > 0);
    assert.ok(!JSON.stringify(m).includes('sensitive upstream'));
  }
});

test('limits, malformed empty response and wrong mailbox cannot report complete', async () => {
  const f = fixture(); assert.equal((await captureGmailAcceptance({ ...f.options, maxPages: 1 })).sourceComplete, false);
  assert.equal((await captureGmailAcceptance({ ...f.options, maxRows: 1 })).sourceComplete, false);
  f.gmail.listAllMessageIds = async () => ({}); assert.equal((await captureGmailAcceptance(f.options)).sourceComplete, false);
  f.gmail.getProfile = async () => ({ emailAddress: 'other@example.com', historyId: '1', messagesTotal: 0 });
  assert.equal((await captureGmailAcceptance(f.options)).sourceComplete, false);
});

test('invalid context is rejected before Gmail access', async () => {
  const f = fixture();
  await assert.rejects(captureGmailAcceptance({ ...f.options, hashKeyId: 'bad' }), { message: 'MAIL_ACCEPTANCE_INPUT_INVALID' });
  assert.deepEqual(f.calls(), { pageCalls: 0, profileCalls: 0 });
});

test('explicit stable empty mailbox succeeds but non-string metadata dates do not', async () => {
  const f = fixture();
  f.gmail.getProfile = async () => ({ emailAddress: 'customer@speed-ad.com', historyId: '123', messagesTotal: 0 });
  f.gmail.listAllMessageIds = async () => ({ messageIds: [], nextPageToken: null });
  const empty = await captureGmailAcceptance(f.options); assert.equal(empty.sourceComplete, true); assert.equal(empty.pages.length, 1);
  const invalid = fixture(); invalid.gmail.getMessageMetadata = async (id) => ({ id, internalDate: 1794355200000 });
  assert.equal((await captureGmailAcceptance(invalid.options)).sourceComplete, false);
});
