const { e2eTest, test, expect } = require('../../fixtures');

/**
 * 管理者側シナリオの通し実行（storageState=admin-lv4 / フル権限）。
 * 各手順を test.step('STEP:<step_id>') で実行。保存/削除/送信/確定は実行せず存在確認まで。
 */

e2eTest({ scenarioId: 'STG-SCN-009' }, 'STG-SCN-009 管理者ログインと主要画面巡回', async ({ page }) => {
  await test.step('STEP:STG-SCN-009-01', async () => {
    await page.goto('/admin/top');
    await expect(page).toHaveURL(/\/admin\/top/);
  });
  await test.step('STEP:STG-SCN-009-02', async () => {
    for (const name of ['ユーザー(利用者)管理', 'アンケート管理', '請求管理', 'オペレーター管理']) {
      await expect(page.getByRole('link', { name })).toBeVisible();
    }
  });
  await test.step('STEP:STG-SCN-009-03', async () => {
    await page.getByRole('link', { name: 'クーポン管理' }).click();
    await expect(page).toHaveURL(/\/admin\/coupon/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/top/);
  });
  await test.step('STEP:STG-SCN-009-04', async () => {
    await expect(page.locator('form[action*="logout"]')).toHaveCount(1);
  });
});

e2eTest({ scenarioId: 'STG-SCN-010' }, 'STG-SCN-010 管理者の利用者・アンケート・請求検索', async ({ page }) => {
  await test.step('STEP:STG-SCN-010-01', async () => {
    await page.goto('/admin/user');
    await expect(page.getByRole('heading', { name: 'ユーザー管理' })).toBeVisible();
    await expect(page.getByRole('button', { name: '検索' })).toBeVisible();
  });
  await test.step('STEP:STG-SCN-010-02', async () => {
    await page.goto('/admin/surveys');
    await expect(page.getByRole('heading', { name: 'アンケート管理' })).toBeVisible();
    await expect(page.locator('input[type=checkbox][name="statuses[]"]').first()).toBeAttached();
  });
  await test.step('STEP:STG-SCN-010-03', async () => {
    await page.goto('/admin/payment');
    await expect(page.getByRole('heading', { name: '請求管理' })).toBeVisible();
  });
  await test.step('STEP:STG-SCN-010-04', async () => {
    // 編集/削除/保存系は確定前で停止（存在確認のみ）
    await expect(page.getByRole('button', { name: '編集' }).first()).toBeVisible();
  });
});

e2eTest({ scenarioId: 'STG-SCN-011' }, 'STG-SCN-011 管理者のクーポン検索と実績確認', async ({ page }) => {
  await test.step('STEP:STG-SCN-011-01', async () => {
    await page.goto('/admin/coupon');
    await expect(page.getByRole('heading', { name: 'クーポン管理' })).toBeVisible();
  });
  await test.step('STEP:STG-SCN-011-02', async () => {
    await expect(page.getByRole('button', { name: '検索' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'リセット' })).toBeVisible();
  });
  await test.step('STEP:STG-SCN-011-03', async () => {
    await expect(page.getByText('クーポン新規作成').first()).toBeVisible();
    await expect(page.getByRole('button', { name: '利用履歴' }).first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-011-04', async () => {
    await page.goto('/admin/achievements');
    await expect(page.getByText('所属グループ別集計')).toBeVisible();
  });
});
