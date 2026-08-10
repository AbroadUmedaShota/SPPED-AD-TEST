import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const assetDirectories = [
  'img/brand',
  '02_dashboard/assets/svg/brand',
  '05_support/assets/img/brand'
];

const assetNames = [
  'speed-ad-emblem-color.svg',
  'speed-ad-emblem-white.svg',
  'speed-ad-favicon.svg',
  'speed-ad-wordmark-horizontal-black.svg',
  'speed-ad-wordmark-horizontal-white.svg',
  'speed-ad-wordmark-stacked-black.svg',
  'speed-ad-wordmark-stacked-white.svg'
];
const manifestPath = 'docs/画面設計/仕様/brand-asset-manifest.json';

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

function canonicalText(content) {
  return content.toString('utf8').replace(/\r\n?/g, '\n');
}

function svgPaths(svg) {
  return [...svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/gi)].map((match) => match[1]);
}

function viewBox(svg) {
  return svg.match(/viewBox="([^"]+)"/i)?.[1];
}

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

test('brand assets are identical across deployment areas', async () => {
  for (const name of assetNames) {
    const copies = await Promise.all(assetDirectories.map((directory) => readFile(path.join(directory, name))));
    assert.equal(new Set(copies.map(hash)).size, 1, `${name} differs between deployment areas`);
  }
});

test('brand manifest records canonical source and matches generated outputs', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.sourceId, 'latest-svg-directory');
  assert.equal(manifest.sourceDirectory, undefined);
  assert.deepEqual(
    Object.values(manifest.sourceFiles).map((sourceFile) => sourceFile.filename).sort(),
    [
      'カラーロゴ_ベクター_最終版_v10-edited.svg',
      'シルエットロゴ_ベクター_最終版_v10-edited.svg',
      'ブラックフォントロゴ_幅90_白背景.svg',
      'ブラックフォントロゴ幅90-2行左揃え_白背景.svg'
    ].sort()
  );
  for (const name of assetNames) {
    const content = await readFile(path.join(assetDirectories[0], name));
    const canonicalContent = canonicalText(content);
    assert.equal(hash(canonicalContent), manifest.outputs[name].sha256, `${name} does not match its manifest hash`);
    assert.equal(Buffer.byteLength(canonicalContent), manifest.outputs[name].bytes, `${name} does not match its manifest size`);
  }
});

test('wordmark variants are transparent, path-based, and shape-identical', async () => {
  for (const layout of ['horizontal', 'stacked']) {
    const black = await readFile(path.join(assetDirectories[0], `speed-ad-wordmark-${layout}-black.svg`), 'utf8');
    const white = await readFile(path.join(assetDirectories[0], `speed-ad-wordmark-${layout}-white.svg`), 'utf8');
    for (const [variant, svg] of [['black', black], ['white', white]]) {
      assert.doesNotMatch(svg, /<(?:rect|text|image)\b/i, `${layout} ${variant} is not transparent path data`);
      assert.match(svg, /<path\b/i);
    }
    assert.equal(viewBox(black), viewBox(white));
    assert.deepEqual(svgPaths(black), svgPaths(white));
  }
});

test('login hero uses the custom wordmark font as one copyable text string', async () => {
  const html = await readFile('index.html', 'utf8');
  const css = await readFile('css/login-front.css', 'utf8');
  const fontBuilder = await readFile('scripts/build-brand-font.py', 'utf8');
  const font = await readFile('fonts/speed-ad-wordmark.woff2');
  const heroTitle = html.match(/<h1\b[^>]*id="hero-title"[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '';

  assert.equal(heroTitle.trim(), 'SPEED AD');
  assert.doesNotMatch(heroTitle, /<(?:br|img|span)\b/i);
  const fontCss = await readFile('fonts/speed-ad-wordmark.css', 'utf8');
  assert.match(fontCss, /@font-face\s*\{[\s\S]*?font-family:\s*"SPEED AD Wordmark";[\s\S]*?speed-ad-wordmark\.woff2/);
  assert.match(fontCss, /--speed-ad-wordmark-first-line-width:\s*4\.275em;/);
  assert.match(fontCss, /--speed-ad-wordmark-block-offset:\s*-0\.088em;/);
  assert.match(fontCss, /--speed-ad-wordmark-first-line-indent:\s*-0\.048em;/);
  assert.match(css, /\.hero__brand-text\s*\{[\s\S]*?font-family:\s*"SPEED AD Wordmark"[\s\S]*?user-select:\s*text;/);
  assert.match(css, /\.hero__brand-text\s*\{[\s\S]*?font-size:\s*clamp\(6\.1rem,\s*10\.8vw,\s*8\.25rem\);/);
  assert.match(css, /\.hero__brand-text\s*\{[\s\S]*?line-height:\s*0\.79;/);
  assert.match(css, /\.hero__brand-text\s*\{[\s\S]*?font-feature-settings:\s*"kern" 1;[\s\S]*?letter-spacing:\s*normal;/);
  assert.match(css, /\.hero__brand-text\s*\{[\s\S]*?left:\s*var\(--speed-ad-wordmark-block-offset,[\s\S]*?text-indent:\s*var\(--speed-ad-wordmark-first-line-indent,/);
  assert.match(css, /\.hero__statement\s*\{[\s\S]*?margin:\s*8px 0 0;[\s\S]*?font-size:\s*32px;[\s\S]*?letter-spacing:\s*0\.025em;[\s\S]*?line-height:\s*1\.42;/);
  assert.match(css, /@media \(max-width:\s*760px\)[\s\S]*?\.hero__statement\s*\{[\s\S]*?font-size:\s*clamp\(1\.35rem,\s*6vw,\s*1\.5rem\);/);
  assert.match(fontBuilder, /def centered_left_side_bearing\([\s\S]*?advance - ink_width[\s\S]*?\/ 2/);
  assert.match(fontBuilder, /def setup_wordmark_gpos\([\s\S]*?addOpenTypeFeaturesFromString/);
  assert.equal(font.subarray(0, 4).toString('ascii'), 'wOF2');
});

test('customer-facing source no longer references legacy logo files', async () => {
  const roots = ['index.html', 'signup-verify.html', '02_dashboard', '04_first-login', '05_support'];
  const sourceFiles = [];
  for (const root of roots) {
    if (path.extname(root)) {
      sourceFiles.push(root);
    } else {
      sourceFiles.push(...(await walk(root)).filter((file) => /\.(?:html|css|js)$/i.test(file)));
    }
  }
  const legacyReference = /(?:speedad_logo(?:_white)?|speedad_emblem_(?:color|silhouette)|logo2|speedad-login-header-logo)\.svg/i;
  for (const file of sourceFiles) {
    assert.doesNotMatch(await readFile(file, 'utf8'), legacyReference, `${file} still references a legacy logo`);
  }
});
