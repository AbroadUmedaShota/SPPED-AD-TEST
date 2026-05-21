function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }
  const normalized = typeof value === 'string' ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  const value = new Date(date.getTime());
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date) {
  const value = new Date(date.getTime());
  value.setHours(23, 59, 59, 999);
  return value;
}

function formatMonthDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatDateYmd(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getSurveyPeriodRange(survey, answers = []) {
  const surveyStart = parseDateValue(survey?.periodStart);
  const surveyEnd = parseDateValue(survey?.periodEnd);

  if (surveyStart && surveyEnd && surveyStart <= surveyEnd) {
    return {
      start: startOfDay(surveyStart),
      end: endOfDay(surveyEnd)
    };
  }

  const answerDates = (answers || [])
    .map(answer => parseDateValue(answer?.answeredAt))
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  if (answerDates.length === 0) {
    return null;
  }

  return {
    start: startOfDay(answerDates[0]),
    end: endOfDay(answerDates[answerDates.length - 1])
  };
}

export function buildDateFilterOptions(range) {
  const options = [];
  if (!range) {
    return [
      { value: 'all', label: '全期間' },
      { value: 'custom', label: 'カスタム範囲' }
    ];
  }

  options.push({
    value: 'all',
    label: `会期全体 (${formatMonthDay(range.start)} - ${formatMonthDay(range.end)})`
  });

  const cursor = new Date(range.start.getTime());
  let dayIndex = 1;
  while (cursor <= range.end) {
    options.push({
      value: formatDateYmd(cursor),
      label: `${dayIndex}日目 (${formatMonthDay(cursor)})`
    });
    cursor.setDate(cursor.getDate() + 1);
    dayIndex += 1;
  }

  options.push({ value: 'custom', label: 'カスタム範囲' });
  return options;
}

export function applyDateFilterOptions(selectEl, options) {
  if (!selectEl) return;
  selectEl.innerHTML = '';
  options.forEach(optionData => {
    const option = document.createElement('option');
    option.value = optionData.value;
    option.textContent = optionData.label;
    selectEl.appendChild(option);
  });
}

export function resolveDateRangeFromValue(value, range) {
  if (!range || value === 'custom') {
    return null;
  }
  if (value === 'all') {
    return [new Date(range.start.getTime()), new Date(range.end.getTime())];
  }
  const selected = parseDateValue(value);
  if (!selected) {
    return null;
  }
  return [startOfDay(selected), endOfDay(selected)];
}
