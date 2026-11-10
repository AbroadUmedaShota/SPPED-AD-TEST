import { createHash } from 'node:crypto';
import { assertMail } from '../runtime/errors.mjs';
import { suppressionKey } from '../runtime/purgeGate.mjs';

const ROOT = 'contactMailboxes/customer-speed-ad';
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const HASH = /^[a-f0-9]{64}$/;
const MAX_SNAPSHOTS = 25;
const MAX_DOCUMENTS = 1000;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const hash = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const data = (snapshot) => snapshot.exists ? snapshot.data() : null;

export function createCatalogRetirement({ db, projectId, databaseId = '(default)', now = () => new Date() }) {
  assertMail(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId || '') && databaseId === '(default)', 'MAIL_CATALOG_RETIRE_TARGET_INVALID');
  const mailbox = db.doc(ROOT);
  const catalogs = mailbox.collection('catalogSnapshots');
  const meta = mailbox.collection('meta');
  const controlRef = meta.doc('purgeControl');
  const jobRef = meta.doc('catalogRetirementJob');

  function input(reference, afterSnapshot = '') {
    assertMail(/^[A-Za-z0-9._-]{1,80}$/.test(reference || '') && (!afterSnapshot || ID.test(afterSnapshot)), 'MAIL_CATALOG_RETIRE_INPUT_INVALID');
  }
  function state(documents) {
    const values = Object.fromEntries(documents.map((item) => [item.id, item.data()]));
    assertMail(!Object.keys(values).some((id) => id.endsWith('Job') && id !== 'catalogRetirementJob'), 'MAIL_MAINTENANCE', 503);
    const active = values.activeCatalog;
    const sync = values.sync;
    const lease = values.syncLease;
    assertMail(ID.test(active?.snapshotId || ''), 'MAIL_CATALOG_RETIRE_STATE_INVALID', 409);
    assertMail(!lease || typeof lease.expiresAt === 'string' && Number.isFinite(Date.parse(lease.expiresAt)) &&
      new Date(lease.expiresAt).toISOString() === lease.expiresAt && Date.parse(lease.expiresAt) <= now().getTime(), 'MAIL_CATALOG_RETIRE_BUSY', 409);
    assertMail(!sync || ['running', 'failed', 'complete'].includes(sync.state), 'MAIL_CATALOG_RETIRE_STATE_INVALID', 409);
    const pinned = sync && ['running', 'failed'].includes(sync.state) ? sync.catalogSnapshotId : null;
    assertMail(!pinned || ID.test(pinned), 'MAIL_CATALOG_RETIRE_STATE_INVALID', 409);
    assertMail(!sync || !['running', 'failed'].includes(sync.state) || pinned, 'MAIL_CATALOG_RETIRE_STATE_INVALID', 409);
    return { stateHash: hash({ active, sync: sync || null, lease: lease || null }),
      protectedIds: [...new Set([active.snapshotId, pinned].filter(Boolean))].sort() };
  }
  async function inspect(snapshotIds) {
    const targets = [];
    let bytes = 0;
    for (const id of snapshotIds) {
      const ref = catalogs.doc(id);
      const parent = await ref.get();
      const collections = await ref.listCollections();
      assertMail(collections.every((item) => item.id === 'pages'), 'MAIL_CATALOG_RETIRE_UNSUPPORTED_DATA', 409);
      const pages = (await ref.collection('pages').listDocuments()).sort((a, b) => a.path.localeCompare(b.path));
      assertMail(pages.length + targets.length + 1 <= MAX_DOCUMENTS, 'MAIL_CATALOG_RETIRE_LIMIT', 409);
      for (const page of pages) {
        assertMail((await page.listCollections()).length === 0, 'MAIL_CATALOG_RETIRE_UNSUPPORTED_DATA', 409);
        const value = await page.get();
        assertMail(value.exists, 'MAIL_CATALOG_RETIRE_UNSUPPORTED_DATA', 409);
        bytes += Buffer.byteLength(JSON.stringify(value.data()));
        assertMail(bytes <= 5 * 1024 * 1024, 'MAIL_CATALOG_RETIRE_LIMIT', 409);
        targets.push({ path: page.path, hash: hash(value.data()) });
      }
      bytes += Buffer.byteLength(JSON.stringify(data(parent)));
      assertMail(bytes <= 5 * 1024 * 1024, 'MAIL_CATALOG_RETIRE_LIMIT', 409);
      targets.push({ path: ref.path, hash: parent.exists ? hash(parent.data()) : null });
    }
    return targets;
  }
  async function scan(reference, afterSnapshot) {
    input(reference, afterSnapshot);
    const docs = await meta.get();
    const control = data(await controlRef.get());
    const generation = control?.generation ?? 0;
    assertMail(Number.isSafeInteger(generation) && generation >= 0 && !control?.active && !docs.docs.some((item) => item.id === 'catalogRetirementJob'), 'MAIL_MAINTENANCE', 503);
    const source = state(docs.docs);
    const refs = await catalogs.listDocuments();
    assertMail(refs.length <= 1000 && refs.every((item) => ID.test(item.id)), 'MAIL_CATALOG_RETIRE_LIMIT', 409);
    const eligible = refs.map((item) => item.id).filter((id) => id > afterSnapshot && !source.protectedIds.includes(id)).sort();
    const snapshotIds = eligible.slice(0, MAX_SNAPSHOTS);
    const plan = { version: 1, projectId, databaseId, generation, requestHash: suppressionKey('catalog-retirement-reference', reference),
      afterSnapshot, ...source, snapshotIds, targets: await inspect(snapshotIds),
      nextSnapshot: eligible.length > snapshotIds.length ? snapshotIds.at(-1) : null };
    assertMail(Buffer.byteLength(JSON.stringify(plan)) < 450000, 'MAIL_CATALOG_RETIRE_LIMIT', 409);
    return { ...plan, planHash: hash(plan) };
  }
  const publicPlan = (job, mode) => ({ mode, planHash: job.planHash, snapshotCount: job.snapshotIds.length,
    documentCount: job.targets.length, deletedCount: job.offset || 0, retainedSnapshotCount: job.protectedIds.length,
    nextSnapshot: job.nextSnapshot });
  function validate(job) {
    const { planHash, offset, stage, ...plan } = job || {};
    assertMail(plan.version === 1 && plan.projectId === projectId && plan.databaseId === databaseId && HASH.test(planHash || '') &&
      hash(plan) === planHash && Number.isSafeInteger(plan.generation) && plan.generation >= 0 && HASH.test(plan.requestHash || '') &&
      HASH.test(plan.stateHash || '') && Array.isArray(plan.snapshotIds) && plan.snapshotIds.length <= MAX_SNAPSHOTS &&
      Array.isArray(plan.protectedIds) && plan.protectedIds.every((id) => ID.test(id)) &&
      plan.snapshotIds.every((id) => ID.test(id) && !plan.protectedIds.includes(id)) && new Set(plan.snapshotIds).size === plan.snapshotIds.length &&
      Array.isArray(plan.targets) && plan.targets.length <= MAX_DOCUMENTS && new Set(plan.targets.map((item) => item.path)).size === plan.targets.length &&
      plan.targets.every((item) => (item.hash === null ? item.path.split('/').length === 4 : HASH.test(item.hash)) && plan.snapshotIds.some((id) =>
        item.path === `${ROOT}/catalogSnapshots/${id}` || item.path.startsWith(`${ROOT}/catalogSnapshots/${id}/pages/`) && item.path.split('/').length === 6)) &&
      Number.isSafeInteger(offset) && offset >= 0 && offset <= plan.targets.length && ['validating', 'deleting'].includes(stage), 'MAIL_CATALOG_RETIRE_JOB_INVALID', 409);
    return plan;
  }
  async function locked(transaction, reference, planHash, checkState = true) {
    const [controlDoc, jobDoc, docs] = await Promise.all([transaction.get(controlRef), transaction.get(jobRef), transaction.get(meta)]);
    const job = data(jobDoc);
    validate(job);
    const control = data(controlDoc);
    assertMail(job.requestHash === suppressionKey('catalog-retirement-reference', reference) && job.planHash === planHash &&
      control?.generation === job.generation + 1 && control.active?.kind === 'catalog-retirement' && control.active.planHash === planHash, 'MAIL_MAINTENANCE', 503);
    if (checkState) assertMail(state(docs.docs).stateHash === job.stateHash, 'MAIL_CATALOG_RETIRE_STATE_CHANGED', 409);
    return job;
  }
  async function plan(reference, afterSnapshot = '') {
    return publicPlan(await scan(reference, afterSnapshot), 'dry-run');
  }
  async function apply(reference, planHash, afterSnapshot = '') {
    input(reference, afterSnapshot);
    assertMail(HASH.test(planHash || ''), 'MAIL_CATALOG_RETIRE_PLAN_REQUIRED');
    if (!(await jobRef.get()).exists) {
      const source = await scan(reference, afterSnapshot);
      assertMail(source.planHash === planHash && source.targets.length > 0, 'MAIL_CATALOG_RETIRE_PLAN_CHANGED', 409);
      await db.runTransaction(async (transaction) => {
        const [controlDoc, existing, docs] = await Promise.all([transaction.get(controlRef), transaction.get(jobRef), transaction.get(meta)]);
        const control = data(controlDoc);
        assertMail(!existing.exists && !control?.active && (control?.generation ?? 0) === source.generation && state(docs.docs).stateHash === source.stateHash,
          'MAIL_CATALOG_RETIRE_PLAN_CHANGED', 409);
        transaction.set(controlRef, { generation: source.generation + 1, active: { kind: 'catalog-retirement', planHash } });
        transaction.set(jobRef, { ...source, offset: 0, stage: 'validating' });
      });
    }
    let job = await db.runTransaction((transaction) => locked(transaction, reference, planHash));
    if (job.stage === 'validating') {
      assertMail(hash(await inspect(job.snapshotIds)) === hash(job.targets), 'MAIL_CATALOG_RETIRE_PLAN_CHANGED', 409);
      await db.runTransaction(async (transaction) => {
        const current = await locked(transaction, reference, planHash);
        assertMail(current.offset === 0 && current.stage === 'validating', 'MAIL_CATALOG_RETIRE_STATE_CHANGED', 409);
        transaction.set(jobRef, { ...current, stage: 'deleting' });
      });
    }
    job = await db.runTransaction((transaction) => locked(transaction, reference, planHash));
    const group = job.targets.slice(job.offset, job.offset + 25);
    for (const item of group) {
      const children = await db.doc(item.path).listCollections();
      assertMail(children.every((child) => item.path.split('/').length === 4 && child.id === 'pages'), 'MAIL_CATALOG_RETIRE_UNSUPPORTED_DATA', 409);
    }
    return db.runTransaction(async (transaction) => {
      const current = await locked(transaction, reference, planHash);
      assertMail(current.stage === 'deleting' && current.offset === job.offset, 'MAIL_CATALOG_RETIRE_STATE_CHANGED', 409);
      const found = await Promise.all(group.map((item) => transaction.get(db.doc(item.path))));
      assertMail(found.every((item, index) => (item.exists ? hash(item.data()) : null) === group[index].hash), 'MAIL_CATALOG_RETIRE_PLAN_CHANGED', 409);
      for (const item of group.filter((target) => target.path.split('/').length === 4)) {
        const pages = await transaction.get(db.doc(item.path).collection('pages'));
        assertMail(pages.docs.every((page) => group.some((target) => target.path === page.ref.path)), 'MAIL_CATALOG_RETIRE_PLAN_CHANGED', 409);
      }
      group.forEach((item) => transaction.delete(db.doc(item.path)));
      const updated = { ...current, offset: current.offset + group.length };
      if (updated.offset === updated.targets.length) {
        transaction.set(controlRef, { generation: current.generation + 1 });
        transaction.delete(jobRef);
        return publicPlan(updated, 'complete');
      }
      transaction.set(jobRef, updated);
      return publicPlan(updated, 'deleting');
    });
  }
  async function status(reference, planHash) {
    input(reference);
    assertMail(HASH.test(planHash || ''), 'MAIL_CATALOG_RETIRE_PLAN_REQUIRED');
    if (!(await jobRef.get()).exists) return { mode: 'idle' };
    return db.runTransaction(async (transaction) => {
      const job = await locked(transaction, reference, planHash, false);
      return publicPlan(job, job.stage);
    });
  }
  async function cancel(reference, planHash) {
    input(reference);
    assertMail(HASH.test(planHash || ''), 'MAIL_CATALOG_RETIRE_PLAN_REQUIRED');
    return db.runTransaction(async (transaction) => {
      const job = await locked(transaction, reference, planHash, false);
      transaction.set(controlRef, { generation: job.generation + 1 });
      transaction.delete(jobRef);
      return { mode: 'cancelled', deletedCount: job.offset };
    });
  }
  return { plan, apply, status, cancel };
}
