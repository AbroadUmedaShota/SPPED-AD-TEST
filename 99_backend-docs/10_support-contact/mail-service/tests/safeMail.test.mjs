import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { htmlToPlainText } from '../safeMail.mjs';
import { readMessageText } from '../mime.mjs';
import { classifyMessage } from '../classification.mjs';

test('HTML text keeps line breaks and entities while discarding comments, attributes and active content', () => {
  assert.equal(htmlToPlainText('<p title="a > b">A &amp; B<br/>C</p><!-- hidden -->'
    + '<SCRIPT type="text/javascript">hidden</SCRIPT><style>hidden</style>'
    + '<iframe>hidden</iframe><object>hidden</object><svg><text>hidden</text></svg>'
    + '<svg />D<div>E</div><li>F</li><table><tr><td>G</td></tr></table><blockquote>H</blockquote>'),
  'A & B\nC\nDE\nF\nG\nH\n');
  assert.equal(htmlToPlainText('&lt;script&gt;inert text&lt;/script&gt; &#x65e5;&#26412;&#xD800;'),
    '<script>inert text</script> 日本�');
  assert.equal(htmlToPlainText('&amp;lt;literal&amp;gt; &nbsp;'), '&lt;literal&gt;  ');
});

test('unfinished HTML markup and active blocks discard the remaining content', () => {
  for (const suffix of ['<p title="unfinished', '<!-- unfinished comment', '<script>hidden',
    '<STYLE>hidden < < <', '<iframe>hidden', '<object>hidden', '<svg>hidden']) {
    assert.equal(htmlToPlainText(`visible${suffix}`), 'visible');
  }
  assert.equal(htmlToPlainText('before<script>hidden</script>after<!-- hidden -->end'), 'beforeafterend');
  assert.equal(htmlToPlainText('before<script>hidden</script!>still hidden'), 'before');
});

test('literal less-than text remains visible under HTML parsing rules', () => {
  assert.equal(htmlToPlainText('<p>cost < 100 yen'), 'cost < 100 yen\n');
  assert.equal(htmlToPlainText('visible<'), 'visible<');
});

test('comparison operators inside active blocks cannot consume the matching end tag or later text', () => {
  for (const name of ['script', 'style', 'iframe', 'object', 'svg']) {
    assert.equal(htmlToPlainText(`<${name}>if (a < b) run();</${name}><p>customer text</p>`),
      'customer text\n');
  }
  assert.equal(htmlToPlainText('before<script>a < b && c > d; <!-- unfinished </SCRIPT \n>after'), 'beforeafter');
  assert.equal(htmlToPlainText('<script>hidden</script!>a < b</script><p>later</p>'), 'later\n');
});

test('commented closing tags cannot leak hidden SVG or object case IDs into classification', async () => {
  const caseId = '11111111-1111-4111-8111-111111111111';
  for (const name of ['svg', 'object']) {
    const html = `<${name}><!-- </${name}> -->受付ID: ${caseId}</${name}>visible`;
    const bytes = Buffer.from(html);
    const bodyText = await readMessageText({ id: 'mail1', payload: { mimeType: 'text/html',
      body: { data: bytes.toString('base64url'), size: bytes.length } } });
    assert.equal(bodyText, 'visible');
    const result = classifyMessage({ bodyText, trustedAnchor: true }, [caseId]);
    assert.equal(result.matchState, 'pending');
    assert.equal(result.reason, 'no_proven_case');
    assert.deepEqual(result.evidence.bodyCaseIds, []);
  }
});

test('maximum-size malformed HTML finishes within a generous process budget', { timeout: 15000 }, (t) => {
  const moduleUrl = new URL('../safeMail.mjs', import.meta.url).href;
  const script = `import assert from 'node:assert/strict';
    import { htmlToPlainText } from ${JSON.stringify(moduleUrl)};
    const size = 2 * 1024 * 1024;
    const started = performance.now();
    const literal = '<'.repeat(size);
    assert.ok(htmlToPlainText(literal) === literal);
    for (const prefix of ['<!--', '<script>']) {
      assert.equal(htmlToPlainText(prefix + '<'.repeat(size - prefix.length)), '');
    }
    assert.equal(htmlToPlainText('visible' + '<p title="' + 'x'.repeat(size - 17)), 'visible');
    const prefix = '<script>';
    const suffix = '</script><p>customer text</p>';
    assert.equal(htmlToPlainText(prefix + '<'.repeat(size - prefix.length - suffix.length) + suffix), 'customer text\\n');
    for (const tag of ['<br>', '<div>']) {
      assert.throws(() => htmlToPlainText(tag.repeat(Math.floor(size / tag.length))), /MAIL_HTML_STRUCTURE_LIMIT/);
    }
    const text = 'x'.repeat(size - 20000 * 5);
    assert.ok(htmlToPlainText('<div>'.repeat(20000) + text) === text + '\\n'.repeat(20000));
    let attrs = []; let length = 6;
    for (let index = 0; length < size - 30; index += 1) {
      const attr = 'a' + index + '=x '; attrs.push(attr); length += attr.length;
    }
    assert.equal(htmlToPlainText('<div ' + attrs.join('') + '>text</div>'), 'text\\n');
    process.stdout.write(JSON.stringify({ elapsedMs: performance.now() - started, maxRssKiB: process.resourceUsage().maxRSS }));`;
  const result = JSON.parse(execFileSync(process.execPath, ['--max-old-space-size=128', '--input-type=module', '--eval', script],
    { encoding: 'utf8', timeout: 10000 }));
  assert(result.maxRssKiB > 0 && result.maxRssKiB <= 192 * 1024, `HTML parsing peak RSS ${result.maxRssKiB} KiB`);
  t.diagnostic(`HTML stress: ${Math.round(result.elapsedMs)} ms, peak RSS ${result.maxRssKiB} KiB`);
});
