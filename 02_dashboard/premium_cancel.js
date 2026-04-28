document.addEventListener('DOMContentLoaded', () => {
    // --- Survey Logic ---
    const cancelForm = document.getElementById('cancel-form');
    const radioButtons = document.querySelectorAll('input[name="cancelReason"]');
    const otherReasonContainer = document.getElementById('other-reason-container');
    const otherReasonTextarea = document.getElementById('otherReasonDetail');

    if (cancelForm) {
        radioButtons.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'other') {
                    otherReasonContainer.classList.remove('hidden');
                    otherReasonTextarea.focus();
                } else {
                    otherReasonContainer.classList.add('hidden');
                }
            });
        });
    }

    // --- Dynamic Date Display ---
    const now = new Date();
    // Calculate the last day of the current month
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const formattedDate = `${endOfMonth.getFullYear()}年${endOfMonth.getMonth() + 1}月${endOfMonth.getDate()}日`;
    const expiryDateElements = document.querySelectorAll('#premium-expiry-date, [data-role="premium-expiry-date"]');
    expiryDateElements.forEach(element => {
        element.textContent = formattedDate;
    });

    // --- Cancel Confirmation Modal Logic ---
    const cancelConfirmationModal = document.getElementById('cancelConfirmationModal');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const cancelCancelBtn = document.getElementById('cancel-cancel-btn');
    const cancelButton = document.getElementById('cancel-button'); // "自動更新の停止へ進む" button
    let activeModal = null;
    let lastFocusedElement = null;

    const getFocusableElements = (modal) => Array.from(modal.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => element.offsetParent !== null || element === document.activeElement);

    function handleModalKeydown(event) {
        if (!activeModal) return;

        if (event.key === 'Escape') {
            closeCancelConfirmationModal();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusableElements = getFocusableElements(activeModal);
        if (!focusableElements.length) {
            event.preventDefault();
            return;
        }

        const firstFocusableElement = focusableElements[0];
        const lastFocusableElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === firstFocusableElement) {
            event.preventDefault();
            lastFocusableElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
            event.preventDefault();
            firstFocusableElement.focus();
        }
    }

    function activateModalFocus(modal, initialFocusElement = null) {
        activeModal = modal;
        lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        document.addEventListener('keydown', handleModalKeydown);
        const focusTarget = initialFocusElement || getFocusableElements(modal)[0] || modal;
        if (focusTarget === modal) {
            modal.setAttribute('tabindex', '-1');
        }
        setTimeout(() => focusTarget.focus(), 0);
    }

    function deactivateModalFocus(modal) {
        if (activeModal !== modal) return;
        activeModal = null;
        document.removeEventListener('keydown', handleModalKeydown);
        if (lastFocusedElement && document.contains(lastFocusedElement) && lastFocusedElement.offsetParent !== null) {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    }

    // Function to open modal
    function openCancelConfirmationModal() {
        if (cancelConfirmationModal) {
            cancelConfirmationModal.classList.remove('hidden');
            // Force reflow
            void cancelConfirmationModal.offsetWidth;
            cancelConfirmationModal.classList.remove('opacity-0');
            const modalContent = cancelConfirmationModal.querySelector('#cancel-confirmation-content');
            if (modalContent) {
                modalContent.classList.remove('scale-95');
                modalContent.classList.add('scale-100');
            }
            activateModalFocus(cancelConfirmationModal, cancelCancelBtn);
        }
    }

    // Function to close modal
    function closeCancelConfirmationModal() {
        if (cancelConfirmationModal) {
            cancelConfirmationModal.classList.add('opacity-0');
            const modalContent = cancelConfirmationModal.querySelector('#cancel-confirmation-content');
            if (modalContent) {
                modalContent.classList.remove('scale-100');
                modalContent.classList.add('scale-95');
            }
            setTimeout(() => {
                cancelConfirmationModal.classList.add('hidden');
                deactivateModalFocus(cancelConfirmationModal);
            }, 300); // Wait for transition
        }
    }

    // "自動更新の停止へ進む" button click event
    if (cancelButton) {
        cancelButton.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent immediate form submission
            openCancelConfirmationModal();
        });
    }

    // Modal: "解約を確定する" button click
    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => {
            // Collect survey data (optional)
            const selectedReason = document.querySelector('input[name="cancelReason"]:checked');
            const reasonValue = selectedReason ? selectedReason.value : 'no_reason';
            const otherDetail = reasonValue === 'other' ? otherReasonTextarea.value : '';

            console.log('Cancellation Reason:', reasonValue);
            if (reasonValue === 'other') {
                console.log('Other Detail:', otherDetail);
            }

            // Verify: Update localStorage to reflect cancellation for simulation
            const storedData = localStorage.getItem('simulationUserData');
            const userData = storedData ? JSON.parse(storedData) : {};
            userData.is_premium_member = true;
            userData.is_cancelled = true;
            userData.is_free_trial = false;
            localStorage.setItem('simulationUserData', JSON.stringify(userData));
            localStorage.setItem('currentScenario', 'premium-cancelled');

            // Simulate API call or form submission
            // Here we just redirect to the complete page
            closeCancelConfirmationModal();
            window.location.href = 'premium_cancel_complete.html';
        });
    }

    // Modal: "キャンセル" button click
    if (cancelCancelBtn) {
        cancelCancelBtn.addEventListener('click', closeCancelConfirmationModal);
    }

    // Close modal on outside click
    if (cancelConfirmationModal) {
        cancelConfirmationModal.addEventListener('click', (event) => {
            if (event.target === cancelConfirmationModal) {
                closeCancelConfirmationModal();
            }
        });
    }
});
