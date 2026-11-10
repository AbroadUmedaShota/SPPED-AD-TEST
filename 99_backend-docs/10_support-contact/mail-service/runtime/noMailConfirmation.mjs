import { createHash } from 'node:crypto';

const ID = /^[A-Za-z0-9_-]{1,200}$/;
const HASH = /^[a-f0-9]{64}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const iso = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const contextKeys = 'catalogDigest,catalogSnapshotId,cutoffAt,executionId,historyId,mappingRevision,purgeGeneration,startAt';

function validContext(value) {
  return value && Object.keys(value).sort().join(',') === contextKeys && ID.test(value.catalogSnapshotId || '') && HASH.test(value.catalogDigest || '') &&
    iso(value.startAt) && iso(value.cutoffAt) && value.startAt <= value.cutoffAt && ID.test(value.executionId || '') && /^\d+$/.test(value.historyId || '') &&
    (value.mappingRevision === null || UUID.test(value.mappingRevision || '')) && Number.isSafeInteger(value.purgeGeneration) && value.purgeGeneration >= 0;
}

export function mappingRevisionToken(value) {
  return value == null ? null : Object.keys(value).join(',') === 'token' && UUID.test(value.token || '') ? value.token : 'invalid';
}

export function noMailContext(catalog, sync, revision = null, purgeGeneration = 0) {
  if (!catalog?.complete || !ID.test(catalog.snapshotId || '') || !HASH.test(catalog.digest || '') ||
      sync?.state !== 'complete' || sync.catalogSnapshotId !== catalog.snapshotId ||
      (sync.catalogDigest !== undefined && sync.catalogDigest !== catalog.digest) || !iso(sync.startAt) || !iso(sync.cutoffAt) ||
      sync.startAt > sync.cutoffAt || !ID.test(sync.executionId || '') || !/^\d+$/.test(sync.historyId || '') ||
      !['full', 'history'].includes(sync.mode) || !iso(sync.lastSuccessAt) || sync.lastSuccessAt < sync.cutoffAt ||
      sync.failedCount !== 0 || sync.errorCode || sync.pageToken || sync.inFlightPage || sync.finalizeCursor ||
      (sync.failedMessageIds && (!Array.isArray(sync.failedMessageIds) || sync.failedMessageIds.length)) ||
      (revision !== null && !UUID.test(revision)) || !Number.isSafeInteger(purgeGeneration) || purgeGeneration < 0) return null;
  return { catalogSnapshotId: catalog.snapshotId, catalogDigest: catalog.digest, startAt: sync.startAt,
    cutoffAt: sync.cutoffAt, executionId: sync.executionId, historyId: sync.historyId, mappingRevision: revision, purgeGeneration };
}

export function noMailContextToken(context) {
  return validContext(context) ? createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.keys(context).sort().map((key) => [key, context[key]])))).digest('hex') : null;
}

export function wellFormedNoMailConfirmation(value) {
  return Boolean(value && Object.keys(value).sort().join(',') === 'at,caseId,context,email,requestId' &&
    UUID.test(value.caseId || '') && /^(?:[^\s@]+@abroad-o\.com|customer@speed-ad\.com)$/.test(value.email || '') &&
    iso(value.at) && UUID.test(value.requestId || '') && validContext(value.context) && value.at >= value.context.cutoffAt);
}

export function validNoMailConfirmation(value, context) {
  return wellFormedNoMailConfirmation(value) && validContext(context) && noMailContextToken(value.context) === noMailContextToken(context);
}

export function noMailConfirmationSummary(value) {
  return value ? { email: value.email, at: value.at, startAt: value.context.startAt, cutoffAt: value.context.cutoffAt } : null;
}
