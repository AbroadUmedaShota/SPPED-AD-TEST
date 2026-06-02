#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const __filename = fileURLToPath(import.meta.url);

const REQUIRED_FIELDS = ['bugCategory', 'bugSummary', 'reproductionSteps', 'actualBehavior'];

export const PII_FIELD_ALIASES = {
  reporterName: ['reporterName', '氏名', 'お名前', '報告者名'],
  reporterEmail: ['reporterEmail', 'メール', 'メールアドレス', 'Email Address', 'email'],
  reporterCompany: ['reporterCompany', '会社名', '組織名'],
  internalNotes: ['internalNotes', '社内メモ', '内部メモ'],
  assigneeSuggestion: ['assigneeSuggestion', '担当者候補', '担当部署や担当者'],
  internalProjectId: ['internalProjectId', '社内プロジェクトID', '内部管理ID'],
  screenshot: ['screenshot', 'スクリーンショットData URI', 'スクリーンショット本体'],
  screenshotFilename: ['screenshotFilename', 'スクリーンショットファイル名', '添付ファイル名']
};

export const HEADER_ALIASES = {
  timestamp: ['timestamp', 'タイムスタンプ', '送信日時', 'submitted_at'],
  reportType: ['reportType', '報告タイプ', '報告種別', '問い合わせ種別'],
  bugCategory: ['bugCategory', '不具合の種別', 'カテゴリ', 'bug_category'],
  bugSummary: ['bugSummary', '不具合の概要', '概要', 'summary'],
  questionnaireId: ['questionnaireId', 'アンケートID', 'アンケート参照', 'questionnaire_ref'],
  reproductionSteps: ['reproductionSteps', '再現手順', 'reproduce_steps', 'reproduction_steps'],
  actualBehavior: ['actualBehavior', '実際の動作', 'actual'],
  expectedBehavior: ['expectedBehavior', '期待される動作', '期待結果', 'expected'],
  errorMessage: ['errorMessage', 'エラーメッセージ'],
  occurrenceDateTime: ['occurrenceDateTime', '発生日時', '発生日', '発生時刻'],
  device: ['device', '利用デバイス', '端末'],
  deviceName: ['deviceName', '機種名', '端末名'],
  os: ['os', 'OS'],
  browser: ['browser', 'ブラウザ'],
  browserVersion: ['browserVersion', 'ブラウザバージョン'],
  speedAdEnvironment: ['speedAdEnvironment', '利用画面', '画面', 'screen'],
  affectedModule: ['affectedModule', '影響モジュール', '影響を受けるモジュール/機能'],
  severity: ['severity', '重要度', '優先度']
};

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeMultiline(value) {
  return normalizeText(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function normalizeForKey(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function findValue(record, aliases) {
  const entries = Object.entries(record);
  const normalizedAliases = aliases.map(normalizeHeader);
  const exact = entries.find(([header]) => normalizedAliases.includes(normalizeHeader(header)));
  if (exact) return normalizeText(exact[1]);
  const partial = entries.find(([header]) => {
    const normalizedHeader = normalizeHeader(header);
    return normalizedAliases.some(alias => normalizedHeader.includes(alias) || alias.includes(normalizedHeader));
  });
  return partial ? normalizeText(partial[1]) : '';
}

function hasAnyValue(record, aliases) {
  return Boolean(findValue(record, aliases));
}

function csvDateToIso(value, fallback = new Date()) {
  const raw = normalizeText(value);
  if (!raw) return fallback.toISOString();
  const normalized = raw.replace(/\//g, '-');
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? fallback.toISOString() : date.toISOString();
}

function makeObservationId(rowIndex, observedAt) {
  const stamp = observedAt.replace(/[-:TZ.]/g, '').slice(0, 14) || new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  return `OBS-IMPORT-${stamp}-${String(rowIndex).padStart(4, '0')}`;
}

function buildDedupeKey({ screen, category, summary, actual }) {
  return [screen, category, summary, actual]
    .map(normalizeForKey)
    .filter(Boolean)
    .join('|');
}

function buildEnvironment(record) {
  return [
    'dashboard',
    findValue(record, HEADER_ALIASES.device),
    findValue(record, HEADER_ALIASES.deviceName),
    findValue(record, HEADER_ALIASES.os),
    findValue(record, HEADER_ALIASES.browser),
    findValue(record, HEADER_ALIASES.browserVersion)
  ].filter(Boolean).join(' / ');
}

function buildAnonymousNote(record) {
  const lines = [
    findValue(record, HEADER_ALIASES.timestamp) ? `フォーム送信日時: ${findValue(record, HEADER_ALIASES.timestamp)}` : '',
    findValue(record, HEADER_ALIASES.occurrenceDateTime) ? `発生日時: ${findValue(record, HEADER_ALIASES.occurrenceDateTime)}` : '',
    findValue(record, HEADER_ALIASES.errorMessage) ? `エラーメッセージ: ${normalizeMultiline(findValue(record, HEADER_ALIASES.errorMessage))}` : '',
    hasAnyValue(record, PII_FIELD_ALIASES.screenshot) || hasAnyValue(record, PII_FIELD_ALIASES.screenshotFilename)
      ? 'スクリーンショット: CSV元に添付列あり（ファイル本体とData URIは共有DB未投入）'
      : ''
  ].filter(Boolean);
  return lines.join('\n');
}

export function detectIgnoredPiiFields(records) {
  const headers = new Set(records.flatMap(record => Object.keys(record)));
  const present = [];
  Object.entries(PII_FIELD_ALIASES).forEach(([field, aliases]) => {
    const hasHeader = [...headers].some(header => aliases.map(normalizeHeader).includes(normalizeHeader(header)));
    if (hasHeader) {
      present.push(field);
    }
  });
  return present;
}

export function detectMissingColumns(records) {
  const headers = new Set(records.flatMap(record => Object.keys(record)));
  return Object.entries(HEADER_ALIASES)
    .filter(([field]) => REQUIRED_FIELDS.includes(field))
    .filter(([, aliases]) => ![...headers].some(header => aliases.map(normalizeHeader).includes(normalizeHeader(header))))
    .map(([field]) => field);
}

export function mapCsvRecordToObservationPayload(record, options = {}) {
  const rowIndex = options.rowIndex || 1;
  const fallbackDate = options.now || new Date();
  const observedAt = csvDateToIso(findValue(record, HEADER_ALIASES.timestamp), fallbackDate);
  const reportType = findValue(record, HEADER_ALIASES.reportType) || 'Imported';
  const category = findValue(record, HEADER_ALIASES.bugCategory);
  const screen = findValue(record, HEADER_ALIASES.speedAdEnvironment);
  const summary = normalizeMultiline(findValue(record, HEADER_ALIASES.bugSummary));
  const actual = normalizeMultiline(findValue(record, HEADER_ALIASES.actualBehavior));
  const observation = {
    observation_id: options.observationId || makeObservationId(rowIndex, observedAt),
    case_id: '',
    source_type: 'human',
    source_role: 'google_forms_import',
    agent_run_id: '',
    observed_at: observedAt,
    reproduce_status: 'reported',
    confidence: '',
    verification_status: 'unverified',
    note: buildAnonymousNote(record),
    report_type: reportType,
    category,
    environment: buildEnvironment(record),
    screen,
    questionnaire_ref: findValue(record, HEADER_ALIASES.questionnaireId),
    summary,
    reproduction_steps: normalizeMultiline(findValue(record, HEADER_ALIASES.reproductionSteps)),
    expected: normalizeMultiline(findValue(record, HEADER_ALIASES.expectedBehavior)),
    actual,
    affected_module: findValue(record, HEADER_ALIASES.affectedModule),
    severity: findValue(record, HEADER_ALIASES.severity),
    dedupe_key: buildDedupeKey({ screen, category, summary, actual }),
    source_ref: 'google_forms_csv_import'
  };
  return { observation, evidence: [] };
}

export function readCsvRecords(csvPath) {
  const csvText = readFileSync(csvPath, 'utf8');
  return parse(csvText, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true
  });
}

function validatePayload(payload) {
  const missing = REQUIRED_FIELDS.filter(field => {
    const fieldMap = {
      bugCategory: payload.observation.category,
      bugSummary: payload.observation.summary,
      reproductionSteps: payload.observation.reproduction_steps,
      actualBehavior: payload.observation.actual
    };
    return !fieldMap[field];
  });
  return missing;
}

export function buildImportPreview(records, options = {}) {
  const payloads = records.map((record, index) => mapCsvRecordToObservationPayload(record, {
    rowIndex: index + 1,
    now: options.now
  }));
  const rowIssues = payloads
    .map((payload, index) => ({ row: index + 2, missing: validatePayload(payload) }))
    .filter(issue => issue.missing.length);
  return {
    totalRows: records.length,
    payloads,
    validPayloads: payloads.filter(payload => !validatePayload(payload).length),
    rowIssues,
    missingColumns: detectMissingColumns(records),
    ignoredPiiFields: detectIgnoredPiiFields(records),
    anonymizedFields: Object.keys(payloads[0]?.observation || {})
  };
}

async function postAppendObservation(gasUrl, payload) {
  const response = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'appendObservation',
      payload
    })
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`GAS POST failed: ${response.status} ${text}`);
  }
  if (!text) return;
  try {
    const json = JSON.parse(text);
    if (json.ok === false) {
      throw new Error(json.error || 'GAS returned ok=false');
    }
  } catch (error) {
    if (error instanceof SyntaxError) return;
    throw error;
  }
}

function parseArgs(argv) {
  const args = { csv: '', gasUrl: '', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--csv') {
      args.csv = argv[index + 1] || '';
      index += 1;
    } else if (token === '--gas-url') {
      args.gasUrl = argv[index + 1] || '';
      index += 1;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    } else if (token === '--help' || token === '-h') {
      args.help = true;
    }
  }
  return args;
}

function usage() {
  return [
    'Usage:',
    '  node scripts/import-bug-report-form-csv.mjs --csv path/to/forms.csv --dry-run',
    '  node scripts/import-bug-report-form-csv.mjs --csv path/to/forms.csv --gas-url https://script.google.com/macros/s/.../exec',
    '',
    'Notes:',
    '  --dry-run は投入せず、件数・欠落列・匿名化結果を表示します。',
    '  実投入時は --gas-url が必須です。'
  ].join('\n');
}

export async function runImport(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return { ok: true, help: true };
  }
  if (!args.csv) {
    throw new Error('--csv を指定してください。');
  }
  if (!args.dryRun && !args.gasUrl) {
    throw new Error('実投入時は --gas-url を指定してください。');
  }

  const csvPath = path.resolve(process.cwd(), args.csv);
  const records = readCsvRecords(csvPath);
  const preview = buildImportPreview(records);
  const summary = {
    ok: preview.rowIssues.length === 0,
    dryRun: args.dryRun,
    totalRows: preview.totalRows,
    validRows: preview.validPayloads.length,
    skippedRows: preview.rowIssues.length,
    missingColumns: preview.missingColumns,
    ignoredPiiFields: preview.ignoredPiiFields,
    anonymizedFields: preview.anonymizedFields,
    rowIssues: preview.rowIssues,
    samplePayloads: preview.validPayloads.slice(0, 3)
  };

  if (args.dryRun) {
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  }

  if (preview.rowIssues.length) {
    throw new Error(`欠落項目のある行があります。dry-runで rowIssues を確認してください: ${preview.rowIssues.length} 行`);
  }

  for (const payload of preview.validPayloads) {
    await postAppendObservation(args.gasUrl, payload);
  }

  console.log(JSON.stringify({
    ...summary,
    importedRows: preview.validPayloads.length
  }, null, 2));
  return {
    ...summary,
    importedRows: preview.validPayloads.length
  };
}

if (path.resolve(process.argv[1] || '') === __filename) {
  runImport().catch(error => {
    console.error(error.message);
    console.error(usage());
    process.exitCode = 1;
  });
}
