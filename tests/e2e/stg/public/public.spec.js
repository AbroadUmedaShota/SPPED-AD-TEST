const { e2eTest, expect } = require('../../fixtures');

/**
 * 未ログイン（storageStateなし）で確認する公開・共通ケース。
 */
e2eTest({ caseId: 'COM-001' }, '未認証で保護URLを開くとログインへリダイレクト', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

e2eTest({ caseId: 'PWR-001' }, 'パスワード再設定画面が表示される', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page).toHaveURL(/forgot-password/);
  await expect(page.getByRole('textbox', { name: 'メールアドレス' })).toBeVisible();
});

e2eTest({ caseId: 'COM-002' }, '公開ページでコンソール致命エラーが無い', async ({ page }) => {
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/login');
  await page.goto('/forgot-password');
  expect(errors, errors.join('\n')).toHaveLength(0);
});
