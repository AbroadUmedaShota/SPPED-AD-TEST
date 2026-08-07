const { test, expect } = require('@playwright/test');
const { openScreen } = require('./_screens');

/**
 * アンケート詳細（SCR-A-005）の会期ゲート。
 *
 * 14_admin_survey_detail.md §2.1 の「通常編集と要注意操作の分離」が守られているかを見る。
 * 会期中の変更は §4.6 の確認（対象・範囲・理由）を必ず通し、監査ログに残す。
 * 会期終了後は変更させない。
 */

const SURVEYS = {
  会期前: 'SV-10262',
  会期中: 'SV-10259',
  会期終了後: 'SV-10250',
};

const open = (page, id) => openScreen(page, `/03_admin/survey-detail.html?id=${id}`);

/** §4.6 の確認画面を通す。範囲のチェックボックスと理由を入れて実行する */
async function passGate(page, { scope, reason }) {
  await expect(page.locator('#mDangerEdit')).toBeVisible();
  if (scope) { await page.check(scope); }
  await page.fill('#rEdit', reason);
  await page.click('#mDangerEdit button:has-text("編集を開始する")');
  await expect(page.locator('#mDangerEdit')).toBeHidden();
}

test.describe('設問構成の編集ゲート（§2.1・§4.6）', () => {
  test('会期前は通常編集。確認画面を挟まず、警告帯も理由欄も出さない', async ({ page }) => {
    await open(page, SURVEYS.会期前);
    expect(await page.locator('[data-slot="qEditBtn"]').textContent()).toBe('設問を編集');

    await page.click('[data-slot="qEditBtn"]');
    await expect(page.locator('#mQuestions'), '会期前なのに確認画面を挟んでいる').toBeVisible();
    expect(await page.locator('#qGate').isVisible(), '会期前なのに警告帯が出ている').toBe(false);
    expect(await page.locator('#qReasonWrap').isVisible(), '会期前なのに理由欄が出ている').toBe(false);
    expect(await page.locator('#qSave').textContent()).toBe('保存する');
  });

  test('会期中は先に確認画面を通す。理由を消すと保存させない', async ({ page }) => {
    await open(page, SURVEYS.会期中);
    expect(await page.locator('[data-slot="qEditBtn"]').textContent()).toBe('設問を編集(要注意操作)');

    // 押すと編集画面ではなく §4.6 の確認画面が開く
    await page.click('[data-slot="qEditBtn"]');
    expect(await page.locator('#mQuestions').isVisible(), '確認を通さずに編集画面が開いた').toBe(false);
    expect(await page.isChecked('#rEditQ'), '範囲が設問構成に絞られていない').toBe(true);

    await passGate(page, { reason: '主催者からの依頼により設問文を修正' });
    await expect(page.locator('#mQuestions')).toBeVisible();
    expect(await page.locator('#qGate').isVisible(), '会期中なのに警告帯が出ない').toBe(true);
    expect(await page.locator('#qSave').textContent()).toBe('要注意操作として保存する');
    expect(await page.inputValue('#qReason'), '確認画面で入れた理由が引き継がれない')
      .toBe('主催者からの依頼により設問文を修正');

    // 変更したうえで理由を消すと差し戻される。
    // 設問カードは見出し（role=button・aria-expanded）を押すと開く
    await page.locator('#qEdit [aria-expanded]').first().click();
    // 設問文の欄は type 属性を持たない input なので :not([type]) で拾う
    await page.locator('#qEdit input:not([type])').first().fill('テストで書き換えた設問文');
    await page.fill('#qReason', '');
    await page.click('#qSave');
    await expect(page.locator('#mQuestions'), '理由が空でも保存が通ってしまう').toBeVisible();
    expect(await page.locator('#qErr').textContent()).toMatch(/理由/);

    // 入れ直せば通り、監査ログに要注意操作として残る
    await page.fill('#qReason', '主催者からの依頼により設問文を修正');
    await page.click('#qSave');
    await expect(page.locator('#mQuestions')).toBeHidden();
    const log = await page.locator('#sdLog').textContent();
    expect(log).toMatch(/設問構成を変更/);
    expect(log, '監査ログに要注意操作の印が無い').toMatch(/要注意操作/);
  });

  test('会期終了後は編集させない', async ({ page }) => {
    await open(page, SURVEYS.会期終了後);
    expect(await page.locator('[data-slot="qEditBtn"]').isDisabled(), '会期終了後なのに編集できる').toBe(true);
    expect(await page.locator('[data-slot="qNote"]').textContent()).toMatch(/会期終了後/);
  });
});

test.describe('基本情報のロック（§4.6）', () => {
  /** 基本情報が触れない状態か。inert と保存ボタンの無効で判定する */
  const lockState = (page) => page.evaluate(() => {
    const f = document.querySelector('[data-slot="basicFields"]');
    const s = document.querySelector('[data-slot="saveBasic"]');
    return { inert: f.inert, pointer: getComputedStyle(f).pointerEvents, saveDisabled: s.disabled, saveLabel: s.textContent };
  });

  test('会期中はロックされ、確認を通した1回だけ編集できる', async ({ page }) => {
    await open(page, SURVEYS.会期中);

    const before = await lockState(page);
    expect(before.inert, '会期中なのに基本情報が触れる').toBe(true);
    expect(before.pointer).toBe('none');
    expect(before.saveDisabled, '会期中なのに保存できる').toBe(true);
    expect(await page.locator('[data-slot="basicGate"]').isVisible()).toBe(true);

    await page.click('[data-slot="basicGateBtn"]');
    await passGate(page, { scope: '#rEditBasic', reason: '主催者から会期前倒しの連絡' });

    const unlocked = await lockState(page);
    expect(unlocked.inert, '確認を通したのにロックが外れない').toBe(false);
    expect(unlocked.saveDisabled).toBe(false);
    expect(unlocked.saveLabel).toBe('要注意操作として保存');

    const title = page.locator('[data-slot="basicFields"] input').first();
    await title.fill('テストで書き換えたタイトル');
    await page.click('[data-slot="saveBasic"]');
    await expect(page.locator('#mConfirmSaveSurvey'), '保存の確認を挟んでいない').toBeVisible();
    await page.click('#mConfirmSaveSurvey button:has-text("保存する")');
    await expect(page.locator('#mConfirmSaveSurvey')).toBeHidden();

    // 1回の要注意操作で1回の保存。続けて直すならもう一度確認を通す
    expect((await lockState(page)).inert, '保存後もロックへ戻っていない').toBe(true);
    expect(await page.locator('#sdLog').textContent()).toMatch(/基本情報を変更/);
  });

  test('会期前はロックせず、そのまま編集できる', async ({ page }) => {
    await open(page, SURVEYS.会期前);
    const s = await lockState(page);
    expect(s.inert).toBe(false);
    expect(s.saveLabel).toBe('変更を保存');
    expect(await page.locator('[data-slot="basicGate"]').isVisible()).toBe(false);
  });
});

test.describe('要注意操作の4操作（§4.6・§7.2）', () => {
  test('会期中だけ出す操作と、常に出す操作を分ける', async ({ page }) => {
    await open(page, SURVEYS.会期中);
    for (const slot of ['exPublish', 'exStop', 'exDelete', 'exUpload']) {
      expect(await page.locator(`[data-slot="${slot}"]`).isVisible(), `${slot} が会期中に出ない`).toBe(true);
    }

    await open(page, SURVEYS.会期終了後);
    // 公開後の変更と強制停止は会期中の操作なので、終了後は出さない
    expect(await page.locator('[data-slot="exPublish"]').isVisible()).toBe(false);
    expect(await page.locator('[data-slot="exStop"]').isVisible()).toBe(false);
    // 回答の削除と手動アップロードは会期に関係なく必要
    expect(await page.locator('[data-slot="exDelete"]').isVisible()).toBe(true);
    expect(await page.locator('[data-slot="exUpload"]').isVisible()).toBe(true);
  });

  test('4操作それぞれに理由を必須にした確認画面がある', async ({ page }) => {
    await open(page, SURVEYS.会期中);
    const cases = [
      ['exPublish', '#mDangerEdit', '#rEdit'],
      ['exUpload', '#mDangerUpload', '#rUp'],
      ['exDelete', '#mDangerDeleteAnswer', '#rDel'],
      ['exStop', '#mConfirmForceStop', '#rStop'],
    ];
    for (const [slot, modal, reason] of cases) {
      await page.click(`[data-slot="${slot}"] button`);
      await expect(page.locator(modal), `${slot} の確認画面が開かない`).toBeVisible();
      await expect(page.locator(reason), `${slot} に理由の入力欄が無い`).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator(modal)).toBeHidden();
    }
  });
});

test('お礼メールは通常は閲覧のみで、要注意操作を通すと編集できる（§4.5・§4.6）', async ({ page }) => {
  await open(page, SURVEYS.会期中);
  expect(await page.locator('[data-slot="thanksBtn"]').textContent()).toBe('お礼メール内容の確認');

  await page.click('[data-slot="thanksBtn"]');
  await expect(page.locator('#mThanksMail')).toBeVisible();
  expect(await page.locator('[data-slot="tmView"]').isVisible(), '通常は閲覧のはず').toBe(true);
  expect(await page.locator('[data-slot="tmEdit"]').isVisible(), '通常なのに編集欄が出ている').toBe(false);
  await page.keyboard.press('Escape');
  await expect(page.locator('#mThanksMail')).toBeHidden();

  // 公開後のアンケート変更でお礼メールを範囲に選ぶと編集できるようになる
  await page.click('[data-slot="exPublish"] button');
  await passGate(page, { scope: '#rEditMail', reason: '文面の誤りを主催者から指摘されたため' });
  expect(await page.locator('[data-slot="thanksBtn"]').textContent()).toBe('お礼メール内容を編集(要注意操作)');

  // 範囲に選んだ時点で編集画面が開く実装なので、閉じていたときだけ押す
  if (!(await page.locator('#mThanksMail').isVisible())) {
    await page.click('[data-slot="thanksBtn"]');
  }
  await expect(page.locator('#mThanksMail')).toBeVisible();
  expect(await page.locator('[data-slot="tmEdit"]').isVisible(), '要注意操作を通しても編集できない').toBe(true);

  // 閉じても入り直せる（1回きりで閉じ込められない）
  await page.keyboard.press('Escape');
  await page.click('[data-slot="thanksBtn"]');
  expect(await page.locator('[data-slot="tmEdit"]').isVisible(), '閉じたら編集に戻れない').toBe(true);
});
