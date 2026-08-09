/**
 * フッターの有無（`01_admin_common_ui.md` §2）。
 *
 * 個票・作業画面（名刺入力画面・名刺情報照合）は主要領域を縦スクロールなしで
 * 1 画面に収める制約があるため置かない。それ以外の到達画面には置く。
 */

const { test, expect } = require('@playwright/test');
const { SCREENS, openScreen } = require('./_screens');

/** 1 画面に収める制約がある個票・作業画面 */
const NO_FOOTER = ['名刺入力画面', '名刺入力画面(全グループ)', '名刺情報照合'];

for (const s of SCREENS) {
  const want = !NO_FOOTER.includes(s.name);
  test(`${s.name}: フッターを${want ? '表示する' : '置かない'}`, async ({ page }) => {
    await openScreen(page, s.path);
    const footer = page.locator('#footer-placeholder footer');
    if (!want) {
      await expect(footer).toHaveCount(0);
      return;
    }
    await expect(footer).toHaveCount(1);
    await expect(footer).toBeVisible();
    // 本文の器と左右の位置が揃っていないと、端に貼り付いて見える
    const gap = await page.evaluate(() => {
      const f = document.querySelector('#footer-placeholder footer');
      const body = [...document.getElementById('main-content').children]
        .find((e) => e.id !== 'footer-placeholder');
      const fs = getComputedStyle(f);
      const bs = getComputedStyle(body);
      return {
        left: parseFloat(fs.paddingLeft) - parseFloat(bs.paddingLeft),
        right: parseFloat(fs.paddingRight) - parseFloat(bs.paddingRight),
      };
    });
    expect(gap.left, '左の余白が本文と揃っていない').toBe(0);
    expect(gap.right, '右の余白が本文と揃っていない').toBe(0);
  });
}

test('フッターは配色トークンを通していて、テーマに追随する', async ({ page }) => {
  const read = async () => page.evaluate(() => {
    const f = document.querySelector('#footer-placeholder footer');
    const cs = getComputedStyle(f);
    return { color: cs.color, border: cs.borderTopColor };
  });

  await openScreen(page, '/03_admin/index.html');
  const light = await read();

  await page.addInitScript(() => {
    try { localStorage.setItem('adminTheme', 'dark'); } catch (e) { /* 既定で進む */ }
  });
  await openScreen(page, '/03_admin/index.html');
  const dark = await read();

  expect(dark.color, 'ダークで文字色が変わらない').not.toBe(light.color);
  expect(dark.border, 'ダークで罫線の色が変わらない').not.toBe(light.border);
});
