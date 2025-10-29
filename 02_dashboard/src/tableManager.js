import { showConfirmationModal } from './confirmationModal.js';
import { showToast, copyTextToClipboard, resolveDashboardDataPath, debounce } from './utils.js';
import { handleOpenModal } from './modalHandler.js';
import { populateSurveyDetails } from './surveyDetailsModal.js';
import { openDownloadModal } from './downloadOptionsModal.js';
import { openDuplicateSurveyModal } from './duplicateSurveyModal.js';
import {
    deriveSurveyStatus,
    deriveSurveyLifecycleMeta,
    getStatusSortOrder,
    USER_STATUSES
} from './services/statusService.js';

const surveyTableBody = document.getElementById('surveyTableBody');
let allSurveyData = []; // Stores all fetched survey data
let currentGroupId = null; // Stores the currently selected group ID
let currentFilteredData = []; // Data array: holds filtered and sorted data

let currentPage = 1;
let itemsPerPage = 10; // Default, will be updated from select element

function sanitizeSurveysForDisplay(surveys) {
    if (!Array.isArray(surveys)) return [];
    return surveys.filter((survey) => !HIDDEN_USER_STATUSES.has(getSurveyStatus(survey)));
}

function sortSurveysByIdDesc(surveys) {
    if (!Array.isArray(surveys)) return [];
    return [...surveys].sort((a, b) => {
        const idA = a?.id ?? '';
        const idB = b?.id ?? '';
        if (idA < idB) return 1;
        if (idA > idB) return -1;
        return 0;
    });
}

function shouldSkipInitialSurveyLoad() {
    const status = localStorage.getItem('speedad-tutorial-status');
    return ['pending', 'main-running', 'modal-running'].includes(status);
}
const SURVEY_ID_PATTERN = /^sv_(\d{4})_(\d{2})(\d{3})$/;
const SURVEY_ID_DEFAULT_USER = '0001';
const SURVEY_ID_MAX_SEQUENCE = 999;
const HIDDEN_USER_STATUSES = new Set([USER_STATUSES.DELETED]);


/**
 * 仕様に基づいてアンケートの表示ステータスを決定します。
 * @param {object} survey - アンケートオブジェクト
 * @returns {string} - 表示用のステータス文字列
 */
export function getSurveyStatus(survey, referenceDate) {
    return deriveSurveyStatus(survey, referenceDate);
}



let lastSortedHeader = null; // Tracks the last header clicked for sorting

/**
 * Fetches survey data from a JSON file.
 * @returns {Promise<Array>} A promise that resolves with an array of survey objects.
 */
export async function fetchSurveyData() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');

    try {
        // Statically define the list of surveys to load, as we cannot list directory contents.
        const surveyIds = [
            'sv_0001_25019', 'sv_0001_25020', 'sv_0001_25022', 'sv_0001_25023', 'sv_0001_25024',
            'sv_0001_25025', 'sv_0001_25026', 'sv_0001_25027', 'sv_0001_25028', 'sv_0001_25031',
            'sv_0001_25032', 'sv_0001_25035', 'sv_0001_25039', 'sv_0001_25040', 'sv_0001_25043',
            'sv_0001_25044', 'sv_0001_25045', 'sv_0001_25047', 'sv_0001_25049', 'sv_0001_25050',
            'sv_0001_25051', 'sv_0001_25052', 'sv_0001_25053', 'sv_0001_25054', 'sv_0001_25055',
            'sv_0001_25056', 'sv_0001_25057', 'sv_0001_25058', 'sv_0001_25059', 'sv_0001_25060',
            'sv_0001_25061', 'sv_0001_25062'
        ];
        const surveyPromises = surveyIds.map(id => 
            fetch(resolveDashboardDataPath(`demo_surveys/${id}.json`)).then(res => {
                if (!res.ok) {
                    console.warn(`Could not load survey: ${id}`);
                    return null; // Return null for failed fetches
                }
                return res.json();
            })
        );
        const allSurveys = await Promise.all(surveyPromises);
        return allSurveys.filter(Boolean); // Filter out any null results

    } catch (error) {
        console.error('Error fetching survey data:', error);
        showToast("アンケートデータの取得に失敗しました。", "error");
        return [];
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
    }
}

/**
 * Renders table rows based on the provided survey data.
 * @param {Array} surveysToRender The array of survey objects to display.
 */
function renderTableRows(surveysToRender) {
    if (!surveyTableBody) return;

    surveyTableBody.innerHTML = ''; // Clear existing rows

    if (surveysToRender.length === 0) {
        const noResultsRow = document.createElement('tr');
        noResultsRow.innerHTML = `
            <td colspan="6" class="text-center py-8 text-on-surface-variant">
                <p class="text-lg font-medium">該当するアンケートが見つかりませんでした。</p>
                <p class="text-sm mt-2">検索条件を変更するか、新しいアンケートを作成してください。</p>
            </td>
        `;
        surveyTableBody.appendChild(noResultsRow);
        return;
    }

    const fragment = document.createDocumentFragment();
    const lang = window.getCurrentLanguage();


    surveysToRender.forEach(survey => {
        const row = document.createElement('tr');
        row.className = 'cursor-pointer hover:bg-surface-variant transition-colors';
        row.dataset.id = survey.id;
        const surveyName = (survey.name && typeof survey.name === 'object') ? survey.name[lang] || survey.name.ja : survey.name;
        row.dataset.name = surveyName;
        const lifecycleMeta = deriveSurveyLifecycleMeta(survey);
        const displayStatus = lifecycleMeta.status;
        const statusMeta = lifecycleMeta.statusMeta;

        row.dataset.status = displayStatus;
        row.dataset.periodStart = survey.periodStart;
        row.dataset.periodEnd = survey.periodEnd;
        row.dataset.deadline = lifecycleMeta.downloadDeadlineLabel || survey.deadline || '';
        row.dataset.answerCount = survey.answerCount;
        row.dataset.dataCompletionDate = lifecycleMeta.completionDateLabel || survey.dataCompletionDate || '';
        row.dataset.downloadDeadline = lifecycleMeta.downloadDeadlineLabel || '';
        row.dataset.downloadAvailable = lifecycleMeta.isDownloadable ? 'true' : 'false';

        const statusColorClass = statusMeta.badgeClass;
        const statusTitle = statusMeta.description;

        const realtimeAnswersDisplay = '';

        row.innerHTML = `
            <td data-label="アクション" class="px-4 py-3 whitespace-nowrap actions-cell flex gap-1">
                <button class="bg-secondary-container text-on-secondary-container hover:bg-secondary-container hover:text-on-secondary-container rounded-full p-2 w-9 h-9 transition-all shadow-sm shadow-lg border border-secondary flex items-center justify-center" title="アンケートを編集" aria-label="アンケートを編集"><span class="material-icons text-lg">edit</span></button>
                <button class="bg-secondary-container text-on-secondary-container hover:bg-secondary-container hover:text-on-secondary-container rounded-full p-2 w-9 h-9 transition-all shadow-sm shadow-lg border border-secondary flex items-center justify-center" title="QRコードを表示" aria-label="QRコードを表示"><span class="material-icons text-lg">qr_code_2</span></button>
                <button class="bg-secondary-container text-on-secondary-container hover:bg-secondary-container hover:text-on-secondary-container rounded-full p-2 w-9 h-9 transition-all shadow-sm shadow-lg border border-secondary flex items-center justify-center" title="アンケートを複製" aria-label="アンケートを複製"><span class="material-icons text-lg">content_copy</span></button>
                <button class="bg-secondary-container text-on-secondary-container hover:bg-secondary-container hover:text-on-secondary-container rounded-full p-2 w-9 h-9 transition-all shadow-sm shadow-lg border border-secondary flex items-center justify-center" title="SPEEDレビューを開く" aria-label="SPEEDレビューを開く"><span class="material-icons text-lg">bolt</span></button>
                <button class="bg-secondary-container text-on-secondary-container hover:bg-secondary-container hover:text-on-secondary-container rounded-full p-2 w-9 h-9 transition-all shadow-sm shadow-lg border border-secondary flex items-center justify-center" title="データダウンロード" aria-label="データダウンロード"><span class="material-icons text-lg">download</span></button>
            </td>
            <td data-label="アンケートID" class="px-4 py-3 text-on-surface-variant text-sm font-medium" data-sort-value="${survey.id}">
                ${survey.id}
            </td>
            <td data-label="アンケート名" class="px-4 py-3 text-on-surface text-sm font-medium" data-sort-value="${surveyName}">
                ${surveyName}
            </td>
            <td data-label="ステータス" class="px-4 py-3" data-sort-value="${displayStatus}">
                <span class="inline-flex items-center rounded-full text-xs px-2 py-1 whitespace-nowrap w-auto ${statusColorClass}" title="${statusTitle}">${displayStatus}</span>
            </td>
            <td data-label="回答数" class="px-4 py-3 text-on-surface-variant text-sm" data-sort-value="${survey.answerCount}">
                ${survey.answerCount} ${realtimeAnswersDisplay}
            </td>
            <td data-label="掲載期間" class="px-4 py-3 text-on-surface-variant text-sm" data-sort-value="${survey.periodStart}">
                ${survey.periodStart} ~ ${survey.periodEnd}
            </td>
        `;

        const downloadButton = row.querySelector('button[title="データダウンロード"]');
        if (downloadButton) {
            if (lifecycleMeta.isDownloadable) {
                downloadButton.classList.remove('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                downloadButton.removeAttribute('aria-disabled');
                downloadButton.title = 'データダウンロード';
            } else {
                downloadButton.classList.add('opacity-50', 'pointer-events-none', 'cursor-not-allowed');
                downloadButton.setAttribute('aria-disabled', 'true');
                downloadButton.title = statusTitle;
            }
        }

        fragment.appendChild(row);

        row.querySelector('button[title="アンケートを複製"]').addEventListener('click', (e) => {
            e.stopPropagation();
            const surveyToDuplicate = allSurveyData.find(s => s.id === survey.id);
            if (surveyToDuplicate) {
                openDuplicateSurveyModal(surveyToDuplicate);
            }
        });

        row.querySelector('button[title="SPEEDレビューを開く"]').addEventListener('click', (e) => {
            e.stopPropagation();
            window.location.href = `speed-review.html?surveyId=${survey.id}`;
        });

        if (downloadButton) {
            downloadButton.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!lifecycleMeta.isDownloadable) {
                    showToast('名刺データは現在ダウンロードできません。', 'info');
                    return;
                }
                openDownloadModal('answer', survey.periodStart, survey.periodEnd);
            });
        }

        row.querySelector('button[title="アンケートを編集"]').addEventListener('click', (e) => {
            e.stopPropagation();
            const surveyNameForUrl = encodeURIComponent(surveyName);
            window.location.href = `surveyCreation.html?surveyId=${survey.id}&surveyName=${surveyNameForUrl}`;
        });

        row.querySelector('button[title="QRコードを表示"]').addEventListener('click', (e) => {
            e.stopPropagation();
            handleOpenModal('qrCodeModal', 'modals/qrCodeModal.html');
        });
        
        row.addEventListener('click', (e) => {
            if (e.target.closest('button')) {
                return;
            }
            handleOpenModal('surveyDetailsModal', 'modals/surveyDetailsModal.html')
                .then(() => {
                    populateSurveyDetails(survey);
                })
                .catch(error => console.error("Failed to open survey details modal:", error));
        });
    });

    surveyTableBody.appendChild(fragment);
}

/**
 * Survey ID generation helpers.
 */
function normalizeUserId(rawValue) {
    if (!rawValue) {
        return '';
    }
    const digits = String(rawValue).replace(/\D/g, '');
    if (!digits) {
        return '';
    }
    return digits.slice(-4).padStart(4, '0');
}

function getDatasetUserId() {
    if (typeof document === 'undefined') {
        return '';
    }
    const body = document.body;
    if (body && body.dataset && body.dataset.userId) {
        return body.dataset.userId;
    }
    return '';
}

function getMetaUserId() {
    if (typeof document === 'undefined' || typeof document.querySelector !== 'function') {
        return '';
    }
    const meta = document.querySelector('meta[name="current-user-id"]');
    if (meta && meta.content) {
        return meta.content;
    }
    return '';
}

function getGlobalUserId() {
    if (typeof window === 'undefined') {
        return '';
    }
    if (window.currentUserId) {
        return window.currentUserId;
    }
    if (window.currentUser && window.currentUser.id) {
        return window.currentUser.id;
    }
    if (window.appContext && window.appContext.userId) {
        return window.appContext.userId;
    }
    return '';
}

function resolveActiveUserId(referenceSurveyId = '') {
    const match = SURVEY_ID_PATTERN.exec(referenceSurveyId || '');
    if (match) {
        return match[1];
    }

    const datasetUserId = normalizeUserId(getDatasetUserId());
    if (datasetUserId) {
        return datasetUserId;
    }

    const metaUserId = normalizeUserId(getMetaUserId());
    if (metaUserId) {
        return metaUserId;
    }

    const globalUserId = normalizeUserId(getGlobalUserId());
    if (globalUserId) {
        return globalUserId;
    }

    return SURVEY_ID_DEFAULT_USER;
}

function extractSurveySequenceParts(surveyId) {
    if (typeof surveyId !== 'string') {
        return null;
    }
   
    const match = SURVEY_ID_PATTERN.exec(surveyId);
    if (!match) {
        return null;
    }
    return {
        userId: match[1],
        year: match[2],
        sequence: Number(match[3])
    };
}

function findNextSurveySequence(userId, yearSuffix, referenceParts = null) {
    const usedSequences = new Set();

    if (referenceParts && referenceParts.userId === userId && referenceParts.year === yearSuffix) {
        usedSequences.add(referenceParts.sequence);
    }

    allSurveyData.forEach((survey) => {
        const parts = extractSurveySequenceParts(survey.id);
        if (!parts) {
            return;
        }
        if (parts.userId === userId && parts.year === yearSuffix) {
            usedSequences.add(parts.sequence);
        }
    });

    for (let i = 1; i <= SURVEY_ID_MAX_SEQUENCE; i += 1) {
        if (!usedSequences.has(i)) {
            return String(i).padStart(3, '0');
        }
    }

    showToast('アンケートIDの連番が上限に達しました。管理者にお問い合わせください。', 'error');
    console.error('Survey ID sequence exhausted for user %s and year %s', userId, yearSuffix);
    return '000';
}

/**
 * Generates a new unique survey ID following the SpeedAd rule.
 * @param {string} [referenceSurveyId] Optional existing survey ID used to infer user context.
 * @returns {string} A new survey ID.
 */
function generateNewSurveyId(referenceSurveyId = '') {
    const userId = resolveActiveUserId(referenceSurveyId);
    const now = new Date();
    const yearSuffix = String(now.getFullYear() % 100).padStart(2, '0');
    const referenceParts = extractSurveySequenceParts(referenceSurveyId);
    const sequence = findNextSurveySequence(userId, yearSuffix, referenceParts);
    return `sv_${userId}_${yearSuffix}${sequence}`;
}

/**
 * Duplicates a survey.
 * @param {string} surveyId The ID of the survey to duplicate.
 * @param {string} newName The new name for the duplicated survey.
 * @param {string} newPeriodStart The new start date for the duplicated survey.
 * @param {string} newPeriodEnd The new end date for the duplicated survey.
 */
export function duplicateSurvey(surveyId, newName, newPeriodStart, newPeriodEnd) {
    const surveyToDuplicate = allSurveyData.find(s => s.id === surveyId);
    if (!surveyToDuplicate) {
        showToast('複製対象のアンケートが見つかりません。', 'error');
        return;
    }

    const newSurvey = {
        ...surveyToDuplicate,
        id: generateNewSurveyId(surveyToDuplicate.id),
        name: newName,
        periodStart: newPeriodStart,
        periodEnd: newPeriodEnd,
        status: '会期前',
        answerCount: 0,
        realtimeAnswers: 0,
        // 必要に応じて他のフィールドもリセット・変更
    };

    // Add the new survey to the main data array
    allSurveyData.unshift(newSurvey); // Add to the beginning of the array

    // Re-apply filters and pagination to show the new survey
    applyFiltersAndPagination();

    showToast(`「${newName}」を複製しました。`, 'success');
}

/** Updates the displayed rows and pagination controls. */
function updatePagination() {
    const totalItems = currentFilteredData.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    } else if (totalPages === 0) {
        currentPage = 0;
    } else if (currentPage === 0 && totalPages > 0) {
        currentPage = 1;
    }

    const startIndex = Math.max(0, (currentPage - 1) * itemsPerPage);
    const endIndex = Math.min(totalItems, startIndex + itemsPerPage);
    const surveysForCurrentPage = currentFilteredData.slice(startIndex, endIndex);

    renderTableRows(surveysForCurrentPage);

    // Update Page Info Text
    const pageInfoSpan = document.getElementById('pageInfo');
    if (pageInfoSpan) {
        if (totalItems === 0) {
            pageInfoSpan.textContent = '全 0件';
        } else {
            const displayStart = startIndex + 1;
            const displayEnd = endIndex;
            pageInfoSpan.textContent = `${displayStart} - ${displayEnd} / 全 ${totalItems}件`;
        }
    }
    // Update Pagination Buttons
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    if (prevPageBtn) prevPageBtn.disabled = (currentPage <= 1);
    if (nextPageBtn) nextPageBtn.disabled = (currentPage >= totalPages || totalPages === 0);

    // Render Pagination Numbers
    const paginationNumbersContainer = document.getElementById('pagination-numbers');
    if (!paginationNumbersContainer) return;

    paginationNumbersContainer.innerHTML = ''; // Clear old numbers
    const fragment = document.createDocumentFragment();

    const createPageButton = (pageNumber, isActive = false, isDisabled = false, text = null) => {
        const button = document.createElement(isDisabled ? 'span' : 'button');
        button.className = `flex items-center justify-center w-8 h-8 rounded-full transition-colors text-sm `;
        if (isActive) {
            button.className += 'bg-primary text-on-primary font-bold';
        } else if (isDisabled) {
            button.className += 'text-on-surface-variant';
        } else {
            button.className += 'bg-secondary-container text-on-secondary-container';
        }
        button.textContent = text || pageNumber;
        if (!isDisabled) {
            button.onclick = () => {
                currentPage = pageNumber;
                updatePagination();
            };
        }
        return button;
    };

    if (totalPages <= 7) { // Show all pages if 7 or less
        for (let i = 1; i <= totalPages; i++) {
            fragment.appendChild(createPageButton(i, i === currentPage));
        }
    } else {
        // Always show first page
        fragment.appendChild(createPageButton(1, 1 === currentPage));

        // Logic for ellipses
        if (currentPage > 4) {
            fragment.appendChild(createPageButton(0, false, true, '...'));
        }

        let startPage = Math.max(2, currentPage - 2);
        let endPage = Math.min(totalPages - 1, currentPage + 2);

        if (currentPage <= 4) {
            startPage = 2;
            endPage = 5;
        }
        if (currentPage >= totalPages - 3) {
            startPage = totalPages - 4;
            endPage = totalPages - 1;
        }

        for (let i = startPage; i <= endPage; i++) {
            fragment.appendChild(createPageButton(i, i === currentPage));
        }

        if (currentPage < totalPages - 3) {
            fragment.appendChild(createPageButton(0, false, true, '...'));
        }

        // Always show last page
        fragment.appendChild(createPageButton(totalPages, totalPages === currentPage));
    }

    paginationNumbersContainer.appendChild(fragment);
}

function isValidDate(date) {
    return date instanceof Date && !isNaN(date.getTime());
}

/** Applies filters to `allSurveyData` and updates `currentFilteredData`. */
export function applyFiltersAndPagination() {
    const loadingIndicator = document.getElementById('loading-indicator');
    if (loadingIndicator) loadingIndicator.classList.remove('hidden');

    try {
        const searchKeywordInput = document.getElementById('searchKeyword');
        const filterStatusSelect = document.getElementById('filterStatus');
        const filterStartDateInput = document.getElementById('filterStartDate');
        const filterEndDateInput = document.getElementById('filterEndDate');

        const keyword = searchKeywordInput ? searchKeywordInput.value.toLowerCase() : '';
        const status = filterStatusSelect ? filterStatusSelect.value : 'all';
        const startDateInputVal = filterStartDateInput ? filterStartDateInput.value : '';
        const endDateInputVal = filterEndDateInput ? filterEndDateInput.value : '';

        const startDate = startDateInputVal ? new Date(startDateInputVal) : null;
        const endDate = endDateInputVal ? new Date(endDateInputVal) : null;
        const lang = window.getCurrentLanguage();

        currentFilteredData = allSurveyData.filter(survey => {
            const surveyName = (survey.name && typeof survey.name === 'object') 
                ? (survey.name[lang] || survey.name.ja || '').toLowerCase() 
                : (survey.name || '').toLowerCase();
            
            const displayStatus = getSurveyStatus(survey);
            if (HIDDEN_USER_STATUSES.has(displayStatus)) {
                return false;
            }
            const surveyPeriodStart = survey.periodStart ? new Date(survey.periodStart) : null;
            const surveyPeriodEnd = survey.periodEnd ? new Date(survey.periodEnd) : null;

            const matchesKeyword = keyword === '' || surveyName.includes(keyword);
            const matchesStatus = status === 'all' || displayStatus === status;
            const matchesGroup = currentGroupId === 'personal'
                ? !survey.groupId
                : (currentGroupId === null || survey.groupId === currentGroupId); // グループIDによるフィルタリング
            
            const matchesPeriod = 
                (!startDate || !isValidDate(startDate) || (surveyPeriodStart && surveyPeriodStart >= startDate)) &&
                (!endDate || !isValidDate(endDate) || (surveyPeriodEnd && surveyPeriodEnd <= endDate));
            
            return matchesKeyword && matchesStatus && matchesPeriod && matchesGroup;
        });

        currentPage = 1; // Reset to first page after filtering
        updatePagination(); // Re-render table with filtered data and update pagination
    } finally {
        if (loadingIndicator) {
            setTimeout(() => loadingIndicator.classList.add('hidden'), 100); // 短い遅延を追加してちらつきを軽減
        }
    }
}

export function setGroupFilter(groupId) {
    currentGroupId = groupId;
    applyFiltersAndPagination();
}

export function initTableManager() {
    const searchKeywordInput = document.getElementById('searchKeyword');
    const filterStatusSelect = document.getElementById('filterStatus');
    const filterStartDateInput = document.getElementById('filterStartDate');
    const filterEndDateInput = document.getElementById('filterEndDate');
    const itemsPerPageSelect = document.getElementById('itemsPerPage');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    // Table Sort Logic
    document.querySelectorAll('.sortable-header').forEach(header => {
        header.addEventListener('click', () => {
            const loadingIndicator = document.getElementById('loading-indicator');
            if (loadingIndicator) loadingIndicator.classList.remove('hidden');

            try {
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
                    const lang = window.getCurrentLanguage();
                    let aValue, bValue;

                    // Get values based on sortKey, handling multi-language names
                    if (sortKey === 'name') {
                        aValue = (a.name && typeof a.name === 'object') ? a.name[lang] || a.name.ja || '' : a.name || '';
                        bValue = (b.name && typeof b.name === 'object') ? b.name[lang] || b.name.ja || '' : b.name || '';
                    } else {
                        aValue = a[sortKey];
                        bValue = b[sortKey];
                    }

                    // Type-specific processing
                    if (sortKey === 'status') {
                        aValue = getStatusSortOrder(getSurveyStatus(a)) || 99;
                        bValue = getStatusSortOrder(getSurveyStatus(b)) || 99;
                    } else if (sortKey === 'answerCount') {
                        aValue = parseInt(aValue, 10) || 0;
                        bValue = parseInt(bValue, 10) || 0;
                    } else if (['periodStart', 'deadline', 'dataCompletionDate'].includes(sortKey)) {
                        // Handle invalid dates gracefully for sorting
                        aValue = aValue ? new Date(aValue) : new Date(0);
                        bValue = bValue ? new Date(bValue) : new Date(0);
                    }

                    // Universal comparison logic
                    let result;
                    if (typeof aValue === 'string' && typeof bValue === 'string') {
                        result = aValue.localeCompare(bValue, 'ja', { sensitivity: 'base' });
                    } else {
                        // Handles numbers, dates, and status orders
                        result = (aValue < bValue) ? -1 : ((aValue > bValue) ? 1 : 0);
                    }

                    return sortOrder === 'asc' ? result : -result;
                });

                updatePagination(); // Re-render table with sorted data and update pagination
            } finally {
                if (loadingIndicator) {
                    setTimeout(() => loadingIndicator.classList.add('hidden'), 100);
                }
            }
        });
    });

    // Filter Event Listeners
    if (searchKeywordInput) {
        searchKeywordInput.addEventListener('input', debounce(applyFiltersAndPagination, 300));
    }
    if (filterStatusSelect) filterStatusSelect.addEventListener('change', applyFiltersAndPagination);
    if (filterStartDateInput) filterStartDateInput.addEventListener('change', applyFiltersAndPagination);
    if (filterEndDateInput) filterEndDateInput.addEventListener('change', applyFiltersAndPagination);

    if (resetFiltersButton) {
        resetFiltersButton.addEventListener('click', () => {
            if (searchKeywordInput) searchKeywordInput.value = '';
            if (filterStatusSelect) filterStatusSelect.value = 'all';
            if (filterStartDateInput) filterStartDateInput.value = '';
            if (filterEndDateInput) filterEndDateInput.value = '';
            applyFiltersAndPagination();
            showToast('フィルターをリセットしました', 'info');
        });
    }

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

    // Initial data fetch and render
    if (shouldSkipInitialSurveyLoad()) {
        allSurveyData = [];
        applyFiltersAndPagination();
    } else {
        fetchSurveyData().then(data => {
            const visibleSurveys = sanitizeSurveysForDisplay(data);
            allSurveyData = sortSurveysByIdDesc(visibleSurveys);
            currentFilteredData = [...allSurveyData];
            
            // ソートアイコンを更新
            const idHeader = document.querySelector('.sortable-header[data-sort-key="id"]');
            if (idHeader) {
                idHeader.dataset.sortOrder = 'desc';
                const icon = idHeader.querySelector('.sort-icon');
                if (icon) {
                    icon.textContent = 'arrow_downward';
                    icon.classList.remove('opacity-40');
                    icon.classList.add('opacity-100');
                }
                lastSortedHeader = idHeader;
            }

            applyFiltersAndPagination();
        }).catch(error => {
            console.error("DEBUG: Error during initial data fetch or rendering:", error);
        });
    }
}

export async function reloadSurveyData() {
    const data = await fetchSurveyData();
    const visibleSurveys = sanitizeSurveysForDisplay(data);
    allSurveyData = sortSurveysByIdDesc(visibleSurveys);
    applyFiltersAndPagination();
}

export function updateSurveyData(updatedSurvey) {
    const index = allSurveyData.findIndex(survey => survey.id === updatedSurvey.id);
    if (index !== -1) {
        const mergedSurvey = { ...allSurveyData[index], ...updatedSurvey };
        if (HIDDEN_USER_STATUSES.has(getSurveyStatus(mergedSurvey))) {
            allSurveyData.splice(index, 1);
        } else {
            allSurveyData[index] = mergedSurvey;
        }
    } else if (!HIDDEN_USER_STATUSES.has(getSurveyStatus(updatedSurvey))) {
        allSurveyData.push(updatedSurvey);
    }
    applyFiltersAndPagination(); // Re-apply filters and pagination to update table
}





