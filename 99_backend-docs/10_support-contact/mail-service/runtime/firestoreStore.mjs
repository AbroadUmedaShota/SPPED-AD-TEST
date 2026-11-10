import { randomUUID } from 'node:crypto';
import { AggregateField, FieldValue } from '@google-cloud/firestore';
import { assertMail } from './errors.mjs';
import { canonicalJson, catalogDigest } from './service.mjs';
import { indexedClassificationEvent, mergeIndexedMessage, mixedThreadDemotions } from './mixedThread.mjs';
import { observeAttachment } from './attachmentObservation.mjs';
import { normalizeCatalogCases, assertRetainedRecord, isRetainedRecord, retentionExpiresAt } from './caseRetention.mjs';
import { createPurgeGate, suppressionKey } from './purgeGate.mjs';
import { noMailContext, noMailContextToken, validNoMailConfirmation, mappingRevisionToken } from './noMailConfirmation.mjs';

const expiredLease = (lease, at) => typeof lease?.expiresAt === 'string' && Number.isFinite(Date.parse(lease.expiresAt)) &&
  new Date(lease.expiresAt).toISOString() === lease.expiresAt && lease.expiresAt <= at;

export function createFirestoreStore(db) {
  const mailbox = db.collection('contactMailboxes').doc('customer-speed-ad');
  const messages = mailbox.collection('messages');
  const coverage = mailbox.collection('caseCoverage');
  const meta = mailbox.collection('meta');
  const snapshots = mailbox.collection('catalogSnapshots');
  const syncRef = meta.doc('sync');
  const leaseRef = meta.doc('syncLease');
  const activeRef = meta.doc('activeCatalog');
  const mappingRef = meta.doc('mappingRevision');
  const deletionDiagnostics = mailbox.collection('deletionDiagnostics');
  const data = (snapshot) => snapshot.exists ? snapshot.data() : null;
  const controlRef = meta.doc('purgeControl');
  const suppressedMessages = mailbox.collection('suppressedMessages');
  const suppressedCases = mailbox.collection('suppressedCases');
  const suppressedRequests = mailbox.collection('suppressedRequests');
  const gate = createPurgeGate(async () => data(await controlRef.get()));
  async function runTransaction(operation) {
    return db.runTransaction(async (transaction) => {
      const control = data(await transaction.get(controlRef));
      gate.check(control);
      return operation(transaction, control);
    });
  }
  async function requestAllowed(transaction, id) {
    assertMail(!(await transaction.get(suppressedRequests.doc(suppressionKey('request', id)))).exists, 'MAIL_REQUEST_CONFLICT', 409);
  }
  function updateCoverage(transaction, before, after) {
    const previous = before?.matchState === 'matched' ? before.caseId : null;
    const next = after?.matchState === 'matched' ? after.caseId : null;
    if (before?.matchState !== after?.matchState || previous !== next) transaction.set(mappingRef, { token: randomUUID() });
    if (previous === next) return;
    if (previous) transaction.set(coverage.doc(previous), { count: FieldValue.increment(-1), noMailConfirmed: false, noMailConfirmation: null }, { merge: true });
    if (next) transaction.set(coverage.doc(next), { count: FieldValue.increment(1), noMailConfirmed: false, noMailConfirmation: null }, { merge: true });
  }

  async function getCatalog(snapshotId) {
    const active = snapshotId ? { ...data(await snapshots.doc(snapshotId).get()), snapshotId } : data(await activeRef.get());
    if (!active) return { complete: false, caseIds: [], cases: [] };
    if (snapshotId && !active.complete) return { complete: false, caseIds: [], cases: [] };
    const pages = await snapshots.doc(active.snapshotId).collection('pages').orderBy('pageIndex').get();
    const cases = normalizeCatalogCases(pages.docs.flatMap((page) => { assertMail(Array.isArray(page.data().cases), 'MAIL_CATALOG_INVALID', 409); return page.data().cases; }));
    assertMail(cases.length === active.total && catalogDigest(cases) === active.digest, 'MAIL_CATALOG_INVALID', 409);
    const blocked = new Set((await suppressedCases.get()).docs.map((item) => item.id));
    const suppressedCaseIds = cases.map((item) => item.caseId).filter((id) => blocked.has(suppressionKey('case', id)));
    return { complete: true, snapshotId: active.snapshotId, digest: active.digest, cases,
      caseIds: cases.map((item) => item.caseId).filter((id) => !suppressedCaseIds.includes(id)), suppressedCaseIds };
  }

  return {
    getCatalog,
    withAccess: gate.withAccess,
    async getMappingRevision() { return mappingRevisionToken(data(await mappingRef.get())); },
    async getPurgeGeneration() { return data(await controlRef.get())?.generation ?? 0; },
    async hasActiveSyncLease(at) { const lease = data(await leaseRef.get()); return Boolean(lease && !expiredLease(lease, at)); },
    async getCaseNoMailConfirmation(id) { return data(await coverage.doc(id).get())?.noMailConfirmation || null; },
    async getConfirmedNoMailCaseIds(context, at) {
      const found = await coverage.where('noMailConfirmed', '==', true).get();
      return found.docs.filter((item) => item.data().noMailConfirmation?.caseId === item.id && item.data().noMailConfirmation.at <= at && validNoMailConfirmation(item.data().noMailConfirmation, context)).map((item) => item.id);
    },
    async confirmCaseNoMail({ caseId, caseEntry, contextToken, email, at, requestId, fingerprint }) {
      const entry = normalizeCatalogCases([caseEntry])[0];
      assertMail(entry.caseId === caseId, 'MAIL_CASE_NOT_FOUND', 404);
      return runTransaction(async (transaction, control) => {
        await requestAllowed(transaction, requestId);
        const [stateDoc, catalogDoc, revisionDoc, leaseDoc, coverageDoc, receiptDoc, suppressed] = await Promise.all([
          transaction.get(syncRef), transaction.get(activeRef), transaction.get(mappingRef), transaction.get(leaseRef),
          transaction.get(coverage.doc(caseId)), transaction.get(mailbox.collection('receipts').doc(requestId)),
          transaction.get(suppressedCases.doc(suppressionKey('case', caseId)))
        ]);
        const state = data(stateDoc); const catalog = data(catalogDoc);
        const context = noMailContext({ ...catalog, complete: true }, state, mappingRevisionToken(data(revisionDoc)), control?.generation ?? 0);
        assertMail(context && noMailContextToken(context) === contextToken, 'MAIL_MAPPING_CHANGED', 409);
        assertMail(!entry.closedAt || retentionExpiresAt(entry.closedAt) > at, 'MAIL_RETENTION_EXPIRED', 410);
        assertMail(!suppressed.exists, 'MAIL_RECORDS_DELETED', 410);
        const lease = data(leaseDoc);
        assertMail(!lease || expiredLease(lease, at), 'MAIL_SYNC_BUSY', 409);
        const [matched, pending, deleted] = await Promise.all([
          transaction.get(messages.where('caseId', '==', caseId).where('matchState', '==', 'matched').where('internalDate', '>=', context.startAt).limit(1)),
          transaction.get(messages.where('matchState', '==', 'pending').where('internalDate', '>=', context.startAt).limit(1)),
          transaction.get(deletionDiagnostics.limit(1))
        ]);
        assertMail(!matched.docs.length && !pending.docs.length && !deleted.docs.length, 'MAIL_MAPPING_CHANGED', 409);
        const receipt = data(receiptDoc);
        if (receipt) { assertMail(receipt.fingerprint === fingerprint, 'MAIL_REQUEST_CONFLICT', 409); return receipt.result; }
        const existing = data(coverageDoc)?.noMailConfirmation;
        const confirmation = validNoMailConfirmation(existing, context) && existing.at <= at ? existing : { caseId, email, at, requestId, context };
        assertMail(validNoMailConfirmation(confirmation, context), 'MAIL_INVALID_REQUEST');
        transaction.set(coverage.doc(caseId), { noMailConfirmed: true, noMailConfirmation: confirmation }, { merge: true });
        if (confirmation !== existing) transaction.set(mailbox.collection('events').doc(), {
          type: 'case.no_mail_confirmed', caseId, actor: email, at, requestId, context
        });
        const result = { confirmation };
        transaction.set(mailbox.collection('receipts').doc(requestId), { fingerprint, result, committedAt: at });
        return result;
      });
    },
    async isMessageSuppressed(id) { return (await suppressedMessages.doc(suppressionKey('message', id)).get()).exists; },
    async getCoveredCaseIds({ startAt } = {}) {
      if (!startAt) return (await coverage.where('count', '>', 0).get()).docs.map((item) => item.id);
      const found = await messages.where('matchState', '==', 'matched').where('internalDate', '>=', startAt).select('caseId').get();
      return [...new Set(found.docs.map((item) => item.data().caseId))];
    },
    async uploadCatalogPage(page, makeDigest) {
      const ref = snapshots.doc(page.snapshotId);
      const pageRef = ref.collection('pages').doc(String(page.pageIndex).padStart(4, '0'));
      await runTransaction(async (transaction) => {
        const existing = data(await transaction.get(ref));
        const existingPage = data(await transaction.get(pageRef));
        if (existing) assertMail(existing.pageCount === page.pageCount && existing.total === page.total && existing.digest === page.digest, 'MAIL_REQUEST_CONFLICT', 409);
        if (existingPage) assertMail(canonicalJson(existingPage.cases) === canonicalJson(page.cases), 'MAIL_REQUEST_CONFLICT', 409);
        if (!existing) transaction.set(ref, { pageCount: page.pageCount, total: page.total, digest: page.digest, createdAt: new Date().toISOString() });
        if (!existingPage) transaction.set(pageRef, { pageIndex: page.pageIndex, cases: page.cases });
      });
      const pages = await ref.collection('pages').orderBy('pageIndex').get();
      if (pages.size !== page.pageCount) return { complete: false, snapshotId: page.snapshotId, receivedPages: pages.size };
      const cases = normalizeCatalogCases(pages.docs.flatMap((item) => item.data().cases));
      assertMail(cases.length === page.total && makeDigest(cases) === page.digest, 'MAIL_CATALOG_INVALID', 409);
      await runTransaction(async (transaction) => {
        const snapshot = data(await transaction.get(ref));
        const active = data(await transaction.get(activeRef));
        if (!active || active.createdAt <= snapshot.createdAt) transaction.set(activeRef, { snapshotId: page.snapshotId, createdAt: snapshot.createdAt, total: cases.length, digest: page.digest });
        transaction.update(ref, { complete: true });
      });
      return { complete: true, snapshotId: page.snapshotId, total: cases.length };
    },
    async getMessage(id) {
      if ((await suppressedMessages.doc(suppressionKey('message', id)).get()).exists) return null;
      return data(await messages.doc(id).get());
    },
    async recordUnobservedDeletion(id, at) {
      const ref = deletionDiagnostics.doc(id);
      await runTransaction(async (transaction) => {
        const [message, diagnostic, blocked] = await Promise.all([transaction.get(messages.doc(id)), transaction.get(ref), transaction.get(suppressedMessages.doc(suppressionKey('message', id)))]);
        if (!blocked.exists && !message.exists && !diagnostic.exists) transaction.set(ref, { messageId: id, detectedAt: at });
      });
    },
    async countUnobservedDeletions() { return (await deletionDiagnostics.count().get()).data().count; },
    async listUnobservedDeletions({ cursor, limit }) {
      let query = deletionDiagnostics.orderBy('detectedAt', 'desc').orderBy('messageId', 'desc');
      if (cursor) query = query.startAfter(cursor.at, cursor.id);
      return (await query.limit(limit).get()).docs.map((item) => item.data());
    },
    async excludeDraft(id, at, { current = true } = {}) {
      const ref = messages.doc(id);
      await runTransaction(async (transaction) => {
        const marker = suppressedMessages.doc(suppressionKey('message', id));
        if ((await transaction.get(marker)).exists) return;
        const existing = data(await transaction.get(ref));
        if (existing?.matchState === 'excluded' && (existing.manualClassification === true || existing.reason === 'manual')) return;
        const historicalMail = existing && (existing.sourceKind !== 'draft' || existing.version > 1 ||
          existing.firstReview || existing.threadId || existing.subject || existing.from || existing.to ||
          existing.rfcMessageId || existing.attachmentCount || existing.evidence);
        if (historicalMail && !current && existing.sourceKind !== 'draft') return;
        if (!historicalMail) {
          transaction.set(marker, { version: 1 });
          transaction.delete(ref);
          if (existing) updateCoverage(transaction, existing, null);
          transaction.delete(deletionDiagnostics.doc(id));
          return;
        }
        // A previously observed mail must retain its review and audit evidence.
        const changed = existing.reason !== 'current_draft_conflict' || existing.matchState !== 'pending' || existing.caseId !== null;
        const record = { ...existing, sourceKind: 'mail', matchState: 'pending', caseId: null,
          reason: 'current_draft_conflict', unavailable: true, bodyAvailability: 'unavailable',
          version: existing.version + (changed ? 1 : 0) };
        transaction.set(ref, record);
        transaction.delete(deletionDiagnostics.doc(id));
        updateCoverage(transaction, existing, record);
        if (changed) transaction.set(mailbox.collection('events').doc(), {
          type: 'mail.auto_match_withdrawn', messageId: id, at, version: record.version,
          reason: record.reason, previous: { matchState: existing.matchState, caseId: existing.caseId },
          next: { matchState: 'pending', caseId: null }
        });
      });
    },
    async listMessages({ mode, caseId, startAt, cursor, limit }) {
      let query = messages;
      if (startAt) query = query.where('internalDate', '>=', startAt);
      if (mode === 'case') query = query.where('caseId', '==', caseId).where('matchState', '==', 'matched');
      if (mode === 'pending') query = query.where('matchState', '==', 'pending');
      if (mode === 'unreviewed') query = query.where('matchState', '==', 'matched').where('firstReview', '==', null);
      const direction = cursor?.direction === 'previous' ? 'asc' : 'desc';
      query = query.orderBy('internalDate', direction).orderBy('messageId', direction);
      if (cursor) query = query.startAfter(cursor.at, cursor.id);
      return (await query.limit(limit).get()).docs.map((item) => item.data());
    },
    async countMessages({ startAt } = {}) {
      const scoped = startAt ? messages.where('internalDate', '>=', startAt) : messages;
      const active = scoped.where('matchState', 'in', ['matched', 'pending']);
      const [pending, unavailable, unreviewed, bodyUnverified, bodyUnavailable, attachments] = await Promise.all([
        scoped.where('matchState', '==', 'pending').count().get(),
        active.where('unavailable', '==', true).count().get(),
        scoped.where('matchState', '==', 'matched').where('firstReview', '==', null).count().get(),
        active.where('bodyAvailability', '==', 'unverified').count().get(),
        active.where('bodyAvailability', '==', 'unavailable').count().get(),
        active.aggregate({ unverified: AggregateField.sum('unverifiedAttachmentCount'), unavailable: AggregateField.sum('unavailableAttachmentCount') }).get()
      ]);
      return { pending: pending.data().count, unavailable: unavailable.data().count, unreviewed: unreviewed.data().count,
        bodyUnverified: bodyUnverified.data().count, bodyUnavailable: bodyUnavailable.data().count,
        attachmentUnverified: attachments.data().unverified || 0, attachmentUnavailable: attachments.data().unavailable || 0 };
    },
    async findThreadMessages(threadId) {
      return (await messages.where('threadId', '==', threadId).get()).docs.map((item) => item.data());
    },
    async findReferences(ids) {
      const results = new Map();
      for (let start = 0; start < ids.length; start += 30) {
        const batch = ids.slice(start, start + 30);
        if (!batch.length) continue;
        const found = await messages.where('rfcMessageId', 'in', batch).get();
        for (const item of found.docs) results.set(item.id, item.data());
      }
      return [...results.values()];
    },
    async mutate(requestId, fingerprint, operation, expectedStartAt, expectedCatalogDigest) {
      const receiptRef = mailbox.collection('receipts').doc(requestId);
      return runTransaction(async (transaction) => {
        await requestAllowed(transaction, requestId);
        const state = data(await transaction.get(syncRef));
        const catalog = data(await transaction.get(activeRef));
        if (expectedCatalogDigest) assertMail(catalog?.digest === expectedCatalogDigest, 'MAIL_CATALOG_CHANGED', 409);
        if (expectedStartAt) assertMail(state?.startAt === expectedStartAt, 'MAIL_MAPPING_CHANGED', 409);
        const receipt = data(await transaction.get(receiptRef));
        if (receipt) {
          assertMail(receipt.fingerprint === fingerprint, 'MAIL_REQUEST_CONFLICT', 409);
          return receipt.result;
        }
        const pendingWrites = [];
        const originals = new Map();
        const result = await operation({
          async getSyncState() { return state; },
          async getMessage(id) { const record = data(await transaction.get(messages.doc(id))); originals.set(id, record); return record; },
          async getThreadMessages(threadId) {
            const found = (await transaction.get(messages.where('threadId', '==', threadId))).docs.map((item) => item.data());
            found.forEach((record) => originals.set(record.messageId, record));
            return found;
          },
          setMessage(record) { pendingWrites.push(() => { transaction.set(messages.doc(record.messageId), record); updateCoverage(transaction, originals.get(record.messageId), record); }); },
          addEvent(event) { pendingWrites.push(() => transaction.set(mailbox.collection('events').doc(), event)); }
        });
        pendingWrites.forEach((write) => write());
        transaction.set(receiptRef, { fingerprint, result, committedAt: new Date().toISOString() });
        return result;
      });
    },
    async getReceipt(requestId, fingerprint) {
      assertMail(!(await suppressedRequests.doc(suppressionKey('request', requestId)).get()).exists, 'MAIL_REQUEST_CONFLICT', 409);
      const receipt = data(await mailbox.collection('receipts').doc(requestId).get());
      if (!receipt) return null;
      assertMail(receipt.fingerprint === fingerprint, 'MAIL_REQUEST_CONFLICT', 409);
      return receipt.result;
    },
    async saveReceipt(requestId, fingerprint, result) {
      const ref = mailbox.collection('receipts').doc(requestId);
      await runTransaction(async (transaction) => {
        await requestAllowed(transaction, requestId);
        const existing = data(await transaction.get(ref));
        if (existing) assertMail(existing.fingerprint === fingerprint, 'MAIL_REQUEST_CONFLICT', 409);
        else transaction.set(ref, { fingerprint, result, committedAt: new Date().toISOString() });
      });
    },
    async listIndexedScope({ startAt, cutoffAt, cursor, limit }) {
      let query = messages.where('internalDate', '<=', cutoffAt);
      if (startAt) query = query.where('internalDate', '>=', startAt);
      query = query.orderBy('internalDate', 'desc').orderBy('messageId', 'desc');
      if (cursor) query = query.startAfter(cursor.at, cursor.id);
      return (await query.limit(limit).get()).docs.map((item) => item.data());
    },
    async upsertIndexedMessage(incoming, expectedCatalogDigest, retentionPolicy) {
      const ref = messages.doc(incoming.messageId);
      await runTransaction(async (transaction) => {
        const catalog = data(await transaction.get(activeRef));
        if (expectedCatalogDigest) assertMail(catalog?.digest === expectedCatalogDigest, 'MAIL_CATALOG_CHANGED', 409);
        if ((await transaction.get(suppressedMessages.doc(suppressionKey('message', incoming.messageId)))).exists) return;
        if (incoming.caseId && (await transaction.get(suppressedCases.doc(suppressionKey('case', incoming.caseId)))).exists) {
          incoming = { ...incoming, matchState: 'pending', caseId: null, reason: 'suppressed_case' };
        }
        const existing = data(await transaction.get(ref));
        if (existing?.reason === 'current_draft_conflict') return;
        const threadRecords = incoming.threadId ? (await transaction.get(messages.where('threadId', '==', incoming.threadId))).docs.map((item) => item.data()) : [];
        if (retentionPolicy && existing) assertRetainedRecord(existing, retentionPolicy);
        const merged = mergeIndexedMessage(existing, incoming);
        const demotions = mixedThreadDemotions([...threadRecords.filter((item) => item.messageId !== incoming.messageId && (!retentionPolicy || isRetainedRecord(item, retentionPolicy))), merged], incoming.indexedAt);
        const final = demotions.find((item) => item.record.messageId === incoming.messageId)?.record || merged;
        if (retentionPolicy) assertRetainedRecord(final, retentionPolicy);
        transaction.set(ref, final);
        transaction.delete(deletionDiagnostics.doc(incoming.messageId));
        updateCoverage(transaction, existing, final);
        const event = indexedClassificationEvent(existing, merged, incoming.indexedAt);
        if (event) transaction.set(mailbox.collection('events').doc(), event);
        for (const demotion of demotions) {
          if (demotion.record.messageId !== incoming.messageId) {
            const before = threadRecords.find((item) => item.messageId === demotion.record.messageId);
            transaction.set(messages.doc(demotion.record.messageId), demotion.record);
            updateCoverage(transaction, before, demotion.record);
          }
          transaction.set(mailbox.collection('events').doc(), demotion.event);
        }
      });
    },
    async markUnavailable(id, at) {
      const ref = messages.doc(id);
      await runTransaction(async (transaction) => {
        const existing = data(await transaction.get(ref));
        if (existing && existing.sourceKind !== 'draft') transaction.update(ref, { unavailable: true });
      });
    },
    async recordBodyObservation(id, availability, at) {
      await runTransaction(async (transaction) => {
        const ref = messages.doc(id);
        const [record, blocked] = await Promise.all([transaction.get(ref), transaction.get(suppressedMessages.doc(suppressionKey('message', id)))]);
        assertMail(record.exists && !blocked.exists, 'MAIL_NOT_FOUND', 404);
        transaction.update(ref, { bodyAvailability: availability, bodyCheckedAt: at });
      });
    },
    async recordAttachmentObservation(id, partId, availability, at, transfer) {
      const ref = messages.doc(id);
      return runTransaction(async (transaction) => {
        const record = data(await transaction.get(ref));
        assertMail(record && record.attachments?.some((item) => item.partId === partId), 'MAIL_ATTACHMENT_NOT_FOUND', 404);
        const attachments = record.attachments.map((item) => item.partId === partId ? observeAttachment(item, availability, at, transfer) : item);
        transaction.update(ref, { attachments,
          unverifiedAttachmentCount: attachments.filter((item) => item.availability === 'unverified').length,
          unavailableAttachmentCount: attachments.filter((item) => item.availability === 'unavailable').length });
        return attachments.find((item) => item.partId === partId);
      });
    },
    async getSyncState() { return data(await syncRef.get()); },
    async acquireSyncLease(requestId, at) {
      return runTransaction(async (transaction) => {
        const existing = data(await transaction.get(leaseRef));
        if (existing && Date.parse(existing.expiresAt) > Date.parse(at)) return null;
        const lease = { token: randomUUID(), requestId, expiresAt: new Date(Date.parse(at) + 600000).toISOString() };
        transaction.set(leaseRef, lease);
        return lease.token;
      });
    },
    async setSyncState(state, lease, receipt) {
      await runTransaction(async (transaction) => {
        if (receipt) await requestAllowed(transaction, receipt.requestId);
        const existing = data(await transaction.get(leaseRef));
        const previousReceipt = receipt ? data(await transaction.get(mailbox.collection('receipts').doc(receipt.requestId))) : null;
        assertMail(existing?.token === lease, 'MAIL_SYNC_BUSY', 409);
        if (previousReceipt) assertMail(previousReceipt.fingerprint === receipt.fingerprint, 'MAIL_REQUEST_CONFLICT', 409);
        transaction.set(syncRef, state);
        if (receipt) transaction.set(mailbox.collection('receipts').doc(receipt.requestId), {
          fingerprint: receipt.fingerprint, result: receipt.result, committedAt: new Date().toISOString()
        });
      });
    },
    async releaseSyncLease(lease) {
      await runTransaction(async (transaction) => {
        const existing = data(await transaction.get(leaseRef));
        if (existing?.token === lease) transaction.delete(leaseRef);
      });
    }
  };
}
