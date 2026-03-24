import { showToast, resolveDashboardDataPath } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';
import {
  formatMessage,
  normalizeLocale,
  normalizeEditableLocalizedRecord,
  resolveLocalizedValue
} from './services/i18n/messages.js';

const MAX_MESSAGE_LENGTH = 500;
const STORAGE_KEY_PREFIX = 'thankYouScreenSettings_';
const PREMIUM_PLAN_KEYWORDS = ['premium', 'professional', 'pro'];
const BASE_LANGUAGE = 'ja';
const SUPPORTED_LANGUAGES = [
  { code: 'ja', label: '日本語', shortLabel: '日本語' },
  { code: 'en', label: 'English', shortLabel: 'English' },
  { code: 'zh-Hant', label: '中国語（繁体字）', shortLabel: '繁体字' },
  { code: 'zh-Hans', label: '中国語（簡体字）', shortLabel: '簡体字' },
  { code: 'vi', label: 'ベトナム語', shortLabel: 'ベトナム語' }
];
const EDITOR_LOCALE_ALIASES = {
  'zh-TW': 'zh-Hant',
  'zh-CN': 'zh-Hans'
};

function isPremiumPlan(plan) {
  if (!plan) return false;
  const normalized = String(plan).toLowerCase();
  return PREMIUM_PLAN_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function resolveUiLanguage() {
  if (typeof window.getCurrentLanguage === 'function') {
    try {
      return normalizeLocale(window.getCurrentLanguage());
    } catch (_) {
      return 'ja';
    }
  }
  try {
    return normalizeLocale(localStorage.getItem('language') || 'ja');
  } catch (_) {
    return 'ja';
  }
}

function getLanguageMeta(code) {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code) || { code, label: code, shortLabel: code };
}

function normalizeEditorLocale(code) {
  return EDITOR_LOCALE_ALIASES[code] || code;
}

function normalizeActiveLanguages(langs = []) {
  const normalized = [BASE_LANGUAGE];
  langs.forEach((lang) => {
    const normalizedCode = normalizeEditorLocale(lang);
    if (!normalizedCode || normalizedCode === BASE_LANGUAGE) return;
    if (!SUPPORTED_LANGUAGES.some((candidate) => candidate.code === normalizedCode)) return;
    if (normalized.includes(normalizedCode)) return;
    if (normalized.length >= 3) return;
    normalized.push(normalizedCode);
  });
  return normalized;
}

function buildLocalizedMessage(value) {
  return normalizeEditableLocalizedRecord(value, SUPPORTED_LANGUAGES.map((lang) => lang.code));
}

async function getSurveyById(surveyId) {
  if (!surveyId) return null;

  const detailPath = resolveDashboardDataPath(`surveys/${surveyId}.json`);
  const detailResponse = await fetch(detailPath);
  if (detailResponse.ok) {
    return detailResponse.json();
  }

  const dataPath = resolveDashboardDataPath('core/surveys.json');
  const response = await fetch(dataPath);
  if (!response.ok) {
    throw new Error('Survey data not found');
  }
  const surveys = await response.json();
  return surveys.find((survey) => survey.id === surveyId) || null;
}

function loadStoredSettings(surveyId) {
  if (!surveyId) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${surveyId}`);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Failed to load thank-you screen settings from storage:', error);
    return null;
  }
}

function saveStoredSettings(surveyId, settings) {
  if (!surveyId) return;
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${surveyId}`, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to persist thank-you screen settings:', error);
  }
}

function deriveDefaultSettings(survey) {
  const thankYouSettings = survey?.thankYouScreenSettings || survey?.settings?.thankYouScreen || {};
  return {
    thankYouMessage: buildLocalizedMessage(thankYouSettings.thankYouMessage || survey?.thankYouMessage || ''),
    allowContinuousAnswer: typeof thankYouSettings.allowContinuousAnswer === 'boolean'
      ? thankYouSettings.allowContinuousAnswer
      : (typeof survey?.allowContinuousAnswer === 'boolean' ? survey.allowContinuousAnswer : false)
  };
}

function hasSettingsChanged(current, baseline) {
  if (!baseline) return true;
  return JSON.stringify(current.thankYouMessage) !== JSON.stringify(baseline.thankYouMessage)
    || current.allowContinuousAnswer !== baseline.allowContinuousAnswer;
}

function renderPageTitle(survey, uiLanguage) {
  const titleElement = document.getElementById('pageTitle');
  if (!titleElement) return;
  const surveyName = resolveLocalizedValue(survey?.name, uiLanguage) || survey?.id || '';
  titleElement.textContent = surveyName
    ? formatMessage(uiLanguage, 'thankYouSettings.pageTitle', { name: surveyName })
    : formatMessage(uiLanguage, 'thankYouSettings.pageTitleFallback');
}

function applyStaticTexts(uiLanguage) {
  document.title = formatMessage(uiLanguage, 'thankYouSettings.pageTitleFallback');

  const sectionTitle = document.getElementById('thankYouMessageSectionTitle');
  const label = document.getElementById('thankYouMessageLabel');
  const description = document.getElementById('thankYouMessageDescription');
  const continuousSectionTitle = document.getElementById('continuousSectionTitle');
  const continuousLabel = document.getElementById('continuousLabel');
  const continuousDescription = document.getElementById('continuousDescription');
  const cancelButton = document.getElementById('cancelButton');
  const saveButton = document.getElementById('saveButton');

  if (sectionTitle) sectionTitle.textContent = formatMessage(uiLanguage, 'thankYouSettings.sectionTitle');
  if (label) label.textContent = formatMessage(uiLanguage, 'thankYouSettings.fieldLabel');
  if (description) description.textContent = formatMessage(uiLanguage, 'thankYouSettings.fieldDescription');
  if (continuousSectionTitle) continuousSectionTitle.textContent = formatMessage(uiLanguage, 'thankYouSettings.continuousSectionTitle');
  if (continuousLabel) continuousLabel.textContent = formatMessage(uiLanguage, 'thankYouSettings.continuousLabel');
  if (continuousDescription) continuousDescription.textContent = formatMessage(uiLanguage, 'thankYouSettings.continuousDescription');
  if (cancelButton) cancelButton.textContent = formatMessage(uiLanguage, 'thankYouSettings.cancel');
  if (saveButton) saveButton.textContent = formatMessage(uiLanguage, 'thankYouSettings.save');
}

function renderLanguageTabs(activeLanguages, editorLanguage) {
  const tabs = document.getElementById('thankYouLanguageTabs');
  if (!tabs) return;
  tabs.innerHTML = '';
  tabs.classList.toggle('hidden', activeLanguages.length <= 1);

  activeLanguages.forEach((code) => {
    const meta = getLanguageMeta(code);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.lang = code;
    button.className = `px-4 py-2 text-sm font-semibold transition-colors duration-200 ${code === editorLanguage ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant border-b-2 border-transparent'}`;
    button.textContent = meta.shortLabel || meta.label;
    tabs.appendChild(button);
  });
}

function updateThankYouMessageMeta(textarea, settingsState, editorLanguage, uiLanguage) {
  if (!textarea) return true;
  const counter = document.getElementById('thankYouMessageCounter');
  const errorEl = document.getElementById('thankYouMessageError');
  const currentValue = settingsState.thankYouMessage[editorLanguage] || '';
  const length = currentValue.length;

  if (counter) {
    counter.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;
  }

  const isValid = length <= MAX_MESSAGE_LENGTH;
  if (errorEl) {
    if (!isValid) {
      errorEl.textContent = formatMessage(uiLanguage, 'thankYouSettings.counterError', { count: MAX_MESSAGE_LENGTH });
      errorEl.classList.remove('hidden');
    } else {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }

  textarea.classList.toggle('input-error', !isValid);
  return isValid;
}

function updateReferenceHint(settingsState, editorLanguage) {
  const hint = document.getElementById('thankYouMessageReferenceHint');
  if (!hint) return;

  const referenceText = editorLanguage === BASE_LANGUAGE ? '' : (settingsState.thankYouMessage[BASE_LANGUAGE] || '');
  const currentValue = settingsState.thankYouMessage[editorLanguage] || '';
  const shouldShow = Boolean(referenceText.trim() && !currentValue.trim());

  hint.textContent = shouldShow ? `${getLanguageMeta(BASE_LANGUAGE).label}: ${referenceText}` : '';
  hint.classList.toggle('hidden', !shouldShow);
}

function syncTextarea(textarea, settingsState, editorLanguage) {
  if (!textarea) return;
  textarea.value = settingsState.thankYouMessage[editorLanguage] || '';
  textarea.placeholder = ' ';
  updateReferenceHint(settingsState, editorLanguage);
}

function disableThankYouScreenForm(controls, uiLanguage, message) {
  controls.forEach((control) => {
    if (control) {
      control.disabled = true;
    }
  });

  const mainContent = document.getElementById('main-content');
  if (message && mainContent) {
    const noticeContainer = document.createElement('div');
    noticeContainer.className = 'max-w-4xl mx-auto -mt-4 mb-6';
    noticeContainer.innerHTML = `
      <div class="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg shadow">
        <div class="flex items-start">
          <span class="material-icons mr-3 text-blue-600">info</span>
          <div>
            <p class="font-semibold">${formatMessage(uiLanguage, 'thankYouSettings.premiumNoticeTitle')}</p>
            <p class="text-sm">${message}</p>
          </div>
        </div>
      </div>
    `;
    mainContent.insertBefore(noticeContainer, mainContent.children[2] || null);
  }
}

export async function initThankYouScreenSettings() {
  const uiLanguage = resolveUiLanguage();
  const thankYouMessageInput = document.getElementById('thankYouMessage');
  const allowContinuousAnswerToggle = document.getElementById('allowContinuousAnswer');
  const saveButton = document.getElementById('saveButton');
  const cancelButton = document.getElementById('cancelButton');

  if (!thankYouMessageInput || !allowContinuousAnswerToggle || !saveButton || !cancelButton) {
    return;
  }

  applyStaticTexts(uiLanguage);

  const interactiveControls = [thankYouMessageInput, allowContinuousAnswerToggle, saveButton];
  const urlParams = new URLSearchParams(window.location.search);
  const surveyId = urlParams.get('surveyId');
  const fromPage = urlParams.get('from') === 'v2' ? 'surveyCreation-v2.html' : 'surveyCreation.html';
  let survey = null;
  let initialSettings;
  let editorLanguage = BASE_LANGUAGE;
  let activeLanguages = [BASE_LANGUAGE];

  try {
    if (surveyId) {
      survey = await getSurveyById(surveyId);
      if (!survey) {
        throw new Error('Survey not found');
      }
    } else {
      const tempDataString = localStorage.getItem('tempSurveyData');
      if (!tempDataString) {
        showToast(formatMessage(uiLanguage, 'thankYouSettings.tempDataMissing'), 'error');
        setTimeout(() => { window.location.href = fromPage; }, 2000);
        disableThankYouScreenForm(interactiveControls, uiLanguage, formatMessage(uiLanguage, 'thankYouSettings.tempDataMissing'));
        return;
      }
      survey = JSON.parse(tempDataString);
    }
  } catch (error) {
    console.error('Failed to initialize thank-you screen settings:', error);
    showToast(formatMessage(uiLanguage, 'thankYouSettings.loadFailed'), 'error');
    disableThankYouScreenForm(interactiveControls, uiLanguage, formatMessage(uiLanguage, 'thankYouSettings.loadFailed'));
    return;
  }

  activeLanguages = normalizeActiveLanguages(survey?.activeLanguages || [BASE_LANGUAGE]);
  const preferredEditorLanguage = normalizeEditorLocale(survey?.editorLanguage);
  editorLanguage = activeLanguages.includes(preferredEditorLanguage) ? preferredEditorLanguage : BASE_LANGUAGE;

  const defaultSettings = deriveDefaultSettings(survey);
  const storedSettings = surveyId
    ? (loadStoredSettings(surveyId) || survey?.settings?.thankYouScreen || survey?.thankYouScreenSettings || null)
    : (survey?.settings?.thankYouScreen || survey?.thankYouScreenSettings || null);
  const mergedSettings = {
    thankYouMessage: buildLocalizedMessage(storedSettings?.thankYouMessage || defaultSettings.thankYouMessage),
    allowContinuousAnswer: typeof storedSettings?.allowContinuousAnswer === 'boolean'
      ? storedSettings.allowContinuousAnswer
      : defaultSettings.allowContinuousAnswer
  };
  const settingsState = {
    thankYouMessage: { ...mergedSettings.thankYouMessage },
    allowContinuousAnswer: mergedSettings.allowContinuousAnswer
  };
  initialSettings = JSON.parse(JSON.stringify(settingsState));

  renderPageTitle(survey, uiLanguage);
  renderLanguageTabs(activeLanguages, editorLanguage);
  syncTextarea(thankYouMessageInput, settingsState, editorLanguage);
  allowContinuousAnswerToggle.checked = Boolean(settingsState.allowContinuousAnswer);
  updateThankYouMessageMeta(thankYouMessageInput, settingsState, editorLanguage, uiLanguage);

  if (!isPremiumPlan(survey.plan)) {
    thankYouMessageInput.disabled = true;
    const premiumMessage = formatMessage(uiLanguage, 'thankYouSettings.premiumMessage');
    disableThankYouScreenForm([thankYouMessageInput], uiLanguage, premiumMessage);
  }

  thankYouMessageInput.addEventListener('input', () => {
    settingsState.thankYouMessage[editorLanguage] = thankYouMessageInput.value || '';
    updateReferenceHint(settingsState, editorLanguage);
    updateThankYouMessageMeta(thankYouMessageInput, settingsState, editorLanguage, uiLanguage);
  });

  allowContinuousAnswerToggle.addEventListener('change', () => {
    settingsState.allowContinuousAnswer = allowContinuousAnswerToggle.checked;
    showToast(
      allowContinuousAnswerToggle.checked
        ? formatMessage(uiLanguage, 'thankYouSettings.allowContinuousOn')
        : formatMessage(uiLanguage, 'thankYouSettings.allowContinuousOff'),
      'info'
    );
  });

  document.getElementById('thankYouLanguageTabs')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-lang]');
    if (!button) return;
    const nextLanguage = button.dataset.lang;
    if (!activeLanguages.includes(nextLanguage) || nextLanguage === editorLanguage) {
      return;
    }
    editorLanguage = nextLanguage;
    renderLanguageTabs(activeLanguages, editorLanguage);
    syncTextarea(thankYouMessageInput, settingsState, editorLanguage);
    updateThankYouMessageMeta(thankYouMessageInput, settingsState, editorLanguage, uiLanguage);
  });

  saveButton.addEventListener('click', () => {
    if (!updateThankYouMessageMeta(thankYouMessageInput, settingsState, editorLanguage, uiLanguage)) {
      showToast(formatMessage(uiLanguage, 'thankYouSettings.counterError', { count: MAX_MESSAGE_LENGTH }), 'error');
      thankYouMessageInput.focus();
      return;
    }

    const settingsToSave = {
      thankYouMessage: buildLocalizedMessage(settingsState.thankYouMessage),
      allowContinuousAnswer: Boolean(settingsState.allowContinuousAnswer)
    };

    if (surveyId) {
      saveStoredSettings(surveyId, settingsToSave);
    } else {
      try {
        const tempDataString = localStorage.getItem('tempSurveyData');
        const surveyDataForUpdate = tempDataString ? JSON.parse(tempDataString) : {};
        if (!surveyDataForUpdate.settings) surveyDataForUpdate.settings = {};
        surveyDataForUpdate.settings.thankYouScreen = settingsToSave;
        localStorage.setItem('tempSurveyData', JSON.stringify(surveyDataForUpdate));
      } catch (error) {
        console.error('Failed to save temp data', error);
        showToast(formatMessage(uiLanguage, 'thankYouSettings.tempSaveFailed'), 'error');
        return;
      }
    }

    initialSettings = JSON.parse(JSON.stringify(settingsToSave));
    showToast(formatMessage(uiLanguage, 'thankYouSettings.saved'), 'success');
    if (!surveyId) {
      setTimeout(() => { window.location.href = fromPage; }, 1000);
    }
  });

  cancelButton.addEventListener('click', () => {
    const returnUrl = surveyId
      ? `${fromPage}?surveyId=${encodeURIComponent(surveyId)}`
      : fromPage;
    const currentSettings = {
      thankYouMessage: buildLocalizedMessage(settingsState.thankYouMessage),
      allowContinuousAnswer: Boolean(settingsState.allowContinuousAnswer)
    };
    if (hasSettingsChanged(currentSettings, initialSettings)) {
      showConfirmationModal(
        '未保存の変更があります。このページを離れますか？',
        () => { window.location.href = returnUrl; }
      );
    } else {
      window.location.href = returnUrl;
    }
  });
}
