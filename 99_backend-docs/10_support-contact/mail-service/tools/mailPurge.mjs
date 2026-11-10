import { createHash } from 'node:crypto';
import { assertMail } from '../runtime/errors.mjs';
import { suppressionKey } from '../runtime/purgeGate.mjs';
import { createFirestoreStore } from '../runtime/firestoreStore.mjs';
import { retentionExpiresAt } from '../runtime/caseRetention.mjs';

const MAILBOX = 'contactMailboxes/customer-speed-ad';
const CASE_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const KNOWN = new Set(['messages', 'events', 'receipts', 'caseCoverage', 'deletionDiagnostics', 'meta',
  'catalogSnapshots', 'suppressedMessages', 'suppressedCases', 'suppressedRequests']);
const SCANNED = ['messages', 'events', 'receipts', 'caseCoverage', 'deletionDiagnostics'];
const MAX_SCAN = 10000;
const MAX_TARGETS = 2000;
const MAX_SCAN_BYTES = 50 * 1024 * 1024;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const hash = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const values = (value) => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(values) :
  value && typeof value === 'object' ? Object.values(value).flatMap(values) : [];
const caseReferences = (value) => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(caseReferences) :
  Object.entries(value).flatMap(([key, item]) => key === 'caseId' || key === 'caseIds' || key.endsWith('CaseId') || key.endsWith('CaseIds') ? values(item).filter((id) => CASE_ID.test(id)) : caseReferences(item));
const messageReferences = (value) => !value || typeof value !== 'object' ? [] : Array.isArray(value) ? value.flatMap(messageReferences) :
  Object.entries(value).flatMap(([key, item]) => ['messageId', 'messageIds'].includes(key) ? values(item) : messageReferences(item));
const record = (snapshot) => ({ path: snapshot.ref.path, data: snapshot.data(), hash: hash(snapshot.data()) });

export function createMailPurge({ db, projectId, databaseId = '(default)', now = () => new Date() }) {
  assertMail(typeof projectId === 'string' && /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId) &&
    databaseId === '(default)', 'MAIL_PURGE_TARGET_INVALID');
  const mailbox = db.doc(MAILBOX);
  const controlRef = mailbox.collection('meta').doc('purgeControl');
  const jobRef = mailbox.collection('meta').doc('purgeJob');
  const syncRef = mailbox.collection('meta').doc('sync');
  const leaseRef = mailbox.collection('meta').doc('syncLease');
  const snapshotData = (snapshot) => snapshot.exists ? snapshot.data() : null;

  function validate(caseId, requestReference, excluded = false) {
    assertMail((excluded || CASE_ID.test(caseId || '')) && /^[A-Za-z0-9._-]{1,80}$/.test(requestReference || ''), 'MAIL_PURGE_INPUT_INVALID');
  }
  function excludedExpiry(value) {
    if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null;
    const date = new Date(value);
    if (date.toISOString() !== value) return null;
    const month = date.getUTCMonth();
    date.setUTCFullYear(date.getUTCFullYear() + 3);
    if (date.getUTCMonth() !== month) date.setUTCDate(0);
    return date.toISOString();
  }
  async function scan(caseId, requestReference, excluded = false, expiryOnly = false) {
    validate(caseId, requestReference, excluded);
    let expiryAnchor = null;
    if (expiryOnly) {
      const catalog = await createFirestoreStore(db).getCatalog();
      const entry = catalog.cases?.find((item) => item.caseId === caseId);
      assertMail(catalog.complete && entry?.handledStatus === '対応済み' && entry.closedAt &&
        Date.parse(retentionExpiresAt(entry.closedAt)) <= now().getTime(), 'MAIL_PURGE_NOT_EXPIRED', 409);
      expiryAnchor = { digest: catalog.digest, closedAt: entry.closedAt };
    }
    const collections = await mailbox.listCollections();
    assertMail(collections.every((item) => KNOWN.has(item.id)), 'MAIL_PURGE_UNSUPPORTED_COLLECTION', 409);
    const root = await mailbox.get();
    assertMail(!root.exists || Object.keys(root.data()).length === 0, 'MAIL_PURGE_UNSUPPORTED_COLLECTION', 409);
    const meta = await mailbox.collection('meta').get();
    assertMail(meta.docs.every((item) => ['sync', 'syncLease', 'activeCatalog', 'purgeControl', 'purgeJob', 'markerCleanupJob'].includes(item.id)), 'MAIL_PURGE_UNSUPPORTED_COLLECTION', 409);
    const all = [];
    let scanBytes = 0;
    for (const name of SCANNED) {
      const refs = await mailbox.collection(name).listDocuments();
      assertMail(refs.length <= MAX_SCAN, 'MAIL_PURGE_SCAN_LIMIT', 409);
      for (let offset = 0; offset < refs.length; offset += 25) {
        const found = await db.getAll(...refs.slice(offset, offset + 25));
        for (const item of found) {
          assertMail((await item.ref.listCollections()).length === 0, 'MAIL_PURGE_UNSUPPORTED_COLLECTION', 409);
          if (!item.exists) continue;
          const value = record(item);
          scanBytes += Buffer.byteLength(JSON.stringify(value.data));
          assertMail(scanBytes <= MAX_SCAN_BYTES, 'MAIL_PURGE_SCAN_LIMIT', 409);
          all.push(value);
        }
      }
    }
    const sync = await syncRef.get();
    if (sync.exists) all.push(record(sync));
    all.sort((a, b) => a.path.localeCompare(b.path));
    const messages = all.filter((item) => item.path.startsWith(`${MAILBOX}/messages/`));
    const eligibleExcluded = messages.filter((item) => item.data.matchState === 'excluded' && item.data.sourceKind !== 'draft');
    const unknownExclusionCount = excluded ? eligibleExcluded.filter((item) => !excludedExpiry(item.data.excludedAt)).length : 0;
    let selected = excluded ? eligibleExcluded.filter((item) => {
      const expiry = excludedExpiry(item.data.excludedAt);
      return expiry && expiry <= now().toISOString();
    }) : messages.filter((item) => item.data.caseId === caseId);
    let unsafeExclusionCount = 0;
    if (excluded) {
      const candidates = new Set(selected.map((item) => item.data.messageId));
      const related = new Map([...candidates].map((id) => [id, []]));
      const unsafe = new Set();
      const queue = [];
      const protect = (id) => { if (!unsafe.has(id)) { unsafe.add(id); queue.push(id); } };
      for (const item of all.filter((entry) => entry.path !== `${MAILBOX}/meta/sync`)) {
        const refs = [...new Set(values(item.data).filter((value) => candidates.has(value)))];
        const owners = messageReferences(item.data);
        // Retaining a child protects its referenced parent; retaining a parent does not protect the child.
        for (const id of owners.filter((value) => candidates.has(value))) related.get(id).push(refs);
        if (caseReferences(item.data).length || owners.some((id) => !candidates.has(id))) {
          refs.forEach(protect);
        }
      }
      // A retained message's shared event/receipt cannot be removed through another candidate.
      for (let index = 0; index < queue.length; index++) {
        for (const refs of related.get(queue[index])) refs.forEach(protect);
      }
      unsafeExclusionCount = unsafe.size;
      selected = selected.filter((item) => !unsafe.has(item.data.messageId));
    }
    const ids = selected.map((item) => item.data.messageId).sort();
    const identifiers = new Set([...(excluded ? [] : [caseId]), ...ids]);
    const refers = (item) => values(item.data).some((value) => identifiers.has(value));
    // Pending/mixed mail must be resolved before deleting one case's records.
    const selectedIds = new Set(ids);
    assertMail(messages.every((item) => selectedIds.has(item.data.messageId) || !refers(item)), 'MAIL_PURGE_AMBIGUOUS', 409);
    assertMail(excluded || messages.every((item) => item.data.caseId === caseId || !values(item.data).includes(caseId)), 'MAIL_PURGE_AMBIGUOUS', 409);
    assertMail(excluded || selected.every((item) => values(item.data.evidence || {}).filter((value) => CASE_ID.test(value)).every((value) => value === caseId)), 'MAIL_PURGE_AMBIGUOUS', 409);
    const targets = all.filter((item) => refers(item) || (!excluded && item.path === `${MAILBOX}/caseCoverage/${caseId}`));
    for (const item of targets.filter((entry) => entry.path.startsWith(`${MAILBOX}/events/`))) {
      assertMail(caseReferences(item.data).every((value) => !excluded && value === caseId), 'MAIL_PURGE_SHARED_EVENT', 409);
    }
    assertMail(targets.length <= MAX_TARGETS, 'MAIL_PURGE_TARGET_LIMIT', 409);
    const plan = { version: 1, projectId, databaseId, mailbox: MAILBOX, scope: excluded ? 'expired-exclusions' : expiryOnly ? 'expired-case' : 'case-request',
      caseHash: suppressionKey(excluded ? 'scope' : 'case', excluded ? 'expired-exclusions' : caseId), unknownExclusionCount, unsafeExclusionCount,
      requestHash: suppressionKey('request-reference', requestReference),
      stateHash: hash({ records: all.map(({ path, hash: digest }) => [path, digest]), expiryAnchor }),
      targets: targets.map(({ path, hash: digest }) => ({ path, hash: digest })), messageIds: ids,
      receiptIds: targets.filter((item) => item.path.startsWith(`${MAILBOX}/receipts/`)).map((item) => item.path.split('/').at(-1)) };
    assertMail(Buffer.byteLength(JSON.stringify(plan)) < 500000, 'MAIL_PURGE_TARGET_LIMIT', 409);
    return { ...plan, planHash: hash(plan) };
  }
  const publicPlan = (plan) => ({ projectId, databaseId, mailbox: 'customer-speed-ad', planHash: plan.planHash,
    messageCount: plan.messageIds.length, documentCount: plan.targets.length, unknownExclusionCount: plan.unknownExclusionCount,
    unsafeExclusionCount: plan.unsafeExclusionCount, mode: 'dry-run' });

  function validateJob(job) {
    const { planHash, ...source } = job || {};
    assertMail(job?.version === 1 && job.projectId === projectId && job.databaseId === databaseId && job.mailbox === MAILBOX &&
      ['case-request', 'expired-case', 'expired-exclusions'].includes(job.scope) && planHash === hash(source) &&
      Array.isArray(job.targets) && job.targets.length <= MAX_TARGETS && job.targets.every((item) =>
        /^[a-f0-9]{64}$/.test(item.hash || '') && (SCANNED.some((name) => item.path.startsWith(`${MAILBOX}/${name}/`) && item.path.split('/').length === 4) || item.path === `${MAILBOX}/meta/sync`)) &&
      Array.isArray(job.messageIds) && job.messageIds.every((id) => /^[A-Za-z0-9_-]{1,128}$/.test(id)) &&
      Array.isArray(job.receiptIds) && job.receiptIds.every((id) => /^[A-Za-z0-9-]{16,80}$/.test(id)), 'MAIL_PURGE_JOB_INVALID', 409);
  }

  async function plan(caseId, requestReference, excluded = false, expiryOnly = false) {
    const control = snapshotData(await controlRef.get());
    if (control?.active) {
      const job = snapshotData(await jobRef.get());
      validateJob(job);
      validate(caseId, requestReference, excluded);
      assertMail(job && job.scope === (excluded ? 'expired-exclusions' : expiryOnly ? 'expired-case' : 'case-request') && job.caseHash === suppressionKey(excluded ? 'scope' : 'case', excluded ? 'expired-exclusions' : caseId) && job.requestHash === suppressionKey('request-reference', requestReference), 'MAIL_MAINTENANCE', 503);
      return { ...publicPlan(job), mode: 'resume-required' };
    }
    return publicPlan(await scan(caseId, requestReference, excluded, expiryOnly));
  }

  async function apply(caseId, requestReference, planHash, excluded = false, expiryOnly = false) {
    validate(caseId, requestReference, excluded);
    assertMail(/^[a-f0-9]{64}$/.test(planHash || ''), 'MAIL_PURGE_PLAN_REQUIRED');
    const before = snapshotData(await controlRef.get());
    let job = snapshotData(await jobRef.get());
    if (job) {
      validateJob(job);
      assertMail(job.scope === (excluded ? 'expired-exclusions' : expiryOnly ? 'expired-case' : 'case-request') && job.planHash === planHash && job.caseHash === suppressionKey(excluded ? 'scope' : 'case', excluded ? 'expired-exclusions' : caseId) &&
        job.requestHash === suppressionKey('request-reference', requestReference), 'MAIL_PURGE_PLAN_CHANGED', 409);
    } else {
      const beforeGeneration = before?.generation ?? 0;
      assertMail(Number.isSafeInteger(beforeGeneration) && beforeGeneration >= 0 && !before?.active, 'MAIL_MAINTENANCE', 503);
      job = await scan(caseId, requestReference, excluded, expiryOnly);
      assertMail(job.planHash === planHash, 'MAIL_PURGE_PLAN_CHANGED', 409);
      await db.runTransaction(async (transaction) => {
        const [control, lease, sync, existingJob] = await Promise.all([transaction.get(controlRef), transaction.get(leaseRef), transaction.get(syncRef), transaction.get(jobRef)]);
        assertMail(Number.isSafeInteger(control.data()?.generation ?? 0), 'MAIL_MAINTENANCE', 503);
        assertMail((control.data()?.generation ?? 0) === beforeGeneration && !existingJob.exists, 'MAIL_PURGE_PLAN_CHANGED', 409);
        assertMail(!control.data()?.active && !(lease.exists && Date.parse(lease.data().expiresAt) > now().getTime()) && sync.data()?.state !== 'running', 'MAIL_PURGE_BUSY', 409);
        transaction.set(controlRef, { generation: (control.data()?.generation || 0) + 1,
          active: { planHash, caseHash: job.caseHash, stage: 'validating', nextOffset: 0 } });
        transaction.set(jobRef, job);
      });
    }
    const control = snapshotData(await controlRef.get());
    const generation = control?.generation;
    assertMail(Number.isSafeInteger(generation) && generation >= 0 && control?.active?.planHash === planHash, 'MAIL_MAINTENANCE', 503);
    const locked = async (transaction) => {
      const [controlSnapshot, jobSnapshot] = await Promise.all([transaction.get(controlRef), transaction.get(jobRef)]);
      const current = snapshotData(controlSnapshot);
      const currentJob = snapshotData(jobSnapshot);
      assertMail(current?.generation === generation && current.active?.planHash === planHash && currentJob?.planHash === planHash,
        'MAIL_MAINTENANCE', 503);
      validateJob(currentJob);
      assertMail(['validating', 'deleting'].includes(current.active.stage) && Number.isSafeInteger(current.active.nextOffset) &&
        current.active.nextOffset >= 0 && current.active.nextOffset <= job.targets.length &&
        (current.active.stage !== 'validating' || current.active.nextOffset === 0), 'MAIL_PURGE_JOB_INVALID', 409);
      return current;
    };
    // A failed or interrupted validation is never a resumable deletion approval.
    if (control.active.stage !== 'deleting') {
      const checked = await scan(caseId, requestReference, excluded, expiryOnly);
      assertMail(checked.planHash === planHash, 'MAIL_PURGE_PLAN_CHANGED', 409);
      await db.runTransaction(async (transaction) => {
        const current = await locked(transaction);
        if (current.active.stage === 'deleting') return;
        transaction.set(controlRef, { generation, active: { ...current.active, stage: 'deleting', nextOffset: 0 } });
      });
    }
    // The gate stays closed after a partial failure; the same plan resumes idempotently.
    while (await db.runTransaction(async (transaction) => {
      const current = await locked(transaction);
      const offset = current.active.nextOffset;
      assertMail(current.active.stage === 'deleting' && Number.isSafeInteger(offset) && offset >= 0 && offset <= job.targets.length,
        'MAIL_PURGE_JOB_INVALID', 409);
      if (offset === job.targets.length) return false;
      const group = job.targets.slice(offset, offset + 25);
      const found = await Promise.all(group.map((item) => transaction.get(db.doc(item.path))));
      assertMail(found.every((item, index) => !item.exists || hash(item.data()) === group[index].hash), 'MAIL_PURGE_PLAN_CHANGED', 409);
      for (const item of group) transaction.delete(db.doc(item.path));
      for (const id of job.messageIds) if (group.some((item) => item.path === `${MAILBOX}/messages/${id}`)) {
        transaction.set(mailbox.collection('suppressedMessages').doc(suppressionKey('message', id)), { version: 1 });
      }
      for (const id of job.receiptIds) if (group.some((item) => item.path === `${MAILBOX}/receipts/${id}`)) {
        transaction.set(mailbox.collection('suppressedRequests').doc(suppressionKey('request', id)), { version: 1 });
      }
      transaction.set(controlRef, { generation, active: { ...current.active, nextOffset: offset + group.length } });
      return true;
    })) {
      // Each batch re-reads the current lock and progress inside its transaction.
    }
    await db.runTransaction(async (transaction) => {
      const current = await locked(transaction);
      assertMail(current.active.stage === 'deleting' && current.active.nextOffset === job.targets.length, 'MAIL_PURGE_INCOMPLETE', 503);
      const remaining = await Promise.all(job.targets.map((item) => transaction.get(db.doc(item.path))));
      assertMail(remaining.every((item) => !item.exists), 'MAIL_PURGE_INCOMPLETE', 503);
      if (job.scope !== 'expired-exclusions') transaction.set(mailbox.collection('suppressedCases').doc(job.caseHash), { version: 1 });
      transaction.set(controlRef, { generation: current.generation });
      transaction.delete(jobRef);
    });
    return { ...publicPlan(job), mode: 'applied' };
  }
  async function cancelUnvalidated(caseId, requestReference, planHash, excluded = false, expiryOnly = false) {
    validate(caseId, requestReference, excluded);
    assertMail(/^[a-f0-9]{64}$/.test(planHash || ''), 'MAIL_PURGE_PLAN_REQUIRED');
    const job = await db.runTransaction(async (transaction) => {
      const [controlSnapshot, jobSnapshot] = await Promise.all([transaction.get(controlRef), transaction.get(jobRef)]);
      const control = snapshotData(controlSnapshot);
      const currentJob = snapshotData(jobSnapshot);
      validateJob(currentJob);
      assertMail(currentJob.scope === (excluded ? 'expired-exclusions' : expiryOnly ? 'expired-case' : 'case-request') &&
        currentJob.planHash === planHash && currentJob.caseHash === suppressionKey(excluded ? 'scope' : 'case', excluded ? 'expired-exclusions' : caseId) &&
        currentJob.requestHash === suppressionKey('request-reference', requestReference), 'MAIL_PURGE_PLAN_CHANGED', 409);
      assertMail(control?.active?.planHash === planHash && control.active.stage === 'validating' && control.active.nextOffset === 0,
        'MAIL_PURGE_CANCEL_UNSAFE', 409);
      const targets = await Promise.all(currentJob.targets.map((item) => transaction.get(db.doc(item.path))));
      assertMail(targets.every((item) => item.exists), 'MAIL_PURGE_CANCEL_UNSAFE', 409);
      transaction.set(controlRef, { generation: control.generation });
      transaction.delete(jobRef);
      return currentJob;
    });
    return { ...publicPlan(job), mode: 'cancelled-unvalidated' };
  }
  return { plan, apply, cancelUnvalidated, planExpiredCase: (caseId, reference) => plan(caseId, reference, false, true),
    applyExpiredCase: (caseId, reference, planHash) => apply(caseId, reference, planHash, false, true),
    planExpiredExclusions: (reference) => plan(null, reference, true),
    applyExpiredExclusions: (reference, planHash) => apply(null, reference, planHash, true) };
}
