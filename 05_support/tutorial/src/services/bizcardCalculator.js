/**
 * @file bizcardCalculator.js
 * 名刺データ化費用の見積もり計算ロジックを扱うモジュール
 */

import {
    DEFAULT_PLAN,
    PREMIUM_OPTION_GROUPS,
    getPlanConfig,
    normalizePlanValue,
    normalizePremiumOptions
} from './bizcardPlans.js';

/**
 * 見積もりを計算します。
 * @param {object} settings - ユーザーが選択した設定。
 * @returns {object} 計算結果 { amount: number, completionDate: string }。
 */
export function calculateEstimate(settings, surveyEndDate = null) {
    if (!settings.bizcardEnabled) {
        return { amount: 0, completionDate: '未定' };
    }

    const normalizedPlan = normalizePlanValue(settings.dataConversionPlan || DEFAULT_PLAN);
    const planConfig = getPlanConfig(normalizedPlan) || getPlanConfig(DEFAULT_PLAN);
    const unitPrice = planConfig?.unitPrice ?? 0;
    const turnaroundDays = planConfig?.turnaroundDays ?? 0;
    const requestedCards = Math.max(0, parseInt(settings.bizcardRequest, 10) || 0);

    let amount = 0;
    let completionDays = turnaroundDays;

    if (normalizedPlan !== 'trial') {
        amount += requestedCards * unitPrice;
    }

    const premiumSelections = normalizePremiumOptions(settings.premiumOptions);
    const multilingualGroup = PREMIUM_OPTION_GROUPS.find(group => group.value === 'multilingual');
    const additionalGroup = PREMIUM_OPTION_GROUPS.find(group => group.value === 'additionalItems');

    const premiumUnitAddOn = premiumSelections.multilingual
        ? (multilingualGroup?.unitPrice ?? 0)
        : 0;
    const premiumTotal = requestedCards * premiumUnitAddOn;
    amount += premiumTotal;

    const selectedPremiumOptions = [];
    if (premiumSelections.multilingual && multilingualGroup) {
        selectedPremiumOptions.push({ value: multilingualGroup.value, title: multilingualGroup.title });
    }

    const additionalOptionsMap = new Map((additionalGroup?.options || []).map(option => [option.value, option]));
    premiumSelections.additionalItems.forEach(itemValue => {
        const option = additionalOptionsMap.get(itemValue);
        if (option) {
            selectedPremiumOptions.push({ value: option.value, title: option.title });
        }
    });

    const subtotal = amount;            // 税抜・クーポン未適用
    const preDiscount = subtotal;       // 互換用（旧名残）
    const couponAmount = 0;             // 常に 0（値引きは aggregator 側でのみ）
    const couponPercent = 0;

    // 4. 完了予定日を計算
    const startDate = surveyEndDate ? new Date(surveyEndDate) : new Date();
    const calculationBaseDate = new Date(startDate); // 基点の日付を保持
    const completionDate = new Date(startDate.setDate(startDate.getDate() + completionDays));
    const formattedCompletionDate = completionDate.toLocaleDateString('ja-JP');

    const minChargeCards = Math.ceil(requestedCards * 0.5);
    const minCharge = minChargeCards > 0 ? minChargeCards * unitPrice : 0;

    return {
        amount,                  // ＝ subtotal（互換維持）
        subtotal,                // 新設: 税抜・クーポン未適用
        completionDate: formattedCompletionDate,
        turnaroundDays: completionDays,
        calculationBaseDate: calculationBaseDate.toLocaleDateString('ja-JP'),
        unitPrice,
        requestedCards,
        preDiscount,
        couponAmount: 0,         // 互換: 常に 0
        couponPercent: 0,
        minCharge,
        minChargeCards,
        premiumTotal,
        premiumUnitAddOn,
        selectedPremiumOptions,
        premiumSelections
    };
}
