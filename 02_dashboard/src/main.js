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
import { initInvoiceListPage } from './invoiceList.js';
import { initIndexPage } from './indexPage.js';
import { initializePage as initSpeedReviewPage } from './speed-review.js'; // Import initializePage from speed-review.js
import { initGroupEditPage } from './group-edit/group-edit.js';

import { showToast, copyTextToClipboard, loadCommonHtml } from './utils.js';

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

document.addEventListener('DOMContentLoaded', async () => {

    // 共通要素の読み込み（動的パス解決）
    await loadCommonHtml('header-placeholder', 'common/header.html');
    await loadCommonHtml('sidebar-placeholder', 'common/sidebar.html', initSidebarHandler);
    await loadCommonHtml('footer-placeholder', 'common/footer.html');

    // Initialize the language switcher after the header is loaded
    initLanguageSwitcher();

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
    const page = window.location.pathname.split('/').pop();
    switch (page) {
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
        case 'speed-review.html':
            initSpeedReviewPage(); // Call the imported function
            break;
        case 'group-edit.html':
            initGroupEditPage();
            break;
        
    }

    // Initialize page-specific settings functions after DOM is fully loaded
    if (page === 'bizcardSettings.html') {
        initBizcardSettings();
    } else if (page === 'thankYouEmailSettings.html') {
        initThankYouEmailSettings();
    }

    const openNewSurveyModalBtn = document.getElementById('openNewSurveyModalBtn');
    if (openNewSurveyModalBtn) {
        openNewSurveyModalBtn.addEventListener('click', () => {
            handleOpenModal('newSurveyModal', 'modals/newSurveyModal.html', () => {
                const createSurveyBtn = document.getElementById('createSurveyFromModalBtn');
                if (createSurveyBtn) {
                    createSurveyBtn.addEventListener('click', (e) => {
                        e.preventDefault(); // Prevent default form submission

                        // Get values from the modal form
                        const surveyName = document.getElementById('surveyName').value;
                        const displayTitle = document.getElementById('displayTitle').value;
                        const surveyMemo = document.getElementById('surveyMemo').value;
                        const surveyStartDate = document.getElementById('surveyStartDate').value;
                        const surveyEndDate = document.getElementById('surveyEndDate').value;

                        // Build query parameters
                        const params = new URLSearchParams();
                        if (surveyName) params.set('surveyName', surveyName);
                        if (displayTitle) params.set('displayTitle', displayTitle);
                        if (surveyMemo) params.set('memo', surveyMemo);
                        if (surveyStartDate) params.set('periodStart', surveyStartDate);
                        if (surveyEndDate) params.set('periodEnd', surveyEndDate);

                        // Redirect to the creation page with parameters
                        window.location.href = `surveyCreation.html?${params.toString()}`;
                    });
                }
            });
        });
    }

    // Initial layout adjustment on load
    adjustLayout();

    // Adjust on window resize
    window.addEventListener('resize', adjustLayout);

});
