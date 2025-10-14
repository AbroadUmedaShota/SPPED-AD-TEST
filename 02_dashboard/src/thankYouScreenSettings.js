import { showToast, resolveDashboardDataPath } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';

const MAX_MESSAGE_LENGTH = 500;
const STORAGE_KEY_PREFIX = 'thankYouScreenSettings_';

// --- Services (�ȈՓI�Ȃ���) ---
async function getSurveyById(surveyId) {
  try {
    const dataPath = resolveDashboardDataPath('surveys/surveys-with-details.json');
    const response = await fetch(dataPath);
    if (!response.ok) throw new Error('Survey data not found');
    const surveys = await response.json();
    const survey = surveys.find(s => s.id === surveyId);
    if (!survey) throw new Error(`Survey with id ${surveyId} not found`);
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
    const displayName = surveyName || '���̖��ݒ�';
    titleElement.textContent = `�A���P�[�g�u${displayName}�v�̃T���N�X��ʐݒ�`;
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
      errorEl.textContent = `�T���N�X���b�Z�[�W��${MAX_MESSAGE_LENGTH}�����ȓ��œ��͂��Ă��������B`;
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

function disableThankYouScreenForm(controls) {
  controls.forEach(control => {
    if (control) {
      control.disabled = true;
    }
  });
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
    showToast('Survey ID is missing.', 'error');
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) {
      titleEl.textContent = 'Survey ID not provided';
    }
    disableThankYouScreenForm(interactiveControls);
    return;
  }

  let survey = null;
  try {
    survey = await getSurveyById(surveyId);
    renderPageTitle(survey);
  } catch (error) {
    console.error('Failed to initialize thank-you screen settings:', error);
    showToast('Failed to load survey data.', 'error');
    disableThankYouScreenForm(interactiveControls);
    return;
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
        ? 'Continuous answers enabled.'
        : 'Continuous answers disabled.',
      'info'
    );
  });

  saveButton.addEventListener('click', () => {
    if (!updateThankYouMessageMeta(thankYouMessageInput)) {
      showToast(`Thank-you message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`, 'error');
      thankYouMessageInput.focus();
      return;
    }
    const settingsToSave = collectCurrentSettings();
    saveStoredSettings(surveyId, settingsToSave);
    initialSettings = { ...settingsToSave };
    showToast('Settings saved.', 'success');
  });

  cancelButton.addEventListener('click', () => {
    const currentSettings = collectCurrentSettings();
    if (hasSettingsChanged(currentSettings, initialSettings)) {
      showConfirmationModal(
        'You have unsaved changes. Leave this page?',
        () => { window.location.href = 'index.html'; }
      );
    } else {
      window.location.href = 'index.html';
    }
  });

  applySettingsToForm(mergedSettings);
}
