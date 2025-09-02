import { handleOpenModal, closeModal } from './modalHandler.js';
import { duplicateSurvey } from './tableManager.js';

/**
 * Opens the duplicate survey modal and populates it with initial data.
 * @param {object} survey The survey object to be duplicated.
 */
export async function openDuplicateSurveyModal(survey) {
    await handleOpenModal('duplicateSurveyModal', 'modals/duplicateSurveyModal.html');

    const newSurveyNameInput = document.getElementById('newSurveyName');
    const newPeriodStartInput = document.getElementById('newPeriodStart');
    const newPeriodEndInput = document.getElementById('newPeriodEnd');
    const confirmBtn = document.getElementById('duplicateSurveyConfirmBtn');
    const cancelBtn = document.getElementById('duplicateSurveyCancelBtn');
    const closeBtn = document.getElementById('closeDuplicateSurveyModalBtn');

    // --- Event Listeners ---
    const handleConfirm = () => {
        const newName = newSurveyNameInput ? newSurveyNameInput.value : '';
        const newStart = newPeriodStartInput ? newPeriodStartInput.value : '';
        const newEnd = newPeriodEndInput ? newPeriodEndInput.value : '';

        if (!newName || !newStart || !newEnd) {
            showToast('全てのフィールドを入力してください。', 'error');
            return;
        }

        duplicateSurvey(survey.id, newName, newStart, newEnd);
        closeModal('duplicateSurveyModal');
    };

    const handleCancel = () => {
        closeModal('duplicateSurveyModal');
    };

    // Clone and replace to ensure old listeners are removed
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.addEventListener('click', handleConfirm);

    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        newCancelBtn.addEventListener('click', handleCancel);
    }

    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', handleCancel);
    }
}