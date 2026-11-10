import { createHash } from 'node:crypto';
import { assertMail, MailError } from './errors.mjs';
import { validateActor } from './auth.mjs';
import { mixedThreadDemotions } from './mixedThread.mjs';
import { ATTACHMENT_CHUNK_SIZE, attachmentReviewReady } from './attachmentObservation.mjs';
import { normalizeCatalogCases, catalogRetention, retentionPolicy, isRetainedRecord, assertRetainedRecord } from './caseRetention.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const OPERATIONS = new Set(['listCaseMail', 'listUnreviewedMail', 'listPendingMail', 'getMail',
  'getAttachmentChunk', 'markReviewed', 'resolvePending', 'getSyncStatus', 'getSyncRequestResult', 'uploadCaseCatalog', 'advanceSync', 'reconcilePending', 'listMailIssues']);
const PAGE_SIZE = 50;
const WORK_SIZE = 5;
const CHUNK_SIZE = ATTACHMENT_CHUNK_SIZE;

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function digest(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

export function catalogDigest(cases) {
  return digest(normalizeCatalogCases(cases).map((item) => JSON.stringify([item.caseId, item.handledStatus, item.closedAt])).join('\n'));
}

export function summary(record) {
  const fields = ['messageId', 'threadId', 'caseId', 'matchState', 'version', 'internalDate',
    'subject', 'from', 'to', 'direction', 'attachmentCount', 'firstReview', 'unavailable', 'reason', 'evidence'];
  return Object.fromEntries(fields.map((key) => [key, record[key] ?? (['firstReview', 'evidence'].includes(key) ? null : '')]));
}

function caseId(value) {
  const id = String(value || '').toLowerCase();
  assertMail(UUID.test(id));
  return id;
}

function messageId(value) {
  assertMail(typeof value === 'string' && ID.test(value));
  return value;
}

function cursorToken(record, direction, scopeKey) {
  return Buffer.from(JSON.stringify({ id: record.messageId, at: record.internalDate, direction, scopeKey })).toString('base64url');
}

function parseCursor(token, scopeKey) {
  if (!token) return null;
  assertMail(typeof token === 'string' && token.length <= 2048 && /^[A-Za-z0-9_-]+$/.test(token));
  try {
    const cursor = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    assertMail(cursor.scopeKey === scopeKey && ID.test(cursor.id) && Number.isFinite(Date.parse(cursor.at)) &&
      ['next', 'previous'].includes(cursor.direction));
    return cursor;
  } catch (error) {
    if (error instanceof MailError) throw error;
    throw new MailError('MAIL_INVALID_REQUEST');
  }
}

function assertScope(record, payload) {
  const scope = payload.scope || (payload.caseId ? 'case' : 'unreviewed');
  assertMail(['case', 'pending', 'unreviewed', 'issues'].includes(scope));
  if (scope === 'issues') assertMail(['matched', 'pending'].includes(record.matchState), 'MAIL_MAPPING_CHANGED', 409);
  if (scope === 'case') assertMail(record.matchState === 'matched' && record.caseId === caseId(payload.caseId), 'MAIL_MAPPING_CHANGED', 409);
  if (scope === 'pending') assertMail(record.matchState === 'pending', 'MAIL_MAPPING_CHANGED', 409);
  if (scope === 'unreviewed') assertMail(record.matchState === 'matched', 'MAIL_MAPPING_CHANGED', 409);
}

function periodStart(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

function withinPeriod(record, startAt) {
  return Boolean(startAt && typeof record?.internalDate === 'string' && record.internalDate >= startAt);
}

export function createMailService({ store, gmail, core, now = () => new Date(), trustedAnchor = () => false }) {
  assertMail(store && typeof store.withAccess === 'function' && gmail && core, 'MAIL_NOT_CONFIGURED', 503);

  async function syncStatus(override) {
    const state = override || await store.getSyncState();
    const startAt = periodStart(state?.startAt);
    const counts = startAt ? await store.countMessages({ startAt }) : {
      pending: null, unreviewed: null, unavailable: null, bodyUnverified: null, bodyUnavailable: null,
      attachmentUnverified: null, attachmentUnavailable: null
    };
    const unobservedDeletedCount = startAt ? await store.countUnobservedDeletions() : null;
    const catalog = await store.getCatalog();
    const retention = catalog.complete ? catalogRetention(catalog, now()) : null;
    const covered = new Set(startAt ? await store.getCoveredCaseIds({ startAt }) : []);
    const coverageUnverified = catalog.caseIds.filter((id) => !covered.has(id));
    const enumerationComplete = Boolean(startAt) && state?.state === 'complete';
    const residual = counts.pending + counts.unreviewed + counts.unavailable + (state?.failedCount || 0) +
      counts.bodyUnverified + counts.bodyUnavailable + counts.attachmentUnverified + counts.attachmentUnavailable + unobservedDeletedCount;
    return {
      state: !startAt && state ? 'needs_full_sync' : state?.state || 'not_started', lastSuccessAt: state?.lastSuccessAt || null,
      pendingCount: counts.pending, unreviewedCount: counts.unreviewed, failedCount: startAt ? state?.failedCount || 0 : null,
      unavailableCount: counts.unavailable, remainingPages: Boolean(startAt && state?.state === 'running'),
      startAt: startAt || null, cutoffAt: state?.cutoffAt || null, errorCode: !startAt && state ? 'MAIL_PERIOD_REQUIRED' : state?.errorCode || null,
      processedCount: state?.processedCount || 0, phase: state?.phase || 'enumerate',
      failedMessageIds: startAt ? state?.failedMessageIds || [] : [],
      unobservedDeletedCount,
      executionId: state?.executionId || null, mode: state?.mode || null, historyAvailable: Boolean(startAt && state?.historyId),
      enumerationComplete, acceptanceReady: Boolean(startAt) && enumerationComplete && catalog.complete && residual === 0 && coverageUnverified.length === 0 && retention.unknownClosureCaseIds.length === 0 && retention.expiredCaseIds.length === 0,
      coverageUnverifiedCaseCount: catalog.complete && startAt ? coverageUnverified.length : null,
      coverageUnverifiedCaseIds: startAt ? coverageUnverified.slice(0, 50) : [],
      unknownClosureCaseCount: retention ? retention.unknownClosureCaseIds.length : null,
      expiredCaseCount: retention ? retention.expiredCaseIds.length : null,
      bodyUnverifiedCount: counts.bodyUnverified, bodyUnavailableCount: counts.bodyUnavailable,
      attachmentUnverifiedCount: counts.attachmentUnverified, attachmentUnavailableCount: counts.attachmentUnavailable
    };
  }

  async function assertCaseRetention(id) {
    const catalog = await store.getCatalog();
    assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
    assertRetainedRecord({ caseId: id }, retentionPolicy(catalog, now()));
  }

  async function activeStartAt() {
    const startAt = periodStart((await store.getSyncState())?.startAt);
    assertMail(startAt, 'MAIL_PERIOD_REQUIRED', 409);
    return startAt;
  }

  async function requireRecord(payload, { allowUnavailable = false } = {}) {
    const record = await store.getMessage(messageId(payload.messageId));
    assertMail(record, 'MAIL_NOT_FOUND', 404);
    assertMail(withinPeriod(record, await activeStartAt()), 'MAIL_NOT_FOUND', 404);
    assertScope(record, payload);
    if (record.caseId) await assertCaseRetention(record.caseId);
    if (!allowUnavailable) assertMail(!record.unavailable, 'MAIL_CONTENT_UNAVAILABLE', 410);
    return record;
  }

  async function fetchMessage(id, includeDraft = false) {
    try {
      const message = await gmail.getMessage(id);
      assertMail(message?.id === id, 'MAIL_INVALID_UPSTREAM', 502);
      if (!includeDraft && message.labelIds?.includes('DRAFT')) {
        await store.excludeDraft(id, now().toISOString());
        throw new MailError('MAIL_MAPPING_CHANGED', 409);
      }
      return message;
    } catch (error) {
      if (error.code === 'MAIL_CONTENT_UNAVAILABLE') await store.markUnavailable(id, now().toISOString());
      throw error;
    }
  }

  async function list(operation, payload) {
    const startAt = await activeStartAt();
    const mode = operation === 'listCaseMail' ? 'case' : operation === 'listPendingMail' ? 'pending' : 'unreviewed';
    const targetCaseId = mode === 'case' ? caseId(payload.caseId) : null;
    if (targetCaseId) {
      const catalog = await store.getCatalog();
      assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
      assertRetainedRecord({ caseId: targetCaseId }, retentionPolicy(catalog, now()));
    }
    const scopeKey = `${mode}:${targetCaseId || ''}:${startAt}`;
    const cursor = parseCursor(payload.pageToken, scopeKey);
    const catalog = await store.getCatalog();
    assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
    const policy = retentionPolicy(catalog, now());
    const result = await store.listMessages({ mode, caseId: targetCaseId, startAt, cursor, limit: PAGE_SIZE + 1 });
    const more = result.length > PAGE_SIZE;
    let scanned = result.slice(0, PAGE_SIZE);
    if (cursor?.direction === 'previous') scanned = scanned.reverse();
    const records = scanned.filter((item) => isRetainedRecord(item, policy));
    const hasPrevious = cursor?.direction === 'previous' ? more : Boolean(cursor);
    const hasNext = cursor?.direction === 'previous' ? Boolean(cursor) : more;
    const sync = await syncStatus();
    assertMail(periodStart(sync.startAt) === startAt, 'MAIL_MAPPING_CHANGED', 409);
    assertMail((await store.getCatalog()).digest === catalog.digest, 'MAIL_CATALOG_CHANGED', 409);
    return {
      messages: records.map(summary),
      page: {
        nextPageToken: hasNext && scanned.length ? cursorToken(scanned.at(-1), 'next', scopeKey) : '',
        previousPageToken: hasPrevious && scanned.length ? cursorToken(scanned[0], 'previous', scopeKey) : '',
        pageSize: PAGE_SIZE
      },
      sync
    };
  }

  async function getMail(payload) {
    const record = await requireRecord(payload, { allowUnavailable: true });
    const metadataOnly = (item) => ({ message: { ...summary(item), bodyText: '', bodyAvailability: 'unavailable', reviewReady: false,
      attachments: (item.attachments || []).map(({ partId, name, mimeType, size, availability }) => ({ partId, name, mimeType, size, availability })) } });
    if (record.unavailable) return metadataOnly(await requireRecord(payload, { allowUnavailable: true }));
    let message;
    try { message = await fetchMessage(record.messageId); } catch (error) {
      if (error.code === 'MAIL_CONTENT_UNAVAILABLE') return metadataOnly(await requireRecord(payload, { allowUnavailable: true }));
      throw error;
    }
    const parsed = core.inspectMime(message);
    let bodyText;
    try {
      bodyText = await core.readMessageText(message, gmail.getAttachment.bind(gmail));
      await store.recordBodyObservation(record.messageId, 'verified', now().toISOString());
    } catch {
      await store.recordBodyObservation(record.messageId, 'unavailable', now().toISOString());
      bodyText = '';
    }
    const latest = await requireRecord(payload);
    return { message: { ...summary(latest), bodyText, bodyAvailability: latest.bodyAvailability, reviewReady: attachmentReviewReady(latest), attachments: parsed.attachments.map((item) => ({
      partId: item.partId, name: item.name, mimeType: item.mimeType, size: item.size, inline: item.inline,
      availability: latest.attachments?.find((stored) => stored.partId === item.partId)?.availability || 'unverified'
    })) } };
  }

  async function listIssues(payload) {
    const startAt = await activeStartAt();
    const kinds = ['pending', 'unreviewed', 'unavailable', 'bodyUnverified', 'bodyUnavailable', 'attachmentUnverified', 'attachmentUnavailable', 'failed', 'coverage', 'deleted', 'unknownClosure', 'expiredRetention'];
    const kind = payload.kind;
    assertMail(kinds.includes(kind));
    const currentCatalog = await store.getCatalog();
    assertMail(currentCatalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
    const policy = retentionPolicy(currentCatalog, now());
    const scopeKey = `issues:${kind}:${startAt}`;
    let cursor = null;
    if (payload.pageToken) {
      assertMail(typeof payload.pageToken === 'string' && /^[A-Za-z0-9_-]{1,2048}$/.test(payload.pageToken));
      try { cursor = JSON.parse(Buffer.from(payload.pageToken, 'base64url').toString('utf8')); } catch { throw new MailError('MAIL_INVALID_REQUEST'); }
      assertMail(cursor && cursor.scopeKey === scopeKey);
    }
    const token = (value) => Buffer.from(JSON.stringify({ scopeKey, ...value })).toString('base64url');
    let targets;
    let nextPageToken = '';
    let scannedCount;
    if (kind === 'deleted') {
      if (cursor) assertMail(ID.test(cursor.id) && Number.isFinite(Date.parse(cursor.at)));
      const rows = await store.listUnobservedDeletions({ cursor, limit: PAGE_SIZE + 1 });
      const pageRows = rows.slice(0, PAGE_SIZE);
      targets = pageRows.map((item) => ({ type: 'deleted', messageId: item.messageId, detectedAt: item.detectedAt }));
      if (rows.length > PAGE_SIZE) nextPageToken = token({ id: pageRows.at(-1).messageId, at: pageRows.at(-1).detectedAt });
      scannedCount = pageRows.length;
    } else if (['coverage', 'failed', 'unknownClosure', 'expiredRetention'].includes(kind)) {
      const state = await store.getSyncState();
      let ids;
      if (kind !== 'failed') {
        const catalog = await store.getCatalog();
        assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
        const covered = new Set(await store.getCoveredCaseIds({ startAt }));
        const retention = catalogRetention(catalog, now());
        ids = kind === 'unknownClosure' ? retention.unknownClosureCaseIds : kind === 'expiredRetention' ? retention.expiredCaseIds : catalog.caseIds.filter((id) => !covered.has(id)).sort();
      } else ids = [...new Set(state?.failedMessageIds || [])].sort();
      const snapshot = digest({ ids, executionId: kind === 'failed' ? state?.executionId || '' : '' });
      const offset = cursor?.offset || 0;
      assertMail(Number.isSafeInteger(offset) && offset >= 0 && (!cursor || cursor.snapshot === snapshot), 'MAIL_MAPPING_CHANGED', 409);
      const pageIds = ids.slice(offset, offset + PAGE_SIZE);
      targets = await Promise.all(pageIds.map(async (id) => kind !== 'failed' ? { type: 'case', caseId: id } :
        { type: 'message', messageId: id, message: await store.getMessage(id).then((item) => withinPeriod(item, startAt) && ['matched', 'pending'].includes(item.matchState) && isRetainedRecord(item, policy) ? summary(item) : null) }));
      if (kind === 'failed' && !ids.length && state?.state === 'failed') targets = [{ type: 'sync', errorCode: state.errorCode || 'MAIL_SYNC_FAILED' }];
      if (offset + PAGE_SIZE < ids.length) nextPageToken = token({ offset: offset + PAGE_SIZE, snapshot });
      scannedCount = pageIds.length;
    } else {
      if (cursor) assertMail(ID.test(cursor.id) && Number.isFinite(Date.parse(cursor.at)));
      const rows = await store.listIndexedScope({ startAt, cutoffAt: '9999-12-31T23:59:59.999Z', cursor, limit: PAGE_SIZE + 1 });
      const pageRows = rows.slice(0, PAGE_SIZE);
      const filters = {
        pending: (item) => item.matchState === 'pending', unreviewed: (item) => item.matchState === 'matched' && !item.firstReview,
        unavailable: (item) => item.unavailable, bodyUnverified: (item) => item.bodyAvailability === 'unverified',
        bodyUnavailable: (item) => item.bodyAvailability === 'unavailable',
        attachmentUnverified: (item) => item.unverifiedAttachmentCount > 0, attachmentUnavailable: (item) => item.unavailableAttachmentCount > 0
      };
      targets = pageRows.filter((item) => ['matched', 'pending'].includes(item.matchState) && isRetainedRecord(item, policy) && filters[kind](item))
        .map((item) => ({ type: 'message', messageId: item.messageId, message: summary(item) }));
      if (rows.length > PAGE_SIZE) nextPageToken = token({ id: pageRows.at(-1).messageId, at: pageRows.at(-1).internalDate });
      scannedCount = pageRows.length;
    }
    const sync = await syncStatus();
    assertMail(periodStart(sync.startAt) === startAt, 'MAIL_MAPPING_CHANGED', 409);
    assertMail((await store.getCatalog()).digest === currentCatalog.digest, 'MAIL_CATALOG_CHANGED', 409);
    return { kind, targets, scannedCount, page: { nextPageToken, pageSize: PAGE_SIZE }, sync };
  }

  async function attachment(payload) {
    const record = await requireRecord(payload);
    assertMail(typeof payload.partId === 'string' && payload.partId.length <= 64 && /^0(?:\.\d+)*$/.test(payload.partId));
    const offset = payload.offset ?? 0;
    assertMail(Number.isSafeInteger(offset) && offset >= 0 && offset % CHUNK_SIZE === 0);
    const message = await fetchMessage(record.messageId);
    let result;
    try {
      result = await core.readMailAttachment(message, payload.partId, gmail.getAttachment.bind(gmail));
    } catch (error) {
      if (error instanceof MailError && error.code === 'MAIL_ATTACHMENT_BUSY') throw error;
      await store.recordAttachmentObservation(record.messageId, payload.partId, 'unavailable', now().toISOString());
      throw new MailError('MAIL_ATTACHMENT_UNAVAILABLE', 410);
    }
    const bytes = result.previewKind === 'text' ? Buffer.from(result.text, 'utf8') : Buffer.from(result.bytes);
    assertMail(offset < bytes.length || (offset === 0 && bytes.length === 0));
    await requireRecord(payload);
    const chunk = bytes.subarray(offset, Math.min(offset + CHUNK_SIZE, bytes.length));
    const observed = await store.recordAttachmentObservation(record.messageId, payload.partId, 'served', now().toISOString(),
      { offset, totalSize: bytes.length, contentDigest: createHash('sha256').update(bytes).digest('hex') });
    const latest = await requireRecord(payload);
    return { reviewReady: attachmentReviewReady(latest), attachment: { partId: payload.partId, name: result.name,
      mimeType: result.mimeType, size: bytes.length, previewKind: result.previewKind, availability: observed.availability },
    offset, nextOffset: offset + chunk.length, totalSize: bytes.length,
    dataBase64: chunk.toString('base64'), done: offset + chunk.length === bytes.length };
  }

  async function write(operation, payload, actor, requestId) {
    const id = messageId(payload.messageId);
    const startAt = await activeStartAt();
    assertMail(withinPeriod(await store.getMessage(id), startAt), 'MAIL_NOT_FOUND', 404);
    const current = await store.getMessage(id);
    if (current?.caseId) await assertCaseRetention(current.caseId);
    assertMail(Number.isSafeInteger(payload.expectedVersion) && payload.expectedVersion >= 1);
    const fingerprint = digest({ operation, payload, actor, startAt });
    const catalog = await store.getCatalog();
    assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
    const policy = retentionPolicy(catalog, now());
    if (current?.caseId) assertRetainedRecord(current, policy);
    return store.mutate(requestId, fingerprint, async (transaction) => {
      const record = await transaction.getMessage(id);
      assertMail(record, 'MAIL_NOT_FOUND', 404);
      assertRetainedRecord(record, policy);
      assertMail(withinPeriod(record, periodStart((await transaction.getSyncState())?.startAt)), 'MAIL_NOT_FOUND', 404);
      let transition;
      if (operation === 'markReviewed') {
        assertScope(record, payload);
        assertMail(record.matchState === 'matched' && !record.unavailable, 'MAIL_MAPPING_CHANGED', 409);
        if (record.firstReview) return { message: summary(record) };
        assertMail(attachmentReviewReady(record), 'MAIL_CONTENT_UNAVAILABLE', 410);
        assertMail(record.version === payload.expectedVersion, 'MAIL_MAPPING_CHANGED', 409);
        transition = core.recordFirstReview(record, { email: actor.email, verified: true }, now().toISOString());
      } else {
        assertMail(record.version === payload.expectedVersion, 'MAIL_MAPPING_CHANGED', 409);
        assertMail(record.matchState === 'pending', 'MAIL_MAPPING_CHANGED', 409);
        assertMail(['match', 'exclude'].includes(payload.action));
        assertMail(typeof payload.reason === 'string' && payload.reason.trim().length >= 1 && payload.reason.length <= 1000);
        const targetCase = payload.action === 'match' ? caseId(payload.caseId) : null;
        if (targetCase) {
          assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
          assertMail(catalog.caseIds.includes(targetCase), 'MAIL_CASE_NOT_FOUND', 404);
          assertRetainedRecord({ caseId: targetCase }, policy);
        }
        transition = core.classifyManually(record, {
          matchState: payload.action === 'match' ? 'matched' : 'excluded', caseId: targetCase,
          expectedVersion: payload.expectedVersion, reason: payload.reason
        }, { email: actor.email, verified: true }, now().toISOString(), catalog.caseIds);
      }
      const threadRecords = transition.record.threadId ? (await transaction.getThreadMessages(transition.record.threadId)).filter((item) => isRetainedRecord(item, policy)) : [];
      const demotions = mixedThreadDemotions([...threadRecords.filter((item) => item.messageId !== id), transition.record], now().toISOString());
      transaction.setMessage(transition.record);
      if (transition.event) transaction.addEvent({ ...transition.event, requestId });
      for (const demotion of demotions) {
        transaction.setMessage(demotion.record);
        transaction.addEvent({ ...demotion.event, requestId });
      }
      return { message: summary(demotions.find((item) => item.record.messageId === id)?.record || transition.record) };
    }, startAt, catalog.digest);
  }

  async function uploadCatalog(payload) {
    assertMail(ID.test(payload.snapshotId || '') && Number.isInteger(payload.pageIndex) && payload.pageIndex >= 0 &&
      Number.isInteger(payload.pageCount) && payload.pageCount >= 1 && payload.pageCount <= 500 &&
      payload.pageIndex < payload.pageCount && Number.isInteger(payload.total) && payload.total >= 0 && payload.total <= 100000 &&
      /^[a-f0-9]{64}$/.test(payload.digest || '') && Array.isArray(payload.cases) && payload.cases.length <= 200);
    const cases = normalizeCatalogCases(payload.cases);
    assertMail(cases.every((item) => !item.closedAt || Date.parse(item.closedAt) <= now().getTime()), 'MAIL_CATALOG_INVALID', 409);
    return { catalog: await store.uploadCatalogPage({ ...payload, cases }, catalogDigest) };
  }

  async function indexMessage(id, catalog, scope = {}) {
    if (await store.isMessageSuppressed?.(id)) return;
    let message;
    try { message = await fetchMessage(id, true); } catch (error) {
      if (error.code === 'MAIL_CONTENT_UNAVAILABLE') {
        const existing = await store.getMessage(id);
        if (scope.draftEvidence && existing?.sourceKind !== 'mail') await store.excludeDraft(id, now().toISOString());
        else if (!existing) await store.recordUnobservedDeletion(id, now().toISOString());
        return;
      }
      throw error;
    }
    if (message.labelIds?.includes('DRAFT')) {
      await store.excludeDraft(id, now().toISOString());
      return;
    }
    const internalDate = new Date(Number(message.internalDate)).toISOString();
    if ((scope.startAt && internalDate < scope.startAt) || (scope.cutoffAt && internalDate > scope.cutoffAt)) return;
    const parsed = core.inspectMime(message);
    let bodyText = '';
    let bodyAvailability = 'verified';
    try { bodyText = await core.readMessageText(message, gmail.getAttachment.bind(gmail)); }
    catch { bodyAvailability = 'unavailable'; }
    const referenceIds = core.replyMessageIds(message.payload?.headers || []);
    const referenceMatches = await store.findReferences(referenceIds.slice(0, 100));
    const threadMatches = message.threadId ? await store.findThreadMessages(message.threadId) : [];
    const classification = bodyAvailability === 'verified' && referenceIds.length <= 100 ? core.classifyMessage({ bodyText, headers: message.payload?.headers || [],
      trustedAnchor: trustedAnchor(message) === true }, catalog.caseIds, referenceMatches, threadMatches.filter((item) => item.messageId !== id)) :
      { matchState: 'pending', caseId: null, reason: bodyAvailability === 'verified' ? 'evidence_limit' : 'body_unavailable', evidence: { bodyCaseIds: [], currentCaseIds: [], parentMessageIds: [] } };
    const latestCatalog = await store.getCatalog();
    assertMail(latestCatalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
    assertMail(latestCatalog.digest === catalog.digest, 'MAIL_CATALOG_CHANGED', 409);
    const policy = retentionPolicy(latestCatalog, now());
    const existing = await store.getMessage(id);
    if (existing) assertRetainedRecord(existing, policy);
    const expiredIds = policy.expiredCaseIds;
    assertMail(!expiredIds.includes(classification.caseId) && !classification.evidence.currentCaseIds.some((id) => expiredIds.includes(id)), 'MAIL_RETENTION_EXPIRED', 410);
    for (const key of ['bodyCaseIds', 'currentCaseIds', 'parentMessageIds']) {
      if (classification.evidence[key].length > 100) {
        classification.evidence[key] = classification.evidence[key].slice(0, 100);
        classification.evidence.truncated = true;
      }
    }
    const headers = message.payload?.headers || [];
    const scrub = (value) => core.safeMailText(value).slice(0, 4096);
    const from = scrub(core.headerValue(headers, 'From'));
    const to = scrub(core.headerValue(headers, 'To'));
    const rawRfcMessageId = core.headerValue(headers, 'Message-ID').trim();
    const rfcMessageId = rawRfcMessageId.length <= 512 && /^<[^<>\s]+@[^<>\s]+>$/.test(rawRfcMessageId) ? rawRfcMessageId : '';
    await store.upsertIndexedMessage({ messageId: id, sourceKind: 'mail', threadId: message.threadId || '', internalDate,
      subject: scrub(core.headerValue(headers, 'Subject')), from, to,
      direction: Array.isArray(message.labelIds) ? (message.labelIds.includes('SENT') ? 'sent' : 'received') : 'unknown',
      attachmentCount: parsed.attachments.length, rfcMessageId, unavailable: false,
      attachments: parsed.attachments.map((item) => ({ partId: item.partId, name: item.name, mimeType: item.mimeType,
        size: item.size, availability: 'unverified', checkedAt: null })),
      bodyAvailability, bodyCheckedAt: now().toISOString(),
      unverifiedAttachmentCount: parsed.attachments.length, unavailableAttachmentCount: 0,
      ...classification, version: 1, firstReview: null, indexedAt: now().toISOString(),
      ...(scope.generation ? { indexedGeneration: scope.generation } : {}) }, latestCatalog.digest, policy);
  }

  async function reconcilePending(payload, requestId, actor) {
    const startAt = await activeStartAt();
    const fingerprint = digest({ operation: 'reconcilePending', payload, actor, startAt });
    const receipt = await store.getReceipt(requestId, fingerprint);
    if (receipt) return receipt;
    const catalog = await store.getCatalog();
    assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
    const scopeKey = `reconcile:${startAt}`;
    const cursor = parseCursor(payload.pageToken, scopeKey);
    assertMail(!cursor || cursor.direction === 'next');
    const records = await store.listMessages({ mode: 'pending', startAt, cursor, limit: WORK_SIZE + 1 });
    const batch = records.slice(0, WORK_SIZE);
    for (const record of batch) await indexMessage(record.messageId, catalog, { startAt });
    const result = { processedCount: batch.length,
      page: { nextPageToken: records.length > WORK_SIZE ? cursorToken(batch.at(-1), 'next', scopeKey) : '', previousPageToken: '', pageSize: WORK_SIZE },
      sync: await syncStatus() };
    await store.saveReceipt(requestId, fingerprint, result);
    return result;
  }

  async function advanceSync(payload, requestId, actor) {
    assertMail(ID.test(payload.executionId || ''));
    const fingerprint = digest({ operation: 'advanceSync', payload, actor });
    const receipt = await store.getReceipt(requestId, fingerprint);
    if (receipt) return receipt;
    let catalog = await store.getCatalog();
    assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
    const lease = await store.acquireSyncLease(requestId, now().toISOString());
    assertMail(lease, 'MAIL_SYNC_BUSY', 409);
    let state;
    try {
      state = await store.getSyncState();
      if (state?.executionId === payload.executionId && state.catalogSnapshotId) catalog = await store.getCatalog(state.catalogSnapshotId);
      assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
      if (state?.executionId === payload.executionId && state.state === 'failed' && payload.resume === true) {
        state = { ...state, state: 'running', errorCode: null, failedCount: 0 };
        await store.setSyncState(state, lease);
      }
      if (state?.executionId !== payload.executionId) {
        assertMail(!state || state.state !== 'running' || !periodStart(state.startAt), 'MAIL_SYNC_BUSY', 409);
        assertMail(['full', 'history'].includes(payload.mode));
        if (payload.catalogSnapshotId !== undefined) assertMail(payload.catalogSnapshotId === catalog.snapshotId && payload.catalogDigest === catalog.digest, 'MAIL_CATALOG_CHANGED', 409);
        if (payload.mode === 'history') assertMail(state?.historyId, 'MAIL_FULL_SYNC_REQUIRED', 409);
        const startAt = periodStart(payload.startAt);
        assertMail(startAt, 'MAIL_PERIOD_REQUIRED', 409);
        const mode = payload.mode === 'history' && startAt !== periodStart(state?.startAt) ? 'full' : payload.mode;
        const startedAt = now().toISOString();
        assertMail(startAt <= startedAt, 'MAIL_INVALID_REQUEST');
        const profile = await gmail.getProfile();
        assertMail(profile.emailAddress?.toLowerCase() === 'customer@speed-ad.com', 'MAIL_MAILBOX_MISMATCH', 403);
        // History must cover a snapshot requested after this time, not the later processing completion time.
        const at = mode === 'history' ? startedAt : now().toISOString();
        state = { executionId: payload.executionId, mode, state: 'running', pageToken: null,
          startAt, cutoffAt: at, historyId: state?.historyId || null,
          initialHistoryId: String(profile.historyId || ''), failedCount: 0, processedCount: 0,
          catalogSnapshotId: catalog.snapshotId || null,
          lastSuccessAt: state?.lastSuccessAt || null, errorCode: null };
        assertMail(/^\d+$/.test(state.initialHistoryId), 'MAIL_INVALID_UPSTREAM', 502);
        await store.setSyncState(state, lease);
      }
      assertMail(periodStart(state?.startAt), 'MAIL_PERIOD_REQUIRED', 409);
      assertMail(state.state === 'running', state.state === 'complete' ? 'MAIL_SYNC_COMPLETE' : 'MAIL_FULL_SYNC_REQUIRED', 409);
      if (state.phase === 'finalize') {
        const records = await store.listIndexedScope({ startAt: state.startAt, cutoffAt: state.cutoffAt, cursor: state.finalizeCursor, limit: PAGE_SIZE + 1 });
        const batch = records.slice(0, PAGE_SIZE);
        for (const record of batch) if (record.indexedGeneration !== state.executionId) await store.markUnavailable(record.messageId, now().toISOString());
        const more = records.length > PAGE_SIZE;
        state = { ...state, finalizeCursor: more ? { at: batch.at(-1).internalDate, id: batch.at(-1).messageId } : null,
          state: more ? 'running' : 'complete' };
        if (!more) { state.historyId = state.initialHistoryId; state.lastSuccessAt = now().toISOString(); }
        const result = { sync: await syncStatus(state) };
        await store.setSyncState(state, lease, { requestId, fingerprint, result });
        return result;
      }
      let page = state.inFlightPage?.page;
      try {
        if (!page) page = state.mode === 'full' ? await gmail.listMessages({ pageToken: state.pageToken,
          startAt: state.startAt, cutoffAt: state.cutoffAt }) :
          await gmail.listHistory({ pageToken: state.pageToken, startHistoryId: state.historyId });
      } catch (error) {
        if (state.mode === 'history' && error.code === 'MAIL_HISTORY_EXPIRED') {
          state = { ...state, state: 'needs_full_sync', errorCode: 'MAIL_HISTORY_EXPIRED', failedCount: 1 };
          const result = { sync: await syncStatus(state) };
          await store.setSyncState(state, lease, { requestId, fingerprint, result });
          return result;
        }
        throw error;
      }
      assertMail(Array.isArray(page.messageIds) && page.messageIds.length <= 1000 &&
        (!page.deletedIds || (Array.isArray(page.deletedIds) && page.deletedIds.length <= 1000)) &&
        (!page.draftIds || (Array.isArray(page.draftIds) && page.draftIds.length <= 1000)) &&
        (!page.nextPageToken || typeof page.nextPageToken === 'string'), 'MAIL_INVALID_UPSTREAM', 502);
      if (page.nextPageToken) assertMail(page.nextPageToken !== state.pageToken, 'MAIL_INVALID_UPSTREAM', 502);
      if (state.mode === 'history') {
        assertMail(/^\d+$/.test(String(page.historyId || '')) && BigInt(page.historyId) >= BigInt(state.historyId) &&
          (!state.lastPageHistoryId || BigInt(page.historyId) >= BigInt(state.lastPageHistoryId)) &&
          (page.nextPageToken || BigInt(page.historyId) >= BigInt(state.initialHistoryId)), 'MAIL_INVALID_UPSTREAM', 502);
        state.lastPageHistoryId = String(page.historyId);
      }
      if (!state.inFlightPage) {
        page = { ...page, messageIds: [...new Set(page.messageIds)].map(messageId), deletedIds: [...new Set(page.deletedIds || [])].map(messageId),
          draftIds: [...new Set(page.draftIds || [])].map(messageId) };
        for (const id of page.draftIds) if (!page.messageIds.includes(id)) await store.excludeDraft(id, now().toISOString());
        state.inFlightPage = { page, index: 0 };
        await store.setSyncState(state, lease);
      }
      const end = Math.min(state.inFlightPage.index + WORK_SIZE, page.messageIds.length);
      while (state.inFlightPage.index < end) {
        const id = page.messageIds[state.inFlightPage.index];
        try { await indexMessage(messageId(id), catalog, { ...(state.mode === 'full' ? {
          startAt: state.startAt, cutoffAt: state.cutoffAt, generation: state.executionId
        } : { startAt: state.startAt }), draftEvidence: page.draftIds?.includes(id) === true }); }
        catch (error) { state.failedMessageIds = [id]; throw error; }
        state.inFlightPage.index += 1;
        state.processedCount += 1;
      }
      if (state.inFlightPage.index < page.messageIds.length) {
        const result = { sync: await syncStatus(state) };
        await store.setSyncState(state, lease, { requestId, fingerprint, result });
        return result;
      }
      for (const id of new Set(page.deletedIds || [])) {
        const record = await store.getMessage(messageId(id));
        if (record) await store.markUnavailable(id, now().toISOString());
        else await store.recordUnobservedDeletion(id, now().toISOString());
      }
      const complete = !page.nextPageToken && state.mode === 'history';
      state = { ...state, pageToken: page.nextPageToken || null,
        inFlightPage: null,
        state: complete ? 'complete' : 'running', errorCode: null, failedCount: 0, failedMessageIds: [],
        ...(!page.nextPageToken && state.mode === 'full' ? { phase: 'finalize', finalizeCursor: null } : {}) };
      if (complete) {
        const historyId = state.mode === 'history' ? String(page.historyId || '') : state.initialHistoryId;
        assertMail(/^\d+$/.test(historyId) && BigInt(historyId) >= BigInt(state.initialHistoryId), 'MAIL_INVALID_UPSTREAM', 502);
        state.historyId = historyId;
        state.lastSuccessAt = now().toISOString();
      }
      const result = { sync: await syncStatus(state) };
      await store.setSyncState(state, lease, { requestId, fingerprint, result });
      return result;
    } catch (error) {
      if (state?.executionId === payload.executionId && state.state === 'running') {
        await store.setSyncState({ ...state, state: 'failed', errorCode: error instanceof MailError ? error.code : 'MAIL_SYNC_FAILED', failedCount: 1 }, lease);
      }
      throw error;
    } finally {
      await store.releaseSyncLease(lease);
    }
  }

  async function execute(envelope) {
    assertMail(envelope && envelope.contractVersion === 1 && OPERATIONS.has(envelope.operation) &&
      ID.test(envelope.requestId || '') && typeof envelope.issuedAt === 'string' &&
      Math.abs(now().getTime() - Date.parse(envelope.issuedAt)) <= 120000 && envelope.payload &&
      typeof envelope.payload === 'object' && !Array.isArray(envelope.payload));
    const actor = validateActor(envelope.actor);
    const { operation, payload, requestId } = envelope;
    if (['uploadCaseCatalog', 'advanceSync', 'getSyncRequestResult', 'reconcilePending'].includes(operation)) assertMail(actor.authMode === 'domain', 'MAIL_FORBIDDEN', 403);
    return store.withAccess(async () => {
      let result;
      if (operation === 'listMailIssues') result = await listIssues(payload);
      else if (operation.startsWith('list')) result = await list(operation, payload);
      else if (operation === 'getMail') result = await getMail(payload);
      else if (operation === 'getAttachmentChunk') result = await attachment(payload);
      else if (operation === 'markReviewed' || operation === 'resolvePending') result = await write(operation, payload, actor, requestId);
      else if (operation === 'getSyncStatus') result = { sync: await syncStatus() };
      else if (operation === 'getSyncRequestResult') {
        const original = payload.requestPayload;
        assertMail(ID.test(payload.requestId || '') && original && typeof original === 'object' && !Array.isArray(original) &&
          ID.test(original.executionId || '') && Object.keys(original).every((key) => ['executionId', 'mode', 'catalogSnapshotId', 'catalogDigest', 'startAt', 'resume'].includes(key)));
        const receipt = await store.getReceipt(payload.requestId, digest({ operation: 'advanceSync', payload: original, actor }));
        result = { found: Boolean(receipt), receipt: receipt ? { sync: receipt.sync } : null, sync: await syncStatus() };
      }
      else if (operation === 'uploadCaseCatalog') result = await uploadCatalog(payload);
      else if (operation === 'advanceSync') result = await advanceSync(payload, requestId, actor);
      else if (operation === 'reconcilePending') result = await reconcilePending(payload, requestId, actor);
      return { ok: true, ...result };
    });
  }
  return execute;
}
