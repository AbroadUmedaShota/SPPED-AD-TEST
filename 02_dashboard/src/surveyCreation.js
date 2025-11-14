import { handleOpenModal, closeModal } from './modalHandler.js';
import { openAccountInfoModal } from './accountInfoModal.js';
import { initSidebarHandler } from './sidebarHandler.js';
import { initBreadcrumbs } from './breadcrumb.js';
import { setupQrCodeModalListeners } from './qrCodeModal.js';
import { initThemeToggle } from './lib/themeToggle.js';
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
import { loadCommonHtml, showToast, resolveDashboardDataPath, resolveDemoDataPath, resolveDashboardAssetPath } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';

// --- Global State ---
let surveyData = {};
let currentLang = 'ja';
let currentSurveyId = null;
let isDirty = false; // To track unsaved changes
window.isTutorialActive = false; // Global flag for tutorial state
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

/**
 * Initializes unload confirmation logic.
 * This function handles three scenarios for preventing data loss:
 * 1. In-page navigation (e.g., clicking a link): Shows a custom modal.
 * 2. Browser back button: Uses the history API (`pushState`/`popstate`) to show a custom modal.
 * 3. Browser-level navigation (e.g., closing tab, refresh): Shows the browser's native confirmation prompt.
 * This multi-layered approach is necessary due to browser security restrictions.
 */
const handleBeforeUnload = (event) => {
    if (isDirty) {
        // This will trigger the browser's native confirmation dialog.
        // Customizing this dialog's appearance is not possible for security reasons.
        event.preventDefault();
        event.returnValue = ''; // Required for legacy browsers
    }
};

function initUnloadConfirmation() {
    // --- 2. Browser back button handling ---
    // Push an initial state to the history. This allows us to intercept the first back button press.
    history.pushState(null, '', null);

    window.addEventListener('popstate', (event) => {
        if (isDirty) {
            // When the user clicks 'back', popstate fires. We immediately push the state back
            // to "re-arm" the trap in case the user cancels our modal.
            history.pushState(null, '', null);

            showConfirmationModal(
                '編集中の内容は保存されませんが、ページを離れてもよろしいですか？',
                () => { // On Confirm (Leave)
                    isDirty = false; // Allow navigation
                    // Use a timeout to ensure the history operation completes after the modal closes
                    setTimeout(() => history.back(), 0);
                },
                'ページを離れますか？'
            );
        }
    });

    // --- 1. In-page navigation handling (Link clicks) ---
    document.body.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');

        // Ignore non-navigation links or links opening in a new tab
        if (!link || link.getAttribute('href') === '#' || link.target === '_blank' || link.dataset.preventNavGuard || link.getAttribute('onclick')) {
            return;
        }

        // Ignore if the URL is the same
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(link.href, window.location.href);
        if (currentUrl.href === targetUrl.href) {
            return;
        }

        if (isDirty) {
            event.preventDefault();
            showConfirmationModal(
                '編集中の内容は保存されませんが、ページを離れてもよろしいですか？',
                () => {
                    isDirty = false; // Allow navigation
                    window.location.href = link.href;
                },
                'ページを離れますか？'
            );
        }
    }, true); // Use capture phase to intercept clicks early

    // --- 3. Browser-level navigation handling (Close tab, refresh, etc.) ---
    window.addEventListener('beforeunload', handleBeforeUnload);
}

window.disableUnloadConfirmation = () => {
    window.removeEventListener('beforeunload', handleBeforeUnload);
};

window.enableUnloadConfirmation = () => {
    window.addEventListener('beforeunload', handleBeforeUnload);
};



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

function ensureTextValidationMeta(question) {
    const meta = ensureQuestionMeta(question);
    if (!meta.validation || typeof meta.validation !== 'object') {
        meta.validation = {};
    }
    if (!meta.validation.text || typeof meta.validation.text !== 'object') {
        meta.validation.text = {
            minLength: '',
            maxLength: '',
        };
    }
    return meta.validation.text;
}

function ensureDateTimeMeta(question) {
    const meta = ensureQuestionMeta(question);
    if (!meta.dateTimeConfig || typeof meta.dateTimeConfig !== 'object') {
        meta.dateTimeConfig = {
            inputMode: 'datetime', // Default to show both date and time
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
    }
    if (type !== 'free_answer' && question.meta.validation) {
        delete question.meta.validation.text;
    }
    if (Object.keys(question.meta.validation || {}).length === 0) {
        delete question.meta.validation;
    }
    if (type !== 'date_time') {
        delete question.meta.dateTimeConfig;
    }
    if (type !== 'handwriting') {
        delete question.meta.handwritingConfig;
    }
    if (type !== 'multi_answer') {
        delete question.meta.maxSelections;
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
    } else if (question.type === 'free_answer') {
        ensureTextValidationMeta(question);
    } else if (question.type === 'multi_answer') {
        const meta = ensureQuestionMeta(question);
        if (meta.maxSelections === undefined) {
            meta.maxSelections = question.options?.length || 1;
        }
    }
}

// --- Language Switcher ---
function initLanguageSwitcher() {
    // This function is intentionally left blank to disable the language switcher.
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

            if (isDirty) {
                showConfirmationModal(
                    '編集中の内容は保存されませんが、ページを離れてもよろしいですか？',
                    () => { // onConfirm
                        isDirty = false;
                        window.location.href = url;
                    },
                    'ページを離れますか？'
                );
            } else {
                window.location.href = url;
            }
        });
    });
    updateAdditionalSettingsAvailability();
}

const ADDITIONAL_SETTINGS_MESSAGES = {
    requireSurveyId: 'アンケートIDを発行後に利用できます。',
    requireBizcard: '名刺撮影依頼を有効にすると利用できます。'
};



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
    const bizcardEnabled = surveyData?.settings?.bizcard?.enabled === true;

    if (!currentSurveyId) {
        additionalSettingsButtons.forEach((_, feature) => {
            setAdditionalSettingsButtonState(feature, true, ADDITIONAL_SETTINGS_MESSAGES.requireSurveyId);
        });
        return;
    }

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
    destroySortables(); // Destroy old instances before re-rendering
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

        if (!qrButton.dataset.qrModalListenerAttached) {
            qrButton.addEventListener('click', () => {
                if (qrButton.disabled) return;
                handleOpenModal('qrCodeModal', resolveDashboardAssetPath('modals/qrCodeModal.html'), setupQrCodeModalListeners);
            });
            qrButton.dataset.qrModalListenerAttached = 'true';
        }
    }

    updateOutlineActionsState();

    // Post-render enhancements (linking labels, setting dynamic states)
    document.querySelectorAll('.question-item').forEach(qItem => {
        const groupId = qItem.closest('.question-group').dataset.groupId;
        const questionId = qItem.dataset.questionId;
        const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
        if (!question) return;

        // Link 'Required' checkbox and label
        const requiredCheckbox = qItem.querySelector('.required-checkbox');
        const requiredLabel = qItem.querySelector('.required-label');
        if (requiredCheckbox && requiredLabel) {
            const uniqueId = `required-${questionId}`;
            requiredCheckbox.id = uniqueId;
            requiredLabel.setAttribute('for', uniqueId);
        }


    });

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

        // Explanation description
        if (target.classList.contains('explanation-description-input')) {
            const qItem = target.closest('.question-item');
            const groupEl = target.closest('.question-group');
            if (!qItem || !groupEl) return;
            const groupId = groupEl.dataset.groupId;
            const questionId = qItem.dataset.questionId;
            const lang = target.dataset.lang || getEditorLanguage();
            const group = (surveyData.questionGroups || []).find((g) => g.groupId === groupId);
            const question = group?.questions?.find((q) => q.questionId === questionId);
            if (question) {
                if (typeof question.explanationText !== 'object' || question.explanationText === null) {
                    question.explanationText = normalizeLocalization(question.explanationText);
                }
                question.explanationText[lang] = target.value || '';
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
    // --- Tutorial Restart Logic ---
    if (localStorage.getItem('speedad-tutorial-status') === 'pending') {
        if (typeof window.startAppTutorial === 'function') {
            // A brief delay to ensure the page elements are ready
            setTimeout(() => window.startAppTutorial(), 300);
        }
    }
    // --- End Tutorial Logic ---

    try {
        await Promise.all([
            loadCommonHtml('header-placeholder', 'common/header.html'),
            loadCommonHtml('sidebar-placeholder', 'common/sidebar.html', initSidebarHandler),
            loadCommonHtml('footer-placeholder', 'common/footer.html', () => {
                const btn = document.getElementById('openContactModalBtn');
                if (btn) btn.addEventListener('click', () => handleOpenModal('contactModal', resolveDashboardAssetPath('modals/contactModal.html')));
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

        // --- bizcard setting initialization ---
        if (!surveyData.settings) {
            surveyData.settings = {};
        }
        if (!surveyData.settings.bizcard) {
            surveyData.settings.bizcard = {};
        }

        // Robustly coerce the 'enabled' value to a boolean, defaulting to ON for new/unspecified surveys.
        const rawValue = surveyData.settings.bizcard.enabled;
        let coercedValue;

        if (rawValue === undefined || rawValue === null) {
            // If the setting is missing entirely, default to ON.
            coercedValue = true;
        } else if (typeof rawValue === 'boolean') {
            // If it's already a boolean, use it as is.
            coercedValue = rawValue;
        } else if (rawValue === 'true' || rawValue === 1 || rawValue === '1') {
            // Coerce truthy strings/numbers to true.
            coercedValue = true;
        } else {
            // Coerce all other values (e.g., "false", 0, "", etc.) to false.
            coercedValue = false; 
        }
        surveyData.settings.bizcard.enabled = coercedValue;

        const bizcardToggle = document.getElementById('bizcardEnabled');
        if (bizcardToggle) {
            bizcardToggle.checked = surveyData.settings.bizcard.enabled;
        }
        updateAdditionalSettingsAvailability(); // Also call here to set initial state
        // --- end of bizcard setting initialization ---

        updateAndRenderAll();
        restoreAccordionState();
        const fabActions = {
            onAddQuestion: (questionType) => {
                handleAddNewQuestion(null, questionType);
            },
            onAddGroup: () => handleAddNewQuestionGroup()
        };
        initializeFab('fab-container', fabActions);



        // チュートリアルの状態を確認して開始
        const tutorialStatus = localStorage.getItem('speedad-tutorial-status');
        if (tutorialStatus === 'survey-creation-started') {
            if (typeof startSurveyCreationTutorial === 'function') {
                startSurveyCreationTutorial();
            } else {
                console.error('Tutorial function is not available.');
            }
        }

        initUnloadConfirmation();
        document.dispatchEvent(new CustomEvent('pageInitialized'));

        // Expose functions to global scope for tutorial
        window.handleAddNewQuestion = handleAddNewQuestion;
        window.updateAndRenderAll = updateAndRenderAll;

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
            // input, button, select, and drag handles are excluded from toggling the accordion
            if (event.target.closest('input, button, select, .handle')) {
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

    if (configType === 'text') {
        const textValidation = ensureTextValidationMeta(question);
        if (field === 'minLength' || field === 'maxLength') {
            const value = parseInt(target.value, 10);
            textValidation[field] = !Number.isNaN(value) && value >= 0 ? value : '';
        }
    } else if (configType === 'number') {
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
            case 'showDate':
            case 'showTime':
                const showDate = qItem.querySelector('[data-config-field="showDate"]').checked;
                const showTime = qItem.querySelector('[data-config-field="showTime"]').checked;
                if (showDate && showTime) {
                    config.inputMode = 'datetime';
                } else if (showDate) {
                    config.inputMode = 'date';
                } else if (showTime) {
                    config.inputMode = 'time';
                } else {
                    // If neither is checked, default to datetime or handle as an error/warning
                    // For now, let's default to datetime if both are unchecked to ensure a valid state
                    config.inputMode = 'datetime';
                    // Optionally, you could force one to be checked or show a warning
                    // For this implementation, we'll ensure at least one is selected in the UI rendering
                }
                break;
            default:
                break;
        }
    } else if (configType === 'handwriting') {
        const config = ensureHandwritingMeta(question);
        const customHeightGroup = qItem.querySelector('[data-handwriting-sub-config="customHeight"]');

        if (field === 'canvasHeightPreset') {
            const presetValue = target.value;
            if (presetValue === 'custom') {
                customHeightGroup.classList.remove('hidden');
            } else {
                customHeightGroup.classList.add('hidden');
                config.canvasHeight = parseInt(presetValue, 10);
            }
        } else if (field === 'canvasHeight') {
             const sizeValue = parseInt(target.value, 10);
             config.canvasHeight = Number.isNaN(sizeValue) ? 200 : Math.max(50, sizeValue); // Default 200, min 50
        } else {
            // Handle other handwriting settings if any
        }
    } else if (configType === 'multi_answer') {
        const meta = ensureQuestionMeta(question);
        if (field === 'maxSelections') {
            const value = parseInt(target.value, 10);
            meta.maxSelections = !Number.isNaN(value) && value >= 1 ? value : 1;
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
    initOutlineMapToggle();

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

            const isNewSurvey = !currentSurveyId;
            const startDateObj = toDateOnly(periodStartVal);
            const today = toDateOnly(new Date());

            // Only validate that the start date is in the future for NEW surveys.
            if (isNewSurvey && (!startDateObj || (today && startDateObj.getTime() <= today.getTime()))) {
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

            let confirmationMessage = 'アンケートを保存します。よろしいですか？';
            let confirmationTitle = '保存の確認';

            if (missing.length > 0) {
                const summary = extras.map((lang) => {
                    const meta = getLanguageMeta(lang);
                    const label = meta?.label || lang;
                    const count = missing.filter((item) => item.lang === lang).length;
                    return `${label}：${count}件`;
                }).join(' / ');
                confirmationMessage = `選択された追加言語で未入力の項目があります。\n${summary}\nこの状態で保存しますか？`;
                confirmationTitle = '未翻訳の確認';
            }

            showConfirmationModal(confirmationMessage, performSave, confirmationTitle);
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

    // --- bizcard setting event listener ---
    const bizcardToggle = document.getElementById('bizcardEnabled');
    if (bizcardToggle) {
        bizcardToggle.addEventListener('change', () => {
            if (surveyData.settings && surveyData.settings.bizcard) {
                surveyData.settings.bizcard.enabled = bizcardToggle.checked;
                setDirty(true);
                updateAdditionalSettingsAvailability();
            }
        });
    }
    // --- end of bizcard setting event listener ---
}

// --- Data Manipulation Handlers ---
function handleAddNewQuestionGroup() {
    if (!surveyData.questionGroups) surveyData.questionGroups = [];

    const emptyGroup = surveyData.questionGroups.find(g => !g.questions || g.questions.length === 0);

    if (emptyGroup) {
        showToast('設問のない空のグループが既に存在します。先に設問を追加してください。', 'warning');
        const emptyGroupEl = document.querySelector(`[data-group-id="${emptyGroup.groupId}"]`);
        if (emptyGroupEl) {
            emptyGroupEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            emptyGroupEl.classList.add('border-yellow-400', 'shadow-lg');
            setTimeout(() => {
                emptyGroupEl.classList.remove('border-yellow-400', 'shadow-lg');
            }, 2000);
        }
        return;
    }

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

function handleAddNewQuestion(groupId, questionType, creationOptions = {}) {
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
        required: false
    };

    if (['single_answer', 'multi_answer', 'dropdown'].includes(questionType)) {
        newQuestion.options = [
            { text: normalizeLocalization({ ja: '選択肢1' }) },
            { text: normalizeLocalization({ ja: '選択肢2' }) }
        ];
    }

    if (creationOptions.displayAs === 'dropdown') {
        ensureQuestionMeta(newQuestion);
        newQuestion.meta.displayAs = 'dropdown';
    }

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
        
        // Also update maxSelections to match the new number of options
        if (question.type === 'multi_answer') {
            const meta = ensureQuestionMeta(question);
            meta.maxSelections = question.options.length;
        }

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
    const needsOptions = ['single_answer', 'multi_answer', 'dropdown'].includes(newType);
    if (needsOptions) {
        if (!Array.isArray(question.options)) {
            question.options = [
                { text: normalizeLocalization({ ja: '選択肢1' }) },
                { text: normalizeLocalization({ ja: '選択肢2' }) }
            ];
        }
        if (newType === 'multi_answer') {
            const meta = ensureQuestionMeta(question);
            meta.maxSelections = question.options.length;
        }
        if ('matrix' in question) delete question.matrix;
        if ('explanationText' in question) delete question.explanationText;
    } else if (newType === 'matrix_sa' || newType === 'matrix_ma') {
        // Initialize matrix rows/cols
        delete question.options;
        if ('explanationText' in question) delete question.explanationText;
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
    } else if (newType === 'explanation_card') {
        delete question.options;
        delete question.matrix;
        if (!question.explanationText) {
            question.explanationText = normalizeLocalization({ ja: '' });
        }
    } else {
        if ('options' in question) delete question.options;
        if ('matrix' in question) delete question.matrix;
        if ('explanationText' in question) delete question.explanationText;
    }

    updateAndRenderAll();
}

/**
 * フォームの必須項目を検証し、保存ボタンの有効/無効を切り替える。
 */
function validateFormForSaveButton() {
    const saveButton = document.getElementById('createSurveyBtn');
    if (!saveButton) return;

    const isNewSurvey = !currentSurveyId;
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
        } else if (isNewSurvey && today && startDateObj.getTime() <= today.getTime()) {
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
        let errorMessage = '';
        if (startMissing || endMissing) {
            errorMessage = 'この入力は必須です';
        } else if (!dateOrderValid) {
            errorMessage = '終了日は開始日以降に設定してください。';
        } else if (!startDateValid) {
            if (isNewSurvey) {
                errorMessage = '開始日は翌日以降に設定してください。';
            } else {
                errorMessage = '開始日が無効です。';
            }
        }
        rangeError.textContent = errorMessage;
        rangeError.classList.toggle('hidden', !hasRangeError || !errorMessage);
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

    initOutlineMapToggle();
    
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

function renderPreviewInModal() {
    const dataString = localStorage.getItem('surveyPreviewData');
    if (!dataString) return;

    const surveyData = JSON.parse(dataString);
    const container = document.getElementById('modalSurveyPreviewContainer');
    if (!container) return;

    const getLocalizedText = (field) => {
        if (typeof field === 'string') return field;
        if (typeof field === 'object' && field !== null) {
            return field.ja || Object.values(field)[0] || '';
        }
        return '';
    };

    let html = '<div class="survey-preview-stack">';

    // Header
    html += `
        <div class="survey-preview-header">
            <h3 class="survey-preview-title">${getLocalizedText(surveyData.displayTitle)}</h3>
            <p class="survey-preview-period">期間: ${surveyData.periodStart || ''} ～ ${surveyData.periodEnd || ''}</p>
            <p class="survey-preview-description">${getLocalizedText(surveyData.description)}</p>
        </div>
    `;

    // Questions
    (surveyData.questionGroups || []).forEach(group => {
        html += '<div class="survey-preview-section">';
        if (group.title && getLocalizedText(group.title)) {
            html += `<h4 class="survey-preview-group-title">${getLocalizedText(group.title)}</h4>`;
        }
        (group.questions || []).forEach(q => {
            html += '<div class="survey-preview-question">';
            html += `<p class="survey-preview-question-title">${getLocalizedText(q.text)} ${q.required ? '<span class="text-error survey-preview-required">*</span>' : ''}</p>`;
            
            if (q.type === 'single_answer' && q.meta?.displayAs === 'dropdown') {
                html += '<select class="input-field"><option value="">選択してください</option>';
                (q.options || []).forEach(opt => {
                    html += `<option value="${getLocalizedText(opt.text)}">${getLocalizedText(opt.text)}</option>`;
                });
                html += '</select>';
            } else if (q.type === 'dropdown') {
                html += '<select class="input-field"><option value="">選択してください</option>';
                (q.options || []).forEach(opt => {
                    html += `<option value="${getLocalizedText(opt.text)}">${getLocalizedText(opt.text)}</option>`;
                });
                html += '</select>';
            } else if (q.type === 'single_answer') {
                html += '<div class="survey-preview-options">';
                (q.options || []).forEach(opt => {
                    html += `<div class="survey-preview-option-row"><span class="material-icons survey-preview-option-icon">radio_button_unchecked</span> <span class="survey-preview-option-text">${getLocalizedText(opt.text)}</span></div>`;
                });
                html += '</div>';
            } else if (q.type === 'multi_answer') {
                html += '<div class="survey-preview-options">';
                (q.options || []).forEach(opt => {
                    html += `<div class="survey-preview-option-row"><span class="material-icons survey-preview-option-icon">check_box_outline_blank</span> <span class="survey-preview-option-text">${getLocalizedText(opt.text)}</span></div>`;
                });
                html += '</div>';
            } else if (q.type === 'free_answer') {
                const validation = q.meta?.validation?.text;
                const min = validation?.minLength > 0 ? validation.minLength : '';
                const max = validation?.maxLength > 0 ? validation.maxLength : '';
                const textareaId = `preview-textarea-${q.questionId}`;
                const warningId = `preview-warning-${q.questionId}`;

                html += `<textarea id="${textareaId}" class="input-field" rows="3" placeholder="回答を入力" data-min="${min}" data-max="${max}"></textarea>`;
                html += `<div id="${warningId}" class="text-error text-sm mt-1" style="display: none;"></div>`;
            } else if (q.type === 'number_answer') {
                html += '<input type="number" class="input-field" placeholder="数値を入力">';
            }
            
            html += '</div>';
        });
        html += '</div>';
    });

    html += '</div>';
    container.innerHTML = html;
}

function setupPreviewSwitcher() {
    // Render the content first
    renderPreviewInModal();

    const phoneBtn = document.getElementById('preview-mode-phone');
    const tabletBtn = document.getElementById('preview-mode-tablet');
    const device = document.querySelector('.survey-preview-device');

    if (!phoneBtn || !tabletBtn || !device) return;

    phoneBtn.classList.add('active');
    device.classList.remove('is-tablet');

    phoneBtn.addEventListener('click', () => {
        device.classList.remove('is-tablet');
        phoneBtn.classList.add('active');
        tabletBtn.classList.remove('active');
    });

    tabletBtn.addEventListener('click', () => {
        device.classList.add('is-tablet');
        tabletBtn.classList.add('active');
        phoneBtn.classList.remove('active');
    });

    // Set focus to the modal title for accessibility, ONLY if tutorial is not active
    if (!window.isTutorialActive) {
        const modalTitle = document.getElementById('modalTitle');
        if (modalTitle) {
            modalTitle.focus();
        }
    }

    // --- Add validation for free_answer textareas in preview ---
    const dataString = localStorage.getItem('surveyPreviewData');
    if (!dataString) return;

    const surveyData = JSON.parse(dataString);
    if (surveyData && surveyData.questionGroups) {
        surveyData.questionGroups.forEach(group => {
            (group.questions || []).forEach(q => {
                if (q.type === 'free_answer') {
                    const textarea = document.getElementById(`preview-textarea-${q.questionId}`);
                    const warningDiv = document.getElementById(`preview-warning-${q.questionId}`);
                    
                    if (textarea && warningDiv) {
                        const min = parseInt(textarea.dataset.min, 10);
                        const max = parseInt(textarea.dataset.max, 10);

                        textarea.addEventListener('input', () => {
                            const len = textarea.value.length;
                            let message = '';

                            if (max > 0 && len > max) {
                                message = `${len - max}文字超過しています。`;
                            } else if (min > 0 && len < min) {
                                message = `あと${min - len}文字必要です。`;
                            }

                            if (message) {
                                warningDiv.textContent = message;
                                warningDiv.style.display = 'block';
                            } else {
                                warningDiv.style.display = 'none';
                            }
                        });
                    }
                }
            });
        });
    }
    // --- End validation for free_answer textareas in preview ---
}

function attachPreviewListener() {
    const previewBtn = document.getElementById('showPreviewBtn');
    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            try {
                localStorage.setItem('surveyPreviewData', JSON.stringify(surveyData));
                handleOpenModal('surveyPreviewModal', resolveDashboardAssetPath('modals/surveyPreviewModal.html'), setupPreviewSwitcher);
            } catch (e) {
                console.error('Failed to save preview data to localStorage', e);
                showToast('プレビューの表示に失敗しました。', 'error');
            }
        });
    }
    const outlinePreviewBtn = document.querySelector('[data-outline-action="preview"]');
    if (outlinePreviewBtn) {
        outlinePreviewBtn.addEventListener('click', () => {
            document.getElementById('showPreviewBtn')?.click();
        });
    }
}

// --- Drag & Drop (Sortable) ---
let sortableInstances = [];

function setupSortables() {
    destroySortables();

    const reorder = (list, oldIndex, newIndex) => {
        const item = list.splice(oldIndex, 1)[0];
        list.splice(newIndex, 0, item);
        return list;
    };

    const createSortable = (el, groupName, onEndCallback) => {
        if (!el) return null;
        const sortable = new Sortable(el, {
            group: groupName,
            handle: '.handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'dragging-item',
            forceFallback: true, // Use fallback to avoid HTML5 D&D quirks
            onEnd: (evt) => {
                const { oldIndex, newIndex } = evt;
                if (oldIndex !== newIndex) {
                    onEndCallback(oldIndex, newIndex);
                    setDirty(true);
                    renderOutlineMap();
                }
            },
        });
        sortableInstances.push(sortable);
        return sortable;
    };

    // Sort groups
    const groupsContainer = document.getElementById('questionGroupsContainer');
    createSortable(groupsContainer, 'groups', (oldIndex, newIndex) => {
        reorder(surveyData.questionGroups, oldIndex, newIndex);
    });

    // Sort questions within each group
    document.querySelectorAll('.questions-list').forEach(list => {
        const groupEl = list.closest('.question-group');
        const groupId = groupEl.dataset.groupId;
        const group = surveyData.questionGroups.find(g => g.groupId === groupId);
        if (!group) return;

        createSortable(list, `questions-${groupId}`, (oldIndex, newIndex) => {
            reorder(group.questions, oldIndex, newIndex);
        });
    });

    // Sort options within each question
    document.querySelectorAll('.options-container').forEach(container => {
        const questionEl = container.closest('.question-item');
        const groupEl = container.closest('.question-group');
        if (!questionEl || !groupEl) return;

        const questionId = questionEl.dataset.questionId;
        const groupId = groupEl.dataset.groupId;
        const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
        if (!question || !Array.isArray(question.options)) return;

        createSortable(container, `options-${questionId}`, (oldIndex, newIndex) => {
            reorder(question.options, oldIndex, newIndex);
        });
    });

    // Sort matrix rows
    document.querySelectorAll('.matrix-rows-list').forEach(list => {
        const questionEl = list.closest('.question-item');
        const groupEl = list.closest('.question-group');
        if (!questionEl || !groupEl) return;

        const questionId = questionEl.dataset.questionId;
        const groupId = groupEl.dataset.groupId;
        const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
        if (!question || !question.matrix || !Array.isArray(question.matrix.rows)) return;

        createSortable(list, `matrix-rows-${questionId}`, (oldIndex, newIndex) => {
            reorder(question.matrix.rows, oldIndex, newIndex);
        });
    });

    // Sort matrix cols
    document.querySelectorAll('.matrix-cols-list').forEach(list => {
        const questionEl = list.closest('.question-item');
        const groupEl = list.closest('.question-group');
        if (!questionEl || !groupEl) return;

        const questionId = questionEl.dataset.questionId;
        const groupId = groupEl.dataset.groupId;
        const question = surveyData.questionGroups.find(g => g.groupId === groupId)?.questions.find(q => q.questionId === questionId);
        if (!question || !question.matrix || !Array.isArray(question.matrix.cols)) return;

        createSortable(list, `matrix-cols-${questionId}`, (oldIndex, newIndex) => {
            reorder(question.matrix.cols, oldIndex, newIndex);
        });
    });
}


function destroySortables() {
    sortableInstances.forEach(s => s.destroy());
    sortableInstances = [];
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

    const data = getSurveyData();
    const lang = getEditorSurveyLanguage();

    let content = `<div class="p-4 space-y-6">
`;
    content += `<h1 class="text-2xl font-bold">${getLocalizedValue(data.displayTitle, lang)}</h1>`;
    if (data.description) {
        content += `<p class="text-base">${getLocalizedValue(data.description, lang)}</p>`;
    }
    content += `<hr class="my-6">
`;

    data.questionGroups.forEach((group, groupIndex) => {
        content += `<div class="space-y-4">
`;
        if (group.title) {
            content += `<h2 class="text-xl font-semibold">${getLocalizedValue(group.title, lang)}</h2>`;
        }

        group.questions.forEach((question, qIndex) => {
            content += `<div class="py-4">
`;
            if (question.type === 'explanation_card') {
                // Render title without number, but bold and with normal text size
                content += `<p class="font-semibold break-words">${getLocalizedValue(question.text, lang)}</p>`;
                // Render description below it
                if (question.explanationText) {
                    content += `<p class="mt-2 text-on-surface-variant break-words">${getLocalizedValue(question.explanationText, lang)}</p>`;
                }
            } else {
                content += `<p class="font-semibold">${qIndex + 1}. ${getLocalizedValue(question.text, lang)} ${question.required ? '<span class="text-red-500">*</span>' : ''}</p>`;
            }
            content += `<div class="mt-2 space-y-2">
`;

            switch (question.type) {
                case 'explanation_card':
                    if (question.explanationText) {
                        content += `<p class="mt-2 text-base text-on-surface-variant break-words">${getLocalizedValue(question.explanationText, lang)}</p>`;
                    }
                    break;
        case 'free_answer':
            console.log('Rendering preview for free_answer. Question data:', JSON.stringify(question, null, 2)); // Debug log
            const validation = question.meta?.validation?.text;
            const minLength = validation?.minLength;
            const maxLength = validation?.maxLength;

            const textarea = document.createElement('textarea');
            textarea.name = `preview_${question.questionId}`;
            textarea.className = 'input-field w-full';
            textarea.rows = 4;
            textarea.placeholder = '回答を入力';

            const warningDiv = document.createElement('div');
            warningDiv.className = 'text-error text-sm mt-1';
            warningDiv.style.display = 'none';

            controlArea.appendChild(textarea);
            controlArea.appendChild(warningDiv);

            textarea.addEventListener('input', () => {
                const len = textarea.value.length;
                let message = '';

                if (maxLength > 0 && len > maxLength) {
                    message = `${len - maxLength}文字超過しています。`;
                } else if (minLength > 0 && len < minLength) {
                    message = `あと${minLength - len}文字必要です。`;
                }
                
                console.log(`Input length: ${len}, min: ${minLength}, max: ${maxLength}, message: "${message}"`); // Debug log

                if (message) {
                    warningDiv.textContent = message;
                    warningDiv.style.display = 'block';
                } else {
                    warningDiv.style.display = 'none';
                }
            });
            break;
                case 'single_answer':
                    question.options.forEach(option => {
                        content += `<div class="flex items-center space-x-3">
                            <span class="material-icons text-on-surface-variant">radio_button_unchecked</span>
                            <span>${getLocalizedValue(option.text, lang)}</span>
                        </div>`;
                    });
                    break;
                case 'multi_answer':
                    question.options.forEach(option => {
                        content += `<div class="flex items-center space-x-3">
                            <span class="material-icons text-on-surface-variant">check_box_outline_blank</span>
                            <span>${getLocalizedValue(option.text, lang)}</span>
                        </div>`;
                    });
                    break;
                case 'number_answer':
                    content += `<input type="number" class="w-full border-gray-300 rounded-md shadow-sm" readonly />`;
                    break;
                case 'matrix_sa':
                case 'matrix_ma':
                    content += `<div class="overflow-x-auto relative"><table class="w-full text-sm text-left text-gray-500 dark:text-gray-400">
                        <thead class="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                            <tr>
                                <th scope="col" class="py-3 px-6"></th>
                                ${question.matrix.cols.map(c => `<th scope="col" class="py-3 px-6">${getLocalizedValue(c.text, lang)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${question.matrix.rows.map(r => `
                                <tr class="bg-white border-b dark:bg-gray-800 dark:border-gray-700">
                                    <th scope="row" class="py-4 px-6 font-medium text-gray-900 whitespace-nowrap dark:text-white">${getLocalizedValue(r.text, lang)}</th>
                                    ${question.matrix.cols.map(() => `
                                        <td class="py-4 px-6 text-center">
                                            <span class="material-icons text-on-surface-variant">${question.type === 'matrix_sa' ? 'radio_button_unchecked' : 'check_box_outline_blank'}</span>
                                        </td>
                                    `).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table></div>`;
                    break;
            }
            content += `</div></div>`;
        });
        content += `</div>`;
    });

    content += `</div>`;
    container.innerHTML = content;
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

function initOutlineMapToggle() {
    const toggleBtn = document.getElementById('outline-map-toggle-btn');
    const outlineContainer = document.getElementById('outline-map-container');
    const btnIcon = toggleBtn.querySelector('.material-icons');

    if (!toggleBtn || !outlineContainer || !btnIcon) {
        return;
    }

    // Default state is open
    let isOutlineOpen = true;

    const updateOutlineState = () => {
        if (isOutlineOpen) {
            // OPEN STATE
            outlineContainer.classList.remove('translate-x-full');
            toggleBtn.style.right = '18rem'; // w-72 = 18rem
            btnIcon.textContent = 'chevron_left';
        } else {
            // CLOSED STATE
            outlineContainer.classList.add('translate-x-full');
            toggleBtn.style.right = '0';
            btnIcon.textContent = 'chevron_right';
        }
    };

    toggleBtn.addEventListener('click', () => {
        isOutlineOpen = !isOutlineOpen;
        updateOutlineState();
    });

    // Initial setup
    updateOutlineState();
}
