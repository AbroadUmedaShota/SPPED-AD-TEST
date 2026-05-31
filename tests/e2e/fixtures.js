const base = require('@playwright/test');

/**
 * 証跡を自動で残す共通テスト基盤。
 *
 * - 各テスト終了時に「全画面スクショ」と「context（case_id / URL / ブラウザ / 実行日時 / 結果）」を
 *   testInfo.attach で添付する（運用ルール: スクショ＋URL＋ブラウザ＋日時をセットで残す）。
 * - `caseTest(caseId, title, fn)` で index.html の case_id とテストを紐付ける。
 *   付与した case_id は annotation('case') として残り、reporter が結果CSV/カバレッジに使う。
 */
function safeUrl(page) {
  try { return page.url(); } catch { return ''; }
}

const test = base.test.extend({
  _evidence: [async ({ page, browserName }, use, testInfo) => {
    await use();
    const caseIds = testInfo.annotations.filter(a => a.type === 'case').map(a => a.description);
    try {
      const shot = await page.screenshot({ fullPage: true });
      await testInfo.attach('evidence-screenshot', { body: shot, contentType: 'image/png' });
    } catch {
      /* ページが閉じている等は証跡スキップ */
    }
    const meta = {
      caseIds,
      url: safeUrl(page),
      browser: browserName,
      project: testInfo.project.name,
      status: testInfo.status,
      title: testInfo.title,
      time: new Date().toISOString(),
    };
    await testInfo.attach('evidence-context', {
      body: JSON.stringify(meta, null, 2),
      contentType: 'application/json',
    });
  }, { auto: true }],
});

/**
 * ケース駆動／シナリオ駆動の両方に対応した登録ヘルパー。
 *   e2eTest({ caseId, scenarioId, stepId }, title, fn)
 * - caseId: index.html の case_id（カバレッジ集計に使用）
 * - scenarioId / stepId: scenario-data.js の scenario_id / step_id（scenario_step_results 記録キー）
 * いずれも annotation として残り、reporter が結果CSV・カバレッジ・スプシ記録に使う。
 */
function e2eTest(meta, title, fn) {
  const annotation = [];
  if (meta.caseId) annotation.push({ type: 'case', description: meta.caseId });
  if (meta.scenarioId) annotation.push({ type: 'scenario', description: meta.scenarioId });
  if (meta.stepId) annotation.push({ type: 'step', description: meta.stepId });
  test(title, { annotation }, fn);
}
e2eTest.skip = (meta, title, fn) => {
  const annotation = [];
  if (meta.caseId) annotation.push({ type: 'case', description: meta.caseId });
  if (meta.scenarioId) annotation.push({ type: 'scenario', description: meta.scenarioId });
  if (meta.stepId) annotation.push({ type: 'step', description: meta.stepId });
  test.skip(title, { annotation }, fn);
};

/** case_id だけ紐付ける簡易版（ケース駆動）。 */
function caseTest(caseId, title, fn) {
  e2eTest({ caseId }, title, fn);
}

module.exports = { test, expect: base.expect, e2eTest, caseTest };
