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
      maxLength: '{count}文字超過しています。',
      validation: {
        surveyNameRequired: '要確認: アンケート名を入力してください',
        displayTitleRequired: '要確認: 表示タイトルを入力してください',
        periodRequired: '要確認: 期間を設定してください',
        noQuestionsTitle: '設問が登録されていません',
        noQuestionsBody: 'アンケートには最低1件の設問が必要なため、現状では保存できません。',
        noQuestionsRecommendation: '推奨対応：画面中央の「最初の設問を追加」ボタンから、1問以上の設問を登録してください。'
      }
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
      maxLength: '{count} characters over the limit.',
      validation: {
        surveyNameRequired: 'Please enter the survey name.',
        displayTitleRequired: 'Please enter the display title.',
        periodRequired: 'Please set the survey period.',
        noQuestionsTitle: 'No questions have been registered',
        noQuestionsBody: 'At least one question is required, so the survey cannot be saved in its current state.',
        noQuestionsRecommendation: 'Recommended action: add at least one question using the "Add first question" button in the center of the screen.'
      }
    }
  },
  'zh-CN': {
    common: {
      required: '请填写必填项。',
      noQuestions: '此问卷暂无可显示的题目。'
    },
    validation: {
      minLength: '还需输入 {count} 个字符。',
      maxLength: '已超出 {count} 个字符。'
    },
    surveyAnswer: {
      pageTitleFallback: '问卷回答',
      titleFallback: '问卷',
      languageLabel: 'Language',
      switchedLocale: '已切换为 {locale}',
      submitFailed: '提交回答失败。',
      loadingFailed: '加载问卷失败。',
      missingSurveyId: 'URL 中未指定 surveyId。',
      surveyNotFound: '未找到问卷定义文件（ID：{surveyId}）',
      requiredBadge: '必填',
      submitButton: '提交',
      bizcardCameraButton: '拍摄名片',
      bizcardManualButton: '没有名片',
      submitting: '正在提交...'
    },
    thankYouScreen: {
      documentTitle: 'SpeedAd - 问卷回答完成',
      title: '感谢您参与本次问卷调查！',
      body: '您的宝贵意见将用于我们今后的服务改进。',
      continuousAnswerButton: '继续回答'
    },
    thankYouSettings: {
      pageTitleFallback: '感谢页面设置',
      pageTitle: '问卷「{name}」的感谢页面设置',
      sectionTitle: '提交后文案设置',
      fieldLabel: '感谢信息',
      fieldDescription: '提交问卷后显示的信息。留空时将显示默认信息。',
      counterError: '感谢信息请控制在 {count} 个字符以内。',
      saved: '设置已保存。',
      tempSaveFailed: '临时保存设置失败。',
      tempDataMissing: '未找到临时问卷数据，请从创建页面重新开始。',
      loadFailed: '加载问卷数据失败。',
      allowContinuousOn: '已启用连续回答。',
      allowContinuousOff: '已停用连续回答。',
      continuousSectionTitle: '连续回答功能',
      continuousLabel: '允许连续回答',
      continuousDescription: '提交完成后，允许在同一设备上继续提交其他回答。',
      cancel: '取消',
      save: '保存',
      premiumNoticeTitle: '高级功能说明',
      premiumMessage: '感谢信息的自定义功能可在高级套餐（即将推出）中使用。'
    },
    surveyCreation: {
      requiredInput: '请填写必填项。',
      startDateFuture: '开始日期请选择次日及以后的日期。',
      requiredField: '此项为必填项',
      minLength: '还需输入 {count} 个字符。',
      maxLength: '已超出 {count} 个字符。',
      validation: {
        surveyNameRequired: '请输入问卷名称。',
        displayTitleRequired: '请输入显示标题。',
        periodRequired: '请设置问卷期间。',
        noQuestionsTitle: '尚未登记任何题目',
        noQuestionsBody: '问卷至少需要 1 个题目，当前状态下无法保存。',
        noQuestionsRecommendation: '建议操作：请通过页面中央的「添加第一个题目」按钮，至少登记 1 个题目。'
      }
    }
  },
  'zh-TW': {
    common: {
      required: '請填寫必填欄位。',
      noQuestions: '此問卷中沒有可顯示的題目。'
    },
    validation: {
      minLength: '還需要 {count} 個字。',
      maxLength: '已超過 {count} 個字。'
    },
    surveyAnswer: {
      pageTitleFallback: '問卷回答',
      titleFallback: '問卷',
      languageLabel: 'Language',
      switchedLocale: '已切換為 {locale}',
      submitFailed: '回答送出失敗。',
      loadingFailed: '問卷載入失敗。',
      missingSurveyId: '網址中未指定 surveyId。',
      surveyNotFound: '找不到問卷定義檔案（ID：{surveyId}）',
      requiredBadge: '必填',
      submitButton: '送出',
      bizcardCameraButton: '拍攝名片',
      bizcardManualButton: '手邊沒有名片',
      submitting: '送出中...'
    },
    thankYouScreen: {
      documentTitle: 'SpeedAd - 問卷回答完成',
      title: '感謝您協助填寫本問卷！',
      body: '您的寶貴意見將協助我們持續改善服務品質。',
      continuousAnswerButton: '繼續回答'
    },
    thankYouSettings: {
      pageTitleFallback: '感謝頁面設定',
      pageTitle: '問卷「{name}」的感謝頁面設定',
      sectionTitle: '回答後的訊息設定',
      fieldLabel: '感謝訊息',
      fieldDescription: '此訊息會在填答者送出問卷後顯示。若留空，將顯示預設訊息。',
      counterError: '感謝訊息請控制在 {count} 個字以內。',
      saved: '設定已儲存。',
      tempSaveFailed: '設定暫存失敗。',
      tempDataMissing: '找不到暫存的問卷資料，請從建立畫面重新開始。',
      loadFailed: '問卷資料載入失敗。',
      allowContinuousOn: '已啟用連續回答。',
      allowContinuousOff: '已停用連續回答。',
      continuousSectionTitle: '連續回答功能',
      continuousLabel: '允許連續回答',
      continuousDescription: '填答完成後，允許在相同裝置上繼續送出另一份回答。',
      cancel: '取消',
      save: '儲存',
      premiumNoticeTitle: '進階功能說明',
      premiumMessage: '感謝訊息的自訂功能將於進階方案（預計推出）中提供。'
    },
    surveyCreation: {
      requiredInput: '請填寫必填欄位。',
      startDateFuture: '開始日期請選擇隔日以後的日期。',
      requiredField: '此欄位為必填',
      minLength: '還需要 {count} 個字。',
      maxLength: '已超過 {count} 個字。',
      validation: {
        surveyNameRequired: '請輸入問卷名稱。',
        displayTitleRequired: '請輸入顯示標題。',
        periodRequired: '請設定問卷期間。',
        noQuestionsTitle: '尚未登錄任何題目',
        noQuestionsBody: '問卷至少需要 1 個題目，目前狀態下無法儲存。',
        noQuestionsRecommendation: '建議操作：請透過頁面中央的「新增第一個題目」按鈕，至少登錄 1 個題目。'
      }
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
