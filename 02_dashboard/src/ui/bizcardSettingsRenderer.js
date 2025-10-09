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

function findPlanByValue(plans, value) {
    if (!value) return null;
    return plans.find(plan => plan.value === value) || null;
}

function dedupeFeatures(features = []) {
    const seen = new Set();
    return features.filter(feature => {
        if (!feature) return false;
        const key = feature.key || getLocalizedText(feature.text, 'ja');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function collectPlanFeatures(plan, plans, visited = new Set()) {
    if (!plan || visited.has(plan.value)) return [];
    visited.add(plan.value);

    const ownFeatures = dedupeFeatures([
        ...(Array.isArray(plan.baseFeatures) ? plan.baseFeatures : []),
        ...(Array.isArray(plan.additionalFeatures) ? plan.additionalFeatures : [])
    ]);

    if (!plan.basePlanKey) {
        return ownFeatures;
    }

    const basePlan = findPlanByValue(plans, plan.basePlanKey);
    const inherited = collectPlanFeatures(basePlan, plans, visited);
    return dedupeFeatures([...inherited, ...ownFeatures]);
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
    dom.dataConversionSpeedSelection = document.getElementById('dataConversionSpeedSelection');
    dom.bizcardRequestInput = document.getElementById('bizcardRequest');
    dom.couponCodeInput = document.getElementById('couponCode');
    dom.couponMessage = document.getElementById('couponMessage');
    dom.estimatedAmountSpan = document.getElementById('estimatedAmount');
    dom.estimatedCompletionDateSpan = document.getElementById('estimatedCompletionDate');
    dom.estimateBreakdown = document.getElementById('estimateBreakdown');
    dom.minChargeNotice = document.getElementById('minChargeNotice');
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
    const requestCount = Number.isFinite(parsedRequest) && parsedRequest > 0 ? parsedRequest : 100;

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
    if (dom.estimateBreakdown) {
        const cards = estimate.requestedCards ?? 0;
        const unit = estimate.unitPrice ?? 0;
        const couponAmt = estimate.couponAmount ?? 0;
        const couponPct = estimate.couponPercent ?? 0;
        const minCharge = estimate.minCharge ?? 0;
        const minChargeLine = minCharge > 0
            ? `<div class="text-xs text-on-surface-variant">＝ ※最低ご請求金額 ¥${minCharge.toLocaleString()}（＋税）</div>`
            : '';
        dom.estimateBreakdown.innerHTML = `
            <div class="space-y-1">
              <div class="text-xs text-on-surface-variant">ご請求見込み金額</div>
              <div class="grid grid-cols-2 text-sm">
                <div class="text-on-surface-variant">想定件数</div>
                <div class="text-right text-on-surface">${cards.toLocaleString()}件</div>
              </div>
              <div class="text-xs text-on-surface-variant">内訳</div>
              <div class="text-sm text-on-surface">
                ${cards.toLocaleString()}件 × データ化単価 ${unit.toLocaleString()}円 ー クーポンお値引き ${couponAmt.toLocaleString()}円（${couponPct}%相当）
              </div>
              <div class="text-sm font-semibold text-on-surface">＝ ご請求見込み金額 ¥${estimate.amount.toLocaleString()}（＋税）</div>
              ${minChargeLine}
            </div>
        `;
    }
    if (dom.minChargeNotice) {
        const requestedCards = estimate.requestedCards ?? 0;
        const minChargeCards = estimate.minChargeCards ?? (requestedCards > 0 ? Math.ceil(requestedCards * 0.5) : 0);
        if (requestedCards > 0 && (estimate.minCharge ?? 0) > 0 && minChargeCards > 0) {
            const cardsText = minChargeCards.toLocaleString();
            const amountText = (estimate.minCharge ?? 0).toLocaleString();
            dom.minChargeNotice.textContent = `※ 実際の件数が${cardsText}枚に満たない場合でも${cardsText}枚分（¥${amountText}）をご請求します。`;
            dom.minChargeNotice.classList.remove('hidden');
        } else {
            dom.minChargeNotice.textContent = '';
            dom.minChargeNotice.classList.add('hidden');
        }
    }
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
        const isSelected = plan.value === selectedPlan;
        const wrapper = document.createElement('div');
        wrapper.className = 'relative';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'dataConversionPlan';
        input.value = plan.value;
        input.id = `data-plan-${plan.value}`;
        input.className = 'sr-only peer';
        if (isSelected) {
            input.checked = true;
        }

        const label = document.createElement('label');
        label.setAttribute('for', input.id);
        label.className = [
            'flex h-full flex-col gap-3 rounded-xl border p-5 transition-all focus:outline-none cursor-pointer',
            isSelected
                ? 'border-primary ring-2 ring-primary bg-primary-container'
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

        const description = document.createElement('p');
        description.className = 'text-sm text-on-surface-variant';
        description.textContent = getLocalizedText(plan.description, lang);
        label.appendChild(description);

        const basePlan = findPlanByValue(plans, plan.basePlanKey);
        const planName = getLocalizedText(plan.title, lang);
        const intro = document.createElement('p');
        intro.className = 'text-sm font-medium text-on-surface';
        if (basePlan) {
            const basePlanName = getLocalizedText(basePlan.title, lang);
            intro.textContent = lang === 'ja'
                ? `${planName}は${basePlanName}に加えて、次の機能が利用できます。`
                : `${planName} adds the following on top of ${basePlanName}.`;
        } else {
            intro.textContent = lang === 'ja' ? 'このプランで利用可能' : 'Available in this plan';
        }

        const featureSection = document.createElement('div');
        featureSection.className = 'space-y-2';
        featureSection.appendChild(intro);

        const featureList = document.createElement('ul');
        featureList.className = 'flex flex-wrap gap-2';
        featureList.setAttribute('role', 'list');

        const featuresToRender = basePlan
            ? dedupeFeatures(Array.isArray(plan.additionalFeatures) ? plan.additionalFeatures : [])
            : dedupeFeatures([
                ...(Array.isArray(plan.baseFeatures) ? plan.baseFeatures : []),
                ...(Array.isArray(plan.additionalFeatures) ? plan.additionalFeatures : [])
            ]);

        featuresToRender.forEach(feature => {
            const item = document.createElement('li');
            item.className = 'flex';
            item.setAttribute('role', 'listitem');

            const pill = document.createElement('span');
            pill.className = [
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold',
                basePlan
                    ? 'bg-secondary-container text-on-secondary-container'
                    : 'bg-primary-container text-on-primary-container'
            ].join(' ');

            const badgeLabel = document.createElement('span');
            badgeLabel.className = 'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide';
            if (basePlan) {
                badgeLabel.classList.add('bg-primary', 'text-on-primary');
            } else {
                badgeLabel.classList.add('bg-secondary', 'text-on-secondary');
            }
            badgeLabel.textContent = basePlan ? (lang === 'ja' ? '追加' : 'New') : (lang === 'ja' ? '基本' : 'Included');
            badgeLabel.setAttribute('aria-hidden', 'true');

            const srPrefix = document.createElement('span');
            srPrefix.className = 'sr-only';
            srPrefix.textContent = basePlan
                ? (lang === 'ja' ? '追加機能: ' : 'Additional feature: ')
                : (lang === 'ja' ? '含まれる機能: ' : 'Included feature: ');

            const textSpan = document.createElement('span');
            textSpan.textContent = getLocalizedText(feature.text, lang);

            pill.append(badgeLabel, srPrefix, textSpan);
            item.appendChild(pill);
            featureList.appendChild(item);
        });

        if (featuresToRender.length > 0) {
            featureSection.appendChild(featureList);
        }

        if (basePlan) {
            const inheritedFeatures = collectPlanFeatures(basePlan, plans);
            if (inheritedFeatures.length > 0) {
                const srInherited = document.createElement('p');
                srInherited.className = 'sr-only';
                const inheritedTexts = inheritedFeatures
                    .map(feature => getLocalizedText(feature.text, lang))
                    .filter(Boolean);
                const basePlanName = getLocalizedText(basePlan.title, lang);
                srInherited.textContent = lang === 'ja'
                    ? `${basePlanName}から継承される機能: ${inheritedTexts.join('、')}。`
                    : `Inherited from ${basePlanName}: ${inheritedTexts.join(', ')}.`;
                featureSection.appendChild(srInherited);
            }
        }

        label.appendChild(featureSection);

        const divider = document.createElement('div');
        divider.className = 'border-t border-outline-variant my-2';
        label.appendChild(divider);

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
 * データ化スピードプラン（@単価表示あり）を描画します。
 * @param {Array<object>} speeds - 表示するスピードオプション一覧。
 *  speeds[i]: { value, title: {ja,en}|string, unitPrice: number, days: number }
 * @param {string} selectedSpeed - 選択中のスピード値。
 */
export function renderDataConversionSpeeds(speeds, selectedSpeed) {
    if (!Array.isArray(speeds)) return;
    if (!dom.dataConversionSpeedSelection) cacheDOMElements();
    const container = dom.dataConversionSpeedSelection;
    if (!container) return;

    const lang = document.documentElement.lang || 'ja';
    container.innerHTML = '';

    speeds.forEach(speed => {
        const wrapper = document.createElement('div');
        wrapper.className = 'relative';

        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'dataConversionSpeed';
        input.value = speed.value;
        input.id = `speed-${speed.value}`;
        input.className = 'sr-only peer';
        if (speed.value === selectedSpeed) input.checked = true;

        const label = document.createElement('label');
        label.setAttribute('for', input.id);
        label.className = [
            'flex h-full flex-col gap-2 rounded-xl border p-4 transition-all focus:outline-none',
            speed.value === selectedSpeed
                ? 'border-green-500 ring-2 ring-green-500 bg-surface-container-highest shadow-lg'
                : 'border-outline bg-surface-container hover:border-green-500 hover:shadow-sm'
        ].join(' ');

        const title = document.createElement('p');
        title.className = 'text-sm font-semibold text-on-surface';
        title.textContent = getLocalizedText(speed.title, lang);

        const unit = document.createElement('p');
        unit.className = 'text-lg font-bold text-primary';
        unit.textContent = `@${speed.unitPrice.toLocaleString()}円/枚`;

        const note = document.createElement('p');
        note.className = 'text-xs text-on-surface-variant';
        note.textContent = speed.days === 0 ? '納期目安: 当日中' : `納期目安: ${speed.days}営業日`;

        label.append(title, unit, note);
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
