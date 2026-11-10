import { pathToFileURL } from 'node:url';
import { createMailPurge } from './mailPurge.mjs';

export function parsePurgeArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (['--apply', '--expired-exclusions', '--expired-case'].includes(key)) { if (options[key]) throw new Error('MAIL_PURGE_INPUT_INVALID'); options[key] = true; continue; }
    if (!['--project', '--confirm-project', '--database', '--case-id', '--request-reference', '--plan-hash'].includes(key) ||
        options[key] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('MAIL_PURGE_INPUT_INVALID');
    options[key] = args[++index];
  }
  if (!options['--project'] || options['--project'] !== options['--confirm-project'] || options['--database'] !== '(default)' ||
      (Boolean(options['--case-id']) === Boolean(options['--expired-exclusions'])) || (options['--expired-case'] && (!options['--case-id'] || options['--expired-exclusions'])) || !options['--request-reference'] || (options['--apply'] && !/^[a-f0-9]{64}$/.test(options['--plan-hash'] || '')) ||
      (!options['--apply'] && options['--plan-hash'])) throw new Error('MAIL_PURGE_INPUT_INVALID');
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(options['--project']) ||
      (options['--case-id'] && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(options['--case-id'])) ||
      !/^[A-Za-z0-9._-]{1,80}$/.test(options['--request-reference'])) throw new Error('MAIL_PURGE_INPUT_INVALID');
  return options;
}

export async function runPurgeCli(args, { createDatabase, write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const options = parsePurgeArguments(args);
  const db = await createDatabase(options['--project'], options['--database']);
  const purge = createMailPurge({ db, projectId: options['--project'], databaseId: options['--database'] });
  const result = options['--expired-case'] ? (options['--apply'] ? await purge.applyExpiredCase(options['--case-id'], options['--request-reference'], options['--plan-hash']) : await purge.planExpiredCase(options['--case-id'], options['--request-reference'])) : options['--expired-exclusions'] ? (options['--apply'] ? await purge.applyExpiredExclusions(options['--request-reference'], options['--plan-hash']) : await purge.planExpiredExclusions(options['--request-reference'])) :
    (options['--apply'] ? await purge.apply(options['--case-id'], options['--request-reference'], options['--plan-hash']) : await purge.plan(options['--case-id'], options['--request-reference']));
  write(result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPurgeCli(process.argv.slice(2), { createDatabase: async (projectId, databaseId) => {
    const { Firestore } = await import('@google-cloud/firestore');
    return new Firestore({ projectId, databaseId, ignoreUndefinedProperties: true });
  } }).catch((error) => {
    const code = /^MAIL_[A-Z_]+$/.test(error?.code || error?.message || '') ? error.code || error.message : 'MAIL_PURGE_FAILED';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
