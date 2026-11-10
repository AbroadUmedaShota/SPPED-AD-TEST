import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { createHash, createHmac, randomUUID, webcrypto } from 'node:crypto';
import test from 'node:test';

const root = new URL('../99_backend-docs/10_support-contact/viewer-workspace-gas/', import.meta.url);
const source = readFileSync(new URL('Code.gs', root), 'utf8');
const oauthSource = existsSync(new URL('OAuth.gs', root)) ? readFileSync(new URL('OAuth.gs', root), 'utf8') : '';
const html = readFileSync(new URL('Index.html', root), 'utf8');
const publicNames = ['doGet', 'getViewerContext', 'listContactSubmissions', 'getContactSubmission', 'getAttachmentPreview', 'updateContactSubmissionStatus', 'beginCustomerOAuthLogin', 'completeCustomerOAuthLogin'];

function runtime(email = 'reader@abroad-o.com', { sessionThrows = false, missingProperty = '', missingHeader = '', trashed = false, mimeType = 'image/webp', oauth = false, records: fixtureRecords } = {}) {
  const accesses = [];
  const writes = [];
  const templates = [];
  const cacheEntries = new Map();
  const network = [];
  const cacheReads = [];
  let now = Date.now();
  let temporaryKey = oauth ? 'script-user-a' : '';
  let locked = false;
  let response = () => { throw new Error('No mocked token response'); };
  const cache = {
    get(key) {
      cacheReads.push(key);
      const entry = cacheEntries.get(key);
      return entry && entry.until > now ? entry.value : null;
    },
    put(key, value, ttl) { cacheEntries.set(key, { value, until: now + ttl * 1000, ttl }); },
    remove(key) { assert.equal(locked, true, 'one-time state consumed under lock'); cacheEntries.delete(key); },
  };
  const headers = ['submission_id', 'submitted_at', 'contact_type', 'name', 'email', 'subject', 'message', 'attachment_count', 'attachment_refs', 'source_url', 'user_agent', 'storage_status', 'mail_status', 'handled_status', 'handled_by', 'handled_at', 'internal_note'].filter((key) => key !== missingHeader);
  const records = fixtureRecords || [
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
  if (oauth) Object.assign(properties, {
    OAUTH_CLIENT_ID: 'test-client.apps.googleusercontent.com',
    OAUTH_CLIENT_SECRET: 'test-secret-never-in-output',
    OAUTH_REDIRECT_URI: 'https://script.google.com/macros/s/test-deployment/exec',
  });
  delete properties[missingProperty];
  const sandbox = {
    Date: class extends Date { static now() { return now; } },
    CacheService: { getScriptCache: () => cache },
    LockService: { getScriptLock: () => ({
      waitLock() { assert.equal(locked, false); locked = true; },
      releaseLock() { assert.equal(locked, true); locked = false; },
    }) },
    UrlFetchApp: { fetch(url, options) {
      assert.equal(locked, false, 'network must run after consume lock is released');
      assert.equal([...cacheEntries.keys()].some((key) => key.startsWith('oauth-state-v2:')), false, 'state consumed before network');
      network.push({ url, options });
      return response(url, options);
    } },
    Session: {
      getTemporaryActiveUserKey: () => temporaryKey,
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
    Utilities: {
      Charset: { UTF_8: 'UTF-8' }, DigestAlgorithm: { SHA_256: 'SHA-256' },
      getUuid: () => randomUUID(),
      base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
      base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString('base64url'),
      base64DecodeWebSafe: (value) => [...Buffer.from(value, 'base64url')],
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString('utf8') }),
      computeDigest: (_algorithm, value) => [...createHash('sha256').update(value).digest()],
      computeHmacSha256Signature: (value, secret) => [...createHmac('sha256', secret).update(value).digest()],
    },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' }, createTemplateFromFile(name) {
      assert.ok(['Index', 'Login'].includes(name));
      const template = { name, evaluate() { return { setTitle() { return this; }, setXFrameOptionsMode() { return this; } }; } };
      templates.push(template);
      return template;
    } },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: 'Code.gs' });
  vm.runInContext(oauthSource, sandbox, { filename: 'OAuth.gs' });
  return { api: sandbox, accesses, writes, templates, rows, headers, setEmail(value) { email = value; },
    proof: 'a'.repeat(64),
    cacheEntries, cacheReads, network, properties,
    setTempKey(value) { temporaryKey = value; },
    advance(seconds) { now += seconds * 1000; },
    nowSeconds: () => Math.floor(now / 1000),
    respond(handler) { response = handler; },
  };
}

const deniedCalls = [
  ['doGet', [{ parameter: { id: 'case-a', token: 'old-token', email: 'reader@abroad-o.com' } }]],
  ['getViewerContext', ['old-token', { email: 'customer@speed-ad.com', allowed: true }]],
  ['listContactSubmissions', [{ status: 'all', token: 'old-token', email: 'reader@abroad-o.com' }]],
  ['getContactSubmission', ['case-a', 'old-token']],
  ['getAttachmentPreview', ['case-a', 'file-a', 'old-token']],
  ['updateContactSubmissionStatus', ['case-a', '対応中', 'memo', { email: 'reader@abroad-o.com', token: 'old-token' }]],
];

for (const email of ['', null, 'outsider@example.com', 'customer@speed-ad.com', '  CuStOmEr@SPEED-AD.COM  ', 'other@speed-ad.com', 'customer+alias@speed-ad.com', 'customer@sub.speed-ad.com', 'customer@speed-ad.com.evil', 'reader@sub.abroad-o.com', 'reader@abroad-o.com.evil', 'reader@evilabroad-o.com', 'reader@@abroad-o.com', '@abroad-o.com']) {
  test(`all public entry points deny ${JSON.stringify(email)} before datastore access`, () => {
    const env = runtime(email);
    for (const [name, args] of deniedCalls) {
      if (name === 'doGet') {
        env.api[name](...args);
        assert.equal(env.templates.at(-1).name, 'Index');
        assert.equal(Object.keys(env.templates.at(-1).viewerContext).length, 0);
      } else assert.throws(() => env.api[name](...args), /権限/);
    }
    assert.ok(!env.accesses.some((entry) => /^(sheet:|file:|blob:)/.test(entry)));
    assert.deepEqual(env.writes, []);
    assert.ok(env.templates.every((template) => !template.viewerContext || Object.keys(template.viewerContext).length === 0));
  });
}

test('unavailable Session identity fails closed for every public entry point', () => {
  const env = runtime('reader@abroad-o.com', { sessionThrows: true });
  for (const [name, args] of deniedCalls) {
    if (name === 'doGet') { env.api[name](...args); assert.equal(Object.keys(env.templates.at(-1).viewerContext).length, 0); }
    else assert.throws(() => env.api[name](...args), /権限/);
  }
  assert.ok(!env.accesses.some((entry) => /^(sheet:|file:|blob:)/.test(entry)));
});

for (const email of ['reader@abroad-o.com', '  AnOther.User@ABROAD-O.COM  ']) {
  test(`allowed identity ${email} reads and updates with actual normalized actor`, () => {
    const { api, accesses, rows, headers, templates } = runtime(email);
    const normalized = email.trim().toLowerCase();
    api.doGet({ parameter: { id: 'case-b' } });
    assert.equal(templates[0].initialSubmissionId, 'case-b');
    assert.equal(templates[0].viewerContext.email, normalized);
    assert.equal(api.getViewerContext().allowed, true);
    assert.equal(api.getAttachmentPreview('case-a', 'file-a').fileId, 'file-a');
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
  const actual = Object.keys(api).filter((name) => typeof api[name] === 'function' && !name.endsWith('_') && name !== 'Date').sort();
  assert.deepEqual(actual, publicNames.slice().sort());
  assert.doesNotMatch(source, /getEffectiveUser|setTrashed|deleteRow|setProperty|setProperties|CONTACT_VIEWER_ACCESS_TOKEN|CONTACT_VIEWER_EMAILS|UrlFetchApp/);
  assert.equal(existsSync(new URL('.clasp.json', root)), false);
});

test('manifest requires Google sign-in, deployer execution and minimum used services', () => {
  const manifest = JSON.parse(readFileSync(new URL('appsscript.json', root), 'utf8'));
  assert.deepEqual(manifest.webapp, { executeAs: 'USER_DEPLOYING', access: 'ANYONE' });
  assert.deepEqual(manifest.oauthScopes.slice().sort(), [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/script.external_request',
  ].sort());
});

test('UI has no legacy email-token storage and safely serializes template values', () => {
  assert.doesNotMatch(html, /accessToken|AccessToken|ACCESS_TOKEN|validateViewerAccessToken/);
  assert.match(html, /JSON\.stringify\(initialSubmissionId\)\.replace\(/);
  assert.match(html, /JSON\.stringify\(viewerContext\)\.replace\(/);
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const [, script] of scripts) new vm.Script(script.replace(/<\?[\s\S]*?\?>/g, 'null'));
});


test('each RPC rechecks active identity after a previously authorized request', () => {
  const env = runtime();
  assert.equal(env.api.getViewerContext().allowed, true);
  env.setEmail('outsider@example.com');
  for (const [name, args] of deniedCalls) {
    if (name === 'doGet') { env.api[name](...args); assert.equal(Object.keys(env.templates.at(-1).viewerContext).length, 0); }
    else assert.throws(() => env.api[name](...args), /権限/);
  }
  assert.ok(!env.accesses.some((entry) => /^(sheet:|file:|blob:)/.test(entry)));
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

function uiRuntime(env = runtime(), initialId = '', storage = new Map()) {
  const elements = new Map();
  const calls = [];
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      _value: id === 'statusFilter' ? 'active' : '',
      get value() { return this._value; },
      set value(value) {
        const text = String(value);
        this._value = id === 'statusSelect' && !['未対応', '対応中', '対応済み', '保留'].includes(text) ? '' : text;
      },
      hidden: true,
      innerHTML: '',
      classList: { add() {}, remove() {} },
      options: [{ value: 'active', textContent: '対応が必要' }],
      listeners: new Map(),
      addEventListener(type, listener) { this.listeners.set(type, listener); },
      removeAttribute() {}, setAttribute() {},
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
            let deliver;
            try { const value = env.api[key](...args); deliver = () => success(value); } catch (error) { deliver = () => failure(error); }
            if (env.rpcQueue) env.rpcQueue.push({ name: key, deliver });
            else deliver();
          };
        } });
      } };
    },
  };
  const context = {
    window: { CONTACT_VIEWER_INITIAL_ID: initialId, CONTACT_VIEWER_CONTEXT: { allowed: true, email: 'spoof@abroad-o.com' }, sessionStorage: { getItem: (key) => storage.get(key) || null } },
    document: {
      getElementById: element,
      querySelectorAll: (selector) => selector === '.quick-status' ? ['対応中', '対応済み', '保留'].map((status) => {
        const button = element(`quick-${status}`);
        button.dataset = { status };
        return button;
      }) : [],
      addEventListener() {},
    },
    google: { script: { run } },
    URL, URLSearchParams,
  };
  vm.createContext(context);
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][1][1];
  vm.runInContext(script.replace('    bootstrapViewer();', ''), context, { filename: 'Index.html' });
  return { ui: context, elements, calls, env, state: vm.runInContext('state', context) };
}

function paginationRecords() {
  const statuses = ['未対応', '対応中', '保留', '対応済み'];
  return Array.from({ length: 253 }, (_, index) => ({
    submission_id: `case-${String(index).padStart(3, '0')}`,
    submitted_at: '2026-11-10T00:00:00Z',
    subject: `問い合わせ ${index}`,
    message: `受付本文 ${index}`,
    email: `person-${index}@example.com`,
    handled_status: statuses[index % statuses.length],
  }));
}

test('keyset pages reach every matching case beyond 200 in both directions with equal timestamps', () => {
  const records = paginationRecords();
  const env = runtime('reader@abroad-o.com', { records });
  for (const status of ['all', 'active', '未対応', '対応中', '保留', '対応済み']) {
    const expected = records.filter((record) => status === 'all' || (status === 'active' ? ['未対応', '対応中'].includes(record.handled_status) : record.handled_status === status)).map((record) => record.submission_id).reverse();
    const pages = [];
    let pageToken = '';
    do {
      const page = env.api.listContactSubmissions({ status, pageSize: 50, pageToken });
      assert.equal(page.counts.total, 253);
      assert.equal(page.page.total, expected.length);
      assert.ok(page.submissions.length <= 50);
      pages.push(page);
      pageToken = page.page.nextPageToken;
    } while (pageToken);
    assert.deepEqual(pages.flatMap((page) => Array.from(page.submissions, (record) => record.submission_id)), expected);
    let page = pages.at(-1);
    for (let index = pages.length - 2; index >= 0; index--) {
      page = env.api.listContactSubmissions({ status, pageSize: 50, pageToken: page.page.previousPageToken });
      assert.deepEqual(Array.from(page.submissions, (record) => record.submission_id), Array.from(pages[index].submissions, (record) => record.submission_id));
    }
    assert.equal(page.page.previousPageToken, '');
  }
  const search = env.api.listContactSubmissions({ status: 'all', query: 'person-25', pageSize: 50 });
  assert.equal(search.page.total, 4);
  assert.equal(search.counts.total, 253, 'status counts remain global while searching');
  assert.equal(env.api.listContactSubmissions({ status: 'all', limit: 200 }).submissions.length, 200, 'legacy limit remains supported');
});

test('page tokens are scoped to filters and retain position after cursor row removal or newer insertion', () => {
  const env = runtime('reader@abroad-o.com', { records: paginationRecords() });
  const first = env.api.listContactSubmissions({ status: 'all', pageSize: 50 });
  assert.throws(() => env.api.listContactSubmissions({ status: 'active', pageToken: first.page.nextPageToken }), /ページ情報/);
  assert.throws(() => env.api.listContactSubmissions({ status: 'all', query: 'changed', pageToken: first.page.nextPageToken }), /ページ情報/);
  assert.throws(() => env.api.listContactSubmissions({ status: 'all', pageToken: 'bad-json' }), /ページ情報/);
  const lastId = first.submissions.at(-1).submission_id;
  env.rows.splice(env.rows.findIndex((row) => row[0] === lastId), 1);
  env.rows.push(env.headers.map((header) => ({ submission_id: 'newer', submitted_at: '2026-11-11T00:00:00Z', handled_status: '未対応' })[header] || ''));
  const next = env.api.listContactSubmissions({ status: 'all', pageSize: 50, pageToken: first.page.nextPageToken });
  assert.equal(next.submissions[0].submission_id, 'case-202');
  assert.ok(!next.submissions.some((record) => first.submissions.some((previous) => previous.submission_id === record.submission_id)));
  env.rows.push(env.headers.map(() => ''));
  assert.equal(env.api.listContactSubmissions({ status: 'all' }).counts.total, 253, 'empty rows are not cases');
});

test('status tabs and sequential case navigation cross pages in the current filter', async () => {
  const fixture = paginationRecords();
  const app = uiRuntime(runtime('reader@abroad-o.com', { records: fixture }));
  await app.ui.changeStatusTab('all');
  assert.equal(app.calls.find(([name]) => name === 'listContactSubmissions')[1].pageSize, 50);
  assert.match(app.elements.get('statusSummary').innerHTML, /role="tab" data-status="all"[^>]*aria-selected="true"/);
  const visited = [app.state.selectedId];
  for (let index = 1; index < fixture.length; index++) {
    await app.ui.moveCase(1);
    visited.push(app.state.selectedId);
  }
  assert.deepEqual(visited, fixture.map((record) => record.submission_id).reverse());
  assert.equal(app.elements.get('caseNext').disabled, true);
  for (let index = fixture.length - 2; index >= 0; index--) {
    await app.ui.moveCase(-1);
    assert.equal(app.state.selectedId, visited[index]);
  }
  assert.equal(app.elements.get('casePrev').disabled, true);
  app.elements.get('searchInput').value = 'person-25';
  await app.ui.changeStatusTab('未対応');
  assert.equal(app.state.page.total, 1);
  assert.equal(app.state.selectedId, 'case-252');
  assert.equal(app.elements.get('searchInput').value, 'person-25');
});

test('unsaved changes stop tab, search and page-boundary case navigation; saved out-of-filter detail remains visible', async () => {
  const app = uiRuntime(runtime('reader@abroad-o.com', { records: paginationRecords() }));
  await app.ui.loadList();
  for (let index = 0; index < 49; index++) await app.ui.moveCase(1);
  const selected = app.state.selectedId;
  app.elements.get('statusSelect').value = app.state.detail.handled_status;
  app.elements.get('internalNote').value = 'unsaved memo';
  app.ui.markDirty();
  app.ui.window.confirm = () => false;
  const calls = app.calls.length;
  await app.ui.moveCase(1);
  await app.ui.changeStatusTab('all');
  app.elements.get('searchInput').value = 'changed';
  await app.ui.loadList();
  assert.equal(app.calls.length, calls);
  assert.equal(app.state.selectedId, selected);
  assert.equal(app.elements.get('statusFilter').value, 'active');
  assert.equal(app.elements.get('searchInput').value, '');
  app.ui.window.confirm = () => true;
  await app.ui.moveCase(1);
  assert.notEqual(app.state.selectedId, selected);
  app.elements.get('statusSelect').value = '対応済み';
  app.elements.get('internalNote').value = 'saved memo';
  const savedId = app.state.selectedId;
  await app.ui.saveStatus();
  assert.equal(app.state.selectedId, savedId);
  assert.equal(app.state.detail.internal_note, 'saved memo');
  assert.equal(app.state.detail.handled_status, '対応済み');
  assert.equal(app.elements.get('casePosition').textContent, '保存済み・現在のタブの対象外');
  await app.ui.moveCase(1);
  assert.notEqual(app.state.selectedId, savedId);
});

test('late list and detail responses cannot overwrite a newer query or authentication loss', async () => {
  const env = runtime();
  env.rpcQueue = [];
  const app = uiRuntime(env);
  const oldList = app.ui.loadList();
  app.elements.get('searchInput').value = 'other';
  app.elements.get('statusFilter').value = 'all';
  const newList = app.ui.loadList();
  env.rpcQueue.splice(1, 1)[0].deliver();
  await Promise.resolve();
  env.rpcQueue.splice(1, 1)[0].deliver();
  await newList;
  env.rpcQueue.shift().deliver();
  await oldList;
  assert.equal(app.state.selectedId, 'case-b');
  assert.match(app.elements.get('detailView').innerHTML, /other case/);
  const oldDetail = app.ui.selectSubmission('case-a');
  const newDetail = app.ui.selectSubmission('case-b');
  env.rpcQueue.splice(1, 1)[0].deliver();
  await newDetail;
  env.rpcQueue.shift().deliver();
  await oldDetail;
  assert.equal(app.state.detail.submission_id, 'case-b');
  const pending = app.ui.loadList();
  env.setEmail('outsider@example.com');
  const denied = app.ui.bootstrapViewer();
  env.rpcQueue.splice(1, 1)[0].deliver();
  await denied;
  env.rpcQueue.shift().deliver();
  await pending;
  assert.equal(app.elements.get('appView').hidden, true);
  assert.equal(app.elements.get('detailView').innerHTML, '');
  assert.equal(app.state.submissions.length, 0);
});

test('date order precedes ID tie-break and failed reads never appear as a valid zero result', async () => {
  const env = runtime('reader@abroad-o.com', { records: [
    { submission_id: 'z-old', submitted_at: '2026-11-09T00:00:00Z', handled_status: '未対応' },
    { submission_id: 'a-new', submitted_at: '2026-11-11T00:00:00Z', handled_status: '未対応' },
    { submission_id: 'z-same', submitted_at: '2026-11-10T00:00:00Z', handled_status: '未対応' },
    { submission_id: 'a-same', submitted_at: '2026-11-10T00:00:00Z', handled_status: '未対応' },
  ] });
  assert.deepEqual(Array.from(env.api.listContactSubmissions({ status: 'all' }).submissions, (record) => record.submission_id), ['a-new', 'z-same', 'a-same', 'z-old']);
  const app = uiRuntime(env);
  await app.ui.loadList();
  env.api.listContactSubmissions = () => { throw new Error('一覧の通信に失敗しました。'); };
  await app.ui.loadList();
  assert.equal(app.elements.get('pagePosition').textContent, '一覧を取得できません');
  assert.equal(app.state.submissions.length, 0);
  assert.match(app.elements.get('detailView').innerHTML, /一覧の通信に失敗/);
  assert.equal(app.elements.get('caseNext').disabled, true);
});

test('a saved response arriving after authentication loss cannot restore protected detail', async () => {
  const app = uiRuntime();
  await app.ui.loadList();
  app.env.rpcQueue = [];
  app.elements.get('statusSelect').value = '対応中';
  app.elements.get('internalNote').value = 'save in progress';
  const saving = app.ui.saveStatus();
  app.ui.showDenied('認証が失効しました。');
  app.env.rpcQueue.shift().deliver();
  await saving;
  assert.equal(app.state.detail, null);
  assert.equal(app.elements.get('detailView').innerHTML, '');
  assert.equal(app.elements.get('statusSummary').innerHTML, '');
});

test('successful status save keeps its read-back detail when the following list refresh fails', async () => {
  const app = uiRuntime();
  await app.ui.loadList();
  app.elements.get('statusSelect').value = '対応中';
  app.elements.get('internalNote').value = 'saved before list outage';
  app.env.api.listContactSubmissions = () => { throw new Error('一覧の更新に失敗'); };
  await app.ui.saveStatus();
  assert.equal(app.state.detail.internal_note, 'saved before list outage');
  assert.equal(app.state.detail.handled_status, '対応中');
  assert.equal(app.elements.get('statusSaveMessage').textContent, '保存しました。');
  assert.equal(app.elements.get('pagePosition').textContent, '一覧を取得できません');
});

test('saving memo or in-filter status on a later page preserves its page and adjacent next case', async () => {
  for (const tab of ['all', 'active']) {
    const app = uiRuntime(runtime('reader@abroad-o.com', { records: paginationRecords() }));
    await app.ui.changeStatusTab(tab);
    const pageToken = app.state.page.nextPageToken;
    await app.ui.loadList({ pageToken, selectEdge: 'first' });
    await app.ui.moveCase(1);
    const selectedId = app.state.selectedId;
    const nextId = app.state.submissions[2].submission_id;
    const from = app.state.page.from;
    app.elements.get('statusSelect').value = tab === 'active' ? (app.state.detail.handled_status === '未対応' ? '対応中' : '未対応') : app.state.detail.handled_status;
    app.elements.get('internalNote').value = 'later-page memo';
    await app.ui.saveStatus();
    assert.equal(app.state.currentPageToken, pageToken);
    assert.equal(app.state.page.from, from);
    assert.equal(app.state.selectedId, selectedId);
    assert.equal(app.state.savedOutsideFilter, false);
    await app.ui.moveCase(1);
    assert.equal(app.state.selectedId, nextId);
  }
});

test('saved selection uses server search membership and returns to the first page when excluded', async () => {
  const app = uiRuntime(runtime('reader@abroad-o.com', { records: paginationRecords() }));
  app.elements.get('searchInput').value = 'person-';
  await app.ui.changeStatusTab('all');
  await app.ui.loadList({ pageToken: app.state.page.nextPageToken, selectEdge: 'first' });
  const selectedId = app.state.selectedId;
  const update = app.env.api.updateContactSubmissionStatus;
  app.env.api.updateContactSubmissionStatus = (...args) => {
    const result = update(...args);
    const row = app.env.rows.find((entry) => entry[0] === selectedId);
    row[app.env.headers.indexOf('email')] = 'changed@example.net';
    return result;
  };
  app.elements.get('statusSelect').value = app.state.detail.handled_status;
  app.elements.get('internalNote').value = 'saved while source changed';
  await app.ui.saveStatus();
  assert.equal(app.state.currentPageToken, '');
  assert.equal(app.state.page.from, 1);
  assert.equal(app.state.savedOutsideFilter, true);
  assert.equal(app.state.selectedId, selectedId);
  assert.equal(app.elements.get('casePosition').textContent, '保存済み・現在のタブの対象外');
});

test('a saved case shifted outside its current page has an explicit return to list start', async () => {
  const app = uiRuntime(runtime('reader@abroad-o.com', { records: paginationRecords() }));
  await app.ui.changeStatusTab('all');
  await app.ui.loadList({ pageToken: app.state.page.nextPageToken, selectEdge: 'first' });
  await app.ui.selectSubmission(app.state.submissions[5].submission_id);
  const selectedId = app.state.selectedId;
  const update = app.env.api.updateContactSubmissionStatus;
  app.env.api.updateContactSubmissionStatus = (...args) => {
    const result = update(...args);
    for (let index = 0; index < 60; index++) {
      const record = { submission_id: `case-201-extra-${String(index).padStart(3, '0')}`, submitted_at: '2026-11-10T00:00:00Z', handled_status: '未対応' };
      app.env.rows.push(app.env.headers.map((header) => record[header] || ''));
    }
    return result;
  };
  app.elements.get('statusSelect').value = app.state.detail.handled_status;
  app.elements.get('internalNote').value = 'saved before incoming cases';
  await app.ui.saveStatus();
  assert.equal(app.state.selectedId, selectedId);
  assert.equal(app.state.savedOutsideFilter, false);
  assert.equal(app.elements.get('casePosition').textContent, '表示中の一覧外');
  assert.equal(app.elements.get('caseNext').textContent, '一覧の先頭へ →');
  await app.ui.moveCase(1);
  assert.equal(app.state.page.from, 1);
  assert.equal(app.state.selectedId, 'case-252');
});

test('list and save waits suspend old detail edits and selections until the accepted response', async () => {
  const app = uiRuntime();
  await app.ui.loadList();
  app.env.rpcQueue = [];
  const loading = app.ui.loadList();
  assert.equal(app.elements.get('internalNote').disabled, true);
  assert.equal(app.elements.get('statusSelect').disabled, true);
  const count = app.calls.length;
  await app.ui.selectSubmission('case-b');
  app.ui.markDirty();
  assert.equal(app.calls.length, count);
  assert.equal(app.state.dirty, false);
  app.env.rpcQueue.shift().deliver();
  await Promise.resolve();
  app.env.rpcQueue.shift().deliver();
  await loading;
  assert.equal(app.elements.get('internalNote').disabled, false);
  app.elements.get('statusSelect').value = '対応中';
  app.elements.get('internalNote').value = 'captured memo';
  const saving = app.ui.saveStatus();
  assert.equal(app.elements.get('internalNote').disabled, true);
  assert.equal(app.elements.get('saveStatusButton').disabled, true);
  assert.equal(app.elements.get('searchInput').disabled, true);
  const savingCount = app.calls.length;
  await app.ui.selectSubmission('case-b');
  await app.ui.changeStatusTab('all');
  assert.equal(app.calls.length, savingCount);
  app.env.rpcQueue.shift().deliver();
  await Promise.resolve();
  app.env.rpcQueue.shift().deliver();
  await saving;
  assert.equal(app.state.detail.internal_note, 'captured memo');
  assert.equal(app.elements.get('internalNote').disabled, false);
  assert.equal(app.elements.get('searchInput').disabled, false);
});

test('an older save list response cannot announce or unlock a newer case save', async () => {
  const app = uiRuntime();
  await app.ui.loadList();
  app.env.rpcQueue = [];
  app.elements.get('statusSelect').value = '対応中';
  app.elements.get('internalNote').value = 'case A saved';
  const saveA = app.ui.saveStatus();
  app.env.rpcQueue.shift().deliver();
  await Promise.resolve();
  assert.equal(app.env.rpcQueue[0].name, 'listContactSubmissions', 'A list refresh waits');
  app.elements.get('statusFilter').value = 'all';
  app.elements.get('searchInput').value = 'other';
  const listB = app.ui.loadList();
  app.env.rpcQueue.splice(1, 1)[0].deliver();
  await Promise.resolve();
  app.env.rpcQueue.splice(1, 1)[0].deliver();
  await listB;
  assert.equal(app.state.selectedId, 'case-b');
  app.elements.get('statusSelect').value = '対応中';
  app.elements.get('internalNote').value = 'case B saved';
  const saveB = app.ui.saveStatus();
  assert.equal(app.state.saving, true);
  app.env.rpcQueue.shift().deliver();
  await saveA;
  assert.equal(app.state.selectedId, 'case-b');
  assert.equal(app.state.saving, true, 'A completion does not unlock B');
  assert.equal(app.elements.get('internalNote').disabled, true);
  assert.equal(app.elements.get('statusSelect').disabled, true);
  assert.equal(app.elements.get('statusSaveMessage').textContent, '保存中...');
  app.env.rpcQueue.shift().deliver();
  await Promise.resolve();
  assert.equal(app.elements.get('internalNote').disabled, true, 'B list read-back still locks detail');
  app.env.rpcQueue.shift().deliver();
  await saveB;
  assert.equal(app.state.detail.submission_id, 'case-b');
  assert.equal(app.state.detail.internal_note, 'case B saved');
  assert.equal(app.elements.get('statusSaveMessage').textContent, '保存しました。');
  assert.equal(app.elements.get('internalNote').disabled, false);
});

test('initial list shows loading and only a validated empty response can display zero', async () => {
  const env = runtime('reader@abroad-o.com', { records: [] });
  env.rpcQueue = [];
  const app = uiRuntime(env);
  app.ui.renderNavigation();
  assert.equal(app.elements.get('pagePosition').textContent, '一覧未取得');
  const pending = app.ui.loadList();
  assert.equal(app.elements.get('pagePosition').textContent, '読み込み中...');
  assert.doesNotMatch(app.elements.get('pagePosition').textContent, /0件/);
  env.rpcQueue.shift().deliver();
  await pending;
  assert.equal(app.elements.get('pagePosition').textContent, '0件');
  assert.equal(app.state.listState, 'loaded');
});

test('malformed page metadata fails closed instead of displaying zero or accepting partial rows', async () => {
  const mutations = [
    (result) => { delete result.page; },
    (result) => { result.page.size = '50'; },
    (result) => { result.page.total = -1; },
    (result) => { result.page.from = 0; },
    (result) => { result.page.to = 2; },
    (result) => { result.page.nextPageToken = null; },
    (result) => { result.page.previousPageToken = 'unexpected'; },
    (result) => { result.page.total = 2; },
    (result) => { result.submissions = []; },
    (result) => { result.submissions.push(result.submissions[0]); },
    (result) => { result.counts.active = '1'; },
  ];
  for (const mutate of mutations) {
    const env = runtime();
    const response = env.api.listContactSubmissions({ status: 'active', pageSize: 50 });
    mutate(response);
    env.api.listContactSubmissions = () => response;
    const app = uiRuntime(env);
    await app.ui.loadList();
    assert.equal(app.state.listState, 'failed');
    assert.equal(app.state.submissions.length, 0);
    assert.equal(app.elements.get('pagePosition').textContent, '一覧を取得できません');
    assert.doesNotMatch(app.elements.get('detailView').innerHTML, /一致するお問い合わせがありません/);
  }
});

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

test('recorded Save click listener preserves selected status when passed a MouseEvent', async () => {
  const { ui, elements, calls, env } = uiRuntime();
  await ui.loadList();
  const button = elements.get('saveStatusButton');
  elements.get('statusSelect').value = '対応中';
  elements.get('internalNote').value = 'saved by button click';
  const event = {
    type: 'click', target: button, currentTarget: button, button: 0, bubbles: true,
    isTrusted: true, preventDefault() {},
    [Symbol.toStringTag]: 'MouseEvent',
  };
  button.listeners.get('click')(event);
  await new Promise(setImmediate);
  const update = calls.find(([name]) => name === 'updateContactSubmissionStatus');
  assert.equal(update[2], '対応中');
  const saved = env.api.getContactSubmission('case-a').submission;
  assert.equal(saved.handled_status, '対応中');
  assert.equal(saved.internal_note, 'saved by button click');
  assert.equal(saved.handled_by, 'reader@abroad-o.com');
  assert.equal(elements.get('statusSaveMessage').textContent, '保存しました。');
});

test('recorded quick-status click listeners still save each explicit status', async () => {
  for (const status of ['対応中', '対応済み', '保留']) {
    const { ui, calls, env } = uiRuntime();
    await ui.loadList();
    const button = ui.document.querySelectorAll('.quick-status').find((item) => item.dataset.status === status);
    button.listeners.get('click')({ type: 'click', target: button, currentTarget: button, button: 0 });
    await new Promise(setImmediate);
    assert.equal(calls.find(([name]) => name === 'updateContactSubmissionStatus')[2], status);
    assert.equal(env.api.getContactSubmission('case-a').submission.handled_status, status);
  }
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

function beginOAuth(env, id = 'case-b') {
  env.api.doGet({ parameter: { login: 'google', id } });
  assert.equal(env.templates.at(-1).name, 'Login');
  const proofHash = createHash('sha256').update(env.proof).digest('hex');
  const result = env.api.beginCustomerOAuthLogin(proofHash, id);
  assert.ok(result.authorizationUrl);
  return new URL(result.authorizationUrl);
}

function tokenResponse(env, authorization, changes = {}, headerChanges = {}) {
  const claims = {
    iss: 'https://accounts.google.com', aud: env.properties.OAUTH_CLIENT_ID,
    azp: env.properties.OAUTH_CLIENT_ID, sub: 'google-customer-subject',
    email: 'customer@speed-ad.com', email_verified: true, hd: 'speed-ad.com',
    exp: env.nowSeconds() + 1800, iat: env.nowSeconds(), nonce: authorization.searchParams.get('nonce'),
    ...changes,
  };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const idToken = [encode({ alg: 'RS256', ...headerChanges }), encode(claims), 'trusted-endpoint-signature'].join('.');
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ id_token: idToken, access_token: 'never-return-access-token', refresh_token: 'never-store-refresh-token' }) };
}

function finishOAuth(env, authorization, extra = {}) {
  const params = { code: 'single-use-google-code', state: authorization.searchParams.get('state'), ...extra };
  const requestsBefore = env.network.length;
  env.api.doGet({ parameter: params });
  assert.equal(env.network.length, requestsBefore, 'GET callback cannot exchange or issue grants');
  const page = env.templates.at(-1);
  assert.equal(page.name, 'Login');
  try {
    env.lastCompletion = env.api.completeCustomerOAuthLogin(page.callback, env.proof);
  } catch (error) {
    env.lastCompletion = { returnUrl: '', error: String(error) };
  }
  return env.lastCompletion;
}

function assertNoContactAccess(env) {
  assert.ok(!env.accesses.some((entry) => /^(sheet:|file:|blob:)/.test(entry)));
  assert.deepEqual(env.writes, []);
  for (const page of env.templates) {
    if (page.name === 'Index') assert.equal(Object.keys(page.viewerContext).length, 0);
    else assert.equal(page.name, 'Login');
    assert.doesNotMatch(String(page.message || '') + String(page.oauthUrl || ''), /customer@|test-secret|never-return|never-store/);
    assert.equal(page.submissions, undefined);
    assert.equal(page.detail, undefined);
  }
}

test('OAuth initial login, authorization and callback are data-free; PKCE/state/nonce use HMAC', () => {
  const env = runtime('', { oauth: true });
  env.api.doGet({ parameter: { id: 'case-b' } });
  assert.equal(Object.keys(env.templates.at(-1).viewerContext).length, 0);
  assert.equal(env.cacheEntries.size, 0, 'ordinary login page does not create a state');
  assert.equal(env.templates.at(-1).loginStartUrl, env.properties.OAUTH_REDIRECT_URI + '?login=google&id=case-b');
  const authorization = beginOAuth(env);
  assert.equal(authorization.origin + authorization.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(authorization.searchParams.get('scope'), 'openid email');
  assert.equal(authorization.searchParams.get('response_type'), 'code');
  assert.equal(authorization.searchParams.get('redirect_uri'), env.properties.OAUTH_REDIRECT_URI);
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorization.searchParams.has('login_hint'), false);
  assert.equal(authorization.searchParams.has('c'), false);
  assert.equal(authorization.searchParams.has('sid'), false);
  const [key, entry] = [...env.cacheEntries.entries()][0];
  const pending = JSON.parse(entry.value);
  assert.equal(key, 'oauth-state-v2:' + authorization.searchParams.get('state'));
  assert.equal(entry.ttl, 600);
  assert.equal(createHash('sha256').update(pending.verifier).digest('base64url'), authorization.searchParams.get('code_challenge'));
  assert.equal(new Set([authorization.searchParams.get('state'), pending.nonce, pending.verifier]).size, 3);
  for (const value of [authorization.searchParams.get('state'), pending.nonce, pending.verifier]) assert.match(value, /^[A-Za-z0-9_-]{43}$/);
  assert.doesNotMatch(authorization.href, new RegExp(pending.verifier));
  assert.doesNotMatch(entry.value, /script-user-a/);
  assertNoContactAccess(env);
  // A known UUID still produces keyed, purpose-separated values rather than bare UUID entropy.
  env.api.Utilities.getUuid = () => 'predictable-test-uuid';
  // Clock may have millisecond precision; independently calculate using the sandbox clock.
  const exact = createHmac('sha256', env.properties.OAUTH_CLIENT_SECRET)
    .update(JSON.stringify(['state', 'predictable-test-uuid:' + env.api.Date.now()])).digest('base64url');
  assert.equal(beginOAuth(env).searchParams.get('state'), exact);
});

for (const email of ['customer@speed-ad.com', '  CuStOmEr@SPEED-AD.COM  ']) {
  test(`OAuth verified ${email} reuses ordinary URL and records RPC actor`, () => {
    const env = runtime('customer@speed-ad.com', { oauth: true });
    const authorization = beginOAuth(env);
    env.respond(() => tokenResponse(env, authorization, { email }));
    const page = finishOAuth(env, authorization);
    assert.equal(page.returnUrl, env.properties.OAUTH_REDIRECT_URI + '?id=case-b');
    assertNoContactAccess(env);
    const request = env.network[0];
    assert.equal(request.url, 'https://oauth2.googleapis.com/token');
    assert.equal(request.options.method, 'post');
    assert.equal(request.options.contentType, 'application/x-www-form-urlencoded');
    assert.equal(request.options.followRedirects, false);
    assert.equal(request.options.validateHttpsCertificates, true);
    assert.equal(request.options.payload.client_secret, env.properties.OAUTH_CLIENT_SECRET);
    assert.equal(request.options.payload.redirect_uri, env.properties.OAUTH_REDIRECT_URI);
    assert.equal(request.options.payload.grant_type, 'authorization_code');
    assert.equal(createHash('sha256').update(request.options.payload.code_verifier).digest('base64url'), authorization.searchParams.get('code_challenge'));
    const [sessionKey, sessionEntry] = [...env.cacheEntries.entries()][0];
    assert.match(sessionKey, /^oauth-tab-session-v2:[A-Za-z0-9_-]{43}$/);
    assert.ok(sessionEntry.ttl <= 1800);
    assert.doesNotMatch(sessionEntry.value, /id_token|access_token|refresh_token|secret|verifier|nonce/);
    assert.equal(JSON.parse(sessionEntry.value).sub, 'google-customer-subject');
    const context = env.api.getViewerContext(env.proof);
    assert.equal(context.authMode, 'google-oauth');
    assert.deepEqual(Object.keys(context).sort(), ['allowed', 'authMode', 'email']);
    env.api.doGet({ parameter: { id: 'case-b' } });
    assert.equal(env.templates.at(-1).name, 'Index');
    assert.equal(Object.keys(env.templates.at(-1).viewerContext).length, 0);
    assert.equal(env.api.listContactSubmissions({ status: 'all' }, env.proof).submissions.length, 2);
    assert.equal(env.api.getContactSubmission('case-a', env.proof).submission.submission_id, 'case-a');
    assert.equal(env.api.getAttachmentPreview('case-a', 'file-a', env.proof).fileId, 'file-a');
    assert.equal(env.api.updateContactSubmissionStatus('case-a', '対応中', 'oauth memo', env.proof).submission.handled_by, 'customer@speed-ad.com');
    assert.equal(env.network.length, 1);
  });
}

test('OAuth state is single-use even during a second callback while first exchange runs', () => {
  const env = runtime('', { oauth: true });
  const authorization = beginOAuth(env);
  env.respond(() => {
    finishOAuth(env, authorization);
    assert.equal(env.lastCompletion.returnUrl, '');
    return tokenResponse(env, authorization);
  });
  finishOAuth(env, authorization);
  finishOAuth(env, authorization);
  assert.equal(env.lastCompletion.returnUrl, '');
  assert.equal(env.network.length, 1);
  assertNoContactAccess(env);
});

for (const condition of ['expired', 'wrong-user-key', 'missing-user-key', 'evicted', 'future-state']) {
  test(`OAuth rejects ${condition} state before exchange`, () => {
    const env = runtime('', { oauth: true });
    const authorization = beginOAuth(env);
    if (condition === 'expired') env.advance(600);
    if (condition === 'wrong-user-key') env.setTempKey('different-google-script-user');
    if (condition === 'missing-user-key') env.setTempKey('');
    if (condition === 'evicted') env.cacheEntries.clear();
    if (condition === 'future-state') env.advance(-1);
    const page = finishOAuth(env, authorization);
    assert.equal(page.returnUrl, '');
    assert.equal(env.network.length, 0);
    assert.throws(() => env.api.listContactSubmissions({}, env.proof), /権限/);
    assertNoContactAccess(env);
  });
}

test('missing key/configuration and non-global redirect fail closed on initiation', () => {
  for (const condition of ['key', 'client', 'secret', 'redirect']) {
    const env = runtime('', { oauth: true });
    if (condition === 'key') env.setTempKey('');
    if (condition === 'client') delete env.properties.OAUTH_CLIENT_ID;
    if (condition === 'secret') delete env.properties.OAUTH_CLIENT_SECRET;
    if (condition === 'redirect') env.properties.OAUTH_REDIRECT_URI = 'https://evil.example/exec';
    env.api.doGet({ parameter: { login: 'google' } });
    assert.throws(() => env.api.beginCustomerOAuthLogin(createHash('sha256').update(env.proof).digest('hex'), ''), /ログイン/);
    assert.equal(env.cacheEntries.size, 0);
    assertNoContactAccess(env);
  }
});

for (const condition of ['network', 'http-302', 'http-400', 'token-error', 'malformed-json', 'missing-id-token', 'malformed-token', 'provider-error', 'duplicate-state', 'client-id-token']) {
  test(`OAuth ${condition} cannot create a grant`, () => {
    const env = runtime('', { oauth: true });
    const authorization = beginOAuth(env);
    env.respond(() => {
      if (condition === 'network') throw new Error('sensitive-network-details');
      const body = condition === 'token-error' ? '{"error":"invalid_grant"}' : condition === 'malformed-json' ? '{' : condition === 'malformed-token' ? '{"id_token":"bad"}' : '{}';
      return { getResponseCode: () => condition === 'http-302' ? 302 : condition === 'http-400' ? 400 : 200, getContentText: () => body };
    });
    if (condition === 'duplicate-state') {
      env.api.doGet({ parameter: { state: authorization.searchParams.get('state'), code: 'code' }, parameters: { state: ['one', 'two'] } });
      assert.throws(() => env.api.completeCustomerOAuthLogin(env.templates.at(-1).callback, env.proof), /ログイン/);
      env.lastCompletion = { returnUrl: '' };
    }
    else finishOAuth(env, authorization, condition === 'provider-error' ? { error: 'access_denied' } : condition === 'client-id-token' ? { id_token: 'untrusted-client-token' } : {});
    assert.equal(env.lastCompletion.returnUrl, '');
    assert.throws(() => env.api.getViewerContext(env.proof), /権限/);
    assert.ok(![...env.cacheEntries.keys()].some((key) => key.startsWith('oauth-tab-session-v2:')));
    assertNoContactAccess(env);
    assert.doesNotMatch(JSON.stringify(env.templates), /sensitive-network-details|invalid_grant|untrusted-client-token/);
  });
}

const invalidClaims = [
  ['issuer', { iss: 'https://evil.example' }], ['audience', { aud: 'wrong-client' }],
  ['audience-array', { aud: ['test-client.apps.googleusercontent.com'] }], ['azp', { azp: 'wrong-client' }], ['azp-null', { azp: null }],
  ['subject', { sub: '' }], ['subject-type', { sub: 123 }],
  ['expired', { exp: 1 }], ['expiry-type', { exp: '9999999999' }], ['future-issued', { iat: 9999999999 }],
  ['stale-issued', { iat: 1 }], ['issued-type', { iat: '1' }], ['nonce', { nonce: 'wrong' }],
  ['unverified', { email_verified: false }], ['verification-string', { email_verified: 'true' }],
  ['other-email', { email: 'other@speed-ad.com' }], ['employee-email', { email: 'employee@abroad-o.com' }],
  ['missing-hd', { hd: undefined }], ['wrong-hd', { hd: 'abroad-o.com' }], ['hd-suffix', { hd: 'speed-ad.com.evil' }],
];
for (const [name, changes] of invalidClaims) {
  test(`OAuth rejects ID token claim ${name}`, () => {
    const env = runtime('', { oauth: true });
    const authorization = beginOAuth(env);
    env.respond(() => tokenResponse(env, authorization, changes));
    finishOAuth(env, authorization);
    assert.equal(env.lastCompletion.returnUrl, '');
    assert.throws(() => env.api.getViewerContext(env.proof), /権限/);
    assertNoContactAccess(env);
  });
}

test('only RS256 headers from direct token response are accepted', () => {
  const env = runtime('', { oauth: true });
  const authorization = beginOAuth(env);
  env.respond(() => tokenResponse(env, authorization, {}, { alg: 'none' }));
  finishOAuth(env, authorization);
  assert.throws(() => env.api.getViewerContext(env.proof), /権限/);
  assertNoContactAccess(env);
});

test('known noncustomer principal cannot initiate, finish or consult cached customer grant', () => {
  const env = runtime('', { oauth: true });
  const authorization = beginOAuth(env);
  env.setEmail('other@speed-ad.com');
  finishOAuth(env, authorization);
  assert.equal(env.network.length, 0);
  env.api.doGet({ parameter: { login: 'google' } });
  assert.throws(() => env.api.beginCustomerOAuthLogin(createHash('sha256').update(env.proof).digest('hex'), ''), /ログイン/);
  assertNoContactAccess(env);
  env.setEmail('customer@speed-ad.com');
  const second = beginOAuth(env);
  env.respond(() => tokenResponse(env, second));
  finishOAuth(env, second);
  const readsBefore = env.cacheReads.filter((key) => key.startsWith('oauth-tab-session-v2:')).length;
  env.setEmail('other@speed-ad.com');
  assert.throws(() => env.api.getViewerContext(env.proof), /権限/);
  for (const [name, args] of deniedCalls) {
    if (name === 'doGet') { env.api[name](...args); assert.equal(Object.keys(env.templates.at(-1).viewerContext).length, 0); }
    else assert.throws(() => env.api[name](...args), /権限/);
  }
  assert.equal(env.cacheReads.filter((key) => key.startsWith('oauth-tab-session-v2:')).length, readsBefore);
  env.setEmail('employee@abroad-o.com');
  assert.equal(env.api.getViewerContext(env.proof).authMode, 'domain');
  assert.equal(env.api.getViewerContext(env.proof).email, 'employee@abroad-o.com');
});

for (const condition of ['expiry', 'key-rotation', 'missing-key', 'eviction', 'secret-rotation', 'client-rotation', 'redirect-rotation']) {
  test(`customer grant fails closed after ${condition}`, () => {
    const env = runtime('customer@speed-ad.com', { oauth: true });
    const authorization = beginOAuth(env);
    env.respond(() => tokenResponse(env, authorization, { exp: env.nowSeconds() + 7200 }));
    finishOAuth(env, authorization);
    const session = [...env.cacheEntries.values()][0];
    assert.equal(session.ttl, 3600);
    if (condition === 'expiry') env.advance(3600);
    if (condition === 'key-rotation') env.setTempKey('rotated-user-key');
    if (condition === 'missing-key') env.setTempKey('');
    if (condition === 'eviction') env.cacheEntries.clear();
    if (condition === 'secret-rotation') env.properties.OAUTH_HMAC_SECRET = 'new-dedicated-key';
    if (condition === 'client-rotation') env.properties.OAUTH_CLIENT_ID = 'another-client';
    if (condition === 'redirect-rotation') env.properties.OAUTH_REDIRECT_URI = 'https://script.google.com/macros/s/other/exec';
    assert.throws(() => env.api.getViewerContext(env.proof), /権限/);
    assert.throws(() => env.api.listContactSubmissions({}, env.proof), /権限/);
    assertNoContactAccess(env);
  });
}

test('OAuth helper surface stays private and Login never exposes identity or provider tokens', () => {
  const login = readFileSync(new URL('Login.html', root), 'utf8');
  for (const match of oauthSource.matchAll(/^function ([^(]+)\(/gm)) assert.ok(match[1].endsWith('_') || ['beginCustomerOAuthLogin', 'completeCustomerOAuthLogin'].includes(match[1]));
  assert.doesNotMatch(oauthSource, /getEffectiveUser|Math\.random|console\.|Logger\.|login_hint|setProperty/);
  assert.doesNotMatch(login, /customer@|speed-ad\.com|id_token|access_token/);
  assert.match(login, /getRandomValues/);
  assert.match(login, /sessionStorage/);
  assert.match(login, /JSON\.stringify\(callback\)/);
  assert.match(login, /JSON\.stringify\(submissionId\)/);
  assert.match(login, /no-referrer/);
});


test('known principal and temporary key are rechecked immediately before grant issuance', () => {
  for (const condition of ['known-mismatch', 'rotated-key']) {
    const env = runtime('', { oauth: true });
    const authorization = beginOAuth(env);
    env.respond(() => {
      if (condition === 'known-mismatch') env.setEmail('other@speed-ad.com');
      else env.setTempKey('rotated-script-user');
      return tokenResponse(env, authorization);
    });
    finishOAuth(env, authorization);
    assert.equal(env.lastCompletion.returnUrl, '');
    assert.ok(![...env.cacheEntries.keys()].some((key) => key.startsWith('oauth-tab-session-v2:')));
    assertNoContactAccess(env);
  }
});

test('grant expires at token expiry even when the cache retains an unexpired entry', () => {
  const env = runtime('customer@speed-ad.com', { oauth: true });
  const authorization = beginOAuth(env);
  env.respond(() => tokenResponse(env, authorization, { exp: env.nowSeconds() + 120 }));
  finishOAuth(env, authorization);
  const entry = [...env.cacheEntries.values()][0];
  assert.equal(entry.ttl, 120);
  entry.until += 3600000; // Model delayed cache expiry; the application must still deny.
  env.advance(120);
  assert.throws(() => env.api.getViewerContext(env.proof), /権限/);
});

test('dedicated HMAC key replaces client secret for state unpredictability', () => {
  const env = runtime('', { oauth: true });
  env.properties.OAUTH_HMAC_SECRET = 'separate-test-hmac-key';
  env.api.Utilities.getUuid = () => 'test-uuid';
  const state = beginOAuth(env).searchParams.get('state');
  const expected = createHmac('sha256', env.properties.OAUTH_HMAC_SECRET)
    .update(JSON.stringify(['state', 'test-uuid:' + env.api.Date.now()])).digest('base64url');
  assert.equal(state, expected);
});


const tabProofKey = 'speed-ad-contact-oauth-tab-proof-v2';

function loginClientRuntime(env, storage = new Map(), callback = null, authuser = '') {
  const elements = new Map([['loginMessage', {}], ['loginLink', { hidden: true }]]);
  const run = { withSuccessHandler(success) { return { withFailureHandler(failure) {
    return new Proxy({}, { get(_target, method) { return (...args) => {
      try { success(env.api[method](...args)); } catch (error) { failure(error); }
    }; } });
  } }; } };
  const context = {
    window: {
      crypto: webcrypto,
      sessionStorage: {
        getItem: (key) => storage.get(key) || null,
        setItem: (key, value) => storage.set(key, value),
      },
    },
    document: { getElementById: (id) => elements.get(id) },
    google: { script: { run } }, Uint8Array, TextEncoder,
  };
  vm.createContext(context);
  const login = readFileSync(new URL('Login.html', root), 'utf8');
  const script = login.match(/<script>([\s\S]*?)<\/script>/)[1]
    .replace(/<\?!= ([\s\S]*?) \?>/g, (_match, expression) => vm.runInNewContext(expression, { callback, submissionId: 'case-b', authuser }))
    .replace('    prepareLogin();', '');
  vm.runInContext(script, context);
  return { ui: context, elements, storage };
}

test('same GAS principal cannot finish another tab state without its original secret', () => {
  const env = runtime('', { oauth: true });
  const authorization = beginOAuth(env);
  const callback = { code: 'single-use-google-code', state: authorization.searchParams.get('state') };
  env.respond(() => tokenResponse(env, authorization));
  env.api.doGet({ parameter: callback });
  assert.equal(env.network.length, 0);
  assertNoContactAccess(env);
  const leakedHash = createHash('sha256').update(env.proof).digest('hex');
  for (const proof of [undefined, '', 'b'.repeat(64), leakedHash]) {
    assert.throws(() => env.api.completeCustomerOAuthLogin(callback, proof), /ログイン/);
    assert.equal(env.network.length, 0);
    assert.ok([...env.cacheEntries.keys()].some((key) => key.startsWith('oauth-state-v2:')), 'wrong proof cannot consume the real state');
  }
  env.api.completeCustomerOAuthLogin(callback, env.proof);
  assert.equal(env.network.length, 1);
  assert.throws(() => env.api.completeCustomerOAuthLogin(callback, env.proof), /ログイン/);
});

test('same blank-email GAS key in a different tab cannot reuse an issued customer grant', () => {
  const env = runtime('', { oauth: true });
  const authorization = beginOAuth(env);
  env.respond(() => tokenResponse(env, authorization));
  finishOAuth(env, authorization);
  assert.equal(env.api.getViewerContext(env.proof).email, 'customer@speed-ad.com');
  const accessesBefore = env.accesses.filter((entry) => /^(sheet:|file:|blob:)/.test(entry)).length;
  for (const proof of [undefined, '', 'b'.repeat(64), createHash('sha256').update(env.proof).digest('hex')]) {
    assert.throws(() => env.api.getViewerContext(proof), /権限/);
    assert.throws(() => env.api.listContactSubmissions({}, proof), /権限/);
    assert.throws(() => env.api.getContactSubmission('case-a', proof), /権限/);
    assert.throws(() => env.api.getAttachmentPreview('case-a', 'file-a', proof), /権限/);
    assert.throws(() => env.api.updateContactSubmissionStatus('case-a', '対応中', 'attack', proof), /権限/);
  }
  assert.equal(env.accesses.filter((entry) => /^(sheet:|file:|blob:)/.test(entry)).length, accessesBefore);
  assert.deepEqual(env.writes, []);
});

test('legacy GAS-key-only grants are never consumed by revised code', () => {
  const env = runtime('', { oauth: true });
  const config = env.api.oauthConfig_();
  const legacyBinding = env.api.oauthHmac_(config, 'temporary-user', JSON.stringify(['script-user-a', config.clientId, config.redirectUri]));
  env.cacheEntries.set('oauth-session:' + legacyBinding, {
    value: JSON.stringify({ email: 'customer@speed-ad.com', sub: 'old', expiresAt: env.nowSeconds() + 3600 }), until: Date.now() + 3600000,
  });
  assert.throws(() => env.api.getViewerContext(), /権限/);
  assert.throws(() => env.api.getViewerContext(env.proof), /権限/);
  assert.ok(env.cacheReads.every((key) => !key.startsWith('oauth-session:')));
  assertNoContactAccess(env);
});

test('Login WebCrypto client completes with same tab proof and app reload forwards proof to all RPCs', async () => {
  const env = runtime('', { oauth: true });
  const login = loginClientRuntime(env);
  await login.ui.prepareLogin();
  const proof = login.storage.get(tabProofKey);
  assert.match(proof, /^[a-f0-9]{64}$/);
  const authorization = new URL(login.elements.get('loginLink').href);
  const pending = JSON.parse([...env.cacheEntries.values()][0].value);
  assert.equal(pending.proofHash, createHash('sha256').update(proof).digest('hex'));
  assert.doesNotMatch(authorization.href, new RegExp(proof));
  assert.doesNotMatch([...env.cacheEntries.values()][0].value, new RegExp(proof));
  env.respond(() => tokenResponse(env, authorization));
  const callback = { code: 'single-use-google-code', state: authorization.searchParams.get('state') };
  env.api.doGet({ parameter: callback });
  assert.equal(env.network.length, 0);
  const wrongTab = loginClientRuntime(env, new Map(), callback);
  await wrongTab.ui.prepareLogin();
  assert.equal(wrongTab.elements.get('loginLink').hidden, true);
  assert.equal(wrongTab.storage.size, 0, 'callback must not generate a replacement proof');
  assert.equal(env.network.length, 0);
  const completion = loginClientRuntime(env, login.storage, callback);
  await completion.ui.prepareLogin();
  assert.equal(completion.elements.get('loginLink').href, env.properties.OAUTH_REDIRECT_URI + '?id=case-b');
  assert.equal(env.network.length, 1);
  for (let reload = 0; reload < 2; reload++) {
    const app = uiRuntime(env, '', login.storage);
    await app.ui.loadList();
    assert.match(app.elements.get('detailView').innerHTML, /case-a/);
    app.elements.get('statusSelect').value = '対応中';
    app.elements.get('internalNote').value = 'tab proof update';
    await app.ui.saveStatus();
    const preview = await app.ui.ensureAttachmentPreviewLoaded(0);
    assert.equal(preview.dataUrl, 'data:image/webp;base64,AQID');
    assert.ok(app.calls.every((call) => call.at(-1) === proof));
  }
  assert.equal(env.api.getContactSubmission('case-a', proof).submission.handled_by, 'customer@speed-ad.com');
  const isolatedTab = uiRuntime(env, '', new Map([[tabProofKey, 'b'.repeat(64)]]));
  await isolatedTab.ui.bootstrapViewer();
  assert.equal(isolatedTab.elements.get('appView').hidden, true);
  assert.equal(isolatedTab.elements.get('submissionRows').innerHTML, '');
  env.cacheEntries.clear();
  const expiredApp = uiRuntime(env, '', login.storage);
  await expiredApp.ui.bootstrapViewer();
  assert.equal(expiredApp.elements.get('appView').hidden, true);
});

test('Login storage/WebCrypto unavailability fails closed without OAuth initiation', async () => {
  const env = runtime('', { oauth: true });
  const unavailable = loginClientRuntime(env);
  unavailable.ui.window.sessionStorage.getItem = () => { throw new Error('blocked'); };
  await unavailable.ui.prepareLogin();
  assert.equal(unavailable.elements.get('loginLink').hidden, true);
  assert.equal(env.cacheEntries.size, 0);
  const noCrypto = loginClientRuntime(env);
  noCrypto.ui.window.crypto = {};
  await noCrypto.ui.prepareLogin();
  assert.equal(noCrypto.elements.get('loginLink').hidden, true);
  assert.equal(env.cacheEntries.size, 0);
});


test('every fresh Login start replaces stored proof using 32-byte WebCrypto randomness; callback never generates', async () => {
  const env = runtime('', { oauth: true });
  const storage = new Map([[tabProofKey, 'c'.repeat(64)]]);
  const start = loginClientRuntime(env, storage);
  let randomCalls = 0;
  start.ui.window.crypto = {
    subtle: webcrypto.subtle,
    getRandomValues(bytes) {
      randomCalls++;
      assert.equal(bytes.length, 32);
      return webcrypto.getRandomValues(bytes);
    },
  };
  await start.ui.prepareLogin();
  const proof = storage.get(tabProofKey);
  assert.equal(randomCalls, 1);
  assert.notEqual(proof, 'c'.repeat(64));
  const authorization = new URL(start.elements.get('loginLink').href);
  env.respond(() => tokenResponse(env, authorization));
  const callback = loginClientRuntime(env, storage, { code: 'single-use-google-code', state: authorization.searchParams.get('state') });
  callback.ui.window.crypto = { getRandomValues() { throw new Error('Callback must only read original proof'); } };
  await callback.ui.prepareLogin();
  assert.equal(callback.elements.get('loginLink').hidden, false);
  assert.equal(storage.get(tabProofKey), proof);
  assert.equal(env.api.getViewerContext(proof).email, 'customer@speed-ad.com');
});

test('two successive logins after grant A expiry never revive proof A under the same GAS key', async () => {
  const env = runtime('', { oauth: true });
  const storage = new Map();
  const loginA = loginClientRuntime(env, storage);
  await loginA.ui.prepareLogin();
  const proofA = storage.get(tabProofKey);
  const authorizationA = new URL(loginA.elements.get('loginLink').href);
  env.respond(() => tokenResponse(env, authorizationA));
  const callbackA = loginClientRuntime(env, storage, { code: 'code-a', state: authorizationA.searchParams.get('state') });
  await callbackA.ui.prepareLogin();
  assert.equal(callbackA.elements.get('loginLink').hidden, false);
  assert.equal(env.api.getViewerContext(proofA).email, 'customer@speed-ad.com');
  env.advance(1800);
  assert.throws(() => env.api.getViewerContext(proofA), /権限/);
  const loginB = loginClientRuntime(env, storage);
  await loginB.ui.prepareLogin();
  const proofB = storage.get(tabProofKey);
  assert.notEqual(proofB, proofA);
  const authorizationB = new URL(loginB.elements.get('loginLink').href);
  env.respond(() => tokenResponse(env, authorizationB));
  const callbackB = loginClientRuntime(env, storage, { code: 'code-b', state: authorizationB.searchParams.get('state') });
  await callbackB.ui.prepareLogin();
  assert.equal(callbackB.elements.get('loginLink').hidden, false);
  assert.throws(() => env.api.getViewerContext(proofA), /権限/);
  assert.throws(() => env.api.listContactSubmissions({}, proofA), /権限/);
  assert.equal(env.api.getViewerContext(proofB).email, 'customer@speed-ad.com');
  assert.equal(env.api.listContactSubmissions({}, proofB).submissions.length, 2);
  assert.equal(env.network.length, 2);
});


test('authuser 2 routing survives customer URL, Login start RPC, pending state and completion URL', async () => {
  const env = runtime('', { oauth: true });
  env.api.doGet({ parameter: { id: 'case-b', authuser: '2', pli: '1' } });
  const startUrl = env.templates.at(-1).loginStartUrl;
  assert.equal(startUrl, env.properties.OAUTH_REDIRECT_URI + '?login=google&id=case-b&authuser=2');
  env.api.doGet({ parameter: Object.fromEntries(new URL(startUrl).searchParams) });
  assert.equal(env.templates.at(-1).authuser, '2');
  const login = loginClientRuntime(env, new Map(), null, env.templates.at(-1).authuser);
  await login.ui.prepareLogin();
  const authorization = new URL(login.elements.get('loginLink').href);
  assert.equal(authorization.searchParams.get('redirect_uri'), env.properties.OAUTH_REDIRECT_URI);
  assert.equal(new URL(authorization.searchParams.get('redirect_uri')).search, '');
  const pending = JSON.parse([...env.cacheEntries.values()][0].value);
  assert.equal(pending.authuser, '2');
  env.respond(() => tokenResponse(env, authorization));
  env.api.doGet({ parameter: { code: 'google-code', state: authorization.searchParams.get('state'), authuser: '7' } });
  const result = env.api.completeCustomerOAuthLogin(env.templates.at(-1).callback, login.storage.get(tabProofKey));
  assert.equal(result.returnUrl, env.properties.OAUTH_REDIRECT_URI + '?id=case-b&authuser=2', 'callback hint cannot replace the original return routing');
  assert.equal(env.api.getViewerContext(login.storage.get(tabProofKey)).email, 'customer@speed-ad.com');
});

test('malformed authuser hints are ignored and never grant authorization', () => {
  for (const hint of ['2&email=customer@speed-ad.com', '-1', '2.0', ' 2', '2\n', 'a', ['2'], {}, '99999999999']) {
    const env = runtime('', { oauth: true });
    env.api.doGet({ parameter: { authuser: hint } });
    assert.equal(env.templates.at(-1).loginStartUrl, env.properties.OAUTH_REDIRECT_URI + '?login=google');
    const proofHash = createHash('sha256').update(env.proof).digest('hex');
    const authorization = new URL(env.api.beginCustomerOAuthLogin(proofHash, '', hint).authorizationUrl);
    const pending = JSON.parse([...env.cacheEntries.values()][0].value);
    assert.equal(pending.authuser, '');
    assert.equal(authorization.searchParams.get('redirect_uri'), env.properties.OAUTH_REDIRECT_URI);
    env.respond(() => tokenResponse(env, authorization));
    const result = finishOAuth(env, authorization);
    assert.equal(result.returnUrl, env.properties.OAUTH_REDIRECT_URI);
  }
  const knownOther = runtime('other@speed-ad.com', { oauth: true });
  knownOther.api.doGet({ parameter: { authuser: '2' } });
  assert.equal(Object.keys(knownOther.templates.at(-1).viewerContext).length, 0);
  assert.throws(() => knownOther.api.beginCustomerOAuthLogin(createHash('sha256').update(knownOther.proof).digest('hex'), '', '2'), /ログイン/);
  assert.throws(() => knownOther.api.getViewerContext(knownOther.proof), /権限/);
});

test('diagnostic mapper exposes only fixed codes for exact internal messages', () => {
  const env = runtime();
  const known = {
    'OAuth configuration unavailable': 'AUTH_CONFIG',
    'Invalid state': 'AUTH_STATE', 'Invalid tab proof': 'AUTH_STATE',
    'Tab proof unavailable': 'AUTH_PROOF',
    'Invalid customer identity': 'AUTH_IDENTITY',
    'Known principal mismatch': 'AUTH_PERMISSION',
    'OAuth exchange HTTP 400': 'AUTH_TOKEN_HTTP400',
    'OAuth token request failed': 'AUTH_TOKEN_NETWORK',
    'Invalid token response': 'AUTH_TOKEN',
  };
  for (const [message, code] of Object.entries(known)) assert.equal(env.api.oauthFailureCode_({ message }), code);
  for (const message of ['Known principal mismatch customer@speed-ad.com', 'secret=PII_TOKEN [AUTH_STATE]', 'HTTP 400 arbitrary body', '']) {
    assert.equal(env.api.oauthFailureCode_({ message }), 'AUTH_UNKNOWN');
  }
  assert.equal(env.api.oauthFailureCode_(null), 'AUTH_UNKNOWN');
});

test('HTTP 400 diagnostic does not read or expose the token response body', () => {
  const env = runtime('', { oauth: true });
  const authorization = beginOAuth(env);
  let bodyReads = 0;
  env.respond(() => ({ getResponseCode: () => 400, getContentText() {
    bodyReads++;
    return 'private description customer@speed-ad.com secret=PII_TOKEN';
  } }));
  const result = finishOAuth(env, authorization);
  assert.equal(result.returnUrl, '');
  assert.match(result.error, /\[AUTH_TOKEN_HTTP400\]$/);
  assert.equal(bodyReads, 0);
  assert.doesNotMatch(result.error, /customer@|PII_TOKEN|description/);
  assertNoContactAccess(env);
});

test('public begin/complete sanitize known, network and unknown exceptions', () => {
  const denied = runtime('other@speed-ad.com', { oauth: true });
  assert.throws(() => denied.api.beginCustomerOAuthLogin('a'.repeat(64), ''), /\[AUTH_PERMISSION\]$/);
  const env = runtime('', { oauth: true });
  const authorization = beginOAuth(env);
  env.respond(() => { throw new Error('request with secret=PII_TOKEN customer@speed-ad.com'); });
  const result = finishOAuth(env, authorization);
  assert.match(result.error, /\[AUTH_TOKEN_NETWORK\]$/);
  assert.doesNotMatch(result.error, /PII_TOKEN|customer@/);
  const unknown = runtime('', { oauth: true });
  unknown.api.CacheService.getScriptCache = () => { throw new Error('unexpected private=PII_TOKEN customer@speed-ad.com'); };
  assert.throws(() => unknown.api.beginCustomerOAuthLogin('a'.repeat(64), ''), (error) => {
    assert.match(error.message, /\[AUTH_UNKNOWN\]$/);
    assert.doesNotMatch(error.message, /PII_TOKEN|customer@/);
    return true;
  });
});

test('Login catch shows only whitelisted fixed server codes and separates missing/storage proof', async () => {
  const env = runtime('', { oauth: true });
  const missing = loginClientRuntime(env, new Map(), { code: 'private-code', state: 'state' });
  await missing.ui.prepareLogin();
  assert.match(missing.elements.get('loginMessage').textContent, /\[AUTH_TAB_STORAGE\]$/);
  assert.equal(env.network.length, 0);
  const blocked = loginClientRuntime(env, new Map(), { code: 'private-code', state: 'state' });
  blocked.ui.window.sessionStorage.getItem = () => { throw new Error('raw storage error secret=PII_TOKEN'); };
  await blocked.ui.prepareLogin();
  assert.match(blocked.elements.get('loginMessage').textContent, /\[AUTH_TAB_STORAGE\]$/);
  assert.doesNotMatch(blocked.elements.get('loginMessage').textContent, /PII_TOKEN|private-code/);
  const login = loginClientRuntime(env);
  for (const code of ['AUTH_CONFIG', 'AUTH_STATE', 'AUTH_PROOF', 'AUTH_IDENTITY', 'AUTH_PERMISSION', 'AUTH_TOKEN_HTTP400', 'AUTH_TOKEN_NETWORK', 'AUTH_TOKEN', 'AUTH_UNKNOWN']) {
    assert.equal(login.ui.loginFailureCode({ message: 'Error: generic [' + code + ']' }), code);
  }
  assert.equal(login.ui.loginFailureCode({ message: 'secret=PII_TOKEN [AUTH_NOT_ALLOWED]' }), 'AUTH_UNKNOWN');
  assert.equal(login.ui.loginFailureCode({ message: 'secret=PII_TOKEN' }), 'AUTH_UNKNOWN');
  const callback = loginClientRuntime(env, new Map([[tabProofKey, env.proof]]), { code: 'private-code', state: 'bad-state' });
  await callback.ui.prepareLogin();
  assert.match(callback.elements.get('loginMessage').textContent, /\[AUTH_STATE\]$/);
  assert.doesNotMatch(callback.elements.get('loginMessage').textContent, /private-code|bad-state/);
});
