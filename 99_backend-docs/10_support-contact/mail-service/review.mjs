import { normalizeCaseId } from './classification.mjs';
import { safeMailText } from './safeMail.mjs';

function actorEmail(actor) {
  const email = String(actor?.email || '').trim().toLowerCase();
  if (!actor?.verified || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('VERIFIED_ACTOR_REQUIRED');
  return email;
}

function timestamp(now) {
  if (now == null || now === '') throw new Error('INVALID_TIMESTAMP');
  const value = new Date(now);
  if (!Number.isFinite(value.getTime())) throw new Error('INVALID_TIMESTAMP');
  return value.toISOString();
}

function assertRecord(record) {
  if (!record?.messageId || !Number.isSafeInteger(record.version) || record.version < 0) throw new Error('INVALID_MAIL_RECORD');
}

/** Apply inside one Firestore transaction; the client never supplies actor identity or time. */
export function recordFirstReview(record, actor, now) {
  assertRecord(record);
  const email = actorEmail(actor);
  if (record.matchState !== 'matched' || !normalizeCaseId(record.caseId)) throw new Error('MATCHED_MAIL_REQUIRED');
  if (record.firstReview) return { record, event: null, created: false };
  const at = timestamp(now);
  const next = { ...record, version: record.version + 1, firstReview: { email, at } };
  return { record: next, created: true, event: { type: 'mail.reviewed', messageId: record.messageId, actor: email, at, version: next.version } };
}

/** Classification changes use optimistic concurrency and a required reason. Review evidence is retained. */
export function classifyManually(record, change, actor, now, knownCaseIds) {
  assertRecord(record);
  const email = actorEmail(actor);
  if (change?.expectedVersion !== record.version) throw new Error('MAIL_VERSION_CONFLICT');
  if (!['matched', 'pending', 'excluded'].includes(change.matchState)) throw new Error('INVALID_MATCH_STATE');
  const reason = safeMailText(change.reason || '').trim();
  if (!reason || reason.length > 1000) throw new Error('CLASSIFICATION_REASON_REQUIRED');
  const caseId = change.matchState === 'matched' ? normalizeCaseId(change.caseId) : null;
  const known = new Set([...knownCaseIds].map(normalizeCaseId).filter(Boolean));
  if (change.matchState === 'matched' && (!caseId || !known.has(caseId))) throw new Error('CASE_NOT_FOUND');
  const at = timestamp(now);
  const next = { ...record, matchState: change.matchState, caseId, reason: 'manual', manualClassification: true, version: record.version + 1,
    excludedAt: change.matchState === 'excluded' ? at : null };
  const event = { type: 'mail.classified', messageId: record.messageId, actor: email, at, version: next.version, reason, previous: { matchState: record.matchState, caseId: record.caseId || null }, next: { matchState: next.matchState, caseId } };
  return { record: next, event };
}
