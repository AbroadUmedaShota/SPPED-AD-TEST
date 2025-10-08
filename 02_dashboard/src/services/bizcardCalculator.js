/**
 * @file bizcardCalculator.js
 * 名刺データ化費用の見積もり計算ロジックを扱うモジュール
 */

const PLAN_PRICES = {
    free: 0,
    standard: 5000,
    premium: 12000,
    enterprise: 25000,
    custom: 0 // カスタムプランは別途計算
};

const SPEED_OPTIONS = {
    normal: { days: 3, price_per_card: 10 },
    express: { days: 1, price_per_card: 20 },
    superExpress: { days: 0.5, price_per_card: 30 },
    onDemand: { days: 0.1, price_per_card: 50 }
};

/**
 * 見積もりを計算します。
 * @param {object} settings - ユーザーが選択した設定。
 * @param {object|null} appliedCoupon - 適用されたクーポン情報。
 * @returns {object} 計算結果 { amount: number, completionDate: string }。
 */
export function calculateEstimate(settings, appliedCoupon = null) {
    if (!settings.bizcardEnabled) {
        return { amount: 0, completionDate: '未定' };
    }

    let amount = 0;
    let completionDays = 3; // デフォルト

    // 1. プラン料金
    amount += PLAN_PRICES[settings.dataConversionPlan] || 0;

    // 2. スピード料金と納期
    const speedOption = SPEED_OPTIONS[settings.dataConversionSpeed];
    if (speedOption) {
        completionDays = speedOption.days;
        amount += (settings.bizcardRequest || 0) * speedOption.price_per_card;
    }

    // 3. クーポン適用
    if (appliedCoupon) {
        if (appliedCoupon.type === 'discount') {
            amount = Math.max(0, amount - appliedCoupon.value);
        }
        if (appliedCoupon.type === 'speedBoost') {
            completionDays = Math.max(0.1, completionDays - appliedCoupon.value);
        }
    }

    // 4. 完了予定日を計算
    const today = new Date();
    const completionDate = new Date(today.setDate(today.getDate() + completionDays));
    const formattedCompletionDate = completionDate.toLocaleDateString('ja-JP');

    return { amount, completionDate: formattedCompletionDate };
}
