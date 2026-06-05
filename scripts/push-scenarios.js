// scenario-data.js の全シナリオ＋全ステップを共有スプシ(GAS)へ replaceScenarioMasters で push（全置換）。
// 実行: node scripts/push-scenarios.js
const https = require('https');
const path = require('path');

const GAS = 'https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec';

// scenario-data.js を読み込む（window グローバルを用意）
global.window = {};
require(path.resolve('99_backend-docs/08_e2e-testing/scenario-data.js'));
const SCEN = global.window.E2E_SCENARIOS || [];
const STEPS = global.window.E2E_SCENARIO_STEPS || [];

const csv = (v) => Array.isArray(v) ? v.join(',') : (v || '');
const scenarios = SCEN.map(s => ({
  scenario_id: s.scenario_id, title: s.title, role_scope: s.role_scope, scenario_group: s.scenario_group,
  priority: s.priority, side_effect: s.side_effect, start_url: s.start_url, objective: s.objective,
  linked_case_ids: csv(s.linked_case_ids), stg_observation_status: s.stg_observation_status,
  expected_outcome: s.expected_outcome, evidence_policy: s.evidence_policy, notes: s.notes || '', active: 'TRUE',
}));
const steps = STEPS.map(s => ({
  scenario_id: s.scenario_id, step_id: s.step_id, step_no: s.step_no, action: s.action, expected: s.expected,
  side_effect: s.side_effect, requires_permission: s.requires_permission ? 'TRUE' : 'FALSE',
  linked_case_ids: csv(s.linked_case_ids), active: 'TRUE',
}));

function req(method, body) {
  return new Promise((res, rej) => {
    const u = new URL(GAS);
    const opt = { method, hostname: u.hostname, path: u.pathname + u.search, headers: {} };
    if (body) { opt.headers['Content-Type'] = 'text/plain;charset=utf-8'; opt.headers['Content-Length'] = Buffer.byteLength(body); }
    const r = https.request(opt, x => {
      if (x.statusCode >= 300 && x.statusCode < 400 && x.headers.location) { return req('GET', null, x.headers.location).then(res, rej); }
      let d = ''; x.on('data', c => d += c); x.on('end', () => res({ status: x.statusCode, body: d }));
    });
    r.on('error', rej); if (body) r.write(body); r.end();
  });
}
function get(resource) {
  return new Promise((res, rej) => {
    const follow = (url) => https.get(url, x => {
      if (x.statusCode >= 300 && x.statusCode < 400 && x.headers.location) return follow(x.headers.location);
      let d = ''; x.on('data', c => d += c); x.on('end', () => { try { res(JSON.parse(d)); } catch (e) { res({ raw: d.slice(0, 120) }); } });
    }).on('error', rej);
    follow(`${GAS}?resource=${resource}`);
  });
}

(async () => {
  const beforeS = await get('scenarios'); const beforeT = await get('scenario_steps');
  console.log('PUSH前 scenarios:', (beforeS.data || []).length, ' steps:', (beforeT.data || []).length);
  console.log('送信 scenarios:', scenarios.length, ' steps:', steps.length);
  const r = await req('POST', JSON.stringify({ action: 'replaceScenarioMasters', payload: { scenarios, steps } }));
  console.log('replaceScenarioMasters -> HTTP', r.status);
  await new Promise(f => setTimeout(f, 1500));
  const afterS = await get('scenarios'); const afterT = await get('scenario_steps');
  console.log('PUSH後 scenarios:', (afterS.data || []).length, ' steps:', (afterT.data || []).length);
  // 反映確認: 034/035の更新ステップ
  const chk = (afterT.data || []).filter(x => (x.scenario_id === 'STG-SCN-034' && [9, 10].includes(Number(x.step_no))) || (x.scenario_id === 'STG-SCN-035' && Number(x.step_no) === 8));
  chk.forEach(x => console.log(' 反映:', x.scenario_id, x.step_no, String(x.action).slice(0, 36) + '...'));
})();
