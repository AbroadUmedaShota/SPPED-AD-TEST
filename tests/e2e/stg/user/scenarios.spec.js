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

// STG-SCN-016（グループ新規作成）: 実機確認の結果、グループ作成を開く導線（ボタン）が現状UIに存在しない
// （#newGroupModal のマークアップは残存するが、それを開く要素がDOM上に無い）。BUG-USR-03として登録済み。
e2eTest.skip({ scenarioId: 'STG-SCN-016' }, 'STG-SCN-016 グループ新規作成（作成導線が現状UIに無い／BUG-USR-03）', async () => {});

e2eTest({ scenarioId: 'STG-SCN-003' }, 'STG-SCN-003 回答プレビューで完了表示まで（送信は直前停止）', async ({ page }) => {
  await test.step('STEP:STG-SCN-003-01', async () => {
    await page.goto(`/questionnaire_answer?id=${SID}`);
    await expect(page.getByText('名刺を撮影').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-003-02', async () => {
    await expect(page.getByRole('button', { name: /Q\.0/ }).first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-003-03', async () => {
    const ta = page.locator('textarea').first();
    if (await ta.count()) { await ta.fill('E2Eプレビュー確認の自由記述'); await expect(ta).toHaveValue('E2Eプレビュー確認の自由記述'); }
  });
  await test.step('STEP:STG-SCN-003-04', async () => {
    // 実送信はせず、送信導線の存在まで（プレビュー/完了は要許可）
    await expect(page.getByRole('button', { name: '送信する' })).toBeVisible();
  });
});

e2eTest({ scenarioId: 'STG-SCN-004' }, 'STG-SCN-004 回答本送信の事前確認（本送信は直前停止）', async ({ page }) => {
  await test.step('STEP:STG-SCN-004-01', async () => {
    await page.goto(`/questionnaire_answer?id=${SID}`);
    await expect(page.getByRole('button', { name: /Q\.0/ }).first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-004-02', async () => {
    await expect(page.getByRole('button', { name: '送信する' })).toBeVisible(); // 要許可: 送信前まで
  });
  await test.step('STEP:STG-SCN-004-03', async () => {
    // 本送信は実行しない（stgデータ更新の可能性のため要許可で停止）
    await expect(page.getByRole('button', { name: '送信する' })).toBeVisible();
  });
  await test.step('STEP:STG-SCN-004-04', async () => {
    await expect(page.getByText('名刺を撮影').first()).toBeVisible();
  });
});

e2eTest({ scenarioId: 'STG-SCN-005' }, 'STG-SCN-005 アンケート作成から編集画面確認（保存は直前停止）', async ({ page }) => {
  await test.step('STEP:STG-SCN-005-01', async () => {
    await page.goto(`/survey/${SID}`);
    await expect(page.getByText('アンケート作成・編集').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-005-02', async () => {
    await expect(page.getByText('基本情報').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-005-03', async () => {
    await expect(page.getByRole('button', { name: '設問を追加' }).first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-005-04', async () => {
    // 保存は実行しない（要許可で停止）
    await expect(page.getByRole('button', { name: 'アンケート保存' })).toBeVisible();
  });
});

e2eTest({ scenarioId: 'STG-SCN-006' }, 'STG-SCN-006 名刺データ化設定と見積表示（確定は直前停止）', async ({ page }) => {
  await test.step('STEP:STG-SCN-006-01', async () => {
    await page.goto(`/survey/${SID}/bizcard-settings`);
    await expect(page.getByText('名刺データ化設定').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-006-02', async () => {
    await expect(page.getByText('お試し').first()).toBeVisible();
    await expect(page.getByText('名刺データ化費用見積もり').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-006-03', async () => {
    await expect(page.getByText('設定を保存して依頼を確定する').first()).toBeVisible(); // 要許可: 確定しない
  });
});

e2eTest({ scenarioId: 'STG-SCN-007' }, 'STG-SCN-007 お礼メール設定の表示確認（保存/送信は直前停止）', async ({ page }) => {
  await test.step('STEP:STG-SCN-007-01', async () => {
    await page.goto(`/survey/${SID}/thank-you-email-settings`);
    await expect(page.getByText('お礼メール設定').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-007-02', async () => {
    await expect(page.getByText('送信対象者リスト').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-007-03', async () => {
    await expect(page.getByText('設定を保存する').first()).toBeVisible(); // 要許可: 保存/送信しない
  });
});

e2eTest({ scenarioId: 'STG-SCN-008' }, 'STG-SCN-008 請求一覧から請求詳細確認（当アカウントは請求0件）', async ({ page }) => {
  await test.step('STEP:STG-SCN-008-01', async () => {
    await page.goto('/invoices');
    await expect(page.getByText('請求書一覧').first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-008-02', async () => {
    // 請求0件のため詳細は未到達。空状態を確認（データ不足）
    await expect(page.getByText(/請求書がありません|全0件/).first()).toBeVisible();
  });
  await test.step('STEP:STG-SCN-008-03', async () => {
    await expect(page.getByText(/請求書がありません|全0件/).first()).toBeVisible(); // 印刷ビューもデータ不足で未到達
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
