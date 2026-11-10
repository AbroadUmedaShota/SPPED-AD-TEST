/**
 * SPEED AD support contact viewer.
 *
 * Script Properties:
 *   SPREADSHEET_ID
 *   DRIVE_FOLDER_ID
 *   CONTACT_SHEET_NAME
 */

var DEFAULT_SHEET_NAME = 'contact_submissions';
var VIEWER_STATUSES = ['未対応', '対応中', '対応済み', '保留'];
var CONTACT_HEADERS = [
  'submission_id',
  'submitted_at',
  'contact_type',
  'name',
  'email',
  'subject',
  'message',
  'attachment_count',
  'attachment_refs',
  'source_url',
  'user_agent',
  'storage_status',
  'mail_status',
  'handled_status',
  'handled_by',
  'handled_at',
  'internal_note'
];

function doGet(e) {
  var params = (e && e.parameter) || {};
  if ('code' in params || 'state' in params || 'error' in params || 'id_token' in params || 'access_token' in params) {
    var callback = {};
    var invalid = 'id_token' in params || 'access_token' in params;
    ['code', 'state', 'error'].forEach(function (key) {
      if (e.parameters && e.parameters[key] && e.parameters[key].length !== 1) invalid = true;
      if (typeof params[key] === 'string') callback[key] = params[key].slice(0, 4096);
    });
    // Callback GET never consumes state, exchanges code, issues grant, or reads contact data.
    return renderLogin_('', invalid ? { invalid: true } : callback, params.authuser);
  }
  if (params.login === 'google') return renderLogin_(String(params.id || '').slice(0, 256), null, params.authuser);
  var email = getActiveUserEmail_();
  var template = HtmlService.createTemplateFromFile('Index');
  template.initialSubmissionId = String(params.id || '');
  // External GET is only a data-free shell. Its first RPC must prove the tab secret.
  template.viewerContext = /^[^\s@]+@abroad-o\.com$/.test(email) ? getViewerContext_() : {};
  template.loginStartUrl = customerLoginStartUrl_(params.id, params.authuser);
  return template.evaluate().setTitle('SPEED AD お問い合わせ確認（社内）');
}

function getViewerContext(authProof) {
  return requireViewer_(authProof);
}

function listContactSubmissions(options, authProof) {
  var context = requireViewer_(authProof);
  options = options || {};
  var statusFilter = String(options.status || '').trim();
  var query = String(options.query || '').toLowerCase().trim();
  var requestedSize = Number(options.pageSize == null ? (options.limit || 100) : options.pageSize);
  var limit = Number.isFinite(requestedSize) ? Math.min(Math.max(Math.floor(requestedSize), 1), 200) : 50;
  var cursor = parseSubmissionPageToken_(options.pageToken, statusFilter, query);
  var sheet = getSheet_();
  var headers = ensureHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  var records = [];
  var counts = {
    total: 0,
    active: 0
  };

  VIEWER_STATUSES.forEach(function (status) {
    counts[status] = 0;
  });

  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    var record = rowToRecord_(headers, values[rowIndex], rowIndex + 1);
    if (!String(record.submission_id || '').trim()) continue;
    record.handled_status = normalizeHandledStatus_(record.handled_status);
    counts.total += 1;
    if (isActiveStatus_(record.handled_status)) {
      counts.active += 1;
    }
    if (counts[record.handled_status] != null) {
      counts[record.handled_status] += 1;
    }
    if (query && !matchesQuery_(record, query)) continue;
    if (statusFilter === 'all') {
      records.push(toSummary_(record));
      continue;
    }
    if (statusFilter === 'active') {
      if (isActiveStatus_(record.handled_status)) {
        records.push(toSummary_(record));
      }
      continue;
    }
    if (statusFilter && record.handled_status !== statusFilter) continue;
    records.push(toSummary_(record));
  }

  records.sort(compareSubmissionOrder_);
  var selectedId = String(options.selectedId || '').trim();
  var selectedMatches = selectedId ? records.some(function (record) { return record.submission_id === selectedId; }) : null;
  if (selectedId && !selectedMatches) cursor = null;
  var start = 0;
  var end = records.length;
  if (cursor) {
    if (cursor.direction === 'after') {
      start = records.findIndex(function (record) { return compareSubmissionOrder_(record, cursor) > 0; });
      if (start === -1) start = records.length;
    } else {
      end = records.findIndex(function (record) { return compareSubmissionOrder_(record, cursor) >= 0; });
      if (end === -1) end = records.length;
      start = Math.max(0, end - limit);
    }
  }
  if (records.length && start >= records.length) start = Math.max(0, records.length - limit);
  if (records.length && end === 0) end = Math.min(limit, records.length);
  var pageRecords = records.slice(start, Math.min(start + limit, end));
  var pageEnd = start + pageRecords.length;

  return {
    ok: true,
    viewerEmail: context.email,
    statuses: VIEWER_STATUSES,
    counts: counts,
    selectedMatches: selectedMatches,
    submissions: pageRecords,
    page: {
      size: limit,
      total: records.length,
      from: pageRecords.length ? start + 1 : 0,
      to: pageEnd,
      previousPageToken: start > 0 ? makeSubmissionPageToken_(pageRecords[0] || cursor, 'before', statusFilter, query) : '',
      nextPageToken: pageEnd < records.length && pageRecords.length ? makeSubmissionPageToken_(pageRecords[pageRecords.length - 1], 'after', statusFilter, query) : ''
    }
  };
}

function compareSubmissionOrder_(a, b) {
  var dateA = String(a.submitted_at || '');
  var dateB = String(b.submitted_at || '');
  if (dateA !== dateB) return dateA < dateB ? 1 : -1;
  var idA = String(a.submission_id || '');
  var idB = String(b.submission_id || '');
  return idA === idB ? 0 : (idA < idB ? 1 : -1);
}

function makeSubmissionPageToken_(record, direction, status, query) {
  return Utilities.base64EncodeWebSafe(JSON.stringify({
    version: 1, direction: direction, status: status, query: query,
    submitted_at: String(record.submitted_at || ''), submission_id: String(record.submission_id || '')
  }), Utilities.Charset.UTF_8);
}

function parseSubmissionPageToken_(token, status, query) {
  if (!token) return null;
  try {
    if (typeof token !== 'string' || token.length > 8192) throw new Error('invalid');
    var cursor = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(token)).getDataAsString());
    if (cursor.version !== 1 || ['after', 'before'].indexOf(cursor.direction) === -1 ||
        cursor.status !== status || cursor.query !== query || typeof cursor.submitted_at !== 'string' ||
        typeof cursor.submission_id !== 'string' || !cursor.submission_id) throw new Error('invalid');
    return cursor;
  } catch (_error) {
    throw new Error('一覧のページ情報が無効です。先頭から読み込み直してください。');
  }
}

function getContactSubmission(submissionId, authProof) {
  requireViewer_(authProof);
  var match = findSubmission_(submissionId);
  if (!match) {
    throw new Error('問い合わせが見つかりません。');
  }
  match.record.attachments = parseAttachmentRefs_(match.record.attachment_refs).map(function (attachment) {
    return enrichAttachment_(attachment, match.record.submission_id);
  });
  return {
    ok: true,
    submission: match.record
  };
}

function getAttachmentPreview(submissionId, fileId, authProof) {
  requireViewer_(authProof);
  var match = findSubmission_(submissionId);
  if (!match) {
    throw new Error('問い合わせが見つかりません。');
  }
  var targetFileId = String(fileId || '').trim();
  var referenced = parseAttachmentRefs_(match.record.attachment_refs).some(function (attachment) {
    return attachment.fileId === targetFileId;
  });
  if (!targetFileId || !referenced) {
    throw new Error('この問い合わせの添付ファイルではありません。');
  }
  var file = DriveApp.getFileById(targetFileId);
  assertAttachmentFile_(file, match.record.submission_id);
  var blob = file.getBlob();
  var mimeType = blob.getContentType();
  if (String(mimeType || '').indexOf('image/') !== 0) {
    throw new Error('画像ファイルではありません。');
  }
  return {
    ok: true,
    fileId: file.getId(),
    name: file.getName(),
    mimeType: mimeType,
    dataUrl: 'data:' + mimeType + ';base64,' + Utilities.base64Encode(blob.getBytes()),
    url: file.getUrl()
  };
}

function updateContactSubmissionStatus(submissionId, status, note, authProof) {
  var context = requireViewer_(authProof);
  var normalizedStatus = String(status || '').trim();
  if (VIEWER_STATUSES.indexOf(normalizedStatus) === -1) {
    throw new Error('対応ステータスが不正です。');
  }

  var sheet = getSheet_();
  var headers = ensureHeaders_(sheet);
  var match = findSubmission_(submissionId, sheet, headers);
  if (!match) {
    throw new Error('問い合わせが見つかりません。');
  }

  var fields = {
    handled_status: normalizedStatus,
    handled_by: context.email,
    handled_at: new Date().toISOString(),
    internal_note: asSheetText_(String(note || '').trim())
  };
  Object.keys(fields).forEach(function (key) {
    var colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      sheet.getRange(match.rowNumber, colIndex + 1).setValue(fields[key]);
    }
  });

  return getContactSubmission(submissionId, authProof);
}

function getViewerContext_(authProof) {
  var email = getActiveUserEmail_();
  var customer = (!email || email === OAUTH_CUSTOMER_EMAIL) ? getCustomerOAuthSession_(authProof) : null;
  if (customer) return customer;
  return {
    email: email,
    allowed: /^[^\s@]+@abroad-o\.com$/.test(email),
    authMode: 'domain'
  };
}

function requireViewer_(authProof) {
  var context = getViewerContext_(authProof);
  if (!context.allowed) {
    throw new Error('このお問い合わせ確認アプリを利用する権限がありません。社員は abroad-o.com のアカウント、customer は通常URLの専用Googleログインで開いてください。');
  }
  return context;
}

function getActiveUserEmail_() {
  try {
    return String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (_err) {
    return '';
  }
}

function asSheetText_(value) {
  // A leading apostrophe prevents a memo from being evaluated as a Sheets formula.
  return /^[=+@-]/.test(value) ? "'" + value : value;
}

function getSheet_() {
  var spreadsheetId = getProperty_('SPREADSHEET_ID', '');
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID が未設定です。');
  }
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheetName = getProperty_('CONTACT_SHEET_NAME', DEFAULT_SHEET_NAME);
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('問い合わせ保存シートが見つかりません。');
  }
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  var lastColumn = Math.max(sheet.getLastColumn(), CONTACT_HEADERS.length);
  var current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function (value) {
    return String(value || '').trim();
  });
  var missing = CONTACT_HEADERS.filter(function (header) {
    return current.indexOf(header) === -1;
  });
  if (missing.length) {
    throw new Error('問い合わせ保存シートの必須列がありません: ' + missing.join(', '));
  }
  return current;
}

function findSubmission_(submissionId, sheet, headers) {
  var targetId = String(submissionId || '').trim();
  if (!targetId) return null;
  sheet = sheet || getSheet_();
  headers = headers || ensureHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  var idIndex = headers.indexOf('submission_id');
  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][idIndex]) === targetId) {
      return {
        rowNumber: rowIndex + 1,
        record: rowToRecord_(headers, values[rowIndex], rowIndex + 1)
      };
    }
  }
  return null;
}

function rowToRecord_(headers, row, rowNumber) {
  var record = { rowNumber: rowNumber };
  headers.forEach(function (header, index) {
    if (!header) return;
    record[header] = normalizeCellValue_(row[index]);
  });
  CONTACT_HEADERS.forEach(function (header) {
    if (record[header] == null) record[header] = '';
  });
  record.attachment_count = Number(record.attachment_count || 0);
  return record;
}

function toSummary_(record) {
  return {
    submission_id: record.submission_id,
    submitted_at: record.submitted_at,
    contact_type: record.contact_type,
    name: record.name,
    email: record.email,
    subject: record.subject,
    attachment_count: record.attachment_count,
    handled_status: record.handled_status || '未対応',
    handled_by: record.handled_by,
    handled_at: record.handled_at
  };
}

function matchesQuery_(record, query) {
  return [
    record.submission_id,
    record.contact_type,
    record.name,
    record.email,
    record.subject,
    record.message
  ].join(' ').toLowerCase().indexOf(query) !== -1;
}

function isActiveStatus_(status) {
  return ['未対応', '対応中'].indexOf(normalizeHandledStatus_(status)) !== -1;
}

function normalizeHandledStatus_(status) {
  var normalized = String(status || '').trim();
  return normalized || '未対応';
}

function parseAttachmentRefs_(value) {
  return String(value || '')
    .split(',')
    .map(function (part) { return part.trim(); })
    .filter(Boolean)
    .map(function (part) {
      var separatorIndex = part.indexOf(':');
      return {
        fileId: separatorIndex === -1 ? part : part.slice(0, separatorIndex),
        url: separatorIndex === -1 ? '' : part.slice(separatorIndex + 1)
      };
    });
}

function enrichAttachment_(attachment, submissionId) {
  try {
    var file = DriveApp.getFileById(attachment.fileId);
    assertAttachmentFile_(file, submissionId);
    var description = parseJson_(file.getDescription());
    return {
      fileId: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      url: file.getUrl(),
      originalName: description.originalName || '',
      originalMimeType: description.originalMimeType || '',
      originalSize: description.originalSize || ''
    };
  } catch (err) {
    return {
      fileId: attachment.fileId,
      name: attachment.fileId,
      mimeType: '',
      size: '',
      url: '',
      error: String(err)
    };
  }
}

function assertAttachmentFile_(file, submissionId) {
  // Sender filenames begin with the submission ID; reject cross-row references too.
  if (!submissionId || file.isTrashed() || String(file.getName() || '').indexOf(submissionId + '-') !== 0) {
    throw new Error('この問い合わせの添付ファイルではありません。');
  }
  var folderId = getProperty_('DRIVE_FOLDER_ID', '');
  if (!folderId) {
    throw new Error('DRIVE_FOLDER_ID が未設定です。');
  }
  var parents = file.getParents();
  while (parents.hasNext()) {
    if (parents.next().getId() === folderId) {
      return;
    }
  }
  throw new Error('添付保存フォルダ外のファイルは表示できません。');
}

function normalizeCellValue_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.toISOString();
  }
  return value == null ? '' : String(value);
}

function parseJson_(value) {
  try {
    return JSON.parse(String(value || '{}'));
  } catch (_err) {
    return {};
  }
}

function getProperty_(key, fallback) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return value == null || value === '' ? fallback : value;
}
