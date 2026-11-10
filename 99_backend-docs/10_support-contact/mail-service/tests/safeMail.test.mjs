import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { htmlToPlainText } from '../safeMail.mjs';

test('HTML text keeps line breaks and entities while discarding comments, attributes and active content', () => {
  assert.equal(htmlToPlainText('<p title="a > b">A &amp; B<br/>C</p><!-- hidden -->'
    + '<SCRIPT type="text/javascript">hidden</SCRIPT><style>hidden</style>'
    + '<iframe>hidden</iframe><object>hidden</object><svg><text>hidden</text></svg>'
    + '<svg />D<div>E</div><li>F</li><tr>G</tr><blockquote>H</blockquote>'),
  'A & B\nC\nDE\nF\nG\nH\n');
  assert.equal(htmlToPlainText('&lt;script&gt;inert text&lt;/script&gt; &#x65e5;&#26412;&#xD800;'),
    '<script>inert text</script> 日本');
});

test('unfinished HTML markup and active blocks discard the remaining content', () => {
  for (const suffix of ['<', '<p title="unfinished', '<!-- unfinished comment', '<script>hidden',
    '<STYLE>hidden < < <', '<iframe>hidden', '<object>hidden', '<svg>hidden']) {
    assert.equal(htmlToPlainText(`visible${suffix}`), 'visible');
  }
  assert.equal(htmlToPlainText('before<script>hidden</script>after<!-- hidden -->end'), 'beforeafterend');
  assert.equal(htmlToPlainText('before<script>hidden</script!>still hidden'), 'before');
});

test('maximum-size malformed HTML finishes within a generous process budget', { timeout: 15000 }, () => {
  const moduleUrl = new URL('../safeMail.mjs', import.meta.url).href;
  const script = `import assert from 'node:assert/strict';
    import { htmlToPlainText } from ${JSON.stringify(moduleUrl)};
    const size = 2 * 1024 * 1024;
    for (const prefix of ['', '<!--', '<script>']) {
      assert.equal(htmlToPlainText(prefix + '<'.repeat(size - prefix.length)), '');
    }
    assert.equal(htmlToPlainText('visible' + '<p title="' + 'x'.repeat(size - 17)), 'visible');
    process.stdout.write('completed');`;
  assert.equal(execFileSync(process.execPath, ['--input-type=module', '--eval', script],
    { encoding: 'utf8', timeout: 10000 }), 'completed');
});
