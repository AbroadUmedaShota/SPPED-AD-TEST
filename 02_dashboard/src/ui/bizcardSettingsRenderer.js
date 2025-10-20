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
    const requestCount = Number.isFinite(parsedRequest) && parsedRequest > 0 ? parsedRequest : 100;

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
  const normalizedPlan = selectedPlan || DEFAULT_PLAN;
  container.innerHTML = '';

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'overflow-hidden rounded-xl border border-outline-variant/60 bg-surface shadow-sm';

  const table = document.createElement('table');
  table.className = 'min-w-full table-fixed';
  table.setAttribute('role', 'presentation');

  const thead = document.createElement('thead');
  thead.className = 'bg-surface-container text-left text-xs font-semibold uppercase tracking-widest text-on-surface-variant';

  const headerRow = document.createElement('tr');
  const headers = [
    { label: '', className: 'w-12 px-4 py-3 text-center sm:px-6' },
    { label: lang === 'ja' ? 'プラン名' : 'Plan', className: 'px-4 py-3 sm:px-6' },
    { label: lang === 'ja' ? '単価' : 'Unit price', className: 'px-4 py-3 text-right sm:px-6' },
    { label: lang === 'ja' ? '項目数' : 'Fields', className: 'px-4 py-3 text-right sm:px-6' },
    { label: lang === 'ja' ? '納期' : 'Turnaround', className: 'px-4 py-3 text-right sm:px-6' }
  ];

  headers.forEach(header => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.className = header.className;
    th.textContent = header.label;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  const tbody = document.createElement('tbody');
  tbody.className = 'divide-y divide-outline-variant/30';

  plans.forEach(plan => {
    const isSelected = plan.value === normalizedPlan;
    const row = document.createElement('tr');
    row.className = [
      'cursor-pointer transition-colors',
      isSelected ? 'bg-primary/10' : 'hover:bg-surface-container-highest'
    ].join(' ');

    const selectCell = document.createElement('td');
    selectCell.className = 'px-4 py-4 text-center sm:px-6';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'dataConversionPlan';
    input.value = plan.value;
    input.id = `data-plan-${plan.value}`;
    input.className = 'h-4 w-4 border-outline text-primary focus:ring-primary';
    input.checked = isSelected;
    selectCell.appendChild(input);
    row.appendChild(selectCell);

    const planCell = document.createElement('td');
    planCell.className = 'px-4 py-4 sm:px-6';
    const planStack = document.createElement('div');
    planStack.className = 'flex flex-col gap-1';
    const title = document.createElement('p');
    title.className = isSelected
      ? 'text-sm font-semibold text-primary'
      : 'text-sm font-semibold text-on-surface';
    title.textContent = getLocalizedText(plan.title, lang);
    planStack.appendChild(title);

    const description = getLocalizedText(plan.description, lang);
    const tagline = getLocalizedText(plan.tagline, lang);
    const helperText = description || tagline;
    if (helperText) {
      const note = document.createElement('p');
      note.className = 'text-xs text-on-surface-variant';
      note.textContent = helperText;
      planStack.appendChild(note);
    }
    planCell.appendChild(planStack);
    row.appendChild(planCell);

    const priceCell = document.createElement('td');
    priceCell.className = 'px-4 py-4 text-right text-sm font-semibold sm:px-6';
    priceCell.textContent = getLocalizedText(plan.unitPriceLabel || plan.price, lang);
    row.appendChild(priceCell);

    const itemCell = document.createElement('td');
    itemCell.className = 'px-4 py-4 text-right text-sm font-semibold sm:px-6';
    itemCell.textContent = getLocalizedText(plan.itemCountLabel, lang);
    row.appendChild(itemCell);

    const turnaroundCell = document.createElement('td');
    turnaroundCell.className = 'px-4 py-4 text-right text-sm font-semibold sm:px-6';
    turnaroundCell.textContent = getLocalizedText(plan.turnaroundLabel, lang);
    row.appendChild(turnaroundCell);

    row.addEventListener('click', event => {
      const target = event.target;
      if (target instanceof HTMLInputElement) return;
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    tbody.appendChild(row);
  });

  table.append(thead, tbody);
  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);
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
