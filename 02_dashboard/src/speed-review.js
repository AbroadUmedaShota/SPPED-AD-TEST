
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
let currentSearchTerm = '';
let currentDateFilter = '';
let currentAnswerFilter = '';
let datePickerInstance = null;
let currentItemInModal = null;
let isModalInEditMode = false;
let currentSurvey = null;

let currentSortKey = 'answeredAt';
let currentSortOrder = 'desc';

// --- Functions ---

function truncateQuestion(questionText) {
    if (!questionText) {
        return '';
    }
    let truncatedText = questionText.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '');
    if (truncatedText.length > 17) {
        truncatedText = truncatedText.substring(0, 17) + '...';
    }
    return truncatedText;
}

function updateAnswerFilterAvailability() {
    const answerFilterSelect = document.getElementById('answerFilter');
    if (!answerFilterSelect) return;

    const questionDef = currentSurvey?.details?.find(d => d.text === currentIndustryQuestion);
    const filterableTypes = ['single_choice', 'multi_choice', 'matrix_single', 'matrix_multi'];

    if (questionDef && filterableTypes.includes(questionDef.type)) {
        answerFilterSelect.disabled = false;
        populateAnswerFilterDropdown();
    } else {
        answerFilterSelect.innerHTML = '<option value="">(対象外の設問)</option>';
        answerFilterSelect.disabled = true;
    }
}

function populateAnswerFilterDropdown() {
    const answerFilterSelect = document.getElementById('answerFilter');
    if (!answerFilterSelect) return;

    const answers = new Set();
    allCombinedData.forEach(item => {
        const detail = item.details?.find(d => d.question === currentIndustryQuestion);
        const answer = detail?.answer;
        
        if (Array.isArray(answer)) {
            answer.forEach(a => {
                if (a !== '') answers.add(a);
            });
        } else {
            answers.add(answer);
        }
    });

    const uniqueAnswers = Array.from(answers);
    answerFilterSelect.innerHTML = '<option value="">全ての回答</option>';

    let hasUnansweredOption = false;
    uniqueAnswers.forEach(answer => {
        const option = document.createElement('option');
        if (answer === '' || answer == null || answer === '-') {
            if (!hasUnansweredOption) {
                option.value = 'unanswered';
                option.textContent = '未回答';
                answerFilterSelect.appendChild(option);
                hasUnansweredOption = true;
            }
        } else {
            option.value = answer;
            option.textContent = answer;
            answerFilterSelect.appendChild(option);
        }
    });

    answerFilterSelect.value = currentAnswerFilter;
}

function handleSearch(e) {
    currentSearchTerm = e.target.value;
    applyFilters();
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
    currentAnswerFilter = '';
    updateAnswerFilterAvailability();
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
            if(img) {
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
    currentSearchTerm = '';
    currentDateFilter = '';
    currentAnswerFilter = '';

    const searchInput = document.getElementById('searchKeyword');
    if (searchInput) {
        searchInput.value = '';
    }
    if (datePickerInstance) {
        datePickerInstance.clear();
    }
    const answerFilterSelect = document.getElementById('answerFilter');
    if (answerFilterSelect) {
        answerFilterSelect.value = '';
    }

    applyFilters();
}

function applyFilters() {
    let filteredData = allCombinedData;

    if (currentSearchTerm) {
        const searchTermLower = currentSearchTerm.toLowerCase();
        filteredData = filteredData.filter(item => {
            const lastName = item.businessCard?.group2?.lastName || '';
            const firstName = item.businessCard?.group2?.firstName || '';
            const fullName = `${lastName} ${firstName}`.toLowerCase();
            const companyName = (item.businessCard?.group3?.companyName || '').trim().toLowerCase();
            let selectedQuestionAnswer = '';
            if (item.details) {
                const detail = item.details.find(d => d.question === currentIndustryQuestion);
                if (detail && detail.answer) {
                    selectedQuestionAnswer = Array.isArray(detail.answer) ? detail.answer.join(', ').toLowerCase() : String(detail.answer).toLowerCase();
                }
            }
            return fullName.includes(searchTermLower) || 
                   companyName.includes(searchTermLower) ||
                   selectedQuestionAnswer.includes(searchTermLower);
        });
    }

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

    if (currentAnswerFilter) {
        filteredData = filteredData.filter(item => {
            const detail = item.details?.find(d => d.question === currentIndustryQuestion);
            const answer = detail?.answer;

            if (currentAnswerFilter === 'unanswered') {
                return answer === '' || answer == null || answer === '-' || (Array.isArray(answer) && answer.length === 0);
            }
            
            if (Array.isArray(answer)) {
                return answer.includes(currentAnswerFilter);
            } else {
                return answer === currentAnswerFilter;
            }
        });
    }

    sortData(filteredData);
    displayPage(1, filteredData);
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

    const searchInput = document.getElementById('searchKeyword');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }
    const dateFilterInput = document.getElementById('dateFilterInput');
    if (dateFilterInput) {
        datePickerInstance = flatpickr(dateFilterInput, {
            dateFormat: "Y-m-d",
            locale: "ja",
            onChange: function(selectedDates, dateStr, instance) {
                currentDateFilter = dateStr;
                applyFilters();
            }
        });
    }
    const resetBtn = document.getElementById('resetFiltersButton');
    if (resetBtn) {
        resetBtn.addEventListener('click', handleResetFilters);
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

    const answerFilterSelect = document.getElementById('answerFilter');
    if (answerFilterSelect) {
        answerFilterSelect.addEventListener('change', (e) => {
            currentAnswerFilter = e.target.value;
            applyFilters();
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

export async function initializePage() {
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
            const r1 = await fetch(resolveDashboardDataPath(`responses/answers/${surveyId}.json`));
            answersData = r1.ok ? await r1.json() : [];
        }
        if (!Array.isArray(personalInfoData) || personalInfoData.length === 0) {
            const r2 = await fetch(resolveDashboardDataPath(`responses/business-cards/${surveyId}.json`));
            personalInfoData = r2.ok ? await r2.json() : [];
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
            const businessCard = personalInfoMap.get(answer.answerId) || {
                group2: { lastName: '(情報なし)' },
                group3: { companyName: '(情報なし)' }
            };
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
        updateAnswerFilterAvailability();
        displayPage(1, allCombinedData);
        setupEventListeners();
        updateSortIcons();

    } catch (error) {
        console.error('SPEEDレビューページの初期化に失敗しました:', error);
        const tableBody = document.getElementById('reviewTableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-error">${error.message}</td></tr>`;
        }
    }
}

