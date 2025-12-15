const USER_STATUSES = Object.freeze({
  PRE_PERIOD: '会期前',
  IN_PERIOD: '会期中',
  DATA_PROCESSING: '会期終了（データ化中）',
  DATA_READY: '会期終了（データ化完了）',
  POST_PERIOD: '会期終了',
  DOWNLOAD_CLOSED: '会期終了（DL期限終了）',
  DELETED: '削除済み'
});

const INTERNAL_STATUS_MAP = new Map([
  ['草稿', USER_STATUSES.PRE_PERIOD],
  ['準備中', USER_STATUSES.PRE_PERIOD],
  ['実施中', USER_STATUSES.IN_PERIOD],
  ['公開中', USER_STATUSES.IN_PERIOD],
  ['データ精査中', USER_STATUSES.DATA_PROCESSING],
  ['データ精査完了', USER_STATUSES.DATA_READY],
  ['完了', USER_STATUSES.DATA_READY],
  ['データ化なし', USER_STATUSES.POST_PERIOD],
  ['終了', USER_STATUSES.POST_PERIOD],
  ['停止済み', USER_STATUSES.POST_PERIOD],
  ['アーカイブ', USER_STATUSES.DOWNLOAD_CLOSED],
  ['削除済み', USER_STATUSES.DELETED]
]);

const STATUS_METADATA = {
  [USER_STATUSES.PRE_PERIOD]: {
    sortOrder: 1,
    badgeClass: 'bg-yellow-100 text-yellow-800',
    description: 'アンケートに設定された会期開始日を迎えるまでの状態です。',
    canDownload: false
  },
  [USER_STATUSES.IN_PERIOD]: {
    sortOrder: 2,
    badgeClass: 'bg-green-100 text-green-800',
    description: '会期中です。回答受付や来場者対応がアクティブな状態です。',
    canDownload: false
  },
  [USER_STATUSES.DATA_PROCESSING]: {
    sortOrder: 4,
    badgeClass: 'bg-blue-100 text-blue-800',
    description: '会期終了後に名刺データ化処理が進行中です。完了判定を待機しています。',
    canDownload: false
  },
  [USER_STATUSES.DATA_READY]: {
    sortOrder: 5,
    badgeClass: 'bg-indigo-100 text-indigo-800',
    description: '名刺データ化が完了しました。ダウンロード期限内であれば取得できます。',
    canDownload: true
  },
  [USER_STATUSES.POST_PERIOD]: {
    sortOrder: 3,
    badgeClass: 'bg-slate-200 text-slate-700',
    description: 'データ化対象外、またはデータ化が不要なアンケートの会期終了後状態です。',
    canDownload: false
  },
  [USER_STATUSES.DOWNLOAD_CLOSED]: {
    sortOrder: 6,
    badgeClass: 'bg-rose-100 text-rose-700',
    description: 'ダウンロード期限を過ぎ、名刺データは取得できない状態です。',
    canDownload: false
  },
  [USER_STATUSES.DELETED]: {
    sortOrder: 99,
    badgeClass: 'bg-red-100 text-red-800',
    description: 'このアンケートは削除済みです。',
    canDownload: false
  }
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const cloned = new Date(date.getTime());
  cloned.setHours(0, 0, 0, 0);
  return cloned;
}

function parseISODate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return normalizeDate(parsed);
}

function coerceBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lowered = value.trim().toLowerCase();
    if (lowered === 'true') return true;
    if (lowered === 'false') return false;
  }
  return Boolean(value);
}

function safeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function computeDownloadDeadline(periodEndDate, explicitDeadline) {
  const explicitDate = parseISODate(explicitDeadline);
  if (explicitDate) {
    explicitDate.setHours(23, 59, 59, 999);
    return explicitDate;
  }

  if (!periodEndDate) return null;

  const deadline = new Date(periodEndDate.getTime());
  deadline.setDate(deadline.getDate() + 90);
  deadline.setHours(23, 59, 59, 999);
  return deadline;
}

function isDataConversionTarget(survey) {
  if (!survey) return false;
  if (INTERNAL_STATUS_MAP.get(survey.status) === USER_STATUSES.POST_PERIOD) {
    return false;
  }

  const enabled = coerceBoolean(survey.bizcardEnabled);
  if (!enabled) {
    return false;
  }

  const requested = safeNumber(survey.bizcardRequest);
  if (requested > 0) {
    return true;
  }

  // When request count is未取得でも、利用設定が true ならデータ化対象として扱う
  return enabled;
}

function hasDataConversionCompleted(survey, referenceDate) {
  if (!survey) return false;

  if (survey.status === 'データ精査完了' || survey.status === '完了' || survey.status === 'アーカイブ') {
    return true;
  }

  const completionFlag = typeof survey.dataCompletionFlag === 'boolean'
    ? survey.dataCompletionFlag
    : coerceBoolean(survey.dataCompletionFlag);
  if (completionFlag) {
    return true;
  }

  const requested = safeNumber(survey.bizcardRequest);
  const completed = safeNumber(survey.bizcardCompletionCount);
  if (requested > 0 && completed >= requested) {
    return true;
  }

  const completionDate = parseISODate(survey.dataCompletionDate);
  if (completionDate && referenceDate && referenceDate >= completionDate) {
    return true;
  }

  return false;
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function deriveSurveyStatus(survey, referenceDate = new Date()) {
  if (!survey) return USER_STATUSES.POST_PERIOD;

  const now = normalizeDate(referenceDate) || normalizeDate(new Date());
  const bypassDownloadDeadline = coerceBoolean(survey?.bypassDownloadDeadline);

  if (survey.status === '削除済み') {
    return USER_STATUSES.DELETED;
  }

  if (survey.status === 'アーカイブ') {
    return USER_STATUSES.DOWNLOAD_CLOSED;
  }

  const periodStart = parseISODate(survey.periodStart);
  const periodEnd = parseISODate(survey.periodEnd);

  if (periodStart && now && now < periodStart) {
    return USER_STATUSES.PRE_PERIOD;
  }

  if (periodStart && periodEnd && now && now >= periodStart && now <= periodEnd) {
    return USER_STATUSES.IN_PERIOD;
  }

  const fallbackStatus = INTERNAL_STATUS_MAP.get(survey.status);

  if (!periodEnd || !now) {
    return fallbackStatus || USER_STATUSES.POST_PERIOD;
  }

  if (now <= periodEnd) {
    // 会期終了日の23:59までは「会期中」と同等に扱う（既に上で評価済み）
    return fallbackStatus || USER_STATUSES.IN_PERIOD;
  }

  const downloadDeadline = computeDownloadDeadline(periodEnd, survey.downloadDeadline || survey.deadline);
  if (!bypassDownloadDeadline && downloadDeadline && now.getTime() > downloadDeadline.getTime()) {
    return USER_STATUSES.DOWNLOAD_CLOSED;
  }

  const requiresDataConversion = isDataConversionTarget(survey);
  if (!requiresDataConversion) {
    return USER_STATUSES.POST_PERIOD;
  }

  if (hasDataConversionCompleted(survey, now)) {
    return USER_STATUSES.DATA_READY;
  }

  return USER_STATUSES.DATA_PROCESSING;
}

export function deriveSurveyLifecycleMeta(survey, referenceDate = new Date()) {
  const now = normalizeDate(referenceDate) || normalizeDate(new Date());
  const periodStart = parseISODate(survey?.periodStart);
  const periodEnd = parseISODate(survey?.periodEnd);
  const downloadDeadlineDate = computeDownloadDeadline(periodEnd, survey?.downloadDeadline || survey?.deadline);
  const bypassDownloadDeadline = coerceBoolean(survey?.bypassDownloadDeadline);

  const status = deriveSurveyStatus(survey, now || undefined);
  const statusMeta = getStatusMetadata(status);
  const completionDate = parseISODate(survey?.dataCompletionDate);
  const dataConversionTarget = isDataConversionTarget(survey);
  const dataConversionCompleted = hasDataConversionCompleted(survey, now);

  return {
    status,
    statusMeta,
    periodStart,
    periodEnd,
    downloadDeadlineDate,
    downloadDeadlineLabel: formatDate(downloadDeadlineDate),
    completionDate,
    completionDateLabel: formatDate(completionDate),
    requiresDataConversion: dataConversionTarget,
    isDownloadable: Boolean(statusMeta.canDownload) && (
      bypassDownloadDeadline || !downloadDeadlineDate || !now || now.getTime() <= downloadDeadlineDate.getTime()
    ),
    dataConversionCompleted
  };
}

export function getStatusMetadata(status) {
  return STATUS_METADATA[status] || {
    sortOrder: 98,
    badgeClass: 'bg-gray-100 text-gray-800',
    description: 'ステータス情報を取得できませんでした。',
    canDownload: false
  };
}

export function getStatusSortOrder(status) {
  return getStatusMetadata(status).sortOrder;
}

export function getFilterableStatuses() {
  return [
    USER_STATUSES.PRE_PERIOD,
    USER_STATUSES.IN_PERIOD,
    USER_STATUSES.POST_PERIOD,
    USER_STATUSES.DATA_PROCESSING,
    USER_STATUSES.DATA_READY,
    USER_STATUSES.DOWNLOAD_CLOSED
  ];
}

export { USER_STATUSES };
