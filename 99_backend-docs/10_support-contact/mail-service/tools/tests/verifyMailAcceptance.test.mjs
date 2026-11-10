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
    read: async (path) => { reads.push(path); return '{}'; }, write: (value) => writes.push(value)
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
    const common = { schemaVersion: 1, runId: 'empty-synthetic', hashKeyId: 'a'.repeat(64),
      startAt: '2026-11-01T00:00:00.000Z', cutoffAt: '2026-11-11T00:00:00.000Z', capturedAt: '2026-11-11T00:00:00.000Z',
      sourceComplete: true, errors: [], pages: [{ index: 0, requestTokenHash: null, nextTokenHash: null, rowCount: 0 }], rows: [] };
    const sheet = { ...common, source: 'sheet' }; const gmail = { ...common, source: 'gmail' };
    const app = { ...common, source: 'app', catalog: [], noMailConfirmations: [], syncComplete: true, residualCount: 0 };
    await Promise.all([['sheet', sheet], ['gmail', gmail], ['app', app]].map(([name, value]) => writeFile(join(folder, `${name}.json`), JSON.stringify(value))));
    const cli = fileURLToPath(new URL('../verifyMailAcceptance.mjs', import.meta.url));
    const args = [cli, '--sheet', join(folder, 'sheet.json'), '--sheet-after', join(folder, 'sheet.json'),
      '--gmail', join(folder, 'gmail.json'), '--app', join(folder, 'app.json')];
    const success = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(success.status, 0); assert.equal(JSON.parse(success.stdout).technicalReady, true);
    app.residualCount = 1; await writeFile(join(folder, 'app.json'), JSON.stringify(app));
    const failure = spawnSync(process.execPath, args, { encoding: 'utf8' });
    assert.equal(failure.status, 1); assert.equal(JSON.parse(failure.stdout).technicalReady, false);
    assert.ok(!failure.stdout.includes(folder));
  } finally {
    await Promise.all(['sheet', 'gmail', 'app'].map((name) => rm(join(folder, `${name}.json`), { force: true })));
    await rmdir(folder);
  }
});
