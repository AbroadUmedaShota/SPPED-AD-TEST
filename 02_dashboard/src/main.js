// Navigation state handling

const INDEX_PAGE_PATHS = new Set(['index.html', '']);
window.__INDEX_PAGE_SEEN = window.__INDEX_PAGE_SEEN || false;

window.addEventListener('pageshow', async () => {
    const page = window.location.pathname.split('/').pop();
    if (INDEX_PAGE_PATHS.has(page)) {
        if (window.__INDEX_PAGE_SEEN) {
            const { reloadSurveyData } = await import('./tableManager.js');
            await reloadSurveyData();
        }
        window.__INDEX_PAGE_SEEN = true;
    }
});
// --- Imports ---


import { handleOpenModal, closeModal, openModal } from './modalHandler.js';
import { initTableManager, applyFiltersAndPagination } from './tableManager.js';
import { initSidebarHandler, adjustLayout } from './sidebarHandler.js';
import { initThemeToggle } from './themeToggle.js';
import { openAccountInfoModal } from './accountInfoModal.js';
import { openDuplicateSurveyModal } from './duplicateSurveyModal.js';
import { initBreadcrumbs } from './breadcrumb.js';
import { initBizcardSettings } from './bizcardSettings.js';
import { initThankYouEmailSettings } from './thankYouEmailSettings.js';
import { initThankYouScreenSettings } from './thankYouScreenSettings.js';
import { initInvoiceListPage } from './invoiceList.js';
import { initInvoiceDetailPage } from './invoiceDetail.js';
import { initIndexPage } from './indexPage.js';
import { initializePage as initSpeedReviewPage } from './speed-review.js'; // Import initializePage from speed-review.js
import { initGroupEditPage } from './groupEdit.js';
import { initPasswordChange } from './password_change.js';

import { showToast, copyTextToClipboard, loadCommonHtml } from './utils.js';

function showTutorialResumeBanner() {
    if (document.getElementById('tutorialResumeBanner')) {
        return;
    }

    const mainContent = document.getElementById('main-content');
    const banner = document.createElement('div');
    banner.id = 'tutorialResumeBanner';
    banner.className = 'mb-6 rounded-xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm';
    banner.innerHTML = `
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div class="text-left">
                <p class="text-base font-semibold text-indigo-900">作成チュートリアルが途中です</p>
                <p class="text-sm text-indigo-900/80 mt-1">前回の続きから再開するか、チュートリアルを終了するか選択してください。</p>
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
                <button type="button" data-action="resume" class="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors">続きから再開</button>
                <button type="button" data-action="dismiss" class="inline-flex items-center justify-center rounded-full border border-indigo-200 px-5 py-2 text-sm font-semibold text-indigo-700 bg-white hover:bg-indigo-50 transition-colors">終了する</button>
            </div>
        </div>
    `;

    if (mainContent) {
        const firstChild = mainContent.firstElementChild;
        if (firstChild) {
            mainContent.insertBefore(banner, firstChild);
        } else {
            mainContent.appendChild(banner);
        }
    } else {
        document.body.insertBefore(banner, document.body.firstChild);
    }

    const resumeBtn = banner.querySelector('[data-action="resume"]');
    const dismissBtn = banner.querySelector('[data-action="dismiss"]');

    if (resumeBtn) {
        resumeBtn.addEventListener('click', () => {
            const params = localStorage.getItem('speedad-tutorial-last-survey-params');
            const targetUrl = params ? `surveyCreation.html?${params}` : 'surveyCreation.html';
            banner.remove();
            localStorage.setItem('speedad-tutorial-status', 'survey-creation-started');
            window.location.href = targetUrl;
        });
    }

    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            localStorage.setItem('speedad-tutorial-status', 'completed');
            localStorage.removeItem('speedad-tutorial-last-survey-params');
            banner.remove();
            showToast('チュートリアルを終了しました', 'info');
        });
    }
}

// --- Language Switcher ---
function initLanguageSwitcher() {
    const languageSwitcherButton = document.getElementById('language-switcher-button');
    const languageSwitcherDropdown = document.getElementById('language-switcher-dropdown');
    const currentLanguageText = document.getElementById('current-language-text');

    if (!languageSwitcherButton || !languageSwitcherDropdown || !currentLanguageText) {
        // Elements might not be present on all pages, so we exit gracefully.
        return;
    }

    const setLanguage = (lang) => {
        localStorage.setItem('language', lang);
        currentLanguageText.textContent = lang === 'ja' ? '日本語' : 'English';
        document.documentElement.lang = lang; // Update the lang attribute of the <html> tag
        
        // Dispatch a custom event to notify other parts of the app
        document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
        
        languageSwitcherDropdown.classList.add('hidden');
    };

    languageSwitcherButton.addEventListener('click', (e) => {
        e.stopPropagation();
        languageSwitcherDropdown.classList.toggle('hidden');
    });

function openNewSurveyModalWithSetup(afterOpen) {
    handleOpenModal('newSurveyModal', 'modals/newSurveyModal.html', () => {
        // Initialize flatpickr for the new range input
        const periodRangePicker = window.flatpickr('#newSurveyPeriodRange', {
            mode: 'range',
            dateFormat: 'Y-m-d',
            locale: 'ja'
        });

        const createSurveyBtn = document.getElementById('createSurveyFromModalBtn');
        if (!createSurveyBtn) {
            if (typeof afterOpen === 'function') {
                afterOpen({ periodRangePicker: null, createSurveyBtn: null });
            }
            return;
        }

        const surveyNameInput = document.getElementById('surveyName');
        const displayTitleInput = document.getElementById('displayTitle');
        const periodRangeInput = document.getElementById('newSurveyPeriodRange');

        const surveyNameError = document.getElementById('surveyName-error');
        const displayTitleError = document.getElementById('displayTitle-error');
        const periodRangeError = document.getElementById('newSurveyPeriodRange-error');

        const inputs = [
            { input: surveyNameInput, error: surveyNameError },
            { input: displayTitleInput, error: displayTitleError },
            { input: periodRangeInput, error: periodRangeError }
        ];

        const hideAllErrors = () => {
            inputs.forEach(({ input, error }) => {
                input.classList.remove('border-red-500');
                error.classList.add('hidden');
                error.textContent = '';
            });
        };

        const showError = (input, error, message) => {
            input.classList.add('border-red-500');
            error.textContent = message;
            error.classList.remove('hidden');
        };

        createSurveyBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent default form submission
            hideAllErrors();
            let isValid = true;

            // Get values
            const surveyName = surveyNameInput.value.trim();
            const displayTitle = displayTitleInput.value.trim();
            const surveyMemo = document.getElementById('surveyMemo').value.trim();
            const fallbackFlatpickr = periodRangeInput && periodRangeInput._flatpickr;
            const selectedDates = Array.isArray(periodRangePicker && periodRangePicker.selectedDates)
                ? periodRangePicker.selectedDates
                : (fallbackFlatpickr && Array.isArray(fallbackFlatpickr.selectedDates) ? fallbackFlatpickr.selectedDates : []);

            // --- Validation ---
            if (!surveyName) {
                showError(surveyNameInput, surveyNameError, 'アンケート名を入力してください。');
                isValid = false;
            }
            if (!displayTitle) {
                showError(displayTitleInput, displayTitleError, '表示タイトルを入力してください。');
                isValid = false;
            }
            if (selectedDates.length < 2) {
                showError(periodRangeInput, periodRangeError, '回答期間を選択してください。');
                isValid = false;
            }

            if (!isValid) {
                return;
            }

            const activePicker = periodRangePicker || fallbackFlatpickr;
            const formatDate = (date) => {
                if (activePicker && typeof activePicker.formatDate === 'function') {
                    return activePicker.formatDate(date, 'Y-m-d');
                }
                const safeDate = date instanceof Date ? date : new Date(date);
                return Number.isNaN(safeDate.getTime()) ? '' : safeDate.toISOString().split('T')[0];
            };

            const surveyStartDate = formatDate(selectedDates[0]);
            const surveyEndDate = formatDate(selectedDates[1]);

            if (!surveyStartDate || !surveyEndDate) {
                showError(periodRangeInput, periodRangeError, '�񓚊��Ԃ�I�����Ă��������B');
                return;
            }

            // Build query parameters
            const params = new URLSearchParams();
            params.set('surveyName', surveyName);
            params.set('displayTitle', displayTitle);
            if (surveyMemo) params.set('memo', surveyMemo);
            params.set('periodStart', surveyStartDate);
            params.set('periodEnd', surveyEndDate);

            // Redirect to the creation page with parameters
            localStorage.setItem('speedad-tutorial-last-survey-params', params.toString());
            window.location.href = `surveyCreation.html?${params.toString()}`;
        });

        if (typeof afterOpen === 'function') {
            afterOpen({ periodRangePicker, createSurveyBtn });
        }
    });
}

window.openNewSurveyModalWithSetup = openNewSurveyModalWithSetup;

    document.addEventListener('click', () => {
        if (!languageSwitcherDropdown.classList.contains('hidden')) {
            languageSwitcherDropdown.classList.add('hidden');
        }
    });

    languageSwitcherDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        const target = e.target.closest('a[data-lang]');
        if (target) {
            const lang = target.getAttribute('data-lang');
            setLanguage(lang);
        }
    });

    // Set initial language from storage or default to Japanese
    const currentLang = localStorage.getItem('language') || 'ja';
    setLanguage(currentLang);
}

window.getCurrentLanguage = () => {
    return localStorage.getItem('language') || 'ja';
};


// script.js の最上部に移動 (DOMContentLoadedイベントリスナーの外側)
// ダミーユーザーデータ (本来はAPIから取得)
// windowオブジェクトにアタッチすることで、HTMLのonclickから参照可能にする



// Expose functions to global scope if needed by inline HTML (e.g., onclick attributes)
window.handleOpenModal = handleOpenModal;
window.openAccountInfoModal = openAccountInfoModal;
window.openDuplicateSurveyModal = openDuplicateSurveyModal;
window.showToast = showToast;
window.closeModal = closeModal;
window.openModal = openModal;
window.copyUrl = async function(inputElement) {
    if (inputElement && inputElement.value) {
        await copyTextToClipboard(inputElement.value);
    }
};
// チュートリアル関数をグローバルに公開
window.startSurveyCreationTutorial = () => {
    // この関数は surveyCreationTutorial.js で上書きされる
    console.log('startSurveyCreationTutorial called from placeholder');
};

document.addEventListener('DOMContentLoaded', async () => {

    // 共通要素の読み込み（動的パス解決）
    await loadCommonHtml('header-placeholder', 'common/header.html');
    await loadCommonHtml('sidebar-placeholder', 'common/sidebar.html', initSidebarHandler);
    await loadCommonHtml('footer-placeholder', 'common/footer.html');

    // Initialize the language switcher after the header is loaded
    initLanguageSwitcher();

    const currentPage = window.location.pathname.split('/').pop() || '';
    const isIndexPage = currentPage === '' || currentPage === 'index.html';

    // Check for tutorial status AFTER common elements are loaded
    let tutorialStatus = localStorage.getItem('speedad-tutorial-status');

    if (tutorialStatus === 'main-running' || tutorialStatus === 'modal-running') {
        localStorage.setItem('speedad-tutorial-status', 'pending');
        tutorialStatus = 'pending';
    }

    if (tutorialStatus === 'pending' && isIndexPage) {
        if (typeof startTutorial === 'function') {
            startTutorial();
        }
    } else if (tutorialStatus === 'survey-creation-started' && isIndexPage) {
        showTutorialResumeBanner();
    }

    // --- Global Escape Key Listener for Modals & Sidebar ---
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            // Close all open modals
            document.querySelectorAll('.modal-overlay[data-state="open"]').forEach(modal => {
                closeModal(modal.id);
            });
            // Close mobile sidebar if open
            const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
            if (mobileSidebarOverlay && mobileSidebarOverlay.classList.contains('is-visible')) {
                // Assuming toggleMobileSidebar is exported from sidebarHandler
                // and accessible here, or re-import it.
                // For now, directly manipulate classes as a fallback if not imported.
                const sidebar = document.getElementById('sidebar');
                if (sidebar) {
                    sidebar.classList.remove('is-open-mobile');
                    mobileSidebarOverlay.classList.remove('is-visible');
                }
            }
        }
    });

    // Initialize common modules
    initThemeToggle();
    initBreadcrumbs();

    // Page-specific initializations
    switch (currentPage) {
        case 'index.html':
        case '': // root path
            initIndexPage();
            break;
        case 'invoiceList.html':
            initInvoiceListPage();
            break;
        case 'bizcardSettings.html':
            initBizcardSettings();
            break;
        case 'thankYouEmailSettings.html':
            initThankYouEmailSettings();
            break;
        case 'thankYouScreenSettings.html':
            initThankYouScreenSettings();
            break;
        case 'invoice-detail.html':
            initInvoiceDetailPage();
            break;
        case 'speed-review.html':
            initSpeedReviewPage(); // Call the imported function
            break;
        case 'group-edit.html':
            initGroupEditPage();
            break;
        case 'password_change.html':
            initPasswordChange();
            break;
        
    }




    const openNewSurveyModalBtn = document.getElementById('openNewSurveyModalBtn');
    if (openNewSurveyModalBtn) {
        openNewSurveyModalBtn.addEventListener('click', openNewSurveyModalWithSetup);
    }

    // Initial layout adjustment on load
    adjustLayout();

    // Adjust on window resize
    window.addEventListener('resize', adjustLayout);

});
