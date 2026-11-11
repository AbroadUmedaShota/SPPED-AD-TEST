import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mock } from 'node:test';
import { createMailHttpServer as realCreateMailHttpServer } from '../../http.mjs';
import { MAILBOX, MAILBOX_DISCLOSURE_VERSION, mailboxDisclosure } from '../../mailboxDisclosure.mjs';
import { memoryFirestore } from '../memoryFirestore.mjs';

const scenario = process.argv[2];
assert(['ready', 'invalid-consent'].includes(scenario));
const db = memoryFirestore();
const observed = { verifierClients: 0, mailboxClients: 0, secretReads: 0, verifications: 0, gmailCalls: 0 };
const parameters = { retentionNotice: '合成試験用の手動削除', deletionContact: 'synthetic@example.com' };
const disclosure = mailboxDisclosure(parameters);
const credentials = {
  clientId: 'SYNTHETIC_CLIENT_ID', clientSecret: 'SYNTHETIC_CLIENT_SECRET', refreshToken: 'SYNTHETIC_REFRESH_TOKEN',
  consentReceipt: {
    disclosureVersion: scenario === 'invalid-consent' ? 'invalid' : MAILBOX_DISCLOSURE_VERSION,
    disclosure, disclosureParameters: parameters,
    disclosureSha256: createHash('sha256').update(disclosure, 'utf8').digest('hex'),
    acceptedAt: new Date().toISOString(), verifiedMailbox: MAILBOX
  }
};

// No SDK client or fetch in this child process may reach a real Google service.
globalThis.fetch = async () => { throw new Error('UNEXPECTED_NETWORK_CALL'); };
mock.module('google-auth-library', { namedExports: { OAuth2Client: class {
  constructor(clientId, clientSecret) {
    if (clientId === undefined) observed.verifierClients++;
    else {
      assert.equal(clientId, credentials.clientId);
      assert.equal(clientSecret, credentials.clientSecret);
      observed.mailboxClients++;
    }
  }
  setCredentials(value) { assert.deepEqual(value, { refresh_token: credentials.refreshToken }); }
  async verifyIdToken(value) {
    observed.verifications++;
    assert.deepEqual(value, { idToken: 'SYNTHETIC_ID_TOKEN', audience: 'synthetic-audience' });
    return { getPayload: () => ({ iss: 'https://accounts.google.com', aud: 'synthetic-audience',
      sub: 'synthetic-subject', email: 'synthetic@abroad-o.com', email_verified: true }) };
  }
  async getAccessToken() { observed.gmailCalls++; throw new Error('UNEXPECTED_GMAIL_CALL'); }
} } });
mock.module('@google-cloud/firestore', { namedExports: {
  Firestore: class {
    constructor(options) {
      assert.deepEqual(options, { ignoreUndefinedProperties: true, databaseId: 'synthetic-database' });
      return db;
    }
  },
  AggregateField: { sum() { throw new Error('UNEXPECTED_AGGREGATE'); } },
  FieldValue: { increment() { throw new Error('UNEXPECTED_WRITE'); } }
} });
mock.module('@google-cloud/secret-manager', { namedExports: { SecretManagerServiceClient: class {
  async accessSecretVersion(value) {
    observed.secretReads++;
    assert.deepEqual(value, { name: 'projects/synthetic-project/secrets/mailbox/versions/1' });
    return [{ payload: { data: Buffer.from(JSON.stringify(credentials)) } }];
  }
} } });
mock.module(new URL('../../http.mjs', import.meta.url).href, { namedExports: {
  createMailHttpServer(options) {
    const server = realCreateMailHttpServer(options);
    assert.equal(server.listenerCount('request'), 1);
    const listen = server.listen.bind(server);
    server.listen = (port, host) => {
      assert.equal(port, 8080);
      assert.equal(host, '0.0.0.0');
      // Validate main's binding arguments, then isolate the test on an ephemeral loopback port.
      return listen(0, '127.0.0.1');
    };
    server.once('listening', () => process.stdout.write(`${JSON.stringify({ type: 'ready', port: server.address().port })}\n`));
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (message) => {
      assert.equal(message, 'stop\n');
      server.close(() => {
        assert.equal(db.records.size, 0);
        process.stdout.write(`${JSON.stringify({ type: 'stopped', observed })}\n`);
        process.stdin.destroy();
      });
    });
    return server;
  }
} });

Object.assign(process.env, {
  MAIL_SCRIPT_AUDIENCE: 'synthetic-audience', MAIL_DEPLOYER_EMAIL: 'synthetic@abroad-o.com',
  MAIL_DEPLOYER_SUBJECT: 'synthetic-subject', FIRESTORE_DATABASE_ID: 'synthetic-database',
  MAILBOX_OAUTH_SECRET_VERSION: 'projects/synthetic-project/secrets/mailbox/versions/1', PORT: '8080'
});
await import('../../main.mjs');
