# 07 データフロー・マッピング

本ドキュメントは、SPEED ADの主要なデータが、データソース（JSONモック）からサービス層（ビジネスロジック）、そしてUI層（画面表示）へとどのように流れるかをマッピングし、開発者向けの技術的な見取り図を提供します。

## データフロー概要図

```mermaid
flowchart TD
    subgraph データ層 (JSON Mocks)
        A1[surveys/*.json]
        A2[demo_answers/*.json]
        A3[core/invoices.json]
    end

    subgraph サービス層 (src/services)
        B1[surveyService.js]
        B2[speedReviewService.js]
        B3[invoiceService.js]
    end

    subgraph UI層 (src/ui)
        C1[surveyRenderer.js]
        C2[speedReviewRenderer.js]
        C3[invoiceRenderer.js]
        C4[invoiceDetailRenderer.js]
    end

    A1 --> B1 --> C1
    A2 --> B2 --> C2
    A3 --> B3 --> C3
    A3 --> B3 --> C4
end
```

---

## 1. サーベイ関連
- **データソース**: `data/surveys/*.json`, `data/surveys/surveys-with-details.json`
- **サービス層**: `02_dashboard/src/services/surveyService.js`
- **UI層**: `02_dashboard/src/ui/surveyRenderer.js`
- **主なフィールド**:
  - `name`, `displayTitle`, `description`, `periodStart`, `periodEnd`
  - `questionGroups[].questions[]` (`questionId`, `type`, `text`, `required`, `options[]`)

## 2. 回答・スピードレビュー関連
- **データソース**:
  - 回答: `data/demo_answers/*.json`, `data/responses/*.json`
  - 名刺: `data/demo_business-cards/*.json`
- **サービス層**: `02_dashboard/src/services/speedReviewService.js`
- **UI層**: `02_dashboard/src/ui/speedReviewRenderer.js`
- **主なフィールド**:
  - `answerId`, `surveyId`, `answeredAt`, `isTest`
  - `details[]` (`question`, `answer`)
  - `businessCard.group*` (会社名, 氏名, 部署/役職, 連絡先など)

## 3. 請求関連
- **データソース**: `data/core/invoices.json` (一覧および詳細画面の共通ソース)
- **サービス層**: `02_dashboard/src/services/invoiceService.js`
- **UI層**:
  - 一覧: `02_dashboard/src/ui/invoiceRenderer.js`
  - 詳細: `02_dashboard/src/ui/invoiceDetailRenderer.js`
- **主なフィールド**:
  - **ヘッダ**: `invoiceId`, `issueDate`, `dueDate`, `corporateName`, `contactPerson`
  - **金額**: `subtotalTaxable`, `tax`, `subtotalNonTaxable`, `totalAmount`
  - **口座**: `bankInfo.*`

## 共通コンポーネント
- **共通ユーティリティ**: `02_dashboard/src/utils.js` (`resolveDashboardDataPath` など、データパス解決を補助)
- **共通HTML**: `02_dashboard/common/*.html` (ヘッダー、フッター、サイドバー)
- **モーダル**: `02_dashboard/modals/*.html` (各種モーダルウィンドウのUI部品)

## 前提・想定（Assumptions）
- **本番環境への置換**: 本マッピングはモック環境を前提としています。本番環境では、データソースはREST/GraphQLなどのAPIエンドポイントに置き換えられます。その際のデータスキーマは、別途API仕様書に準拠します。
- **エクスポート仕様**: CSV/Excelなど外部へのエクスポート機能は、出力先のシステム要件に応じて、別途専用のデータマッピングや変換処理を定義する必要があります。

