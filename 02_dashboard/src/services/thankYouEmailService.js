/**
 * @file thankYouEmailService.js
 * お礼メール設定に関するデータ操作を扱うモジュール
 */

// --- Mock Data ---
const mockSurveyData = {
    "123": {
        surveyName: `サンプルアンケート`,
        periodStart: '2025-07-01',
        periodEnd: '2025-07-31',
        isEventFinished: true,
        isBizcardDataReady: true,
        recipientCount: 150,
    }
};

const mockEmailSettings = {
    "123": {
        thankYouEmailEnabled: true,
        sendMethod: 'manual',
        emailTemplateId: 'default',
        emailSubject: 'ご来場ありがとうございました',
        emailBody: '本日はご来場いただき、誠にありがとうございました。\n\n株式会社〇〇\n{会社名} {氏名}様'
    }
};

const mockEmailTemplates = {
    'default': { id: 'default', name: 'デフォルトテンプレート', subject: 'ご来場ありがとうございました', body: '本日はご来場いただき、誠にありがとうございました。\n\n株式会社〇〇\n{会社名} {氏名}様' },
    'special': { id: 'special', name: '特別オファー', subject: '【特別オファー】ご来場者様限定', body: '先日は、弊社ブースにお立ち寄りいただき、誠にありがとうございました。\n\n{会社名} {氏名}様\n\n特別なご案内がございます。' },
};

const mockVariables = ['会社名', '氏名', '部署名', '役職'];

// --- Service Functions ---

/**
 * 必要な初期データをまとめて取得します。
 * @param {string} surveyId - アンケートID。
 * @returns {Promise<object>} 関連データのオブジェクト。
 */
export async function getInitialData(surveyId) {
    console.log(`Fetching initial data for survey ID: ${surveyId}`);
    // 複数のAPI呼び出しをシミュレート
    await new Promise(resolve => setTimeout(resolve, 400));
    const survey = mockSurveyData[surveyId];
    const settings = mockEmailSettings[surveyId];

    if (!survey) {
        throw new Error('Survey not found');
    }

    return {
        surveyData: survey,
        emailSettings: settings || { thankYouEmailEnabled: false, sendMethod: 'manual' },
        emailTemplates: Object.values(mockEmailTemplates),
        variables: mockVariables
    };
}

/**
 * お礼メール設定を保存します。
 * @param {object} settings - 保存する設定データ。
 * @returns {Promise<object>} 保存結果。
 */
export async function saveThankYouEmailSettings(settings) {
    console.log('Saving thank you email settings:', settings);
    await new Promise(resolve => setTimeout(resolve, 1500));
    mockEmailSettings[settings.surveyId] = settings;
    return { success: true, message: '設定を保存しました！' };
}

/**
 * お礼メールを送信します。
 * @param {string} surveyId - アンケートID。
 * @returns {Promise<object>} 送信結果。
 */
export async function sendThankYouEmails(surveyId) {
    const recipientCount = mockSurveyData[surveyId]?.recipientCount || 0;
    console.log(`Sending ${recipientCount} emails for survey ID: ${surveyId}`);
    await new Promise(resolve => setTimeout(resolve, 2500));
    return { success: true, message: `お礼メールの送信を開始しました！ (${recipientCount}件)` };
}
