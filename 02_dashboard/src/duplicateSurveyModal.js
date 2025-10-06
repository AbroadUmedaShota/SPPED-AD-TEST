import { handleOpenModal, closeModal } from './modalHandler.js';
import { showToast } from './utils.js';

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

// 仮のアンケートデータ取得関数 (将来的にはAPIを呼び出す)
const getSurveyDetails = async (surveyId) => {
    console.log(`Fetching data for surveyId: ${surveyId}`);
    // ダミーデータ
    return {
        id: surveyId,
        name: `サンプルアンケート ${surveyId}`,
        displayTitle: `サンプル表示タイトル ${surveyId}`,
        memo: `これはサンプルアンケートの説明（メモ）です。`,
    };
};


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
    if (surveyNameInput) {
        surveyNameInput.value = `${survey.name} のコピー`;
    }
    if (displayTitleInput) {
        displayTitleInput.value = survey.displayTitle;
    }
    if (surveyMemoInput) {
        surveyMemoInput.value = survey.memo;
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
    // TODO: flatpickrがプロジェクトに導入されたら、以下のコメントアウトを解除して有効化する
    // periodRangeInstance = flatpickr(periodRangeInput, {
    //     mode: "range",
    //     dateFormat: "Y-m-d",
    //     locale: 'ja',
    // });
    console.log("Datepicker initialization skipped (flatpickr not integrated).");
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
};

/**
 * Opens the duplicate survey modal and populates it with data.
 * @param {string} surveyId The ID of the survey to be duplicated.
 */
export async function openDuplicateSurveyModal(surveyId) {
    await handleOpenModal('duplicateSurveyModal', 'modals/duplicateSurveyModal.html');
    
    initElements();

    try {
        const survey = await getSurveyDetails(surveyId);
        populateForm(survey);
    } catch (error) {
        console.error('Failed to get survey details:', error);
        showToast('アンケート情報の取得に失敗しました。', 'error');
        return;
    }
    
    initDatepicker();

    setupEventListeners();
}
