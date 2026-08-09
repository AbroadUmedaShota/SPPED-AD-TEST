const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

/**
 * 03_admin 配下の全HTMLが参照する資産（画像・CSS・JS・HTML）が実在するかを見る。
 *
 * 到達16画面だけでなく、凍結資料として残している旧プロトタイプも対象にする。
 * 2026-08-09 に名刺画像を assets/ へ移設した際、到達16画面だけを確認して
 * 旧プロトタイプ（BY-223）の同ディレクトリ相対の参照を壊した。同じ見落としを止めるための検査。
 */

const ROOT = path.join(__dirname, '..', '..', '..', '03_admin');
const EXT = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.css', '.js', '.html'];

/** common/ の断片はページ側（03_admin 直下）へ差し込まれるため、相対パスはそこから解決する */
const isFragment = (rel) => rel.startsWith('common' + path.sep) || rel.startsWith('common/');

function htmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) { htmlFiles(full, out); }
    else if (name.endsWith('.html')) { out.push(path.relative(ROOT, full)); }
  }
  return out;
}

test('参照している画像・CSS・JS がすべて実在する', () => {
  const files = htmlFiles(ROOT);
  expect(files.length, 'HTML が見つからない').toBeGreaterThan(20);

  const missing = [];
  let checked = 0;
  for (const rel of files) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const base = isFragment(rel) ? '' : path.dirname(rel);
    const refs = new Set(Array.from(src.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g), (m) => m[1]));
    for (const ref of refs) {
      if (/^(https?:)?\/\/|^data:|^#|^mailto:/.test(ref)) { continue; }
      const clean = ref.split('?')[0].split('#')[0];
      if (!EXT.some((e) => clean.toLowerCase().endsWith(e))) { continue; }
      checked += 1;
      const target = path.join(ROOT, base, clean);
      if (!fs.existsSync(target)) {
        missing.push(`${rel} → ${ref}`);
      }
    }
  }
  expect(checked, '検査対象の参照が少なすぎる').toBeGreaterThan(100);
  expect(missing, `参照先が存在しない:\n  ${missing.join('\n  ')}`).toEqual([]);
});
