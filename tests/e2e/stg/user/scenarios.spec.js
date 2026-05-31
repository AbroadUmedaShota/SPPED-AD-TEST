const { e2eTest, test, expect } = require('../../fixtures');

/**
 * ユーザー側シナリオの通し実行（storageState=user）。
 * 1シナリオ=1テスト、各手順を test.step('STEP:<step_id>') で実行 → reporterが scenario_step_results に展開。
 * 副作用手順（保存/送信/削除等）は実行せず、操作部品の存在確認までで停止する。
 */
const SID = '225';

async function openDetail(page) {
  await page.goto('/dashboard');
  await page.getByText('ABC展示会来場者アンケート').first().click();
  await expect(page.getByRole('button', { name: 'モーダルを閉じる' })).toBeVisible();
}

e2eTest({ scenarioId: 'STG-SCN-001' }, 'STG-SCN-001 ログインからダッシュボード表示', async ({ page }) => {
  await test.step('STEP:STG-SCN-001-01', async () => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });
  await test.step('STEP:STG-SCN-001-02', async () => {
    await expect(page.getByRole('heading', { name: 'アンケート一覧' })).toBeVisible();
  });
  await test.step('STEP:STG-SCN-001-03', async () => {
    await page.getByText('ABC展示会来場者アンケート').first().click();
    await expect(page.getByRole('button', { name: 'モーダルを閉じる' })).toBeVisible();
    await page.getByRole('button', { name: 'モーダルを閉じる' }).click();
  });
  await test.step('STEP:STG-SCN-001-04', async () => {
    await page.getByRole('link', { name: 'ご請求内容一覧' }).click();
    await expect(page).toHaveURL(/invoices/);
    await page.goBack();
    await expect(page).toHaveURL(/dashboard/);
  });
  await test.step('STEP:STG-SCN-001-05', async () => {
    // コンソール致命エラーの有無は reporter/trace で担保。ここでは一覧再表示を確認。
    await expect(page.getByRole('heading', { name: 'アンケート一覧' })).toBeVisible();
  });
});

e2eTest({ scenarioId: 'STG-SCN-002' }, 'STG-SCN-002 アンケート詳細とQR/回答URL確認', async ({ page }) => {
  await test.step('STEP:STG-SCN-002-01', async () => {
    await openDetail(page);
  });
  await test.step('STEP:STG-SCN-002-02', async () => {
    await expect(page.getByText('アンケートアクセス情報').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'QRコードをダウンロード' })).toBeVisible();
  });
  await test.step('STEP:STG-SCN-002-03', async () => {
    // 回答URL欄の表示確認（コピー操作の起点）。開いているモーダル内の可視要素に限定。
    await expect(page.locator('label:has-text("アンケートURL"):visible').first()).toBeVisible();
  });
});

e2eTest({ scenarioId: 'STG-SCN-017' }, 'STG-SCN-017 SPEEDレビューの集計・絞り込み', async ({ page }) => {
  await test.step('STEP:STG-SCN-017-01', async () => {
    await page.goto(`/survey/${SID}/speed-review`);
    await expect(page.getByText('回答総数').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-017-02', async () => {
    await expect(page.getByText('集計データ').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-017-03', async () => {
    await expect(page.getByText('回答ID').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-017-04', async () => {
    await expect(page.getByText('簡易検索').first()).toBeVisible();
  });
});

e2eTest({ scenarioId: 'STG-SCN-020' }, 'STG-SCN-020 お礼メール期限切れ時の代替導線', async ({ page }) => {
  await test.step('STEP:STG-SCN-020-01', async () => {
    await page.goto(`/survey/${SID}/thank-you-email-settings`);
    await expect(page.getByText('送信期限が終了しています').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-020-02', async () => {
    await expect(page.getByText('送信対象者リスト').first()).toBeVisible();
  });
});

e2eTest({ scenarioId: 'STG-SCN-021' }, 'STG-SCN-021 詳細モーダル起点の設定画面横断', async ({ page }) => {
  await test.step('STEP:STG-SCN-021-01', async () => {
    await openDetail(page);
  });
  await test.step('STEP:STG-SCN-021-02', async () => {
    await page.getByRole('button', { name: '名刺データ化設定へ' }).click();
    await expect(page).toHaveURL(/bizcard-settings/);
  });
  await test.step('STEP:STG-SCN-021-03', async () => {
    await openDetail(page);
    await page.getByRole('button', { name: 'お礼メール設定へ' }).click();
    await expect(page).toHaveURL(/thank-you-email-settings/);
  });
});
