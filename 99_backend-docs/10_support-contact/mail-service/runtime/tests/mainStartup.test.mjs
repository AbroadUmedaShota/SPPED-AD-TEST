import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { fileURLToPath } from 'node:url';

const fixture = fileURLToPath(new URL('./fixtures/mainStartup.mjs', import.meta.url));

function rpc(port, envelope) {
  const body = envelope ? JSON.stringify(envelope) : '';
  return new Promise((resolve, reject) => {
    const outgoing = request({ host: '127.0.0.1', port, path: '/rpc', method: 'POST', agent: false,
      signal: AbortSignal.timeout(5000), headers: envelope ? {
        authorization: 'Bearer SYNTHETIC_ID_TOKEN', 'content-type': 'application/json',
        'content-length': Buffer.byteLength(body)
      } : {} }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        try { resolve({ status: response.statusCode, headers: response.headers,
          json: JSON.parse(Buffer.concat(chunks).toString('utf8')) }); } catch (error) { reject(error); }
      });
    });
    outgoing.on('error', reject);
    outgoing.end(body);
  });
}

function childRuntime(t, scenario) {
  const child = spawn(process.execPath, ['--experimental-test-module-mocks', fixture, scenario], {
    stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
    env: { SystemRoot: process.env.SystemRoot || '', PATH: process.env.PATH || '' }
  });
  let stdout = ''; let stderr = ''; let lineBuffer = '';
  const messages = [];
  const waiters = [];
  child.stdout.on('data', (chunk) => {
    stdout += chunk; lineBuffer += chunk;
    let boundary;
    while ((boundary = lineBuffer.indexOf('\n')) !== -1) {
      const line = lineBuffer.slice(0, boundary); lineBuffer = lineBuffer.slice(boundary + 1);
      const message = JSON.parse(line);
      if (message.type) {
        messages.push(message);
        for (const waiter of waiters.splice(0)) {
          if (waiter.type === message.type) waiter.resolve(message); else waiters.push(waiter);
        }
      }
    }
  });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const closed = once(child, 'close');
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await closed;
  });
  const message = (type) => {
    const existing = messages.find((value) => value.type === type);
    return existing ? Promise.resolve(existing) : Promise.race([
      new Promise((resolve) => waiters.push({ type, resolve })),
      closed.then(() => { throw new Error(`main exited before ${type}`); })
    ]);
  };
  return { child, closed, messages, message, output: () => ({ stdout, stderr }) };
}

test('normal main entrypoint wires consent, auth, Firestore and HTTP without Google calls', { timeout: 15000 }, async (t) => {
  const runtime = childRuntime(t, 'ready');
  const ready = await runtime.message('ready');
  assert.equal(ready.type, 'ready');
  assert(Number.isInteger(ready.port) && ready.port > 0);
  const denied = await rpc(ready.port);
  assert.equal(denied.status, 401);
  assert.equal(denied.json.error.code, 'MAIL_AUTH_REQUIRED');
  const response = await rpc(ready.port, { contractVersion: 1, operation: 'getSyncStatus', requestId: 'synthetic-startup-read',
    issuedAt: new Date().toISOString(), actor: { email: 'reader@abroad-o.com', authMode: 'domain' }, payload: {} });
  assert.equal(response.status, 200);
  for (const result of [denied, response]) {
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
  }
  const result = response.json;
  assert.equal(result.ok, true);
  assert.equal(result.sync.state, 'not_started');
  assert.equal(result.sync.pendingCount, null);
  assert.equal(result.sync.acceptanceReady, false);
  const stopped = runtime.message('stopped');
  runtime.child.stdin.end('stop\n');
  const summary = await stopped;
  assert.deepEqual(summary, { type: 'stopped', observed: {
    verifierClients: 1, mailboxClients: 1, secretReads: 1, verifications: 1, gmailCalls: 0
  } });
  assert.deepEqual(await runtime.closed, [0, null]);
  const output = runtime.output();
  assert.doesNotMatch(output.stderr, /MAIL_STARTUP_FAILED/);
  assert.doesNotMatch(output.stdout + output.stderr, /SYNTHETIC_(?:CLIENT_SECRET|REFRESH_TOKEN|ID_TOKEN)/);
});

test('normal main entrypoint fails closed for invalid consent before opening HTTP', { timeout: 15000 }, async (t) => {
  const runtime = childRuntime(t, 'invalid-consent');
  assert.deepEqual(await runtime.closed, [1, null]);
  assert.deepEqual(runtime.messages, []);
  const output = runtime.output();
  assert.equal(output.stdout, '');
  assert.match(output.stderr, /(?:^|\n)MAIL_STARTUP_FAILED\r?\n/);
  assert.doesNotMatch(output.stderr, /SYNTHETIC_(?:CLIENT_SECRET|REFRESH_TOKEN|ID_TOKEN)|MAIL_CONSENT_OUTDATED/);
});
