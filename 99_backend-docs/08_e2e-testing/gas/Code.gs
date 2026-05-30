/**
 * SPEED AD E2E scenario execution backend.
 *
 * Setup:
 * 1. Create a Google Spreadsheet for scenario execution management.
 * 2. Deploy as a Web App.
 *
 * GET:
 *   ?resource=scenarios|scenario_steps|scenario_runs|scenario_step_results
 *   Optional JSONP: ?callback=callbackName
 *
 * POST Content-Type:
 *   text/plain;charset=utf-8
 *
 * POST actions:
 *   { action: "createScenarioRun", payload: {...} }
 *   { action: "upsertScenarioStepResult", payload: { results: [...] } }
 *   { action: "replaceScenarioMasters", payload: { scenarios: [...], steps: [...] } }
 */

var DEFAULT_SPREADSHEET_ID = '16aPp9PVFlkfBhhirmP0nG7P09oImGXhrSTrraLLYK9M';

var SHEET_DEFINITIONS = {
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

    if (action === 'replaceScenarioMasters') {
      replaceRows_(SHEET_DEFINITIONS.scenarios, (payload.scenarios || []).map(normalizeScenario_));
      replaceRows_(SHEET_DEFINITIONS.scenario_steps, (payload.steps || []).map(normalizeStep_));
      return jsonOut_({ ok: true, action: action, updatedAt: new Date().toISOString() });
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
