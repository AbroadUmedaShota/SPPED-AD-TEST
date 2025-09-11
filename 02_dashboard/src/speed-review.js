console.log("SCRIPT LOADED: speed-review.js");

import { speedReviewService } from './services/speedReviewService.js';
import { populateTable, renderModalContent } from './ui/speedReviewRenderer.js';
import { handleOpenModal } from './modalHandler.js';

// --- State ---
let allCombinedData = [];
let currentPage = 1;
let rowsPerPage = 25;
let currentIndustryQuestion = 'Q.02_お客様の主な業界';
let currentSearchTerm = '';
let currentDateFilter = '';
let datePickerInstance = null;
let currentItemInModal = null;
let isModalInEditMode = false;

// --- Functions ---

async function displaySurveyName(surveyId) {
    const surveyNameEl = document.getElementById('review-survey-name');
    if (!surveyNameEl) return;

    if (surveyId === 'SURVEY8j2l0x') {
        surveyNameEl.textContent = `アンケート名: CSVデータからのアンケート`;
        return;
    }

    try {
        const response = await fetch('./data/surveys.json');
        if (!response.ok) {
            throw new Error('Failed to load survey data.');
        }
        const surveys = await response.json();
        const survey = surveys.find(s => s.id === surveyId);
        const surveyName = survey?.name?.ja || '不明なアンケート';
        surveyNameEl.textContent = `アンケート名: ${surveyName}`;
    } catch (error) {
        console.error('Error displaying survey name:', error);
        surveyNameEl.textContent = 'アンケート名の取得に失敗しました';
    }
}

function truncateQuestion(questionText) {
    if (!questionText) {
        return '';
    }
    let truncatedText = questionText.replace(/（.*?）/g, '').replace(/\(.*?\)/g, '');
    if (truncatedText.length > 19) {
        truncatedText = truncatedText.substring(0, 19) + '...';
    }
    return truncatedText;
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
    applyFilters();
}

function handleDetailClick(answerId) {
    const item = allCombinedData.find(data => data.answerId === answerId);
    if (item) {
        currentItemInModal = item;
        isModalInEditMode = false;
        handleOpenModal('reviewDetailModalOverlay', 'modals/reviewDetailModal.html', () => {
            renderModalContent(item, false);
            setupModalEventListeners();
        });
    } else {
        console.warn('Item not found for answerId:', answerId);
    }
}

function setupModalEventListeners() {
    const footer = document.querySelector('#reviewDetailModal .p-4.border-t');
    if (!footer) return;

    // Use event delegation to handle clicks on dynamically added buttons
    footer.addEventListener('click', (e) => {
        if (e.target.id === 'editDetailBtn') {
            handleEditToggle();
        } else if (e.target.id === 'saveDetailBtn') {
            handleSave();
        } else if (e.target.id === 'cancelEditBtn') {
            handleEditToggle(); // Simply toggle back to view mode
        }
    });
}

function handleEditToggle() {
    isModalInEditMode = !isModalInEditMode;
    renderModalContent(currentItemInModal, isModalInEditMode);
    updateModalFooter();
}

function handleSave() {
    if (!isModalInEditMode) return;

    // In a real app, you would collect and validate data.
    // For this demo, we'll just log a success message.
    console.log('Saving data for answerId:', currentItemInModal.answerId);
    alert('データが保存されました。（実際には保存されません）');

    // Revert to view mode
    handleEditToggle();
}

function updateModalFooter() {
    const footer = document.querySelector('#reviewDetailModal .p-4.border-t');
    if (!footer) return;

    if (isModalInEditMode) {
        footer.innerHTML = `
            <button id="cancelEditBtn" class="button-secondary py-2 px-4 rounded-md font-semibold mr-2">キャンセル</button>
            <button id="saveDetailBtn" class="button-primary py-2 px-4 rounded-md font-semibold">保存する</button>
        `;
    } else {
        footer.innerHTML = `
            <button id="editDetailBtn" class="button-secondary py-2 px-4 rounded-md font-semibold">編集する</button>
        `;
    }
}

function handleResetFilters() {
    currentSearchTerm = '';
    currentDateFilter = '';
    const searchInput = document.getElementById('searchKeyword');
    if (searchInput) {
        searchInput.value = '';
    }
    if (datePickerInstance) {
        datePickerInstance.clear();
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
    if (!container || data.length === 0) return;

    const allQuestions = new Set();
    data.forEach(item => {
        if (item.details) {
            item.details.forEach(detail => {
                allQuestions.add(detail.question);
            });
        }
    });

    container.innerHTML = '';
    allQuestions.forEach(question => {
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
                surveyId = 'SURVEY8j2l0x'; // Fallback to default
            }
            window.location.href = `../sample/graph-page.html?surveyId=${surveyId}`;
        });
    }
}

export async function initializePage() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        let surveyId = urlParams.get('surveyId');
        if (!surveyId) {
            surveyId = 'SURVEY8j2l0x';
        }

        await displaySurveyName(surveyId);

        if (surveyId === 'SURVEY8j2l0x') {
            const csvPaths = [
                '../sample/0008000154.csv',
                '../sample/0008000154ncd.csv'
            ];
            const csvData = await speedReviewService.loadAndCombineCsvData(csvPaths);
            allCombinedData = speedReviewService.transformCsvToCombinedData(csvData, surveyId);
        } else {
            await speedReviewService.loadJsonData(
                './data/surveys.json',
                './data/survey-answers.json',
                './data/business-cards.json'
            );
            allCombinedData = await speedReviewService.getCombinedReviewData(surveyId);
        }

        const dynamicHeader = document.getElementById('dynamic-question-header');
        if (dynamicHeader) {
            dynamicHeader.textContent = truncateQuestion(currentIndustryQuestion);
        }

        populateQuestionSelector(allCombinedData);
        displayPage(1, allCombinedData);
        setupEventListeners();

    } catch (error) {
        console.error('SPEEDレビューページの初期化に失敗しました:', error);
        const tableBody = document.getElementById('reviewTableBody');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-error">データの読み込みに失敗しました。</td></tr>`;
        }
    }
}