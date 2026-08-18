/**
 * ヘッダーの横断検索（2026-08-18）。
 *
 * IDの頭書き(U-/SV-/OP-/INV-/CP-)で行き先を判定して直行し、
 * ID以外は会社名としてユーザー管理の絞り込みへ渡す。
 * 行き先側の絞り込み適用は proto-ui の pApplyUrlFilter(既存)が受ける。
 */

const { test, expect } = require('@playwright/test');
const { openScreen } = require('./_screens');

async function search(page, text) {
  await page.fill('#globalSearch', text);
  await page.press('#globalSearch', 'Enter');
  await page.waitForLoadState('domcontentloaded');
}

test.describe('横断検索', () => {
  test('U-のIDはユーザー詳細へ直行する', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await search(page, 'U-1052');
    await expect(page).toHaveURL(/user-detail\.html\?id=U-1052/);
    await expect(page.locator('h1')).toHaveText('ユーザー詳細');
  });

  test('SV-のIDはアンケート詳細へ直行する（小文字でも通る）', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await search(page, 'sv-10259');
    await expect(page).toHaveURL(/survey-detail\.html\?id=SV-10259/);
  });

  test('OP-のIDはオペレーター管理を該当者だけに絞り込んで開く', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await search(page, 'OP-0034');
    await expect(page).toHaveURL(/operator-management\.html\?any=OP-0034/);
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#operatorsList [data-pg]:not([data-out])');
      return rows.length === 1;
    });
  });

  test('INV-のIDは請求書管理を該当の1通に絞り込んで開く', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await search(page, 'INV-2026-07-002');
    await expect(page).toHaveURL(/invoice-management\.html\?invoice=INV-2026-07-002/);
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#invoiceList [data-pg]:not([data-out])');
      return rows.length === 1;
    });
  });

  test('IDでない文字は会社名としてユーザー管理を絞り込む', async ({ page }) => {
    await openScreen(page, '/03_admin/index.html');
    await search(page, 'マーケットビジョン');
    await expect(page).toHaveURL(/user-management\.html\?company=/);
    await page.waitForFunction(() => {
      const rows = [...document.querySelectorAll('#usersList [data-pg]:not([data-out])')];
      return rows.length >= 1
        && rows.every((r) => (r.getAttribute('data-f-company') || '').includes('マーケットビジョン'));
    });
  });

  test('下層ページ(データ入力対象一覧)からでも正しい画面へ移動する', async ({ page }) => {
    await openScreen(page, '/03_admin/data-entry/index.html');
    await search(page, 'U-1052');
    await expect(page).toHaveURL(/03_admin\/user-detail\.html\?id=U-1052/);
  });

  test('Lv2では表示しない（行き先がLv3画面のため・2026-08-18確定）', async ({ page }) => {
    await page.addInitScript(() => {
      try { localStorage.setItem('adminMockLevel', 'lv2'); } catch (e) { /* 既定で進む */ }
    });
    await openScreen(page, '/03_admin/index.html');
    await page.waitForFunction(() => {
      const el = document.getElementById('globalSearch');
      return el && el.offsetParent === null;
    });
  });
});
