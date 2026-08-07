const { test, expect } = require('@playwright/test');
const { SCREENS, openScreen } = require('./_screens');

/**
 * 到達16画面の土台。どの画面でも崩れていないことだけを見る。
 *
 * ここが落ちるときは個別機能ではなく共通部分（admin.js のシェル注入、
 * admin-style.css、proto-ui.js）が壊れている。
 */

test.describe('管理画面モックの共通シェル', () => {
  for (const screen of SCREENS) {
    test(`${screen.name}: JSエラーなし・横スクロールなし・hidden が効いている`, async ({ page }) => {
      const errors = await openScreen(page, screen.path);

      const state = await page.evaluate(() => {
        const de = document.documentElement;
        // hidden 属性を持つのに表示されている要素。
        // インラインの display:flex が [hidden] に勝つ事故を防ぐ（admin-style.css の !important）
        const hiddenLeaks = [];
        document.querySelectorAll('[hidden]').forEach((e) => {
          if (getComputedStyle(e).display !== 'none') {
            hiddenLeaks.push((e.id || e.tagName) + ' style=' + (e.getAttribute('style') || '').slice(0, 40));
          }
        });
        // 1920px 全幅で組む前提なので、横にはみ出す要素があれば設計違反
        const overflow = [];
        document.querySelectorAll('*').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.right > de.clientWidth + 1) {
            overflow.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + ' right=' + Math.round(r.right));
          }
        });
        return {
          hiddenLeaks,
          overflow: overflow.slice(0, 3),
          scrollWidth: de.scrollWidth,
          clientWidth: de.clientWidth,
          hasHeader: !!document.querySelector('#header-placeholder')?.children.length,
          hasMain: !!document.querySelector('#main-content'),
          lang: de.getAttribute('lang'),
        };
      });

      expect(errors, `JSエラー: ${errors[0] || ''}`).toEqual([]);
      expect(state.hiddenLeaks, 'hidden なのに表示されている要素').toEqual([]);
      expect(state.overflow, `横にはみ出している（${state.scrollWidth} > ${state.clientWidth}）`).toEqual([]);
      expect(state.hasHeader, '共通ヘッダーが注入されていない').toBe(true);
      expect(state.hasMain, '#main-content が無い').toBe(true);
      expect(state.lang).toBe('ja');
    });
  }
});

test.describe('表示シナリオ（proto-level.js）', () => {
  // 権限そのものではなく「モックの見せ分け」。実際の認可はサーバー側の責務
  for (const [stored, expected] of [['lv1', 1], ['lv2', 2], ['lv3', 3], ['lv4', 4]]) {
    test(`${stored} が pLevel()=${expected} になる`, async ({ page }) => {
      await page.addInitScript((v) => localStorage.setItem('adminMockLevel', v), stored);
      await openScreen(page, '/03_admin/index.html');
      expect(await page.evaluate(() => window.pLevel())).toBe(expected);
    });
  }

  test('未定義のレベルは 4 に丸める（旧実装は lv9 を 9 と解釈していた）', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('adminMockLevel', 'lv9'));
    await openScreen(page, '/03_admin/index.html');
    expect(await page.evaluate(() => window.pLevel())).toBe(4);
  });
});
