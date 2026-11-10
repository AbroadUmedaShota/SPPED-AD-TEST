import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { authorizeMailbox, MAILBOX, OnboardingError } from './mailboxOnboarding.mjs';

export function parseArguments(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const values = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (['--execute', '--desktop-client'].includes(arg)) {
      if (values[arg]) throw new OnboardingError('INVALID_ARGUMENTS');
      values[arg] = true;
    } else if (['--secret', '--confirm-mailbox'].includes(arg)) {
      if (values[arg] || !args[index + 1] || args[index + 1].startsWith('--')) throw new OnboardingError('INVALID_ARGUMENTS');
      values[arg] = args[++index];
    } else throw new OnboardingError('INVALID_ARGUMENTS');
  }
  return { execute: values['--execute'] === true, desktopClient: values['--desktop-client'] === true,
    secretName: values['--secret'], confirmMailbox: values['--confirm-mailbox'] };
}

export async function openSystemBrowser(url, { platform = process.platform, spawnImpl = spawn, env = process.env } = {}) {
  const commands = { win32: ['rundll32.exe', ['url.dll,FileProtocolHandler', url]], darwin: ['open', [url]], linux: ['xdg-open', [url]] };
  const command = commands[platform];
  if (!command) throw new OnboardingError('BROWSER_OPEN_FAILED');
  const browserEnv = Object.fromEntries(Object.entries(env).filter(([name]) =>
    !['MAIL_OAUTH_CLIENT_ID', 'MAIL_OAUTH_CLIENT_SECRET'].includes(name.toUpperCase())));
  await new Promise((resolve, reject) => {
    const child = spawnImpl(command[0], command[1], { shell: false, windowsHide: true, detached: true, stdio: 'ignore', env: browserEnv });
    child.once('error', () => reject(new OnboardingError('BROWSER_OPEN_FAILED')));
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const options = parseArguments(args);
  if (options.help) {
    process.stdout.write(`node tools/authorizeMailbox.mjs --execute --desktop-client --confirm-mailbox ${MAILBOX} --secret projects/PROJECT/secrets/EXISTING_SECRET\n`);
    process.stdout.write('Requires MAIL_OAUTH_CLIENT_ID and MAIL_OAUTH_CLIENT_SECRET in the process environment, an approved Desktop OAuth client, owner consent, and Secret Manager ADC permission.\n');
    return;
  }
  const config = { ...options, clientId: env.MAIL_OAUTH_CLIENT_ID, clientSecret: env.MAIL_OAUTH_CLIENT_SECRET };
  // Validate explicit intent before importing Google clients or opening any browser/listener.
  const { validateOnboardingOptions } = await import('./mailboxOnboarding.mjs');
  validateOnboardingOptions(config);
  const [{ OAuth2Client }, { SecretManagerServiceClient }] = await Promise.all([
    import('google-auth-library'), import('@google-cloud/secret-manager')
  ]);
  const result = await authorizeMailbox(config, {
    createOAuthClient: (clientId, clientSecret, redirectUri) => new OAuth2Client(clientId, clientSecret, redirectUri),
    secretManager: new SecretManagerServiceClient(), openAuthorization: openSystemBrowser
  });
  process.stdout.write(`Stored mailbox authorization: ${result.secretVersion}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = error instanceof OnboardingError ? error.code : 'ONBOARDING_FAILED';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
