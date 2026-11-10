import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../99_backend-docs/10_support-contact/viewer-workspace-gas/', import.meta.url);
const bridge = readFileSync(new URL('MailBridge.gs', root), 'utf8');
const acceptance = readFileSync(new URL('SheetAcceptance.gs', root), 'utf8');
const key = Buffer.alloc(32, 7);
const headers = ['submission_id', 'submitted_at', 'handled_status', 'closed_at'];
const id = '11111111-1111-4111-8111-111111111111';
const submittedAt = '2026-11-10T00:00:00.000Z';
const options = { runId: 'acceptance-1', startAt: '2026-11-08T15:00:00.000Z', cutoffAt: '2026-11-10T01:00:00.000Z', hashKeyBase64: key.toString('base64') };
const row = (caseId = id) => [caseId, submittedAt, '未対応', ''];

function runtime({ actor = { authMode: 'domain' }, snapshots = [[headers, row()]] } = {}) {
  let reads = 0;
  const context = {
    requireViewer_() { if (!actor) throw new Error('AUTH_REQUIRED'); return actor; },
    getSheet_: () => ({ getDataRange: () => ({ getValues: () => snapshots[Math.min(reads++, snapshots.length - 1)] }) }),
    ensureHeaders_: () => headers,
    Utilities: {
      Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'SHA-256' },
      base64Decode: (value) => [...Buffer.from(value, 'base64')],
      base64Encode: (value) => Buffer.from(value).toString('base64'),
      computeDigest: (_kind, value) => [...createHash('sha256').update(typeof value === 'string' ? value : Buffer.from(value)).digest()],
      computeHmacSha256Signature: (value, bytes) => [...createHmac('sha256', Buffer.from(bytes)).update(Buffer.from(value)).digest()],
    },
  };
  vm.createContext(context);
  vm.runInContext(bridge, context);
  vm.runInContext(acceptance, context);
  return { api: context, get reads() { return reads; } };
}

test('Sheet acceptance export authenticates before reading and accepts only existing domain users', () => {
  for (const actor of [null, { authMode: 'google-oauth' }]) {
    const app = runtime({ actor });
    assert.throws(() => app.api.exportContactMailSheetAcceptance(options), /AUTH_REQUIRED|FORBIDDEN/);
    assert.equal(app.reads, 0);
  }
});

test('Sheet acceptance export covers more than 200 cases and returns only hashed projection fields', () => {
  const rows = Array.from({ length: 401 }, (_, index) => row(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`));
  const app = runtime({ snapshots: [[headers, ...rows.slice().reverse()]] });
  const result = JSON.parse(JSON.stringify(app.api.exportContactMailSheetAcceptance(options)));
  assert.equal(app.reads, 2);
  assert.equal(result.ok, true);
  assert.equal(result.manifest.sourceComplete, true);
  assert.equal(result.manifest.rows.length, 401);
  assert.equal(result.manifest.pages[0].rowCount, 401);
  assert.equal(result.receipt.total, 401);
  assert.equal(result.receipt.readCount, 2);
  assert.equal(result.receipt.catalogDigest, createHash('sha256').update(rows.map((item) => JSON.stringify([item[0], item[2], null])).join('\n')).digest('hex'));
  assert.equal(result.manifest.hashKeyId, createHash('sha256').update(key).digest('hex'));
  assert.equal(result.manifest.rows[0].caseHash, createHmac('sha256', key).update('case\0' + rows[0][0]).digest('hex'));
  assert.deepEqual(Object.keys(result.manifest.rows[0]).sort(), ['caseHash', 'closedAt', 'handledStatus', 'submittedAt']);
  assert.equal(result.manifest.rows[0].submittedAt, submittedAt);
  assert.doesNotMatch(JSON.stringify(result), /00000000-0000|hashKeyBase64|message|email|subject|internal_note/);
});

test('Sheet acceptance export rejects malformed source rows and never treats zero or missing IDs as complete', () => {
  const invalid = [
    [], [row(), row()], [row('bad-id')], [['', submittedAt, '未対応', '']],
    [[id, '', '未対応', '']], [[id, '2026-02-30T00:00:00.000Z', '未対応', '']],
    [[id, submittedAt, 'invalid', '']], [[id, submittedAt, '未対応', submittedAt]],
    [[id, submittedAt, '対応済み', '2026-11-09T00:00:00.000Z']],
  ];
  for (const rows of invalid) {
    const app = runtime({ snapshots: [[headers, ...rows]] });
    assert.throws(() => app.api.exportContactMailSheetAcceptance(options), /MAIL_ACCEPTANCE_SOURCE_INVALID/);
  }
});

test('Sheet acceptance export rejects drift, rows after cutoff, and an unrelated period', () => {
  const changed = row(); changed[2] = '対応中';
  assert.throws(() => runtime({ snapshots: [[headers, row()], [headers, changed]] }).api.exportContactMailSheetAcceptance(options), /MAIL_ACCEPTANCE_SOURCE_CHANGED/);
  const changedDate = row(); changedDate[1] = '2026-11-10T00:01:00.000Z';
  assert.throws(() => runtime({ snapshots: [[headers, row()], [headers, changedDate]] }).api.exportContactMailSheetAcceptance(options), /MAIL_ACCEPTANCE_SOURCE_CHANGED/);
  const later = row(); later[1] = '2026-11-10T02:00:00.000Z';
  assert.throws(() => runtime({ snapshots: [[headers, later]] }).api.exportContactMailSheetAcceptance(options), /MAIL_ACCEPTANCE_CUTOFF_CHANGED/);
  assert.throws(() => runtime().api.exportContactMailSheetAcceptance({ ...options, startAt: '2026-11-09T00:00:00.000Z' }), /MAIL_ACCEPTANCE_INPUT_INVALID/);
});

test('Sheet acceptance export rejects header drift and hides source exception details', () => {
  assert.throws(() => runtime({ snapshots: [[['submission_id', 'wrong_date', 'handled_status', 'closed_at'], row()]] }).api.exportContactMailSheetAcceptance(options), /MAIL_ACCEPTANCE_SOURCE_INVALID/);
  const app = runtime();
  app.api.getSheet_ = () => { throw new Error('private-sheet-id-and-contact-content'); };
  assert.throws(() => app.api.exportContactMailSheetAcceptance(options), (error) => error.message === 'MAIL_ACCEPTANCE_SOURCE_INVALID');
});

test('Sheet acceptance export validates run, canonical dates and ephemeral key before reading', () => {
  for (const override of [{ runId: '' }, { cutoffAt: '2026-11-10' }, { hashKeyBase64: 'not-base64' }, { hashKeyBase64: Buffer.alloc(31).toString('base64') }, { extra: 'ignored' }]) {
    const app = runtime();
    assert.throws(() => app.api.exportContactMailSheetAcceptance({ ...options, ...override }), /MAIL_ACCEPTANCE_INPUT_INVALID/);
    assert.equal(app.reads, 0);
  }
});
