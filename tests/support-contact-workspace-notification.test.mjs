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
