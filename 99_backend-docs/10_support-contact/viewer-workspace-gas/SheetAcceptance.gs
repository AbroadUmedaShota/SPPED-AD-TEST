/** Read-only, authenticated Sheet projection for an independent acceptance run. */
function exportContactMailSheetAcceptance(options, authProof) {
  var context = requireViewer_(authProof);
  if (context.authMode !== 'domain') throw new Error('FORBIDDEN');
  if (!options || Object.keys(options).sort().join(',') !== 'cutoffAt,hashKeyBase64,runId,startAt' ||
      !/^[A-Za-z0-9._-]{1,80}$/.test(options.runId || '') ||
      !mailAcceptanceIso_(options.startAt) || !mailAcceptanceIso_(options.cutoffAt) ||
      options.startAt > options.cutoffAt || Date.parse(options.cutoffAt) > Date.now() ||
      typeof options.hashKeyBase64 !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(options.hashKeyBase64)) {
    throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID');
  }
  var key;
  try {
    key = Utilities.base64Decode(options.hashKeyBase64);
    if (key.length !== 32 || Utilities.base64Encode(key) !== options.hashKeyBase64) throw new Error('invalid');
  } catch (error) { throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID'); }

  var before = mailAcceptanceReadSource_(options.cutoffAt);
  var after = mailAcceptanceReadSource_(options.cutoffAt);
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('MAIL_ACCEPTANCE_SOURCE_CHANGED');
  if (after.startAt !== options.startAt) throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID');
  var rows = after.rows.map(function (item) {
    return { caseHash: mailAcceptanceHmac_('case\0' + item.caseId, key), submittedAt: item.submittedAt,
      handledStatus: item.handledStatus, closedAt: item.closedAt };
  });
  var catalogText = after.rows.map(function (item) {
    return JSON.stringify([item.caseId, item.handledStatus, item.closedAt]);
  }).join('\n');
  return {
    ok: true,
    manifest: { schemaVersion: 1, source: 'sheet', runId: options.runId,
      hashKeyId: mailAcceptanceHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, key)),
      startAt: options.startAt, cutoffAt: options.cutoffAt, capturedAt: new Date().toISOString(),
      sourceComplete: true, errors: [],
      pages: [{ index: 0, requestTokenHash: null, nextTokenHash: null, rowCount: rows.length }], rows: rows },
    receipt: { catalogDigest: mailAcceptanceHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, catalogText, Utilities.Charset.UTF_8)),
      total: rows.length, readCount: 2 }
  };
}

function mailAcceptanceReadSource_(cutoffAt) {
  try {
    var sheet = getSheet_();
    var headers = ensureHeaders_(sheet);
    var values = sheet.getDataRange().getValues();
    if (!values.length || JSON.stringify(values[0].map(function (value) { return String(value || '').trim(); })) !== JSON.stringify(headers)) {
      throw new Error('invalid');
    }
    var idColumn = headers.indexOf('submission_id');
    var dateColumn = headers.indexOf('submitted_at');
    var statusColumn = headers.indexOf('handled_status');
    var closedColumn = headers.indexOf('closed_at');
    if ([idColumn, dateColumn, statusColumn, closedColumn].some(function (index) { return index < 0; })) throw new Error('invalid');
    var rows = [];
    var seen = {};
    var earliest = Infinity;
    values.slice(1).forEach(function (row) {
      if (!row.some(function (value) { return value !== '' && value != null; })) return;
      var id = mailUuid_(String(row[idColumn] || '').trim().toLowerCase());
      if (seen[id]) throw new Error('invalid');
      seen[id] = true;
      var submittedMillis = mailSubmittedAtMillis_(row[dateColumn]);
      if (!isFinite(submittedMillis)) throw new Error('invalid');
      var submittedAt = new Date(submittedMillis).toISOString();
      if (submittedAt > cutoffAt) throw new Error('MAIL_ACCEPTANCE_CUTOFF_CHANGED');
      var status = String(row[statusColumn] || '').trim() || '未対応';
      if (['未対応', '対応中', '対応済み', '保留'].indexOf(status) === -1) throw new Error('invalid');
      var closedAt = null;
      if (row[closedColumn] !== '' && row[closedColumn] != null) {
        var closedMillis = mailSubmittedAtMillis_(row[closedColumn]);
        if (status !== '対応済み' || !isFinite(closedMillis) || closedMillis < submittedMillis || closedMillis > Date.now()) throw new Error('invalid');
        closedAt = new Date(closedMillis).toISOString();
      }
      rows.push({ caseId: id, submittedAt: submittedAt, handledStatus: status, closedAt: closedAt });
      earliest = Math.min(earliest, submittedMillis);
    });
    if (!rows.length || rows.length > 100000 || !isFinite(earliest)) throw new Error('invalid');
    rows.sort(function (a, b) { return a.caseId < b.caseId ? -1 : a.caseId > b.caseId ? 1 : 0; });
    var day = 86400000;
    return { rows: rows, startAt: new Date(Math.floor((earliest + 32400000) / day) * day - 32400000 - day).toISOString() };
  } catch (error) {
    if (error.message === 'MAIL_ACCEPTANCE_CUTOFF_CHANGED') throw error;
    throw new Error('MAIL_ACCEPTANCE_SOURCE_INVALID');
  }
}

function mailAcceptanceIso_(value) {
  return typeof value === 'string' && isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

function mailAcceptanceHmac_(value, key) {
  var bytes = [];
  for (var index = 0; index < value.length; index++) bytes.push(value.charCodeAt(index));
  return mailAcceptanceHex_(Utilities.computeHmacSha256Signature(bytes, key));
}

function mailAcceptanceHex_(bytes) {
  return bytes.map(function (byte) { return ('0' + ((byte + 256) % 256).toString(16)).slice(-2); }).join('');
}
