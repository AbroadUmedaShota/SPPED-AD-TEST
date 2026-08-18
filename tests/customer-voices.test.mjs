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
  assert.equal(voice.voicePageHeadline, '展示会後の名刺を、翌々日には利用中のCRMへ。');
  assert.equal(
    voice.listingSummary,
    '既存ユーザー様からの紹介をきっかけに利用を開始。展示会終了後の翌営業日に名刺データを納品し、翌々日にはSPEED ADが利用中のCRMへの取り込みまで完了した事例です。'
  );
  assert.equal(
    voice.voicePageSummary,
    '既存ユーザー様の紹介をきっかけに利用を開始。本事例では、展示会終了後の翌営業日に名刺データを納品し、その翌日にはSPEED ADが利用中のCRMへの取り込みまで完了しました。データ納品だけで終わらず、CRMで活用できる状態まで一連で進められたことが、大きなメリットとなりました。'
  );
  assert.deepEqual(voice.voicePageHighlights, [
    { label: '導入のきっかけ', value: '既存ユーザー様からの紹介' },
    { label: '展示会終了後 翌営業日', value: '名刺データを納品' },
    { label: '展示会終了後 翌々日', value: 'SPEED ADがCRM取り込みまで完了' },
  ]);
  assert.deepEqual(voice.outcome, [
    '展示会終了後の翌営業日に、名刺データを受領できた',
    '翌々日には、SPEED ADによる利用中CRMへの取り込みまで完了した',
    '名刺データ化からCRMで活用できる状態まで、一連の流れで進められた',
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
  assert.match(html, /展示会後の名刺を、[\s\S]*翌々日には[\s\S]*利用中の[\s\S]*CRMへ。/);
  assert.match(html, /紹介をきっかけに、[\s\S]*CRM活用までを一連で依頼/);
  assert.match(html, /展示会終了から翌々日まで。[\s\S]*活用できるデータへ/);
  assert.match(html, /データ納品で終わらない、[\s\S]*一連対応のメリット/);
  assert.match(html, /名刺データ化から、[\s\S]*利用中CRMへの[\s\S]*取り込みまで。/);
  assert.doesNotMatch(html, /実名掲載許諾済み|固有情報は掲載していません|編集注記|確認済みの導入事例|同一日程を保証/);
  assert.match(html, /class="voice-footer oriental-footer"/);
  assert.match(html, /class="oriental-signal"/);
  assert.match(html, /D\+1[\s\S]*名刺データを納品/);
  assert.match(html, /D\+2[\s\S]*CRM取り込み完了/);
  assert.doesNotMatch(html, /Zen\+Old\+Mincho|支給素材へ差し替え予定/);
  assert.match(html, /導入事例一覧/);
  assert.match(script, /item\.slug === 'oriental-motor'/);
  assert.match(script, /展示会後の名刺を、翌々日には利用中のCRMへ。/);
  assert.match(script, /renderParagraphs\(voice\.overview\)/);
  assert.match(script, /renderTimeline\(voice\.operationImage\)/);
  assert.match(script, /renderBullets\(voice\.outcome\)/);
  assert.match(style, /\.voice-oriental-motor/);
  assert.match(style, /\.oriental-signal/);
  assert.match(style, /--oriental-canvas: #f7f9fc/);
  assert.match(style, /\.voice-oriental-motor \.oriental-footer/);
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
