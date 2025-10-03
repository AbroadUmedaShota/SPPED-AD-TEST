import { showToast, copyTextToClipboard } from './utils.js';
import { openDownloadModal } from './downloadOptionsModal.js';
import { updateSurveyData, getSurveyStatus } from './tableManager.js'; // tableManagerからインポート
import { closeModal } from './modalHandler.js';

let currentEditingSurvey = null; // 現在編集中のアンケートデータを保持する変数

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
        openDownloadModal('answer', currentEditingSurvey.periodStart, currentEditingSurvey.periodEnd);
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
    const detail_bizcardEnabled_view = document.getElementById('detail_bizcardEnabled_view');
    const detail_bizcardCompletionCount_view = document.getElementById('detail_bizcardCompletionCount');
    const detail_thankYouEmailSettings_view = document.getElementById('detail_thankYouEmailSettings_view');

    // Non-editable fields
    const detail_surveyUrl = document.getElementById('detail_surveyUrl');
    const detail_qrCodeImage = document.getElementById('detail_qrCodeImage');

    // --- Populate View and Edit Fields ---
    const surveyName = (survey.name && typeof survey.name === 'object') ? survey.name[lang] || survey.name.ja : survey.name;
    const displayTitle = (survey.displayTitle && typeof survey.displayTitle === 'object') ? survey.displayTitle[lang] || survey.displayTitle.ja : survey.displayTitle;
    const description = (survey.description && typeof survey.description === 'object') ? survey.description[lang] || survey.description.ja : survey.description;

    // Status Badge
    const displayStatus = getSurveyStatus(survey);
    let statusColorClass = '';
    switch (displayStatus) {
        case '開催中':
            statusColorClass = 'bg-green-100 text-green-800';
            break;
        case '開催前':
            statusColorClass = 'bg-yellow-100 text-yellow-800';
            break;
        case 'データ精査中':
            statusColorClass = 'bg-blue-100 text-blue-800';
            break;
        case '完了':
            statusColorClass = 'bg-indigo-100 text-indigo-800';
            break;
        case 'データ化なし':
            statusColorClass = 'bg-gray-200 text-gray-700';
            break;
        case '終了':
            statusColorClass = 'bg-emerald-100 text-emerald-800';
            break;
        case '削除済み':
            statusColorClass = 'bg-red-100 text-red-800';
            break;
        default:
            statusColorClass = 'bg-gray-100 text-gray-800';
            break;
    }
    surveyDetailName.textContent = surveyName;
    surveyDetailStatusBadge.className = `inline-flex items-center rounded-full text-xs px-2 py-1 ${statusColorClass}`;
    surveyDetailStatusBadge.textContent = displayStatus;

    // Populate view fields
    detail_surveyId_view.textContent = survey.id;
    detail_plan_view.textContent = survey.plan || 'N/A';
    detail_surveyNameInternal_view.textContent = surveyName;
    detail_displayTitle_view.textContent = displayTitle || 'なし';
    detail_surveyMemo_view.textContent = survey.memo || description || 'なし';

    const formattedPeriodStart = survey.periodStart || '―';
    const formattedPeriodEnd = survey.periodEnd || '―';
    detail_surveyPeriod_view.textContent = `${formattedPeriodStart} ~ ${formattedPeriodEnd}`;
    const realtimeAnswersDisplay = survey.realtimeAnswers > 0 ? ` (+${survey.realtimeAnswers})` : '';
    detail_answerCount_view.textContent = `${survey.answerCount}${realtimeAnswersDisplay}`;
    detail_dataCompletionDate_view.textContent = survey.dataCompletionDate || '未定';
    detail_deadline_view.textContent = survey.deadline || 'N/A';

    const isBillingConfirmed = displayStatus === '完了' || Boolean(survey.dataCompletionDate);
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
    detail_bizcardEnabled_view.textContent = survey.bizcardEnabled ? '利用する' : '利用しない';
    detail_bizcardCompletionCount_view.textContent = survey.bizcardEnabled ? `${survey.bizcardCompletionCount || 0}件` : 'N/A';
    detail_thankYouEmailSettings_view.textContent = survey.thankYouEmailSettings || '設定なし';

    // Non-editable fields
    const qrUrl = `https://survey.speedad.com/qr/${survey.id}`;
    detail_surveyUrl.value = qrUrl;
    detail_qrCodeImage.src = `sample_qr.png`; // survey.id を使って動的に生成

    // --- Reset to View Mode --- 
    

    // 編集ボタンの表示/非表示をステータスに基づいて制御
    const editSurveyBtn = modal.querySelector('#editSurveyBtn');
    if (editSurveyBtn) {
        if (displayStatus === '会期前') {
            editSurveyBtn.classList.remove('hidden');
        } else {
            editSurveyBtn.classList.add('hidden');
        }
    }
};
