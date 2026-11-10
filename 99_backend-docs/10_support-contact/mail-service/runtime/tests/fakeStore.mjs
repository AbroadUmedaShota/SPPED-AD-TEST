import { assertMail } from '../errors.mjs';
import { indexedClassificationEvent, mergeIndexedMessage, mixedThreadDemotions } from '../mixedThread.mjs';
import { observeAttachment } from '../attachmentObservation.mjs';

const clone = (value) => structuredClone(value);
const order = (a, b) => b.internalDate.localeCompare(a.internalDate) || b.messageId.localeCompare(a.messageId);

export function fakeStore(caseIds = []) {
  const records = new Map();
  const receipts = new Map();
  const pages = new Map();
  const events = [];
  const deletionDiagnostics = new Map();
  let catalog = { complete: true, caseIds };
  let sync = null;
  let lease = null;
  let queue = Promise.resolve();
  const serial = (fn) => { const task = queue.then(fn); queue = task.catch(() => {}); return task; };
  const store = {
    records, receipts, events,
    seed(record) { records.set(record.messageId, clone(record)); },
    setCatalog(value) { catalog = value; },
    async getCatalog() { return clone(catalog); },
    async getCoveredCaseIds() { return [...new Set([...records.values()].filter((item) => item.matchState === 'matched').map((item) => item.caseId))]; },
    async uploadCatalogPage(page, digest) {
      const snapshot = pages.get(page.snapshotId) || { ...page, pages: new Map() };
      assertMail(snapshot.digest === page.digest && snapshot.total === page.total && snapshot.pageCount === page.pageCount, 'MAIL_REQUEST_CONFLICT', 409);
      const old = snapshot.pages.get(page.pageIndex);
      if (old) assertMail(JSON.stringify(old) === JSON.stringify(page.caseIds), 'MAIL_REQUEST_CONFLICT', 409);
      snapshot.pages.set(page.pageIndex, page.caseIds);
      pages.set(page.snapshotId, snapshot);
      if (snapshot.pages.size < page.pageCount) return { complete: false, snapshotId: page.snapshotId, receivedPages: snapshot.pages.size };
      const ids = [...snapshot.pages].sort(([a], [b]) => a - b).flatMap(([, value]) => value);
      assertMail(ids.length === page.total && new Set(ids).size === ids.length && digest(ids) === page.digest, 'MAIL_CATALOG_INVALID', 409);
      catalog = { complete: true, caseIds: ids };
      return { complete: true, snapshotId: page.snapshotId, total: ids.length };
    },
    async getMessage(id) { return clone(records.get(id) || null); },
    async recordUnobservedDeletion(id, at) { if (!records.has(id) && !deletionDiagnostics.has(id)) deletionDiagnostics.set(id, { messageId: id, detectedAt: at }); },
    async countUnobservedDeletions() { return deletionDiagnostics.size; },
    async listUnobservedDeletions({ cursor, limit }) {
      let items = [...deletionDiagnostics.values()].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt) || b.messageId.localeCompare(a.messageId));
      if (cursor) items = items.filter((item) => item.detectedAt < cursor.at || (item.detectedAt === cursor.at && item.messageId < cursor.id));
      return clone(items.slice(0, limit));
    },
    async excludeDraft(id, at) {
      const old = records.get(id);
      store.seed({ ...(old || { messageId: id, threadId: '', internalDate: at, direction: 'unknown',
        attachments: [], unverifiedAttachmentCount: 0, unavailableAttachmentCount: 0 }),
      sourceKind: 'draft', matchState: 'excluded', caseId: null, reason: 'unsent_draft', unavailable: false,
      version: (old?.version || 0) + (old?.sourceKind === 'draft' ? 0 : 1) });
      deletionDiagnostics.delete(id);
    },
    async listMessages({ mode, caseId, cursor, limit }) {
      let items = [...records.values()].filter((item) => mode === 'case' ? item.caseId === caseId && item.matchState === 'matched' :
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
    async countMessages() {
      const all = [...records.values()];
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
    async mutate(id, fingerprint, fn) {
      return serial(async () => {
        const old = await store.getReceipt(id, fingerprint);
        if (old) return old;
        const writes = [];
        const result = await fn({ getMessage: store.getMessage, getThreadMessages: store.findThreadMessages,
          setMessage(record) { writes.push(() => store.seed(record)); },
          addEvent(event) { writes.push(() => events.push(clone(event))); }
        });
        writes.forEach((fn) => fn());
        await store.saveReceipt(id, fingerprint, result);
        return clone(result);
      });
    },
    async upsertIndexedMessage(incoming) {
      deletionDiagnostics.delete(incoming.messageId);
      const before = records.get(incoming.messageId);
      const merged = mergeIndexedMessage(before, incoming);
      const threadRecords = [...records.values()].filter((record) => record.threadId === incoming.threadId && record.messageId !== incoming.messageId);
      const demotions = mixedThreadDemotions([...threadRecords, merged], incoming.indexedAt);
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
