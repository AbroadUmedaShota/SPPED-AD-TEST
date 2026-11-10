import { createHash } from 'node:crypto';
import { assertMail } from '../runtime/errors.mjs';
import { suppressionKey } from '../runtime/purgeGate.mjs';
import { normalizeCatalogCases } from '../runtime/caseRetention.mjs';
import { catalogDigest } from '../runtime/service.mjs';

const ROOT = 'contactMailboxes/customer-speed-ad';
const ID = /^[A-Za-z0-9_-]{1,200}$/;
const HASH = /^[a-f0-9]{64}$/;
const MAX_SNAPSHOTS = 1;
const MAX_DOCUMENTS = 1000;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const hash = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const data = (snapshot) => snapshot.exists ? snapshot.data() : null;

export function createCatalogDocumentPager({ client, projectId, databaseId = '(default)' }) {
  const parent = `projects/${projectId}/databases/${databaseId}/documents/${ROOT}`;
  return async (pageToken = '', snapshotId = null) => {
    assertMail(typeof pageToken === 'string' && pageToken.length <= 8192 && (snapshotId === null || ID.test(snapshotId)), 'MAIL_CATALOG_RETIRE_DISCOVERY_INVALID', 409);
    const documentParent = snapshotId === null ? parent : `${parent}/catalogSnapshots/${snapshotId}`;
    const collectionId = snapshotId === null ? 'catalogSnapshots' : 'pages';
    const pageSize = snapshotId === null ? MAX_SNAPSHOTS : 25;
    const [documents, , response] = await client.listDocuments({ parent: documentParent, collectionId,
      pageSize, pageToken, showMissing: true, mask: { fieldPaths: ['complete'] } }, { autoPaginate: false });
    assertMail(response && (response.nextPageToken === undefined || typeof response.nextPageToken === 'string' && response.nextPageToken.length <= 8192) &&
      Array.isArray(documents) && documents.length <= pageSize && documents.every((item) =>
      typeof item.name === 'string' && item.name.startsWith(`${documentParent}/${collectionId}/`) &&
      ID.test(item.name.slice(`${documentParent}/${collectionId}/`.length))), 'MAIL_CATALOG_RETIRE_DISCOVERY_INVALID', 409);
    return { ids: documents.map((item) => item.name.split('/').at(-1)), nextPageToken: response?.nextPageToken || null };
  };
}

export function createCatalogRetirement({ db, listCatalogPage, projectId, databaseId = '(default)', now = () => new Date() }) {
  assertMail(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId || '') && databaseId === '(default)', 'MAIL_CATALOG_RETIRE_TARGET_INVALID');
  assertMail(typeof listCatalogPage === 'function', 'MAIL_CATALOG_RETIRE_TARGET_INVALID');
  const mailbox = db.doc(ROOT);
  const catalogs = mailbox.collection('catalogSnapshots');
  const meta = mailbox.collection('meta');
  const controlRef = meta.doc('purgeControl');
  const jobRef = meta.doc('catalogRetirementJob');

  function input(reference, pageToken = '') {
    assertMail(/^[A-Za-z0-9._-]{1,80}$/.test(reference || '') && typeof pageToken === 'string' && pageToken.length <= 8192, 'MAIL_CATALOG_RETIRE_INPUT_INVALID');
  }
  async function state(documents, transaction) {
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
    const protectedIds = [...new Set([active.snapshotId, pinned].filter(Boolean))].sort();
    const protectedCatalogs = [];
    for (const id of protectedIds) {
      const ref = catalogs.doc(id);
      const pageQuery = ref.collection('pages').limit(501);
      const [parentDoc, pageDocs] = await Promise.all(transaction ? [transaction.get(ref), transaction.get(pageQuery)] : [ref.get(), pageQuery.get()]);
      const parent = data(parentDoc);
      assertMail(parent?.complete === true && Number.isInteger(parent.pageCount) && parent.pageCount >= 1 && parent.pageCount <= 500 &&
        Number.isInteger(parent.total) && parent.total >= 0 && parent.total <= 100000 && HASH.test(parent.digest || '') &&
        pageDocs.docs.length === parent.pageCount, 'MAIL_CATALOG_RETIRE_PROTECTED_INVALID', 409);
      const pages = [...pageDocs.docs].sort((a, b) => a.id.localeCompare(b.id));
      assertMail(pages.every((page, index) => page.id === String(index).padStart(4, '0') && page.data().pageIndex === index &&
        Array.isArray(page.data().cases) && page.data().cases.length <= 200), 'MAIL_CATALOG_RETIRE_PROTECTED_INVALID', 409);
      const cases = normalizeCatalogCases(pages.flatMap((page) => page.data().cases));
      assertMail(cases.length === parent.total && catalogDigest(cases) === parent.digest &&
        (id !== active.snapshotId || active.total === parent.total && active.digest === parent.digest), 'MAIL_CATALOG_RETIRE_PROTECTED_INVALID', 409);
      protectedCatalogs.push([id, parent.digest, parent.total, parent.pageCount]);
    }
    return { stateHash: hash({ active, sync: sync || null, lease: lease || null, protectedCatalogs }), protectedIds };
  }
  async function inspect(snapshotIds) {
    const targets = [];
    for (const id of snapshotIds) {
      const ref = catalogs.doc(id);
      const parent = await ref.get();
      const collections = await ref.listCollections();
      assertMail(collections.every((item) => item.id === 'pages'), 'MAIL_CATALOG_RETIRE_UNSUPPORTED_DATA', 409);
      let token = '';
      const seen = new Set();
      const tokens = new Set(['']);
      do {
        const page = await listCatalogPage(token, id);
        assertMail(page && Array.isArray(page.ids) && page.ids.length <= 25 && page.ids.every((value) => ID.test(value) && !seen.has(value)) &&
          new Set(page.ids).size === page.ids.length && (page.nextPageToken === null || page.ids.length > 0 && typeof page.nextPageToken === 'string' &&
            page.nextPageToken.length > 0 && page.nextPageToken.length <= 8192 && !tokens.has(page.nextPageToken)),
        'MAIL_CATALOG_RETIRE_DISCOVERY_INVALID', 409);
        assertMail(page.ids.length + targets.length + 1 <= MAX_DOCUMENTS, 'MAIL_CATALOG_RETIRE_LIMIT', 409);
        for (const pageId of page.ids) {
          seen.add(pageId);
          const pageRef = ref.collection('pages').doc(pageId);
          assertMail((await pageRef.listCollections()).length === 0, 'MAIL_CATALOG_RETIRE_UNSUPPORTED_DATA', 409);
          const value = await pageRef.get();
          assertMail(value.exists, 'MAIL_CATALOG_RETIRE_UNSUPPORTED_DATA', 409);
          targets.push({ path: pageRef.path, hash: hash(value.data()) });
        }
        token = page.nextPageToken;
        tokens.add(token);
      } while (token !== null);
      targets.push({ path: ref.path, hash: parent.exists ? hash(parent.data()) : null });
    }
    return targets;
  }
  async function scan(reference, pageToken) {
    input(reference, pageToken);
    const docs = await meta.get();
    const control = data(await controlRef.get());
    const generation = control?.generation ?? 0;
    assertMail(Number.isSafeInteger(generation) && generation >= 0 && !control?.active && !docs.docs.some((item) => item.id === 'catalogRetirementJob'), 'MAIL_MAINTENANCE', 503);
    const source = await state(docs.docs);
    const page = await listCatalogPage(pageToken);
    assertMail(page && Array.isArray(page.ids) && page.ids.length <= MAX_SNAPSHOTS &&
      page.ids.every((id) => ID.test(id)) && new Set(page.ids).size === page.ids.length &&
      (page.nextPageToken === null || page.ids.length > 0 && typeof page.nextPageToken === 'string' && page.nextPageToken.length > 0 && page.nextPageToken.length <= 8192 && page.nextPageToken !== pageToken),
    'MAIL_CATALOG_RETIRE_DISCOVERY_INVALID', 409);
    const snapshotIds = page.ids.filter((id) => !source.protectedIds.includes(id)).sort();
    const plan = { version: 1, projectId, databaseId, generation, requestHash: suppressionKey('catalog-retirement-reference', reference),
      pageToken, ...source, snapshotIds, targets: await inspect(snapshotIds), nextPageToken: page.nextPageToken };
    assertMail(Buffer.byteLength(JSON.stringify(plan)) < 450000, 'MAIL_CATALOG_RETIRE_LIMIT', 409);
    return { ...plan, planHash: hash(plan) };
  }
  const publicPlan = (job, mode) => ({ mode, planHash: job.planHash, snapshotCount: job.snapshotIds.length,
    documentCount: job.targets.length, deletedCount: job.offset || 0, retainedSnapshotCount: job.protectedIds.length,
    pageToken: job.pageToken, nextPageToken: job.nextPageToken });
  function validate(job) {
    const { planHash, offset, stage, ...plan } = job || {};
    assertMail(plan.version === 1 && plan.projectId === projectId && plan.databaseId === databaseId && HASH.test(planHash || '') &&
      hash(plan) === planHash && Number.isSafeInteger(plan.generation) && plan.generation >= 0 && HASH.test(plan.requestHash || '') &&
      HASH.test(plan.stateHash || '') && Array.isArray(plan.snapshotIds) && plan.snapshotIds.length <= MAX_SNAPSHOTS &&
      typeof plan.pageToken === 'string' && plan.pageToken.length <= 8192 &&
      (plan.nextPageToken === null || typeof plan.nextPageToken === 'string' && plan.nextPageToken.length > 0 && plan.nextPageToken.length <= 8192) &&
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
    if (checkState) assertMail((await state(docs.docs, transaction)).stateHash === job.stateHash, 'MAIL_CATALOG_RETIRE_STATE_CHANGED', 409);
    return job;
  }
  async function plan(reference, pageToken = '') {
    return publicPlan(await scan(reference, pageToken), 'dry-run');
  }
  async function apply(reference, planHash, pageToken = '') {
    input(reference, pageToken);
    assertMail(HASH.test(planHash || ''), 'MAIL_CATALOG_RETIRE_PLAN_REQUIRED');
    if (!(await jobRef.get()).exists) {
      const source = await scan(reference, pageToken);
      assertMail(source.planHash === planHash, 'MAIL_CATALOG_RETIRE_PLAN_CHANGED', 409);
      if (source.targets.length === 0) return publicPlan(source, 'complete');
      await db.runTransaction(async (transaction) => {
        const [controlDoc, existing, docs] = await Promise.all([transaction.get(controlRef), transaction.get(jobRef), transaction.get(meta)]);
        const control = data(controlDoc);
        assertMail(!existing.exists && !control?.active && (control?.generation ?? 0) === source.generation && (await state(docs.docs, transaction)).stateHash === source.stateHash,
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
    const group = job.targets.slice(job.offset, job.offset + 5);
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
      try {
        const current = await state((await transaction.get(meta)).docs, transaction);
        const touched = new Set(job.targets.slice(0, job.offset).map((item) => item.path.split('/')[3]));
        const unsafe = current.protectedIds.some((id) => touched.has(id));
        return { ...publicPlan(job, job.stage), sourceState: unsafe ? 'unsafe' : current.stateHash === job.stateHash ? 'valid' : 'changed' };
      } catch {
        return { ...publicPlan(job, job.stage), sourceState: 'unsafe' };
      }
    });
  }
  async function cancel(reference, planHash) {
    input(reference);
    assertMail(HASH.test(planHash || ''), 'MAIL_CATALOG_RETIRE_PLAN_REQUIRED');
    return db.runTransaction(async (transaction) => {
      const job = await locked(transaction, reference, planHash, false);
      const current = await state((await transaction.get(meta)).docs, transaction);
      const touched = new Set(job.targets.slice(0, job.offset).map((item) => item.path.split('/')[3]));
      assertMail(!current.protectedIds.some((id) => touched.has(id)), 'MAIL_CATALOG_RETIRE_UNSAFE_SOURCE', 409);
      transaction.set(controlRef, { generation: job.generation + 1 });
      transaction.delete(jobRef);
      return { mode: 'cancelled', deletedCount: job.offset };
    });
  }
  return { plan, apply, status, cancel };
}
