import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtemp, writeFile, rm, rmdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashAcceptanceId } from '../acceptanceReconciliation.mjs';
import { runAcceptanceCli } from '../verifyMailAcceptance.mjs';

test('CLI reads all four observations and emits a structured failing result for invalid manifests', async () => {
  const reads = []; const writes = [];
  const result = await runAcceptanceCli(['--sheet', 's', '--gmail', 'g', '--app', 'a', '--sheet-after', 'z'], {
    read: async (path) => { reads.push(path); return path === 's' || path === 'z' ?
      JSON.stringify({ manifest: { rows: [{}] }, receipt: { catalogDigest: 'a'.repeat(64), total: 1, readCount: 2 } }) : '{}'; },
    write: (value) => writes.push(value)
  });
  assert.deepEqual(reads, ['s', 'g', 'a', 'z']); assert.equal(result.technicalReady, false); assert.equal(writes.length, 1);
  assert.equal(result.failures.filter((x) => x.code === 'MANIFEST_INVALID').length, 4);
});

test('CLI rejects unknown, duplicate and incomplete arguments before file access', async () => {
  for (const args of [[], ['--sheet', 's'], ['--secret', 'value'], ['--sheet', 's', '--sheet', 's'], ['--sheet']]) {
    let read = false;
    await assert.rejects(runAcceptanceCli(args, { read: async () => { read = true; return '{}'; } }), { message: 'MAIL_ACCEPTANCE_INPUT_INVALID' });
    assert.equal(read, false);
  }
});

test('real CLI masks filesystem errors and exits with invalid-input status', () => {
  const secretPath = 'private-mailbox-do-not-print.json';
  const cli = fileURLToPath(new URL('../verifyMailAcceptance.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, '--sheet', secretPath, '--gmail', secretPath, '--app', secretPath, '--sheet-after', secretPath], { encoding: 'utf8' });
  assert.equal(result.status, 2); assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'MAIL_ACCEPTANCE_INPUT_INVALID\n');
});

test('ID hashes are domain separated and change with the ephemeral key', () => {
  const key = Buffer.alloc(32, 1); const secondKey = Buffer.alloc(32, 2);
  assert.match(hashAcceptanceId('case', 'id', key), /^[a-f0-9]{64}$/);
  assert.notEqual(hashAcceptanceId('case', 'id', key), hashAcceptanceId('message', 'id', key));
  assert.notEqual(hashAcceptanceId('case', 'id', key), hashAcceptanceId('case', 'id', secondKey));
  assert.throws(() => hashAcceptanceId('case', 'id', Buffer.alloc(1)), { message: 'MAIL_ACCEPTANCE_INPUT_INVALID' });
});

test('real CLI returns success only for complete manifests and nonzero for residuals', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'contact-acceptance-'));
  try {
    const common = { schemaVersion: 1, runId: 'synthetic-1', hashKeyId: 'a'.repeat(64),
      startAt: '2026-11-01T00:00:00.000Z', cutoffAt: '2026-11-11T00:00:00.000Z', capturedAt: '2026-11-11T00:00:00.000Z',
      sourceComplete: true, errors: [], pages: [{ index: 0, requestTokenHash: null, nextTokenHash: null, rowCount: 0 }], rows: [] };
    const caseHash = 'c'.repeat(64);
    const sheet = { ...common, source: 'sheet', pages: [{ ...common.pages[0], rowCount: 1 }],
      rows: [{ caseHash, submittedAt: common.startAt, handledStatus: '未対応', closedAt: null }] };
    const gmail = { ...common, source: 'gmail', capturedAt: '2026-11-11T00:00:00.001Z' };
    const app = { ...common, source: 'app', capturedAt: '2026-11-11T00:00:00.002Z',
      catalog: [{ caseHash, handledStatus: '未対応', closedAt: null }],
      noMailConfirmations: [{ caseHash, evidenceHash: 'd'.repeat(64) }], syncComplete: true, residualCount: 0 };
    const sheetCapture = { manifest: sheet, receipt: { catalogDigest: 'b'.repeat(64), total: 1, readCount: 2 } };
    const afterCapture = { manifest: { ...sheet, capturedAt: '2026-11-11T00:00:00.003Z' }, receipt: { ...sheetCapture.receipt } };
    await Promise.all([['sheet', sheetCapture], ['sheet-after', afterCapture], ['gmail', gmail], ['app', app]]
      .map(([name, value]) => writeFile(join(folder, `${name}.json`), JSON.stringify(value))));
    const cli = fileURLToPath(new URL('../verifyMailAcceptance.mjs', import.meta.url));
    const args = [cli, '--sheet', join(folder, 'sheet.json'), '--sheet-after', join(folder, 'sheet-after.json'),
      '--gmail', join(folder, 'gmail.json'), '--app', join(folder, 'app.json')];
    const success = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(success.status, 0); assert.equal(JSON.parse(success.stdout).technicalReady, true);
    app.residualCount = 1; await writeFile(join(folder, 'app.json'), JSON.stringify(app));
    const failure = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(failure.status, 1); assert.equal(JSON.parse(failure.stdout).technicalReady, false);
    assert.ok(!failure.stdout.includes(folder));
    app.residualCount = 0; await writeFile(join(folder, 'app.json'), JSON.stringify(app));
    args[args.indexOf('--sheet-after') + 1] = join(folder, 'sheet.json');
    const copied = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(copied.status, 1);
    assert.ok(JSON.parse(copied.stdout).failures.some((item) => item.code === 'OBSERVATION_ORDER_INVALID'));
    args[args.indexOf('--sheet-after') + 1] = join(folder, 'sheet-after.json');
    await writeFile(join(folder, 'sheet-after.json'), JSON.stringify({ ...afterCapture,
      receipt: { ...afterCapture.receipt, catalogDigest: 'e'.repeat(64) } }));
    const changed = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(changed.status, 1);
    assert.deepEqual(JSON.parse(changed.stdout).failures, [{ code: 'SHEET_RECEIPT_CHANGED', source: 'sheetAfter', count: 1, category: 'identity' }]);
    assert.equal(JSON.parse(changed.stdout).idReconciliationPass, false);
  } finally {
    await Promise.all(['sheet', 'sheet-after', 'gmail', 'app'].map((name) => rm(join(folder, `${name}.json`), { force: true })));
    await rmdir(folder);
  }
});

test('CLI rejects bare Sheet manifests and tampered receipts without output', async () => {
  for (const sheet of [
    { rows: [] },
    { manifest: { rows: [] }, receipt: { catalogDigest: 'a'.repeat(64), total: 0, readCount: 2 } },
    { manifest: { rows: [] }, receipt: { catalogDigest: 'a'.repeat(64), total: 1, readCount: 2 } },
    { manifest: { rows: [] }, receipt: { catalogDigest: 'a'.repeat(64), total: 0, readCount: 1 } },
    { manifest: { rows: [] }, receipt: { catalogDigest: 'raw-case-id', total: 0, readCount: 2 } },
  ]) {
    const writes = [];
    await assert.rejects(runAcceptanceCli(['--sheet', 's', '--gmail', 'g', '--app', 'a', '--sheet-after', 'z'], {
      read: async (path) => path === 's' ? JSON.stringify(sheet) : '{}', write: (value) => writes.push(value),
    }), { message: 'MAIL_ACCEPTANCE_INPUT_INVALID' });
    assert.equal(writes.length, 0);
  }
});
