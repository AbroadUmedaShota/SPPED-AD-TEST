const { e2eTest, expect } = require('../../fixtures');

/**
 * stg 管理者画面 Phase0 スモーク（フル権限 Lv4 / storageState=admin-lv4）。閲覧のみ・副作用なし。
 */
e2eTest({ caseId: 'STG-ADM-00-01', scenarioId: 'STG-SCN-009', stepId: 'STG-SCN-009-02' },
  '管理者トップにフル主要メニューが表示される', async ({ page }) => {
    const res = await page.goto('/admin/top');
    expect(res?.ok()).toBeTruthy();
    for (const name of ['ユーザー(利用者)管理', 'アンケート管理', '請求管理', 'クーポン管理', 'オペレーター管理', 'オペレーター実績確認']) {
      await expect(page.getByRole('link', { name })).toBeVisible();
    }
  });
