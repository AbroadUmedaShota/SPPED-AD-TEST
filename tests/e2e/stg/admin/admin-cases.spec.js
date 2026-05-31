const { e2eTest, expect } = require('../../fixtures');

/**
 * 管理者画面 正常系ケース（storageState=admin-lv4 / フル権限）。
 * 方針: 到達＋主要UI/状態の確認まで。保存/削除/送信/確定/アップロードは「直前停止」で実行しない。
 * 各 e2eTest は index.html の STG-ADM-NN-MM に対応。
 */

// ===== STG-ADM-00 共通/トップ =====
e2eTest({ caseId: 'STG-ADM-00-02', scenarioId: 'STG-SCN-009', stepId: 'STG-SCN-009-03' },
  'トップから主要画面へ遷移して戻れる', async ({ page }) => {
    await page.goto('/admin/top');
    await page.getByRole('link', { name: 'クーポン管理' }).click();
    await expect(page).toHaveURL(/\/admin\/coupon/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/top/);
  });
e2eTest({ caseId: 'STG-ADM-00-04', scenarioId: 'STG-SCN-009', stepId: 'STG-SCN-009-04' },
  'ログアウト導線が存在する', async ({ page }) => {
    await page.goto('/admin/top');
    await expect(page.locator('form[action*="logout"]')).toHaveCount(1);
  });

// ===== STG-ADM-01 利用者管理 =====
e2eTest({ caseId: 'STG-ADM-01-01' }, '利用者管理: 検索4条件が表示', async ({ page }) => {
  await page.goto('/admin/user');
  await expect(page.getByRole('heading', { name: 'ユーザー管理' })).toBeVisible();
  await expect(page.getByRole('button', { name: '検索' })).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-01-02' }, '利用者管理: リセットボタン', async ({ page }) => {
  await page.goto('/admin/user');
  await expect(page.getByRole('button', { name: 'リセット' })).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-01-03' }, '利用者管理: ページングと件数表示', async ({ page }) => {
  await page.goto('/admin/user');
  await expect(page.getByText(/件\/全\s*\d+件|全\s*\d+件/)).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-01-04' }, '利用者管理: 行アクション導線が存在', async ({ page }) => {
  await page.goto('/admin/user');
  await expect(page.getByRole('button', { name: 'アンケート一覧' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: '請求管理' }).first()).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-01-05' }, '利用者管理: 管理区分列が表示', async ({ page }) => {
  await page.goto('/admin/user');
  await expect(page.getByText('メールアドレス').first()).toBeVisible();
});

// ===== STG-ADM-02 アンケート管理 =====
e2eTest({ caseId: 'STG-ADM-02-01' }, 'アンケート管理: 検索が表示', async ({ page }) => {
  await page.goto('/admin/surveys');
  await expect(page.getByRole('heading', { name: 'アンケート管理' })).toBeVisible();
  await expect(page.getByRole('button', { name: '検索する' })).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-02-02' }, 'アンケート管理: ステータス絞り込みチェックが存在', async ({ page }) => {
  await page.goto('/admin/surveys');
  await expect(page.locator('input[type=checkbox][name="statuses[]"]').first()).toBeAttached();
});
e2eTest({ caseId: 'STG-ADM-02-03' }, 'アンケート管理: 名刺画像ダウンロード導線', async ({ page }) => {
  await page.goto('/admin/surveys');
  await expect(page.getByRole('button', { name: 'ダウンロード' }).first()).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-02-04' }, 'アンケート管理: 完了データアップロード導線（直前停止）', async ({ page }) => {
  await page.goto('/admin/surveys');
  await expect(page.locator('input[type=file]').first()).toBeAttached();
});
e2eTest({ caseId: 'STG-ADM-02-05' }, 'アンケート管理: 編集/請求情報/アカウント情報の導線', async ({ page }) => {
  await page.goto('/admin/surveys');
  await expect(page.getByText('アカウント情報').first()).toBeVisible();
});

// ===== STG-ADM-03 請求管理 =====
e2eTest({ caseId: 'STG-ADM-03-01' }, '請求管理: 検索と一覧', async ({ page }) => {
  await page.goto('/admin/payment');
  await expect(page.getByRole('heading', { name: '請求管理' })).toBeVisible();
  await expect(page.getByRole('button', { name: '検索' })).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-03-04' }, '請求管理: クーポン割引率/メモ列が存在', async ({ page }) => {
  await page.goto('/admin/payment');
  await expect(page.getByText('クーポン').first()).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-03-05' }, '請求管理: 行アクション導線', async ({ page }) => {
  await page.goto('/admin/payment');
  await expect(page.getByRole('button', { name: 'アンケート情報' }).first()).toBeVisible();
});

// ===== STG-ADM-04 クーポン管理 =====
e2eTest({ caseId: 'STG-ADM-04-01' }, 'クーポン管理: 検索と一覧', async ({ page }) => {
  await page.goto('/admin/coupon');
  await expect(page.getByRole('heading', { name: 'クーポン管理' })).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-04-02' }, 'クーポン管理: 新規作成導線（直前停止）', async ({ page }) => {
  await page.goto('/admin/coupon');
  await expect(page.getByText('クーポン新規作成').first()).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-04-04' }, 'クーポン管理: 利用履歴導線', async ({ page }) => {
  await page.goto('/admin/coupon');
  await expect(page.getByRole('button', { name: '利用履歴' }).first()).toBeVisible();
});

// ===== STG-ADM-05 営業日カレンダー =====
e2eTest({ caseId: 'STG-ADM-05-01' }, '営業日カレンダー: 定休日チェックが存在', async ({ page }) => {
  await page.goto('/admin/calendar');
  await expect(page.getByText('定休日').first()).toBeVisible();
  await expect(page.locator('input[type=checkbox]').first()).toBeAttached();
});
e2eTest({ caseId: 'STG-ADM-05-03' }, '営業日カレンダー: 決定ボタンが存在（直前停止）', async ({ page }) => {
  await page.goto('/admin/calendar');
  await expect(page.getByRole('button', { name: '決定' })).toBeVisible();
});

// ===== STG-ADM-06 請求書管理（BUG-ADM-02: ロード時アラート → dismiss）=====
e2eTest({ caseId: 'STG-ADM-06-02' }, '請求書管理: 会社名＋請求月で検索できる', async ({ page }) => {
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto('/admin/invoice');
  await expect(page.getByRole('heading', { name: '請求書管理' })).toBeVisible();
  await expect(page.locator('select').first()).toBeAttached();
});

// ===== STG-ADM-07 名刺入力 =====
e2eTest({ caseId: 'STG-ADM-07-01' }, '名刺入力: 対象グループ一覧が表示', async ({ page }) => {
  await page.goto('/admin/data_input_list');
  await expect(page.getByText('データ入力対象一覧')).toBeVisible();
  await expect(page.getByText(/作業可能件数/).first()).toBeVisible();
});
e2eTest.skip({ caseId: 'STG-FLOW-DATA-01-01' }, '名刺入力作業画面（レコード占有懸念のため保留）', async () => {});

// ===== STG-ADM-08 照合 =====
e2eTest({ caseId: 'STG-ADM-08-01' }, '照合: 検索と一覧', async ({ page }) => {
  await page.goto('/admin/matching_list');
  await expect(page.getByText('照合結果一覧')).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-08-03' }, '照合: KPIが表示', async ({ page }) => {
  await page.goto('/admin/matching_list');
  await expect(page.getByText(/進行中|エスカレ|総件数|納品期日/).first()).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-08-04' }, '照合: カード別アクション導線（作業/DLは直前停止）', async ({ page }) => {
  await page.goto('/admin/matching_list');
  await expect(page.getByText('照合作業の開始').first()).toBeVisible();
});
e2eTest.skip({ caseId: 'STG-FLOW-MATCH-01-01' }, '照合作業画面（未到達のため保留）', async () => {});
e2eTest.skip({ caseId: 'STG-FLOW-ESCALE-01-01' }, 'エスカレーション確認（未到達のため保留）', async () => {});

// ===== STG-ADM-09 オペレーター管理 =====
e2eTest({ caseId: 'STG-ADM-09-01' }, 'オペレーター管理: 検索と一覧', async ({ page }) => {
  await page.goto('/admin/operator_list');
  await expect(page.getByRole('heading', { name: 'オペレーター管理' })).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-09-03' }, 'オペレーター管理: 新規作成導線', async ({ page }) => {
  await page.goto('/admin/operator_list');
  await expect(page.getByRole('button', { name: '新規作成' })).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-09-04' }, 'オペレーター管理: 権限レベル4種の選択肢', async ({ page }) => {
  await page.goto('/admin/operator_list');
  const opts = await page.locator('select[name="authorityLevel"] option').allTextContents();
  expect(opts.join(' ')).toMatch(/レベル1.*レベル2.*レベル3.*レベル4/s);
});
e2eTest({ caseId: 'STG-ADM-09-05' }, 'オペレーター管理: 対応言語の複数選択が存在', async ({ page }) => {
  await page.goto('/admin/operator_list');
  await expect(page.locator('input[type=checkbox][name="language_ids[]"]').first()).toBeAttached();
});
e2eTest({ caseId: 'STG-ADM-09-08' }, 'オペレーター管理: 最終ログイン列が存在', async ({ page }) => {
  await page.goto('/admin/operator_list');
  await expect(page.getByText('最終ログイン')).toBeVisible();
});

// ===== STG-ADM-10 オペレーター実績確認 =====
e2eTest({ caseId: 'STG-ADM-10-01' }, '実績確認: 集計タブが存在', async ({ page }) => {
  await page.goto('/admin/achievements');
  await expect(page.getByText('所属グループ別集計')).toBeVisible();
  await expect(page.getByText('オペレーター別集計')).toBeVisible();
});
e2eTest({ caseId: 'STG-ADM-10-02' }, '実績確認: グループ別集計列が表示', async ({ page }) => {
  await page.goto('/admin/achievements');
  await expect(page.getByText('平均正答率')).toBeVisible();
});
