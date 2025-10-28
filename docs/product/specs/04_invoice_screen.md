# 請求関連画面仕様書（サービスプラン反映版）

最終更新日: 2025-10-12

---

## 1. 概要

- SPEED AD の請求情報（一覧・詳細・印刷ビュー）を統一仕様で提供する。
- 現行サービスプラン（Standard / Premium / Premium+従量課金）と各種オプションを画面上で正しく提示し、料金算出の根拠を透明化する。
- データは `data/core/invoices.json` の静的モックを使用し、将来的な API 連携に備えて構造を固定化する。

---

## 2. 対象画面

| 画面ID | パス | 役割 |
| :--- | :--- | :--- |
| INV-001 | `02_dashboard/invoiceList.html` | 請求書の検索・一覧表示・詳細遷移 |
| INV-002 | `02_dashboard/invoice-detail.html` | 個別請求書の明細確認・ダウンロード・印刷遷移 |
| INV-003 | `02_dashboard/invoice-print.html` | 印刷用簡易レイアウト |

### 共通要件
- ヘッダー／サイドバー／フッターは `src/utils.js` の `loadCommonHtml` で読み込む。
- 画面識別用 `data-page-id` を `invoice-list` / `invoice-detail` とする。
- 表示通貨はデフォルトで「円」。数値は税抜・税込を明示し、桁区切りは `toLocaleString('ja-JP')` を使用。

---

## 3. データモデル

### 3.1 請求書オブジェクト

```js
{
  invoiceId: string,              // 例: "INV-2025-09-001"
  accountId: string,              // 例: "ACC-001"
  plan: {
    code: "STANDARD" | "PREMIUM" | "PREMIUM_PLUS",
    displayName: string,          // 画面表示用 (例: "Premium")
    billingType: "monthly" | "annual"
  },
  addOns: [                       // 任意。サマリー表示にも利用
    {
      code: string,               // 例: "BIZCARD"
      displayName: string,        // 例: "名刺データ化パック"
      quantity: number,           // 例: 200
      unit: string                // 例: "件"
    }
  ],
  issueDate: string,              // YYYY-MM-DD
  dueDate: string,                // YYYY-MM-DD
  billingPeriod: {
    from: string,                 // YYYY-MM-DD
    to: string                    // YYYY-MM-DD
  },
  subtotalTaxable: number,
  subtotalNonTaxable: number,
  tax: number,
  totalAmount: number,
  status: "unpaid" | "paid" | "overdue" | "canceled",
  bankInfo: {
    bankName: string,
    branchName: string,
    accountType: string,
    accountNumber: string,
    accountHolder: string
  },
  notes: string | null,
  items: [
    {
      lineId: string,
      category: "BASE" | "ADD_ON" | "ONE_TIME" | "CREDIT",
      itemName: string,
      description: string | null,
      quantity: number | null,
      unit: string | null,
      unitPrice: number | null,
      amount: number,
      taxable: boolean
    }
  ]
}
```

### 3.2 補助マスタ
- `plan.displayName`・`addOns.displayName` は `docs/references/resources/client-materials/service-plan-comparison.md` を唯一の参照元とし、表記揺れを許容しない。
- `status` は以下に固定：
  - `unpaid`: 未入金（一覧・詳細とも「未入金」表示、黄色バッジ）
  - `paid`: 入金済（緑バッジ）
  - `overdue`: 延滞（赤バッジ。期限超過日数を詳細画面で表示）
  - `canceled`: 請求取消（灰バッジ。印刷不可）

---

## 4. 一覧画面仕様（INV-001）

### 4.1 レイアウト
- テーブル列構成（左→右）：
  1. 請求月 (`issueDate` を `YYYY年MM月`)
  2. 請求書ID
  3. 契約プラン（例: `Premium / 名刺200件`)
  4. 請求金額（税込、`¥12,345` 表記）
  5. ステータスバッジ
  6. アクション（詳細ボタン）

### 4.2 フィルタ／ソート
- フィルタ：
  - 請求期間（初期値：直近3か月）
  - プラン（`すべて` / `Standard` / `Premium` / `Premium+従量`)
  - ステータス（`すべて` / `未入金` / `入金済` / `延滞` / `取消`）
- ソート：
  - デフォルト：`issueDate` 降順
  - 列ヘッダークリックで昇降切り替え
- フィルタ結果が 0 件の際は `invoiceRenderer.showMessage('対象の請求書がありません')` を表示。

### 4.3 状態表示
- ローディング：`invoice-loading-overlay` を Tailwind スピナーで表示。
- エラー：サービス層が throw した場合「請求データの取得に失敗しました。リロードして再試行してください。」をオーバーレイ表示。

---

## 5. 詳細画面仕様（INV-002）

### 5.1 ヘッダー
- タイトル：`請求書詳細`
- アクションボタン：
  - `PDFダウンロード` → `seikyusyo_sample.xlsx`（暫定）に差し替え。将来的に PDF を提供する場合はファイル名 `invoice-{invoiceId}.pdf` を推奨。
  - `印刷` → `invoice-print.html?id={invoiceId}` を新規タブで開く。
  - ステータスバッジと最終更新日時（issueDate）を併記。

### 5.2 情報ブロック
1. **請求情報**
   - `請求書番号`, `請求日`, `支払期限`, `対象期間`
   - `契約プラン`: `plan.displayName` + 課金タイプ（例: `Premium（定額/月次）`）
   - `追加オプション`: `addOns` をカンマ区切りで表示。ハイフン省略。
2. **請求先情報**
   - `corporateName` 御中, `contactPerson` 様
3. **明細テーブル**
   - 列：No., 項目, 内訳, 数量, 単価, 金額
   - `items` の `category` ごとに小計行を挿入：
     - `BASE`: 基本料金小計
     - `ADD_ON`: 追加オプション小計
     - `ONE_TIME`: 一時費用小計
     - `CREDIT`: 調整額（マイナス表示）
   - 金額列は `¥12,345` 形式。
4. **集計**
   - 課税対象小計、非課税小計、消費税、合計金額（税込）
5. **振込先情報**
   - 登録口座を表示。`accountType` は「普通 / 当座」など日本語に変換。
6. **メモ**
   - `notes` が存在する場合のみ表示。

### 5.3 異常系
- 対象 ID が存在しない：`invoice-detail-message-overlay` に「対象の請求書が見つかりませんでした」を表示し、明細テーブルは `-` に差し替え。
- データ取得エラー：一覧と同じ文言でオーバーレイ表示し、アクションボタンは `disabled`。
- ステータス `canceled`: 印刷ボタンを非活性化し、注記として「この請求書は取消されています」を表示。

---

## 6. 印刷画面仕様（INV-003）

- `invoice-detail.html` と同じデータソースを使用し、`items` の順序・小計構成を一致させる。
- Web フォントを限定し、白黒印刷でも可読性を確保する（太字・下線中心）。
- ステータス表示はページ右上（`未入金`, `入金済`, `延滞`, `取消`）。`取消` の場合は朱色で「控」で透かしを入れる。

---

## 7. 操作フロー

1. ユーザーがダッシュボードにログインし、左ナビから「請求書」メニューを選択。
2. INV-001 が表示され、直近3か月分の請求書がロードされる。
3. フィルタ／ソートで対象を絞り込み、任意の請求書行の「詳細」ボタンを押下。
4. INV-002 が開き、`invoiceId` に応じたデータが表示される。
5. `PDFダウンロード` または `印刷` を実行。
6. ブラウザの戻る操作または「一覧に戻る」リンクで INV-001 へ戻る。

---

## 8. テスト観点（手動）

| 観点 | 詳細 |
| :--- | :--- |
| ロード | 一覧・詳細ともに初回ロードでコンソールエラーが無いこと |
| フィルタ | 期間・プラン・ステータスで組み合わせ検索し、結果が一致すること |
| 明細表示 | `BASE` / `ADD_ON` / `ONE_TIME` / `CREDIT` の各カテゴリが小計されること |
| 金額 | 税抜・税込・消費税が仕様通り計算表示されること |
| ステータス | 各ステータスでバッジ色と文言が一致すること |
| ダウンロード | ダウンロードリンクが存在するファイルに遷移すること（暫定で XLSX を使用） |
| 印刷 | `invoice-print.html` で同一データが反映され、A4 縦で崩れないこと |
| エラー | 404 ID や fetch 失敗時に適切なメッセージが表示されること |

---

## 9. 今後の課題

- PDF 出力の正式対応（テンプレート整備・動的生成）
-.MongoDB 等の永続層との連携に向けた API 契約定義
- 英語／多言語対応時の表示文言マッピング
- 支払実績データとの突合表示（入金日・入金額）

---

## 10. 関連資料

- `docs/references/resources/client-materials/service-plan-comparison.md`（サービスプラン比較表）
- `docs/architecture/02_data_model.md`（データモデル全体像）
- `docs/03_TESTING_GUIDELINES.md`（手動テスト手順）
- `data/core/invoices.json`（本仕様に準拠したモックデータ）

