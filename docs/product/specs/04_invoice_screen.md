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

請求書一覧は個別の請求書を直接表示するのではなく、**請求月**と**契約種別（個人／グループ）**で集計された月次サマリーをカード形式で表示する。

### 4.1 レイアウト
- **カードレイアウト**: 一覧はテーブルではなく、月次サマリーごとのカードリストとして表示する。
- **カード内表示項目**:
  1. 請求月（例: `2025年09月請求`）
  2. 請求期間（例: `2025-08-01〜2025-08-31`）
  3. 表示用ID（ロジックに基づき生成されたID）
  4. 契約種別バッジ（`個人` / `グループ`）
  5. 合計請求額（その月の種別ごとの合計、税込）

### 4.2 フィルタ
- フィルタ：
  - ステータス（`すべて` / `未入金` / `入金済` / `延滞` / `取消`）
- フィルタ結果が 0 件の際は `invoiceRenderer.showMessage('対象の請求書がありません')` を表示。

### 4.3 状態表示
- ローディング：`invoiceRenderer.showLoading()` により「読み込み中です…」メッセージを表示。
- エラー：サービス層が throw した場合「請求データの取得に失敗しました。ページを再読み込みしてください。」をエラーメッセージとして表示。

---

## 5. 詳細画面仕様（INV-002）

### 5.1 ヘッダー
- タイトル：`請求書詳細`
- アクションボタン：
  - `帳票ダウンロード` (`PDFダウンロード`): `html2pdf.js` ライブラリを使用し、画面に表示されている請求書レイアウトから動的に `invoice-{invoiceId}.pdf` というファイル名のPDFを生成してダウンロードする。
  - `印刷` → `invoice-print.html?id={invoiceId}` を新規タブで開く。
  - ステータスバッジを請求書の発行日（issueDate）と併記。

### 5.2 情報ブロック
1. **請求情報**
   - `請求書番号`, `発行日`, `支払期限`, `対象期間`
   - `契約プラン`: `plan.displayName` + 課金タイプ（例: `Premium（定額/月次）`）
   - `追加オプション`: `addOns` を `/` 区切りで表示。
2. **請求先情報**
   - `accountId`に基づき、個人アカウントまたはグループの請求先情報を動的に解決して表示 (`corporateName` 御中, `contactPerson` 様)。
3. **明細テーブル**
   - 列：No., 品名１, 品名２, 数量, 単価, 金額
   - `items` 配列の各要素を一行としてテーブルに描画する。カテゴリごとの小計は表示しない。
   - 金額列は `12,345` 形式。
4. **集計**
   - 小計(課税対象)、小計(非課税)、消費税等、合計ご請求金額（税込）
5. **振込先情報**
   - 登録口座を表示。
6. **備考**
   - `notes` が存在する場合のみ表示。

### 5.3 異常系
- 対象 ID が存在しない：`invoice-detail-message-overlay` に「対象の請求書が見つかりませんでした」を表示。
- データ取得エラー：一覧と同じ文言でオーバーレイ表示し、アクションボタンは `disabled`。
- ステータス `canceled`: 印刷ボタンを非活性化する。

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

