// script.js の最上部に移動 (DOMContentLoadedイベントリスナーの外側)
// ダミーユーザーデータ (本来はAPIから取得)
// windowオブジェクトにアタッチすることで、HTMLのonclickから参照可能にする
window.dummyUserData = {
    email: "user@example.com",
    companyName: "株式会社SpeedAd", // テスト用に値を入れておく
    departmentName: "開発部", // テスト用に値を入れておく
    positionName: "エンジニア", // テスト用に値を入れておく
    lastName: "田中",
    firstName: "太郎",
    phoneNumber: "09012345678",
    postalCode: "100-0001",
    address: "東京都千代田区千代田1-1",
    buildingFloor: "皇居ビルディング 1F",
    billingAddressType: "same", // or "different"
    billingCompanyName: "",
    billingDepartmentName: "",
    billingLastName: "",
    billingFirstName: "",
    billingPhoneNumber: "",
    billingPostalCode: "",
    billingAddress: "",
    billingBuildingFloor: "",
};


document.addEventListener('DOMContentLoaded', () => {

    // --- Global Utility Functions for Scroll Lock ---
    let scrollPosition = 0; // Stores scroll position for `lockScroll`/`unlockScroll`
    let activeUIsCount = 0; // Tracks number of active UI overlays (modals, mobile sidebar)

    /**
     * Prevents scrolling on the body element.
     * Captures current scroll position and applies fixed positioning.
     */
    function lockScroll() {
        if (activeUIsCount === 0) { // Lock scroll only when the first UI element opens
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
        if (activeUIsCount <= 0) { // Unlock scroll only when all UI elements are closed
            document.body.style.removeProperty('overflow');
            document.body.style.removeProperty('position');
            document.body.style.removeProperty('top');
            document.body.style.removeProperty('width');
            window.scrollTo(0, scrollPosition);
            activeUIsCount = 0; // Reset to 0 to prevent negative values
        }
    }

    // --- Modal Loading and Control Functions ---
    const loadedModals = new Set(); // Keep track of loaded modal IDs

    /**
     * Loads a modal's HTML content from a file and appends it to the body.
     * Prevents loading the same modal multiple times.
     * @param {string} modalId The ID of the modal element.
     * @param {string} filePath The path to the modal's HTML file.
     * @returns {Promise<void>} A promise that resolves when the modal is loaded.
     */
    async function loadModalFromFile(modalId, filePath) {
        if (loadedModals.has(modalId)) {
            return; // Modal already loaded
        }
        
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                // エラーメッセージをより具体的に改善
                throw new Error(`Failed to load modal from ${filePath}: HTTP status ${response.status} (${response.statusText})`);
            }
            const modalHtml = await response.text();
            
            // Create a temporary div to parse the HTML string
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = modalHtml;
            const modalElement = tempDiv.firstElementChild; // Get the root element of the modal

            if (modalElement && modalElement.id === modalId) {
                document.body.appendChild(modalElement);
                loadedModals.add(modalId);
                // Attach common event listeners for this new modal overlay
                attachModalEventListeners(modalElement);
                // Re-initialize floating labels for newly loaded forms
                // initializeFloatingLabelsForModal(modalElement); // <-- ここでは呼び出さない。データ投入後に populateAccountInfoModal から呼び出す
                                                                 // initializeAccountInfoModalFunctionality が initializeFloatingLabelsForModal を呼ぶため、そちらに任せる

                // --- 変更点: accountInfoModal に特化した初期化 ---
                if (modalId === 'accountInfoModal') {
                    // initializeAccountInfoModalFunctionality はイベントリスナー設定と初期状態の調整を行う。
                    // populateAccountInfoModal の中で toggleBillingDetails が呼ばれるので、
                    // initializeAccountInfoModalFunctionality のリスナー設定が先である必要がある。
                    initializeAccountInfoModalFunctionality(modalElement); 
                }
                if (modalId === 'surveyDetailsModal') {
                    setupSurveyDetailsModalListeners(modalElement);
                }
                // --- End 変更点 ---

            } else {
                console.error(`Error: Modal ID mismatch or invalid HTML structure for ${modalId} from ${filePath}.`);
                showToast(`モーダル (${modalId}) のHTML構造が不正です。`, "error"); // より具体的なエラー
            }
        } catch (error) {
            // エラー原因のヒントを追加済み
            console.error(`Error loading modal ${modalId} from ${filePath}:`, error);
            showToast(`モーダル (${modalId}) の読み込みに失敗しました。ファイルパスを確認してください。`, "error");
            throw error; // Re-throw to propagate error for handleOpenModal
        }
    }

    /**
     * Attaches common event listeners to a modal overlay for closing.
     * @param {HTMLElement} modalElement The root element of the modal overlay.
     */
    function attachModalEventListeners(modalElement) {
        // Overlay click to close
        modalElement.addEventListener('click', (e) => {
            if (e.target === modalElement) {
                window.closeModal(modalElement.id);
            }
        });
    }

    /**
     * Initializes floating label behavior for input fields within a newly loaded modal.
     * @param {HTMLElement} containerElement The root element of the modal or a section containing inputs.
     */
    function initializeFloatingLabelsForModal(containerElement) { // 汎用化
        // This function is now empty as the logic is handled by CSS.
    }


    /**
     * Handles opening a modal, loading it first if necessary.
     * @param {string} modalId The ID of the modal element to open.
     * @param {string} filePath The path to the modal's HTML file.
     */
    window.handleOpenModal = async function(modalId, filePath) {
        const modal = document.getElementById(modalId);
        if (!modal) {
            try {
                await loadModalFromFile(modalId, filePath);
                // After loading, the modal element should now be in the DOM
                // and openModal can proceed.
                window.openModal(modalId);
            } catch (error) {
                // Error already handled by loadModalFromFile and shown to user.
                // No further action needed here, just prevent opening.
            }
        } else {
            // Modal is already in DOM, just open it
            window.openModal(modalId);
        }
    };

    /**
     * Opens a modal window. (Original openModal, renamed and adapted for external loading)
     * This function is now called *after* the modal is confirmed to be in the DOM.
     * @param {string} modalId The ID of the modal element to open.
     */
    window.openModal = function(modalId) {
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
    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.dataset.state = 'closed';
            const modalContent = modal.querySelector('.modal-content-transition');
            modalContent.dataset.state = 'closed';

            modalContent.addEventListener('transitionend', () => {
                modal.classList.add('hidden');
                unlockScroll();
            }, { once: true });
        }
    }

    // --- Global Escape Key Listener for Modals & Sidebar ---
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // Close all open modals
            document.querySelectorAll('.modal-overlay[data-state="open"]').forEach(modal => {
                window.closeModal(modal.id);
            });
            // Close mobile sidebar if open
            const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
            if (mobileSidebarOverlay && mobileSidebarOverlay.classList.contains('is-visible')) {
                toggleMobileSidebar();
            }
        }
    });

    // --- Download Options Modal Specific Logic ---
    let currentSurveyPeriod = { start: '', end: '' }; // Stores survey specific period for date picker limits

    /**
     * Initializes elements specific to the Download Options Modal.
     * This is called after the modal's HTML is loaded into the DOM.
     */
    function initializeDownloadOptionsModal() {
        const modal = document.getElementById('downloadOptionsModal');
        if (!modal) {
            console.warn("Download Options Modal not found for initialization.");
            return; // Modal not loaded yet
        }

        const periodCustomRadio = modal.querySelector('#period_custom');
        const customPeriodInputs = modal.querySelector('#customPeriodInputs');
        const downloadForm = modal.querySelector('form');

        if (downloadForm && periodCustomRadio && customPeriodInputs) {
            // Ensure listeners are not duplicated if called multiple times
            downloadForm.removeEventListener('change', handleDownloadFormChange); // Remove if already attached
            downloadForm.addEventListener('change', handleDownloadFormChange);
        }
    }

    function handleDownloadFormChange(event) {
        // Access elements from the document directly, assuming they are now loaded.
        const periodCustomRadio = document.getElementById('period_custom');
        const customPeriodInputs = document.getElementById('customPeriodInputs');

        if (event.target === periodCustomRadio) {
            if (periodCustomRadio.checked) {
                customPeriodInputs.classList.remove('hidden');
                document.getElementById('download_start_date').value = currentSurveyPeriod.start;
                document.getElementById('download_end_date').value = currentSurveyPeriod.end;
            } else {
                customPeriodInputs.classList.add('hidden');
            }
        }
    }


    /**
     * Opens the download options modal, pre-selects a download type, and sets date limits.
     * @param {string} initialSelection Initial radio button to select ('answer', 'image', 'business_card', 'both').
     * @param {string} periodStart Start date for the survey period (YYYY-MM-DD).
     * @param {string} periodEnd End date for the survey period (YYYY-MM-DD).
     */
    window.openDownloadModal = async function(initialSelection, periodStart = '', periodEnd = '') {
        // --- 変更点: 相対パスに変更 ---
        await window.handleOpenModal('downloadOptionsModal', 'modals/downloadOptionsModal.html');
        
        // Ensure modal elements are available after loading and opening.
        // It's crucial to call initializeDownloadOptionsModal *after* the modal content is in the DOM.
        initializeDownloadOptionsModal();

        // Reset form to default state
        const periodAllRadio = document.getElementById('period_all');
        const customPeriodInputsEl = document.getElementById('customPeriodInputs');
        if (periodAllRadio) periodAllRadio.checked = true;
        if (customPeriodInputsEl) customPeriodInputsEl.classList.add('hidden');

        // Set initial data type selection
        const initialRadio = document.getElementById(`download_${initialSelection}`);
        if (initialRadio) {
            initialRadio.checked = true;
        } else {
            const defaultAnswerRadio = document.getElementById('download_answer');
            if (defaultAnswerRadio) defaultAnswerRadio.checked = true;
        }

        // Store survey period for custom date selection and set min/max attributes
        currentSurveyPeriod = { start: periodStart, end: periodEnd };
        const downloadStartDateInput = document.getElementById('download_start_date');
        const downloadEndDateInput = document.getElementById('download_end_date');
        if (downloadStartDateInput) {
            downloadStartDateInput.min = periodStart;
            downloadStartDateInput.max = periodEnd;
        }
        if (downloadEndDateInput) {
            downloadEndDateInput.min = periodStart;
            downloadEndDateInput.max = periodEnd;
        }
    }

    // --- Toast Notification Component --- (Already defined, kept for completeness)
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
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.className = `toast-notification show toast-${type}`;

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.classList.remove(`toast-${type}`);
            }, 300); // Match CSS transition duration
        }, duration);
    }

    /**
     * Copies a given string to the clipboard.
     * @param {string} text The string to be copied.
     */
    async function copyTextToClipboard(text) {
        if (!text) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                showToast("URLがクリップボードにコピーされました！", "success");
            } catch (err) {
                console.error('URLコピーに失敗しました:', err);
                showToast("URLのコピーに失敗しました。", "error");
            }
        } else { // Fallback for older browsers
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.top = "-9999px";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                showToast("URLがクリップボードにコピーされました！", "success");
            } catch (err) {
                console.error('URLコピーに失敗しました:', err);
                showToast("URLのコピーに失敗しました。", "error");
            }
            document.body.removeChild(textArea);
        }
    }

    // --- URL Copy & Download Functions ---
    /**
     * Copies the value of a given input element to the clipboard.
     * @param {HTMLInputElement} inputElement The input element whose value is to be copied.
     */
    window.copyUrl = async function(inputElement) { // 引数としてinputElementを受け取る
        if (inputElement && inputElement.value) {
            // Use the new generic copy function
            await copyTextToClipboard(inputElement.value);
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
    let currentFilteredData = []; // Data array: holds filtered and sorted data

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
            showToast("アンケートデータの取得に失敗しました。", "error");
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
            row.dataset.dataCompletionDate = survey.dataCompletionDate || '';

            // Status badge logic (shared with openSurveyDetails)
            let statusColorClass = '';
            let displayStatus = survey.status;
            let statusTitle = '';

            switch (survey.status) {
                case '会期中':
                    statusColorClass = 'bg-green-100 text-green-800';
                    statusTitle = '現在回答を受け付けている状態';
                    break;
                case '準備中':
                case '会期前':
                    displayStatus = '会期前';
                    statusColorClass = 'bg-yellow-100 text-yellow-800';
                    statusTitle = 'まだ回答を受け付けていない状態';
                    break;
                case 'データ化中':
                case 'アップ待ち':
                    displayStatus = 'データ化中';
                    statusColorClass = 'bg-blue-100 text-blue-800';
                    statusTitle = '名刺データの入力・照合作業が進行中';
                    break;
                case 'アップ完了':
                    statusColorClass = 'bg-blue-100 text-blue-800';
                    statusTitle = '名刺データがダウンロード可能になり、お礼メールも送信可能';
                    break;
                case '期限切れ':
                case '削除済み':
                case 'データ化なし':
                case '終了':
                    displayStatus = '終了';
                    statusColorClass = 'bg-red-100 text-red-800';
                    statusTitle = 'データへのアクセスが制限された重要な状態、または会期終了';
                    break;
                default:
                    statusColorClass = 'bg-gray-100 text-gray-800';
                    statusTitle = '不明なステータス';
                    break;
            }

            // Realtime answers display
            const realtimeAnswersDisplay = survey.realtimeAnswers > 0 && (survey.status === '会期中' || survey.status === 'データ化中')
                                           ? `<span class="text-primary text-xs ml-1" title="本日+${survey.realtimeAnswers}件">(+${survey.realtimeAnswers})</span>`
                                           : '';

            row.innerHTML = `
                <td data-label="アクション" class="px-4 py-3 whitespace-nowrap actions-cell">
                    <button class="text-secondary hover:bg-secondary-container rounded-full p-2 transition-all shadow-sm shadow-soft" title="アンケートを編集" aria-label="アンケートを編集"><span class="material-icons text-base">edit</span></button>
                    <button class="text-secondary hover:bg-secondary-container rounded-full p-2 transition-all shadow-sm shadow-soft" title="QRコードを表示" aria-label="QRコードを表示"><span class="material-icons text-base">qr_code_2</span></button>
                    <button class="text-secondary hover:bg-secondary-container rounded-full p-2 transition-all shadow-sm shadow-soft" title="アンケートURLをコピー" aria-label="アンケートURLをコピー"><span class="material-icons text-base">content_copy</span></button>
                    <button class="text-error hover:bg-error-container rounded-full p-2 transition-all shadow-sm shadow-soft" title="アンケートを削除" aria-label="アンケートを削除"><span class="material-icons text-base">delete</span></button>
                </td>
                <td data-label="アンケートID" class="px-4 py-3 text-on-surface-variant text-sm font-medium" data-sort-value="${survey.id}">
                    ${survey.id}
                </td>
                <td data-label="アンケート名" class="px-4 py-3 text-on-surface text-sm font-medium" data-sort-value="${survey.name}">
                    ${survey.name}
                </td>
                <td data-label="ステータス" class="px-4 py-3" data-sort-value="${survey.status}">
                    <span class="inline-flex items-center rounded-full text-xs px-2 py-1 ${statusColorClass}" title="${statusTitle}">${displayStatus}</span>
                </td>
                <td data-label="回答数" class="px-4 py-3 text-on-surface-variant text-sm" data-sort-value="${survey.answerCount}">
                    ${survey.answerCount} ${realtimeAnswersDisplay}
                </td>
                <td data-label="展示会会期" class="px-4 py-3 text-on-surface-variant text-sm" data-sort-value="${survey.periodStart}">
                    ${survey.periodStart} ~ ${survey.periodEnd}
                </td>
            `;

            fragment.appendChild(row);

            // EVENT_DELEGATION_FOR_DYNAMIC_ELEMENTS: Add event listeners for action buttons
            row.querySelector('button[title="アンケートを編集"]').addEventListener('click', (e) => {
                e.stopPropagation();
                showToast('アンケート編集画面へ移動します(未実装)', 'info');
            });

            row.querySelector('button[title="QRコードを表示"]').addEventListener('click', (e) => {
                e.stopPropagation();
                // --- 変更点: 相対パスに変更 ---
                window.handleOpenModal('qrCodeModal', 'modals/qrCodeModal.html')
                      .then(() => { // Ensure elements are in DOM after modal is loaded
                          document.getElementById('surveyUrl').value = `https://survey.speedad.com/qr/${survey.id}`;
                          document.getElementById('qrCodeModal').querySelector('img').src = 'sample_qr.png';
                      })
                      .catch(error => console.error("Failed to open QR code modal:", error));
            });

            row.querySelector('button[title="アンケートURLをコピー"]').addEventListener('click', (e) => {
                e.stopPropagation();
                const surveyUrl = `https://survey.speedad.com/qr/${survey.id}`;
                copyTextToClipboard(surveyUrl);
            });
            
            row.querySelector('button[title="アンケートを削除"]').addEventListener('click', (e) => {
                e.stopPropagation();
                showToast(`アンケートID: ${survey.id} を削除します。（実装はここから）`, 'info');
            });

            // 行クリックで詳細モーダルを開く
            row.addEventListener('click', (e) => {
                // ボタンクリック時はモーダルを開かないようにする
                if (e.target.closest('button')) {
                    return;
                }
                window.handleOpenModal('surveyDetailsModal', 'modals/surveyDetailsModal.html')
                    .then(() => {
                        window.populateSurveyDetails(survey);
                    })
                    .catch(error => console.error("Failed to open survey details modal:", error));
            });
        });

        surveyTableBody.appendChild(fragment);
    }

    // --- Table Sort Logic ---
    let lastSortedHeader = null; // Tracks the last header clicked for sorting

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

            // Sorting on currentFilteredData directly
            currentFilteredData.sort((a, b) => {
                let aValue = a[sortKey];
                let bValue = b[sortKey];

                // Type conversion for robust numerical/date sorting
                if (sortKey === 'answerCount' && aValue !== undefined && bValue !== undefined) {
                    aValue = parseInt(aValue, 10);
                    bValue = parseInt(bValue, 10);
                } else if ((sortKey === 'periodStart' || sortKey === 'deadline' || sortKey === 'dataCompletionDate') && aValue !== undefined && bValue !== undefined) {
                    aValue = new Date(aValue); // Date objects for proper comparison
                    bValue = new Date(bValue);
                } else if (sortKey === 'status') {
                    // Custom sort order for status
                    aValue = STATUS_SORT_ORDER[aValue] || 99;
                    bValue = STATUS_SORT_ORDER[bValue] || 99;
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    // Default string comparison (case-insensitive)
                    return aValue.localeCompare(bValue, 'ja', { sensitivity: 'base' });
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

    /** Updates the displayed rows based on current page and filters. */
    function updatePagination() {
        const totalItems = currentFilteredData.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);

        // Adjust currentPage if it's out of bounds
        if (currentPage > totalPages && totalPages > 0) {
            currentPage = totalPages;
        } else if (totalPages === 0) {
            currentPage = 0;
        } else if (currentPage === 0 && totalPages > 0) {
            currentPage = 1;
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = currentPage * itemsPerPage;
        const surveysForCurrentPage = currentFilteredData.slice(startIndex, endIndex);

        renderTableRows(surveysForCurrentPage);

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
    
    /** Handles opening/closing of the mobile sidebar. */
    function toggleMobileSidebar() {
        const isOpen = sidebar.classList.contains('is-open-mobile');
        if (isOpen) {
            sidebar.classList.remove('is-open-mobile');
            mobileSidebarOverlay.classList.remove('is-visible');
            unlockScroll();
        } else {
            sidebar.classList.add('is-open-mobile');
            mobileSidebarOverlay.classList.add('is-visible');
            lockScroll();
        }
    }

    // Event listener for mobile hamburger menu
    if (sidebarToggleMobile) sidebarToggleMobile.addEventListener('click', toggleMobileSidebar);
    // Event listener for clicking on mobile overlay
    if (mobileSidebarOverlay) mobileSidebarOverlay.addEventListener('click', toggleMobileSidebar);

    // Close mobile sidebar if a nav item is clicked
    sidebar.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (event) => {
            if (window.innerWidth < 1024) { // Only close on mobile
                // Check if the click is not meant to open a modal itself, which handles its own closing
                if (!event.target.closest('[onclick^="handleOpenModal("]')) { // Updated to handleOpenModal
                    toggleMobileSidebar();
                }
            }
        });
    });

    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default link behavior
            showToast('ログアウト機能は未実装です。', 'info');
        });
    }

    const newGroupButton = document.querySelector('.sidebar-group-control button[aria-label="グループを新規作成"]');
    if (newGroupButton) {
        newGroupButton.addEventListener('click', () => {
            showToast('グループ新規作成機能は未実装です。', 'info');
        });
    }

    /** Adjusts layout based on screen size (PC vs Mobile sidebar behavior). */
    function adjustLayout() {
        const isModalOpen = document.querySelector('.modal-overlay[data-state="open"]');

        if (window.innerWidth >= 1024) { // PC screens (LG and XL)
            sidebar.classList.remove('is-open-mobile');
            mobileSidebarOverlay.classList.remove('is-visible');
            if (!isModalOpen) {
                unlockScroll();
            }
        } else { // For screens smaller than LG (mobile/small tablet)
            const isMobileSidebarOpen = sidebar.classList.contains('is-open-mobile');
            if (!isMobileSidebarOpen && !isModalOpen) {
                unlockScroll();
            }
        }
        
        // XLスクリーンでのサイドバーホバーイベントリスナーをセットアップ
        // 既存のリスナーをクリアして重複を防ぐ
        sidebar.onmouseenter = null;
        sidebar.onmouseleave = null;

        if (window.innerWidth >= 1280) {
            sidebar.onmouseenter = () => document.body.classList.add('sidebar-hovered');
            sidebar.onmouseleave = () => document.body.classList.remove('sidebar-hovered');
        } else {
            // XLスクリーンでない場合は、クラスが残らないように削除する
            document.body.classList.remove('sidebar-hovered');
        }

        // Update pagination visibility on layout change
        applyFiltersAndPagination();
    }

    // Initial adjustment on load
    adjustLayout();
    
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
    window.toggleTheme = function() {
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
    if (themeToggles[0]) themeToggles[0].addEventListener('click', window.toggleTheme);
    if (themeToggles[1]) themeToggles[1].addEventListener('click', window.toggleTheme);


    // --- Account Info Modal Logic --- (新規追加/修正)
    // ダミーユーザーデータ (本来はAPIから取得)
    // windowオブジェクトにアタッチすることで、HTMLのonclickから参照可能にする
    window.dummyUserData = {
        email: "user@example.com",
        companyName: "株式会社SpeedAd", // テスト用に値を入れておく
        departmentName: "開発部", // テスト用に値を入れておく
        positionName: "エンジニア", // テスト用に値を入れておく
        lastName: "田中",
        firstName: "太郎",
        phoneNumber: "09012345678",
        postalCode: "100-0001",
        address: "東京都千代田区千代田1-1",
        buildingFloor: "皇居ビルディング 1F",
        billingAddressType: "same", // or "different"
        billingCompanyName: "",
        billingDepartmentName: "",
        billingLastName: "",
        billingFirstName: "",
        billingPhoneNumber: "",
        billingPostalCode: "",
        billingAddress: "",
        billingBuildingFloor: "",
    };

    /**
     * Account Info Modalを開き、データを設定する。
     * @param {object} userData 表示するユーザーデータ
     */
    window.openAccountInfoModal = async function(userData) {
        await window.handleOpenModal('accountInfoModal', 'modals/accountInfoModal.html');
        // モーダルがDOMにロードされた後、専用の初期化処理とデータ投入を行う
        initializeAccountInfoModalFunctionality(document.getElementById('accountInfoModal')); // モーダル要素を渡す
        populateAccountInfoModal(userData); // データ投入
    };

    /**
     * Account Info Modal内の動的な機能（セクションの開閉、請求先住所の表示切り替え）を初期化する。
     * モーダルがDOMにロードされるたびに呼び出す。
     * @param {HTMLElement} modalElement モーダルのルート要素
     */
    function initializeAccountInfoModalFunctionality(modalElement) {
        // セクション開閉機能
        modalElement.querySelectorAll('.section-header').forEach(header => { // modalElement から探索
            // 重複登録防止のため、一度リスナーを削除してから追加
            header.removeEventListener('click', toggleSectionContent);
            header.addEventListener('click', toggleSectionContent);
        });

        // 請求先住所の表示切り替え
        const billingAddressTypeRadios = modalElement.querySelectorAll('input[name="billingAddressType"]'); // modalElement から探索
        const billingDetailsSection = modalElement.querySelector('#billingDetailsSection'); // modalElement から探索
        
        if (billingAddressTypeRadios.length > 0 && billingDetailsSection) {
            // 重複登録防止のため、一度リスナーを削除してから追加
            billingAddressTypeRadios.forEach(radio => {
                radio.removeEventListener('change', toggleBillingDetails);
                radio.addEventListener('change', toggleBillingDetails);
            });
            // 初回ロード時の状態は populateAccountInfoModal の最後で設定するため、ここでは呼び出さない
        }
    }

    /**
     * Initializes elements specific to the Survey Details Modal.
     * This is called after the modal's HTML is loaded into the DOM.
     * @param {HTMLElement} modalElement The root element of the modal overlay.
     */
    function setupSurveyDetailsModalListeners(modalElement) {
        if (!modalElement) {
            console.warn("surveyDetailsModal element not provided to setupSurveyDetailsModalListeners.");
            return;
        }

        const editSurveyBtn = modalElement.querySelector('#editSurveyBtn');
        const cancelEditBtn = modalElement.querySelector('#cancelEditBtn');
        const saveSurveyBtn = modalElement.querySelector('#saveSurveyBtn');
        const detailDownloadBtn = modalElement.querySelector('#detailDownloadBtn');

        // Remove existing listeners to prevent duplication
        if (editSurveyBtn) editSurveyBtn.removeEventListener('click', handleEditSurvey);
        if (cancelEditBtn) cancelEditBtn.removeEventListener('click', handleCancelEdit);
        if (saveSurveyBtn) saveSurveyBtn.removeEventListener('click', handleSaveSurvey);
        if (detailDownloadBtn) detailDownloadBtn.removeEventListener('click', handleDetailDownload);

        // Add new listeners
        if (editSurveyBtn) editSurveyBtn.addEventListener('click', handleEditSurvey);
        if (cancelEditBtn) cancelEditBtn.addEventListener('click', handleCancelEdit);
        if (saveSurveyBtn) saveSurveyBtn.addEventListener('click', handleSaveSurvey);
        if (detailDownloadBtn) detailDownloadBtn.addEventListener('click', handleDetailDownload);

        // Ensure it starts in view mode
        setSurveyDetailsMode('view');
    }

    function handleEditSurvey() {
        setSurveyDetailsMode('edit');
    }

    function handleCancelEdit() {
        setSurveyDetailsMode('view');
        // Optionally re-populate with original data if changes were made
        if (currentEditingSurvey) {
            populateSurveyDetails(currentEditingSurvey);
        }
    }

    function handleSaveSurvey() {
        // Implement save logic here
        showToast('アンケート情報を保存します（未実装）', 'info');
        setSurveyDetailsMode('view');
    }

    function handleDetailDownload() {
        if (currentEditingSurvey) {
            window.openDownloadModal('answer', currentEditingSurvey.periodStart, currentEditingSurvey.periodEnd);
        } else {
            showToast('ダウンロードするアンケート情報がありません。', 'error');
        }
    }

    /**
     * セクションの展開/折りたたみを行う。
     * @param {Event} event クリックイベント
     */
    function toggleSectionContent(event) {
        const header = event.currentTarget;
        const contentId = header.getAttribute('aria-controls');
        const content = document.getElementById(contentId);
        const isExpanded = header.getAttribute('aria-expanded') === 'true';
        const icon = header.querySelector('.expand-icon');

        if (content) {
            if (isExpanded) {
                // 折りたたむ
                header.setAttribute('aria-expanded', 'false');
                icon.textContent = 'expand_more';
                content.style.height = content.scrollHeight + 'px'; // 現在の高さを設定してから
                requestAnimationFrame(() => {
                    content.classList.add('hidden');
                    content.style.height = ''; // hiddenクラスがheightを0にするので、ここで高さをリセット
                });
            } else {
                // 展開する
                header.setAttribute('aria-expanded', 'true');
                icon.textContent = 'expand_less';
                content.classList.remove('hidden');
                // heightをautoにする前にscrollHeightを設定してtransitionを効かせる
                content.style.height = content.scrollHeight + 'px';
                // transition完了後にheightをautoに戻す (コンテンツの変化に対応するため)
                const onTransitionEnd = () => {
                    content.style.height = '';
                    content.removeEventListener('transitionend', onTransitionEnd);
                };
                content.addEventListener('transitionend', onTransitionEnd);
            }
        }
    }

    /**
     * 「ご請求書の宛名」ラジオボタンに応じて請求先詳細の表示/非表示を切り替える。
     */
    function toggleBillingDetails() {
        const billingSame = document.getElementById('billingSame');
        const billingDifferent = document.getElementById('billingDifferent');
        const billingDetailsSection = document.getElementById('billingDetailsSection');

        if (billingDetailsSection) {
            if (billingDifferent && billingDifferent.checked) {
                billingDetailsSection.classList.remove('hidden');
                // 展開時に内部の浮動ラベルを再初期化 (hiddenから表示された場合)
                initializeFloatingLabelsForModal(billingDetailsSection);
            } else {
                billingDetailsSection.classList.add('hidden');
            }
        }
    }

    /**
     * Account Info Modalにユーザーデータを投入する。
     * @param {object} userData 投入するユーザーデータオブジェクト
     */
    function populateAccountInfoModal(userData) {
        const modal = document.getElementById('accountInfoModal');
        if (!modal) return;

        // メールアドレス (readonly)
        const userEmailInput = modal.querySelector('#userEmail');
        if (userEmailInput) userEmailInput.value = userData.email || "";

        // 会社情報
        const companyNameInput = modal.querySelector('#companyName');
        if (companyNameInput) companyNameInput.value = userData.companyName || "";
        const departmentNameInput = modal.querySelector('#departmentName');
        if (departmentNameInput) departmentNameInput.value = userData.departmentName || "";
        const positionNameInput = modal.querySelector('#positionName');
        if (positionNameInput) positionNameInput.value = userData.positionName || "";

        // 個人連絡先
        const lastNameInput = modal.querySelector('#lastName');
        if (lastNameInput) lastNameInput.value = userData.lastName || "";
        const firstNameInput = modal.querySelector('#firstName');
        if (firstNameInput) firstNameInput.value = userData.firstName || "";
        const phoneNumberInput = modal.querySelector('#phoneNumber');
        if (phoneNumberInput) phoneNumberInput.value = userData.phoneNumber || "";
        const postalCodeInput = modal.querySelector('#postalCode');
        if (postalCodeInput) postalCodeInput.value = userData.postalCode || "";
        const addressInput = modal.querySelector('#address');
        if (addressInput) addressInput.value = userData.address || "";
        const buildingFloorInput = modal.querySelector('#buildingFloor');
        if (buildingFloorInput) buildingFloorInput.value = userData.buildingFloor || "";

        // ご請求書の宛名 (ラジオボタン)
        const billingSameRadio = modal.querySelector('#billingSame');
        const billingDifferentRadio = modal.querySelector('#billingDifferent');
        if (userData.billingAddressType === 'different') {
            if (billingDifferentRadio) billingDifferentRadio.checked = true;
        } else {
            if (billingSameRadio) billingSameRadio.checked = true;
        }
        toggleBillingDetails(); // ラジオボタンの状態に応じて請求先詳細の表示を切り替え (ここが正しいタイミング)

        // 請求先詳細 (条件付き表示)
        const billingCompanyNameInput = modal.querySelector('#billingCompanyName');
        if (billingCompanyNameInput) billingCompanyNameInput.value = userData.billingCompanyName || "";
        const billingDepartmentNameInput = modal.querySelector('#billingDepartmentName');
        if (billingDepartmentNameInput) billingDepartmentNameInput.value = userData.billingDepartmentName || "";
        const billingLastNameInput = modal.querySelector('#billingLastName');
        if (billingLastNameInput) billingLastNameInput.value = userData.billingLastName || "";
        const billingFirstNameInput = modal.querySelector('#billingFirstName');
        if (billingFirstNameInput) billingFirstNameInput.value = userData.billingFirstName || "";
        const billingPhoneNumberInput = modal.querySelector('#billingPhoneNumber');
        if (billingPhoneNumberInput) billingPhoneNumberInput.value = userData.billingPhoneNumber || "";
        const billingPostalCodeInput = modal.querySelector('#billingPostalCode');
        if (billingPostalCodeInput) billingPostalCodeInput.value = userData.billingPostalCode || "";
        const billingAddressInput = modal.querySelector('#billingAddress');
        if (billingAddressInput) billingAddressInput.value = userData.billingAddress || "";
        const billingBuildingFloorInput = modal.querySelector('#billingBuildingFloor');
        if (billingBuildingFloorInput) billingBuildingFloorInput.value = userData.billingBuildingFloor || "";

        // --- 変更点: データ投入後にinputイベントを強制的に発火させる --- (This part is no longer needed due to CSS changes)
        // --- End 変更点 ---
    }


    // --- Survey Details Panel Logic ---
    let currentEditingSurvey = null; // 現在編集中のアンケートデータを保持する変数

    /**
     * Toggles between view and edit mode in the survey details modal.
     * @param {'view' | 'edit'} mode The mode to switch to.
     */
    function setSurveyDetailsMode(mode) {
        const modal = document.getElementById('surveyDetailsModal');
        if (!modal) return;

        const viewModeElements = modal.querySelectorAll('.view-mode');
        const editModeElements = modal.querySelectorAll('.edit-mode');
        const viewModeButtons = document.getElementById('viewModeButtons');
        const editModeButtons = document.getElementById('editModeButtons');

        if (mode === 'edit') {
            viewModeElements.forEach(el => el.classList.add('hidden'));
            editModeElements.forEach(el => el.classList.remove('hidden'));
            viewModeButtons.classList.add('hidden');
            editModeButtons.classList.remove('hidden');
            editModeButtons.classList.add('flex'); // Ensure flex is applied
        } else { // 'view'
            viewModeElements.forEach(el => el.classList.remove('hidden'));
            editModeElements.forEach(el => el.classList.add('hidden'));
            viewModeButtons.classList.remove('hidden');
            editModeButtons.classList.add('hidden');
            editModeButtons.classList.remove('flex');
        }
    }


    /**
     * Populates the survey details modal with data for a given survey object.
     * This is separated from openModal because the modal might be loaded asynchronously.
     * @param {object} survey The survey data object.
     */
    window.populateSurveyDetails = function(survey) {
        currentEditingSurvey = survey; // Store the survey object for editing

        const modal = document.getElementById('surveyDetailsModal');
        if (!modal) return;

        // --- Get All View and Edit Elements ---
        const surveyDetailName = document.getElementById('surveyDetailName');
        const surveyDetailStatusBadge = document.getElementById('surveyDetailStatusBadge');
        
        // View mode elements
        const detail_surveyId_view = document.getElementById('detail_surveyId');
        const detail_plan_view = document.getElementById('detail_plan_view');
        const detail_surveyNameInternal_view = document.getElementById('detail_surveyNameInternal_view');
        const detail_displayTitle_view = document.getElementById('detail_displayTitle_view');
        const detail_surveyMemo_view = document.getElementById('detail_surveyMemo_view');
        const detail_surveyPeriod_view = document.getElementById('detail_surveyPeriod_view');
        const detail_answerCount_view = document.getElementById('detail_answerCount');
        const detail_dataCompletionDate_view = document.getElementById('detail_dataCompletionDate_view');
        const detail_deadline_view = document.getElementById('detail_deadline_view');
        const detail_estimatedBillingAmount_view = document.getElementById('detail_estimatedBillingAmount_view');
        const detail_bizcardEnabled_view = document.getElementById('detail_bizcardEnabled_view');
        const detail_bizcardCompletionCount_view = document.getElementById('detail_bizcardCompletionCount');
        const detail_thankYouEmailSettings_view = document.getElementById('detail_thankYouEmailSettings_view');

        // Edit mode elements
        const detail_plan_edit = document.getElementById('detail_plan');
        const detail_surveyNameInternal_edit = document.getElementById('detail_surveyNameInternal');
        const detail_displayTitle_edit = document.getElementById('detail_displayTitle');
        const detail_surveyMemo_edit = document.getElementById('detail_surveyMemo');
        const detail_periodStart_edit = document.getElementById('detail_periodStart');
        const detail_periodEnd_edit = document.getElementById('detail_periodEnd');
        const detail_bizcardEnabled_edit = document.getElementById('detail_bizcardEnabled');
        const detail_thankYouEmailSettings_edit = document.getElementById('detail_thankYouEmailSettings');

        // Non-editable fields
        const detail_surveyUrl = document.getElementById('detail_surveyUrl');
        const detail_qrCodeImage = document.getElementById('detail_qrCodeImage');

        // --- Populate View and Edit Fields ---
        // Status Badge
        let statusColorClass = '';
        let displayStatus = survey.status;
        switch (survey.status) {
            case '会期中': statusColorClass = 'bg-green-100 text-green-800'; break;
            case '準備中': case '会期前': displayStatus = '会期前'; statusColorClass = 'bg-yellow-100 text-yellow-800'; break;
            case 'データ化中': case 'アップ待ち': displayStatus = 'データ化中'; statusColorClass = 'bg-blue-100 text-blue-800'; break;
            case 'アップ完了': statusColorClass = 'bg-blue-100 text-blue-800'; break;
            case '期限切れ': case '削除済み': case 'データ化なし': case '終了': displayStatus = '終了'; statusColorClass = 'bg-red-100 text-red-800'; break;
            default: statusColorClass = 'bg-gray-100 text-gray-800'; break;
        }
        surveyDetailName.textContent = survey.name;
        surveyDetailStatusBadge.className = `inline-flex items-center rounded-full text-xs px-2 py-1 ${statusColorClass}`;
        surveyDetailStatusBadge.textContent = displayStatus;

        // Populate view fields
        detail_surveyId_view.textContent = survey.id;
        detail_plan_view.textContent = survey.plan || 'N/A';
        detail_surveyNameInternal_view.textContent = survey.name;
        detail_displayTitle_view.textContent = survey.displayTitle || 'なし';
        detail_surveyMemo_view.textContent = survey.memo || survey.description || 'なし';
        detail_surveyPeriod_view.textContent = `${survey.periodStart} ~ ${survey.periodEnd}`;
        const realtimeAnswersDisplay = survey.realtimeAnswers > 0 ? ` (+${survey.realtimeAnswers})` : '';
        detail_answerCount_view.textContent = `${survey.answerCount}${realtimeAnswersDisplay}`;
        detail_dataCompletionDate_view.textContent = survey.dataCompletionDate || '未定';
        detail_deadline_view.textContent = survey.deadline || 'N/A';
        detail_estimatedBillingAmount_view.textContent = survey.estimatedBillingAmount ? `¥${survey.estimatedBillingAmount.toLocaleString()}` : 'N/A';
        detail_bizcardEnabled_view.textContent = survey.bizcardEnabled ? '利用する' : '利用しない';
        detail_bizcardCompletionCount_view.textContent = survey.bizcardEnabled ? `${survey.bizcardCompletionCount || 0}件` : 'N/A';
        detail_thankYouEmailSettings_view.textContent = survey.thankYouEmailSettings || '設定なし';

        // Populate edit fields
        // Populate edit fields
        detail_plan_edit.value = survey.plan || '';
        detail_surveyNameInternal_edit.value = survey.name;
        detail_displayTitle_edit.value = survey.displayTitle || '';
        detail_surveyMemo_edit.value = survey.memo || survey.description || '';
        detail_periodStart_edit.value = survey.periodStart;
        detail_periodEnd_edit.value = survey.periodEnd;
        detail_bizcardEnabled_edit.value = String(survey.bizcardEnabled); // Convert boolean to string for select
        detail_thankYouEmailSettings_edit.value = survey.thankYouEmailSettings || '設定なし';

        // Non-editable fields
        const qrUrl = `https://survey.speedad.com/qr/${survey.id}`;
        detail_surveyUrl.value = qrUrl;
        detail_qrCodeImage.src = 'sample_qr.png';

        // --- Reset to View Mode --- 
        setSurveyDetailsMode('view');
    };

    // Initial data fetch and render
    fetchSurveyData().then(data => {
        allSurveyData = data;
        applyFiltersAndPagination();
        console.log("Fetched survey data:", allSurveyData);
        console.log("Current filtered data:", currentFilteredData);
    });
});

        