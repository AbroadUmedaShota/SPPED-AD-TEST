console.log("SCRIPT LOADED: speed-review.js");

import { speedReviewService } from './services/speedReviewService.js';
import { populateTable, populateModal } from './ui/speedReviewRenderer.js';
import { handleOpenModal, closeModal } from './modalHandler.js';

// --- State ---
let allCombinedData = [];
let currentPage = 1;
let rowsPerPage = 10; // Default items per page
let currentIndustryQuestion = 'Q.02_お客様の主な業界'; // Default selected industry question
let currentSearchTerm = ''; // Stores the current search keyword
let currentDateFilter = ''; // Stores the current date filter

// --- Functions ---

/**
 * キーワード検索の変更を処理します。
 * @param {Event} e - inputイベントオブジェクト。
 */
function handleSearch(e) {
    currentSearchTerm = e.target.value;
    applyFilters(); // フィルターを再適用
}

/**
 * 業界質問プルダウンの変更を処理します。
 * @param {Event} e - changeイベントオブジェクト。
 */
function handleIndustryQuestionChange(e) {
    currentIndustryQuestion = e.target.value;

    const getAnswer = (item, questionText) => {
        if (!item.details) return '-';
        const detail = item.details.find(d => d.question === questionText);
        if (!detail || !detail.answer || detail.answer.length === 0) return '-';
        const answer = Array.isArray(detail.answer) ? detail.answer.join(', ') : String(detail.answer);
        return answer.trim() === '' ? '-' : answer;
    };

    // Sort data: unanswered items ('-') go to the bottom
    allCombinedData.sort((a, b) => {
        const answerA = getAnswer(a, currentIndustryQuestion);
        const answerB = getAnswer(b, currentIndustryQuestion);

        const aIsUnanswered = answerA === '-';
        const bIsUnanswered = answerB === '-';

        if (aIsUnanswered && !bIsUnanswered) {
            return 1; // a comes after b
        }
        if (!aIsUnanswered && bIsUnanswered) {
            return -1; // a comes before b
        }
        return 0; // Keep original order for other cases
    });

    applyFilters(); // Re-apply filters and pagination with the sorted data
}

/**
 * 詳細ボタンクリック時の処理。
 * @param {string} answerId - クリックされた回答のID。
 */
function handleDetailClick(answerId) {
    const item = allCombinedData.find(data => data.answerId === answerId);
    if (item) {
        populateModal(item);
        handleOpenModal('reviewDetailModal', 'modals/reviewDetailModal.html'); // Assuming reviewDetailModal exists
    } else {
        console.warn('Item not found for answerId:', answerId);
    }
}

/**
 * 全てのフィルターを適用し、テーブルを更新します。
 */
function applyFilters() {
    let filteredData = allCombinedData;

    // キーワードフィルター
    if (currentSearchTerm) {
        const searchTermLower = currentSearchTerm.toLowerCase();
        filteredData = filteredData.filter(item => {
            // businessCard can be null, handle gracefully
            const lastName = item.businessCard?.group2?.lastName || '';
            const firstName = item.businessCard?.group2?.firstName || '';
            const fullName = `${lastName} ${firstName}`.toLowerCase();
            const companyName = item.businessCard?.group3?.companyName?.toLowerCase() || '';

            // Get the answer for the currently selected question in the dropdown
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

    // 日付フィルター
    if (currentDateFilter) {
        const filterDate = new Date(currentDateFilter);
        filteredData = filteredData.filter(item => {
            if (!item.answeredAt) return false;
            const itemDate = new Date(item.answeredAt);
            // 日付部分のみを比較（時間情報は無視）
            return itemDate.getFullYear() === filterDate.getFullYear() &&
                   itemDate.getMonth() === filterDate.getMonth() &&
                   itemDate.getDate() === filterDate.getDate();
        });
    }

    displayPage(1, filteredData);
}

/**
 * データをページごとに分割してテーブルに表示します。
 * @param {number} page - 表示するページ番号。
 * @param {Array} data - ページネーションの対象となる全データ。
 */
function displayPage(page, data = allCombinedData) {
    currentPage = page;
    const tableBody = document.getElementById('reviewTableBody');
    const pageInfo = document.getElementById('pageInfo');
    
    if (!tableBody || !pageInfo) return;

    tableBody.innerHTML = '';

    const startIndex = (page - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = data.slice(startIndex, endIndex);

    populateTable(paginatedData, handleDetailClick, currentIndustryQuestion);
    setupPagination(data);

    // ページ情報の更新
    const totalItems = data.length;
    const startItem = totalItems === 0 ? 0 : startIndex + 1;
    const endItem = Math.min(endIndex, totalItems);
    pageInfo.textContent = `${startItem} - ${endItem} / 全 ${totalItems}件`;
}

/**
 * ページネーションのUIを生成し、イベントリスナーを設定します。
 * @param {Array} currentData - ページネーションの対象となる全データ。
 */
function setupPagination(currentData = allCombinedData) {
    const paginationNumbers = document.getElementById('pagination-numbers');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const itemsPerPageSelect = document.getElementById('itemsPerPage');

    if (!paginationNumbers || !prevPageBtn || !nextPageBtn || !itemsPerPageSelect) return;

    const pageCount = Math.ceil(currentData.length / rowsPerPage);

    // ページ番号ボタンのクリアと再生成
    paginationNumbers.innerHTML = '';
    const maxPagesToShow = 5; // 表示する最大ページ数
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(pageCount, startPage + maxPagesToShow - 1);

    // 終端がmaxPagesToShowに満たない場合、開始を調整
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

    // 前へ/次へボタンの状態更新
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === pageCount;

    // イベントリスナーの再設定 (重複登録防止のため、既存のものを削除してから追加)
    prevPageBtn.onclick = null; // 既存のイベントリスナーをクリア
    nextPageBtn.onclick = null; // 既存のイベントリスナーをクリア

    prevPageBtn.addEventListener('click', () => displayPage(currentPage - 1, currentData));
    nextPageBtn.addEventListener('click', () => displayPage(currentPage + 1, currentData));

    // 表示件数セレクタのイベントリスナー
    itemsPerPageSelect.onchange = null; // 既存のイベントリスナーをクリア
    itemsPerPageSelect.addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value);
        displayPage(1, currentData); // 表示件数変更時は1ページ目に戻る
    });
    itemsPerPageSelect.value = rowsPerPage; // 現在の表示件数をセレクタに反映
}

/**
 * ページの初期化処理
 */
export async function initializePage() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const surveyId = urlParams.get('surveyId');
        console.log('DEBUG: Survey ID from URL:', surveyId);

        if (!surveyId) {
            console.error('Survey ID not found in URL.');
            const tableBody = document.getElementById('reviewTableBody');
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-error">アンケートIDが見つかりません。</td></tr>`;
            }
            return;
        }

        await speedReviewService.loadJsonData(
            '../data/surveys.json',
            '../data/survey-answers.json',
            '../data/business-cards.json'
        );
        console.log('DEBUG: JSON data loaded by speedReviewService.');

        allCombinedData = await speedReviewService.getCombinedReviewData(surveyId);
        console.log('DEBUG: Combined data for table:', allCombinedData);
        displayPage(1); // 初期表示は1ページ目
        setupEventListeners();
    } catch (error) {
        console.error('SPEEDレビューページの初期化に失敗しました:', error);
        const tableBody = document.getElementById('reviewTableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-error">データの読み込みに失敗しました。</td></tr>`;
        }
    }
}

/**
 * イベントリスナーを設定します。
 */
function setupEventListeners() {
    const searchInput = document.getElementById('searchKeyword');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    const dateFilterInput = document.getElementById('dateFilterInput');
    if (dateFilterInput) {
        flatpickr(dateFilterInput, {
            dateFormat: "Y-m-d",
            locale: "ja",
            onChange: function(selectedDates, dateStr, instance) {
                currentDateFilter = dateStr; // Store the selected date string
                applyFilters(); // Apply all filters when date changes
            }
        });
    }

    const industryQuestionSelect = document.getElementById('industryQuestionSelect');
    if (industryQuestionSelect) {
        industryQuestionSelect.addEventListener('change', handleIndustryQuestionChange);
    }
}

    