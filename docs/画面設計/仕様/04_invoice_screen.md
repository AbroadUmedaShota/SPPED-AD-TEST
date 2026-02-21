# 請求書機能 画面・機能要件定義書（ユーザー画面）

最終更新日: 2026-01-15

---

## 1. 対象範囲

### 1.1 対象画面（ユーザー画面）

| 画面ID | パス | 役割 |
| :--- | :--- | :--- |
| INV-001 | `02_dashboard/invoiceList.html` | 請求書一覧（月次サマリー） |
| INV-002 | `02_dashboard/invoice-detail.html` | 請求書詳細（Invoice Sheet 表示 + PDF出力） |
| INV-003 | `02_dashboard/invoice-print.html` | 印刷用ページ（ブラウザ印刷） |

### 1.2 スコープ外

- 決済（カード/口座振替/請求代行）の実行、入金消込
- 送付（メール送信）・督促・再発行の業務フロー
- 管理画面での請求データ作成/編集

---

## 2. 参照（実装・データ）

### 2.1 実装（モック画面の正）

- 一覧: `02_dashboard/src/invoiceList.js`
- 詳細: `02_dashboard/src/invoiceDetail.js`
- データ取得: `02_dashboard/src/services/invoiceService.js`
- 一覧UI描画: `02_dashboard/src/ui/invoiceRenderer.js`

### 2.2 モックデータ

- 請求書: `data/core/invoices.json`
- ユーザー: `data/core/users.json`
- グループ: `data/core/groups.json`

---

## 3. 用語・IDの定義

### 3.1 表示用ID（請求書番号）

- 画面上の請求書番号は `YY-ユーザーID5桁-連番3桁` 形式で表示する（例: `25-00001-001`）。
- 生成ルール（現行モック実装）:
  - `YY`: `issueDate` の西暦下2桁
  - `ユーザーID5桁`: `accountId` の数字部分を抽出し、0埋めで5桁
  - `連番3桁`: 元 `invoiceId`（例: `INV-2025-09-001`）の末尾要素

### 3.2 遷移ID（URLパラメータ `id`）

一覧→詳細/印刷で利用する `id` は以下のいずれか。

- 元請求書 ID: `INV-YYYY-MM-SEQ`（例: `INV-2025-09-001`）
- 集計 ID: `AGG-YYYYMM-{GROUP|PERSONAL}`（例: `AGG-202509-GROUP`）

一覧画面（INV-001）は **月次サマリー** を表示するため、詳細遷移には原則として集計 ID を用いる。

補足（集計 ID の解決）:
- 集計 ID を指定した場合、詳細/印刷側では該当月・該当種別に属する複数請求書をまとめて1件として扱う。
- 明細は請求書ごとに連結し、各請求書の末尾に「小計」行（`isSubtotal: true`）を挿入する（現行モック実装）。

### 3.3 契約種別（個人/グループ）

現行モック実装の判定:
- `plan.code === 'STANDARD'` → `個人`
- 上記以外 → `グループ`

---

## 4. データ契約（画面が期待する `Invoice`）

本要件は API 連携を想定したデータ契約でもあります（現状は `data/core/invoices.json` を参照）。

### 4.1 `Invoice`（請求書）

| 項目 | 型 | 必須 | 説明 |
| :--- | :--- | :---: | :--- |
| `invoiceId` | string | ◯ | 元請求書ID（画面では表示用に整形される） |
| `accountId` | string | ◯ | 請求先アカウントID |
| `plan.code` | string | ◯ | `STANDARD/PREMIUM/PREMIUM_PLUS` 等 |
| `plan.displayName` | string | ◯ | 画面表示名 |
| `plan.billingType` | string | ◯ | `monthly/annual` |
| `addOns[]` | array |  | 追加オプション（要約表示に使用） |
| `issueDate` | string | ◯ | `YYYY-MM-DD` |
| `dueDate` | string | ◯ | `YYYY-MM-DD` |
| `billingPeriod.from` | string | ◯ | `YYYY-MM-DD` |
| `billingPeriod.to` | string | ◯ | `YYYY-MM-DD` |
| `status` | string | ◯ | `unpaid/paid/overdue/canceled` |
| `bankInfo` | object | ◯ | 振込先情報 |
| `notes` | string/null |  | 備考 |
| `items[]` | array | ◯ | 明細（計算・表示の正） |

### 4.2 `InvoiceItem`（明細）

| 項目 | 型 | 必須 | 説明 |
| :--- | :--- | :---: | :--- |
| `category` | string | ◯ | `BASE/ADD_ON/ONE_TIME/CREDIT`（印刷画面の出力条件） |
| `itemName` | string | ◯ | 項目名 |
| `description` | string/null |  | 内訳 |
| `quantity` | number/null |  | 数量 |
| `unit` | string/null |  | 単位 |
| `unitPrice` | number/null |  | 単価 |
| `amount` | number | ◯ | 金額（未設定時は `unitPrice * quantity` 相当を推奨） |
| `taxable` | boolean | ◯ | 課税対象フラグ（合計計算に使用） |

### 4.3 金額計算（現行モック実装）

画面/帳票は `items[]` を正として金額を再計算する。

- 課税小計: `sum(item.amount)`（ただし `item.taxable === true` のみ）
- 非課税小計: `sum(item.amount)`（上記以外）
- 消費税: `floor(課税小計 * 0.1)`
- 合計: `課税小計 + 非課税小計 + 消費税`

---

## 5. 画面要件

### 5.1 INV-001 請求書一覧（月次サマリー）

#### 5.1.1 表示要件

- 一覧は請求書単位ではなく **請求月 + 契約種別（個人/グループ）** で集計した月次サマリーをカード表示する。
- 表示順は新しい請求月（`issueDate`）が先（降順）。
- カードには最低限以下を表示する。
  - 請求月（例: `2025年09月請求`）
  - 対象期間（例: `2025-08-01 ? 2025-08-31`）
  - 表示用ID（表示用に整形した請求書番号）
  - 契約種別バッジ（`個人` / `グループ`）
  - 合計請求額（税込、3桁区切り）

#### 5.1.2 操作要件

- カード押下で INV-002 に遷移する（`invoice-detail.html?id={AGG...}`）。
- キーボード操作で `Enter` / `Space` でも遷移できる。

#### 5.1.3 状態（ロード/空/エラー）

- ロード中は「読み込み中です…」を表示する。
- 0件の場合:
  - 「対象の請求書がありません。」を表示し、`再読み込み` アクションを提供する。
- 取得失敗の場合:
  - 「請求データの取得に失敗しました。ページを再読み込みしてください。」を表示し、`再読み込み` アクションを提供する。

#### 5.1.4 フィルタ

- 現行モック画面ではフィルタ UI は提供しない（将来拡張余地として内部ロジックは存在）。

---

### 5.2 INV-002 請求書詳細（Invoice Sheet + PDF出力）

#### 5.2.1 表示要件

- 詳細は、A4の「請求書レイアウト（Invoice Sheet）」を画面内に表示する（カード分割しない）。
- 明細が多い場合はページを自動追加する。
  - 1ページ目: 20行
  - 2ページ目以降: 42行
- 請求先（宛名）は `accountId` から解決した `corporateName` / `contactPerson` を表示する。

#### 5.2.2 操作要件（帳票ダウンロード）

- `帳票ダウンロード` ボタンで PDF を生成しダウンロードする。
- PDF生成対象は `#invoice-sheet-container` とする。
- ファイル名は `invoice-{id}.pdf`（`id` は URL の `id` 値）とする。

#### 5.2.3 状態（ロード/エラー）

- ロード中はローディングオーバーレイを表示する。
- `id` 未指定: 「請求書IDが指定されていません。」
- データ未存在: 「対象の請求書が見つかりませんでした。」
- その他: 例外メッセージ（または「請求データの取得に失敗しました。」）

---

### 5.3 INV-003 印刷用ページ（ブラウザ印刷）

#### 5.3.1 表示要件

- `invoice-print.html` は `id` に該当する請求書を取得し、印刷用のHTMLを生成して表示する。
- 明細は `category` でグルーピングし、カテゴリごとに小計行を出力する。
- `category` が未設定、または定義外の明細は印刷画面に表示されない（現行モック実装の制約）。

#### 5.3.2 操作要件

- 画面表示後、印刷ダイアログを自動で開く（`window.print()`）。

---

## 6. 受け入れ基準（抜粋）

- INV-001: 月次サマリーが降順で表示され、カード押下で詳細に遷移できる。
- INV-002: `id` に応じた請求書が表示され、PDFが生成できる。
- INV-003: `id` に応じた内容が表示され、カテゴリ小計を含めて印刷プレビューで崩れない。

詳細チェックは `docs/ハンドブック/テスト/invoice_manual_checklist.md` を参照。

---

## 7. 既知の留意点（引き継ぎ向け）

- 一覧カードの金額表示の通貨記号は実装上の表示差分が出やすい（提供時に `¥` 表示へ統一すること）。
- `items[].category` と `items[].taxable` は帳票整合のため必須項目として扱うこと（モックデータ側も揃えること）。
