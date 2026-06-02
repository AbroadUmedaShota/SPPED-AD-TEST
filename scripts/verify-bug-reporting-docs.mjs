import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const bugDir = path.join(repoRoot, '99_backend-docs', '09_bug-reporting');

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function assertExists(relativePath) {
  assert.ok(existsSync(path.join(repoRoot, relativePath)), `${relativePath} should exist`);
}

[
  '99_backend-docs/09_bug-reporting/README.md',
  '99_backend-docs/09_bug-reporting/index.html',
  '99_backend-docs/09_bug-reporting/manifest.json',
  '99_backend-docs/09_bug-reporting/reports.html',
  '99_backend-docs/09_bug-reporting/reports-model.js',
  '99_backend-docs/09_bug-reporting/gas/Code.gs',
  '99_backend-docs/09_bug-reporting/gas/README.md',
  '99_backend-docs/09_bug-reporting/01_bug-report-overview.md',
  '99_backend-docs/09_bug-reporting/02_backlog-ticket-template.md',
  '99_backend-docs/09_bug-reporting/03_ai-observation-rules.md',
  '99_backend-docs/09_bug-reporting/04_triage-and-duplicate-check.md',
  '02_dashboard/src/services/bugReportDbService.js',
  'scripts/import-bug-report-form-csv.mjs'
].forEach(assertExists);

const manifest = JSON.parse(read('99_backend-docs/09_bug-reporting/manifest.json'));
assert.equal(manifest.meta.id, '09_bug-reporting');
assert.equal(manifest.documents.length, 4);
assert.ok(manifest.documents.some(document => document.path === '03_ai-observation-rules.md'));
assert.ok(manifest.flow?.[0]?.items?.some(item => item.label === 'AI観測登録'));

const rootReadme = read('99_backend-docs/README.md');
assert.match(rootReadme, /09_bug-reporting/);
assert.match(rootReadme, /バグ報告DB/);
assert.match(rootReadme, /共有モックDB/);

const rootIndex = read('99_backend-docs/index.html');
assert.match(rootIndex, /10カテゴリ/);
assert.match(rootIndex, /\.\/09_bug-reporting\/index\.html/);
assert.match(rootIndex, /バグ報告DB/);

const e2eGasReadme = read('99_backend-docs/08_e2e-testing/gas/README.md');
assert.match(e2eGasReadme, /SPEED AD共有モックDB GAS/);
assert.match(e2eGasReadme, /defect_cases/);
assert.match(e2eGasReadme, /appendObservation/);

const bugReadme = read('99_backend-docs/09_bug-reporting/README.md');
assert.match(bugReadme, /共有モックDB/);
assert.match(bugReadme, /AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/);

const reportsHtml = read('99_backend-docs/09_bug-reporting/reports.html');
assert.match(reportsHtml, /DEFAULT_GAS_WEB_APP_URL/);
assert.match(reportsHtml, /共有モックDB接続/);

const gasCode = read('99_backend-docs/09_bug-reporting/gas/Code.gs');
[
  'defect_cases',
  'defect_observations',
  'defect_evidence',
  'triage_events',
  'appendObservation',
  'promoteObservationToCase',
  'linkObservationToCase',
  'linkBacklogIssue',
  'mergeCases',
  'appendTriageEvent'
].forEach(token => assert.match(gasCode, new RegExp(token)));

const e2eGasCode = read('99_backend-docs/08_e2e-testing/gas/Code.gs');
[
  'linkObservationToCase',
  'report_type',
  'questionnaire_ref',
  'reproduction_steps',
  'dedupe_key',
  'source_ref'
].forEach(token => {
  assert.match(gasCode, new RegExp(token));
  assert.match(e2eGasCode, new RegExp(token));
});

const dashboardBugReport = read('02_dashboard/src/bug-report.js');
const dashboardBugReportService = read('02_dashboard/src/services/bugReportDbService.js');
assert.match(`${dashboardBugReport}\n${dashboardBugReportService}`, /appendObservation/);
assert.match(`${dashboardBugReport}\n${dashboardBugReportService}`, /DEFAULT_BUG_REPORT_GAS_URL/);
assert.match(`${dashboardBugReport}\n${dashboardBugReportService}`, /verification_status:\s*'unverified'/);
assert.doesNotMatch(dashboardBugReport, /GOOGLE_FORM_RESPONSE_URL/);

const packageJson = JSON.parse(read('package.json'));
assert.ok(packageJson.devDependencies?.['csv-parse'], 'csv-parse should be registered as devDependency');

const model = await import(pathToFileURL(path.join(bugDir, 'reports-model.js')).href);
const csvImporter = await import(pathToFileURL(path.join(repoRoot, 'scripts', 'import-bug-report-form-csv.mjs')).href);

const anonymousObservation = model.normalizeObservation({
  observation_id: 'OBS-FORM-001',
  source_type: 'human',
  source_role: 'user_submission',
  report_type: 'Simple',
  category: '機能しない',
  environment: 'dashboard',
  screen: 'アンケート回答画面',
  questionnaire_ref: 'survey/301',
  summary: '送信できない',
  reproduction_steps: '回答して送信する',
  expected: '',
  actual: 'ボタンが反応しない',
  affected_module: '',
  severity: '',
  dedupe_key: 'アンケート回答画面|機能しない|送信できない|ボタンが反応しない',
  source_ref: 'dashboard_bug_report'
});
assert.equal(anonymousObservation.report_type, 'Simple');
assert.equal(anonymousObservation.questionnaire_ref, 'survey/301');
assert.equal(anonymousObservation.dedupe_key.includes('送信できない'), true);
assert.equal('reporterEmail' in anonymousObservation, false);

let localData = model.createEmptyDefectDataSet();
localData = model.applyAppendObservation(localData, {
  observation: {
    observation_id: 'OBS-LOCAL-001',
    source_type: 'human',
    source_role: 'QA',
    verification_status: 'confirmed',
    reproduce_status: 'reproduced',
    note: 'Human confirmed.'
  },
  evidence: [{
    evidence_id: 'EVD-LOCAL-001',
    observation_id: 'OBS-LOCAL-001',
    type: 'screenshot',
    url_or_path: 'local/evidence.png',
    redaction_status: 'redacted'
  }]
});
localData = model.applyPromoteObservationToCase(localData, {
  observation_id: 'OBS-LOCAL-001',
  case: {
    case_id: 'BUG-LOCAL-001',
    title: 'Local usable defect',
    status: 'confirmed',
    severity: 'High',
    environment: 'local',
    screen: 'バグ報告DB',
    summary: 'Local mode should persist usable data.'
  },
  actor_role: 'QA'
});
assert.equal(localData.defect_cases.length, 1);
assert.equal(localData.defect_observations[0].case_id, 'BUG-LOCAL-001');
assert.equal(model.isBacklogEligible(localData.defect_cases[0], localData.defect_observations), true);

localData = model.applyAppendObservation(localData, {
  observation: {
    observation_id: 'OBS-UNLINKED-001',
    source_type: 'human',
    source_role: 'user_submission',
    verification_status: 'unverified',
    summary: 'Local mode should persist usable data.',
    actual: 'Local mode should persist usable data.',
    screen: 'バグ報告DB',
    dedupe_key: 'local-mode'
  }
});
assert.equal(model.getUnlinkedObservations(localData.defect_observations).length, 1);
const candidates = model.findDuplicateCandidates(
  localData.defect_observations.find(observation => observation.observation_id === 'OBS-UNLINKED-001'),
  localData.defect_cases
);
assert.equal(candidates[0].case_id, 'BUG-LOCAL-001');
localData = model.applyLinkObservationToCase(localData, {
  observation_id: 'OBS-UNLINKED-001',
  case_id: 'BUG-LOCAL-001',
  verification_status: 'confirmed',
  actor_role: 'QA'
});
const linkedObservation = localData.defect_observations.find(observation => observation.observation_id === 'OBS-UNLINKED-001');
assert.equal(linkedObservation.case_id, 'BUG-LOCAL-001');
assert.equal(linkedObservation.verification_status, 'confirmed');
assert.ok(localData.triage_events.some(event => event.event_type === 'observation_linked'));

localData = model.applyLinkBacklogIssue(localData, {
  case_id: 'BUG-LOCAL-001',
  backlog_key: 'SPDAD2026-999',
  actor_role: 'QA'
});
assert.equal(localData.defect_cases[0].backlog_key, 'SPDAD2026-999');
assert.equal(localData.defect_cases[0].status, 'backlog_linked');

localData = model.applyPromoteObservationToCase(localData, {
  case: {
    case_id: 'BUG-LOCAL-002',
    title: 'Duplicate case',
    status: 'confirmed'
  },
  actor_role: 'QA'
});
localData = model.applyMergeCases(localData, {
  source_case_id: 'BUG-LOCAL-002',
  target_case_id: 'BUG-LOCAL-001',
  actor_role: 'QA',
  note: 'same symptom'
});
const duplicateCase = localData.defect_cases.find(defectCase => defectCase.case_id === 'BUG-LOCAL-002');
assert.equal(duplicateCase.status, 'duplicate');
assert.equal(duplicateCase.duplicate_of_case_id, 'BUG-LOCAL-001');
assert.ok(localData.triage_events.some(event => event.event_type === 'case_merged'));

const aiOnlyCase = { case_id: 'BUG-001', title: 'AI only candidate', summary: 'summary' };
const aiOnlyObservations = [
  {
    observation_id: 'OBS-001',
    case_id: 'BUG-001',
    source_type: 'ai',
    verification_status: 'unverified',
    note: 'AI found this but nobody confirmed it.'
  }
];
assert.equal(model.isBacklogEligible(aiOnlyCase, aiOnlyObservations), false);

const confirmedHumanObservations = [
  {
    observation_id: 'OBS-002',
    case_id: 'BUG-001',
    source_type: 'human',
    source_role: 'QA',
    verification_status: 'confirmed',
    reproduce_status: 'reproduced',
    note: 'Confirmed on stg.'
  }
];
assert.equal(model.isBacklogEligible(aiOnlyCase, confirmedHumanObservations), true);

const backlogBody = model.buildBacklogBody(
  {
    case_id: 'BUG-001',
    title: '必須エラー後に回答送信できない',
    severity: 'High',
    environment: 'stg',
    screen: 'アンケート回答',
    summary: '必須エラー後に送信できない。',
    expected: '入力後に送信できる。',
    actual: '送信ボタンが反応しない。'
  },
  confirmedHumanObservations,
  [
    {
      evidence_id: 'EVD-001',
      observation_id: 'OBS-002',
      type: 'screenshot',
      url_or_path: 'https://example.test/evidence.png',
      summary: 'エラー後の画面',
      redaction_status: 'redacted'
    }
  ]
);
[
  '## 概要',
  '## 発生環境',
  '## 再現・観測',
  '## 期待結果',
  '## 実際結果',
  '## 証跡',
  '## 関連DB'
].forEach(section => assert.match(backlogBody, new RegExp(section)));

const csvPayload = csvImporter.mapCsvRecordToObservationPayload({
  'タイムスタンプ': '2026-05-31 09:00:00',
  '報告タイプ': '詳細報告',
  '不具合の種別': '機能しない',
  '不具合の概要': '送信できない',
  'アンケートID': 'survey/301',
  '再現手順': '回答して送信する',
  '実際の動作': 'ボタンが反応しない',
  '期待される動作': '完了画面へ遷移する',
  '利用画面': 'アンケート回答画面',
  '重要度': '高',
  '氏名': '山田 太郎',
  'メールアドレス': 'taro@example.test',
  '会社名': 'テスト株式会社',
  '社内メモ': '社内だけのメモ',
  '担当者候補': '担当A',
  'スクリーンショットData URI': 'data:image/png;base64,AAAA'
}, {
  rowIndex: 1,
  now: new Date('2026-05-31T00:00:00.000Z')
});
const csvObservationJson = JSON.stringify(csvPayload.observation);
assert.equal(csvPayload.observation.source_ref, 'google_forms_csv_import');
assert.equal(csvPayload.observation.verification_status, 'unverified');
assert.equal(csvPayload.observation.category, '機能しない');
assert.doesNotMatch(csvObservationJson, /taro@example\.test/);
assert.doesNotMatch(csvObservationJson, /テスト株式会社/);
assert.doesNotMatch(csvObservationJson, /山田 太郎/);
assert.doesNotMatch(csvObservationJson, /data:image\/png/);
assert.equal(csvPayload.evidence.length, 0);

const csvPreview = csvImporter.buildImportPreview([{
  '不具合の種別': '表示崩れ',
  '不具合の概要': 'ボタンが欠ける',
  '再現手順': '画面を開く',
  '実際の動作': '右端が見切れる',
  'メールアドレス': 'ignored@example.test'
}]);
assert.equal(csvPreview.validPayloads.length, 1);
assert.ok(csvPreview.ignoredPiiFields.includes('reporterEmail'));

console.log('bug-reporting docs verification passed');
