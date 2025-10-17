/**
 * @file bizcardSettingsService.js
 * 名刺データ化設定に関するデータ操作を扱うモジュール
 */

import { resolveDashboardDataPath } from '../utils.js';

// --- Mock Data for Coupons (as backend is not implemented) ---
const mockCoupons = {
    'SAVE10': { type: 'discount', value: 1000, message: 'クーポン「SAVE10」が適用されました (-¥1,000)。' },
    'SPEEDUP': { type: 'speedBoost', value: 1, message: 'クーポン「SPEEDUP」が適用されました (納期1営業日短縮)。' }
};

/**
 * 指定されたIDのアンケートデータを取得します。
 * @param {string} surveyId - アンケートID。
 * @returns {Promise<object>} アンケートデータ。
 */
export async function fetchSurveyData(surveyId) {
    try {
        const response = await fetch(resolveDashboardDataPath('core/surveys.json'));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const surveys = await response.json();
        const survey = surveys.find(s => s.id === surveyId);

        if (survey) {
            return {
                surveyName: survey.name.ja,
                periodStart: survey.periodStart,
                periodEnd: survey.periodEnd,
            };
        }
        throw new Error('Survey not found');
    } catch (error) {
        console.error('Failed to fetch survey data:', error);
        throw new Error('Failed to load survey data file.');
    }
}

/**
 * 指定されたIDの名刺データ化設定を取得します。
 * @param {string} surveyId - アンケートID。
 * @returns {Promise<object>} 設定データ。
 */
export async function fetchBizcardSettings(surveyId) {
    try {
        const response = await fetch(resolveDashboardDataPath('core/surveys.json'));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const surveys = await response.json();
        const survey = surveys.find(s => s.id === surveyId);

        if (survey && typeof survey.bizcardSettings === 'object' && survey.bizcardSettings !== null) {
            return survey.bizcardSettings;
        }
        // フォールバック用のデフォルト設定
        return {
            bizcardEnabled: false,
            bizcardRequest: 100,
            dataConversionPlan: 'normal',
            dataConversionSpeed: 'normal',
            couponCode: '',
            internalMemo: ''
        };
    } catch (error) {
        console.error('Failed to fetch bizcard settings:', error);
        throw new Error('Failed to load bizcard settings data.');
    }
}

/**
 * クーポンコードを検証します。
 * @param {string} code - クーポンコード。
 * @returns {Promise<object>} クーポン情報。
 */
export async function validateCoupon(code) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
    const coupon = mockCoupons[code];
    if (coupon) {
        return { success: true, ...coupon };
    }
    return { success: false, message: '無効なクーポンコードです。' };
}

/**
 * 名刺データ化設定を保存します。
 * @param {object} settings - 保存する設定データ。
 * @returns {Promise<object>} 保存結果。
 */
export async function saveBizcardSettings(settings) {
    // This is a mock function. In a real application, this would send data to a server.
    console.log('Saving settings (mock):', settings);
    await new Promise(resolve => setTimeout(resolve, 1500));
    // In a real app, you'd update the data source. Here we just log it.
    return { success: true, message: '設定を保存しました。' };
}
