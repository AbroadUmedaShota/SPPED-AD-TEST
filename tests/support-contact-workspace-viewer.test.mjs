import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const root = new URL('../99_backend-docs/10_support-contact/viewer-workspace-gas/', import.meta.url);
const source = readFileSync(new URL('Code.gs', root), 'utf8');
const html = readFileSync(new URL('Index.html', root), 'utf8');
const publicNames = ['doGet', 'getViewerContext', 'listContactSubmissions', 'getContactSubmission', 'getAttachmentPreview', 'updateContactSubmissionStatus'];

function runtime(email = 'reader@abroad-o.com', { sessionThrows = false, missingProperty = '', missingHeader = '', trashed = false, mimeType = 'image/webp' } = {}) {
  const accesses = [];
  const writes = [];
  const templates = [];
  const headers = ['submission_id', 'submitted_at', 'contact_type', 'name', 'email', 'subject', 'message', 'attachment_count', 'attachment_refs', 'source_url', 'user_agent', 'storage_status', 'mail_status', 'handled_status', 'handled_by', 'handled_at', 'internal_note'].filter((key) => key !== missingHeader);
  const records = [
    { submission_id: 'case-a', submitted_at: '2026-11-10T00:00:00Z', subject: '<img src=x onerror=alert(1)>', message: '</div><script>bad()</script>', email: 'customer@example.com', attachment_count: '3', attachment_refs: 'file-a:https://drive.google.com/file/d/file-a/view,file-out:javascript:bad(),file-swapped:javascript:bad()', handled_status: '未対応' },
    { submission_id: 'case-b', submitted_at: '2026-11-09T00:00:00Z', subject: 'other case', attachment_count: '1', attachment_refs: 'file-b:https://drive.google.com/file/d/file-b/view', handled_status: '対応済み' },
  ];
  const rows = [headers.slice(), ...records.map((record) => headers.map((key) => record[key] || ''))];
  const sheet = {
    getLastColumn: () => headers.length,
    getDataRange: () => ({ getValues: () => rows.map((row) => row.slice()) }),
    getRange(row, col, height = 1, width = 1) {
      return {
        getValues: () => Array.from({ length: height }, (_, offset) => Array.from({ length: width }, (_, index) => rows[row - 1 + offset]?.[col - 1 + index] || '')),
        setValue(value) {
          writes.push({ row, col, value });
          rows[row - 1][col - 1] = typeof value === 'string' && value.startsWith("'") ? value.slice(1) : value;
        },
        setValues() { throw new Error('Unexpected schema mutation'); },
      };
    },
  };
  const properties = { SPREADSHEET_ID: 'configured-sheet', DRIVE_FOLDER_ID: 'configured-folder', CONTACT_SHEET_NAME: 'contact_submissions', CONTACT_VIEWER_ACCESS_TOKEN: 'old-token', CONTACT_VIEWER_EMAILS: 'outsider@example.com' };
  delete properties[missingProperty];
  const sandbox = {
    Session: {
      getActiveUser() {
        if (sessionThrows) throw new Error('Identity unavailable');
        return { getEmail: () => email };
      },
      getEffectiveUser() { throw new Error('Effective user must never be used'); },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty(key) { accesses.push(`property:${key}`); return properties[key] ?? null; } }) },
    SpreadsheetApp: { openById(id) {
      accesses.push(`sheet:${id}`);
      assert.equal(id, 'configured-sheet');
      return { getSheetByName(name) { assert.equal(name, 'contact_submissions'); return sheet; } };
    } },
    DriveApp: { getFileById(id) {
      accesses.push(`file:${id}`);
      assert.ok(['file-a', 'file-b', 'file-out', 'file-swapped', 'unreferenced'].includes(id));
      const parentIds = id === 'file-out' ? ['other-folder'] : ['configured-folder'];
      let cursor = 0;
      return {
        getId: () => id,
        getName: () => `${id === 'file-b' || id === 'file-swapped' ? 'case-b' : 'case-a'}-1-image.webp`,
        getParents: () => ({ hasNext: () => cursor < parentIds.length, next: () => ({ getId: () => parentIds[cursor++] }) }),
        isTrashed: () => trashed,
        getMimeType: () => mimeType,
        getDescription: () => '{}',
        getSize: () => 3,
        getUrl: () => `https://drive.google.com/file/d/${id}/view`,
        getBlob() { accesses.push(`blob:${id}`); return { getContentType: () => mimeType, getBytes: () => [1, 2, 3] }; },
      };
    } },
    Utilities: { base64Encode: (bytes) => Buffer.from(bytes).toString('base64') },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createTemplateFromFile(name) {
      assert.equal(name, 'Index');
      const template = { evaluate() { return { setTitle() { return this; }, setXFrameOptionsMode() { return this; } }; } };
      templates.push(template);
      return template;
    } },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'Code.gs' });
  return { api: sandbox, accesses, writes, templates, rows, headers, setEmail(value) { email = value; } };
}

const deniedCalls = [
  ['doGet', [{ parameter: { id: 'case-a', token: 'old-token', email: 'reader@abroad-o.com' } }]],
  ['getViewerContext', ['old-token', { email: 'reader@abroad-o.com', allowed: true }]],
  ['listContactSubmissions', [{ status: 'all', token: 'old-token', email: 'reader@abroad-o.com' }]],
  ['getContactSubmission', ['case-a', 'old-token']],
  ['getAttachmentPreview', ['case-a', 'file-a', 'old-token']],
  ['updateContactSubmissionStatus', ['case-a', '対応中', 'memo', { email: 'reader@abroad-o.com', token: 'old-token' }]],
];

for (const email of ['', null, 'outsider@example.com', 'customer@speed-ad.com', 'reader@sub.abroad-o.com', 'reader@abroad-o.com.evil', 'reader@evilabroad-o.com', 'reader@@abroad-o.com', '@abroad-o.com']) {
  test(`all public entry points deny ${JSON.stringify(email)} before datastore access`, () => {
    const env = runtime(email);
    for (const [name, args] of deniedCalls) {
      assert.throws(() => env.api[name](...args), /権限/);
    }
    assert.deepEqual(env.accesses, []);
    assert.deepEqual(env.writes, []);
    assert.deepEqual(env.templates, []);
  });
}

test('unavailable Session identity fails closed for every public entry point', () => {
  const env = runtime('reader@abroad-o.com', { sessionThrows: true });
  for (const [name, args] of deniedCalls) assert.throws(() => env.api[name](...args), /権限/);
  assert.deepEqual(env.accesses, []);
});

for (const email of ['reader@abroad-o.com', '  AnOther.User@ABROAD-O.COM  ']) {
  test(`company identity ${email} reads and updates with actual normalized actor`, () => {
    const { api, accesses, rows, headers, templates } = runtime(email);
    const normalized = email.trim().toLowerCase();
    api.doGet({ parameter: { id: 'case-b' } });
    assert.equal(templates[0].initialSubmissionId, 'case-b');
    assert.equal(templates[0].viewerContext.email, normalized);
    assert.equal(api.getViewerContext().allowed, true);
    const list = api.listContactSubmissions({ status: 'all' });
    assert.equal(list.viewerEmail, normalized);
    assert.equal(list.counts.total, 2);
    assert.equal(list.submissions.length, 2);
    assert.equal(api.listContactSubmissions({ status: 'active' }).submissions.length, 1);
    assert.equal(api.listContactSubmissions({ query: 'other' }).submissions[0].submission_id, 'case-b');
    assert.equal(api.getContactSubmission('case-a').submission.subject, '<img src=x onerror=alert(1)>');
    const result = api.updateContactSubmissionStatus('case-a', '対応中', '  memo  ', 'forged@abroad-o.com');
    assert.equal(result.submission.handled_status, '対応中');
    assert.equal(result.submission.internal_note, 'memo');
    assert.equal(result.submission.handled_by, normalized);
    assert.ok(Number.isFinite(Date.parse(result.submission.handled_at)));
    assert.equal(rows[2][headers.indexOf('handled_status')], '対応済み');
    assert.ok(!accesses.some((entry) => /TOKEN|EMAILS/.test(entry)));
  });
}

test('status and nonexistent row guards prevent writes; only handling fields are updated', () => {
  const { api, writes, headers } = runtime();
  assert.throws(() => api.updateContactSubmissionStatus('case-a', 'delete', 'memo'), /ステータス/);
  assert.throws(() => api.updateContactSubmissionStatus('missing', '対応中', 'memo'), /見つかりません/);
  assert.throws(() => api.updateContactSubmissionStatus('', '対応中', 'memo'), /見つかりません/);
  assert.deepEqual(writes, []);
  api.updateContactSubmissionStatus('case-a', '保留', '=IMPORTXML("https://example.com","//x")');
  assert.deepEqual(writes.map(({ col }) => headers[col - 1]).sort(), ['handled_at', 'handled_by', 'handled_status', 'internal_note']);
  assert.ok(writes.find(({ col }) => headers[col - 1] === 'internal_note').value.startsWith("'="), 'memo must be stored as text');
});

test('missing schema fails closed without silently creating columns', () => {
  const { api, writes } = runtime('reader@abroad-o.com', { missingHeader: 'handled_by' });
  assert.throws(() => api.updateContactSubmissionStatus('case-a', '対応中', 'memo'), /列/);
  assert.deepEqual(writes, []);
});

test('attachment preview requires the selected row reference and configured folder', () => {
  const { api, accesses } = runtime();
  assert.equal(api.getAttachmentPreview('case-a', 'file-a').dataUrl, 'data:image/webp;base64,AQID');
  assert.equal(api.getAttachmentPreview('case-b', 'file-b').fileId, 'file-b');
  assert.throws(() => api.getAttachmentPreview('case-a', 'file-b'), /添付/);
  assert.throws(() => api.getAttachmentPreview('case-a', 'unreferenced'), /添付/);
  assert.throws(() => api.getAttachmentPreview('missing', 'file-a'), /見つかりません/);
  assert.throws(() => api.getAttachmentPreview('case-a', 'file-out'), /フォルダ/);
  assert.throws(() => api.getAttachmentPreview('case-a', 'file-swapped'), /添付/);
  assert.ok(!accesses.includes('file:unreferenced'));
  assert.ok(!accesses.includes('blob:file-out'));
  assert.ok(!accesses.includes('blob:file-swapped'));
  const detail = api.getContactSubmission('case-a').submission;
  for (const id of ['file-out', 'file-swapped']) {
    const attachment = detail.attachments.find((item) => item.fileId === id);
    assert.ok(attachment.error);
    assert.equal(attachment.url, '');
    assert.equal(attachment.originalName, undefined);
  }
});

test('missing configured resource IDs never fall back to another datastore', () => {
  for (const key of ['SPREADSHEET_ID', 'DRIVE_FOLDER_ID']) {
    const env = runtime('reader@abroad-o.com', { missingProperty: key });
    assert.throws(() => key === 'SPREADSHEET_ID' ? env.api.listContactSubmissions({}) : env.api.getAttachmentPreview('case-a', 'file-a'), new RegExp(key));
    assert.deepEqual(env.writes, []);
  }
});

test('only the approved RPC surface is public; no cleanup, setup or property writers', () => {
  const { api } = runtime();
  const actual = Object.keys(api).filter((name) => typeof api[name] === 'function' && !name.endsWith('_')).sort();
  assert.deepEqual(actual, publicNames.slice().sort());
  assert.doesNotMatch(source, /getEffectiveUser|setTrashed|deleteRow|setProperty|setProperties|CONTACT_VIEWER_ACCESS_TOKEN|CONTACT_VIEWER_EMAILS|UrlFetchApp/);
  assert.equal(existsSync(new URL('.clasp.json', root)), false);
});

test('manifest restricts deployment to domain, deployer execution and minimum used services', () => {
  const manifest = JSON.parse(readFileSync(new URL('appsscript.json', root), 'utf8'));
  assert.deepEqual(manifest.webapp, { executeAs: 'USER_DEPLOYING', access: 'DOMAIN' });
  assert.deepEqual(manifest.oauthScopes.slice().sort(), [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ].sort());
});

test('UI has no token storage and safely serializes template values', () => {
  assert.doesNotMatch(html, /accessToken|AccessToken|ACCESS_TOKEN|sessionStorage|validateViewerAccessToken/);
  assert.match(html, /JSON\.stringify\(initialSubmissionId\)\.replace\(/);
  assert.match(html, /JSON\.stringify\(viewerContext\)\.replace\(/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const [, script] of scripts) new vm.Script(script.replace(/<\?[\s\S]*?\?>/g, 'null'));
});


test('each RPC rechecks active identity after a previously authorized request', () => {
  const env = runtime();
  assert.equal(env.api.getViewerContext().allowed, true);
  env.setEmail('outsider@example.com');
  for (const [name, args] of deniedCalls) assert.throws(() => env.api[name](...args), /権限/);
  assert.deepEqual(env.accesses, []);
  env.setEmail('second@abroad-o.com');
  assert.equal(env.api.updateContactSubmissionStatus('case-a', '対応済み', '').submission.handled_by, 'second@abroad-o.com');
});

test('trashed and non-image files cannot be previewed', () => {
  const trashed = runtime('reader@abroad-o.com', { trashed: true });
  assert.throws(() => trashed.api.getAttachmentPreview('case-a', 'file-a'), /添付/);
  assert.ok(!trashed.accesses.includes('blob:file-a'));
  const nonImage = runtime('reader@abroad-o.com', { mimeType: 'text/html' });
  assert.throws(() => nonImage.api.getAttachmentPreview('case-a', 'file-a'), /画像/);
});

function uiRuntime(env = runtime(), initialId = '') {
  const elements = new Map();
  const calls = [];
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      value: id === 'statusFilter' ? 'active' : '',
      hidden: true,
      innerHTML: '',
      classList: { add() {}, remove() {} },
      options: [{ value: 'active', textContent: '対応が必要' }],
      addEventListener() {}, removeAttribute() {}, setAttribute() {},
      querySelectorAll: () => [],
    });
    return elements.get(id);
  };
  // Handlers belong to each pending call, just like google.script.run's builder.
  const run = {
    withSuccessHandler(success) {
      return { withFailureHandler(failure) {
        return new Proxy({}, { get(_target, key) {
          return (...args) => {
            calls.push([key, ...args]);
            try { success(env.api[key](...args)); } catch (error) { failure(error); }
          };
        } });
      } };
    },
  };
  const context = {
    window: { CONTACT_VIEWER_INITIAL_ID: initialId, CONTACT_VIEWER_CONTEXT: { allowed: true, email: 'spoof@abroad-o.com' } },
    document: { getElementById: element, querySelectorAll: () => [], addEventListener() {} },
    google: { script: { run } },
    URL, URLSearchParams,
  };
  vm.createContext(context);
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1];
  vm.runInContext(script.replace('    bootstrapViewer();', ''), context, { filename: 'Index.html' });
  return { ui: context, elements, calls, env };
}

test('UI opens initial id outside active list and safely renders stored content', async () => {
  const { ui, elements, calls } = uiRuntime(runtime(), 'case-b');
  ui.applyViewerLocationState(null);
  await ui.loadList();
  assert.ok(calls.some(([name, id]) => name === 'getContactSubmission' && id === 'case-b'));
  assert.match(elements.get('detailView').innerHTML, /other case/);
  ui.applyViewerLocationState({ parameters: { id: ['case-a'] } });
  await ui.loadList();
  assert.match(elements.get('detailView').innerHTML, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(elements.get('detailView').innerHTML, /<script>bad|<img src=x/);
  assert.match(elements.get('submissionRows').innerHTML, /&lt;img/);
  const attachment = ui.renderAttachmentShell({ fileId: 'f', name: '<img src=x>', url: 'javascript:alert(1)' }, 0);
  assert.match(attachment, /&lt;img/);
  assert.doesNotMatch(attachment, /href=/);
  assert.equal(ui.safeHttpUrl('javascript:alert(1)'), '');
  assert.equal(ui.safeHttpUrl('https://example.com/'), 'https://example.com/');
});

test('ordinary bookmark loads without token and UI saves through real authenticated RPC', async () => {
  const { ui, elements, calls, env } = uiRuntime();
  ui.applyViewerLocationState(null);
  await ui.loadList();
  assert.match(elements.get('detailView').innerHTML, /case-a/);
  elements.get('statusSelect').value = '対応中';
  elements.get('internalNote').value = '</textarea><script>memo()</script>';
  await ui.saveStatus();
  assert.equal(env.api.getContactSubmission('case-a').submission.handled_by, 'reader@abroad-o.com');
  assert.match(elements.get('detailView').innerHTML, /&lt;\/textarea&gt;&lt;script&gt;memo/);
  assert.doesNotMatch(elements.get('detailView').innerHTML, /<script>memo/);
  const preview = await ui.ensureAttachmentPreviewLoaded(0);
  assert.equal(preview.dataUrl, 'data:image/webp;base64,AQID');
  assert.ok(calls.some(([name, id, fileId]) => name === 'getAttachmentPreview' && id === 'case-a' && fileId === 'file-a'));
});

test('spoofed frontend context cannot authorize bootstrap', async () => {
  const { ui, elements, calls } = uiRuntime(runtime('outsider@example.com'));
  await ui.bootstrapViewer();
  assert.equal(elements.get('appView').hidden, true);
  assert.equal(elements.get('deniedView').hidden, false);
  assert.deepEqual(calls.map(([name]) => name), ['getViewerContext']);
});

test('template JSON cannot close its script tag through initial id', () => {
  const initialSubmissionId = '</script><script>alert(1)</script>';
  const viewerContext = { email: 'reader@abroad-o.com', allowed: true };
  const expressions = [...html.matchAll(/<\?!= ([\s\S]*?) \?>/g)].map((match) => match[1]);
  assert.equal(expressions.length, 2);
  const rendered = expressions.map((expression) => vm.runInNewContext(expression, { initialSubmissionId, viewerContext }));
  assert.doesNotMatch(rendered.join(''), /<\/script>/i);
  assert.equal(JSON.parse(rendered[0]), initialSubmissionId);
});
