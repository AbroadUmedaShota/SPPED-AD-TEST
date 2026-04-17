/**
 * survey-answer.js
 * アンケート回答画面のフロントエンドロジック
 */

import { resolveDashboardDataPath } from './utils.js';
import {
    LANGUAGE_LABELS,
    formatMessage,
    normalizeLocale,
    resolveLocalizedValue
} from './services/i18n/messages.js';

// --- 状態管理 ---
const state = {
    surveyId: null,
    surveyData: null,
    answers: {},
    draftExists: false,
    sessionId: `session_${Date.now()}`,
    isSubmitting: false,
    idleTimer: null,
    isIdle: false,
    currentLanguage: '',
    hasUnsavedChanges: false,
};

// --- DOM要素 ---
let DOMElements = {}; // DOM要素の参照を保持するオブジェクト

function initializeDOMElements() {
    DOMElements = {
        loadingIndicator: document.getElementById('loading-indicator'),
        header: document.getElementById('survey-page-header'),
        headerText: document.getElementById('survey-header-text'),
        languageSelect: document.getElementById('language-select'),
        mainContent: document.getElementById('main-content'),
        errorContainer: document.getElementById('error-container'),
        surveyForm: document.getElementById('survey-form'),
        bizcardManualButton: document.getElementById('bizcard-manual-button'),
        bizcardCameraButton: document.getElementById('bizcard-camera-button'),
        submitSurveyButton: document.getElementById('submit-survey-button'),
        bizcardUploadModal: document.getElementById('bizcard-upload-modal'),
        manualInputModal: document.getElementById('manual-input-modal'),
        leaveConfirmModal: document.getElementById('leave-confirm-modal'),
        draftRestoreModal: document.getElementById('draft-restore-modal'),
        toastNotification: document.getElementById('toast-notification'),
        toastMessage: document.getElementById('toast-message'),
        submittingModal: document.getElementById('submitting-modal'),
        submittingProgressBar: document.getElementById('submitting-progress-bar'),
        submittingPercentage: document.getElementById('submitting-percentage'),
        submittingText: document.getElementById('submitting-text'),

        // --- カラーピッカーテスト機能用要素 ---
        surveyMainWrapper: document.getElementById('survey-main-wrapper'),
        footer: document.querySelector('footer'),
    };
}

function getCurrentLocale() {
    return normalizeLocale(
        state.currentLanguage
        || state.surveyData?.defaultAnswerLocale
        || state.surveyData?.editorLanguage
        || 'ja'
    );
}

function t(path, params = {}) {
    return formatMessage(getCurrentLocale(), path, params);
}

function resolveSurveyText(value) {
    return resolveLocalizedValue(value, getCurrentLocale());
}

function isLocalizedTextObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }
    const keys = Object.keys(value);
    if (!keys.length) {
        return false;
    }
    return keys.some((key) => Object.prototype.hasOwnProperty.call(LANGUAGE_LABELS, normalizeLocale(key))
        && typeof value[key] === 'string');
}

function collectLocalizedLocales(value, bucket) {
    if (!isLocalizedTextObject(value)) {
        return;
    }
    Object.keys(value).forEach((locale) => {
        const normalized = normalizeLocale(locale);
        if (Object.prototype.hasOwnProperty.call(LANGUAGE_LABELS, normalized)) {
            bucket.add(normalized);
        }
    });
}

function getSurveyAvailableLocales() {
    const locales = new Set(['ja']);
    const append = (locale) => {
        const normalized = normalizeLocale(locale);
        if (Object.prototype.hasOwnProperty.call(LANGUAGE_LABELS, normalized)) {
            locales.add(normalized);
        }
    };

    (state.surveyData?.settings?.supportedLocales || []).forEach(append);
    (state.surveyData?.activeLanguages || []).forEach(append);
    (state.surveyData?.languages || []).forEach(append);

    collectLocalizedLocales(state.surveyData?.displayTitle, locales);
    collectLocalizedLocales(state.surveyData?.description, locales);

    (state.surveyData?.questions || []).forEach((question) => {
        collectLocalizedLocales(question?.text, locales);
        (question?.options || []).forEach((option) => collectLocalizedLocales(option?.text, locales));
        (question?.rows || []).forEach((row) => collectLocalizedLocales(row?.text, locales));
        (question?.columns || []).forEach((column) => collectLocalizedLocales(column?.text, locales));
    });

    return [...locales];
}

function inferAvailableLanguages() {
    const candidates = [];
    const append = (locale) => {
        const normalized = normalizeLocale(locale);
        if (normalized && !candidates.includes(normalized)) {
            candidates.push(normalized);
        }
    };

    getSurveyAvailableLocales().forEach(append);

    return candidates;
}

function applyStaticTranslations() {
    document.documentElement.lang = getCurrentLocale();

    const submitLabel = DOMElements.submitSurveyButton?.querySelector('span:last-child');
    if (submitLabel) {
        submitLabel.textContent = t('surveyAnswer.submitButton');
    }

    const bizcardCameraLabel = DOMElements.bizcardCameraButton?.querySelector('span:last-child');
    if (bizcardCameraLabel) {
        bizcardCameraLabel.textContent = t('surveyAnswer.bizcardCameraButton');
    }

    if (DOMElements.bizcardManualButton) {
        DOMElements.bizcardManualButton.textContent = t('surveyAnswer.bizcardManualButton');
    }

    if (DOMElements.submittingText) {
        DOMElements.submittingText.textContent = t('surveyAnswer.submitting');
    }
}

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeDOMElements(); // DOMElements の初期化をここで行う
        showLoading(true); // 初期化後にローディングを表示
        initializeParams();
        await loadSurveyData();
        if (state.isPreviewMode) {
            renderSurvey();
            if (DOMElements.submitSurveyButton) {
                DOMElements.submitSurveyButton.addEventListener('click', handleSubmit);
            }
            if (DOMElements.bizcardCameraButton) {
                DOMElements.bizcardCameraButton.addEventListener('click', () => showToast('プレビューのため、この機能は使用できません'));
            }
            if (DOMElements.bizcardManualButton) {
                DOMElements.bizcardManualButton.addEventListener('click', () => showToast('プレビューのため、この機能は使用できません'));
            }
        } else {
            setupEventListeners();
            await checkForDraft();
            renderSurvey();
            if (state.draftToRestore) {
                populateFormWithDraft();
            }
            startAutoSaveTimer();
            setupLeaveConfirmation();
            // setupHeaderScrollBehavior();
            disablePullToRefresh();
            history.pushState(null, '', location.href); // <-- Add this line
        }

        // テキストエリアの自動リサイズ
        DOMElements.surveyForm.addEventListener('input', (e) => {
            if (e.target.tagName.toLowerCase() === 'textarea') {
                autoResizeTextarea(e.target);
            }
        });
    } catch (error) {
        console.error('初期化エラー:', error);
        displayError(error.message || t('surveyAnswer.loadingFailed'));
    } finally {
        showLoading(false);
    }
});

// --- 初期化ヘルパー関数 ---

function initializeParams() {
    const params = new URLSearchParams(window.location.search);
    state.isPreviewMode = params.get('preview') === '1';
    state.surveyId = params.get('surveyId') || (state.isPreviewMode ? '__preview__' : null);
    if (!state.surveyId) {
        throw new Error(formatMessage('ja', 'surveyAnswer.missingSurveyId'));
    }
    state.currentLanguage = normalizeLocale(params.get('answerLocale') || '');
}

function normalizeQuestion(rawQuestion, index) {
    const rawType = String(rawQuestion.type).toLowerCase();
    const type = normalizeQuestionType(rawQuestion.type);
    const isMatrix = (type === 'matrix_sa' || type === 'matrix_ma');
    const options = (type === 'single_answer' || type === 'multi_answer' || type === 'dropdown')
        ? normalizeOptions(rawQuestion.options || rawQuestion.choices, rawQuestion.id || `q${index}`)
        : [];

    // マトリクス設問: columns が無い場合は options をカラムとして使用
    const columns = isMatrix
        ? normalizeOptions(rawQuestion.columns || rawQuestion.options || [], rawQuestion.id || `q${index}`)
        : (rawQuestion.columns || []);

    const meta = { ...rawQuestion.meta };
    // 旧 "time" タイプは date_time に正規化されるが、時刻のみ表示にする
    if (rawType === 'time' && !meta.dateTimeConfig) {
        meta.dateTimeConfig = { inputMode: 'time' };
    }
    // 旧 "date" タイプも日付のみ表示にする
    if (rawType === 'date' && !meta.dateTimeConfig) {
        meta.dateTimeConfig = { inputMode: 'date' };
    }

    return {
        ...rawQuestion,
        id: rawQuestion.id || `q${index}`,
        type: type,
        text: rawQuestion.text || rawQuestion.title,
        required: rawQuestion.required || rawQuestion.isRequired || false,
        options: options,
        columns: columns,
        rows: rawQuestion.rows || [],
        meta: meta,
    };
}

function normalizeQuestionType(type) {
    const t = String(type).toLowerCase();
    if (t.includes('single') || t.includes('radio')) return 'single_answer';
    if (t.includes('multi') || t.includes('check')) return 'multi_answer';
    if (t.includes('free') || t.includes('text')) return 'free_answer';
    if (t.includes('number')) return 'number_answer';
    if (t.includes('date') || t === 'time') return 'date_time';
    if (t.includes('image')) return 'image_upload';
    if (t.includes('dropdown')) return 'dropdown';
    if (t.includes('matrix_sa')) return 'matrix_sa';
    if (t.includes('matrix_ma')) return 'matrix_ma';
    if (t.includes('handwriting')) return 'handwriting_space';
    if (t.includes('explanation')) return 'explanation_card';
    return type;
}

function normalizeOptions(options, questionId) {
    return (options || []).map((option, index) => {
        if (typeof option === 'string') {
            return { text: option, value: option };
        }
        return {
            ...option,
            text: option.text || option.label,
            value: option.value || option.text || option.label,
        };
    });
}

async function loadSurveyData() {
    if (state.isPreviewMode) {
        const previewJson = localStorage.getItem('surveyPreviewData');
        if (!previewJson) {
            throw new Error('プレビューデータが見つかりません。');
        }
        state.surveyData = JSON.parse(previewJson);
    } else {
        const dataPath = resolveDashboardDataPath(`surveys/${state.surveyId}.json`);
        const response = await fetch(dataPath);
        if (!response.ok) {
            throw new Error(formatMessage('ja', 'surveyAnswer.surveyNotFound', { surveyId: state.surveyId }));
        }
        state.surveyData = await response.json();
    }

    // データ構造の正規化
    const rawQuestions = state.surveyData.questions || state.surveyData.details || [];
    state.surveyData.questions = rawQuestions.map((q, index) => normalizeQuestion(q, index));

    // プレミアム機能のチェックとUIの更新
    // NOTE: Temporarily calling this always for testing
    if (!state.currentLanguage) {
        state.currentLanguage = normalizeLocale(
            state.surveyData?.defaultAnswerLocale
            || state.surveyData?.editorLanguage
            || 'ja'
        );
    }
    setupPremiumFeatures();
}

function setupEventListeners() {
    DOMElements.surveyForm.addEventListener('click', (e) => {
        const header = e.target.closest('.accordion-header');
        if (!header) return;

        const fieldset = header.closest('.survey-question-card');
        if (!fieldset) return;

        const body = fieldset.querySelector('.accordion-body');
        const icon = header.querySelector('.accordion-icon');

        if (!body || !icon) return;

        const currentState = header.dataset.state;

        if (currentState === 'open') {
            body.classList.add('hidden');
            icon.textContent = 'expand_more';
            header.dataset.state = 'closed';
        } else {
            body.classList.remove('hidden');
            icon.textContent = 'expand_less';
            header.dataset.state = 'open';
        }
    });

    // 他の必須ボタンもガード
    if (DOMElements.submitSurveyButton) {
        DOMElements.submitSurveyButton.addEventListener('click', handleSubmit);
    }
    const isPreview = new URLSearchParams(window.location.search).get('preview') === '1';
    if (DOMElements.bizcardCameraButton) {
        DOMElements.bizcardCameraButton.addEventListener('click', () => {
            if (isPreview) { showToast('プレビューのため、この機能は使用できません'); return; }
            startBizcardUploadFlow();
        });
    }
    initBizcardPreviewListeners();
    if (DOMElements.bizcardManualButton) {
        DOMElements.bizcardManualButton.addEventListener('click', () => {
            if (isPreview) { showToast('プレビューのため、この機能は使用できません'); return; }
            const formId = 'manual-bizcard-form';
            const body = `
            <form id="${formId}" class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="manual-last-name" class="block text-sm font-medium text-on-surface-variant">姓</label>
                        <input type="text" id="manual-last-name" name="lastName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                    </div>
                    <div>
                        <label for="manual-first-name" class="block text-sm font-medium text-on-surface-variant">名</label>
                        <input type="text" id="manual-first-name" name="firstName" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                    </div>
                </div>
                <div>
                    <label for="manual-email" class="block text-sm font-medium text-on-surface-variant">メールアドレス</label>
                    <input type="email" id="manual-email" name="email" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
                <div>
                    <label for="manual-company" class="block text-sm font-medium text-on-surface-variant">会社名</label>
                    <input type="text" id="manual-company" name="company" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
                <div>
                    <label for="manual-department" class="block text-sm font-medium text-on-surface-variant">部署名</label>
                    <input type="text" id="manual-department" name="department" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
                <div>
                    <label for="manual-title" class="block text-sm font-medium text-on-surface-variant">役職名</label>
                    <input type="text" id="manual-title" name="title" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
                <div>
                    <label for="manual-phone" class="block text-sm font-medium text-on-surface-variant">電話番号</label>
                    <input type="tel" id="manual-phone" name="phone" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
                <div>
                    <label for="manual-postal-code" class="block text-sm font-medium text-on-surface-variant">郵便番号</label>
                    <input type="text" id="manual-postal-code" name="postalCode" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
                <div>
                    <label for="manual-address" class="block text-sm font-medium text-on-surface-variant">住所</label>
                    <input type="text" id="manual-address" name="address" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
                <div>
                    <label for="manual-building" class="block text-sm font-medium text-on-surface-variant">建物名</label>
                    <input type="text" id="manual-building" name="building" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                </div>
            </form>
        `;
            showModal(DOMElements.manualInputModal, '名刺情報を手入力', body, {
                onSave: () => {
                    const form = document.getElementById(formId);
                    const formData = new FormData(form);
                    const manualInfo = {};
                    formData.forEach((value, key) => manualInfo[key] = value);

                    // 姓と名を結合してnameフィールドを作成
                    if (manualInfo.lastName || manualInfo.firstName) {
                        manualInfo.name = `${manualInfo.lastName || ''} ${manualInfo.firstName || ''}`.trim();
                    }

                    // 確認用のHTMLを生成
                    const confirmationBody = `
                        <div class="space-y-2 text-sm text-on-surface-variant">
                            ${Object.entries({
                                '氏名': manualInfo.name,
                                'メールアドレス': manualInfo.email,
                                '会社名': manualInfo.company,
                                '部署名': manualInfo.department,
                                '役職名': manualInfo.title,
                                '電話番号': manualInfo.phone,
                                '郵便番号': manualInfo.postalCode,
                                '住所': manualInfo.address,
                                '建物名': manualInfo.building
                            }).map(([label, value]) => `<p><span class="font-semibold text-on-surface">${label}:</span> ${value || ''}</p>`).join('')}
                        </div>
                        <p class="mt-6 text-on-surface">この内容で保存しますか？</p>
                    `;

                    // 既存の手入力モーダルを一旦隠す
                    DOMElements.manualInputModal.style.display = 'none';

                    // 確認モーダルを表示
                    showModal(DOMElements.leaveConfirmModal, '入力内容の確認', confirmationBody, {
                        saveText: '保存', // 「はい、保存します」から「保存」へ変更
                        cancelText: '修正する',
                        onSave: () => {
                            // 元の保存処理
                            state.answers.manualBizcardInfo = manualInfo;
                            state.hasUnsavedChanges = true;
                            showToast('名刺情報を保存しました。');
                            console.log('Manual bizcard info saved:', manualInfo);
                            DOMElements.leaveConfirmModal.style.display = 'none';
                        },
                        onCancel: () => {
                            // 手入力モーダルを再表示
                            DOMElements.leaveConfirmModal.style.display = 'none';
                            DOMElements.manualInputModal.style.display = 'flex';
                        }
                    });
                }
            });
        });
    }
}

// ... (他の関数の間)

/**
 * テキストエリアの高さを内容に応じて自動調整する
 * @param {HTMLTextAreaElement} element - 対象のテキストエリア
 */
function autoResizeTextarea(element) {
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
}

// --- 名刺アップロードフロー ---
// ボタン状態更新関数を追加
function updateBizcardButtonState() {
    if (!DOMElements.bizcardCameraButton) return;
    const hasImages = state.answers.bizcardImages &&
                      (state.answers.bizcardImages.front || state.answers.bizcardImages.back);
    const textSpan = DOMElements.bizcardCameraButton.querySelector('span:nth-child(2)');
    if (textSpan) {
        textSpan.textContent = hasImages ? '撮影済み' : '名刺を撮影';
    }
    if (hasImages) {
        DOMElements.bizcardCameraButton.disabled = true;
        DOMElements.bizcardCameraButton.classList.remove('bg-blue-100', 'text-blue-800', 'hover:bg-blue-200');
        DOMElements.bizcardCameraButton.classList.add('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
    } else {
        DOMElements.bizcardCameraButton.disabled = false;
        DOMElements.bizcardCameraButton.classList.remove('bg-gray-100', 'text-gray-400', 'cursor-not-allowed');
        DOMElements.bizcardCameraButton.classList.add('bg-blue-100', 'text-blue-800', 'hover:bg-blue-200');
    }
}

// 名刺プレビューエリアを更新する
function updateBizcardPreview() {
    const previewArea = document.getElementById('bizcard-preview-area');
    const frontImg = document.getElementById('bizcard-preview-front');
    const backImg = document.getElementById('bizcard-preview-back');
    const backEmpty = document.getElementById('bizcard-preview-back-empty');
    const backActions = document.getElementById('bizcard-preview-back-actions');
    if (!previewArea || !frontImg || !backImg || !backEmpty || !backActions) return;

    const images = state.answers.bizcardImages;
    const hasFront = !!(images && images.front);
    const hasBack = !!(images && images.back);

    if (!hasFront && !hasBack) {
        previewArea.classList.add('hidden');
        return;
    }

    previewArea.classList.remove('hidden');

    // 表面
    if (hasFront) {
        frontImg.src = images.front;
    }

    // 裏面
    if (hasBack) {
        backImg.src = images.back;
        backImg.classList.remove('hidden');
        backEmpty.classList.add('hidden');
        backActions.classList.remove('bizcard-preview-back-actions-hidden');
    } else {
        backImg.classList.add('hidden');
        backEmpty.classList.remove('hidden');
        backActions.classList.add('bizcard-preview-back-actions-hidden');
    }
}

// プレビューエリアのイベントリスナーを初期化する（一度だけ呼ぶ）
function initBizcardPreviewListeners() {
    const frontImg = document.getElementById('bizcard-preview-front');
    const backImg = document.getElementById('bizcard-preview-back');
    const backEmpty = document.getElementById('bizcard-preview-back-empty');
    const retakeFront = document.getElementById('bizcard-retake-front');
    const deleteFront = document.getElementById('bizcard-delete-front');
    const retakeBack = document.getElementById('bizcard-retake-back');
    const deleteBack = document.getElementById('bizcard-delete-back');

    // コンテナクリック → 拡大表示（ボタン以外の領域）
    const frontContainer = document.getElementById('bizcard-preview-front-container');
    const backContainer = document.getElementById('bizcard-preview-back-container');
    if (frontContainer) frontContainer.addEventListener('click', () => {
        if (frontImg && frontImg.src) openMagnifyModal(frontImg.src);
    });
    if (backContainer) backContainer.addEventListener('click', () => {
        if (backImg && !backImg.classList.contains('hidden') && backImg.src) openMagnifyModal(backImg.src);
    });

    // 裏面「追加」クリック → 裏面撮影フローを起動
    if (backEmpty) backEmpty.addEventListener('click', (e) => {
        e.stopPropagation();
        startBizcardUploadFlow('back');
    });

    // ボタンはバブリングを止めて各処理のみ実行
    if (retakeFront) retakeFront.addEventListener('click', (e) => {
        e.stopPropagation();
        startBizcardUploadFlow('front');
    });
    if (deleteFront) deleteFront.addEventListener('click', (e) => {
        e.stopPropagation();
        showBizcardDeleteConfirm('front');
    });
    if (retakeBack) retakeBack.addEventListener('click', (e) => {
        e.stopPropagation();
        startBizcardUploadFlow('back');
    });
    if (deleteBack) deleteBack.addEventListener('click', (e) => {
        e.stopPropagation();
        showBizcardDeleteConfirm('back');
    });
}

function showBizcardDeleteConfirm(side) {
    const label = side === 'front' ? '表面' : '裏面';
    showModal(DOMElements.bizcardUploadModal, '画像の削除', `
        <p class="text-center text-gray-700">${label}の画像を削除してもよろしいですか？</p>
    `, {
        saveText: '削除する',
        cancelText: 'キャンセル',
        onSave: () => {
            if (!state.answers.bizcardImages) return;
            state.answers.bizcardImages[side] = null;
            state.hasUnsavedChanges = true;
            if (!state.answers.bizcardImages.front && !state.answers.bizcardImages.back) {
                state.answers.bizcardImages = null;
            }
            DOMElements.bizcardUploadModal.style.display = 'none';
            updateBizcardButtonState();
            updateBizcardPreview();
            showToast(`${label}の画像を削除しました。`);
        },
        onCancel: () => {
            DOMElements.bizcardUploadModal.style.display = 'none';
        },
    });

    // 削除ボタンを赤くする
    const saveBtn = DOMElements.bizcardUploadModal.querySelector('#modal-save-button');
    if (saveBtn) {
        saveBtn.classList.remove('bg-primary', 'hover:bg-primary-dark', 'text-on-primary');
        saveBtn.classList.add('bg-red-600', 'hover:bg-red-700', 'text-white');
    }
}

let bizcardImages = { front: null, back: null };

// targetSide: 'front' | 'back' | null
// nullの場合は通常の初回フロー（表面から開始）
function startBizcardUploadFlow(targetSide = null) {
    let localImages = { front: null, back: null };
    let currentSide = null; // New variable to track current side
    let isEditingSide = !!targetSide; // 特定の面だけを再撮影しているかのフラグ

    // 既存画像があればローカルにコピー
    if (state.answers.bizcardImages && (state.answers.bizcardImages.front || state.answers.bizcardImages.back)) {
        localImages = { ...state.answers.bizcardImages };
    }
    
    // Create a single hidden file input element and reuse it
    const hiddenFileInput = document.createElement('input');
    hiddenFileInput.type = 'file';
    hiddenFileInput.accept = 'image/*';
    hiddenFileInput.style.display = 'none'; // Hide it
    document.body.appendChild(hiddenFileInput); // Add to DOM once

    // Set onchange listener ONCE for hiddenFileInput
    hiddenFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) {
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            localImages[currentSide] = event.target.result;
            if (currentSide === 'front') showFrontPreview();
            else showBackPreview();
        };
        reader.onerror = (error) => {
            console.error(`FileReader error for side: ${currentSide}`, error);
        };
        reader.readAsDataURL(file);
    };

    const triggerFileInput = (useCamera, side, isEdit = false) => {
        currentSide = side; 
        isEditingSide = isEdit;
        if (useCamera) {
            hiddenFileInput.setAttribute('capture', 'environment');
        } else {
            hiddenFileInput.removeAttribute('capture');
        }
        hiddenFileInput.click(); 
    };

    const showChoice = (side = 'front', isEdit = false) => {
        const titleText = isEdit ? '再撮影' : '名刺を撮影';
        const descriptionText = isEdit ? '再撮影する画像の選択方法を選んでください。' : '名刺画像の選択方法を選んでください。';
        
        let stepIndicatorHTML = '';
        if (!isEdit) {
            stepIndicatorHTML = `
                <!-- ステップインジケーター -->
                <div class="flex items-center justify-center mb-4">
                    <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">1</span>
                    <span class="flex-auto border-t-2 border-gray-200 mx-2"></span>
                    <span class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">2</span>
                    <span class="flex-auto border-t-2 border-gray-200 mx-2"></span>
                    <span class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">3</span>
                </div>
            `;
        }

        const body = `
            ${stepIndicatorHTML}
            <p class="text-center text-sm text-gray-600 mb-6">${descriptionText}</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <!-- ストレージから選択カード -->
                <div id="upload-storage" class="p-6 border rounded-lg text-center cursor-pointer hover:bg-gray-50 hover:border-primary transition-all">
                    <span class="material-icons text-4xl text-primary">folder_open</span>
                    <h3 class="font-semibold mt-2">ストレージから選択</h3>
                    <p class="text-xs text-gray-500 mt-1">デバイス内の画像ファイルを選びます。</p>
                </div>
                <!-- カメラで撮影カード -->
                <div id="upload-camera" class="p-6 border rounded-lg text-center cursor-pointer hover:bg-gray-50 hover:border-primary transition-all">
                    <span class="material-icons text-4xl text-primary">photo_camera</span>
                    <h3 class="font-semibold mt-2">カメラで撮影</h3>
                    <p class="text-xs text-gray-500 mt-1">カメラを起動して名刺を撮影します。</p>
                </div>
            </div>
        `;
        showModal(DOMElements.bizcardUploadModal, titleText, body, { 
            cancelText: isEdit ? '戻る' : '閉じる',
            onCancel: isEdit ? showBizcardEditModal : undefined
        });

        document.getElementById('upload-storage').addEventListener('click', () => triggerFileInput(false, side, isEdit));
        document.getElementById('upload-camera').addEventListener('click', () => triggerFileInput(true, side, isEdit));
    };

    const showFrontPreview = () => {
        if (isEditingSide) {
            const body = `
                <p class="text-center text-sm text-gray-600 mb-4">表面のプレビュー</p>
                <div class="bg-gray-100 p-4 rounded-lg">
                    <img src="${localImages.front}" alt="名刺 表面" class="max-w-full mx-auto rounded-md shadow-md">
                </div>
            `;
            showModal(DOMElements.bizcardUploadModal, '内容の確認', body, {
                saveText: '決定',
                cancelText: '撮り直す',
                onSave: () => {
                    if (!state.answers.bizcardImages) state.answers.bizcardImages = {};
                    state.answers.bizcardImages.front = localImages.front;
                    state.hasUnsavedChanges = true;
                    showToast('表面画像を更新しました。');
                    DOMElements.bizcardUploadModal.style.display = 'none';
                    updateBizcardButtonState();
                    updateBizcardPreview();
                },
                onCancel: () => showChoice('front', true)
            });
            return;
        }

        const body = `
            <!-- ステップインジケーター -->
            <div class="flex items-center justify-center mb-4">
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">1</span>
                <span class="flex-auto border-t-2 border-gray-200 mx-2"></span>
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">2</span>
                <span class="flex-auto border-t-2 border-gray-200 mx-2"></span>
                <span class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">3</span>
            </div>
            <p class="text-center text-sm text-gray-600 mb-4">表面のプレビュー</p>
            <div class="bg-gray-100 p-4 rounded-lg">
                <img src="${localImages.front}" alt="名刺 表面" class="max-w-full mx-auto rounded-md shadow-md">
            </div>
            <p class="text-center text-sm mt-2 text-gray-500">OCR言語: 日本語 (ダミー)</p>
        `;
        showModal(DOMElements.bizcardUploadModal, '内容の確認', body, {
            saveText: '裏面を追加する',
            cancelText: '撮り直す',
            onSave: () => showBackChoice(),
            onCancel: () => showChoice('front')
        });

        // フッターのボタンレイアウトを調整
        const footer = DOMElements.bizcardUploadModal.querySelector('.rounded-b-lg');
        if (footer) {
            // 1. フッターを完全にクリアして重複を防止
            footer.innerHTML = ''; 
            
            // 2. 正しいレイアウトを設定
            footer.classList.remove('justify-end');
            footer.classList.add('justify-between', 'w-full', 'items-center');

            // 3. 「撮り直す」ボタンを作成して追加 (左側)
            const retakeButton = document.createElement('button');
            retakeButton.className = 'px-4 py-2 text-sm font-medium rounded-md hover:bg-surface-container-high';
            retakeButton.textContent = '撮り直す';
            retakeButton.onclick = () => showChoice('front');
            footer.appendChild(retakeButton);

            // 4. 右側のボタン用コンテナを作成
            const rightContainer = document.createElement('div');
            rightContainer.className = 'flex items-center gap-4';

            // 5. 「裏面をスキップ」ボタンを作成して追加
            const skipButton = document.createElement('button');
            skipButton.className = 'text-sm font-medium text-primary hover:underline';
            skipButton.textContent = '裏面をスキップ';
            skipButton.onclick = showFinalConfirmation;
            rightContainer.appendChild(skipButton);

            // 6. 「裏面を追加する」ボタンを作成して追加
            const addBackButton = document.createElement('button');
            addBackButton.className = 'px-4 py-2 text-sm font-bold text-on-primary bg-primary rounded-md hover:bg-primary-dark';
            addBackButton.textContent = '裏面を追加する';
            addBackButton.onclick = showBackChoice;
            rightContainer.appendChild(addBackButton);

            // 7. 右側コンテナをフッターに追加
            footer.appendChild(rightContainer);
        }
    };

    const showBackChoice = () => {
        const body = `
            <div class="flex items-center justify-center mb-4">
                <span class="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center"><span class="material-icons text-primary">check</span></span>
                <span class="flex-auto border-t-2 border-primary mx-2"></span>
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">2</span>
                <span class="flex-auto border-t-2 border-gray-200 mx-2"></span>
                <span class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">3</span>
            </div>
            <p class="text-center text-sm text-gray-600 mb-6">裏面のアップロード方法を選択してください。</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div id="upload-storage-back" class="p-6 border rounded-lg text-center cursor-pointer hover:bg-gray-50 hover:border-primary transition-all">
                    <span class="material-icons text-4xl text-primary">folder_open</span>
                    <h3 class="font-semibold mt-2">ストレージから選択</h3>
                </div>
                <div id="upload-camera-back" class="p-6 border rounded-lg text-center cursor-pointer hover:bg-gray-50 hover:border-primary transition-all">
                    <span class="material-icons text-4xl text-primary">photo_camera</span>
                    <h3 class="font-semibold mt-2">カメラで撮影</h3>
                </div>
            </div>
        `;
        showModal(DOMElements.bizcardUploadModal, '裏面の追加', body, { cancelText: '戻る', onCancel: showFrontPreview });
        
        // フッターのボタンレイアウトを調整し、スキップボタンを追加
        const footer = DOMElements.bizcardUploadModal.querySelector('.rounded-b-lg');
        if (footer) {
            // 現在の戻るボタン（左側）と新しいスキップボタン（右側）を配置するためにレイアウト変更
            footer.classList.remove('justify-end');
            footer.classList.add('justify-between', 'w-full', 'items-center');

            footer.innerHTML = ''; 

            const backButton = document.createElement('button');
            backButton.className = 'px-4 py-2 text-sm font-medium rounded-md hover:bg-surface-container-high';
            backButton.textContent = '戻る';
            backButton.onclick = showFrontPreview;
            footer.appendChild(backButton);

            const skipButtonContainer = document.createElement('div');
            const skipButton = document.createElement('button');
            skipButton.className = 'text-sm font-medium text-primary hover:underline px-4 py-2';
            skipButton.textContent = '裏面をスキップして確認へ';
            skipButton.onclick = showFinalConfirmation;
            skipButtonContainer.appendChild(skipButton);
            footer.appendChild(skipButtonContainer);
        }
        
        const uploadStorageBack = document.getElementById('upload-storage-back');
        const uploadCameraBack = document.getElementById('upload-camera-back');
        
        if (uploadStorageBack) {
            uploadStorageBack.addEventListener('click', () => triggerFileInput(false, 'back'));
        }
        if (uploadCameraBack) {
            uploadCameraBack.addEventListener('click', () => triggerFileInput(true, 'back'));
        }
    };

    const showBackPreview = () => {
        if (isEditingSide) {
            const body = `
                <p class="text-center text-sm text-gray-600 mb-4">裏面のプレビュー</p>
                <div class="bg-gray-100 p-4 rounded-lg">
                    <img src="${localImages.back}" alt="名刺 裏面" class="max-w-full mx-auto rounded-md shadow-md">
                </div>
            `;
            showModal(DOMElements.bizcardUploadModal, '内容の確認', body, {
                saveText: '決定',
                cancelText: '撮り直す',
                onSave: () => {
                    if (!state.answers.bizcardImages) state.answers.bizcardImages = {};
                    state.answers.bizcardImages.back = localImages.back;
                    state.hasUnsavedChanges = true;
                    showToast('裏面画像を更新しました。');
                    DOMElements.bizcardUploadModal.style.display = 'none';
                    updateBizcardButtonState();
                    updateBizcardPreview();
                },
                onCancel: () => showChoice('back', true)
            });
            return;
        }

        const body = `
            <div class="flex items-center justify-center mb-4">
                <span class="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center"><span class="material-icons text-primary">check</span></span>
                <span class="flex-auto border-t-2 border-primary mx-2"></span>
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">2</span>
                <span class="flex-auto border-t-2 border-gray-200 mx-2"></span>
                <span class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center">3</span>
            </div>
            <p class="text-center text-sm text-gray-600 mb-4">裏面のプレビュー</p>
            <div class="bg-gray-100 p-4 rounded-lg">
                <img src="${localImages.back}" alt="名刺 裏面" class="max-w-full mx-auto rounded-md shadow-md">
            </div>
        `;
        showModal(DOMElements.bizcardUploadModal, '内容の確認', body, {
            saveText: '最終確認へ進む',
            cancelText: '撮り直す',
            onSave: showFinalConfirmation,
            onCancel: showBackChoice
        });
    };

    const showFinalConfirmation = () => {
        const frontImageHTML = `<img src="${localImages.front}" alt="名刺 表面" class="w-full rounded-md shadow-sm cursor-pointer bizcard-confirm-image">`;
        const backImageHTML = localImages.back ? `<img src="${localImages.back}" alt="名刺 裏面" class="w-full rounded-md shadow-sm cursor-pointer bizcard-confirm-image">` : '<div class="h-full flex items-center justify-center bg-gray-100 rounded-md border border-dashed border-gray-300"><p class="text-sm text-gray-500">裏面なし</p></div>';
        const body = `
            <div class="flex items-center justify-center mb-4">
                <span class="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center"><span class="material-icons text-primary">check</span></span>
                <span class="flex-auto border-t-2 border-primary mx-2"></span>
                <span class="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center"><span class="material-icons text-primary">check</span></span>
                <span class="flex-auto border-t-2 border-primary mx-2"></span>
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">3</span>
            </div>
            <p class="text-center text-sm text-gray-600 mb-4">以下の内容で保存します。</p>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="font-bold text-center mb-2">表面</p>
                    ${frontImageHTML}
                </div>
                <div>
                    <p class="font-bold text-center mb-2">裏面</p>
                    ${backImageHTML}
                </div>
            </div>
        `;
        showModal(DOMElements.bizcardUploadModal, '最終確認', body, {
            saveText: '保存して回答に戻る',
            cancelText: '戻る',
            onSave: () => {
                state.answers.bizcardImages = { ...localImages };
                state.hasUnsavedChanges = true;
                showToast('名刺画像を保存しました。');
                DOMElements.bizcardUploadModal.style.display = 'none';
                updateBizcardButtonState();
                updateBizcardPreview();
            },
            onCancel: () => localImages.back ? showBackPreview() : showFrontPreview()
        });

        // Add click listeners for magnification
        DOMElements.bizcardUploadModal.querySelectorAll('.bizcard-confirm-image').forEach(img => {
            img.addEventListener('click', (e) => {
                openMagnifyModal(e.target.src);
            });
        });
    };

    const showBizcardEditModal = () => {
        let editMode = null; // 'retake', 'delete', or null

        // 現在の画像を state から取得
        localImages = { ...(state.answers.bizcardImages || { front: null, back: null }) };

        const updateInstructionText = () => {
            const el = document.getElementById('bizcard-edit-instruction');
            if (!el) return;
            if (editMode === 'retake') {
                el.textContent = '再撮影する画像をクリックしてください。';
                el.className = 'text-center text-sm text-blue-600 font-bold mb-4';
            } else if (editMode === 'delete') {
                el.textContent = '削除する画像をクリックしてください。';
                el.className = 'text-center text-sm text-red-600 font-bold mb-4';
            } else {
                el.textContent = 'アップロード済みの名刺画像です。';
                el.className = 'text-center text-sm text-gray-600 mb-4';
            }
        };

        const createSideHTML = (side, title) => {
            const hasImage = !!localImages[side];
            const imageHTML = hasImage 
                ? `<img src="${localImages[side]}" alt="名刺 ${title}" class="w-full rounded-md shadow-sm cursor-pointer bizcard-confirm-image mb-2 hover:opacity-80 transition-opacity" data-side="${side}">`
                : `<div class="w-full h-32 flex items-center justify-center bg-gray-100 border border-dashed border-gray-300 rounded-md mb-2 cursor-pointer bizcard-confirm-image hover:bg-gray-200 transition-colors" data-side="${side}"><p class="text-sm text-gray-500">画像なし（タップで撮影）</p></div>`;
            
            return `
                <div class="flex flex-col items-center h-full">
                    <p class="font-bold text-center mb-2 text-gray-700">${title}</p>
                    <div class="flex-grow w-full flex items-center justify-center">
                        ${imageHTML}
                    </div>
                </div>
            `;
        };

        const body = `
            <p id="bizcard-edit-instruction" class="text-center text-sm text-gray-600 mb-4">アップロード済みの名刺画像です。</p>
            <div class="grid grid-cols-2 gap-4">
                ${createSideHTML('front', '表面')}
                ${createSideHTML('back', '裏面')}
            </div>
        `;

        showModal(DOMElements.bizcardUploadModal, '名刺画像の確認・編集', body, {});

        // フッターのボタンレイアウトを調整
        const footer = DOMElements.bizcardUploadModal.querySelector('.rounded-b-lg');
        if (footer) {
            footer.classList.remove('justify-end');
            footer.classList.add('justify-between', 'w-full', 'items-center');
            footer.innerHTML = '';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors';
            deleteBtn.textContent = '削除';
            deleteBtn.onclick = () => {
                editMode = editMode === 'delete' ? null : 'delete';
                updateInstructionText();
                if(editMode === 'delete') {
                    deleteBtn.classList.add('ring-4', 'ring-red-300');
                    // 再撮影のリングを解除
                    const retakeBtn = footer.querySelector('.btn-retake-mode');
                    if(retakeBtn) retakeBtn.classList.remove('ring-4', 'ring-blue-300');
                } else {
                    deleteBtn.classList.remove('ring-4', 'ring-red-300');
                }
            };
            footer.appendChild(deleteBtn);

            const retakeBtn = document.createElement('button');
            retakeBtn.className = 'btn-retake-mode px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors';
            retakeBtn.textContent = '再撮影';
            retakeBtn.onclick = () => {
                editMode = editMode === 'retake' ? null : 'retake';
                updateInstructionText();
                if(editMode === 'retake') {
                    retakeBtn.classList.add('ring-4', 'ring-blue-300');
                    // 削除のリングを解除
                    deleteBtn.classList.remove('ring-4', 'ring-red-300');
                } else {
                    retakeBtn.classList.remove('ring-4', 'ring-blue-300');
                }
            };
            footer.appendChild(retakeBtn);
        }

        // 画像サムネイルのクリックイベント
        DOMElements.bizcardUploadModal.querySelectorAll('.bizcard-confirm-image').forEach(img => {
            img.addEventListener('click', (e) => {
                const target = e.currentTarget;
                const side = target.dataset.side;

                if (editMode === 'retake') {
                    showChoice(side, true); // true = isEdit
                } else if (editMode === 'delete') {
                    if (!localImages[side]) {
                        showToast('削除する画像がありません。');
                        return;
                    }
                    localImages[side] = null;
                    state.answers.bizcardImages[side] = null;
                    state.hasUnsavedChanges = true;
                    
                    // 両方削除されたら
                    if (!state.answers.bizcardImages.front && !state.answers.bizcardImages.back) {
                        state.answers.bizcardImages = null; // 完全にクリア
                        showToast('名刺画像をすべて削除しました。');
                        DOMElements.bizcardUploadModal.style.display = 'none';
                        updateBizcardButtonState();
                        return;
                    }
                    
                    showToast(`${side === 'front' ? '表面' : '裏面'}の画像を削除しました。`);
                    showBizcardEditModal(); // 再描画してモードをリセット
                    updateBizcardButtonState();
                } else {
                    // 通常時: 画像があれば拡大、なければ再撮影モード
                    if (target.tagName.toLowerCase() === 'img') {
                        openMagnifyModal(target.src);
                    } else {
                        showChoice(side, true);
                    }
                }
            });
        });
    };

    // targetSide が指定された場合はその面の選択から開始（再撮影・追加）
    // それ以外は表面の選択から開始
    if (targetSide) {
        showChoice(targetSide, true);
    } else {
        showChoice();
    }
}

// ... (他の関数の間)

// --- モーダル制御 ---
function showModal(modalElement, title, body, options = {}) {
    const { onSave, onCancel, saveText = '保存', cancelText = 'キャンセル' } = options;

    const saveButtonHTML = onSave ? `<button id="modal-save-button" class="px-4 py-2 text-sm font-bold text-on-primary bg-primary rounded-md hover:bg-primary-dark">${saveText}</button>` : '';
    const cancelButtonHTML = onCancel ? `<button id="modal-cancel-button" class="px-4 py-2 text-sm font-medium rounded-md border border-outline-variant hover:bg-surface-container-high">${cancelText}</button>` : '';

    modalElement.innerHTML = `
        <div class="bg-surface rounded-lg shadow-xl max-w-lg w-full m-4">
            <div class="flex justify-between items-center p-4 border-b border-outline-variant">
                <h3 class="text-lg font-bold">${title}</h3>
                <button class="close-modal-button text-on-surface-variant hover:text-on-surface">&times;</button>
            </div>
            <div class="p-6">${body}</div>
            <div class="flex justify-end items-center p-4 bg-surface-container rounded-b-lg gap-3">
                ${cancelButtonHTML}
                ${saveButtonHTML}
            </div>
        </div>
    `;
    modalElement.style.display = 'flex';

    if (onSave) {
        modalElement.querySelector('#modal-save-button').addEventListener('click', () => {
            onSave();
        });
    }

    if (onCancel) {
        modalElement.querySelector('#modal-cancel-button').addEventListener('click', () => {
            onCancel();
        });
    }

    modalElement.querySelectorAll('.close-modal-button').forEach(btn => {
        btn.addEventListener('click', () => {
            // キャンセルコールバックがあれば実行
            if (onCancel) onCancel();
            modalElement.style.display = 'none';
        });
    });

    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            if (onCancel) onCancel();
            modalElement.style.display = 'none';
        }
    });
}

function openMagnifyModal(src) {
    const modal = document.getElementById('image-magnify-modal');
    if (!modal) return;

    modal.innerHTML = `
        <button class="magnify-close-button absolute top-4 right-4 text-white text-5xl z-10 leading-none">&times;</button>
        <div class="magnify-image-container p-4">
            <img src="${src}" class="max-w-[90vw] max-h-[90vh] object-contain">
        </div>
    `;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const closeModal = () => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        modal.innerHTML = '';
        // イベントリスナーはモーダルがクリアされると自動的に削除される
    };

    // 背景クリックで閉じる
    modal.addEventListener('click', closeModal);

    // Xボタンクリックで閉じる
    modal.querySelector('.magnify-close-button').addEventListener('click', (e) => {
        e.stopPropagation(); // 背景のクリックイベントを発火させない
        closeModal();
    });

    // 画像自体のクリックでは閉じないようにする
    modal.querySelector('.magnify-image-container').addEventListener('click', (e) => {
        e.stopPropagation();
    });
}


async function checkForDraft() {
    const draftKey = `survey_draft_${state.surveyId}_${state.sessionId}`;
    const draftData = localStorage.getItem(draftKey);
    if (draftData) {
        showModal(DOMElements.draftRestoreModal, '回答の復元', '未送信の回答がありますが、復元しますか？', {
            saveText: '復元する',
            cancelText: '新しく始める',
            onSave: () => {
                try {
                    state.answers = JSON.parse(draftData);
                    state.draftToRestore = true;
                    showToast('下書きを復元しました。');
                    updateBizcardButtonState();
                } catch (e) {
                    console.error('ドラフトの解析に失敗しました:', e);
                    localStorage.removeItem(draftKey);
                }
            },
            onCancel: () => {
                localStorage.removeItem(draftKey);
            }
        });
    }
}

function populateFormWithDraft() {
    if (!state.answers) return;

    Object.keys(state.answers).forEach(questionId => {
        const answer = state.answers[questionId];
        const question = state.surveyData.questions.find(q => q.id === questionId);
        if (!question) return;

        const elements = document.getElementsByName(questionId);
        
        const type = question.type;

        if (type === 'date_time') {
            const [datePart, timePart] = (answer || '').split('T');
            const dateInput = document.querySelector(`input[name=\"${questionId}_date\"]`);
            const timeInput = document.querySelector(`input[name=\"${questionId}_time\"]`);
            if (dateInput) dateInput.value = datePart || '';
            if (timeInput) timeInput.value = timePart || '';
        } else if (type === 'handwriting_space') {
            const canvas = document.getElementById(`${questionId}-canvas`);
            if (canvas && answer) {
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                };
                img.src = answer;
            }
        } else if (elements.length > 0) { // elements を使う他のタイプ
            if (elements[0].type === 'radio') {
                elements.forEach(el => {
                    if (el.value === answer) {
                        el.checked = true;
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            } else if (elements[0].type === 'checkbox') {
                const answerArray = Array.isArray(answer) ? answer : [answer];
                elements.forEach(el => {
                    if (answerArray.includes(el.value)) {
                        el.checked = true;
                    }
                });
            } else { // textarea, select-one, number, etc.
                elements[0].value = answer;
            }
        }
    });
    console.log('フォームにドラフトを反映しました。');
}

function startAutoSaveTimer() {
    setInterval(saveDraft, 30000); // 30秒ごとに自動保存
}

// --- 描画関数 ---

function renderSurvey() {
    applyStaticTranslations();
    renderHeader();
    renderSurveyTitle();
    renderQuestions();
    updateDynamicColors('#FFFFFF'); // スタイルを再適用
}

function renderHeader() {
    const { displayTitle } = state.surveyData;
    // DOMElements.headerText.innerHTML = ''; // コンテンツを削除
    document.title = `SpeedAd - ${resolveSurveyText(displayTitle) || t('surveyAnswer.pageTitleFallback')}`;
}

function renderSurveyTitle() {
    const { displayTitle, description } = state.surveyData;
    const titleContainer = document.getElementById('survey-title-container');
    if (titleContainer) {
        titleContainer.innerHTML = `
            <div class="bg-white border-2 border-gray-200 rounded-lg shadow-md p-6">
                <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">${resolveSurveyText(displayTitle) || t('surveyAnswer.titleFallback')}</h1>
                <p class="text-gray-600 mt-2">${resolveSurveyText(description) || ''}</p>
            </div>
        `;
    }
}

function renderQuestions() {
    const form = DOMElements.surveyForm;
    form.innerHTML = ''; // 既存の設問をクリア

    if (!Array.isArray(state.surveyData.questions) || state.surveyData.questions.length === 0) {
        form.innerHTML = `<p class="text-center text-on-surface-variant">${t('common.noQuestions')}</p>`;
        return;
    }

    state.surveyData.questions.forEach((question, index) => {
        const questionElement = createQuestionElement(question, index);
        form.appendChild(questionElement);
    });
}

function createQuestionElement(question, index) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'survey-question-card';
    if (question.required) {
        fieldset.classList.add('is-required');
    }
    fieldset.dataset.questionId = question.id;

    const questionNumber = `Q.${String(index + 1).padStart(2, '0')}`;
    const requiredText = question.required ? `<span class="text-red-600 font-bold text-xs">${t('surveyAnswer.requiredBadge')}</span>` : '';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'question-content';

    contentDiv.innerHTML = `
        <div class="accordion-header flex justify-between items-start cursor-pointer mb-4" data-state="open">
            <div class="flex-grow">
                <div class="flex items-center">
                    <span class="text-lg font-bold text-gray-500 mr-3">${questionNumber}</span>${requiredText}
                </div>
                <p class="text-base font-semibold text-on-surface-variant mt-2">${resolveSurveyText(question.text)}</p>
            </div>
            <span class="material-icons accordion-icon text-on-surface-variant ml-4">expand_less</span>
        </div>
        <div class="control-area space-y-3 accordion-body"></div>
    `;
    
    fieldset.appendChild(contentDiv);
    const controlArea = fieldset.querySelector('.control-area');

    // 設問タイプに応じて入力コントロールを生成
    switch (question.type) {
        case 'free_answer':
            const validation = question.meta?.validation?.text;
            const min = validation?.minLength;
            const max = validation?.maxLength;

            const textarea = document.createElement('textarea');
            textarea.name = question.id;
            textarea.className = 'w-full rounded-md border-gray-300 shadow-sm';
            textarea.rows = 4;
            if (min > 0) textarea.minLength = min;

            const warningDiv = document.createElement('div');
            warningDiv.className = 'text-error text-sm mt-1';
            warningDiv.style.display = 'none';

            controlArea.appendChild(textarea);
            controlArea.appendChild(warningDiv);

            textarea.addEventListener('input', () => {
                const len = textarea.value.length;
                let message = '';

                if (max > 0 && len > max) {
                    message = t('validation.maxLength', { count: len - max });
                } else if (min > 0 && len < min) {
                    message = t('validation.minLength', { count: min - len });
                }

                if (message) {
                    warningDiv.textContent = message;
                    warningDiv.style.display = 'block';
                } else {
                    warningDiv.style.display = 'none';
                }
            });
            break;
        case 'single_answer':
            question.options.forEach(opt => {
                controlArea.innerHTML += `
                    <div class="flex items-center gap-3">
                        <input type="radio" id="${question.id}-${opt.value}" name="${question.id}" value="${opt.value}" class="form-radio text-primary">
                        <label for="${question.id}-${opt.value}">${resolveSurveyText(opt.text)}</label>
                    </div>`;
            });
            break;
        case 'multi_answer':
            const maxSelections = question.meta?.maxSelections;
            question.options.forEach(opt => {
                const div = document.createElement('div');
                div.className = 'flex items-center gap-3';
                const input = document.createElement('input');
                input.type = 'checkbox';
                input.id = `${question.id}-${opt.value}`;
                input.name = question.id;
                input.value = opt.value;
                input.className = 'form-checkbox text-primary';
                const label = document.createElement('label');
                label.htmlFor = input.id;
                label.textContent = resolveSurveyText(opt.text);
                div.appendChild(input);
                div.appendChild(label);
                controlArea.appendChild(div);
            });

            if (maxSelections > 0) {
                controlArea.addEventListener('change', (e) => {
                    if (e.target.type === 'checkbox') {
                        const checkedCheckboxes = controlArea.querySelectorAll('input[type="checkbox"]:checked');
                        const uncheckedCheckboxes = controlArea.querySelectorAll('input[type="checkbox"]:not(:checked)');
                        
                        if (checkedCheckboxes.length >= maxSelections) {
                            uncheckedCheckboxes.forEach(cb => cb.disabled = true);
                        } else {
                            uncheckedCheckboxes.forEach(cb => cb.disabled = false);
                        }
                    }
                });
            }
            break;
        case 'number_answer':
            controlArea.innerHTML = `<input type="number" name="${question.id}" class="w-full rounded-md border-gray-300 shadow-sm" min="${question.min}" max="${question.max}" step="${question.step || 1}">`;
            break;
        case 'date_time':
            const config = question.meta?.dateTimeConfig || { inputMode: 'datetime' };
            const mode = config.inputMode || 'datetime';

            let dateInputHTML = '';
            if (mode === 'date' || mode === 'datetime') {
                dateInputHTML = `<input type="date" name="${question.id}_date" class="w-full rounded-md border-gray-300 shadow-sm p-2" aria-label="Date" max="9999-12-31">`;
            }

            let timeInputHTML = '';
            if (mode === 'time' || mode === 'datetime') {
                timeInputHTML = `<input type="time" name="${question.id}_time" class="w-full rounded-md border-gray-300 shadow-sm p-2" aria-label="Time">`;
            }

            controlArea.innerHTML = `
              <div class="flex flex-col sm:flex-row gap-2">
                ${dateInputHTML}
                ${timeInputHTML}
              </div>
            `;
            break;
        case 'dropdown':
            let optionsHTML = '';
            question.options.forEach(opt => {
                optionsHTML += `<option value="${opt.value}">${resolveSurveyText(opt.text)}</option>`;
            });
            controlArea.innerHTML = `<select name="${question.id}" class="w-full rounded-md border-gray-300 shadow-sm">${optionsHTML}</select>`;
            break;
        case 'matrix_sa':
        case 'matrix_ma':
            const isSingleAnswer = question.type === 'matrix_sa';
            let tableHTML = '<div class="overflow-x-auto"><table class="min-w-full border-collapse border border-outline-variant"><thead><tr><th class="border border-outline-variant p-2 bg-surface-container"></th>';
            question.columns.forEach(col => {
                tableHTML += `<th class="border border-outline-variant p-2 bg-surface-container text-sm font-medium">${resolveSurveyText(col.text)}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';
            question.rows.forEach(row => {
                tableHTML += `<tr><td class="border border-outline-variant p-2 text-sm font-medium">${resolveSurveyText(row.text)}</td>`;
                question.columns.forEach(col => {
                    const inputType = isSingleAnswer ? 'radio' : 'checkbox';
                    const colId = col.id || col.value;
                    const name = isSingleAnswer ? `${question.id}-${row.id}` : `${question.id}-${row.id}-${colId}`;
                    const id = `${question.id}-${row.id}-${colId}`;
                    tableHTML += '<td class="border border-outline-variant p-2 text-center">';
                    tableHTML += `<input type="${inputType}" id="${id}" name="${name}" value="${col.value}" class="form-${inputType} text-primary">`;
                    tableHTML += '</td>';
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table></div>';
            controlArea.innerHTML = tableHTML;
            break;
        case 'rating_scale': {
            const rsCfg = question.meta?.ratingScaleConfig || {};
            const rsPoints = rsCfg.points || 5;
            const rsMinLabel = resolveSurveyText(rsCfg.minLabel) || '';
            const rsMaxLabel = resolveSurveyText(rsCfg.maxLabel) || '';
            const rsShowMid = !!rsCfg.showMidLabel;
            const rsMidLabel = rsShowMid ? (resolveSurveyText(rsCfg.midLabel) || '') : '';
            const rsMidIndex = Math.ceil(rsPoints / 2); // 中間ポイントのインデックス

            // 外枠コンテナ
            const rsContainer = document.createElement('div');
            rsContainer.className = 'border border-gray-200 rounded-xl px-4 py-5 sm:px-6';

            // メイン行（左ラベル + ラジオ群 + 右ラベル）
            const rsMainRow = document.createElement('div');
            rsMainRow.className = 'flex items-start gap-3 sm:gap-4';

            // 左ラベル
            const rsLeftLabel = document.createElement('span');
            rsLeftLabel.className = 'text-xs sm:text-sm text-gray-500 font-medium pt-1 shrink-0 max-w-[60px] sm:max-w-[80px] leading-snug';
            rsLeftLabel.textContent = rsMinLabel;

            // ラジオボタン群
            const rsRadioGroup = document.createElement('div');
            rsRadioGroup.className = 'flex items-start justify-between flex-1';

            // 中間ラベル表示エリア（常時表示）
            let rsMidDisplay = null;
            if (rsShowMid && rsMidLabel) {
                rsMidDisplay = document.createElement('div');
                rsMidDisplay.className = 'text-center text-xs text-gray-400 font-medium mt-2';
                rsMidDisplay.textContent = rsMidLabel;
            }


            for (let i = 1; i <= rsPoints; i++) {
                const label = document.createElement('label');
                label.className = 'flex flex-col items-center gap-1.5 cursor-pointer group';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = question.id;
                radio.value = String(i);
                radio.className = 'sr-only peer';

                // カスタムラジオ円
                const circle = document.createElement('span');
                circle.className = 'w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 border-gray-300 transition-all flex items-center justify-center group-hover:border-primary peer-checked:border-primary peer-checked:bg-white peer-focus-visible:ring-2 peer-focus-visible:ring-primary/40';

                // 内側の塗りつぶし丸
                const innerDot = document.createElement('span');
                innerDot.className = 'w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-primary scale-0 transition-transform peer-checked:scale-100';

                circle.appendChild(innerDot);

                // 番号テキスト
                const numText = document.createElement('span');
                numText.className = 'text-xs sm:text-sm text-gray-500 font-medium';
                numText.textContent = String(i);

                label.append(radio, circle, numText);

                // peer-checked CSS がネイティブで動かない場合のフォールバック（JS制御）
                radio.addEventListener('change', () => {
                    rsRadioGroup.querySelectorAll('label').forEach(lbl => {
                        const r = lbl.querySelector('input[type="radio"]');
                        const c = lbl.querySelector('span:first-of-type');
                        const d = c?.querySelector('span');
                        if (r && r.checked) {
                            c.classList.remove('border-gray-300');
                            c.classList.add('border-primary');
                            if (d) { d.classList.remove('scale-0'); d.classList.add('scale-100'); }
                        } else {
                            c.classList.add('border-gray-300');
                            c.classList.remove('border-primary');
                            if (d) { d.classList.add('scale-0'); d.classList.remove('scale-100'); }
                        }
                    });
                });

                rsRadioGroup.appendChild(label);
            }

            // 右ラベル
            const rsRightLabel = document.createElement('span');
            rsRightLabel.className = 'text-xs sm:text-sm text-gray-500 font-medium pt-1 shrink-0 max-w-[60px] sm:max-w-[80px] leading-snug text-right';
            rsRightLabel.textContent = rsMaxLabel;

            rsMainRow.append(rsLeftLabel, rsRadioGroup, rsRightLabel);
            rsContainer.appendChild(rsMainRow);

            // 中間ラベルをコンテナ末尾に追加（常時表示）
            if (rsMidDisplay) {
                rsContainer.appendChild(rsMidDisplay);
            }


            controlArea.appendChild(rsContainer);
            break;
        }
        case 'explanation_card':
            controlArea.innerHTML = `<p class="text-on-surface-variant">${resolveSurveyText(question.text)}</p>`;
            // 説明カードには凡例や枠線が不要な場合があるため、スタイルを調整
            break;
        case 'handwriting_space':
            const canvasId = `${question.id}-canvas`;
            const handwritingConfig = question.meta?.handwritingConfig || { canvasHeight: 200 };
            const canvasHeight = handwritingConfig.canvasHeight || 200;

            // ツールボックスのHTMLを定義
            controlArea.innerHTML = `
                <div class="handwriting-container">
                    <div class="toolbox">
                        <div class="tool-group">
                            <button type="button" id="${question.id}-pen-tool" class="tool-button" title="ペンモードをオンにする">
                                <span class="material-icons">edit</span>
                            </button>
                            <button type="button" id="${question.id}-eraser-tool" class="tool-button" title="消しゴム" disabled>
                                <span class="material-icons">layers_clear</span>
                            </button>
                        </div>
                        <div class="tool-group">
                            <input type="color" id="${question.id}-color-picker" class="color-palette" title="カラーパレット" value="#000000">
                            <input type="range" id="${question.id}-thickness-slider" class="thickness-slider" min="1" max="20" value="5" title="ペンの太さ">
                        </div>
                        <div class="tool-group">
                            <button type="button" id="${question.id}-undo-btn" class="tool-button" title="戻る">
                                <span class="material-icons">undo</span>
                            </button>
                            <button type="button" id="${question.id}-redo-btn" class="tool-button" title="進む">
                                <span class="material-icons">redo</span>
                            </button>
                        </div>
                         <div class="tool-group">
                            <button type="button" id="${question.id}-clear-btn" class="tool-button" title="リセット">
                                <span class="material-icons">delete</span>
                            </button>
                        </div>
                    </div>
                    <div class="relative">
                        <canvas id="${canvasId}" class="border border-gray-400 rounded-md w-full" style="touch-action: auto;" height="${canvasHeight}"></canvas>
                        <div id="${question.id}-canvas-overlay" class="absolute inset-0 flex items-center justify-center bg-gray-50/80 rounded-md cursor-pointer" title="タップしてペンモードをオン">
                            <div class="flex flex-col items-center gap-1 text-gray-400 pointer-events-none">
                                <span class="material-icons text-3xl">edit_off</span>
                                <span class="text-xs font-medium">ペンモードがオフです</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // setTimeoutを使用して、DOMがレンダリングされた後にCanvasの初期化を行う
            setTimeout(() => {
                const canvas = document.getElementById(canvasId);
                if (!canvas) return;
                const ctx = canvas.getContext('2d');

                // DPIスケーリングで高解像度ディスプレイに対応
                const dpr = window.devicePixelRatio || 1;
                const rect = canvas.getBoundingClientRect();
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);

                // 描画状態
                let drawing = false;
                let tool = 'pen'; // 'pen' or 'eraser'
                let penModeActive = false;

                const canvasOverlay = document.getElementById(`${question.id}-canvas-overlay`);

                function setPenMode(active) {
                    penModeActive = active;
                    canvas.style.touchAction = active ? 'none' : 'auto';
                    if (canvasOverlay) canvasOverlay.style.display = active ? 'none' : 'flex';
                    penTool.classList.toggle('active', active && tool === 'pen');
                    eraserTool.disabled = !active;
                    if (!active) {
                        tool = 'pen';
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.strokeStyle = colorPicker.value;
                        eraserTool.classList.remove('active');
                        penTool.classList.remove('active');
                    }
                }
                
                // 履歴管理
                let history = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
                let historyIndex = 0;

                // ツールボタン
                const penTool = document.getElementById(`${question.id}-pen-tool`);
                const eraserTool = document.getElementById(`${question.id}-eraser-tool`);
                const colorPicker = document.getElementById(`${question.id}-color-picker`);
                const thicknessSlider = document.getElementById(`${question.id}-thickness-slider`);
                const undoBtn = document.getElementById(`${question.id}-undo-btn`);
                const redoBtn = document.getElementById(`${question.id}-redo-btn`);
                const clearBtn = document.getElementById(`${question.id}-clear-btn`);

                // 初期設定
                ctx.strokeStyle = colorPicker.value;
                ctx.lineWidth = thicknessSlider.value;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                updateHistoryButtons();


                // --- 関数定義 ---

                function updateToolButtons() {
                    penTool.classList.toggle('active', penModeActive && tool === 'pen');
                    eraserTool.classList.toggle('active', penModeActive && tool === 'eraser');
                }

                function updateHistoryButtons() {
                    undoBtn.disabled = historyIndex <= 0;
                    redoBtn.disabled = historyIndex >= history.length - 1;
                }
                
                function saveState() {
                    // Redoの履歴を削除
                    if (historyIndex < history.length - 1) {
                        history = history.slice(0, historyIndex + 1);
                    }
                    history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
                    historyIndex++;
                    updateHistoryButtons();
                    
                    // stateを更新して自動保存をトリガー
                    state.answers[question.id] = canvas.toDataURL();
                    state.hasUnsavedChanges = true;
                }

                function restoreState(index) {
                    if (index < 0 || index >= history.length) return;
                    ctx.putImageData(history[index], 0, 0);
                    historyIndex = index;
                    updateHistoryButtons();
                    
                    // stateを更新
                    state.answers[question.id] = canvas.toDataURL();
                    state.hasUnsavedChanges = true;
                }

                const getPos = (e) => {
                    const rect = canvas.getBoundingClientRect();
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    return {
                        x: (clientX - rect.left) * dpr,
                        y: (clientY - rect.top) * dpr
                    };
                };

                const startDrawing = (e) => {
                    if (!penModeActive) return;
                    e.preventDefault();
                    drawing = true;
                    const pos = getPos(e);
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y);
                };

                const draw = (e) => {
                    if (!drawing || !penModeActive) return;
                    e.preventDefault();
                    const pos = getPos(e);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                };

                const stopDrawing = () => {
                    if (!drawing) return;
                    drawing = false;
                    ctx.closePath();
                    saveState();
                };

                // --- イベントリスナー設定 ---

                // ツール選択
                penTool.addEventListener('click', () => {
                    if (!penModeActive) {
                        // ペンモードをオン
                        setPenMode(true);
                    } else if (tool !== 'pen') {
                        // 消しゴムからペンに切り替え
                        tool = 'pen';
                        ctx.globalCompositeOperation = 'source-over';
                        ctx.strokeStyle = colorPicker.value;
                        updateToolButtons();
                    } else {
                        // ペンモードをオフ
                        setPenMode(false);
                    }
                });

                eraserTool.addEventListener('click', () => {
                    if (!penModeActive) return;
                    tool = 'eraser';
                    ctx.globalCompositeOperation = 'destination-out';
                    updateToolButtons();
                });


                // プロパティ変更
                colorPicker.addEventListener('input', (e) => {
                    ctx.strokeStyle = e.target.value;
                    // ペンモードに戻す
                    tool = 'pen';
                    ctx.globalCompositeOperation = 'source-over';
                    updateToolButtons();
                });

                thicknessSlider.addEventListener('input', (e) => {
                    ctx.lineWidth = e.target.value;
                });

                // 履歴操作
                undoBtn.addEventListener('click', () => {
                    if (historyIndex > 0) {
                        restoreState(historyIndex - 1);
                    }
                });

                redoBtn.addEventListener('click', () => {
                    if (historyIndex < history.length - 1) {
                        restoreState(historyIndex + 1);
                    }
                });
                
                clearBtn.addEventListener('click', () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    saveState(); // クリアした状態を保存
                });

                // 描画イベント
                canvas.addEventListener('mousedown', startDrawing);
                canvas.addEventListener('mousemove', draw);
                canvas.addEventListener('mouseup', stopDrawing);
                canvas.addEventListener('mouseleave', stopDrawing);
                canvas.addEventListener('touchstart', startDrawing, { passive: false });
                canvas.addEventListener('touchmove', draw, { passive: false });
                canvas.addEventListener('touchend', stopDrawing);

            }, 0);
            break;
        case 'image_upload': {
            const imageInput = document.createElement('input');
            imageInput.type = 'file';
            imageInput.accept = 'image/*';
            imageInput.name = question.id;
            imageInput.className = 'hidden';

            const previewArea = document.createElement('div');
            previewArea.className = 'mt-2';

            const uploadBtn = document.createElement('div');
            uploadBtn.className = 'p-6 border-2 border-dashed rounded-lg text-center cursor-pointer hover:bg-gray-50 hover:border-primary transition-all';
            uploadBtn.innerHTML = `
                <span class="material-icons text-4xl text-gray-400">photo_camera</span>
                <p class="text-sm text-gray-500 mt-2">${t('survey.tapToCapture') || '写真を撮影またはファイルを選択'}</p>
            `;

            uploadBtn.addEventListener('click', () => imageInput.click());

            imageInput.addEventListener('change', () => {
                const file = imageInput.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewArea.innerHTML = `<img src="${e.target.result}" class="max-w-full max-h-64 rounded-lg mt-2" alt="preview">`;
                    state.answers[question.id] = e.target.result;
                    state.hasUnsavedChanges = true;
                };
                reader.readAsDataURL(file);
            });

            controlArea.appendChild(imageInput);
            controlArea.appendChild(uploadBtn);
            controlArea.appendChild(previewArea);
            break;
        }
        default:
            controlArea.innerHTML = `<p class="text-sm text-error">未対応の設問タイプです: ${question.type}</p>`;
    }
    
    fieldset.addEventListener('change', (e) => {
        const questionId = fieldset.dataset.questionId;
        const question = state.surveyData.questions.find(q => q.id === questionId);

        if (question.type === 'date_time') {
            const dateEl = fieldset.querySelector(`input[name="${questionId}_date"]`);
            const timeEl = fieldset.querySelector(`input[name="${questionId}_time"]`);
            const dateValue = dateEl ? dateEl.value : '';
            const timeValue = timeEl ? timeEl.value : '';

            if (dateValue && timeValue) {
                state.answers[questionId] = `${dateValue}T${timeValue}`;
            } else if (dateValue) {
                state.answers[questionId] = dateValue;
            } else if (timeValue) {
                state.answers[questionId] = timeValue;
            } else {
                delete state.answers[questionId];
            }
        } else {
            const formData = new FormData(DOMElements.surveyForm);
            const entries = formData.getAll(questionId);
            
            if (entries.length > 1) {
                state.answers[questionId] = entries; // チェックボックスやマトリックスMAなど
            } else if (entries.length === 1) {
                state.answers[questionId] = entries[0]; // ラジオボタンやテキスト入力など
            } else {
                delete state.answers[questionId]; // 未選択状態
            }
        }
        state.hasUnsavedChanges = true;
        validateField(questionId); // リアルタイムバリデーションを実行
        console.log('Answers updated:', state.answers);
    });

    return fieldset;
}

// --- 機能別ロジック ---

function setupPremiumFeatures() {
    // 多言語対応
    const { languageSelect } = DOMElements;
    if (!languageSelect) {
        console.error('Language select element not found.');
        return;
    }

    const availableLanguages = inferAvailableLanguages();
    const displayLanguages = availableLanguages.filter((locale) => locale !== 'ja');

    if (!availableLanguages.includes(state.currentLanguage)) {
        const requestedLocale = normalizeLocale(state.currentLanguage);
        state.currentLanguage = availableLanguages.includes(requestedLocale)
            ? requestedLocale
            : (availableLanguages[0] || 'ja');
    }

    languageSelect.innerHTML = ''; // 既存のオプションをクリア

    // デフォルトの「Language」オプションを追加
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = t('surveyAnswer.languageLabel');
    defaultOption.disabled = true;
    languageSelect.appendChild(defaultOption);

    availableLanguages.forEach(lang => {
        const langName = LANGUAGE_LABELS[lang] || lang;
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = langName;
        languageSelect.appendChild(option);
    });

    // 現在の言語に基づいて選択状態を設定
    languageSelect.value = getCurrentLocale();

    // コンテナを表示
    const container = document.getElementById('language-switcher-container');
    if (container) {
        container.classList.toggle('hidden', availableLanguages.length <= 1);
    }

    // イベントリスナーを設定 (一度だけ)
    if (!languageSelect.dataset.listenerAttached) {
        languageSelect.dataset.listenerAttached = 'true';
        languageSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            if (newLang !== state.currentLanguage) {
                state.currentLanguage = normalizeLocale(newLang);
                renderSurvey();
                populateFormWithDraft();
                showToast(t('surveyAnswer.switchedLocale', { locale: LANGUAGE_LABELS[state.currentLanguage] || state.currentLanguage }));
            }
        });
    }
}

function saveDraft() {
    // 未保存の変更がない場合はスキップ
    if (!state.hasUnsavedChanges) {
        return;
    }

    const draftKey = `survey_draft_${state.surveyId}_${state.sessionId}`;
    
    // Create a copy of state.answers and remove bizcardImages for localStorage
    const answersToSave = { ...state.answers };
    if (answersToSave.bizcardImages) {
        delete answersToSave.bizcardImages;
    }

    localStorage.setItem(draftKey, JSON.stringify(answersToSave));
    state.hasUnsavedChanges = false;

    console.log('自動保存: ドラフトを保存しました。', state.answers);
}

function validateField(questionId) {
    const question = state.surveyData.questions.find(q => q.id === questionId);
    const fieldset = document.querySelector(`fieldset[data-question-id="${questionId}"]`);
    if (!question || !fieldset) return;

    let isValid = true;
    if (question.required) {
        const answer = state.answers[question.id];
        const isAnswered = answer && (Array.isArray(answer) ? answer.length > 0 : String(answer).trim() !== '');
        if (!isAnswered) {
            isValid = false;
        }
    }

    if (isValid) {
        fieldset.classList.remove('border-error', 'border-2');
    } else {
        fieldset.classList.add('border-error', 'border-2');
    }
    return isValid;
}

function validateForm() {
    let isFormValid = true;
    state.surveyData.questions.forEach(question => {
        // validateFieldがエラー表示も担当する
        const isFieldValid = validateField(question.id);
        if (!isFieldValid) {
            isFormValid = false;
        }
    });
    return isFormValid;
}

async function handleSubmit() {
    if (state.isSubmitting) return;

    if (!validateForm()) {
        showToast(t('common.required'));
        return;
    }

    state.isSubmitting = true;
    DOMElements.submitSurveyButton.disabled = true;
    showSubmittingModal(true);

    try {
        // 回答データを収集
        const finalAnswers = {
            surveyId: state.surveyId,
            submittedAt: new Date().toISOString(),
            answerLocale: getCurrentLocale(),
            answers: state.answers,
        };

        // ダミーのアップロード処理
        await simulateUpload(finalAnswers);

        // ローカルストレージに保存
        const responseKey = `survey_response_${state.surveyId}_${Date.now()}`;
        localStorage.setItem(responseKey, JSON.stringify(finalAnswers));

        // ドラフトを削除
        localStorage.removeItem(`survey_draft_${state.surveyId}_${state.sessionId}`);
        state.hasUnsavedChanges = false;

        // サンクス画面へ遷移
        const thankYouSettings = state.surveyData.thankYouScreenSettings || state.surveyData.settings?.thankYouScreen || {};

        if (state.isPreviewMode) {
            // プレビュー: iframe内でサンクス画面をインライン描画
            const thankYouMessage = (thankYouSettings.thankYouMessage
                ? (typeof thankYouSettings.thankYouMessage === 'object'
                    ? (thankYouSettings.thankYouMessage[getCurrentLocale()] || thankYouSettings.thankYouMessage.ja || '')
                    : thankYouSettings.thankYouMessage)
                : '') || 'ご回答ありがとうございました。';
            document.open();
            document.write(`<!DOCTYPE html><html lang="ja"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<script src="https://cdn.tailwindcss.com"><\/script>
</head><body class="bg-blue-50 min-h-screen flex items-center justify-center py-12 px-4">
<div class="max-w-md w-full bg-white rounded-lg shadow-xl p-10 text-center space-y-4">
  <svg class="mx-auto w-16 h-16 text-green-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>
  <h2 class="text-2xl font-extrabold text-gray-900">回答完了</h2>
  <p class="text-sm text-gray-600">${thankYouMessage}</p>
  <p class="text-xs text-amber-600 font-bold mt-4">※ プレビューモードのため回答データは送信されていません</p>
</div>
</body></html>`);
            document.close();
            return;
        }

        let thankYouUrl = thankYouSettings.url || 'thankYouScreen.html';
        thankYouUrl += `?surveyId=${state.surveyId}`;
        thankYouUrl += `&answerLocale=${encodeURIComponent(getCurrentLocale())}`;
        if (state.surveyData.plan === 'premium') {
            thankYouUrl += '&continuous=true';
        }
        window.location.href = thankYouUrl;

    } catch (error) {
        console.error('送信エラー:', error);
        displayError(t('surveyAnswer.submitFailed'));
        state.isSubmitting = false;
        DOMElements.submitSurveyButton.disabled = false;
        showSubmittingModal(false);
    }
}

async function simulateUpload(data) {
    let progress = 0;
    DOMElements.submittingProgressBar.style.width = '0%';
    DOMElements.submittingPercentage.textContent = '0%';

    return new Promise(resolve => {
        const interval = setInterval(() => {
            progress += Math.random() * 20;
            if (progress > 100) progress = 100;
            
            DOMElements.submittingProgressBar.style.width = `${progress}%`;
            DOMElements.submittingPercentage.textContent = `${Math.round(progress)}%`;

            if (progress >= 100) {
                clearInterval(interval);
                setTimeout(resolve, 300); // 100%表示を少し見せる
            }
        }, 200);
    });
}


// --- UIフィードバック関数 ---

function showToast(message) {
    if (!DOMElements.toastNotification || !DOMElements.toastMessage) {
        console.error('Toast elements not initialized.');
        return;
    }
    
    DOMElements.toastMessage.textContent = message;
    DOMElements.toastNotification.classList.remove('hidden');
    
    // 3秒後に非表示にする
    setTimeout(() => {
        DOMElements.toastNotification.classList.add('hidden');
    }, 3000);
}

function showLoading(show) {
    DOMElements.loadingIndicator.style.display = show ? 'flex' : 'none';
}

function showSubmittingModal(show) {
    DOMElements.submittingModal.style.display = show ? 'flex' : 'none';
}

function displayError(message) {
    DOMElements.surveyForm.classList.add('hidden');
    DOMElements.errorContainer.innerHTML = `<p>${message}</p>`;
    DOMElements.errorContainer.classList.remove('hidden');
}

// --- その他のユーティリティ ---

function setupHeaderScrollBehavior() {
    // Header has been removed.
}

function setupLeaveConfirmation() {


    // 戻るボタン対策
    window.addEventListener('popstate', (e) => {
        console.log('popstate event fired. hasUnsavedChanges:', state.hasUnsavedChanges); // <-- Add this line
        if (state.hasUnsavedChanges) {
            showModal(DOMElements.leaveConfirmModal, 'ページを離れますか？', '変更が保存されていません。このページを離れてもよろしいですか？', {
                saveText: '離れる',
                cancelText: '留まる',
                onSave: () => {
                    state.hasUnsavedChanges = false; // 離脱を許可
                    DOMElements.leaveConfirmModal.style.display = 'none'; // <-- Add this line
                    history.back(); // <-- 実際に前のページに戻る
                },
                onCancel: () => {
                    // 留まる場合、何もしない。ユーザーは既に現在のページに留まっている。
                    DOMElements.leaveConfirmModal.style.display = 'none'; // モーダルを閉じる
                    history.pushState(null, '', location.href); // <-- この行を追加: 履歴ポインタを現在のページに戻す
                }
            });
        } else {
            // 変更がない場合は、そのまま前のページに戻る
            // 何もしないことで、ブラウザのデフォルトの戻る動作が実行される
        }
    });

    // ページ内リンク対策
    document.body.addEventListener('click', (e) => {
        if (!state.hasUnsavedChanges) return;

        const anchor = e.target.closest('a');
        if (anchor && anchor.href && anchor.target !== '_blank') {
            if (location.origin !== anchor.origin || !anchor.hash) {
                 e.preventDefault();
                 showModal(DOMElements.leaveConfirmModal, 'ページを離れますか？', '変更が保存されていません。このページを離れてもよろしいですか？', {
                    saveText: '離れる',
                    cancelText: '留まる',
                    onSave: () => {
                        state.hasUnsavedChanges = false; // 離脱を許可
                        window.location.href = anchor.href;
                    },
                    onCancel: () => {}
                });
            }
        }
    }, true);
}

function disablePullToRefresh() {
    document.body.style.overscrollBehaviorY = 'contain';
}

function adjustColor(color, amount) {
    // Handles hex, rgb, and rgba colors
    let r, g, b;

    if (color.startsWith('#')) {
        color = color.slice(1);
        if (color.length === 3) {
            color = color.split('').map(c => c + c).join('');
        }
        r = parseInt(color.substring(0, 2), 16);
        g = parseInt(color.substring(2, 4), 16);
        b = parseInt(color.substring(4, 6), 16);
    } else if (color.startsWith('rgb')) {
        const parts = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        r = parseInt(parts[1], 10);
        g = parseInt(parts[2], 10);
        b = parseInt(parts[3], 10);
    } else {
        // Return a default if color format is unknown
        return { hex: '#4285F4', rgb: { r: 66, g: 133, b: 244 } };
    }
    
    r = Math.max(0, Math.min(255, r - amount));
    g = Math.max(0, Math.min(255, g - amount));
    b = Math.max(0, Math.min(255, b - amount));

    const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    return { hex, rgb: { r, g, b } };
}

function updateDynamicColors(backgroundColor) {
    const darkerColor = adjustColor(backgroundColor, 40);

    // Update left border for required questions
    const requiredElements = document.querySelectorAll('.is-required');
    requiredElements.forEach(el => {
        el.style.borderLeftColor = darkerColor.hex;
    });

    // Create/update style tag for focus-within styles
    let styleTag = document.getElementById('dynamic-styles');
    if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'dynamic-styles';
        document.head.appendChild(styleTag);
    }
    
    const { r, g, b } = darkerColor.rgb;

    styleTag.innerHTML = `
        .survey-question-card:focus-within {
            border-color: ${darkerColor.hex};
            transform: translateY(-3px);
            box-shadow: 0 4px 12px 0 rgba(${r}, ${g}, ${b}, 0.25);
        }
    `;
}
