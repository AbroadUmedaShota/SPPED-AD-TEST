const DEFAULT_NEW_SURVEY_TEMPLATE_PATH = 'surveys/templates/default-new-survey.json';
const GLOBAL_SAMPLE_VISIBILITY = 'all_accounts';

function startOfDay(date) {
  const normalized = date instanceof Date ? new Date(date) : new Date();
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function addDays(baseDate, days) {
  const date = startOfDay(baseDate);
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

export function formatDateYmd(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return '';
  const year = safeDate.getFullYear();
  const month = String(safeDate.getMonth() + 1).padStart(2, '0');
  const day = String(safeDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateCompact(date) {
  return formatDateYmd(date).replaceAll('-', '');
}

export function resolveDefaultSurveyPeriod(template, referenceDate = new Date()) {
  const offsets = template?.periodOffsetDays || {};
  const startOffset = Number.isFinite(Number(offsets.start)) ? Number(offsets.start) : 1;
  const endOffset = Number.isFinite(Number(offsets.end)) ? Number(offsets.end) : 7;
  return {
    startDate: addDays(referenceDate, startOffset),
    endDate: addDays(referenceDate, endOffset),
    start: formatDateYmd(addDays(referenceDate, startOffset)),
    end: formatDateYmd(addDays(referenceDate, endOffset))
  };
}

export function buildDefaultSurveyName(template, referenceDate = new Date()) {
  const prefix = template?.namePrefix || '展示会サンプルアンケート';
  return `${prefix}_${formatDateCompact(referenceDate)}`;
}

export async function fetchDefaultNewSurveyTemplate(resolveDataPath) {
  const path = typeof resolveDataPath === 'function'
    ? resolveDataPath(DEFAULT_NEW_SURVEY_TEMPLATE_PATH)
    : DEFAULT_NEW_SURVEY_TEMPLATE_PATH;
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load default survey template: ${response.status}`);
  }
  return response.json();
}

export function getLocalizedValue(value, lang = 'ja') {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.ja || '';
}

export function isGlobalSampleSurvey(survey) {
  return Boolean(survey?.isSample && survey?.sampleVisibility === GLOBAL_SAMPLE_VISIBILITY);
}

export function isReadOnlySurvey(survey) {
  return Boolean(survey?.readOnly || isGlobalSampleSurvey(survey));
}
