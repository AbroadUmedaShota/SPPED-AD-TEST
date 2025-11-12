/**
 * survey-answer.js
 * アンケート回答画面のフロントエンドロジック
 */

import { resolveDashboardDataPath } from './utils.js';

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

        // --- カラーピッカーテスト機能用要素 ---
        surveyMainWrapper: document.getElementById('survey-main-wrapper'),
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
        // setupHeaderScrollBehavior();
        disablePullToRefresh();
        history.pushState(null, '', location.href); // <-- Add this line

        // テキストエリアの自動リサイズ
        DOMElements.surveyForm.addEventListener('input', (e) => {
            if (e.target.tagName.toLowerCase() === 'textarea') {
                autoResizeTextarea(e.target);
            }
        });
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
    const dataPath = resolveDashboardDataPath(`surveys/${state.surveyId}.json`);
    const response = await fetch(dataPath);
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
                    <div id="manual-phone-error" class="text-red-500 text-xs mt-1 hidden"></div>
                </div>
                <div>
                    <label for="manual-postal-code" class="block text-sm font-medium text-on-surface-variant">郵便番号</label>
                    <input type="text" id="manual-postal-code" name="postalCode" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                    <div id="manual-postal-code-error" class="text-red-500 text-xs mt-1 hidden"></div>
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

                    // エラーメッセージ要素をクリア
                    document.getElementById('manual-postal-code-error').textContent = '';
                    document.getElementById('manual-postal-code-error').classList.add('hidden');
                    document.getElementById('manual-phone-error').textContent = '';
                    document.getElementById('manual-phone-error').classList.add('hidden');

                    let isValid = true;

                    // 郵便番号バリデーション
                    const postalCode = manualInfo.postalCode;
                    if (postalCode && !/^\d{3}-?\d{4}$/.test(postalCode)) {
                        isValid = false;
                        document.getElementById('manual-postal-code-error').textContent = '郵便番号の形式が正しくありません。(例: 123-4567)';
                        document.getElementById('manual-postal-code-error').classList.remove('hidden');
                    }

                    // 電話番号バリデーション
                    const phone = manualInfo.phone;
                    if (phone && !/^[\d-]+$/.test(phone)) {
                        isValid = false;
                        document.getElementById('manual-phone-error').textContent = '電話番号には数字とハイフンのみを使用してください。';
                        document.getElementById('manual-phone-error').classList.remove('hidden');
                    }

                    if (!isValid) {
                        return; // 保存せずに処理を中断
                    }

                    state.answers.manualBizcardInfo = manualInfo;
                    state.hasUnsavedChanges = true;
                    showToast('名刺情報を保存しました。'); // 成功時のトーストは残す
                    console.log('Manual bizcard info saved:', manualInfo);
                    DOMElements.manualInputModal.style.display = 'none';
                }
            });

            // --- リアルタイムバリデーションの追加 ---
            const postalInput = document.getElementById('manual-postal-code');
            const phoneInput = document.getElementById('manual-phone');
            const postalError = document.getElementById('manual-postal-code-error');
            const phoneError = document.getElementById('manual-phone-error');

            postalInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value && !/^\d{3}-?\d{4}$/.test(value)) {
                    postalError.textContent = '郵便番号の形式が正しくありません。(例: 123-4567)';
                    postalError.classList.remove('hidden');
                } else {
                    postalError.textContent = '';
                    postalError.classList.add('hidden');
                }
            });

            phoneInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value && !/^[\d-]+$/.test(value)) {
                    phoneError.textContent = '電話番号には数字とハイフンのみを使用してください。';
                    phoneError.classList.remove('hidden');
                } else {
                    phoneError.textContent = '';
                    phoneError.classList.add('hidden');
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
let bizcardImages = { front: null, back: null };

function startBizcardUploadFlow() {
    let localImages = { front: null, back: null };
    let currentSide = null; // New variable to track current side
    
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

    const triggerFileInput = (useCamera, side) => {
        currentSide = side; // Set currentSide before triggering click
        hiddenFileInput.capture = useCamera ? 'environment' : ''; // Set capture attribute
        hiddenFileInput.click(); // Trigger click on the reused input
    };

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
            retakeButton.onclick = showChoice;
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
        const backImageHTML = localImages.back ? `<img src="${localImages.back}" alt="名刺 裏面" class="w-full rounded-md shadow-sm cursor-pointer bizcard-confirm-image">` : '<div class="h-full flex items-center justify-center bg-gray-100 rounded-md"><p class="text-sm text-gray-500">裏面なし</p></div>';
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
                    ${frontImageHTML}
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

        // Add click listeners for magnification
        DOMElements.bizcardUploadModal.querySelectorAll('.bizcard-confirm-image').forEach(img => {
            img.addEventListener('click', (e) => {
                openMagnifyModal(e.target.src);
            });
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
    renderHeader();
    renderSurveyTitle();
    renderQuestions();
    updateDynamicColors('#FFFFFF'); // スタイルを再適用
}

function renderHeader() {
    const { displayTitle } = state.surveyData;
    // DOMElements.headerText.innerHTML = ''; // コンテンツを削除
    document.title = `SpeedAd - ${resolveLocalizedText(displayTitle) || 'アンケート回答'}`;
}

function renderSurveyTitle() {
    const { displayTitle, description } = state.surveyData;
    const titleContainer = document.getElementById('survey-title-container');
    if (titleContainer) {
        titleContainer.innerHTML = `
            <div class="bg-white border-2 border-gray-200 rounded-lg shadow-md p-6">
                <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">${resolveLocalizedText(displayTitle) || 'アンケート'}</h1>
                <p class="text-gray-600 mt-2">${resolveLocalizedText(description) || ''}</p>
            </div>
        `;
    }
}

function renderQuestions() {
    const form = DOMElements.surveyForm;
    form.innerHTML = ''; // 既存の設問をクリア

    if (!Array.isArray(state.surveyData.questions) || state.surveyData.questions.length === 0) {
        form.innerHTML = '<p class="text-center text-on-surface-variant">このアンケートには表示できる設問がありません。</p>';
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
    const requiredText = question.required ? `<span class="text-red-600 font-bold text-xs">必須</span>` : '';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'question-content';

    contentDiv.innerHTML = `
        <div class="mb-4">
            <div class="flex items-center">
                <span class="text-lg font-bold text-gray-500 mr-3">${questionNumber}</span>${requiredText}
            </div>
            <p class="text-base font-semibold text-on-surface-variant mt-2">${resolveLocalizedText(question.text)}</p>
        </div>
        <div class="control-area space-y-3"></div>
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
                label.textContent = resolveLocalizedText(opt.text);
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
            controlArea.innerHTML = `
              <div class="flex flex-col sm:flex-row gap-2">
                <input type="date" name="${question.id}_date" class="w-full rounded-md border-gray-300 shadow-sm p-2" aria-label="Date" max="9999-12-31">
                <input type="time" name="${question.id}_time" class="w-full rounded-md border-gray-300 shadow-sm p-2" aria-label="Time">
              </div>
            `;
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
            break;
        case 'handwriting_space':
            const canvasId = `${question.id}-canvas`;
            const clearButtonId = `${question.id}-clear`;
            controlArea.innerHTML = `
                <canvas id="${canvasId}" class="border border-gray-400 rounded-md w-full" height="200"></canvas>
                <button type="button" id="${clearButtonId}" class="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 mt-2">クリア</button>
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
    
    fieldset.addEventListener('change', (e) => {
        const questionId = fieldset.dataset.questionId;
        const question = state.surveyData.questions.find(q => q.id === questionId);

        if (question.type === 'date_time') {
            const dateValue = fieldset.querySelector(`input[name=\"${questionId}_date\"]`).value;
            const timeValue = fieldset.querySelector(`input[name=\"${questionId}_time\"]`).value;

            if (dateValue) { // 時刻は任意でも良い場合を考慮
                state.answers[questionId] = `${dateValue}${timeValue ? 'T' + timeValue : ''}`;
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

    let displayLanguages = state.surveyData.languages || [];
    if (displayLanguages.length === 0) {
        displayLanguages = ['en', 'zh-CN']; // テスト用のダミーデータ
    }

    const languageMap = {
        'ja': '日本語',
        'en': 'English',
        'zh-CN': '中文(简体)',
        'zh-TW': '中文(繁體)',
        'vi': 'Tiếng Việt',
    };

    const availableLanguages = ['ja', ...displayLanguages];

    languageSelect.innerHTML = ''; // 既存のオプションをクリア

    // デフォルトの「Language」オプションを追加
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Language';
    defaultOption.disabled = true;
    languageSelect.appendChild(defaultOption);

    availableLanguages.forEach(lang => {
        const langName = languageMap[lang] || lang;
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = langName;
        languageSelect.appendChild(option);
    });

    // 現在の言語に基づいて選択状態を設定
    languageSelect.value = state.currentLanguage || '';

    // コンテナを表示
    const container = document.getElementById('language-switcher-container');
    if (container) {
        container.classList.remove('hidden');
    }

    // イベントリスナーを設定 (一度だけ)
    if (!languageSelect.dataset.listenerAttached) {
        languageSelect.dataset.listenerAttached = 'true';
        languageSelect.addEventListener('change', (e) => {
            const newLang = e.target.value;
            if (newLang !== state.currentLanguage) {
                state.currentLanguage = newLang;
                renderSurvey();
                populateFormWithDraft();
                showToast(`${languageMap[newLang] || newLang}に切り替えました`);
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
