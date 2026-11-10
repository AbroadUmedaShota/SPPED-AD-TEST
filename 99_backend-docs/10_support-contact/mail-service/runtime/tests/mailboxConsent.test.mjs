import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRuntimeGmailAdapter } from '../mailboxConsent.mjs';
import { MAILBOX, MAILBOX_DISCLOSURE_VERSION, MAILBOX_MARKER_DISCLOSURE, MAILBOX_SYNC_DISCLOSURE, mailboxDisclosure } from '../../tools/mailboxOnboarding.mjs';

const disclosure = mailboxDisclosure({ retentionNotice: '管理者が期限を確認して手動削除', deletionContact: 'ops@example.com' });
const digest = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const receipt = { disclosureVersion: MAILBOX_DISCLOSURE_VERSION, disclosure,
  disclosureSha256: digest(disclosure), acceptedAt: '2026-11-11T00:00:00.000Z', verifiedMailbox: MAILBOX };

test('normal runtime rejects missing, old and altered consent before constructing an OAuth client', async () => {
  assert.match(disclosure, /同期・再照合の対象判定では、対象期間外・下書きを含む候補メールのID・ラベル・内部日時だけを先に一時取得/);
  let clients = 0;
  const create = (consentReceipt, overrides = {}) => createRuntimeGmailAdapter({
    secretVersion: 'projects/test-project/secrets/mail/versions/1',
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify({
      clientId: 'id', clientSecret: 'secret', refreshToken: 'refresh', consentReceipt })) } }]; } },
    createOAuthClient: () => { clients++; return { setCredentials() {} }; }, ...overrides
  });
  const omittedSync = disclosure.replace(MAILBOX_SYNC_DISCLOSURE, '');
  const omittedMarker = disclosure.replace(MAILBOX_MARKER_DISCLOSURE, '');
  for (const invalid of [undefined, { ...receipt, disclosureVersion: '2026-11-11.2' },
    { ...receipt, disclosureVersion: '2026-11-11.3' },
    { ...receipt, disclosureVersion: '2026-11-11.4' },
    { ...receipt, verifiedMailbox: 'other@example.com' }, { ...receipt, acceptedAt: undefined },
    { ...receipt, acceptedAt: 'not-a-date' }, { ...receipt, acceptedAt: '2026-11-11T00:00:00Z' },
    { ...receipt, disclosureSha256: '0'.repeat(64) },
    { ...receipt, disclosure: omittedSync, disclosureSha256: digest(omittedSync) },
    { ...receipt, disclosure: omittedMarker, disclosureSha256: digest(omittedMarker) }]) {
    await assert.rejects(create(invalid), { code: 'MAIL_CONSENT_OUTDATED' });
  }
  // Callers cannot disable the runtime's mandatory receipt checks through options.
  await assert.rejects(create(undefined, { requiredDisclosureVersion: null, requiredDisclosureClause: null }),
    { code: 'MAIL_CONSENT_OUTDATED' });
  assert.equal(clients, 0);
  const gmail = await create(receipt);
  assert.equal(clients, 1);
  assert.equal(typeof gmail.getMessage, 'function');
});
