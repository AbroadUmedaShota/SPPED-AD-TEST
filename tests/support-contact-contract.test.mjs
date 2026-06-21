import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const CONTACT_FORM_HELPERS = '05_support/assets/js/contact-attachment-utils.js';
const PUBLIC_GAS_CODE = '99_backend-docs/10_support-contact/gas/Code.gs';
const VIEWER_GAS_CODE = '99_backend-docs/10_support-contact/viewer-gas/Code.gs';
const VIEWER_GAS_HTML = '99_backend-docs/10_support-contact/viewer-gas/Index.html';
const VIEWER_GAS_MANIFEST = '99_backend-docs/10_support-contact/viewer-gas/appsscript.json';

async function importLocalModule(path) {
  const source = await readFile(path, 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

test('support contact attachment helpers produce WEBP payload metadata', async () => {
  const helpers = await importLocalModule(CONTACT_FORM_HELPERS);
  const blob = new Blob(['webp-bytes'], { type: 'image/webp' });
  const file = { name: 'sample.capture.png', type: 'image/png', size: 14 };

  assert.equal(helpers.normalizeWebpQuality(undefined), 0.82);
  assert.equal(helpers.normalizeWebpQuality('0.72'), 0.72);
  assert.equal(helpers.normalizeWebpQuality('1.4'), 0.82);
  assert.equal(helpers.toWebpFilename('sample.capture.png'), 'sample.capture.webp');
  assert.equal(helpers.toWebpFilename(''), 'attachment.webp');

  assert.deepEqual(
    helpers.buildWebpAttachmentPayload({ file, webpBlob: blob, base64: 'abc123' }),
    {
      name: 'sample.capture.webp',
      mimeType: 'image/webp',
      size: blob.size,
      data: 'abc123',
      originalName: 'sample.capture.png',
      originalMimeType: 'image/png',
      originalSize: file.size,
    }
  );
});

test('public support contact GAS advertises viewer detail links', async () => {
  const code = await readFile(PUBLIC_GAS_CODE, 'utf8');

  assert.match(code, /CONTACT_VIEWER_BASE_URL/);
  assert.match(code, /CONTACT_VIEWER_ACCESS_TOKEN/);
  assert.match(code, /function buildViewerDetailUrl_/);
  assert.match(code, /#token=/);
  assert.doesNotMatch(code, /[&?]token=/);
  assert.match(code, /確認アプリ/);
  assert.match(code, /handled_by/);
  assert.match(code, /internal_note/);
});

test('support contact viewer GAS is token-gated and updates status', async () => {
  const [code, html, manifestText] = await Promise.all([
    readFile(VIEWER_GAS_CODE, 'utf8'),
    readFile(VIEWER_GAS_HTML, 'utf8'),
    readFile(VIEWER_GAS_MANIFEST, 'utf8'),
  ]);
  const manifest = JSON.parse(manifestText);

  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.match(code, /CONTACT_VIEWER_EMAILS/);
  assert.match(code, /CONTACT_VIEWER_ACCESS_TOKEN/);
  assert.match(code, /function doGet/);
  assert.match(code, /function listContactSubmissions/);
  assert.match(code, /function getContactSubmission/);
  assert.match(code, /function getAttachmentPreview/);
  assert.match(code, /function updateContactSubmissionStatus/);
  assert.match(code, /function validateViewerAccessToken/);
  assert.match(code, /function assertAttachmentFile_/);
  assert.match(code, /function requireViewer_/);
  assert.match(code, /counts\.total \+= 1;[\s\S]*if \(query && !matchesQuery_\(record, query\)\) continue;/);
  assert.match(code, /isActiveStatus_/);
  assert.match(code, /getRequestToken_/);
  assert.match(code, /DRIVE_FOLDER_ID/);
  assert.match(html, /CONTACT_VIEWER_ACCESS_TOKEN/);
  assert.match(html, /new URL\(window\.location\.href\)/);
  assert.match(html, /URLSearchParams/);
  assert.match(html, /history\.replaceState/);
  assert.match(html, /cleanAccessTokenFromUrl/);
  assert.match(html, /url\.searchParams\.delete\(key\)/);
  assert.match(html, /params\.delete\('token'\)/);
  assert.match(html, /params\.delete\('accessToken'\)/);
  assert.match(html, /validateViewerAccessToken/);
  assert.match(html, /bootstrapViewer/);
  assert.match(html, /callServer\('validateViewerAccessToken', state\.accessToken\)/);
  assert.match(html, /showApp\(\)[\s\S]*cleanAccessTokenFromUrl\(\);/);
  assert.match(html, /showDenied\([\s\S]*true\);/);
  assert.match(html, /showDenied\([\s\S]*false\);/);
  assert.match(html, /ensureAttachmentPreviewLoaded/);
  assert.match(html, /await ensureAttachmentPreviewLoaded\(state\.attachmentIndex\)/);
  assert.match(html, /setAttachmentModalVisibility/);
  assert.match(html, /removeAttribute\('aria-hidden'\)/);
  assert.match(html, /setAttribute\('aria-hidden', 'true'\)/);
  assert.doesNotMatch(html, /context\.allowed\s*=\s*true/);
  assert.match(html, /statusSummary/);
  assert.match(html, /対応が必要/);
  assert.match(html, /value="active" selected/);
  assert.match(html, /quick-status/);
  assert.match(html, /replyMailLink/);
  assert.match(html, /confirmDiscardChanges/);
  assert.match(html, /attachmentModal/);
  assert.match(html, /attachment-modal__nav/);
  assert.match(html, /未保存の変更があります。/);
  assert.match(html, /保存しました。/);
  assert.match(html, /未対応/);
  assert.match(html, /対応中/);
  assert.match(html, /対応済み/);
  assert.match(html, /保留/);
});
