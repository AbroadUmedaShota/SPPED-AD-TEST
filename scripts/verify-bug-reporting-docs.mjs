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
  '99_backend-docs/09_bug-reporting/04_triage-and-duplicate-check.md'
].forEach(assertExists);

const manifest = JSON.parse(read('99_backend-docs/09_bug-reporting/manifest.json'));
assert.equal(manifest.meta.id, '09_bug-reporting');
assert.equal(manifest.documents.length, 4);
assert.ok(manifest.documents.some(document => document.path === '03_ai-observation-rules.md'));
assert.ok(manifest.flow?.[0]?.items?.some(item => item.label === 'AI観測登録'));

const rootReadme = read('99_backend-docs/README.md');
assert.match(rootReadme, /09_bug-reporting/);
assert.match(rootReadme, /バグ報告DB/);

const rootIndex = read('99_backend-docs/index.html');
assert.match(rootIndex, /10カテゴリ/);
assert.match(rootIndex, /\.\/09_bug-reporting\/index\.html/);
assert.match(rootIndex, /バグ報告DB/);

const gasCode = read('99_backend-docs/09_bug-reporting/gas/Code.gs');
[
  'defect_cases',
  'defect_observations',
  'defect_evidence',
  'triage_events',
  'appendObservation',
  'promoteObservationToCase',
  'linkBacklogIssue',
  'mergeCases',
  'appendTriageEvent'
].forEach(token => assert.match(gasCode, new RegExp(token)));

const model = await import(pathToFileURL(path.join(bugDir, 'reports-model.js')).href);

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

console.log('bug-reporting docs verification passed');
