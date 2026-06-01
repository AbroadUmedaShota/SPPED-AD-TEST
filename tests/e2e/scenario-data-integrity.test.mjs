import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const scenarioDataPath = path.join(repoRoot, '99_backend-docs', '08_e2e-testing', 'scenario-data.js');
const scenarioSource = fs.readFileSync(scenarioDataPath, 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(scenarioSource, context, { filename: scenarioDataPath });

const scenarios = context.window.E2E_SCENARIOS;
const steps = context.window.E2E_SCENARIO_STEPS;
const stgTestDir = path.join(repoRoot, 'tests', 'e2e', 'stg');

const expectedPhases = new Set([
  '01_準備',
  '02_公開・導線',
  '03_回答受付',
  '04_データ化中',
  '05_納品・取得',
  '06_フォロー・請求',
  '90_管理者運用'
]);

function collectFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(entryPath);
    return entry.isFile() ? [entryPath] : [];
  });
}

test('scenario masters use lifecycle phases and keep existing ids stable', () => {
  assert.equal(scenarios.length, 34);

  const scenarioIds = scenarios.map(scenario => scenario.scenario_id);
  assert.equal(new Set(scenarioIds).size, scenarioIds.length);

  for (let i = 1; i <= 31; i += 1) {
    const id = `STG-SCN-${String(i).padStart(3, '0')}`;
    assert.ok(scenarioIds.includes(id), `${id} should remain for Playwright annotations`);
  }

  assert.ok(!scenarioIds.includes('STG-SCN-032'), 'STG-SCN-032 is reserved by existing docs and must not be reused');
  assert.ok(scenarioIds.includes('STG-SCN-033'));
  assert.ok(scenarioIds.includes('STG-SCN-034'));
  assert.ok(scenarioIds.includes('STG-SCN-035'));

  for (const scenario of scenarios) {
    assert.ok(expectedPhases.has(scenario.scenario_group), `${scenario.scenario_id} has unexpected phase ${scenario.scenario_group}`);
  }
});

test('new lifecycle scenarios cover response to delivery handoff', () => {
  const byId = Object.fromEntries(scenarios.map(scenario => [scenario.scenario_id, scenario]));

  assert.equal(byId['STG-SCN-033'].title, '回答送信から名刺データ化対象生成まで');
  assert.equal(byId['STG-SCN-033'].scenario_group, '03_回答受付');
  assert.equal(byId['STG-SCN-034'].title, 'データ化内部処理から完了CSV反映まで');
  assert.equal(byId['STG-SCN-034'].scenario_group, '04_データ化中');
  assert.equal(byId['STG-SCN-035'].title, 'データ化完了データの受け取りとDL期限確認');
  assert.equal(byId['STG-SCN-035'].scenario_group, '05_納品・取得');

  for (const id of ['STG-SCN-033', 'STG-SCN-034', 'STG-SCN-035']) {
    const scenarioSteps = steps.filter(step => step.scenario_id === id);
    assert.ok(scenarioSteps.length >= 4, `${id} should have enough steps for a handoff flow`);
    assert.ok(
      scenarioSteps.some(step => step.requires_permission),
      `${id} should mark at least one side-effectful step as permission-gated`
    );
  }
});

test('scenario steps are uniquely keyed and attached to known scenarios', () => {
  const scenarioIds = new Set(scenarios.map(scenario => scenario.scenario_id));
  const stepIds = steps.map(step => step.step_id);
  assert.equal(new Set(stepIds).size, stepIds.length);

  for (const step of steps) {
    assert.ok(scenarioIds.has(step.scenario_id), `${step.step_id} points to unknown scenario ${step.scenario_id}`);
    assert.match(step.step_id, new RegExp(`^${step.scenario_id}-\\d{2}$`));
  }
});

test('Playwright scenario annotations still point to known masters', () => {
  const scenarioIds = new Set(scenarios.map(scenario => scenario.scenario_id));
  const stepIds = new Set(steps.map(step => step.step_id));
  const referencedScenarios = new Set();
  const referencedSteps = new Set();

  for (const filePath of collectFiles(stgTestDir)) {
    const source = fs.readFileSync(filePath, 'utf8');
    for (const match of source.matchAll(/STG-SCN-\d{3}(?!-\d{2})/g)) {
      referencedScenarios.add(match[0]);
    }
    for (const match of source.matchAll(/STG-SCN-\d{3}-\d{2}/g)) {
      referencedSteps.add(match[0]);
    }
  }

  for (const scenarioId of referencedScenarios) {
    assert.ok(scenarioIds.has(scenarioId), `Playwright references unknown scenario ${scenarioId}`);
  }
  for (const stepId of referencedSteps) {
    assert.ok(stepIds.has(stepId), `Playwright references unknown step ${stepId}`);
  }
});
