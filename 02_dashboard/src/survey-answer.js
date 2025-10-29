/**
 * survey-answer.js
 * アンケート回答画面のフロントエンドロジック
 */

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
    currentLanguage: 'ja',
    hasUnsavedChanges: false,
};

// --- DOM要素 ---
let DOMElements = {}; // DOM要素の参照を保持するオブジェクト

function initializeDOMElements() {
    DOMElements = {
        loadingIndicator: document.getElementById('loading-indicator'),
        header: document.getElementById('survey-page-header'),
        headerText: document.getElementById('survey-header-text'),
        draftSaveButton: document.getElementById('draft-save-fab'),
        draftSaveFabContainer: document.getElementById('draft-save-fab-container'),
        languageSwitcher: document.getElementById('language-switcher'),
        languageSwitcherButton: document.getElementById('language-switcher-button'),
        languageMenu: document.getElementById('language-menu'),
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

        // --- カラーピッカーテスト機能用要素 ---
        surveyMainWrapper: document.getElementById('survey-main-wrapper'),
        headerColorPicker: document.getElementById('header-color-picker'),
        footerColorPicker: document.getElementById('footer-color-picker'),
        backgroundColorPicker: document.getElementById('background-color-picker'),
        footer: document.querySelector('footer'),
    };
}

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeDOMElements(); // DOMElements の初期化をここで行う
        showLoading(true); // 初期化後にローディングを表示
        initializeParams();
        await loadSurveyData();
        setupEventListeners();
        await checkForDraft();
        renderSurvey();
        if (state.draftToRestore) {
            populateFormWithDraft();
        }
        startAutoSaveTimer();
        setupLeaveConfirmation();
        setupHeaderScrollBehavior();
        disablePullToRefresh();
    } catch (error) {
        console.error('初期化エラー:', error);
        displayError(error.message || 'アンケートの読み込みに失敗しました。');
    } finally {
        showLoading(false);
    }
});

// --- 初期化ヘルパー関数 ---

function initializeParams() {
    const params = new URLSearchParams(window.location.search);
    state.surveyId = params.get('surveyId');
    if (!state.surveyId) {
        throw new Error('URLに surveyId が指定されていません。');
    }
}

function normalizeQuestion(rawQuestion, index) {
    const type = normalizeQuestionType(rawQuestion.type);
    const options = (type === 'single_answer' || type === 'multi_answer' || type === 'dropdown') 
        ? normalizeOptions(rawQuestion.options || rawQuestion.choices, rawQuestion.id || `q${index}`)
        : [];

    return {
        ...rawQuestion,
        id: rawQuestion.id || `q${index}`,
        type: type,
        text: rawQuestion.text || rawQuestion.title,
        required: rawQuestion.required || rawQuestion.isRequired || false,
        options: options,
        columns: rawQuestion.columns || [],
        rows: rawQuestion.rows || [],
    };
}

function normalizeQuestionType(type) {
    const t = String(type).toLowerCase();
    if (t.includes('single') || t.includes('radio')) return 'single_answer';
    if (t.includes('multi') || t.includes('check')) return 'multi_answer';
    if (t.includes('free') || t.includes('text')) return 'free_answer';
    if (t.includes('number')) return 'number_answer';
    if (t.includes('date')) return 'date_time';
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
    const response = await fetch(`/data/demo_surveys/${state.surveyId}.json`);
    if (!response.ok) {
        throw new Error(`アンケート定義ファイルが見つかりません (ID: ${state.surveyId})`);
    }
    state.surveyData = await response.json();

    // データ構造の正規化
    const rawQuestions = state.surveyData.questions || state.surveyData.details || [];
    state.surveyData.questions = rawQuestions.map((q, index) => normalizeQuestion(q, index));

    // プレミアム機能のチェックとUIの更新
    // NOTE: Temporarily calling this always for testing
    setupPremiumFeatures();
}

function setupEventListeners() {
    // 一時保存ボタンのイベントリスナー設定
    if (DOMElements.draftSaveButton) {
        DOMElements.draftSaveButton.addEventListener('click', () => saveDraft(true));
    } else {
        console.error('一時保存ボタン (draft-save-fab) が見つかりません。一時保存機能は無効です。');
    }
    
    // 他の必須ボタンもガード
    if (DOMElements.submitSurveyButton) {
        DOMElements.submitSurveyButton.addEventListener('click', handleSubmit);
    }
    if (DOMElements.bizcardCameraButton) {
        DOMElements.bizcardCameraButton.addEventListener('click', startBizcardUploadFlow);
    }
    if (DOMElements.bizcardManualButton) {
        DOMElements.bizcardManualButton.addEventListener('click', () => {
            const formId = 'manual-bizcard-form';
            const body = `
            <form id="${formId}" class="space-y-4">
                <div>
                    <label for="manual-name" class="block text-sm font-medium text-on-surface-variant">氏名</label>
                    <input type="text" id="manual-name" name="name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
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
                    state.answers.manualBizcardInfo = manualInfo;
                    state.hasUnsavedChanges = true;
                    showToast('名刺情報を保存しました。');
                    console.log('Manual bizcard info saved:', manualInfo);
                }
            });
        });
    }

    // テスト用カラーピッカー機能のセットアップ
    setupColorPickerTestFeature();
    
    // アイドル検出とFAB表示ロジックのセットアップ
    setupIdleDetection();
}

// ... (他の関数の間)

// --- 名刺アップロードフロー ---
let bizcardImages = { front: null, back: null };

function startBizcardUploadFlow() {
    let localImages = { front: null, back: null };

    const showChoice = () => {
        const body = `
            <p class="text-center text-sm text-gray-600 mb-6">名刺画像のアップロード方法を選択してください。</p>
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
        showModal(DOMElements.bizcardUploadModal, '名刺をアップロード (1/4)', body, { cancelText: '閉じる' });

        document.getElementById('upload-storage').addEventListener('click', () => triggerFileInput(false, 'front'));
        document.getElementById('upload-camera').addEventListener('click', () => triggerFileInput(true, 'front'));
    };

    const triggerFileInput = (useCamera, side) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (useCamera) input.capture = 'environment';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                localImages[side] = event.target.result;
                if (side === 'front') showFrontPreview();
                else showBackPreview();
            };
            reader.readAsDataURL(file);
        };
        input.click();
    };

    const showFrontPreview = () => {
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
            onCancel: showChoice
        });

        // 「裏面をスキップ」ボタンをフッターに別途追加
        const footer = DOMElements.bizcardUploadModal.querySelector('.flex.justify-end');
        if (footer) {
            const skipButton = document.createElement('button');
            skipButton.id = 'skip-back-button';
            skipButton.className = 'text-sm font-medium text-primary hover:underline mr-auto';
            skipButton.textContent = '裏面をスキップ';
            skipButton.onclick = showFinalConfirmation;
            footer.insertBefore(skipButton, footer.firstChild);
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
        document.getElementById('upload-storage-back').addEventListener('click', () => triggerFileInput(false, 'back'));
        document.getElementById('upload-camera-back').addEventListener('click', () => triggerFileInput(true, 'back'));
    };

    const showBackPreview = () => {
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
        const backImageHTML = localImages.back ? `<img src="${localImages.back}" alt="名刺 裏面" class="w-full rounded-md shadow-sm">` : '<div class="h-full flex items-center justify-center bg-gray-100 rounded-md"><p class="text-sm text-gray-500">裏面なし</p></div>';
        const body = `
            <div class="flex items-center justify-center mb-4">
                <span class="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center"><span class="material-icons text-primary">check</span></span>
                <span class="flex-auto border-t-2 border-primary mx-2"></span>
                <span class="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center"><span class="material-icons text-primary">check</span></span>
                <span class="flex-auto border-t-2 border-primary mx-2"></span>
                <span class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">3</span>
            </div>
            <p class="text-center text-sm text-gray-600 mb-4">以下の内容でアップロードします。</p>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <p class="font-bold text-center mb-2">表面</p>
                    <img src="${localImages.front}" alt="名刺 表面" class="w-full rounded-md shadow-sm">
                </div>
                <div>
                    <p class="font-bold text-center mb-2">裏面</p>
                    ${backImageHTML}
                </div>
            </div>
        `;
        showModal(DOMElements.bizcardUploadModal, '最終確認', body, {
            saveText: 'アップロード完了',
            cancelText: '戻る',
            onSave: () => {
                state.answers.bizcardImages = { ...localImages };
                state.hasUnsavedChanges = true;
                showToast('名刺画像を保存しました。');
                DOMElements.bizcardUploadModal.style.display = 'none';
            },
            onCancel: () => localImages.back ? showBackPreview() : showFrontPreview()
        });
    };

    showChoice();
}

// ... (他の関数の間)

// --- モーダル制御 ---
function showModal(modalElement, title, body, options = {}) {
    const { onSave, onCancel, saveText = '保存', cancelText = 'キャンセル' } = options;

    const saveButtonHTML = onSave ? `<button id="modal-save-button" class="px-4 py-2 text-sm font-bold text-on-primary bg-primary rounded-md hover:bg-primary-dark">${saveText}</button>` : '';
    const cancelButtonHTML = onCancel ? `<button id="modal-cancel-button" class="px-4 py-2 text-sm font-medium rounded-md hover:bg-surface-container-high">${cancelText}</button>` : '';

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
            modalElement.style.display = 'none';
        });
    }

    if (onCancel) {
        modalElement.querySelector('#modal-cancel-button').addEventListener('click', () => {
            onCancel();
            modalElement.style.display = 'none';
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
        if (elements.length === 0 && question.type !== 'handwriting_space') return;

        const type = question.type;

        if (type === 'handwriting_space') {
            const canvas = document.getElementById(`${questionId}-canvas`);
            if (canvas && answer) {
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0);
                };
                img.src = answer;
            }
        } else if (elements[0].type === 'radio') {
            elements.forEach(el => {
                if (el.value === answer) {
                    el.checked = true;
                }
            });
        } else if (type === 'checkbox') {
            const answerArray = Array.isArray(answer) ? answer : [answer];
            elements.forEach(el => {
                if (answerArray.includes(el.value)) {
                    el.checked = true;
                }
            });
        } else { // textarea, select-one, number, datetime-local etc.
            elements[0].value = answer;
        }
    });
    console.log('フォームにドラフトを反映しました。');
}

function startAutoSaveTimer() {
    setInterval(() => saveDraft(false), 30000); // 30秒ごとに自動保存
}

// --- 描画関数 ---

function renderSurvey() {
    renderHeader();
    renderQuestions();
}

function renderHeader() {
    const { displayTitle, description } = state.surveyData;
    DOMElements.headerText.innerHTML = `
        <h1 class="text-2xl sm:text-3xl font-bold text-on-surface">${resolveLocalizedText(displayTitle) || 'アンケート'}</h1>
        <p class="text-on-surface-variant mt-2">${resolveLocalizedText(description) || ''}</p>
    `;
    document.title = `SpeedAd - ${resolveLocalizedText(displayTitle) || 'アンケート回答'}`;
}

function renderQuestions() {
    const form = DOMElements.surveyForm;
    form.innerHTML = ''; // 既存の設問をクリア

    if (!Array.isArray(state.surveyData.questions) || state.surveyData.questions.length === 0) {
        form.innerHTML = '<p class="text-center text-on-surface-variant">このアンケートには表示できる設問がありません。</p>';
        return;
    }

    state.surveyData.questions.forEach(question => {
        const questionElement = createQuestionElement(question);
        form.appendChild(questionElement);
    });
}

function createQuestionElement(question) {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'survey-question-card';
    if (question.required) {
        fieldset.classList.add('is-required');
    }
    fieldset.dataset.questionId = question.id;

    const requiredBadge = question.required ? `<span class="text-red-600 font-bold ml-1">*</span>` : '';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'question-content';

    contentDiv.innerHTML = `
        <div class="flex items-center mb-4">
            <p class="text-base font-semibold text-on-surface-variant">${resolveLocalizedText(question.text)}</p>
            ${requiredBadge}
        </div>
        <div class="control-area space-y-3"></div>
    `;
    
    fieldset.appendChild(contentDiv);
    const controlArea = fieldset.querySelector('.control-area');

    // 設問タイプに応じて入力コントロールを生成
    switch (question.type) {
        case 'free_answer':
            controlArea.innerHTML = `<textarea name="${question.id}" class="w-full rounded-md border-gray-300 shadow-sm" rows="4"></textarea>`;
            break;
        case 'single_answer':
            question.options.forEach(opt => {
                controlArea.innerHTML += `
                    <div class="flex items-center gap-3">
                        <input type="radio" id="${question.id}-${opt.value}" name="${question.id}" value="${opt.value}" class="form-radio text-primary">
                        <label for="${question.id}-${opt.value}">${resolveLocalizedText(opt.text)}</label>
                    </div>`;
            });
            break;
        case 'multi_answer':
             question.options.forEach(opt => {
                controlArea.innerHTML += `
                    <div class="flex items-center gap-3">
                        <input type="checkbox" id="${question.id}-${opt.value}" name="${question.id}" value="${opt.value}" class="form-checkbox text-primary">
                        <label for="${question.id}-${opt.value}">${resolveLocalizedText(opt.text)}</label>
                    </div>`;
            });
            break;
        case 'number_answer':
            controlArea.innerHTML = `<input type="number" name="${question.id}" class="w-full rounded-md border-gray-300 shadow-sm" min="${question.min}" max="${question.max}" step="${question.step || 1}">`;
            break;
        case 'date_time':
            controlArea.innerHTML = `<input type="datetime-local" name="${question.id}" class="w-full rounded-md border-gray-300 shadow-sm">`;
            break;
        case 'dropdown':
            let optionsHTML = '';
            question.options.forEach(opt => {
                optionsHTML += `<option value="${opt.value}">${resolveLocalizedText(opt.text)}</option>`;
            });
            controlArea.innerHTML = `<select name="${question.id}" class="w-full rounded-md border-gray-300 shadow-sm">${optionsHTML}</select>`;
            break;
        case 'matrix_sa':
        case 'matrix_ma':
            const isSingleAnswer = question.type === 'matrix_sa';
            let tableHTML = '<div class="overflow-x-auto"><table class="min-w-full border-collapse border border-outline-variant"><thead><tr><th class="border border-outline-variant p-2 bg-surface-container"></th>';
            question.columns.forEach(col => {
                tableHTML += `<th class="border border-outline-variant p-2 bg-surface-container text-sm font-medium">${resolveLocalizedText(col.text)}</th>`;
            });
            tableHTML += '</tr></thead><tbody>';
            question.rows.forEach(row => {
                tableHTML += `<tr><td class="border border-outline-variant p-2 text-sm font-medium">${resolveLocalizedText(row.text)}</td>`;
                question.columns.forEach(col => {
                    const inputType = isSingleAnswer ? 'radio' : 'checkbox';
                    const name = isSingleAnswer ? `${question.id}-${row.id}` : `${question.id}-${row.id}-${col.id}`;
                    const id = `${question.id}-${row.id}-${col.id}`;
                    tableHTML += '<td class="border border-outline-variant p-2 text-center">';
                    tableHTML += `<input type="${inputType}" id="${id}" name="${name}" value="${col.value}" class="form-${inputType} text-primary">`;
                    tableHTML += '</td>';
                });
                tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table></div>';
            controlArea.innerHTML = tableHTML;
            break;
        case 'explanation_card':
            controlArea.innerHTML = `<p class="text-on-surface-variant">${resolveLocalizedText(question.text)}</p>`;
            // 説明カードには凡例や枠線が不要な場合があるため、スタイルを調整
            fieldset.className = 'p-4'; // 余白のみ
            fieldset.querySelector('legend').style.display = 'none';
            break;
        case 'handwriting_space':
            const canvasId = `${question.id}-canvas`;
            const clearButtonId = `${question.id}-clear`;
            controlArea.innerHTML = `
                <canvas id="${canvasId}" class="border border-gray-400 rounded-md w-full" height="200"></canvas>
                <button type="button" id="${clearButtonId}" class="text-sm text-primary hover:underline mt-2">クリア</button>
            `;

            setTimeout(() => {
                const canvas = document.getElementById(canvasId);
                const ctx = canvas.getContext('2d');
                let drawing = false;

                const getPos = (e) => {
                    const rect = canvas.getBoundingClientRect();
                    const scaleX = canvas.width / rect.width;
                    const scaleY = canvas.height / rect.height;
                    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                    return {
                        x: (clientX - rect.left) * scaleX,
                        y: (clientY - rect.top) * scaleY
                    };
                };

                const startDrawing = (e) => {
                    drawing = true;
                    const pos = getPos(e);
                    ctx.beginPath();
                    ctx.moveTo(pos.x, pos.y);
                };

                const draw = (e) => {
                    if (!drawing) return;
                    e.preventDefault();
                    const pos = getPos(e);
                    ctx.lineTo(pos.x, pos.y);
                    ctx.stroke();
                };

                const stopDrawing = () => {
                    if (!drawing) return;
                    drawing = false;
                    state.answers[question.id] = canvas.toDataURL();
                    state.hasUnsavedChanges = true;
                };

                canvas.addEventListener('mousedown', startDrawing);
                canvas.addEventListener('mousemove', draw);
                canvas.addEventListener('mouseup', stopDrawing);
                canvas.addEventListener('mouseleave', stopDrawing);
                canvas.addEventListener('touchstart', startDrawing);
                canvas.addEventListener('touchmove', draw);
                canvas.addEventListener('touchend', stopDrawing);

                document.getElementById(clearButtonId).addEventListener('click', () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    delete state.answers[question.id];
                    state.hasUnsavedChanges = true;
                });
            }, 0);
            break;
        default:
            controlArea.innerHTML = `<p class="text-sm text-error">未対応の設問タイプです: ${question.type}</p>`;
    }
    
    // 回答をstateに反映するイベントリスナー
    fieldset.addEventListener('change', (e) => {
        const questionId = fieldset.dataset.questionId;
        const formData = new FormData(DOMElements.surveyForm);
        const entries = formData.getAll(questionId);
        
        if (entries.length > 1) {
            state.answers[questionId] = entries; // チェックボックスやマトリックスMAなど
        } else if (entries.length === 1) {
            state.answers[questionId] = entries[0]; // ラジオボタンやテキスト入力など
        } else {
            delete state.answers[questionId]; // 未選択状態
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
    // NOTE: Temporarily modified to always show switcher for testing.
    let displayLanguages = state.surveyData.languages || [];
    // Create dummy data for testing if no languages are set
    if (displayLanguages.length === 0) {
        displayLanguages = ['en', 'zh-CN'];
    }

    DOMElements.languageSwitcher.classList.remove('hidden');
    
    const languageMap = {
        'ja': '日本語',
        'en': 'English',
        'zh-CN': '中文(简体)',
        'zh-TW': '中文(繁體)',
        'vi': 'Tiếng Việt',
    };

    const buildMenu = () => {
        const availableLanguages = ['ja', ...displayLanguages];
        DOMElements.languageMenu.innerHTML = ''; // Clear existing options

        availableLanguages.forEach(lang => {
            const langName = languageMap[lang] || lang;
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100';
            if (state.currentLanguage === lang) {
                link.classList.add('bg-gray-100', 'font-bold');
            }
            link.textContent = langName;
            link.dataset.lang = lang;
            DOMElements.languageMenu.appendChild(link);
        });
    };

    buildMenu(); // Initial build

    // Attach listeners only once.
    if (!DOMElements.languageSwitcher.dataset.listenerAttached) {
        DOMElements.languageSwitcher.dataset.listenerAttached = 'true';

        // Globe icon click to toggle menu
        DOMElements.languageSwitcherButton.addEventListener('click', (e) => {
            e.stopPropagation();
            DOMElements.languageMenu.classList.toggle('hidden');
        });

        // Language selection click
        DOMElements.languageMenu.addEventListener('click', (e) => {
            e.preventDefault();
            const target = e.target.closest('[data-lang]');
            if (target) {
                const lang = target.dataset.lang;
                if (lang !== state.currentLanguage) {
                    state.currentLanguage = lang;
                    renderSurvey();
                    populateFormWithDraft();
                    showToast(`${languageMap[state.currentLanguage] || state.currentLanguage}に切り替えました`);
                    buildMenu(); // Re-build menu to update highlight
                }
                DOMElements.languageMenu.classList.add('hidden');
            }
        });

        // Click outside to close
        window.addEventListener('click', () => {
            if (!DOMElements.languageMenu.classList.contains('hidden')) {
                DOMElements.languageMenu.classList.add('hidden');
            }
        });
    }
    // TODO: 手書きスペース設問のハンドリング
}

function saveDraft(isManual) {
    // 自動保存 (isManual: false) の場合のみ、未保存の変更がない場合はスキップ
    if (!isManual && !state.hasUnsavedChanges) {
        console.log('自動保存: 未保存の変更がないためスキップしました。');
        return;
    }

    const draftKey = `survey_draft_${state.surveyId}_${state.sessionId}`;
    
    localStorage.setItem(draftKey, JSON.stringify(state.answers));
    state.hasUnsavedChanges = false;

    if (isManual) {
        showToast('下書きを保存しました。');
        // 手動保存が成功したら、ボタンを非表示にする
        hideFab();
        console.log('手動保存: ドラフトを保存しました。', state.answers);
    } else {
        console.log('自動保存: ドラフトを保存しました。', state.answers);
    }
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
        showToast('必須項目を入力してください。');
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
        let thankYouUrl = state.surveyData.thankYouScreenSettings?.url || 'thankYouScreen.html';
        thankYouUrl += `?surveyId=${state.surveyId}`;
        if (state.surveyData.plan === 'premium') {
            thankYouUrl += '&continuous=true';
        }
        window.location.href = thankYouUrl;

    } catch (error) {
        console.error('送信エラー:', error);
        displayError('回答の送信に失敗しました。');
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

function resolveLocalizedText(value) {
    if (typeof value === 'string') {
        return value;
    }
    if (typeof value === 'object' && value !== null) {
        return value[state.currentLanguage] || value['ja'] || Object.values(value)[0] || '';
    }
    return '';
}

// --- その他のユーティリティ ---

function setupHeaderScrollBehavior() {
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (window.scrollY > lastScrollY && window.scrollY > DOMElements.header.offsetHeight) {
            // Downscroll
            DOMElements.header.classList.add('header-unpinned');
        } else {
            // Upscroll
            DOMElements.header.classList.remove('header-unpinned');
        }
        lastScrollY = window.scrollY;
    });
}

function setupLeaveConfirmation() {
    // ブラウザ標準の離脱防止
    window.addEventListener('beforeunload', (e) => {
        if (state.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = ''; // Chromeでダイアログを出すために必要
        }
    });

    // 戻るボタン対策
    window.addEventListener('popstate', (e) => {
        if (state.hasUnsavedChanges) {
            history.pushState(null, '', location.href); // デフォルトの挙動を一旦キャンセル
            showModal(DOMElements.leaveConfirmModal, 'ページを離れますか？', '変更が保存されていません。このページを離れてもよろしいですか？', {
                saveText: '離れる',
                cancelText: '留まる',
                onSave: () => {
                    state.hasUnsavedChanges = false; // 離脱を許可
                    history.back();
                },
                onCancel: () => {}
            });
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

// --- テスト用カラーピッカー機能 ---
function setupColorPickerTestFeature() {
    if (!DOMElements.headerColorPicker || !DOMElements.footerColorPicker || !DOMElements.backgroundColorPicker) {
        // HTMLに要素がない場合は何もしない
        return;
    }

    // ヘッダー色の変更
    DOMElements.headerColorPicker.addEventListener('input', (e) => {
        if (DOMElements.header) {
            DOMElements.header.style.backgroundColor = e.target.value;
        }
    });

    // フッター色の変更
    DOMElements.footerColorPicker.addEventListener('input', (e) => {
        if (DOMElements.footer) {
            DOMElements.footer.style.backgroundColor = e.target.value;
        }
    });

        // 背景色の変更

        DOMElements.backgroundColorPicker.addEventListener('input', (e) => {

            if (DOMElements.surveyMainWrapper) {

                // Tailwind CSSのクラスを上書きするためにstyle属性を直接操作

                DOMElements.surveyMainWrapper.style.backgroundColor = e.target.value;

            }

        });

    }

    

    

        // --- FAB表示/非表示ロジック (アイドル検出) ---

    

        const IDLE_TIMEOUT = 2000; // 2秒

    

        function showFab() {

    

            DOMElements.draftSaveFabContainer.classList.remove('opacity-0', 'pointer-events-none');

    

            DOMElements.draftSaveFabContainer.classList.add('opacity-100');

    

        }

    

        

    

        function hideFab() {

    

        

    

            if (!DOMElements.draftSaveFabContainer) {

    

        

    

                console.error('FAB container not initialized.');

    

        

    

                return;

    

        

    

            }

    

        

    

            DOMElements.draftSaveFabContainer.classList.remove('opacity-100');

    

        

    

            DOMElements.draftSaveFabContainer.classList.add('opacity-0', 'pointer-events-none');

    

        

    

        }

    

        

    

        function resetIdleTimer() {

    

            // 既存のタイマーをクリア

    

            clearTimeout(state.idleTimer);

    

        

    

                            // 操作があったら、アイドル状態を解除し、FABを非表示にする

    

        

    

                    

    

        

    

                            if (state.isIdle) {

    

        

    

                    

    

        

    

                                state.isIdle = false;

    

        

    

                                // クリック操作を妨げないように、少し遅れて非表示にする

    

        

    

                                setTimeout(hideFab, 500);

    

        

    

                    

    

        

    

                            }

    

        

    

            // 新しいタイマーを設定

    

            state.idleTimer = setTimeout(() => {

    

                // 2秒経過したらアイドル状態

    

                state.isIdle = true;

    

                // 未保存の変更がある場合のみ表示

    

                if (state.hasUnsavedChanges) {

    

                    showFab();

    

                }

    

            }, IDLE_TIMEOUT);

    

        }

    

        

    

        function setupIdleDetection() {

    

            // 初期タイマー設定

    

            resetIdleTimer();

    

        

    

                // 監視するイベントの基本セット

    

        

    

                let events = ['mousedown', 'keypress', 'scroll'];

    

        

    

            

    

        

    

                // PCとモバイルでイベントを分岐

    

        

    

                const isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0);

    

        

    

            

    

        

    

                if (isTouchDevice) {

    

        

    

                    events.push('touchstart');

    

        

    

                } else {

    

        

    

                    // PCの場合、マウスムーブでは非表示にしない。

    

        

    

                    // マウスダウン、キープレス、スクロールは操作とみなす。

    

        

    

                }

    

        

    

            

    

        

    

                events.forEach(event => {

    

        

    

                    document.addEventListener(event, resetIdleTimer, true);

    

        

    

                });

    

        }

    

        // --- /FAB表示/非表示ロジック (アイドル検出)

    

        

    