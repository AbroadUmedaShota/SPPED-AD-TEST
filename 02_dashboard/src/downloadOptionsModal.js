import { handleOpenModal, closeModal } from './modalHandler.js';

const DEFAULT_START_TIME = '00:00';
const DEFAULT_END_TIME = '23:59';

let currentSurveyPeriod = {
    startDate: '',
    endDate: '',
    startDefaultDateTime: '',
    endDefaultDateTime: ''
}; // Stores survey specific period for date picker limits

/**
 * Initializes elements specific to the Download Options Modal.
 * This is called after the modal's HTML is loaded into the DOM.
 */
function initializeDownloadOptionsModal() {
    const modal = document.getElementById('downloadOptionsModal');
    if (!modal) {
        console.warn('Download Options Modal not found for initialization.');
        return; // Modal not loaded yet
    }

    const downloadForm = modal.querySelector('form');
    if (downloadForm) {
        downloadForm.removeEventListener('change', handleDownloadFormChange);
        downloadForm.addEventListener('change', handleDownloadFormChange);
    }

    const closeBtn = modal.querySelector('#closeDownloadOptionsModalBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModal('downloadOptionsModal'));
    }
    const cancelBtn = modal.querySelector('#cancelDownloadBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => closeModal('downloadOptionsModal'));
    }
}

function handleDownloadFormChange(event) {
    const periodCustomRadio = document.getElementById('period_custom');
    const customPeriodInputs = document.getElementById('customPeriodInputs');
    if (!periodCustomRadio || !customPeriodInputs) {
        return;
    }

    const startInput = document.getElementById('download_start_date');
    const endInput = document.getElementById('download_end_date');
    const startPicker = startInput && startInput._flatpickr;
    const endPicker = endInput && endInput._flatpickr;

    if (event.target === periodCustomRadio) {
        if (periodCustomRadio.checked) {
            customPeriodInputs.classList.remove('hidden');
            const startDefault = currentSurveyPeriod.startDefaultDateTime;
            const endDefault = currentSurveyPeriod.endDefaultDateTime;

            if (startPicker && startDefault) {
                startPicker.setDate(startDefault, false);
            } else if (startInput && startDefault) {
                startInput.value = startDefault;
            }

            if (endPicker && endDefault) {
                endPicker.setDate(endDefault, false);
            } else if (endInput && endDefault) {
                endInput.value = endDefault;
            }
        } else {
            customPeriodInputs.classList.add('hidden');
        }
    }
}

/**
 * Opens the download options modal, pre-selects a download type, and sets date limits.
 * @param {string} initialSelection Initial radio button to select ('answer', 'image', 'business_card', 'both').
 * @param {string} periodStart Start date for the survey period (YYYY-MM-DD).
 * @param {string} periodEnd End date for the survey period (YYYY-MM-DD).
 */
export async function openDownloadModal(initialSelection, periodStart = '', periodEnd = '') {
    await handleOpenModal('downloadOptionsModal', 'modals/downloadOptionsModal.html');

    initializeDownloadOptionsModal();

    const periodAllRadio = document.getElementById('period_all');
    const customPeriodInputsEl = document.getElementById('customPeriodInputs');
    const startInput = document.getElementById('download_start_date');
    const endInput = document.getElementById('download_end_date');

    if (periodAllRadio) periodAllRadio.checked = true;
    if (customPeriodInputsEl) customPeriodInputsEl.classList.add('hidden');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';

    const initialRadio = document.getElementById(`download_${initialSelection}`);
    if (initialRadio) {
        initialRadio.checked = true;
    } else {
        const defaultAnswerRadio = document.getElementById('download_answer');
        if (defaultAnswerRadio) defaultAnswerRadio.checked = true;
    }

    const fallbackEndDate = periodEnd || periodStart || '';
    const startDefaultDateTime = periodStart ? `${periodStart} ${DEFAULT_START_TIME}` : '';
    const endDefaultDateTime = fallbackEndDate ? `${fallbackEndDate} ${DEFAULT_END_TIME}` : '';

    currentSurveyPeriod = {
        startDate: periodStart,
        endDate: periodEnd,
        startDefaultDateTime,
        endDefaultDateTime
    };

    let endDatePicker;
    let startDatePicker;

    if (startInput) {
        startDatePicker = flatpickr(startInput, {
            enableTime: true,
            time_24hr: true,
            dateFormat: 'Y-m-d H:i',
            minDate: startDefaultDateTime || null,
            maxDate: endDefaultDateTime || null,
            onChange(selectedDates) {
                if (selectedDates[0] && endDatePicker) {
                    endDatePicker.set('minDate', selectedDates[0]);
                }
            }
        });
        startInput.value = '';
    }

    if (endInput) {
        endDatePicker = flatpickr(endInput, {
            enableTime: true,
            time_24hr: true,
            dateFormat: 'Y-m-d H:i',
            minDate: startDefaultDateTime || null,
            maxDate: endDefaultDateTime || null,
            onChange(selectedDates) {
                if (selectedDates[0] && startDatePicker) {
                    startDatePicker.set('maxDate', selectedDates[0]);
                }
            }
        });
        endInput.value = '';
    }
}
