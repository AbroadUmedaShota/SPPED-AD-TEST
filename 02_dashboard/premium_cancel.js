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
    const expiryDateElement = document.getElementById('premium-expiry-date');
    if (expiryDateElement) {
        const now = new Date();
        // Calculate the last day of the current month
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const formattedDate = `${endOfMonth.getFullYear()}年${endOfMonth.getMonth() + 1}月${endOfMonth.getDate()}日`;
        expiryDateElement.textContent = formattedDate;
    }

    // --- Cancel Confirmation Modal Logic ---
    const cancelConfirmationModal = document.getElementById('cancelConfirmationModal');
    const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
    const cancelCancelBtn = document.getElementById('cancel-cancel-btn');
    const cancelButton = document.getElementById('cancel-button'); // "解約する" button

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
            }, 300); // Wait for transition
        }
    }

    // "解約する" button click event
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
            if (storedData) {
                const userData = JSON.parse(storedData);
                userData.is_premium_member = false;
                localStorage.setItem('simulationUserData', JSON.stringify(userData));
            }

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