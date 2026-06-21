/**
 * SPEED AD support contact viewer.
 *
 * Script Properties:
 *   SPREADSHEET_ID
 *   DRIVE_FOLDER_ID
 *   CONTACT_SHEET_NAME
 *   CONTACT_VIEWER_EMAILS
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
  var template = HtmlService.createTemplateFromFile('Index');
  template.initialSubmissionId = String((e && e.parameter && e.parameter.id) || '');
  template.viewerContext = getViewerContext_();
  return template
    .evaluate()
    .setTitle('SPEED AD お問い合わせ確認')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getViewerContext() {
  return getViewerContext_();
}

function listContactSubmissions(options) {
  var context = requireViewer_();
  options = options || {};
  var statusFilter = String(options.status || '').trim();
  var query = String(options.query || '').toLowerCase().trim();
  var limit = Math.min(Math.max(Number(options.limit || 100), 1), 200);
  var sheet = getSheet_();
  var headers = ensureHeaders_(sheet);
  var values = sheet.getDataRange().getValues();
  var records = [];

  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    var record = rowToRecord_(headers, values[rowIndex], rowIndex + 1);
    if (statusFilter && record.handled_status !== statusFilter) continue;
    if (query && !matchesQuery_(record, query)) continue;
    records.push(toSummary_(record));
  }

  records.sort(function (a, b) {
    return String(b.submitted_at).localeCompare(String(a.submitted_at));
  });

  return {
    ok: true,
    viewerEmail: context.email,
    statuses: VIEWER_STATUSES,
    submissions: records.slice(0, limit)
  };
}

function getContactSubmission(submissionId) {
  requireViewer_();
  var match = findSubmission_(submissionId);
  if (!match) {
    throw new Error('問い合わせが見つかりません。');
  }
  match.record.attachments = parseAttachmentRefs_(match.record.attachment_refs).map(enrichAttachment_);
  return {
    ok: true,
    submission: match.record
  };
}

function getAttachmentPreview(fileId) {
  requireViewer_();
  var file = DriveApp.getFileById(String(fileId || ''));
  assertAttachmentFile_(file);
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

function updateContactSubmissionStatus(submissionId, status, note) {
  var context = requireViewer_();
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
    internal_note: String(note || '').trim()
  };
  Object.keys(fields).forEach(function (key) {
    var colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      sheet.getRange(match.rowNumber, colIndex + 1).setValue(fields[key]);
    }
  });

  return getContactSubmission(submissionId);
}

function getViewerContext_() {
  var email = getActiveUserEmail_();
  var allowedEmails = getViewerEmails_();
  return {
    email: email,
    allowed: !!email && allowedEmails.indexOf(email.toLowerCase()) !== -1,
    allowedCount: allowedEmails.length
  };
}

function requireViewer_() {
  var context = getViewerContext_();
  if (!context.allowed) {
    throw new Error('このお問い合わせ確認アプリを利用する権限がありません。');
  }
  return context;
}

function getActiveUserEmail_() {
  try {
    return String(Session.getActiveUser().getEmail() || '').toLowerCase();
  } catch (_err) {
    return '';
  }
}

function getViewerEmails_() {
  return normalizeEmailList_(getProperty_('CONTACT_VIEWER_EMAILS', ''));
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
  var hasAnyHeader = current.some(function (value) { return !!value; });
  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, CONTACT_HEADERS.length).setValues([CONTACT_HEADERS]);
    return CONTACT_HEADERS.slice();
  }

  var changed = false;
  CONTACT_HEADERS.forEach(function (header) {
    if (current.indexOf(header) === -1) {
      current.push(header);
      changed = true;
    }
  });
  if (changed) {
    sheet.getRange(1, 1, 1, current.length).setValues([current]);
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

function enrichAttachment_(attachment) {
  try {
    var file = DriveApp.getFileById(attachment.fileId);
    assertAttachmentFile_(file);
    var description = parseJson_(file.getDescription());
    return {
      fileId: file.getId(),
      name: file.getName(),
      mimeType: file.getMimeType(),
      size: file.getSize(),
      url: file.getUrl() || attachment.url,
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
      url: attachment.url,
      error: String(err)
    };
  }
}

function assertAttachmentFile_(file) {
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

function normalizeEmailList_(value) {
  if (Array.isArray(value)) {
    value = value.join(',');
  }
  return String(value || '')
    .split(/[,;\n]+/)
    .map(function (email) { return email.trim().toLowerCase(); })
    .filter(function (email, index, emails) {
      return email && emails.indexOf(email) === index;
    });
}
