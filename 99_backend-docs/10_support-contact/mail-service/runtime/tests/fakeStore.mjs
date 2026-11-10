import { assertMail } from '../errors.mjs';
import { indexedClassificationEvent, mergeIndexedMessage, mixedThreadDemotions } from '../mixedThread.mjs';
import { assertRetainedRecord, isRetainedRecord } from '../caseRetention.mjs';
import { observeAttachment } from '../attachmentObservation.mjs';
import { suppressionKey } from '../purgeGate.mjs';
import { randomUUID } from 'node:crypto';
import { noMailContext, noMailContextToken, validNoMailConfirmation } from '../noMailConfirmation.mjs';

const caseEntries = (ids) => ids.map((caseId) => ({ caseId, handledStatus: '未対応', closedAt: null }));
const clone = (value) => structuredClone(value);
const order = (a, b) => b.internalDate.localeCompare(a.internalDate) || b.messageId.localeCompare(a.messageId);

export function fakeStore(caseIds = [], initialSync = null) {
  const records = new Map();
  const receipts = new Map();
  const pages = new Map();
  const events = [];
  const deletionDiagnostics = new Map();
  const suppressedMessages = new Map();
  const noMail = new Map();
  let mappingRevision = null;
  let catalog = { complete: true, caseIds, cases: caseEntries(caseIds) };
  let sync = clone(initialSync);
  let lease = null;
  let queue = Promise.resolve();
  const serial = (fn) => { const task = queue.then(fn); queue = task.catch(() => {}); return task; };
  const store = {
    records, receipts, events, suppressedMessages,
    withAccess: (operation) => operation(),
    seed(record) {
      const before = records.get(record.messageId);
      if (before?.matchState !== record.matchState || before?.caseId !== record.caseId) {
        mappingRevision = randomUUID();
        if (before?.caseId) noMail.delete(before.caseId);
        if (record.caseId) noMail.delete(record.caseId);
      }
      records.set(record.messageId, clone(record));
    },
    async getMappingRevision() { return mappingRevision; },
    async getPurgeGeneration() { return 0; },
    async hasActiveSyncLease() { return Boolean(lease); },
    async getCaseNoMailConfirmation(id) { return clone(noMail.get(id) || null); },
    async getConfirmedNoMailCaseIds(context, at) { return [...noMail].filter(([, value]) => value.at <= at && validNoMailConfirmation(value, context)).map(([id]) => id); },
    async confirmCaseNoMail({ caseId, contextToken, email, at, requestId, fingerprint }) {
      return serial(async () => {
        const context = noMailContext(catalog, sync, mappingRevision);
        assertMail(context && noMailContextToken(context) === contextToken, 'MAIL_MAPPING_CHANGED', 409);
        assertMail(!lease, 'MAIL_SYNC_BUSY', 409);
        assertMail(!deletionDiagnostics.size && ![...records.values()].some((item) => item.internalDate >= context.startAt &&
          (item.matchState === 'pending' || item.matchState === 'matched' && item.caseId === caseId)), 'MAIL_MAPPING_CHANGED', 409);
        const receipt = await store.getReceipt(requestId, fingerprint);
        if (receipt) return receipt;
        const previous = noMail.get(caseId);
        const confirmation = validNoMailConfirmation(previous, context) ? previous : { caseId, email, at, requestId, context };
        noMail.set(caseId, clone(confirmation));
        if (confirmation !== previous) events.push({ type: 'case.no_mail_confirmed', caseId, actor: email, at, requestId, context });
        const result = { confirmation };
        await store.saveReceipt(requestId, fingerprint, result);
        return clone(result);
      });
    },
    setCatalog(value) { catalog = value; },
    async getCatalog() { return clone(catalog); },
    async getCoveredCaseIds({ startAt } = {}) { return [...new Set([...records.values()].filter((item) => item.matchState === 'matched' && (!startAt || item.internalDate >= startAt)).map((item) => item.caseId))]; },
    async uploadCatalogPage(page, digest) {
      const snapshot = pages.get(page.snapshotId) || { ...page, pages: new Map() };
      assertMail(snapshot.digest === page.digest && snapshot.total === page.total && snapshot.pageCount === page.pageCount, 'MAIL_REQUEST_CONFLICT', 409);
      const old = snapshot.pages.get(page.pageIndex);
      if (old) assertMail(JSON.stringify(old) === JSON.stringify(page.cases), 'MAIL_REQUEST_CONFLICT', 409);
      snapshot.pages.set(page.pageIndex, page.cases);
      pages.set(page.snapshotId, snapshot);
      if (snapshot.pages.size < page.pageCount) return { complete: false, snapshotId: page.snapshotId, receivedPages: snapshot.pages.size };
      const cases = [...snapshot.pages].sort(([a], [b]) => a - b).flatMap(([, value]) => value);
      const ids = cases.map((item) => item.caseId);
      assertMail(ids.length === page.total && new Set(ids).size === ids.length && digest(cases) === page.digest, 'MAIL_CATALOG_INVALID', 409);
      catalog = { complete: true, caseIds: ids, cases, digest: page.digest, snapshotId: page.snapshotId };
      return { complete: true, snapshotId: page.snapshotId, total: ids.length };
    },
    async isMessageSuppressed(id) { return suppressedMessages.has(suppressionKey('message', id)); },
    async getMessage(id) { return suppressedMessages.has(suppressionKey('message', id)) ? null : clone(records.get(id) || null); },
    async recordUnobservedDeletion(id, at) { if (!suppressedMessages.has(suppressionKey('message', id)) && !records.has(id) && !deletionDiagnostics.has(id)) deletionDiagnostics.set(id, { messageId: id, detectedAt: at }); },
    async countUnobservedDeletions() { return deletionDiagnostics.size; },
    async listUnobservedDeletions({ cursor, limit }) {
      let items = [...deletionDiagnostics.values()].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt) || b.messageId.localeCompare(a.messageId));
      if (cursor) items = items.filter((item) => item.detectedAt < cursor.at || (item.detectedAt === cursor.at && item.messageId < cursor.id));
      return clone(items.slice(0, limit));
    },
    async excludeDraft(id, at, { current = true } = {}) {
      const key = suppressionKey('message', id);
      if (suppressedMessages.has(key)) return;
      const old = records.get(id);
      if (old?.matchState === 'excluded' && (old.manualClassification === true || old.reason === 'manual')) return;
      const historicalMail = old && (old.sourceKind !== 'draft' || old.version > 1 || old.firstReview ||
        old.threadId || old.subject || old.from || old.to || old.rfcMessageId || old.attachmentCount || old.evidence);
      if (historicalMail && !current && old.sourceKind !== 'draft') return;
      if (!historicalMail) {
        suppressedMessages.set(key, { version: 1 });
        if (old) { mappingRevision = randomUUID(); if (old.caseId) noMail.delete(old.caseId); }
        records.delete(id);
        deletionDiagnostics.delete(id);
        return;
      }
      const changed = old.reason !== 'current_draft_conflict' || old.matchState !== 'pending' || old.caseId !== null;
      const next = { ...old, sourceKind: 'mail', matchState: 'pending', caseId: null,
        reason: 'current_draft_conflict', unavailable: true, bodyAvailability: 'unavailable',
        version: old.version + (changed ? 1 : 0) };
      store.seed(next);
      if (changed) events.push({ type: 'mail.auto_match_withdrawn', messageId: id, at, version: next.version,
        reason: next.reason, previous: { matchState: old.matchState, caseId: old.caseId }, next: { matchState: 'pending', caseId: null } });
      deletionDiagnostics.delete(id);
    },
    async listMessages({ mode, caseId, startAt, cursor, limit }) {
      let items = [...records.values()].filter((item) => !startAt || item.internalDate >= startAt).filter((item) => mode === 'case' ? item.caseId === caseId && item.matchState === 'matched' :
        mode === 'pending' ? item.matchState === 'pending' : item.matchState === 'matched' && !item.firstReview).sort(order);
      if (cursor) {
        const anchor = { internalDate: cursor.at, messageId: cursor.id };
        items = items.filter((item) => cursor.direction === 'previous' ? order(item, anchor) < 0 : order(item, anchor) > 0);
        if (cursor.direction === 'previous') items.reverse();
      }
      return clone(items.slice(0, limit));
    },
    async listIndexedScope({ startAt, cutoffAt, cursor, limit }) {
      let items = [...records.values()].filter((item) => (!startAt || item.internalDate >= startAt) && item.internalDate <= cutoffAt).sort(order);
      if (cursor) items = items.filter((item) => order(item, { internalDate: cursor.at, messageId: cursor.id }) > 0);
      return clone(items.slice(0, limit));
    },
    async countMessages({ startAt } = {}) {
      const all = [...records.values()].filter((item) => !startAt || item.internalDate >= startAt);
      const active = all.filter((item) => item.matchState !== 'excluded');
      return {
        pending: active.filter((item) => item.matchState === 'pending').length,
        unreviewed: active.filter((item) => item.matchState === 'matched' && !item.firstReview).length,
        unavailable: active.filter((item) => item.unavailable).length,
        bodyUnverified: active.filter((item) => item.bodyAvailability === 'unverified').length,
        bodyUnavailable: active.filter((item) => item.bodyAvailability === 'unavailable').length,
        attachmentUnverified: active.reduce((sum, item) => sum + (item.unverifiedAttachmentCount || 0), 0),
        attachmentUnavailable: active.reduce((sum, item) => sum + (item.unavailableAttachmentCount || 0), 0)
      };
    },
    async findThreadMessages(threadId) { return clone([...records.values()].filter((record) => record.threadId === threadId)); },
    async findReferences(ids) { return clone([...records.values()].filter((record) => ids.includes(record.rfcMessageId))); },
    async getReceipt(id, fingerprint) {
      const receipt = receipts.get(id);
      if (!receipt) return null;
      assertMail(receipt.fingerprint === fingerprint, 'MAIL_REQUEST_CONFLICT', 409);
      return clone(receipt.result);
    },
    async saveReceipt(id, fingerprint, result) {
      const old = receipts.get(id);
      if (old) assertMail(old.fingerprint === fingerprint, 'MAIL_REQUEST_CONFLICT', 409);
      else receipts.set(id, { fingerprint, result: clone(result) });
    },
    async mutate(id, fingerprint, fn, expectedStartAt, expectedCatalogDigest) {
      return serial(async () => {
        if (expectedCatalogDigest) assertMail(catalog.digest === expectedCatalogDigest, 'MAIL_CATALOG_CHANGED', 409);
        if (expectedStartAt) assertMail(sync?.startAt === expectedStartAt, 'MAIL_MAPPING_CHANGED', 409);
        const old = await store.getReceipt(id, fingerprint);
        if (old) return old;
        const writes = [];
        const result = await fn({ getSyncState: store.getSyncState, getMessage: store.getMessage, getThreadMessages: store.findThreadMessages,
          setMessage(record) { writes.push(() => store.seed(record)); },
          addEvent(event) { writes.push(() => events.push(clone(event))); }
        });
        if (expectedCatalogDigest) assertMail(catalog.digest === expectedCatalogDigest, 'MAIL_CATALOG_CHANGED', 409);
        writes.forEach((fn) => fn());
        await store.saveReceipt(id, fingerprint, result);
        return clone(result);
      });
    },
    async upsertIndexedMessage(incoming, expectedCatalogDigest, policy) {
      if (suppressedMessages.has(suppressionKey('message', incoming.messageId))) return;
      if (expectedCatalogDigest) assertMail(catalog.digest === expectedCatalogDigest, 'MAIL_CATALOG_CHANGED', 409);
      const before = records.get(incoming.messageId);
      if (before?.reason === 'current_draft_conflict') return;
      if (policy && before) assertRetainedRecord(before, policy);
      const merged = mergeIndexedMessage(before, incoming);
      const threadRecords = [...records.values()].filter((record) => record.threadId === incoming.threadId && record.messageId !== incoming.messageId);
      const demotions = mixedThreadDemotions([...threadRecords.filter((item) => !policy || isRetainedRecord(item, policy)), merged], incoming.indexedAt);
      if (policy) assertRetainedRecord(merged, policy);
      deletionDiagnostics.delete(incoming.messageId);
      store.seed(merged);
      const event = indexedClassificationEvent(before, merged, incoming.indexedAt);
      if (event) events.push(clone(event));
      for (const demotion of demotions) { store.seed(demotion.record); events.push(clone(demotion.event)); }
    },
    async markUnavailable(id, at) {
      const old = records.get(id);
      if (!old || old.sourceKind === 'draft') return;
      store.seed({ ...old, unavailable: true, bodyAvailability: old.bodyAvailability || 'unavailable' });
    },
    async recordBodyObservation(id, availability, at) {
      const record = records.get(id);
      assertMail(record, 'MAIL_NOT_FOUND', 404);
      store.seed({ ...record, bodyAvailability: availability, bodyCheckedAt: at });
    },
    async recordAttachmentObservation(id, partId, availability, at, transfer) {
      const record = records.get(id);
      assertMail(record?.attachments?.some((item) => item.partId === partId), 'MAIL_ATTACHMENT_NOT_FOUND', 404);
      const attachments = record.attachments.map((item) => item.partId === partId ? observeAttachment(item, availability, at, transfer) : item);
      store.seed({ ...record, attachments,
        unverifiedAttachmentCount: attachments.filter((item) => item.availability === 'unverified').length,
        unavailableAttachmentCount: attachments.filter((item) => item.availability === 'unavailable').length });
      return clone(attachments.find((item) => item.partId === partId));
    },
    async getSyncState() { return clone(sync); },
    async acquireSyncLease(id) { if (lease) return null; lease = id; return lease; },
    async releaseSyncLease(id) { if (lease === id) lease = null; },
    async setSyncState(state, id, receipt) {
      assertMail(lease === id, 'MAIL_SYNC_BUSY', 409);
      if (receipt) await store.saveReceipt(receipt.requestId, receipt.fingerprint, receipt.result);
      sync = clone(state);
    }
  };
  return store;
}
