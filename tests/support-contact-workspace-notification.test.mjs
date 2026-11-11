import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile('99_backend-docs/10_support-contact/gas/Code.gs', 'utf8');
function viewerLink(token = 'legacy-test-token', baseUrl = 'https://script.google.com/macros/s/workspace-viewer/exec') {
  const values = {
    CONTACT_VIEWER_BASE_URL: baseUrl,
    CONTACT_VIEWER_ACCESS_TOKEN: token,
  };
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => values[key] ?? null }) },
  });
  vm.runInContext(source, context);
  return context.buildViewerDetailUrl_('synthetic-id');
}

test('workspace notification link contains only the submission id, never a legacy token', () => {
  assert.equal(viewerLink(''), 'https://script.google.com/macros/s/workspace-viewer/exec?id=synthetic-id');
});
test('legacy notification links remain compatible while a token is configured', () => {
  assert.match(viewerLink(), /#token=legacy-test-token$/);
});
test('missing notification target does not emit a link', () => {
  assert.equal(viewerLink('', ''), '');
});

test('internal notification is a minimal alert addressed to the mailbox and group', () => {
  const values = {
    CONTACT_FROM_EMAIL: 'customer@speed-ad.com',
    CONTACT_REPLY_TO_EMAIL: 'customer@speed-ad.com',
    CONTACT_NOTIFY_EMAIL: 'customer@speed-ad.com,speed-ad-support@abroad-o.com',
    CONTACT_VIEWER_BASE_URL: 'https://script.google.com/macros/s/workspace-viewer/exec',
  };
  const sent = [];
  const context = vm.createContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => values[key] ?? null }) },
    GmailApp: { sendEmail: (...args) => sent.push(args) },
  });
  vm.runInContext(source, context);
  context.sendInternalNotification_({
    submissionId: 'synthetic-id',
    contactTypeLabel: '一般',
    name: 'Private Name',
    email: 'customer@example.com',
    subject: 'Private Subject',
    message: 'Private Body',
  }, '2026-11-11T00:00:00.000Z', { mode: 'primary' });
  assert.equal(sent.length, 1);
  const [to, subject, body, options] = sent[0];
  assert.equal(to, 'customer@speed-ad.com,speed-ad-support@abroad-o.com');
  assert.equal(subject, '【SPEED AD】新規お問い合わせ');
  assert.equal(options.replyTo, 'customer@speed-ad.com');
  assert.match(body, /synthetic-id/);
  assert.match(body, /2026-11-11T00:00:00.000Z/);
  assert.match(body, /exec\?id=synthetic-id/);
  for (const value of ['Private Name', 'customer@example.com', 'Private Subject', 'Private Body', '#token=']) {
    assert.doesNotMatch(body, new RegExp(value));
  }
});
