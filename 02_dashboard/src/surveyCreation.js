import { handleOpenModal } from './modalHandler.js';
import { openAccountInfoModal } from './accountInfoModal.js';
import { initSidebarHandler } from './sidebarHandler.js';
import { initBreadcrumbs } from './breadcrumb.js';
import { initThemeToggle } from './themeToggle.js';
import { fetchSurveyData, saveSurveyDataToLocalStorage, loadSurveyDataFromLocalStorage } from './services/surveyService.js';
import { 
    populateBasicInfo, 
    renderAllQuestionGroups, 
    displayErrorMessage, 
    renderOutlineMap 
} from './ui/surveyRenderer.js';
import { initializeFab } from './ui/fab.js';
import { loadCommonHtml } from './utils.js';
import { showToast } from './utils.js';

// --- Global State ---
let surveyData = {};
let currentLang = 'ja';
let currentSurveyId = null;

// --- Utility Functions ---
window.getCurrentLanguage = () => currentLang;
window.getSurveyData = () => surveyData;
// Expose commonly used handlers for inline HTML in common partials
window.openAccountInfoModal = openAccountInfoModal;
window.handleOpenModal = handleOpenModal;

// --- Language Switcher ---
function initLanguageSwitcher() {
    const languageSwitcherButton = document.getElementById('language-switcher-button');
    const languageSwitcherDropdown = document.getElementById('language-switcher-dropdown');
    const currentLanguageText = document.getElementById('current-language-text');

    if (!languageSwitcherButton || !languageSwitcherDropdown || !currentLanguageText) {
        return;
    }

    const setLanguage = (lang) => {
        localStorage.setItem('language', lang);
        document.documentElement.lang = lang;
        currentLanguageText.textContent = lang === 'ja' ? '日本語' : 'English';
        // update local state then notify
        currentLang = lang;
        document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
        languageSwitcherDropdown.classList.add('hidden');
    };

    languageSwitcherButton.addEventListener('click', (e) => {
        e.stopPropagation();
        languageSwitcherDropdown.classList.toggle('hidden');
        languageSwitcherButton.setAttribute('aria-expanded', languageSwitcherDropdown.classList.contains('hidden') ? 'false' : 'true');
    });

    document.addEventListener('click', () => {
        if (!languageSwitcherDropdown.classList.contains('hidden')) {
            languageSwitcherDropdown.classList.add('hidden');
            languageSwitcherButton.setAttribute('aria-expanded', 'false');
        }
    });

    languageSwitcherDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.target.closest('a[data-lang]');
        if (target) {
            const lang = target.getAttribute('data-lang');
            setLanguage(lang);
        }
    });

    // initial
    const initial = localStorage.getItem('language') || 'ja';
    setLanguage(initial);
}

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
    // Initialize Sortable after rendering
    setupSortables();
}

/**
 * ページの初期化処理
 */
async function initializePage() {
    try {
        await Promise.all([
            loadCommonHtml('header-placeholder', 'common/header.html'),
            loadCommonHtml('sidebar-placeholder', 'common/sidebar.html', initSidebarHandler),
            loadCommonHtml('footer-placeholder', 'common/footer.html', () => {
                const btn = document.getElementById('openContactModalBtn');
                if (btn) btn.addEventListener('click', () => handleOpenModal('contactModal', 'modals/contactModal.html'));
            })
        ]);

        // Initialize global UI helpers present across pages
        initThemeToggle();
        initBreadcrumbs();
        initLanguageSwitcher();

        // Load keyed data by surveyId if present (local-only)
        try {
            currentSurveyId = (new URLSearchParams(window.location.search)).get('surveyId');
            if (currentSurveyId) {
                const keyed = localStorage.getItem(`surveyData_${currentSurveyId}`);
                if (keyed) {
                    surveyData = JSON.parse(keyed);
                    console.log('Loaded survey data (by surveyId) from localStorage:', currentSurveyId);
                }
            }
        } catch (e) {
            console.warn('Failed to load keyed survey data:', e);
        }

        if (!surveyData || Object.keys(surveyData).length === 0) {
            const loadedData = loadSurveyDataFromLocalStorage();
            if (loadedData) {
                console.log('Loaded survey data from localStorage:', loadedData);
                surveyData = loadedData;
            } else {
                console.log('No survey data in localStorage. Fetching initial data...');
                surveyData = await fetchSurveyData();
            }
        }

        // --- New: Process URL Query Parameters ---
        const params = new URLSearchParams(window.location.search);
        const surveyName = params.get('surveyName');
        const displayTitle = params.get('displayTitle');
        const memo = params.get('memo');
        const periodStart = params.get('periodStart');
        const periodEnd = params.get('periodEnd');

        if (surveyName) {
            if (typeof surveyData.name !== 'object' || surveyData.name === null) surveyData.name = {};
            surveyData.name.ja = surveyName;
        }
        if (displayTitle) {
            if (typeof surveyData.displayTitle !== 'object' || surveyData.displayTitle === null) surveyData.displayTitle = {};
            surveyData.displayTitle.ja = displayTitle;
        }
        if (memo) {
            surveyData.memo = memo;
        }
        if (periodStart) {
            surveyData.periodStart = periodStart;
        }
        if (periodEnd) {
            surveyData.periodEnd = periodEnd;
        }
        // --- End New ---

        updateAndRenderAll();

        restoreAccordionState(); // アコーディオンの状態を復元
        // FABの初期化とアクションの紐付け
        const fabActions = {
            onAddQuestion: (questionType) => handleAddNewQuestion(null, questionType), // グループIDはnullで渡す（最後のグループに追加するロジック）
            onAddGroup: () => handleAddNewQuestionGroup()
        };
        initializeFab('fab-container', 'components/fab.html', fabActions);

    } catch (error) {
        console.error('Failed to initialize page:', error);
        console.error('Error details:', error.message, error.stack); // エラーの詳細を追加
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

    // --- Delegated Click-to-Action Listeners ---
    document.body.addEventListener('click', (event) => {
        const target = event.target;
        const deleteGroupBtn = target.closest('.delete-group-btn');
        const duplicateGroupBtn = target.closest('.duplicate-group-btn');
        const addQuestionBtn = target.closest('.add-question-btn');
        const deleteQuestionBtn = target.closest('.delete-question-btn');
        const duplicateQuestionBtn = target.closest('.duplicate-question-btn');
        const addOptionBtn = target.closest('.add-option-btn');
        const deleteOptionBtn = target.closest('.delete-option-btn');

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
            if (currentSurveyId) {
                try {
                    localStorage.setItem(`surveyData_${currentSurveyId}`, JSON.stringify(surveyData));
                } catch (e) {
                    console.error('Failed to save keyed survey data:', e);
                }
            }
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
        title: { ja: '新しい質問グループ', en: '' },
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
    let targetGroup;
    if (groupId) {
        targetGroup = surveyData.questionGroups.find(g => g.groupId === groupId);
    } else {
        // If groupId is null, add to the last group
        if (!surveyData.questionGroups || surveyData.questionGroups.length === 0) {
            handleAddNewQuestionGroup(); // Create a new group if none exist
        }
        targetGroup = surveyData.questionGroups[surveyData.questionGroups.length - 1];
    }

    if (!targetGroup) return; // Should not happen if handleAddNewQuestionGroup is called

    if (!targetGroup.questions) targetGroup.questions = [];
    const newQuestion = {
        questionId: `q_${Date.now()}`,
        type: questionType,
        text: { ja: '新しい質問', en: '' },
        required: false,
        options: (questionType === 'single_answer' || questionType === 'multi_answer') ? [] : undefined
    };
    targetGroup.questions.push(newQuestion);
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
        question.options.push({ text: { ja: '新しい選択肢', en: '' } });
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
    console.log('DOMContentLoaded event fired. Initializing page...'); // 追加
    initializePage();
    console.log('Page initialized. Setting up event listeners...'); // 追加
    setupEventListeners();
    console.log('Event listeners set up. Attaching preview listener...'); // 追加
    attachPreviewListener();
    // Re-render on language change
    document.addEventListener('languagechange', (e) => {
        const lang = (e && e.detail && e.detail.lang) ? e.detail.lang : (localStorage.getItem('language') || 'ja');
        currentLang = lang;
        try {
            if (window.flatpickr) {
                if (lang === 'ja' && window.flatpickr.l10ns && window.flatpickr.l10ns.ja) {
                    window.flatpickr.localize(window.flatpickr.l10ns.ja);
                } else {
                    // Reset to default (en)
                    window.flatpickr.localize(window.flatpickr.l10ns.default || {});
                }
            }
        } catch (_) { /* noop */ }
        updateAndRenderAll();
    });
});

// プレビューのイベントを付与
function attachPreviewListener() {
    const previewBtn = document.getElementById('showPreviewBtn');
    if (!previewBtn) return;
    previewBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await handleOpenModal('surveyPreviewModal', 'modals/surveyPreviewModal.html');
            renderSurveyPreview();
        } catch (err) {
            console.error('Failed to open preview modal:', err);
        }
    });
}

// --- Drag & Drop (Sortable) ---
function arrayMove(arr, from, to) {
    if (!arr || from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
}

function setupSortables() {
    if (typeof Sortable === 'undefined') return;

    // Group sorting
    const groupsContainer = document.getElementById('questionGroupsContainer');
    if (groupsContainer) {
        new Sortable(groupsContainer, {
            animation: 150,
            handle: '.handle',
            draggable: '.question-group',
            onEnd: (evt) => {
                arrayMove(surveyData.questionGroups, evt.oldIndex, evt.newIndex);
                updateAndRenderAll();
            }
        });
    }

    // For each group: question sorting and option sorting
    document.querySelectorAll('.question-group').forEach(groupEl => {
        const groupId = groupEl.dataset.groupId;
        const questionsList = groupEl.querySelector('.questions-list');
        if (questionsList) {
            new Sortable(questionsList, {
                animation: 150,
                handle: '.handle',
                draggable: '.question-item',
                onEnd: (evt) => {
                    const group = surveyData.questionGroups.find(g => g.groupId === groupId);
                    if (!group || !group.questions) return;
                    arrayMove(group.questions, evt.oldIndex, evt.newIndex);
                    updateAndRenderAll();
                }
            });
        }

        // Option sorting per question (if options exist)
        groupEl.querySelectorAll('.question-item').forEach(qItem => {
            const questionId = qItem.dataset.questionId;
            const optionsContainer = qItem.querySelector('.options-container');
            if (!optionsContainer) return;
            new Sortable(optionsContainer, {
                animation: 150,
                draggable: '.option-item',
                onEnd: (evt) => {
                    const group = surveyData.questionGroups.find(g => g.groupId === groupId);
                    const question = group?.questions?.find(q => q.questionId === questionId);
                    if (!question || !question.options) return;
                    arrayMove(question.options, evt.oldIndex, evt.newIndex);
                    updateAndRenderAll();
                }
            });
        });
    });
}

// --- Preview Rendering ---
function getTextLocal(field, lang = 'ja') {
    if (typeof field === 'object' && field !== null) {
        return field[lang] || field.ja || '';
    }
    return field || '';
}

function renderSurveyPreview() {
    const container = document.getElementById('modalSurveyPreviewContainer');
    if (!container) return;

    const lang = 'ja';
    const lines = [];
    lines.push(`<div class="space-y-3">`);
    lines.push(`<div>
        <div class=\"text-xl font-semibold text-on-surface\">${getTextLocal(surveyData.displayTitle, lang) || getTextLocal(surveyData.name, lang) || '（無題アンケート）'}</div>
        <div class=\"text-on-surface-variant text-sm\">${surveyData.periodStart || ''} ${(surveyData.periodStart || surveyData.periodEnd) ? '〜' : ''} ${surveyData.periodEnd || ''}</div>
    </div>`);
    if (surveyData.description) {
        lines.push(`<p class=\"text-on-surface-variant\">${getTextLocal(surveyData.description, lang)}</p>`);
    }

    (surveyData.questionGroups || []).forEach((g, gi) => {
        lines.push(`<div class=\"mt-4\">
            <h3 class=\"text-on-surface font-bold mb-2\">${getTextLocal(g.title, lang) || `グループ${gi + 1}`}</h3>
        </div>`);
        (g.questions || []).forEach((q, qi) => {
            const qTitle = getTextLocal(q.text, lang) || `設問${qi + 1}`;
            lines.push(`<div class=\"mb-3\">
                <div class=\"text-on-surface font-medium\">Q${qi + 1}. ${qTitle} ${q.required ? '<span class=\"text-error text-xs\"(必須)</span>' : ''}</div>`);
            if (q.options && q.options.length) {
                lines.push('<ul class="list-disc ml-6 text-on-surface-variant">');
                q.options.forEach(opt => {
                    lines.push(`<li>${getTextLocal(opt.text, lang)}</li>`);
                });
                lines.push('</ul>');
            }
            lines.push(`</div>`);
        });
    });
    lines.push(`</div>`);

        container.innerHTML = lines.join('\n');

}
