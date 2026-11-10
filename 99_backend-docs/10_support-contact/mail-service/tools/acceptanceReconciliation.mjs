import { createHmac } from 'node:crypto';

const HASH = /^[a-f0-9]{64}$/;
const STATUSES = new Set(['未対応', '対応中', '保留', '対応済み']);
const COMMON = ['schemaVersion', 'source', 'runId', 'hashKeyId', 'startAt', 'cutoffAt', 'capturedAt', 'sourceComplete', 'errors', 'pages', 'rows'];
const MAX_ROWS = 100000;
const CHUNK_SIZE = 512 * 1024;
const MAX_ATTACHMENT_BYTES = 64 * 1024 * 1024;
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
const keys = (v, expected) => object(v) && Object.keys(v).sort().join(',') === [...expected].sort().join(',');
const date = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const array = (v) => Array.isArray(v) && v.length <= MAX_ROWS;

// Use one ephemeral key per capture run. The key and raw IDs stay outside manifests/logs.
export function hashAcceptanceId(kind, value, key) {
  if (!['case', 'message', 'actor', 'evidence', 'page'].includes(kind) || typeof value !== 'string' || !value ||
      !Buffer.isBuffer(key) || key.length < 32) throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID');
  return createHmac('sha256', key).update(`${kind}\0${value}`).digest('hex');
}

export function reconcileAcceptance(input) {
  const failures = [];
  const add = (code, source, count = 1, category = 'identity') => {
    const existing = failures.find((item) => item.code === code && item.source === source);
    if (existing) existing.count += count;
    else failures.push({ code, source, count, category });
  };
  const sources = {};
  for (const source of ['sheet', 'gmail', 'app', 'sheetAfter']) {
    const m = input?.[source];
    const expected = source === 'app' ? [...COMMON, 'catalog', 'syncComplete', 'residualCount', 'noMailConfirmations'] : COMMON;
    if (!keys(m, expected) || m.schemaVersion !== 1 || m.source !== (source === 'sheetAfter' ? 'sheet' : source) ||
        !/^[A-Za-z0-9._-]{1,80}$/.test(m.runId || '') || !HASH.test(m.hashKeyId || '') ||
        !date(m.startAt) || !date(m.cutoffAt) || m.startAt > m.cutoffAt || !date(m.capturedAt) || m.capturedAt < m.cutoffAt ||
        typeof m.sourceComplete !== 'boolean' || !array(m.errors) || !array(m.rows) || !array(m.pages) || m.pages.length === 0 ||
        !m.errors.every((item) => typeof item === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(item))) {
      add('MANIFEST_INVALID', source); continue;
    }
    sources[source] = m;
    if (!m.sourceComplete || m.errors.length) add('SOURCE_INCOMPLETE', source);
    let rowCount = 0; let previousToken = null; const seen = new Set(); let validPages = true;
    for (let index = 0; index < m.pages.length; index++) {
      const page = m.pages[index];
      if (!keys(page, ['index', 'requestTokenHash', 'nextTokenHash', 'rowCount']) || page.index !== index ||
          page.requestTokenHash !== previousToken || !Number.isSafeInteger(page.rowCount) || page.rowCount < 0 ||
          !(page.requestTokenHash === null || HASH.test(page.requestTokenHash)) ||
          !(page.nextTokenHash === null || HASH.test(page.nextTokenHash)) ||
          (index < m.pages.length - 1 ? page.nextTokenHash === null : page.nextTokenHash !== null) ||
          (page.nextTokenHash !== null && seen.has(page.nextTokenHash))) { validPages = false; break; }
      if (page.nextTokenHash !== null) seen.add(page.nextTokenHash);
      rowCount += page.rowCount; previousToken = page.nextTokenHash;
    }
    if (!validPages || rowCount !== m.rows.length) add('PAGINATION_INVALID', source);
  }
  const context = sources.sheet;
  for (const source of ['sheet', 'sheetAfter']) {
    if (sources[source]?.rows.length === 0) add('SHEET_EMPTY', source);
  }
  for (const [source, m] of Object.entries(sources)) {
    if (context && ['runId', 'hashKeyId', 'startAt', 'cutoffAt'].some((field) => m[field] !== context[field])) add('CONTEXT_MISMATCH', source);
  }
  if (sources.sheet && sources.gmail && sources.app && sources.sheetAfter &&
      !(sources.sheet.capturedAt < sources.gmail.capturedAt && sources.gmail.capturedAt < sources.app.capturedAt &&
        sources.app.capturedAt < sources.sheetAfter.capturedAt)) add('OBSERVATION_ORDER_INVALID', 'app');
  const cases = (rows, source) => {
    const map = new Map();
    for (const row of rows || []) {
      const sheet = source === 'sheet' || source === 'sheetAfter';
      if (!keys(row, sheet ? ['caseHash', 'submittedAt', 'handledStatus', 'closedAt'] : ['caseHash', 'handledStatus', 'closedAt']) ||
          !HASH.test(row.caseHash || '') || !STATUSES.has(row.handledStatus) ||
          (sheet && !date(row.submittedAt)) ||
          !(row.closedAt === null || date(row.closedAt) && row.handledStatus === '対応済み')) { add('CASE_INVALID', source); continue; }
      if (sheet && (row.submittedAt < sources[source].startAt || row.submittedAt > sources[source].cutoffAt)) add('SHEET_PERIOD_INVALID', source);
      if (map.has(row.caseHash)) add('DUPLICATE_ID', source);
      else map.set(row.caseHash, row);
    }
    return map;
  };
  const sheetCases = cases(sources.sheet?.rows, 'sheet');
  const sheetAfterCases = cases(sources.sheetAfter?.rows, 'sheetAfter');
  const app = sources.app;
  if (app && (!array(app.catalog) || !array(app.noMailConfirmations) || typeof app.syncComplete !== 'boolean' ||
      !Number.isSafeInteger(app.residualCount) || app.residualCount < 0)) add('APP_STATE_INVALID', 'app');
  const appCases = cases(Array.isArray(app?.catalog) ? app.catalog : [], 'app');
  const compare = (left, right, missing, extra, source) => {
    const absent = [...left.keys()].filter((key) => !right.has(key)).length;
    const surplus = [...right.keys()].filter((key) => !left.has(key)).length;
    if (absent) add(missing, source, absent);
    if (surplus) add(extra, source, surplus);
  };
  compare(sheetCases, appCases, 'SHEET_CASE_MISSING', 'APP_CASE_EXTRA', 'app');
  compare(sheetCases, sheetAfterCases, 'SHEET_AFTER_CASE_MISSING', 'SHEET_AFTER_CASE_EXTRA', 'sheetAfter');
  for (const [id, row] of sheetCases) {
    const other = appCases.get(id);
    if (other && (row.handledStatus !== other.handledStatus || row.closedAt !== other.closedAt)) add('CASE_STATE_MISMATCH', 'app');
    const after = sheetAfterCases.get(id);
    if (after && (row.submittedAt !== after.submittedAt || row.handledStatus !== after.handledStatus || row.closedAt !== after.closedAt)) add('SHEET_CHANGED', 'sheetAfter');
  }
  const messages = (m, source) => {
    const all = new Set(); const selected = new Map();
    for (const row of m?.rows || []) {
      const expected = source === 'gmail' ? ['messageHash', 'internalDate', 'draft'] :
        ['messageHash', 'internalDate', 'classification', 'caseHash', 'manualExclusion', 'unavailable', 'bodyVerified', 'attachmentCount', 'attachments', 'firstReview'];
      if (!keys(row, expected) || !HASH.test(row.messageHash || '') || !date(row.internalDate) ||
          (source === 'gmail' && typeof row.draft !== 'boolean') ||
          (source === 'app' && (!['matched', 'pending', 'excluded'].includes(row.classification) ||
            !(row.caseHash === null || HASH.test(row.caseHash)) || typeof row.manualExclusion !== 'boolean' ||
            typeof row.unavailable !== 'boolean' || typeof row.bodyVerified !== 'boolean' || !array(row.attachments) ||
            !Number.isSafeInteger(row.attachmentCount) || row.attachmentCount < 0 ||
            !(row.firstReview === null || keys(row.firstReview, ['actorHash', 'at']) && HASH.test(row.firstReview.actorHash || '') && date(row.firstReview.at)) ||
            !row.attachments.every((item) => keys(item, ['availability', 'transferVersion', 'transferSize', 'servedChunks']) &&
              ['verified', 'unverified', 'unavailable'].includes(item.availability) &&
              (item.transferVersion === null || Number.isSafeInteger(item.transferVersion)) &&
              (item.transferSize === null || Number.isSafeInteger(item.transferSize) && item.transferSize >= 0) &&
              array(item.servedChunks) && item.servedChunks.every(Number.isSafeInteger))))) { add('MESSAGE_INVALID', source); continue; }
      if (all.has(row.messageHash)) add('DUPLICATE_ID', source);
      else all.add(row.messageHash);
      if (row.internalDate >= m.startAt && row.internalDate <= m.cutoffAt && !row.draft) selected.set(row.messageHash, row);
    }
    return selected;
  };
  const gmailMessages = messages(sources.gmail, 'gmail');
  const appMessages = messages(app, 'app');
  compare(gmailMessages, appMessages, 'GMAIL_MESSAGE_MISSING', 'APP_MESSAGE_EXTRA', 'app');
  const covered = new Set();
  for (const [id, row] of appMessages) {
    if (gmailMessages.has(id) && gmailMessages.get(id).internalDate !== row.internalDate) add('MESSAGE_DATE_MISMATCH', 'app');
    if (row.classification === 'excluded') {
      if (!row.manualExclusion || row.caseHash !== null) add('EXCLUSION_UNCONFIRMED', 'app', 1, 'content');
      continue;
    }
    if (row.classification !== 'matched') { add('MATCH_PENDING', 'app', 1, 'content'); continue; }
    if (!appCases.has(row.caseHash)) add('UNKNOWN_CASE', 'app', 1, 'content');
    else covered.add(row.caseHash);
    if (row.unavailable || !row.bodyVerified) add('BODY_UNVERIFIED', 'app', 1, 'content');
    if (!keys(row.firstReview, ['actorHash', 'at']) || !HASH.test(row.firstReview.actorHash || '') ||
        !date(row.firstReview.at) || row.firstReview.at > app.capturedAt) add('REVIEW_UNVERIFIED', 'app', 1, 'content');
    const completeAttachment = (item) => {
      if (!keys(item, ['availability', 'transferVersion', 'transferSize', 'servedChunks']) || item.availability !== 'verified' ||
          item.transferVersion !== 1 || !Number.isSafeInteger(item.transferSize) || item.transferSize < 0 || item.transferSize > MAX_ATTACHMENT_BYTES ||
          !array(item.servedChunks)) return false;
      const count = Math.max(1, Math.ceil(item.transferSize / CHUNK_SIZE));
      return item.servedChunks.length === count && new Set(item.servedChunks).size === count &&
        item.servedChunks.every((offset) => Number.isSafeInteger(offset) && offset >= 0 && offset % CHUNK_SIZE === 0 && offset / CHUNK_SIZE < count);
    };
    if (row.attachments.length !== row.attachmentCount || !row.attachments.every(completeAttachment)) add('ATTACHMENT_UNVERIFIED', 'app', 1, 'content');
  }
  const confirmed = new Set();
  for (const row of Array.isArray(app?.noMailConfirmations) ? app.noMailConfirmations : []) {
    if (!keys(row, ['caseHash', 'evidenceHash']) || !HASH.test(row.caseHash || '') || !HASH.test(row.evidenceHash || '') ||
        !sheetCases.has(row.caseHash) || covered.has(row.caseHash) || confirmed.has(row.caseHash)) add('NO_MAIL_EVIDENCE_INVALID', 'app', 1, 'content');
    else confirmed.add(row.caseHash);
  }
  const noMailCaseCount = [...sheetCases.keys()].filter((id) => !covered.has(id) && !confirmed.has(id)).length;
  if (noMailCaseCount) add('CASE_MAIL_UNCONFIRMED', 'app', noMailCaseCount, 'content');
  if (app && (!app.syncComplete || app.residualCount > 0)) add('APP_RESIDUALS', 'app', Math.max(1, app.residualCount || 0), 'content');
  return { schemaVersion: 1, idReconciliationPass: !failures.some((item) => item.category === 'identity'),
    technicalReady: failures.length === 0, businessAcceptance: 'unverified',
    counts: { sheetCases: sheetCases.size, appCases: appCases.size, gmailMessages: gmailMessages.size,
      appMessages: appMessages.size, noMailCaseCount }, failures };
}
