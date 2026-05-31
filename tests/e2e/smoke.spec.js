const { test, expect } = require('@playwright/test');

/**
 * セットアップ検証用スモークテスト。
 *
 * Playwright とローカル配信 (scripts/dev-server.py) が正しく動くことを
 * 確認する最小限のテスト。本格的な導線テストは
 * 99_backend-docs/08_e2e-testing/02_target-flows.md の E2E-FLOW-01〜07 を
 * 順次このディレクトリに追加していく。
 */

test('トップページが表示される', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/SPEED AD/);
});

test('ダッシュボードページが配信される (E2E-FLOW-01 の入口)', async ({ page }) => {
  const response = await page.goto('/02_dashboard/index.html');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('body')).toBeVisible();
});
