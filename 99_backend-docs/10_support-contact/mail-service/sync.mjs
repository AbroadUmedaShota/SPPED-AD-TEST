const safeCodes = new Set(['AUTH_REQUIRED', 'GMAIL_UNAVAILABLE', 'RATE_LIMITED', 'CONTENT_UNAVAILABLE', 'SYNC_PAGE_INVALID']);

export function beginSync({ mode = 'full', cutoffAt, historyId = null, includeSpamTrash = false }) {
  if (!['full', 'history'].includes(mode)) throw new Error('INVALID_SYNC_MODE');
  if (typeof cutoffAt !== 'string' || !cutoffAt.trim()) throw new Error('INVALID_SYNC_CUTOFF');
  const cutoff = new Date(cutoffAt);
  if (!Number.isFinite(cutoff.getTime())) throw new Error('INVALID_SYNC_CUTOFF');
  if (historyId != null && !/^\d+$/.test(String(historyId))) throw new Error('INVALID_HISTORY_ID');
  if (mode === 'history' && !historyId) throw new Error('HISTORY_ID_REQUIRED');
  return { status: 'syncing', mode, cutoffAt: cutoff.toISOString(), includeSpamTrash: Boolean(includeSpamTrash), baseHistoryId: historyId == null ? null : String(historyId), nextPageToken: null, observedPageTokens: [], messageIds: [], deletedMessageIds: [], pageCount: 0, complete: false, committedHistoryId: null, errorCode: null };
}

function messageIds(items) {
  if (!Array.isArray(items)) throw new Error('SYNC_PAGE_INVALID');
  return items.map((item) => {
    if (!item || !/^[a-zA-Z0-9_-]{1,256}$/.test(String(item.id || ''))) throw new Error('SYNC_PAGE_INVALID');
    return String(item.id);
  });
}

export function applySyncPage(state, page, requestedPageToken = null) {
  if (state.status !== 'syncing' || state.complete || requestedPageToken !== state.nextPageToken) throw new Error('SYNC_PAGE_OUT_OF_ORDER');
  if (!page || typeof page !== 'object' || Array.isArray(page)) throw new Error('SYNC_PAGE_INVALID');
  const nextToken = page.nextPageToken == null ? null : String(page.nextPageToken);
  if (nextToken != null && (!nextToken || nextToken.length > 4096 || state.observedPageTokens.includes(nextToken) || nextToken === requestedPageToken)) throw new Error('SYNC_PAGE_CYCLE');
  let added;
  let deleted = [];
  if (state.mode === 'full') {
    // Gmail omits messages for a well-formed empty page; an adapter must confirm HTTP 200 first.
    if (page.messages != null && !Array.isArray(page.messages)) throw new Error('SYNC_PAGE_INVALID');
    added = messageIds(page.messages || []);
  } else {
    if (page.history != null && !Array.isArray(page.history)) throw new Error('SYNC_PAGE_INVALID');
    added = [];
    for (const entry of page.history || []) {
      if (!entry || !/^\d+$/.test(String(entry.id || ''))) throw new Error('SYNC_PAGE_INVALID');
      for (const key of ['messagesAdded', 'labelsAdded', 'labelsRemoved']) {
        if (entry[key] != null && !Array.isArray(entry[key])) throw new Error('SYNC_PAGE_INVALID');
        added.push(...messageIds((entry[key] || []).map((item) => item.message)));
      }
      if (entry.messagesDeleted != null && !Array.isArray(entry.messagesDeleted)) throw new Error('SYNC_PAGE_INVALID');
      deleted.push(...messageIds((entry.messagesDeleted || []).map((item) => item.message)));
    }
  }
  const observedHistoryId = page.historyId == null ? state.observedHistoryId || state.baseHistoryId : String(page.historyId);
  if (observedHistoryId != null && !/^\d+$/.test(observedHistoryId)) throw new Error('SYNC_PAGE_INVALID');
  if (state.mode === 'history' && (page.historyId == null || BigInt(observedHistoryId) < BigInt(state.observedHistoryId || state.baseHistoryId))) throw new Error('SYNC_PAGE_INVALID');
  const complete = nextToken === null;
  return { ...state, status: complete ? 'loaded' : 'syncing', nextPageToken: nextToken, observedPageTokens: [...state.observedPageTokens, ...(requestedPageToken == null ? [] : [requestedPageToken])], messageIds: [...new Set([...state.messageIds, ...added])].sort(), deletedMessageIds: [...new Set([...state.deletedMessageIds, ...deleted])].sort(), pageCount: state.pageCount + 1, observedHistoryId, committedHistoryId: complete ? (state.mode === 'full' ? state.baseHistoryId : observedHistoryId) : null, complete };
}

export function failSync(state, code) {
  if (code === 'HISTORY_EXPIRED') return { ...state, status: 'gap', complete: false, committedHistoryId: null, errorCode: code, requiresFullSync: true };
  return { ...state, status: 'failed', complete: false, committedHistoryId: null, errorCode: safeCodes.has(code) ? code : 'GMAIL_UNAVAILABLE' };
}

export function buildReconciliationReport(syncState, records, caseIds, noMailConfirmedCaseIds = []) {
  const counts = { matched: 0, pending: 0, excluded: 0, unavailable: 0, unreviewed: 0, unavailableAttachments: 0 };
  const covered = new Set();
  for (const record of records) {
    if (!['matched', 'pending', 'excluded'].includes(record.matchState)) throw new Error('INVALID_MAIL_RECORD');
    counts[record.matchState] += 1;
    if (record.matchState === 'matched') {
      covered.add(record.caseId);
      if (!record.firstReview) counts.unreviewed += 1;
    }
    if (record.unavailable) counts.unavailable += 1;
    const unavailableAttachmentCount = Number(record.unavailableAttachmentCount || 0);
    if (!Number.isSafeInteger(unavailableAttachmentCount) || unavailableAttachmentCount < 0) throw new Error('INVALID_MAIL_RECORD');
    counts.unavailableAttachments += unavailableAttachmentCount;
  }
  const confirmed = new Set(noMailConfirmedCaseIds);
  const casesWithNoMail = [...new Set(caseIds)].filter((id) => !covered.has(id)).sort();
  const unresolvedCaseIds = casesWithNoMail.filter((id) => !confirmed.has(id));
  const indexedIds = new Set(records.map((record) => record.messageId));
  const unindexedMessageIds = syncState.messageIds.filter((id) => !indexedIds.has(id));
  const complete = syncState.status === 'loaded' && syncState.complete && !counts.pending && !counts.unavailable && !counts.unavailableAttachments && !unresolvedCaseIds.length && !unindexedMessageIds.length;
  return { cutoffAt: syncState.cutoffAt, complete, counts, casesWithNoMail, unresolvedCaseIds, unindexedMessageIds };
}
