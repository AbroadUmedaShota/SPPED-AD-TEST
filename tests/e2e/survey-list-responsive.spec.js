// @ts-check
const { test, expect, webkit, devices } = require('@playwright/test');

/**
 * アンケート一覧（02_dashboard/index.html）のレスポンシブ表示の確認。
 * テスト名の A1〜D3 は受入基準の番号（A: 一覧、B: 1023px 以下のモーダル、C: タッチ操作の端末・パソコン・ほかの画面、D: 追加の確認）。
 *
 * - 操作は実際のタップ・クリック・入力だけで行う（DOM を書き換える回避策は使わない）。
 * - タッチ操作の端末は hasTouch + isMobile で再現し、操作は tap() で行う
 *   （click() はマウス操作として扱われ、(hover: none) and (pointer: coarse) の判定が外れるため）。
 */

test.setTimeout(60000);
test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const LIST_URL = '/02_dashboard/index.html';
const TOUCH_QUERY = '(hover: none) and (pointer: coarse)';
const SORT_LABELS = ['アンケートID', 'アンケート名', 'ステータス', '回答数', '展示会会期'];

/** @param {boolean} touch */
function makePress(touch) {
  /** @param {import('@playwright/test').Locator} locator */
  return (locator) => (touch ? locator.tap() : locator.click());
}

/** @param {import('@playwright/test').Page} page */
function collectErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/**
 * 一覧を開いて、行が出るまで待つ。
 * @param {import('@playwright/test').Page} page
 */
async function openList(page) {
  await page.goto(LIST_URL);
  await page.waitForFunction(() => document.querySelector('#user_select')?.options.length >= 4, null, { timeout: 30000 });
  // 取得前は「該当するアンケートが見つかりませんでした」の行が出るため、実データの行（data-id 付き）を待つ
  await expect(page.locator('#surveyTableBody tr[data-id]').first()).toBeVisible({ timeout: 30000 });
  await expect(page.locator('#loading-indicator')).toBeHidden();
}

/**
 * 画面の中央あたりを指で上へなぞって、下へスクロールする（タッチ操作の端末の実際の操作）。
 * @param {import('@playwright/test').Page} page
 * @param {number} distance なぞる距離（px）
 */
async function swipeUp(page, distance) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewport is not set');
  const x = Math.round(viewport.width / 2);
  const startY = Math.round(viewport.height * 0.6);
  const client = await page.context().newCDPSession(page);
  let remaining = distance;
  // 1 回でなぞれるのは画面の中だけなので、足りなければ繰り返す
  while (remaining > 0) {
    const stroke = Math.min(remaining, startY - 40);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: startY }] });
    for (let moved = 20; moved <= stroke; moved += 20) {
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: startY - moved }] });
      await page.waitForTimeout(16);
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(500);
    remaining -= stroke;
  }
  await client.detach();
}

/**
 * 一覧のステータスのバッジに色が付いていること。
 * バッジの色は Tailwind の CDN 版が画面を開いたあとに作る CSS で付く。行の描画と同じタイミングで
 * 別の class 名が増えると、色の指定が取りこぼされて付かなくなる（背景が透明のままになる）。
 * @param {import('@playwright/test').Page} page
 */
async function expectStatusBadgeColored(page) {
  const badge = page.locator('#surveyTableBody tr[data-id] td[data-label="ステータス"] span').first();
  await expect(badge).toBeVisible();
  await expect(badge).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
}

/** @param {import('@playwright/test').Page} page */
async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    // 画面全体の枠は overflow-x: hidden ではみ出しを切り取るので、枠の中のはみ出しも測る
    const frame = document.querySelector('body > div.relative');
    const wrapper = document.getElementById('surveyTableWrapper');
    const selectors = ['.survey-list-title-row', '#surveyListToolbar', '#surveyFilterPanel', '#surveySortMenu', '#surveyTableWrapper', '#surveyPagination'];
    const edges = selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return 0;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden') return 0;
      return Math.ceil(element.getBoundingClientRect().right) - root.clientWidth;
    });
    return {
      page: root.scrollWidth - root.clientWidth,
      frame: frame ? frame.scrollWidth - frame.clientWidth : 0,
      list: wrapper ? wrapper.scrollWidth - wrapper.clientWidth : 0,
      edge: Math.max(...edges),
    };
  });
  expect(overflow.page, 'ページの横スクロール').toBeLessThanOrEqual(0);
  expect(overflow.frame, '画面全体の枠の中のはみ出し').toBeLessThanOrEqual(0);
  expect(overflow.list, '一覧の横スクロール').toBeLessThanOrEqual(0);
  expect(overflow.edge, '主要な要素の右端が画面の幅を超えない').toBeLessThanOrEqual(0);
}

/**
 * モーダルが閉じていて、画面に何も残っていないこと。
 * 閉じたモーダルは DOM に残る場合がある（現行からの動き）ため、残っていても
 * 「非表示」「透明」「画面の外にあって影も無い」のいずれかであることを確かめる。
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} modal
 */
async function expectClosedAndUnseen(page, modal) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewport is not set');
  await expect(modal).not.toHaveAttribute('data-state', 'open');
  await expect.poll(() => modal.evaluateAll((elements, size) => elements.every((element) => {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.opacity === '0') return true;
    const box = element.getBoundingClientRect();
    const outside = box.right <= 0 || box.bottom <= 0 || box.left >= size.width || box.top >= size.height;
    return outside && style.boxShadow === 'none';
  }), viewport), '閉じたモーダルが画面に残らない').toBe(true);
}

/**
 * タイトルの行が、ヘッダーのすぐ下（本文の上の余白 32px）にあること。
 * ヘッダーの分の空きが二重に取られると、タイトルが 64px 以上余分に下がる。
 * @param {import('@playwright/test').Page} page
 */
async function expectTitleRightBelowHeader(page) {
  const headerBox = await page.locator('#header-placeholder header').boundingBox();
  const titleBox = await page.locator('.survey-list-title-row').boundingBox();
  if (!headerBox || !titleBox) throw new Error('ヘッダーまたはタイトルの行が見つかりません');
  expect(Math.round(titleBox.y - (headerBox.y + headerBox.height)), 'ヘッダーの下からタイトルの行までの空き').toBe(32);
}

/**
 * 要素が画面全体を覆っていること（せり上がり・切り替えの動きが終わるまで待つ）。
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} locator
 */
async function expectCoversViewport(page, locator) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewport is not set');
  await expect.poll(async () => {
    const box = await locator.boundingBox();
    if (!box) return 'no box';
    return [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)].join(',');
  }).toBe(`0,0,${viewport.width},${viewport.height}`);
}

/**
 * 絞り込みでアンケートを 1 件に絞ってから、その行を押して詳細を開く。
 * @param {import('@playwright/test').Page} page
 * @param {(locator: import('@playwright/test').Locator) => Promise<void>} press
 * @param {string} keyword
 */
async function openDetailByKeyword(page, press, keyword) {
  await press(page.locator('#toggleSurveyFilterBtn'));
  await page.locator('#searchKeyword').fill(keyword);
  const rows = page.locator('#surveyTableBody tr');
  await expect(rows).toHaveCount(1);
  await press(page.locator('#toggleSurveyFilterBtn'));
  await expect(page.locator('#surveyFilterPanel')).not.toHaveAttribute('data-open', 'true');
  await press(rows.first().locator('td[data-label="アンケート名"]'));
  await expect(page.locator('#surveyDetailsModal')).toHaveAttribute('data-state', 'open');
}

const NARROW_VIEWPORTS = [
  { name: 'スマートフォン 375×553', width: 375, height: 553, phone: true },
  { name: 'スマートフォン 390×844', width: 390, height: 844, phone: true },
  { name: 'タブレット 768×1024', width: 768, height: 1024, phone: false },
];

for (const vp of NARROW_VIEWPORTS) {
  test.describe(`1023px 以下・タッチ操作の端末（${vp.name}）`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: true });
    const press = makePress(true);

    test('A1-A3 一覧は 1 件 1 行で、上はツールバー 1 行だけ', async ({ page }) => {
      const errors = collectErrors(page);
      await openList(page);
      await expectNoHorizontalScroll(page);
      await expectTitleRightBelowHeader(page);
      await expectStatusBadgeColored(page);

      const firstRow = page.locator('#surveyTableBody tr').first();
      await expect(firstRow.locator('td[data-label="アンケート名"]')).toBeVisible();
      await expect(firstRow.locator('td[data-label="ステータス"]')).toBeVisible();
      await expect(firstRow.locator('td[data-label="アンケートID"]')).toBeHidden();
      await expect(firstRow.locator('td[data-label="回答数"]')).toBeHidden();
      await expect(firstRow.locator('td[data-label="掲載期間"]')).toBeHidden();
      await expect(firstRow.getByRole('button')).toHaveCount(0);
      await expect(page.locator('#surveyTable thead')).toBeHidden();
      await expect(page.locator('#surveyTable .help-trigger').first()).toBeHidden();

      // 一覧の上: 表示件数・絞り込み・並べ替え。絞り込みの枠は閉じている
      await expect(page.locator('#toggleSurveyFilterBtn')).toBeVisible();
      await expect(page.locator('#toggleSurveySortBtn')).toBeVisible();
      await expect(page.locator('#surveyFilterPanel')).toBeHidden();
      const perPageBox = await page.locator('#itemsPerPage').boundingBox();
      const tableBox = await page.locator('#surveyTableWrapper').boundingBox();
      expect(perPageBox && tableBox && perPageBox.y < tableBox.y, '表示件数が一覧の上にある').toBe(true);

      // ボタンの高さは 44px
      for (const id of ['#toggleSurveyFilterBtn', '#toggleSurveySortBtn', '#openNewSurveyModalBtn']) {
        const box = await page.locator(id).boundingBox();
        expect(Math.round(box ? box.height : 0), `${id} の高さ`).toBe(44);
      }
      expect(errors).toEqual([]);
    });

    test('A4 絞り込みはボタンの下に重なって開き、外側を押すと閉じるだけ', async ({ page }) => {
      await openList(page);
      await press(page.locator('#close-test-overlay'));
      const filterButton = page.locator('#toggleSurveyFilterBtn');
      const panel = page.locator('#surveyFilterPanel');
      const rows = page.locator('#surveyTableBody tr');
      const tableBefore = await page.locator('#surveyTableWrapper').boundingBox();

      await press(filterButton);
      await expect(panel).toBeVisible();
      await expect(filterButton).toHaveAttribute('aria-expanded', 'true');
      const tableAfter = await page.locator('#surveyTableWrapper').boundingBox();
      expect(tableAfter && tableBefore && Math.round(tableAfter.y), '一覧を押し下げない').toBe(Math.round(tableBefore ? tableBefore.y : -1));
      for (const id of ['#searchKeyword', '#filterStatus', '#filterStartDate', '#filterEndDate', '#resetFiltersButton']) {
        await expect(page.locator(id)).toBeVisible();
      }
      await expectNoHorizontalScroll(page);

      // 入力のたびに一覧が変わる
      const totalBefore = await rows.count();
      const pageInfoBefore = await page.locator('#pageInfo').innerText();
      await page.locator('#searchKeyword').fill('個人');
      // 入力から少し遅れて一覧が描き直されるので、件数の表示が変わるまで待つ
      await expect(page.locator('#pageInfo')).not.toHaveText(pageInfoBefore);
      await expect(page.locator('#loading-indicator')).toBeHidden();
      await expect(rows.first()).toContainText('個人');
      await expect(filterButton).toHaveAttribute('data-active', 'true');

      // 外側（枠に隠れていない行）を押す → 閉じるだけで、詳細は開かない
      const lastRow = rows.last();
      await lastRow.scrollIntoViewIfNeeded();
      await press(lastRow.locator('td[data-label="アンケート名"]'));
      await expect(panel).toBeHidden();
      await page.waitForTimeout(500);
      await expect(page.locator('#surveyDetailsModal')).toHaveCount(0);
      // 条件が入っている間は、閉じていても青
      await expect(filterButton).toHaveAttribute('data-active', 'true');

      // フィルターをリセットで戻る
      await filterButton.scrollIntoViewIfNeeded();
      await press(filterButton);
      await press(page.locator('#resetFiltersButton'));
      await expect(page.locator('#searchKeyword')).toHaveValue('');
      await expect(rows).toHaveCount(totalBefore);
      await press(filterButton);
      await expect(panel).toBeHidden();
      await expect(filterButton).not.toHaveAttribute('data-active', 'true');
    });

    test('A4 絞り込みは Esc でも閉じ、0 件の表示は横幅いっぱい', async ({ page }) => {
      await openList(page);
      await press(page.locator('#toggleSurveyFilterBtn'));
      await page.locator('#searchKeyword').fill('該当なしのキーワード_zzz');
      const empty = page.locator('#surveyTableBody td[colspan]');
      await expect(empty).toContainText('該当するアンケートが見つかりませんでした。');
      await page.keyboard.press('Escape');
      await expect(page.locator('#surveyFilterPanel')).toBeHidden();
      const emptyBox = await empty.boundingBox();
      const wrapperBox = await page.locator('#surveyTableWrapper').boundingBox();
      expect(emptyBox && wrapperBox && emptyBox.width >= wrapperBox.width - 44, '0 件表示の幅').toBe(true);
      await expect(page.locator('#pageInfo')).toHaveText('全 0件');
      await expectNoHorizontalScroll(page);
    });

    test('A5 並べ替えは 5 項目で、押すと並びが変わり、メニューは開いたまま', async ({ page }) => {
      await openList(page);
      const sortButton = page.locator('#toggleSurveySortBtn');
      const menu = page.locator('#surveySortMenu');
      const items = menu.locator('.survey-sort-menu__item');
      const firstName = () => page.locator('#surveyTableBody tr td[data-label="アンケート名"]').first().innerText();

      await press(sortButton);
      await expect(menu).toBeVisible();
      await expect(items.locator('span:first-child')).toHaveText(SORT_LABELS);
      await expect(menu.locator('.help-trigger')).toHaveCount(0);
      const menuBox = await menu.boundingBox();
      expect(Math.round(menuBox ? menuBox.width : 0), 'メニューの幅').toBe(264);

      // 初期の並びはアンケートIDの降順
      const idItem = items.nth(0);
      await expect(idItem).toHaveAttribute('aria-pressed', 'true');
      await expect(idItem.locator('.survey-sort-menu__icon')).toHaveText('arrow_downward');

      const nameItem = items.nth(1);
      // 列見出しと同じ動き: 1 回目は降順、もう一度押すと昇順
      await press(nameItem);
      await expect(nameItem).toHaveAttribute('aria-pressed', 'true');
      await expect(nameItem.locator('.survey-sort-menu__icon')).toHaveText('arrow_downward');
      await expect(page.locator('.sortable-header[data-sort-key="name"]')).toHaveAttribute('aria-sort', 'descending');
      await expect(idItem).toHaveAttribute('aria-pressed', 'false');
      const descending = await firstName();

      await press(nameItem);
      await expect(nameItem.locator('.survey-sort-menu__icon')).toHaveText('arrow_upward');
      await expect(page.locator('.sortable-header[data-sort-key="name"]')).toHaveAttribute('aria-sort', 'ascending');
      const ascending = await firstName();
      expect(descending).not.toBe(ascending);
      await expect(menu).toHaveAttribute('data-open', 'true');

      await press(sortButton);
      await expect(menu).toBeHidden();
    });

    test('A6 表示件数とページ送りが動く', async ({ page }) => {
      await openList(page);
      const pageInfo = page.locator('#pageInfo');
      const rows = page.locator('#surveyTableBody tr');
      const match = (await pageInfo.innerText()).match(/全 (\d+)件/);
      const total = Number(match ? match[1] : 0);
      expect(total).toBeGreaterThan(0);

      if (total > 10) {
        await expect(rows).toHaveCount(10);
        await press(page.locator('#pagination-numbers button', { hasText: /^2$/ }));
        await expect(pageInfo).toHaveText(new RegExp(`^11 - \\d+ / 全 ${total}件$`));
        await press(page.locator('#prevPageBtn'));
        await expect(pageInfo).toHaveText(new RegExp(`^1 - 10 / 全 ${total}件$`));
      }
      await page.locator('#itemsPerPage').selectOption('50');
      await expect(rows).toHaveCount(Math.min(total, 50));
      await expectNoHorizontalScroll(page);
    });

    test('B1-B3 詳細は下から出て画面全体を覆い、下のボタンだけが残る', async ({ page }) => {
      const errors = collectErrors(page);
      await openList(page);
      await press(page.locator('#close-test-overlay'));
      await press(page.locator('#surveyTableBody tr').first().locator('td[data-label="アンケート名"]'));
      const modal = page.locator('#surveyDetailsModal');
      await expect(modal).toHaveAttribute('data-state', 'open');
      await expectCoversViewport(page, modal);
      // 灰色（オーバーレイの色）が残らない
      expect(await modal.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');

      // C1 タッチ操作の端末では、削除・データダウンロード・閉じるを出さない
      expect(await page.evaluate((query) => matchMedia(query).matches, TOUCH_QUERY)).toBe(true);
      await expect(page.locator('#deleteSurveyBtn')).toBeHidden();
      await expect(page.locator('#detailDownloadBtn')).toBeHidden();
      await expect(page.locator('#footerCloseSurveyDetailsModalBtn')).toBeHidden();

      // 下のボタンは SPEEDレビュー・編集・複製・QRコード（編集は会期を問わず出る。会期前でないアンケートで確かめる）
      await expect(page.locator('#surveyDetailStatusBadge')).not.toHaveText('会期前');
      const footer = page.locator('#viewModeButtons');
      await expect(footer.locator('button:visible')).toHaveText(['編集', 'SPEEDレビュー', /複製/, 'QRコード']);
      await expect(page.locator('#detailAccessInfoSection')).toBeHidden();
      await expect(page.locator('#goToSpeedReviewBtn')).toHaveCSS('background-color', 'rgb(66, 133, 244)');

      // スクロールすると、アンケート名・ステータス・×は一緒に流れ、下のボタンだけが残る
      const closeButton = page.locator('#closeSurveyDetailsModalBtn');
      const speedButton = page.locator('#goToSpeedReviewBtn');
      const closeBefore = await closeButton.boundingBox();
      const nameBefore = await page.locator('#surveyDetailName').boundingBox();
      const speedBefore = await speedButton.boundingBox();
      await swipeUp(page, 700);
      const closeAfter = await closeButton.boundingBox();
      const nameAfter = await page.locator('#surveyDetailName').boundingBox();
      const speedAfter = await speedButton.boundingBox();
      if (!closeBefore || !closeAfter || !nameBefore || !nameAfter || !speedBefore || !speedAfter) throw new Error('詳細の要素が見つかりません');
      const scrolled = closeBefore.y - closeAfter.y;
      expect(scrolled, '×が中身と一緒に上へ流れる').toBeGreaterThan(40);
      expect(Math.round(nameBefore.y - nameAfter.y), 'アンケート名も同じだけ流れる').toBe(Math.round(scrolled));
      expect(Math.round(speedAfter.y), '下のボタンは動かない').toBe(Math.round(speedBefore.y));
      await expect(speedButton).toBeInViewport();
      await expect(page.locator('#detailQrCodeBtn')).toBeInViewport();
      // 最後まで送ると、お礼メール設定のボタンが下のボタンに隠れずに見える
      await swipeUp(page, 2000);
      const lastButton = await page.locator('#goToThankYouEmailSettingsBtn').boundingBox();
      if (!lastButton) throw new Error('お礼メール設定のボタンが見つかりません');
      expect(lastButton.y + lastButton.height, '最後の項目が下のボタンに隠れない').toBeLessThanOrEqual(speedAfter.y);

      // 一番上の×で閉じられる。閉じたモーダルは DOM から消える（現行と同じ）
      await page.locator('#closeSurveyDetailsModalBtn').scrollIntoViewIfNeeded();
      await press(page.locator('#closeSurveyDetailsModalBtn'));
      await expect(modal).toHaveCount(0);
      await expectNoHorizontalScroll(page);
      expect(errors).toEqual([]);
    });

    test('B1 一覧を下へ送ってから詳細を開いても、上端から表示され、閉じると同じ位置に戻る', async ({ page }) => {
      await openList(page);
      await press(page.locator('#close-test-overlay'));
      await page.locator('#itemsPerPage').selectOption('50');
      const rows = page.locator('#surveyTableBody tr[data-id]');
      await expect(rows.first()).toBeVisible();
      // 指でなぞって、ページを下へ送る
      await swipeUp(page, 240);
      const scrolledBefore = await page.evaluate(() => Math.round(window.scrollY));
      expect(scrolledBefore, '一覧が下へ送られている').toBeGreaterThan(0);
      // 画面の中に見えている行を選ぶ
      let target = rows.first();
      for (let index = 0; index < await rows.count(); index++) {
        const box = await rows.nth(index).boundingBox();
        if (box && box.y > 80 && box.y + box.height < vp.height - 20) {
          target = rows.nth(index);
          break;
        }
      }

      await press(target.locator('td[data-label="アンケート名"]'));
      const detail = page.locator('#surveyDetailsModal');
      await expect(detail).toHaveAttribute('data-state', 'open');
      await expectCoversViewport(page, detail);
      // 開いている間は背面のページを動かせない。スクロール位置は変わらない
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).toBe('hidden');
      expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(scrolledBefore);
      // ×は画面の上端にあり、押せる
      const closeButton = page.locator('#closeSurveyDetailsModalBtn');
      await expect(closeButton).toBeInViewport();
      const closeBox = await closeButton.boundingBox();
      expect(closeBox ? Math.round(closeBox.y) : -1, '×が画面の上端にある').toBeGreaterThanOrEqual(0);
      expect(closeBox ? Math.round(closeBox.y) : 999, '×が画面の上端にある').toBeLessThan(40);

      await press(closeButton);
      await expectClosedAndUnseen(page, detail);
      await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).overflowY)).not.toBe('hidden');
      expect(await page.evaluate(() => Math.round(window.scrollY)), '閉じたあとも一覧は同じ位置').toBe(scrolledBefore);
    });

    test('B3 サンプルの詳細では「編集」が出ない', async ({ page }) => {
      await openList(page);
      await press(page.locator('#close-test-overlay'));
      await openDetailByKeyword(page, press, 'SPEED ADアンケートサンプル');
      await expect(page.locator('#sampleReadOnlyNotice')).toContainText('標準機能確認用のサンプルです。');
      await expect(page.locator('#editSurveyBtn')).toBeHidden();
      await expect(page.locator('#viewModeButtons button:visible')).toHaveText(['SPEEDレビュー', /複製/, 'QRコード']);
    });

    test('B4 B6 QRコードと複製は同じ画面の中で切り替わり、「←」で詳細に戻る', async ({ page }) => {
      const errors = collectErrors(page);
      await openList(page);
      await press(page.locator('#close-test-overlay'));
      await press(page.locator('#surveyTableBody tr').first().locator('td[data-label="アンケート名"]'));
      const detail = page.locator('#surveyDetailsModal');
      await expect(detail).toHaveAttribute('data-state', 'open');

      // QRコード
      await press(page.locator('#detailQrCodeBtn'));
      const qr = page.locator('#qrCodeModal');
      await expect(qr).toHaveAttribute('data-state', 'open');
      await expectCoversViewport(page, qr);
      await expect(qr.getByRole('heading', { name: 'アンケートQRコード' })).toBeVisible();
      await expect(page.locator('#backQrCodeModalBtn')).toBeVisible();
      await expect(page.locator('#closeQrCodeModalBtn')).toBeHidden();
      await expect(page.locator('#footerCloseQrCodeModalBtn')).toBeHidden();
      await expect(page.locator('#surveyUrlInput')).toBeHidden();
      await expect(page.locator('#qrCodeImageHint')).toHaveText('QRコード画像は未設定です。URLは利用できます。');
      await expect(qr.locator('#downloadQrCodeBtn')).toBeVisible();
      await press(page.locator('#copyUrlBtn'));
      await expect(page.locator('#toastNotification')).toHaveText('URLがクリップボードにコピーされました！');
      await press(page.locator('#backQrCodeModalBtn'));
      await expect(qr).toHaveCount(0);
      await expect(detail).toHaveAttribute('data-state', 'open');

      // アンケートを複製
      await press(page.locator('#duplicateSurveyBtn'));
      const duplicate = page.locator('#duplicateSurveyModal');
      await expect(duplicate).toHaveAttribute('data-state', 'open');
      await expectCoversViewport(page, duplicate);
      await expect(page.locator('#backDuplicateSurveyModalBtn')).toBeVisible();
      await expect(page.locator('#closeDuplicateSurveyModalBtn')).toBeHidden();
      await expect(page.locator('#duplicateSurveyName')).toHaveValue(/ のコピー$/);
      await expect(page.locator('#duplicateSurveyPeriodRange')).toHaveValue('');
      // 回答期間の欄: カレンダーと「？」が欄の上下中央にそろって並ぶ（押せる範囲を広げても位置はずれない）
      const periodBox = await page.locator('#duplicateSurveyPeriodRange').boundingBox();
      const calendarBox = await duplicate.locator('.field-trailing-actions .field-action-button').boundingBox();
      const helpBox = await duplicate.locator('.field-trailing-actions .help-icon-button').boundingBox();
      if (!periodBox || !calendarBox || !helpBox) throw new Error('回答期間の欄が見つかりません');
      const centerY = (/** @type {{ y: number, height: number }} */ box) => box.y + box.height / 2;
      expect(Math.abs(centerY(helpBox) - centerY(calendarBox)), '「？」とカレンダーの上下のずれ').toBeLessThan(1);
      expect(Math.abs(centerY(helpBox) - centerY(periodBox)), '「？」と入力欄の上下のずれ').toBeLessThan(1);
      expect(Math.round(helpBox.x - (calendarBox.x + calendarBox.width)), 'カレンダーと「？」の間隔').toBe(4);
      await expect(page.locator('#cancelDuplicateSurveyModalBtn')).toBeInViewport();
      await expect(page.locator('#confirmDuplicateSurveyBtn')).toBeInViewport();

      // 入力チェックの文言は現行のまま
      await page.locator('#duplicateDisplayTitle').fill('複製の表示タイトル');
      await press(page.locator('#confirmDuplicateSurveyBtn'));
      await expect(page.locator('#duplicateSurveyPeriodRange-error')).toHaveText('回答期間を開始日と終了日で指定してください。');

      // 「←」で詳細に戻る
      await press(page.locator('#backDuplicateSurveyModalBtn'));
      await expectClosedAndUnseen(page, duplicate);
      await expect(detail).toHaveAttribute('data-state', 'open');

      // 「キャンセル」も同じく詳細に戻る（入力欄にフォーカスがあるまま押す）
      await press(page.locator('#duplicateSurveyBtn'));
      await expect(duplicate).toHaveAttribute('data-state', 'open');
      await press(page.locator('#duplicateSurveyName'));
      await press(page.locator('#cancelDuplicateSurveyModalBtn'));
      await expectClosedAndUnseen(page, duplicate);
      await expect(detail).toHaveAttribute('data-state', 'open');
      expect(errors).toEqual([]);
    });

    test('B6 複製すると複製の画面だけが閉じ、一覧の先頭に追加される', async ({ page }) => {
      await openList(page);
      await press(page.locator('#close-test-overlay'));
      const firstNameCell = page.locator('#surveyTableBody tr').first().locator('td[data-label="アンケート名"]');
      const sourceName = (await firstNameCell.innerText()).trim();
      await press(firstNameCell);
      await expect(page.locator('#surveyDetailsModal')).toHaveAttribute('data-state', 'open');
      await press(page.locator('#duplicateSurveyBtn'));
      const duplicate = page.locator('#duplicateSurveyModal');
      await expect(duplicate).toHaveAttribute('data-state', 'open');
      await page.locator('#duplicateDisplayTitle').fill('複製の表示タイトル');

      // 回答期間はカレンダーから開始日・終了日を選ぶ
      await press(page.locator('#duplicateSurveyPeriodRange'));
      const days = page.locator('.flatpickr-calendar.open .flatpickr-day:not(.flatpickr-disabled)');
      await press(days.nth(0));
      await press(days.nth(2));
      await expect(page.locator('#duplicateSurveyPeriodRange')).toHaveValue(/\d{4}-\d{2}-\d{2}.+\d{4}-\d{2}-\d{2}/);

      await press(page.locator('#confirmDuplicateSurveyBtn'));
      await expect(page.locator('#toastNotification')).toHaveText(`「${sourceName} のコピー」を複製しました。`);
      await expectClosedAndUnseen(page, duplicate);
      await expect(page.locator('#surveyDetailsModal')).toHaveAttribute('data-state', 'open');

      await press(page.locator('#closeSurveyDetailsModalBtn'));
      await expect(page.locator('#surveyDetailsModal')).toHaveCount(0);
      const newFirstRow = page.locator('#surveyTableBody tr').first();
      await expect(newFirstRow.locator('td[data-label="アンケート名"]')).toHaveText(`${sourceName} のコピー`);
      await expect(newFirstRow.locator('td[data-label="ステータス"]')).toHaveText('会期前');
    });

    test('B1 B5 新規作成・アカウント情報・グループ新規作成は全画面で、タイトルと下のボタンが固定', async ({ page }) => {
      const errors = collectErrors(page);
      await openList(page);
      await press(page.locator('#close-test-overlay'));

      // アンケート新規作成
      await press(page.locator('#openNewSurveyModalBtn'));
      const newSurvey = page.locator('#newSurveyModal');
      await expect(newSurvey).toHaveAttribute('data-state', 'open');
      await expectCoversViewport(page, newSurvey);
      await expect(page.locator('#closeNewSurveyModalBtn')).toBeInViewport();
      await expect(page.locator('#cancelNewSurveyModalBtn')).toBeInViewport();
      await expect(page.locator('#createSurveyFromModalBtn')).toBeInViewport();
      // 入力チェックの文言は現行のまま
      await expect(page.locator('#surveyName')).toHaveValue(/.+/);
      await page.locator('#surveyName').fill('');
      await press(page.locator('#createSurveyFromModalBtn'));
      await expect(page.locator('#surveyName-error')).toHaveText('アンケート名を入力してください。');
      await press(page.locator('#closeNewSurveyModalBtn'));
      await expectClosedAndUnseen(page, newSurvey);
      await expect(page.locator('#createSurveyFromModalBtn')).not.toBeInViewport();

      // アカウント情報
      await press(page.locator('header a[aria-label="現在のユーザー情報"]'));
      const account = page.locator('#accountInfoModal');
      await expect(account).toHaveAttribute('data-state', 'open');
      await expectCoversViewport(page, account);
      await page.locator('#buildingFloor').scrollIntoViewIfNeeded();
      await expect(page.locator('#closeAccountInfoModalBtn')).toBeInViewport();
      await expect(account.getByRole('heading', { name: 'アカウント情報' })).toBeInViewport();
      await expect(page.locator('#saveAccountInfoBtn')).toBeInViewport();
      await expect(page.locator('#userEmail')).not.toBeInViewport();
      const scrollWidths = await account.locator('form').evaluate((el) => [el.scrollWidth, el.clientWidth]);
      expect(scrollWidths[0], 'アカウント情報の横スクロール').toBeLessThanOrEqual(scrollWidths[1]);
      // 入力欄にフォーカスがあるまま×で閉じても、画面に何も残らない
      await press(page.locator('#buildingFloor'));
      await press(page.locator('#closeAccountInfoModalBtn'));
      await expectClosedAndUnseen(page, account);

      // グループ新規作成（メニューは現行どおり左から出る引き出し）
      await press(page.locator('#sidebarToggleMobile'));
      await expect(page.locator('#sidebar')).toHaveClass(/is-open-mobile/);
      await press(page.locator('#newGroupButton'));
      const group = page.locator('#newGroupModal');
      await expect(group).toHaveAttribute('data-state', 'open');
      await expectCoversViewport(page, group);
      await expect(page.locator('#closeNewGroupModalBtn')).toBeInViewport();
      await expect(page.locator('#cancelNewGroupModalBtn')).toBeInViewport();
      const emailBox = await page.locator('#memberEmail').boundingBox();
      const roleBox = await page.locator('#memberRole').boundingBox();
      const addBox = await page.locator('#addMemberBtn').boundingBox();
      if (!emailBox || !roleBox || !addBox) throw new Error('グループ新規作成の入力欄が見つかりません');
      if (vp.phone) {
        // メールアドレスを 1 行にし、役割と「追加」は次の行
        expect(roleBox.y, '役割はメールアドレスの下').toBeGreaterThan(emailBox.y + emailBox.height - 1);
        expect(Math.abs((addBox.y + addBox.height / 2) - (roleBox.y + roleBox.height / 2)), '役割と追加は同じ行').toBeLessThan(12);
      } else {
        expect(Math.abs((roleBox.y + roleBox.height / 2) - (emailBox.y + emailBox.height / 2)), '現行と同じ横一列').toBeLessThan(12);
      }
      expect(addBox.x + addBox.width, '「追加」が画面内に収まる').toBeLessThanOrEqual(vp.width);
      await press(page.locator('#closeNewGroupModalBtn'));
      await expectClosedAndUnseen(page, group);
      await expectNoHorizontalScroll(page);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('スマートフォンの実機に近い設定（390×844）', () => {
  const press = makePress(true);

  test.describe('端末標準の日付入力に切り替わる場合（スマートフォンのブラウザーとして開く）', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
    });

    test('A1 A4 絞り込みの日付欄が枠に収まり、リセットで表示も空に戻る', async ({ page }) => {
      await openList(page);
      await press(page.locator('#close-test-overlay'));
      const filterButton = page.locator('#toggleSurveyFilterBtn');
      const panel = page.locator('#surveyFilterPanel');
      await press(filterButton);
      await expect(panel).toBeVisible();

      // スマートフォンでは flatpickr が端末標準の日付入力を出す
      const startDate = page.locator('#startDatePickerWrapper .flatpickr-mobile');
      const endDate = page.locator('#endDatePickerWrapper .flatpickr-mobile');
      await expect(startDate).toBeVisible();
      await expect(endDate).toBeVisible();
      const panelBox = await panel.boundingBox();
      const endBox = await endDate.boundingBox();
      if (!panelBox || !endBox) throw new Error('絞り込みの枠が見つかりません');
      expect(endBox.x + endBox.width, '終了日が枠の右にはみ出さない').toBeLessThanOrEqual(panelBox.x + panelBox.width);
      await expectNoHorizontalScroll(page);

      const pageInfoBefore = await page.locator('#pageInfo').innerText();
      await startDate.fill('2026-03-01');
      await expect(page.locator('#pageInfo')).not.toHaveText(pageInfoBefore);
      await expect(page.locator('#filterStartDate')).toHaveValue('2026-03-01');
      await expect(filterButton).toHaveAttribute('data-active', 'true');

      await press(page.locator('#resetFiltersButton'));
      await expect(page.locator('#pageInfo')).toHaveText(pageInfoBefore);
      await expect(page.locator('#filterStartDate')).toHaveValue('');
      await expect(startDate).toHaveValue('');
      await press(filterButton);
      await expect(panel).toBeHidden();
      await expect(filterButton).not.toHaveAttribute('data-active', 'true');
    });
  });

  test.describe('「視差効果を減らす」を有効にした端末', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, contextOptions: { reducedMotion: 'reduce' } });

    test('メニューが一覧を覆わず、モーダルは動きなしで開閉できる', async ({ page }) => {
      await openList(page);
      await press(page.locator('#close-test-overlay'));
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      const sidebarBox = await page.locator('#sidebar').boundingBox();
      expect(sidebarBox ? sidebarBox.x + sidebarBox.width : 0, '開いていないメニューは画面の外').toBeLessThanOrEqual(0);

      await press(page.locator('#surveyTableBody tr').first().locator('td[data-label="アンケート名"]'));
      const detail = page.locator('#surveyDetailsModal');
      await expect(detail).toHaveAttribute('data-state', 'open');
      await expectCoversViewport(page, detail);
      await press(page.locator('#detailQrCodeBtn'));
      const qr = page.locator('#qrCodeModal');
      await expect(qr).toHaveAttribute('data-state', 'open');
      await expectCoversViewport(page, qr);
      await press(page.locator('#backQrCodeModalBtn'));
      await expectClosedAndUnseen(page, qr);
      await press(page.locator('#closeSurveyDetailsModalBtn'));
      await expectClosedAndUnseen(page, detail);

      // メニューは現行どおり左から出る
      await press(page.locator('#sidebarToggleMobile'));
      await expect(page.locator('#sidebar')).toHaveClass(/is-open-mobile/);
      await expect.poll(async () => {
        const box = await page.locator('#sidebar').boundingBox();
        return box ? Math.round(box.x) : -1;
      }).toBe(0);
    });
  });
});

test.describe('1023px 以下・タッチ操作でない端末（パソコンの狭いウィンドウ 390×844）', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  const press = makePress(false);

  test('C2 削除・データダウンロード・閉じるは出る。D1 ダウンロードオプションは全画面', async ({ page }) => {
    const errors = collectErrors(page);
    await openList(page);
    await press(page.locator('#close-test-overlay'));
    await press(page.locator('#surveyTableBody tr').first().locator('td[data-label="アンケート名"]'));
    const detail = page.locator('#surveyDetailsModal');
    await expect(detail).toHaveAttribute('data-state', 'open');
    await expectCoversViewport(page, detail);
    expect(await page.evaluate((query) => matchMedia(query).matches, TOUCH_QUERY)).toBe(false);
    await expect(page.locator('#deleteSurveyBtn')).toBeVisible();
    await expect(page.locator('#detailDownloadBtn')).toBeVisible();
    await expect(page.locator('#footerCloseSurveyDetailsModalBtn')).toBeVisible();
    await expect(page.locator('#detailQrCodeBtn')).toBeVisible();

    // ダウンロードオプション: 画面いっぱいに広がり、ボタンは区切り線の下で画面の下に残る
    await press(page.locator('#detailDownloadBtn'));
    const download = page.locator('#downloadOptionsModal');
    await expect(download).toHaveAttribute('data-state', 'open');
    const content = download.locator('> .modal-content-transition');
    await expect.poll(async () => {
      const box = await content.boundingBox();
      return box ? Math.round(box.width) : 0;
    }).toBe(390);
    await press(page.locator('label[for="period_custom"]'));
    await expect(page.locator('#download_start_date')).toBeVisible();
    await expect(page.locator('#cancelDownloadBtn')).toBeInViewport();
    await expect(page.locator('#downloadSubmitBtn')).toBeInViewport();
    const buttons = download.locator('form > div:last-child');
    await expect(buttons).toHaveCSS('border-top-width', '1px');
    await expect(buttons).toHaveCSS('position', 'sticky');
    const overflow = await download.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, 'ダウンロードオプションの横スクロール').toBeLessThanOrEqual(0);
    await press(page.locator('#cancelDownloadBtn'));
    await expectClosedAndUnseen(page, download);

    await press(page.locator('#footerCloseSurveyDetailsModalBtn'));
    await expectClosedAndUnseen(page, detail);
    expect(errors).toEqual([]);
  });
});

const WIDE_VIEWPORTS = [
  { name: '小さめのパソコン 1024×768', width: 1024, height: 768, small: true },
  { name: 'パソコン 1280×800', width: 1280, height: 800, small: false },
  { name: 'パソコン 1440×900', width: 1440, height: 900, small: false },
];

for (const vp of WIDE_VIEWPORTS) {
  test.describe(`1024px 以上（${vp.name}）`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });
    const press = makePress(false);

    test('A1 A7 6 列の表で横スクロールがなく、並べ替え・絞り込み・表示件数は現行の位置', async ({ page }) => {
      const errors = collectErrors(page);
      await openList(page);
      await expectNoHorizontalScroll(page);
      await expectTitleRightBelowHeader(page);
      await expectStatusBadgeColored(page);
      await expect(page.locator('#surveyTable thead th')).toHaveCount(6);
      await expect(page.locator('#surveyTable thead')).toBeVisible();
      await expect(page.locator('#toggleSurveyFilterBtn')).toBeHidden();
      await expect(page.locator('#toggleSurveySortBtn')).toBeHidden();
      await expect(page.locator('#surveySortMenu')).toBeHidden();
      await expect(page.locator('#surveyFilterPanel')).toBeVisible();
      await expect(page.locator('#searchKeyword')).toBeVisible();

      const firstRow = page.locator('#surveyTableBody tr').first();
      for (const name of ['アンケートを編集', 'QRコードを表示', 'SPEEDレビューを開く', 'データダウンロード']) {
        await expect(firstRow.getByRole('button', { name })).toBeVisible();
      }
      const perPageBox = await page.locator('#itemsPerPage').boundingBox();
      const tableBox = await page.locator('#surveyTableWrapper').boundingBox();
      expect(perPageBox && tableBox && perPageBox.y > tableBox.y + tableBox.height - 1, '表示件数が一覧の下にある').toBe(true);

      // 絞り込みの列数: 1280px 未満は 2 列、1280px 以上は 3 列
      const keywordBox = await page.locator('#searchKeyword').boundingBox();
      const startDateBox = await page.locator('#filterStartDate').boundingBox();
      if (!keywordBox || !startDateBox) throw new Error('絞り込みの入力欄が見つかりません');
      if (vp.small) {
        expect(startDateBox.y, '日付は 2 段目').toBeGreaterThan(keywordBox.y + keywordBox.height);
      } else {
        expect(Math.abs(startDateBox.y - keywordBox.y), '日付は 1 段目').toBeLessThan(12);
      }

      // 会期: 1280px 未満は開始日と終了日の間で 2 行、1280px 以上は 1 行
      const periodSpans = firstRow.locator('td[data-label="掲載期間"] span');
      const startBox = await periodSpans.nth(0).boundingBox();
      const endBox = await periodSpans.nth(1).boundingBox();
      if (!startBox || !endBox) throw new Error('会期のセルが見つかりません');
      if (vp.small) {
        expect(endBox.y, '会期は 2 行').toBeGreaterThan(startBox.y + startBox.height - 2);
      } else {
        expect(Math.abs(endBox.y - startBox.y), '会期は 1 行').toBeLessThan(2);
      }

      // 本文の左右の余白がそろっている（サイドバーの右の領域の中央）
      const inner = await page.locator('#main-content > div').boundingBox();
      if (!inner) throw new Error('本文が見つかりません');
      const leftGap = inner.x - 64;
      const rightGap = vp.width - (inner.x + inner.width);
      expect(Math.abs(leftGap - rightGap), '本文の左右の余白の差').toBeLessThan(2);

      // 列見出しを押して並べ替える（現行どおり）
      const idHeader = page.locator('.sortable-header[data-sort-key="id"]');
      await expect(idHeader).toHaveAttribute('aria-sort', 'descending');
      await press(page.locator('.sortable-header[data-sort-key="answerCount"]'));
      await expect(page.locator('.sortable-header[data-sort-key="answerCount"]')).toHaveAttribute('aria-sort', 'descending');
      await expectNoHorizontalScroll(page);
      expect(errors).toEqual([]);
    });

    test('C3 D1 QRコードは新しい案内文で URL 欄を押すとコピー、モーダルは画面内に収まる', async ({ page }) => {
      const errors = collectErrors(page);
      await openList(page);
      const firstRow = page.locator('#surveyTableBody tr').first();

      await press(firstRow.getByRole('button', { name: 'QRコードを表示' }));
      const qr = page.locator('#qrCodeModal');
      await expect(qr).toHaveAttribute('data-state', 'open');
      await expect(page.locator('#qrCodeImageHint')).toHaveText('QRコード画像は未設定です。URLは利用できます。');
      await expect(page.locator('#backQrCodeModalBtn')).toBeHidden();
      await expect(page.locator('#closeQrCodeModalBtn')).toBeVisible();
      await expect(page.locator('#footerCloseQrCodeModalBtn')).toBeVisible();
      const urlField = page.locator('#surveyUrlInput');
      await expect(urlField).toHaveCSS('text-overflow', 'ellipsis');
      await expect(urlField).toHaveCSS('overflow-x', 'hidden');
      await press(urlField);
      await expect(page.locator('#toastNotification')).toHaveText('URLがクリップボードにコピーされました！');
      expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^survey-answer\.html\?surveyId=sv_/);
      await press(page.locator('#footerCloseQrCodeModalBtn'));
      await expectClosedAndUnseen(page, qr);

      // アンケート詳細: 現行どおり中央に出る。下のボタンの上に区切り線、アクセス情報も出る
      await press(firstRow.locator('td[data-label="アンケート名"]'));
      const detail = page.locator('#surveyDetailsModal');
      await expect(detail).toHaveAttribute('data-state', 'open');
      const detailContent = detail.locator('> .modal-content-transition');
      await expect.poll(async () => {
        const box = await detailContent.boundingBox();
        return box ? box.y >= 0 && box.y + box.height <= vp.height && box.width < vp.width : false;
      }).toBe(true);
      await expect(page.locator('#viewModeButtons')).toHaveCSS('border-top-width', '1px');
      await expect(page.locator('#detailQrCodeBtn')).toBeHidden();
      await expect(page.locator('#deleteSurveyBtn')).toBeVisible();
      await expect(page.locator('#footerCloseSurveyDetailsModalBtn')).toBeVisible();
      await page.locator('#detailAccessInfoSection').scrollIntoViewIfNeeded();
      await expect(page.locator('#detailAccessInfoSection')).toBeVisible();

      // ダウンロードオプション: 高さを画面内に収め、ボタンの上に区切り線
      await press(page.locator('#detailDownloadBtn'));
      const download = page.locator('#downloadOptionsModal');
      await expect(download).toHaveAttribute('data-state', 'open');
      await press(page.locator('label[for="period_custom"]'));
      await expect(page.locator('#download_start_date')).toBeVisible();
      const downloadContent = download.locator('> .modal-content-transition');
      await expect.poll(async () => {
        const box = await downloadContent.boundingBox();
        return box ? box.y >= 0 && box.y + box.height <= vp.height : false;
      }).toBe(true);
      await expect(download.locator('form > div:last-child')).toHaveCSS('border-top-width', '1px');
      await expect(page.locator('#downloadSubmitBtn')).toBeInViewport();
      await press(page.locator('#cancelDownloadBtn'));
      await expectClosedAndUnseen(page, download);
      expect(errors).toEqual([]);
    });
  });
}

test.describe('1024px 以上・タッチ操作の端末（タブレットの横向き 1280×800）', () => {
  test.use({ viewport: { width: 1280, height: 800 }, hasTouch: true, isMobile: true });
  const press = makePress(true);

  test('C1 表のまま、データダウンロード・削除・閉じるを出さない', async ({ page }) => {
    await openList(page);
    expect(await page.evaluate((query) => matchMedia(query).matches, TOUCH_QUERY)).toBe(true);
    const firstRow = page.locator('#surveyTableBody tr').first();
    await expect(firstRow.getByRole('button', { name: 'QRコードを表示' })).toBeVisible();
    await expect(firstRow.getByRole('button', { name: 'データダウンロード' })).toBeHidden();

    await press(firstRow.locator('td[data-label="アンケート名"]'));
    await expect(page.locator('#surveyDetailsModal')).toHaveAttribute('data-state', 'open');
    await expect(page.locator('#goToSpeedReviewBtn')).toBeVisible();
    await expect(page.locator('#deleteSurveyBtn')).toBeHidden();
    await expect(page.locator('#detailDownloadBtn')).toBeHidden();
    await expect(page.locator('#footerCloseSurveyDetailsModalBtn')).toBeHidden();
    await press(page.locator('#closeSurveyDetailsModalBtn'));
    await expectClosedAndUnseen(page, page.locator('#surveyDetailsModal'));

    await press(firstRow.getByRole('button', { name: 'QRコードを表示' }));
    await expect(page.locator('#qrCodeModal')).toHaveAttribute('data-state', 'open');
    await expect(page.locator('#footerCloseQrCodeModalBtn')).toBeHidden();
    await expect(page.locator('#closeQrCodeModalBtn')).toBeVisible();
  });
});

test.describe('Safari 系のブラウザー（iPhone の設定）', () => {
  test('一覧と詳細のステータスのバッジに色が付く', async ({ baseURL }) => {
    // local プロジェクトは Chrome 系だけなので、ここだけ WebKit を直接起動する。
    // バッジの色の取りこぼしは WebKit で確実に再現するため（Chrome 系では端末の速さ次第）。
    let browser;
    try {
      browser = await webkit.launch();
    } catch (error) {
      test.skip(true, 'WebKit が入っていない環境では確かめられない（npx playwright install webkit）');
      return;
    }
    try {
      // ファイル先頭のクリップボードの許可は Chrome 系専用の指定なので、ここでは外す
      const context = await browser.newContext({ ...devices['iPhone 13'], baseURL, permissions: [] });
      const page = await context.newPage();
      await openList(page);
      await expectStatusBadgeColored(page);
      await expectNoHorizontalScroll(page);

      // 並べ替え・絞り込みを使ったあとも、色が付いたまま
      await page.locator('#toggleSurveySortBtn').tap();
      await page.locator('.survey-sort-menu__item[data-sort-key="name"]').tap();
      await page.locator('#toggleSurveySortBtn').tap();
      await expectStatusBadgeColored(page);

      await page.locator('#close-test-overlay').tap();
      await page.locator('#surveyTableBody tr').first().locator('td[data-label="アンケート名"]').tap();
      await expect(page.locator('#surveyDetailsModal')).toHaveAttribute('data-state', 'open');
      await expect(page.locator('#surveyDetailStatusBadge')).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    } finally {
      await browser.close();
    }
  });
});

test.describe('ほかの画面への波及がないこと', () => {
  test('C4 ご請求内容一覧（390px）: ヘッダーとモーダルにこの画面用の指定が効いていない', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await page.goto('/02_dashboard/invoiceList.html');
    const userLink = page.locator('header a[aria-label="現在のユーザー情報"]');
    await expect(userLink).toBeVisible();
    await expect(userLink).not.toHaveCSS('text-overflow', 'ellipsis');
    await userLink.click();
    const account = page.locator('#accountInfoModal');
    await expect(account).toHaveAttribute('data-state', 'open');
    // 現行どおり中央の枠（まわりにオーバーレイの色が残り、角丸がある）
    await expect(account).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(account.locator('> .modal-content-transition')).toHaveCSS('border-top-left-radius', '8px');
    await context.close();
  });

  test('D2 アンケート作成画面の QRコード: 案内文は新しい文、URL 欄を押しても何も起きない', async ({ page }) => {
    // パソコン側の「QR発行」（#openQrModalBtn）は現行で無効のため、1024px 未満の下部バーのボタンから開く
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/02_dashboard/surveyCreation.html?surveyId=sv_0001_26008');
    const openButton = page.locator('#openQrModalBtnMobile');
    await expect(openButton).toBeVisible({ timeout: 15000 });
    await openButton.click();
    const qr = page.locator('#qrCodeModal');
    await expect(qr).toHaveAttribute('data-state', 'open');
    // この画面では現行どおり中央の枠（全画面にも、右からの切り替えにもならない）
    await expect(qr).not.toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('#closeQrCodeModalBtn')).toBeVisible();
    await expect(page.locator('#footerCloseQrCodeModalBtn')).toBeVisible();
    await expect(page.locator('#qrCodeImageHint')).toHaveText('QRコード画像は未設定です。URLは利用できます。');
    await expect(page.locator('#backQrCodeModalBtn')).toBeHidden();
    await page.locator('#surveyUrlInput').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#toastNotification')).toHaveCount(0);
  });
});
