import { handleOpenModal } from './modalHandler.js';
import { openAccountInfoModal } from './accountInfoModal.js';
import { fetchSurveyData, saveSurveyDataToLocalStorage, loadSurveyDataFromLocalStorage } from './services/surveyService.js';
import { 
    populateBasicInfo, 
    renderAllQuestionGroups, 
    displayErrorMessage, 
    renderOutlineMap 
} from './ui/surveyRenderer.js';
import { initializeFab } from './ui/fab.js';
import { loadCommonHtml } from './utils.js';

// --- Global State ---
let surveyData = {};
let currentLang = 'ja';

// --- Utility Functions ---
window.getCurrentLanguage = () => currentLang;
window.getSurveyData = () => surveyData;

// ダミーユーザーデータ (本来はAPIから取得)
window.dummyUserData = {
    email: "user@example.com",
    companyName: "株式会社SpeedAd",
    departmentName: "開発部",
    positionName: "エンジニア",
    lastName: "田中",
    firstName: "太郎",
    phoneNumber: "09012345678",
    postalCode: "100-0001",
    address: "東京都千代田区千代田1-1",
    buildingFloor: "皇居ビルディング 1F",
    billingAddressType: "same",
    billingCompanyName: "",
    billingDepartmentName: "",
    billingLastName: "",
    billingFirstName: "",
    billingPhoneNumber: "",
    billingPostalCode: "",
    billingAddress: "",
    billingBuildingFloor: "",
};

/**
 * Re-renders the entire form based on the current state (surveyData, currentLang)
 */
function updateAndRenderAll() {
    populateBasicInfo(surveyData, currentLang);
    renderAllQuestionGroups(surveyData.questionGroups, currentLang);
    renderOutlineMap();
    // After rendering, re-validate the form to enable/disable the save button
    validateFormForSaveButton();
}

/**
 * Switches the current language and updates the UI.
 * @param {string} newLang - The new language code ('ja' or 'en').
 */
function switchLanguage(newLang) {
    currentLang = newLang;
    // Update all language tabs in the document
    document.querySelectorAll('.lang-tab-button').forEach(btn => {
        if (btn.dataset.lang === newLang) {
            btn.classList.add('border-primary', 'text-primary');
            btn.classList.remove('border-transparent', 'text-on-surface-variant', 'hover:border-outline-variant', 'hover:text-on-surface');
        } else {
            btn.classList.remove('border-primary', 'text-primary');
            btn.classList.add('border-transparent', 'text-on-surface-variant', 'hover:border-outline-variant', 'hover:text-on-surface');
        }
    });
    updateAndRenderAll();
}

/**
 * ページの初期化処理
 */
async function initializePage() {
    try {
        await Promise.all([
            loadCommonHtml('main-header', 'common/header.html'),
            loadCommonHtml('sidebar', 'common/sidebar.html'),
            loadCommonHtml('main-footer', 'common/footer.html', () => {
                document.getElementById('openContactModalBtn').addEventListener('click', () => handleOpenModal('contactModal', 'modals/contactModal.html'));
            })
        ]);

        const loadedData = loadSurveyDataFromLocalStorage();
        if (loadedData) {
            console.log('Loaded survey data from localStorage:', loadedData);
            surveyData = loadedData;
        } else {
            console.log('No survey data in localStorage. Fetching initial data...');
            surveyData = await fetchSurveyData();
        }

        // --- New: Process URL Query Parameters ---
        const params = new URLSearchParams(window.location.search);
        const surveyName = params.get('surveyName');
        const displayTitle = params.get('displayTitle');
        const memo = params.get('memo');
        const periodStart = params.get('periodStart');
        const periodEnd = params.get('periodEnd');

        if (surveyName) {
            surveyData.name.ja = surveyName;
            document.getElementById('surveyName').value = surveyName;
        }
        if (displayTitle) {
            surveyData.displayTitle.ja = displayTitle;
            document.getElementById('displayTitle').value = displayTitle;
        }
        if (memo) {
            surveyData.memo = memo;
            document.getElementById('memo').value = memo;
        }
        if (periodStart) {
            surveyData.periodStart = periodStart;
            document.getElementById('periodStart').value = periodStart;
        }
        if (periodEnd) {
            surveyData.periodEnd = periodEnd;
            document.getElementById('periodEnd').value = periodEnd;
        }
        // --- End New ---

        // Set initial language from global state
        currentLang = window.getCurrentLanguage ? window.getCurrentLanguage() : 'ja';
        switchLanguage(currentLang);

        restoreAccordionState(); // アコーディオンの状態を復元
        // FABの初期化とアクションの紐付け
        const fabActions = {
            onAddQuestion: (questionType) => handleAddNewQuestion(null, questionType), // グループIDはnullで渡す（最後のグループに追加するロジック）
            onAddGroup: () => handleAddNewQuestionGroup()
        };
        initializeFab('fab-container', 'components/fab.html', fabActions);

    } catch (error) {
        console.error('Failed to initialize page:', error);
        displayErrorMessage();
    }
}


/**
 * アコーディオンの開閉状態をlocalStorageに保存する
 * @param {string} id - アコーディオンコンテンツのID
 * @param {boolean} isOpen - 開いているかどうか
 */
function saveAccordionState(id, isOpen) {
    localStorage.setItem(`accordionState_${id}`, isOpen);
}

/**
 * localStorageからアコーディオンの開閉状態を復元する
 */
function restoreAccordionState() {
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const contentId = header.dataset.accordionTarget;
        const content = document.getElementById(contentId);
        const icon = header.querySelector('.expand-icon');
        if (content && localStorage.getItem(`accordionState_${contentId}`) === 'false') {
            content.style.display = 'none';
            icon.textContent = 'expand_more';
        } else if (content) {
            content.style.display = 'block';
            icon.textContent = 'expand_less';
        }
    });
}

/**
 * アコーディオンの初期化処理
 */
function initializeAccordion() {
    document.body.addEventListener('click', (event) => {
        const header = event.target.closest('.accordion-header');
        if (!header) return;

        const contentId = header.dataset.accordionTarget;
        const content = document.getElementById(contentId);
        const icon = header.querySelector('.expand-icon');

        if (content) {
            const isOpen = content.style.display === 'block';
            content.style.display = isOpen ? 'none' : 'block';
            icon.textContent = isOpen ? 'expand_more' : 'expand_less';
            saveAccordionState(contentId, !isOpen);
        }
    });
}

/**
 * イベントリスナーを登録する
 */
function setupEventListeners() {
    initializeAccordion();

    // --- Global Language Change Listener ---
    document.addEventListener('languagechange', (e) => {
        switchLanguage(e.detail.lang);
    });

    // --- Delegated Click-to-Action Listeners ---
    document.body.addEventListener('click', (event) => {
        const target = event.target;
        const langTabButton = target.closest('.lang-tab-button');
        const addGroupBtn = target.closest('#addQuestionGroupBtn'); // Assuming a button with this ID exists
        const deleteGroupBtn = target.closest('.delete-group-btn');
        const duplicateGroupBtn = target.closest('.duplicate-group-btn');
        const addQuestionBtn = target.closest('.add-question-btn');
        const deleteQuestionBtn = target.closest('.delete-question-btn');
        const duplicateQuestionBtn = target.closest('.duplicate-question-btn');
        const addOptionBtn = target.closest('.add-option-btn');
        const deleteOptionBtn = target.closest('.delete-option-btn');

        if (langTabButton) {
            switchLanguage(langTabButton.dataset.lang);
            return; // Stop further processing
        }
        if (addGroupBtn) {
            handleAddNewQuestionGroup();
            return;
        }
        if (deleteGroupBtn) {
            const groupId = deleteGroupBtn.closest('.question-group').dataset.groupId;
            handleDeleteQuestionGroup(groupId);
            return;
        }
        if (duplicateGroupBtn) {
            const groupId = duplicateGroupBtn.closest('.question-group').dataset.groupId;
            handleDuplicateQuestionGroup(groupId);
            return;
        }
        if (addQuestionBtn) {
            const groupId = addQuestionBtn.closest('.question-group').dataset.groupId;
            const questionType = 'free_answer'; // Example type, should be determined from UI
            handleAddNewQuestion(groupId, questionType);
            return;
        }
        if (deleteQuestionBtn) {
            const groupId = deleteQuestionBtn.closest('.question-group').dataset.groupId;
            const questionId = deleteQuestionBtn.closest('.question-item').dataset.questionId;
            handleDeleteQuestion(groupId, questionId);
            return;
        }
        if (duplicateQuestionBtn) {
            const groupId = duplicateQuestionBtn.closest('.question-group').dataset.groupId;
            const questionId = duplicateQuestionBtn.closest('.question-item').dataset.questionId;
            handleDuplicateQuestion(groupId, questionId);
            return;
        }
        if (addOptionBtn) {
            const groupId = addOptionBtn.closest('.question-group').dataset.groupId;
            const questionId = addOptionBtn.closest('.question-item').dataset.questionId;
            handleAddOption(groupId, questionId);
            return;
        }
        if (deleteOptionBtn) {
            const groupId = deleteOptionBtn.closest('.question-group').dataset.groupId;
            const questionId = deleteOptionBtn.closest('.question-item').dataset.questionId;
            // This needs index, which is harder with delegation. A direct listener in render might be better here.
            // For now, let's assume we can get it.
            const optionIndex = Array.from(deleteOptionBtn.closest('.options-container').children).indexOf(deleteOptionBtn.closest('.option-item'));
            handleDeleteOption(groupId, questionId, optionIndex);
            return;
        }
    });

    // アンケートを保存ボタンのイベントリスナー
    const createSurveyBtn = document.getElementById('createSurveyBtn');
    if (createSurveyBtn) {
        createSurveyBtn.addEventListener('click', () => {
            saveSurveyDataToLocalStorage(surveyData);
            console.log('Saved Survey Data to localStorage:', surveyData);
            alert('アンケートデータがlocalStorageに保存されました！');
        });
    }
}

// --- Data Manipulation Handlers ---

function handleAddNewQuestionGroup() {
    if (!surveyData.questionGroups) surveyData.questionGroups = [];
    const newGroup = {
        groupId: `group_${Date.now()}`,
        title: { ja: '新しい質問グループ', en: 'New Question Group' },
        questions: []
    };
    surveyData.questionGroups.push(newGroup);
    updateAndRenderAll();
}

function handleDeleteQuestionGroup(groupId) {
    if (!confirm('この質問グループを削除してもよろしいですか？')) return;
    surveyData.questionGroups = surveyData.questionGroups.filter(g => g.groupId !== groupId);
    updateAndRenderAll();
}

function handleDuplicateQuestionGroup(groupId) {
    const groupToDuplicate = surveyData.questionGroups.find(g => g.groupId === groupId);
    if (!groupToDuplicate) return;
    const newGroup = JSON.parse(JSON.stringify(groupToDuplicate)); // Deep copy
    newGroup.groupId = `group_${Date.now()}`;
    newGroup.questions.forEach(q => q.questionId = `q_${Date.now()}_${Math.random()}`);
    const index = surveyData.questionGroups.findIndex(g => g.groupId === groupId);
    surveyData.questionGroups.splice(index + 1, 0, newGroup);
    updateAndRenderAll();
}

function handleAddNewQuestion(groupId, questionType) {
    const group = surveyData.questionGroups.find(g => g.groupId === groupId);
    if (!group) return;
    if (!group.questions) group.questions = [];
    const newQuestion = {
        questionId: `q_${Date.now()}`,
        type: questionType,
        text: { ja: '新しい質問', en: 'New Question' },
        required: false,
        options: (questionType === 'single_answer' || questionType === 'multi_answer') ? [] : undefined
    };
    group.questions.push(newQuestion);
    updateAndRenderAll();
}

function handleDeleteQuestion(groupId, questionId) {
    const group = surveyData.questionGroups.find(g => g.groupId === groupId);
    if (group && confirm('この質問を削除してもよろしいですか？')) {
        group.questions = group.questions.filter(q => q.questionId !== questionId);
        updateAndRenderAll();
    }
}

function handleDuplicateQuestion(groupId, questionId) {
    const group = surveyData.questionGroups.find(g => g.groupId === groupId);
    if (!group) return;
    const questionToDuplicate = group.questions.find(q => q.questionId === questionId);
    if (!questionToDuplicate) return;
    const newQuestion = JSON.parse(JSON.stringify(questionToDuplicate));
    newQuestion.questionId = `q_${Date.now()}`;
    const index = group.questions.findIndex(q => q.questionId === questionId);
    group.questions.splice(index + 1, 0, newQuestion);
    updateAndRenderAll();
}

function handleAddOption(groupId, questionId) {
    const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
    if (question && question.options) {
        question.options.push({ text: { ja: '新しい選択肢', en: 'New Option' } });
        updateAndRenderAll();
    }
}

function handleDeleteOption(groupId, questionId, optionIndex) {
    const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
    if (question && question.options) {
        question.options.splice(optionIndex, 1);
        updateAndRenderAll();
    }
}

/**
 * フォームの必須項目を検証し、保存ボタンの有効/無効を切り替える。
 */
function validateFormForSaveButton() {
    const saveButton = document.getElementById('createSurveyBtn');
    if (!saveButton) return;

    // For multilingual, we check the required fields in the default language (e.g., Japanese)
    const requiredFields = [
        surveyData.name?.ja,
        surveyData.displayTitle?.ja,
        surveyData.periodStart,
        surveyData.periodEnd
    ];

    let allValid = requiredFields.every(fieldValue => fieldValue && fieldValue.trim() !== '');
    
    // Also check required questions
    surveyData.questionGroups?.forEach(group => {
        group.questions?.forEach(question => {
            if (question.required) {
                if (!question.text?.ja || question.text.ja.trim() === '') {
                    allValid = false;
                }
            }
        });
    });

    saveButton.disabled = !allValid;
}

// DOMの読み込みが完了したら処理を開始
document.addEventListener('DOMContentLoaded', () => {
    initializePage();
    setupEventListeners();
});