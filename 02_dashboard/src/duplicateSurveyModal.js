import { handleOpenModal, closeModal } from './modalHandler.js';
import { showToast, resolveDashboardAssetPath } from './utils.js';

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

let activeDuplicateSurveyPopover = null;

function closeDuplicateSurveyPopover() {
    if (!activeDuplicateSurveyPopover) return;
    const { button, popover } = activeDuplicateSurveyPopover;
    if (popover) popover.classList.add('hidden');
    if (button) button.setAttribute('aria-expanded', 'false');
    activeDuplicateSurveyPopover = null;
}

document.addEventListener('click', (event) => {
    if (!activeDuplicateSurveyPopover) return;
    const { button, popover } = activeDuplicateSurveyPopover;
    if ((button && button.contains(event.target)) || (popover && popover.contains(event.target))) {
        return;
    }
    closeDuplicateSurveyPopover();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeDuplicateSurveyPopover();
    }
});




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
        surveyMemoInput.value = surveyMemo;
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
const handleConfirm = (event) => {
    event.preventDefault();
    // TODO: Add validation logic
    const newSurveyData = {
        name: surveyNameInput.value,
        displayTitle: displayTitleInput.value,
        memo: surveyMemoInput.value,
        period: periodRangeInput.value,
    };

    console.log('Duplicating survey with data:', newSurveyData);
    showToast('アンケートの複製処理は未実装です。', 'info');
    // TODO: Implement actual duplication logic (e.g., API call)

    // On success:
    // closeModal('duplicateSurveyModal');
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

    // Initialize Help Popovers
    const helpButtons = modal.querySelectorAll('.help-icon-button');
    helpButtons.forEach((button) => {
        if (button.dataset.bound === 'true') return;

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            const tooltipId = button.dataset.tooltipId;
            const popover = document.getElementById(tooltipId);
            if (!popover) return;

            if (activeDuplicateSurveyPopover && activeDuplicateSurveyPopover.popover === popover) {
                closeDuplicateSurveyPopover();
            } else {
                closeDuplicateSurveyPopover();
                popover.classList.remove('hidden');
                button.setAttribute('aria-expanded', 'true');
                activeDuplicateSurveyPopover = { button, popover };
            }
        });
        button.dataset.bound = 'true';
    });
};

/**
 * Opens the duplicate survey modal and populates it with data.
 * @param {object} survey The survey object to be duplicated.
 */
export async function openDuplicateSurveyModal(survey) {
    await handleOpenModal('duplicateSurveyModal', resolveDashboardAssetPath('modals/duplicateSurveyModal.html'));

    initElements();

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
