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
import { initializeDatepickers } from './ui/datepicker.js';
import { loadCommonHtml, showToast, resolveDashboardDataPath, resolveDemoDataPath } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';

// --- Global State ---
let surveyData = {};
let currentLang = 'ja';
let currentSurveyId = null;
let isDirty = false; // To track unsaved changes
const ADDITIONAL_SETTINGS_CONFIG = [
    { id: 'openBizcardSettingsBtn', path: 'bizcardSettings.html', feature: 'bizcard' },
    { id: 'openThankYouEmailSettingsBtn', path: 'thankYouEmailSettings.html', feature: 'thankYouEmail' },
    { id: 'openThankYouScreenSettingsBtn', path: 'thankYouScreenSettings.html', feature: 'thankYouScreen' }
];
const additionalSettingsButtons = new Map();

// --- Dirty State Management ---
function setDirty(dirty) {
    if (isDirty !== dirty) {
        isDirty = dirty;
    }
}

window.addEventListener('beforeunload', (event) => {
    if (isDirty) {
        event.preventDefault();
        event.returnValue = ''; // For legacy browsers
    }
});

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

    // --- Delegated Change Listeners ---
    document.body.addEventListener('change', (event) => {
        const select = event.target.closest('.question-type-select');
        if (select) {
            const questionItem = select.closest('.question-item');
            const groupEl = select.closest('.question-group');
            if (!questionItem || !groupEl) return;
            const groupId = groupEl.dataset.groupId;
            const questionId = questionItem.dataset.questionId;
            const newType = select.value;
            handleChangeQuestionType(groupId, questionId, newType);
            return;
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

function registerAdditionalSettingsLinks() {
    ADDITIONAL_SETTINGS_CONFIG.forEach(({ id, path, feature }) => {
        const button = document.getElementById(id);
        if (!button) {
            return;
        }
        if (!additionalSettingsButtons.has(feature)) {
            additionalSettingsButtons.set(feature, button);
        }
        if (button.dataset.settingsLinkInitialized === 'true') {
            return;
        }
        button.dataset.settingsLinkInitialized = 'true';
        button.addEventListener('click', (event) => {
            event.preventDefault();
            if (!currentSurveyId) {
                showToast('アンケートIDが未設定です。先にアンケートを保存してください。', 'error');
                return;
            }
            const url = `${path}?surveyId=${encodeURIComponent(currentSurveyId)}`;
            window.location.href = url;
        });
    });
    updateAdditionalSettingsAvailability();
}

const ADDITIONAL_SETTINGS_MESSAGES = {
    requireSurveyId: 'アンケートIDを発行後に利用できます。',
    requireBizcard: '名刺撮影依頼を有効にすると利用できます。'
};

window.addEventListener('storage', (event) => {
    if (!currentSurveyId) {
        return;
    }
    if (event && event.key === `thankYouScreenSettings_${currentSurveyId}`) {
        updateAdditionalSettingsAvailability();
    }
});

function loadThankYouScreenSettingsFromStorage(surveyId) {
    if (!surveyId) {
        return null;
    }
    try {
        const raw = localStorage.getItem(`thankYouScreenSettings_${surveyId}`);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        console.warn('Failed to parse thank-you screen settings from storage:', error);
        return null;
    }
}

function setAdditionalSettingsButtonState(feature, disabled, message) {
    const button = additionalSettingsButtons.get(feature);
    if (!button) {
        return;
    }
    button.disabled = !!disabled;
    if (disabled) {
        button.setAttribute('aria-disabled', 'true');
        if (message) {
            button.setAttribute('title', message);
        } else {
            button.removeAttribute('title');
        }
    } else {
        button.removeAttribute('aria-disabled');
        button.removeAttribute('title');
    }
}

function updateAdditionalSettingsAvailability() {
    if (!currentSurveyId) {
        additionalSettingsButtons.forEach((_, feature) => {
            setAdditionalSettingsButtonState(feature, true, ADDITIONAL_SETTINGS_MESSAGES.requireSurveyId);
        });
        return;
    }

    const storedSettings = loadThankYouScreenSettingsFromStorage(currentSurveyId);
    const bizcardEnabled = storedSettings ? storedSettings.requestBusinessCardPhoto !== false : true;

    additionalSettingsButtons.forEach((_, feature) => {
        if (feature === 'thankYouScreen') {
            setAdditionalSettingsButtonState(feature, false);
            return;
        }
        if (!bizcardEnabled && (feature === 'bizcard' || feature === 'thankYouEmail')) {
            setAdditionalSettingsButtonState(feature, true, ADDITIONAL_SETTINGS_MESSAGES.requireBizcard);
        } else {
            setAdditionalSettingsButtonState(feature, false);
        }
    });
}

// ダミ'ーユーザーデータ (本来はAPIから取得)
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
    // Ensure accordion headers are accessible (ARIA) after each render
    enhanceAccordionA11y();
}

// --- Input Bindings ---
function getStr(value) {
    if (value && typeof value === 'object') {
        return value.ja || value.en || '';
    }
    return value || '';
}

function deepNormalizeSurveyData(data) {
    if (!data) return data;
    data.name = getStr(data.name);
    data.displayTitle = getStr(data.displayTitle);
    data.description = getStr(data.description);
    if (Array.isArray(data.questionGroups)) {
        data.questionGroups.forEach(g => {
            g.title = getStr(g.title);
            if (Array.isArray(g.questions)) {
                g.questions.forEach(q => {
                    q.text = getStr(q.text);
                    if (Array.isArray(q.options)) {
                        q.options.forEach(o => { o.text = getStr(o.text); });
                    }
                    if (q.matrix) {
                        if (Array.isArray(q.matrix.rows)) q.matrix.rows.forEach(r => { r.text = getStr(r.text); });
                        if (Array.isArray(q.matrix.cols)) q.matrix.cols.forEach(c => { c.text = getStr(c.text); });
                    }
                });
            }
        });
    }
    return data;
}
function setDeep(target, path, value) {
    if (!target || !path || path.length === 0) return;
    let obj = target;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        if (typeof obj[key] !== 'object' || obj[key] === null) obj[key] = {};
        obj = obj[key];
    }
    obj[path[path.length - 1]] = value;
}

function setupInputBindings() {
    // Basic info bindings (static DOM)
    const bind = (id, path) => {
        const el = document.getElementById(id);
        if (!el) return;
        const handler = () => {
            setDeep(surveyData, path, el.value || '');
            validateFormForSaveButton();
            setDirty(true);
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    };

    // single-language: bind only JA fields into string properties
    const bindStr = (id, key) => {
        const el = document.getElementById(id);
        if (!el) return;
        const handler = () => {
            surveyData[key] = el.value || '';
            validateFormForSaveButton();
            setDirty(true);
        };
        el.addEventListener('input', handler);
        el.addEventListener('change', handler);
    };
    bindStr('surveyName_ja', 'name');
    bindStr('displayTitle_ja', 'displayTitle');
    // descriptions may be optional
    const descJa = document.getElementById('description_ja');
    if (descJa) {
        const h = () => { 
            surveyData.description = descJa.value || ''; 
            setDirty(true);
        };
        descJa.addEventListener('input', h);
        descJa.addEventListener('change', h);
    }
    bind('periodStart', ['periodStart']);
    bind('periodEnd', ['periodEnd']);
    bind('deadline', ['deadline']);
    bind('memo', ['memo']);

    const planEl = document.getElementById('plan');
    if (planEl) {
        const onPlan = () => { 
            surveyData.plan = planEl.value; 
            validateFormForSaveButton(); 
            setDirty(true);
        };
        planEl.addEventListener('change', onPlan);
    }

    // Dynamic bindings via delegation (groups/questions/options)
    const container = document.getElementById('questionGroupsContainer');
    if (!container) return;

    container.addEventListener('input', (e) => {
        const target = e.target;
        // Group title
        if (target.classList.contains('group-title-input')) {
            const groupEl = target.closest('.question-group');
            if (!groupEl) return;
            const groupId = groupEl.dataset.groupId;
            const group = (surveyData.questionGroups || []).find(g => g.groupId === groupId);
            if (group) {
                group.title = target.value || '';
                setDirty(true);
            }
            return;
        }

        // Question text
        if (target.classList.contains('question-text-input')) {
            const qItem = target.closest('.question-item');
            const groupEl = target.closest('.question-group');
            if (!qItem || !groupEl) return;
            const groupId = groupEl.dataset.groupId;
            const questionId = qItem.dataset.questionId;
            const group = (surveyData.questionGroups || []).find(g => g.groupId === groupId);
            const question = group?.questions?.find(q => q.questionId === questionId);
            if (question) {
                question.text = target.value || '';
                setDirty(true);
            }
            return;
        }

        // Option text
        if (target.classList.contains('option-text-input')) {
            const optionItem = target.closest('.option-item');
            const qItem = target.closest('.question-item');
            const groupEl = target.closest('.question-group');
            if (!optionItem || !qItem || !groupEl) return;
            const groupId = groupEl.dataset.groupId;
            const questionId = qItem.dataset.questionId;
            const optionItems = qItem.querySelectorAll('.options-container .option-item');
            const optionIndex = Array.from(optionItems).indexOf(optionItem);
            const group = (surveyData.questionGroups || []).find(g => g.groupId === groupId);
            const question = group?.questions?.find(q => q.questionId === questionId);
            if (question && Array.isArray(question.options) && optionIndex > -1 && optionIndex < question.options.length) {
                question.options[optionIndex].text = target.value || '';
                setDirty(true);
            }
            return;
        }

        // Matrix row input
        if (target.classList.contains('matrix-row-input')) {
            const groupEl = target.closest('.question-group');
            const qItem = target.closest('.question-item');
            if (!groupEl || !qItem) return;
            const groupId = groupEl.dataset.groupId;
            const questionId = qItem.dataset.questionId;
            const index = parseInt(target.getAttribute('data-index'), 10) || 0;
            const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
            if (question && question.matrix && question.matrix.rows && question.matrix.rows[index]) {
                question.matrix.rows[index].text = target.value || '';
                setDirty(true);
            }
            return;
        }

        // Matrix col input
        if (target.classList.contains('matrix-col-input')) {
            const groupEl = target.closest('.question-group');
            const qItem = target.closest('.question-item');
            if (!groupEl || !qItem) return;
            const groupId = groupEl.dataset.groupId;
            const questionId = qItem.dataset.questionId;
            const index = parseInt(target.getAttribute('data-index'), 10) || 0;
            const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
            if (question && question.matrix && question.matrix.cols && question.matrix.cols[index]) {
                question.matrix.cols[index].text = target.value || '';
                setDirty(true);
            }
            return;
        }
    });
}

// --- Data Fetching & Mapping Utilities ---
async function fetchJson(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch ${url}: ${response.statusText}`);
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching or parsing ${url}:`, error);
        return null;
    }
}

const normalizeMultilingual = (field) => {
    if (typeof field === 'string') {
        return { ja: field, en: '' };
    }
    return field || { ja: '', en: '' };
};

const mapEnqueteToQuestions = (enqueteDetails) => {
    if (!enqueteDetails || !Array.isArray(enqueteDetails.details)) {
        return [];
    }

    const typeMapping = {
        free_text: 'free_answer',
        text: 'free_answer',
        single_choice: 'single_answer',
        multi_choice: 'multi_answer',
        number: 'number_answer',
        matrix_single: 'matrix_sa',
        matrix_multi: 'matrix_ma',
    };

    const questions = enqueteDetails.details.map((item, index) => {
        const questionId = `q_${Date.now()}_${index}`;
        const mappedType = typeMapping[item.type] || 'free_answer';
        const question = {
            questionId,
            type: mappedType,
            text: normalizeMultilingual(item.text),
            required: item.required || false,
        };

        if (item.options && Array.isArray(item.options)) {
            question.options = item.options.map((opt, optIndex) => ({
                optionId: `opt_${questionId}_${optIndex}`,
                text: normalizeMultilingual(opt),
            }));
        }

        return question;
    });

    return [{
        groupId: 'group_from_enquete',
        title: { ja: '取り込み設問', en: 'Imported Questions' },
        questions: questions,
    }];
};

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

        initThemeToggle();
        initBreadcrumbs();
        initLanguageSwitcher();
        // Initialize date pickers for period/deadline fields
        try { initializeDatepickers(); } catch (_) {}

        const params = new URLSearchParams(window.location.search);
        currentSurveyId = params.get('surveyId');

        registerAdditionalSettingsLinks();
        updateAdditionalSettingsAvailability();

        // 1. Try loading from localStorage keyed by surveyId
        if (currentSurveyId) {
            const keyedData = localStorage.getItem(`surveyData_${currentSurveyId}`);
            if (keyedData) {
                surveyData = JSON.parse(keyedData);
                
            }
        }

        // 2. If not found, try loading generic data from localStorage
        if (!surveyData || Object.keys(surveyData).length === 0) {
            const genericData = loadSurveyDataFromLocalStorage(); // from surveyCreationData
            if (genericData) {
                surveyData = genericData;
                
            }
        }

        // 3. If still empty and surveyId is present, load from JSON files
        if ((!surveyData || Object.keys(surveyData).length === 0) && currentSurveyId) {
            

            // Load canonical dataset from `/data/`
            let surveysList = await fetchJson(resolveDashboardDataPath('core/surveys.json'));
            let surveyInfo = surveysList?.find(s => s.id === currentSurveyId) || null;
            let enqueteDetails = null;

            if (surveyInfo) {
                enqueteDetails = await fetchJson(resolveDashboardDataPath(`demos/sample-3/Enquete/${currentSurveyId}.json`));
            }

            // Re-fetch canonical surveys list to ensure metadata is available
            if (!surveyInfo) {
                surveysList = await fetchJson(resolveDashboardDataPath('core/surveys.json'));
                surveyInfo = surveysList?.find(s => s.id === currentSurveyId) || null;
            }

            // Fallback: sample Enquete payloads
            if (!enqueteDetails) {
                enqueteDetails = await fetchJson(resolveDemoDataPath(`surveys/${currentSurveyId}.json`));
            }

            if (enqueteDetails) {
                // If meta not available, derive from details file
                const name = enqueteDetails.name || { ja: currentSurveyId, en: '' };
                const displayTitle = enqueteDetails.displayTitle || name;
                const description = enqueteDetails.description || { ja: '', en: '' };
                surveyData = {
                    id: currentSurveyId,
                    name: getStr(name),
                    displayTitle: getStr(displayTitle),
                    description: getStr(description),
                    memo: surveyInfo?.memo || '',
                    periodStart: surveyInfo?.periodStart || enqueteDetails.periodStart || '',
                    periodEnd: surveyInfo?.periodEnd || enqueteDetails.periodEnd || '',
                    plan: surveyInfo?.plan || 'Standard',
                    deadline: surveyInfo?.deadline || '',
                    questionGroups: mapEnqueteToQuestions(enqueteDetails),
                };
                // Ensure group title is readable Japanese by default
                if (surveyData.questionGroups && surveyData.questionGroups.length > 0) {
                    surveyData.questionGroups[0].title = surveyData.questionGroups[0].title || { ja: 'インポートされた設問', en: 'Imported Questions' };
                    if (typeof surveyData.questionGroups[0].title === 'object') {
                        surveyData.questionGroups[0].title.ja = surveyData.questionGroups[0].title.ja || 'インポートされた設問';
                        surveyData.questionGroups[0].title.en = surveyData.questionGroups[0].title.en || 'Imported Questions';
                    }
                }
                

            } else {
                console.warn(`Survey with id "${currentSurveyId}" not found in any known source.`);
                showToast(`Survey not found: ${currentSurveyId}`, 'error', 3000);
            }
        }

        // 4. If still no data, fall back to the default template
        if (!surveyData || Object.keys(surveyData).length === 0) {
            console.log('No survey data found. Fetching fallback template...');
            surveyData = await fetchSurveyData(); // Reads data/surveys/sample_survey.json
        }

        // Always apply URL query parameter overrides
        const surveyName = params.get('surveyName');
        const displayTitle = params.get('displayTitle');
        const memo = params.get('memo');
        const periodStart = params.get('periodStart');
        const periodEnd = params.get('periodEnd');

        if (surveyName) surveyData.name = surveyName;
        if (displayTitle) surveyData.displayTitle = displayTitle;
        if (memo) surveyData.memo = memo;
        if (periodStart) surveyData.periodStart = periodStart;
        if (periodEnd) surveyData.periodEnd = periodEnd;

        // Normalize any multilingual remnants to strings
        deepNormalizeSurveyData(surveyData);

        updateAndRenderAll();

        restoreAccordionState();
        const fabActions = {
            onAddQuestion: (questionType) => handleAddNewQuestion(null, questionType),
            onAddGroup: () => handleAddNewQuestionGroup()
        };
        initializeFab('fab-container', fabActions);

    } catch (error) {
        console.error('Failed to initialize page:', error);
        console.error('Error details:', error.message, error.stack);
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
    const accordionItems = document.querySelectorAll('.accordion-item, .question-group');
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header, .group-header');
        if (!header) return;

        const contentId = header.dataset.accordionTarget;
        const content = contentId ? document.getElementById(contentId) : item.querySelector('.accordion-content');
        const icon = header.querySelector('.expand-icon');

        if (content) {
            const isStoredOpen = localStorage.getItem(`accordionState_${contentId || item.dataset.groupId}`) !== 'false';
            
            content.classList.toggle('hidden', !isStoredOpen);
            if (icon) {
                icon.textContent = isStoredOpen ? 'expand_less' : 'expand_more';
            }
            header.setAttribute('aria-expanded', isStoredOpen ? 'true' : 'false');
        }
    });
}

/**
 * アコーディオンの初期化処理
 */
function initializeAccordion() {
    const toggle = (header) => {
        if (!header) return;
        const contentId = header.getAttribute('data-accordion-target');
        // 動的に生成されるグループヘッダーの場合、contentIdがないことがあるので、親要素からコンテンツを探す
        const content = contentId 
            ? document.getElementById(contentId) 
            : header.closest('.question-group')?.querySelector('.accordion-content');

        const icon = header.querySelector('.expand-icon');
        if (!content) return;

        const isOpen = !content.classList.contains('hidden');
        
        content.classList.toggle('hidden');
        const isNowOpen = !content.classList.contains('hidden');

        if (icon) {
            icon.textContent = isNowOpen ? 'expand_less' : 'expand_more';
        }
        header.setAttribute('aria-expanded', isNowOpen ? 'true' : 'false');
        
        // 動的グループの場合はgroupIdを、静的な場合はcontentIdをキーにする
        const storageKey = contentId || header.closest('.question-group')?.dataset.groupId;
        if (storageKey) {
            saveAccordionState(storageKey, isNowOpen);
        }
    };

    document.body.addEventListener('click', (event) => {
        const header = event.target.closest('.accordion-header, .group-header');
        if (header) {
            // inputやbuttonなど、ヘッダー内のインタラクティブな要素は除外
            if (event.target.closest('input, button, select')) {
                return;
            }
            toggle(header);
        }
    });

    document.body.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const header = event.target.closest('.accordion-header, .group-header');
        if (!header) return;
        // inputやbuttonなど、ヘッダー内のインタラクティブな要素は除外
        if (event.target.closest('input, button, select')) {
            return;
        }
        event.preventDefault();
        toggle(header);
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
            const optionsContainer = deleteOptionBtn.closest('.options-container');
            const items = optionsContainer ? Array.from(optionsContainer.querySelectorAll('.option-item')) : [];
            const optionEl = deleteOptionBtn.closest('.option-item');
            const optionIndex = items.indexOf(optionEl);
            handleDeleteOption(groupId, questionId, optionIndex);
            return;
        }

        // Matrix add/delete
        const addRowBtn = target.closest('.add-matrix-row-btn');
        if (addRowBtn) {
            const groupId = addRowBtn.closest('.question-group').dataset.groupId;
            const questionId = addRowBtn.closest('.question-item').dataset.questionId;
            handleAddMatrixRow(groupId, questionId);
            return;
        }
        const addColBtn = target.closest('.add-matrix-col-btn');
        if (addColBtn) {
            const groupId = addColBtn.closest('.question-group').dataset.groupId;
            const questionId = addColBtn.closest('.question-item').dataset.questionId;
            handleAddMatrixCol(groupId, questionId);
            return;
        }
        const delRowBtn = target.closest('.delete-matrix-row-btn');
        if (delRowBtn) {
            const groupId = delRowBtn.closest('.question-group').dataset.groupId;
            const questionId = delRowBtn.closest('.question-item').dataset.questionId;
            const idx = parseInt(delRowBtn.getAttribute('data-index'), 10) || 0;
            handleDeleteMatrixRow(groupId, questionId, idx);
            return;
        }
        const delColBtn = target.closest('.delete-matrix-col-btn');
        if (delColBtn) {
            const groupId = delColBtn.closest('.question-group').dataset.groupId;
            const questionId = delColBtn.closest('.question-item').dataset.questionId;
            const idx = parseInt(delColBtn.getAttribute('data-index'), 10) || 0;
            handleDeleteMatrixCol(groupId, questionId, idx);
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
            
            showToast('アンケートデータが保存されました。');
            setDirty(false); // Reset dirty state after successful save
        });
    }

    // キャンセルボタンのイベントリスナー
    const cancelBtn = document.getElementById('cancelCreateSurvey');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (isDirty) {
                showConfirmationModal(
                    '編集中の内容は保存されませんが、ページを離れてもよろしいですか？',
                    () => {
                        setDirty(false); // Clear dirty state before redirect
                        window.location.href = 'index.html'; // Redirect
                    },
                    '編集のキャンセル'
                );
            } else {
                window.location.href = 'index.html'; // Redirect directly if no changes
            }
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
    setDirty(true);
    updateAndRenderAll();
}

function handleDeleteQuestionGroup(groupId) {
    showConfirmationModal('この質問グループを削除してもよろしいですか？', () => {
        surveyData.questionGroups = surveyData.questionGroups.filter(g => g.groupId !== groupId);
        setDirty(true);
        updateAndRenderAll();
    }, 'グループの削除');
}

function handleDuplicateQuestionGroup(groupId) {
    const groupToDuplicate = surveyData.questionGroups.find(g => g.groupId === groupId);
    if (!groupToDuplicate) return;
    const newGroup = JSON.parse(JSON.stringify(groupToDuplicate)); // Deep copy
    newGroup.groupId = `group_${Date.now()}`;
    newGroup.questions.forEach(q => q.questionId = `q_${Date.now()}_${Math.random()}`);
    const index = surveyData.questionGroups.findIndex(g => g.groupId === groupId);
    surveyData.questionGroups.splice(index + 1, 0, newGroup);
    setDirty(true);
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
    setDirty(true);
    updateAndRenderAll();
}

function handleDeleteQuestion(groupId, questionId) {
    const group = surveyData.questionGroups.find(g => g.groupId === groupId);
    if (group) {
        showConfirmationModal('この質問を削除してもよろしいですか？', () => {
            group.questions = group.questions.filter(q => q.questionId !== questionId);
            setDirty(true);
            updateAndRenderAll();
        }, '質問の削除');
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
    setDirty(true);
    updateAndRenderAll();
}

function handleAddOption(groupId, questionId) {
    const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
    if (question && question.options) {
        question.options.push({ text: { ja: '新しい選択肢', en: '' } });
        setDirty(true);
        updateAndRenderAll();
    }
}

function handleDeleteOption(groupId, questionId, optionIndex) {
    const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
    if (question && question.options) {
        question.options.splice(optionIndex, 1);
        setDirty(true);
        updateAndRenderAll();
    }
}

function handleAddMatrixRow(groupId, questionId) {
    const q = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
    if (!q) return;
    q.matrix = q.matrix || { rows: [], cols: [] };
    q.matrix.rows = q.matrix.rows || [];
    q.matrix.rows.push({ text: { ja: `行${q.matrix.rows.length + 1}`, en: '' } });
    setDirty(true);
    updateAndRenderAll();
}

function handleAddMatrixCol(groupId, questionId) {
    const q = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
    if (!q) return;
    q.matrix = q.matrix || { rows: [], cols: [] };
    q.matrix.cols = q.matrix.cols || [];
    q.matrix.cols.push({ text: { ja: `列${q.matrix.cols.length + 1}`, en: '' } });
    setDirty(true);
    updateAndRenderAll();
}

function handleDeleteMatrixRow(groupId, questionId, index) {
    const q = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
    if (!q || !q.matrix || !Array.isArray(q.matrix.rows)) return;
    q.matrix.rows.splice(index, 1);
    setDirty(true);
    updateAndRenderAll();
}

function handleDeleteMatrixCol(groupId, questionId, index) {
    const q = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
    if (!q || !q.matrix || !Array.isArray(q.matrix.cols)) return;
    q.matrix.cols.splice(index, 1);
    setDirty(true);
    updateAndRenderAll();
}

function handleChangeQuestionType(groupId, questionId, newType) {
    const group = surveyData.questionGroups.find(g => g.groupId === groupId);
    if (!group) return;
    const question = group.questions.find(q => q.questionId === questionId);
    if (!question) return;

    question.type = newType;
    setDirty(true); // Change of type is a modification
    const needsOptions = ['single_answer', 'multi_answer'].includes(newType);
    if (needsOptions) {
        if (!Array.isArray(question.options)) {
            question.options = [
                { text: { ja: '選択肢1', en: '' } },
                { text: { ja: '選択肢2', en: '' } }
            ];
        }
        if ('matrix' in question) delete question.matrix;
    } else if (newType === 'matrix_sa' || newType === 'matrix_ma') {
        // Initialize matrix rows/cols
        delete question.options;
        question.matrix = question.matrix || { rows: [], cols: [] };
        if (!Array.isArray(question.matrix.rows) || question.matrix.rows.length === 0) {
            question.matrix.rows = [
                { text: { ja: '行1', en: '' } },
                { text: { ja: '行2', en: '' } },
            ];
        }
        if (!Array.isArray(question.matrix.cols) || question.matrix.cols.length === 0) {
            question.matrix.cols = [
                { text: { ja: '列1', en: '' } },
                { text: { ja: '列2', en: '' } },
            ];
        }
    } else {
        if ('options' in question) delete question.options;
        if ('matrix' in question) delete question.matrix;
    }

    updateAndRenderAll();
}

/**
 * フォームの必須項目を検証し、保存ボタンの有効/無効を切り替える。
 */
function validateFormForSaveButton() {
    const saveButton = document.getElementById('createSurveyBtn');
    if (!saveButton) return;

    const nameVal = typeof surveyData.name === 'object' ? (surveyData.name?.ja || surveyData.name?.en || '') : (surveyData.name || '');
    const titleVal = typeof surveyData.displayTitle === 'object' ? (surveyData.displayTitle?.ja || surveyData.displayTitle?.en || '') : (surveyData.displayTitle || '');
    const periodStartVal = surveyData.periodStart || '';
    const periodEndVal = surveyData.periodEnd || '';

    let allValid = [nameVal, titleVal, periodStartVal, periodEndVal].every(v => v && v.trim() !== '');

    // Date order check (YYYY-MM-DD lexicographical works)
    let dateOrderValid = true;
    if (periodStartVal && periodEndVal) {
        dateOrderValid = periodEndVal >= periodStartVal;
        if (!dateOrderValid) allValid = false;
    }

    // Also check required questions (string/object safe)
    surveyData.questionGroups?.forEach(group => {
        group.questions?.forEach(question => {
            if (question.required) {
                const qText = typeof question.text === 'object' ? (question.text?.ja || question.text?.en || '') : (question.text || '');
                if (!qText || qText.trim() === '') {
                    allValid = false;
                }
            }
        });
    });

    saveButton.disabled = !allValid;

    // Inline error highlighting and aria-invalid
    const elName = document.getElementById('surveyName_ja');
    const elTitle = document.getElementById('displayTitle_ja');
    const elStart = document.getElementById('periodStart');
    const elEnd = document.getElementById('periodEnd');

    const nameError = document.getElementById('surveyNameError');
    const titleError = document.getElementById('displayTitleError');
    const startError = document.getElementById('periodStartError');
    const endError = document.getElementById('periodEndError');

    const toggleErr = (el, errEl, condition, message) => {
        if (!el || !errEl) return;
        el.classList.toggle('input-error', condition);
        el.setAttribute('aria-invalid', condition ? 'true' : 'false');
        if (message) errEl.textContent = message;
        errEl.classList.toggle('hidden', !condition);
    };

    toggleErr(elName, nameError, !(elName?.value || '').trim(), 'この入力は必須です');
    toggleErr(elTitle, titleError, !(elTitle?.value || '').trim(), 'この入力は必須です');

    const startMissing = !(elStart?.value || '').trim();
    const endMissing = !(elEnd?.value || '').trim();
    toggleErr(elStart, startError, startMissing, 'この入力は必須です');
    toggleErr(elEnd, endError, endMissing, 'この入力は必須です');

    // Order error on end field
    const showOrderError = !startMissing && !endMissing && !dateOrderValid;
    if (elEnd && endError) {
        if (showOrderError) endError.textContent = '終了日は開始日以降にしてください。';
        // Keep error visible if missing or order error
        endError.classList.toggle('hidden', !(endMissing || showOrderError));
        elEnd.setAttribute('aria-invalid', (endMissing || showOrderError) ? 'true' : 'false');
        elEnd.classList.toggle('input-error', endMissing || showOrderError);
    }
}

// Ensure accordion headers are keyboard/AT friendly
function enhanceAccordionA11y() {
    const headers = document.querySelectorAll('.accordion-header, .group-header');
    headers.forEach(header => {
        const contentId = header.getAttribute('data-accordion-target');
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        if (contentId) header.setAttribute('aria-controls', contentId);
        const content = contentId ? document.getElementById(contentId) : null;
        const isOpen = content ? (getComputedStyle(content).display !== 'none') : true;
        header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
}

// DOMの読み込みが完了したら処理を開始
document.addEventListener('DOMContentLoaded', () => {
    
    initializePage();
    
    setupEventListeners();
    
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
            onStart: () => {
                // Close all accordions when starting to drag
                document.querySelectorAll('.question-group .accordion-content').forEach(content => {
                    if (getComputedStyle(content).display !== 'none') {
                        const header = content.previousElementSibling;
                        const icon = header ? header.querySelector('.expand-icon') : null;
                        content.style.display = 'none';
                        if (icon) icon.textContent = 'expand_more';
                        if (header) header.setAttribute('aria-expanded', 'false');
                    }
                });
            },
            onEnd: (evt) => {
                arrayMove(surveyData.questionGroups, evt.oldIndex, evt.newIndex);
                setDirty(true);
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
                    setDirty(true);
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
                    setDirty(true);
                    updateAndRenderAll();
                }
            });
        });

        // Matrix rows/cols sorting per question (if matrix exists)
        groupEl.querySelectorAll('.question-item').forEach(qItem => {
            const qId = qItem.dataset.questionId;
            const rowsList = qItem.querySelector('.matrix-rows-list');
            const colsList = qItem.querySelector('.matrix-cols-list');
            if (rowsList) {
                new Sortable(rowsList, {
                    animation: 150,
                    handle: '.matrix-handle',
                    draggable: '.matrix-row-item',
                    chosenClass: 'matrix-chosen',
                    dragClass: 'matrix-drag',
                    ghostClass: 'matrix-ghost',
                    onEnd: (evt) => {
                        const group = surveyData.questionGroups.find(g => g.groupId === groupId);
                        const question = group?.questions?.find(q => q.questionId === qId);
                        if (!question || !question.matrix || !Array.isArray(question.matrix.rows)) return;
                        arrayMove(question.matrix.rows, evt.oldIndex, evt.newIndex);
                        setDirty(true);
                        updateAndRenderAll();
                    }
                });
            }
            if (colsList) {
                new Sortable(colsList, {
                    animation: 150,
                    handle: '.matrix-handle',
                    draggable: '.matrix-col-item',
                    chosenClass: 'matrix-chosen',
                    dragClass: 'matrix-drag',
                    ghostClass: 'matrix-ghost',
                    onEnd: (evt) => {
                        const group = surveyData.questionGroups.find(g => g.groupId === groupId);
                        const question = group?.questions?.find(q => q.questionId === qId);
                        if (!question || !question.matrix || !Array.isArray(question.matrix.cols)) return;
                        arrayMove(question.matrix.cols, evt.oldIndex, evt.newIndex);
                        setDirty(true);
                        updateAndRenderAll();
                    }
                });
            }
        });
    });
}

// --- Preview Rendering ---
function getTextLocal(field, lang) {
    if (typeof field === 'string') return field;
    if (field && typeof field === 'object') {
        return field[lang] || field.ja || field.en || '';
    }
    return '';
}

function renderSurveyPreview() {
    const container = document.getElementById('modalSurveyPreviewContainer');
    if (!container) return;

    const lang = 'ja';
    const lines = [];
    lines.push(`<div class="space-y-3">`);
    lines.push(`<div>
        <div class="text-xl font-semibold text-on-surface">${getTextLocal(surveyData.displayTitle, lang) || getTextLocal(surveyData.name, lang) || '（無題アンケート）'}</div>
        <div class="text-on-surface-variant text-sm">${surveyData.periodStart || ''} ${(surveyData.periodStart || surveyData.periodEnd) ? '〜' : ''} ${surveyData.periodEnd || ''}</div>
    </div>`);
    if (surveyData.description) {
        lines.push(`<p class="text-on-surface-variant">${getTextLocal(surveyData.description, lang)}</p>`);
    }

    (surveyData.questionGroups || []).forEach((g, gi) => {
        lines.push(`<div class="mt-4">
            <h3 class="text-on-surface font-bold mb-2">${getTextLocal(g.title, lang) || `グループ${gi + 1}`}</h3>
        </div>`);
        (g.questions || []).forEach((q, qi) => {
            const qTitle = getTextLocal(q.text, lang) || `設問${qi + 1}`;
            lines.push(`<div class="mb-3">
                <div class="text-on-surface font-medium">Q${qi + 1}. ${qTitle} ${q.required ? '<span class="text-error text-xs">(必須)</span>' : ''}</div>`);
            if (q.options && q.options.length) {
                lines.push('<ul class="list-disc ml-6 text-on-surface-variant">');
                q.options.forEach(opt => {
                    lines.push(`<li>${getTextLocal(opt.text, lang)}</li>`);
                });
                lines.push('</ul>');
            } else if (q.matrix && Array.isArray(q.matrix.rows) && Array.isArray(q.matrix.cols)) {
                const cols = q.matrix.cols.map(c => getTextLocal(c.text, lang));
                const rows = q.matrix.rows.map(r => getTextLocal(r.text, lang));
                const isSA = q.type === 'matrix_sa';
                lines.push('<div class="overflow-auto max-h-80 mt-2">');
                lines.push('<table class="matrix-preview-table min-w-full text-sm border border-outline-variant">');
                // thead
                lines.push('<thead class="sticky top-0 z-10"><tr>');
                lines.push('<th class="matrix-header border border-outline-variant px-2 py-1 bg-surface-variant text-on-surface sticky left-0 z-20">&nbsp;</th>');
                cols.forEach(label => {
                    lines.push(`<th class="matrix-header border border-outline-variant px-2 py-1 bg-surface-variant text-on-surface">${label || '&nbsp;'}</th>`);
                });
                lines.push('</tr></thead>');
                // tbody
                lines.push('<tbody>');
                rows.forEach((rLabel, rIdx) => {
                    lines.push('<tr>');
                    lines.push(`<td class="matrix-row-header border border-outline-variant px-2 py-1 text-on-surface sticky left-0 z-10 bg-surface">${rLabel || '&nbsp;'}</td>`);
                    cols.forEach((_, cIdx) => {
                        const icon = isSA ? 'radio_button_unchecked' : 'check_box_outline_blank';
                        lines.push(`<td class="matrix-cell border border-outline-variant px-2 py-1 text-center"><span class=\"material-icons-outlined matrix-icon\">${icon}</span></td>`);
                    });
                    lines.push('</tr>');
                });
                lines.push('</tbody>');
                lines.push('</table>');
                lines.push('</div>');
            }
            lines.push(`</div>`);
        });
    });
    lines.push(`</div>`);

    container.innerHTML = lines.join('\n');
}

// Ensure input bindings are attached once
try {
    if (!window.__surveyInputBound) {
        const bindNow = () => { try { setupInputBindings(); } catch(_) {} };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', bindNow, { once: true });
        } else {
            bindNow();
        }
        window.__surveyInputBound = true;
    }
} catch (_) { /* noop */ }
