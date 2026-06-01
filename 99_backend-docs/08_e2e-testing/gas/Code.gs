/**
 * SPEED AD shared mock DB backend.
 *
 * Setup:
 * 1. Use the SPEED AD shared mock DB Spreadsheet.
 * 2. Deploy as a Web App.
 *
 * GET:
 *   ?resource=e2e_cases|scenarios|scenario_steps|scenario_runs|scenario_step_results
 *   ?resource=defect_cases|defect_observations|defect_evidence|triage_events
 *   Optional JSONP: ?callback=callbackName
 *
 * POST Content-Type:
 *   text/plain;charset=utf-8
 *
 * POST actions:
 *   { action: "replaceE2eCaseMasters", payload: { cases: [...] } }
 *   { action: "createScenarioRun", payload: {...} }
 *   { action: "upsertScenarioStepResult", payload: { results: [...] } }
 *   { action: "replaceScenarioMasters", payload: { scenarios: [...], steps: [...] } }
 *   { action: "appendObservation", payload: { observation: {...}, evidence: [...] } }
 *   { action: "promoteObservationToCase", payload: { observation_id, case: {...}, actor_role } }
 *   { action: "linkBacklogIssue", payload: { case_id, backlog_key, actor_role } }
 *   { action: "mergeCases", payload: { source_case_id, target_case_id, note, actor_role } }
 *   { action: "appendTriageEvent", payload: { event: {...} } }
 */

var DEFAULT_SPREADSHEET_ID = '16aPp9PVFlkfBhhirmP0nG7P09oImGXhrSTrraLLYK9M';

var SHEET_DEFINITIONS = {
  e2e_cases: {
    name: 'e2e_cases',
    headers: [
      'case_id',
      'group',
      'screen',
      'route',
      'title',
      'preconditions',
      'steps',
      'expected',
      'priority',
      'side_effect',
      'evidence',
      'parent_case_id',
      'data_source',
      'note',
      'active'
    ],
    keyColumns: ['case_id']
  },
  scenarios: {
    name: 'scenarios',
    headers: [
      'scenario_id',
      'title',
      'role_scope',
      'scenario_group',
      'priority',
      'side_effect',
      'start_url',
      'objective',
      'linked_case_ids',
      'stg_observation_status',
      'expected_outcome',
      'evidence_policy',
      'notes',
      'active'
    ],
    keyColumns: ['scenario_id']
  },
  scenario_steps: {
    name: 'scenario_steps',
    headers: [
      'scenario_id',
      'step_id',
      'step_no',
      'action',
      'expected',
      'side_effect',
      'requires_permission',
      'linked_case_ids',
      'active'
    ],
    keyColumns: ['scenario_id', 'step_id']
  },
  scenario_runs: {
    name: 'scenario_runs',
    headers: [
      'run_id',
      'environment',
      'base_url',
      'tester',
      'browser',
      'viewport',
      'started_at',
      'ended_at',
      'note'
    ],
    keyColumns: ['run_id']
  },
  scenario_step_results: {
    name: 'scenario_step_results',
    headers: [
      'run_id',
      'scenario_id',
      'step_id',
      'status',
      'actual',
      'evidence_url',
      'checked_at',
      'checked_by',
      'defect_link',
      'note'
    ],
    keyColumns: ['run_id', 'scenario_id', 'step_id']
  },
  defect_cases: {
    name: 'defect_cases',
    headers: [
      'case_id',
      'title',
      'status',
      'severity',
      'environment',
      'screen',
      'symptom_key',
      'summary',
      'expected',
      'actual',
      'backlog_key',
      'duplicate_of_case_id',
      'created_at',
      'updated_at'
    ],
    keyColumns: ['case_id']
  },
  defect_observations: {
    name: 'defect_observations',
    headers: [
      'observation_id',
      'case_id',
      'source_type',
      'source_role',
      'agent_run_id',
      'observed_at',
      'reproduce_status',
      'confidence',
      'verification_status',
      'note'
    ],
    keyColumns: ['observation_id']
  },
  defect_evidence: {
    name: 'defect_evidence',
    headers: [
      'evidence_id',
      'observation_id',
      'type',
      'url_or_path',
      'summary',
      'redaction_status'
    ],
    keyColumns: ['evidence_id']
  },
  triage_events: {
    name: 'triage_events',
    headers: [
      'event_id',
      'case_id',
      'observation_id',
      'event_type',
      'actor_role',
      'note',
      'created_at'
    ],
    keyColumns: ['event_id']
  }
};

function doGet(e) {
  var callback = getCallback_(e);
  try {
    var resource = String((e && e.parameter && e.parameter.resource) || 'scenarios');
    var definition = SHEET_DEFINITIONS[resource];
    if (!definition) {
      throw new Error('Unknown resource: ' + resource);
    }
    ensureSheets_();
    return jsonOut_({
      ok: true,
      resource: resource,
      data: readRows_(definition),
      fetchedAt: new Date().toISOString()
    }, callback);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) }, callback);
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var gotLock = false;
  try {
    gotLock = lock.tryLock(10000);
    if (!gotLock) {
      return jsonOut_({ ok: false, error: 'busy' });
    }

    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var action = String(body.action || '');
    var payload = body.payload || {};

    ensureSheets_();

    if (action === 'createScenarioRun') {
      var run = normalizeRun_(payload);
      upsertRows_(SHEET_DEFINITIONS.scenario_runs, [run]);
      return jsonOut_({ ok: true, action: action, run_id: run.run_id, updatedAt: new Date().toISOString() });
    }

    if (action === 'upsertScenarioStepResult') {
      var results = payload.results || [];
      if (!Array.isArray(results)) {
        results = [results];
      }
      var rows = results.map(normalizeResult_).filter(function (row) {
        return row.run_id && row.scenario_id && row.step_id;
      });
      upsertRows_(SHEET_DEFINITIONS.scenario_step_results, rows);
      return jsonOut_({ ok: true, action: action, updated: rows.length, updatedAt: new Date().toISOString() });
    }

    if (action === 'replaceE2eCaseMasters') {
      replaceRows_(SHEET_DEFINITIONS.e2e_cases, (payload.cases || payload.test_cases || []).map(normalizeE2eCase_));
      return jsonOut_({ ok: true, action: action, updatedAt: new Date().toISOString() });
    }

    if (action === 'replaceScenarioMasters') {
      replaceRows_(SHEET_DEFINITIONS.scenarios, (payload.scenarios || []).map(normalizeScenario_));
      replaceRows_(SHEET_DEFINITIONS.scenario_steps, (payload.steps || []).map(normalizeStep_));
      return jsonOut_({ ok: true, action: action, updatedAt: new Date().toISOString() });
    }

    if (action === 'appendObservation') {
      return handleAppendObservation_(payload);
    }

    if (action === 'promoteObservationToCase') {
      return handlePromoteObservationToCase_(payload);
    }

    if (action === 'linkBacklogIssue') {
      return handleLinkBacklogIssue_(payload);
    }

    if (action === 'mergeCases') {
      return handleMergeCases_(payload);
    }

    if (action === 'appendTriageEvent') {
      var event = normalizeTriageEvent_(payload.event || payload);
      upsertRows_(SHEET_DEFINITIONS.triage_events, [event]);
      return jsonOut_({ ok: true, action: action, event_id: event.event_id, updatedAt: new Date().toISOString() });
    }

    throw new Error('Unknown action: ' + action);
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    if (gotLock) {
      lock.releaseLock();
    }
  }
}

function setupScenarioSheets() {
  ensureSheets_();
}

function setupDefectSheets() {
  ensureSheets_();
}

function initializeDefectDb() {
  ensureSheets_();
  var spreadsheet = getSpreadsheet_();
  return {
    spreadsheetId: spreadsheet.getId(),
    spreadsheetUrl: spreadsheet.getUrl()
  };
}

function setSpreadsheetId(spreadsheetId) {
  if (!spreadsheetId) {
    throw new Error('spreadsheetId is required.');
  }
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', spreadsheetId);
}

function getSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('Script property SPREADSHEET_ID is not set.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureSheets_() {
  var spreadsheet = getSpreadsheet_();
  Object.keys(SHEET_DEFINITIONS).forEach(function (resource) {
    var definition = SHEET_DEFINITIONS[resource];
    var sheet = spreadsheet.getSheetByName(definition.name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(definition.name);
    }
    ensureHeader_(sheet, definition.headers);
  });
}

function ensureHeader_(sheet, headers) {
  var currentLastColumn = Math.max(sheet.getLastColumn(), headers.length);
  var current = sheet.getRange(1, 1, 1, currentLastColumn).getValues()[0];
  var needsHeader = false;
  for (var i = 0; i < headers.length; i++) {
    if (String(current[i] || '') !== headers[i]) {
      needsHeader = true;
      break;
    }
  }
  if (needsHeader) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function readRows_(definition) {
  var sheet = getSpreadsheet_().getSheetByName(definition.name);
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, definition.headers.length).getValues();
  return values.map(function (row) {
    var item = {};
    definition.headers.forEach(function (header, index) {
      item[header] = serializeCell_(row[index]);
    });
    return item;
  }).filter(function (item) {
    return item.active !== 'FALSE' && item.active !== false && item[definition.keyColumns[0]];
  });
}

function replaceRows_(definition, rows) {
  var sheet = getSpreadsheet_().getSheetByName(definition.name);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, definition.headers.length).clearContent();
  }
  appendRows_(definition, rows);
}

function upsertRows_(definition, rows) {
  if (!rows.length) {
    return;
  }
  var sheet = getSpreadsheet_().getSheetByName(definition.name);
  var keyToRow = {};
  if (sheet.getLastRow() >= 2) {
    var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, definition.headers.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var existing = {};
      definition.headers.forEach(function (header, index) {
        existing[header] = values[i][index];
      });
      keyToRow[buildKey_(definition, existing)] = i + 2;
    }
  }

  var appends = [];
  rows.forEach(function (row) {
    var key = buildKey_(definition, row);
    if (!key) {
      return;
    }
    var values = toRowValues_(definition, row);
    if (keyToRow[key]) {
      sheet.getRange(keyToRow[key], 1, 1, definition.headers.length).setValues([values]);
    } else {
      appends.push(row);
    }
  });
  appendRows_(definition, appends);
}

function appendRows_(definition, rows) {
  if (!rows.length) {
    return;
  }
  var sheet = getSpreadsheet_().getSheetByName(definition.name);
  var values = rows.map(function (row) {
    return toRowValues_(definition, row);
  });
  sheet.getRange(sheet.getLastRow() + 1, 1, values.length, definition.headers.length).setValues(values);
}

function toRowValues_(definition, row) {
  return definition.headers.map(function (header) {
    var value = row[header];
    if (Array.isArray(value)) {
      return value.join(',');
    }
    if (value === true) {
      return 'TRUE';
    }
    if (value === false) {
      return 'FALSE';
    }
    return value == null ? '' : value;
  });
}

function buildKey_(definition, row) {
  return definition.keyColumns.map(function (column) {
    return String(row[column] || '').trim();
  }).join('::');
}

function normalizeScenario_(row) {
  return {
    scenario_id: row.scenario_id || '',
    title: row.title || '',
    role_scope: row.role_scope || '',
    scenario_group: row.scenario_group || '',
    priority: row.priority || '',
    side_effect: row.side_effect || '',
    start_url: row.start_url || '',
    objective: row.objective || '',
    linked_case_ids: row.linked_case_ids || '',
    stg_observation_status: row.stg_observation_status || '',
    expected_outcome: row.expected_outcome || '',
    evidence_policy: row.evidence_policy || '',
    notes: row.notes || '',
    active: row.active == null ? 'TRUE' : row.active
  };
}

function normalizeE2eCase_(row) {
  return {
    case_id: row.case_id || row.id || '',
    group: row.group || '',
    screen: row.screen || '',
    route: row.route || '',
    title: row.title || '',
    preconditions: row.preconditions || '',
    steps: Array.isArray(row.steps) ? row.steps.join('\n') : (row.steps || ''),
    expected: row.expected || '',
    priority: row.priority || 'P2',
    side_effect: row.side_effect || row.sideEffect || 'none',
    evidence: row.evidence || '',
    parent_case_id: row.parent_case_id || row.parentId || '',
    data_source: row.data_source || row.dataSource || '',
    note: row.note || '',
    active: row.active == null ? 'TRUE' : row.active
  };
}

function normalizeStep_(row) {
  return {
    scenario_id: row.scenario_id || '',
    step_id: row.step_id || '',
    step_no: row.step_no || '',
    action: row.action || '',
    expected: row.expected || '',
    side_effect: row.side_effect || '',
    requires_permission: row.requires_permission == null ? 'FALSE' : row.requires_permission,
    linked_case_ids: row.linked_case_ids || '',
    active: row.active == null ? 'TRUE' : row.active
  };
}

function normalizeRun_(payload) {
  return {
    run_id: payload.run_id || Utilities.getUuid(),
    environment: payload.environment || 'stg',
    base_url: payload.base_url || 'https://stg.speed-ad.com/',
    tester: payload.tester || '',
    browser: payload.browser || '',
    viewport: payload.viewport || '',
    started_at: payload.started_at || new Date().toISOString(),
    ended_at: payload.ended_at || '',
    note: payload.note || ''
  };
}

function normalizeResult_(payload) {
  return {
    run_id: payload.run_id || '',
    scenario_id: payload.scenario_id || '',
    step_id: payload.step_id || '',
    status: payload.status || '未実行',
    actual: payload.actual || '',
    evidence_url: payload.evidence_url || '',
    checked_at: payload.checked_at || new Date().toISOString(),
    checked_by: payload.checked_by || '',
    defect_link: payload.defect_link || '',
    note: payload.note || ''
  };
}

function handleAppendObservation_(payload) {
  var observation = normalizeObservation_(payload.observation || payload);
  upsertRows_(SHEET_DEFINITIONS.defect_observations, [observation]);

  var evidence = payload.evidence || [];
  if (!Array.isArray(evidence)) {
    evidence = [evidence];
  }
  var evidenceRows = evidence.map(function (row) {
    return normalizeEvidence_(row, observation.observation_id);
  }).filter(function (row) {
    return row.evidence_id && row.observation_id && row.url_or_path;
  });
  upsertRows_(SHEET_DEFINITIONS.defect_evidence, evidenceRows);

  appendDefectEvent_({
    case_id: observation.case_id,
    observation_id: observation.observation_id,
    event_type: 'observation_appended',
    actor_role: observation.source_role || observation.source_type,
    note: observation.source_type === 'ai' ? 'AI observation registered as unverified.' : 'Human observation registered.'
  });

  return jsonOut_({
    ok: true,
    action: 'appendObservation',
    observation_id: observation.observation_id,
    evidence: evidenceRows.length,
    updatedAt: new Date().toISOString()
  });
}

function handlePromoteObservationToCase_(payload) {
  var now = new Date().toISOString();
  var defectCase = normalizeCase_(payload.case || payload, now);
  upsertRows_(SHEET_DEFINITIONS.defect_cases, [defectCase]);

  var observationId = String(payload.observation_id || '').trim();
  if (observationId) {
    var observation = findRowByKey_(SHEET_DEFINITIONS.defect_observations, observationId);
    if (observation) {
      observation.case_id = defectCase.case_id;
      if (observation.source_type !== 'ai' && !observation.verification_status) {
        observation.verification_status = 'confirmed';
      }
      upsertRows_(SHEET_DEFINITIONS.defect_observations, [normalizeObservation_(observation)]);
    }
  }

  appendDefectEvent_({
    case_id: defectCase.case_id,
    observation_id: observationId,
    event_type: 'case_promoted',
    actor_role: payload.actor_role || 'QA',
    note: 'Observation promoted to representative defect case.'
  });

  return jsonOut_({
    ok: true,
    action: 'promoteObservationToCase',
    case_id: defectCase.case_id,
    updatedAt: now
  });
}

function handleLinkBacklogIssue_(payload) {
  var caseId = String(payload.case_id || '').trim();
  var backlogKey = String(payload.backlog_key || '').trim();
  if (!caseId || !backlogKey) {
    throw new Error('case_id and backlog_key are required.');
  }

  var defectCase = findRowByKey_(SHEET_DEFINITIONS.defect_cases, caseId);
  if (!defectCase) {
    throw new Error('case not found: ' + caseId);
  }
  defectCase.backlog_key = backlogKey;
  defectCase.status = 'backlog_linked';
  defectCase.updated_at = new Date().toISOString();
  upsertRows_(SHEET_DEFINITIONS.defect_cases, [normalizeCase_(defectCase)]);

  appendDefectEvent_({
    case_id: caseId,
    event_type: 'backlog_linked',
    actor_role: payload.actor_role || 'QA',
    note: backlogKey
  });

  return jsonOut_({
    ok: true,
    action: 'linkBacklogIssue',
    case_id: caseId,
    backlog_key: backlogKey,
    updatedAt: new Date().toISOString()
  });
}

function handleMergeCases_(payload) {
  var sourceCaseId = String(payload.source_case_id || '').trim();
  var targetCaseId = String(payload.target_case_id || '').trim();
  if (!sourceCaseId || !targetCaseId) {
    throw new Error('source_case_id and target_case_id are required.');
  }
  if (sourceCaseId === targetCaseId) {
    throw new Error('source and target case must be different.');
  }

  var sourceCase = findRowByKey_(SHEET_DEFINITIONS.defect_cases, sourceCaseId);
  if (!sourceCase) {
    throw new Error('source case not found: ' + sourceCaseId);
  }
  if (!findRowByKey_(SHEET_DEFINITIONS.defect_cases, targetCaseId)) {
    throw new Error('target case not found: ' + targetCaseId);
  }

  sourceCase.status = 'duplicate';
  sourceCase.duplicate_of_case_id = targetCaseId;
  sourceCase.updated_at = new Date().toISOString();
  upsertRows_(SHEET_DEFINITIONS.defect_cases, [normalizeCase_(sourceCase)]);

  appendDefectEvent_({
    case_id: sourceCaseId,
    event_type: 'case_merged',
    actor_role: payload.actor_role || 'QA',
    note: 'merged into ' + targetCaseId + (payload.note ? ': ' + payload.note : '')
  });

  return jsonOut_({
    ok: true,
    action: 'mergeCases',
    source_case_id: sourceCaseId,
    target_case_id: targetCaseId,
    updatedAt: new Date().toISOString()
  });
}

function normalizeCase_(row, defaultCreatedAt) {
  var now = new Date().toISOString();
  return {
    case_id: String(row.case_id || createId_('BUG')).trim(),
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
    created_at: String(row.created_at || defaultCreatedAt || now),
    updated_at: now
  };
}

function normalizeObservation_(row) {
  var sourceType = String(row.source_type || 'human').trim();
  return {
    observation_id: String(row.observation_id || createId_('OBS')).trim(),
    case_id: String(row.case_id || '').trim(),
    source_type: sourceType,
    source_role: String(sourceType === 'ai' ? 'AI agent' : (row.source_role || '')).trim(),
    agent_run_id: String(sourceType === 'ai' ? (row.agent_run_id || '') : '').trim(),
    observed_at: String(row.observed_at || new Date().toISOString()).trim(),
    reproduce_status: String(row.reproduce_status || 'reported').trim(),
    confidence: String(row.confidence || '').trim(),
    verification_status: String(sourceType === 'ai' ? 'unverified' : (row.verification_status || 'unverified')).trim(),
    note: String(row.note || '').trim()
  };
}

function normalizeEvidence_(row, fallbackObservationId) {
  return {
    evidence_id: String(row.evidence_id || createId_('EVD')).trim(),
    observation_id: String(row.observation_id || fallbackObservationId || '').trim(),
    type: String(row.type || 'note').trim(),
    url_or_path: String(row.url_or_path || '').trim(),
    summary: String(row.summary || '').trim(),
    redaction_status: String(row.redaction_status || 'unknown').trim()
  };
}

function normalizeTriageEvent_(row) {
  return {
    event_id: String(row.event_id || createId_('EVT')).trim(),
    case_id: String(row.case_id || '').trim(),
    observation_id: String(row.observation_id || '').trim(),
    event_type: String(row.event_type || 'note').trim(),
    actor_role: String(row.actor_role || '').trim(),
    note: String(row.note || '').trim(),
    created_at: String(row.created_at || new Date().toISOString()).trim()
  };
}

function appendDefectEvent_(row) {
  upsertRows_(SHEET_DEFINITIONS.triage_events, [normalizeTriageEvent_(row)]);
}

function findRowByKey_(definition, key) {
  var rows = readRows_(definition);
  for (var i = 0; i < rows.length; i++) {
    if (buildKey_(definition, rows[i]) === String(key || '').trim()) {
      return rows[i];
    }
  }
  return null;
}

function createId_(prefix) {
  var compact = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMddHHmmss');
  var random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return prefix + '-' + compact + '-' + random;
}

function serializeCell_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value.toISOString();
  }
  return value == null ? '' : value;
}

function getCallback_(e) {
  var callback = (e && e.parameter && e.parameter.callback) ? String(e.parameter.callback) : '';
  if (callback && !/^[A-Za-z_$][A-Za-z0-9_$.]*$/.test(callback)) {
    callback = '';
  }
  return callback;
}

function jsonOut_(obj, callback) {
  var body = JSON.stringify(obj);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + body + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}
