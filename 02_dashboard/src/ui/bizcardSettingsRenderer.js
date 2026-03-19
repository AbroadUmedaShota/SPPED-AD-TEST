/**
 * @file bizcardSettingsRenderer.js
 * 名刺データ化設定画面のUI描画と更新を扱うモジュール
 */

// DOM要素をこのモジュール内で管理
import { DEFAULT_PLAN } from '../services/bizcardPlans.js';

const dom = {};

function getLocalizedText(content, lang) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (typeof content === 'object') {
        return content[lang] || content.ja || Object.values(content)[0] || '';
    }
    return String(content);
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
    dom.premiumOptionsContainer = document.getElementById('premiumOptionsContainer');
    dom.estimatedAmountSpan = document.getElementById('estimatedAmount');
    dom.estimatedCompletionDateSpan = document.getElementById('estimatedCompletionDate');
    dom.estimateBreakdown = document.getElementById('estimateBreakdown');
    dom.minChargeNotice = document.getElementById('minChargeNotice');
    dom.minChargeNoticeText = document.getElementById('minChargeNoticeText');
    dom.bizcardRequestSlider = document.getElementById('bizcardRequestSlider');
    dom.bizcardRequestPresets = document.getElementById('bizcardRequestPresets');
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

    const planValue = settings.dataConversionPlan || DEFAULT_PLAN;
    const parsedRequest = parseInt(settings.bizcardRequest, 10);
    const requestCount = Number.isFinite(parsedRequest) && parsedRequest >= 0 ? parsedRequest : 100;

    dom.bizcardRequestInput.value = requestCount;
    dom.couponCodeInput.value = settings.couponCode || '';
    dom.internalMemo.value = settings.internalMemo || '';

    // ラジオボタンの選択
    const planRadio = document.querySelector(`input[name="dataConversionPlan"][value="${planValue}"]`);
    if (planRadio) {
        planRadio.checked = true;
    } else {
        const fallbackPlanRadio = document.querySelector(`input[name="dataConversionPlan"][value="${DEFAULT_PLAN}"]`);
        if (fallbackPlanRadio) fallbackPlanRadio.checked = true;
    }

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
        const lang = document.documentElement.lang || 'ja';
        const cards = estimate.requestedCards ?? 0;
        const unit = estimate.unitPrice ?? 0;
        const couponAmt = estimate.couponAmount ?? 0;
        const couponPct = estimate.couponPercent ?? 0;
        const premiumUnit = estimate.premiumUnitAddOn ?? 0;
        const premiumTotal = estimate.premiumTotal ?? 0;
        const minCharge = estimate.minCharge ?? 0;
        const minChargeLine = minCharge > 0
            ? `<div class="text-xs text-on-surface-variant">※ 最低ご請求金額 ¥${minCharge.toLocaleString()}（＋税）</div>`
            : '';
        const baseLine = `${cards.toLocaleString()}件 × データ化単価 ${unit.toLocaleString()}円`;
        const premiumLine = premiumTotal > 0
            ? `＋ ${cards.toLocaleString()}件 × プレミアム加算 ${premiumUnit.toLocaleString()}円`
            : '';
        const couponLine = couponAmt > 0
            ? `ー クーポンお値引き ${couponAmt.toLocaleString()}円（${couponPct}%相当）`
            : '';
        const breakdownLines = [baseLine, premiumLine, couponLine].filter(Boolean).join('<br>');
        const premiumSelections = Array.isArray(estimate.selectedPremiumOptions)
            ? estimate.selectedPremiumOptions
            : [];
        const premiumSummary = premiumSelections.length > 0
            ? `<div class="text-xs text-on-surface-variant">選択オプション: ${premiumSelections
                .map(option => getLocalizedText(option.title, lang))
                .join('、')}</div>`
            : '';
        dom.estimateBreakdown.innerHTML = `
            <div class="space-y-3 text-on-surface-variant">
              <div class="flex items-center justify-between text-sm">
                <span class="text-on-surface-variant">想定件数</span>
                <span class="text-base font-semibold text-on-surface">${cards.toLocaleString()}件</span>
              </div>
              <div class="space-y-2">
                <div class="text-xs uppercase tracking-widest text-on-surface-variant">内訳</div>
                <div class="rounded-2xl border border-outline-variant bg-surface p-3 text-xs leading-relaxed">
                  ${breakdownLines || '—'}
                </div>
              </div>
              ${premiumSummary}
              <div class="text-sm font-semibold text-on-surface">＝ ご請求見込み金額 ¥${estimate.amount.toLocaleString()}（＋税）</div>
              ${minChargeLine}
            </div>
        `;
    }
    // minChargeNotice: new structure is <div id="minChargeNotice"><span material-icons/><span id="minChargeNoticeText"/></div>
    if (dom.minChargeNotice) {
        if (!dom.minChargeNoticeText) dom.minChargeNoticeText = document.getElementById('minChargeNoticeText');
        const requestedCards = estimate.requestedCards ?? 0;
        const minChargeCards = estimate.minChargeCards ?? (requestedCards > 0 ? Math.ceil(requestedCards * 0.5) : 0);
        if (requestedCards > 0 && (estimate.minCharge ?? 0) > 0 && minChargeCards > 0) {
            const cardsText = minChargeCards.toLocaleString();
            const amountText = (estimate.minCharge ?? 0).toLocaleString();
            if (dom.minChargeNoticeText) {
                dom.minChargeNoticeText.textContent = `実際の件数が${cardsText}枚に満たない場合でも${cardsText}枚分（¥${amountText}）をご請求します。`;
            }
            dom.minChargeNotice.classList.remove('hidden');
            dom.minChargeNotice.classList.add('flex');

            if (requestedCards < minChargeCards) {
                dom.minChargeNotice.classList.add('text-error', 'bg-error/10', 'border-error/20');
                dom.minChargeNotice.classList.remove('text-on-surface-variant', 'bg-surface-variant/30', 'border-outline-variant/40');
            } else {
                dom.minChargeNotice.classList.remove('text-error', 'bg-error/10', 'border-error/20');
                dom.minChargeNotice.classList.add('text-on-surface-variant', 'bg-surface-variant/30', 'border-outline-variant/40');
            }
        } else {
            if (dom.minChargeNoticeText) dom.minChargeNoticeText.textContent = '';
            dom.minChargeNotice.classList.add('hidden');
            dom.minChargeNotice.classList.remove('flex');
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
  const normalizedPlan = selectedPlan || DEFAULT_PLAN;
  container.innerHTML = '';

  plans.forEach(plan => {
    const isSelected = plan.value === normalizedPlan;
    
    const label = document.createElement('label');
    label.className = [
      'relative flex cursor-pointer flex-col rounded-2xl border-2 p-5 transition-all duration-200 bg-surface text-left select-none',
      isSelected 
        ? 'border-primary ring-1 ring-primary/20 bg-primary/5 shadow-md scale-[1.01] z-10' 
        : 'border-outline-variant/60 hover:border-primary/40 hover:bg-surface-variant hover:shadow-sm'
    ].join(' ');

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'dataConversionPlan';
    input.value = plan.value;
    input.id = `data-plan-${plan.value}`;
    input.className = 'peer sr-only';
    input.checked = isSelected;

    const header = document.createElement('div');
    header.className = 'flex items-start justify-between border-b border-outline-variant/50 pb-3 mb-3 shrink-0';
    
    const titleFlex = document.createElement('div');
    titleFlex.className = 'flex items-center gap-2.5';
    
    if (plan.icon) {
       const iconDiv = document.createElement('div');
       iconDiv.className = `flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${plan.accentGradient} text-white shadow-sm shrink-0`;
       const iconSpan = document.createElement('span');
       iconSpan.className = 'material-icons text-[18px]';
       iconSpan.textContent = plan.icon;
       iconDiv.appendChild(iconSpan);
       titleFlex.appendChild(iconDiv);
    }
    
    const titleInfo = document.createElement('div');
    titleInfo.className = 'flex flex-col';
    
    const titleWrapper = document.createElement('div');
    titleWrapper.className = 'flex items-center gap-1.5 flex-wrap';
    
    const titleText = document.createElement('span');
    titleText.className = [
        'font-bold text-base leading-tight',
        isSelected ? 'text-primary' : 'text-on-surface'
    ].join(' ');
    titleText.textContent = getLocalizedText(plan.title, lang);
    titleWrapper.appendChild(titleText);
    
    if (plan.badge) {
        const badge = document.createElement('span');
        badge.className = 'rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary border border-primary/20 shrink-0';
        badge.textContent = getLocalizedText(plan.badge, lang);
        titleWrapper.appendChild(badge);
    }
    
    titleInfo.appendChild(titleWrapper);
    titleFlex.appendChild(titleInfo);
    
    const radioUiContainer = document.createElement('div');
    radioUiContainer.className = 'flex h-6 w-6 items-center justify-center shrink-0 mt-0.5 ml-2';
    
    const radioUi = document.createElement('div');
    radioUi.className = [
        'flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all',
        isSelected ? 'border-primary bg-primary shadow-sm shadow-primary/30' : 'border-outline-variant bg-surface'
    ].join(' ');
    const radioInner = document.createElement('div');
    radioInner.className = [
        'h-2 w-2 rounded-full bg-surface transition-transform duration-200',
        isSelected ? 'scale-100' : 'scale-0'
    ].join(' ');
    radioUi.appendChild(radioInner);
    radioUiContainer.appendChild(radioUi);
    
    header.append(titleFlex, radioUiContainer);
    
    const body = document.createElement('div');
    body.className = 'flex-1 flex flex-col justify-between';
    
    const features = [
       { icon: 'sell', label: lang === 'ja' ? '単価' : 'Price', value: getLocalizedText(plan.unitPriceLabel || plan.price, lang) },
       { icon: 'data_object', label: lang === 'ja' ? '項目数' : 'Fields', value: getLocalizedText(plan.itemCountLabel, lang) },
       { icon: 'schedule', label: lang === 'ja' ? '納期' : 'Speed', value: getLocalizedText(plan.turnaroundLabel, lang) }
    ];
    
    const ul = document.createElement('ul');
    ul.className = 'space-y-2 text-sm text-on-surface mb-3';
    features.forEach(f => {
       const li = document.createElement('li');
       li.className = 'flex items-center justify-between border-b border-outline-variant/30 pb-1.5 last:border-0 last:pb-0';
       
       const liLeft = document.createElement('div');
       liLeft.className = 'flex items-center gap-1.5 text-on-surface-variant';
       const listIcon = document.createElement('span');
       listIcon.className = 'material-icons text-[14px] opacity-70';
       listIcon.textContent = f.icon;
       const listLabel = document.createElement('span');
       listLabel.className = 'font-semibold text-[13px]';
       listLabel.textContent = f.label;
       liLeft.append(listIcon, listLabel);
       
       const liRight = document.createElement('span');
       liRight.className = 'font-bold text-[14px]';
       liRight.textContent = f.value;
       
       li.append(liLeft, liRight);
       ul.appendChild(li);
    });
    
    const bottomSection = document.createElement('div');
    bottomSection.className = 'mt-auto pt-2';
    
    if (plan.tagline) {
        const tagline = document.createElement('p');
        tagline.className = [
            'text-[11px] font-bold p-1.5 rounded text-center transition-colors',
            isSelected ? 'text-primary bg-primary/10' : 'text-on-surface-variant bg-surface-container-highest'
        ].join(' ');
        tagline.textContent = getLocalizedText(plan.tagline, lang);
        bottomSection.appendChild(tagline);
    }
    
    body.append(ul, bottomSection);
    
    label.addEventListener('click', event => {
      if (event.target === input) return;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    
    label.append(input, header, body);
    container.appendChild(label);
  });
}

export function renderPremiumOptions(optionGroups, selections) {
  if (!dom.premiumOptionsContainer) cacheDOMElements();
  const container = dom.premiumOptionsContainer;
  if (!container || !Array.isArray(optionGroups)) return;

  const lang = document.documentElement.lang || 'ja';
  const normalizedSelections = selections || {};
  const additionalItems = new Set(normalizedSelections.additionalItems || []);
  container.innerHTML = '';

  optionGroups.forEach(group => {
    const card = document.createElement('div');
    card.className = 'rounded-xl border border-outline-variant/60 bg-surface p-4 shadow-sm';

    const header = document.createElement('div');
    header.className = 'flex items-start justify-between gap-3';

    const titleBlock = document.createElement('div');
    titleBlock.className = 'space-y-1';
    const title = document.createElement('p');
    title.className = 'text-sm font-semibold text-on-surface';
    title.textContent = getLocalizedText(group.title, lang);
    titleBlock.appendChild(title);

    const description = document.createElement('p');
    description.className = 'text-xs text-on-surface-variant';
    description.textContent = getLocalizedText(group.description, lang);
    titleBlock.appendChild(description);
    header.appendChild(titleBlock);

    if (group.unitPriceLabel) {
      const badge = document.createElement('span');
      badge.className = 'rounded-full border border-primary/40 bg-primary/5 px-3 py-1 text-[11px] font-semibold text-primary';
      badge.textContent = getLocalizedText(group.unitPriceLabel, lang);
      header.appendChild(badge);
    }

    card.appendChild(header);

    if (group.type === 'toggle') {
      const optionId = `premium-${group.value}`;
      const toggleLabel = document.createElement('label');
      toggleLabel.setAttribute('for', optionId);
      toggleLabel.className = 'mt-3 flex items-center justify-between rounded-lg border border-outline-variant/50 bg-surface-container-highest px-3 py-2';

      const textLabel = document.createElement('span');
      textLabel.className = 'text-sm text-on-surface-variant';
      textLabel.textContent = lang === 'ja' ? '必要に応じてチェックしてください' : 'Check to enable';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = optionId;
      input.name = 'premiumMultilingual';
      input.className = 'h-4 w-4 rounded border-outline text-primary focus:ring-primary';
      input.checked = Boolean(normalizedSelections[group.value]);

      toggleLabel.append(textLabel, input);
      card.appendChild(toggleLabel);
    }

    if (group.type === 'multi' && Array.isArray(group.options)) {
      const list = document.createElement('div');
      list.className = 'mt-3 grid gap-2';

      group.options.forEach(option => {
        const optionId = `premium-${group.value}-${option.value}`;
        const optionLabel = document.createElement('label');
        optionLabel.setAttribute('for', optionId);
        optionLabel.className = 'flex items-start gap-3 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-3 py-2';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.id = optionId;
        input.name = 'premiumAdditionalItems';
        input.value = option.value;
        input.className = 'mt-1 h-4 w-4 rounded border-outline text-primary focus:ring-primary';
        input.checked = additionalItems.has(option.value);

        const textStack = document.createElement('div');
        textStack.className = 'flex flex-col';
        const optionTitle = document.createElement('p');
        optionTitle.className = 'text-sm font-medium text-on-surface';
        optionTitle.textContent = getLocalizedText(option.title, lang);
        const optionDescription = document.createElement('p');
        optionDescription.className = 'text-xs text-on-surface-variant';
        optionDescription.textContent = getLocalizedText(option.description, lang);
        textStack.append(optionTitle, optionDescription);

        optionLabel.append(input, textStack);
        list.appendChild(optionLabel);
      });

      card.appendChild(list);
    }

    container.appendChild(card);
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
 * @param {boolean} isSkipped - スキップ状態かどうか。
 * @returns {boolean} 検証が成功したかどうか。
 */
export function validateForm(isSkipped = false) {
    if (!dom.bizcardRequestInput || !dom.saveButton) cacheDOMElements();
    let isValid = true;
    
    // スキップされている場合は常に有効とする
    if (isSkipped) {
        const errorEl = dom.bizcardRequestInput.parentElement.querySelector('.input-error-message');
        if (errorEl) errorEl.textContent = '';
        dom.bizcardRequestInput.classList.remove('border-error');
        dom.saveButton.disabled = false;
        return true;
    }

    const value = parseInt(dom.bizcardRequestInput.value || 0, 10);
    const errorEl = dom.bizcardRequestInput.parentElement.querySelector('.input-error-message');
    
    if (isNaN(value) || value <= 0) {
        if (errorEl) errorEl.textContent = '依頼枚数は1枚以上入力してください。';
        dom.bizcardRequestInput.classList.add('border-error');
        isValid = false;
    } else {
        if (errorEl) errorEl.textContent = '';
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
