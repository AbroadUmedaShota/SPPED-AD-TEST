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
/**
 * 500件のモックデータを生成します。
 */
const generateMockRecipients = (count) => {
    const companies = ['株式会社A', 'B株式会社', 'Cコーポレーション', '合同会社D', 'E商事', 'Fシステム', 'Gテック', 'Hフーズ', 'I建設', 'J銀行'];
    const departments = ['営業部', '開発部', 'マーケティング部', '総務部', '人事部', '経理部', '広報部', '法務部', 'カスタマーサクセス', ''];
    const titles = ['部長', '課長', 'マネージャー', 'リーダー', '係長', '主任', '一般職', '代表取締役', '役員', ''];
    const names = ['山田 太郎', '佐藤 花子', '鈴木 一郎', '田中 美咲', '高橋 健太', '伊藤 結衣', '渡辺 直樹', '中村 真由美', '小林 剛', '加藤 恵'];

    const data = [];
    for (let i = 1; i <= count; i++) {
        const company = companies[i % companies.length];
        const dept = departments[i % departments.length];
        const title = titles[i % titles.length];
        const name = names[i % names.length];
        const email = `user${i}@example.com`;
        const sendEnabled = i % 10 !== 0; // 10件に1件は初期チェック外す
        const status = sendEnabled ? 'pending' : 'excluded'; // チェックが外れている場合は対象外

        data.push({
            id: i,
            company: `${company} ${i}`,
            department: dept,
            title: title,
            name: name,
            email: email,
            sendEnabled: sendEnabled,
            status: status,
            hasEmptyVariable: dept === '' || title === '',
            sentAt: undefined
        });
    }
    return data;
};

const mockRecipientsData = generateMockRecipients(500);

const DEFAULT_SUBJECT = 'この度はご来場いただきありがとうございました';
const DEFAULT_BODY = `{{会社名}}
{{部署名}} {{役職}}
{{氏名}} 様

この度は「{{アンケート名}}」にご参加いただきまして、誠にありがとうございました。

お忙しい中、貴重なお時間をいただきましたことを心より感謝申し上げます。
いただいたご意見・ご要望は今後のサービス改善に活かしてまいります。

改めてご不明な点やご質問等がございましたら、お気軽にご連絡ください。

どうぞよろしくお願いいたします。

---
{{自社担当者名}}`;

const mockEmailTemplates = {
    'default': { id: 'default', name: '標準文面（初期設定）', subject: DEFAULT_SUBJECT, body: DEFAULT_BODY },
    'special': { id: 'special', name: '特別オファー', subject: '【特別オファー】ご来場者様限定', body: `{{会社名}} {{氏名}}様\n\n先日は、弊社ブースにお立ち寄りいただき、誠にありがとうございました。\n\n特別なご案内がございます。\n\n{{自社担当者名}}` },
};

const mockVariables = ['会社名', '部署名', '役職', '氏名', 'アンケート名', '自社担当者名'];

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
                emailTemplateId: 'default',
                emailSubject: DEFAULT_SUBJECT,
                emailBody: DEFAULT_BODY
              };

        return {
            surveyData: surveyData,
            emailSettings: settings,
            emailTemplates: Object.values(mockEmailTemplates),
            variables: mockVariables.map(v => ({ name: v, value: v }))
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
