import test from 'node:test';
import assert from 'node:assert/strict';
import { createGmailAdapter } from '../googleAdapters.mjs';

test('Gmail runtime reads credentials with a consent receipt without forwarding that receipt', async () => {
  const oauthCalls = [];
  const requests = [];
  const credentials = { clientId: 'synthetic-client', clientSecret: 'synthetic-secret', refreshToken: 'synthetic-refresh',
    consentReceipt: { disclosureVersion: 'synthetic-version', disclosureSha256: 'a'.repeat(64),
      acceptedAt: '2026-11-10T14:00:00.000Z', verifiedMailbox: 'customer@speed-ad.com', disclosure: 'synthetic-disclosure' } };
  const gmail = await createGmailAdapter({
    secretVersion: 'projects/123/secrets/synthetic/versions/1',
    secretManager: { async accessSecretVersion() { return [{ payload: { data: Buffer.from(JSON.stringify(credentials)) } }]; } },
    createOAuthClient(clientId, clientSecret) {
      oauthCalls.push([clientId, clientSecret]);
      return {
        setCredentials(value) { oauthCalls.push(value); },
        async getAccessToken() { return { token: 'synthetic-token' }; },
        async getTokenInfo() { return { scopes: ['https://www.googleapis.com/auth/gmail.readonly'] }; }
      };
    },
    async fetchImpl(url, options) {
      requests.push({ url: String(url), options });
      return { ok: true, async json() { return { emailAddress: 'customer@speed-ad.com' }; } };
    }
  });
  assert.equal((await gmail.getProfile()).emailAddress, 'customer@speed-ad.com');
  assert.deepEqual(oauthCalls, [['synthetic-client', 'synthetic-secret'], { refresh_token: 'synthetic-refresh' }]);
  assert.equal(requests.length, 1);
  assert.doesNotMatch(JSON.stringify(requests), /synthetic-disclosure|synthetic-version|disclosureSha256|consentReceipt/);
});
