import { lockScroll, unlockScroll, showToast } from './utils.js';
import { initializeAccountInfoModalFunctionality, populateAccountInfoModal } from './accountInfoModal.js';
import { setupSurveyDetailsModalListeners, populateSurveyDetails } from './surveyDetailsModal.js';
import { initGroupManagementModal } from './groupManagementModal.js';
import { setupQrCodeModalListeners } from './qrCodeModal.js';



/**
 * Loads a modal's HTML content from a file and appends it to the body.
 * Prevents loading the same modal multiple times.
 * @param {string} modalId The ID of the modal element.
 * @param {string} filePath The path to the modal's HTML file.
 * @returns {Promise<void>} A promise that resolves when the modal is loaded.
 */
async function loadModalFromFile(modalId, filePath) {
    const cacheBustedFilePath = `${filePath}?v=${new Date().getTime()}`; // キャッシュ busting を追加
    console.log(`[modalHandler] loadModalFromFile: Attempting to load modalId: ${modalId} from cache-busted filePath: ${cacheBustedFilePath}`);
    try {
        const response = await fetch(cacheBustedFilePath, { cache: "no-store" });
        if (!response.ok) {
            throw new Error(`Failed to load modal from ${cacheBustedFilePath}: HTTP status ${response.status} (${response.statusText})`);
        }
        const modalHtml = await response.text();
        console.log(`[modalHandler] loadModalFromFile: Fetched modalHtml for ${modalId}:\n`, modalHtml);

        let processedModalHtml = modalHtml;
        if (modalId === 'confirmationModal' && !modalHtml.includes('id="confirmationModalInputContainer"')) {
            // 強制的に inputContainer を挿入する (Webサーバーが古いHTMLを配信し続ける場合の回避策)
            const messageTag = '<p id="confirmationModalMessage" class="text-on-surface-variant">';
            const messageTagEnd = '</p>';
            const inputContainerDiv = '<div id="confirmationModalInputContainer" class="mt-4"></div>';

            const messageEndIndex = processedModalHtml.indexOf(messageTagEnd, processedModalHtml.indexOf(messageTag));
            if (messageEndIndex !== -1) {
                processedModalHtml = processedModalHtml.slice(0, messageEndIndex + messageTagEnd.length) +
                                     inputContainerDiv +
                                     processedModalHtml.slice(messageEndIndex + messageTagEnd.length);
                console.warn('[modalHandler] loadModalFromFile: Forced insertion of #confirmationModalInputContainer due to mismatched HTML from server.');
            }
        }
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = processedModalHtml;
        const modalElement = tempDiv.firstElementChild; // Get the root element of the modal

        if (modalElement && modalElement.id === modalId) {
            document.body.appendChild(modalElement);
            console.log(`[modalHandler] loadModalFromFile: Modal ${modalId} appended to body.`);
            attachModalEventListeners(modalElement);

            if (modalId === 'accountInfoModal') {
                initializeAccountInfoModalFunctionality(modalElement); 
            }
            if (modalId === 'surveyDetailsModal'){
                setupSurveyDetailsModalListeners(modalElement);
            }
            if (modalId === 'newGroupModal') {
                initGroupManagementModal(modalElement);
            }
            if (modalId === 'qrCodeModal') {
                setupQrCodeModalListeners(modalElement);
            }
            if (modalId === 'newSurveyModal') {
                const closeBtn = modalElement.querySelector('#closeNewSurveyModalBtn');
                const cancelBtn = modalElement.querySelector('#cancelNewSurveyModalBtn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => closeModal(modalId));
                }
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => closeModal(modalId));
                }
            }
            if (modalId === 'newCouponModal') {
                const closeBtn = modalElement.querySelector('#closeNewCouponModalBtn');
                const cancelBtn = modalElement.querySelector('#cancelNewCouponModalBtn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => closeModal(modalId));
                }
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => closeModal(modalId));
                }
            }
            if (modalId === 'couponDetailModal') {
                const closeBtn = modalElement.querySelector('#closeCouponDetailModalBtn');
                const cancelBtn = modalElement.querySelector('#closeDetailModalBtn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => closeModal(modalId));
                }
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => closeModal(modalId));
                }
            }
            if (modalId === 'editCouponModal') {
                const closeBtn = modalElement.querySelector('#closeEditCouponModalBtn');
                const cancelBtn = modalElement.querySelector('#cancelEditCouponModalBtn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => closeModal(modalId));
                }
                if (cancelBtn) {
                    cancelBtn.addEventListener('click', () => closeModal(modalId));
                }
            }
            if (modalId === 'reviewDetailModalOverlay') {
                const closeBtn = modalElement.querySelector('#closeDetailModalBtn');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => closeModal(modalId));
                }
            }



        } else {
            console.error(`[modalHandler] loadModalFromFile: Error: Modal ID mismatch or invalid HTML structure for ${modalId} from ${filePath}.`);
            showToast(`モーダル (${modalId}) のHTML構造が不正です。`, "error");
        }
    } catch (error) {
        console.error(`[modalHandler] loadModalFromFile: Error loading modal ${modalId} from ${filePath}:`, error);
        showToast(`モーダル (${modalId}) の読み込みに失敗しました。ファイルパスを確認してください。`, "error");
        throw error;
    }
}

/**
 * Attaches common event listeners to a modal overlay for closing.
 * @param {HTMLElement} modalElement The root element of the modal overlay.
 */
function attachModalEventListeners(modalElement) {
    const modalId = modalElement.id;

    // Close when clicking the background overlay
    modalElement.addEventListener('click', (e) => {
        if (e.target === modalElement) {
            console.log(`[modalHandler] attachModalEventListeners: Overlay clicked for ${modalId}.`);
            closeModal(modalId);
        }
    });

    // Find and attach listeners to all close buttons within the modal
    const closeButtons = modalElement.querySelectorAll(`[data-modal-close="${modalId}"]`);
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            console.log(`[modalHandler] attachModalEventListeners: Close button clicked for ${modalId}.`);
            closeModal(modalId);
        });
    });
}

/**
 * Initializes floating label behavior for input fields within a newly loaded modal.
 * This function is now empty as the logic is handled by CSS.
 */
export function initializeFloatingLabelsForModal(containerElement) {
    // This function is now empty as the logic is handled by CSS.
}


/**
 * Handles opening a modal, loading it first if necessary.
 * @param {string} modalId The ID of the modal element to open.
 * @param {string} filePath The path to the modal's HTML file.
 * @param {Function} [callback] An optional callback function to execute after the modal is opened.
 */
export async function handleOpenModal(modalId, filePath, callback) {
    console.log(`[modalHandler] handleOpenModal: Attempting to open modalId: ${modalId}`);
    const openAndCallback = async () => {
        console.log(`[modalHandler] handleOpenModal: Calling openModal for ${modalId}`);
        await openModal(modalId); // Wait for the modal to be fully ready
        if (callback && typeof callback === 'function') {
            console.log(`[modalHandler] handleOpenModal: Executing callback for ${modalId}`);
            callback(); // This is now called at the correct time
        }
        console.log(`[modalHandler] handleOpenModal: Finished openAndCallback for ${modalId}`);
    };

    try {
        // Check if modal already exists to prevent duplicates
        if (!document.getElementById(modalId)) {
            console.log(`[modalHandler] handleOpenModal: Modal ${modalId} does not exist, loading from file.`);
            await loadModalFromFile(modalId, filePath);
        } else {
            console.log(`[modalHandler] handleOpenModal: Modal ${modalId} already exists in DOM.`);
        }
        await openAndCallback();
    } catch (error) {
        console.error(`[modalHandler] handleOpenModal: Error in process for ${modalId}:`, error);
        // Error is handled in loadModalFromFile
    }
}

/**
 * Opens a modal window and returns a promise that resolves when it's ready.
 * @param {string} modalId The ID of the modal element to open.
 * @returns {Promise<void>}
 */
export function openModal(modalId) {
    console.log(`[modalHandler] openModal: Attempting to open modalId: ${modalId}`);
    return new Promise((resolve) => {
        const modal = document.getElementById(modalId);
        if (modal) {
            console.log(`[modalHandler] openModal: Modal ${modalId} found. Current classes: ${modal.className}`);
            // モーダルを実際に表示するために、非表示に関するクラスを削除する
            modal.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
            // 必要に応じて、表示状態を示すクラスを追加する（例: 'opacity-100', 'pointer-events-auto'）
            // 現在のHTMLのクラスに 'flex' があるため、'flex' は残しておく
            modal.classList.add('opacity-100', 'pointer-events-auto');
            console.log(`[modalHandler] openModal: Removed 'hidden', 'opacity-0', 'pointer-events-none' classes from ${modalId}. New classes: ${modal.className}`);
            requestAnimationFrame(() => {
                modal.dataset.state = 'open';
                console.log(`[modalHandler] openModal: Set data-state='open' for ${modalId}.`);
                // Resolve the promise AFTER the state is set
                resolve();
                console.log(`[modalHandler] openModal: Promise resolved for ${modalId}.`);
            });
            lockScroll();
            console.log(`[modalHandler] openModal: Scroll locked for ${modalId}.`);

            // Ensure mobile sidebar overlay is hidden when a modal opens
            const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
            if (mobileSidebarOverlay) {
                mobileSidebarOverlay.classList.remove('is-visible');
                console.log(`[modalHandler] openModal: Mobile sidebar overlay hidden.`);
            }

            // Specific handler for newSurveyModal to set default dates
            if (modalId === 'newSurveyModal') {
                const today = new Date();
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);

                const surveyStartDateInput = document.getElementById('surveyStartDate');
                const surveyEndDateInput = document.getElementById('surveyEndDate');

                const getFormattedDate = (date) => {
                    const year = date.getFullYear();
                    const month = (date.getMonth() + 1).toString().padStart(2, '0');
                    const day = date.getDate().toString().padStart(2, '0');
                    return `${year}-${month}-${day}`;
                };

                if (surveyStartDateInput) {
                    surveyStartDateInput.value = getFormattedDate(tomorrow);
                }
                if (surveyEndDateInput) {
                    const oneWeekLater = new Date(tomorrow);
                    oneWeekLater.setDate(tomorrow.getDate() + 7);
                    surveyEndDateInput.value = getFormattedDate(oneWeekLater);
                }
                console.log(`[modalHandler] openModal: Handled default dates for newSurveyModal.`);
            }
        } else {
            // If modal doesn't exist, resolve immediately to not hang forever
            console.error(`[modalHandler] openModal: Modal with ID ${modalId} not found.`);
            resolve(); // IMPORTANT: resolve even if not found to avoid blocking
        }
    });
}

/**
 * Closes a modal window.
 * @param {string} modalId The ID of the modal element to close.
 */
export function closeModal(modalId) {
    console.log(`[modalHandler] closeModal: Attempting to close modalId: ${modalId}`);
    const modal = document.getElementById(modalId);
    
    if (modal) {
        modal.dataset.state = 'closed';
        modal.classList.add('opacity-0', 'pointer-events-none'); // 閉じる時にクラスを追加
        modal.classList.remove('opacity-100', 'pointer-events-auto'); // 開く時に追加したクラスを削除
        const modalContent = modal.querySelector('.modal-content-transition');
        if (modalContent) {
            modalContent.dataset.state = 'closed';
        }

        unlockScroll();
        console.log(`[modalHandler] closeModal: Scroll unlocked for ${modalId}.`);

        // Explicitly reset body styles in case of lingering effects
        document.body.style.backgroundColor = '';
        document.body.style.opacity = '';
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        console.log(`[modalHandler] closeModal: Body styles reset for ${modalId}.`);

        // Ensure mobile sidebar overlay is hidden when a modal closes
        const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
        if (mobileSidebarOverlay) {
            mobileSidebarOverlay.classList.remove('is-visible');
            mobileSidebarOverlay.dataset.state = 'closed'; // Explicitly set data-state
            console.log(`[modalHandler] closeModal: Mobile sidebar overlay hidden.`);
            
        }

        // Wait for the opacity transition to complete before removing from DOM
        modal.addEventListener('transitionend', (e) => {
            
            if (e.propertyName === 'opacity' || (e.target === modal && e.propertyName === 'transform')) { // Added transform check
                console.log(`[modalHandler] closeModal: Transition ended for ${modalId}. Removing modal from DOM.`);
                modal.remove();
                
            }
        }, { once: true });
    } else {
        console.warn(`[modalHandler] closeModal: Modal with ID ${modalId} not found in DOM.`);
    }
}