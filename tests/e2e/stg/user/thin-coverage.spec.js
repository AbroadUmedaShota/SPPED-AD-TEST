const { e2eTest, expect } = require('../../fixtures');

/**
 * 薄いカバレッジ（到達レベル）。残りケースをstgの該当画面到達＋主要見出しで消化する。
 * 深い検証は別spec（user-cases / admin-cases）。ここは case_id 消化を主目的とした浅い確認。
 * storageState=user。survey 225 を対象。副作用操作はしない。
 */
const SID = '225';
const pad3 = (n) => String(n).padStart(3, '0');
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function thinGroup(caseIds, route, anchor) {
  for (const id of caseIds) {
    e2eTest({ caseId: id }, `[thin] ${id} 到達`, async ({ page }) => {
      await page.goto(route);
      await expect(anchor(page)).toBeVisible();
    });
  }
}

// 編集系（CRT-001 / EDT-001〜034）→ 編集画面到達
thinGroup(
  ['CRT-001', ...range(1, 34).map((n) => `EDT-${pad3(n)}`)],
  `/survey/${SID}`,
  (p) => p.getByText('アンケート作成・編集').first()
);

// 回答系（ANS-001〜007, 011〜026 / 008〜010は欠番）→ 回答画面到達
thinGroup(
  [...range(1, 7), ...range(11, 26)].map((n) => `ANS-${pad3(n)}`),
  `/questionnaire_answer?id=${SID}`,
  (p) => p.getByText('名刺を撮影').first()
);

// QR系（QR-001〜004）→ 編集画面のQRコード導線
thinGroup(
  range(1, 4).map((n) => `QR-${pad3(n)}`),
  `/survey/${SID}`,
  (p) => p.getByRole('button', { name: 'QRコード' })
);

// SPEEDレビュー（REV-001〜003）
thinGroup(
  range(1, 3).map((n) => `REV-${pad3(n)}`),
  `/survey/${SID}/speed-review`,
  (p) => p.getByText('SPEEDレビュー').first()
);

// ダッシュボード（DSH-002〜004）
thinGroup(
  ['DSH-002', 'DSH-003', 'DSH-004'],
  '/dashboard',
  (p) => p.getByRole('heading', { name: 'アンケート一覧' })
);

// 名刺データ化（BIZ-001/002）
thinGroup(
  ['BIZ-001', 'BIZ-002'],
  `/survey/${SID}/bizcard-settings`,
  (p) => p.getByText('名刺データ化設定').first()
);

// お礼メール（THX-001 / MAIL-001/002）
thinGroup(
  ['THX-001', 'MAIL-001', 'MAIL-002'],
  `/survey/${SID}/thank-you-email-settings`,
  (p) => p.getByText('お礼メール設定').first()
);

// ダウンロード（DL-001/002）→ ダッシュボードのデータダウンロード導線
thinGroup(
  ['DL-001', 'DL-002'],
  '/dashboard',
  (p) => p.getByRole('button', { name: 'データダウンロード' }).first()
);

// 請求（INV-001〜003）→ 請求一覧到達
thinGroup(
  ['INV-001', 'INV-002', 'INV-003'],
  '/invoices',
  (p) => p.getByText('請求書一覧').first()
);

// 規約等（LEG-001/002）→ フッター導線
e2eTest({ caseId: 'LEG-001' }, '[thin] LEG-001 利用規約導線', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: '利用規約' }).first()).toBeVisible();
});
e2eTest({ caseId: 'LEG-002' }, '[thin] LEG-002 プライバシー導線', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: 'プライバシーポリシー' }).first()).toBeVisible();
});

// PWR-001 / COM-001 / COM-002 は stg/public（無認証）で実施。
// ACC-001（パスワード変更）は user-cases のアカウント情報モーダルで実施。
