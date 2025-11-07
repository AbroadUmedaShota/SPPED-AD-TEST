import { handleOpenModal, closeModal } from './modalHandler.js';
import { resolveDashboardAssetPath } from './utils.js';

const DEFAULT_START_TIME = '00:00';
const DEFAULT_END_TIME = '24:00';

let currentSurveyPeriod = {
    startDate: '',
    endDate: '',
    startDefaultDate: '',
    endDefaultDate: ''
}; // Stores survey specific period for date picker limits

/**
 * Updates the visual state of selection cards within a group.
 * @param {HTMLElement} groupElement The container element with [data-selection-group].
 */
function updateSelectionCards(groupElement) {
    const radioButtons = groupElement.querySelectorAll('input[type="radio"]');
    radioButtons.forEach(radio => {
        const label = radio.closest('.selection-card-label');
        if (label) {
            if (radio.checked) {
                label.classList.add('selected');
            } else {
                label.classList.remove('selected');
            }
        }
    });
}

/**
 * Initializes elements specific to the Download Options Modal.
 */
function initializeDownloadOptionsModal() {
    const modal = document.getElementById('downloadOptionsModal');
    if (!modal) {
        console.warn('Download Options Modal not found for initialization.');
        return;
    }

    const downloadForm = modal.querySelector('form');
    if (downloadForm) {
        downloadForm.addEventListener('change', handleDownloadFormChange);
    }

    // Setup selection cards
    const selectionGroups = modal.querySelectorAll('[data-selection-group]');
    selectionGroups.forEach(group => {
        // Set initial state
        updateSelectionCards(group);
        // Add event listener for changes
        group.addEventListener('change', () => updateSelectionCards(group));
    });

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

    // Only handle the logic for showing/hiding the custom period inputs
    if (event.target.name === 'download_period') {
        if (periodCustomRadio.checked) {
            customPeriodInputs.classList.remove('hidden');
            initializeDatepickers(); // Re-initialize datepickers if needed
        } else {
            customPeriodInputs.classList.add('hidden');
        }
    }
}

/**
 * Initializes or re-initializes the date pickers for the modal.
 */
function initializeDatepickers() {
    const startInput = document.getElementById('download_start_date');
    const endInput = document.getElementById('download_end_date');
    const startTimeInput = document.getElementById('download_start_time');
    const endTimeInput = document.getElementById('download_end_time');

    const startDefault = currentSurveyPeriod.startDefaultDate || currentSurveyPeriod.startDate;
    const endDefault = currentSurveyPeriod.endDefaultDate || currentSurveyPeriod.endDate || currentSurveyPeriod.startDate;

    if (startTimeInput) startTimeInput.value = DEFAULT_START_TIME;
    if (endTimeInput) endTimeInput.value = DEFAULT_END_TIME;

    let endDatePicker;
    let startDatePicker;

    if (startInput) {
        startDatePicker = flatpickr(startInput, {
            dateFormat: 'Y-m-d',
            minDate: currentSurveyPeriod.startDate || null,
            maxDate: endDefault || null,
            defaultDate: startDefault,
            onChange(selectedDates) {
                if (selectedDates[0] && endDatePicker) {
                    endDatePicker.set('minDate', selectedDates[0]);
                }
            }
        });
    }

    if (endInput) {
        endDatePicker = flatpickr(endInput, {
            dateFormat: 'Y-m-d',
            minDate: currentSurveyPeriod.startDate || null,
            maxDate: endDefault || null,
            defaultDate: endDefault,
            onChange(selectedDates) {
                if (selectedDates[0] && startDatePicker) {
                    startDatePicker.set('maxDate', selectedDates[0]);
                }
            }
        });
    }
}

/**
 * Opens the download options modal, pre-selects a download type, and sets date limits.
 * @param {string} initialSelection Initial radio button to select ('answer', 'image', 'business_card', 'both').
 * @param {string} periodStart Start date for the survey period (YYYY-MM-DD).
 * @param {string} periodEnd End date for the survey period (YYYY-MM-DD).
 */
export async function openDownloadModal(initialSelection, periodStart = '', periodEnd = '') {
    await handleOpenModal('downloadOptionsModal', resolveDashboardAssetPath('modals/downloadOptionsModal.html'));

    // Set checked states before initializing
    const periodAllRadio = document.getElementById('period_all');
    if (periodAllRadio) periodAllRadio.checked = true;

    const initialRadio = document.getElementById(`download_${initialSelection}`);
    if (initialRadio) {
        initialRadio.checked = true;
    } else {
        const defaultAnswerRadio = document.getElementById('download_answer');
        if (defaultAnswerRadio) defaultAnswerRadio.checked = true;
    }

    // Hide custom period inputs initially
    const customPeriodInputsEl = document.getElementById('customPeriodInputs');
    if (customPeriodInputsEl) customPeriodInputsEl.classList.add('hidden');

    // Store survey period for date pickers
    currentSurveyPeriod = {
        startDate: periodStart,
        endDate: periodEnd,
        startDefaultDate: periodStart || '',
        endDefaultDate: periodEnd || periodStart || ''
    };

    // Initialize all modal components, including selection cards and datepickers
    initializeDownloadOptionsModal();
}
