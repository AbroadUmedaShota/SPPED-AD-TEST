import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { captureAppAcceptance } from '../captureAppAcceptance.mjs';
import { captureGmailAcceptance } from '../captureGmailAcceptance.mjs';
import { hashAcceptanceId, reconcileAcceptance } from '../acceptanceReconciliation.mjs';

const ROOT = 'contactMailboxes/customer-speed-ad';
const KEY = Buffer.alloc(32, 19);
const CASE = '00000000-0000-0000-0000-000000000001';
const MESSAGE = 'mail123';
const START = '2026-11-10T00:00:00.000Z';
const CUTOFF = '2026-11-10T12:00:00.000Z';
const hash = (value) => createHash('sha256').update(value).digest('hex');

function appDatabase() {
  const caseRow = { caseId: CASE, handledStatus: '未対応', closedAt: null };
  const digest = hash(JSON.stringify([CASE, '未対応', null]));
  const records = new Map([
    [`${ROOT}/meta/activeCatalog`, { snapshotId: 'snapshot', total: 1, digest }],
    [`${ROOT}/catalogSnapshots/snapshot`, { complete: true, pageCount: 1, total: 1, digest }],
    [`${ROOT}/catalogSnapshots/snapshot/pages/0000`, { pageIndex: 0, cases: [caseRow] }],
    [`${ROOT}/meta/sync`, { state: 'complete', startAt: START, cutoffAt: CUTOFF, failedCount: 0,
      failedMessageIds: [], historyId: '123', catalogSnapshotId: 'snapshot', pageToken: null,
      mode: 'full', executionId: 'sync-1', lastSuccessAt: CUTOFF }],
    [`${ROOT}/messages/${MESSAGE}`, { messageId: MESSAGE, internalDate: START, matchState: 'matched',
      caseId: CASE, unavailable: false, bodyAvailability: 'verified', attachmentCount: 0,
      indexedGeneration: 'sync-1', attachments: [],
      firstReview: { email: 'reviewer@abroad-o.com', at: CUTOFF } }]
  ]);
  const snapshot = (path) => ({ id: path.split('/').at(-1), exists: records.has(path),
    data: () => structuredClone(records.get(path)) });
  return {
    doc: (path) => ({ path }),
    collection: (path) => ({ path, query: true, select() { return this; } }),
    runTransaction: async (operation, options) => {
      assert.deepEqual(options, { readOnly: true });
      return operation({ get: async (ref) => ref.query ? {
        docs: [...records.keys()].filter((path) => path.startsWith(`${ref.path}/`) &&
          path.split('/').length === ref.path.split('/').length + 1).map(snapshot)
      } : snapshot(ref.path) });
    }
  };
}

function sheet(capturedAt) {
  return { schemaVersion: 1, source: 'sheet', runId: 'integration-1', hashKeyId: hash(KEY),
    startAt: START, cutoffAt: CUTOFF, capturedAt, sourceComplete: true, errors: [],
    pages: [{ index: 0, requestTokenHash: null, nextTokenHash: null, rowCount: 1 }],
    rows: [{ caseHash: hashAcceptanceId('case', CASE, KEY), submittedAt: START,
      handledStatus: '未対応', closedAt: null }] };
}

test('independent Gmail and Firestore captures reconcile with Sheet projection in capture order', async () => {
  const gmail = await captureGmailAcceptance({
    gmail: {
      getProfile: async () => ({ emailAddress: 'customer@speed-ad.com', historyId: '123', messagesTotal: 1 }),
      listAllMessageIds: async () => ({ messageIds: [MESSAGE], nextPageToken: null }),
      getMessageMetadata: async (id) => ({ id, internalDate: String(Date.parse(START)), labelIds: ['INBOX'] })
    }, runId: 'integration-1', key: KEY, hashKeyId: hash(KEY), startAt: START, cutoffAt: CUTOFF,
    now: () => new Date('2026-11-10T14:00:00.000Z')
  });
  const app = await captureAppAcceptance({ db: appDatabase(), runId: 'integration-1', key: KEY,
    startAt: START, cutoffAt: CUTOFF, now: () => new Date('2026-11-10T15:00:00.000Z') });
  const result = reconcileAcceptance({ sheet: sheet('2026-11-10T13:00:00.000Z'), gmail, app,
    sheetAfter: sheet('2026-11-10T16:00:00.000Z') });
  assert.equal(result.idReconciliationPass, true);
  assert.equal(result.technicalReady, true);
  assert.equal(result.businessAcceptance, 'unverified');
  assert.deepEqual(result.failures, []);
  assert.equal(JSON.stringify({ gmail, app }).includes(MESSAGE), false);
});
