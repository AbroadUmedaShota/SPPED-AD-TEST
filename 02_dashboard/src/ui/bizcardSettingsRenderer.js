/**
 * @file bizcardSettingsRenderer.js
 * 名刺データ化設定画面のUI描画と更新を扱うモジュール
 */

// DOM要素をこのモジュール内で管理
const dom = {};

function getLocalizedText(content, lang) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
        return content[lang] || content.ja || Object.values(content)[0] || '';
    }
    return String(content);
}

function getBadgeToneClass(tone) {
    switch (tone) {
        case 'limit':
            return 'bg-tertiary-container text-on-tertiary-container';
        case 'info':
            return 'bg-secondary-container text-on-secondary-container';
        default:
            return 'bg-primary-container text-on-primary-container';
    }
}

/**
 * レンダラーに必要なDOM要素をキャッシュします。
 */
function cacheDOMElements() {
    dom.pageTitle = document.getElementById('pageTitle');
    dom.surveyNameDisplay = document.getElementById('surveyNameDisplay');
    dom.surveyIdDisplay = document.getElementById('surveyIdDisplay');
    dom.surveyPeriodDisplay = document.getElementById('surveyPeriodDisplay');
    dom.bizcardSettingsFields = document.getElementById('bizcardSettingsFields');
    dom.dataConversionPlanSelection = document.getElementById('dataConversionPlanSelection');
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
    if (!dom.bizcardRequestInput) cacheDOMElements();

    const planValue = settings.dataConversionPlan || 'free';
    const speedValue = settings.dataConversionSpeed || 'normal';
    const parsedRequest = parseInt(settings.bizcardRequest, 10);
    const requestCount = Number.isFinite(parsedRequest) ? Math.max(0, parsedRequest) : 0;

    dom.bizcardRequestInput.value = requestCount;
    dom.couponCodeInput.value = settings.couponCode || '';
    dom.internalMemo.value = settings.internalMemo || '';

    // ラジオボタンの選択
    const planRadio = document.querySelector(`input[name="dataConversionPlan"][value="${planValue}"]`);
    if (planRadio) planRadio.checked = true;

    const speedRadio = document.querySelector(`input[name="dataConversionSpeed"][value="${speedValue}"]`);
    if (speedRadio) speedRadio.checked = true;
}

/**
 * 名刺データ化設定エリアの表示/非表示を切り替えます。
 * (関連するUIが削除されたため、この関数は現在何もしません)
 */
export function updateSettingsVisibility() {
    // No-op
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
 * データ化項目プランを描画します。
 * @param {Array<object>} plans - 表示するプラン一覧。
 * @param {string} selectedPlan - 選択中のプラン値。
 */
export function renderDataConversionPlans(plans, selectedPlan) {
    if (!Array.isArray(plans)) return;
    if (!dom.dataConversionPlanSelection) cacheDOMElements();
    const container = dom.dataConversionPlanSelection;
    if (!container) return;

    const lang = document.documentElement.lang || 'ja';
    container.innerHTML = '';

    plans.forEach(plan => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'dataConversionPlan';
        input.value = plan.value;
        input.id = `data-plan-${plan.value}`;
        input.className = 'sr-only peer';
        if (plan.value === selectedPlan) {
            input.checked = true;
        }

        const label = document.createElement('label');
        label.setAttribute('for', input.id);
        label.className = [
            'flex h-full flex-col gap-3 rounded-xl border p-5 transition-all focus:outline-none',
            plan.value === selectedPlan
                ? 'border-primary bg-surface-container-highest shadow-lg'
                : 'border-outline bg-surface-container hover:border-primary hover:shadow-sm'
        ].join(' ');

        const header = document.createElement('div');
        header.className = 'flex items-start justify-between gap-2';

        const title = document.createElement('p');
        title.className = 'text-lg font-semibold text-on-surface';
        title.textContent = getLocalizedText(plan.title, lang);

        const price = document.createElement('div');
        price.className = 'text-right';
        const priceValue = document.createElement('p');
        priceValue.className = 'text-2xl font-bold text-primary';
        priceValue.textContent = getLocalizedText(plan.price, lang);
        const priceNote = document.createElement('p');
        priceNote.className = 'text-xs text-on-surface-variant';
        priceNote.textContent = getLocalizedText(plan.priceNote, lang);
        price.append(priceValue, priceNote);

        header.append(title, price);
        label.appendChild(header);

        if (Array.isArray(plan.badges) && plan.badges.length > 0) {
            const badgeWrapper = document.createElement('div');
            badgeWrapper.className = 'flex flex-wrap gap-2';
            plan.badges.forEach(badge => {
                const badgeEl = document.createElement('span');
                badgeEl.className = `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getBadgeToneClass(badge.tone)}`;
                badgeEl.textContent = getLocalizedText(badge.text, lang);
                badgeWrapper.appendChild(badgeEl);
            });
            label.appendChild(badgeWrapper);
        }

        const description = document.createElement('p');
        description.className = 'text-sm text-on-surface-variant';
        description.textContent = getLocalizedText(plan.description, lang);
        label.appendChild(description);

        if (Array.isArray(plan.highlights) && plan.highlights.length > 0) {
            const list = document.createElement('ul');
            list.className = 'space-y-1 text-sm text-on-surface-variant';
            plan.highlights.forEach(item => {
                const li = document.createElement('li');
                li.className = 'flex items-start gap-2';
                const icon = document.createElement('span');
                icon.className = 'material-icons text-base text-primary mt-0.5';
                icon.textContent = 'check_circle';
                const text = document.createElement('span');
                text.className = 'flex-1';
                text.textContent = getLocalizedText(item, lang);
                li.append(icon, text);
                list.appendChild(li);
            });
            label.appendChild(list);
        }

        wrapper.append(input, label);
        container.appendChild(wrapper);
    });
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
    if (!dom.bizcardRequestInput) cacheDOMElements();
    let isValid = true;
    
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
