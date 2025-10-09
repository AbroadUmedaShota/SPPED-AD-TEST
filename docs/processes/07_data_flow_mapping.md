# 07 データ流通マッピング（サービス準拠／ドラフト v1）

本サービスにおける JSON（モック）→ Service 層 → UI 表示の代表的マッピングを示します。

## サーベイ
- データ
  - `data/surveys/*.json`, `data/surveys/surveys-with-details.json`
- サービス／UI
  - `02_dashboard/src/services/surveyService.js`
  - `02_dashboard/src/ui/surveyRenderer.js`
- 主なフィールド
  - `name`, `displayTitle`, `description`, `periodStart`, `periodEnd`, `plan`, `deadline`, `memo`
  - `questionGroups[].questions[]`（`questionId`, `type`, `text`, `required`, `options[]`）

## 回答・スピードレビュー
- データ
  - `data/demo_answers/*.json`（デモ）, `data/responses/*.json`（モック）
  - 名刺: `data/demo_business-cards/*.json`
- サービス／UI
  - `02_dashboard/src/services/speedReviewService.js`, `02_dashboard/src/ui/speedReviewRenderer.js`
- 主なフィールド
  - `answerId`, `surveyId`, `answeredAt`, `isTest`
  - `details[]`（`question`, `answer`（string｜string[]））
  - `businessCard.group*`（会社名・氏名・部署／役職・連絡先 など）

## 請求
- データ
  - `data/core/invoices.json`（想定。一覧／詳細参照）
- サービス／UI
  - `02_dashboard/src/services/invoiceService.js`, `02_dashboard/src/ui/invoiceRenderer.js`, `invoiceDetailRenderer.js`
- 主なフィールド
  - ヘッダ: `invoiceId`, `issueDate`, `dueDate`, `corporateName`, `contactPerson`
  - 金額: `subtotalTaxable`, `tax`, `subtotalNonTaxable`, `totalAmount`
  - 口座: `bankInfo.*`

## 汎用
- 共通ユーティリティ: `02_dashboard/src/utils.js`（`resolveDashboardDataPath` 等）
- 共通 HTML: `02_dashboard/common/*.html`
- モーダル: `02_dashboard/modals/*.html`

## 前提・想定（Assumptions）
- 本番は REST／GraphQL などの API に置換予定。キー項目・スキーマは別途 API 仕様に準拠
- エクスポート仕様（CSV／Excel／BI）は、使用先の項目定義に合わせ派生テーブルを準備

