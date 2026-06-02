export const DEFAULT_BUG_REPORT_GAS_URL = 'https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec';

const OBSERVATION_RESOURCE = 'defect_observations';

export const BUG_REPORT_PII_FIELDS = [
  'reporterName',
  'reporterEmail',
  'reporterCompany',
  'internalNotes',
  'assigneeSuggestion',
  'screenshot'
];

function trimText(value) {
  return String(value || '').trim();
}

function normalizeForKey(value) {
  return trimText(value)
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function sanitizeMultiline(value) {
  return trimText(value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function makeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

function makeRandomSuffix() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  }
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

export function createBugReportObservationId(date = new Date()) {
  return `OBS-FORM-${makeTimestamp(date)}-${makeRandomSuffix()}`;
}

export function buildBugReportDedupeKey(input = {}) {
  return [
    input.screen,
    input.category,
    input.summary,
    input.actual
  ]
    .map(normalizeForKey)
    .filter(Boolean)
    .join('|');
}

function buildOccurrenceText(formData) {
  if (formData.occurrenceDate && formData.occurrenceTime) {
    return `${formData.occurrenceDate} ${formData.occurrenceTime}`;
  }
  return trimText(formData.occurrenceDate);
}

function buildEnvironmentText(formData, labels) {
  const parts = [
    'dashboard',
    labels.device,
    formData.deviceName,
    labels.os,
    labels.browser,
    formData.browserVersion
  ].map(trimText).filter(Boolean);
  return [...new Set(parts)].join(' / ');
}

function buildAnonymousNote(formData, labels) {
  const lines = [
    buildOccurrenceText(formData) ? `発生日時: ${buildOccurrenceText(formData)}` : '',
    buildEnvironmentText(formData, labels) ? `利用環境: ${buildEnvironmentText(formData, labels)}` : '',
    formData.hasErrorMessage && formData.errorMessage ? `エラーメッセージ: ${sanitizeMultiline(formData.errorMessage)}` : '',
    formData.screenshot ? 'スクリーンショット: 添付あり（ファイル本体とData URIは共有DB未保存）' : ''
  ].filter(Boolean);
  return lines.join('\n');
}

export function buildBugReportObservationPayload(formData, options = {}) {
  const labels = options.labels || {};
  const now = options.now || new Date();
  const observationId = options.observationId || createBugReportObservationId(now);
  const reportType = trimText(labels.reportType || formData.reportType);
  const category = trimText(labels.bugCategory || formData.bugCategory);
  const screen = trimText(labels.speedAdEnvironment || formData.speedAdEnvironment);
  const summary = sanitizeMultiline(formData.bugSummary);
  const actual = sanitizeMultiline(formData.actualBehavior);
  const observation = {
    observation_id: observationId,
    case_id: '',
    source_type: 'human',
    source_role: 'user_submission',
    agent_run_id: '',
    observed_at: now.toISOString(),
    reproduce_status: 'reported',
    confidence: '',
    verification_status: 'unverified',
    note: buildAnonymousNote(formData, labels),
    report_type: reportType,
    category,
    environment: buildEnvironmentText(formData, labels),
    screen,
    questionnaire_ref: trimText(formData.questionnaireId),
    summary,
    reproduction_steps: sanitizeMultiline(formData.reproductionSteps),
    expected: sanitizeMultiline(formData.expectedBehavior),
    actual,
    affected_module: trimText(labels.affectedModule || formData.affectedModule),
    severity: trimText(labels.severity || formData.severity),
    dedupe_key: buildBugReportDedupeKey({ screen, category, summary, actual }),
    source_ref: 'dashboard_bug_report'
  };
  return {
    observation,
    evidence: []
  };
}

export function buildJsonpUrl(baseUrl, resource, callbackName) {
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}resource=${encodeURIComponent(resource)}&callback=${encodeURIComponent(callbackName)}`;
}

function loadJsonp(baseUrl, resource, timeoutMs) {
  if (typeof document === 'undefined') {
    return Promise.reject(new Error('JSONP確認はブラウザ上で実行してください。'));
  }
  return new Promise((resolve, reject) => {
    const callbackName = `__speedad_bug_report_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement('script');
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('受付DBへの保存確認がタイムアウトしました。'));
    }, timeoutMs);

    function cleanup() {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    }

    window[callbackName] = payload => {
      cleanup();
      resolve(payload);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('受付DBへの保存確認に失敗しました。'));
    };
    script.src = buildJsonpUrl(baseUrl, resource, callbackName);
    document.head.appendChild(script);
  });
}

function hasObservation(payload, observationId) {
  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.some(row => trimText(row.observation_id) === observationId);
}

export async function verifyObservationSaved(gasUrl, observationId, options = {}) {
  const timeoutMs = options.timeoutMs || 15000;
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const payload = await loadJsonp(gasUrl, OBSERVATION_RESOURCE, Math.min(5000, timeoutMs));
      if (hasObservation(payload, observationId)) {
        return true;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => window.setTimeout(resolve, 800));
  }
  throw lastError || new Error(`受付DBで ${observationId} を確認できませんでした。`);
}

export async function postAppendObservation(gasUrl, payload) {
  await fetch(gasUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({
      action: 'appendObservation',
      payload
    })
  });
}

export function getBugReportGasUrl() {
  return trimText(globalThis.window?.__BUG_REPORT_GAS_URL__ || DEFAULT_BUG_REPORT_GAS_URL);
}

export async function submitBugReportToDb(formData, options = {}) {
  const gasUrl = trimText(options.gasUrl || getBugReportGasUrl());
  if (!gasUrl) {
    throw new Error('受付DBのGAS URLが未設定です。');
  }
  const payload = buildBugReportObservationPayload(formData, options);
  await postAppendObservation(gasUrl, payload);
  await verifyObservationSaved(gasUrl, payload.observation.observation_id, {
    timeoutMs: options.timeoutMs || 15000
  });
  return {
    observationId: payload.observation.observation_id,
    payload
  };
}
