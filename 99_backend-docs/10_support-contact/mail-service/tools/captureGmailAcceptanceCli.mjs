import { createHash } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { captureGmailAcceptance } from './captureGmailAcceptance.mjs';
import { prepareCaptureFiles } from './privateCaptureFiles.mjs';

const date = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const inputError = () => { throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID'); };

export function parseGmailCaptureArguments(args, now = new Date()) {
  if (args.length === 0) return { execute: false, configured: false };
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const values = {}; const names = ['--project', '--confirm-project', '--secret-version', '--confirm-mailbox', '--run-id',
    '--start-at', '--cutoff-at', '--private-dir', '--key-file', '--out'];
  for (let index = 0; index < args.length; index++) {
    const name = args[index];
    if (name === '--execute') { if (values[name]) inputError(); values[name] = true; }
    else {
      if (!names.includes(name) || values[name] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) inputError();
      values[name] = args[++index];
    }
  }
  const projectId = values['--project'];
  if (names.some((name) => !values[name]) || !/^(?:[a-z][a-z0-9-]{4,61}[a-z0-9]|[1-9][0-9]{5,29})$/.test(projectId) ||
      values['--confirm-project'] !== projectId || values['--confirm-mailbox'] !== 'customer@speed-ad.com' ||
      !/^projects\/[^/]+\/secrets\/[A-Za-z0-9_-]+\/versions\/[1-9][0-9]*$/.test(values['--secret-version']) ||
      values['--secret-version'].split('/')[1] !== projectId || !/^[A-Za-z0-9._-]{1,80}$/.test(values['--run-id']) ||
      !date(values['--start-at']) || !date(values['--cutoff-at']) || values['--start-at'] > values['--cutoff-at'] ||
      values['--cutoff-at'] > now.toISOString() || !['--private-dir', '--key-file', '--out'].every((name) => isAbsolute(values[name])) ||
      !/\.json$/i.test(values['--out'])) inputError();
  return { execute: values['--execute'] === true, configured: true, projectId, secretVersion: values['--secret-version'],
    runId: values['--run-id'], startAt: values['--start-at'], cutoffAt: values['--cutoff-at'],
    privateDir: resolve(values['--private-dir']), keyFile: resolve(values['--key-file']), outputFile: resolve(values['--out']) };
}

export async function runGmailCaptureCli(args, { prepare = prepareCaptureFiles, createGmail, now = () => new Date(),
  write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const options = parseGmailCaptureArguments(args, now());
  if (options.help) {
    write({ code: 'MAIL_ACCEPTANCE_CAPTURE_HELP', operation: 'readOnlyGmailAcceptanceCapture', executeByDefault: false,
      required: ['--project', '--confirm-project', '--secret-version', '--confirm-mailbox', '--run-id', '--start-at', '--cutoff-at', '--private-dir', '--key-file', '--out'],
      executionFlag: '--execute', prerequisites: 'Google verification and owner consent, current acceptance-purpose receipt, approved human access, private directory and temporary 32-byte run key' });
    return { execute: false };
  }
  if (!options.configured) { write({ code: 'MAIL_ACCEPTANCE_CAPTURE_PLAN', execute: false, configured: false }); return { execute: false }; }
  const files = await prepare(options);
  try {
    if (!options.execute) { write({ code: 'MAIL_ACCEPTANCE_CAPTURE_PLAN', execute: false, configured: true }); return { execute: false }; }
    const gmail = await createGmail(options.secretVersion);
    const manifest = await captureGmailAcceptance({ gmail, runId: options.runId, key: files.key,
      hashKeyId: createHash('sha256').update(files.key).digest('hex'), startAt: options.startAt, cutoffAt: options.cutoffAt, now });
    await files.write(manifest);
    const result = { execute: true, sourceComplete: manifest.sourceComplete, code: manifest.sourceComplete ? 'MAIL_ACCEPTANCE_CAPTURE_COMPLETE' : 'MAIL_ACCEPTANCE_CAPTURE_INCOMPLETE',
      rowCount: manifest.rows.length, pageCount: manifest.pages.length, errors: manifest.errors };
    write(result); return result;
  } finally { await files.close(); }
}

export async function createCaptureGmail(secretVersion, load = () => Promise.all([
  import('@google-cloud/secret-manager'), import('google-auth-library'), import('../runtime/mailboxConsent.mjs')])) {
  const [{ SecretManagerServiceClient }, { OAuth2Client }, { createRuntimeGmailAdapter }] = await load();
  return createRuntimeGmailAdapter({ secretManager: new SecretManagerServiceClient(), secretVersion,
    createOAuthClient: (clientId, clientSecret) => new OAuth2Client(clientId, clientSecret) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runGmailCaptureCli(process.argv.slice(2), { createGmail: createCaptureGmail }).then((result) => {
    process.exitCode = result.execute && !result.sourceComplete ? 1 : 0;
  }).catch((error) => {
    const code = ['MAIL_ACCEPTANCE_INPUT_INVALID', 'MAIL_ACCEPTANCE_PRIVATE_PATH_REQUIRED', 'MAIL_CONSENT_OUTDATED'].includes(error?.code || error?.message) ? error.code || error.message : 'MAIL_ACCEPTANCE_CAPTURE_FAILED';
    process.stderr.write(`${code}\n`); process.exitCode = 2;
  });
}
