/**
 * 回答画面（02_dashboard/survey-answer.html）の手書き設問 UI 回帰テスト。
 *
 * 2026-08-18 のスマホ向け改修（ロック/描画の2状態モデル）で確定した仕様を固定する:
 *   - 既定はロック状態。オーバーレイ（touch-action: pan-y・リスナ無し）がスクロールを素通しし、
 *     「描画を開始」ボタンのタップだけが描画状態へ入る入口
 *   - 描画中のみ1段ツールバーを表示（320px 幅でも折り返さない）
 *   - 描画中にできる手書き設問は同時に1問のみ（他は自動ロック）
 *   - キャンバスが画面外へスクロールアウトしたら自動ロック（「完了」押し忘れ対策）
 *   - undo 履歴は上限 HW_HISTORY_LIMIT(20)。ドラフト復元画像は履歴の起点に積まれ、
 *     復元後に undo しても復元前の空キャンバスまで消えない
 *
 * データ経路は2系統:
 *   - 実データ: sv_0003_26010（Q10 が handwriting・ja/en の2言語）
 *   - プレビュー: localStorage.surveyPreviewData 注入 + ?preview=1（複数手書き設問の排他用）
 */

const { test, expect } = require('@playwright/test');

const REAL_URL = '/02_dashboard/survey-answer.html?surveyId=sv_0003_26010';
const HW = 'Q10'; // sv_0003_26010 の手書き設問 id

/** 手書き2問入りのプレビュー定義（排他検証用） */
const TWO_HW_PREVIEW = {
  displayTitle: '手書きUIテスト',
  description: '',
  details: [
    { id: 'HW1', text: '手書き1', type: 'handwriting' },
    { id: 'F1', text: '自由記述', type: 'free_text' },
    { id: 'HW2', text: '手書き2', type: 'handwriting' },
  ],
};

/** canvas 初期化（setTimeout(0)）完了まで待つ */
async function waitForCanvasReady(page, qid) {
  await page.waitForFunction((id) => {
    const canvas = document.getElementById(`${id}-canvas`);
    return !!canvas && canvas.width > 0;
  }, qid);
}

async function openRealSurvey(page) {
  await page.goto(REAL_URL);
  await waitForCanvasReady(page, HW);
}

async function openPreviewSurvey(page) {
  await page.addInitScript((data) => {
    localStorage.setItem('surveyPreviewData', JSON.stringify(data));
  }, TWO_HW_PREVIEW);
  await page.goto('/02_dashboard/survey-answer.html?preview=1');
  await waitForCanvasReady(page, 'HW1');
  await waitForCanvasReady(page, 'HW2');
}

/** 描画状態へ入る（「描画を開始」を実クリック）。
 *  先に canvas を画面内へ収めておく: sticky 状態のツールバーへ Playwright が
 *  自動スクロールすると canvas が画面外に出て自動ロック（仕様）が発動するため */
async function startDrawingMode(page, qid) {
  await page.locator(`#${qid}-canvas`).scrollIntoViewIfNeeded();
  await page.locator(`#${qid}-start-btn`).click();
  await expect(page.locator(`#${qid}-toolbar`)).toBeVisible();
  await page.locator(`#${qid}-canvas`).scrollIntoViewIfNeeded();
}

/** マウス実操作で1ストローク描く。offset で開始位置をずらす */
async function drawStroke(page, qid, offset = 0) {
  const box = await page.locator(`#${qid}-canvas`).boundingBox();
  const x = box.x + 30 + (offset % 5) * 25;
  const y = box.y + 30 + Math.floor(offset / 5) * 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 25, { steps: 4 });
  await page.mouse.up();
}

/** canvas の現在の見た目（比較用スナップショット） */
function canvasData(page, qid) {
  return page.evaluate((id) => document.getElementById(`${id}-canvas`).toDataURL(), qid);
}

test.describe('手書き設問: ロック/描画の2状態', () => {
  test('既定はロック状態（オーバーレイ表示・ツールバー非表示・スクロール素通しの構え）', async ({ page }) => {
    await openRealSurvey(page);

    await expect(page.locator(`#${HW}-overlay`)).toBeVisible();
    await expect(page.locator(`#${HW}-start-btn`)).toBeVisible();
    await expect(page.locator(`#${HW}-toolbar`)).toBeHidden();

    const styles = await page.evaluate((id) => ({
      overlayTouchAction: getComputedStyle(document.getElementById(`${id}-overlay`)).touchAction,
      canvasTouchAction: document.getElementById(`${id}-canvas`).style.touchAction,
    }), HW);
    expect(styles.overlayTouchAction).toBe('pan-y');
    expect(styles.canvasTouchAction).toBe('auto');
  });

  test('ロック中はオーバーレイ上のホイールでページがスクロールする', async ({ page }) => {
    await openRealSurvey(page);

    const box = await page.locator(`#${HW}-overlay`).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 400);
    await page.waitForFunction((y) => window.scrollY !== y, before);
  });

  test('「描画を開始」→描画中、「完了」→ロックへ戻り開始ボタンへフォーカス', async ({ page }) => {
    await openRealSurvey(page);
    await startDrawingMode(page, HW);

    await expect(page.locator(`#${HW}-overlay`)).toBeHidden();
    const touchAction = await page.evaluate((id) => document.getElementById(`${id}-canvas`).style.touchAction, HW);
    expect(touchAction).toBe('none');
    await expect(page.locator(`#${HW}-hw-status`)).toHaveText('描画中');

    await page.locator(`#${HW}-done-btn`).click();
    await expect(page.locator(`#${HW}-overlay`)).toBeVisible();
    await expect(page.locator(`#${HW}-toolbar`)).toBeHidden();
    const focusedId = await page.evaluate(() => document.activeElement?.id);
    expect(focusedId).toBe(`${HW}-start-btn`);
  });

  test('キャンバスが画面外へスクロールアウトしたら自動ロック', async ({ page }) => {
    await openRealSurvey(page);
    await startDrawingMode(page, HW);

    // Q10 はページ中腹。ページ先頭までホイールで戻すとキャンバスは画面外になる
    await page.mouse.move(200, 80);
    await page.mouse.wheel(0, -20000);
    await expect(page.locator(`#${HW}-overlay`)).toBeVisible();
    await expect(page.locator(`#${HW}-toolbar`)).toBeHidden();
  });
});

test.describe('手書き設問: 小画面レイアウト（iPhone SE 1st = 320px）', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('描画中ツールバーが1段に収まり、ページが横に溢れない', async ({ page }) => {
    await openRealSurvey(page);
    await startDrawingMode(page, HW);

    const layout = await page.evaluate((id) => {
      const toolbar = document.getElementById(`${id}-toolbar`);
      return {
        clientHeight: toolbar.clientHeight,
        scrollWidth: toolbar.scrollWidth,
        clientWidth: toolbar.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
      };
    }, HW);
    expect(layout.clientHeight).toBeLessThan(60); // 2段に折り返すと 80px を超える
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.pageScrollWidth).toBeLessThanOrEqual(321);
  });
});

test.describe('手書き設問: 複数設問の排他', () => {
  test('後から開始した設問だけが描画中になり、先行側は自動ロック', async ({ page }) => {
    await openPreviewSurvey(page);

    await startDrawingMode(page, 'HW1');
    await expect(page.locator('#HW1-overlay')).toBeHidden();

    await startDrawingMode(page, 'HW2');
    await expect(page.locator('#HW1-overlay')).toBeVisible();
    await expect(page.locator('#HW1-toolbar')).toBeHidden();
    await expect(page.locator('#HW2-overlay')).toBeHidden();
    await expect(page.locator('#HW2-toolbar')).toBeVisible();
  });
});

test.describe('手書き設問: 履歴・復元', () => {
  test('undo/redo でストローク単位に往復できる', async ({ page }) => {
    await openRealSurvey(page);
    await startDrawingMode(page, HW);

    await drawStroke(page, HW, 0);
    const snapA = await canvasData(page, HW);
    await drawStroke(page, HW, 1);
    const snapB = await canvasData(page, HW);
    expect(snapB).not.toBe(snapA);

    await page.locator(`#${HW}-undo-btn`).click();
    expect(await canvasData(page, HW)).toBe(snapA);
    await page.locator(`#${HW}-redo-btn`).click();
    expect(await canvasData(page, HW)).toBe(snapB);
  });

  test('undo 履歴は上限20で頭打ちになる（無制限に遡れない）', async ({ page }) => {
    test.setTimeout(120000);
    await openRealSurvey(page);
    await startDrawingMode(page, HW);

    for (let i = 0; i < 22; i++) {
      await drawStroke(page, HW, i);
    }
    let undoClicks = 0;
    const undoBtn = page.locator(`#${HW}-undo-btn`);
    while (!(await undoBtn.isDisabled()) && undoClicks < 30) {
      await undoBtn.click();
      undoClicks++;
    }
    expect(undoClicks).toBeGreaterThan(0);
    // 22 ストローク+初期状態が全部残っていれば 22 回戻れてしまう。上限20なら最大19回
    expect(undoClicks).toBeLessThan(22);
    await expect(undoBtn).toBeDisabled();
  });

  test('言語切替による再描画・復元の後に undo しても復元画像が消えない', async ({ page }) => {
    await openRealSurvey(page);
    const blank = await canvasData(page, HW);

    await startDrawingMode(page, HW);
    await drawStroke(page, HW, 0);
    expect(await canvasData(page, HW)).not.toBe(blank);

    // 言語切替 → renderSurvey() で canvas ごと再生成 → state.answers から復元される
    await page.locator('#language-select').selectOption('en');
    await waitForCanvasReady(page, HW);
    await page.waitForFunction((args) => {
      const canvas = document.getElementById(`${args.id}-canvas`);
      return canvas.toDataURL() !== args.blank;
    }, { id: HW, blank });
    const restored = await canvasData(page, HW);

    await startDrawingMode(page, HW);
    await drawStroke(page, HW, 3);
    await page.locator(`#${HW}-undo-btn`).click();

    // 復元画像が履歴の起点に積まれているので、undo で戻るのは「復元直後」まで
    expect(await canvasData(page, HW)).toBe(restored);
    expect(await canvasData(page, HW)).not.toBe(blank);
  });
});

test.describe('手書き設問: ポップオーバー', () => {
  test('色ボタンのカラーピッカーで選んだ色がチップに反映される', async ({ page }) => {
    await openRealSurvey(page);
    await startDrawingMode(page, HW);

    // ボタン自体が native の color input（タップで OS のピッカーが直接開く）
    const colorInput = page.locator(`#${HW}-custom-color`);
    await expect(colorInput).toBeVisible();
    await colorInput.fill('#dc2626');
    const chipColor = await page.evaluate((id) => document.getElementById(`${id}-color-chip`).style.backgroundColor, HW);
    expect(chipColor).toBe('rgb(220, 38, 38)');
  });

  test('太さポップオーバーの開閉・外側クリック・プリセット選択', async ({ page }) => {
    await openRealSurvey(page);
    await startDrawingMode(page, HW);

    const trigger = page.locator(`#${HW}-width-trigger`);
    const popover = page.locator(`#${HW}-width-popover`);

    await trigger.click();
    await expect(popover).toBeVisible();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // 外側クリックで閉じる（canvas 脇の余白を実クリック。ページ先頭の要素へ
    // 飛ばすと自動スクロールで canvas が画面外に出て自動ロックが発動してしまう）
    const canvasBox = await page.locator(`#${HW}-canvas`).boundingBox();
    await page.mouse.click(Math.max(canvasBox.x - 40, 5), canvasBox.y + 10);
    await expect(popover).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');

    // 再度開いてプリセットを選ぶと閉じて選択状態が変わる
    await trigger.click();
    await popover.locator('[data-width="10"]').click();
    await expect(popover).toBeHidden();
    await expect(page.locator(`#${HW}-width-popover [data-width="10"]`)).toHaveClass(/active/);
  });
});
