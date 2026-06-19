const { test, expect } = require('@playwright/test');

test.setTimeout(60000);

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(baseDate, days) {
  const date = new Date(baseDate);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

test.describe('新規アンケート初期値と共通サンプルアンケート', () => {
  test.describe.configure({ mode: 'serial' });

  test('新規作成モーダルの初期値だけで作成画面に進み、サンプル設問が入る', async ({ page }) => {
    const today = new Date();
    const expectedStart = formatDate(addDays(today, 1));
    const expectedEnd = formatDate(addDays(today, 7));

    await page.goto('/02_dashboard/index.html');
    await page.waitForFunction(() => typeof window.openNewSurveyModalWithSetup === 'function');
    await page.waitForFunction(() => document.querySelector('#user_select')?.options.length >= 4);
    await page.locator('#openNewSurveyModalBtn').click();
    const modal = page.locator('#newSurveyModal');

    await expect(modal).toBeVisible({ timeout: 15000 });
    await expect(modal.locator('#surveyName')).toHaveValue(/展示会サンプルアンケート_\d{8}/, { timeout: 15000 });
    await expect(modal.locator('#displayTitle')).toHaveValue('ご来場者アンケート');
    await expect(modal.locator('#newSurveyPeriodRange')).toHaveValue(new RegExp(`${expectedStart}.*${expectedEnd}`));

    await page.locator('#createSurveyFromModalBtn').click();
    await expect(page).toHaveURL(/\/02_dashboard\/surveyCreation\.html\?/);

    await expect(page.locator('#surveyName_ja')).toHaveValue(/展示会サンプルアンケート_\d{8}/);
    await expect(page.locator('#displayTitle_ja')).toHaveValue('ご来場者アンケート');
    await expect(page.locator('#periodRange')).toHaveValue(new RegExp(`${expectedStart}.*${expectedEnd}`));
    await expect(page.locator('#questionCountBadge')).toHaveText('4問');
    await expect(page.locator('[data-question-summary-text]')).toHaveText([
      'ご来場の目的を教えてください',
      '興味のあるサービスを選択してください',
      '導入予定時期を教えてください',
      'ご意見・ご要望をご記入ください'
    ]);
  });

  test('共通サンプルは各アカウントで表示され、編集不可の完了サンプルとして扱われる', async ({ page }) => {
    const sampleName = 'SPEED AD サンプルアンケート（標準機能確認用）';
    const groups = ['personal', 'group_sales', 'group_marketing', 'group_bpo'];

    await page.goto('/02_dashboard/index.html');
    await page.waitForFunction(() => document.querySelector('#user_select')?.options.length >= 4);

    for (const groupId of groups) {
      await page.evaluate((selectedGroupId) => {
        const select = document.querySelector('#user_select');
        select.value = selectedGroupId;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }, groupId);
      await page.locator('#searchKeyword').fill(sampleName);

      const sampleRow = page.locator('tbody tr', { hasText: sampleName });
      await expect(sampleRow).toHaveCount(1);
      await expect(sampleRow).toContainText('会期終了（データ化完了）');
      await expect(sampleRow).toContainText('10');
      await expect(sampleRow).toContainText('2026-06-01 ~ 2026-06-15');
      await expect(sampleRow.getByRole('button', { name: 'サンプルのため編集できません' })).toBeDisabled();
      await expect(sampleRow.getByRole('button', { name: 'QRコードを表示' })).toBeEnabled();
      await expect(sampleRow.getByRole('button', { name: 'SPEEDレビューを開く' })).toBeEnabled();
      await expect(sampleRow.getByRole('button', { name: 'データダウンロード' })).toBeEnabled();
    }
  });

  test('共通サンプルは通常一覧の最後に表示される', async ({ page }) => {
    const sampleName = 'SPEED AD サンプルアンケート（標準機能確認用）';

    await page.goto('/02_dashboard/index.html');
    await page.waitForFunction(() => document.querySelector('#user_select')?.options.length >= 4);
    await page.locator('#itemsPerPage').selectOption('50');

    const rows = page.locator('tbody tr');
    await expect(rows.last()).toContainText(sampleName);

    await page.locator('.sortable-header[data-sort-key="answerCount"]').click();
    await expect(rows.last()).toContainText(sampleName);
  });

  test('共通サンプルは複製して通常アンケートとして追加できる', async ({ page }) => {
    const sampleName = 'SPEED AD サンプルアンケート（標準機能確認用）';
    const copiedName = `${sampleName} のコピー`;
    const copyStart = formatDate(addDays(new Date(), 1));
    const copyEnd = formatDate(addDays(new Date(), 7));

    await page.goto('/02_dashboard/index.html');
    await page.waitForFunction(() => document.querySelector('#user_select')?.options.length >= 4);
    await page.evaluate(() => {
      const select = document.querySelector('#user_select');
      select.value = 'personal';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.locator('#searchKeyword').fill(sampleName);

    const sampleRow = page.locator('tbody tr', { hasText: sampleName });
    await expect(sampleRow).toHaveCount(1);
    await sampleRow.locator('td[data-label="アンケート名"]').click();

    const detailModal = page.locator('#surveyDetailsModal');
    await expect(detailModal).toBeVisible();
    await expect(detailModal.locator('#sampleReadOnlyNotice')).toContainText('複製して通常アンケートとして利用できます');
    await expect(detailModal.locator('#duplicateSurveyBtn')).toBeVisible();
    await detailModal.locator('#duplicateSurveyBtn').click();

    const duplicateModal = page.locator('#duplicateSurveyModal');
    await expect(duplicateModal).toBeVisible();
    await expect(duplicateModal.locator('#duplicateSurveyName')).toHaveValue(copiedName);
    await page.evaluate(({ start, end }) => {
      const input = document.querySelector('#duplicateSurveyPeriodRange');
      input.value = `${start} 〜 ${end}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, { start: copyStart, end: copyEnd });
    await duplicateModal.locator('#confirmDuplicateSurveyBtn').click();
    await expect(duplicateModal).toHaveAttribute('data-state', 'closed');
    await expect(duplicateModal).toHaveClass(/pointer-events-none/);

    await detailModal.locator('#footerCloseSurveyDetailsModalBtn').click();
    await expect(detailModal).toHaveAttribute('data-state', 'closed');
    await expect(detailModal).toHaveClass(/pointer-events-none/);
    await page.locator('#searchKeyword').fill(copiedName);

    const copiedRow = page.locator('tbody tr', { hasText: copiedName });
    await expect(copiedRow).toHaveCount(1);
    await expect(copiedRow).toContainText('会期前');
    await expect(copiedRow).toContainText(`${copyStart} ~ ${copyEnd}`);
    await expect(copiedRow.getByRole('button', { name: 'アンケートを編集' })).toBeEnabled();
  });

  test('共通サンプルのSPEEDレビューで10件の回答を読み込む', async ({ page }) => {
    const sampleAssetErrors = [];
    page.on('response', (response) => {
      const url = response.url();
      if (
        (url.includes('/media/generated/sv_0003_26010/') || url.includes('/data/responses/')) &&
        response.status() >= 400
      ) {
        sampleAssetErrors.push(`${response.status()} ${url}`);
      }
    });

    await page.goto('/02_dashboard/index.html');
    await page.evaluate(() => {
      localStorage.setItem('speedReview:sv_0003_26010:uiState', JSON.stringify({
        currentPage: 1,
        rowsPerPage: 25,
        currentSortKey: 'answeredAt',
        currentSortOrder: 'desc',
        currentStatusFilter: 'processing',
        currentIndustryQuestion: '展示会を知ったきっかけ (SA)',
        currentDateFilter: ['2026-01-31T15:00:00.000Z', '2026-02-28T14:59:59.999Z']
      }));
    });
    await page.goto('/02_dashboard/speed-review.html?surveyId=sv_0003_26010');

    await expect(page.locator('#review-survey-name')).toContainText('SPEED AD サンプルアンケート（標準機能確認用）');
    await expect(page.locator('#kpi-total-answers')).toHaveText('10件');
    await expect(page.locator('#pageInfo')).toContainText('全 10件');
    await expect(page.locator('#dayFilterSelect')).toHaveValue('all');
    await expect(page.locator('#statusFilterSelect')).toHaveValue('all');
    await page.locator('#statusFilterSelect').selectOption('completed');
    await expect(page.locator('#pageInfo')).toContainText('全 10件');
    await page.locator('#statusFilterSelect').selectOption('processing');
    await expect(page.locator('#pageInfo')).toContainText('全 0件');
    await page.locator('#statusFilterSelect').selectOption('all');
    await expect(page.locator('#pageInfo')).toContainText('全 10件');
    expect(sampleAssetErrors).toEqual([]);
  });

  test('共通サンプルのグラフ分析で10件の回答を集計できる', async ({ page }) => {
    await page.goto('/02_dashboard/graph-page.html?surveyId=sv_0003_26010');

    await expect(page.locator('#survey-title')).toContainText('SPEED AD サンプルアンケート（標準機能確認用）');
    await expect(page.locator('#charts-container [data-role="valid-answers"]').first()).toContainText('有効回答: 10件');
  });

  test('共通サンプルのダウンロード確認で回答・名刺・画像が利用可能になる', async ({ page }) => {
    const sampleName = 'SPEED AD サンプルアンケート（標準機能確認用）';

    await page.goto('/02_dashboard/index.html');
    await page.waitForFunction(() => document.querySelector('#user_select')?.options.length >= 4);
    await page.locator('#searchKeyword').fill(sampleName);

    const sampleRow = page.locator('tbody tr', { hasText: sampleName });
    await expect(sampleRow).toHaveCount(1);
    await sampleRow.getByRole('button', { name: 'データダウンロード' }).click();

    const modal = page.locator('#downloadOptionsModal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-download-status="answer"]')).toHaveText('利用可能');
    await expect(modal.locator('[data-download-status="business_card_answer"]')).toHaveText('利用可能');
    await expect(modal.locator('[data-download-status="business_card"]')).toHaveText('利用可能');
    await expect(modal.locator('[data-download-status="image"]')).toHaveText('利用可能');
    await expect(modal.locator('#downloadSubmitBtn')).toBeEnabled();
  });
});
