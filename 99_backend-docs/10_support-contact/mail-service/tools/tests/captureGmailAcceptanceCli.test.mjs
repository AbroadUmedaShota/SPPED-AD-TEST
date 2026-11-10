import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, rmdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseGmailCaptureArguments, runGmailCaptureCli, createCaptureGmail } from '../captureGmailAcceptanceCli.mjs';
import { prepareCaptureFiles, validateWindowsPrivateAcl } from '../privateCaptureFiles.mjs';
import { createRuntimeGmailAdapter } from '../../runtime/mailboxConsent.mjs';
import { mailboxDisclosure, MAILBOX_DISCLOSURE_VERSION, MAILBOX_ACCEPTANCE_DISCLOSURE } from '../mailboxOnboarding.mjs';

const NOW = new Date('2026-11-11T01:00:00.000Z');
const args = () => ['--project', 'test-project', '--confirm-project', 'test-project',
  '--secret-version', 'projects/test-project/secrets/mail/versions/1', '--confirm-mailbox', 'customer@speed-ad.com',
  '--run-id', 'synthetic', '--start-at', '2026-11-01T00:00:00.000Z', '--cutoff-at', '2026-11-11T00:00:00.000Z',
  '--private-dir', resolve('private-capture'), '--key-file', resolve('private-capture/run.key'), '--out', resolve('private-capture/gmail.json')];

test('capture args require explicit same-project numeric Secret version, mailbox, period and absolute private paths', () => {
  assert.equal(parseGmailCaptureArguments(args(), NOW).execute, false);
  for (const [name, value] of [['--confirm-project', 'other-project'], ['--secret-version', 'projects/other-project/secrets/mail/versions/1'],
    ['--secret-version', 'projects/test-project/secrets/mail/versions/latest'], ['--confirm-mailbox', 'other@example.com'],
    ['--cutoff-at', '2026-11-12T00:00:00.000Z'], ['--run-id', '../bad'], ['--out', 'relative.json']]) {
    const values = args(); values[values.indexOf(name) + 1] = value;
    assert.throws(() => parseGmailCaptureArguments(values, NOW), { message: 'MAIL_ACCEPTANCE_INPUT_INVALID' });
  }
  for (const values of [['--execute'], [...args(), '--execute', '--execute'], [...args(), '--unknown', 'value']]) {
    assert.throws(() => parseGmailCaptureArguments(values, NOW), { message: 'MAIL_ACCEPTANCE_INPUT_INVALID' });
  }
});

test('dry-run validates local private paths but never loads Gmail or writes output', async () => {
  let prepared = 0; let closed = 0;
  const io = { now: () => NOW, createGmail: async () => { throw new Error('must not access Secret'); },
    prepare: async () => { prepared++; return { close: async () => { closed++; }, write: async () => { throw new Error('must not write'); } }; }, write: () => {} };
  await runGmailCaptureCli([], io); assert.equal(prepared, 0);
  await runGmailCaptureCli(args(), io); assert.equal(prepared, 1); assert.equal(closed, 1);
});

test('execute writes hashed complete or incomplete manifests and logs only counts/fixed codes', async () => {
  for (const fail of [false, true]) {
    let manifest; let closed = 0; const logs = []; const key = Buffer.alloc(32, 1);
    const gmail = { getProfile: async () => ({ emailAddress: 'customer@speed-ad.com', historyId: '1', messagesTotal: 1 }),
      listAllMessageIds: async () => ({ messageIds: ['sensitive-mail-id'], nextPageToken: null }),
      getMessageMetadata: async (id) => { if (fail) throw new Error('sensitive-token'); return { id, internalDate: String(NOW.getTime() - 3600000) }; } };
    const result = await runGmailCaptureCli([...args(), '--execute'], { now: () => NOW,
      prepare: async () => ({ key, write: async (value) => { manifest = value; }, close: async () => { closed++; } }),
      createGmail: async (version) => { assert.equal(version, 'projects/test-project/secrets/mail/versions/1'); return gmail; }, write: (value) => logs.push(value) });
    assert.equal(result.sourceComplete, !fail); assert.equal(manifest.sourceComplete, !fail); assert.equal(closed, 1);
    assert.ok(!JSON.stringify(logs).includes('sensitive')); assert.ok(!JSON.stringify(manifest).includes('sensitive'));
  }
});

test('private output preparation precedes Secret access and closes on consent error', async () => {
  let closes = 0;
  await assert.rejects(runGmailCaptureCli([...args(), '--execute'], { now: () => NOW,
    prepare: async () => ({ close: async () => { closes++; } }), createGmail: async () => { throw new Error('MAIL_CONSENT_OUTDATED'); }, write: () => {} }), /MAIL_CONSENT_OUTDATED/);
  assert.equal(closes, 1);
  let cloudCalls = 0;
  await assert.rejects(runGmailCaptureCli([...args(), '--execute'], { now: () => NOW,
    prepare: async () => { throw new Error('MAIL_ACCEPTANCE_PRIVATE_PATH_REQUIRED'); }, createGmail: async () => { cloudCalls++; }, write: () => {} }), /MAIL_ACCEPTANCE_PRIVATE_PATH_REQUIRED/);
  assert.equal(cloudCalls, 0);
});

test('Windows ACL policy rejects broad, unknown and unreadable grants', () => {
  const currentSid = 'S-1-5-21-1-2-3-1001';
  const good = { currentSid, ownerSid: currentSid, rules: [{ sid: currentSid, type: 'Allow' }, { sid: 'S-1-5-18', type: 'Allow' }] };
  assert.equal(validateWindowsPrivateAcl(good), true);
  for (const sid of ['S-1-1-0', 'S-1-5-32-545', 'unresolved']) {
    assert.equal(validateWindowsPrivateAcl({ ...good, rules: [...good.rules, { sid, type: 'Allow' }] }), false);
  }
  assert.equal(validateWindowsPrivateAcl({ ...good, ownerSid: 'S-1-1-0' }), false);
  assert.equal(validateWindowsPrivateAcl({ ...good, rules: [null] }), false);
  assert.equal(validateWindowsPrivateAcl(null), false);
});

test('file boundary uses exclusive create, rejects existing/outside paths, and erases key buffer on close', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'mail-private-'));
  const keyFile = join(folder, 'run.key'); const outputFile = join(folder, 'mail.json');
  try {
    await writeFile(keyFile, Buffer.alloc(32, 7), { mode: 0o600 });
    const options = { privateDir: folder, keyFile, outputFile, execute: false,
      ...(process.platform === 'win32' ? { inspectWindows: async () => {} } : {}) };
    const plan = await prepareCaptureFiles(options); await plan.close();
    const file = await prepareCaptureFiles({ ...options, execute: true });
    assert.equal(file.key[0], 7); await file.write({ sourceComplete: true }); await file.close();
    assert.equal(file.key.every((value) => value === 0), true);
    assert.deepEqual(JSON.parse(await readFile(outputFile, 'utf8')), { sourceComplete: true });
    await assert.rejects(prepareCaptureFiles({ ...options, execute: true }));
    await assert.rejects(prepareCaptureFiles({ ...options, outputFile: join(tmpdir(), 'outside.json') }), /MAIL_ACCEPTANCE_PRIVATE_PATH_REQUIRED/);
  } finally {
    await Promise.all([keyFile, outputFile].map((path) => rm(path, { force: true }))); await rmdir(folder);
  }
});

test('real CLI default and malformed arguments never import Google clients or expose errors', () => {
  const cli = fileURLToPath(new URL('../captureGmailAcceptanceCli.mjs', import.meta.url));
  const plan = spawnSync(process.execPath, [cli], { encoding: 'utf8' });
  assert.equal(plan.status, 0); assert.equal(JSON.parse(plan.stdout).execute, false);
  const bad = spawnSync(process.execPath, [cli, '--secret-token', 'sensitive'], { encoding: 'utf8' });
  assert.equal(bad.status, 2); assert.equal(bad.stdout, ''); assert.equal(bad.stderr, 'MAIL_ACCEPTANCE_INPUT_INVALID\n');
});

test('capture factory rejects old and omitted acceptance consent before OAuth construction', async () => {
  const disclosureParameters = { retentionNotice: '合成の手動削除方法', deletionContact: 'ops@example.com' };
  const disclosure = mailboxDisclosure(disclosureParameters);
  const digest = (value) => createHash('sha256').update(value).digest('hex');
  const receipt = { disclosureVersion: MAILBOX_DISCLOSURE_VERSION, disclosure, disclosureParameters, disclosureSha256: digest(disclosure),
    acceptedAt: '2020-01-01T00:00:00.000Z', verifiedMailbox: 'customer@speed-ad.com' };
  let clients = 0; let consentReceipt;
  const load = async () => [{ SecretManagerServiceClient: class {
    async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({ clientId: 'synthetic-id',
      clientSecret: 'synthetic-secret', refreshToken: 'synthetic-refresh', consentReceipt })) } }]; }
  } }, { OAuth2Client: class { constructor() { clients++; } setCredentials() {} } }, { createRuntimeGmailAdapter }];
  const omitted = disclosure.replace(MAILBOX_ACCEPTANCE_DISCLOSURE, '');
  for (const invalid of [undefined, { ...receipt, disclosureVersion: '2026-11-11.5' },
    { ...receipt, disclosure: omitted, disclosureSha256: digest(omitted) }]) {
    consentReceipt = invalid;
    await assert.rejects(createCaptureGmail('projects/test-project/secrets/mail/versions/1', load), { code: 'MAIL_CONSENT_OUTDATED' });
  }
  assert.equal(clients, 0); consentReceipt = receipt;
  const gmail = await createCaptureGmail('projects/test-project/secrets/mail/versions/1', load);
  assert.equal(clients, 1); assert.equal(typeof gmail.getMessageMetadata, 'function');
});
