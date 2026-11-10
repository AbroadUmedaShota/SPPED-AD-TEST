import { createHash } from 'node:crypto';
import { assertMail } from '../runtime/errors.mjs';
import { suppressionKey } from '../runtime/purgeGate.mjs';

const ROOT = 'contactMailboxes/customer-speed-ad';
const HASH = /^[a-f0-9]{64}$/;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const hash = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const data = (snapshot) => snapshot.exists ? snapshot.data() : null;
const minimal = (value) => value?.version === 1 && Object.keys(value).length === 1;

export function createMarkerCleanup({ db, gmail, projectId, databaseId = '(default)', now = () => new Date() }) {
  assertMail(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId || '') && databaseId === '(default)', 'MAIL_MARKER_TARGET_INVALID');
  const mailbox = db.doc(ROOT);
  const markers = mailbox.collection('suppressedMessages');
  const meta = mailbox.collection('meta');
  const controlRef = meta.doc('purgeControl');
  const jobRef = meta.doc('markerCleanupJob');
  const syncRef = meta.doc('sync');
  const leaseRef = meta.doc('syncLease');
  const purgeJobRef = meta.doc('purgeJob');

  function inputs(reference, afterMarker = '') {
    assertMail(/^[A-Za-z0-9._-]{1,80}$/.test(reference || '') && (!afterMarker || HASH.test(afterMarker)), 'MAIL_MARKER_INPUT_INVALID');
  }
  function syncValid(sync, lease) {
    assertMail(sync?.state === 'complete' && typeof sync.startAt === 'string' &&
      Number.isFinite(Date.parse(sync.startAt)) && new Date(sync.startAt).toISOString() === sync.startAt &&
      (!lease || Number.isFinite(Date.parse(lease.expiresAt)) && Date.parse(lease.expiresAt) <= now().getTime()), 'MAIL_MARKER_SYNC_BUSY', 409);
  }
  function validateJob(job) {
    assertMail(job?.version === 1 && job.projectId === projectId && job.databaseId === databaseId && HASH.test(job.planHash || '') &&
      HASH.test(job.requestHash || '') && HASH.test(job.syncHash || '') && Number.isSafeInteger(job.generation) && job.generation >= 1 &&
      Number.isSafeInteger(job.revision) && job.revision >= 0 && ['enumerating', 'ready', 'deleting'].includes(job.stage) &&
      Array.isArray(job.candidates) && job.candidates.length > 0 && job.candidates.length <= 250 && job.candidates.every((id) => HASH.test(id)) &&
      new Set(job.candidates).size === job.candidates.length && Array.isArray(job.absent) &&
      job.absent.every((id) => job.candidates.includes(id)) && new Set(job.absent).size === job.absent.length &&
      Array.isArray(job.pageHashes) && job.pageHashes.length <= 5000 && job.pageHashes.every((id) => HASH.test(id)) &&
      Number.isSafeInteger(job.deletedOffset) && job.deletedOffset >= 0 && job.deletedOffset <= job.absent.length,
    'MAIL_MARKER_JOB_INVALID', 409);
    assertMail(job.planHash === hash({ version: 1, projectId, databaseId, generation: job.generation - 1,
      requestHash: job.requestHash, afterMarker: job.afterMarker, syncHash: job.syncHash, candidates: job.candidates, nextMarker: job.nextMarker }) &&
      (job.historyId === null || typeof job.historyId === 'string' && /^[0-9]{1,20}$/.test(job.historyId)) &&
      (job.stage === 'enumerating' ? job.deletedOffset === 0 : job.historyId !== null && HASH.test(job.deletionHash || '')),
    'MAIL_MARKER_JOB_INVALID', 409);
  }
  const publicJob = (job, mode = job.stage) => ({ mode, planHash: job.planHash, candidateCount: job.candidates.length,
    absentCount: job.stage === 'enumerating' ? null : job.absent.length, deletedCount: job.deletedOffset,
    pageCount: job.pageHashes.length, deletionHash: job.deletionHash || null, nextMarker: job.nextMarker });

  async function scan(reference, afterMarker) {
    inputs(reference, afterMarker);
    const [control, sync, lease, job, purgeJob] = await Promise.all([controlRef.get(), syncRef.get(), leaseRef.get(), jobRef.get(), purgeJobRef.get()]);
    const generation = data(control)?.generation ?? 0;
    assertMail(Number.isSafeInteger(generation) && generation >= 0 && !data(control)?.active && !job.exists && !purgeJob.exists, 'MAIL_MAINTENANCE', 503);
    syncValid(data(sync), data(lease));
    let query = markers.orderBy('__name__');
    if (afterMarker) query = query.startAfter(afterMarker);
    const found = (await query.limit(251).get()).docs;
    assertMail(found.every((item) => HASH.test(item.id)), 'MAIL_MARKER_JOB_INVALID', 409);
    const selected = found.slice(0, 250);
    assertMail(selected.every((item) => item.exists && minimal(item.data()) && item.ref.path === `${ROOT}/suppressedMessages/${item.id}`), 'MAIL_MARKER_JOB_INVALID', 409);
    for (const item of selected) assertMail((await item.ref.listCollections()).length === 0, 'MAIL_MARKER_JOB_INVALID', 409);
    const source = { version: 1, projectId, databaseId, generation, requestHash: suppressionKey('marker-reference', reference),
      afterMarker, syncHash: hash(data(sync)), candidates: selected.map((item) => item.id),
      nextMarker: found.length > selected.length ? selected.at(-1).id : null };
    return { ...source, planHash: hash(source) };
  }
  async function plan(reference, afterMarker = '') {
    const value = await scan(reference, afterMarker);
    return { mode: 'dry-run', planHash: value.planHash, candidateCount: value.candidates.length, nextMarker: value.nextMarker };
  }
  async function locked(transaction, reference, planHash, checkSync = true) {
    const [control, jobSnapshot, sync, lease, purgeJob] = await Promise.all([
      transaction.get(controlRef), transaction.get(jobRef), transaction.get(syncRef), transaction.get(leaseRef), transaction.get(purgeJobRef)]);
    const job = data(jobSnapshot);
    validateJob(job);
    assertMail(job.requestHash === suppressionKey('marker-reference', reference) && job.planHash === planHash &&
      data(control)?.generation === job.generation && data(control)?.active?.kind === 'marker-cleanup' &&
      data(control)?.active?.planHash === planHash && !purgeJob.exists, 'MAIL_MAINTENANCE', 503);
    if (checkSync) {
      syncValid(data(sync), data(lease));
      assertMail(hash(data(sync)) === job.syncHash, 'MAIL_MARKER_STATE_CHANGED', 409);
    }
    return job;
  }
  async function profile(expected) {
    const value = await gmail.getProfile();
    assertMail(typeof value?.emailAddress === 'string' && value.emailAddress.toLowerCase() === 'customer@speed-ad.com' &&
      typeof value.historyId === 'string' && /^[0-9]{1,20}$/.test(value.historyId), 'MAIL_MARKER_PROFILE_INVALID', 409);
    assertMail(!expected || value.historyId === expected, 'MAIL_MARKER_MAILBOX_CHANGED', 409);
    return value.historyId;
  }
  async function status(reference, planHash) {
    inputs(reference);
    assertMail(HASH.test(planHash || ''), 'MAIL_MARKER_PLAN_REQUIRED');
    if (!(await jobRef.get()).exists) return { mode: 'idle' };
    return db.runTransaction(async (transaction) => publicJob(await locked(transaction, reference, planHash, false)));
  }
  async function advance(reference, planHash, afterMarker = '') {
    inputs(reference, afterMarker);
    assertMail(HASH.test(planHash || ''), 'MAIL_MARKER_PLAN_REQUIRED');
    if (!(await jobRef.get()).exists) {
      const source = await scan(reference, afterMarker);
      assertMail(source.planHash === planHash && source.candidates.length > 0, 'MAIL_MARKER_PLAN_CHANGED', 409);
      await db.runTransaction(async (transaction) => {
        const [control, existing, sync, lease, purgeJob] = await Promise.all([
          transaction.get(controlRef), transaction.get(jobRef), transaction.get(syncRef), transaction.get(leaseRef), transaction.get(purgeJobRef)]);
        assertMail(!existing.exists && !purgeJob.exists && !data(control)?.active && (data(control)?.generation ?? 0) === source.generation,
          'MAIL_MARKER_PLAN_CHANGED', 409);
        syncValid(data(sync), data(lease));
        assertMail(hash(data(sync)) === source.syncHash, 'MAIL_MARKER_STATE_CHANGED', 409);
        const found = await Promise.all(source.candidates.map((id) => transaction.get(markers.doc(id))));
        assertMail(found.every((item) => item.exists && minimal(item.data())), 'MAIL_MARKER_PLAN_CHANGED', 409);
        transaction.set(controlRef, { generation: source.generation + 1, active: { kind: 'marker-cleanup', planHash } });
        transaction.set(jobRef, { ...source, generation: source.generation + 1, stage: 'enumerating', revision: 0,
          historyId: null, pageToken: null, pageHashes: [], absent: source.candidates, deletedOffset: 0 });
      });
    }
    const job = await db.runTransaction((transaction) => locked(transaction, reference, planHash));
    if (job.stage !== 'enumerating') return publicJob(job);
    const historyId = await profile(job.historyId);
    assertMail(job.pageHashes.length < 5000, 'MAIL_MARKER_SCAN_LIMIT', 409);
    const page = await gmail.listAllMessageIds({ pageToken: job.pageToken });
    assertMail(Array.isArray(page?.messageIds) && page.messageIds.length <= 50 && page.messageIds.every((id) => /^[A-Za-z0-9_-]{1,128}$/.test(id)) &&
      (page.nextPageToken === null || typeof page.nextPageToken === 'string' && page.nextPageToken.length > 0 && page.nextPageToken.length <= 8192),
    'MAIL_INVALID_UPSTREAM', 502);
    assertMail(!page.nextPageToken || page.messageIds.length > 0 && !job.pageHashes.includes(hash(page.nextPageToken)), 'MAIL_MARKER_PAGINATION_INVALID', 409);
    const present = new Set(page.messageIds.map((id) => suppressionKey('message', id)));
    const absent = job.absent.filter((id) => !present.has(id));
    const complete = page.nextPageToken === null;
    if (complete) await profile(historyId);
    return db.runTransaction(async (transaction) => {
      const current = await locked(transaction, reference, planHash);
      assertMail(current.revision === job.revision && current.stage === 'enumerating', 'MAIL_MARKER_STATE_CHANGED', 409);
      const updated = { ...current, historyId, absent, pageToken: page.nextPageToken, revision: current.revision + 1,
        pageHashes: [...current.pageHashes, hash(page.nextPageToken || 'complete')], stage: complete ? 'ready' : 'enumerating' };
      if (complete) updated.deletionHash = hash({ planHash, historyId, absent });
      transaction.set(jobRef, updated);
      return publicJob(updated);
    });
  }
  async function apply(reference, planHash, deletionHash) {
    inputs(reference);
    assertMail(HASH.test(planHash || '') && HASH.test(deletionHash || ''), 'MAIL_MARKER_PLAN_REQUIRED');
    const job = await db.runTransaction((transaction) => locked(transaction, reference, planHash));
    assertMail(['ready', 'deleting'].includes(job.stage) && job.deletionHash === deletionHash &&
      deletionHash === hash({ planHash, historyId: job.historyId, absent: job.absent }), 'MAIL_MARKER_PLAN_CHANGED', 409);
    await profile(job.historyId);
    return db.runTransaction(async (transaction) => {
      const current = await locked(transaction, reference, planHash);
      assertMail(current.revision === job.revision && current.deletionHash === deletionHash, 'MAIL_MARKER_STATE_CHANGED', 409);
      const group = current.absent.slice(current.deletedOffset, current.deletedOffset + 25);
      const found = await Promise.all(group.map((id) => transaction.get(markers.doc(id))));
      assertMail(found.every((item) => item.exists && minimal(item.data())), 'MAIL_MARKER_PLAN_CHANGED', 409);
      group.forEach((id) => transaction.delete(markers.doc(id)));
      const updated = { ...current, stage: 'deleting', revision: current.revision + 1, deletedOffset: current.deletedOffset + group.length };
      if (updated.deletedOffset === updated.absent.length) {
        transaction.set(controlRef, { generation: current.generation });
        transaction.delete(jobRef);
        return publicJob(updated, 'complete');
      }
      transaction.set(jobRef, updated);
      return publicJob(updated);
    });
  }
  async function cancel(reference, planHash) {
    inputs(reference);
    assertMail(HASH.test(planHash || ''), 'MAIL_MARKER_PLAN_REQUIRED');
    return db.runTransaction(async (transaction) => {
      const job = await locked(transaction, reference, planHash, false);
      transaction.set(controlRef, { generation: job.generation });
      transaction.delete(jobRef);
      return { mode: 'cancelled', deletedCount: job.deletedOffset };
    });
  }
  return { plan, advance, apply, status, cancel };
}
