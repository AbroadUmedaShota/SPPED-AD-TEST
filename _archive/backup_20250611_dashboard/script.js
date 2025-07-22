document.addEventListener('DOMContentLoaded', () => {

    // --- Global Utility Functions for Scroll Lock ---
    let scrollPosition = 0; // Stores scroll position for `lockScroll`/`unlockScroll`
    let activeUIsCount = 0; // MODAL_OVERLAY_TRANSPARENCY: スクロールロックの堅牢化

    /**
     * Prevents scrolling on the body element.
     * Captures current scroll position and applies fixed positioning.
     */
    function lockScroll() {
        if (activeUIsCount === 0) { // 最初のUI要素が開くときのみスクロールロック
            scrollPosition = window.scrollY;
            document.body.style.overflow = 'hidden';
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollPosition}px`;
            document.body.style.width = '100%';
        }
        activeUIsCount++;
    }

    /**
     * Restores scrolling on the body element.
     * Reverts fixed positioning and restores scroll position.
     */
    function unlockScroll() {
        activeUIsCount--;
        if (activeUIsCount <= 0) { // 全てのUI要素が閉じられたときのみスクロール解除
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('position');
            document.body.style.removeProperty('top');
            document.body.style.removeProperty('width');
            window.scrollTo(0, scrollPosition);
            activeUIsCount = 0; // 負の値にならないようにリセット
        }
    }

    // --- Modal Control Functions ---
    /**
     * Opens a modal window.
     * @param {string} modalId The ID of the modal element to open.
     */
    window.openModal = function(modalId) { // Exposed to window
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            requestAnimationFrame(() => {
                modal.dataset.state = 'open';
                modal.querySelector('.modal-content-transition').dataset.state = 'open';
            });
            lockScroll(); // Lock scroll when any modal opens

            // Specific handler for newSurveyModal to set default dates
            if (modalId === 'newSurveyModal') {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1); // Set to next day

                const surveyStartDateInput = document.getElementById('surveyStartDate');
                const surveyEndDateInput = document.getElementById('surveyEndDate');

                // Helper to format date as YYYY-MM-DD
                const getFormattedDate = (date) => {
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                if (surveyStartDateInput) {
                    surveyStartDateInput.value = getFormattedDate(tomorrow);
                }
                // Optionally set an end date, e.g., one week from start date
                if (surveyEndDateInput) {
                    const oneWeekLater = new Date(tomorrow);
                    oneWeekLater.setDate(tomorrow.getDate() + 7);
                    surveyEndDateInput.value = getFormattedDate(oneWeekLater);
                }
            }
        }
    }

    /**
     * Closes a modal window.
     * @param {string} modalId The ID of the modal element to close.
     */
    window.closeModal = function(modalId) { // Exposed to window
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.dataset.state = 'closed';
            const modalContent = modal.querySelector('.modal-content-transition');
            modalContent.dataset.state = 'closed';

            modalContent.addEventListener('transitionend', () => {
                modal.classList.add('hidden');
                // MODAL_OVERLAY_TRANSPARENCY: スクロールロック解除ロジックをglobal_scroll_state_managementに集約
                unlockScroll();
            }, { once: true });
        }
    }

    // --- Event Listeners for Modals ---
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                window.closeModal(overlay.id);
            }
        });
    });

    // MODAL_CONTROL_FUNCTION: Escapeキーでのモーダル閉じる処理を動的に変更
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // 開いている全てのモーダルを閉じる
            document.querySelectorAll('.modal-overlay[data-state="open"]').forEach(modal => {
                window.closeModal(modal.id);
            });
            // モバイルサイドバーも開いていれば閉じる
            const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
            if (mobileSidebarOverlay && mobileSidebarOverlay.classList.contains('is-visible')) {
                toggleMobileSidebar();
            }
        }
    });

    // --- Download Options Modal Specific Logic ---
    const periodCustomRadio = document.getElementById('period_custom');
    const customPeriodInputs = document.getElementById('customPeriodInputs');
    const downloadForm = document.querySelector('#downloadOptionsModal form');
    let currentSurveyPeriod = { start: '', end: '' }; // Stores survey specific period for date picker limits

    if (downloadForm && periodCustomRadio && customPeriodInputs) {
        downloadForm.addEventListener('change', (event) => {
            if (event.target === periodCustomRadio) {
                if (periodCustomRadio.checked) {
                    customPeriodInputs.classList.remove('hidden');
                    document.getElementById('download_start_date').value = currentSurveyPeriod.start;
                    document.getElementById('download_end_date').value = currentSurveyPeriod.end;
                } else {
                    customPeriodInputs.classList.add('hidden');
                }
            }
        });
    }

    /**
     * Opens the download options modal, pre-selects a download type, and sets date limits.
     * @param {string} initialSelection Initial radio button to select ('answer', 'image', 'business_card', 'both').
     * @param {string} periodStart Start date for the survey period (YYYY-MM-DD).
     * @param {string} periodEnd End date for the survey period (YYYY-MM-DD).
     */
    window.openDownloadModal = function(initialSelection, periodStart = '', periodEnd = '') { // Exposed to window
        // Reset form to default state
        document.getElementById('period_all').checked = true;
        customPeriodInputs.classList.add('hidden');

        // Set initial data type selection
        const initialRadio = document.getElementById(`download_${initialSelection}`);
        if (initialRadio) {
            initialRadio.checked = true;
        } else {
            document.getElementById('download_answer').checked = true; // Fallback
        }

        // Store survey period for custom date selection and set min/max attributes
        currentSurveyPeriod = { start: periodStart, end: periodEnd };
        document.getElementById('download_start_date').min = periodStart;
        document.getElementById('download_start_date').max = periodEnd;
        document.getElementById('download_end_date').min = periodStart;
        document.getElementById('download_end_date').max = periodEnd;

        window.openModal('downloadOptionsModal'); // Use window.openModal
    }

    // ERROR_HANDLING_UI: トースト通知コンポーネントの基本スタイルとJS
    /**
     * Shows a non-blocking toast notification to the user.
     * @param {string} message The message to display.
     * @param {'success' | 'error' | 'info'} type The type of toast (for styling).
     * @param {number} duration How long the toast should be visible in milliseconds.
     */
    function showToast(message, type = 'info', duration = 3000) {
        let toast = document.getElementById('toastNotification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toastNotification';
            // トーストのCSSクラスをここで初期設定
            toast.className = 'toast-notification'; 
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        // 既存のクラスを一度クリアしてから、新しいタイプと表示クラスを追加
        toast.className = `toast-notification show toast-${type}`;

        setTimeout(() => {
            toast.classList.remove('show');
            // アニメーションが完了してからvisiblityをhiddenにするため、少し遅延させる
            setTimeout(() => {
                toast.classList.remove(`toast-${type}`); // タイプクラスもクリア
            }, 300); // CSS transition duration に合わせる
        }, duration);
    }

    // QR_CODE_URL_COPY_DOWNLOAD_FUNCTION: URLコピーにClipboard APIを使用
    window.copyUrl = async function() { // Exposed to window
        const surveyUrlInput = document.getElementById('surveyUrl') || document.getElementById('detail_surveyUrl'); // Check both
        if (surveyUrlInput) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                try {
                    await navigator.clipboard.writeText(surveyUrlInput.value);
                    showToast("URLがクリップボードにコピーされました！", "success");
                } catch (err) {
                    console.error('URLコピーに失敗しました:', err);
                    showToast("URLのコピーに失敗しました。手動でコピーしてください。", "error");
                }
            } else { // Fallback for browsers without Clipboard API (less common now)
                surveyUrlInput.select();
                surveyUrlInput.setSelectionRange(0, 99999); // For mobile devices
                try {
                    document.execCommand("copy");
                    showToast("URLがクリップボードにコピーされました！", "success");
                } catch (err) {
                    console.error('URLコピーに失敗しました:', err);
                    showToast("URLのコピーに失敗しました。手動でコピーしてください。", "error");
                }
            }
        }
    }

    /**
     * Downloads a file from a given URL.
     * @param {string} url The URL of the file to download.
     * @param {string} filename The desired filename for the downloaded file.
     */
    function downloadFile(url, filename) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }


    // --- Table Data Management & Rendering ---
    const surveyTableBody = document.getElementById('surveyTableBody');
    let allSurveyData = []; // Stores all fetched survey data
    let currentFilteredData = []; // データ配列: フィルタリングとソート後のデータを保持 (旧 currentSortedDataの役割も兼ねる)


    /**
     * Fetches survey data from a JSON file.
     * @returns {Promise<Array>} A promise that resolves with an array of survey objects.
     */
    async function fetchSurveyData() {
        try {
            const response = await fetch('data/surveys.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching survey data:', error);
            showToast("アンケートデータの取得に失敗しました。", "error"); // UIへのエラーフィードバック
            return [];
        }
    }

    /**
     * Renders table rows based on the provided survey data.
     * @param {Array} surveysToRender The array of survey objects to display.
     */
    function renderTableRows(surveysToRender) {
        if (!surveyTableBody) return;

        surveyTableBody.innerHTML = ''; // Clear existing rows

        const fragment = document.createDocumentFragment();

        surveysToRender.forEach(survey => {
            const row = document.createElement('tr');
            row.className = 'cursor-pointer hover:bg-surface-variant transition-colors';
            row.dataset.id = survey.id;
            row.dataset.name = survey.name;
            row.dataset.status = survey.status;
            row.dataset.periodStart = survey.periodStart;
            row.dataset.periodEnd = survey.periodEnd;
            row.dataset.deadline = survey.deadline;
            row.dataset.answerCount = survey.answerCount;

            // ステータスバッジのロジック (openSurveyDetails と共通化可能だが、ここでは独立)
            let statusColorClass = '';
            let statusTitle = '';
            switch (survey.status) {
                case '会期中': statusColorClass = 'bg-green-100 text-green-800'; statusTitle = '現在回答を受け付けている状態'; break;
                case '準備中': statusColorClass = 'bg-yellow-100 text-yellow-800'; statusTitle = 'まだ回答を受け付けていない状態'; break;
                case '会期前': statusColorClass = 'bg-yellow-100 text-yellow-800'; statusTitle = 'まだ回答を受け付けていない状態'; break;
                case 'データ化中': statusColorClass = 'bg-blue-100 text-blue-800'; statusTitle = '名刺データの入力・照合作業が進行中'; break;
                case 'アップ待ち': statusColorClass = 'bg-indigo-100 text-indigo-800'; statusTitle = '名刺データ化が完了し、最終確認・ダウンロード準備中'; break;
                case 'アップ完了': statusColorClass = 'bg-blue-100 text-blue-800'; statusTitle = '名刺データがダウンロード可能になり、お礼メールも送信可能'; break;
                case 'データ化なし': statusColorClass = 'bg-gray-100 text-gray-800'; statusTitle = '名刺データ化を行わない設定のアンケート'; break;
                case '期限切れ': statusColorClass = 'bg-orange-100 text-orange-800'; statusTitle = 'データへのアクセスが制限された重要な状態'; break;
                case '削除済み': statusColorClass = 'bg-red-100 text-red-800'; statusTitle = 'ユーザーが削除した状態'; break;
                case '終了': statusColorClass = 'bg-red-100 text-red-800'; statusTitle = '会期終了'; break;
                default: statusColorClass = 'bg-gray-100 text-gray-800'; statusTitle = '不明なステータス'; break;
            }

            // Realtime answers display
            const realtimeAnswersDisplay = survey.realtimeAnswers > 0 && (survey.status === '会期中' || survey.status === 'データ化中') 
                                           ? `<span class="text-primary text-xs ml-1" title="本日+${survey.realtimeAnswers}件">(+${survey.realtimeAnswers})</span>` 
                                           : '';

            row.innerHTML = `
                <td data-label="アクション" class="px-4 py-3 whitespace-nowrap actions-cell">
                    <button class="text-secondary hover:bg-secondary-container rounded-full p-2 transition-all shadow-sm hover:shadow-md" title="アンケートを編集" aria-label="アンケートを編集"><span class="material-icons text-base">edit</span></button>
                    <button class="text-secondary hover:bg-secondary-container rounded-full p-2 transition-all shadow-sm hover:shadow-md" title="QRコードを表示" aria-label="QRコードを表示"><span class="material-icons text-base">qr_code_2</span></button>
                    <button class="text-secondary hover:bg-secondary-container rounded-full p-2 transition-all shadow-sm hover:shadow-md" title="アンケートをコピー" aria-label="アンケートをコピー"><span class="material-icons text-base">content_copy</span></button>
                    <button class="text-error hover:bg-error-container rounded-full p-2 transition-all shadow-sm hover:shadow-md" title="アンケートを削除" aria-label="アンケートを削除"><span class="material-icons text-base">delete</span></button>
                </td>
                <td data-label="アンケート名" class="px-4 py-3 text-on-surface text-sm font-medium" data-sort-value="${survey.name}">
                    ${survey.name}
                </td>
                <td data-label="ステータス" class="px-4 py-3" data-sort-value="${survey.status}">
                    <span class="inline-flex items-center rounded-full ${statusColorClass}" title="${statusTitle}">${survey.status}</span>
                </td>
                <td data-label="回答数" class="px-4 py-3 text-on-surface-variant text-sm" data-sort-value="${survey.answerCount}">
                    ${survey.answerCount} ${realtimeAnswersDisplay}
                </td>
                <td data-label="展示会会期" class="px-4 py-3 text-on-surface-variant text-sm" data-sort-value="${survey.periodStart}">
                    ${survey.periodStart} ~ ${survey.periodEnd}
                </td>
                <td data-label="データダウンロード" class="px-4 py-3">
                    <button class="text-primary hover:bg-primary-container rounded-full p-2" title="データダウンロード" aria-label="データダウンロード"><span class="material-icons text-base">download</span></button>
                </td>
                <td data-label="名刺データ" class="px-4 py-3 text-on-surface-variant text-sm">${survey.bizcardEnabled ? survey.bizcardRequest : '利用なし'}</td>
                <td data-label="ダウンロード期限" class="px-4 py-3 text-on-surface-variant text-sm" data-sort-value="${survey.deadline}">${survey.deadline}</td>
                <td data-label="分析" class="px-4 py-3">
                    <button class="text-secondary hover:bg-secondary-container rounded-full p-2" title="回答分析" aria-label="回答分析"><span class="material-icons text-base">analytics</span></button>
                </td>
            `;
            fragment.appendChild(row);

            // EVENT_DELEGATION_FOR_DYNAMIC_ELEMENTS: 各行のアクションボタンにイベントリスナーを設定 (ここではデリゲーションではなく直接設定の例を残すが、デリゲーションが推奨される)
            // Edit button (already delegated via row click for openSurveyDetails)
            row.querySelector('button[title="アンケートを編集"]').addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent row click from triggering openSurveyDetails twice
                window.openSurveyDetails(survey.id); // 詳細を開く
            });

            // QR Code button
            row.querySelector('button[title="QRコードを表示"]').addEventListener('click', (e) => {
                e.stopPropagation();
                window.openModal('qrCodeModal');
                // QRコードモーダルに動的にURLと画像を設定
                document.getElementById('surveyUrl').value = `https://survey.speedad.com/qr/${survey.id}`;
                document.getElementById('qrCodeModal').querySelector('img').src = `https://via.placeholder.com/200x200?text=QR+Code+${survey.id}`;
            });

            // Data Download button
            row.querySelector('button[title="データダウンロード"]').addEventListener('click', (e) => {
                e.stopPropagation();
                window.openDownloadModal('answer', survey.periodStart, survey.periodEnd);
            });
            
            // Delete button (placeholder for actual delete logic)
            row.querySelector('button[title="アンケートを削除"]').addEventListener('click', (e) => {
                e.stopPropagation();
                // 削除確認モーダルなどを開く処理
                alert(`アンケートID: ${survey.id} を削除します。（実装はここから）`);
            });
            
            // Copy button (placeholder for actual copy logic)
            row.querySelector('button[title="アンケートをコピー"]').addEventListener('click', (e) => {
                e.stopPropagation();
                // アンケートをコピーする処理
                alert(`アンケートID: ${survey.id} をコピーします。（実装はここから）`);
            });
        });

        surveyTableBody.appendChild(fragment);
    }

    // --- Table Sort Logic ---
    let lastSortedHeader = null; // Tracks the last header clicked for sorting

    // TABLE_SORT_FUNCTION: ステータスのカスタムソート順序を中央集約された定数として定義
    const STATUS_SORT_ORDER = {
        '会期前': 1,
        '準備中': 2,
        '会期中': 3,
        'データ化中': 4,
        'アップ待ち': 5,
        'アップ完了': 6,
        'データ化なし': 7,
        '期限切れ': 8,
        '削除済み': 9,
        '終了': 10
    };

    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sortKey;
            let sortOrder = header.dataset.sortOrder; // 'asc' or 'desc'

            // Toggle sort order
            sortOrder = (sortOrder === 'asc') ? 'desc' : 'asc';
            header.dataset.sortOrder = sortOrder;

            // Update sort icons (reset previous, set current)
            if (lastSortedHeader && lastSortedHeader !== header) {
                const prevIcon = lastSortedHeader.querySelector('.sort-icon');
                if (prevIcon) {
                    prevIcon.textContent = 'unfold_more';
                    prevIcon.classList.remove('opacity-100');
                    prevIcon.classList.add('opacity-40');
                }
            }
            const currentSortIcon = header.querySelector('.sort-icon');
            if (currentSortIcon) {
                currentSortIcon.textContent = (sortOrder === 'asc') ? 'arrow_upward' : 'arrow_downward';
                currentSortIcon.classList.remove('opacity-40');
                currentSortIcon.classList.add('opacity-100');
            }
            lastSortedHeader = header;

            // PROBLEM FIX: Sorting on currentFilteredData directly
            currentFilteredData.sort((a, b) => {
                let aValue = a[sortKey];
                let bValue = b[sortKey];

                // Type conversion for robust numerical/date sorting
                if (sortKey === 'answerCount' && aValue !== undefined && bValue !== undefined) {
                    aValue = parseInt(aValue, 10);
                    bValue = parseInt(bValue, 10);
                } else if ((sortKey === 'period' || sortKey === 'deadline') && aValue !== undefined && bValue !== undefined) {
                    aValue = new Date(aValue); // Date objects for proper comparison
                    bValue = new Date(bValue);
                } else if (sortKey === 'status') {
                    // Custom sort order for status
                    aValue = STATUS_SORT_ORDER[aValue] || 99; // 未定義ステータスの場合は大きい値でソート
                    bValue = STATUS_SORT_ORDER[bValue] || 99;
                }

                // Comparison logic
                if (aValue < bValue) return (sortOrder === 'asc') ? -1 : 1;
                if (aValue > bValue) return (sortOrder === 'asc') ? 1 : -1;
                return 0;
            });

            updatePagination(); // Re-render table with sorted data and update pagination
        });
    });


    // --- Filter & Pagination Logic Combined ---
    const searchKeywordInput = document.getElementById('searchKeyword');
    const filterStatusSelect = document.getElementById('filterStatus');
    const filterStartDateInput = document.getElementById('filterStartDate');
    const filterEndDateInput = document.getElementById('filterEndDate');
    const itemsPerPageSelect = document.getElementById('itemsPerPage');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageInfoSpan = document.getElementById('pageInfo');

    let currentPage = 1;
    let itemsPerPage = parseInt(itemsPerPageSelect ? itemsPerPageSelect.value : '10', 10);
    // allSurveyData will be populated by fetchSurveyData()
    // currentFilteredData will hold the data after filtering (before pagination)

    /** Updates the displayed rows based on current page and filters. */
    function updatePagination() {
        // currentFilteredData holds the filtered and sorted (if applicable) data
        const totalItems = currentFilteredData.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Adjust currentPage if it's out of bounds
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
        } else if (totalPages === 0) {
            currentPage = 0; // No pages if no items
        } else if (currentPage === 0 && totalPages > 0) {
            currentPage = 1; // Default to first page if current is 0
        }

        // Slice the data for the current page
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = currentPage * itemsPerPage;
        const surveysForCurrentPage = currentFilteredData.slice(startIndex, endIndex);

        renderTableRows(surveysForCurrentPage); // Re-render table with paginated data

        // Update pagination controls
        if (pageInfoSpan) {
            if (totalItems === 0) {
                pageInfoSpan.textContent = `0件 / 全 0件`;
            } else {
                pageInfoSpan.textContent = `${Math.min(totalItems, startIndex + 1)} - ${Math.min(totalItems, endIndex)} / 全 ${totalItems}件`;
            }
        }
        if (prevPageBtn) prevPageBtn.disabled = (currentPage <= 1);
        if (nextPageBtn) nextPageBtn.disabled = (currentPage >= totalPages || totalPages === 0);
    }

    // FILTER_PAGINATION_FUNCTION: 日付フィルタリングの堅牢なバリデーション
    function isValidDate(date) {
        return date instanceof Date && !isNaN(date.getTime());
    }

    /** Applies filters to `allSurveyData` and updates `currentFilteredData`. */
    function applyFiltersAndPagination() {
        const keyword = searchKeywordInput ? searchKeywordInput.value.toLowerCase() : '';
        const status = filterStatusSelect ? filterStatusSelect.value : 'all';
        const startDateInputVal = filterStartDateInput ? filterStartDateInput.value : '';
        const endDateInputVal = filterEndDateInput ? filterEndDateInput.value : '';

        const startDate = startDateInputVal ? new Date(startDateInputVal) : null;
        const endDate = endDateInputVal ? new Date(endDateInputVal) : null;

        currentFilteredData = allSurveyData.filter(survey => {
            const surveyName = survey.name ? survey.name.toLowerCase() : '';
            const surveyStatus = survey.status;
            const surveyPeriodStart = survey.periodStart ? new Date(survey.periodStart) : null;
            const surveyPeriodEnd = survey.periodEnd ? new Date(survey.periodEnd) : null;

            const matchesKeyword = keyword === '' || surveyName.includes(keyword);
            const matchesStatus = status === 'all' || surveyStatus === status;
            
            // Check if dates are valid before comparison
            const matchesPeriod = 
                (!startDate || !isValidDate(startDate) || (surveyPeriodStart && surveyPeriodStart >= startDate)) &&
                (!endDate || !isValidDate(endDate) || (surveyPeriodEnd && surveyPeriodEnd <= endDate));
            
            return matchesKeyword && matchesStatus && matchesPeriod;
        });

        currentPage = 1; // Reset to first page after filtering
        updatePagination(); // Re-render table with filtered data and update pagination
    }

    // Filter Event Listeners
    if (searchKeywordInput) searchKeywordInput.addEventListener('input', applyFiltersAndPagination);
    if (filterStatusSelect) filterStatusSelect.addEventListener('change', applyFiltersAndPagination);
    if (filterStartDateInput) filterStartDateInput.addEventListener('change', applyFiltersAndPagination);
    if (filterEndDateInput) filterEndDateInput.addEventListener('change', applyFiltersAndPagination);

    // Pagination Event Listeners
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (event) => {
            itemsPerPage = parseInt(event.target.value, 10);
            currentPage = 1;
            updatePagination();
        });
    }
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                updatePagination();
            }
        });
    }
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            const totalItems = currentFilteredData.length;
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                updatePagination();
            }
        });
    }


    // --- Sidebar & Layout Adjustment Logic ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggleMobile = document.getElementById('sidebarToggleMobile');
    const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
    const mainContent = document.getElementById('main-content');
    const mainFooter = document.getElementById('main-footer');
    const sidebarProfileBlock = document.querySelector('.profile-block');
    const sidebarGroupControl = document.querySelector('.sidebar-group-control');
    
    // Theme Toggle Elements
    const themeToggle = document.getElementById('themeToggle'); // Header toggle
    const themeIcon = document.getElementById('themeIcon'); // Header icon
    const sidebarThemeToggle = document.getElementById('sidebarThemeToggle'); // Sidebar toggle
    const sidebarThemeIcon = document.getElementById('sidebarThemeIcon'); // Sidebar icon

    /** Handles opening/closing of the mobile sidebar. */
    function toggleMobileSidebar() {
        const isOpen = sidebar.classList.contains('is-open-mobile');
        if (isOpen) {
            sidebar.classList.remove('is-open-mobile');
            mobileSidebarOverlay.classList.remove('is-visible');
            // MODAL_OVERLAY_TRANSPARENCY: スクロールロック解除ロジックをglobal_scroll_state_managementに集約
            unlockScroll();
        } else {
            sidebar.classList.add('is-open-mobile');
            mobileSidebarOverlay.classList.add('is-visible');
            lockScroll(); // Lock scroll when mobile sidebar opens
        }
    }

    // Event listener for mobile hamburger menu
    if (sidebarToggleMobile) sidebarToggleMobile.addEventListener('click', toggleMobileSidebar);
    // Event listener for clicking on mobile overlay
    if (mobileSidebarOverlay) mobileSidebarOverlay.addEventListener('click', toggleMobileSidebar);
    // SIDEBAR_LAYOUT_ADJUSTMENT: モバイルサイドバーのリンククリックイベントリスナーにeventパラメータを追加
    // Close mobile sidebar if a nav item is clicked
    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (event) => { // 'event' パラメータを追加
            if (window.innerWidth < 1024) { // Only close on mobile
                // Check if the click is not meant to open a modal itself, which handles its own closing
                if (!event.target.closest('[onclick^="openModal("]')) {
                    toggleMobileSidebar();
                }
            }
        });
    });

    /** Adjusts layout based on screen size (PC vs Mobile sidebar behavior). */
    function adjustLayout() {
        // Clear previous event listeners for sidebar hover to prevent duplicates on resize
        sidebar.removeEventListener('mouseenter', handleSidebarExpand);
        sidebar.removeEventListener('mouseleave', handleSidebarCollapse);

        if (window.innerWidth >= 1024) { // PC screens (LG and XL)
            // Ensure mobile-specific classes are removed
            sidebar.classList.remove('is-open-mobile');
            mobileSidebarOverlay.classList.remove('is-visible');
            if (!document.querySelector('.modal-overlay:not(.hidden)')) {
                unlockScroll();
            }
            
            // USE_CSS_CLASSES_FOR_LAYOUT_STYLES: スタイル直接変更をCSSクラス管理に置き換え
            mainContent.classList.add('lg:pl-64'); // Tailwindのクラスを直接追加する例
            mainFooter.classList.add('lg:pl-64');
            mainContent.style.paddingLeft = ''; // 不要なインラインスタイルを削除
            mainFooter.style.paddingLeft = '';

            // Hide mobile toggle button
            sidebarToggleMobile.style.display = 'none';

            // Handle sidebar width and visibility of elements based on breakpoint
            if (window.innerWidth >= 1280) { // XL screens (1280px and above)
                sidebar.style.width = '4rem'; // Collapsed by default
                sidebar.addEventListener('mouseenter', handleSidebarExpand);
                sidebar.addEventListener('mouseleave', handleSidebarCollapse);
                
                // Hide profile block and group control for XL default
                if (sidebarProfileBlock) sidebarProfileBlock.style.display = 'none';
                if (sidebarGroupControl) sidebarGroupControl.style.display = 'none';

            } else { // LG screens (1024px to 1279px)
                sidebar.style.width = '16rem'; // Expanded by default
                // Show profile block and group control for LG default
                if (sidebarProfileBlock) sidebarProfileBlock.style.display = 'flex';
                if (sidebarGroupControl) {
                    sidebarGroupControl.style.display = 'flex';
                    sidebarGroupControl.style.flexDirection = 'column'; 
                    sidebarGroupControl.style.alignItems = 'flex-start';
                    sidebarGroupControl.style.gap = '8px';
                }
            }

            // Show header theme toggle on PC
            if (themeToggle) themeToggle.style.display = 'block';

        } else { // For screens smaller than LG (mobile/small tablet)
            // Ensure sidebar is hidden by default and overlay is hidden
            sidebar.style.width = '0';
            sidebar.style.transform = 'translateX(-100%)';
            mobileSidebarOverlay.classList.remove('is-visible');
            if (!document.querySelector('.modal-overlay:not(.hidden)')) {
                unlockScroll();
            }

            // USE_CSS_CLASSES_FOR_LAYOUT_STYLES: スタイル直接変更をCSSクラス管理に置き換え
            mainContent.classList.remove('lg:pl-64');
            mainFooter.classList.remove('lg:pl-64');
            mainContent.style.paddingLeft = ''; // 不要なインラインスタイルを削除
            mainFooter.style.paddingLeft = '';

            // Show mobile toggle button
            sidebarToggleMobile.style.display = 'block';

            // Ensure profile block and group control are visible when mobile sidebar opens
            if (sidebarProfileBlock) sidebarProfileBlock.style.display = 'flex';
            if (sidebarGroupControl) {
                sidebarGroupControl.style.display = 'flex';
                sidebarGroupControl.style.flexDirection = 'column';
                sidebarGroupControl.style.alignItems = 'flex-start';
                sidebarGroupControl.style.gap = '8px';
            }
            // Hide header theme toggle on mobile
            if (themeToggle) themeToggle.style.display = 'none';
        }
        // Update pagination visibility on layout change
        applyFiltersAndPagination();
    }

    /** Handles sidebar expansion on hover (XL only). */
    function handleSidebarExpand() {
        sidebar.style.width = '16rem'; // Expand sidebar
        if (sidebarProfileBlock) sidebarProfileBlock.style.display = 'flex';
        if (sidebarGroupControl) {
            sidebarGroupControl.style.display = 'flex';
            sidebarGroupControl.style.flexDirection = 'column';
            sidebarGroupControl.style.alignItems = 'flex-start';
            sidebarGroupControl.style.gap = '8px';
        }
    }

    /** Handles sidebar collapse on mouse leave (XL only). */
    function handleSidebarCollapse() {
        sidebar.style.width = '4rem'; // Collapse sidebar
        if (sidebarProfileBlock) sidebarProfileBlock.style.display = 'none';
        if (sidebarGroupControl) sidebarGroupControl.style.display = 'none'; /* Hide group control on collapse */
    }

    // Initial adjustment on load
    adjustLayout(); // Initial layout setup
    
    // Adjust on window resize
    window.addEventListener('resize', adjustLayout);


    // --- Dark Mode Toggle Logic ---
    const themeToggles = [document.getElementById('themeToggle'), document.getElementById('sidebarThemeToggle')];
    const themeIcons = [document.getElementById('themeIcon'), document.getElementById('sidebarThemeIcon')];

    // Load theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeIcons.forEach(icon => { if(icon) icon.textContent = 'dark_mode'; });
    } else {
        themeIcons.forEach(icon => { if(icon) icon.textContent = 'light_mode'; });
    }

    /** Toggles the dark mode class and updates icons/localStorage. */
    window.toggleTheme = function() { // Exposed to window
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        
        // Update both header and sidebar icons
        themeIcons.forEach(iconElement => {
            if (iconElement) {
                iconElement.textContent = isDarkMode ? 'dark_mode' : 'light_mode';
            }
        });
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    }

    // Attach toggle function to both buttons
    if (themeToggle) themeToggle.addEventListener('click', window.toggleTheme);
    if (sidebarThemeToggle) sidebarThemeToggle.addEventListener('click', window.toggleTheme);


    // --- Survey Details Panel Logic ---
    /**
     * Opens the survey details modal and populates it with data for the given survey ID.
     * @param {string} surveyId The ID of the survey to display details for.
     */
    window.openSurveyDetails = function(surveyId) { // Exposed to window
        const survey = allSurveyData.find(s => s.id === surveyId);

        if (!survey) {
            console.error(`Survey with ID ${surveyId} not found.`);
            showToast('アンケートデータが見つかりませんでした。', 'error');
            return;
        }

        // Get modal elements
        const surveyDetailName = document.getElementById('surveyDetailName');
        const surveyDetailStatusBadge = document.getElementById('surveyDetailStatusBadge');
        const detail_surveyName = document.getElementById('detail_surveyName');
        const detail_surveyDescription = document.getElementById('detail_surveyDescription');
        const detail_surveyPeriod = document.getElementById('detail_surveyPeriod');
        const detail_answerCount = document.getElementById('detail_answerCount');
        const detail_deadline = document.getElementById('detail_deadline');
        const detail_bizcardEnabled = document.getElementById('detail_bizcardEnabled');
        const detail_bizcardRequest = document.getElementById('detail_bizcardRequest');
        const detail_surveyUrl = document.getElementById('detail_surveyUrl');
        const detail_qrCodeImage = document.getElementById('detail_qrCodeImage');
        const downloadQrCodeBtn = document.getElementById('downloadQrCodeBtn');
        const detailDownloadBtn = document.getElementById('detailDownloadBtn');


        // Set common status badge logic
        let statusColorClass = '';
        let statusTitle = '';
        switch (survey.status) {
            case '会期中': statusColorClass = 'bg-green-100 text-green-800'; statusTitle = '現在回答を受け付けている状態'; break;
            case '準備中': statusColorClass = 'bg-yellow-100 text-yellow-800'; statusTitle = 'まだ回答を受け付けていない状態'; break;
            case '会期前': statusColorClass = 'bg-yellow-100 text-yellow-800'; statusTitle = 'まだ回答を受け付けていない状態'; break;
            case 'データ化中': statusColorClass = 'bg-blue-100 text-blue-800'; statusTitle = '名刺データの入力・照合作業が進行中'; break;
            case 'アップ待ち': statusColorClass = 'bg-indigo-100 text-indigo-800'; statusTitle = '名刺データ化が完了し、最終確認・ダウンロード準備中'; break;
            case 'アップ完了': statusColorClass = 'bg-blue-100 text-blue-800'; statusTitle = '名刺データがダウンロード可能になり、お礼メールも送信可能'; break;
            case 'データ化なし': statusColorClass = 'bg-gray-100 text-gray-800'; statusTitle = '名刺データ化を行わない設定のアンケート'; break;
            case '期限切れ': statusColorClass = 'bg-orange-100 text-orange-800'; statusTitle = 'データへのアクセスが制限された重要な状態'; break;
            case '削除済み': statusColorClass = 'bg-red-100 text-red-800'; statusTitle = 'ユーザーが削除した状態'; break;
            case '終了': statusColorClass = 'bg-red-100 text-red-800'; statusTitle = '会期終了'; break;
            default: statusColorClass = 'bg-gray-100 text-gray-800'; statusTitle = '不明なステータス'; break;
        }

        // Populate basic info
        if (surveyDetailName) surveyDetailName.textContent = survey.name;
        if (surveyDetailStatusBadge) {
            surveyDetailStatusBadge.className = `inline-flex items-center rounded-full text-xs px-2 py-1 ${statusColorClass}`;
            surveyDetailStatusBadge.textContent = survey.status;
            surveyDetailStatusBadge.title = statusTitle;
        }
        if (detail_surveyName) detail_surveyName.textContent = survey.name;
        if (detail_surveyDescription) detail_surveyDescription.textContent = survey.description || 'なし';
        if (detail_surveyPeriod) detail_surveyPeriod.textContent = `${survey.periodStart} ~ ${survey.periodEnd}`;
        
        // Answer count with realtime display
        if (detail_answerCount) {
            const realtimeAnswersDisplay = survey.realtimeAnswers > 0 && (survey.status === '会期中' || survey.status === 'データ化中') 
                                           ? ` (+${survey.realtimeAnswers})` 
                                           : '';
            detail_answerCount.textContent = `${survey.answerCount}${realtimeAnswersDisplay}`;
        }

        if (detail_deadline) detail_deadline.textContent = survey.deadline;

        // Populate business card info
        if (detail_bizcardEnabled) detail_bizcardEnabled.textContent = survey.bizcardEnabled ? '利用する' : '利用しない';
        if (detail_bizcardRequest) {
            if (survey.bizcardEnabled && survey.bizcardRequest) {
                detail_bizcardRequest.textContent = `${survey.bizcardRequest}件`;
            } else {
                detail_bizcardRequest.textContent = 'N/A'; // Not applicable if not enabled or no request
            }
        }

        // Populate access info
        const qrUrl = `https://survey.speedad.com/qr/${survey.id}`; // Example static QR URL
        const qrImageUrl = `https://via.placeholder.com/200x200?text=QR+Code+${survey.id}`; // Example dynamic QR image URL
        // In a real app, you'd generate or fetch the actual QR image here.

        if (detail_surveyUrl) detail_surveyUrl.value = qrUrl;
        if (detail_qrCodeImage) detail_qrCodeImage.src = qrImageUrl;

        // Attach event listener for QR code download button
        if (downloadQrCodeBtn) {
            // Remove previous listener to prevent duplicates
            const oldDownloadQrCodeBtn = downloadQrCodeBtn.cloneNode(true);
            downloadQrCodeBtn.parentNode.replaceChild(oldDownloadQrCodeBtn, downloadQrCodeBtn);
            document.getElementById('downloadQrCodeBtn').addEventListener('click', () => {
                downloadFile(qrImageUrl, `survey_${survey.id}_qrcode.png`);
            });
        }
        
        // Attach event listener for Data Download button in modal footer
        if (detailDownloadBtn) {
             // Remove previous listener to prevent duplicates
            const oldDetailDownloadBtn = detailDownloadBtn.cloneNode(true);
            detailDownloadBtn.parentNode.replaceChild(oldDetailDownloadBtn, detailDownloadBtn);
            document.getElementById('detailDownloadBtn').addEventListener('click', () => {
                window.openDownloadModal('answer', survey.periodStart, survey.periodEnd);
            });
        }

        // Add event listener for "編集" button in details modal
        const editButton = document.querySelector('#surveyDetailsModal button[aria-label="アンケートを編集"]');
        if (editButton) {
            editButton.addEventListener('click', () => {
                showToast(`アンケートID: ${survey.id} の編集機能は未実装です。`, 'info');
                // ここに編集モーダルを開く、または編集ページに遷移するロジックを追加
            });
        }

        // Add event listener for "分析" button in details modal
        const analyzeButton = document.querySelector('#surveyDetailsModal button[aria-label="分析"]');
        if (analyzeButton) {
            analyzeButton.addEventListener('click', () => {
                showToast(`アンケートID: ${survey.id} の分析機能は未実装です。`, 'info');
                // ここに分析画面へ遷移するロジックを追加 (例: window.location.href = `/analysis?surveyId=${survey.id}`)
            });
        }

        // Add event listener for "削除" button in details modal
        const deleteButton = document.querySelector('#surveyDetailsModal button[aria-label="アンケートを削除"]');
        if (deleteButton) {
            deleteButton.addEventListener('click', () => {
                showToast(`アンケートID: ${survey.id} の削除機能は未実装です。`, 'info');
                // ここに削除確認モーダルなどを開くロジックを追加
            });
        }


        window.openModal('surveyDetailsModal');
    };

    // EVENT_DELEGATION_FOR_DYNAMIC_ELEMENTS: テーブル行のクリックイベントをtbodyにデリゲート
    document.querySelectorAll('#surveyTableBody').forEach(tableBody => { // Attach to tbody to handle dynamically added rows
        tableBody.addEventListener('click', (event) => {
            const targetRow = event.target.closest('tr');
            if (!targetRow) return; // Not a row click

            // Prevent event from bubbling up from interactive elements within the row
            // `event.target.closest('button, a')` で、ボタンやリンクがクリックされた場合は行クリックイベントを停止
            if (event.target.closest('button, a')) {
                event.stopPropagation(); // Stop propagation for clicks on interactive elements
                return;
            }
            
            // Get survey ID from data-id attribute on the <tr>
            const surveyId = targetRow.dataset.id;
            if (surveyId) {
                window.openSurveyDetails(surveyId); // Use window.openSurveyDetails
            }
        });
    });

    // Initial data fetch and render on DOMContentLoaded
    fetchSurveyData().then(data => {
        allSurveyData = data;
        applyFiltersAndPagination(); // Initial render with filters and pagination
    });

});