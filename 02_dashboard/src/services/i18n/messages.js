const LOCALE_ALIASES = {
  ja: ['ja'],
  en: ['en'],
  'zh-CN': ['zh-CN', 'zh-Hans'],
  'zh-TW': ['zh-TW', 'zh-Hant'],
  vi: ['vi']
};

const LOCALE_CANONICAL_MAP = Object.entries(LOCALE_ALIASES).reduce((acc, [canonical, aliases]) => {
  aliases.forEach((alias) => {
    acc[alias] = canonical;
  });
  return acc;
}, {});

export const LANGUAGE_LABELS = {
  ja: '日本語',
  en: 'English',
  'zh-CN': '中文(简体)',
  'zh-TW': '中文(繁體)',
  vi: 'Tiếng Việt'
};

export const messages = {
  ja: {
    common: {
      required: '必須項目を入力してください。',
      noQuestions: 'このアンケートには表示できる設問がありません。'
    },
    validation: {
      minLength: 'あと{count}文字必要です。',
      maxLength: '{count}文字超過しています。'
    },
    surveyAnswer: {
      pageTitleFallback: 'アンケート回答',
      titleFallback: 'アンケート',
      languageLabel: 'Language',
      switchedLocale: '{locale}に切り替えました',
      submitFailed: '回答の送信に失敗しました。',
      loadingFailed: 'アンケートの読み込みに失敗しました。',
      missingSurveyId: 'URLに surveyId が指定されていません。',
      surveyNotFound: 'アンケート定義ファイルが見つかりません (ID: {surveyId})',
      requiredBadge: '必須',
      submitButton: '送信する',
      bizcardCameraButton: '名刺を撮影',
      bizcardManualButton: '名刺が手元に無い方',
      submitting: '送信中...'
    },
    thankYouScreen: {
      documentTitle: 'SpeedAd - アンケート回答完了',
      title: 'アンケートにご協力いただきありがとうございました！',
      body: 'お客様のご意見は今後のサービス改善に役立てさせていただきます。',
      continuousAnswerButton: '続けて回答する'
    },
    thankYouSettings: {
      pageTitleFallback: 'サンクス画面設定',
      pageTitle: 'アンケート「{name}」のサンクス画面設定',
      sectionTitle: '回答後の文言設定',
      fieldLabel: 'サンクスメッセージ',
      fieldDescription: 'アンケート回答後に表示されるメッセージです。空欄の場合、デフォルトのメッセージが表示されます。',
      counterError: 'サンクスメッセージは{count}文字以内で入力してください。',
      saved: '設定を保存しました。',
      tempSaveFailed: '設定の一時保存に失敗しました。',
      tempDataMissing: '一時的なアンケートデータが見つかりません。作成画面からやり直してください。',
      loadFailed: 'アンケートデータの読み込みに失敗しました。',
      allowContinuousOn: '連続回答が有効になりました。',
      allowContinuousOff: '連続回答が無効になりました。',
      continuousSectionTitle: '連続回答機能',
      continuousLabel: '連続回答を許可する',
      continuousDescription: '回答完了後、同じ端末で続けて別の回答ができるようにします。',
      cancel: 'キャンセル',
      save: '保存する',
      premiumNoticeTitle: 'プレミアム機能のご案内',
      premiumMessage: 'サンクスメッセージのカスタマイズはプレミアムプラン（今後実装予定）でご利用いただけます。'
    },
    surveyCreation: {
      requiredInput: '必須項目を入力してください。',
      startDateFuture: '開始日は翌日以降の日付を選択してください。',
      requiredField: 'この入力は必須です',
      minLength: 'あと{count}文字必要です。',
      maxLength: '{count}文字超過しています。'
    }
  },
  en: {
    common: {
      required: 'Please fill in the required fields.',
      noQuestions: 'There are no questions available in this survey.'
    },
    validation: {
      minLength: '{count} more characters required.',
      maxLength: '{count} characters over the limit.'
    },
    surveyAnswer: {
      pageTitleFallback: 'Survey Response',
      titleFallback: 'Survey',
      languageLabel: 'Language',
      switchedLocale: 'Switched to {locale}',
      submitFailed: 'Failed to submit your response.',
      loadingFailed: 'Failed to load the survey.',
      missingSurveyId: 'The surveyId parameter is missing from the URL.',
      surveyNotFound: 'Survey definition file was not found (ID: {surveyId})',
      requiredBadge: 'Required',
      submitButton: 'Submit',
      bizcardCameraButton: 'Scan business card',
      bizcardManualButton: 'I do not have a business card',
      submitting: 'Submitting...'
    },
    thankYouScreen: {
      documentTitle: 'SpeedAd - Survey Completed',
      title: 'Thank you for completing the survey!',
      body: 'Your feedback will help us improve our service.',
      continuousAnswerButton: 'Submit another response'
    },
    thankYouSettings: {
      pageTitleFallback: 'Thank-you Screen Settings',
      pageTitle: 'Thank-you Screen Settings for "{name}"',
      sectionTitle: 'Post-submission message',
      fieldLabel: 'Thank-you message',
      fieldDescription: 'This message is shown after a respondent submits the survey. If left blank, the default message is displayed.',
      counterError: 'Please keep the thank-you message within {count} characters.',
      saved: 'Settings saved.',
      tempSaveFailed: 'Failed to save temporary settings.',
      tempDataMissing: 'Temporary survey data was not found. Please return to the creation screen.',
      loadFailed: 'Failed to load survey data.',
      allowContinuousOn: 'Continuous responses enabled.',
      allowContinuousOff: 'Continuous responses disabled.',
      continuousSectionTitle: 'Continuous responses',
      continuousLabel: 'Allow continuous responses',
      continuousDescription: 'Allow another response to be submitted on the same device after completion.',
      cancel: 'Cancel',
      save: 'Save',
      premiumNoticeTitle: 'Premium feature notice',
      premiumMessage: 'Thank-you message customization is available with the premium plan (coming soon).'
    },
    surveyCreation: {
      requiredInput: 'Please fill in the required fields.',
      startDateFuture: 'Please select a start date that is at least one day in the future.',
      requiredField: 'This field is required.',
      minLength: '{count} more characters required.',
      maxLength: '{count} characters over the limit.'
    }
  }
};

export function normalizeLocale(locale, fallbackLocale = 'ja') {
  if (!locale) {
    return LOCALE_CANONICAL_MAP[fallbackLocale] || fallbackLocale;
  }
  return LOCALE_CANONICAL_MAP[locale] || locale;
}

export function getLocaleCandidates(locale, fallbackLocale = 'ja') {
  const candidates = [];
  const pushAliases = (targetLocale) => {
    if (!targetLocale) return;
    const canonical = normalizeLocale(targetLocale, fallbackLocale);
    const aliases = LOCALE_ALIASES[canonical] || [canonical];
    aliases.forEach((alias) => {
      if (!candidates.includes(alias)) {
        candidates.push(alias);
      }
    });
  };

  pushAliases(locale);
  pushAliases(fallbackLocale);
  pushAliases('ja');
  return candidates;
}

export function resolveLocalizedValue(value, locale, fallbackLocale = 'ja') {
  if (typeof value === 'string') {
    return value;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return '';
  }

  const candidates = getLocaleCandidates(locale, fallbackLocale);
  for (const candidate of candidates) {
    const resolved = value[candidate];
    if (typeof resolved === 'string' && resolved.trim()) {
      return resolved;
    }
  }

  const firstValue = Object.values(value).find((entry) => typeof entry === 'string' && entry.trim());
  return typeof firstValue === 'string' ? firstValue : '';
}

export function normalizeLocalizedRecord(value, activeLocales = ['ja'], fallbackLocale = 'ja') {
  const normalized = {};
  activeLocales.forEach((locale) => {
    normalized[locale] = resolveLocalizedValue(value, locale, fallbackLocale);
  });
  return normalized;
}

export function normalizeEditableLocalizedRecord(value, activeLocales = ['ja'], fallbackLocale = 'ja') {
  const normalized = {};

  activeLocales.forEach((locale) => {
    normalized[locale] = '';
  });

  if (typeof value === 'string') {
    if (Object.prototype.hasOwnProperty.call(normalized, fallbackLocale)) {
      normalized[fallbackLocale] = value;
    }
    return normalized;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return normalized;
  }

  activeLocales.forEach((locale) => {
    const aliases = LOCALE_ALIASES[normalizeLocale(locale, fallbackLocale)] || [locale];
    const resolved = aliases
      .map((alias) => value[alias])
      .find((entry) => typeof entry === 'string');

    normalized[locale] = typeof resolved === 'string' ? resolved : '';
  });

  return normalized;
}

export function getMessage(locale, path, fallbackLocale = 'ja') {
  const segments = String(path).split('.');
  const localeCandidates = [normalizeLocale(locale, fallbackLocale), normalizeLocale(fallbackLocale, 'ja'), 'ja'];

  for (const candidate of localeCandidates) {
    let current = messages[candidate];
    for (const segment of segments) {
      current = current?.[segment];
    }
    if (typeof current === 'string') {
      return current;
    }
  }

  return path;
}

export function formatMessage(locale, path, params = {}, fallbackLocale = 'ja') {
  const template = getMessage(locale, path, fallbackLocale);
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value === null || value === undefined ? '' : String(value);
  });
}
