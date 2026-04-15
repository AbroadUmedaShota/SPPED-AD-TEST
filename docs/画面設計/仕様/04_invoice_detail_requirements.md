---
owner: shared-docs
status: draft
last_reviewed: 2026-04-15
---

# INV-002 請求書詳細（Invoice Sheet）補助仕様

## 1. 位置づけ

- 本書は `02_dashboard/invoice-detail.html` 固有の画面骨格、DOM、操作要件を整理する補助仕様です。
- 利用者向け請求の正本は以下を優先します。
  - 画面横断要件: `docs/画面設計/仕様/04_invoice_screen.md`
  - 帳票/PDF/印刷要件: `docs/画面設計/仕様/05_invoice_document.md`
  - 手動検証: `docs/ハンドブック/テスト/invoice_manual_checklist.md`
- 本書では、帳票レイアウト、改ページ、金額計算、印刷との差分を重複定義しません。詳細ルールは `05_invoice_document.md` を参照してください。
- 品目1 / 品目2 の定義、具体課金名の canonical 表記、`従量課金` を表示ラベルに使わない方針は `04_invoice_screen.md` と `05_invoice_document.md` を正本とします。

## 2. 対象画面

- パス: `02_dashboard/invoice-detail.html`
- URL: `invoice-detail.html?id={id}`
- `id` は以下のいずれかを受け付けます。
  - 元請求書 ID: `INV-YYYY-MM-SEQ`
  - 集計 ID: `AGG-YYYYMM-{GROUP|PERSONAL}`（内部互換用）

一覧（INV-001）からの遷移は、原則として元請求書 ID（`INV-...`）を使用します。

## 3. データ取得と依存

### 3.1 利用サービス

- 取得: `02_dashboard/src/services/invoiceService.js` の `fetchInvoiceById(id)`
- 請求先解決:
  - `02_dashboard/src/services/userService.js`
  - `02_dashboard/src/services/groupService.js`

### 3.2 データソース

- 請求書: `data/core/invoices.json`
- 請求先（個人）: `data/core/users.json`
- 請求先（グループ）: `data/core/groups.json`

### 3.3 請求先情報の解決

- 詳細画面では `accountId` から `corporateName` / `contactPerson` を解決し、画面表示用の請求先情報を組み立てます。
- 解決優先度と分岐条件は `02_dashboard/src/invoiceDetail.js` の現行実装を正とします。

### 3.4 集計 ID（`AGG-...`）の扱い

- `AGG-...` は legacy/internal 互換用の受け口です。
- `fetchInvoiceById(id)` は `AGG-...` 指定時に、該当月・該当契約種別の複数請求書を 1 件として返します。
- 返却データの `items[]` には、元請求書ごとの `isSubtotal: true` 行が挿入されます。
- `isSubtotal` 行は INV-002 の画面/PDF では表示対象です。印刷ページ（INV-003）の差分ルールは `05_invoice_document.md` を参照してください。

## 4. 画面骨格

### 4.1 ページ構成

- `data-page-id="invoice-detail"`
- ダッシュボード共通のヘッダー/サイドバー/フッターを表示します。
- 主要アクションは `帳票ダウンロード` のみです。

### 4.2 主要 DOM

| 種別 | DOM | 用途 |
| :--- | :--- | :--- |
| 帳票ダウンロード | `#downloadPdfBtn` | INV-002 から PDF を生成する起点 |
| ローディング | `#invoice-detail-loading-overlay` | データ取得中、PDF生成中に表示 |
| メッセージ | `#invoice-detail-message-overlay` | 異常系文言を表示 |
| 帳票全体 | `#invoice-sheet-container` | PDF 生成対象コンテナ |
| 1ページ目テンプレート | `#invoice-page-1` | 1ページ目の帳票レイアウト |
| 1ページ目明細 tbody | `#sheet-details-tbody-1` | 初期ページの明細出力先 |
| 1ページ目ページ番号 | `#page-number-1` | `{current}/{total}` 表示 |

### 4.3 代表表示項目

| 項目 | 表示先（ID） |
| :--- | :--- |
| 発行日 | `#sheet-issue-date` |
| 請求書番号 | `#sheet-invoice-number` |
| 宛名（会社） | `#sheet-corporate-name` |
| 宛名（担当者） | `#sheet-contact-person` |
| 件名 | `#sheet-billing-period` |
| 課税小計 | `#sheet-subtotal-taxable` |
| 消費税等 | `#sheet-tax-amount` |
| 非課税小計 | `#sheet-subtotal-non-taxable` |
| 合計（税込） | `#sheet-total-amount` |
| 支払期限 | `#sheet-due-date` |

表示フォーマット、明細列定義、品目1 / 品目2 の表記、金額計算、改ページは `05_invoice_document.md` を正本とします。

## 5. 操作要件

### 5.1 帳票ダウンロード

- `#downloadPdfBtn` 押下で `#invoice-sheet-container` を PDF 化して保存します。
- ファイル名は `invoice-{id}.pdf` とし、`{id}` は URL パラメータ値をそのまま使用します。
- 出力仕様、改ページ、PDF 用スタイル調整は `05_invoice_document.md` を正本とします。

### 5.2 状態表示

- 初期ロード時は `#invoice-detail-loading-overlay` を表示します。
- PDF 生成時も同じローディングオーバーレイを使用します。
- 異常時は `#invoice-detail-message-overlay` に文言を表示します。

## 6. 異常系

| 条件 | 表示文言 |
| :--- | :--- |
| `id` 未指定 | `請求書IDが指定されていません。` |
| `id` が存在しない | `対象の請求書が見つかりませんでした。` |
| データ取得失敗 | `請求データの取得に失敗しました。` または例外メッセージ |

## 7. 実装参照

- 画面初期化・請求先解決・PDF 生成: `02_dashboard/src/invoiceDetail.js`
- ID 解決・`AGG-...` 結合・税計算: `02_dashboard/src/services/invoiceService.js`
- 帳票本体 DOM: `02_dashboard/invoice-detail.html`

## 8. 受け入れ確認の観点

- `id` 指定で帳票レイアウトが表示されること
- `AGG-...` 指定で集計請求が正しく展開されること（内部互換確認）
- `帳票ダウンロード` で PDF が生成されること
- 詳細確認の手順は `docs/ハンドブック/テスト/invoice_manual_checklist.md` を参照すること
