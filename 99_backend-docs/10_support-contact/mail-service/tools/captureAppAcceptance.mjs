import { createHash, createHmac } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

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

export function noMailEvidenceRows(input, context) {
  if (!input || Object.keys(input).sort().join(',') !== 'cutoffAt,hashKeyId,rows,runId,schemaVersion,startAt' ||
      input.schemaVersion !== 1 || ['runId', 'hashKeyId', 'startAt', 'cutoffAt'].some((name) => input[name] !== context[name]) ||
      !Array.isArray(input.rows) || input.rows.length > MAX_ROWS || !input.rows.every((item) => item &&
        Object.keys(item).sort().join(',') === 'caseHash,evidenceHash' && HASH.test(item.caseHash || '') && HASH.test(item.evidenceHash || ''))) invalid();
  return structuredClone(input.rows);
}

// Reads one Firestore snapshot. No runtime RPC, classification, or mutation is invoked.
export async function captureAppAcceptance({ db, runId, key, startAt, cutoffAt, now = () => new Date(), noMailConfirmations = [] }) {
  if (!db || typeof db.runTransaction !== 'function' || !/^[A-Za-z0-9._-]{1,80}$/.test(runId || '') ||
      !Buffer.isBuffer(key) || key.length < 32 || !date(startAt) || !date(cutoffAt) || startAt > cutoffAt ||
      !Array.isArray(noMailConfirmations) || noMailConfirmations.length > MAX_ROWS) invalid();
  const capturedAt = now().toISOString();
  if (!date(capturedAt) || capturedAt < cutoffAt) invalid();
  const idHash = (kind, value) => createHmac('sha256', key).update(`${kind}\0${value}`).digest('hex');
  if (!noMailConfirmations.every((item) => item && Object.keys(item).sort().join(',') === 'caseHash,evidenceHash' &&
      HASH.test(item.caseHash || '') && HASH.test(item.evidenceHash || ''))) invalid();
  const manifest = { schemaVersion: 1, source: 'app', runId, hashKeyId: hash(key), startAt, cutoffAt, capturedAt,
    sourceComplete: false, errors: [], pages: [], rows: [], catalog: [], syncComplete: false, residualCount: 0,
    noMailConfirmations: structuredClone(noMailConfirmations) };
  const errors = new Set();
  try {
    await db.runTransaction(async (transaction) => {
      const doc = (path) => db.doc(`${ROOT}/${path}`);
      const collection = (path) => db.collection(`${ROOT}/${path}`);
      const [activeDoc, syncDoc, leaseDoc, controlDoc, messageDocs, diagnostics, suppressedMessages, suppressedCases] = await Promise.all([
        transaction.get(doc('meta/activeCatalog')), transaction.get(doc('meta/sync')),
        transaction.get(doc('meta/syncLease')), transaction.get(doc('meta/purgeControl')),
        transaction.get(collection('messages').select('messageId', 'internalDate', 'matchState', 'caseId', 'manualClassification',
          'reason', 'unavailable', 'bodyAvailability', 'attachmentCount', 'attachments', 'firstReview', 'excludedAt', 'indexedGeneration')),
        transaction.get(collection('deletionDiagnostics').select('messageId')),
        transaction.get(collection('suppressedMessages').select()), transaction.get(collection('suppressedCases').select())
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

async function main(args) {
  if (args.length === 1 && args[0] === '--help') {
    process.stdout.write('Read-only app acceptance capture. Plan by default; --execute requires --project --database --run-id --start-at --cutoff-at --out and MAIL_ACCEPTANCE_HASH_KEY (base64, at least 32 bytes). Optional --no-mail-confirmations accepts a private hashed evidence manifest for the same run. Existing ADC must already have read permission. No overwrite; keep output in a restricted private directory.\n');
    return;
  }
  const options = {}; const required = ['--project', '--database', '--run-id', '--start-at', '--cutoff-at', '--out'];
  const allowed = new Set([...required, '--no-mail-confirmations']);
  let execute = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--execute' && !execute) { execute = true; continue; }
    if (!allowed.has(args[index]) || options[args[index]] !== undefined || !args[index + 1] || args[index + 1].startsWith('--')) invalid();
    options[args[index]] = args[++index];
  }
  if (!execute) { process.stdout.write('{"execute":false,"operation":"readOnlyAppAcceptanceCapture"}\n'); return; }
  if (required.some((name) => !options[name]) || !/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(options['--project']) ||
      !/^\(default\)$|^[a-z][a-z0-9-]{2,61}$/.test(options['--database'])) invalid();
  const encoded = process.env.MAIL_ACCEPTANCE_HASH_KEY || '';
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) invalid();
  const key = Buffer.from(encoded, 'base64');
  if (key.toString('base64') !== encoded || key.length < 32) invalid();
  let noMailConfirmations = [];
  if (options['--no-mail-confirmations']) {
    if ((await stat(options['--no-mail-confirmations'])).size > 10 * 1024 * 1024) invalid();
    noMailConfirmations = noMailEvidenceRows(JSON.parse(await readFile(options['--no-mail-confirmations'], 'utf8')),
      { runId: options['--run-id'], hashKeyId: hash(key), startAt: options['--start-at'], cutoffAt: options['--cutoff-at'] });
  }
  const { Firestore } = await import('@google-cloud/firestore');
  const db = new Firestore({ projectId: options['--project'], databaseId: options['--database'] });
  try {
    const manifest = await captureAppAcceptance({ db, runId: options['--run-id'], key,
      startAt: options['--start-at'], cutoffAt: options['--cutoff-at'], noMailConfirmations });
    await writeFile(options['--out'], `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ sourceComplete: manifest.sourceComplete, errors: manifest.errors,
      caseCount: manifest.catalog.length, messageCount: manifest.rows.length })}\n`);
    if (!manifest.sourceComplete) process.exitCode = 1;
  } finally { key.fill(0); await db.terminate(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch(() => { process.stderr.write('MAIL_ACCEPTANCE_CAPTURE_FAILED\n'); process.exitCode = 1; });
}
