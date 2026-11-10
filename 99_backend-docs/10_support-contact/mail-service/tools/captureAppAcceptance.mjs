import { createHash, createHmac } from 'node:crypto';
import { isAbsolute, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { prepareCaptureFiles } from './privateCaptureFiles.mjs';
import { noMailContext, validNoMailConfirmation, wellFormedNoMailConfirmation } from '../runtime/noMailConfirmation.mjs';

const ROOT = 'contactMailboxes/customer-speed-ad';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const HASH = /^[a-f0-9]{64}$/;
const STATUSES = ['未対応', '対応中', '保留', '対応済み'];
const MAX_ROWS = 100000;
const date = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const marker = (kind, value) => hash(`customer-speed-ad\0${kind}\0${value}`);
const data = (snapshot) => snapshot.exists ? snapshot.data() : null;
const invalid = () => { throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID'); };
const expiresAt = (at) => {
  const value = new Date(at); const month = value.getUTCMonth();
  value.setUTCFullYear(value.getUTCFullYear() + 3);
  if (value.getUTCMonth() !== month) value.setUTCDate(0);
  return value.toISOString();
};

// Reads one Firestore snapshot. No runtime RPC, classification, or mutation is invoked.
export async function captureAppAcceptance({ db, runId, key, startAt, cutoffAt, now = () => new Date() }) {
  if (!db || typeof db.runTransaction !== 'function' || !/^[A-Za-z0-9._-]{1,80}$/.test(runId || '') ||
      !Buffer.isBuffer(key) || key.length < 32 || !date(startAt) || !date(cutoffAt) || startAt > cutoffAt) invalid();
  const capturedAt = now().toISOString();
  if (!date(capturedAt) || capturedAt < cutoffAt) invalid();
  const idHash = (kind, value) => createHmac('sha256', key).update(`${kind}\0${value}`).digest('hex');
  const manifest = { schemaVersion: 1, source: 'app', runId, hashKeyId: hash(key), startAt, cutoffAt, capturedAt,
    sourceComplete: false, errors: [], pages: [], rows: [], catalog: [], syncComplete: false, residualCount: 0,
    noMailConfirmations: [] };
  const errors = new Set();
  try {
    await db.runTransaction(async (transaction) => {
      const doc = (path) => db.doc(`${ROOT}/${path}`);
      const collection = (path) => db.collection(`${ROOT}/${path}`);
      const [activeDoc, syncDoc, leaseDoc, controlDoc, messageDocs, diagnostics, suppressedMessages, suppressedCases, coverageDocs, revisionDoc] = await Promise.all([
        transaction.get(doc('meta/activeCatalog')), transaction.get(doc('meta/sync')),
        transaction.get(doc('meta/syncLease')), transaction.get(doc('meta/purgeControl')),
        transaction.get(collection('messages').select('messageId', 'internalDate', 'matchState', 'caseId', 'manualClassification',
          'reason', 'unavailable', 'bodyAvailability', 'attachmentCount', 'attachments', 'firstReview', 'excludedAt', 'indexedGeneration')),
        transaction.get(collection('deletionDiagnostics').select('messageId')),
        transaction.get(collection('suppressedMessages').select()), transaction.get(collection('suppressedCases').select()),
        transaction.get(collection('caseCoverage')), transaction.get(doc('meta/mappingRevision'))
      ]);
      const active = data(activeDoc); const sync = data(syncDoc); const lease = data(leaseDoc); const control = data(controlDoc);
      if (control?.active) errors.add('APP_PURGE_ACTIVE');
      if (control && (!Number.isSafeInteger(control.generation) || control.generation < 0)) errors.add('APP_PURGE_STATE_INVALID');
      if (lease && (!date(lease.expiresAt) || lease.expiresAt > capturedAt)) errors.add('APP_SYNC_LEASE_ACTIVE');
      manifest.syncComplete = sync?.state === 'complete' && sync.startAt === startAt && sync.cutoffAt === cutoffAt &&
        sync.failedCount === 0 && !sync.errorCode && !sync.pageToken && !sync.inFlightPage && !sync.finalizeCursor &&
        (!sync.failedMessageIds || Array.isArray(sync.failedMessageIds) && sync.failedMessageIds.length === 0) &&
        ['full', 'history'].includes(sync.mode) && ID.test(sync.executionId || '') &&
        date(sync.lastSuccessAt) && sync.lastSuccessAt >= cutoffAt && /^\d+$/.test(sync.historyId || '');
      if (!manifest.syncComplete) errors.add('APP_SYNC_INCOMPLETE');
      if (!Number.isSafeInteger(sync?.failedCount) || sync.failedCount < 0) errors.add('APP_SYNC_STATE_INVALID');
      if (!active || !ID.test(active.snapshotId || '') || !HASH.test(active.digest || '') ||
          !Number.isSafeInteger(active.total) || active.total < 0 || active.total > MAX_ROWS) {
        errors.add('APP_CATALOG_INVALID'); return;
      }
      if (sync?.catalogSnapshotId !== active.snapshotId) errors.add('APP_CATALOG_CHANGED');
      const [snapshotDoc, pageDocs] = await Promise.all([
        transaction.get(doc(`catalogSnapshots/${active.snapshotId}`)),
        transaction.get(collection(`catalogSnapshots/${active.snapshotId}/pages`).select('pageIndex', 'cases'))
      ]);
      const snapshot = data(snapshotDoc);
      if (!snapshot?.complete || snapshot.digest !== active.digest || snapshot.total !== active.total ||
          !Number.isSafeInteger(snapshot.pageCount) || snapshot.pageCount < 1 || snapshot.pageCount > MAX_ROWS ||
          pageDocs.docs.length !== snapshot.pageCount) errors.add('APP_CATALOG_INCOMPLETE');
      const pages = [...pageDocs.docs].sort((a, b) => a.data().pageIndex - b.data().pageIndex);
      const cases = []; const seenCases = new Set();
      for (let index = 0; index < pages.length; index++) {
        const page = pages[index].data();
        if (page.pageIndex !== index || pages[index].id !== String(index).padStart(4, '0') || !Array.isArray(page.cases)) {
          errors.add('APP_CATALOG_PAGES_INVALID'); continue;
        }
        for (const item of page.cases) {
          if (!item || Object.keys(item).sort().join(',') !== 'caseId,closedAt,handledStatus' || !UUID.test(item.caseId || '') ||
              !STATUSES.includes(item.handledStatus) || !(item.closedAt === null || date(item.closedAt) && item.handledStatus === '対応済み') ||
              seenCases.has(item.caseId)) { errors.add('APP_CATALOG_INVALID'); continue; }
          seenCases.add(item.caseId); cases.push(item);
        }
      }
      cases.sort((a, b) => a.caseId.localeCompare(b.caseId));
      if (cases.length !== active.total || hash(cases.map((item) => JSON.stringify([item.caseId, item.handledStatus, item.closedAt])).join('\n')) !== active.digest) errors.add('APP_CATALOG_DIGEST_MISMATCH');
      const blockedCases = new Set(suppressedCases.docs.map((item) => item.id));
      if (suppressedCases.docs.some((item) => !HASH.test(item.id)) || suppressedMessages.docs.some((item) => !HASH.test(item.id))) errors.add('APP_SUPPRESSION_INVALID');
      for (const item of cases) {
        if (blockedCases.has(marker('case', item.caseId))) errors.add('APP_CASE_SUPPRESSED');
        if (item.handledStatus === '対応済み' && item.closedAt === null) errors.add('APP_CLOSURE_UNKNOWN');
        if (item.closedAt && expiresAt(item.closedAt) <= capturedAt) errors.add('APP_RETENTION_EXPIRED');
        manifest.catalog.push({ caseHash: idHash('case', item.caseId), handledStatus: item.handledStatus, closedAt: item.closedAt });
      }
      if (messageDocs.docs.length > MAX_ROWS) { errors.add('APP_ROW_LIMIT'); return; }
      const blockedMessages = new Set(suppressedMessages.docs.map((item) => item.id));
      const seenMessages = new Set();
      for (const item of messageDocs.docs) {
        const record = item.data();
        if (!ID.test(item.id) || record.messageId !== item.id || seenMessages.has(item.id) || !date(record.internalDate) ||
            !['matched', 'pending', 'excluded'].includes(record.matchState) || !(record.caseId === null || UUID.test(record.caseId || '')) ||
            typeof record.unavailable !== 'boolean' || !['verified', 'unverified', 'unavailable'].includes(record.bodyAvailability) ||
            !Array.isArray(record.attachments) || !Number.isSafeInteger(record.attachmentCount) || record.attachmentCount < 0 ||
            !record.attachments.every((attachment) => attachment && ['verified', 'unverified', 'unavailable'].includes(attachment.availability) &&
              (attachment.transferVersion == null || Number.isSafeInteger(attachment.transferVersion)) &&
              (attachment.transferSize == null || Number.isSafeInteger(attachment.transferSize) && attachment.transferSize >= 0) &&
              (attachment.servedChunks === undefined || Array.isArray(attachment.servedChunks) && attachment.servedChunks.length <= MAX_ROWS &&
                attachment.servedChunks.every((offset) => Number.isSafeInteger(offset) && offset >= 0)))) {
          errors.add('APP_MESSAGE_INVALID'); continue;
        }
        seenMessages.add(item.id);
        if (record.internalDate >= startAt && record.internalDate <= cutoffAt && sync?.mode === 'full' &&
            record.indexedGeneration !== sync.executionId) errors.add('APP_MESSAGE_GENERATION_MISMATCH');
        if (record.matchState === 'excluded' && (!date(record.excludedAt) || expiresAt(record.excludedAt) <= capturedAt)) errors.add('APP_EXCLUSION_RETENTION_UNRESOLVED');
        if (blockedMessages.has(marker('message', item.id))) errors.add('APP_MESSAGE_SUPPRESSED');
        const review = record.firstReview;
        if (review !== null && (!review || typeof review.email !== 'string' || !review.email || !date(review.at))) {
          errors.add('APP_REVIEW_INVALID'); continue;
        }
        manifest.rows.push({ messageHash: idHash('message', item.id), internalDate: record.internalDate,
          classification: record.matchState, caseHash: record.caseId === null ? null : idHash('case', record.caseId),
          manualExclusion: record.matchState === 'excluded' && (record.manualClassification === true || record.reason === 'manual'),
          unavailable: record.unavailable, bodyVerified: record.bodyAvailability === 'verified', attachmentCount: record.attachmentCount,
          attachments: record.attachments.map((attachment) => ({ availability: attachment.availability,
            transferVersion: attachment.transferVersion ?? null, transferSize: attachment.transferSize ?? null,
            servedChunks: attachment.servedChunks ?? [] })),
          firstReview: review === null ? null : { actorHash: idHash('actor', review.email), at: review.at } });
      }
      if (diagnostics.docs.length) errors.add('APP_DELETION_UNRESOLVED');
      if (diagnostics.docs.some((item) => !ID.test(item.id) || item.data().messageId !== item.id)) errors.add('APP_DELETION_INVALID');
      manifest.residualCount = diagnostics.docs.length + (Number.isSafeInteger(sync?.failedCount) ? sync.failedCount : 1);
      const revision = data(revisionDoc);
      if (revision && (Object.keys(revision).join(',') !== 'token' || !UUID.test(revision.token || ''))) errors.add('APP_MAPPING_REVISION_INVALID');
      const context = noMailContext({ complete: true, snapshotId: active.snapshotId, digest: active.digest }, sync, revision?.token ?? null, control?.generation ?? 0);
      if (coverageDocs.docs.length > MAX_ROWS) errors.add('APP_ROW_LIMIT');
      const linked = new Set(manifest.rows.filter((item) => item.classification === 'matched' && item.internalDate >= startAt && item.internalDate <= cutoffAt).map((item) => item.caseHash));
      const pending = manifest.rows.some((item) => item.classification === 'pending' && item.internalDate >= startAt && item.internalDate <= cutoffAt);
      for (const item of coverageDocs.docs) {
        const value = item.data(); const confirmation = value.noMailConfirmation;
        if (confirmation == null && value.noMailConfirmed !== true) continue;
        if (!UUID.test(item.id) || !wellFormedNoMailConfirmation(confirmation) || confirmation.caseId !== item.id ||
            typeof value.noMailConfirmed !== 'boolean' || !seenCases.has(item.id) || confirmation.at > capturedAt) {
          errors.add('APP_NO_MAIL_CONFIRMATION_INVALID'); continue;
        }
        if (value.noMailConfirmed && validNoMailConfirmation(confirmation, context) && !linked.has(idHash('case', item.id)) &&
            manifest.syncComplete && !pending && !diagnostics.docs.length && (!lease || date(lease.expiresAt) && lease.expiresAt <= capturedAt)) {
          manifest.noMailConfirmations.push({ caseHash: idHash('case', item.id), evidenceHash: idHash('evidence', JSON.stringify({
            caseId: confirmation.caseId, email: confirmation.email, at: confirmation.at, requestId: confirmation.requestId,
            context: Object.fromEntries(Object.keys(confirmation.context).sort().map((name) => [name, confirmation.context[name]])) })) });
        }
      }
    }, { readOnly: true });
  } catch {
    errors.add('APP_CAPTURE_FAILED');
  }
  manifest.capturedAt = now().toISOString();
  if (!date(manifest.capturedAt) || manifest.capturedAt < capturedAt) errors.add('APP_CAPTURE_TIME_INVALID');
  if (manifest.catalog.some((item) => item.closedAt && item.closedAt > manifest.capturedAt)) errors.add('APP_CLOSURE_INVALID');
  manifest.errors = [...errors].sort();
  manifest.sourceComplete = manifest.errors.length === 0;
  manifest.pages = [{ index: 0, requestTokenHash: null, nextTokenHash: null, rowCount: manifest.rows.length }];
  return manifest;
}

export function parseAppCaptureArguments(args, now = new Date()) {
  if (args.length === 0) return { execute: false, configured: false };
  if (args.length === 1 && args[0] === '--help') return { help: true };
  const options = {}; const required = ['--project', '--database', '--run-id', '--start-at', '--cutoff-at', '--private-dir', '--key-file', '--out'];
  const allowed = new Set(required);
  let execute = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--execute' && !execute) { execute = true; continue; }
    if (!allowed.has(args[index]) || options[args[index]] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) invalid();
    options[args[index]] = args[++index];
  }
  if (required.some((name) => !options[name]) || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(options['--project']) ||
      !/^\(default\)$|^[a-z][a-z0-9-]{2,61}$/.test(options['--database']) ||
      !/^[A-Za-z0-9._-]{1,80}$/.test(options['--run-id']) || !date(options['--start-at']) || !date(options['--cutoff-at']) ||
      options['--start-at'] > options['--cutoff-at'] || options['--cutoff-at'] > now.toISOString() ||
      !['--private-dir', '--key-file', '--out'].every((name) => isAbsolute(options[name])) ||
      !/\.json$/i.test(options['--out'])) invalid();
  return { execute, configured: true, projectId: options['--project'], databaseId: options['--database'],
    runId: options['--run-id'], startAt: options['--start-at'], cutoffAt: options['--cutoff-at'],
    privateDir: resolve(options['--private-dir']), keyFile: resolve(options['--key-file']), outputFile: resolve(options['--out']) };
}

export async function runAppCaptureCli(args, { prepare = prepareCaptureFiles, createDb = async (options) => {
  const { Firestore } = await import('@google-cloud/firestore');
  return new Firestore({ projectId: options.projectId, databaseId: options.databaseId });
}, now = () => new Date(), write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const options = parseAppCaptureArguments(args, now());
  if (options.help) {
    write({ operation: 'readOnlyAppAcceptanceCapture', executeByDefault: false,
      required: ['--project', '--database', '--run-id', '--start-at', '--cutoff-at', '--private-dir', '--key-file', '--out'],
      executionFlag: '--execute',
      prerequisites: 'Existing read-only ADC, restricted private directory, shared temporary 32-byte run key file' });
    return { execute: false };
  }
  if (!options.configured) { write({ execute: false, operation: 'readOnlyAppAcceptanceCapture' }); return { execute: false }; }
  const files = await prepare(options);
  let db;
  try {
    if (!options.execute) { write({ execute: false, operation: 'readOnlyAppAcceptanceCapture' }); return { execute: false }; }
    db = await createDb(options);
    const manifest = await captureAppAcceptance({ db, runId: options.runId, key: files.key,
      startAt: options.startAt, cutoffAt: options.cutoffAt, now });
    await files.write(manifest);
    const result = { execute: true, sourceComplete: manifest.sourceComplete, errors: manifest.errors,
      caseCount: manifest.catalog.length, messageCount: manifest.rows.length };
    write(result);
    return result;
  } finally {
    try { if (db) await db.terminate(); } finally { await files.close(); }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runAppCaptureCli(process.argv.slice(2)).then((result) => { process.exitCode = result.execute && !result.sourceComplete ? 1 : 0; }).catch((error) => {
    const code = ['MAIL_ACCEPTANCE_INPUT_INVALID', 'MAIL_ACCEPTANCE_PRIVATE_PATH_REQUIRED'].includes(error?.message) ? error.message : 'MAIL_ACCEPTANCE_CAPTURE_FAILED';
    process.stderr.write(`${code}\n`); process.exitCode = 2;
  });
}
