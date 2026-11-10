import { createHash } from 'node:crypto';
import { assertMail, MailError } from './errors.mjs';
import { validateActor } from './auth.mjs';
import { mixedThreadDemotions } from './mixedThread.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const OPERATIONS = new Set(['listCaseMail', 'listUnreviewedMail', 'listPendingMail', 'getMail',
  'getAttachmentChunk', 'markReviewed', 'resolvePending', 'getSyncStatus', 'uploadCaseCatalog', 'advanceSync', 'reconcilePending']);
const PAGE_SIZE = 50;
const WORK_SIZE = 5;
const CHUNK_SIZE = 512 * 1024;

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function digest(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

export function catalogDigest(ids) {
  return digest([...ids].sort().join('\n'));
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
  assertMail(['case', 'pending', 'unreviewed'].includes(scope));
  if (scope === 'case') assertMail(record.matchState === 'matched' && record.caseId === caseId(payload.caseId), 'MAIL_MAPPING_CHANGED', 409);
  if (scope === 'pending') assertMail(record.matchState === 'pending', 'MAIL_MAPPING_CHANGED', 409);
  if (scope === 'unreviewed') assertMail(record.matchState === 'matched', 'MAIL_MAPPING_CHANGED', 409);
}

export function createMailService({ store, gmail, core, now = () => new Date(), trustedAnchor = () => false }) {
  assertMail(store && gmail && core, 'MAIL_NOT_CONFIGURED', 503);

  async function syncStatus(override) {
    const state = override || await store.getSyncState();
    const counts = await store.countMessages();
    const catalog = await store.getCatalog();
    const covered = new Set(await store.getCoveredCaseIds());
    const coverageUnverified = catalog.caseIds.filter((id) => !covered.has(id));
    const enumerationComplete = state?.state === 'complete';
    const residual = counts.pending + counts.unreviewed + counts.unavailable + (state?.failedCount || 0) +
      counts.bodyUnverified + counts.bodyUnavailable + counts.attachmentUnverified + counts.attachmentUnavailable;
    return {
      state: state?.state || 'not_started', lastSuccessAt: state?.lastSuccessAt || null,
      pendingCount: counts.pending, unreviewedCount: counts.unreviewed, failedCount: state?.failedCount || 0,
      unavailableCount: counts.unavailable, remainingPages: state?.state === 'running',
      startAt: state?.startAt || null, cutoffAt: state?.cutoffAt || null, errorCode: state?.errorCode || null,
      processedCount: state?.processedCount || 0, phase: state?.phase || 'enumerate',
      failedMessageIds: state?.failedMessageIds || [],
      executionId: state?.executionId || null, mode: state?.mode || null, historyAvailable: Boolean(state?.historyId),
      enumerationComplete, acceptanceReady: enumerationComplete && catalog.complete && residual === 0 && coverageUnverified.length === 0,
      coverageUnverifiedCaseCount: catalog.complete ? coverageUnverified.length : null,
      coverageUnverifiedCaseIds: coverageUnverified.slice(0, 50),
      bodyUnverifiedCount: counts.bodyUnverified, bodyUnavailableCount: counts.bodyUnavailable,
      attachmentUnverifiedCount: counts.attachmentUnverified, attachmentUnavailableCount: counts.attachmentUnavailable
    };
  }

  async function requireRecord(payload) {
    const record = await store.getMessage(messageId(payload.messageId));
    assertMail(record, 'MAIL_NOT_FOUND', 404);
    assertScope(record, payload);
    assertMail(!record.unavailable, 'MAIL_CONTENT_UNAVAILABLE', 410);
    return record;
  }

  async function fetchMessage(id) {
    try {
      const message = await gmail.getMessage(id);
      assertMail(message?.id === id, 'MAIL_INVALID_UPSTREAM', 502);
      return message;
    } catch (error) {
      if (error.code === 'MAIL_CONTENT_UNAVAILABLE') await store.markUnavailable(id, now().toISOString());
      throw error;
    }
  }

  async function list(operation, payload) {
    const mode = operation === 'listCaseMail' ? 'case' : operation === 'listPendingMail' ? 'pending' : 'unreviewed';
    const targetCaseId = mode === 'case' ? caseId(payload.caseId) : null;
    if (targetCaseId) {
      const catalog = await store.getCatalog();
      assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
      assertMail(catalog.caseIds.includes(targetCaseId), 'MAIL_CASE_NOT_FOUND', 404);
    }
    const scopeKey = `${mode}:${targetCaseId || ''}`;
    const cursor = parseCursor(payload.pageToken, scopeKey);
    const result = await store.listMessages({ mode, caseId: targetCaseId, cursor, limit: PAGE_SIZE + 1 });
    const more = result.length > PAGE_SIZE;
    let records = result.slice(0, PAGE_SIZE);
    if (cursor?.direction === 'previous') records = records.reverse();
    const hasPrevious = cursor?.direction === 'previous' ? more : Boolean(cursor);
    const hasNext = cursor?.direction === 'previous' ? Boolean(cursor) : more;
    return {
      messages: records.map(summary),
      page: {
        nextPageToken: hasNext && records.length ? cursorToken(records.at(-1), 'next', scopeKey) : '',
        previousPageToken: hasPrevious && records.length ? cursorToken(records[0], 'previous', scopeKey) : '',
        pageSize: PAGE_SIZE
      },
      sync: await syncStatus()
    };
  }

  async function getMail(payload) {
    const record = await requireRecord(payload);
    const message = await fetchMessage(record.messageId);
    const parsed = core.inspectMime(message);
    let bodyText;
    try {
      bodyText = await core.readMessageText(message, gmail.getAttachment.bind(gmail));
      await store.recordBodyObservation(record.messageId, 'verified', now().toISOString());
    } catch {
      await store.recordBodyObservation(record.messageId, 'unavailable', now().toISOString());
      throw new MailError('MAIL_CONTENT_UNAVAILABLE', 410);
    }
    const latest = await requireRecord(payload);
    return { message: { ...summary(latest), bodyText, attachments: parsed.attachments.map((item) => ({
      partId: item.partId, name: item.name, mimeType: item.mimeType, size: item.size, inline: item.inline
    })) } };
  }

  async function attachment(payload) {
    const record = await requireRecord(payload);
    assertMail(typeof payload.partId === 'string' && payload.partId.length <= 64 && /^0(?:\.\d+)*$/.test(payload.partId));
    const offset = payload.offset ?? 0;
    assertMail(Number.isSafeInteger(offset) && offset >= 0);
    const message = await fetchMessage(record.messageId);
    let result;
    try {
      result = await core.readMailAttachment(message, payload.partId, gmail.getAttachment.bind(gmail));
      await store.recordAttachmentObservation(record.messageId, payload.partId, 'verified', now().toISOString());
    } catch {
      await store.recordAttachmentObservation(record.messageId, payload.partId, 'unavailable', now().toISOString());
      throw new MailError('MAIL_ATTACHMENT_UNAVAILABLE', 410);
    }
    const bytes = result.previewKind === 'text' ? Buffer.from(result.text, 'utf8') : Buffer.from(result.bytes);
    assertMail(offset <= bytes.length);
    await requireRecord(payload);
    const chunk = bytes.subarray(offset, Math.min(offset + CHUNK_SIZE, bytes.length));
    return { attachment: { partId: payload.partId, name: result.name,
      mimeType: result.mimeType, size: bytes.length, previewKind: result.previewKind },
    offset, nextOffset: offset + chunk.length, totalSize: bytes.length,
    dataBase64: chunk.toString('base64'), done: offset + chunk.length === bytes.length };
  }

  async function write(operation, payload, actor, requestId) {
    const id = messageId(payload.messageId);
    assertMail(Number.isSafeInteger(payload.expectedVersion) && payload.expectedVersion >= 1);
    const fingerprint = digest({ operation, payload, actor });
    const catalog = operation === 'resolvePending' ? await store.getCatalog() : null;
    return store.mutate(requestId, fingerprint, async (transaction) => {
      const record = await transaction.getMessage(id);
      assertMail(record, 'MAIL_NOT_FOUND', 404);
      let transition;
      if (operation === 'markReviewed') {
        assertScope(record, payload);
        assertMail(record.matchState === 'matched' && !record.unavailable, 'MAIL_MAPPING_CHANGED', 409);
        if (record.firstReview) return { message: summary(record) };
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
        }
        transition = core.classifyManually(record, {
          matchState: payload.action === 'match' ? 'matched' : 'excluded', caseId: targetCase,
          expectedVersion: payload.expectedVersion, reason: payload.reason
        }, { email: actor.email, verified: true }, now().toISOString(), catalog.caseIds);
      }
      const threadRecords = transition.record.threadId ? await transaction.getThreadMessages(transition.record.threadId) : [];
      const demotions = mixedThreadDemotions([...threadRecords.filter((item) => item.messageId !== id), transition.record], now().toISOString());
      transaction.setMessage(transition.record);
      if (transition.event) transaction.addEvent({ ...transition.event, requestId });
      for (const demotion of demotions) {
        transaction.setMessage(demotion.record);
        transaction.addEvent({ ...demotion.event, requestId });
      }
      return { message: summary(demotions.find((item) => item.record.messageId === id)?.record || transition.record) };
    });
  }

  async function uploadCatalog(payload) {
    assertMail(ID.test(payload.snapshotId || '') && Number.isInteger(payload.pageIndex) && payload.pageIndex >= 0 &&
      Number.isInteger(payload.pageCount) && payload.pageCount >= 1 && payload.pageCount <= 500 &&
      payload.pageIndex < payload.pageCount && Number.isInteger(payload.total) && payload.total >= 0 && payload.total <= 100000 &&
      /^[a-f0-9]{64}$/.test(payload.digest || '') && Array.isArray(payload.caseIds) && payload.caseIds.length <= 200);
    const ids = payload.caseIds.map(caseId);
    assertMail(new Set(ids).size === ids.length);
    return { catalog: await store.uploadCatalogPage({ ...payload, caseIds: ids }, catalogDigest) };
  }

  async function indexMessage(id, catalog, scope = {}) {
    let message;
    try { message = await fetchMessage(id); } catch (error) {
      if (error.code === 'MAIL_CONTENT_UNAVAILABLE') {
        await store.markUnavailable(id, now().toISOString());
        return;
      }
      throw error;
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
    await store.upsertIndexedMessage({ messageId: id, threadId: message.threadId || '', internalDate,
      subject: scrub(core.headerValue(headers, 'Subject')), from, to,
      direction: Array.isArray(message.labelIds) ? (message.labelIds.includes('SENT') ? 'sent' : 'received') : 'unknown',
      attachmentCount: parsed.attachments.length, rfcMessageId, unavailable: false,
      attachments: parsed.attachments.map((item) => ({ partId: item.partId, name: item.name, mimeType: item.mimeType,
        size: item.size, availability: 'unverified', checkedAt: null })),
      bodyAvailability, bodyCheckedAt: now().toISOString(),
      unverifiedAttachmentCount: parsed.attachments.length, unavailableAttachmentCount: 0,
      ...classification, version: 1, firstReview: null, indexedAt: now().toISOString(),
      ...(scope.generation ? { indexedGeneration: scope.generation } : {}) });
  }

  async function reconcilePending(payload, requestId, actor) {
    const fingerprint = digest({ operation: 'reconcilePending', payload, actor });
    const receipt = await store.getReceipt(requestId, fingerprint);
    if (receipt) return receipt;
    const catalog = await store.getCatalog();
    assertMail(catalog.complete, 'MAIL_CATALOG_INCOMPLETE', 409);
    const cursor = parseCursor(payload.pageToken, 'reconcile');
    assertMail(!cursor || cursor.direction === 'next');
    const records = await store.listMessages({ mode: 'pending', cursor, limit: WORK_SIZE + 1 });
    const batch = records.slice(0, WORK_SIZE);
    for (const record of batch) await indexMessage(record.messageId, catalog);
    const result = { processedCount: batch.length,
      page: { nextPageToken: records.length > WORK_SIZE ? cursorToken(batch.at(-1), 'next', 'reconcile') : '', previousPageToken: '', pageSize: WORK_SIZE },
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
        assertMail(!state || state.state !== 'running', 'MAIL_SYNC_BUSY', 409);
        assertMail(['full', 'history'].includes(payload.mode));
        if (payload.catalogSnapshotId !== undefined) assertMail(payload.catalogSnapshotId === catalog.snapshotId && payload.catalogDigest === catalog.digest, 'MAIL_CATALOG_CHANGED', 409);
        if (payload.mode === 'history') assertMail(state?.historyId, 'MAIL_FULL_SYNC_REQUIRED', 409);
        const profile = await gmail.getProfile();
        assertMail(profile.emailAddress?.toLowerCase() === 'customer@speed-ad.com', 'MAIL_MAILBOX_MISMATCH', 403);
        const at = now().toISOString();
        if (payload.startAt !== undefined) assertMail(typeof payload.startAt === 'string' && Number.isFinite(Date.parse(payload.startAt)));
        const suppliedStartAt = payload.startAt ? new Date(payload.startAt).toISOString() : null;
        const startAt = payload.mode === 'history' ? (state?.startAt || null) : suppliedStartAt;
        assertMail(!startAt || startAt <= at);
        state = { executionId: payload.executionId, mode: payload.mode, state: 'running', pageToken: null,
          startAt, cutoffAt: at, historyId: state?.historyId || null,
          initialHistoryId: String(profile.historyId || ''), failedCount: 0, processedCount: 0,
          catalogSnapshotId: catalog.snapshotId || null,
          lastSuccessAt: state?.lastSuccessAt || null, errorCode: null };
        assertMail(/^\d+$/.test(state.initialHistoryId), 'MAIL_INVALID_UPSTREAM', 502);
        await store.setSyncState(state, lease);
      }
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
        (!page.nextPageToken || typeof page.nextPageToken === 'string'), 'MAIL_INVALID_UPSTREAM', 502);
      if (page.nextPageToken) assertMail(page.nextPageToken !== state.pageToken, 'MAIL_INVALID_UPSTREAM', 502);
      if (state.mode === 'history') {
        assertMail(/^\d+$/.test(String(page.historyId || '')) && BigInt(page.historyId) >= BigInt(state.historyId) &&
          (!state.lastPageHistoryId || BigInt(page.historyId) >= BigInt(state.lastPageHistoryId)), 'MAIL_INVALID_UPSTREAM', 502);
        state.lastPageHistoryId = String(page.historyId);
      }
      if (!state.inFlightPage) {
        page = { ...page, messageIds: [...new Set(page.messageIds)].map(messageId), deletedIds: [...new Set(page.deletedIds || [])].map(messageId) };
        state.inFlightPage = { page, index: 0 };
        await store.setSyncState(state, lease);
      }
      const end = Math.min(state.inFlightPage.index + WORK_SIZE, page.messageIds.length);
      while (state.inFlightPage.index < end) {
        const id = page.messageIds[state.inFlightPage.index];
        try { await indexMessage(messageId(id), catalog, state.mode === 'full' ? {
          startAt: state.startAt, cutoffAt: state.cutoffAt, generation: state.executionId
        } : { startAt: state.startAt }); }
        catch (error) { state.failedMessageIds = [id]; throw error; }
        state.inFlightPage.index += 1;
        state.processedCount += 1;
      }
      if (state.inFlightPage.index < page.messageIds.length) {
        const result = { sync: await syncStatus(state) };
        await store.setSyncState(state, lease, { requestId, fingerprint, result });
        return result;
      }
      for (const id of new Set(page.deletedIds || [])) await store.markUnavailable(messageId(id), now().toISOString());
      const complete = !page.nextPageToken && state.mode === 'history';
      state = { ...state, pageToken: page.nextPageToken || null,
        inFlightPage: null,
        state: complete ? 'complete' : 'running', errorCode: null, failedCount: 0, failedMessageIds: [],
        ...(!page.nextPageToken && state.mode === 'full' ? { phase: 'finalize', finalizeCursor: null } : {}) };
      if (complete) {
        const historyId = state.mode === 'history' ? String(page.historyId || '') : state.initialHistoryId;
        assertMail(/^\d+$/.test(historyId), 'MAIL_INVALID_UPSTREAM', 502);
        state.historyId = historyId;
        state.lastSuccessAt = now().toISOString();
        if (state.mode === 'history') state.cutoffAt = state.lastSuccessAt;
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

  return async function execute(envelope) {
    assertMail(envelope && envelope.contractVersion === 1 && OPERATIONS.has(envelope.operation) &&
      ID.test(envelope.requestId || '') && typeof envelope.issuedAt === 'string' &&
      Math.abs(now().getTime() - Date.parse(envelope.issuedAt)) <= 120000 && envelope.payload &&
      typeof envelope.payload === 'object' && !Array.isArray(envelope.payload));
    const actor = validateActor(envelope.actor);
    const { operation, payload, requestId } = envelope;
    if (['uploadCaseCatalog', 'advanceSync', 'reconcilePending'].includes(operation)) assertMail(actor.authMode === 'domain', 'MAIL_FORBIDDEN', 403);
    let result;
    if (operation.startsWith('list')) result = await list(operation, payload);
    else if (operation === 'getMail') result = await getMail(payload);
    else if (operation === 'getAttachmentChunk') result = await attachment(payload);
    else if (operation === 'markReviewed' || operation === 'resolvePending') result = await write(operation, payload, actor, requestId);
    else if (operation === 'getSyncStatus') result = { sync: await syncStatus() };
    else if (operation === 'uploadCaseCatalog') result = await uploadCatalog(payload);
    else if (operation === 'advanceSync') result = await advanceSync(payload, requestId, actor);
    else if (operation === 'reconcilePending') result = await reconcilePending(payload, requestId, actor);
    return { ok: true, ...result };
  };
}
