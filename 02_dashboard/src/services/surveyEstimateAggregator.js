/**
 * @file surveyEstimateAggregator.js
 * SPEED AD アンケート全体料金集計サービス。
 *
 * 名刺データ化（bizcard）とお礼メール（thankYou）それぞれの小計を
 * localStorage に集約し、クーポン・消費税を踏まえた総見込み額を算出する。
 *
 * 純粋関数で構成し、DOM 操作は行わない。
 */

/**
 * localStorage に保存する際のキー接頭辞。
 * 実キーは `${SURVEY_ESTIMATE_KEY_PREFIX}${surveyId || 'temp'}` となる。
 * @type {string}
 */
export const SURVEY_ESTIMATE_KEY_PREFIX = 'surveyEstimate_';

/**
 * 現行スキーマバージョン。
 * @type {number}
 */
const SCHEMA_VERSION = 1;

/**
 * 有効な scope の集合。
 * @type {ReadonlyArray<'bizcard' | 'thankYou'>}
 */
const VALID_SCOPES = Object.freeze(['bizcard', 'thankYou']);

/**
 * surveyId から localStorage キーを生成する。
 * @param {string|null|undefined} surveyId
 * @returns {string}
 */
function buildStorageKey(surveyId) {
    const id = (typeof surveyId === 'string' && surveyId.length > 0) ? surveyId : 'temp';
    return `${SURVEY_ESTIMATE_KEY_PREFIX}${id}`;
}

/**
 * 数値を 0 以上の整数に正規化する。NaN/Infinity/負数は 0 に丸める。
 * @param {*} value
 * @returns {number}
 */
function normalizeSubtotal(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) return 0;
    return Math.floor(num);
}

/**
 * 指定 surveyId の小計集計を取得する。
 * 値が存在しない / JSON parse に失敗した場合は両 scope null のオブジェクトを返す。
 *
 * @param {string|null} surveyId
 * @returns {{
 *   bizcard: { subtotal: number, updatedAt: string } | null,
 *   thankYou: { subtotal: number, updatedAt: string } | null
 * }}
 */
export function getSurveySubtotals(surveyId) {
    const empty = { bizcard: null, thankYou: null };
    try {
        const raw = localStorage.getItem(buildStorageKey(surveyId));
        if (!raw) return empty;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return empty;
        return {
            bizcard: parsed.bizcard && typeof parsed.bizcard === 'object'
                ? { subtotal: normalizeSubtotal(parsed.bizcard.subtotal), updatedAt: String(parsed.bizcard.updatedAt || '') }
                : null,
            thankYou: parsed.thankYou && typeof parsed.thankYou === 'object'
                ? { subtotal: normalizeSubtotal(parsed.thankYou.subtotal), updatedAt: String(parsed.thankYou.updatedAt || '') }
                : null,
        };
    } catch (error) {
        console.warn('[surveyEstimateAggregator] getSurveySubtotals failed to parse localStorage value.', error);
        return empty;
    }
}

/**
 * 指定 surveyId / scope の小計を保存する。
 * 既存の他 scope 値は維持し、対象 scope のみ上書きする。
 *
 * @param {string|null} surveyId
 * @param {'bizcard'|'thankYou'} scope
 * @param {number} subtotal
 * @returns {void}
 */
export function setSurveySubtotal(surveyId, scope, subtotal) {
    if (!VALID_SCOPES.includes(scope)) {
        console.warn(`[surveyEstimateAggregator] setSurveySubtotal: invalid scope "${scope}".`);
        return;
    }

    const normalized = normalizeSubtotal(subtotal);
    const key = buildStorageKey(surveyId);
    const current = getSurveySubtotals(surveyId);

    const next = {
        bizcard: current.bizcard,
        thankYou: current.thankYou,
        schemaVersion: SCHEMA_VERSION,
    };
    next[scope] = {
        subtotal: normalized,
        updatedAt: new Date().toISOString(),
    };

    try {
        localStorage.setItem(key, JSON.stringify(next));
    } catch (error) {
        console.warn('[surveyEstimateAggregator] setSurveySubtotal failed to write localStorage.', error);
    }
}

/**
 * アンケート全体の料金見込みを算出する純粋関数。
 *
 * @param {Object} params
 * @param {number|null} params.bizcardSubtotal  名刺データ化の税抜小計（null = 未設定 → 0 扱い）
 * @param {number|null} params.thankYouSubtotal お礼メールの税抜小計（null = 未設定 → 0 扱い）
 * @param {{ type: string, value: number, code: string }|null} [params.coupon]
 * @param {number} [params.taxRate=0.1] 消費税率
 * @returns {{
 *   subtotalAll: number,
 *   couponAmount: number,
 *   couponPercent: number,
 *   afterCoupon: number,
 *   tax: number,
 *   totalWithTax: number,
 *   isPartial: boolean,
 *   missing: Array<'bizcard'|'thankYou'>,
 *   bizcardSubtotal: number,
 *   thankYouSubtotal: number,
 *   couponApplied: boolean
 * }}
 */
export function computeSurveyTotalEstimate({ bizcardSubtotal, thankYouSubtotal, coupon = null, taxRate = 0.1 } = {}) {
    const missing = [];
    if (bizcardSubtotal === null || bizcardSubtotal === undefined) missing.push('bizcard');
    if (thankYouSubtotal === null || thankYouSubtotal === undefined) missing.push('thankYou');

    const bizcard = Number.isFinite(Number(bizcardSubtotal)) ? Math.max(0, Number(bizcardSubtotal)) : 0;
    const thankYou = Number.isFinite(Number(thankYouSubtotal)) ? Math.max(0, Number(thankYouSubtotal)) : 0;

    const subtotalAll = bizcard + thankYou;

    const couponAmount = coupon
        ? Math.min(subtotalAll, Math.max(0, Number(coupon.value) || 0))
        : 0;

    const afterCoupon = Math.max(0, subtotalAll - couponAmount);
    const tax = Math.floor(afterCoupon * taxRate);
    const totalWithTax = afterCoupon + tax;
    const couponPercent = subtotalAll > 0 ? Math.round((couponAmount / subtotalAll) * 100) : 0;
    const couponApplied = Boolean(coupon && couponAmount > 0);

    return {
        subtotalAll,
        couponAmount,
        couponPercent,
        afterCoupon,
        tax,
        totalWithTax,
        isPartial: missing.length > 0,
        missing,
        bizcardSubtotal: bizcard,
        thankYouSubtotal: thankYou,
        couponApplied,
    };
}
