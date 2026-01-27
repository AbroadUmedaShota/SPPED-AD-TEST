import { DATA_CONVERSION_PLANS, DEFAULT_PLAN, getPlanConfig, normalizePlanValue } from './services/bizcardPlans.js';
import { openDownloadModal } from './downloadOptionsModal.js';
import { updateSurveyData } from './tableManager.js'; // tableManagerからインポート
import { deriveSurveyLifecycleMeta, USER_STATUSES } from './services/statusService.js';
import { closeModal } from './modalHandler.js';

let currentEditingSurvey = null; // 現在編集中のアンケートデータを保持する変数
let activeHelpPopover = null;

function closeActiveHelpPopover() {
    if (!activeHelpPopover) return;
    const { button, popover } = activeHelpPopover;
    popover.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    activeHelpPopover = null;
}

function toggleHelpPopover(button) {
    if (!button) return;
    const tooltipId = button.dataset.tooltipId;
    if (!tooltipId) return;
    const modalRoot = document.getElementById('surveyDetailsModal');
    if (!modalRoot) return;
    const popover = modalRoot.querySelector(`#${tooltipId}`);
    if (!popover) return;

    if (activeHelpPopover && activeHelpPopover.popover === popover) {
        closeActiveHelpPopover();
        return;
    }

    closeActiveHelpPopover();
    popover.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
    activeHelpPopover = { button, popover };
}

function handleGlobalClick(event) {
    if (!activeHelpPopover) return;
    const { button, popover } = activeHelpPopover;
    if (button.contains(event.target) || popover.contains(event.target)) {
        return;
    }
    closeActiveHelpPopover();
}

document.addEventListener('click', handleGlobalClick);
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeActiveHelpPopover();
    }
});

// Listen for language changes to update the modal if it's open
document.addEventListener('languagechange', () => {
    const modal = document.getElementById('surveyDetailsModal');
    if (currentEditingSurvey && modal && modal.dataset.state === 'open') {
        populateSurveyDetails(currentEditingSurvey);
    }
});

/**
 * Initializes elements specific to the Survey Details Modal.
 * This is called after the modal's HTML is loaded into the DOM.
 * @param {HTMLElement} modalElement The root element of the modal overlay.
 */
export function setupSurveyDetailsModalListeners(modalElement) {
    if (!modalElement) {
        console.warn("surveyDetailsModal element not provided to setupSurveyDetailsModalListeners.");
        return;
    }

    closeActiveHelpPopover();

    const editSurveyBtn = modalElement.querySelector('#editSurveyBtn');
    const cancelEditBtn = modalElement.querySelector('#cancelEditBtn');
    const saveSurveyBtn = modalElement.querySelector('#saveSurveyBtn');
    const detailDownloadBtn = modalElement.querySelector('#detailDownloadBtn');
    const deleteSurveyBtn = modalElement.querySelector('#deleteSurveyBtn');
    const goToBizcardSettingsBtn = modalElement.querySelector('#goToBizcardSettingsBtn');
    const goToThankYouEmailSettingsBtn = modalElement.querySelector('#goToThankYouEmailSettingsBtn');
    const goToSpeedReviewBtn = modalElement.querySelector('#goToSpeedReviewBtn');

    // Remove existing listeners to prevent duplication
    if (detailDownloadBtn) detailDownloadBtn.removeEventListener('click', handleDetailDownload);
    if (deleteSurveyBtn) deleteSurveyBtn.removeEventListener('click', handleDeleteSurvey);
    if (goToBizcardSettingsBtn) goToBizcardSettingsBtn.removeEventListener('click', handleGoToBizcardSettings);
    if (goToThankYouEmailSettingsBtn) goToThankYouEmailSettingsBtn.removeEventListener('click', handleGoToThankYouEmailSettings);
    if (goToSpeedReviewBtn) goToSpeedReviewBtn.removeEventListener('click', handleGoToSpeedReview);

    const surveyUrlInput = modalElement.querySelector('#detail_surveyUrl');

    if (surveyUrlInput && surveyUrlInput.dataset.bound !== 'true') {
        const copySurveyUrl = async () => {
            if (!surveyUrlInput.value) {
                return;
            }
            try {
                await copyTextToClipboard(surveyUrlInput.value);
                showToast('アンケートURLをコピーしました。', 'success');
            } catch (error) {
                console.error('Failed to copy survey URL:', error);
                showToast('URLのコピーに失敗しました。', 'error');
            }
        };
        surveyUrlInput.addEventListener('click', copySurveyUrl);
        surveyUrlInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                copySurveyUrl();
            }
        });
        surveyUrlInput.dataset.bound = 'true';
    }

    const helpButtons = modalElement.querySelectorAll('.help-icon-button');
    helpButtons.forEach((button) => {
        if (button.dataset.bound === 'true') return;
        button.setAttribute('aria-expanded', 'false');
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleHelpPopover(button);
        });
        button.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleHelpPopover(button);
            }
        });
        button.dataset.bound = 'true';
    });

    // Add new listeners
    if (editSurveyBtn) editSurveyBtn.addEventListener('click', () => {
        if (currentEditingSurvey && currentEditingSurvey.id) {
            window.location.href = `surveyCreation.html?surveyId=${currentEditingSurvey.id}`;
        } else {
            showToast('編集するアンケート情報がありません。', 'error');
        }
    });
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', handleCancelEdit);
    if (saveSurveyBtn) saveSurveyBtn.addEventListener('click', handleSaveSurvey);
    if (detailDownloadBtn) detailDownloadBtn.addEventListener('click', handleDetailDownload);
    if (deleteSurveyBtn) deleteSurveyBtn.addEventListener('click', handleDeleteSurvey);
    if (goToBizcardSettingsBtn) goToBizcardSettingsBtn.addEventListener('click', handleGoToBizcardSettings);
    if (goToThankYouEmailSettingsBtn) goToThankYouEmailSettingsBtn.addEventListener('click', handleGoToThankYouEmailSettings);
    if (goToSpeedReviewBtn) goToSpeedReviewBtn.addEventListener('click', handleGoToSpeedReview);

    const closeBtn = modalElement.querySelector('#closeSurveyDetailsModalBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => closeModal('surveyDetailsModal'));
    }
    const footerCloseBtn = modalElement.querySelector('#footerCloseSurveyDetailsModalBtn');
    if (footerCloseBtn) {
        footerCloseBtn.addEventListener('click', () => closeModal('surveyDetailsModal'));
    }
}

function handleGoToBizcardSettings() {
    if (currentEditingSurvey && currentEditingSurvey.id) {
        window.location.href = `bizcardSettings.html?surveyId=${currentEditingSurvey.id}`;
    } else {
        showToast('アンケート情報がありません。', 'error');
    }
}

function handleGoToThankYouEmailSettings() {
    if (currentEditingSurvey && currentEditingSurvey.id) {
        window.location.href = `thankYouEmailSettings.html?surveyId=${currentEditingSurvey.id}`;
    } else {
        showToast('アンケート情報がありません。', 'error');
    }
}

function handleGoToSpeedReview() {
    if (currentEditingSurvey && currentEditingSurvey.id) {
        window.location.href = `speed-review.html?surveyId=${currentEditingSurvey.id}`;
    } else {
        showToast('アンケート情報がありません。', 'error');
    }
}

function handleDeleteSurvey() {
    if (currentEditingSurvey) {
        showToast(`アンケートID: ${currentEditingSurvey.id} を削除します。（実装はここから）`, 'info');
        // 削除処理後、モーダルを閉じるなどの処理が必要
    } else {
        showToast('削除するアンケート情報がありません。', 'error');
    }
}

function handleCancelEdit() {
    closeModal('surveyDetailsModal');
}

function handleSaveSurvey() {
    if (!currentEditingSurvey) {
        showToast('保存するアンケート情報がありません。', 'error');
        return;
    }

    const form = document.getElementById('surveyDetailsForm');
    const formData = new FormData(form);
    const updatedData = {};

    for (let [key, value] of formData.entries()) {
        updatedData[key] = value;
    }

    // Boolean and Number conversions
    updatedData.bizcardEnabled = updatedData.bizcardEnabled === 'true';
    // estimatedBillingAmount, answerCount, bizcardRequest, bizcardCompletionCount は編集不可なので、既存の値を維持
    updatedData.estimatedBillingAmount = currentEditingSurvey.estimatedBillingAmount;
    updatedData.answerCount = currentEditingSurvey.answerCount;
    updatedData.bizcardRequest = currentEditingSurvey.bizcardRequest;
    updatedData.bizcardCompletionCount = currentEditingSurvey.bizcardCompletionCount;

    // Merge with existing data to ensure all fields are present
    const newSurveyData = { ...currentEditingSurvey, ...updatedData };

    // Update data in tableManager
    updateSurveyData(newSurveyData);

    showToast('アンケート情報を保存しました！', 'success');

}

function handleDetailDownload() {
    if (currentEditingSurvey) {
        openDownloadModal(currentEditingSurvey);
    } else {
        showToast('ダウンロードするアンケート情報がありません。', 'error');
    }
}



/**
 * Populates the survey details modal with data for a given survey object.
 * This is separated from openModal because the modal might be loaded asynchronously.
 * @param {object} survey The survey data object.
 */
export function populateSurveyDetails(survey) {
    closeActiveHelpPopover();
    currentEditingSurvey = survey; // Store the survey object for editing

    const modal = document.getElementById('surveyDetailsModal');
    if (!modal) return;

    const lang = window.getCurrentLanguage();

    // --- Get All View and Edit Elements ---
    const surveyDetailName = document.getElementById('surveyDetailName');
    const surveyDetailStatusBadge = document.getElementById('surveyDetailStatusBadge');

    // View mode elements
    const detail_surveyId_view = document.getElementById('detail_surveyId');
    const detail_plan_view = document.getElementById('detail_plan_view');
    const detail_surveyNameInternal_view = document.getElementById('detail_surveyNameInternal_view');
    const detail_displayTitle_view = document.getElementById('detail_displayTitle_view');
    const detail_surveyMemo_view = document.getElementById('detail_surveyMemo_view');
    const detail_surveyPeriod_view = document.getElementById('detail_surveyPeriod_view');
    const detail_answerCount_view = document.getElementById('detail_answerCount');
    const detail_dataCompletionDate_view = document.getElementById('detail_dataCompletionDate_view');
    const detail_deadline_view = document.getElementById('detail_deadline_view');
    const detail_estimatedBillingAmount_view = document.getElementById('detail_estimatedBillingAmount_view');
    const detail_billingAmount_label = document.getElementById('detail_billingAmount_label');
    const detail_bizcardCompletionCount_view = document.getElementById('detail_bizcardCompletionCount');
    const detail_thankYouEmailSettings_view = document.getElementById('detail_thankYouEmailSettings_view');
    const detail_dataConversionPlan_view = document.getElementById('detail_dataConversionPlan_view');

    // Non-editable fields
    const detail_surveyUrl = document.getElementById('detail_surveyUrl');
    const detail_qrCodeImage = document.getElementById('detail_qrCodeImage');

    // --- Populate View and Edit Fields ---
    const surveyName = (survey.name && typeof survey.name === 'object') ? survey.name[lang] || survey.name.ja : survey.name;
    const displayTitle = (survey.displayTitle && typeof survey.displayTitle === 'object') ? survey.displayTitle[lang] || survey.displayTitle.ja : survey.displayTitle;
    const description = (survey.description && typeof survey.description === 'object') ? survey.description[lang] || survey.description.ja : survey.description;

    // Status Badge
    const lifecycleMeta = deriveSurveyLifecycleMeta(survey);
    const displayStatus = lifecycleMeta.status;
    const statusMeta = lifecycleMeta.statusMeta;
    const statusColorClass = statusMeta.badgeClass;
    const statusTooltip = statusMeta.description;

    surveyDetailName.textContent = surveyName;
    surveyDetailStatusBadge.className = `inline-flex items-center rounded-full text-xs px-2 py-1 ${statusColorClass}`;
    surveyDetailStatusBadge.textContent = displayStatus;
    surveyDetailStatusBadge.title = statusTooltip;
    surveyDetailStatusBadge.setAttribute('aria-label', statusTooltip);

    // Populate view fields
    detail_surveyId_view.textContent = survey.id;
    if (survey.plan === 'Premium') {
        detail_plan_view.className = 'text-on-surface text-base view-mode flex items-center gap-2 font-semibold text-amber-700';
        detail_plan_view.innerHTML = `
            <span>Premium</span>`;
    } else {
        detail_plan_view.className = 'text-on-surface text-base view-mode'; // Reset to default if not premium
        detail_plan_view.textContent = survey.plan || 'N/A';
    }
    detail_surveyNameInternal_view.textContent = surveyName;
    detail_displayTitle_view.textContent = displayTitle || 'なし';
    detail_surveyMemo_view.textContent = survey.memo || description || 'なし';

    const formattedPeriodStart = survey.periodStart || '―';
    const formattedPeriodEnd = survey.periodEnd || '―';
    detail_surveyPeriod_view.textContent = `${formattedPeriodStart} ~ ${formattedPeriodEnd}`;
    const realtimeAnswersDisplay = survey.realtimeAnswers > 0 ? ` (+${survey.realtimeAnswers})` : '';
    detail_answerCount_view.textContent = `${survey.answerCount}${realtimeAnswersDisplay}`;
    detail_dataCompletionDate_view.textContent = lifecycleMeta.completionDateLabel || '未定';
    detail_deadline_view.textContent = lifecycleMeta.downloadDeadlineLabel || survey.deadline || '―';

    const isBillingConfirmed = lifecycleMeta.dataConversionCompleted;
    if (detail_billingAmount_label) {
        detail_billingAmount_label.textContent = isBillingConfirmed ? '確定請求額' : '見込み請求額';
    }
    const rawBillingAmount = survey.estimatedBillingAmount;
    let billingAmountValue = null;
    if (rawBillingAmount !== undefined && rawBillingAmount !== null && rawBillingAmount !== '') {
        const parsedAmount = Number(rawBillingAmount);
        billingAmountValue = Number.isFinite(parsedAmount) ? parsedAmount : null;
    }
    detail_estimatedBillingAmount_view.textContent = billingAmountValue !== null
        ? `¥${billingAmountValue.toLocaleString()}`
        : '―';
    const rawPlan = survey.dataConversionPlan || survey.bizcardSettings?.dataConversionPlan;
    const normalizedPlan = normalizePlanValue(rawPlan || DEFAULT_PLAN);
    const planConfig = getPlanConfig(normalizedPlan) || getPlanConfig(DEFAULT_PLAN);
    if (detail_dataConversionPlan_view) {
        detail_dataConversionPlan_view.textContent = planConfig ? planConfig.title.ja : 'データ化項目プランは設定されていません';
    }
    detail_bizcardCompletionCount_view.textContent = `${survey.bizcardRequest || 0}件`;
    detail_thankYouEmailSettings_view.textContent = survey.thankYouEmailSettings || '設定なし';

    // Non-editable fields
    const qrUrl = `https://survey.speedad.com/qr/${survey.id}`;
    detail_surveyUrl.value = qrUrl;
    detail_qrCodeImage.src = `sample_qr.png`; // survey.id を使って動的に生成

    // --- Reset to View Mode --- 


    // 編集ボタンの表示/非表示をステータスに基づいて制御
    const editSurveyBtn = modal.querySelector('#editSurveyBtn');
    if (editSurveyBtn) {
        if (displayStatus === USER_STATUSES.PRE_PERIOD) {
            editSurveyBtn.classList.remove('hidden');
        } else {
            editSurveyBtn.classList.add('hidden');
        }
    }
};
