/**
 * GAS Web App クライアント（reporter から使用 / Node実行）。
 * 共有モックDB（Spreadsheet）へ scenario_runs / scenario_step_results / defect_observations を記録する。
 * URL は .env の GAS_WEB_APP_URL。未設定なら送信せず skip（ローカル記録のみ）。
 * POST は GAS の CORS 制約に合わせ text/plain で送る。
 */
const PW_TO_DB_STATUS = {
  passed: 'OK',
  failed: 'NG',
  timedOut: 'NG',
  interrupted: '保留',
  skipped: '保留',
};

async function gasPost(action, payload) {
  const url = process.env.GAS_WEB_APP_URL;
  if (!url) return { ok: false, skipped: 'GAS_WEB_APP_URL未設定' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload }),
      redirect: 'follow',
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return { ok: false, raw: text.slice(0, 300) };
    }
  } catch (e) {
    return { ok: false, error: String(e).slice(0, 200) };
  }
}

module.exports = { gasPost, PW_TO_DB_STATUS };
