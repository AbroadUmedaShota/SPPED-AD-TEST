import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { authorizeMailbox, createProof, GMAIL_READONLY_SCOPE, listenForOAuthCallback, MAILBOX } from '../mailboxOnboarding.mjs';
import { openSystemBrowser, parseArguments } from '../authorizeMailbox.mjs';

const options = { execute: true, desktopClient: true, confirmMailbox: MAILBOX,
  secretName: 'projects/test-project/secrets/existing-mailbox',
  clientId: '1-test.apps.googleusercontent.com', clientSecret: 'synthetic-client-secret' };

function fixture(overrides = {}) {
  const calls = { writes: [], token: [], opened: [], auth: [] };
  const oauth = {
    generateAuthUrl(value) { calls.auth.push(value); return 'https://accounts.google.com/o/oauth2/v2/auth?synthetic=true'; },
    async getToken(value) { calls.token.push(value); return { tokens: { access_token: 'synthetic-access', refresh_token: 'synthetic-refresh' } }; },
    async getTokenInfo() { return { scopes: [GMAIL_READONLY_SCOPE] }; },
    ...overrides.oauth
  };
  const adapters = {
    createOAuthClient: () => oauth,
    listen: async (state) => {
      calls.state = state;
      return { redirectUri: 'http://127.0.0.1:12345/oauth/callback', result: Promise.resolve('synthetic-code'), close() { calls.closed = true; } };
    },
    openAuthorization: async (url) => { calls.opened.push(url); },
    fetchImpl: async (url, request) => {
      calls.profile = { url, request };
      return { ok: true, async json() { return { emailAddress: MAILBOX }; } };
    },
    secretManager: { async addSecretVersion(request, callOptions) {
      calls.writes.push({ parent: request.parent, payload: JSON.parse(request.payload.data.toString('utf8')), callOptions });
      return [{ name: `${options.secretName}/versions/2` }];
    } },
    ...overrides.adapters
  };
  return { calls, adapters };
}

test('explicit execution, desktop type, mailbox and existing secret target are required before any adapter runs', async () => {
  for (const change of [{ execute: false }, { desktopClient: false }, { confirmMailbox: 'other@example.com' }, { secretName: 'projects/p/secrets/s/versions/latest' }]) {
    const { adapters, calls } = fixture();
    await assert.rejects(authorizeMailbox({ ...options, ...change }, adapters));
    assert.deepEqual(calls.opened, []);
    assert.deepEqual(calls.writes, []);
  }
});

test('PKCE offline consent verifies the exact mailbox and writes only the runtime credential schema', async () => {
  const { adapters, calls } = fixture();
  const result = await authorizeMailbox(options, adapters);
  assert.equal(result.secretVersion, `${options.secretName}/versions/2`);
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
  assert.deepEqual(calls.writes, [{ parent: options.secretName,
    payload: { clientId: options.clientId, clientSecret: options.clientSecret, refreshToken: 'synthetic-refresh' }, callOptions: { retry: null } }]);
  assert.equal(calls.closed, true);
  assert.deepEqual(Object.keys(result).sort(), ['mailbox', 'secretVersion']);
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
    const wrong = await fetch(`${listener.redirectUri}?state=wrong&code=not-accepted`);
    assert.equal(wrong.status, 400);
    const duplicate = await fetch(`${listener.redirectUri}?state=${proof.state}&code=one&code=two`);
    assert.equal(duplicate.status, 400);
    const accepted = await fetch(`${listener.redirectUri}?state=${proof.state}&code=synthetic-code`);
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
  await fetch(`${denied.redirectUri}?state=${proof.state}&error=arbitrary-sensitive-description`);
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
