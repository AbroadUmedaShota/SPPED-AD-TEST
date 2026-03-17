/**
 * @file thankYouEmailCalculator.js
 * お礼メールの費用見積もりを計算するモジュール
 */

/**
 * お礼メールの費用見積もりを計算します。
 * @param {number} activeCount - 送信対象者数
 * @param {object|null} coupon - 適用されたクーポン情報
 * @returns {object} 計算結果
 */
export function calculateThankYouEmailEstimate(activeCount, coupon = null) {
    const FREE_LIMIT = 100;
    const UNIT_PRICE = 1; // 1通 1円
    const TAX_RATE = 0.1; // 消費税 10%

    // 1. 基本料金計算 (税抜)
    const baseAmount = activeCount * UNIT_PRICE;
    
    // 2. 無料枠の適用
    const freeAppliedCount = Math.min(activeCount, FREE_LIMIT);
    const freeDiscount = freeAppliedCount * UNIT_PRICE;

    // 3. 無料枠適用後の金額
    const amountAfterFree = Math.max(0, baseAmount - freeDiscount);

    // 4. クーポン適用
    let couponDiscount = 0;
    if (coupon && coupon.success) {
        if (coupon.discountType === 'fixed') {
            couponDiscount = coupon.discountValue;
        } else if (coupon.discountType === 'percent') {
            couponDiscount = Math.floor(amountAfterFree * (coupon.discountValue / 100));
        }
    }

    // 5. 税抜合計金額
    const subtotal = Math.max(0, amountAfterFree - couponDiscount);

    // 6. 消費税計算
    const tax = Math.floor(subtotal * TAX_RATE);

    // 7. 税込合計金額
    const totalWithTax = subtotal + tax;

    return {
        activeCount,
        unitPrice: UNIT_PRICE,
        baseAmount,
        freeAppliedCount,
        freeDiscount,
        couponDiscount,
        subtotal,
        tax,
        totalWithTax,
        isFree: subtotal === 0
    };
}
