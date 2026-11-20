import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { assertMail } from '../runtime/errors.mjs';
import { suppressionKey } from '../runtime/purgeGate.mjs';

const ROOT = 'contactMailboxes/customer-speed-ad';
const HASH = /^[a-f0-9]{64}$/;
const canonical = (value) => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
const hash = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const data = (snapshot) => snapshot.exists ? snapshot.data() : null;
const iso = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;

export function createRequestMarkerCleanup({ db, projectId, databaseId = '(default)', now = () => new Date() }) {
  assertMail(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(projectId || '') && databaseId === '(default)', 'MAIL_MARKER_TARGET_INVALID');
  const mailbox = db.doc(ROOT);
  const markers = mailbox.collection('suppressedRequests');
  const meta = mailbox.collection('meta');
  const controlRef = meta.doc('purgeControl');
  const syncRef = meta.doc('sync');
  const leaseRef = meta.doc('syncLease');
  const purgeJobRef = meta.doc('purgeJob');
  const markerJobRef = meta.doc('markerCleanupJob');

  function available(control, sync, lease) {
    const generation = control?.generation ?? 0;
    assertMail(Number.isSafeInteger(generation) && generation >= 0 && generation < Number.MAX_SAFE_INTEGER && !control?.active, 'MAIL_MAINTENANCE', 503);
    assertMail(sync?.state !== 'running' && (!lease || iso(lease.expiresAt) && Date.parse(lease.expiresAt) <= now().getTime()), 'MAIL_PURGE_BUSY', 409);
    return generation;
  }
  async function scan(reference, afterMarker = '') {
    assertMail(/^[A-Za-z0-9._-]{1,80}$/.test(reference || '') && (!afterMarker || HASH.test(afterMarker)), 'MAIL_MARKER_INPUT_INVALID');
    const [control, sync, lease, purgeJob, markerJob] = await Promise.all([controlRef.get(), syncRef.get(), leaseRef.get(), purgeJobRef.get(), markerJobRef.get()]);
    const generation = available(data(control), data(sync), data(lease));
    assertMail(!purgeJob.exists && !markerJob.exists, 'MAIL_MAINTENANCE', 503);
    let query = markers.orderBy('__name__');
    if (afterMarker) query = query.startAfter(afterMarker);
    const found = (await query.limit(251).get()).docs;
    const page = found.slice(0, 250);
    for (const item of page) {
      const value = item.data();
      assertMail(HASH.test(item.id) && item.ref.path === `${ROOT}/suppressedRequests/${item.id}` &&
        (value?.version === 1 && Object.keys(value).length === 1 || value?.version === 2 &&
          Object.keys(value).sort().join(',') === 'expiresAt,version' && iso(value.expiresAt)) &&
        (await item.ref.listCollections()).length === 0, 'MAIL_MARKER_JOB_INVALID', 409);
    }
    const candidates = page.filter((item) => item.data().version === 2 && Date.parse(item.data().expiresAt) <= now().getTime())
      .map((item) => ({ id: item.id, hash: hash(item.data()) }));
    const source = { version: 1, projectId, databaseId, generation, requestHash: suppressionKey('request-marker-reference', reference),
      afterMarker, scanned: page.map((item) => [item.id, hash(item.data())]), candidates,
      legacyCount: page.filter((item) => item.data().version === 1).length,
      nextMarker: found.length > page.length ? page.at(-1).id : null };
    return { ...source, planHash: hash(source) };
  }
  const publicPlan = (plan, mode) => ({ mode, planHash: plan.planHash, scannedCount: plan.scanned.length,
    candidateCount: plan.candidates.length, legacyCount: plan.legacyCount, nextMarker: plan.nextMarker });
  return {
    async plan(reference, afterMarker) { return publicPlan(await scan(reference, afterMarker), 'dry-run'); },
    async apply(reference, planHash, afterMarker) {
      assertMail(HASH.test(planHash || ''), 'MAIL_PURGE_PLAN_REQUIRED');
      const plan = await scan(reference, afterMarker);
      assertMail(plan.planHash === planHash, 'MAIL_PURGE_PLAN_CHANGED', 409);
      await db.runTransaction(async (transaction) => {
        const [control, sync, lease, purgeJob, markerJob, ...found] = await Promise.all([transaction.get(controlRef), transaction.get(syncRef), transaction.get(leaseRef), transaction.get(purgeJobRef), transaction.get(markerJobRef),
          ...plan.candidates.map((item) => transaction.get(markers.doc(item.id)))]);
        assertMail(available(data(control), data(sync), data(lease)) === plan.generation, 'MAIL_PURGE_PLAN_CHANGED', 409);
        assertMail(!purgeJob.exists && !markerJob.exists, 'MAIL_MAINTENANCE', 503);
        assertMail(found.every((item, index) => item.exists && hash(item.data()) === plan.candidates[index].hash &&
          item.data().version === 2 && iso(item.data().expiresAt) && Date.parse(item.data().expiresAt) <= now().getTime()), 'MAIL_PURGE_PLAN_CHANGED', 409);
        for (const item of found) transaction.delete(item.ref);
        if (found.length) transaction.set(controlRef, { generation: plan.generation + 1 });
      });
      return publicPlan(plan, 'applied');
    }
  };
}

export function parseRequestMarkerArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const key = args[index];
    assertMail(['--project', '--confirm-project', '--database', '--request-reference', '--operation', '--plan-hash', '--after-marker'].includes(key) &&
      options[key] === undefined && args[index + 1] && !args[index + 1].startsWith('--'), 'MAIL_MARKER_INPUT_INVALID');
    options[key] = args[++index];
  }
  assertMail(/^[a-z][a-z0-9-]{4,61}[a-z0-9]$/.test(options['--project'] || '') && options['--project'] === options['--confirm-project'] &&
    options['--database'] === '(default)' && /^[A-Za-z0-9._-]{1,80}$/.test(options['--request-reference'] || '') &&
    (!options['--after-marker'] || HASH.test(options['--after-marker'])) && ['plan', 'apply'].includes(options['--operation']) &&
    (options['--operation'] === 'apply' ? HASH.test(options['--plan-hash'] || '') : options['--plan-hash'] === undefined), 'MAIL_MARKER_INPUT_INVALID');
  return options;
}

export async function runRequestMarkerCli(args, { createDatabase, write = (value) => process.stdout.write(`${JSON.stringify(value)}\n`) } = {}) {
  const options = parseRequestMarkerArguments(args);
  const cleanup = createRequestMarkerCleanup({ db: await createDatabase(options['--project'], options['--database']),
    projectId: options['--project'], databaseId: options['--database'] });
  const result = options['--operation'] === 'plan' ? await cleanup.plan(options['--request-reference'], options['--after-marker']) :
    await cleanup.apply(options['--request-reference'], options['--plan-hash'], options['--after-marker']);
  write(result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRequestMarkerCli(process.argv.slice(2), {
    createDatabase: async (projectId, databaseId) => {
      const { Firestore } = await import('@google-cloud/firestore');
      return new Firestore({ projectId, databaseId, ignoreUndefinedProperties: true });
    }
  }).catch((error) => {
    process.stderr.write(`${/^MAIL_[A-Z_]+$/.test(error?.code || '') ? error.code : 'MAIL_MARKER_FAILED'}\n`);
    process.exitCode = 1;
  });
}
