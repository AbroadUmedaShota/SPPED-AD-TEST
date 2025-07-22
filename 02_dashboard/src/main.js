import { handleOpenModal, closeModal, openModal } from './modalHandler.js';
import { initTableManager, applyFiltersAndPagination } from './tableManager.js';
import { initSidebarHandler, adjustLayout } from './sidebarHandler.js';
import { initThemeToggle } from './themeToggle.js';
import { openAccountInfoModal } from './accountInfoModal.js';
import { openDuplicateSurveyModal } from './duplicateSurveyModal.js';
import { initBreadcrumbs } from './breadcrumb.js';
import { initBizcardSettings } from './bizcardSettings.js';
import { initThankYouEmailSettings } from './thankYouEmailSettings.js';
import { initSurveyCreation } from './surveyCreation.js';
import { showToast, copyTextToClipboard } from './utils.js';

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

document.addEventListener('DOMContentLoaded', () => {

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
    initSidebarHandler();
    initThemeToggle();
    initBreadcrumbs();

    // Page-specific initializations
    const page = window.location.pathname.split('/').pop();
    switch (page) {
        case 'index.html':
        case '': // root path
            initTableManager();

            // flatpickrの初期化
            flatpickr.localize(flatpickr.l10ns.ja);

            const endDatePicker = flatpickr("#endDatePickerWrapper", {
                wrap: true,
                dateFormat: "Y-m-d",
            });

            const startDatePicker = flatpickr("#startDatePickerWrapper", {
                wrap: true,
                dateFormat: "Y-m-d",
                onChange: function(selectedDates, dateStr, instance) {
                    endDatePicker.set('minDate', dateStr);
                }
            });
            break;
        case 'surveyCreation.html':
            initSurveyCreation();
            break;
        case 'bizcardSettings.html':
            initBizcardSettings();
            break;
        case 'thankYouEmailSettings.html':
            initThankYouEmailSettings();
            break;
    }

    const openNewSurveyModalBtn = document.getElementById('openNewSurveyModalBtn');
    if (openNewSurveyModalBtn) {
        openNewSurveyModalBtn.addEventListener('click', () => {
            handleOpenModal('newSurveyModal', 'modals/newSurveyModal.html', () => {
                const createSurveyBtn = document.getElementById('createSurveyFromModalBtn');
                if (createSurveyBtn) {
                    createSurveyBtn.addEventListener('click', (e) => {
                        e.preventDefault(); // フォームのデフォルト送信を防ぐ
                        window.location.href = 'surveyCreation.html';
                    });
                }
            });
        });
    }

    // Initial layout adjustment on load
    adjustLayout();
    
    // Adjust on window resize
    window.addEventListener('resize', adjustLayout);

    // Update pagination visibility on layout change (after initial data fetch)
    // This might need to be called after fetchSurveyData completes in tableManager
    // For now, calling it here, but consider a callback from tableManager.
    applyFiltersAndPagination();
});
