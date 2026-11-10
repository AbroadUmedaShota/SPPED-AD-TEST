import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { authorizeMailbox, createProof, GMAIL_READONLY_SCOPE, listenForOAuthCallback, MAILBOX, MAILBOX_DISCLOSURE_VERSION } from '../mailboxOnboarding.mjs';
import { confirmMailboxDisclosure, main, openSystemBrowser, parseArguments } from '../authorizeMailbox.mjs';

const options = { execute: true, desktopClient: true, confirmMailbox: MAILBOX,
  secretName: 'projects/test-project/secrets/existing-mailbox',
  clientId: '1-test.apps.googleusercontent.com', clientSecret: 'synthetic-client-secret',
  retentionNotice: '合成試験の保存期間', deletionContact: 'synthetic-operator@example.com' };
const canonicalSecretName = 'projects/1234567890/secrets/existing-mailbox';
const acceptedAt = '2026-11-10T14:00:00.000Z';
const fetchCallback = (url) => fetch(url, { signal: AbortSignal.timeout(5000) });

function fixture(overrides = {}) {
  const calls = { writes: [], metadata: [], token: [], opened: [], auth: [] };
  const oauth = {
    generateAuthUrl(value) { calls.auth.push(value); return 'https://accounts.google.com/o/oauth2/v2/auth?synthetic=true'; },
    async getToken(value) { calls.token.push(value); return { tokens: { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' } }; },
    async getTokenInfo() { return { scopes: [GMAIL_READONLY_SCOPE] }; },
    ...overrides.oauth
  };
  const secretManager = {
    async getSecret(request) { calls.metadata.push(request); return [{ name: canonicalSecretName }]; },
    async addSecretVersion(request, callOptions) {
      calls.writes.push({ parent: request.parent, payload: JSON.parse(request.payload.data.toString('utf8')), callOptions });
      return [{ name: `${canonicalSecretName}/versions/2` }];
    }
  };
  const adapters = {
    now: () => new Date(acceptedAt),
    createOAuthClient: () => oauth,
    listen: async (state) => {
      calls.state = state;
      return { redirectUri: 'http://127.0.0.1:12345/oauth/callback', result: Promise.resolve('synthetic-code'), close() { calls.closed = true; } };
    },
    openAuthorization: async (url) => { calls.opened.push(url); },
    confirmDisclosure: async (disclosure) => { calls.disclosure = disclosure; return true; },
    fetchImpl: async (url, request) => {
      calls.profile = { url, request };
      return { ok: true, async json() { return { emailAddress: MAILBOX }; } };
    },
    secretManager,
    ...overrides.adapters
  };
  adapters.secretManager = { ...secretManager, ...overrides.adapters?.secretManager };
  return { calls, adapters };
}

test('explicit execution, desktop type, mailbox and existing secret target are required before any adapter runs', async () => {
  for (const change of [{ execute: false }, { desktopClient: false }, { confirmMailbox: 'other@example.com' }, { secretName: 'projects/p/secrets/s/versions/latest' },
    { retentionNotice: '' }, { retentionNotice: 'unsafe\u001b[2J' }, { deletionContact: '' }, { deletionContact: 'ask the administrator' }]) {
    const { adapters, calls } = fixture();
    await assert.rejects(authorizeMailbox({ ...options, ...change }, adapters));
    assert.deepEqual(calls.opened, []);
    assert.deepEqual(calls.writes, []);
  }
});

test('PKCE offline consent atomically stores verified credentials and the exact accepted disclosure', async () => {
  const { adapters, calls } = fixture();
  const result = await authorizeMailbox(options, adapters);
  assert.equal(result.secretVersion, `${canonicalSecretName}/versions/2`);
  assert.deepEqual(calls.metadata, [{ name: options.secretName }]);
  const auth = calls.auth[0];
  assert.deepEqual(auth.scope, [GMAIL_READONLY_SCOPE]);
  assert.equal(auth.access_type, 'offline');
  assert.equal(auth.prompt, 'consent');
  assert.equal(auth.include_granted_scopes, false);
  assert.equal(auth.login_hint, MAILBOX);
  assert.equal(auth.state, calls.state);
  assert.equal(auth.code_challenge_method, 'S256');
  assert.match(auth.code_challenge, /^[A-Za-z0-9_-]{43}$/);
  assert.match(calls.token[0].codeVerifier, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(calls.token[0].codeVerifier, auth.code_challenge);
  assert.equal(calls.profile.url, 'https://gmail.googleapis.com/gmail/v1/users/me/profile');
  assert.equal(calls.profile.request.redirect, 'error');
  const receipt = { disclosureVersion: MAILBOX_DISCLOSURE_VERSION,
    disclosureParameters: { retentionNotice: options.retentionNotice, deletionContact: options.deletionContact },
    disclosureSha256: createHash('sha256').update(calls.disclosure, 'utf8').digest('hex'), acceptedAt, verifiedMailbox: MAILBOX };
  assert.deepEqual(calls.writes, [{ parent: canonicalSecretName,
    payload: { clientId: options.clientId, clientSecret: options.clientSecret, refreshToken: 'synthetic-refresh',
      consentReceipt: { ...receipt, disclosure: calls.disclosure } }, callOptions: { retry: null } }]);
  assert.equal(calls.closed, true);
  assert.match(calls.disclosure, /SPEED AD お問い合わせ確認アプリ/);
  assert.match(calls.disclosure, /運営主体: アブロードアウトソーシング株式会社/);
  assert.ok(calls.disclosure.includes(GMAIL_READONLY_SCOPE));
  assert.ok(calls.disclosure.includes(options.retentionNotice));
  assert.match(calls.disclosure, /案件終了後3年間/);
  assert.match(calls.disclosure, /除外したメールの記録は除外確定後3年間/);
  assert.match(calls.disclosure, /照合待ちの記録は案件への照合または除外を確定するまで3年間の起算日が決まらないため保持/);
  assert.match(calls.disclosure, /期限削除は管理者が手動で実行/);
  assert.match(calls.disclosure, /迷惑メール・ゴミ箱を含み、下書きは除きます/);
  assert.match(calls.disclosure, /同期対象期間外、下書き、迷惑メール、ゴミ箱も含めてGmail全体のメールIDを列挙/);
  assert.match(calls.disclosure, /hash集合をFirestoreに処理完了または取消しまで一時保存/);
  assert.match(calls.disclosure, /全件確認の受入照合/);
  assert.match(calls.disclosure, /Gmail全体のメールID・ラベル・内部日時を一時取得/);
  assert.match(calls.disclosure, /hash・内部日時・下書きかどうかを管理者限定の端末ファイルへ一時保存/);
  assert.match(calls.disclosure, /一時鍵とsourceファイルは当該受入作業終了時に削除/);
  assert.match(calls.disclosure, /純粋な下書きも、削除履歴を未確認メールの削除と誤判定しないため、メールID由来の最小hashだけを保持/);
  assert.match(calls.disclosure, /下書きの元ID、ラベル、内部日時、件名、宛先、本文、添付はこの記録に保存しません/);
  assert.match(calls.disclosure, /原本不在と削除履歴の処理済みを確認した後に最小hashを整理/);
  assert.match(calls.disclosure, /未完了ページに含まれる候補メールの元IDは、再開用の同期位置としてFirestoreに保存/);
  assert.match(calls.disclosure, /中断・失敗中も再開用に残り、ページ完了の保存または新しい同期計画への明示的な切替で消去/);
  assert.match(calls.disclosure, /既存の監査・確認記録を保持し、案件との紐付けを外した取得不能の照合待ち/);
  assert.match(calls.disclosure, /期間外メールの本文・添付は取得しません/);
  assert.match(calls.disclosure, /関連が未確定のメールも本文を取得して照合/);
  assert.match(calls.disclosure, /abroad-o.com の社員全員/);
  assert.match(calls.disclosure, /対象メールの本文・添付、照合待ち、確認記録/);
  assert.match(calls.disclosure, /本文は同期時の照合と閲覧時/);
  assert.match(calls.disclosure, /本文と一緒に含まれる添付データは同期時にも一時的に受信/);
  assert.match(calls.disclosure, /本文・添付本体はサーバーの一時メモリと利用者画面で処理し、Firestoreへ保存しません/);
  assert.match(calls.disclosure, /添付名/);
  assert.ok(calls.disclosure.includes(options.deletionContact));
  assert.equal(calls.disclosure.includes(options.clientSecret), false);
  assert.deepEqual(result.consentReceipt, receipt);
  assert.doesNotMatch(JSON.stringify(result), /synthetic-client-secret|synthetic-refresh|synthetic-access/);
  assert.deepEqual(Object.keys(result).sort(), ['consentReceipt', 'mailbox', 'secretVersion']);
});

test('consent receipt binds dynamic disclosure content and refuses an unavailable timestamp before cloud access', async () => {
  const first = fixture();
  const second = fixture();
  const original = await authorizeMailbox(options, first.adapters);
  const changed = await authorizeMailbox({ ...options, retentionNotice: '別の合成保存方針' }, second.adapters);
  assert.notEqual(original.consentReceipt.disclosureSha256, changed.consentReceipt.disclosureSha256);
  const invalid = fixture({ adapters: { now: () => new Date(NaN) } });
  await assert.rejects(authorizeMailbox(options, invalid.adapters), /CONSENT_TIME_UNAVAILABLE/);
  assert.deepEqual(invalid.calls.metadata, []);
  assert.deepEqual(invalid.calls.opened, []);
  assert.deepEqual(invalid.calls.writes, []);
});

test('disclosure requires affirmative acknowledgement immediately before browser consent', async () => {
  const sequence = [];
  const { adapters, calls } = fixture({ adapters: {
    confirmDisclosure: async () => { sequence.push('acknowledge'); return true; },
    openAuthorization: async () => { sequence.push('open'); }
  } });
  await authorizeMailbox(options, adapters);
  assert.deepEqual(sequence, ['acknowledge', 'open']);
  assert.equal(calls.writes.length, 1);
  for (const confirmDisclosure of [undefined, async () => false]) {
    const declined = fixture({ adapters: { confirmDisclosure } });
    await assert.rejects(authorizeMailbox(options, declined.adapters), /DISCLOSURE_(CONFIRMATION_REQUIRED|DECLINED)/);
    assert.deepEqual(declined.calls.opened, []);
    assert.deepEqual(declined.calls.token, []);
    assert.deepEqual(declined.calls.writes, []);
    assert.deepEqual(declined.calls.metadata, []);
    assert.equal(declined.calls.profile, undefined);
    assert.equal(declined.calls.state, undefined);
  }
});

test('Secret metadata resolves project IDs before consent and pins the exact version parent', async () => {
  for (const name of [`${canonicalSecretName}/versions/4`, 'projects/9999999999/secrets/existing-mailbox/versions/4',
    'projects/1234567890/secrets/other-mailbox/versions/4', `${canonicalSecretName}/versions/1/versions/4`]) {
    const { adapters, calls } = fixture({ adapters: { secretManager: { async addSecretVersion(request) {
      calls.writes.push(request);
      return [{ name }];
    } } } });
    if (name === `${canonicalSecretName}/versions/4`) {
      assert.equal((await authorizeMailbox(options, adapters)).secretVersion, name);
    } else await assert.rejects(authorizeMailbox(options, adapters), /SECRET_WRITE_UNCONFIRMED/);
    assert.equal(calls.writes.length, 1);
    assert.equal(calls.writes[0].parent, canonicalSecretName);
  }
  const numeric = fixture();
  assert.equal((await authorizeMailbox({ ...options, secretName: canonicalSecretName }, numeric.adapters)).secretVersion, `${canonicalSecretName}/versions/2`);
  assert.deepEqual(numeric.calls.metadata, [{ name: canonicalSecretName }]);
  for (const [requestedName, metadata] of [
    [options.secretName, 'projects/other-project/secrets/existing-mailbox'],
    [options.secretName, 'projects/1234567890/secrets/other-mailbox'],
    [canonicalSecretName, 'projects/9999999999/secrets/existing-mailbox']
  ]) {
    const { adapters, calls } = fixture({ adapters: { secretManager: { async getSecret() { return [{ name: metadata }]; } } } });
    await assert.rejects(authorizeMailbox({ ...options, secretName: requestedName }, adapters), /SECRET_TARGET_UNCONFIRMED/);
    assert.deepEqual(calls.opened, []);
    assert.deepEqual(calls.token, []);
    assert.deepEqual(calls.writes, []);
  }
  const failed = fixture({ adapters: { secretManager: { async getSecret() { throw new Error('sensitive-details'); } } } });
  await assert.rejects(authorizeMailbox(options, failed.adapters), (error) => error.message === 'SECRET_TARGET_UNCONFIRMED');
  assert.deepEqual(failed.calls.opened, []);
  assert.deepEqual(failed.calls.writes, []);
});

test('interactive disclosure rejects pipes and accepts only the explicit answer', async () => {
  let interfaces = 0;
  let written = '';
  let closed = 0;
  const io = { input: { isTTY: true }, output: { isTTY: true, write(value) { written += value; } },
    createInterfaceImpl() { interfaces += 1; return { question: async () => '同意します', close() { closed += 1; } }; } };
  for (const input of [{}, { isTTY: false }]) {
    await assert.rejects(confirmMailboxDisclosure('synthetic disclosure', { ...io, input }), /DISCLOSURE_INTERACTIVE_REQUIRED/);
  }
  await assert.rejects(confirmMailboxDisclosure('synthetic disclosure', { ...io, output: { isTTY: false } }), /DISCLOSURE_INTERACTIVE_REQUIRED/);
  assert.equal(interfaces, 0);
  assert.equal(written, '');
  assert.equal(await confirmMailboxDisclosure('synthetic disclosure', io), true);
  assert.match(written, /synthetic disclosure/);
  assert.equal(closed, 1);
  for (const answer of ['', 'yes', '同意しません']) {
    assert.equal(await confirmMailboxDisclosure('synthetic disclosure', { ...io,
      createInterfaceImpl: () => ({ question: async () => answer, close() {} }) }), false);
  }
});

test('noninteractive CLI stops before importing cloud clients or opening consent', async () => {
  if (process.stdin.isTTY === true && process.stdout.isTTY === true) return;
  await assert.rejects(main(['--execute', '--desktop-client', '--confirm-mailbox', MAILBOX, '--secret', options.secretName], {
    MAIL_OAUTH_CLIENT_ID: options.clientId, MAIL_OAUTH_CLIENT_SECRET: options.clientSecret,
    MAIL_DATA_RETENTION_NOTICE: options.retentionNotice, MAIL_DATA_DELETION_CONTACT: options.deletionContact
  }), /DISCLOSURE_INTERACTIVE_REQUIRED/);
});

test('missing refresh token, broader scope, mailbox mismatch and profile failure never write a secret', async () => {
  const variations = [
    { oauth: { async getToken() { return { tokens: { access_token: 'synthetic-access' } }; } } },
    { oauth: { async getTokenInfo() { return { scopes: [GMAIL_READONLY_SCOPE, 'https://mail.google.com/'] }; } } },
    { adapters: { fetchImpl: async () => ({ ok: true, json: async () => ({ emailAddress: 'other@example.com' }) }) } },
    { adapters: { fetchImpl: async () => ({ ok: false }) } }
  ];
  for (const variation of variations) {
    const { adapters, calls } = fixture(variation);
    await assert.rejects(authorizeMailbox(options, adapters));
    assert.equal(calls.writes.length, 0);
    assert.equal(calls.closed, true);
  }
});

test('unknown secret write result is reported once without a retry or token in the error', async () => {
  let attempts = 0;
  const { adapters } = fixture({ adapters: { secretManager: { async addSecretVersion() { attempts += 1; throw new Error('synthetic-secret-token'); } } } });
  await assert.rejects(authorizeMailbox(options, adapters), (error) => error.message === 'SECRET_WRITE_UNCONFIRMED');
  assert.equal(attempts, 1);
});

test('authorization URL is limited to the official endpoint and never opened for an arbitrary origin', async () => {
  const { adapters, calls } = fixture({ oauth: { generateAuthUrl() { return 'https://attacker.example/auth'; } } });
  await assert.rejects(authorizeMailbox(options, adapters), /INVALID_AUTHORIZATION_URL/);
  assert.equal(calls.opened.length, 0);
  assert.equal(calls.closed, true);
});

test('loopback callback rejects wrong state and duplicate codes before consuming a valid callback', async () => {
  const proof = createProof();
  const listener = await listenForOAuthCallback(proof.state, { timeoutMs: 10000 });
  try {
    const wrong = await fetchCallback(`${listener.redirectUri}?state=wrong&code=not-accepted`);
    assert.equal(wrong.status, 400);
    const duplicate = await fetchCallback(`${listener.redirectUri}?state=${proof.state}&code=one&code=two`);
    assert.equal(duplicate.status, 400);
    const accepted = await fetchCallback(`${listener.redirectUri}?state=${proof.state}&code=synthetic-code`);
    assert.equal(accepted.status, 200);
    const body = await accepted.text();
    assert.equal(body.includes('synthetic-code'), false);
    assert.equal(body.includes(proof.state), false);
    assert.equal(await listener.result, 'synthetic-code');
  } finally { listener.close(); }
});

test('loopback consent denial and timeout return fixed safe errors', async () => {
  const proof = createProof();
  const denied = await listenForOAuthCallback(proof.state, { timeoutMs: 10000 });
  const rejected = assert.rejects(denied.result, /OAUTH_CONSENT_DECLINED/);
  await fetchCallback(`${denied.redirectUri}?state=${proof.state}&error=arbitrary-sensitive-description`);
  await rejected;
  const expired = await listenForOAuthCallback(proof.state, { timeoutMs: 10 });
  await assert.rejects(expired.result, /OAUTH_CALLBACK_TIMEOUT/);
});

test('CLI accepts only explicit non-secret flags and opens the browser without a shell', async () => {
  const args = ['--execute', '--desktop-client', '--confirm-mailbox', MAILBOX, '--secret', options.secretName];
  assert.deepEqual(parseArguments(args), { execute: true, desktopClient: true, confirmMailbox: MAILBOX, secretName: options.secretName });
  assert.throws(() => parseArguments([...args, '--refresh-token', 'value']), /INVALID_ARGUMENTS/);
  assert.throws(() => parseArguments(['--execute', '--execute']), /INVALID_ARGUMENTS/);
  const observed = [];
  const parentEnv = { PATH: 'synthetic-path', SystemRoot: 'synthetic-system-root', MAIL_OAUTH_CLIENT_ID: 'synthetic-client-id', MAIL_OAUTH_CLIENT_SECRET: 'synthetic-client-secret', mail_oauth_client_secret: 'synthetic-case-variant' };
  await openSystemBrowser('https://accounts.google.com/o/oauth2/v2/auth?synthetic=true', { platform: 'win32', env: parentEnv, spawnImpl(command, commandArgs, config) {
    observed.push({ command, commandArgs, config });
    const child = new EventEmitter();
    child.unref = () => {};
    queueMicrotask(() => child.emit('spawn'));
    return child;
  } });
  assert.equal(observed[0].command, 'rundll32.exe');
  assert.equal(observed[0].config.shell, false);
  assert.equal(observed[0].config.windowsHide, true);
  assert.deepEqual(observed[0].config.env, { PATH: parentEnv.PATH, SystemRoot: parentEnv.SystemRoot });
  assert.equal(parentEnv.MAIL_OAUTH_CLIENT_SECRET, 'synthetic-client-secret');
  assert.notEqual(observed[0].config.env, parentEnv);
});
