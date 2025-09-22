/**
 * @file bizcardSettingsService.js
 * 名刺データ化設定に関するデータ操作を扱うモジュール
 */

// --- Mock Data ---
const mockSurveys = {
    "123": {
        surveyName: `サンプルアンケート`,
        periodStart: '2025-07-01',
        periodEnd: '2025-07-31',
    }
};

const mockSettings = {
    "123": {
        bizcardEnabled: true,
        bizcardRequest: 100,
        dataConversionPlan: 'standard',
        dataConversionSpeed: 'normal',
        couponCode: '',
        internalMemo: 'これは社内用のメモです。'
    }
};

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
    
    // API呼び出しをシミュレート
    await new Promise(resolve => setTimeout(resolve, 300));
    const data = mockSurveys[surveyId];
    if (data) {
        return data;
    }
    throw new Error('Survey not found');
}

/**
 * 指定されたIDの名刺データ化設定を取得します。
 * @param {string} surveyId - アンケートID。
 * @returns {Promise<object>} 設定データ。
 */
export async function fetchBizcardSettings(surveyId) {
    
    // API呼び出しをシミュレート
    await new Promise(resolve => setTimeout(resolve, 300));
    return mockSettings[surveyId] || {
        bizcardEnabled: false,
        bizcardRequest: 0,
        dataConversionPlan: 'standard',
        dataConversionSpeed: 'normal',
        couponCode: '',
        internalMemo: ''
    };
}

/**
 * クーポンコードを検証します。
 * @param {string} code - クーポンコード。
 * @returns {Promise<object>} クーポン情報。
 */
export async function validateCoupon(code) {
    
    await new Promise(resolve => setTimeout(resolve, 500));
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
    
    // API呼び出しをシミュレート
    await new Promise(resolve => setTimeout(resolve, 1500));
    // ここで実際にデータを保存する処理
    mockSettings[settings.surveyId] = settings;
    return { success: true, message: '設定を保存しました。' };
}
