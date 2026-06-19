import { handleOpenModal, closeModal } from './modalHandler.js';
import { showToast, resolveDashboardAssetPath } from './utils.js';
import { initHelpPopovers } from './ui/helpPopover.js';

// --- DOM Elements ---
let modal;
let form;
let surveyNameInput;
let displayTitleInput;
let surveyMemoInput;
let periodRangeInput;
let confirmBtn;
let cancelBtn;
let closeBtn;
let periodRangeInstance = null;
let sourceSurvey = null;

function setFieldError(input, message) {
    const errorEl = input ? document.getElementById(`${input.id}-error`) : null;
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.classList.toggle('hidden', !message);
}

function parsePeriodRange(value) {
    const matches = String(value || '').match(/\d{4}-\d{2}-\d{2}/g) || [];
    if (matches.length < 2) {
        return null;
    }
    return {
        start: matches[0],
        end: matches[1]
    };
}

/**
 * Initializes DOM elements for the duplicate survey modal.
 */
const initElements = () => {
    modal = document.getElementById('duplicateSurveyModal');
    form = modal.querySelector('form');
    surveyNameInput = document.getElementById('duplicateSurveyName');
    displayTitleInput = document.getElementById('duplicateDisplayTitle');
    surveyMemoInput = document.getElementById('duplicateSurveyMemo');
    periodRangeInput = document.getElementById('duplicateSurveyPeriodRange');
    confirmBtn = document.getElementById('confirmDuplicateSurveyBtn');
    cancelBtn = document.getElementById('cancelDuplicateSurveyModalBtn');
    closeBtn = document.getElementById('closeDuplicateSurveyModalBtn');
};

/**
 * Populates the form with survey data.
 * @param {object} survey The survey object.
 */
const populateForm = (survey) => {
    const lang = window.getCurrentLanguage(); // 現在の言語を取得
    const isSampleSurvey = Boolean(survey?.isSample && survey?.sampleVisibility === 'all_accounts');

    if (surveyNameInput) {
        const surveyName = (survey.name && typeof survey.name === 'object') ? survey.name[lang] || survey.name.ja : survey.name;
        surveyNameInput.value = `${surveyName} のコピー`;
    }
    if (displayTitleInput) {
        const displayTitle = (survey.displayTitle && typeof survey.displayTitle === 'object') ? survey.displayTitle[lang] || survey.displayTitle.ja : survey.displayTitle;
        displayTitleInput.value = displayTitle;
    }
    if (surveyMemoInput) {
        const surveyMemo = (survey.memo && typeof survey.memo === 'object') ? survey.memo[lang] || survey.memo.ja : survey.memo;
        surveyMemoInput.value = isSampleSurvey
            ? 'サンプルアンケートを複製して作成した通常アンケートです。'
            : surveyMemo;
    }
    // 回答期間は空にする仕様
    if (periodRangeInput) {
        periodRangeInput.value = '';
    }
};

/**
 * Initializes the date range picker.
 */
const initDatepicker = () => {
    if (periodRangeInstance) {
        periodRangeInstance.destroy();
    }

    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);
    tomorrow.setDate(tomorrow.getDate() + 1);

    periodRangeInstance = flatpickr(periodRangeInput, {
        mode: "range",
        dateFormat: "Y-m-d",
        locale: 'ja',
        minDate: tomorrow
    });
};

/**
 * Handles the form submission to duplicate a survey.
 * @param {Event} event The form submission event.
 */
const handleConfirm = async (event) => {
    event.preventDefault();
    const name = surveyNameInput.value.trim();
    const displayTitle = displayTitleInput.value.trim();
    const memo = surveyMemoInput.value.trim();
    const period = parsePeriodRange(periodRangeInput.value);

    setFieldError(surveyNameInput, name ? '' : 'アンケート名を入力してください。');
    setFieldError(displayTitleInput, displayTitle ? '' : '表示タイトルを入力してください。');
    setFieldError(periodRangeInput, period ? '' : '回答期間を開始日と終了日で指定してください。');

    if (!sourceSurvey || !name || !displayTitle || !period) {
        return;
    }

    const { duplicateSurvey } = await import('./tableManager.js');
    const duplicatedSurvey = duplicateSurvey(sourceSurvey.id, {
        name,
        displayTitle,
        memo,
        periodStart: period.start,
        periodEnd: period.end
    });

    if (duplicatedSurvey) {
        closeModal('duplicateSurveyModal');
    }
};

/**
 * Closes the duplicate survey modal.
 */
const closeDuplicateSurveyModal = () => {
    closeModal('duplicateSurveyModal');
};

/**
 * Sets up event listeners for the modal.
 */
const setupEventListeners = () => {
    form.removeEventListener('submit', handleConfirm);
    form.addEventListener('submit', handleConfirm);

    cancelBtn.removeEventListener('click', closeDuplicateSurveyModal);
    cancelBtn.addEventListener('click', closeDuplicateSurveyModal);

    closeBtn.removeEventListener('click', closeDuplicateSurveyModal);
    closeBtn.addEventListener('click', closeDuplicateSurveyModal);

    initHelpPopovers(modal);
};

/**
 * Opens the duplicate survey modal and populates it with data.
 * @param {object} survey The survey object to be duplicated.
 */
export async function openDuplicateSurveyModal(survey) {
    await handleOpenModal('duplicateSurveyModal', resolveDashboardAssetPath('modals/duplicateSurveyModal.html'));

    initElements();
    sourceSurvey = survey;

    try {
        populateForm(survey);
    } catch (error) {
        console.error('Failed to populate form:', error);
        showToast('アンケート情報の表示に失敗しました。', 'error');
        return;
    }

    initDatepicker();

    setupEventListeners();
}
