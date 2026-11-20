import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogRetention, normalizeCatalogCases, retentionExpiresAt } from '../caseRetention.mjs';
const A = '11111111-1111-4111-8111-111111111111';
test('retention uses a three-year UTC anniversary with a Feb 28 leap-day clamp', () => {
  assert.equal(retentionExpiresAt('2024-02-29T12:34:56.789Z'), '2027-02-28T12:34:56.789Z');
  assert.equal(retentionExpiresAt('2023-11-10T09:00:00.000Z'), '2026-11-10T09:00:00.000Z');
  const cases = [{ caseId: A, handledStatus: '対応済み', closedAt: '2023-11-10T09:00:00.000Z' }];
  assert.equal(catalogRetention({ cases }, new Date('2026-11-10T08:59:59.999Z')).expiredCaseIds.length, 0);
  assert.deepEqual(catalogRetention({ cases }, new Date('2026-11-10T09:00:00.000Z')).expiredCaseIds, [A]);
});
test('legacy ID-only, malformed dates, reopening residue and duplicate case metadata fail closed', () => {
  for (const cases of [[A], [{ caseId: A, handledStatus: '対応済み' }],
    [{ caseId: A, handledStatus: '対応済み', closedAt: '2024-02-30T00:00:00.000Z' }],
    [{ caseId: A, handledStatus: '未対応', closedAt: '2024-01-01T00:00:00.000Z' }]]) {
    assert.throws(() => normalizeCatalogCases(cases), { code: 'MAIL_CATALOG_INVALID' });
  }
  const item = { caseId: A, handledStatus: '対応済み', closedAt: null };
  assert.throws(() => normalizeCatalogCases([item, item]), { code: 'MAIL_CATALOG_INVALID' });
  assert.deepEqual(catalogRetention({ cases: [item] }, new Date()).unknownClosureCaseIds, [A]);
});

test('purge attestation suppresses already-purged cases without changing immutable metadata', () => {
  const cases = [{ caseId: A, handledStatus: '対応済み', closedAt: '2020-01-01T00:00:00.000Z' }];
  const result = catalogRetention({ cases, suppressedCaseIds: [A] }, new Date('2026-01-01T00:00:00.000Z'));
  assert.deepEqual(result.expiredCaseIds, []); assert.deepEqual(result.cases, cases);
  assert.throws(() => catalogRetention({ cases: [{ ...cases[0], closedAt: '2027-01-01T00:00:00.000Z' }] }, new Date('2026-01-01T00:00:00.000Z')), { code: 'MAIL_CATALOG_INVALID' });
});
