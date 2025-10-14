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


