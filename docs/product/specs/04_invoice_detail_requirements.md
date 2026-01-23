# INV-002 請求書詳細（Invoice Sheet）画面要件定義書

最終更新日: 2026-01-15

---

## 1. 目的

利用者が、請求月の請求内容を「請求書レイアウト（A4）」で確認し、同一内容を PDF としてダウンロードできること。

---

## 2. 対象画面

- パス: `02_dashboard/invoice-detail.html`
- URL: `invoice-detail.html?id={id}`
  - `id` は `INV-...`（請求書ID）または `AGG-...`（月次集計ID）

---

## 3. データ取得・依存

### 3.1 データ取得

- 取得API（モック実装）: `02_dashboard/src/services/invoiceService.js` の `fetchInvoiceById(id)`
- データソース: `data/core/invoices.json`

### 3.2 請求先情報の解決

詳細画面では `accountId` から請求先表示名を解決し、請求書データへ `corporateName` / `contactPerson` を付与する。

- 参照:
  - `data/core/users.json`
  - `data/core/groups.json`

解決ルールは `02_dashboard/src/invoiceDetail.js` の実装に準拠する。

### 3.3 集計ID（`AGG-...`）の扱い

- 集計IDを指定した場合、`fetchInvoiceById` は該当月・該当種別に属する複数請求書をまとめて返す。
- 返却データの `items[]` は、各請求書の `items[]` を連結し、各請求書の末尾に「小計」行を追加する。
  - 小計行の特徴: `isSubtotal: true`, `description: '小計'`, `amount: {その請求書の合計額}`

---

## 4. UI要件

### 4.1 画面骨格

- `data-page-id="invoice-detail"`
- 共通ヘッダー/サイドバー/フッターが表示される（ダッシュボードの通常レイアウト）

### 4.2 ヘッダー領域

- タイトル: `請求書詳細`
- 主要アクション:
  - `帳票ダウンロード`（`#downloadPdfBtn`）

### 4.3 状態表示（オーバーレイ）

| 種別 | DOM | 要件 |
| :--- | :--- | :--- |
| ローディング | `#invoice-detail-loading-overlay` | データ取得中、PDF生成中に表示 |
| メッセージ | `#invoice-detail-message-overlay` | 異常系文言を表示 |

### 4.4 Invoice Sheet（請求書レイアウト）

#### 4.4.1 コンテナ

- `#invoice-sheet-container` の配下に A4 用紙レイアウトを描画する。
- 1ページ目のテンプレート要素は `#invoice-page-1` として DOM に存在し、明細の増加に応じて追加ページを生成する。

#### 4.4.2 表示項目（代表）

| 項目 | 表示先（ID） | 仕様 |
| :--- | :--- | :--- |
| 発行日 | `#sheet-issue-date` | `YYYY年MM月DD日` |
| 請求書番号 | `#sheet-invoice-number` | `YY-ユーザーID5桁-連番3桁` |
| 宛名（会社） | `#sheet-corporate-name` | `御中` は固定文言 |
| 宛名（担当者） | `#sheet-contact-person` | `様` は固定文言 |
| 件名 | `#sheet-billing-period` | 表示文言に請求対象月（`billingPeriod.from` を基準）を含める |
| 小計（課税） | `#sheet-subtotal-taxable` | JPY通貨形式 |
| 消費税等 | `#sheet-tax-amount` | JPY通貨形式 |
| 小計（非課税） | `#sheet-subtotal-non-taxable` | JPY通貨形式 |
| 合計（税込） | `#sheet-total-amount` | `¥ 12,345` 相当の表記 |
| 振込先（銀行名） | `#sheet-bank-name` | 銀行名（必要に応じてコード併記） |
| 振込先（支店名） | `#sheet-branch-name` | 支店名（必要に応じてコード併記） |
| 振込先（口座種別） | `#sheet-account-type` | 文字列を表示 |
| 振込先（口座番号） | `#sheet-account-number` | 文字列を表示 |
| 振込先（口座名義） | `#sheet-account-holder` | 文字列を表示 |
| 支払期限 | `#sheet-due-date` | `YYYY年MM月DD日` |

#### 4.4.3 明細テーブル

- 列: `No.` / `品名１` / `品名２` / `数量` / `単価` / `金額`
- 行データ:
  - `itemName` → 品名１
  - `description` → 品名２
  - `quantity` + `unit` → 数量
  - `unitPrice` → 単価
  - `amount` → 金額
- `isSubtotal: true` の行は小計行として扱い、No. は空欄で表示する。

#### 4.4.4 ページ分割

- 1ページ目は明細20行まで表示する。
- 2ページ目以降は1ページあたり明細42行まで表示する。
- ページ番号は `{current}/{total}` 形式で表示する。

---

## 5. 帳票ダウンロード（PDF）要件

### 5.1 概要

- `#downloadPdfBtn` 押下で、Invoice Sheet を PDF としてダウンロードできる。

### 5.2 出力仕様

- 生成対象: `#invoice-sheet-container`
- 用紙: A4 縦
- ファイル名: `invoice-{id}.pdf`
  - `{id}` は URL パラメータの値（表示用に整形した請求書番号ではない）

### 5.3 実装指示（再現のためのポイント）

- PDF生成時は、画面表示用の影や余白を抑制し、ページごとに改ページされるようスタイルを調整する。
- 生成後は、画面表示のスタイルに戻す。

---

## 6. 異常系要件

| 条件 | 表示文言（例） | 備考 |
| :--- | :--- | :--- |
| `id` 未指定 | `請求書IDが指定されていません。` | |
| `id` が存在しない | `対象の請求書が見つかりませんでした。` | |
| データ取得に失敗 | `請求データの取得に失敗しました。` | 実装では例外メッセージが出る場合がある |

---

## 7. 受け入れ基準（抜粋）

- `id` 指定で開くと、請求書レイアウトが表示される。
- 明細が多い請求書ではページが自動追加され、ページ番号が整合する。
- `帳票ダウンロード` でPDFが生成され、A4縦で崩れない。
