import { showToast, resolveDashboardDataPath } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';

const MAX_MESSAGE_LENGTH = 500;
const STORAGE_KEY_PREFIX = 'thankYouScreenSettings_';
const PREMIUM_PLAN_KEYWORDS = ['premium', 'professional', 'pro'];

function isPremiumPlan(plan) {
    if (!plan) return false;
    const normalized = String(plan).toLowerCase();
    return PREMIUM_PLAN_KEYWORDS.some((keyword) => normalized.includes(keyword));
}


// --- Services (本来は外部ファイル) ---
async function getSurveyById(surveyId) {
  try {
    const dataPath = resolveDashboardDataPath('core/surveys.json');
    const response = await fetch(dataPath);
    if (!response.ok) throw new Error('Survey data not found');
    const surveys = await response.json();
    const survey = surveys.find(s => s.id === surveyId);

    if (!survey) {
        // もし core/surveys.json になければ、古いデータ形式も試す
        const oldDataPath = resolveDashboardDataPath('demo_answers/surveys-with-details.json');
        const oldResponse = await fetch(oldDataPath);
        if (!oldResponse.ok) throw new Error(`Survey with id ${surveyId} not found in both new and old data sources.`);
        const oldSurveysOrSurvey = await oldResponse.json();
        const foundSurvey = Array.isArray(oldSurveysOrSurvey)
          ? oldSurveysOrSurvey.find(s => s.id === surveyId)
          : (oldSurveysOrSurvey && oldSurveysOrSurvey.id === surveyId ? oldSurveysOrSurvey : null);
        
        if (!foundSurvey) throw new Error(`Survey with id ${surveyId} not found`);
        return foundSurvey;
    }
    return survey;
  } catch (error) {
    console.error('Failed to get survey by id:', error);
    throw error;
  }
}

// --- Renderer ---
function resolveCurrentLanguage() {
  if (typeof window.getCurrentLanguage === 'function') {
    try {
      return window.getCurrentLanguage();
    } catch (error) {
      console.warn('Failed to resolve language from global accessor:', error);
    }
  }
  try {
    return localStorage.getItem('language') || 'ja';
  } catch (_) {
    return 'ja';
  }
}

function renderPageTitle(survey) {
  if (!survey) return;
  const lang = resolveCurrentLanguage();
  const surveyName = typeof survey.name === 'string'
    ? survey.name
    : (survey.name?.[lang] ?? survey.name?.ja ?? survey.name?.en ?? survey.id ?? '');
  const titleElement = document.getElementById('pageTitle');
  if (!titleElement) return;
  if (lang === 'en') {
    const displayName = surveyName || 'Survey';
    titleElement.textContent = `Thank-you Screen Settings for "${displayName}"`;
  } else {
    const displayName = surveyName || 'アンケート';
    titleElement.textContent = `アンケート「${displayName}」のサンクス画面設定`;
  }
}

function updateThankYouMessageMeta(textarea) {
  if (!textarea) return true;
  const counter = document.getElementById('thankYouMessageCounter');
  const errorEl = document.getElementById('thankYouMessageError');
  const length = textarea.value.length;
  if (counter) {
    counter.textContent = `${length}/${MAX_MESSAGE_LENGTH}`;
  }
  const isValid = length <= MAX_MESSAGE_LENGTH;
  if (errorEl) {
    if (!isValid) {
      errorEl.textContent = `サンクスメッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください。`;
      errorEl.classList.remove('hidden');
    } else {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
    }
  }
  textarea.classList.toggle('input-error', !isValid);
  return isValid;
}

function deriveDefaultSettings(survey) {
  return {
    thankYouMessage: typeof survey?.thankYouMessage === 'string'
      ? survey.thankYouMessage
      : '',
    allowContinuousAnswer: typeof survey?.allowContinuousAnswer === 'boolean'
      ? survey.allowContinuousAnswer
      : false
  };
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

function hasSettingsChanged(current, baseline) {
  if (!baseline) return true;
  return current.thankYouMessage !== baseline.thankYouMessage
    || current.allowContinuousAnswer !== baseline.allowContinuousAnswer;
}

function disableThankYouScreenForm(controls, message) {
    const mainContent = document.getElementById('main-content');
    
    // Disable interactive controls
    controls.forEach(control => {
        if (control) {
            control.disabled = true;
        }
    });

    // Visually disable the sections
    const messageSection = document.querySelector('#thankYouMessage')?.closest('section');
    const continuousAnswerSection = document.querySelector('#allowContinuousAnswer')?.closest('section');
    
    [messageSection, continuousAnswerSection].forEach(section => {
        if (section) {
            section.classList.add('opacity-50');
            const sectionControls = section.querySelectorAll('input, textarea, button');
            sectionControls.forEach(sc => sc.tabIndex = -1);
        }
    });

    if (message && mainContent) {
        const noticeContainer = document.createElement('div');
        noticeContainer.className = 'max-w-4xl mx-auto -mt-4 mb-6';
        noticeContainer.innerHTML = `
            <div class="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg shadow">
                <div class="flex items-start">
                    <span class="material-icons mr-3 text-blue-600">info</span>
                    <div>
                        <p class="font-semibold">プレミアム機能のご案内</p>
                        <p class="text-sm">${message}</p>
                    </div>
                </div>
            </div>
        `;
        mainContent.insertBefore(noticeContainer, mainContent.children[2]);
    }
}

export async function initThankYouScreenSettings() {
  const thankYouMessageInput = document.getElementById('thankYouMessage');
  const allowContinuousAnswerToggle = document.getElementById('allowContinuousAnswer');
  const saveButton = document.getElementById('saveButton');
  const cancelButton = document.getElementById('cancelButton');

  if (!thankYouMessageInput || !allowContinuousAnswerToggle || !saveButton || !cancelButton) {
    return;
  }

  const interactiveControls = [
    thankYouMessageInput,
    allowContinuousAnswerToggle,
    saveButton
  ];

  const urlParams = new URLSearchParams(window.location.search);
  const surveyId = urlParams.get('surveyId');

  if (!surveyId) {
    showToast('アンケートIDが見つかりません。', 'error');
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
      titleEl.textContent = 'アンケートIDが指定されていません。';
    }
    disableThankYouScreenForm(interactiveControls, 'アンケートIDを指定してください。');
    return;
  }

  let survey = null;
  try {
    survey = await getSurveyById(surveyId);
    renderPageTitle(survey);
  } catch (error) {
    console.error('Failed to initialize thank-you screen settings:', error);
    showToast('アンケートデータの読み込みに失敗しました。', 'error');
    disableThankYouScreenForm(interactiveControls, 'アンケートデータの読み込みに失敗しました。');
    return;
  }

  // --- Plan-based Feature Gate ---
  if (!isPremiumPlan(survey.plan)) {
    disableThankYouScreenForm(interactiveControls, 'サンクス画面のカスタマイズはプレミアムプラン（今後実装予定）でご利用いただけます。');
  }

  const defaultSettings = deriveDefaultSettings(survey);
  const storedSettings = loadStoredSettings(surveyId);
  const mergedSettings = { ...defaultSettings, ...storedSettings };
  let initialSettings = { ...mergedSettings };

  const applySettingsToForm = (settings) => {
    thankYouMessageInput.value = settings.thankYouMessage || '';
    allowContinuousAnswerToggle.checked = Boolean(settings.allowContinuousAnswer);
    updateThankYouMessageMeta(thankYouMessageInput);
  };

  const collectCurrentSettings = () => ({
    thankYouMessage: thankYouMessageInput.value.trim(),
    allowContinuousAnswer: allowContinuousAnswerToggle.checked
  });

  thankYouMessageInput.addEventListener('input', () => {
    updateThankYouMessageMeta(thankYouMessageInput);
  });

  allowContinuousAnswerToggle.addEventListener('change', () => {
    showToast(
      allowContinuousAnswerToggle.checked
        ? '連続回答が有効になりました。'
        : '連続回答が無効になりました。',
      'info'
    );
  });

  saveButton.addEventListener('click', () => {
    if (!updateThankYouMessageMeta(thankYouMessageInput)) {
      showToast(`サンクスメッセージは${MAX_MESSAGE_LENGTH}文字以下で入力してください。`, 'error');
      thankYouMessageInput.focus();
      return;
    }
    const settingsToSave = collectCurrentSettings();
    saveStoredSettings(surveyId, settingsToSave);
    initialSettings = { ...settingsToSave };
    showToast('設定を保存しました。', 'success');
  });

  cancelButton.addEventListener('click', () => {
    const currentSettings = collectCurrentSettings();
    if (hasSettingsChanged(currentSettings, initialSettings)) {
      showConfirmationModal(
        '未保存の変更があります。このページを離れますか？',
        () => { window.location.href = 'index.html'; }
      );
    } else {
      window.location.href = 'index.html';
    }
  });

  applySettingsToForm(mergedSettings);
}