import { OAuth2Client } from 'google-auth-library';
import { Firestore } from '@google-cloud/firestore';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import * as classification from '../classification.mjs';
import * as mime from '../mime.mjs';
import * as review from '../review.mjs';
import * as safeMail from '../safeMail.mjs';
import { createGoogleVerifier } from './auth.mjs';
import { createFirestoreStore } from './firestoreStore.mjs';
import { createRuntimeGmailAdapter } from './mailboxConsent.mjs';
import { createMailHttpServer } from './http.mjs';
import { createMailService } from './service.mjs';

async function main() {
  const verify = createGoogleVerifier({ client: new OAuth2Client(), audience: process.env.MAIL_SCRIPT_AUDIENCE,
    deployerEmail: process.env.MAIL_DEPLOYER_EMAIL, deployerSubject: process.env.MAIL_DEPLOYER_SUBJECT });
  const db = new Firestore({ ignoreUndefinedProperties: true,
    ...(process.env.FIRESTORE_DATABASE_ID ? { databaseId: process.env.FIRESTORE_DATABASE_ID } : {}) });
  const gmail = await createRuntimeGmailAdapter({ secretManager: new SecretManagerServiceClient(),
    secretVersion: process.env.MAILBOX_OAUTH_SECRET_VERSION,
    createOAuthClient: (clientId, clientSecret) => new OAuth2Client(clientId, clientSecret) });
  const execute = createMailService({ store: createFirestoreStore(db), gmail,
    core: { ...classification, ...mime, ...review, ...safeMail } });
  const port = Number(process.env.PORT || 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MAIL_NOT_CONFIGURED');
  createMailHttpServer({ verify, execute, log: (event) => process.stdout.write(`${JSON.stringify(event)}\n`) }).listen(port, '0.0.0.0');
}

main().catch(() => {
  process.stderr.write('MAIL_STARTUP_FAILED\n');
  process.exitCode = 1;
});
