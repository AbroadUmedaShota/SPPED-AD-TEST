import { pathToFileURL } from 'node:url';
import { createMarkerCleanup } from './markerCleanup.mjs';
import { MAILBOX_DISCLOSURE_VERSION, MAILBOX_MARKER_DISCLOSURE } from './mailboxOnboarding.mjs';

export function parseMarkerArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (!['--project', '--confirm-project', '--database', '--request-reference', '--operation', '--plan-hash', '--deletion-hash',
      '--after-marker', '--secret-version'].includes(key) || options[key] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error('MAIL_MARKER_INPUT_INVALID');
    }
    options[key] = args[++index];
  }
  const operation = options['--operation'];
  const hash = /^[a-f0-9]{64}$/;
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(options['--project'] || '') || options['--project'] !== options['--confirm-project'] ||
      options['--database'] !== '(default)' || !/^[A-Za-z0-9._-]{1,80}$/.test(options['--request-reference'] || '') ||
      !['plan', 'advance', 'apply', 'status', 'cancel'].includes(operation) ||
      (operation === 'plan' ? options['--plan-hash'] !== undefined : !hash.test(options['--plan-hash'] || '')) ||
      (operation === 'apply' ? !hash.test(options['--deletion-hash'] || '') : options['--deletion-hash'] !== undefined) ||
      (options['--after-marker'] !== undefined && (!['plan', 'advance'].includes(operation) || !hash.test(options['--after-marker']))) ||
      (['advance', 'apply'].includes(operation) ? !/^projects\/[a-z0-9-]+\/secrets\/[A-Za-z0-9_-]+\/versions\/[1-9][0-9]*$/.test(options['--secret-version'] || '') : options['--secret-version'] !== undefined)) {
    throw new Error('MAIL_MARKER_INPUT_INVALID');
  }
  return options;
}

export async function runMarkerCli(args, { createDatabase, createGmail, write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const options = parseMarkerArguments(args);
  const db = await createDatabase(options['--project'], options['--database']);
  const gmail = ['advance', 'apply'].includes(options['--operation']) ? await createGmail(options['--secret-version']) : null;
  const cleanup = createMarkerCleanup({ db, gmail, projectId: options['--project'], databaseId: options['--database'] });
  const reference = options['--request-reference'];
  const planHash = options['--plan-hash'];
  const result = options['--operation'] === 'plan' ? await cleanup.plan(reference, options['--after-marker']) :
    options['--operation'] === 'advance' ? await cleanup.advance(reference, planHash, options['--after-marker']) :
      options['--operation'] === 'apply' ? await cleanup.apply(reference, planHash, options['--deletion-hash']) :
        await cleanup[options['--operation']](reference, planHash);
  write(result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runMarkerCli(process.argv.slice(2), {
    createDatabase: async (projectId, databaseId) => {
      const { Firestore } = await import('@google-cloud/firestore');
      return new Firestore({ projectId, databaseId, ignoreUndefinedProperties: true });
    },
    createGmail: async (secretVersion) => {
      const [{ SecretManagerServiceClient }, { OAuth2Client }, { createGmailAdapter }] = await Promise.all([
        import('@google-cloud/secret-manager'), import('google-auth-library'), import('../runtime/googleAdapters.mjs')]);
      return createGmailAdapter({ secretManager: new SecretManagerServiceClient(), secretVersion,
        createOAuthClient: (clientId, clientSecret) => new OAuth2Client(clientId, clientSecret),
        requiredDisclosureVersion: MAILBOX_DISCLOSURE_VERSION, requiredDisclosureClause: MAILBOX_MARKER_DISCLOSURE });
    }
  }).catch((error) => {
    const code = /^MAIL_[A-Z_]+$/.test(error?.code || error?.message || '') ? error.code || error.message : 'MAIL_MARKER_FAILED';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
