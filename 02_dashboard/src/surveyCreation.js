import { handleOpenModal, closeModal } from './modalHandler.js';
import { openAccountInfoModal } from './accountInfoModal.js';
import { initSidebarHandler } from './sidebarHandler.js';
import { initBreadcrumbs } from './breadcrumb.js';
import { setupQrCodeModalListeners } from './qrCodeModal.js';
import { initThemeToggle } from './themeToggle.js';
import { fetchSurveyData, saveSurveyDataToLocalStorage, loadSurveyDataFromLocalStorage } from './services/surveyService.js';
import {
    populateBasicInfo,
    renderAllQuestionGroups,
    displayErrorMessage,
    renderOutlineMap,
    updateOutlineActionsState
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
const SUPPORTED_LANGUAGES = [
    { code: 'ja', label: '日本語', shortLabel: '日本語', isBase: true },
    { code: 'en', label: 'English', shortLabel: 'English' },
    { code: 'zh-Hant', label: '中国語（繁体字）', shortLabel: '繁体字' },
    { code: 'zh-Hans', label: '中国語（簡体字）', shortLabel: '簡体字' },
    { code: 'vi', label: 'ベトナム語', shortLabel: 'ベトナム語' }
];
const LANGUAGE_MAP = new Map(SUPPORTED_LANGUAGES.map((lang) => [lang.code, lang]));
const BASE_LANGUAGE = 'ja';
const PRO_PLAN_KEYWORDS = ['premium', 'professional', 'pro'];

let activeLanguages = [BASE_LANGUAGE];
let editorLanguage = BASE_LANGUAGE;

const additionalSettingsButtons = new Map();

function toDateOnly(value) {
    if (value === null || value === undefined || value === '') return null;
    const source = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(source.getTime())) return null;
    return new Date(source.getFullYear(), source.getMonth(), source.getDate());
}

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

function getLanguageMeta(code) {
    return LANGUAGE_MAP.get(code) || { code, label: code, shortLabel: code };
}

function normalizeActiveLanguages(langs = []) {
    const normalized = [BASE_LANGUAGE];
    langs.forEach((lang) => {
        if (!lang || lang === BASE_LANGUAGE) return;
        if (!LANGUAGE_MAP.has(lang)) return;
        if (normalized.length >= 3) return;
        if (!normalized.includes(lang)) {
            normalized.push(lang);
        }
    });
    return normalized;
}

function isProPlan(plan) {
    if (!plan) return false;
    const normalized = String(plan).toLowerCase();
    return PRO_PLAN_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function getActiveLanguages() {
    activeLanguages = normalizeActiveLanguages(activeLanguages);
    return [...activeLanguages];
}

function setActiveLanguages(langs) {
    const normalized = normalizeActiveLanguages(langs);
    const prev = getActiveLanguages();
    const changed = normalized.join('|') !== prev.join('|');
    activeLanguages = normalized;
    surveyData.activeLanguages = [...activeLanguages];
    if (!activeLanguages.includes(editorLanguage)) {
        editorLanguage = BASE_LANGUAGE;
    }
    return changed;
}

function getEditorLanguage() {
    if (!getActiveLanguages().includes(editorLanguage)) {
        editorLanguage = BASE_LANGUAGE;
    }
    return editorLanguage;
}

function setEditorLanguage(lang) {
    if (!lang || !LANGUAGE_MAP.has(lang)) return false;
    if (!getActiveLanguages().includes(lang)) return false;
    if (editorLanguage === lang) return false;
    editorLanguage = lang;
    surveyData.editorLanguage = editorLanguage;
    return true;
}

function getLocalizedValue(value, lang) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        const v = value[lang];
        return typeof v === 'string' ? v : (v ?? '');
    }
    if (typeof value === 'string') {
        return lang === 'ja' ? value : '';
    }
    return '';
}

function normalizeLocalization(value) {
    const result = {};
    const langs = getActiveLanguages();
    langs.forEach((lang) => {
        result[lang] = getLocalizedValue(value, lang);
    });
    return result;
}

function ensureLocalization(target, key) {
    const current = target[key];
    target[key] = normalizeLocalization(current);
    return target[key];
}


function collectMissingTranslations(langs) {
    const missing = [];
    if (!Array.isArray(langs) || !langs.length) return missing;

    const recordMissing = (value, pathLabel) => {
        langs.forEach((lang) => {
            const textValue = getLocalizedValue(value, lang).trim();
            if (!textValue) {
                missing.push({ lang, path: pathLabel });
            }
        });
    };

    recordMissing(surveyData.name, 'アンケート名');
    recordMissing(surveyData.displayTitle, '表示タイトル');
    recordMissing(surveyData.description, '説明');

    (surveyData.questionGroups || []).forEach((group, groupIndex) => {
        recordMissing(group.title, `質問グループ${groupIndex + 1}`);
        (group.questions || []).forEach((question, questionIndex) => {
            const questionLabel = `質問${questionIndex + 1}`;
            recordMissing(question.text, questionLabel);
            if (Array.isArray(question.options)) {
                question.options.forEach((opt, optIndex) => {
                    recordMissing(opt.text, `${questionLabel} - 選択肢${optIndex + 1}`);
                });
            }
            if (question.matrix) {
                (question.matrix.rows || []).forEach((row, rowIndex) => {
                    recordMissing(row.text, `${questionLabel} - 行${rowIndex + 1}`);
                });
                (question.matrix.cols || []).forEach((col, colIndex) => {
                    recordMissing(col.text, `${questionLabel} - 列${colIndex + 1}`);
                });
            }
        });
    });

    return missing;
}

function syncSurveyLocalization() {
    const langs = getActiveLanguages();
    surveyData.name = normalizeLocalization(surveyData.name);
    surveyData.displayTitle = normalizeLocalization(surveyData.displayTitle);
    surveyData.description = normalizeLocalization(surveyData.description);
    surveyData.memo = surveyData.memo || '';
    if (Array.isArray(surveyData.questionGroups)) {
        surveyData.questionGroups.forEach((group) => {
            group.title = normalizeLocalization(group.title);
            if (!Array.isArray(group.questions)) return;
            group.questions.forEach((question) => {
                question.text = normalizeLocalization(question.text);
                if (Array.isArray(question.options)) {
                    question.options.forEach((opt) => {
                        opt.text = normalizeLocalization(opt.text);
                    });
                }
                if (question.matrix) {
                    const matrix = question.matrix;
                    if (Array.isArray(matrix.rows)) {
                        matrix.rows.forEach((row) => {
                            row.text = normalizeLocalization(row.text);
                        });
                    }
                    if (Array.isArray(matrix.cols)) {
                        matrix.cols.forEach((col) => {
                            col.text = normalizeLocalization(col.text);
                        });
                    }
                }
                initializeQuestionMeta(question);
            });
        });
    }
    surveyData.activeLanguages = [...langs];
    surveyData.editorLanguage = getEditorLanguage();
}

function updateLocalization(target, key, lang, value) {
    ensureLocalization(target, key);
    target[key][lang] = value;
}

window.getActiveSurveyLanguages = () => [...getActiveLanguages()];
window.getSupportedSurveyLanguages = () => SUPPORTED_LANGUAGES.map((lang) => ({ ...lang }));
window.getEditorSurveyLanguage = () => getEditorLanguage();

function ensureQuestionMeta(question) {
    if (!question || typeof question !== 'object') return {};
    if (!question.meta || typeof question.meta !== 'object') {
        question.meta = {};
    }
    return question.meta;
}

function ensureNumericMeta(question) {
    const meta = ensureQuestionMeta(question);
    if (!meta.validation || typeof meta.validation !== 'object') {
        meta.validation = {};
    }
    if (!meta.validation.numeric || typeof meta.validation.numeric !== 'object') {
        meta.validation.numeric = {
            mode: 'integer',
            min: '',
            max: '',
            precision: 0,
            step: 1,
            unitLabel: '',
            unitSystem: 'metric'
        };
    }
    return meta.validation.numeric;
}

function ensureDateTimeMeta(question) {
    const meta = ensureQuestionMeta(question);
    if (!meta.dateTimeConfig || typeof meta.dateTimeConfig !== 'object') {
        meta.dateTimeConfig = {
            inputMode: 'date',
            timezone: 'Asia/Tokyo',
            minDateTime: '',
            maxDateTime: '',
            allowPast: true,
            allowFuture: true
        };
    }
    return meta.dateTimeConfig;
}

function ensureHandwritingMeta(question) {
    const meta = ensureQuestionMeta(question);
    if (!meta.handwritingConfig || typeof meta.handwritingConfig !== 'object') {
        meta.handwritingConfig = {
            canvasWidth: 600,
            canvasHeight: 200,
            penColor: '#000000',
            penWidth: 2,
            backgroundPattern: 'plain'
        };
    }
    return meta.handwritingConfig;
}

function pruneQuestionMeta(question, type) {
    if (!question || !question.meta || typeof question.meta !== 'object') return;
    if (type !== 'number_answer' && question.meta.validation) {
        delete question.meta.validation.numeric;
        if (Object.keys(question.meta.validation).length === 0) {
            delete question.meta.validation;
        }
    }
    if (type !== 'date_time') {
        delete question.meta.dateTimeConfig;
    }
    if (type !== 'handwriting') {
        delete question.meta.handwritingConfig;
    }
}

function initializeQuestionMeta(question) {
    if (!question) return;
    pruneQuestionMeta(question, question.type);
    if (question.type === 'number_answer') {
        ensureNumericMeta(question);
    } else if (question.type === 'date_time') {
        ensureDateTimeMeta(question);
    } else if (question.type === 'handwriting') {
        ensureHandwritingMeta(question);
    }
}

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

function updateTabIndicator() {
    const tabsContainer = document.getElementById('languageEditorTabs');
    const indicator = document.getElementById('language-tab-indicator');
    if (!tabsContainer || !indicator) return;

    const activeButton = tabsContainer.querySelector('button[aria-selected="true"]');
    if (activeButton) {
        indicator.style.left = `${activeButton.offsetLeft}px`;
        indicator.style.width = `${activeButton.offsetWidth}px`;
    } else {
        indicator.style.width = '0px';
    }
}

function renderLanguageSettings({ activeLanguages, editorLanguage, languageMap }) {
    const panel = document.getElementById('languageSelectionPanel');
    const tabs = document.getElementById('languageEditorTabs');

    if (panel) {
        panel.innerHTML = '';
        const selectable = SUPPORTED_LANGUAGES.filter((lang) => lang.code !== 'ja');
        
        selectable.forEach((lang) => {
            const isSelected = activeLanguages.includes(lang.code);
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.lang = lang.code;
            
            if (isSelected) {
                button.setAttribute('aria-label', `${lang.label}を削除`);
                button.className = 'flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full border border-transparent bg-secondary-container text-on-secondary-container shadow-sm text-sm';
                button.innerHTML = `
                    <span>${lang.label}</span>
                    <span class="material-icons text-base" data-action="remove">cancel</span>
                `;
            } else {
                button.setAttribute('aria-label', `${lang.label}を追加`);
                button.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-outline bg-surface-container-highest text-on-surface hover:bg-surface-variant text-sm';
                button.innerHTML = `
                    <span class="material-icons text-base" data-action="add">add</span>
                    <span>${lang.label}</span>
                `;
            }
            panel.appendChild(button);
        });
    }

    if (tabs) {
        tabs.innerHTML = '';
        activeLanguages.forEach((code) => {
            const lang = languageMap.get(code) || { code, shortLabel: code, label: code };
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.lang = code;
            button.setAttribute('role', 'tab');
            const isActive = code === editorLanguage;
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.className = `px-4 py-3 text-sm font-semibold transition-colors duration-200 ${isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`;
            button.textContent = lang.shortLabel || lang.label;
            tabs.appendChild(button);
        });
    }

    Promise.resolve().then(() => {
        updateAllPlaceholders();
        updateOutlineActionsState();
        updateTabIndicator();
        bindLanguageControlEvents();
    });
}

function bindLanguageControlEvents() {
    const panel = document.getElementById('languageSelectionPanel');
    if (panel && panel.dataset.bound !== 'true') {
        panel.dataset.bound = 'true';
        panel.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-lang]');
            if (!button) return;

            const lang = button.dataset.lang;
            const actionTarget = event.target.closest('[data-action]');
            const action = actionTarget ? actionTarget.dataset.action : 'add'; // Default to add if clicking the body

            const extras = getActiveLanguages().filter((code) => code !== 'ja');
            let next = [...extras];
            let editorLangShouldChange = false;

            if (action === 'remove') {
                next = next.filter((code) => code !== lang);
            } else { // Add action
                if (extras.includes(lang)) return; // Already added, do nothing
                if (next.length >= 2) {
                    showToast('追加言語は最大2件までです。', 'warning');
                    return;
                }
                next.push(lang);
                editorLangShouldChange = true; // Mark that the editor language should switch
            }

            const languagesChanged = setActiveLanguages(next);
            const editorChanged = editorLangShouldChange ? setEditorLanguage(lang) : false;

            if (languagesChanged || editorChanged) {
                syncSurveyLocalization();
                setDirty(true);
                updateAndRenderAll();
            }
        });
    }

    const tabs = document.getElementById('languageEditorTabs');
    if (tabs && tabs.dataset.bound !== 'true') {
        tabs.dataset.bound = 'true';
        tabs.addEventListener('click', (event) => {
            const button = event.target.closest('button[role="tab"]');
            if (!button) return;

            const lang = button.dataset.lang;
            if (setEditorLanguage(lang)) {
                tabs.querySelectorAll('button').forEach(btn => {
                    const isActive = btn.dataset.lang === lang;
                    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
                    btn.className = `px-4 py-3 text-sm font-semibold transition-colors duration-200 ${isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`;
                });
                updateTabIndicator();
                syncSurveyLocalization();
                updateAndRenderAll();
            }
        });
    }
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
    const allowExtraLanguages = isProPlan(surveyData.plan);
    if (!allowExtraLanguages) {
        setActiveLanguages([BASE_LANGUAGE]);
        setEditorLanguage(BASE_LANGUAGE);
    }

    syncSurveyLocalization();

    const languageOptions = {
        activeLanguages: getActiveLanguages(),
        editorLanguage: getEditorLanguage(),
        languageMap: LANGUAGE_MAP,
        allowMultilingual: allowExtraLanguages
    };

    const languageSection = document.getElementById('language-settings-section');
    if (languageSection) {
        languageSection.classList.toggle('hidden', !allowExtraLanguages);
        languageSection.setAttribute('aria-hidden', !allowExtraLanguages ? 'true' : 'false');
    }

    renderLanguageSettings(languageOptions);
    populateBasicInfo(surveyData, languageOptions);
    renderAllQuestionGroups(surveyData.questionGroups, currentLang, languageOptions);
    renderOutlineMap();

    validateFormForSaveButton();
    setupSortables();
    enhanceAccordionA11y();

    const qrButton = document.getElementById('openQrModalBtn');
    if (qrButton) {
        const canOpenQr = Boolean(surveyData.id);
        qrButton.disabled = !canOpenQr;
        qrButton.setAttribute('aria-disabled', !canOpenQr ? 'true' : 'false');
        qrButton.classList.toggle('opacity-50', !canOpenQr);
    }

    if (openQrModalBtn) {
        openQrModalBtn.addEventListener('click', () => {
            loadModal('qrCodeModal', setupQrCodeModalListeners);
        });
    }

    updateOutlineActionsState();

    // Ensure placeholders and outline actions are updated after rendering
    Promise.resolve().then(() => {
        updateAllPlaceholders();
        updateOutlineActionsState();
    });
}

// --- Input Bindings ---
function updateAllPlaceholders() {
    document.querySelectorAll('.multi-lang-input-group').forEach(container => {
        const jaInput = container.querySelector('input[data-lang="ja"], textarea[data-lang="ja"]');
        if (jaInput && jaInput.value) {
            const value = jaInput.value;
            const otherInputs = container.querySelectorAll('input[data-lang]:not([data-lang="ja"]), textarea[data-lang]:not([data-lang="ja"])');
            otherInputs.forEach(input => {
                input.placeholder = value;
            });
        }
    });
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

        const basicInfoContainer = document.getElementById('basicInfoContent');
    if (basicInfoContainer) {
        const handleBasicInput = (event) => {
            const target = event.target;
            if (!target.matches('.multi-lang-input-group input, .multi-lang-input-group textarea')) return;
            const container = target.closest('.multi-lang-input-group');
            if (!container) return;
            const fieldKey = container.dataset.fieldKey;
            if (!fieldKey) return;
            const lang = target.dataset.lang || getEditorLanguage();
            const value = target.value || '';
            if (fieldKey === 'surveyName') {
                updateLocalization(surveyData, 'name', lang, value);
            } else if (fieldKey === 'displayTitle') {
                updateLocalization(surveyData, 'displayTitle', lang, value);
            } else if (fieldKey === 'description') {
                updateLocalization(surveyData, 'description', lang, value);
            }

            if (lang === 'ja') {
                const otherInputs = container.querySelectorAll('input[data-lang]:not([data-lang="ja"]), textarea[data-lang]:not([data-lang="ja"])');
                otherInputs.forEach(input => {
                    input.placeholder = value;
                });
            }

            validateFormForSaveButton();
            setDirty(true);
        };
        basicInfoContainer.addEventListener('input', handleBasicInput);
        basicInfoContainer.addEventListener('change', handleBasicInput);
    }

    // periodStart and periodEnd are now handled by the flatpickr onChange event in initializePage
    bind('memo', ['memo']);



    // Dynamic bindings via delegation (groups/questions/options)
    const container = document.getElementById('questionGroupsContainer');
    if (!container) return;

    container.addEventListener('input', (e) => {
        const target = e.target;

        // Update placeholders for other languages when Japanese input changes
        if (target.dataset.lang === 'ja') {
            const multiLangGroup = target.closest('.multi-lang-input-group');
            if (multiLangGroup) {
                const value = target.value || '';
                const otherInputs = multiLangGroup.querySelectorAll('input[data-lang]:not([data-lang="ja"]), textarea[data-lang]:not([data-lang="ja"])');
                otherInputs.forEach(input => {
                    input.placeholder = value;
                });
            }
        }

        if (target.dataset && target.dataset.configType) {
            handleQuestionConfigInput(target);
            return;
        }
        // Group title
        if (target.classList.contains('group-title-input')) {
            const groupEl = target.closest('.question-group');
            if (!groupEl) return;
            const groupId = groupEl.dataset.groupId;
            const group = (surveyData.questionGroups || []).find((g) => g.groupId === groupId);
            if (group) {
                const lang = target.dataset.lang || getEditorLanguage();
                updateLocalization(group, 'title', lang, target.value || '');
                setDirty(true);
                validateFormForSaveButton();
                renderOutlineMap();
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
            const lang = target.dataset.lang || getEditorLanguage();
            const group = (surveyData.questionGroups || []).find((g) => g.groupId === groupId);
            const question = group?.questions?.find((q) => q.questionId === questionId);
            if (question) {
                updateLocalization(question, 'text', lang, target.value || '');
                setDirty(true);
                validateFormForSaveButton();
                renderOutlineMap();
            }
            return;
        }

        // Option text
        if (target.classList.contains('option-text-input')) {
            const qItem = target.closest('.question-item');
            const groupEl = target.closest('.question-group');
            const optionEl = target.closest('.option-item');
            if (!qItem || !groupEl || !optionEl) return;
            const optionIndex = Array.from(optionEl.parentNode.children).indexOf(optionEl);
            const groupId = groupEl.dataset.groupId;
            const questionId = qItem.dataset.questionId;
            const lang = target.dataset.lang || getEditorLanguage();
            const group = (surveyData.questionGroups || []).find((g) => g.groupId === groupId);
            const question = group?.questions?.find((q) => q.questionId === questionId);
            if (question && Array.isArray(question.options) && optionIndex > -1 && optionIndex < question.options.length) {
                question.options[optionIndex].text = normalizeLocalization(question.options[optionIndex].text);
                question.options[optionIndex].text[lang] = target.value || '';
                setDirty(true);
                validateFormForSaveButton();
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
            const lang = target.dataset.lang || getEditorLanguage();
            const question = surveyData.questionGroups.find((g) => g.groupId === groupId)?.questions.find((q) => q.questionId === questionId);
            if (question && question.matrix && Array.isArray(question.matrix.rows) && question.matrix.rows[index]) {
                question.matrix.rows[index].text = normalizeLocalization(question.matrix.rows[index].text);
                question.matrix.rows[index].text[lang] = target.value || '';
                setDirty(true);
                validateFormForSaveButton();
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
            const lang = target.dataset.lang || getEditorLanguage();
            const question = surveyData.questionGroups.find((g) => g.groupId === groupId)?.questions.find((q) => q.questionId === questionId);
            if (question && question.matrix && Array.isArray(question.matrix.cols) && question.matrix.cols[index]) {
                question.matrix.cols[index].text = normalizeLocalization(question.matrix.cols[index].text);
                question.matrix.cols[index].text[lang] = target.value || '';
                setDirty(true);
                validateFormForSaveButton();
            }
            return;
        }
    });

    container.addEventListener('change', (e) => {
        const target = e.target;
        if (target.dataset && target.dataset.configType) {
            handleQuestionConfigInput(target);
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

/**
 * Loads question groups from a CSV string.
 * @param {string} csvString The CSV content.
 * @returns {Array|null} An array of question groups or null if parsing fails.
 */
function loadQuestionsFromCsv(csvString) {
    if (!window.Papa) {
        console.error('PapaParse is not loaded.');
        showToast('CSV解析ライブラリが読み込まれていません。', 'error');
        return null;
    }

    let questions = [];
    try {
        const results = Papa.parse(csvString, { header: true, skipEmptyLines: true });
        const parsedData = results.data;

        questions = parsedData.map((row, index) => {
            const questionId = `q_csv_${Date.now()}_${index}`;
            const type = (row.type || 'free_answer').trim();
            const required = (row.required || 'FALSE').trim().toUpperCase() === 'TRUE';
            const text = (row.text || '').trim();

            if (!text) return null; // Skip rows without question text

            const question = {
                questionId,
                type,
                text: normalizeLocalization({ ja: text }),
                required,
            };

            const optionsSource = (row['options/rows'] || '').trim();
            const colsSource = (row.cols || '').trim();

            if (type === 'single_answer' || type === 'multi_answer') {
                if (optionsSource) {
                    question.options = optionsSource.split(',').map((opt, optIndex) => ({
                        optionId: `opt_${questionId}_${optIndex}`,
                        text: normalizeLocalization({ ja: opt.trim() }),
                    }));
                }
            } else if (type === 'matrix_sa' || type === 'matrix_ma') {
                question.matrix = {
                    rows: optionsSource ? optionsSource.split(',').map((r, rIndex) => ({
                        rowId: `row_${questionId}_${rIndex}`,
                        text: normalizeLocalization({ ja: r.trim() }),
                    })) : [],
                    cols: colsSource ? colsSource.split(',').map((c, cIndex) => ({
                        colId: `col_${questionId}_${cIndex}`,
                        text: normalizeLocalization({ ja: c.trim() }),
                    })) : [],
                };
            }
            
            initializeQuestionMeta(question);
            return question;

        }).filter(q => q !== null); // Filter out invalid rows

    } catch (error) {
        console.error("CSV parsing error:", error);
        throw error; // Re-throw to be caught by the event handler
    }

    if (questions.length === 0) {
        return null;
    }

    return [{
        groupId: 'group_from_csv_' + Date.now(),
        title: normalizeLocalization({ ja: 'CSVから読み込んだ設問' }),
        questions: questions,
    }];
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
                text: normalizeMultilingual(typeof opt === 'string' ? opt : opt.text || ''),
            }));
        }

        // Add mapping for matrix rows and columns
        if (mappedType === 'matrix_sa' || mappedType === 'matrix_ma') {
            question.matrix = {
                rows: (item.rows || []).map((row, rowIndex) => ({
                    rowId: `row_${questionId}_${rowIndex}`,
                    text: normalizeMultilingual(typeof row === 'string' ? row : row.text || ''),
                })),
                cols: (item.columns || item.cols || []).map((col, colIndex) => ({
                    colId: `col_${questionId}_${colIndex}`,
                    text: normalizeMultilingual(typeof col === 'string' ? col : col.text || ''),
                })),
            };
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
        try {
            initializeDatepickers();
            const periodRangeEl = document.getElementById('periodRange');
            if (periodRangeEl && periodRangeEl._flatpickr) {
                periodRangeEl._flatpickr.config.onChange.push((selectedDates) => {
                    if (selectedDates.length === 2) {
                        const formatDate = (date) => {
                            const y = date.getFullYear();
                            const m = String(date.getMonth() + 1).padStart(2, '0');
                            const d = String(date.getDate()).padStart(2, '0');
                            return `${y}-${m}-${d}`;
                        };
                        surveyData.periodStart = formatDate(selectedDates[0]);
                        surveyData.periodEnd = formatDate(selectedDates[1]);
                    } else {
                        surveyData.periodStart = '';
                        surveyData.periodEnd = '';
                    }
                    validateFormForSaveButton();
                    setDirty(true);
                });
            }
        } catch (_) {}

        const params = new URLSearchParams(window.location.search);
        currentSurveyId = params.get('surveyId');

        registerAdditionalSettingsLinks();
        updateAdditionalSettingsAvailability();

        if (currentSurveyId) {
            // --- EDIT MODE ---
            let dataLoadedFromId = false;

            // 1. Try loading from localStorage keyed by surveyId
            const keyedData = localStorage.getItem(`surveyData_${currentSurveyId}`);
            if (keyedData) {
                try {
                    const parsedData = JSON.parse(keyedData);
                    if (parsedData && Array.isArray(parsedData.questionGroups)) {
                        surveyData = parsedData;
                        dataLoadedFromId = true;
                    }
                } catch (e) {
                    console.error('Failed to parse survey data from localStorage:', e);
                    localStorage.removeItem(`surveyData_${currentSurveyId}`);
                }
            }

            // 2. If not in localStorage, load from data files
            if (!dataLoadedFromId) {
                let surveysList = await fetchJson(resolveDashboardDataPath('core/surveys.json'));
                const surveyInfo = surveysList?.find(s => s.id === currentSurveyId) || null;
                let enqueteDetails = null;

                enqueteDetails = await fetchJson(resolveDemoDataPath(`surveys/${currentSurveyId}.json`));

                if (enqueteDetails) {
                    const questionGroups = mapEnqueteToQuestions(enqueteDetails);
                    if (questionGroups) {
                        surveyData = {
                            id: currentSurveyId,
                            name: enqueteDetails.name || surveyInfo?.name || { ja: currentSurveyId, en: '' },
                            displayTitle: enqueteDetails.displayTitle || surveyInfo?.displayTitle || enqueteDetails.name,
                            description: enqueteDetails.description || surveyInfo?.description || { ja: '', en: '' },
                            memo: enqueteDetails.memo || surveyInfo?.memo || '',
                            periodStart: enqueteDetails.periodStart || surveyInfo?.periodStart || '',
                            periodEnd: enqueteDetails.periodEnd || '',
                            plan: enqueteDetails.plan || surveyInfo?.plan || 'Standard',
                            questionGroups: questionGroups,
                        };
                    }
                } else {
                    console.warn(`Survey with id "${currentSurveyId}" not found.`);
                    showToast(`Survey not found: ${currentSurveyId}`, 'error', 3000);
                    surveyData = await fetchSurveyData(); // Fallback to new survey template
                }
            }
        } else {
            // --- NEW SURVEY MODE ---
            console.log('No surveyId found, initializing a new survey...');
            // Initialize with a minimal, empty survey structure
            surveyData = {
                id: null,
                name: {},
                displayTitle: {},
                description: {},
                memo: '',
                periodStart: '',
                periodEnd: '',
                plan: 'Standard',
                questionGroups: [],
                activeLanguages: ['ja'],
                editorLanguage: 'ja'
            };

            // Apply any URL parameters for pre-filling
            const surveyName = params.get('surveyName');
            const displayTitle = params.get('displayTitle');
            const memo = params.get('memo');
            const periodStart = params.get('periodStart');
            const periodEnd = params.get('periodEnd');

            if (surveyName) surveyData.name = { ja: surveyName, en: '' };
            if (displayTitle) surveyData.displayTitle = { ja: displayTitle, en: '' };
            if (memo) surveyData.memo = memo;
            if (periodStart) surveyData.periodStart = periodStart;
            if (periodEnd) surveyData.periodEnd = periodEnd;
        }

        setActiveLanguages(Array.isArray(surveyData.activeLanguages) ? surveyData.activeLanguages : activeLanguages);
        if (surveyData.editorLanguage) {
            setEditorLanguage(surveyData.editorLanguage);
        }

        updateAndRenderAll();
        restoreAccordionState();
        const fabActions = {
            onAddQuestion: (questionType) => handleAddNewQuestion(null, questionType),
            onAddGroup: () => handleAddNewQuestionGroup()
        };
        initializeFab('fab-container', fabActions);

        // Force update bizcard plan display at the very end
        setTimeout(() => {
            try {
                const surveyId = new URLSearchParams(window.location.search).get('surveyId');
                const bizcardPlanValue = localStorage.getItem(`bizcardPlan_${surveyId}`);
                const planDisplayEl = document.getElementById('selectedBizcardPlan');

                if (planDisplayEl && bizcardPlanValue) {
                    const planMap = {
                        'normal': '通常作業プラン',
                        'express': '特急作業プラン',
                        'super-express': '超特急プラン',
                        'ondemand': 'オンデマンドプラン'
                    };
                    planDisplayEl.textContent = planMap[bizcardPlanValue] || bizcardPlanValue;
                } else if (planDisplayEl) {
                    planDisplayEl.textContent = '未設定';
                }
            } catch (e) {
                console.error('Failed to display bizcard plan:', e);
            }
        }, 100);

        // チュートリアルの状態を確認して開始
        const tutorialStatus = localStorage.getItem('speedad-tutorial-status');
        if (tutorialStatus === 'survey-creation-started') {
            if (typeof startSurveyCreationTutorial === 'function') {
                startSurveyCreationTutorial();
            } else {
                console.error('Tutorial function is not available.');
            }
        }

        document.dispatchEvent(new CustomEvent('pageInitialized'));

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
function handleQuestionConfigInput(target) {
    const configType = target.dataset.configType;
    const field = target.dataset.configField;
    if (!configType || !field) return;

    const groupEl = target.closest('.question-group');
    const qItem = target.closest('.question-item');
    if (!groupEl || !qItem) return;

    const groupId = groupEl.dataset.groupId;
    const questionId = qItem.dataset.questionId;
    const group = (surveyData.questionGroups || []).find((g) => g.groupId === groupId);
    const question = group?.questions?.find((q) => q.questionId === questionId);
    if (!question) return;

    let requiresRerender = false;

    if (configType === 'number') {
        const numeric = ensureNumericMeta(question);
        switch (field) {
            case 'mode':
                numeric.mode = target.value || 'integer';
                if (numeric.mode !== 'decimal') {
                    numeric.precision = 0;
                    if (numeric.step === '' || Number.isNaN(Number(numeric.step))) {
                        numeric.step = 1;
                    }
                } else if (numeric.step === '' || Number.isNaN(Number(numeric.step))) {
                    numeric.step = 0.1;
                }
                requiresRerender = true;
                break;
            case 'min':
            case 'max':
            case 'step':
                if (target.value === '') {
                    numeric[field] = '';
                } else {
                    const numericValue = Number(target.value);
                    numeric[field] = Number.isNaN(numericValue) ? '' : numericValue;
                }
                break;
            case 'precision':
                numeric.precision = target.value === '' ? '' : Math.max(0, parseInt(target.value, 10) || 0);
                break;
            case 'unitLabel':
                numeric.unitLabel = target.value || '';
                break;
            case 'unitSystem':
                numeric.unitSystem = target.value || 'metric';
                break;
            default:
                break;
        }
    } else if (configType === 'date_time') {
        const config = ensureDateTimeMeta(question);
        switch (field) {
            case 'inputMode':
                config.inputMode = target.value || 'date';
                requiresRerender = true;
                break;
            case 'timezone':
                config.timezone = target.value || 'Asia/Tokyo';
                break;
            case 'minDateTime':
            case 'maxDateTime':
                config[field] = target.value || '';
                break;
            case 'allowPast':
            case 'allowFuture':
                config[field] = !!target.checked;
                break;
            default:
                break;
        }
    } else if (configType === 'handwriting') {
        const config = ensureHandwritingMeta(question);
        switch (field) {
            case 'canvasWidth':
            case 'canvasHeight':
                if (target.value === '') {
                    config[field] = '';
                } else {
                    const sizeValue = parseInt(target.value, 10);
                    config[field] = Number.isNaN(sizeValue) ? '' : Math.max(1, sizeValue);
                }
                break;
            case 'penColor':
                config.penColor = target.value || '#000000';
                break;
            case 'penWidth':
                if (target.value === '') {
                    config.penWidth = '';
                } else {
                    const widthValue = parseInt(target.value, 10);
                    config.penWidth = Number.isNaN(widthValue) ? '' : Math.max(1, widthValue);
                }
                break;
            case 'backgroundPattern':
                config.backgroundPattern = target.value || 'plain';
                break;
            default:
                break;
        }
    } else {
        return;
    }

    setDirty(true);
    if (requiresRerender) {
        updateAndRenderAll();
    }
}

function setupEventListeners() {
    initializeAccordion();

    const addNewGroupBtn = document.getElementById('addNewGroupBtn');
    if (addNewGroupBtn) {
        addNewGroupBtn.addEventListener('click', () => {
            handleAddNewQuestionGroup();
        });
    }

    // --- Delegated Change Listeners ---
    document.body.addEventListener('change', (event) => {
        const target = event.target;

        // Handle question type change
        const select = target.closest('.question-type-select');
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

        // Handle required checkbox change
        const checkbox = target.closest('.required-checkbox');
        if (checkbox) {
            const qItem = checkbox.closest('.question-item');
            const gItem = checkbox.closest('.question-group');
            if (qItem && gItem) {
                const groupId = gItem.dataset.groupId;
                const questionId = qItem.dataset.questionId;
                const group = surveyData.questionGroups.find(g => g.groupId === groupId);
                const question = group?.questions.find(q => q.questionId === questionId);
                if (question) {
                    question.required = checkbox.checked;
                    setDirty(true);
                    validateFormForSaveButton();
                }
            }
            return;
        }
    });

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
            validateFormForSaveButton();
            const baseLang = BASE_LANGUAGE;
            const baseName = getLocalizedValue(surveyData.name, baseLang).trim();
            const baseTitle = getLocalizedValue(surveyData.displayTitle, baseLang).trim();
            const periodStartVal = (surveyData.periodStart || '').trim();
            const periodEndVal = (surveyData.periodEnd || '').trim();

            if (!baseName || !baseTitle || !periodStartVal || !periodEndVal) {
                showToast('必須項目を入力してください。', 'error');
                return;
            }

            const startDateObj = toDateOnly(periodStartVal);
            const today = toDateOnly(new Date());
            if (!startDateObj || (today && startDateObj.getTime() <= today.getTime())) {
                showToast('開始日は翌日以降の日付を選択してください。', 'error');
                return;
            }

            const extras = getActiveLanguages().filter((lang) => lang !== 'ja');
            const missing = collectMissingTranslations(extras);

            const performSave = () => {
                saveSurveyDataToLocalStorage(surveyData);
                if (currentSurveyId) {
                    try {
                        localStorage.setItem(`surveyData_${currentSurveyId}`, JSON.stringify(surveyData));
                    } catch (e) {
                        console.error('Failed to save keyed survey data:', e);
                    }
                }
                showToast('アンケートデータを保存しました。');
                setDirty(false);
            };

            if (missing.length > 0) {
                const summary = extras.map((lang) => {
                    const meta = getLanguageMeta(lang);
                    const label = meta?.label || lang;
                    const count = missing.filter((item) => item.lang === lang).length;
                    return `${label}：${count}件`;
                }).join(' / ');
                const message = `選択された追加言語で未入力の項目があります。
${summary}
この状態で保存しますか？`;
                showConfirmationModal(message, performSave, '未翻訳の確認');
                return;
            }

            performSave();
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
        title: normalizeLocalization({ ja: '新しい質問グループ' }),
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
        text: normalizeLocalization({ ja: '新しい設問' }),
        required: false,
        options: (questionType === 'single_answer' || questionType === 'multi_answer') ? [] : undefined
    };
    initializeQuestionMeta(newQuestion);
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
        question.options.push({ text: normalizeLocalization({ ja: '新しい選択肢' }) });
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
    q.matrix.rows.push({ text: normalizeLocalization({ ja: `行${q.matrix.rows.length + 1}` }) });
    setDirty(true);
    updateAndRenderAll();
}

function handleAddMatrixCol(groupId, questionId) {
    const q = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
    if (!q) return;
    q.matrix = q.matrix || { rows: [], cols: [] };
    q.matrix.cols = q.matrix.cols || [];
    q.matrix.cols.push({ text: normalizeLocalization({ ja: `列${q.matrix.cols.length + 1}` }) });
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
                { text: normalizeLocalization({ ja: '選択肢1' }) },
                { text: normalizeLocalization({ ja: '選択肢2' }) }
            ];
        }
        if ('matrix' in question) delete question.matrix;
    } else if (newType === 'matrix_sa' || newType === 'matrix_ma') {
        // Initialize matrix rows/cols
        delete question.options;
        question.matrix = question.matrix || { rows: [], cols: [] };
        if (!Array.isArray(question.matrix.rows) || question.matrix.rows.length === 0) {
            question.matrix.rows = [
                { text: normalizeLocalization({ ja: '行1' }) },
                { text: normalizeLocalization({ ja: '行2' }) },
            ];
        }
        if (!Array.isArray(question.matrix.cols) || question.matrix.cols.length === 0) {
            question.matrix.cols = [
                { text: normalizeLocalization({ ja: '列1' }) },
                { text: normalizeLocalization({ ja: '列2' }) },
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

    const baseLang = BASE_LANGUAGE;
    const nameVal = getLocalizedValue(surveyData.name, baseLang).trim();
    const titleVal = getLocalizedValue(surveyData.displayTitle, baseLang).trim();
    const periodStartVal = (surveyData.periodStart || '').trim();
    const periodEndVal = (surveyData.periodEnd || '').trim();

    const startMissing = !periodStartVal;
    const endMissing = !periodEndVal;

    const startDateObj = startMissing ? null : toDateOnly(periodStartVal);
    const endDateObj = endMissing ? null : toDateOnly(periodEndVal);
    const today = toDateOnly(new Date());

    let dateOrderValid = true;
    if (startDateObj && endDateObj) {
        dateOrderValid = endDateObj.getTime() >= startDateObj.getTime();
    }

    let startDateValid = true;
    if (!startMissing) {
        if (!startDateObj) {
            startDateValid = false;
        } else if (today && startDateObj.getTime() <= today.getTime()) {
            startDateValid = false;
        }
    }

    let allValid = nameVal && titleVal && !startMissing && !endMissing && dateOrderValid && startDateValid;

    surveyData.questionGroups?.forEach(group => {
        group.questions?.forEach(question => {
            if (question.required) {
                const qText = getLocalizedValue(question.text, baseLang).trim();
                if (!qText) {
                    allValid = false;
                }
            }
        });
    });

    const setFieldError = (fieldKey, hasError, message) => {
        const container = document.querySelector(`[data-field-key="${fieldKey}"]`);
        const input = container ? container.querySelector('input, textarea') : null;
        const errorEl = document.getElementById(`${fieldKey}Error`);
        if (input) {
            input.classList.toggle('input-error', !!hasError);
            if (hasError) {
                input.setAttribute('aria-invalid', 'true');
            } else {
                input.removeAttribute('aria-invalid');
            }
        }
        if (errorEl) {
            if (message) errorEl.textContent = message;
            errorEl.classList.toggle('hidden', !hasError);
        }
    };

    setFieldError('surveyName', !nameVal, 'この入力は必須です');
    setFieldError('displayTitle', !titleVal, 'この入力は必須です');

    const periodRangeInput = document.getElementById('periodRange');
    const rangeError = document.getElementById('periodRangeError');
    const hasRangeError = startMissing || endMissing || !dateOrderValid || !startDateValid;

    if (periodRangeInput) {
        periodRangeInput.classList.toggle('input-error', hasRangeError);
        periodRangeInput.setAttribute('aria-invalid', hasRangeError ? 'true' : 'false');
    }
    if (rangeError) {
        if (startMissing || endMissing) {
            rangeError.textContent = 'この入力は必須です';
        } else if (!startDateValid) {
            rangeError.textContent = '開始日は翌日以降に設定してください。';
        } else if (!dateOrderValid) {
            rangeError.textContent = '終了日は開始日以降に設定してください。';
        }
        rangeError.classList.toggle('hidden', !hasRangeError);
    }

    const memoInput = document.getElementById('memo');
    if (memoInput) {
        memoInput.classList.remove('input-error');
        memoInput.removeAttribute('aria-invalid');
    }

    saveButton.disabled = !allValid;
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
            const setupEventListeners = () => {
                const modal = document.getElementById('surveyPreviewModal');
                if (!modal) return;

                const closeButtons = modal.querySelectorAll('[data-modal-close="surveyPreviewModal"]');
                closeButtons.forEach(btn => {
                    if (!btn.dataset.listenerAttached) {
                        btn.addEventListener('click', () => closeModal('surveyPreviewModal'));
                        btn.dataset.listenerAttached = 'true';
                    }
                });
            };
            
            await handleOpenModal('surveyPreviewModal', 'modals/surveyPreviewModal.html', setupEventListeners);
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

    const lang = (typeof getEditorLanguage === 'function' ? getEditorLanguage() : currentLang) || 'ja';
    const lines = [];
    const periodHasStart = Boolean(surveyData.periodStart);
    const periodHasEnd = Boolean(surveyData.periodEnd);
    const periodText = (periodHasStart || periodHasEnd)
        ? `${surveyData.periodStart || ''}${(surveyData.periodStart || surveyData.periodEnd) ? '〜' : ''}${surveyData.periodEnd || ''}`
        : '';

    lines.push('<div class="survey-preview-stack">');
    lines.push('<header class="survey-preview-header">');
    lines.push(`<div class="survey-preview-title text-on-surface">${getTextLocal(surveyData.displayTitle, lang) || getTextLocal(surveyData.name, lang) || '（無題アンケート）'}</div>`);
    if (periodText) {
        lines.push(`<div class="survey-preview-period text-on-surface-variant">${periodText}</div>`);
    }
    const description = surveyData.description ? getTextLocal(surveyData.description, lang) : '';
    if (description) {
        lines.push(`<p class="survey-preview-description text-on-surface-variant">${description}</p>`);
    }
    lines.push('</header>');

    (surveyData.questionGroups || []).forEach((g, gi) => {
        const groupTitle = getTextLocal(g.title, lang) || `グループ${gi + 1}`;
        lines.push('<section class="survey-preview-section">');
        if (groupTitle) {
            lines.push(`<h3 class="survey-preview-group-title text-on-surface-variant">${groupTitle}</h3>`);
        }
        (g.questions || []).forEach((q, qi) => {
            const qTitle = getTextLocal(q.text, lang) || `設問${qi + 1}`;
            const requiredTag = q.required ? '<span class="survey-preview-required text-error">(必須)</span>' : '';
            lines.push('<div class="survey-preview-question">');
            lines.push(`<div class="survey-preview-question-title">Q${qi + 1}. ${qTitle}${requiredTag}</div>`);
            if (q.options && q.options.length) {
                const optionIcon = q.type === 'multi_answer' ? 'check_box_outline_blank' : 'radio_button_unchecked';
                lines.push('<div class="survey-preview-options">');
                q.options.forEach((opt) => {
                    lines.push(`<div class="survey-preview-option-row"><span class="material-icons-outlined survey-preview-option-icon">${optionIcon}</span><span class="survey-preview-option-text">${getTextLocal(opt.text, lang)}</span></div>`);
                });
                lines.push('</div>');
            } else if (q.matrix && Array.isArray(q.matrix.rows) && Array.isArray(q.matrix.cols)) {
                const cols = q.matrix.cols.map((c) => getTextLocal(c.text, lang));
                const rows = q.matrix.rows.map((r) => getTextLocal(r.text, lang));
                const isSA = q.type === 'matrix_sa';
                lines.push('<div class="survey-preview-matrix">');
                lines.push('<div class="survey-preview-matrix-scroll">');
                lines.push('<table class="matrix-preview-table">');
                lines.push('<thead><tr>');
                lines.push('<th class="matrix-header">&nbsp;</th>');
                cols.forEach((label) => {
                    lines.push(`<th class="matrix-header">${label || '&nbsp;'}</th>`);
                });
                lines.push('</tr></thead>');
                lines.push('<tbody>');
                rows.forEach((rLabel) => {
                    lines.push('<tr>');
                    lines.push(`<td class="matrix-row-header">${rLabel || '&nbsp;'}</td>`);
                    cols.forEach(() => {
                        const icon = isSA ? 'radio_button_unchecked' : 'check_box_outline_blank';
                        lines.push(`<td class="matrix-cell"><span class="material-icons-outlined matrix-icon">${icon}</span></td>`);
                    });
                    lines.push('</tr>');
                });
                lines.push('</tbody>');
                lines.push('</table>');
                lines.push('</div>');
                lines.push('</div>');
            }
            lines.push('</div>');
        });
        lines.push('</section>');
    });
    lines.push('</div>');

    container.innerHTML = lines.join('');
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
