const { test, expect } = require('@playwright/test');
const { openScreen } = require('./_screens');

/**
 * ユーザー詳細（SCR-A-003）。
 *
 * 11_admin_user_management.md / 12_admin_user_detail.md の
 * §3.3（停止はこの画面の対象外）・§4.2（未保存の確認）・§4.6（招待の再送）を見る。
 */

const USERS = {
  有効: 'U-1002',
  招待中: 'U-1051',
  本登録未了: 'U-1050',
  停止: 'U-1038',
};

const open = (page, id) => openScreen(page, `/03_admin/user-detail.html?id=${id}`);

test.describe('アカウント状態ごとの出し分け（§4.6・§7.1）', () => {
  test('招待中は招待の帯を出し、パスワード操作を触らせない', async ({ page }) => {
    await open(page, USERS.招待中);
    expect(await page.locator('[data-slot="inviteBand"]').isVisible(), '招待の帯が出ない').toBe(true);
    expect(await page.locator('[data-slot="inviteText"]').textContent()).toMatch(/72/);
    // 招待中はパスワードがまだ存在しないので操作させない
    expect(await page.evaluate(() => document.querySelector('[data-slot="pwBox"]').inert)).toBe(true);
    // まだログインしていない
    expect(await page.locator('[data-slot="lastLogin"]').textContent()).toBe('—');
  });

  test('有効なアカウントでは招待の帯を出さず、パスワード操作は通常どおり', async ({ page }) => {
    await open(page, USERS.有効);
    expect(await page.locator('[data-slot="inviteBand"]').isVisible()).toBe(false);
    expect(await page.evaluate(() => document.querySelector('[data-slot="pwBox"]').inert)).toBe(false);
    expect(await page.locator('[data-slot="lastLogin"]').textContent()).not.toBe('—');
  });

  test('本登録未了もログイン前として扱う', async ({ page }) => {
    await open(page, USERS.本登録未了);
    expect(await page.locator('[data-slot="lastLogin"]').textContent()).toBe('—');
  });
});

test('招待は本登録より前の日時になる（時系列が逆転しない）', async ({ page }) => {
  await open(page, USERS.有効);

  const mails = await page.locator('[data-slot="mailBox"]').innerText();
  const invited = mails.match(/招待メール\s*([\d/]+\s[\d:]+)/);
  const registered = mails.match(/本登録完了メール\s*([\d/]+\s[\d:]+)/);
  expect(invited, '招待メールの日時が読めない').not.toBeNull();
  expect(registered, '本登録完了メールの日時が読めない').not.toBeNull();
  expect(
    new Date(invited[1]).getTime(),
    `招待(${invited[1]})が本登録(${registered[1]})より後になっている`,
  ).toBeLessThan(new Date(registered[1]).getTime());

  // 操作ログも同じ順序で並ぶ（新しいものが上）
  const log = await page.locator('#udLog').innerText();
  expect(log.indexOf('招待から本登録が完了'), '操作ログの並びが時系列と合わない')
    .toBeLessThan(log.indexOf('招待を実行'));
});

test('招待中は招待の再送とキャンセルができる（§4.6）', async ({ page }) => {
  await open(page, USERS.招待中);

  await page.click('button:has-text("招待を再送")');
  await expect(page.locator('#mResendInvite')).toBeVisible();
  expect(await page.locator('#mResendInvite').innerText()).toMatch(/72/);
  await page.click('#mResendInvite button:has-text("再送する")');
  await expect(page.locator('#mResendInvite')).toBeHidden();
  expect(await page.locator('#udLog').innerText(), '再送が操作ログに残らない').toMatch(/再送/);

  await page.click('button:has-text("招待をキャンセル")');
  await expect(page.locator('#mCancelInvite')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mCancelInvite')).toBeHidden();
});

test('アカウントの停止はこの画面に置かない（§3.3 で対象外）', async ({ page }) => {
  await open(page, USERS.有効);
  const html = await page.locator('#main-content').innerHTML();
  expect(html, '停止のモーダルが残っている').not.toContain('mConfirmStopUser');
  expect(await page.locator('button:has-text("アカウントを停止")').count(), '停止ボタンが残っている').toBe(0);
  // 代わりにどこで行うかを書いておく
  expect(await page.locator('#main-content').innerText()).toMatch(/停止.*ユーザー管理|ユーザー管理.*停止/s);
});

test('未保存のまま離れようとすると確認する（§4.2）', async ({ page }) => {
  await open(page, USERS.有効);

  // 変更していなければそのまま移動する
  await page.click('button:has-text("アンケート管理で絞り込む")');
  await page.waitForURL(/survey-management/);
  await page.goBack();
  await page.waitForFunction(() => typeof window.pLevel === 'function');

  // 変更していれば確認を挟む
  await page.locator('[data-slot="acctFields"] input').first().fill('テストで書き換えた会社名');
  await page.click('button:has-text("請求管理で絞り込む")');
  await expect(page.locator('#mLeaveUser'), '未保存なのに確認が出ない').toBeVisible();

  // 「編集に戻る」なら入力を保持したまま留まる
  await page.click('#mLeaveUser button:has-text("編集に戻る")');
  await expect(page.locator('#mLeaveUser')).toBeHidden();
  expect(await page.locator('[data-slot="acctFields"] input').first().inputValue())
    .toBe('テストで書き換えた会社名');
});

test('§4.1 の配置順で並ぶ', async ({ page }) => {
  await open(page, USERS.有効);
  // 見出しは入れ子（「紐づくアンケート」＋「全 1 件」）なので、
  // 末端要素ではなく表示テキスト上の出現位置で順序を見る
  const text = await page.locator('#main-content').innerText();
  const wanted = ['アカウント情報', 'パスワード操作', '紐づくアンケート', '請求状況', '操作ログ'];
  const at = wanted.map((w) => ({ w, i: text.indexOf(w) }));
  for (const { w, i } of at) {
    expect(i, `見出し「${w}」が見つからない`).toBeGreaterThanOrEqual(0);
  }
  const sorted = [...at].sort((a, b) => a.i - b.i).map((x) => x.w);
  expect(sorted, '§4.1 の順序と違う').toEqual(wanted);
});
