import { showToast, resolveDashboardDataPath } from './utils.js';
const MAX_MESSAGE_LENGTH = 500;

// --- Services (簡易的なもの) ---
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
        const displayName = surveyName || '名称未設定';
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

function applyBizcardToggleState(isEnabled) {
    const notice = document.getElementById('bizcardDisabledNotice');
    if (notice) {
        notice.classList.toggle('hidden', !!isEnabled);
    }
}

// --- Main Logic ---

export function initThankYouScreenSettings() {
    initializePage();
}

async function initializePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId');

    if (!surveyId) {
        showToast('有効なアンケートIDが指定されていません。', 'error');
        return;
    }

    try {
        const surveyData = await getSurveyById(surveyId);
        renderPageTitle(surveyData);
        loadSettings(surveyId);
        setupEventListeners(surveyId);
    } catch (error) {
        showToast('ページの読み込みに失敗しました。', 'error');
    }
}

function setupEventListeners(surveyId) {
    const saveButton = document.getElementById('saveButton');
    const cancelButton = document.getElementById('cancelButton');
    const requestBusinessCardPhoto = document.getElementById('requestBusinessCardPhoto');
    const thankYouMessageInput = document.getElementById('thankYouMessage');

    if (saveButton) {
        saveButton.addEventListener('click', () => handleSave(surveyId));
    }
    if (cancelButton) {
        cancelButton.addEventListener('click', handleCancel);
    }
    if (requestBusinessCardPhoto) {
        requestBusinessCardPhoto.addEventListener('change', handleBizCardToggle);
    }
    if (thankYouMessageInput) {
        thankYouMessageInput.addEventListener('input', () => updateThankYouMessageMeta(thankYouMessageInput));
    }
}

function loadSettings(surveyId) {
    const settingsKey = `thankYouScreenSettings_${surveyId}`;
    const settings = JSON.parse(localStorage.getItem(settingsKey)) || {
        thankYouMessage: 'アンケートのご回答ありがとうございました。ご協力いただきありがとうございました。',
        allowContinuousAnswer: false,
        requestBusinessCardPhoto: true
    };

    const thankYouMessageInput = document.getElementById('thankYouMessage');
    const allowContinuousAnswerInput = document.getElementById('allowContinuousAnswer');
    const requestBusinessCardPhotoInput = document.getElementById('requestBusinessCardPhoto');

    if (thankYouMessageInput) {
        thankYouMessageInput.value = (settings.thankYouMessage || '').slice(0, MAX_MESSAGE_LENGTH);
        updateThankYouMessageMeta(thankYouMessageInput);
    }
    if (allowContinuousAnswerInput) {
        allowContinuousAnswerInput.checked = settings.allowContinuousAnswer === true;
    }
    const isBizcardEnabled = settings.requestBusinessCardPhoto !== false;
    if (requestBusinessCardPhotoInput) {
        requestBusinessCardPhotoInput.checked = isBizcardEnabled;
    }
    applyBizcardToggleState(isBizcardEnabled);
}

function handleSave(surveyId) {
    const thankYouMessageInput = document.getElementById('thankYouMessage');
    const allowContinuousAnswerInput = document.getElementById('allowContinuousAnswer');
    const requestBusinessCardPhotoInput = document.getElementById('requestBusinessCardPhoto');

    if (!thankYouMessageInput || !allowContinuousAnswerInput || !requestBusinessCardPhotoInput) {
        showToast('フォームの初期化に失敗しました。', 'error');
        return;
    }

    if (!updateThankYouMessageMeta(thankYouMessageInput)) {
        thankYouMessageInput.focus();
        showToast(`サンクスメッセージは${MAX_MESSAGE_LENGTH}文字以内で入力してください。`, 'error');
        return;
    }

    const settingsKey = `thankYouScreenSettings_${surveyId}`;
    const sanitizedMessage = thankYouMessageInput.value.slice(0, MAX_MESSAGE_LENGTH);
    thankYouMessageInput.value = sanitizedMessage;

    const settings = {
        thankYouMessage: sanitizedMessage,
        allowContinuousAnswer: allowContinuousAnswerInput.checked,
        requestBusinessCardPhoto: requestBusinessCardPhotoInput.checked
    };

    localStorage.setItem(settingsKey, JSON.stringify(settings));
    applyBizcardToggleState(settings.requestBusinessCardPhoto);
    showToast('設定が保存されました。', 'success');
}

function handleCancel() {
    history.back();
}

function handleBizCardToggle(event) {
    const isEnabled = event.target.checked;
    applyBizcardToggleState(isEnabled);
}
