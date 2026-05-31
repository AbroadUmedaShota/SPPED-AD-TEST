const { e2eTest, expect } = require('../../fixtures');

/**
 * Lv2（オペレーター管理者 / storageState=admin-lv2）の到達範囲・アクセス制御検証。閲覧のみ・副作用なし。
 * ⚠️ 現状の振る舞い（不備 BUG-ADM-04）をスナップショットする特性化テスト。
 * アクセス制御が修正されると下のアサートは失敗し、仕様確定・期待値更新を促す。
 */
e2eTest({ caseId: 'STG-ADM-PERM-02', scenarioId: 'STG-SCN-030', stepId: 'STG-SCN-030-01' },
  'Lv2: メニューは名刺入力＋実績確認の2項目', async ({ page }) => {
    await page.goto('/admin/top');
    await expect(page.getByRole('link', { name: '名刺入力画面' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'オペレーター実績確認' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ユーザー(利用者)管理' })).toHaveCount(0);
  });

e2eTest({ caseId: 'STG-ADM-01-01', scenarioId: 'STG-SCN-030', stepId: 'STG-SCN-030-02' },
  'Lv2: メニュー非表示の利用者管理に直URL到達できてしまう（BUG-ADM-04）', async ({ page }, testInfo) => {
    testInfo.annotations.push({ type: 'bug', description: 'BUG-ADM-04: Lv2でアクセス制御がサーバ側で強制されていない' });
    await page.goto('/admin/user');
    await expect(page).toHaveURL(/\/admin\/user/);
    await expect(page.getByRole('heading', { name: 'ユーザー管理' })).toBeVisible();
  });
