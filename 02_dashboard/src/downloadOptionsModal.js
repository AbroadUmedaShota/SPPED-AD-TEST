import { handleOpenModal, closeModal } from './modalHandler.js';
import { resolveDashboardAssetPath, showToast } from './utils.js';
import { deriveSurveyLifecycleMeta, USER_STATUSES } from './services/statusService.js';

const DEFAULT_START_TIME = '00:00';
const DEFAULT_END_TIME = '24:00';

let currentSurvey = null;
let currentOptionStates = null;

let currentSurveyPeriod = {
    startDate: '',
    endDate: '',
    startDefaultDate: '',
    endDefaultDate: ''
}; // Stores survey specific period for date picker limits

function combineReasons(...reasons) {
    return reasons.filter(Boolean).join(' / ');
}

function safeNumber(value) {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

function summarizeDownloadState(optionStates) {
    const availability = Object.values(optionStates).map(option => Boolean(option.isAvailable));
    const allUnavailable = availability.every(isAvailable => !isAvailable);
    const anyUnavailable = availability.some(isAvailable => !isAvailable);

    if (allUnavailable) {
        return '現在ダウンロードできるデータがありません。';
    }
    if (anyUnavailable) {
        return 'ダウンロードできないデータがあります。理由をご確認ください。';
    }
    return 'ダウンロードするデータを選択してください。';
}

function computeOptionStates(survey) {
    const lifecycleMeta = deriveSurveyLifecycleMeta(survey);

    const answerCount = safeNumber(survey?.answerCount);
    const realtimeAnswers = safeNumber(survey?.realtimeAnswers);
    const totalAnswers = answerCount + realtimeAnswers;

    const bizcardEnabled = Boolean(survey?.bizcardEnabled);
    const bizcardRequested = safeNumber(survey?.bizcardRequest);
    const bizcardCompleted = safeNumber(survey?.bizcardCompletionCount);

    const isDownloadClosed = lifecycleMeta.status === USER_STATUSES.DOWNLOAD_CLOSED;

    const answer = {
        isAvailable: totalAnswers > 0,
        reason: totalAnswers > 0 ? '' : '回答がないためダウンロードできません。',
        meta: `回答数: ${answerCount}${realtimeAnswers > 0 ? ` (+${realtimeAnswers})` : ''}件`
    };

    let imageReason = '';
    if (!bizcardEnabled) {
        imageReason = '画像データの登録対象がないためダウンロードできません。';
    } else if (bizcardRequested <= 0) {
        imageReason = '画像データが登録されていないためダウンロードできません。';
    } else if (isDownloadClosed) {
        imageReason = '画像データのダウンロード期限を過ぎたためダウンロードできません。';
    }
    const image = {
        isAvailable: bizcardEnabled && bizcardRequested > 0 && !isDownloadClosed,
        reason: imageReason,
        meta: bizcardEnabled ? `画像登録: ${bizcardRequested}件` : '画像機能: 利用しない'
    };

    let businessCardReason = '';
    if (!bizcardEnabled) {
        businessCardReason = '名刺機能を利用していないためダウンロードできません。';
    } else if (bizcardRequested <= 0) {
        businessCardReason = '名刺が登録されていないためダウンロードできません。';
    } else if (isDownloadClosed) {
        businessCardReason = 'ダウンロード期限を過ぎたためダウンロードできません。';
    } else if (lifecycleMeta.status === USER_STATUSES.DATA_PROCESSING) {
        businessCardReason = '名刺データがまだ準備できていません。しばらくしてから再度お試しください。';
    } else if (lifecycleMeta.status === USER_STATUSES.PRE_PERIOD || lifecycleMeta.status === USER_STATUSES.IN_PERIOD) {
        businessCardReason = '会期終了後に名刺データが準備されます。';
    } else if (lifecycleMeta.status === USER_STATUSES.POST_PERIOD) {
        businessCardReason = '名刺データ化対象外のためダウンロードできません。';
    } else if (bizcardCompleted <= 0) {
        businessCardReason = '名刺データが存在しないためダウンロードできません。';
    } else if (!lifecycleMeta.isDownloadable) {
        businessCardReason = '名刺データがまだ準備できていません。しばらくしてから再度お試しください。';
    }

    const businessCard = {
        isAvailable: bizcardEnabled && bizcardRequested > 0 && bizcardCompleted > 0 && lifecycleMeta.isDownloadable,
        reason: businessCardReason,
        meta: bizcardEnabled
            ? `名刺データ化完了: ${bizcardCompleted}件 / 名刺登録: ${bizcardRequested}件`
            : '名刺機能: 利用しない'
    };

    const businessCardAnswer = {
        isAvailable: answer.isAvailable && businessCard.isAvailable,
        reason: combineReasons(
            answer.isAvailable ? '' : answer.reason,
            businessCard.isAvailable ? '' : businessCard.reason
        ),
        meta: `${answer.meta} | ${businessCard.meta}`
    };

    return {
        lifecycleMeta,
        optionStates: {
            answer,
            business_card_answer: businessCardAnswer,
            business_card: businessCard,
            image
        }
    };
}

function applyStatusBadge(modal, optionKey, optionState) {
    const badge = modal.querySelector(`[data-download-status="${optionKey}"]`);
    if (!badge) return;

    badge.textContent = optionState.isAvailable ? '利用可能' : '利用不可';
    badge.className = `text-xs mt-2 px-2 py-0.5 rounded-full ${optionState.isAvailable ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-700'}`;
    if (!optionState.isAvailable && optionState.reason) {
        badge.setAttribute('title', optionState.reason);
    } else {
        badge.removeAttribute('title');
    }
}

function getSelectedDownloadType() {
    const selected = document.querySelector('input[name="download_type"]:checked');
    return selected?.value || '';
}

function updateDownloadButtonState(modal) {
    const downloadBtn = modal.querySelector('#downloadSubmitBtn');
    if (!downloadBtn) return;

    const selectedType = getSelectedDownloadType();
    const selectedState = selectedType && currentOptionStates ? currentOptionStates[selectedType] : null;
    const canDownload = Boolean(selectedState?.isAvailable);

    downloadBtn.disabled = !canDownload;
    downloadBtn.setAttribute('aria-disabled', canDownload ? 'false' : 'true');
    downloadBtn.classList.toggle('opacity-50', !canDownload);
    downloadBtn.classList.toggle('cursor-not-allowed', !canDownload);

    const typeMessageEl = modal.querySelector('#downloadOptionsTypeMessage');
    if (typeMessageEl) {
        const message = selectedState && !selectedState.isAvailable ? selectedState.reason : '';
        typeMessageEl.textContent = message || '';
        typeMessageEl.classList.toggle('hidden', !message);
    }
}

function renderDownloadOptionsModal() {
    const modal = document.getElementById('downloadOptionsModal');
    if (!modal) return;

    const summaryMessageEl = modal.querySelector('#downloadOptionsSummaryMessage');
    const deadlineMessageEl = modal.querySelector('#downloadOptionsDeadlineMessage');

    if (!currentSurvey) {
        if (summaryMessageEl) summaryMessageEl.textContent = 'ダウンロードするアンケート情報がありません。';
        if (deadlineMessageEl) deadlineMessageEl.classList.add('hidden');

        const unavailableState = { isAvailable: false, reason: 'ダウンロードするアンケート情報がありません。', meta: '' };
        applyStatusBadge(modal, 'answer', unavailableState);
        applyStatusBadge(modal, 'business_card_answer', unavailableState);
        applyStatusBadge(modal, 'business_card', unavailableState);
        applyStatusBadge(modal, 'image', unavailableState);
        currentOptionStates = {
            answer: unavailableState,
            business_card_answer: unavailableState,
            business_card: unavailableState,
            image: unavailableState
        };
        updateDownloadButtonState(modal);
        return;
    }

    const { lifecycleMeta, optionStates } = computeOptionStates(currentSurvey);
    currentOptionStates = optionStates;

    if (summaryMessageEl) {
        summaryMessageEl.textContent = summarizeDownloadState(optionStates);
    }

    if (deadlineMessageEl) {
        const deadlineLabel = lifecycleMeta.downloadDeadlineLabel;
        if (deadlineLabel && Boolean(currentSurvey.bizcardEnabled)) {
            deadlineMessageEl.textContent = `画像データのダウンロード期限: ${deadlineLabel}`;
            deadlineMessageEl.classList.remove('hidden');
        } else {
            deadlineMessageEl.classList.add('hidden');
        }
    }

    applyStatusBadge(modal, 'answer', optionStates.answer);
    applyStatusBadge(modal, 'business_card_answer', optionStates.business_card_answer);
    applyStatusBadge(modal, 'business_card', optionStates.business_card);
    applyStatusBadge(modal, 'image', optionStates.image);

    updateDownloadButtonState(modal);
}

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
    const alreadyBound = modal.dataset.bound === 'true';

    const downloadForm = modal.querySelector('form');
    if (downloadForm && !alreadyBound) {
        downloadForm.addEventListener('change', (event) => {
            handleDownloadFormChange(event);
            renderDownloadOptionsModal();
        });
        downloadForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const selectedType = getSelectedDownloadType();
            const optionState = selectedType && currentOptionStates ? currentOptionStates[selectedType] : null;
            if (!selectedType) {
                showToast('ダウンロードするデータを選択してください。', 'error');
                return;
            }
            if (!optionState?.isAvailable) {
                showToast(optionState?.reason || '現在ダウンロードできません。', 'info');
                renderDownloadOptionsModal();
                return;
            }
            showToast('データダウンロード機能は未実装です。', 'info');
        });
    }

    // Setup selection cards
    const selectionGroups = modal.querySelectorAll('[data-selection-group]');
    selectionGroups.forEach(group => {
        // Set initial state
        updateSelectionCards(group);
        // Add event listener for changes (bind once)
        if (!alreadyBound) {
            group.addEventListener('change', () => updateSelectionCards(group));
        }
    });

    const closeBtn = modal.querySelector('#closeDownloadOptionsModalBtn');
    if (closeBtn && !alreadyBound) {
        closeBtn.addEventListener('click', () => closeModal('downloadOptionsModal'));
    }
    const cancelBtn = modal.querySelector('#cancelDownloadBtn');
    if (cancelBtn && !alreadyBound) {
        cancelBtn.addEventListener('click', () => closeModal('downloadOptionsModal'));
    }

    modal.dataset.bound = 'true';
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
 * Opens the download options modal and renders availability/reasons based on survey data.
 * @param {object | null} survey Survey object.
 */
export async function openDownloadModal(survey) {
    await handleOpenModal('downloadOptionsModal', resolveDashboardAssetPath('modals/downloadOptionsModal.html'));

    currentSurvey = survey || null;

    // Set checked states before initializing
    const periodAllRadio = document.getElementById('period_all');
    if (periodAllRadio) periodAllRadio.checked = true;

    const defaultAnswerRadio = document.getElementById('download_answer');
    if (defaultAnswerRadio) defaultAnswerRadio.checked = true;

    // Hide custom period inputs initially
    const customPeriodInputsEl = document.getElementById('customPeriodInputs');
    if (customPeriodInputsEl) customPeriodInputsEl.classList.add('hidden');

    // Store survey period for date pickers
    currentSurveyPeriod = {
        startDate: currentSurvey?.periodStart || '',
        endDate: currentSurvey?.periodEnd || '',
        startDefaultDate: currentSurvey?.periodStart || '',
        endDefaultDate: currentSurvey?.periodEnd || currentSurvey?.periodStart || ''
    };

    // Initialize all modal components, including selection cards and datepickers
    initializeDownloadOptionsModal();
    renderDownloadOptionsModal();
}
