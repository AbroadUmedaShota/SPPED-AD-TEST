/**
 * 省略表示（…）になったセルから全文を読めることを担保する。
 *
 * 幅が足りない列は横スクロールではなく省略で収める方針（`05_admin_nonfunctional.md` §6.2）。
 * 省略した以上、全文はどこかで読めないといけない。title か aria-label に入れる。
 * 行き先だけを書いた title（「アンケート詳細へ」など）では中身が読めないので、
 * 表示している文字そのものが含まれているかまで見る。
 */

const { test, expect } = require('@playwright/test');
const { SCREENS, openScreen } = require('./_screens');

/** 実際に切れていて、かつ全文が読めない要素を集める */
const CUT_OFF = `() => {
  const out = [];
  const seen = new Set();
  document.querySelectorAll('#main-content *').forEach((e) => {
    if (e.children.length) { return; }
    const st = getComputedStyle(e);
    if (st.textOverflow !== 'ellipsis' && !/hidden|clip/.test(st.overflowX)) { return; }
    if (e.scrollWidth <= e.clientWidth + 1) { return; }
    const txt = (e.textContent || '').trim();
    if (txt.length < 4) { return; }
    const hint = (e.getAttribute('title') || '') + ' ' + (e.getAttribute('aria-label') || '');
    if (hint.includes(txt.slice(0, Math.min(8, txt.length)))) { return; }
    const k = txt.slice(0, 20);
    if (seen.has(k)) { return; }
    seen.add(k);
    out.push('「' + txt.slice(0, 30) + '」 title=' + (e.getAttribute('title') || 'なし'));
  });
  return out;
}`;

// 1920 は基準幅、1366 は列を隠しきる下限、1280 はその下（`05_admin_nonfunctional.md` §6.2）
for (const width of [1920, 1366, 1280]) {
  test.describe(`省略表示 @${width}px`, () => {
    for (const s of SCREENS) {
      test(`${s.name}: 切れた文字は title から読める`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        await openScreen(page, s.path);
        // openScreen が 1920 に戻すため、開いたあとにもう一度当てる
        await page.setViewportSize({ width, height: 1000 });
        // 幅を変えると一部の画面は行を描き直す。寸法が動かなくなるまで待つ
        await page.waitForFunction(() => {
          const m = document.getElementById('main-content');
          if (!m) { return false; }
          const now = m.scrollWidth + 'x' + m.scrollHeight + ':' + m.querySelectorAll('*').length;
          const same = window.__lastLayout === now;
          window.__lastLayout = now;
          return same;
        }, null, { timeout: 5000, polling: 120 });
        const cut = await page.evaluate(`(${CUT_OFF})()`);
        expect(cut, `全文が読めない\n${cut.join('\n')}`).toEqual([]);
      });
    }
  });
}
