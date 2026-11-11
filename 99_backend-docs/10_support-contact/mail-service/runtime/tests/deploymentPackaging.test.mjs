import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = fileURLToPath(new URL('../../', import.meta.url));

test('deploy-only source contains the runtime import closure and loads consent without CLI files', async (t) => {
  const [cloudIgnore, dockerIgnore, dockerfile] = await Promise.all([
    readFile(join(source, '.gcloudignore'), 'utf8'), readFile(join(source, '.dockerignore'), 'utf8'),
    readFile(join(source, 'runtime/Dockerfile'), 'utf8')
  ]);
  // The staged boundary follows the current Cloud Build allowlist and Docker exclusions.
  for (const rule of ['*', '!/package.json', '!/package-lock.json', '!/*.mjs', '!/runtime/', '/runtime/*', '!/runtime/*.mjs']) {
    assert(cloudIgnore.split(/\r?\n/).includes(rule), `review deployment staging after changing ${rule}`);
  }
  assert(dockerIgnore.split(/\r?\n/).includes('tools'));
  assert.match(dockerfile, /^COPY \. \.$/m);
  assert.match(dockerfile, /^CMD \["node", "runtime\/main\.mjs"\]$/m);
  const stage = await mkdtemp(join(tmpdir(), 'contact-mail-deploy-'));
  t.after(async () => {
    assert(resolve(stage).startsWith(`${resolve(tmpdir())}${sep}`));
    await rm(stage, { recursive: true, force: true });
  });
  await mkdir(join(stage, 'runtime'));
  const paths = ['package.json', 'package-lock.json',
    ...(await readdir(source)).filter((name) => name.endsWith('.mjs')),
    ...(await readdir(join(source, 'runtime'))).filter((name) => name.endsWith('.mjs')).map((name) => `runtime/${name}`)];
  await Promise.all(paths.map((name) => copyFile(join(source, name), join(stage, name))));
  await assert.rejects(stat(join(stage, 'tools')), { code: 'ENOENT' });
  for (const name of paths.filter((value) => value.endsWith('.mjs'))) {
    const text = await readFile(join(stage, name), 'utf8');
    const imports = [...text.matchAll(/\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?['"](\.[^'"]+)['"]/g),
      ...text.matchAll(/\bimport\(\s*['"](\.[^'"]+)['"]/g)];
    for (const [, specifier] of imports) {
      const dependency = resolve(dirname(join(stage, name)), specifier);
      assert(!relative(stage, dependency).startsWith('..'), `${name} escapes the staged source`);
      assert((await stat(dependency)).isFile(), `${name} requires an excluded file: ${specifier}`);
    }
  }
  const module = await import(pathToFileURL(join(stage, 'runtime/mailboxConsent.mjs')).href);
  assert.equal(typeof module.createRuntimeGmailAdapter, 'function');
});
