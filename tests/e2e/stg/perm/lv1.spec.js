const { e2eTest, expect } = require('../../fixtures');

/**
 * Lv1（オペレーター / storageState=admin-lv1）の到達範囲検証。閲覧のみ・副作用なし。
 * 期待: 名刺入力のみ到達、他の管理画面はログインへリダイレクトされ遮断される。
 */
e2eTest({ caseId: 'STG-ADM-00-01', scenarioId: 'STG-SCN-029', stepId: 'STG-SCN-029-01' },
  'Lv1: 管理者トップは名刺入力のみ', async ({ page }) => {
    await page.goto('/admin/top');
    await expect(page.getByRole('link', { name: '名刺入力画面' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ユーザー(利用者)管理' })).toHaveCount(0);
  });

e2eTest({ caseId: 'STG-ADM-00-03', scenarioId: 'STG-SCN-029', stepId: 'STG-SCN-029-02' },
  'Lv1: 利用者管理は遮断される（/loginへ）', async ({ page }) => {
    await page.goto('/admin/user');
    await expect(page).toHaveURL(/\/login/);
  });

e2eTest({ caseId: 'STG-ADM-07-01', scenarioId: 'STG-SCN-029', stepId: 'STG-SCN-029-03' },
  'Lv1: 名刺入力一覧には到達できる', async ({ page }) => {
    await page.goto('/admin/data_input_list');
    await expect(page).toHaveURL(/data_input_list/);
  });
