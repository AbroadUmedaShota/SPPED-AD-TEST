const { test, expect } = require('@playwright/test');

/**
 * 権限の足りないシナリオで開いたときのページガード。
 *
 * proto-level.js は main[data-page-min-lv] の範囲外で main.innerHTML をガード表示へ
 * 差し替える。差し替えの後に画面側の描画が走ると、消えた要素へ書き込んで例外になる。
 * ガード文言は出るので画面を見ても気付けず、console にだけ残る。
 *
 * 15画面を並列に開くと静的サーバーが取りこぼすため、1つのテストで順に回す。
 * 判定は本題の pageerror（未捕捉の例外）に絞る。資材の読み込みは他のテストが見ている。
 */

const BASE = '/03_admin';

// data-page-min-lv を持つ画面と、その最小レベル
const GUARDED = [
  { path: `${BASE}/calendar-management.html`, min: 2 },
  { path: `${BASE}/operator-management.html`, min: 2 },
  { path: `${BASE}/performance-management.html`, min: 2 },
  { path: `${BASE}/performance-group-detail.html`, min: 2 },
  { path: `${BASE}/performance-operator-detail.html`, min: 2 },
  { path: `${BASE}/reconciliation/index.html`, min: 2 },
  { path: `${BASE}/reconciliation/detail.html`, min: 2 },
  { path: `${BASE}/audit-log.html`, min: 3 },
  { path: `${BASE}/billing-management.html`, min: 3 },
  { path: `${BASE}/coupon-management.html`, min: 3 },
  { path: `${BASE}/invoice-management.html`, min: 3 },
  { path: `${BASE}/survey-management.html`, min: 3 },
  { path: `${BASE}/survey-detail.html`, min: 3 },
  { path: `${BASE}/user-management.html`, min: 3 },
  { path: `${BASE}/user-detail.html`, min: 3 },
];

test('権限の足りないシナリオではガード表示になり、例外を出さない', async ({ page }) => {
  test.slow();
  const thrown = [];
  page.on('pageerror', (e) => thrown.push(`${page.url().split('/').pop()}: ${e.message}`));

  const noGuard = [];
  for (const { path, min } of GUARDED) {
    const lv = `lv${min - 1}`;
    await page.addInitScript((v) => localStorage.setItem('adminMockLevel', v), lv);
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.pLevel === 'function', null, { timeout: 20000 });
    const main = (await page.locator('#main-content').innerText()).trim();
    if (!main.includes('シナリオでは表示されません')) {
      noGuard.push(`${path} (${lv})`);
    }
  }

  expect(noGuard, `ガード表示にならない画面: ${noGuard.join(' / ')}`).toEqual([]);
  expect(thrown, `ガード表示の裏で例外が出ている: ${thrown.join(' / ')}`).toEqual([]);
});
