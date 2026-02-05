
import { resolveDemoDataPath, resolveDashboardDataPath, resolveDashboardAssetPath, showToast } from './utils.js';
import { speedReviewService } from './services/speedReviewService.js';
import { populateTable, renderModalContent, handleModalImageClick } from './ui/speedReviewRenderer.js';
import { handleOpenModal } from './modalHandler.js';
import { initBreadcrumbs } from './breadcrumb.js';

// --- State ---
let allCombinedData = [];
let currentPage = 1;
let rowsPerPage = 25;
let currentIndustryQuestion = '';
let currentDateFilter = null;
let currentStatusFilter = 'all'; // ステータスフィルター
let startDatePicker = null;
let endDatePicker = null;
let timeSeriesAxisMode = 'auto'; // 'auto' or 'fixed'
let currentItemInModal = null;
let isModalInEditMode = false;
let currentSurvey = null;

let currentSortKey = 'answeredAt';
let currentSortOrder = 'desc';

let timeSeriesChart = null; // Dashboard Chart Instance
let attributeChart = null;  // Dashboard Chart Instance

const SINGLE_CHOICE_TYPES = new Set(['single_choice', 'dropdown']);
const MULTI_CHOICE_TYPES = new Set(['multi_choice']);
const BLANK_TYPES = new Set([
    'text',
    'free_text',
    'number',
    'date',
    'datetime',
    'datetime_local',
    'time',
    'handwriting',
    'explanation',
    'matrix_sa',
    'matrix_single',
    'matrix_ma',
    'matrix_multi',
    'matrix_multiple'
]);

// --- Functions ---

function truncateQuestion(questionText) {
    if (!questionText) {
        return '';
    }
    let truncatedText = questionText.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '');
    if (truncatedText.length > 25) {
        truncatedText = truncatedText.substring(0, 25) + '...';
    }
    return truncatedText;
}

function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getBlankReason(type) {
    switch (type) {
        case 'text':
        case 'free_text':
            return '自由記述のため';
        case 'number':
            return '数値入力のため';
        case 'date':
        case 'datetime':
        case 'datetime_local':
        case 'time':
            return '日付・時刻入力のため';
        case 'handwriting':
            return '手書き入力のため';
        case 'explanation':
            return '説明カードのため';
        case 'matrix_sa':
        case 'matrix_single':
        case 'matrix_ma':
        case 'matrix_multi':
        case 'matrix_multiple':
            return 'マトリクス設問のため';
        default:
            return '未対応の設問タイプ';
    }
}

function normalizeQuestionText(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .replace(/^[\s　]*q[0-9０-９]+[._、:：\s-]*/i, '')
        .replace(/\s+/g, '');
}

function findAnswerDetail(answer, question) {
    if (!answer || !answer.details) return null;
    const normalizedTarget = normalizeQuestionText(question.text);
    return answer.details.find(detail => {
        if (!detail || !detail.question) return false;
        if (detail.question === question.text) return true;
        return normalizeQuestionText(detail.question) === normalizedTarget;
    }) || null;
}

function normalizeChoiceOptions(options = []) {
    const labels = [];
    const map = new Map();

    options.forEach((opt, index) => {
        if (opt && typeof opt === 'object') {
            const value = opt.value ?? opt.id ?? opt.text ?? `option_${index + 1}`;
            const text = opt.text ?? opt.label ?? opt.value ?? opt.id ?? String(value);
            labels.push(text);
            map.set(String(value), text);
            map.set(String(text), text);
        } else if (opt !== undefined && opt !== null) {
            const text = String(opt);
            labels.push(text);
            map.set(text, text);
        }
    });

    return { labels, map };
}

function resolveOptionLabel(value, optionsInfo) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object') {
        const raw = value.value ?? value.text ?? value.label ?? value.id;
        if (raw !== undefined && raw !== null) {
            return optionsInfo.map.get(String(raw)) || String(raw);
        }
        return null;
    }
    return optionsInfo.map.get(String(value)) || String(value);
}

function buildChoiceSummary(question, answers) {
    const counts = {};
    let answeredCount = 0;
    const optionsInfo = normalizeChoiceOptions(question.options || []);

    answers.forEach(answer => {
        const detail = findAnswerDetail(answer, question);
        if (!detail || detail.answer === undefined || detail.answer === null || detail.answer === '') return;

        const answerValue = detail.answer;
        const selections = Array.isArray(answerValue) ? answerValue : [answerValue];
        if (selections.length === 0) return;

        answeredCount += 1;
        selections.forEach(selection => {
            const label = resolveOptionLabel(selection, optionsInfo);
            if (!label) return;
            counts[label] = (counts[label] || 0) + 1;
        });
    });

    const labels = optionsInfo.labels.length > 0
        ? optionsInfo.labels
        : Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    const data = labels.map(label => counts[label] || 0);
    const totalVotes = data.reduce((sum, current) => sum + current, 0);

    return {
        labels,
        data,
        totalAnswers: answeredCount,
        totalVotes
    };
}

function handleQuestionSelectClick(newQuestion) {
    currentIndustryQuestion = newQuestion;
    const dynamicHeader = document.getElementById('dynamic-question-header');
    if (dynamicHeader) {
        dynamicHeader.textContent = truncateQuestion(newQuestion);
    }
    const selectorContainer = document.getElementById('question-selector-container');
    if (selectorContainer) {
        const buttons = selectorContainer.querySelectorAll('button');
        buttons.forEach(button => {
            button.classList.toggle('active', button.title === newQuestion);
        });
    }
    applyFilters();
}

function handleWheelZoom(e) {
    e.preventDefault();
    const container = e.currentTarget;
    const img = container.querySelector('img');
    if (!img) return;

    let scale = parseFloat(img.dataset.scale || '1');
    const rotation = parseInt(img.dataset.rotation || '0');

    // ホイールの移動量に応じてスケール変更
    // deltaYの符号で方向判定
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    scale += delta;

    // 範囲制限 (0.5倍 〜 5.0倍)
    scale = Math.min(Math.max(scale, 0.5), 5.0);

    img.dataset.scale = scale.toFixed(2); // 精度を保つため文字列化して保存
    img.style.transform = `rotate(${rotation}deg) scale(${scale})`;
}

function setupWheelZoomListeners(modalContext) {
    if (!modalContext) return;
    const zoomContainers = modalContext.querySelectorAll('[data-zoom-src]');
    zoomContainers.forEach(container => {
        // 重複登録を避けるために一度削除
        container.removeEventListener('wheel', handleWheelZoom);
        container.addEventListener('wheel', handleWheelZoom, { passive: false });
    });
}

function handleRotateClick(e) {
    const btn = e.currentTarget;
    const targetKey = btn.dataset.target; // 'front', 'back', 'detail-front', 'detail-back', 'inline'
    const dir = parseInt(btn.dataset.dir);

    // ターゲット画像要素を特定
    let imgElement;

    if (targetKey === 'inline') {
        // インライン展開の場合、DOM構造から相対的に探索
        const wrapper = btn.closest('.inline-card-wrapper');
        if (wrapper) {
            imgElement = wrapper.querySelector('img');
        }
    } else {
        // 安全のためボタンの親モーダルから探索することを推奨したいが、
        // IDが一意であることを前提に既存ロジックを踏襲
        if (targetKey === 'front') {
            imgElement = document.querySelector('#card-image-front-container img');
        } else if (targetKey === 'back') {
            imgElement = document.querySelector('#card-image-back-container img');
        } else if (targetKey === 'detail-front') {
            imgElement = document.getElementById('detail-front-image');
        } else if (targetKey === 'detail-back') {
            imgElement = document.getElementById('detail-back-image');
        }
    }

    if (!imgElement) return;

    // 現在の角度を取得
    let currentRotation = parseInt(imgElement.dataset.rotation || '0');
    let newRotation = currentRotation + dir;

    // 現在のスケールを取得（追加）
    let currentScale = parseFloat(imgElement.dataset.scale || '1');

    imgElement.style.transform = `rotate(${newRotation}deg) scale(${currentScale})`;
    imgElement.dataset.rotation = newRotation;
}

function setupTableEventListeners() {
    const table = document.getElementById('reviewTable');
    if (!table) return;

    // 既にリスナーが登録されていたら何もしない（二重登録防止）
    if (table.hasAttribute('data-listeners-attached')) return;
    table.setAttribute('data-listeners-attached', 'true');

    table.addEventListener('click', (e) => {
        // 0. タブ切り替えボタン
        const tabBtn = e.target.closest('.card-tab-btn');
        if (tabBtn) {
            e.stopPropagation();
            const tabType = tabBtn.dataset.tab; // 'front' or 'back'
            const detailRow = tabBtn.closest('.inline-detail-row');
            if (detailRow) {
                const frontView = detailRow.querySelector('#inline-front-view');
                const backView = detailRow.querySelector('#inline-back-view');
                const buttons = detailRow.querySelectorAll('.card-tab-btn');

                // ボタンのスタイル更新
                buttons.forEach(btn => {
                    if (btn === tabBtn) {
                        btn.classList.add('bg-surface', 'text-primary', 'shadow-sm', 'active');
                        btn.classList.remove('text-on-surface-variant', 'hover:text-on-surface');
                    } else {
                        btn.classList.remove('bg-surface', 'text-primary', 'shadow-sm', 'active');
                        btn.classList.add('text-on-surface-variant', 'hover:text-on-surface');
                    }
                });

                // 表示切り替え
                if (tabType === 'front') {
                    frontView.classList.remove('hidden');
                    backView.classList.add('hidden');
                } else {
                    frontView.classList.add('hidden');
                    backView.classList.remove('hidden');
                }
            }
            return;
        }

        // 1. インライン展開ボタン
        const toggleBtn = e.target.closest('.toggle-inline-btn');
        if (toggleBtn) {
            e.stopPropagation(); // 行クリック（詳細モーダル）への伝播を止める
            const row = toggleBtn.closest('tr');
            const answerId = row.dataset.answerId;
            toggleInlineRow(row, answerId);
            return;
        }

        // 2. 回転ボタン（インライン用）
        const rotateBtn = e.target.closest('.rotate-btn');
        if (rotateBtn) {
            e.stopPropagation();
            handleRotateClick({ currentTarget: rotateBtn });
            return;
        }

        // 3. 画像クリック（ズーム）（インライン用）
        const zoomTarget = e.target.closest('[data-zoom-src]');
        if (zoomTarget) {
            // handleModalImageClick はイベントオブジェクトを受け取って処理する設計なのでそのまま呼ぶ
            // ただし、handleModalImageClick は e.target を使うので、ここでの e を渡せばOK
            // デリゲーションの中でさらに条件分岐している形
            handleModalImageClick(e);
            return;
        }
    });
}

import { renderInlineRow } from './ui/speedReviewRenderer.js';

function toggleInlineRow(parentRow, answerId) {
    const nextRow = parentRow.nextElementSibling;
    const isExpanded = parentRow.dataset.expanded === 'true';

    if (isExpanded && nextRow && nextRow.classList.contains('inline-detail-row')) {
        // 折りたたみ
        nextRow.remove();
        parentRow.dataset.expanded = 'false';
        const icon = parentRow.querySelector('.toggle-icon');
        if (icon) icon.textContent = 'keyboard_arrow_right';
    } else {
        // 展開
        const item = allCombinedData.find(d => d.answerId === answerId);
        if (!item) return;

        const detailRow = renderInlineRow(item, 6); // colspanは適宜調整
        parentRow.after(detailRow);
        parentRow.dataset.expanded = 'true';
        const icon = parentRow.querySelector('.toggle-icon');
        if (icon) icon.textContent = 'keyboard_arrow_down';

        // ホイールズームの適用
        setupWheelZoomListeners(detailRow);
    }
}

function handleDetailClick(answerId) {
    const item = allCombinedData.find(data => data.answerId === answerId);
    if (item) {
        currentItemInModal = item;
        isModalInEditMode = false;
        handleOpenModal('reviewDetailModalOverlay', resolveDashboardAssetPath('modals/reviewDetailModal.html'), () => {
            renderModalContent(item, false);
            updateModalFooter(); // Initialize footer with correct buttons
            setupModalEventListeners();

            // ホイールズームリスナーを設定（DOM再描画のたびに必要）
            setupWheelZoomListeners(document.getElementById('reviewDetailModalOverlay'));
        });
    } else {
        console.warn('Item not found for answerId:', answerId);
    }
}

function setupModalEventListeners() {
    const modal = document.getElementById('reviewDetailModalOverlay');
    if (!modal) return;

    // Check if listener is already attached to avoid duplicates (using a custom property)
    if (!modal.hasAttribute('data-zoom-listener-attached')) {
        modal.addEventListener('click', handleModalImageClick);
        modal.setAttribute('data-zoom-listener-attached', 'true');
    }

    // Rotate button listener (Delegation)
    if (!modal.hasAttribute('data-rotate-listener-attached')) {
        modal.addEventListener('click', (e) => {
            const btn = e.target.closest('.rotate-btn');
            if (btn) {
                e.stopPropagation();
                handleRotateClick({ currentTarget: btn });
            }
        });
        modal.setAttribute('data-rotate-listener-attached', 'true');
    }

    const footer = document.querySelector('#reviewDetailModal .p-4.border-t');
    if (!footer) return;

    // Use event delegation for footer buttons to handle dynamic updates
    if (!footer.hasAttribute('data-footer-listeners-attached')) {
        footer.addEventListener('click', (e) => {
            if (e.target.id === 'editDetailBtn') {
                handleEditToggle();
            } else if (e.target.id === 'saveDetailBtn') {
                handleSave();
            } else if (e.target.id === 'cancelEditBtn') {
                handleEditToggle();
            }
        });
        footer.setAttribute('data-footer-listeners-attached', 'true');
    }
}

function showCardImagesModal(item) {
    if (!item) return;

    handleOpenModal('cardImagesModalOverlay', resolveDashboardAssetPath('modals/cardImagesModal.html'), () => {
        const modal = document.getElementById('cardImagesModalOverlay');
        const frontContainer = modal.querySelector('#card-image-front-container');
        const backContainer = modal.querySelector('#card-image-back-container');

        const frontUrl = '../media/縦表 .png';
        const backUrl = '../media/縦裏.png';

        const setupImage = (container, url) => {
            container.innerHTML = `<img src="${url}" class="max-w-full max-h-full object-contain transition-transform duration-200" alt="名刺画像">`;
            const img = container.querySelector('img');
            if (img) {
                img.dataset.rotation = '0'; // Reset rotation
                img.dataset.scale = '1';    // Reset scale
            }
            container.setAttribute('data-zoom-src', url);
        };

        if (frontContainer) setupImage(frontContainer, frontUrl);
        if (backContainer) setupImage(backContainer, backUrl);

        // Attach zoom listener to the new modal
        if (!modal.hasAttribute('data-zoom-listener-attached')) {
            modal.addEventListener('click', handleModalImageClick);
            modal.setAttribute('data-zoom-listener-attached', 'true');
        }

        // Rotate button listener (Delegation)
        if (!modal.hasAttribute('data-rotate-listener-attached')) {
            modal.addEventListener('click', (e) => {
                const btn = e.target.closest('.rotate-btn');
                if (btn) {
                    e.stopPropagation();
                    handleRotateClick({ currentTarget: btn });
                }
            });
            modal.setAttribute('data-rotate-listener-attached', 'true');
        }

        // ホイールズームリスナーを設定
        setupWheelZoomListeners(modal);
    });
}

function handleEditToggle() {
    isModalInEditMode = !isModalInEditMode;
    renderModalContent(currentItemInModal, isModalInEditMode);
    // setupCardZoomListeners() removed; Event delegation handles this automatically
    updateModalFooter();
}

function handleSave() {
    if (!isModalInEditMode || !currentItemInModal) return;

    const answerContainer = document.getElementById('modal-survey-answer-details');
    if (!answerContainer) return;

    const updatedItem = JSON.parse(JSON.stringify(currentItemInModal));

    let hasChanges = false;

    updatedItem.details.forEach(detail => {
        const questionText = detail.question;
        const questionDef = updatedItem.survey?.details?.find(d => d.question === questionText);
        const questionType = questionDef ? questionDef.type : 'free_text';

        let newAnswer;

        switch (questionType) {
            case 'single_choice':
                const select = answerContainer.querySelector(`select[data-question="${questionText}"]`);
                if (select) {
                    newAnswer = select.value;
                }
                break;

            case 'multi_choice':
                const checkboxes = answerContainer.querySelectorAll(`input[type="checkbox"][data-question="${questionText}"]:checked`);
                newAnswer = Array.from(checkboxes).map(cb => cb.value);
                break;

            default:
                const input = answerContainer.querySelector(`input[type="text"][data-question="${questionText}"]`);
                if (input) {
                    newAnswer = input.value;
                }
                break;
        }

        const oldAnswer = JSON.stringify(detail.answer);
        const newAnswerStr = JSON.stringify(newAnswer);

        if (oldAnswer !== newAnswerStr) {
            hasChanges = true;
            detail.answer = newAnswer;
        }
    });

    if (hasChanges) {
        const index = allCombinedData.findIndex(item => item.answerId === updatedItem.answerId);
        if (index !== -1) {
            allCombinedData[index] = updatedItem;
        }

        currentItemInModal = updatedItem;

        applyFilters();

        showToast('回答を更新しました。', 'success');
    } else {
        showToast('変更はありませんでした。', 'info');
    }

    handleEditToggle();
}

function updateModalFooter() {
    const footer = document.querySelector('#reviewDetailModal .p-4.border-t');
    if (!footer) return;

    if (isModalInEditMode) {
        footer.innerHTML = `
            <div class="flex justify-end items-center gap-2 w-full">
                <button id="cancelEditBtn" class="button-secondary py-2 px-4 rounded-md font-semibold">キャンセル</button>
                <button id="saveDetailBtn" class="button-primary py-2 px-4 rounded-md font-semibold">保存する</button>
            </div>
        `;
    } else {
        footer.innerHTML = `
            <div class="flex justify-end items-center gap-2 w-full">
                <button id="editDetailBtn" class="button-secondary py-2 px-4 rounded-md font-semibold">編集する</button>
            </div>
        `;
    }
}

function handleResetFilters() {
    currentDateFilter = null;
    currentStatusFilter = 'all';

    if (startDatePicker) startDatePicker.clear();
    if (endDatePicker) endDatePicker.clear();

    const daySelect = document.getElementById('dayFilterSelect');
    if (daySelect) daySelect.value = 'all';

    const statusFilterSelect = document.getElementById('statusFilterSelect');
    if (statusFilterSelect) {
        statusFilterSelect.value = 'all';
    }
    const statusFilterSelectDetailed = document.getElementById('statusFilterSelectDetailed');
    if (statusFilterSelectDetailed) {
        statusFilterSelectDetailed.value = 'all';
    }

    applyFilters();
}

function showQuestionSelectModal() {
    handleOpenModal('questionSelectModalOverlay', resolveDashboardAssetPath('modals/questionSelectModal.html'), () => {
        const container = document.getElementById('modal-question-list');
        if (!container) return;

        const questions = [];
        const pushQuestion = (label) => {
            if (!label || questions.includes(label)) return;
            questions.push(label);
        };

        // Get questions from combined data or survey definition
        if (allCombinedData.length > 0) {
            allCombinedData.forEach(item => {
                item.details?.forEach(detail => pushQuestion(detail.question || detail.text || detail.id));
            });
        }
        if (questions.length === 0 && currentSurvey?.details) {
            currentSurvey.details.forEach(detail => pushQuestion(detail.question || detail.text || detail.id));
        }

        container.innerHTML = '';
        if (questions.length === 0) {
            container.innerHTML = '<p class="p-4 text-center text-on-surface-variant">設問情報がありません。</p>';
            return;
        }

        questions.forEach(question => {
            const button = document.createElement('button');
            const isActive = question === currentIndustryQuestion;
            
            // 設問タイプを確認してグラフ化可能か判定
            const questionDef = currentSurvey?.details?.find(d => (d.question || d.text) === question);
            const isGraphable = questionDef && (questionDef.type === 'single_choice' || questionDef.type === 'multi_choice');

            button.className = `w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${isActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-surface-variant text-on-surface'
                }`;

            button.innerHTML = `
                <div class="flex items-center gap-3 truncate">
                    <span class="material-icons text-sm ${isGraphable ? 'text-primary' : 'text-on-surface-variant/60'}">
                        ${isGraphable ? 'analytics' : 'subject'}
                    </span>
                    <span class="truncate pr-4">${question}</span>
                </div>
                ${isActive ? '<span class="material-icons text-sm">check_circle</span>' : '<span class="material-icons text-sm opacity-0 group-hover:opacity-40 transition-opacity">chevron_right</span>'}
            `;

            button.onclick = () => {
                handleQuestionSelectClick(question);
                // Close modal
                const overlay = document.getElementById('questionSelectModalOverlay');
                if (overlay) overlay.click(); // Standard way to close in this project
            };
            container.appendChild(button);
        });
    });
}

function getFilteredData() {
    let filteredData = allCombinedData;

    // 日付・時間範囲フィルター
    if (currentDateFilter && currentDateFilter.length === 2) {
        const [startDate, endDate] = currentDateFilter;
        filteredData = filteredData.filter(item => {
            if (!item.answeredAt) return false;
            const itemDate = new Date(item.answeredAt);
            return itemDate >= startDate && itemDate <= endDate;
        });
    } else if (currentDateFilter && currentDateFilter.length === 1) {
        // 片方のみ選択されている場合はその日全体
        const startDate = new Date(currentDateFilter[0]);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(currentDateFilter[0]);
        endDate.setHours(23, 59, 59, 999);
        filteredData = filteredData.filter(item => {
            if (!item.answeredAt) return false;
            const itemDate = new Date(item.answeredAt);
            return itemDate >= startDate && itemDate <= endDate;
        });
    }

    // ステータスフィルター
    if (currentStatusFilter !== 'all') {
        filteredData = filteredData.filter(item => {
            const cardStatus = item.cardStatus === 'processing' || !item.businessCard ? 'processing' : 'completed';
            return cardStatus === currentStatusFilter;
        });
    }

    return filteredData;
}

function applyFilters() {
    const filteredData = getFilteredData();
    sortData(filteredData);
    displayPage(1, filteredData);
    renderDashboard(filteredData);
}

function displayPage(page, data = allCombinedData) {
    currentPage = page;
    const tableBody = document.getElementById('reviewTableBody');
    const pageInfo = document.getElementById('pageInfo');
    if (!tableBody || !pageInfo) return;

    const sortedData = [...data].sort((a, b) => {
        const getAnswer = (item) => item.details?.find(d => d.question === currentIndustryQuestion)?.answer;
        const answerA = getAnswer(a);
        const answerB = getAnswer(b);
        const isUnanswered = (answer) => answer === '-' || answer === '' || answer == null;
        const isUnansweredA = isUnanswered(answerA);
        const isUnansweredB = isUnanswered(answerB);
        if (isUnansweredA === isUnansweredB) {
            return 0;
        }
        return isUnansweredA ? 1 : -1;
    });

    tableBody.innerHTML = '';
    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = sortedData.slice(startIndex, endIndex);
    populateTable(paginatedData, handleDetailClick, currentIndustryQuestion);
    setupPagination(sortedData);
    const totalItems = sortedData.length;
    const startItem = totalItems === 0 ? 0 : startIndex + 1;
    const endItem = Math.min(endIndex, totalItems);
    pageInfo.textContent = `${startItem} - ${endItem} / 全 ${totalItems}件`;
}

function renderTableSkeleton() {
    const tableBody = document.getElementById('reviewTableBody');
    const pageInfo = document.getElementById('pageInfo');
    if (!tableBody) return;

    // Reset info
    if (pageInfo) pageInfo.textContent = '読み込み中...';

    // Create 5 skeleton rows
    const skeletonRow = `
        <tr class="animate-pulse border-b border-outline-variant/50">
            <td class="px-4 py-4"><div class="h-4 bg-outline-variant/20 rounded w-16"></div></td>
            <td class="px-4 py-4"><div class="h-4 bg-outline-variant/20 rounded w-32"></div></td>
            <td class="px-4 py-4"><div class="h-4 bg-outline-variant/20 rounded w-24"></div></td>
            <td class="px-4 py-4"><div class="h-4 bg-outline-variant/20 rounded w-40"></div></td>
            <td class="px-4 py-4"><div class="h-4 bg-outline-variant/20 rounded w-full"></div></td>
        </tr>
    `;

    tableBody.innerHTML = skeletonRow.repeat(5);
}

function setupPagination(currentData = allCombinedData) {
    const paginationNumbers = document.getElementById('pagination-numbers');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const itemsPerPageSelect = document.getElementById('itemsPerPage');
    if (!paginationNumbers || !prevPageBtn || !nextPageBtn || !itemsPerPageSelect) return;

    const pageCount = Math.ceil(currentData.length / rowsPerPage);
    paginationNumbers.innerHTML = '';
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(pageCount, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        const firstPageButton = document.createElement('button');
        firstPageButton.textContent = '1';
        firstPageButton.className = 'px-3 py-1 mx-1 rounded bg-surface-variant text-on-surface-variant';
        firstPageButton.addEventListener('click', () => displayPage(1, currentData));
        paginationNumbers.appendChild(firstPageButton);
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'mx-1';
            paginationNumbers.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `px-3 py-1 mx-1 rounded ${i === currentPage ? 'bg-primary text-on-primary' : 'bg-surface-variant text-on-surface-variant'}`;
        pageButton.addEventListener('click', () => displayPage(i, currentData));
        paginationNumbers.appendChild(pageButton);
    }

    if (endPage < pageCount) {
        if (endPage < pageCount - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.className = 'mx-1';
            paginationNumbers.appendChild(ellipsis);
        }
        const lastPageButton = document.createElement('button');
        lastPageButton.textContent = pageCount;
        lastPageButton.className = 'px-3 py-1 mx-1 rounded bg-surface-variant text-on-surface-variant';
        lastPageButton.addEventListener('click', () => displayPage(pageCount, currentData));
        paginationNumbers.appendChild(lastPageButton);
    }

    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === pageCount || pageCount === 0;
    prevPageBtn.onclick = () => displayPage(currentPage - 1, currentData);
    nextPageBtn.onclick = () => displayPage(currentPage + 1, currentData);
    itemsPerPageSelect.onchange = (e) => {
        rowsPerPage = parseInt(e.target.value);
        displayPage(1, currentData);
    };
    itemsPerPageSelect.value = rowsPerPage;
}

function populateQuestionSelector(data) {
    const container = document.getElementById('question-selector-container');
    if (!container) return;

    const questions = [];
    const pushQuestion = (label) => {
        if (!label || questions.includes(label)) {
            return;
        }
        questions.push(label);
    };

    if (Array.isArray(data) && data.length > 0) {
        data.forEach(item => {
            if (Array.isArray(item.details)) {
                item.details.forEach(detail => {
                    pushQuestion(detail.question || detail.text || detail.id);
                });
            }
        });
    }

    if (questions.length === 0 && currentSurvey && Array.isArray(currentSurvey.details)) {
        currentSurvey.details.forEach(detail => {
            pushQuestion(detail.question || detail.text || detail.id);
        });
    }

    container.innerHTML = '';

    if (questions.length === 0) {
        const fallbackMessage = document.createElement('p');
        fallbackMessage.textContent = '設問情報が利用できません。';
        fallbackMessage.className = 'text-sm text-on-surface-variant px-3 py-2';
        container.appendChild(fallbackMessage);
        return;
    }

    questions.forEach(question => {
        const button = document.createElement('button');
        button.textContent = truncateQuestion(question);
        button.title = question;
        button.className = 'w-full text-left px-3 py-2 text-sm rounded-md transition-colors';
        if (question === currentIndustryQuestion) {
            button.classList.add('active');
        } else {
            button.classList.add('text-on-surface-variant', 'hover:bg-surface-variant');
        }
        button.addEventListener('click', () => handleQuestionSelectClick(question));
        container.appendChild(button);
    });
}

function setupEventListeners() {
    setupSortListeners();

    const startEl = document.getElementById('startDateInput');
    const endEl = document.getElementById('endDateInput');
    const daySelect = document.getElementById('dayFilterSelect');

    const fpConfig = {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        minDate: "2026-01-04",
        maxDate: "2026-01-17",
        locale: "ja",
        onDayCreate: function (dObj, dStr, fp, dayElem) {
            const date = dayElem.dateObj;
            const start = new Date(2026, 0, 4);
            const end = new Date(2026, 0, 17);
            const compareDate = new Date(date.getTime());
            compareDate.setHours(0, 0, 0, 0);
            if (compareDate >= start && compareDate <= end) {
                dayElem.classList.add('event-duration-highlight');
            }
        },
        onChange: function () {
            if (startDatePicker && endDatePicker) {
                const start = startDatePicker.selectedDates[0];
                const end = endDatePicker.selectedDates[0];
                if (start && end) {
                    currentDateFilter = [start, end];
                    // 手動変更時はセレクターを「カスタム」に
                    if (daySelect && daySelect.value !== 'custom') {
                        const startStr = startDatePicker.formatDate(start, "Y-m-d");
                        const endStr = endDatePicker.formatDate(end, "Y-m-d");
                        // 開始と終了が同じ日の00:00と23:59なら、その日の選択状態を維持してもよいが
                        // 簡略化のため、手動変更はカスタム扱いとする
                        if (valFromSelectChange !== true) {
                            daySelect.value = 'custom';
                        }
                    }
                    applyFilters();
                }
            }
        }
    };

    let valFromSelectChange = false;

    if (startEl && endEl) {
        startDatePicker = flatpickr(startEl, fpConfig);
        endDatePicker = flatpickr(endEl, fpConfig);
    }

    if (daySelect) {
        daySelect.addEventListener('change', (e) => {
            const val = e.target.value;
            valFromSelectChange = true;
            if (val === 'all') {
                startDatePicker.setDate("2026-01-04 00:00");
                endDatePicker.setDate("2026-01-17 23:59");
                currentDateFilter = [new Date(2026, 0, 4, 0, 0), new Date(2026, 0, 17, 23, 59)];
            } else if (val === 'custom') {
                // カスタム選択時は何もしない（ユーザーの入力を待つ）
                valFromSelectChange = false;
                return;
            } else {
                // val は "2026-01-04" 形式
                startDatePicker.setDate(`${val} 00:00`);
                endDatePicker.setDate(`${val} 23:59`);
                const d = val.split('-');
                currentDateFilter = [new Date(d[0], d[1] - 1, d[2], 0, 0), new Date(d[0], d[1] - 1, d[2], 23, 59)];
            }
            applyFilters();
            valFromSelectChange = false;
        });
    }

    // ステータスフィルターのイベントリスナー
    const statusFilterSelect = document.getElementById('statusFilterSelect');
    const statusFilterSelectDetailed = document.getElementById('statusFilterSelectDetailed');
    const syncStatusFilter = (value) => {
        currentStatusFilter = value;
        if (statusFilterSelect && statusFilterSelect.value !== value) {
            statusFilterSelect.value = value;
        }
        if (statusFilterSelectDetailed && statusFilterSelectDetailed.value !== value) {
            statusFilterSelectDetailed.value = value;
        }
        applyFilters();
    };
    if (statusFilterSelect) {
        statusFilterSelect.addEventListener('change', (e) => {
            syncStatusFilter(e.target.value);
        });
    }
    if (statusFilterSelectDetailed) {
        statusFilterSelectDetailed.addEventListener('change', (e) => {
            syncStatusFilter(e.target.value);
        });
    }
    if (statusFilterSelect) statusFilterSelect.value = currentStatusFilter;
    if (statusFilterSelectDetailed) statusFilterSelectDetailed.value = currentStatusFilter;

    const resetBtn = document.getElementById('resetFiltersButton');
    if (resetBtn) {
        resetBtn.addEventListener('click', handleResetFilters);
    }

    const questionCard = document.getElementById('kpi-current-question-card');
    if (questionCard) {
        questionCard.addEventListener('click', showQuestionSelectModal);
    }

    const graphBtn = document.getElementById('graphButton');
    if (graphBtn) {
        graphBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const urlParams = new URLSearchParams(window.location.search);
            let surveyId = urlParams.get('surveyId');
            if (!surveyId) {
                surveyId = 'sv_0001_24001'; // Fallback to default
            }
            window.location.href = `graph-page.html?surveyId=${surveyId}`;
        });
    }

    // 時間帯別グラフの軸モード切り替え
    const tsAutoBtn = document.getElementById('ts-axis-auto-btn');
    const tsFixedBtn = document.getElementById('ts-axis-fixed-btn');

    if (tsAutoBtn && tsFixedBtn) {
        const updateTSButtons = (mode) => {
            if (mode === 'auto') {
                tsAutoBtn.classList.add('bg-surface', 'text-primary', 'shadow-sm');
                tsAutoBtn.classList.remove('text-on-surface-variant', 'hover:text-on-surface');
                tsFixedBtn.classList.remove('bg-surface', 'text-primary', 'shadow-sm');
                tsFixedBtn.classList.add('text-on-surface-variant', 'hover:text-on-surface');
            } else {
                tsFixedBtn.classList.add('bg-surface', 'text-primary', 'shadow-sm');
                tsFixedBtn.classList.remove('text-on-surface-variant', 'hover:text-on-surface');
                tsAutoBtn.classList.remove('bg-surface', 'text-primary', 'shadow-sm');
                tsAutoBtn.classList.add('text-on-surface-variant', 'hover:text-on-surface');
            }
        };

        tsAutoBtn.addEventListener('click', () => {
            timeSeriesAxisMode = 'auto';
            updateTSButtons('auto');
            renderTimeSeriesChart(getFilteredData());
        });

        tsFixedBtn.addEventListener('click', () => {
            timeSeriesAxisMode = 'fixed';
            updateTSButtons('fixed');
            renderTimeSeriesChart(getFilteredData());
        });
    }
}

function sortData(data) {
    data.sort((a, b) => {
        let aValue, bValue;

        const getValue = (item, key) => {
            if (key === 'fullName') {
                const lastName = item.businessCard?.group2?.lastName || '';
                const firstName = item.businessCard?.group2?.firstName || '';
                return `${lastName} ${firstName}`.trim();
            }
            if (key === 'companyName') {
                return item.businessCard?.group3?.companyName || '';
            }
            if (key === 'dynamicQuestion') {
                const detail = item.details?.find(d => d.question === currentIndustryQuestion);
                const answer = detail?.answer;
                return Array.isArray(answer) ? answer.join(', ') : answer || '';
            }
            return item[key] || '';
        };

        aValue = getValue(a, currentSortKey);
        bValue = getValue(b, currentSortKey);

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return currentSortOrder === 'asc'
                ? aValue.localeCompare(bValue, 'ja')
                : bValue.localeCompare(aValue, 'ja');
        } else {
            if (aValue < bValue) return currentSortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return currentSortOrder === 'asc' ? 1 : -1;
            return 0;
        }
    });
}

function updateSortIcons() {
    document.querySelectorAll('.sortable-header').forEach(header => {
        const icon = header.querySelector('.sort-icon');
        if (!icon) return;
        if (header.dataset.sortKey === currentSortKey) {
            icon.textContent = currentSortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward';
            icon.classList.remove('opacity-40');
        } else {
            icon.textContent = 'unfold_more';
            icon.classList.add('opacity-40');
        }
    });
}

function setupSortListeners() {
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sortKey;
            if (currentSortKey === sortKey) {
                currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortKey = sortKey;
                currentSortOrder = 'desc';
            }
            applyFilters();
            updateSortIcons();
        });
    });
}

/**
 * Processes raw survey data into a format suitable for a data table.
 * This is adapted from graph-page.js's processDataForCharts.
 * @param {object} survey The survey definition object.
 * @param {Array} answers The array of answer objects to process.
 * @returns {Array} An array of objects, each representing a question's aggregated data.
 */
function processDataForTable(survey, answers) {
    if (!survey?.details) return [];

    return survey.details.map((question, index) => {
        const questionId = question.id || `q${index + 1}`;

        if (SINGLE_CHOICE_TYPES.has(question.type) || MULTI_CHOICE_TYPES.has(question.type)) {
            const summary = buildChoiceSummary(question, answers);
            return {
                questionId,
                questionText: question.text,
                labels: summary.labels,
                data: summary.data,
                totalAnswers: summary.totalAnswers,
                totalVotes: summary.totalVotes,
                includeTotalRow: SINGLE_CHOICE_TYPES.has(question.type),
                blankReason: ''
            };
        }

        const reason = BLANK_TYPES.has(question.type)
            ? getBlankReason(question.type)
            : '未対応の設問タイプ';

        return {
            questionId,
            questionText: question.text,
            labels: [],
            data: [],
            totalAnswers: 0,
            totalVotes: 0,
            includeTotalRow: false,
            blankReason: reason
        };
    });
}

/**
 * Renders the aggregated data into an HTML table.
 * @param {Array} processedData The data processed by processDataForTable.
 */
function renderGraphDataTable(processedData) {
    const container = document.getElementById('graph-data-table-container');
    if (!container) return;

    if (!processedData || processedData.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center gap-2 py-8 h-full">
                <span class="material-icons text-5xl text-on-surface-variant/20">bar_chart</span>
                <p class="text-sm text-on-surface-variant">設問を選択するとここに内訳が表示されます。</p>
            </div>
        `;
        return;
    }

    const allTablesHtml = processedData.map(questionData => {
        if (!questionData) {
            return '';
        }

        if (questionData.blankReason) {
            const reason = escapeHtml(questionData.blankReason);
            return `
                <div class="p-4 rounded-lg bg-surface-variant text-on-surface-variant text-sm">
                    この設問は現在グラフ対象外です。理由: ${reason}
                </div>
            `;
        }

        if (!questionData.labels || questionData.labels.length === 0) {
            return `
                <div class="flex flex-col items-center justify-center text-center gap-2 py-6">
                    <span class="material-icons text-4xl text-on-surface-variant/20">hourglass_empty</span>
                    <p class="text-sm text-on-surface-variant">回答を待っています...</p>
                </div>
            `;
        }

        const { labels, data, totalVotes, includeTotalRow } = questionData;

        const tableRows = labels.map((label, index) => {
            const count = data[index];
            const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0';
            return `
                <tr class="border-b border-outline-variant/30 last:border-b-0">
                    <td class="px-3 py-2 text-sm text-on-surface truncate" title="${escapeHtml(label)}">${escapeHtml(label)}</td>
                    <td class="px-3 py-2 text-sm text-on-surface text-right">${count}</td>
                    <td class="px-3 py-2 text-sm text-on-surface-variant text-right">${percentage}%</td>
                </tr>
            `;
        }).join('');

        const totalRow = includeTotalRow
            ? `
                <tr class="border-b border-outline-variant/30 font-semibold">
                    <td class="px-3 py-2 text-sm text-on-surface">合計</td>
                    <td class="px-3 py-2 text-sm text-on-surface text-right">${questionData.totalAnswers}</td>
                    <td class="px-3 py-2 text-sm text-on-surface-variant text-right">${questionData.totalAnswers > 0 ? '100.0' : '0.0'}%</td>
                </tr>
            `
            : '';

        return `
            <div class="rounded-lg border border-outline-variant/50">
                <table class="w-full text-left table-fixed">
                    <thead class="bg-surface-variant/30">
                        <tr class="border-b border-outline-variant/50">
                            <th class="px-3 py-2 text-xs font-semibold text-on-surface-variant w-1/2">選択肢</th>
                            <th class="px-3 py-2 text-xs font-semibold text-on-surface-variant text-right">回答数</th>
                            <th class="px-3 py-2 text-xs font-semibold text-on-surface-variant text-right">割合</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-outline-variant/30">
                        ${tableRows}
                        ${totalRow}
                    </tbody>
                </table>
            </div>
        `;
    }).join('');

    container.innerHTML = allTablesHtml || '<p class="text-sm text-on-surface-variant p-4 text-center">集計可能なデータはありません。</p>';
}

function renderDashboard(data) {
    const dashboardContainer = document.getElementById('analytics-dashboard');
    if (!dashboardContainer) return;
    dashboardContainer.classList.remove('hidden');

    // 1. KPIs
    const totalElement = document.getElementById('kpi-total-answers');
    if (totalElement) totalElement.textContent = data.length.toLocaleString() + '件';

    // Update Question Title
    const questionTitleEl = document.getElementById('dashboard-current-question');
    if (questionTitleEl) {
        questionTitleEl.textContent = truncateQuestion(currentIndustryQuestion) || '未選択';
    }

    // 2. Time Series Chart
    renderTimeSeriesChart(data);

    // 3. Attribute Chart
    renderAttributeChart(data);

    // 4. Data Table (New!)
    const processedData = processDataForTable(currentSurvey, data);
    // Filter to show only the currently selected question
    const currentQuestionData = processedData.filter(d => d.questionText === currentIndustryQuestion);
    renderGraphDataTable(currentQuestionData);
}

function renderTimeSeriesChart(data) {
    const ctx = document.getElementById('timeSeriesChart');
    if (!ctx) return;

    if (!data || data.length === 0) {
        if (timeSeriesChart) {
            timeSeriesChart.destroy();
            timeSeriesChart = null;
        }
        return;
    }

    // 1. Determine bounds
    let startHour, endHour;
    
    const hourIndices = data.map(item => {
        if (!item.answeredAt) return null;
        const d = new Date(item.answeredAt);
        if (isNaN(d.getTime())) return null;
        return d.getHours();
    }).filter(h => h !== null);

    if (hourIndices.length === 0 && timeSeriesAxisMode === 'auto') {
        if (timeSeriesChart) {
            timeSeriesChart.destroy();
            timeSeriesChart = null;
        }
        return;
    }

    if (timeSeriesAxisMode === 'fixed') {
        startHour = 9;
        endHour = 19; // 19:00 included
    } else {
        const minHour = Math.min(...hourIndices);
        const maxHour = Math.max(...hourIndices);
        startHour = Math.max(0, minHour - 1);
        endHour = Math.min(23, maxHour + 1);
    }

    const length = endHour - startHour + 1;

    // 2. Aggregate counts
    const counts = Array(length).fill(0);
    const labels = Array.from({ length: length }, (_, i) => `${startHour + i}:00`);

    hourIndices.forEach(h => {
        const index = h - startHour;
        if (index >= 0 && index < length) {
            counts[index]++;
        }
    });

    if (timeSeriesChart) {
        timeSeriesChart.destroy();
    }

    timeSeriesChart = new Chart(ctx, {
        type: 'line', // Changed to Line Chart
        data: {
            labels: labels,
            datasets: [{
                label: '回答数',
                data: counts,
                borderColor: '#1a73e8', // Primary Blue Line
                backgroundColor: 'rgba(26, 115, 232, 0.1)', // Light blue fill
                fill: true, // Fill area under the line
                tension: 0.4, // Smooth curves
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            layout: {
                padding: {
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: 0
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { precision: 0 },
                    grid: { borderDash: [2, 4] }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

function renderAttributeChart(data) {
    const ctx = document.getElementById('attributeChart');
    if (!ctx) return;
    const container = ctx.parentElement;

    const renderEmptyState = (message, icon) => {
        if (attributeChart) {
            attributeChart.destroy();
            attributeChart = null;
        }
        if (container) {
            let empty = container.querySelector('.attribute-empty-state');
            if (!empty) {
                empty = document.createElement('div');
                empty.className = 'attribute-empty-state flex flex-col items-center justify-center text-center gap-2 py-6 h-full w-full';
                empty.innerHTML = `
                    <span class="material-icons text-5xl text-on-surface-variant/20">${icon}</span>
                    <p class="text-sm text-on-surface-variant"></p>
                `;
                container.appendChild(empty);
            }
            const messageEl = empty.querySelector('p');
            if (messageEl) messageEl.textContent = message;
        }
        ctx.classList.add('hidden');
    };

    const clearEmptyState = () => {
        if (!container) return;
        container.querySelector('.attribute-empty-state')?.remove();
        ctx.classList.remove('hidden');
    };

    // Aggregate by currentIndustryQuestion
    const counts = {};
    const questionDef = currentSurvey?.details?.find(detail => detail.question === currentIndustryQuestion || detail.text === currentIndustryQuestion);
    if (!questionDef || (!SINGLE_CHOICE_TYPES.has(questionDef.type) && !MULTI_CHOICE_TYPES.has(questionDef.type))) {
        renderEmptyState('設問を選択するとここに内訳が表示されます。', 'bar_chart');
        return;
    }

    (data || []).forEach(item => {
        const detail = findAnswerDetail(item, questionDef);
        let answer = detail?.answer;

        if (Array.isArray(answer)) {
            answer.forEach(a => {
                const label = a || '未回答';
                counts[label] = (counts[label] || 0) + 1;
            });
        } else {
            const label = answer || '未回答';
            counts[label] = (counts[label] || 0) + 1;
        }
    });

    // Sort by count desc
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) {
        renderEmptyState('回答を待っています...', 'hourglass_empty');
        return;
    }

    clearEmptyState();
    const labels = sorted.map(s => s[0]);
    const values = sorted.map(s => s[1]);

    if (attributeChart) {
        attributeChart.destroy();
    }

    // Colors
    const palette = ['#1a73e8', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722', '#795548', '#9e9e9e', '#607d8b'];

    attributeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: palette.slice(0, labels.length),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { boxWidth: 12, font: { size: 11 } }
                }
            }
        }
    });
}


function setupSidebarToggle() {
    const sidebar = document.getElementById('right-sidebar');
    const toggleBtn = document.getElementById('right-sidebar-toggle-btn');
    const icon = toggleBtn?.querySelector('.material-icons');
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    const overlay = document.getElementById('right-sidebar-overlay');

    if (!sidebar || !toggleBtn || !icon || !mainContentWrapper) return;

    let hasUserInteracted = false;

    // --- Search Tab Logic ---
    const simpleTab = document.getElementById('simple-search-tab');
    const detailedTab = document.getElementById('detailed-search-tab');
    const simpleContent = document.getElementById('simple-search-content');
    const detailedContent = document.getElementById('detailed-search-content');

    if (simpleTab && detailedTab && simpleContent && detailedContent) {
        const switchTab = (mode) => {
            if (mode === 'simple') {
                simpleTab.classList.add('bg-surface', 'text-primary', 'shadow-sm');
                simpleTab.classList.remove('text-on-surface-variant', 'hover:text-on-surface');
                simpleTab.classList.add('is-active');
                detailedTab.classList.remove('bg-surface', 'text-primary', 'shadow-sm');
                detailedTab.classList.add('text-on-surface-variant', 'hover:text-on-surface');
                detailedTab.classList.remove('is-active');
                simpleContent.classList.remove('hidden');
                detailedContent.classList.add('hidden');
            } else {
                detailedTab.classList.add('bg-surface', 'text-primary', 'shadow-sm');
                detailedTab.classList.remove('text-on-surface-variant', 'hover:text-on-surface');
                detailedTab.classList.add('is-active');
                simpleTab.classList.remove('bg-surface', 'text-primary', 'shadow-sm');
                simpleTab.classList.add('text-on-surface-variant', 'hover:text-on-surface');
                simpleTab.classList.remove('is-active');
                detailedContent.classList.remove('hidden');
                simpleContent.classList.add('hidden');
            }
        };

        simpleTab.addEventListener('click', () => switchTab('simple'));
        detailedTab.addEventListener('click', () => switchTab('detailed'));
    }

    const applySidebarState = (isCollapsed) => {
        if (isCollapsed) {
            // CLOSE
            sidebar.classList.remove('translate-x-0');
            sidebar.classList.add('translate-x-full');
            mainContentWrapper.classList.remove('lg:mr-80');
            icon.textContent = 'chevron_left';
            toggleBtn.setAttribute('aria-expanded', 'false');
            if (overlay) overlay.classList.remove('is-visible');
        } else {
            // OPEN
            sidebar.classList.remove('translate-x-full');
            sidebar.classList.add('translate-x-0');
            mainContentWrapper.classList.add('lg:mr-80');
            icon.textContent = 'chevron_right';
            toggleBtn.setAttribute('aria-expanded', 'true');
            if (overlay) overlay.classList.add('is-visible');
        }
    };

    toggleBtn.addEventListener('click', () => {
        hasUserInteracted = true;
        const isCollapsed = !sidebar.classList.contains('translate-x-full');
        applySidebarState(isCollapsed);
    });

    if (overlay) {
        overlay.addEventListener('click', () => {
            hasUserInteracted = true;
            applySidebarState(true);
        });
    }

    // Initial state check
    const isInitiallyCollapsed = window.innerWidth < 1280;
    applySidebarState(isInitiallyCollapsed);

    // Auto-hide logic
    setTimeout(() => {
        if (hasUserInteracted) return;
        // Only auto-hide if it wasn't collapsed initially due to screen size
        if (!isInitiallyCollapsed) {
            applySidebarState(true);
        }
    }, 800);
}

export async function initializePage() {
    renderTableSkeleton(); // Show skeleton immediately
    try {
        initBreadcrumbs();
        const urlParams = new URLSearchParams(window.location.search);
        const surveyId = urlParams.get('surveyId');

        if (!surveyId) {
            throw new Error("アンケートIDが指定されていません。");
        }

        // 1. Fetch all data sources in parallel
        const [surveys, answers, personalInfo, enqueteDetails] = await Promise.all([
            fetch(resolveDashboardDataPath('core/surveys.json')).then(res => res.json()),
            fetch(resolveDemoDataPath(`answers/${surveyId}.json`)).then(res => {
                if (!res.ok) return []; // Return empty array if answer file not found
                return res.json();
            }),
            fetch(resolveDemoDataPath(`business-cards/${surveyId}.json`)).then(res => {
                if (!res.ok) return []; // Return empty array if personal info file not found
                return res.json();
            }),
            fetch(resolveDemoDataPath(`surveys/${surveyId}.json`)).then(res => {
                if (!res.ok) return {}; // Return empty object if enquete file not found
                return res.json();
            })
        ]);

        // Fallback to local data if demo dataset files are unavailable
        let answersData = answers;
        let personalInfoData = personalInfo;
        let enqueteDetailsData = enqueteDetails;

        if (!Array.isArray(answersData) || answersData.length === 0) {
            const url = resolveDashboardDataPath(`responses/answers/${surveyId}.json`);
            console.log('Fetching answers from:', url); // ★デバッグ用ログ
            const r1 = await fetch(url);
            answersData = r1.ok ? await r1.json() : [];
            console.log('Fetched answersData:', answersData); // ★デバッグ用ログ
        }
        if (!Array.isArray(personalInfoData) || personalInfoData.length === 0) {
            const url = resolveDashboardDataPath(`responses/business-cards/${surveyId}.json`);
            console.log('Fetching personal info from:', url); // ★デバッグ用ログ
            const r2 = await fetch(url);
            personalInfoData = r2.ok ? await r2.json() : [];
            console.log('Fetched personalInfoData:', personalInfoData); // ★デバッグ用ログ
        }
        if (!enqueteDetailsData || !enqueteDetailsData.details) {
            const r3 = await fetch(resolveDashboardDataPath(`surveys/enquete/${surveyId}.json`));
            enqueteDetailsData = r3.ok ? await r3.json() : {};
        }

        // 2. Find the survey definition
        currentSurvey = surveys.find(s => s.id === surveyId);
        if (!currentSurvey) {
            throw new Error(`アンケートID「${surveyId}」の定義が見つかりません。`);
        }
        // 設問詳細情報を結合
        const normalizedDetails = Array.isArray(enqueteDetailsData.details)
            ? enqueteDetailsData.details.map(detail => ({
                ...detail,
                text: detail.text || detail.question || '',
                question: detail.question || detail.text || ''
            }))
            : [];
        currentSurvey.details = normalizedDetails;

        // 3. Create a map for quick lookup of personal info
        const personalInfoArr = (Array.isArray(personalInfoData) && personalInfoData.length > 0) ? personalInfoData : personalInfo;
        const answersArr = (Array.isArray(answersData) && answersData.length > 0) ? answersData : answers;
        const personalInfoMap = new Map(personalInfoArr.map(info => [info.answerId, info.businessCard]));

        // 4. Combine answers with personal info and survey definition
        allCombinedData = answersArr.map(answer => {
            // Priority: 1. Separate file (map), 2. Embedded in answer, 3. null for blank status
            let businessCard = personalInfoMap.get(answer.answerId);

            if (!businessCard && answer.businessCard) {
                businessCard = answer.businessCard;
            }

            // 未データ化の場合はbusinessCardをnullのままにする（フォールバックしない）
            // これによりレンダラーがcardStatus='blank'と正しく判定できる

            return {
                ...answer,
                survey: currentSurvey,
                businessCard: businessCard
            };
        });

        if (answersArr.length === 0) {
            console.warn(`アンケートID「${surveyId}」に対する回答データが見つかりませんでした。`);
        }


        // 5. Render the page with the combined data
        const surveyNameEl = document.getElementById('review-survey-name');
        if (surveyNameEl) {
            surveyNameEl.textContent = `アンケート名: ${currentSurvey.name.ja}`;
        }

        // 最初の設問をデフォルトの表示設問とする
        if (currentSurvey.details && currentSurvey.details.length > 0) {
            currentIndustryQuestion = currentSurvey.details[0].question || currentSurvey.details[0].text;
        } else {
            currentIndustryQuestion = '設問情報なし'; // 設問がない場合のデフォルト
        }

        const dynamicHeader = document.getElementById('dynamic-question-header');
        if (dynamicHeader) {
            dynamicHeader.textContent = truncateQuestion(currentIndustryQuestion);
        }

        setupTableEventListeners();
        populateQuestionSelector(allCombinedData);
        displayPage(1, allCombinedData);
        renderDashboard(allCombinedData);
        setupEventListeners();
        setupSidebarToggle();
        updateSortIcons();

    } catch (error) {
        console.error('SPEEDレビューページの初期化に失敗しました:', error);
        const tableBody = document.getElementById('reviewTableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-error">${error.message}</td></tr>`;
        }
    }
}
