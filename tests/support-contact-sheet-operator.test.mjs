import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const root = new URL('../99_backend-docs/10_support-contact/viewer-workspace-gas/', import.meta.url);
const code = readFileSync(new URL('Code.gs', root), 'utf8');
const acceptance = readFileSync(new URL('SheetAcceptance.gs', root), 'utf8');
const page = readFileSync(new URL('SheetAcceptance.html', root), 'utf8');
const script = page.match(/<script>([\s\S]*?)<\/script>/)[1];
const hash = 'a'.repeat(64);
const run = { runId: 'acceptance-1', startAt: '2026-11-08T15:00:00.000Z', cutoffAt: '2026-11-10T01:00:00.000Z', hashKeyBase64: Buffer.alloc(32, 7).toString('base64') };
const result = () => ({ ok: true, manifest: { schemaVersion: 1, source: 'sheet', runId: run.runId, hashKeyId: hash,
  startAt: run.startAt, cutoffAt: run.cutoffAt, capturedAt: '2026-11-11T00:00:00.000Z', sourceComplete: true, errors: [],
  pages: [{ index: 0, requestTokenHash: null, nextTokenHash: null, rowCount: 1 }],
  rows: [{ caseHash: hash, submittedAt: '2026-11-10T00:00:00.000Z', handledStatus: '未対応', closedAt: null }] },
receipt: { catalogDigest: hash, total: 1, readCount: 2 } });

test('dedicated Sheet operator route renders only after server domain authorization', () => {
  for (const actor of [{ allowed: true, authMode: 'domain' }, { allowed: true, authMode: 'google-oauth' }, null]) {
    const rendered = [];
    const context = { HtmlService: { createHtmlOutputFromFile(name) { rendered.push(name); return { setTitle: () => 'rendered' }; } } };
    vm.createContext(context); vm.runInContext(code, context); vm.runInContext(acceptance, context);
    context.requireViewer_ = () => { if (!actor) throw new Error('AUTH_REQUIRED'); return actor; };
    if (actor?.authMode === 'domain') assert.equal(context.doGet({ parameter: { operator: 'sheet-acceptance' } }), 'rendered');
    else assert.throws(() => context.doGet({ parameter: { operator: 'sheet-acceptance' } }), /AUTH_REQUIRED|FORBIDDEN/);
    assert.equal(rendered.length, actor?.authMode === 'domain' ? 1 : 0);
  }
});

test('operator route rejects query input fields and repeated route parameters', () => {
  const context = {};
  vm.createContext(context); vm.runInContext(code, context);
  context.renderSheetAcceptance_ = () => { throw new Error('must not render'); };
  assert.throws(() => context.doGet({ parameter: { operator: 'sheet-acceptance', hashKeyBase64: 'key' } }), /MAIL_ACCEPTANCE_INPUT_INVALID/);
  assert.throws(() => context.doGet({ parameter: { operator: 'sheet-acceptance' }, parameters: { operator: ['sheet-acceptance', 'sheet-acceptance'] } }), /MAIL_ACCEPTANCE_INPUT_INVALID/);
});

function browser({ actor = { allowed: true, authMode: 'domain' }, response = result(), failure = null } = {}) {
  const listeners = {}; const calls = []; const urls = []; const revoked = []; const downloads = []; const blobs = [];
  const fields = Object.fromEntries(['capture-form', 'capture-phase', 'run-id', 'start-at', 'cutoff-at', 'hash-key', 'capture', 'status'].map((id) => [id, {
    value: '', textContent: '', disabled: false, addEventListener: (event, listener) => { listeners[`${id}:${event}`] = listener; },
  }]));
  fields['capture-phase'].value = 'before'; fields['run-id'].value = run.runId; fields['start-at'].value = run.startAt; fields['cutoff-at'].value = run.cutoffAt; fields['hash-key'].value = run.hashKeyBase64;
  const context = { document: { getElementById: (id) => fields[id], body: { appendChild() {} },
    createElement: () => ({ click() { downloads.push({ href: this.href, download: this.download }); }, remove() {} }) },
  URL: { createObjectURL(blob) { blobs.push(blob); const url = 'blob:synthetic'; urls.push(url); return url; }, revokeObjectURL: (url) => revoked.push(url) },
  Blob: class { constructor(parts, options) { this.parts = parts; this.options = options; } },
  atob: (value) => Buffer.from(value, 'base64').toString('binary'), btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  google: { script: { run: { withSuccessHandler(success) { return { withFailureHandler(fail) { return {
    getViewerContext() { calls.push('auth'); success(actor); },
    exportContactMailSheetAcceptance(options, authProof) { calls.push({ options: JSON.parse(JSON.stringify(options)), authProof }); if (failure) fail(failure); else success(response); },
  }; } }; } } } },
  console: { log() { throw new Error('console logging forbidden'); }, error() { throw new Error('console logging forbidden'); } },
  localStorage: new Proxy({}, { get() { throw new Error('storage forbidden'); } }), location: new Proxy({}, { get() { throw new Error('URL access forbidden'); } }),
  };
  vm.createContext(context); vm.runInContext(script, context);
  return { fields, calls, blobs, urls, revoked, downloads, async submit() { await listeners['capture-form:submit']({ preventDefault() {} }); } };
}

test('operator downloads only manifest and receipt, revokes Blob URL and clears temporary key', async () => {
  const app = browser(); await app.submit();
  assert.equal(app.calls[0], 'auth'); assert.equal(app.calls[1].authProof, '');
  assert.deepEqual(app.calls[1].options, run);
  assert.equal(app.fields['hash-key'].value, ''); assert.equal(app.fields.capture.disabled, false);
  assert.deepEqual(app.downloads, [{ href: 'blob:synthetic', download: 'speed-ad-sheet-before.json' }]);
  assert.deepEqual(app.revoked, app.urls);
  const downloaded = JSON.parse(app.blobs[0].parts.join(''));
  assert.deepEqual(Object.keys(downloaded).sort(), ['manifest', 'receipt']);
  assert.doesNotMatch(JSON.stringify(downloaded), /hashKeyBase64|BwcHBw/);
  assert.doesNotMatch(app.fields.status.textContent, /aaaaaa|BwcHBw/);
});

test('Sheet-after selector changes only the fixed local filename', async () => {
  const app = browser(); app.fields['capture-phase'].value = 'after'; await app.submit();
  assert.equal(app.downloads[0].download, 'speed-ad-sheet-after.json');
  assert.deepEqual(app.calls[1].options, run);
});

test('operator rejects auth denial and malformed input without export or download and clears key', async () => {
  for (const actor of [null, { allowed: true, authMode: 'google-oauth' }, { allowed: false, authMode: 'domain' }]) {
    const app = browser({ actor }); await app.submit();
    assert.deepEqual(app.calls, ['auth']); assert.equal(app.downloads.length, 0); assert.equal(app.fields['hash-key'].value, '');
  }
  const app = browser(); app.fields['run-id'].value = '../invalid'; await app.submit();
  assert.equal(app.calls.length, 0); assert.equal(app.downloads.length, 0); assert.equal(app.fields['hash-key'].value, '');
});

test('operator hides arbitrary failure text and rejects incomplete or mismatched responses', async () => {
  const failed = browser({ failure: { message: 'secret-key-and-contact-data' } }); await failed.submit();
  assert.equal(failed.fields['hash-key'].value, ''); assert.doesNotMatch(failed.fields.status.textContent, /secret|contact-data/); assert.equal(failed.downloads.length, 0);
  for (const mutate of [(r) => { r.manifest.sourceComplete = false; }, (r) => { r.manifest.rows[0].caseHash = 'raw-case-id'; },
    (r) => { r.manifest.runId = 'different'; }, (r) => { r.receipt.total = 2; }, (r) => { r.manifest.rows[0].subject = 'private'; }]) {
    const response = result(); mutate(response); const app = browser({ response }); await app.submit();
    assert.equal(app.downloads.length, 0); assert.equal(app.fields['hash-key'].value, '');
  }
});

test('operator markup never serializes fields through URL forms or browser storage', () => {
  assert.match(page, /method="post"/);
  assert.doesNotMatch(page, /<(?:input|select|button|form)[^>]*\bname=|localStorage|sessionStorage|console\.|location\.|URLSearchParams|innerHTML/);
  assert.match(page, /type="password"[^>]+autocomplete="off"/);
  assert.match(page, /<form[^>]+novalidate/);
});

test('deployment source set includes both Sheet acceptance files', () => {
  const commands = readFileSync(new URL('../docs/ハンドブック/デプロイ/11_SUPPORT_CONTACT_MAIL_DEPLOY_COMMANDS.md', import.meta.url), 'utf8');
  const expected = [...commands.match(/\$ExpectedGasFiles = @\(([\s\S]*?)\)/)[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort();
  const actual = readdirSync(root).filter((name) => /\.(?:gs|html)$/.test(name) || name === 'appsscript.json').sort();
  assert.deepEqual(expected, actual);
});
