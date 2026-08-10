import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const sourceDirectory = process.argv[2];

if (!sourceDirectory) {
  throw new Error('Usage: node scripts/sync-brand-assets.mjs <latest-svg-directory>');
}

const sourceFiles = {
  emblemColor: 'カラーロゴ_ベクター_最終版_v10-edited.svg',
  emblemWhite: 'シルエットロゴ_ベクター_最終版_v10-edited.svg',
  wordmarkHorizontal: 'ブラックフォントロゴ_幅90_白背景.svg',
  wordmarkStacked: 'ブラックフォントロゴ幅90-2行左揃え_白背景.svg'
};

const outputDirectories = [
  'img/brand',
  '02_dashboard/assets/svg/brand',
  '05_support/assets/img/brand'
];
const manifestPath = 'docs/画面設計/仕様/brand-asset-manifest.json';

function stripBackground(svg) {
  return svg.replace(/<rect\b[^>]*\bfill=["']#ffffff["'][^>]*\s*\/?>/i, '');
}

function makeWhite(svg) {
  return stripBackground(svg).replaceAll('#000000', '#ffffff');
}

function normalizeLineEndings(content) {
  return content.replace(/\r\n?/g, '\n');
}

function assertDerivedSvg(name, svg) {
  if (/<rect\b/i.test(svg)) {
    throw new Error(`${name} still contains a rect element.`);
  }
  if (/<text\b/i.test(svg)) {
    throw new Error(`${name} still contains a text element.`);
  }
  if (!/<path\b/i.test(svg) || !/viewBox=/i.test(svg)) {
    throw new Error(`${name} is missing paths or a viewBox.`);
  }
}

const sourceEntries = await Promise.all(Object.entries(sourceFiles).map(async ([key, filename]) => {
  const sourcePath = path.join(sourceDirectory, filename);
  const [content, metadata] = await Promise.all([readFile(sourcePath), stat(sourcePath)]);
  return [key, {
    filename,
    content,
    bytes: content.byteLength,
    modifiedAt: metadata.mtime.toISOString(),
    sha256: createHash('sha256').update(content).digest('hex')
  }];
}));
const sourceAssets = Object.fromEntries(sourceEntries);
const emblemColor = normalizeLineEndings(sourceAssets.emblemColor.content.toString('utf8'));
const emblemWhite = normalizeLineEndings(sourceAssets.emblemWhite.content.toString('utf8'));
const wordmarkHorizontalSource = normalizeLineEndings(sourceAssets.wordmarkHorizontal.content.toString('utf8'));
const wordmarkStackedSource = normalizeLineEndings(sourceAssets.wordmarkStacked.content.toString('utf8'));

const assets = {
  'speed-ad-emblem-color.svg': emblemColor,
  'speed-ad-emblem-white.svg': emblemWhite,
  'speed-ad-wordmark-horizontal-black.svg': stripBackground(wordmarkHorizontalSource),
  'speed-ad-wordmark-horizontal-white.svg': makeWhite(wordmarkHorizontalSource),
  'speed-ad-wordmark-stacked-black.svg': stripBackground(wordmarkStackedSource),
  'speed-ad-wordmark-stacked-white.svg': makeWhite(wordmarkStackedSource),
  'speed-ad-favicon.svg': emblemColor
};

function extractSvgBody(svg) {
  return svg
    .replace(/^<\?xml[^>]*>\s*/i, '')
    .replace(/^<svg\b[^>]*>/i, '')
    .replace(/<title>[^<]*<\/title>/i, '')
    .replace(/<\/svg>\s*$/i, '');
}

for (const [name, svg] of Object.entries(assets)) {
  if (name.includes('wordmark')) {
    assertDerivedSvg(name, svg);
  }
}

for (const directory of outputDirectories) {
  await mkdir(directory, { recursive: true });
  for (const [name, svg] of Object.entries(assets)) {
    await writeFile(path.join(directory, name), svg, 'utf8');
  }
}

for (const name of Object.keys(assets)) {
  const hashes = await Promise.all(outputDirectories.map(async (directory) => {
    const content = await readFile(path.join(directory, name));
    return createHash('sha256').update(content).digest('hex');
  }));
  if (new Set(hashes).size !== 1) {
    throw new Error(`${name} differs between deployment areas.`);
  }
}

const newsDefaultPath = '05_support/assets/img/news-default.svg';
const newsDefault = await readFile(newsDefaultPath, 'utf8');
const embeddedWordmark = `<svg x="350" y="235" width="500" height="69" viewBox="0 0 1209 166" aria-hidden="true">${extractSvgBody(assets['speed-ad-wordmark-horizontal-white.svg'])}</svg>`;
const updatedNewsDefault = newsDefault.replace(
  /<text\b[^>]*>SPEED AD<\/text>/i,
  embeddedWordmark
);
if (updatedNewsDefault === newsDefault && !newsDefault.includes('viewBox="0 0 1209 166"')) {
  throw new Error('Could not replace the SPEED AD text in news-default.svg.');
}
await writeFile(newsDefaultPath, updatedNewsDefault, 'utf8');

const manifest = {
  schemaVersion: 1,
  syncedAt: new Date().toISOString(),
  sourceId: 'latest-svg-directory',
  sourceFiles: Object.fromEntries(Object.entries(sourceAssets).map(([key, sourceAsset]) => [key, {
    filename: sourceAsset.filename,
    bytes: sourceAsset.bytes,
    modifiedAt: sourceAsset.modifiedAt,
    sha256: sourceAsset.sha256
  }])),
  outputs: Object.fromEntries(Object.entries(assets).map(([name, svg]) => [name, {
    bytes: Buffer.byteLength(svg),
    sha256: createHash('sha256').update(svg).digest('hex')
  }]))
};
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(`Synced ${Object.keys(assets).length} brand assets to ${outputDirectories.length} deployment areas and wrote ${manifestPath}.`);
