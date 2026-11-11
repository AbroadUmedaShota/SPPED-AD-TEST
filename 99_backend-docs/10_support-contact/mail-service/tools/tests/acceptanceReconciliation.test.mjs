import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { reconcileAcceptance } from '../acceptanceReconciliation.mjs';

const id = (value) => createHash('sha256').update(value).digest('hex');
const START = '2026-11-01T00:00:00.000Z';
const END = '2026-11-11T00:00:00.000Z';
function fixture() {
  const common = { schemaVersion: 1, runId: 'synthetic-1', hashKeyId: id('key'), startAt: START, cutoffAt: END,
    capturedAt: END, sourceComplete: true, errors: [] };
  const row = { caseHash: id('case'), handledStatus: '未対応', closedAt: null };
  const make = (source, rows) => ({ ...structuredClone(common), source,
    pages: [{ index: 0, requestTokenHash: null, nextTokenHash: null, rowCount: rows.length }], rows });
  const result = { sheet: make('sheet', [{ ...row, submittedAt: START }]), gmail: make('gmail', [{ messageHash: id('mail'), internalDate: START, draft: false }]),
    app: { ...make('app', [{ messageHash: id('mail'), internalDate: START, classification: 'matched', caseHash: id('case'),
      manualExclusion: false, unavailable: false, bodyVerified: true, attachmentCount: 0, attachments: [],
      firstReview: { actorHash: id('actor'), at: END } }]), catalog: [structuredClone(row)], syncComplete: true,
    residualCount: 0, noMailConfirmations: [] } };
  result.gmail.capturedAt = '2026-11-11T00:00:00.001Z';
  result.app.capturedAt = '2026-11-11T00:00:00.002Z';
  result.sheetAfter = structuredClone(result.sheet);
  result.sheetAfter.capturedAt = '2026-11-11T00:00:00.003Z';
  return result;
}
const run = (f) => reconcileAcceptance(f);

test('complete manifests reconcile at both inclusive period boundaries', () => {
  const f = fixture();
  f.gmail.rows.push({ messageHash: id('last'), internalDate: END, draft: false });
  f.app.rows.push({ ...structuredClone(f.app.rows[0]), messageHash: id('last'), internalDate: END });
  f.gmail.pages[0].rowCount++; f.app.pages[0].rowCount++;
  assert.equal(run(f).idReconciliationPass, true);
  assert.equal(run(f).technicalReady, true);
  assert.equal(run(f).businessAcceptance, 'unverified');
  assert.equal(run(f).counts.prePeriodMessageCount, 0);
});

for (const source of ['sheet', 'gmail', 'app']) test(`duplicate ${source} IDs fail before set comparison`, () => {
  const f = fixture(); f[source].rows.push(structuredClone(f[source].rows[0])); f[source].pages[0].rowCount++;
  assert.ok(run(f).failures.some((x) => x.code === 'DUPLICATE_ID' && x.source === source));
});

test('missing and extra IDs are detected in both directions without exposing IDs', () => {
  const f = fixture(); f.app.rows[0].messageHash = id('extra'); f.app.catalog[0].caseHash = id('extra-case');
  const result = run(f);
  for (const code of ['SHEET_CASE_MISSING', 'APP_CASE_EXTRA', 'GMAIL_MESSAGE_MISSING', 'APP_MESSAGE_EXTRA']) {
    assert.ok(result.failures.some((x) => x.code === code), code);
  }
  assert.ok(!JSON.stringify(result).includes(id('extra')));
});

test('incomplete, cyclic, skipped and mismatched page chains fail closed', () => {
  const mutations = [
    (m) => { m.sourceComplete = false; }, (m) => { m.errors = ['UPSTREAM_FAILED']; },
    (m) => { m.pages[0].nextTokenHash = id('not-finished'); },
    (m) => { m.pages[0].index = 1; }, (m) => { m.pages[0].rowCount = 0; },
    (m) => { m.pages.push({ index: 1, requestTokenHash: null, nextTokenHash: null, rowCount: 0 }); }
  ];
  for (const mutate of mutations) {
    const f = fixture(); mutate(f.gmail); const result = run(f);
    assert.equal(result.idReconciliationPass, false);
    assert.equal(result.technicalReady, false);
  }
});

test('source context mismatch and invalid dates fail closed', () => {
  for (const [key, value] of [['runId', 'other'], ['hashKeyId', id('other')], ['cutoffAt', START], ['capturedAt', 'bad']]) {
    const f = fixture(); f.gmail[key] = value; assert.equal(run(f).idReconciliationPass, false, key);
  }
});

test('drafts before the start and Gmail IDs after the cutoff do not require app records', () => {
  const f = fixture();
  f.gmail.rows.push({ messageHash: id('draft'), internalDate: START, draft: true },
    { messageHash: id('old-draft'), internalDate: '2026-10-31T23:59:59.999Z', draft: true },
    { messageHash: id('new'), internalDate: '2026-11-11T00:00:00.001Z', draft: false });
  f.gmail.pages[0].rowCount += 3;
  assert.equal(run(f).technicalReady, true);
  assert.equal(run(f).counts.prePeriodMessageCount, 0);
});

test('non-draft Gmail messages before the start remain counted residuals even with app exclusions', () => {
  const f = fixture();
  const old = { messageHash: id('old'), internalDate: '2026-10-31T23:59:59.999Z', draft: false };
  f.gmail.rows.push(old, { ...old, messageHash: id('older'), internalDate: '2026-10-01T00:00:00.000Z' });
  f.gmail.pages[0].rowCount += 2;
  f.app.rows.push({ ...structuredClone(f.app.rows[0]), messageHash: old.messageHash, internalDate: old.internalDate,
    classification: 'excluded', caseHash: null, manualExclusion: true });
  f.app.pages[0].rowCount++;
  const result = run(f);
  assert.equal(result.idReconciliationPass, true);
  assert.equal(result.technicalReady, false);
  assert.equal(result.businessAcceptance, 'unverified');
  assert.equal(result.counts.prePeriodMessageCount, 2);
  assert.deepEqual(result.failures, [{ code: 'GMAIL_PREPERIOD_UNREVIEWED', source: 'gmail', count: 2, category: 'content' }]);
  assert.ok(!JSON.stringify(result).includes(old.messageHash));

  for (const source of Object.values(f)) source.startAt = '2026-10-01T00:00:00.000Z';
  f.app.rows.push({ ...structuredClone(f.app.rows.at(-1)), messageHash: id('older'), internalDate: f.gmail.rows.at(-1).internalDate });
  f.app.pages[0].rowCount++;
  assert.equal(run(f).technicalReady, true);
  assert.equal(run(f).counts.prePeriodMessageCount, 0);
});

test('duplicate or malformed pre-period Gmail rows and incomplete sources cannot establish readiness', () => {
  const old = { messageHash: id('old'), internalDate: '2026-10-31T23:59:59.999Z', draft: false };
  const duplicate = fixture(); duplicate.gmail.rows.push(old, structuredClone(old)); duplicate.gmail.pages[0].rowCount += 2;
  const result = run(duplicate);
  assert.equal(result.counts.prePeriodMessageCount, 1);
  assert.equal(result.technicalReady, false);
  assert.ok(result.failures.some((x) => x.code === 'DUPLICATE_ID'));
  for (const mutate of [
    (f) => { f.gmail.rows.push({ ...old, unexpected: true }); f.gmail.pages[0].rowCount++; },
    (f) => { f.gmail.sourceComplete = false; },
    (f) => { f.gmail.pages[0].nextTokenHash = id('unfinished'); }
  ]) {
    const f = fixture(); mutate(f); assert.equal(run(f).technicalReady, false);
  }
});

test('pending, unavailable, unreviewed and unverified content remain residuals', () => {
  const mutations = [
    (m) => { m.classification = 'pending'; m.caseHash = null; },
    (m) => { m.unavailable = true; }, (m) => { m.firstReview = null; },
    (m) => { m.bodyVerified = false; }, (m) => { m.caseHash = id('unknown'); }
  ];
  for (const mutate of mutations) { const f = fixture(); mutate(f.app.rows[0]); assert.equal(run(f).technicalReady, false); }
});

test('only explicit manual exclusions pass and cases without related mail require evidence', () => {
  const f = fixture(); Object.assign(f.app.rows[0], { classification: 'excluded', caseHash: null, manualExclusion: true,
    bodyVerified: false, firstReview: null });
  let result = run(f); assert.equal(result.idReconciliationPass, true); assert.equal(result.technicalReady, false);
  f.app.noMailConfirmations = [{ caseHash: id('case'), evidenceHash: id('private-evidence') }];
  assert.equal(run(f).technicalReady, true);
  f.app.rows[0].manualExclusion = false;
  assert.equal(run(f).technicalReady, false);
});

test('attachment verification requires every transfer chunk including zero-byte attachment', () => {
  const f = fixture(); const m = f.app.rows[0]; m.attachmentCount = 1;
  m.attachments = [{ availability: 'verified', transferVersion: 1, transferSize: 524289, servedChunks: [0] }];
  assert.equal(run(f).technicalReady, false);
  m.attachments[0].servedChunks.push(524288); assert.equal(run(f).technicalReady, true);
  Object.assign(m.attachments[0], { transferSize: 0, servedChunks: [] }); assert.equal(run(f).technicalReady, false);
  m.attachments[0].servedChunks = [0]; assert.equal(run(f).technicalReady, true);
});

test('unknown fields and suppression-only records cannot be accepted', () => {
  const f = fixture(); f.app.rows[0].subject = 'must not be retained';
  assert.equal(run(f).idReconciliationPass, false);
  delete f.app.rows[0].subject; f.app.rows[0].classification = 'suppressed';
  assert.equal(run(f).technicalReady, false);
});

test('Sheet receipt dates must fit the declared complete period and malformed collections fail closed', () => {
  for (const submittedAt of [undefined, 'invalid', '2026-10-31T23:59:59.999Z', '2026-11-11T00:00:00.001Z']) {
    const f = fixture(); f.sheet.rows[0].submittedAt = submittedAt; assert.equal(run(f).idReconciliationPass, false);
  }
  for (const source of ['sheet', 'gmail', 'app']) for (const key of ['rows', 'pages']) {
    const f = fixture(); f[source][key] = {}; assert.equal(run(f).technicalReady, false);
  }
});

test('final Sheet observation is mandatory, detects drift and brackets Gmail/App captures', () => {
  const f = fixture(); delete f.sheetAfter; assert.equal(run(f).technicalReady, false);
  const changed = fixture(); changed.sheetAfter.rows[0].handledStatus = '保留';
  assert.ok(run(changed).failures.some((x) => x.code === 'SHEET_CHANGED'));
  const order = fixture(); order.gmail.capturedAt = '2026-11-11T01:00:00.000Z';
  assert.ok(run(order).failures.some((x) => x.code === 'OBSERVATION_ORDER_INVALID'));
  const copied = fixture(); copied.sheetAfter.capturedAt = copied.sheet.capturedAt;
  assert.ok(run(copied).failures.some((x) => x.code === 'OBSERVATION_ORDER_INVALID'));
  const empty = fixture(); empty.sheet.rows = []; empty.sheet.pages[0].rowCount = 0;
  empty.sheetAfter.rows = []; empty.sheetAfter.pages[0].rowCount = 0;
  assert.ok(run(empty).failures.some((x) => x.code === 'SHEET_EMPTY'));
});
