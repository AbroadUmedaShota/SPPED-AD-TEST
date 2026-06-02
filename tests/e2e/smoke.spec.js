const { test, expect } = require('@playwright/test');

/**
 * セットアップ検証用スモークテスト。
 *
 * Playwright とローカル配信 (scripts/dev-server.py) が正しく動くことを
 * 確認する最小限のテスト。本格的な導線テストは
 * 99_backend-docs/08_e2e-testing/02_target-flows.md の E2E-FLOW-01〜07 を
 * 順次このディレクトリに追加していく。
 */

test('トップページが表示される', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveTitle(/SPEED AD/);
});

test('ダッシュボードページが配信される (E2E-FLOW-01 の入口)', async ({ page }) => {
  const response = await page.goto('/02_dashboard/index.html');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('body')).toBeVisible();
});

test('不具合報告フォームは受付DBへ匿名化投稿し受付IDを表示する', async ({ page }) => {
  let postedBody = null;

  await page.route('https://script.google.com/**', async route => {
    const request = route.request();
    if (request.method() === 'POST') {
      postedBody = JSON.parse(request.postData() || '{}');
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
      return;
    }

    const url = new URL(request.url());
    const callback = url.searchParams.get('callback') || 'callback';
    const observationId = postedBody?.payload?.observation?.observation_id || 'OBS-FORM-TEST';
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `${callback}({ ok: true, data: [{ observation_id: "${observationId}" }] });`
    });
  });

  const response = await page.goto('/02_dashboard/bug-report.html');
  expect(response?.ok()).toBeTruthy();
  await page.selectOption('#bugCategory', 'Functionality');
  await page.fill('#bugSummary', '回答を送信できない');
  await page.fill('#reproductionSteps', 'アンケートに回答して送信ボタンを押す');
  await page.fill('#actualBehavior', '送信ボタンを押しても完了画面へ進まない');
  await page.click('#submit-btn');

  await expect(page.locator('#success-message')).toBeVisible();
  await expect(page.locator('#bug-report-receipt-id')).toContainText(/受付ID: OBS-FORM-/);
  expect(postedBody.action).toBe('appendObservation');
  expect(postedBody.payload.observation.verification_status).toBe('unverified');
  expect(postedBody.payload.observation.source_role).toBe('user_submission');
  expect(postedBody.payload.observation.summary).toBe('回答を送信できない');
  expect(JSON.stringify(postedBody.payload)).not.toContain('reporterEmail');
  expect(JSON.stringify(postedBody.payload)).not.toContain('data:image/');
});

test('管理ページで未紐づけ投稿を既存代表ケースへ紐づけできる', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('speedad_bug_reporting_gas_url', '');
    localStorage.setItem('speedad_bug_reporting_local_db', JSON.stringify({
      defect_cases: [{
        case_id: 'BUG-TEST-001',
        title: 'アンケート回答を送信できない',
        status: 'confirmed',
        severity: 'High',
        environment: 'stg',
        screen: 'アンケート回答画面',
        symptom_key: 'answer-submit',
        summary: 'アンケート回答画面で送信できない',
        expected: '回答送信後に完了画面へ遷移する',
        actual: '送信ボタンが反応しない'
      }],
      defect_observations: [{
        observation_id: 'OBS-UNLINKED-TEST',
        case_id: '',
        source_type: 'human',
        source_role: 'user_submission',
        observed_at: '2026-06-01T00:00:00.000Z',
        reproduce_status: 'reported',
        verification_status: 'unverified',
        report_type: '簡易報告',
        category: '機能しない',
        environment: 'dashboard',
        screen: 'アンケート回答画面',
        summary: 'アンケート回答画面で送信できない',
        reproduction_steps: '回答して送信する',
        actual: '送信ボタンが反応しない',
        dedupe_key: 'answer-submit',
        source_ref: 'dashboard_bug_report'
      }],
      defect_evidence: [],
      triage_events: []
    }));
  });

  const response = await page.goto('/99_backend-docs/09_bug-reporting/reports.html');
  expect(response?.ok()).toBeTruthy();
  await expect(page.locator('#unlinkedObservationCount')).toHaveText('1件');
  await expect(page.getByRole('button', { name: /OBS-UNLINKED-TEST/ })).toBeVisible();
  await page.getByRole('button', { name: /既存ケースへ紐づけ/ }).click();
  await expect(page.locator('#unlinkedObservationCount')).toHaveText('0件');

  const linked = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('speedad_bug_reporting_local_db') || '{}');
    return data.defect_observations.find(observation => observation.observation_id === 'OBS-UNLINKED-TEST');
  });
  expect(linked.case_id).toBe('BUG-TEST-001');
  expect(linked.verification_status).toBe('confirmed');
});
