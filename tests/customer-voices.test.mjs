import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const dataPath = '05_support/assets/data/customer-voices.json';
const detailHtmlPath = '05_support/customer-voices/oriental-motor/index.html';
const detailScriptPath = '05_support/customer-voices/oriental-motor.js';
const detailStylePath = '05_support/customer-voices/oriental-motor.css';
const heroImagePath = '05_support/assets/img/customer-voices/oriental-motor-placeholder.png';

test('Oriental Motor is the first published customer voice with approved summary copy', async () => {
  const collection = JSON.parse(await readFile(dataPath, 'utf8'));
  const published = collection.voices.filter((voice) => voice.publishStatus === 'published');
  const slugs = collection.voices.map((voice) => voice.slug);
  const voice = published[0];

  assert.equal(new Set(slugs).size, slugs.length, 'customer voice slugs must be unique');
  assert.equal(voice.slug, 'oriental-motor');
  assert.equal(voice.voicePageLabel, 'オリエンタルモーター株式会社様');
  assert.equal(voice.voicePageHeadline, '翌営業日に名刺データを納品。翌々日、利用中のCRMへ取り込み完了。');
  assert.equal(
    voice.listingSummary,
    '既存のSPEED AD利用ユーザーからの紹介をきっかけに利用を開始。名刺データを翌営業日に納品し、利用中のCRMへの取り込みを翌々日に完了した事例です。'
  );
  assert.deepEqual(voice.voicePageHighlights, [
    { label: '導入のきっかけ', value: '既存ユーザー様からの紹介' },
    { label: '名刺データの納品', value: '展示会終了後の翌営業日' },
    { label: '利用中CRMへの取り込み', value: '展示会終了後の翌々日' },
  ]);
  assert.deepEqual(voice.outcome, [
    '名刺データを翌営業日に受領できた',
    '利用中のCRMへの取り込みを翌々日に完了できた',
    '名刺データの納品から利用中のCRMへの取り込みまでを短い日程で進められた',
  ]);
  assert.equal(voice.quote, undefined);
  assert.equal(voice.publicQuoteAuthor, undefined);
  assert.equal(voice.heroImage, 'img/customer-voices/oriental-motor-placeholder.png');
});

test('Oriental Motor detail route has canonical metadata and no testimonial quote block', async () => {
  const html = await readFile(detailHtmlPath, 'utf8');
  const script = await readFile(detailScriptPath, 'utf8');
  const style = await readFile(detailStylePath, 'utf8');

  assert.match(html, /<link rel="canonical" href="https:\/\/support\.speed-ad\.com\/customer-voices\/oriental-motor\/">/);
  assert.match(html, /<meta property="og:url" content="https:\/\/support\.speed-ad\.com\/customer-voices\/oriental-motor\/">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/support\.speed-ad\.com\/assets\/img\/customer-voices\/oriental-motor-placeholder\.png">/);
  assert.match(html, /data-voice-slug="oriental-motor"/);
  assert.doesNotMatch(html, /<blockquote\b|担当者コメント|ご担当者のコメント/);
  assert.match(html, /本ページは、確認済みの導入事例をもとに構成した要約です。/);
  assert.match(html, /紹介をきっかけに始まった、名刺データ活用の流れ/);
  assert.match(html, /名刺データ納品から、利用中のCRM取り込みまで/);
  assert.match(html, /名刺情報を、[\s\S]*次の活用へ[\s\S]*スムーズにつなぐ。/);
  assert.match(script, /item\.slug === 'oriental-motor'/);
  assert.match(script, /renderParagraphs\(voice\.overview\)/);
  assert.match(script, /renderTimeline\(voice\.operationImage\)/);
  assert.match(script, /renderBullets\(voice\.outcome\)/);
  assert.match(style, /\.voice-oriental-motor/);
  await access(heroImagePath);
});

test('login teaser renders approved quotes and editorial summaries with different semantics', async () => {
  const script = await readFile('js/login-front.js', 'utf8');

  assert.match(script, /const hasApprovedQuote = Boolean\(voice\.quote\?\.text\);/);
  assert.match(script, /hasApprovedQuote\s*\? `<blockquote class="voice-teaser-card__quote">/);
  assert.match(script, /: `<p class="voice-teaser-card__quote">/);
  assert.match(script, /hasApprovedQuote && author/);
});

test('mock customer voice navigation stays inside the local static site', async () => {
  const loginHtml = await readFile('index.html', 'utf8');
  const loginScript = await readFile('js/login-front.js', 'utf8');
  const voicePages = await Promise.all([
    readFile('05_support/customer-voices/index.html', 'utf8'),
    readFile('05_support/customer-voices/oriental-motor/index.html', 'utf8'),
    readFile('05_support/customer-voices/company-monitor/index.html', 'utf8'),
    readFile('05_support/customer-voices/university-survey/index.html', 'utf8'),
  ]);

  assert.match(loginHtml, /href="05_support\/customer-voices\/"[^>]*>導入事例<\/a>/);
  assert.match(loginHtml, /href="05_support\/customer-voices\/"[^>]*>すべての声を見る/);
  assert.doesNotMatch(loginHtml, /<a\b[^>]*href="https:\/\/support\.speed-ad\.com\/customer-voices\//);
  assert.match(loginScript, /resolveAppPath\('05_support\/customer-voices\/'\)/);
  assert.match(loginScript, /resolveAppPath\(`05_support\/customer-voices\/\$\{voice\.slug \|\| ''\}\/`\)/);
  assert.doesNotMatch(loginScript, /https:\/\/support\.speed-ad\.com\/customer-voices\//);

  for (const html of voicePages) {
    assert.doesNotMatch(html, /<a\b[^>]*href="https:\/\/(?:support\.)?speed-ad\.com\//);
  }
  assert.match(voicePages[0], /href="\.\.\/\.\.\/index\.html\?intent=signup#top"/);
  for (const html of voicePages.slice(1)) {
    assert.match(html, /href="\.\.\/\.\.\/\.\.\/index\.html#top"/);
  }
});

test('customer voice specification records the named route and optional quote policy', async () => {
  const specification = await readFile('docs/画面設計/仕様/19_customer_voice_public_pages.md', 'utf8');

  assert.match(specification, /https:\/\/support\.speed-ad\.com\/customer-voices\/oriental-motor\//);
  assert.match(specification, /`quote` と `publicQuoteAuthor` は任意/);
  assert.match(specification, /実名掲載許諾済み/);
});
