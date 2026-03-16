/**
 * @file thankYouEmailService.js
 * お礼メール設定に関するデータ操作を扱うモジュール
 */

import { resolveDashboardDataPath } from '../utils.js';

// --- Mock Data ---

/**
 * @typedef {Object} Recipient
 * @property {number}  id          - 内部識別ID
 * @property {string}  company     - 企業名
 * @property {string}  department  - 部署名（空文字の場合あり）
 * @property {string}  title       - 役職名（空文字の場合あり）
 * @property {string}  name        - 氏名
 * @property {string}  email       - メールアドレス
 * @property {boolean} sendEnabled - 送信チェックボックスの初期値
 * @property {string}  status      - 'pending' | 'sent' | 'sent_with_warning' | 'failed' | 'excluded'
 * @property {string}  [errorMsg]  - status が 'failed' の場合のエラー理由
 * @property {boolean} [hasEmptyVariable] - true の場合、差し込み変数に空値が含まれていた（⚠️表示の根拠）
 * @property {string}  [sentAt]    - 送信日時（ISO 8601。未送信・対象外は undefined）
 */
const mockRecipientsData = [
    { id: 1, company: '株式会社A', department: '営業部', title: '部長', name: '山田 太郎', email: 'yamada@example.com', sendEnabled: true, status: 'pending', hasEmptyVariable: false },
    { id: 2, company: 'B株式会社', department: '', title: '', name: '佐藤 花子', email: 'sato@example.com', sendEnabled: true, status: 'pending', hasEmptyVariable: true }, // Empty variables
    { id: 3, company: 'Cコーポレーション', department: '開発部', title: 'マネージャー', name: '鈴木 一郎', email: 'suzuki@example.com', sendEnabled: true, status: 'pending', hasEmptyVariable: false },
    { id: 4, company: '合同会社D', department: 'マーケティング部', title: 'リーダー', name: '田中 美咲', email: 'tanaka@example.com', sendEnabled: false, status: 'excluded', hasEmptyVariable: false }, // Initially excluded
    { id: 5, company: 'E商事', department: '総務部', title: '', name: '高橋 健太', email: 'takahashi@example.com', sendEnabled: true, status: 'pending', hasEmptyVariable: true },
];

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
    try {
        console.log('Attempting to fetch surveys.json...');
        const response = await fetch(resolveDashboardDataPath('core/surveys.json'));
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const surveys = await response.json();
        const survey = surveys.find(s => s.id === surveyId);

        if (!survey) {
            throw new Error('Survey not found');
        }

        // Note: Some data is still mocked as it's not in surveys.json
        const surveyData = {
            surveyName: survey.name.ja,
            periodStart: survey.periodStart,
            periodEnd: survey.periodEnd,
            isEventFinished: survey.status === '終了',
            isBizcardDataReady: survey.bizcardCompletionCount > 0,
            recipientCount: survey.answerCount, // Assuming recipient count is answer count
        };

        const settings = (survey && typeof survey.thankYouEmailSettings === 'object' && survey.thankYouEmailSettings !== null) 
            ? survey.thankYouEmailSettings 
            : { 
                thankYouEmailEnabled: true, 
                sendMethod: 'manual',
                emailTemplateId: '',
                emailSubject: '',
                emailBody: ''
              };

        return {
            surveyData: surveyData,
            emailSettings: settings,
            emailTemplates: Object.values(mockEmailTemplates),
            variables: mockVariables
        };

    } catch (error) {
        console.error('Failed to get initial data:', error);
        throw new Error('Failed to load initial data.');
    }
}

/**
 * アンケートIDに紐づく回答者（送信対象者）のモックデータを取得します。
 * @param {string} surveyId 
 * @returns {Promise<Array<Recipient>>}
 */
export async function getRecipientsData(surveyId) {
    // In a real app, you'd fetch based on surveyId. Here we return mock data.
    await new Promise(resolve => setTimeout(resolve, 300));
    return JSON.parse(JSON.stringify(mockRecipientsData)); // Deep copy to avoid mutating original mock
}

/**
 * お礼メール設定を保存します。
 * @param {object} settings - 保存する設定データ。
 * @returns {Promise<object>} 保存結果。
 */
export async function saveThankYouEmailSettings(settings) {
    
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
    
    await new Promise(resolve => setTimeout(resolve, 2500));
    return { success: true, message: `お礼メールの送信を開始しました！ (${recipientCount}件)` };
}
