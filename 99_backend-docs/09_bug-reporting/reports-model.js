export const DEFECT_RESOURCES = [
  'defect_cases',
  'defect_observations',
  'defect_evidence',
  'triage_events'
];

export const SEVERITY_LABELS = {
  Critical: '緊急',
  High: '高',
  Medium: '中',
  Low: '低'
};

export const STATUS_LABELS = {
  draft: '受付',
  triage: '切り分け中',
  confirmed: '不具合確認済み',
  backlog_linked: 'Backlog連携済み',
  duplicate: '重複',
  rejected: '不具合ではない',
  resolved: '解決済み'
};

export const VERIFICATION_LABELS = {
  unverified: '未確認',
  confirmed: '確認済み',
  rejected: '却下'
};

const RESOURCE_TO_STATE_KEY = {
  defect_cases: 'defect_cases',
  defect_observations: 'defect_observations',
  defect_evidence: 'defect_evidence',
  triage_events: 'triage_events'
};

function valueOrDash(value) {
  const normalized = String(value || '').trim();
  return normalized || '-';
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function splitLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

function cloneDataSet(dataSet) {
  return {
    defect_cases: (dataSet?.defect_cases || []).map(normalizeCase),
    defect_observations: (dataSet?.defect_observations || []).map(normalizeObservation),
    defect_evidence: (dataSet?.defect_evidence || []).map(normalizeEvidence),
    triage_events: (dataSet?.triage_events || []).map(normalizeTriageEvent)
  };
}

function upsertByKey(items, nextItem, keyName) {
  const key = String(nextItem?.[keyName] || '').trim();
  if (!key) {
    return items;
  }
  const index = items.findIndex(item => String(item[keyName] || '').trim() === key);
  if (index === -1) {
    return [...items, nextItem];
  }
  const nextItems = [...items];
  nextItems[index] = { ...nextItems[index], ...nextItem };
  return nextItems;
}

function appendLocalEvent(dataSet, event) {
  const nextEvent = normalizeTriageEvent({
    event_id: event.event_id || createLocalId('EVT'),
    created_at: event.created_at || nowIso(),
    ...event
  });
  return {
    ...dataSet,
    triage_events: upsertByKey(dataSet.triage_events, nextEvent, 'event_id')
  };
}

export function normalizeCase(row = {}) {
  return {
    case_id: String(row.case_id || '').trim(),
    title: String(row.title || '').trim(),
    status: String(row.status || 'draft').trim(),
    severity: String(row.severity || 'Medium').trim(),
    environment: String(row.environment || '').trim(),
    screen: String(row.screen || '').trim(),
    symptom_key: String(row.symptom_key || '').trim(),
    summary: String(row.summary || '').trim(),
    expected: String(row.expected || '').trim(),
    actual: String(row.actual || '').trim(),
    backlog_key: String(row.backlog_key || '').trim(),
    duplicate_of_case_id: String(row.duplicate_of_case_id || '').trim(),
    created_at: String(row.created_at || '').trim(),
    updated_at: String(row.updated_at || '').trim()
  };
}

export function normalizeObservation(row = {}) {
  return {
    observation_id: String(row.observation_id || '').trim(),
    case_id: String(row.case_id || '').trim(),
    source_type: String(row.source_type || 'human').trim(),
    source_role: String(row.source_role || '').trim(),
    agent_run_id: String(row.agent_run_id || '').trim(),
    observed_at: String(row.observed_at || '').trim(),
    reproduce_status: String(row.reproduce_status || '').trim(),
    confidence: String(row.confidence || '').trim(),
    verification_status: String(row.verification_status || 'unverified').trim(),
    note: String(row.note || '').trim()
  };
}

export function normalizeEvidence(row = {}) {
  return {
    evidence_id: String(row.evidence_id || '').trim(),
    observation_id: String(row.observation_id || '').trim(),
    type: String(row.type || '').trim(),
    url_or_path: String(row.url_or_path || '').trim(),
    summary: String(row.summary || '').trim(),
    redaction_status: String(row.redaction_status || '').trim()
  };
}

export function normalizeTriageEvent(row = {}) {
  return {
    event_id: String(row.event_id || '').trim(),
    case_id: String(row.case_id || '').trim(),
    observation_id: String(row.observation_id || '').trim(),
    event_type: String(row.event_type || '').trim(),
    actor_role: String(row.actor_role || '').trim(),
    note: String(row.note || '').trim(),
    created_at: String(row.created_at || '').trim()
  };
}

export function createEmptyDefectDataSet() {
  return {
    defect_cases: [],
    defect_observations: [],
    defect_evidence: [],
    triage_events: []
  };
}

export function normalizeDefectDataSet(rawDataSet = {}) {
  return cloneDataSet(rawDataSet);
}

export function makeDemoDefectDataSet() {
  let dataSet = createEmptyDefectDataSet();
  dataSet = applyAppendObservation(dataSet, {
    observation: {
      observation_id: 'OBS-DEMO-HUMAN-001',
      case_id: 'BUG-DEMO-001',
      source_type: 'human',
      source_role: 'QA',
      observed_at: '2026-05-31T09:00:00.000Z',
      reproduce_status: 'reproduced',
      verification_status: 'confirmed',
      note: 'stgのアンケート回答画面で必須エラー表示後、入力を修正しても送信ボタンが反応しないことを確認。'
    },
    evidence: [{
      evidence_id: 'EVD-DEMO-001',
      observation_id: 'OBS-DEMO-HUMAN-001',
      type: 'screenshot',
      url_or_path: 'DriveまたはBacklogの証跡URLを設定',
      summary: '必須エラー後の画面',
      redaction_status: 'redacted'
    }]
  });
  dataSet = applyAppendObservation(dataSet, {
    observation: {
      observation_id: 'OBS-DEMO-AI-001',
      case_id: 'BUG-DEMO-001',
      source_type: 'ai',
      source_role: 'AI agent',
      agent_run_id: 'agent-demo-20260531-001',
      observed_at: '2026-05-31T09:10:00.000Z',
      reproduce_status: 'reported',
      confidence: 'medium',
      verification_status: 'unverified',
      note: [
        '調査対象: stgアンケート回答画面',
        '実行環境: Chrome headless',
        '確認手順: 必須未入力で送信後、入力して再送信',
        '根拠: console errorなし、送信イベント後の画面遷移なし',
        '推論: バリデーション解除後のsubmit状態更新漏れの可能性',
        '限界: AI観測のため人間確認待ち'
      ].join('\n')
    }
  });
  dataSet = applyPromoteObservationToCase(dataSet, {
    observation_id: 'OBS-DEMO-HUMAN-001',
    case: {
      case_id: 'BUG-DEMO-001',
      title: '必須エラー後に回答送信できない',
      status: 'confirmed',
      severity: 'High',
      environment: 'stg',
      screen: 'アンケート回答',
      symptom_key: 'answer-submit-after-required-error',
      summary: '必須エラー表示後に入力を修正しても回答送信が進まない。',
      expected: '必須項目を入力後、回答を送信して完了画面へ遷移する。',
      actual: '送信ボタン押下後に画面遷移せず、回答完了にならない。'
    },
    actor_role: 'QA'
  });
  return dataSet;
}

export function getRowsForResource(dataSet, resource) {
  const key = RESOURCE_TO_STATE_KEY[resource];
  return key ? cloneDataSet(dataSet)[key] : [];
}

export function applyAppendObservation(dataSet, payload = {}) {
  const nextDataSet = cloneDataSet(dataSet);
  const observation = normalizeObservation({
    observation_id: payload.observation?.observation_id || createLocalId('OBS'),
    observed_at: payload.observation?.observed_at || nowIso(),
    ...payload.observation
  });
  const evidenceRows = (Array.isArray(payload.evidence) ? payload.evidence : payload.evidence ? [payload.evidence] : [])
    .map(evidence => normalizeEvidence({
      evidence_id: evidence.evidence_id || createLocalId('EVD'),
      observation_id: evidence.observation_id || observation.observation_id,
      ...evidence
    }))
    .filter(evidence => evidence.evidence_id && evidence.observation_id && evidence.url_or_path);

  let updatedDataSet = {
    ...nextDataSet,
    defect_observations: upsertByKey(nextDataSet.defect_observations, observation, 'observation_id')
  };
  evidenceRows.forEach(evidence => {
    updatedDataSet = {
      ...updatedDataSet,
      defect_evidence: upsertByKey(updatedDataSet.defect_evidence, evidence, 'evidence_id')
    };
  });
  return appendLocalEvent(updatedDataSet, {
    case_id: observation.case_id,
    observation_id: observation.observation_id,
    event_type: 'observation_appended',
    actor_role: observation.source_role || observation.source_type,
    note: observation.source_type === 'ai' ? 'AI observation registered as unverified.' : 'Human observation registered.'
  });
}

export function applyPromoteObservationToCase(dataSet, payload = {}) {
  const now = nowIso();
  const nextDataSet = cloneDataSet(dataSet);
  const existingCase = nextDataSet.defect_cases.find(defectCase => defectCase.case_id === payload.case?.case_id);
  const defectCase = normalizeCase({
    case_id: payload.case?.case_id || createLocalId('BUG'),
    created_at: existingCase?.created_at || now,
    updated_at: now,
    ...payload.case
  });
  const observations = nextDataSet.defect_observations.map(observation => {
    if (!payload.observation_id || observation.observation_id !== payload.observation_id) {
      return observation;
    }
    return normalizeObservation({
      ...observation,
      case_id: defectCase.case_id,
      verification_status: observation.source_type === 'ai'
        ? observation.verification_status || 'unverified'
        : observation.verification_status || 'confirmed'
    });
  });
  return appendLocalEvent({
    ...nextDataSet,
    defect_cases: upsertByKey(nextDataSet.defect_cases, defectCase, 'case_id'),
    defect_observations: observations
  }, {
    case_id: defectCase.case_id,
    observation_id: payload.observation_id || '',
    event_type: 'case_promoted',
    actor_role: payload.actor_role || 'QA',
    note: 'Observation promoted to representative defect case.'
  });
}

export function applyLinkBacklogIssue(dataSet, payload = {}) {
  const nextDataSet = cloneDataSet(dataSet);
  const caseId = String(payload.case_id || '').trim();
  const backlogKey = String(payload.backlog_key || '').trim();
  const defectCase = nextDataSet.defect_cases.find(item => item.case_id === caseId);
  if (!defectCase || !backlogKey) {
    return nextDataSet;
  }
  const linkedCase = normalizeCase({
    ...defectCase,
    status: 'backlog_linked',
    backlog_key: backlogKey,
    updated_at: nowIso()
  });
  return appendLocalEvent({
    ...nextDataSet,
    defect_cases: upsertByKey(nextDataSet.defect_cases, linkedCase, 'case_id')
  }, {
    case_id: caseId,
    event_type: 'backlog_linked',
    actor_role: payload.actor_role || 'QA',
    note: backlogKey
  });
}

export function applyMergeCases(dataSet, payload = {}) {
  const nextDataSet = cloneDataSet(dataSet);
  const sourceCaseId = String(payload.source_case_id || '').trim();
  const targetCaseId = String(payload.target_case_id || '').trim();
  const sourceCase = nextDataSet.defect_cases.find(item => item.case_id === sourceCaseId);
  const targetCase = nextDataSet.defect_cases.find(item => item.case_id === targetCaseId);
  if (!sourceCase || !targetCase || sourceCaseId === targetCaseId) {
    return nextDataSet;
  }
  const duplicateCase = normalizeCase({
    ...sourceCase,
    status: 'duplicate',
    duplicate_of_case_id: targetCaseId,
    updated_at: nowIso()
  });
  return appendLocalEvent({
    ...nextDataSet,
    defect_cases: upsertByKey(nextDataSet.defect_cases, duplicateCase, 'case_id')
  }, {
    case_id: sourceCaseId,
    event_type: 'case_merged',
    actor_role: payload.actor_role || 'QA',
    note: `merged into ${targetCaseId}${payload.note ? `: ${payload.note}` : ''}`
  });
}

export function applyAppendTriageEvent(dataSet, payload = {}) {
  return appendLocalEvent(cloneDataSet(dataSet), payload.event || payload);
}

export function isAiObservation(observation) {
  return normalizeText(observation?.source_type) === 'ai';
}

export function isConfirmedObservation(observation) {
  return normalizeText(observation?.verification_status) === 'confirmed';
}

export function isHumanObservation(observation) {
  return normalizeText(observation?.source_type) === 'human';
}

export function isBacklogEligible(defectCase, observations = []) {
  const normalizedCase = normalizeCase(defectCase);
  if (!normalizedCase.case_id || normalizedCase.status === 'duplicate' || normalizedCase.status === 'rejected') {
    return false;
  }

  const linked = observations
    .map(normalizeObservation)
    .filter(observation => observation.case_id === normalizedCase.case_id);

  if (linked.length === 0) {
    return normalizedCase.status === 'confirmed' || normalizedCase.status === 'backlog_linked';
  }

  return linked.some(observation => isConfirmedObservation(observation) && isHumanObservation(observation));
}

export function getBacklogBlockReason(defectCase, observations = []) {
  const normalizedCase = normalizeCase(defectCase);
  if (!normalizedCase.case_id) {
    return '代表ケースIDがありません。';
  }
  if (normalizedCase.status === 'duplicate') {
    return '重複ケースは代表課題の本文生成対象外です。';
  }
  if (normalizedCase.status === 'rejected') {
    return '却下済みケースはBacklog本文生成対象外です。';
  }
  if (!isBacklogEligible(normalizedCase, observations)) {
    return '未確認AI観測のみ、または人間確認済み観測がないためBacklog本文を生成しません。';
  }
  return '';
}

export function filterCases(cases = [], query = '') {
  const keyword = normalizeText(query);
  const normalizedCases = cases.map(normalizeCase);
  if (!keyword) {
    return normalizedCases;
  }

  return normalizedCases.filter(defectCase => [
    defectCase.case_id,
    defectCase.title,
    defectCase.status,
    defectCase.severity,
    defectCase.environment,
    defectCase.screen,
    defectCase.symptom_key,
    defectCase.summary,
    defectCase.backlog_key
  ].some(value => normalizeText(value).includes(keyword)));
}

export function groupByCaseId(observations = []) {
  return observations.map(normalizeObservation).reduce((accumulator, observation) => {
    const key = observation.case_id || '__unlinked__';
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(observation);
    return accumulator;
  }, {});
}

export function evidenceByObservationId(evidenceRows = []) {
  return evidenceRows.map(normalizeEvidence).reduce((accumulator, evidence) => {
    const key = evidence.observation_id || '__unlinked__';
    if (!accumulator[key]) {
      accumulator[key] = [];
    }
    accumulator[key].push(evidence);
    return accumulator;
  }, {});
}

export function makeBacklogTitle(defectCase) {
  const normalizedCase = normalizeCase(defectCase);
  return `[不具合][${valueOrDash(normalizedCase.environment)}][${valueOrDash(normalizedCase.screen)}] ${valueOrDash(normalizedCase.title)}`;
}

function renderObservationLines(observations) {
  if (!observations.length) {
    return '- 未登録';
  }

  return observations.map(observation => {
    const source = observation.source_type === 'ai'
      ? `AI agent${observation.agent_run_id ? ` / ${observation.agent_run_id}` : ''}`
      : valueOrDash(observation.source_role);
    const verification = VERIFICATION_LABELS[observation.verification_status] || valueOrDash(observation.verification_status);
    const reproduce = valueOrDash(observation.reproduce_status);
    const noteLines = splitLines(observation.note).map(line => `  - ${line}`).join('\n');
    return [
      `- ${valueOrDash(observation.observed_at)} / ${source} / 再現: ${reproduce} / 確認: ${verification}`,
      noteLines
    ].filter(Boolean).join('\n');
  }).join('\n');
}

function renderEvidenceLines(evidenceRows) {
  if (!evidenceRows.length) {
    return '- 未登録';
  }

  return evidenceRows.map(evidence => [
    `- ${valueOrDash(evidence.type)}: ${valueOrDash(evidence.url_or_path)}`,
    `  - 概要: ${valueOrDash(evidence.summary)}`,
    `  - マスク状態: ${valueOrDash(evidence.redaction_status)}`
  ].join('\n')).join('\n');
}

export function buildBacklogBody(defectCase, observations = [], evidenceRows = []) {
  const normalizedCase = normalizeCase(defectCase);
  const linkedObservations = observations
    .map(normalizeObservation)
    .filter(observation => observation.case_id === normalizedCase.case_id);
  const linkedObservationIds = new Set(linkedObservations.map(observation => observation.observation_id));
  const linkedEvidence = evidenceRows
    .map(normalizeEvidence)
    .filter(evidence => linkedObservationIds.has(evidence.observation_id));

  return [
    '## 概要',
    valueOrDash(normalizedCase.summary),
    '',
    '## 発生環境',
    `- 環境: ${valueOrDash(normalizedCase.environment)}`,
    `- 画面/機能: ${valueOrDash(normalizedCase.screen)}`,
    `- 症状キー: ${valueOrDash(normalizedCase.symptom_key)}`,
    `- 深刻度: ${valueOrDash(SEVERITY_LABELS[normalizedCase.severity] || normalizedCase.severity)}`,
    '',
    '## 再現・観測',
    renderObservationLines(linkedObservations),
    '',
    '## 期待結果',
    valueOrDash(normalizedCase.expected),
    '',
    '## 実際結果',
    valueOrDash(normalizedCase.actual),
    '',
    '## 証跡',
    renderEvidenceLines(linkedEvidence),
    '',
    '## 切り分け状況',
    '- DB受付正本からBacklog対応課題として起票。',
    '- AI観測は人間確認済みのものだけ本文生成対象。',
    '',
    '## 関連DB',
    `- case_id: ${valueOrDash(normalizedCase.case_id)}`,
    `- backlog_key: ${valueOrDash(normalizedCase.backlog_key)}`,
    `- duplicate_of_case_id: ${valueOrDash(normalizedCase.duplicate_of_case_id)}`
  ].join('\n');
}

export function buildJsonpUrl(baseUrl, resource, callbackName) {
  const url = new URL(baseUrl);
  url.searchParams.set('resource', resource);
  if (callbackName) {
    url.searchParams.set('callback', callbackName);
  }
  return url.toString();
}

export function buildPostBody(action, payload = {}) {
  return JSON.stringify({ action, payload });
}

export function createLocalId(prefix) {
  const now = new Date();
  const compact = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${compact}-${random}`;
}
