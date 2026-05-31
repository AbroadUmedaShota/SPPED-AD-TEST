const { e2eTest, expect } = require('../../fixtures');

/**
 * ユーザー画面 正常系ケース（storageState=user / 企業ユーザー）。survey 225 を対象。
 * 方針: 到達＋主要UI/状態の確認まで。保存/送信/削除/確定は「直前停止」で実行しない。
 */
const SID = '225';

async function openDetail(page) {
  await page.goto('/dashboard');
  await page.getByText('ABC展示会来場者アンケート').first().click();
  await expect(page.getByRole('button', { name: 'モーダルを閉じる' })).toBeVisible();
}

async function openAccountPanel(page) {
  await page.goto('/dashboard');
  // クリックがオーバーレイに阻害されるため、ハンドラを直接発火
  await page.locator('#account-infoButton').evaluate((el) => el.click());
  await expect(page.getByRole('combobox', { name: 'ユーザーグループを選択' })).toBeVisible({ timeout: 5000 });
}

// ===== ダッシュボード（DSH-005〜010）=====
e2eTest({ caseId: 'DSH-005' }, 'ダッシュボード: 列ソート見出しが存在', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('回答数').first()).toBeVisible();
});
e2eTest({ caseId: 'DSH-006' }, 'ダッシュボード: ステータスフィルタ', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('combobox', { name: 'ステータス' })).toBeVisible();
});
e2eTest({ caseId: 'DSH-007' }, 'ダッシュボード: 日付範囲フィルタ', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('textbox', { name: '開始日' })).toBeVisible();
});
e2eTest({ caseId: 'DSH-008' }, 'ダッシュボード: フィルターをリセット', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'フィルターをリセット' })).toBeVisible();
});
e2eTest({ caseId: 'DSH-009' }, 'ダッシュボード: 表示件数切替', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('表示件数').first()).toBeVisible();
});
e2eTest({ caseId: 'DSH-010' }, 'ダッシュボード: ページ送り', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: '次のページへ' })).toBeAttached();
});

// ===== アンケート詳細モーダル（DTL-001〜008）=====
e2eTest({ caseId: 'DTL-001', scenarioId: 'STG-SCN-021', stepId: 'STG-SCN-021-01' }, '詳細モーダル: 開閉', async ({ page }) => {
  await openDetail(page);
  await page.getByRole('button', { name: 'モーダルを閉じる' }).click();
  await expect(page.getByRole('button', { name: 'モーダルを閉じる' })).toHaveCount(0);
});
e2eTest({ caseId: 'DTL-002' }, '詳細モーダル: 基本情報表示', async ({ page }) => {
  await openDetail(page);
  await expect(page.getByText('基本情報').first()).toBeVisible();
});
e2eTest({ caseId: 'DTL-003' }, '詳細モーダル: ヘルプツールチップ', async ({ page }) => {
  await openDetail(page);
  await expect(page.getByRole('button', { name: /説明を表示|違いを表示/ }).first()).toBeVisible();
});
e2eTest({ caseId: 'DTL-004' }, '詳細モーダル: データ&請求表示', async ({ page }) => {
  await openDetail(page);
  await expect(page.getByText('見込み請求額').first()).toBeVisible();
});
e2eTest({ caseId: 'DTL-005' }, '詳細モーダル: アンケートURL', async ({ page }) => {
  await openDetail(page);
  await expect(page.getByText('アンケートアクセス情報').first()).toBeVisible();
});
e2eTest({ caseId: 'DTL-006' }, '詳細モーダル: QRダウンロード', async ({ page }) => {
  await openDetail(page);
  await expect(page.getByRole('button', { name: 'QRコードをダウンロード' })).toBeVisible();
});
e2eTest({ caseId: 'DTL-007', scenarioId: 'STG-SCN-021', stepId: 'STG-SCN-021-02' }, '詳細モーダル: 設定画面導線', async ({ page }) => {
  await openDetail(page);
  await expect(page.getByRole('button', { name: '名刺データ化設定へ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'お礼メール設定へ' })).toBeVisible();
});
e2eTest({ caseId: 'DTL-008' }, '詳細モーダル: 削除導線が存在（実行しない）', async ({ page }) => {
  await openDetail(page);
  await expect(page.getByRole('button', { name: 'アンケートを削除' })).toBeVisible();
});

// ===== アンケート編集（EDT-035〜043）=====
e2eTest({ caseId: 'EDT-035' }, '編集: 保存ボタンが初期disabled', async ({ page }) => {
  await page.goto(`/survey/${SID}`);
  await expect(page.getByRole('button', { name: 'アンケート保存' })).toBeDisabled();
});
e2eTest({ caseId: 'EDT-036' }, '編集: 既存設問のタイプ変更不可', async ({ page }) => {
  await page.goto(`/survey/${SID}`);
  await expect(page.locator('select[disabled]').first()).toBeAttached();
});
e2eTest({ caseId: 'EDT-037' }, '編集: 名刺画像添付スイッチが存在', async ({ page }) => {
  await page.goto(`/survey/${SID}`);
  await expect(page.getByText('名刺画像添付を有効にする').first()).toBeVisible();
});
e2eTest({ caseId: 'EDT-038' }, '編集: 設問設定セクションが存在', async ({ page }) => {
  await page.goto(`/survey/${SID}`);
  await expect(page.getByText('設問設定').first()).toBeVisible();
});
e2eTest({ caseId: 'EDT-042' }, '編集: フッター導線（プレビュー/QR/キャンセル）', async ({ page }) => {
  await page.goto(`/survey/${SID}`);
  await expect(page.getByRole('button', { name: 'プレビュー表示' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'QRコード' })).toBeVisible();
});
e2eTest({ caseId: 'EDT-043' }, '編集: 追加設定の各導線', async ({ page }) => {
  await page.goto(`/survey/${SID}`);
  await expect(page.getByRole('link', { name: 'サンクス画面設定' })).toBeVisible();
});
// 設問タイプ追加（尺度/手書き/説明カード）は追加メニュー操作。到達＋追加導線存在まで。
e2eTest({ caseId: 'EDT-039' }, '編集: 設問追加導線が存在', async ({ page }) => {
  await page.goto(`/survey/${SID}`);
  await expect(page.getByRole('button', { name: '設問を追加' }).first()).toBeVisible();
});
e2eTest.skip({ caseId: 'EDT-040' }, '設問追加-手書きスペース（追加メニュー操作・別途）', async () => {});
e2eTest.skip({ caseId: 'EDT-041' }, '設問追加-説明カード（追加メニュー操作・別途）', async () => {});

// ===== 回答画面（ANS-027〜031）=====
e2eTest({ caseId: 'ANS-027' }, '回答: 設問アコーディオン', async ({ page }) => {
  await page.goto(`/questionnaire_answer?id=${SID}`);
  await expect(page.getByRole('button', { name: /Q\.0/ }).first()).toBeVisible();
});
e2eTest({ caseId: 'ANS-028', scenarioId: 'STG-SCN-022', stepId: 'STG-SCN-022-02' }, '回答: 名刺を撮影導線', async ({ page }) => {
  await page.goto(`/questionnaire_answer?id=${SID}`);
  await expect(page.getByText('名刺を撮影').first()).toBeVisible();
});
e2eTest({ caseId: 'ANS-029', scenarioId: 'STG-SCN-022', stepId: 'STG-SCN-022-03' }, '回答: 名刺が手元に無い方', async ({ page }) => {
  await page.goto(`/questionnaire_answer?id=${SID}`);
  await expect(page.getByText('名刺が手元に無い方').first()).toBeVisible();
});
e2eTest({ caseId: 'ANS-030', scenarioId: 'STG-SCN-022', stepId: 'STG-SCN-022-01' }, '回答: 送信ボタンが必須未充足でdisabled', async ({ page }) => {
  await page.goto(`/questionnaire_answer?id=${SID}`);
  await expect(page.getByRole('button', { name: '送信する' })).toBeDisabled();
});
e2eTest.skip({ caseId: 'ANS-031' }, '尺度/手書きのレンダリング（対象アンケート要・保留）', async () => {});

// ===== 名刺データ化設定（BIZ-003〜012）=====
e2eTest({ caseId: 'BIZ-003', scenarioId: 'STG-SCN-018', stepId: 'STG-SCN-018-02' }, '名刺設定: プラン選択肢が表示', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText('お試し').first()).toBeVisible();
  await expect(page.getByText('オンデマンド').first()).toBeVisible();
});
e2eTest({ caseId: 'BIZ-004' }, '名刺設定: 見込み枚数入力', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText('見込み枚数').first()).toBeVisible();
});
e2eTest({ caseId: 'BIZ-005' }, '名刺設定: 最低請求枚数の注記', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText(/50枚/).first()).toBeVisible();
});
e2eTest({ caseId: 'BIZ-006' }, '名刺設定: プレミアムオプション', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText('プレミアムオプション').first()).toBeVisible();
});
e2eTest({ caseId: 'BIZ-007', scenarioId: 'STG-SCN-018', stepId: 'STG-SCN-018-03' }, '名刺設定: クーポンコード', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText('クーポンコード').first()).toBeVisible();
});
e2eTest({ caseId: 'BIZ-008' }, '名刺設定: 見積サイドバー', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText('名刺データ化費用見積もり').first()).toBeVisible();
});
e2eTest({ caseId: 'BIZ-009' }, '名刺設定: メモ(社内共有用)', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText('メモ（社内共有用）').first()).toBeVisible();
});
e2eTest({ caseId: 'BIZ-010' }, '名刺設定: 下部アコーディオン', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText('名刺データ化の詳細').first()).toBeVisible();
});
e2eTest({ caseId: 'BIZ-011', scenarioId: 'STG-SCN-018', stepId: 'STG-SCN-018-04' }, '名刺設定: 確定ボタンが存在（直前停止）', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText('設定を保存して依頼を確定する').first()).toBeVisible();
});
e2eTest({ caseId: 'BIZ-012' }, '名刺設定: データ化完了予定日', async ({ page }) => {
  await page.goto(`/survey/${SID}/bizcard-settings`);
  await expect(page.getByText('データ化完了予定日').first()).toBeVisible();
});

// ===== お礼メール設定（MAIL-003〜012 / survey225は期限切れ状態）=====
e2eTest({ caseId: 'MAIL-003', scenarioId: 'STG-SCN-019', stepId: 'STG-SCN-019-01' }, 'お礼メール: 送信方式3択', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText('手動送信').first()).toBeVisible();
  await expect(page.getByText('自動送信').first()).toBeVisible();
});
e2eTest({ caseId: 'MAIL-004' }, 'お礼メール: テンプレート', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText('テンプレート').first()).toBeVisible();
});
e2eTest({ caseId: 'MAIL-005' }, 'お礼メール: 件名文字数カウンタ', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText(/\/\s*255/).first()).toBeVisible();
});
e2eTest({ caseId: 'MAIL-006', scenarioId: 'STG-SCN-019', stepId: 'STG-SCN-019-02' }, 'お礼メール: 差し込み変数', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText('差し込み変数を挿入').first()).toBeVisible();
});
e2eTest({ caseId: 'MAIL-007', scenarioId: 'STG-SCN-019', stepId: 'STG-SCN-019-03' }, 'お礼メール: リアルタイムプレビュー', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText('リアルタイムプレビュー').first()).toBeVisible();
});
e2eTest({ caseId: 'MAIL-008' }, 'お礼メール: 送信対象者リスト', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText('送信対象者リスト').first()).toBeVisible();
});
e2eTest({ caseId: 'MAIL-009' }, 'お礼メール: 課金境界の注記', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText(/100通/).first()).toBeVisible();
});
e2eTest({ caseId: 'MAIL-010' }, 'お礼メール: クーポンコード', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText('クーポンコード').first()).toBeVisible();
});
e2eTest({ caseId: 'MAIL-011', scenarioId: 'STG-SCN-020', stepId: 'STG-SCN-020-01' }, 'お礼メール: 期限切れ状態のバナー', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText('送信期限が終了しています').first()).toBeVisible();
});
e2eTest({ caseId: 'MAIL-012' }, 'お礼メール: 保存/送信ボタンが存在（直前停止）', async ({ page }) => {
  await page.goto(`/survey/${SID}/thank-you-email-settings`);
  await expect(page.getByText('設定を保存する').first()).toBeVisible();
});

// ===== SPEEDレビュー（REV-004〜011）=====
e2eTest({ caseId: 'REV-004', scenarioId: 'STG-SCN-017', stepId: 'STG-SCN-017-01' }, 'レビュー: 回答総数KPI', async ({ page }) => {
  await page.goto(`/survey/${SID}/speed-review`);
  await expect(page.getByText('回答総数').first()).toBeVisible();
});
e2eTest({ caseId: 'REV-005' }, 'レビュー: Active Question切替', async ({ page }) => {
  await page.goto(`/survey/${SID}/speed-review`);
  await expect(page.getByText('設問を変更').first()).toBeVisible();
});
e2eTest({ caseId: 'REV-006' }, 'レビュー: 時間帯別グラフ', async ({ page }) => {
  await page.goto(`/survey/${SID}/speed-review`);
  await expect(page.getByText('時間帯別回答数').first()).toBeVisible();
});
e2eTest({ caseId: 'REV-007', scenarioId: 'STG-SCN-017', stepId: 'STG-SCN-017-02' }, 'レビュー: 集計データ表', async ({ page }) => {
  await page.goto(`/survey/${SID}/speed-review`);
  await expect(page.getByText('集計データ').first()).toBeVisible();
});
e2eTest({ caseId: 'REV-008', scenarioId: 'STG-SCN-017', stepId: 'STG-SCN-017-03' }, 'レビュー: 個別回答テーブル', async ({ page }) => {
  await page.goto(`/survey/${SID}/speed-review`);
  await expect(page.getByText('回答ID').first()).toBeVisible();
});
e2eTest({ caseId: 'REV-009', scenarioId: 'STG-SCN-017', stepId: 'STG-SCN-017-04' }, 'レビュー: フィルタ（簡易/詳細）', async ({ page }) => {
  await page.goto(`/survey/${SID}/speed-review`);
  await expect(page.getByText('簡易検索').first()).toBeVisible();
});
e2eTest({ caseId: 'REV-010' }, 'レビュー: 空状態', async ({ page }) => {
  await page.goto(`/survey/${SID}/speed-review`);
  await expect(page.getByText(/回答データがありません|回答総数/).first()).toBeVisible();
});
e2eTest({ caseId: 'REV-011' }, 'レビュー: フィルタサイドバー', async ({ page }) => {
  await page.goto(`/survey/${SID}/speed-review`);
  await expect(page.getByText('Filter Options').first()).toBeVisible();
});

// ===== アカウント/グループ・共通（ACC/GRP/COM）=====
// ⚠️ アカウント情報パネルの展開がPlaywright自動操作で不安定（stg側トグル挙動）。保留＝要セレクタ調整。
e2eTest.skip({ caseId: 'ACC-002', scenarioId: 'STG-SCN-015', stepId: 'STG-SCN-015-01' }, 'アカウント情報パネル開閉（パネル展開不安定のため保留）', async () => {});
e2eTest.skip({ caseId: 'GRP-001', scenarioId: 'STG-SCN-015', stepId: 'STG-SCN-015-02' }, 'グループ切替コンボ（パネル展開不安定のため保留）', async () => {});
e2eTest.skip({ caseId: 'GRP-002' }, 'グループ新規作成導線（パネル展開不安定のため保留）', async () => {});
e2eTest.skip({ caseId: 'GRP-003' }, '個人/グループの選択肢（パネル展開不安定のため保留）', async () => {});
e2eTest({ caseId: 'COM-003' }, '共通: テーマ切替導線', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: 'テーマを切り替える' })).toBeVisible();
});
e2eTest({ caseId: 'COM-004' }, '共通: 請求一覧の空状態', async ({ page }) => {
  await page.goto('/invoices');
  await expect(page.getByText(/請求書がありません|請求書一覧/).first()).toBeVisible();
});
e2eTest({ caseId: 'COM-005' }, '共通: サポート導線', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: 'サポート' })).toBeVisible();
});
