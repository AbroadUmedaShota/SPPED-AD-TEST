import { handleOpenModal, closeModal } from './modalHandler.js';
import { resolveDashboardAssetPath } from './utils.js';

/**
 * Displays a confirmation modal and executes a callback on confirmation.
 * @param {string} message The message to display in the modal.
 * @param {function} onConfirm The callback function to execute if the user confirms.
 * @param {object} [options] Optional parameters.
 * @param {string} [options.title='確認'] The title of the modal.
 * @param {string} [options.confirmText='実行'] The text for the confirm button.
 * @param {string} [options.cancelText='キャンセル'] The text for the cancel button.
 * @param {boolean} [options.defaultCancel=true] If true, the cancel button is focused by default.
 */
export function showConfirmationModal(message, onConfirm, options = {}) {
    const {
        title = '確認',
        confirmText = '実行',
        cancelText = 'キャンセル',
        defaultCancel = true,
        prompt = null // New option for input field
    } = options;

    handleOpenModal('confirmationModal', resolveDashboardAssetPath('modals/confirmationModal.html'))
        .then(() => {
            const modal = document.getElementById('confirmationModal');
            console.log('ConfirmationModal: Entering then block after modal opened.');
            console.log('ConfirmationModal: Modal element retrieved:', modal);
            if (modal) {
                console.log('ConfirmationModal: Modal innerHTML:', modal.innerHTML);
            }
            if (!modal) {
                throw new Error('Confirmation modal element not found in DOM after handleOpenModal resolved.');
            }
            // 変数宣言を一度にまとめる
            const titleEl = modal.querySelector('#confirmationModalTitle');
            const messageEl = modal.querySelector('#confirmationModalMessage');
            const inputContainer = modal.querySelector('#confirmationModalInputContainer');
            const confirmBtn = modal.querySelector('#confirmActionButton');
            const cancelBtn = modal.querySelector('[data-action="close"]');
            const closeBtn = modal.querySelector('#closeConfirmationModalBtn');

            console.log('ConfirmationModal: inputContainer element:', inputContainer);
            console.log('ConfirmationModal: prompt option received:', options.prompt);

            if (!confirmBtn || !cancelBtn) {
                throw new Error('Confirmation modal confirm or cancel buttons not found within the modal element.');
            }

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;
            if (confirmBtn) confirmBtn.textContent = confirmText;
            if (cancelBtn) cancelBtn.textContent = cancelText;

            // --- Prompt/Input Field Logic ---
            let inputEl = null;
            if (inputContainer) {
                inputContainer.innerHTML = ''; // Clear previous content
                if (prompt) {
                    console.log(`[confirmationModal] Prompt type detected: ${prompt.type}`);
                    if (prompt.type === 'select') {
                        inputContainer.innerHTML = `
                            <div class="input-group">
                                <select id="confirmationModalInput" class="input-field">
                                    ${prompt.options || ''}
                                </select>
                                <label class="input-label" for="confirmationModalInput">${prompt.label || ''}</label>
                            </div>
                        `;
                    } else {
                        inputContainer.innerHTML = `
                            <div class="input-group">
                                <input type="${prompt.type || 'text'}" id="confirmationModalInput" class="input-field" placeholder=" " required>
                                <label class="input-label" for="confirmationModalInput">${prompt.label || ''}</label>
                            </div>
                        `;
                    }
                    console.log(`[confirmationModal] inputContainer innerHTML after prompt generation:`, inputContainer.innerHTML);
                    inputEl = document.getElementById('confirmationModalInput');
                    console.log(`[confirmationModal] inputEl (confirmationModalInput) after getElementById:`, inputEl);
                }
            }
            // --- End Prompt Logic ---

            const newConfirmBtn = confirmBtn.cloneNode(true);
            confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

            let observer;
            const cleanup = () => {
                document.removeEventListener('keydown', handleKeyDown);
                if (observer) observer.disconnect();
            };

            const confirmAndClose = () => {
                console.log('Confirmation confirmed and closing modal.'); // デバッグ用ログ
                const inputValue = inputEl ? inputEl.value : null;
                onConfirm(inputValue); // Pass input value to callback
                closeModal('confirmationModal');
                cleanup();
            };

            const cancelAction = () => {
                console.log('Confirmation cancelled and closing modal.'); // デバッグ用ログ
                closeModal('confirmationModal');
                cleanup();
            };

            newConfirmBtn.addEventListener('click', confirmAndClose);
            newCancelBtn.addEventListener('click', cancelAction);
            if (closeBtn) {
                closeBtn.addEventListener('click', cancelAction);
            }

            if (inputEl) {
                inputEl.focus();
            } else if (defaultCancel) {
                newCancelBtn.focus();
            } else {
                newConfirmBtn.focus();
            }

            const handleKeyDown = (event) => {
                if (event.key === 'Enter' && (inputEl === document.activeElement || newConfirmBtn === document.activeElement)) {
                    event.preventDefault();
                    confirmAndClose();
                } else if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelAction();
                }
            };

            document.addEventListener('keydown', handleKeyDown);

            observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.attributeName === 'data-state' && modal.dataset.state === 'closed') {
                        cleanup();
                    }
                });
            });
            observer.observe(modal, { attributes: true });
        })
        .catch(error => {
            console.error('Error opening confirmation modal:', error);
        });
}