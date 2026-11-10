import { assertMail } from './errors.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const STATUSES = ['未対応', '対応中', '対応済み', '保留'];

export function normalizeCatalogCases(cases) {
  assertMail(Array.isArray(cases), 'MAIL_CATALOG_INVALID', 409);
  const normalized = cases.map((item) => {
    assertMail(item && typeof item === 'object' && !Array.isArray(item) &&
      Object.keys(item).sort().join(',') === 'caseId,closedAt,handledStatus' && UUID.test(item.caseId || '') &&
      STATUSES.includes(item.handledStatus), 'MAIL_CATALOG_INVALID', 409);
    assertMail(item.closedAt === null || (typeof item.closedAt === 'string' && Number.isFinite(Date.parse(item.closedAt)) &&
      new Date(item.closedAt).toISOString() === item.closedAt && item.handledStatus === '対応済み'), 'MAIL_CATALOG_INVALID', 409);
    return { caseId: item.caseId, handledStatus: item.handledStatus, closedAt: item.closedAt };
  });
  assertMail(new Set(normalized.map((item) => item.caseId)).size === normalized.length, 'MAIL_CATALOG_INVALID', 409);
  return normalized.sort((a, b) => a.caseId.localeCompare(b.caseId));
}

// The UTC calendar anniversary retains the time; a leap-day anniversary uses Feb 28.
export function retentionExpiresAt(closedAt) {
  const date = new Date(closedAt);
  const month = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() + 3);
  if (date.getUTCMonth() !== month) date.setUTCDate(0);
  return date.toISOString();
}

export function catalogRetention(catalog, now) {
  const cases = normalizeCatalogCases(catalog.cases);
  assertMail(cases.every((item) => !item.closedAt || Date.parse(item.closedAt) <= now.getTime()), 'MAIL_CATALOG_INVALID', 409);
  const suppressed = new Set(catalog.suppressedCaseIds || []);
  const retained = cases.filter((item) => !suppressed.has(item.caseId));
  const unknownClosureCaseIds = retained.filter((item) => item.handledStatus === '対応済み' && item.closedAt === null).map((item) => item.caseId);
  const expiredCaseIds = retained.filter((item) => item.closedAt && Date.parse(retentionExpiresAt(item.closedAt)) <= now.getTime()).map((item) => item.caseId);
  return { cases, unknownClosureCaseIds, expiredCaseIds };
}
