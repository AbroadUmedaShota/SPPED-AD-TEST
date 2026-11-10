import { readFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { reconcileAcceptance } from './acceptanceReconciliation.mjs';

const MAX_FILE_BYTES = 64 * 1024 * 1024;

export async function runAcceptanceCli(args, { read = async (path) => {
  if ((await stat(path)).size > MAX_FILE_BYTES) throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID');
  return readFile(path, 'utf8');
}, write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const paths = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    if (!['--sheet', '--sheet-after', '--gmail', '--app'].includes(key) || paths[key] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID');
    }
    paths[key] = args[index + 1];
  }
  if (Object.keys(paths).length !== 4) throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID');
  const values = await Promise.all(['sheet', 'gmail', 'app', 'sheetAfter'].map(async (source) =>
    [source, JSON.parse(await read(paths[source === 'sheetAfter' ? '--sheet-after' : `--${source}`]))]));
  const result = reconcileAcceptance(Object.fromEntries(values));
  write(result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAcceptanceCli(process.argv.slice(2)).then((result) => { process.exitCode = result.technicalReady ? 0 : 1; }).catch(() => {
    process.stderr.write('MAIL_ACCEPTANCE_INPUT_INVALID\n');
    process.exitCode = 2;
  });
}
