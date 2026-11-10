/** Authenticated, fixed-operation bridge to the separately deployed mail service. */
var MAIL_SAFE_ERROR_CODES = [
  'MAIL_NOT_CONFIGURED', 'MAIL_SERVICE_AUTH', 'MAIL_SERVICE_UNAVAILABLE',
  'MAIL_INVALID_RESPONSE', 'INVALID_REQUEST', 'NOT_FOUND', 'CONFLICT',
  'MAIL_UNAVAILABLE', 'ATTACHMENT_UNAVAILABLE', 'SYNC_INCOMPLETE',
  'AUTH_REQUIRED', 'FORBIDDEN', 'HISTORY_EXPIRED', 'MAIL_AUTH_REQUIRED', 'MAIL_FORBIDDEN',
  'MAIL_INVALID_REQUEST', 'MAIL_ATTACHMENT_NOT_FOUND', 'MAIL_CATALOG_INVALID', 'MAIL_REQUEST_CONFLICT',
  'MAIL_SYNC_BUSY', 'MAIL_CONTENT_UNAVAILABLE', 'MAIL_HISTORY_EXPIRED', 'MAIL_INVALID_UPSTREAM',
  'MAIL_MAILBOX_MISMATCH', 'MAIL_UPSTREAM_FAILED', 'MAIL_UPSTREAM_TIMEOUT', 'MAIL_NOT_FOUND',
  'MAIL_REQUEST_TOO_LARGE', 'MAIL_ATTACHMENT_UNAVAILABLE', 'MAIL_CASE_NOT_FOUND',
  'MAIL_CATALOG_INCOMPLETE', 'MAIL_CATALOG_CHANGED', 'MAIL_FULL_SYNC_REQUIRED', 'MAIL_MAPPING_CHANGED', 'MAIL_SYNC_COMPLETE', 'MAIL_SYNC_FAILED'
];

function listContactMail(options, authProof) {
  var context = requireViewer_(authProof);
  var payload = mailScopePayload_(options);
  payload.pageToken = mailString_(options && options.pageToken, 4096, true);
  var operation = payload.scope === 'case' ? 'listCaseMail' : (payload.scope === 'pending' ? 'listPendingMail' : 'listUnreviewedMail');
  return callMailService_(operation, payload, context);
}

function getContactMailMessage(options, authProof) {
  var context = requireViewer_(authProof);
  var payload = mailScopePayload_(options);
  payload.messageId = mailMessageId_(options && options.messageId);
  return callMailService_('getMail', payload, context);
}

function getContactMailAttachmentChunk(options, authProof) {
  var context = requireViewer_(authProof);
  var payload = mailScopePayload_(options);
  payload.messageId = mailMessageId_(options && options.messageId);
  payload.partId = String(options && options.partId || '');
  if (!/^0(?:\.\d+)*$/.test(payload.partId) || payload.partId.length > 64) throw new Error('メール添付の指定が不正です。');
  payload.offset = options && options.offset;
  if (typeof payload.offset !== 'number' || !isFinite(payload.offset) || payload.offset < 0 || Math.floor(payload.offset) !== payload.offset || payload.offset > 52428800) throw new Error('メール添付の取得位置が不正です。');
  return callMailService_('getAttachmentChunk', payload, context);
}

function markContactMailReviewed(options, authProof) {
  var context = requireViewer_(authProof);
  var payload = mailScopePayload_(options);
  if (payload.scope === 'pending') throw new Error('照合待ちメールは案件を確定してから確認してください。');
  payload.messageId = mailMessageId_(options && options.messageId);
  payload.expectedVersion = mailVersion_(options && options.expectedVersion);
  return callMailService_('markReviewed', payload, context, mailRequestId_(options && options.requestId));
}

function resolveContactMailPending(options, authProof) {
  var context = requireViewer_(authProof);
  var action = String(options && options.action || '');
  if (['match', 'exclude'].indexOf(action) === -1) throw new Error('照合操作が不正です。');
  var payload = {
    messageId: mailMessageId_(options && options.messageId),
    action: action,
    reason: mailString_(options && options.reason, 1000, false).trim(),
    expectedVersion: mailVersion_(options && options.expectedVersion)
  };
  if (action === 'match') payload.caseId = mailCaseId_(options && options.caseId);
  return callMailService_('resolvePending', payload, context, mailRequestId_(options && options.requestId));
}

function getContactMailSyncStatus(authProof) {
  return callMailService_('getSyncStatus', {}, requireViewer_(authProof));
}

function reconcileContactMailPending(options, authProof) {
  var context = requireViewer_(authProof);
  if (context.authMode !== 'domain') throw new Error('メール再照合を実行する権限がありません。');
  return callMailService_('reconcilePending', { pageToken: mailString_(options && options.pageToken, 4096, true) }, context, mailRequestId_(options && options.requestId));
}

function advanceContactMailSync(options, authProof) {
  var context = requireViewer_(authProof);
  if (context.authMode !== 'domain') throw new Error('メール同期を実行する権限がありません。');
  options = options || {};
  if (options.executionId) {
    var executionId = mailUuid_(options.executionId);
    var payload = { executionId: executionId };
    if (options.mode != null) {
      if (['full', 'history'].indexOf(options.mode) === -1) throw new Error('メール同期の指定が不正です。');
      payload.mode = options.mode;
      var source = mailCatalogSource_();
      if (!/^[a-f0-9]{64}$/.test(String(options.catalogDigest || ''))) throw new Error('受付ID照合のダイジェストが不正です。');
      if (options.catalogDigest !== source.digest) return mailError_('MAIL_CATALOG_CHANGED');
      payload.catalogSnapshotId = mailUuid_(options.catalogSnapshotId);
      payload.catalogDigest = source.digest;
      if (options.mode === 'full' && source.startAt) payload.startAt = source.startAt;
    }
    if (options.resume === true) payload.resume = true;
    return callMailService_('advanceSync', payload, context, mailRequestId_(options.requestId));
  }
  var source = mailCatalogSource_();
  var ids = source.ids;
  var digest = source.digest;
  var pageCount = Math.max(1, Math.ceil(ids.length / 200));
  var previous = options.catalog || {};
  var snapshotId = previous.snapshotId ? mailUuid_(previous.snapshotId) : Utilities.getUuid();
  var pageIndex = previous.nextPageIndex || 0;
  if (previous.digest && previous.digest !== digest) return mailError_('CONFLICT');
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= pageCount) throw new Error('受付ID照合のページが不正です。');
  var lastResult;
  var end = Math.min(pageCount, pageIndex + 5);
  for (; pageIndex < end; pageIndex++) {
    lastResult = callMailService_('uploadCaseCatalog', {
      snapshotId: snapshotId, pageIndex: pageIndex, pageCount: pageCount, total: ids.length,
      digest: digest, caseIds: ids.slice(pageIndex * 200, (pageIndex + 1) * 200)
    }, context);
    if (!lastResult.ok) return lastResult;
  }
  return { ok: true, catalog: { snapshotId: snapshotId, digest: digest, nextPageIndex: pageIndex, pageCount: pageCount, total: ids.length, complete: pageIndex === pageCount && !!(lastResult.catalog && lastResult.catalog.complete), startAt: source.startAt } };
}

function mailCatalogSource_() {
  var sheet = getSheet_();
  var headers = ensureHeaders_(sheet);
  var idColumn = headers.indexOf('submission_id');
  var dateColumn = headers.indexOf('submitted_at');
  var ids = [];
  var seen = {};
  var earliest = Infinity;
  var invalidDate = dateColumn < 0;
  sheet.getDataRange().getValues().slice(1).forEach(function (row) {
    var raw = String(row[idColumn] || '').trim();
    if (!raw) return;
    var id = mailUuid_(raw.toLowerCase());
    if (seen[id]) throw new Error('受付IDが重複しているためメール同期を開始できません。');
    seen[id] = true;
    ids.push(id);
    var value = dateColumn < 0 ? null : row[dateColumn];
    var time = mailSubmittedAtMillis_(value);
    if (!isFinite(time)) invalidDate = true;
    else earliest = Math.min(earliest, time);
  });
  ids.sort();
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ids.join('\n'), Utilities.Charset.UTF_8).map(function (byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
  var day = 86400000;
  var startAt = !invalidDate && isFinite(earliest) ? new Date(Math.floor((earliest + 32400000) / day) * day - 32400000 - day).toISOString() : null;
  return { ids: ids, digest: digest, startAt: startAt };
}

function mailSubmittedAtMillis_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') return value.getTime();
  if (typeof value !== 'string') return NaN;
  var match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-](\d{2}):?(\d{2}))$/.exec(value);
  if (!match) return NaN;
  var year = Number(match[1]), month = Number(match[2]), date = Number(match[3]);
  var monthEnd = new Date(0);
  monthEnd.setUTCFullYear(year, month, 0);
  if (month < 1 || month > 12 || date < 1 || date > monthEnd.getUTCDate() || Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6]) > 59 || Number(match[8] || 0) > 23 || Number(match[9] || 0) > 59) return NaN;
  return Date.parse(value);
}

function mailUuid_(value) {
  var id = String(value || '');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id)) throw new Error('受付IDまたは同期IDが不正です。');
  return id;
}

function mailScopePayload_(options) {
  var scope = String(options && options.scope || '');
  if (['case', 'unreviewed', 'pending'].indexOf(scope) === -1) throw new Error('メール表示対象が不正です。');
  var payload = { scope: scope };
  if (scope === 'case') payload.caseId = mailCaseId_(options && options.caseId);
  return payload;
}

function mailCaseId_(value) {
  var id = mailString_(value, 256, false).trim();
  if (!findSubmission_(id)) throw new Error('問い合わせが見つかりません。');
  return id;
}

function mailMessageId_(value) {
  var id = String(value || '');
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error('メールの指定が不正です。');
  return id;
}

function mailVersion_(value) {
  if (typeof value !== 'number' || !isFinite(value) || value < 1 || Math.floor(value) !== value) throw new Error('メールの版が不正です。');
  return value;
}

function mailRequestId_(value) {
  if (!value) return Utilities.getUuid();
  var id = String(value);
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(id)) throw new Error('メール操作の識別子が不正です。');
  return id;
}

function mailString_(value, limit, optional) {
  if (value == null && optional) return '';
  if (typeof value !== 'string' || value.length > limit || (!optional && !value.trim())) throw new Error('メール操作の入力が不正です。');
  return value;
}

function callMailService_(operation, payload, context, requestId) {
  var serviceUrl = getProperty_('MAIL_SERVICE_URL', '');
  if (!serviceUrl) return mailError_('MAIL_NOT_CONFIGURED');
  // Only the configured Cloud Run origin is callable; redirects and arbitrary proxy URLs are forbidden.
  if (!/^https:\/\/[a-z0-9][a-z0-9.-]*\.run\.app$/.test(serviceUrl)) return mailError_('MAIL_NOT_CONFIGURED');
  var identityToken;
  try { identityToken = ScriptApp.getIdentityToken(); } catch (_error) { return mailError_('MAIL_SERVICE_AUTH'); }
  if (!identityToken) return mailError_('MAIL_SERVICE_AUTH');
  var envelope = {
    contractVersion: 1,
    operation: operation,
    requestId: requestId || Utilities.getUuid(),
    issuedAt: new Date().toISOString(),
    actor: { email: context.email, authMode: context.authMode === 'google-oauth' ? 'customer-oauth' : 'domain' },
    payload: payload
  };
  try {
    var response = UrlFetchApp.fetch(serviceUrl + '/rpc', {
      method: 'post', contentType: 'application/json', payload: JSON.stringify(envelope),
      headers: { Authorization: 'Bearer ' + identityToken },
      muteHttpExceptions: true, followRedirects: false, validateHttpsCertificates: true
    });
    var status = response.getResponseCode();
    if (status === 401 || status === 403) return mailError_('MAIL_SERVICE_AUTH');
    if (status < 200 || status >= 500) return mailError_('MAIL_SERVICE_UNAVAILABLE');
    var body = response.getContentText();
    if (body.length > 2097152) return mailError_('MAIL_INVALID_RESPONSE');
    var result = JSON.parse(body);
    if (!result || typeof result !== 'object' || typeof result.ok !== 'boolean') return mailError_('MAIL_INVALID_RESPONSE');
    if (!result.ok) return mailError_(result.error && result.error.code);
    if (status !== 200) return mailError_('MAIL_INVALID_RESPONSE');
    return result;
  } catch (_error) {
    // Do not expose or log service responses, tokens, message bodies, or exception details.
    return mailError_('MAIL_SERVICE_UNAVAILABLE');
  }
}

function mailError_(code) {
  return { ok: false, error: { code: MAIL_SAFE_ERROR_CODES.indexOf(code) !== -1 ? code : 'MAIL_SERVICE_UNAVAILABLE' } };
}
