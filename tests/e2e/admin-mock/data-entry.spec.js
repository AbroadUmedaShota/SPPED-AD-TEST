const { test, expect } = require('@playwright/test');
const { openScreen } = require('./_screens');

/**
 * データ入力対象一覧（SCR-A-009）と名刺入力画面（SCR-A-010）。
 *
 * 19_admin_data_input_list.md §4.3・§4.4・§6 と
 * 20_admin_data_input_form.md §4.2・§4.4・§4.5・§4.6・§4.8 を見る。
 */

const LIST = '/03_admin/data-entry/index.html';
const FORM = '/03_admin/data-entry/form.html';

async function openAs(page, path, level) {
  await page.addInitScript((lv) => { localStorage.setItem('adminMockLevel', lv); }, level);
  return openScreen(page, path);
}

test.describe('データ入力対象一覧', () => {
  test('進捗が低い 2 グループを滞留として示す（§4.3）', async ({ page }) => {
    await openScreen(page, LIST);
    const stuck = await page.$$eval('#groupList .is-stuck', (els) => els.map((e) => Number(e.getAttribute('data-progress'))));
    expect(stuck.length).toBe(2);

    const all = await page.$$eval('#groupList .dg-row[data-progress]', (els) => els.map((e) => Number(e.getAttribute('data-progress'))).sort((a, b) => a - b));
    expect(stuck.sort((a, b) => a - b)).toEqual(all.slice(0, 2));
    expect(await page.locator('#groupList .is-stuck', { hasText: '滞留' }).count()).toBe(2);
  });

  test('全グループ入力への導線は Lv4 にだけ出す（§4.4・§6）', async ({ page }) => {
    await openAs(page, LIST, 'lv4');
    expect(await page.locator('button:has-text("全グループ入力画面へ")').isVisible()).toBe(true);

    await page.addInitScript(() => { localStorage.setItem('adminMockLevel', 'lv2'); });
    await openScreen(page, LIST);
    expect(await page.locator('button:has-text("全グループ入力画面へ")').isVisible()).toBe(false);
  });
});

test.describe('名刺入力画面', () => {
  test('スキップの理由からエスカレーションを外している（§4.5）', async ({ page }) => {
    await openScreen(page, `${FORM}?g=3`);
    await page.click('#btnSkip');
    const reasons = await page.$$eval('#mSkip label', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    expect(reasons.some((r) => r.includes('エスカレーション'))).toBe(false);
    expect(reasons.some((r) => r.startsWith('名刺ではない'))).toBe(true);
    expect(reasons.some((r) => r.startsWith('対応言語外'))).toBe(true);
  });

  test('裏面の画像が無い名刺では「裏面なし」と出す（§4.2）', async ({ page }) => {
    await openScreen(page, `${FORM}?g=3`);
    expect(await page.locator('#backNone').isVisible()).toBe(false);
    // サンプル 2 枚目は裏面を持たない
    await page.click('#btnConfirm');
    expect(await page.locator('#backNone').isVisible()).toBe(true);
  });

  test('郵便番号から住所候補を出し、押したときだけ入力する（§4.4）', async ({ page }) => {
    await openScreen(page, `${FORM}?g=4`);
    await page.fill('#g4_f1', '150-0001');
    await expect(page.locator('#zip_g4_f1')).toBeVisible();
    expect(await page.inputValue('#g4_f2'), '押していないのに住所が入っている').toBe('');

    await page.click('#zip_g4_f1 span[role="button"]');
    expect(await page.inputValue('#g4_f2')).toBe('東京都渋谷区神宮前');

    // 辞書に無い番号では候補を出さない
    await page.fill('#g4_f1', '999-9999');
    expect(await page.locator('#zip_g4_f1').isVisible()).toBe(false);
  });

  test('ロックが解除されると名刺を伏せ、確定・スキップを止める（§4.6）', async ({ page }) => {
    await openScreen(page, `${FORM}?g=3`);
    expect(await page.locator('#lockBadge').textContent()).toContain('作業ロック中');

    await page.evaluate(() => window.pWorkLock.expireNow());
    await expect(page.locator('.card-lock-mask').first()).toBeVisible({ timeout: 5000 });

    const sv = await page.locator('#svBadge').textContent();
    await page.click('#btnConfirm');
    expect(await page.locator('#svBadge').textContent(), 'ロック解除中に次の名刺へ進んだ').toBe(sv);
    expect(await page.locator('#p-toast').textContent()).toContain('ロックが解除されています');
  });

  test('全グループ入力は①〜⑧の全項目を並べる（§4.8）', async ({ page }) => {
    await openAs(page, `${FORM}?g=all`, 'lv4');
    expect(await page.locator('#groupBadge').textContent()).toContain('全グループ');
    // 20_admin_data_input_form.md §4.4 の項目表は合計 16 項目
    expect(await page.locator('#fieldsArea input, #fieldsArea textarea').count()).toBe(16);
  });

  test('全グループ入力は Lv3 以下では開けない（§6）', async ({ page }) => {
    await openAs(page, `${FORM}?g=all`, 'lv3');
    expect(await page.locator('#fieldsArea').count()).toBe(0);
    expect(await page.locator('#main-content').textContent()).toContain('Lv4 MasterAdmin');
  });
});
