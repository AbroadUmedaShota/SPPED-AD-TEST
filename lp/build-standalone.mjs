/*
 * 各LPを「1ファイルで開ける」形に固めて lp/standalone/ へ出力する。
 *
 *   node lp/build-standalone.mjs
 *
 * やること:
 *   - <img src> のローカル画像を base64 の data URI に置き換える
 *   - <script src="../switcher.js"> を中身ごと埋め込む
 *   - 歯車の遷移先を ../<key>/index.html → ./<key>.html に書き換える
 *     （standalone を1つのフォルダにまとめて置けば切替もそのまま動く）
 *
 * 埋め込まないもの: Google Fonts。ネットに出られない環境ではヒラギノ／
 * システムフォントにフォールバックする（レイアウトは崩れない）。
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const LP_DIR = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(LP_DIR, 'standalone');

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

function dataUri(file) {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return null;
  return `data:${mime};base64,${readFileSync(file).toString('base64')}`;
}

function lpKeys() {
  return readdirSync(LP_DIR)
    .filter(name => {
      const p = join(LP_DIR, name);
      return name !== 'standalone' && statSync(p).isDirectory() && readdirSync(p).includes('index.html');
    });
}

mkdirSync(OUT_DIR, { recursive: true });

const switcherSrc = readFileSync(join(LP_DIR, 'switcher.js'), 'utf8')
  /* 遷移先を同フォルダの単体ファイルへ */
  .replace(/href: '\.\.\/([a-z0-9-]+)\/index\.html'/g, "href: './$1.html'");

let total = 0;
for (const key of lpKeys()) {
  const srcFile = join(LP_DIR, key, 'index.html');
  let html = readFileSync(srcFile, 'utf8');
  let embedded = 0, missing = [];

  /* 画像を data URI へ */
  html = html.replace(/(<img\b[^>]*?\bsrc=")([^"]+)(")/g, (m, pre, src, post) => {
    if (/^(data:|https?:)/.test(src)) return m;
    const abs = resolve(dirname(srcFile), src);
    try {
      const uri = dataUri(abs);
      if (!uri) { missing.push(src); return m; }
      embedded++;
      return pre + uri + post;
    } catch { missing.push(src); return m; }
  });

  /* switcher.js を埋め込む */
  const before = html;
  html = html.replace(/<script src="\.\.\/switcher\.js"><\/script>/, `<script>\n${switcherSrc}\n</script>`);
  const switcherInlined = html !== before;

  writeFileSync(join(OUT_DIR, `${key}.html`), html, 'utf8');
  const kb = Math.round(Buffer.byteLength(html) / 1024);
  console.log(
    `${key.padEnd(20)} 画像 ${String(embedded).padStart(2)}件埋め込み  切替JS ${switcherInlined ? '埋め込み' : '対象なし'}  ${String(kb).padStart(6)} KB` +
    (missing.length ? `  ※未処理: ${missing.join(', ')}` : '')
  );
  total++;
}
console.log(`\n${total} 本を lp/standalone/ へ出力しました。`);
