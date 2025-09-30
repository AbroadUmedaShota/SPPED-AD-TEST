/**
 * @file bizcardSettingsRenderer.js
 * 名刺データ化設定画面のUI描画と更新を扱うモジュール
 */

// DOM要素をこのモジュール内で管理
const dom = {};

/**
 * レンダラーに必要なDOM要素をキャッシュします。
 */
function cacheDOMElements() {
    dom.pageTitle = document.getElementById('pageTitle');
    dom.surveyNameDisplay = document.getElementById('surveyNameDisplay');
    dom.surveyIdDisplay = document.getElementById('surveyIdDisplay');
    dom.surveyPeriodDisplay = document.getElementById('surveyPeriodDisplay');
    dom.bizcardEnabledToggle = document.getElementById('bizcardEnabledToggle');
    dom.bizcardEnabledStatus = document.getElementById('bizcardEnabledStatus');
    dom.bizcardSettingsFields = document.getElementById('bizcardSettingsFields');
    dom.bizcardRequestInput = document.getElementById('bizcardRequest');
    dom.couponCodeInput = document.getElementById('couponCode');
    dom.couponMessage = document.getElementById('couponMessage');
    dom.estimatedAmountSpan = document.getElementById('estimatedAmount');
    dom.estimatedCompletionDateSpan = document.getElementById('estimatedCompletionDate');
    dom.saveButton = document.getElementById('saveBizcardSettingsBtn');
    dom.saveButtonText = document.getElementById('saveBizcardSettingsBtnText');
    dom.saveButtonLoading = document.getElementById('saveBizcardSettingsBtnLoading');
    dom.internalMemo = document.getElementById('internalMemo');
}

/**
 * アンケート情報をページに描画します。
 * @param {object} surveyData - アンケートデータ。
 * @param {string} surveyId - アンケートID。
 */
export function renderSurveyInfo(surveyData, surveyId) {
    if (!dom.pageTitle) cacheDOMElements(); // DOM要素がなければキャッシュ
    const surveyName = (surveyData.name && surveyData.name.ja) ? surveyData.name.ja : (surveyData.surveyName || '');
    dom.pageTitle.textContent = `アンケート『${surveyName}』の名刺データ化設定`;
    dom.surveyNameDisplay.textContent = surveyName;
    dom.surveyIdDisplay.textContent = surveyId;
    dom.surveyPeriodDisplay.textContent = `${surveyData.periodStart} - ${surveyData.periodEnd}`;
}

/**
 * 設定フォームの初期値を設定します。
 * @param {object} settings - 設定データ。
 */
export function setInitialFormValues(settings) {
    if (!settings) return; // settings が null や undefined なら何もしない
    if (!dom.bizcardEnabledToggle) cacheDOMElements();

    dom.bizcardEnabledToggle.checked = settings.bizcardEnabled || false;
    dom.bizcardRequestInput.value = settings.bizcardRequest || 0;
    dom.couponCodeInput.value = settings.couponCode || '';
    dom.internalMemo.value = settings.internalMemo || '';

    // ラジオボタンの選択
    if (settings.dataConversionPlan) {
        const planRadio = document.querySelector(`input[name="dataConversionPlan"][value="${settings.dataConversionPlan}"]`);
        if (planRadio) planRadio.checked = true;
    }
    if (settings.dataConversionSpeed) {
        const speedRadio = document.querySelector(`input[name="dataConversionSpeed"][value="${settings.dataConversionSpeed}"]`);
        if (speedRadio) speedRadio.checked = true;
    }
}

/**
 * 名刺データ化設定エリアの表示/非表示を切り替えます。
 */
export function updateSettingsVisibility() {
    if (!dom.bizcardEnabledToggle) cacheDOMElements();
    const isEnabled = dom.bizcardEnabledToggle.checked;
    dom.bizcardSettingsFields.style.display = isEnabled ? '' : 'none';
    dom.bizcardEnabledStatus.textContent = isEnabled ? '有効' : '無効';

    // Directly control toggle background color to avoid CSS class issues
    const toggleBackground = dom.bizcardEnabledToggle.nextElementSibling;
    if (toggleBackground) {
        // Tailwind's blue-600 and gray-200
        toggleBackground.style.backgroundColor = isEnabled ? '#2563EB' : '#E5E7EB';
    }
}

/**
 * 見積もり結果をUIに反映します。
 * @param {object} estimate - 計算された見積もり { amount, completionDate }。
 */
export function renderEstimate(estimate) {
    if (!dom.estimatedAmountSpan) cacheDOMElements();
    dom.estimatedAmountSpan.textContent = `¥${estimate.amount.toLocaleString()}`;
    dom.estimatedCompletionDateSpan.textContent = estimate.completionDate;
}

/**
 * クーポン適用の結果メッセージを表示します。
 * @param {object} couponResult - クーポン検証結果。
 */
export function displayCouponResult(couponResult) {
    if (!dom.couponMessage) cacheDOMElements();
    dom.couponMessage.textContent = couponResult.message;
    dom.couponMessage.className = `text-sm -mt-4 ${couponResult.success ? 'text-secondary' : 'text-error'}`;
}

/**
 * 入力検証を行い、エラーメッセージを表示・非表示します。
 * @returns {boolean} 検証が成功したかどうか。
 */
export function validateForm() {
    if (!dom.bizcardEnabledToggle) cacheDOMElements();
    let isValid = true;
    if (dom.bizcardEnabledToggle.checked) {
        const value = parseInt(dom.bizcardRequestInput.value || 0, 10);
        const errorEl = dom.bizcardRequestInput.parentElement.querySelector('.input-error-message');
        if (value <= 0) {
            errorEl.textContent = '依頼枚数は1以上の数値を入力してください。';
            dom.bizcardRequestInput.classList.add('border-error');
            isValid = false;
        } else {
            errorEl.textContent = '';
            dom.bizcardRequestInput.classList.remove('border-error');
        }
    } else {
        const errorEl = dom.bizcardRequestInput.parentElement.querySelector('.input-error-message');
        if(errorEl) errorEl.textContent = '';
        dom.bizcardRequestInput.classList.remove('border-error');
    }
    dom.saveButton.disabled = !isValid;
    return isValid;
}

/**
 * 保存ボタンのローディング状態を切り替えます。
 * @param {boolean} isLoading - ローディング中かどうか。
 */
export function setSaveButtonLoading(isLoading) {
    if (!dom.saveButton) cacheDOMElements();
    dom.saveButton.disabled = isLoading;
    dom.saveButtonText.classList.toggle('hidden', isLoading);
    dom.saveButtonLoading.classList.toggle('hidden', !isLoading);
}
