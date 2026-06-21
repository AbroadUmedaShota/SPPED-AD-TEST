/**
 * SPEED AD support contact form receiver.
 *
 * Web App:
 *   POST { action: "submitContact", payload: {...} }
 *
 * Script Properties:
 *   SPREADSHEET_ID
 *   DRIVE_FOLDER_ID
 *   CONTACT_FROM_EMAIL
 *   CONTACT_REPLY_TO_EMAIL
 *   CONTACT_NOTIFY_EMAIL
 *   CONTACT_SHEET_NAME
 *   CONTACT_MAX_ATTACHMENT_MB
 *   CONTACT_VIEWER_BASE_URL
 *   CONTACT_VIEWER_ACCESS_TOKEN
 */

var DEFAULT_SHEET_NAME = 'contact_submissions';
var DEFAULT_FROM_EMAIL = 'customer@speed-ad.com';
var DEFAULT_MAX_ATTACHMENT_MB = 10;
var DEFAULT_SPREADSHEET_TITLE = 'SPEED AD サポートお問い合わせ';
var DEFAULT_ATTACHMENT_FOLDER_NAME = 'SPEED AD サポートお問い合わせ添付';
var CONTACT_TYPES = ['general', 'bug', 'billing', 'plan', 'feature', 'other'];
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

function initializeContactSheet() {
  var sheet = getSheet_();
  return logAndReturn_({
    ok: true,
    sheetName: sheet.getName(),
    headerCount: CONTACT_HEADERS.length
  });
}

function initializeContactStorage() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = properties.getProperty('SPREADSHEET_ID');
  var driveFolderId = properties.getProperty('DRIVE_FOLDER_ID');

  if (!spreadsheetId) {
    var spreadsheet = SpreadsheetApp.create(DEFAULT_SPREADSHEET_TITLE);
    spreadsheetId = spreadsheet.getId();
    properties.setProperty('SPREADSHEET_ID', spreadsheetId);
  }

  if (!driveFolderId) {
    var folder = DriveApp.createFolder(DEFAULT_ATTACHMENT_FOLDER_NAME);
    driveFolderId = folder.getId();
    properties.setProperty('DRIVE_FOLDER_ID', driveFolderId);
  }

  setDefaultProperty_('CONTACT_FROM_EMAIL', DEFAULT_FROM_EMAIL);
  setDefaultProperty_('CONTACT_REPLY_TO_EMAIL', DEFAULT_FROM_EMAIL);
  setDefaultProperty_('CONTACT_NOTIFY_EMAIL', DEFAULT_FROM_EMAIL);
  setDefaultProperty_('CONTACT_SHEET_NAME', DEFAULT_SHEET_NAME);
  setDefaultProperty_('CONTACT_MAX_ATTACHMENT_MB', String(DEFAULT_MAX_ATTACHMENT_MB));

  var sheet = getSheet_();
  return logAndReturn_({
    ok: true,
    spreadsheetId: spreadsheetId,
    driveFolderId: driveFolderId,
    sheetName: sheet.getName()
  });
}

function checkContactConfiguration() {
  var result = {
    ok: true,
    spreadsheet: checkSpreadsheet_(),
    driveFolder: checkDriveFolder_(),
    from: getFromState_(),
    notifyEmail: checkNotifyEmails_(),
    replyToEmail: checkOptionalProperty_('CONTACT_REPLY_TO_EMAIL'),
    maxAttachmentMb: getMaxAttachmentMb_(),
    viewerBaseUrl: checkOptionalProperty_('CONTACT_VIEWER_BASE_URL'),
    viewerAccessToken: checkOptionalProperty_('CONTACT_VIEWER_ACCESS_TOKEN')
  };

  result.ok = result.spreadsheet.ok &&
    result.driveFolder.ok &&
    result.notifyEmail.ok;

  return logAndReturn_(result);
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    var action = String(body.action || '');
    if (action !== 'submitContact') {
      throw new Error('Unknown action: ' + action);
    }
    return submitContact_(body.payload || {});
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

function submitContact_(payload) {
  var receivedAt = new Date().toISOString();
  var normalized = normalizePayload_(payload);
  var attachmentRefs = saveAttachments_(normalized.submissionId, normalized.attachments);
  var row = buildRow_(normalized, receivedAt, attachmentRefs, 'stored', 'pending');
  var sheetLink = appendRow_(row);

  var fromState = getFromState_();
  try {
    sendInternalNotification_(normalized, attachmentRefs, sheetLink, fromState);
    sendUserReceipt_(normalized, fromState);
    updateSubmission_(normalized.submissionId, {
      mail_status: 'sent'
    });
    return jsonOut_({
      ok: true,
      submissionId: normalized.submissionId,
      receivedAt: receivedAt,
      storageStatus: 'stored',
      mailStatus: 'sent'
    });
  } catch (err) {
    updateSubmission_(normalized.submissionId, {
      mail_status: 'failed_send'
    });
    return jsonOut_({
      ok: false,
      submissionId: normalized.submissionId,
      receivedAt: receivedAt,
      storageStatus: 'stored',
      mailStatus: 'failed_send',
      error: String(err)
    });
  }
}

function normalizePayload_(payload) {
  var contactType = String(payload.contactType || '').trim();
  var email = String(payload.email || '').trim();
  var message = String(payload.message || '').trim();
  var privacyConsent = payload.privacyConsent === true;

  if (CONTACT_TYPES.indexOf(contactType) === -1) {
    throw new Error('問い合わせ種別を選択してください。');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('メールアドレスをご確認ください。');
  }
  if (!message) {
    throw new Error('お問い合わせ内容をご入力ください。');
  }
  if (!privacyConsent) {
    throw new Error('個人情報の取り扱いへの同意が必要です。');
  }

  var attachments = payload.attachments || [];
  if (!Array.isArray(attachments)) attachments = [];
  validateAttachments_(attachments);

  return {
    submissionId: Utilities.getUuid(),
    contactType: contactType,
    contactTypeLabel: String(payload.contactTypeLabel || contactType).trim(),
    name: String(payload.name || '').trim(),
    email: email,
    subject: String(payload.subject || '').trim() || 'お問い合わせ',
    message: message,
    attachments: attachments,
    sourceUrl: String(payload.sourceUrl || '').trim(),
    userAgent: String(payload.userAgent || '').trim()
  };
}

function validateAttachments_(attachments) {
  var maxBytes = getMaxAttachmentMb_() * 1024 * 1024;
  attachments.forEach(function (attachment) {
    var name = String(attachment.name || '').trim();
    var mimeType = String(attachment.mimeType || '').trim();
    var size = Number(attachment.size || 0);
    var data = String(attachment.data || '');
    if (!name || !mimeType || !data) {
      throw new Error('添付ファイルの内容を確認できません。');
    }
    if (mimeType.indexOf('image/') !== 0) {
      throw new Error(name + ' は画像ファイルではありません。');
    }
    if (size > maxBytes) {
      throw new Error(name + ' は添付上限を超えています。');
    }
  });
}

function saveAttachments_(submissionId, attachments) {
  if (!attachments.length) return [];
  var folderId = getProperty_('DRIVE_FOLDER_ID', '');
  if (!folderId) {
    throw new Error('DRIVE_FOLDER_ID が未設定のため添付ファイルを保存できません。');
  }
  var folder = DriveApp.getFolderById(folderId);
  return attachments.map(function (attachment, index) {
    var bytes = Utilities.base64Decode(String(attachment.data || ''));
    var safeName = sanitizeFilename_(submissionId + '-' + (index + 1) + '-' + attachment.name);
    var blob = Utilities.newBlob(bytes, attachment.mimeType, safeName);
    var file = folder.createFile(blob);
    file.setDescription(JSON.stringify({
      originalName: String(attachment.originalName || attachment.name || ''),
      originalMimeType: String(attachment.originalMimeType || ''),
      originalSize: Number(attachment.originalSize || 0),
      savedMimeType: String(attachment.mimeType || ''),
      savedSize: Number(attachment.size || 0)
    }));
    return file.getId() + ':' + file.getUrl();
  });
}

function buildRow_(payload, receivedAt, attachmentRefs, storageStatus, mailStatus) {
  return {
    submission_id: payload.submissionId,
    submitted_at: receivedAt,
    contact_type: payload.contactType,
    name: payload.name,
    email: payload.email,
    subject: payload.subject,
    message: payload.message,
    attachment_count: attachmentRefs.length,
    attachment_refs: attachmentRefs.join(','),
    source_url: payload.sourceUrl,
    user_agent: payload.userAgent,
    storage_status: storageStatus,
    mail_status: mailStatus,
    handled_status: '未対応',
    handled_by: '',
    handled_at: '',
    internal_note: ''
  };
}

function sendUserReceipt_(payload, fromState) {
  var fromEmail = getProperty_('CONTACT_FROM_EMAIL', DEFAULT_FROM_EMAIL);
  var replyTo = getProperty_('CONTACT_REPLY_TO_EMAIL', fromEmail);
  var subject = '【SPEED AD】お問い合わせを受け付けました';
  var body = [
    payload.name ? payload.name + ' 様' : 'SPEED AD ご利用者様',
    '',
    'SPEED AD サポートへのお問い合わせを受け付けました。',
    '内容を確認のうえ、2〜3営業日以内に担当者よりご返信いたします。',
    '',
    '--- お問い合わせ内容 ---',
    '受付ID: ' + payload.submissionId,
    '問い合わせ種別: ' + payload.contactTypeLabel,
    '件名: ' + payload.subject,
    '',
    payload.message,
    '',
    '------------------------',
    'SPEED AD Support'
  ].join('\n');

  sendEmail_(payload.email, subject, body, fromEmail, replyTo, fromState);
}

function sendInternalNotification_(payload, attachmentRefs, sheetLink, fromState) {
  var fromEmail = getProperty_('CONTACT_FROM_EMAIL', DEFAULT_FROM_EMAIL);
  var notifyEmails = getNotifyEmails_();
  var viewerDetailUrl = buildViewerDetailUrl_(payload.submissionId);
  var subject = '【SPEED AD】お問い合わせ: [' + payload.contactTypeLabel + '] ' + payload.subject;
  var body = [
    'SPEED AD サポート問い合わせを受け付けました。',
    '',
    '確認アプリ: ' + (viewerDetailUrl || 'CONTACT_VIEWER_BASE_URL 未設定'),
    '',
    '受付ID: ' + payload.submissionId,
    '問い合わせ種別: ' + payload.contactTypeLabel + ' (' + payload.contactType + ')',
    'お名前: ' + (payload.name || '-'),
    'メールアドレス: ' + payload.email,
    '件名: ' + payload.subject,
    '投稿元URL: ' + (payload.sourceUrl || '-'),
    '',
    '--- 本文 ---',
    payload.message,
    '',
    '--- 予備情報 ---',
    'Spreadsheet: ' + sheetLink.spreadsheetUrl,
    '該当行: ' + sheetLink.rowUrl,
    'シート: ' + sheetLink.sheetName + ' / ' + sheetLink.rowNumber + '行目',
    '添付: ' + (attachmentRefs.length ? attachmentRefs.join('\n') : '-')
  ].join('\n');

  sendEmail_(notifyEmails, subject, body, fromEmail, payload.email, fromState);
}

function buildViewerDetailUrl_(submissionId) {
  var baseUrl = String(getProperty_('CONTACT_VIEWER_BASE_URL', '') || '').trim();
  if (!baseUrl) return '';
  var separator = baseUrl.indexOf('?') === -1 ? '?' : '&';
  var token = String(getProperty_('CONTACT_VIEWER_ACCESS_TOKEN', '') || '').trim();
  var url = baseUrl + separator + 'id=' + encodeURIComponent(submissionId);
  if (token) {
    url += '&token=' + encodeURIComponent(token);
  }
  return url;
}

function sendEmail_(to, subject, body, fromEmail, replyTo, fromState) {
  var options = {
    name: 'SPEED AD Support',
    replyTo: replyTo
  };
  // If the configured From is not available as the executing user or an alias,
  // Gmail sends from the executing account while preserving Reply-To.
  if (fromState.mode === 'alias') {
    options.from = fromEmail;
  }
  GmailApp.sendEmail(normalizeEmailList_(to).join(','), subject, body, options);
}

function getFromState_() {
  var fromEmail = getProperty_('CONTACT_FROM_EMAIL', DEFAULT_FROM_EMAIL).toLowerCase();
  var effectiveUser = '';
  try {
    effectiveUser = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  } catch (_err) {
    effectiveUser = '';
  }
  if (effectiveUser === fromEmail) {
    return { available: true, mode: 'primary' };
  }

  var aliases = GmailApp.getAliases().map(function (alias) {
    return String(alias || '').toLowerCase();
  });
  if (aliases.indexOf(fromEmail) !== -1) {
    return { available: true, mode: 'alias' };
  }
  return { available: false, mode: 'unavailable' };
}

function checkSpreadsheet_() {
  var spreadsheetId = getProperty_('SPREADSHEET_ID', '');
  if (!spreadsheetId) {
    return { ok: false, error: 'SPREADSHEET_ID is not set' };
  }
  try {
    var sheet = getSheet_();
    return { ok: true, spreadsheetId: spreadsheetId, sheetName: sheet.getName() };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function checkDriveFolder_() {
  var folderId = getProperty_('DRIVE_FOLDER_ID', '');
  if (!folderId) {
    return { ok: false, error: 'DRIVE_FOLDER_ID is not set' };
  }
  try {
    var folder = DriveApp.getFolderById(folderId);
    return { ok: true, driveFolderId: folderId, folderName: folder.getName() };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function checkRequiredProperty_(key) {
  var value = getProperty_(key, '');
  return value ? { ok: true, set: true } : { ok: false, set: false, error: key + ' is not set' };
}

function checkNotifyEmails_() {
  var emails = normalizeEmailList_(getProperty_('CONTACT_NOTIFY_EMAIL', ''));
  if (!emails.length) {
    return { ok: false, set: false, count: 0, error: 'CONTACT_NOTIFY_EMAIL is not set' };
  }
  return { ok: true, set: true, count: emails.length };
}

function checkOptionalProperty_(key) {
  var value = getProperty_(key, '');
  return { ok: true, set: !!value };
}

function appendRow_(row) {
  var sheet = getSheet_();
  var values = CONTACT_HEADERS.map(function (header) {
    return row[header] == null ? '' : row[header];
  });
  var rowNumber = sheet.getLastRow() + 1;
  sheet.getRange(rowNumber, 1, 1, CONTACT_HEADERS.length).setValues([values]);
  var spreadsheet = sheet.getParent();
  return {
    spreadsheetUrl: spreadsheet.getUrl(),
    sheetName: sheet.getName(),
    rowNumber: rowNumber,
    rowUrl: spreadsheet.getUrl() + '#gid=' + sheet.getSheetId() + '&range=A' + rowNumber
  };
}

function updateSubmission_(submissionId, fields) {
  var sheet = getSheet_();
  var values = sheet.getDataRange().getValues();
  var idIndex = CONTACT_HEADERS.indexOf('submission_id');
  for (var rowIndex = 1; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][idIndex]) === submissionId) {
      Object.keys(fields).forEach(function (key) {
        var colIndex = CONTACT_HEADERS.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(rowIndex + 1, colIndex + 1).setValue(fields[key]);
        }
      });
      return;
    }
  }
}

function getSheet_() {
  var spreadsheetId = getProperty_('SPREADSHEET_ID', '');
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID が未設定です。');
  }
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheetName = getProperty_('CONTACT_SHEET_NAME', DEFAULT_SHEET_NAME);
  var sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
  ensureHeaders_(sheet);
  return sheet;
}

function ensureHeaders_(sheet) {
  var current = sheet.getRange(1, 1, 1, CONTACT_HEADERS.length).getValues()[0];
  var needsHeader = CONTACT_HEADERS.some(function (header, index) {
    return current[index] !== header;
  });
  if (needsHeader) {
    sheet.getRange(1, 1, 1, CONTACT_HEADERS.length).setValues([CONTACT_HEADERS]);
  }
}

function getMaxAttachmentMb_() {
  var value = Number(getProperty_('CONTACT_MAX_ATTACHMENT_MB', DEFAULT_MAX_ATTACHMENT_MB));
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_ATTACHMENT_MB;
}

function getProperty_(key, fallback) {
  var value = PropertiesService.getScriptProperties().getProperty(key);
  return value == null || value === '' ? fallback : value;
}

function getNotifyEmails_() {
  return normalizeEmailList_(getProperty_('CONTACT_NOTIFY_EMAIL', DEFAULT_FROM_EMAIL));
}

function normalizeEmailList_(value) {
  if (Array.isArray(value)) {
    value = value.join(',');
  }
  return String(value || '')
    .split(/[,;\n]+/)
    .map(function (email) {
      return email.trim();
    })
    .filter(function (email, index, emails) {
      return email && emails.indexOf(email) === index;
    });
}

function setContactNotifyEmail(value) {
  var emails = normalizeEmailList_(value);
  if (!emails.length) {
    throw new Error('CONTACT_NOTIFY_EMAIL requires at least one email address.');
  }
  PropertiesService.getScriptProperties().setProperty('CONTACT_NOTIFY_EMAIL', emails.join(','));
  return logAndReturn_({
    ok: true,
    contactNotifyEmailCount: emails.length
  });
}

function setDefaultProperty_(key, value) {
  var properties = PropertiesService.getScriptProperties();
  var current = properties.getProperty(key);
  if (current == null || current === '') {
    properties.setProperty(key, value);
  }
}

function sanitizeFilename_(name) {
  return String(name || 'attachment').replace(/[\\/:*?"<>|]/g, '_').slice(0, 180);
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function logAndReturn_(obj) {
  Logger.log(JSON.stringify(obj));
  return obj;
}
