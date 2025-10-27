import { ReportType, BugCategory, Severity } from './types';

export const REPORT_TYPE_OPTIONS = [
  { value: ReportType.Simple, label: '簡易報告' },
  { value: ReportType.Detailed, label: '詳細報告' },
];

export const BUG_CATEGORY_OPTIONS = [
  { value: BugCategory.Display, label: '表示崩れ' },
  { value: BugCategory.Functionality, label: '機能しない' },
  { value: BugCategory.Data, label: 'データ不整合' },
  { value: BugCategory.Error, label: 'エラーメッセージ表示' },
  { value: BugCategory.Other, label: 'その他' },
];

export const SEVERITY_OPTIONS = [
  { value: Severity.Critical, label: '緊急 (サービス停止、データ損失)' },
  { value: Severity.High, label: '高 (主要機能に影響、業務継続困難)' },
  { value: Severity.Medium, label: '中 (一部機能に影響、回避策あり)' },
  { value: Severity.Low, label: '低 (軽微な表示崩れ、改善提案)' },
];

export const DEVICE_OPTIONS = [
  { value: 'pc', label: 'PC' },
  { value: 'smartphone', label: 'スマートフォン' },
  { value: 'tablet', label: 'タブレット' },
  { value: 'other', label: 'その他' },
];

export const OS_OPTIONS = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'macOS' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'other', label: 'その他' },
];

export const BROWSER_OPTIONS = [
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'edge', label: 'Edge' },
  { value: 'safari', label: 'Safari' },
  { value: 'other', label: 'その他' },
];

export const AFFECTED_SCREEN_OPTIONS = [
  { value: 'user_header', label: '--- ユーザー向け画面 ---', disabled: true },
  { value: 'login', label: 'ログイン画面' },
  { value: 'password', label: 'パスワード関連画面' },
  { value: 'user_edit', label: 'アカウント編集画面' },
  { value: 'top', label: 'トップ画面' },
  { value: 'questionnaire_create', label: 'アンケート作成画面' },
  { value: 'questionnaire_answer', label: 'アンケート回答画面' },
  { value: 'questionnaire_confirm', label: 'アンケート回答確認画面' },
  { value: 'thanks', label: 'サンクス画面' },
  { value: 'questionnaire_preview', label: 'アンケートプレビュー画面' },
  { value: 'questionnaire_copy', label: 'アンケートコピー画面' },
  { value: 'bizcard', label: '名刺データ設定画面' },
  { value: 'thanks_mail', label: 'お礼メール設定画面' },
  { value: 'group_create', label: 'グループ作成画面' },
  { value: 'group_setting_done', label: 'グループ設定画面_申し込み完了画面' },
  { value: 'group_join', label: 'グループ参加画面' },
  { value: 'user_admin', label: 'ユーザー管理画面' },
  { value: 'user_admin_add', label: 'ユーザー追加画面' },
  { value: 'terms', label: '利用規約画面' },
  { value: 'tokushou', label: '特定商取引法画面' },
  { value: 'help', label: 'ヘルプ画面' },
  { value: 'admin_header', label: '--- 管理者向け画面 ---', disabled: true },
  { value: 'admin_login', label: '管理者ログイン画面' },
  { value: 'admin_top', label: '管理者トップ画面' },
  { value: 'admin_user_list', label: 'ユーザー一覧画面' },
  { value: 'admin_questionnaire_list', label: 'アンケート一覧画面' },
  { value: 'admin_payment', label: '請求管理画面' },
  { value: 'admin_invoice', label: '請求書画面' },
  { value: 'admin_coupon', label: 'クーポン管理画面' },
  { value: 'admin_calendar', label: '営業日カレンダー管理画面' },
  { value: 'admin_data_input_list', label: 'データ入力一覧画面' },
  { value: 'admin_data_input_screen', label: 'データ入力画面' },
  { value: 'admin_matching_list', label: '照合一覧画面' },
  { value: 'admin_matching_screen', label: '照合画面' },
  { value: 'admin_operator_list', label: 'オペレーター一覧画面' },
  { value: 'admin_achievements', label: '実績画面' },
  { value: 'other', label: 'その他' },
];

export const AFFECTED_MODULE_OPTIONS = [
  { value: 'reporting', label: 'レポート作成' },
  { value: 'campaign_settings', label: 'キャンペーン設定' },
  { value: 'api_integration', label: 'API連携' },
  { value: 'user_management', label: 'ユーザー管理' },
  { value: 'other', label: 'その他' },
];


// --- Google Form Integration ---
// GASから出力された最新の値に更新
export const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSck94R-6gC24A-a4-3gUhEOHsEq-w4jjNw7lNxrWae0JYSflQ/viewform';
export const GOOGLE_FORM_RESPONSE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSck94R-6gC24A-a4-3gUhEOHsEq-w4jjNw7lNxrWae0JYSflQ/formResponse';

export const GOOGLE_FORM_ENTRY_MAP: { [key: string]: string } = {
  // '報告の種類'
  reportType: 'entry.380334184',
  // '不具合の種別'
  bugCategory: 'entry.2115928213',
  // '不具合の概要'
  bugSummary: 'entry.62193751',
  // 'アンケートID/URL'
  questionnaireId: 'entry.190511267',
  // '不具合の再現手順'
  reproductionSteps: 'entry.1520710833',
  // '実際の動作'
  actualBehavior: 'entry.1082578203',
  // '期待される動作'
  expectedBehavior: 'entry.213381702',
  // 'エラーメッセージの内容'
  errorMessage: 'entry.484776830',
  // '氏名'
  reporterName: 'entry.908834656',
  // 'メールアドレス'
  reporterEmail: 'entry.1094668055',
  // '会社名／所属'
  reporterCompany: 'entry.1579476750',
  // '不具合の発生日時'
  occurrenceDateTime: 'entry.1132942488',
  // '利用デバイス'
  device: 'entry.1209857462',
  // 'OS'
  os: 'entry.1190375092',
  // 'ブラウザ名'
  browser: 'entry.1884963090',
  // 'SPEED ADの利用画面'
  speedAdEnvironment: 'entry.130013099',
  // '関連プロジェクトID'
  internalProjectId: 'entry.2098474443',
  // '影響を受けるモジュール/機能'
  affectedModule: 'entry.233073011',
  // '深刻度'
  severity: 'entry.304064915',
  // '社内メモ'
  internalNotes: 'entry.2135905601',
  // '担当者候補'
  assigneeSuggestion: 'entry.677635520',

  // --- Updated from Form Response ---
  // '機種名・シリーズ名'
  deviceName: 'entry.1599683027',
  // 'ブラウザのバージョン'
  browserVersion: 'entry.1153774805',
  // 'スクリーンショットファイル名'
  screenshotFilename: 'entry.1454262670',
  // 'スクリーンショット(base64)'
  screenshot: 'entry.1559286548',
};