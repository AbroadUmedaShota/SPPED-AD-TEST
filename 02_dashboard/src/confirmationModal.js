import { handleOpenModal, closeModal } from './modalHandler.js';

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

    handleOpenModal('confirmationModal', 'modals/confirmationModal.html')
        .then(() => {
            const modal = document.getElementById('confirmationModal');
            const titleEl = document.getElementById('confirmationModalTitle');
            const messageEl = document.getElementById('confirmationModalMessage');
            const inputContainer = document.getElementById('confirmationModalInputContainer');
            const confirmBtn = document.getElementById('confirmationModalConfirmBtn');
            const cancelBtn = document.getElementById('confirmationModalCancelBtn');
            const closeBtn = document.getElementById('closeConfirmationModalBtn');

            if (titleEl) titleEl.textContent = title;
            if (messageEl) messageEl.textContent = message;
            if (confirmBtn) confirmBtn.textContent = confirmText;
            if (cancelBtn) cancelBtn.textContent = cancelText;

            // --- Prompt/Input Field Logic ---
            let inputEl = null;
            if (inputContainer) {
                inputContainer.innerHTML = ''; // Clear previous content
                if (prompt) {
                    inputContainer.innerHTML = `
                        <div class="input-group">
                            <input type="${prompt.type || 'text'}" id="confirmationModalInput" class="input-field" placeholder=" " required>
                            <label class="input-label" for="confirmationModalInput">${prompt.label || ''}</label>
                        </div>
                    `;
                    inputEl = document.getElementById('confirmationModalInput');
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
                const inputValue = inputEl ? inputEl.value : null;
                onConfirm(inputValue); // Pass input value to callback
                closeModal('confirmationModal');
                cleanup();
            };

            const cancelAction = () => {
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