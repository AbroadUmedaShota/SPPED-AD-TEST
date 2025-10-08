/**
 * @file bizcardCalculator.js
 * 名刺データ化費用の見積もり計算ロジックを扱うモジュール
 */

const PLAN_PRICES = {
    free: 0,
    standard: 0,
    premium: 30000,
    enterprise: 0,
    custom: 0 // カスタムプランは別途計算
};

const SPEED_OPTIONS = {
    normal: { days: 6, price_per_card: 50 },
    express: { days: 3, price_per_card: 100 },
    superExpress: { days: 1, price_per_card: 150 },
    onDemand: { days: 0, price_per_card: 200 }
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

    const selectedPlan = settings.dataConversionPlan || 'free';
    const selectedSpeed = settings.dataConversionSpeed || 'normal';
    const requestedCards = Math.max(0, parseInt(settings.bizcardRequest, 10) || 0);

    let amount = 0;
    let completionDays = SPEED_OPTIONS.normal.days;

    // 1. プラン料金
    amount += PLAN_PRICES[selectedPlan] || 0;

    // 2. スピード料金と納期
    const speedOption = SPEED_OPTIONS[selectedSpeed];
    if (speedOption) {
        completionDays = speedOption.days;
        amount += requestedCards * speedOption.price_per_card;
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
