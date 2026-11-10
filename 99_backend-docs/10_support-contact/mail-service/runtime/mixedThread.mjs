import { threadCaseIds } from '../classification.mjs';

export const isManual = (record) => record.manualClassification === true || record.reason === 'manual';

export function indexedClassificationEvent(before, after, at) {
  if (!before || (before.matchState === after.matchState && before.caseId === after.caseId)) return null;
  return { type: 'mail.auto_classified', messageId: after.messageId, at, version: after.version, reason: after.reason,
    previous: { matchState: before.matchState, caseId: before.caseId }, next: { matchState: after.matchState, caseId: after.caseId } };
}

// Keep explicit human decisions, but withdraw inherited links when later evidence makes a thread ambiguous.
export function mixedThreadDemotions(records, at) {
  if (threadCaseIds(records).length <= 1) return [];
  return records.filter((record) => record.matchState === 'matched' && !isManual(record)).map((record) => ({
    record: { ...record, matchState: 'pending', caseId: null, reason: 'mixed_thread', version: record.version + 1 },
    event: { type: 'mail.auto_match_withdrawn', messageId: record.messageId, at, version: record.version + 1,
      reason: 'mixed_thread', previous: { matchState: record.matchState, caseId: record.caseId },
      next: { matchState: 'pending', caseId: null } }
  }));
}

export function mergeIndexedMessage(existing, incoming) {
  if (!existing) return incoming;
  if (existing.sourceKind === 'draft') return { ...incoming, version: existing.version + 1, firstReview: null, manualClassification: false };
  const manual = isManual(existing);
  const changed = !manual && (existing.matchState !== incoming.matchState || existing.caseId !== incoming.caseId || existing.reason !== incoming.reason);
  const attachments = incoming.attachments.map((item) => {
    const old = (existing.attachments || []).find((entry) => entry.partId === item.partId && entry.name === item.name && entry.size === item.size);
    return old ? { ...item, availability: old.availability, checkedAt: old.checkedAt } : item;
  });
  return { ...existing, ...incoming, attachments,
    unverifiedAttachmentCount: attachments.filter((item) => item.availability === 'unverified').length,
    unavailableAttachmentCount: attachments.filter((item) => item.availability === 'unavailable').length,
    matchState: manual ? existing.matchState : incoming.matchState, caseId: manual ? existing.caseId : incoming.caseId,
    reason: manual ? existing.reason : incoming.reason, evidence: manual ? existing.evidence : incoming.evidence,
    version: existing.version + (changed ? 1 : 0), firstReview: existing.firstReview || null,
    manualClassification: manual };
}
