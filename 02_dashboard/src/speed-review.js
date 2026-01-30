
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
let currentDateFilter = '';
let currentStatusFilter = 'all'; // ステータスフィルター
let datePickerInstance = null;
let currentItemInModal = null;
let isModalInEditMode = false;
let currentSurvey = null;

let currentSortKey = 'answeredAt';
let currentSortOrder = 'desc';

let timeSeriesChart = null; // Dashboard Chart Instance
let attributeChart = null;  // Dashboard Chart Instance

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
    currentDateFilter = '';
    currentStatusFilter = 'all';

    if (datePickerInstance) {
        datePickerInstance.clear();
    }

    const statusFilterSelect = document.getElementById('statusFilterSelect');
    if (statusFilterSelect) {
        statusFilterSelect.value = 'all';
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
            button.className = `w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between group ${isActive ? 'bg-primary/10 text-primary font-bold' : 'hover:bg-surface-variant text-on-surface'
                }`;

            button.innerHTML = `
                <span class="truncate pr-4">${question}</span>
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

function applyFilters() {
    let filteredData = allCombinedData;

    // 日付フィルター
    if (currentDateFilter) {
        const filterDate = new Date(currentDateFilter);
        filteredData = filteredData.filter(item => {
            if (!item.answeredAt) return false;
            const itemDate = new Date(item.answeredAt);
            return itemDate.getFullYear() === filterDate.getFullYear() &&
                itemDate.getMonth() === filterDate.getMonth() &&
                itemDate.getDate() === filterDate.getDate();
        });
    }

    // ステータスフィルター
    if (currentStatusFilter !== 'all') {
        filteredData = filteredData.filter(item => {
            const cardStatus = item.cardStatus === 'processing' || !item.businessCard ? 'processing' : 'completed';
            return cardStatus === currentStatusFilter;
        });
    }

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

    const dateFilterInput = document.getElementById('dateFilterInput');
    if (dateFilterInput) {
        datePickerInstance = flatpickr(dateFilterInput, {
            dateFormat: "Y-m-d",
            locale: "ja",
            onChange: function (selectedDates, dateStr, instance) {
                currentDateFilter = dateStr;
                applyFilters();
            },
            onDayCreate: function (dObj, dStr, fp, dayElem) {
                // 会期: 2026-01-04 ~ 2026-01-17 (month is 0-indexed)
                const date = dayElem.dateObj;
                const start = new Date(2026, 0, 4);
                const end = new Date(2026, 0, 17);
                // 時間部分をクリアして比較
                date.setHours(0, 0, 0, 0);
                if (date >= start && date <= end) {
                    dayElem.classList.add('event-duration-highlight');
                }
            }
        });
    }

    // ステータスフィルターのイベントリスナー
    const statusFilterSelect = document.getElementById('statusFilterSelect');
    if (statusFilterSelect) {
        statusFilterSelect.addEventListener('change', (e) => {
            currentStatusFilter = e.target.value;
            applyFilters();
        });
    }

    const resetBtn = document.getElementById('resetFiltersButton');
    if (resetBtn) {
        resetBtn.addEventListener('click', handleResetFilters);
    }

    const questionCard = document.getElementById('kpi-current-question-card');
    if (questionCard) {
        questionCard.addEventListener('click', showQuestionSelectModal);
    }

    // 「表示設問の変更」ボタンのイベントリスナー
    const changeQuestionBtn = document.getElementById('change-display-question-btn');
    if (changeQuestionBtn) {
        changeQuestionBtn.addEventListener('click', showQuestionSelectModal);
    }

    const graphBtn = document.getElementById('graphButton');
    if (graphBtn) {
        graphBtn.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            let surveyId = urlParams.get('surveyId');
            if (!surveyId) {
                surveyId = 'sv_0001_24001'; // Fallback to default
            }
            window.location.href = `graph-page.html?surveyId=${surveyId}`;
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

    const graphableQuestions = survey.details.filter(q => q.type === 'single_choice' || q.type === 'multi_choice');

    return graphableQuestions.map(question => {
        const counts = {};
        let answeredCount = 0;

        answers.forEach(answer => {
            const answerDetail = answer.details.find(d => d.question === question.text);

            if (answerDetail && answerDetail.answer && answerDetail.answer !== '') {
                answeredCount++;
                const answerValue = answerDetail.answer;
                if (Array.isArray(answerValue)) { // Multi-choice
                    answerValue.forEach(ans => {
                        if (ans) {
                            counts[ans] = (counts[ans] || 0) + 1;
                        }
                    });
                } else { // Single-choice
                    if (answerValue) {
                        counts[answerValue] = (counts[answerValue] || 0) + 1;
                    }
                }
            }
        });

        // Ensure all predefined options are present, even with 0 count
        if (question.options) {
            question.options.forEach(opt => {
                if (!counts.hasOwnProperty(opt)) {
                    counts[opt] = 0;
                }
            });
        }

        // Add 'Unanswered' if it makes sense, but let's stick to the original logic for now
        // which only counts answered questions.

        const sortedLabels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

        return {
            questionId: question.id,
            questionText: question.text,
            labels: sortedLabels,
            data: sortedLabels.map(label => counts[label]),
            totalAnswers: answeredCount,
            totalVotes: sortedLabels.reduce((sum, label) => sum + counts[label], 0)
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
        container.innerHTML = '<p class="text-sm text-on-surface-variant p-4 text-center">集計可能なデータはありません。</p>';
        return;
    }

    const allTablesHtml = processedData.map(questionData => {
        if (!questionData || questionData.labels.length === 0) {
            return ''; // Skip if no data for this question
        }

        const { questionText, labels, data, totalVotes } = questionData;

        const tableRows = labels.map((label, index) => {
            const count = data[index];
            const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
            return `
                <tr class="border-b border-outline-variant/30 last:border-b-0">
                    <td class="px-3 py-2 text-sm text-on-surface truncate" title="${label}">${label}</td>
                    <td class="px-3 py-2 text-sm text-on-surface text-right">${count}</td>
                    <td class="px-3 py-2 text-sm text-on-surface-variant text-right">${percentage}%</td>
                </tr>
            `;
        }).join('');

        return `
            <div class="mb-6">
                <h4 class="text-base font-bold text-on-surface mb-2 px-1 truncate" title="${questionText}">${truncateQuestion(questionText)}</h4>
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
                        </tbody>
                    </table>
                </div>
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
    const attributeTitleEl = document.getElementById('attribute-chart-title');
    if (attributeTitleEl) {
        attributeTitleEl.textContent = truncateQuestion(currentIndustryQuestion) || '未選択';
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

    // 1. Find min and max hours from data
    const hourIndices = data.map(item => {
        if (!item.answeredAt) return null;
        const d = new Date(item.answeredAt);
        if (isNaN(d.getTime())) return null;
        return d.getHours();
    }).filter(h => h !== null);

    if (hourIndices.length === 0) {
        if (timeSeriesChart) {
            timeSeriesChart.destroy();
            timeSeriesChart = null;
        }
        return;
    }

    const minHour = Math.min(...hourIndices);
    const maxHour = Math.max(...hourIndices);

    // Range: from minHour to maxHour + 1
    const startHour = minHour;
    const endHour = maxHour + 1; // +1 to include the end interval visually or as user requested
    const length = endHour - startHour + 1;

    // 2. Aggregate counts for the dynamic range
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

    // Aggregate by currentIndustryQuestion
    const counts = {};
    data.forEach(item => {
        const detail = item.details?.find(d => d.question === currentIndustryQuestion);
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

