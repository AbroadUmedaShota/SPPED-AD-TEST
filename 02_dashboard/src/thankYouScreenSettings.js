import { showToast, resolveDashboardDataPath } from './utils.js';

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
function renderPageTitle(survey) {
    if (!survey) return;
    const lang = 'ja'; // or get from global state
    const titleElement = document.getElementById('pageTitle');
    if(titleElement) {
        titleElement.textContent = `アンケート『${survey.name[lang]}』のサンクス画面設定`;
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

    saveButton.addEventListener('click', () => handleSave(surveyId));
    cancelButton.addEventListener('click', handleCancel);
    requestBusinessCardPhoto.addEventListener('change', handleBizCardToggle);
}

function loadSettings(surveyId) {
    const settingsKey = `thankYouScreenSettings_${surveyId}`;
    const settings = JSON.parse(localStorage.getItem(settingsKey)) || {
        thankYouMessage: 'アンケートの送信が完了しました。ご回答ありがとうございました。',
        allowContinuousAnswer: true,
        requestBusinessCardPhoto: true
    };

    document.getElementById('thankYouMessage').value = settings.thankYouMessage;
    document.getElementById('allowContinuousAnswer').checked = settings.allowContinuousAnswer;
    document.getElementById('requestBusinessCardPhoto').checked = settings.requestBusinessCardPhoto;
}

function handleSave(surveyId) {
    const settingsKey = `thankYouScreenSettings_${surveyId}`;
    const settings = {
        thankYouMessage: document.getElementById('thankYouMessage').value,
        allowContinuousAnswer: document.getElementById('allowContinuousAnswer').checked,
        requestBusinessCardPhoto: document.getElementById('requestBusinessCardPhoto').checked
    };

    localStorage.setItem(settingsKey, JSON.stringify(settings));
    showToast('設定が保存されました。', 'success');
}

function handleCancel() {
    history.back();
}

function handleBizCardToggle(event) {
    const isEnabled = event.target.checked;
    localStorage.setItem('requestBusinessCardPhoto', isEnabled);
}
