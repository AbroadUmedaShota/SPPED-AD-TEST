const { e2eTest, expect } = require('../../fixtures');

/**
 * stg ユーザー画面 Phase0 スモーク（企業ユーザー / storageState=user）。閲覧のみ・副作用なし。
 */
e2eTest({ caseId: 'LGN-001', scenarioId: 'STG-SCN-001', stepId: 'STG-SCN-001-01' },
  'ログイン済みでダッシュボードに到達できる', async ({ page }) => {
    const res = await page.goto('/dashboard');
    expect(res?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: 'アンケート一覧' })).toBeVisible();
  });

e2eTest({ caseId: 'DSH-001', scenarioId: 'STG-SCN-001', stepId: 'STG-SCN-001-02' },
  'アンケート一覧の主要UIが表示される', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('button', { name: /アンケート新規作成|新しいアンケートを作成/ })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'キーワードで検索' })).toBeVisible();
  });
