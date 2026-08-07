const { test, expect } = require('@playwright/test');
const { openScreen } = require('./_screens');

/**
 * 請求管理（SCR-A-006）。
 *
 * 15_admin_billing.md は 1 行 = 1 アンケートと定めている（§11 #8）。
 * 一覧から対象アンケートと請求先（個人契約かグループ契約か）が分かることを見る。
 */

test.describe('請求管理は1行=1アンケート', () => {
  test('全行にアンケートのタイトルとIDが出る', async ({ page }) => {
    await openScreen(page, '/03_admin/billing-management.html');

    const rows = await page.evaluate(() => {
      const list = document.getElementById('billingList');
      return [...list.children].slice(1)
        .filter((r) => r.hasAttribute('data-pg'))
        .map((r) => {
          const cell = r.children[0];
          return {
            text: (cell.textContent || '').replace(/\s+/g, ' ').trim(),
            sid: (cell.textContent.match(/SV-\d+/) || [null])[0],
            link: !!cell.querySelector('a, [onclick]'),
          };
        });
    });

    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.sid, `アンケートIDが無い行がある: ${r.text}`).not.toBeNull();
      // ID だけでなくタイトルも要る（ID を除いた残りが空でないこと）
      expect(r.text.replace(r.sid, '').trim().length, `タイトルが空の行がある: ${r.text}`)
        .toBeGreaterThan(0);
    }
  });

  test('グループ契約は請求先にバッジを出し、個人契約には出さない', async ({ page }) => {
    await openScreen(page, '/03_admin/billing-management.html');

    const rows = await page.evaluate(() => {
      const list = document.getElementById('billingList');
      return [...list.children].slice(1)
        .filter((r) => r.hasAttribute('data-pg'))
        .map((r) => ({
          payer: (r.children[1].textContent || '').replace(/\s+/g, ' ').trim(),
          group: (r.children[1].textContent || '').includes('グループ'),
        }));
    });

    const groups = rows.filter((r) => r.group);
    expect(groups.length, 'グループ契約の行が1件も無い').toBeGreaterThan(0);
    expect(rows.length - groups.length, '個人契約の行が1件も無い').toBeGreaterThan(0);
    // どの行も請求先が空でない
    for (const r of rows) {
      expect(r.payer.length, '請求先が空の行がある').toBeGreaterThan(0);
    }
  });

  test('詳細を開くとタイトルと請求先が入っている', async ({ page }) => {
    await openScreen(page, '/03_admin/billing-management.html');

    await page.click('#billingList [data-pg] button:has-text("詳細")');
    await expect(page.locator('#mBillDetail')).toBeVisible();

    for (const slot of ['bdTitle', 'bdSid', 'bdName']) {
      const t = (await page.locator(`[data-slot="${slot}"]`).textContent() || '').trim();
      expect(t.length, `詳細の ${slot} が空`).toBeGreaterThan(0);
      expect(t, `詳細の ${slot} が未設定のまま`).not.toBe('—');
    }
    await page.keyboard.press('Escape');
    await expect(page.locator('#mBillDetail')).toBeHidden();
  });
});

test('会社名で絞り込める（§4.3）', async ({ page }) => {
  await openScreen(page, '/03_admin/billing-management.html');
  const visible = () => page.evaluate(() => [...document.getElementById('billingList').children]
    .slice(1).filter((r) => r.hasAttribute('data-pg') && getComputedStyle(r).display !== 'none').length);

  const before = await visible();
  await page.fill('[data-filter-for="billingList"] [data-f-key="company"]', 'テクノブレイン');
  await page.click('[data-filter-for="billingList"] button:has-text("検索")');
  const after = await visible();
  expect(after, '絞り込んでも件数が変わらない').toBeLessThan(before);
  expect(after).toBeGreaterThan(0);

  await page.click('[data-filter-for="billingList"] button:has-text("条件をクリア")');
  expect(await visible(), 'クリアで戻らない').toBe(before);
});

test('アンケートのIDとタイトルで絞り込める（§4.3）', async ({ page }) => {
  await openScreen(page, '/03_admin/billing-management.html');
  const visible = () => page.evaluate(() => [...document.getElementById('billingList').children]
    .slice(1).filter((r) => r.hasAttribute('data-pg') && getComputedStyle(r).display !== 'none').length);
  const field = '[data-filter-for="billingList"] [data-f-key="survey"]';
  await expect(page.locator(field), '一覧の主キーで探す欄が無い').toBeVisible();

  const before = await visible();
  // ID で
  await page.fill(field, 'SV-10188');
  await page.click('[data-filter-for="billingList"] button:has-text("検索")');
  expect(await visible(), 'アンケートIDで1件に絞れない').toBe(1);

  // タイトルの一部で
  await page.fill(field, 'SaaS Expo');
  await page.click('[data-filter-for="billingList"] button:has-text("検索")');
  expect(await visible(), 'タイトルで絞れない').toBe(1);

  await page.click('[data-filter-for="billingList"] button:has-text("条件をクリア")');
  expect(await visible(), 'クリアで戻らない').toBe(before);
});
