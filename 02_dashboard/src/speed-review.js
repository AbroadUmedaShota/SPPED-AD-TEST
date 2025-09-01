import { getCombinedReviewData, getSurveyDetailsFromMainCsv } from './services/speedReviewService.js';
import { populateTable, populateModal } from './ui/speedReviewRenderer.js';
import { handleOpenModal } from './modalHandler.js';

// --- State ---
let allCombinedData = [];
let currentPage = 1;
let rowsPerPage = 10; // デフォルトの表示件数
let currentIndustryQuestion = 'Q.02_お客様の主な業界'; // デフォルトの質問

// --- Functions ---

/**
 * 業界質問プルダウンの変更を処理します。
 * @param {Event} e - changeイベントオブジェクト。
 */
function handleIndustryQuestionChange(e) {
    currentIndustryQuestion = e.target.value;
    displayPage(1); // 質問変更時は1ページ目に戻る
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
async function initializePage() {
    try {
        allCombinedData = await getCombinedReviewData();
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

    const industryQuestionSelect = document.getElementById('industryQuestionSelect');
    if (industryQuestionSelect) {
        industryQuestionSelect.addEventListener('change', handleIndustryQuestionChange);
    }

    // ページネーションの初期設定
    setupPagination();
}

/**
 * 検索入力に基づいてテーブルをフィルタリングします。
 * @param {Event} e - inputイベントオブジェクト。
 */
function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const filteredData = allCombinedData.filter(item => {
        if (!item.businessCard) return false;
        const fullName = `${item.businessCard.group2?.lastName || ''} ${item.businessCard.group2?.firstName || ''}`.toLowerCase();
        const companyName = item.businessCard.group3?.companyName?.toLowerCase() || '';
        return fullName.includes(searchTerm) || companyName.includes(searchTerm);
    });
    populateTable(filteredData, handleDetailClick);
}

/**
 * 詳細ボタンがクリックされたときの処理
 * @param {string} answerId - 表示する回答のID (今回は未使用)。
 */
async function handleDetailClick(answerId) {
    try {
        const response = await fetch('/sample/0008000154.csv');
        if (!response.ok) {
            throw new Error(`CSVファイルの読み込みに失敗しました: ${response.statusText}`);
        }
        const csvText = await response.text();
        
        // PapaParseライブラリが見つからないため、簡易的なパーサーを実装
        const parseCSV = (text) => {
            const lines = text.trim().split('\n');
            const header = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            const rows = lines.slice(1).map(line => {
                const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
                let obj = {};
                header.forEach((h, i) => {
                    obj[h] = values[i];
                });
                return obj;
            });
            return { header, rows };
        };

        const { header, rows } = parseCSV(csvText);

        const tableHtml = `
            <table class="w-full text-sm text-left text-gray-500">
                <thead class="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        ${header.map(h => `<th scope="col" class="px-6 py-3">${h}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(row => `
                        <tr class="bg-white border-b">
                            ${header.map(h => `<td class="px-6 py-4">${row[h] || ''}</td>`).join('')}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        handleOpenModal('reviewDetailModal', 'modals/reviewDetailModal.html', () => {
            const contentArea = document.getElementById('csv-content-area');
            if (contentArea) {
                contentArea.innerHTML = tableHtml;
            }
            
            // 閉じるボタンのイベントリスナーを設定
            const closeModalBtn = document.getElementById('closeDetailModalBtn');
            if(closeModalBtn) {
                // 既存のリスナーを削除して重複を避ける
                const newBtn = closeModalBtn.cloneNode(true);
                closeModalBtn.parentNode.replaceChild(newBtn, closeModalBtn);
                
                newBtn.addEventListener('click', () => {
                    const modal = document.getElementById('reviewDetailModal');
                    if(modal) {
                        modal.classList.add('hidden');
                    }
                });
            }
        });

    } catch (error) {
        console.error('詳細の表示に失敗しました:', error);
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', initializePage);