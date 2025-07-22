import { showToast } from './utils.js';
import { initSidebarHandler } from './sidebarHandler.js';
import { initThemeToggle } from './themeToggle.js';
import { openAccountInfoModal } from './accountInfoModal.js';

// グローバルスコープに関数を公開
window.openAccountInfoModal = openAccountInfoModal;

// --- 1. State Management ---
let state = {};
let draggedElement = null; // ドラッグ中の要素
let draggedFromIndex = -1; // ドラッグ元のインデックス

// --- 2. Utility Functions ---
const generateId = () => `q${Date.now()}${Math.random().toString(36).substring(2, 6)}`;

// --- 3. State Mutation Functions ---
function initializeState(surveyId = null) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowString = tomorrow.toISOString().split('T')[0];

    state = {
        id: surveyId, // Add surveyId to state
        surveyName: '',
        displayTitle: '',
        description: '',
        periodStart: tomorrowString,
        periodEnd: tomorrowString,
        plan: 'Standard',
        deadline: '',
        memo: '',
        questions: [],
    };

    if (surveyId) {
        // Mock data for existing survey
        const mockSurveyData = {
            surveyName: `既存アンケート ${surveyId}`,
            displayTitle: `既存アンケート ${surveyId} の表示タイトル`,
            description: `これは既存アンケート ${surveyId} の説明です。`,
            periodStart: '2024-01-01',
            periodEnd: '2024-12-31',
            plan: 'Premium',
            deadline: '2024-12-15',
            memo: `既存アンケート ${surveyId} のメモです。`,
            questions: [
                { id: 'q1', type: 'free_answer', text: '既存の質問1 (フリーアンサー)', required: true },
                { id: 'q2', type: 'single_answer', text: '既存の質問2 (シングルアンサー)', required: false, options: ['はい', 'いいえ'] }
            ],
        };
        Object.assign(state, mockSurveyData);
    }
}

function updateProperty(key, value) {
    state[key] = value;
}

function updateQuestionProperty(questionId, key, value) {
    const question = state.questions.find(q => q.id === questionId);
    if (question) {
        question[key] = value;
    }
}

function addQuestion(type) {
    const newQuestion = {
        id: generateId(),
        type: type,
        text: '',
        required: false,
    };

    switch (type) {
        case 'free_answer':
            newQuestion.minLength = 0;
            newQuestion.maxLength = 0;
            break;
        case 'single_answer':
        case 'multi_answer':
            newQuestion.options = ['選択肢1'];
            break;
        case 'matrix_sa':
        case 'matrix_ma':
            newQuestion.rows = ['行1'];
            newQuestion.columns = ['列1'];
            break;
        case 'number_answer':
            newQuestion.unit = '';
            newQuestion.min = null;
            newQuestion.max = null;
            break;
        case 'datetime':
            newQuestion.datetimeType = 'date';
            break;
    }
    state.questions.push(newQuestion);
}

function removeQuestion(questionId) {
    state.questions = state.questions.filter(q => q.id !== questionId);
}

function moveQuestion(fromIndex, toIndex) {
    const [movedItem] = state.questions.splice(fromIndex, 1);
    state.questions.splice(toIndex, 0, movedItem);
}

function addOption(questionId) {
    const question = state.questions.find(q => q.id === questionId);
    if (question && question.options) {
        question.options.push(`選択肢${question.options.length + 1}`);
    }
}

function updateOption(questionId, optionIndex, value) {
    const question = state.questions.find(q => q.id === questionId);
    if (question && question.options) {
        question.options[optionIndex] = value;
    }
}

function removeOption(questionId, optionIndex) {
    const question = state.questions.find(q => q.id === questionId);
    if (question && question.options) {
        question.options.splice(optionIndex, 1);
    }
}

function addMatrixItem(questionId, itemType) {
    const question = state.questions.find(q => q.id === questionId);
    if (question && question[itemType]) {
        question[itemType].push(`${itemType === 'rows' ? '行' : '列'}${question[itemType].length + 1}`);
    }
}

function updateMatrixItem(questionId, itemType, index, value) {
    const question = state.questions.find(q => q.id === questionId);
    if (question && question[itemType]) {
        question[itemType][index] = value;
    }
}

function removeMatrixItem(questionId, itemType, index) {
    const question = state.questions.find(q => q.id === questionId);
    if (question && question[itemType]) {
        question[itemType].splice(index, 1);
    }
}

// --- 4. Render Functions ---
function render() {
    renderQuestionEditor();
    renderPreview();

    // 新しく追加された質問項目があれば、プレビューまでスクロール
    const lastQuestion = state.questions[state.questions.length - 1];
    if (lastQuestion) {
        const previewElement = document.getElementById(`preview_${lastQuestion.id}`);
        if (previewElement) {
            previewElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

function renderQuestionEditor() {
    const container = document.getElementById('questionItemsContainer');
    container.innerHTML = '';

    state.questions.forEach((q, index) => {
        const questionCard = document.createElement('div');
        questionCard.className = 'question-item bg-surface p-4 rounded-lg shadow-sm border border-outline-variant';
        questionCard.dataset.questionId = q.id;
        questionCard.dataset.index = index;
        questionCard.draggable = true;
        questionCard.innerHTML = getQuestionEditorHtml(q, index + 1);
        container.appendChild(questionCard);
    });

    attachAllEventListeners();
}

function getQuestionEditorHtml(q, number) {
    const { id, type, text, required } = q;
    let questionContentHtml = '';
    let questionTitle = '';

    switch (type) {
        case 'free_answer':
            questionTitle = `質問 ${number} (フリーアンサー)`;
            questionContentHtml = `
                <div class="grid grid-cols-2 gap-4 mt-2">
                    <div class="input-group">
                        <input type="number" class="input-field min-length-input" data-question-id="${id}" value="${q.minLength || ''}" min="0">
                        <label class="input-label">最小文字数</label>
                    </div>
                    <div class="input-group">
                        <input type="number" class="input-field max-length-input" data-question-id="${id}" value="${q.maxLength || ''}" min="0">
                        <label class="input-label">最大文字数</label>
                    </div>
                </div>
            `;
            break;
        case 'single_answer':
        case 'multi_answer':
            questionTitle = `質問 ${number} (${type === 'single_answer' ? 'シングルアンサー' : 'マルチアンサー'})`;
            questionContentHtml = `
                <div class="options-container space-y-2 mt-2" data-question-id="${id}">
                    ${q.options.map((opt, i) => `
                        <div class="flex items-center gap-2">
                            <input type="text" class="input-field flex-1 option-input" value="${opt}" data-index="${i}">
                            <button type="button" class="remove-option-btn text-on-surface-variant hover:text-error" data-index="${i}" aria-label="選択肢を削除"><span class="material-icons text-base">remove_circle_outline</span></button>
                        </div>`).join('')}
                </div>
                <button type="button" class="add-option-btn mt-2 px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant text-sm font-medium hover:bg-outline-variant transition-colors" data-question-id="${id}"><span class="material-icons text-sm align-middle">add</span> 選択肢を追加</button>
            `;
            break;
        case 'matrix_sa':
        case 'matrix_ma':
            questionTitle = `質問 ${number} (マトリックス - ${type === 'matrix_sa' ? '単一選択' : '複数選択'})`;
            questionContentHtml = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div>
                        <h4 class="text-on-surface-variant font-semibold mb-2">行項目</h4>
                        <div class="space-y-2 matrix-rows-container" data-question-id="${id}">${q.rows.map((row, i) => `<div class="flex items-center gap-2"><input type="text" class="input-field flex-1 matrix-row-input" value="${row}" data-index="${i}"><button type="button" class="remove-matrix-row-btn text-on-surface-variant hover:text-error" data-index="${i}" aria-label="行を削除"><span class="material-icons text-base">remove_circle_outline</span></button></div>`).join('')}</div>
                        <button type="button" class="add-matrix-row-btn mt-2 px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant text-sm font-medium hover:bg-outline-variant transition-colors" data-question-id="${id}"><span class="material-icons text-sm align-middle">add</span> 行を追加</button>
                    </div>
                    <div>
                        <h4 class="text-on-surface-variant font-semibold mb-2">列項目</h4>
                        <div class="space-y-2 matrix-cols-container" data-question-id="${id}">${q.columns.map((col, i) => `<div class="flex items-center gap-2"><input type="text" class="input-field flex-1 matrix-col-input" value="${col}" data-index="${i}"><button type="button" class="remove-matrix-col-btn text-on-surface-variant hover:text-error" data-index="${i}" aria-label="列を削除"><span class="material-icons text-base">remove_circle_outline</span></button></div>`).join('')}</div>
                        <button type="button" class="add-matrix-col-btn mt-2 px-3 py-1 rounded-full bg-surface-variant text-on-surface-variant text-sm font-medium hover:bg-outline-variant transition-colors" data-question-id="${id}"><span class="material-icons text-sm align-middle">add</span> 列を追加</button>
                    </div>
                </div>
            `;
            break;
        case 'datetime':
            questionTitle = `質問 ${number} (日付/時間)`;
            questionContentHtml = `
                <div class="input-group mt-2">
                    <select class="input-field datetime-type-select" data-question-id="${id}">
                        <option value="date" ${q.datetimeType === 'date' ? 'selected' : ''}>日付のみ</option>
                        <option value="time" ${q.datetimeType === 'time' ? 'selected' : ''}>時間のみ</option>
                        <option value="datetime-local" ${q.datetimeType === 'datetime-local' ? 'selected' : ''}>日付と時間</option>
                    </select>
                    <label class="input-label">入力タイプ</label>
                </div>
            `;
            break;
        case 'handwriting':
            questionTitle = `質問 ${number} (手書きスペース)`;
            break;
        case 'number_answer':
            questionTitle = `質問 ${number} (数値回答)`;
            questionContentHtml = `
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                    <div class="input-group">
                        <input type="text" class="input-field unit-input" data-question-id="${id}" value="${q.unit || ''}">
                        <label class="input-label">単位 (例: 歳、円)</label>
                    </div>
                    <div class="input-group">
                        <input type="number" class="input-field min-value-input" data-question-id="${id}" value="${q.min || ''}">
                        <label class="input-label">最小値</label>
                    </div>
                    <div class="input-group">
                        <input type="number" class="input-field max-value-input" data-question-id="${id}" value="${q.max || ''}">
                        <label class="input-label">最大値</label>
                    </div>
                </div>
            `;
            break;
    }

    return `
        <div class="flex justify-between items-center mb-2">
            <div class="flex items-center gap-2">
                <span class="material-icons drag-handle cursor-move text-on-surface-variant" title="ドラッグして並べ替え">drag_indicator</span>
                <h3 class="text-on-surface font-medium">${questionTitle}</h3>
            </div>
            <button type="button" class="remove-question-btn text-on-surface-variant hover:text-error" data-question-id="${id}" aria-label="質問を削除"><span class="material-icons">delete</span></button>
        </div>
        <div class="input-group">
            <input type="text" class="input-field question-text-input" data-question-id="${id}" placeholder=" " value="${text}">
            <label class="input-label">質問文<span class="text-error">*</span></label>
        </div>
        ${questionContentHtml}
        <div class="flex items-center gap-2 mt-4">
            <input type="checkbox" class="form-checkbox h-4 w-4 text-primary rounded focus:ring-primary question-required-checkbox" data-question-id="${id}" ${required ? 'checked' : ''}>
            <label class="text-on-surface-variant text-sm">必須項目</label>
        </div>
    `;
}

function renderPreview() {
    const container = document.getElementById('surveyPreviewContainer');
    if (state.questions.length === 0) {
        container.innerHTML = '<p class="text-on-surface-variant">質問項目を追加するとプレビューが表示されます。</p>';
        return;
    }
    container.innerHTML = state.questions.map(q => {
        const { id, type, text, required } = q;
        let content = '';
        let constraints = [];
        if (q.minLength > 0) constraints.push(`最小${q.minLength}文字`);
        if (q.maxLength > 0) constraints.push(`最大${q.maxLength}文字`);
        const constraintsText = constraints.length > 0 ? `<span class="text-on-surface-variant text-sm ml-2">(${constraints.join('、')})</span>` : '';

        switch (type) {
            case 'free_answer': 
                content = `<textarea class="input-field w-full mt-2" placeholder="回答を入力" readonly></textarea>`; 
                break;
            case 'single_answer':
            case 'multi_answer':
                content = q.options.map(opt => `<label class="flex items-center mt-2"><input type="${type === 'single_answer' ? 'radio' : 'checkbox'}" name="preview_${id}" class="form-${type === 'single_answer' ? 'radio' : 'checkbox'} h-4 w-4 text-primary" disabled><span class="ml-2 text-on-surface">${opt || '[選択肢]'}</span></label>`).join('');
                break;
            case 'matrix_sa':
            case 'matrix_ma':
                content = `<div class="overflow-x-auto mt-2"><table class="min-w-full text-sm text-left"><thead><tr><th class="p-2 border border-outline-variant bg-surface-variant"></th>${q.columns.map(c => `<th class="p-2 border border-outline-variant bg-surface-variant text-center">${c || '[列]'}</th>`).join('')}</tr></thead><tbody>${q.rows.map(r => `<tr><td class="p-2 border border-outline-variant bg-surface-variant font-medium">${r || '[行]'}</td>${q.columns.map(() => `<td class="p-2 border border-outline-variant text-center"><input type="${type === 'matrix_sa' ? 'radio' : 'checkbox'}" name="preview_${id}_${r}" class="form-${type === 'matrix_sa' ? 'radio' : 'checkbox'} h-4 w-4 text-primary" disabled></td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
                break;
            case 'datetime': content = `<input type="${q.datetimeType}" class="input-field w-full mt-2" readonly>`; break;
            case 'handwriting': content = `<div class="w-full h-48 mt-2 border-2 border-dashed border-outline-variant rounded-md flex items-center justify-center bg-surface-variant"><span class="text-on-surface-variant">手書き入力エリア</span></div>`; break;
            case 'number_answer':
                let placeholder = '回答を入力';
                if (q.min !== null && q.max !== null) placeholder = `${q.min}～${q.max}の範囲で入力`;
                else if (q.min !== null) placeholder = `${q.min}以上で入力`;
                else if (q.max !== null) placeholder = `${q.max}以下で入力`;
                content = `<div class="flex items-center gap-2 mt-2"><input type="number" class="input-field w-full" placeholder="${placeholder}" readonly><span class="text-on-surface-variant">${q.unit || ''}</span></div>`;
                break;
        }
        return `<div class="mb-4 p-4 border border-outline-variant rounded-md bg-surface" id="preview_${id}"><p class="font-semibold text-on-surface">${text || '[質問文]'} ${required ? '<span class="text-error text-sm">*</span>' : ''}${constraintsText}</p><div class="mt-2">${content}</div></div>`;
    }).join('');
}

// --- 5. Event Handlers & Listeners ---
function handleFormInput(e) { updateProperty(e.target.id, e.target.value); }
function handleAddQuestionClick(e) { const type = e.currentTarget.dataset.type; if (type) { addQuestion(type); render(); } }

function handleQuestionEditorEvent(e) {
    const target = e.target;
    const questionId = target.closest('.question-item')?.dataset.questionId;
    if (!questionId) return;

    const qId = target.dataset.questionId || questionId;
    const index = target.dataset.index;

    const handlers = {
        '.question-text-input': () => { updateQuestionProperty(qId, 'text', target.value); renderPreview(); },
        '.min-length-input': () => { updateQuestionProperty(qId, 'minLength', parseInt(target.value, 10) || 0); renderPreview(); },
        '.max-length-input': () => { updateQuestionProperty(qId, 'maxLength', parseInt(target.value, 10) || 0); renderPreview(); },
        '.unit-input': () => { updateQuestionProperty(qId, 'unit', target.value); renderPreview(); },
        '.min-value-input': () => { updateQuestionProperty(qId, 'min', target.value !== '' ? parseInt(target.value, 10) : null); renderPreview(); },
        '.max-value-input': () => { updateQuestionProperty(qId, 'max', target.value !== '' ? parseInt(target.value, 10) : null); renderPreview(); },
        '.question-required-checkbox': () => { updateQuestionProperty(qId, 'required', target.checked); renderPreview(); },
        '.remove-question-btn': () => { removeQuestion(qId); render(); },
        '.add-option-btn': () => { addOption(qId); render(); },
        '.option-input': () => { updateOption(qId, index, target.value); renderPreview(); },
        '.remove-option-btn': () => { removeOption(qId, index); render(); },
        '.add-matrix-row-btn': () => { addMatrixItem(qId, 'rows'); render(); },
        '.add-matrix-col-btn': () => { addMatrixItem(qId, 'columns'); render(); },
        '.matrix-row-input': () => { updateMatrixItem(qId, 'rows', index, target.value); renderPreview(); },
        '.matrix-col-input': () => { updateMatrixItem(qId, 'columns', index, target.value); renderPreview(); },
        '.remove-matrix-row-btn': () => { removeMatrixItem(qId, 'rows', index); render(); },
        '.remove-matrix-col-btn': () => { removeMatrixItem(qId, 'columns', index); render(); },
        '.datetime-type-select': () => { updateQuestionProperty(qId, 'datetimeType', target.value); render(); },
    };

    for (const selector in handlers) {
        if (target.closest(selector)) {
            handlers[selector]();
            return;
        }
    }
}

function handleSaveSurvey() {
    if (!state.surveyName || !state.displayTitle || !state.periodStart || !state.periodEnd) { showToast('必須項目（アンケート名、表示タイトル、会期）を全て入力してください。', 'error'); return; }
    if (state.questions.length === 0) { showToast('質問項目を1つ以上追加してください。', 'error'); return; }
    for (const q of state.questions) { if (!q.text) { showToast(`質問「${q.id}」の本文が入力されていません。`, 'error'); return; } }

    const action = state.id ? "更新" : "作成";
    console.log(`--- アンケート${action}データ ---`);
    console.log(JSON.stringify(state, null, 2));
    showToast(`アンケートデータがコンソールに出力されました。コピーして担当者に渡してください。（${action}）`, 'success');
}

// Drag and Drop Handlers
function handleDragStart(e) {
    if (e.target.classList.contains('question-item')) {
        draggedElement = e.target;
        draggedFromIndex = parseInt(e.target.dataset.index, 10);
        e.dataTransfer.effectAllowed = 'move';
        draggedElement.classList.add('dragging');
    }
}

function handleDragOver(e) {
    e.preventDefault();
    const dropTarget = e.target.closest('.question-item');
    
    // Remove drag-over class from all items first
    document.querySelectorAll('.question-item').forEach(item => {
        item.classList.remove('drag-over');
    });

    if (dropTarget && dropTarget !== draggedElement) {
        const allItems = [...dropTarget.parentElement.children];
        const toIndex = allItems.indexOf(dropTarget);
        const fromIndex = allItems.indexOf(draggedElement);

        if (fromIndex < toIndex) {
            dropTarget.parentNode.insertBefore(draggedElement, dropTarget.nextSibling);
        } else {
            dropTarget.parentNode.insertBefore(draggedElement, dropTarget);
        }
        dropTarget.classList.add('drag-over');
    }
}





function handleDrop(e) {
    e.preventDefault();
    const dropTarget = e.target.closest('.question-item');
    if (dropTarget && draggedElement) {
        const allItems = [...dropTarget.parentElement.children];
        const toIndex = allItems.indexOf(draggedElement);
        if (draggedFromIndex !== toIndex) {
            moveQuestion(draggedFromIndex, toIndex);
            render(); // Re-render to ensure state and view are in sync
        }
    }
    // Clean up drag-over class from all items after drop
    document.querySelectorAll('.question-item').forEach(item => item.classList.remove('drag-over'));
}

function handleDragEnd() {
    if (draggedElement) {
        draggedElement.classList.remove('dragging');
    }
    // Clean up drag-over class from all items after drag end
    document.querySelectorAll('.question-item').forEach(item => item.classList.remove('drag-over'));
    draggedElement = null;
    draggedFromIndex = -1;
}

function attachAllEventListeners() {
    document.querySelectorAll('#surveyName, #displayTitle, #description, #periodStart, #periodEnd, #plan, #deadline, #memo').forEach(input => {
        input.removeEventListener('input', handleFormInput);
        input.addEventListener('input', handleFormInput);
    });
    const questionContainer = document.getElementById('questionItemsContainer');
    questionContainer.removeEventListener('click', handleQuestionEditorEvent);
    questionContainer.removeEventListener('input', handleQuestionEditorEvent);
    questionContainer.addEventListener('click', handleQuestionEditorEvent);
    questionContainer.addEventListener('input', handleQuestionEditorEvent);
}

// --- 6. Initialization ---
export function initSurveyCreation() {
    initSidebarHandler();
    initThemeToggle();

    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId');
    initializeState(surveyId);

    // フォームにstateの値を反映
    document.getElementById('surveyName').value = state.surveyName;
    document.getElementById('displayTitle').value = state.displayTitle;
    document.getElementById('description').value = state.description;
    document.getElementById('periodStart').value = state.periodStart;
    document.getElementById('periodEnd').value = state.periodEnd;
    document.getElementById('plan').value = state.plan;
    document.getElementById('deadline').value = state.deadline;
    document.getElementById('memo').value = state.memo;

    // リンクのhrefを更新
    const bizcardLink = document.querySelector('a[href="bizcardSettings.html"]');
    if (bizcardLink && state.id) {
        bizcardLink.href = `bizcardSettings.html?surveyId=${state.id}`;
    }
    const thankYouEmailLink = document.querySelector('a[href="thankYouEmailSettings.html"]');
    if (thankYouEmailLink && state.id) {
        thankYouEmailLink.href = `thankYouEmailSettings.html?surveyId=${state.id}`;
    }

    document.querySelectorAll('[id^="add"][id$="Btn"]').forEach(button => {
        const type = button.id.replace('add', '').replace('Btn', '').toLowerCase();
        const typeMap = { freeanswer: 'free_answer', singleanswer: 'single_answer', multianswer: 'multi_answer', numberanswer: 'number_answer', matrixsa: 'matrix_sa', matrixma: 'matrix_ma', datetime: 'datetime', handwriting: 'handwriting' };
        button.dataset.type = typeMap[type];
        button.addEventListener('click', handleAddQuestionClick);
    });

    document.getElementById('createSurveyBtn').addEventListener('click', handleSaveSurvey);
    document.getElementById('cancelCreateSurvey').addEventListener('click', () => {
        if (confirm('編集中の内容は破棄されます。よろしいですか？')) { window.location.href = 'index.html'; }
    });

    const questionContainer = document.getElementById('questionItemsContainer');
    questionContainer.addEventListener('dragstart', handleDragStart);
    questionContainer.addEventListener('dragover', handleDragOver);
    questionContainer.addEventListener('drop', handleDrop);
    questionContainer.addEventListener('dragend', handleDragEnd);

    render();

    // アコーディオンの初期化とイベントリスナー
    const basicInfoAccordionHeader = document.querySelector('[data-accordion-target="basicInfoContent"]');
    if (basicInfoAccordionHeader) {
        basicInfoAccordionHeader.addEventListener('click', () => {
            const targetId = basicInfoAccordionHeader.dataset.accordionTarget;
            const content = document.getElementById(targetId);
            const icon = basicInfoAccordionHeader.querySelector('.expand-icon');

            if (content.classList.contains('hidden')) {
                // 開く
                content.classList.remove('hidden');
                icon.textContent = 'expand_less';
                // maxHeightをscrollHeightに設定する前に、ブラウザの再描画を強制
                content.style.maxHeight = '0px'; // 一度0に設定してリフローを強制
                content.offsetHeight; // リフローを強制
                content.style.maxHeight = content.scrollHeight + 'px'; // アニメーションのための高さ設定
            } else {
                // 閉じる
                content.style.maxHeight = content.scrollHeight + 'px'; // 現在の高さに設定
                content.offsetHeight; // リフローを強制
                content.style.maxHeight = '0'; // アニメーションのための高さ設定
                content.addEventListener('transitionend', function handler() {
                    content.classList.add('hidden');
                    content.removeEventListener('transitionend', handler);
                }, { once: true });
                icon.textContent = 'expand_more';
            }
        });
    }

    // 初期状態で「基本情報」のみ展開
    const basicInfoContent = document.getElementById('basicInfoContent');
    if (basicInfoContent) {
        basicInfoContent.classList.remove('hidden');
        const basicInfoIcon = document.querySelector('[data-accordion-target="basicInfoContent"]').querySelector('.expand-icon');
        if (basicInfoIcon) basicInfoIcon.textContent = 'expand_less';
    }

    // その他のセクションは閉じた状態を維持（HTML側でhiddenクラスが付与されているため、JSでの操作は不要）
}