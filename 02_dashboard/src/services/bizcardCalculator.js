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
 * @param {object|null} appliedCoupon - 適用されたクーポン情報。
 * @returns {object} 計算結果 { amount: number, completionDate: string }。
 */
export function calculateEstimate(settings, appliedCoupon = null, surveyEndDate = null) {
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

    // 3. クーポン適用
    const preDiscount = amount;
    let couponAmount = 0;
    if (appliedCoupon) {
        if (appliedCoupon.type === 'discount') {
            couponAmount = Math.min(preDiscount, Math.max(0, appliedCoupon.value || 0));
            amount = Math.max(0, preDiscount - couponAmount);
        }
        if (appliedCoupon.type === 'speedBoost') {
            completionDays = Math.max(0.1, completionDays - appliedCoupon.value);
        }
    }

    // 4. 完了予定日を計算
    const startDate = surveyEndDate ? new Date(surveyEndDate) : new Date();
    const completionDate = new Date(startDate.setDate(startDate.getDate() + completionDays));
    const formattedCompletionDate = completionDate.toLocaleDateString('ja-JP');

    const couponPercent = preDiscount > 0 ? Math.round((couponAmount / preDiscount) * 100) : 0;
    const minChargeCards = Math.ceil(requestedCards * 0.5);
    const minCharge = minChargeCards > 0 ? minChargeCards * unitPrice : 0;

    return {
        amount,
        completionDate: formattedCompletionDate,
        unitPrice,
        requestedCards,
        preDiscount,
        couponAmount,
        couponPercent,
        minCharge,
        minChargeCards,
        premiumTotal,
        premiumUnitAddOn,
        selectedPremiumOptions,
        premiumSelections
    };
}
