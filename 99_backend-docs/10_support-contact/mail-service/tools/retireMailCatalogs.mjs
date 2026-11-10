import { pathToFileURL } from 'node:url';
import { createCatalogRetirement, createCatalogDocumentPager } from './catalogRetirement.mjs';

export function parseCatalogRetirementArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    if (!['--project', '--confirm-project', '--database', '--request-reference', '--operation', '--plan-hash', '--page-token'].includes(key) ||
        options[key] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error('MAIL_CATALOG_RETIRE_INPUT_INVALID');
    options[key] = args[++index];
  }
  const operation = options['--operation'];
  if (!/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(options['--project'] || '') || options['--project'] !== options['--confirm-project'] ||
      options['--database'] !== '(default)' || !/^[A-Za-z0-9._-]{1,80}$/.test(options['--request-reference'] || '') ||
      !['plan', 'apply', 'status', 'cancel'].includes(operation) ||
      (operation === 'plan' ? options['--plan-hash'] !== undefined : !/^[a-f0-9]{64}$/.test(options['--plan-hash'] || '')) ||
      (options['--page-token'] !== undefined && (!['plan', 'apply'].includes(operation) || options['--page-token'].length > 8192))) {
    throw new Error('MAIL_CATALOG_RETIRE_INPUT_INVALID');
  }
  return options;
}

export async function runCatalogRetirementCli(args, { createDatabase, createPager, write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const options = parseCatalogRetirementArguments(args);
  const db = await createDatabase(options['--project'], options['--database']);
  let pager;
  try {
    pager = await createPager(options['--project'], options['--database']);
    const cleanup = createCatalogRetirement({ db, listCatalogPage: pager.listCatalogPage, projectId: options['--project'], databaseId: options['--database'] });
    const reference = options['--request-reference'];
    const operation = options['--operation'];
    const result = operation === 'plan' ? await cleanup.plan(reference, options['--page-token']) :
      operation === 'apply' ? await cleanup.apply(reference, options['--plan-hash'], options['--page-token']) :
        await cleanup[operation](reference, options['--plan-hash']);
    write(result);
    return result;
  } finally {
    try { await pager?.close?.(); } finally { await db.terminate?.(); }
  }
}

export async function createCatalogRetirementPager(projectId, databaseId) {
  const { default: firestore } = await import('@google-cloud/firestore');
  const client = new firestore.v1.FirestoreClient();
  return { listCatalogPage: createCatalogDocumentPager({ client, projectId, databaseId }), close: () => client.close() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCatalogRetirementCli(process.argv.slice(2), {
    createDatabase: async (projectId, databaseId) => {
      const { Firestore } = await import('@google-cloud/firestore');
      return new Firestore({ projectId, databaseId, ignoreUndefinedProperties: true });
    },
    createPager: createCatalogRetirementPager
  }).catch((error) => {
    const code = /^MAIL_[A-Z_]+$/.test(error?.code || error?.message || '') ? error.code || error.message : 'MAIL_CATALOG_RETIRE_FAILED';
    process.stderr.write(`${code}\n`);
    process.exitCode = 1;
  });
}
