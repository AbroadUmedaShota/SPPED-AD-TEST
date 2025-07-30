import { getCombinedReviewData } from './services/speedReviewService.js';
import { populateTable, populateModal } from './ui/speedReviewRenderer.js';
import { handleOpenModal } from './modalHandler.js';

// --- State ---
let allCombinedData = [];

// --- Functions ---

/**
 * ページの初期化処理
 */
async function initializePage() {
    try {
        allCombinedData = await getCombinedReviewData();
        populateTable(allCombinedData, handleDetailClick);
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
    searchInput.addEventListener('input', handleSearch);
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
 * @param {string} answerId - 表示する回答のID。
 */
function handleDetailClick(answerId) {
    const itemData = allCombinedData.find(item => item.answerId === answerId);
    if (!itemData) return;

    handleOpenModal('reviewDetailModal', 'modals/reviewDetailModal.html', () => {
        populateModal(itemData);
        // 新しく読み込まれたモーダル内の閉じるボタンにイベントを設定
        const closeModalBtn = document.getElementById('closeDetailModalBtn');
        if(closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                const modal = document.getElementById('reviewDetailModal');
                if(modal) modal.classList.add('hidden');
            });
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', initializePage);
