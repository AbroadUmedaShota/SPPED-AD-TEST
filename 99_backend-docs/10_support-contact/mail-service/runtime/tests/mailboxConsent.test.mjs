import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRuntimeGmailAdapter } from '../mailboxConsent.mjs';
import { MAILBOX, MAILBOX_DISCLOSURE_VERSION, MAILBOX_MARKER_DISCLOSURE, MAILBOX_SYNC_DISCLOSURE, MAILBOX_ACCEPTANCE_DISCLOSURE, mailboxDisclosure } from '../../tools/mailboxOnboarding.mjs';

const disclosureParameters = { retentionNotice: '管理者が期限を確認して手動削除', deletionContact: 'ops@example.com' };
const disclosure = mailboxDisclosure(disclosureParameters);
const now = Date.parse('2026-11-11T01:00:00.000Z');
const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const receipt = { disclosureVersion: MAILBOX_DISCLOSURE_VERSION, disclosure, disclosureParameters,
  disclosureSha256: digest(disclosure), acceptedAt: '2026-11-11T00:00:00.000Z', verifiedMailbox: MAILBOX };

test('normal runtime rejects missing, old and altered consent before constructing an OAuth client', async () => {
  assert.match(disclosure, /管理者が開始日を明示設定した対象期間/);
  assert.doesNotMatch(disclosure, /受付データから決まる対象期間/);
  assert.match(disclosure, /同期・再照合の対象判定では、対象期間外・下書きを含む候補メールのID・ラベル・内部日時だけを先に一時取得/);
  assert.match(disclosure, /開始日前に検出したメールの元ID・内部日時・検出日時/);
  assert.match(disclosure, /未解消の観測記録としてFirestoreに保存/);
  assert.match(disclosure, /原本が途中で消えた場合も取得不能の残件として保持/);
  let clients = 0;
  const create = (consentReceipt, overrides = {}) => createRuntimeGmailAdapter({
    secretVersion: 'projects/test-project/secrets/mail/versions/1', now: () => now,
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({
      clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh', consentReceipt })) } }]; } },
    createOAuthClient: () => { clients++; return { setCredentials() {} }; }, ...overrides
  });
  const omittedSync = disclosure.replace(MAILBOX_SYNC_DISCLOSURE, '');
  const omittedMarker = disclosure.replace(MAILBOX_MARKER_DISCLOSURE, '');
  const omittedAcceptance = disclosure.replace(MAILBOX_ACCEPTANCE_DISCLOSURE, '');
  for (const invalid of [undefined, { ...receipt, disclosureVersion: '2026-11-11.2' },
    { ...receipt, disclosureVersion: '2026-11-11.3' },
    { ...receipt, disclosureVersion: '2026-11-11.4' },
    { ...receipt, disclosureVersion: '2026-11-11.5' },
    { ...receipt, disclosureVersion: '2026-11-11.7' },
    { ...receipt, disclosureVersion: '2026-11-11.9' },
    { ...receipt, disclosureVersion: '2026-11-11.10' },
    { ...receipt, verifiedMailbox: 'other@example.com' }, { ...receipt, acceptedAt: undefined },
    { ...receipt, acceptedAt: 'not-a-date' }, { ...receipt, acceptedAt: '2026-11-11T01:05:00.001Z' },
    { ...receipt, disclosureParameters: undefined },
    { ...receipt, disclosureParameters: { ...disclosureParameters, retentionNotice: '' } },
    { ...receipt, disclosureParameters: { ...disclosureParameters, deletionContact: 'not-an-address' } },
    { ...receipt, disclosureParameters: { ...disclosureParameters, retentionNotice: '別の保存方法' } },
    { ...receipt, acceptedAt: '2026-11-11T00:00:00Z' },
    { ...receipt, disclosureSha256: '0'.repeat(64) },
    { ...receipt, disclosure: omittedSync, disclosureSha256: digest(omittedSync) },
    { ...receipt, disclosure: omittedMarker, disclosureSha256: digest(omittedMarker) },
    { ...receipt, disclosure: omittedAcceptance, disclosureSha256: digest(omittedAcceptance) }]) {
    await assert.rejects(create(invalid), { code: 'MAIL_CONSENT_OUTDATED' });
  }
  // Callers cannot disable the runtime's mandatory receipt checks through options.
  await assert.rejects(create(undefined, { validateConsentReceipt: null, requiredDisclosureVersion: null, requiredDisclosureClause: null }),
    { code: 'MAIL_CONSENT_OUTDATED' });
  for (const line of disclosure.split('\n')) {
    const partial = disclosure.replace(line, '');
    await assert.rejects(create({ ...receipt, disclosure: partial, disclosureSha256: digest(partial) }),
      { code: 'MAIL_CONSENT_OUTDATED' });
  }
  assert.equal(clients, 0);
  const gmail = await create(receipt);
  assert.equal(clients, 1);
  assert.equal(typeof gmail.getMessage, 'function');
});

test('runtime requires a pinned positive numeric Secret version before accessing Secret Manager', async () => {
  let accesses = 0;
  for (const version of ['latest', '0', '01', '-1', '1/versions/2', '', '1?token=sensitive']) {
    await assert.rejects(createRuntimeGmailAdapter({
      secretVersion: `projects/test-project/secrets/mail/versions/${version}`,
      secretManager: { async accessSecretVersion() { accesses++; throw new Error('must not access'); } },
      createOAuthClient: () => { throw new Error('must not construct'); }
    }), { code: 'MAIL_NOT_CONFIGURED' });
  }
  assert.equal(accesses, 0);
});

test('clock skew accepts only a bounded future timestamp and fails closed for an unavailable clock', async () => {
  let clients = 0;
  const create = (acceptedAt, clock) => createRuntimeGmailAdapter({
    secretVersion: 'projects/test-project/secrets/mail/versions/12', now: clock,
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({
      clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh', consentReceipt: { ...receipt, acceptedAt } })) } }]; } },
    createOAuthClient: () => { clients++; return { setCredentials() {} }; }
  });
  await create('2026-11-11T01:05:00.000Z', () => now);
  assert.equal(clients, 1);
  await assert.rejects(create('2026-11-11T01:05:00.001Z', () => now), { code: 'MAIL_CONSENT_OUTDATED' });
  await assert.rejects(create(receipt.acceptedAt, () => NaN), { code: 'MAIL_CONSENT_OUTDATED' });
  await assert.rejects(create(receipt.acceptedAt, () => { throw new Error('sensitive clock failure'); }),
    { code: 'MAIL_CONSENT_OUTDATED' });
  assert.equal(clients, 1);
});
