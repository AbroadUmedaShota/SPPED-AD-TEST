# 請求書帳票 要件定義書（印刷HTML / PDF）

最終更新日: 2026-01-15

---

## 1. 目的

請求書を以下の2形態で出力できること。

- PDF（詳細画面からダウンロード）
- 印刷（印刷専用ページからブラウザ印刷）

本書は、帳票の「表示項目・並び・計算・改ページ・表示フォーマット」を実装できる粒度で定義する。

---

## 2. 対象・入口

### 2.1 PDF（INV-002 詳細画面）

- 画面: `02_dashboard/invoice-detail.html`
- 操作: `帳票ダウンロード`（`#downloadPdfBtn`）
- 生成対象: `#invoice-sheet-container`

### 2.2 印刷（INV-003 印刷ページ）

- 画面: `02_dashboard/invoice-print.html?id={id}`
- 動作: 画面描画後に `window.print()` を自動実行

---

## 3. データ契約（帳票が期待する `Invoice`）

帳票は `Invoice`（請求書）を1件受け取り、各項目を表示する。金額は `items[]` を正として再計算してもよい。

### 3.1 `Invoice`（必須項目）

| 項目 | 型 | 説明 |
| :--- | :--- | :--- |
| `invoiceId` | string | 請求書番号（表示用に整形済みを推奨） |
| `issueDate` | string | 発行日（`YYYY-MM-DD`） |
| `dueDate` | string | 支払期限（`YYYY-MM-DD`） |
| `billingPeriod` | object | `from/to`（`YYYY-MM-DD`） |
| `corporateName` | string | 宛名（会社） |
| `contactPerson` | string | 宛名（担当者） |
| `plan` | object | `displayName` と `billingType` |
| `addOns` | array | 追加オプション（要約表示用） |
| `status` | string | `unpaid/paid/overdue/canceled` |
| `bankInfo` | object | 振込先情報 |
| `notes` | string/null | 備考（任意） |
| `items` | array | 明細 |

### 3.2 `InvoiceItem`（必須項目）

| 項目 | 型 | 説明 |
| :--- | :--- | :--- |
| `category` | string | `BASE/ADD_ON/ONE_TIME/CREDIT`（印刷ページの並びと小計単位） |
| `itemName` | string | 項目名 |
| `description` | string/null | 内訳 |
| `quantity` | number/null | 数量 |
| `unit` | string/null | 単位 |
| `unitPrice` | number/null | 単価 |
| `amount` | number | 金額 |
| `taxable` | boolean | 課税対象フラグ |

---

## 4. 共通フォーマット要件

### 4.1 日付

- 表示形式: `YYYY年MM月DD日`

### 4.2 金額

- 通貨: JPY
- 表示形式: `¥ 12,345`（3桁区切り）
- 負数は `-¥ 3,000` のようにマイナス表記する。

### 4.3 期間（請求対象期間）

- 表示形式: `YYYY年MM月DD日 ? YYYY年MM月DD日`

---

## 5. 金額計算要件

### 5.1 小計・税・合計

- 課税小計: `sum(item.amount)`（`item.taxable === true` のみ）
- 非課税小計: `sum(item.amount)`（上記以外）
- 消費税: `floor(課税小計 * 0.1)`
- 合計（税込）: `課税小計 + 非課税小計 + 消費税`

---

## 6. 明細出力要件

### 6.1 列

- `No.` / `項目` / `内訳` / `数量` / `単価` / `金額`

### 6.2 数量の表示

- `quantity` が `null` の場合は空欄
- `quantity` と `unit` がある場合は結合して表示（例: `200件`）

### 6.3 並びと小計（印刷ページ）

- 明細はカテゴリごとに出力し、各カテゴリの末尾に小計行を出力する。
- カテゴリ表示順: `BASE` → `ADD_ON` → `ONE_TIME` → `CREDIT`
- 小計はカテゴリ内の `amount` 合計とする。

### 6.4 集計ID（`AGG-...`）に関する留意点

- 集計IDの明細には、請求書ごとの「小計」行（`isSubtotal: true`）が混在する。
- 印刷ページは `category` で明細を抽出するため、`category` を持たない小計行は印刷出力されない。
- PDF（INV-002）は `items[]` をそのまま表として出力するため、小計行も表示される。

---

## 7. PDF（INV-002）要件

### 7.1 出力対象

- `#invoice-sheet-container` を A4 縦のPDFとして出力する。

### 7.2 ファイル名

- `invoice-{id}.pdf`（`id` は URL パラメータの値）

### 7.3 改ページ

- 用紙（ページ）単位で改ページされること。
- 複数ページの場合、ページ番号が `{current}/{total}` で表示されること。

---

## 8. 印刷（INV-003）要件

### 8.1 印刷起動

- 初期描画後に印刷ダイアログを自動で起動する。

### 8.2 備考

- `notes` が空の場合は備考ブロック自体を表示しない。

---

## 9. データ品質（帳票の整合性を保つための必須条件）

帳票は `items[]` をもとに計算・表示を行うため、データ側で以下を必須とする。

- 全明細に `category` を必ず付与する（未設定明細は印刷ページで出力されない）
- 全明細に `taxable` を必ず付与する（税計算のブレを防ぐ）
- `amount` が未設定の場合は `unitPrice * quantity` が成立すること（両方 `number`）

---

## 10. 手動テスト

`docs/ハンドブック/テスト/invoice_manual_checklist.md` を参照。
