### 請求書ドキュメント仕様書

#### 1. 概要
本ドキュメントは、システムから出力される請求書（PDF出力および印刷用HTML）の構造、表示項目、およびデザインに関する詳細な仕様を定義する。

#### 2. 基本情報
*   **ファイル名:** `invoice-print.html` (表示用HTML)
*   **出力形式:** 印刷、PDFダウンロードを想定したA4縦サイズレイアウト

#### 3. 動的データ項目 (Variables)

`invoice-print.html` に埋め込まれる動的なデータ項目は以下の通り。これらは `src/invoiceDetail.js` の `sampleInvoiceDetails` オブジェクトのプロパティに対応する。

| 変数名 (JSプロパティ名) | 説明 | フォーマット例 |
| :--- | :--- | :--- |
| `invoiceId` | 請求書の一意な識別子。 | `2500123001` |
| `issueDate` | 請求書の発行日。 | `2025/07/31` |
| `dueDate` | 請求書の支払期日。 | `2025年08月31日` |
| `corporateName` | 請求先の会社名。 | `株式会社サンプル商事` |
| `seikyuName` | 請求先の担当者名。 | `経理部御担当者様` |
| `totalAmount` | 合計請求金額（税込）。 | `55000` |
| `items` | 請求明細の配列。 | (下記参照) |

**`items` 配列の構造:**

| プロパティ名 | データ型 | 説明 |
| :--- | :--- | :--- |
| `no` | Number | 明細の連番。 |
| `itemName1` | String | 明細の品名1。 |
| `itemName2` | String | 明細の品名2。 |
| `quantity` | Number / String | 数量。小計行では空文字。 |
| `unitPrice` | Number / String | 単価。小計行では空文字。 |
| `amount` | Number / String | 金額。小計行では空文字。 |


#### 4. デザイン・レイアウト詳細仕様

`seikyuusyo_sample.html` および `seikyuusyo_sample.pdf` を視覚的ガイドラインとし、以下の具体的なCSSスタイルを適用することでレイアウトを再現する。

| セレクタ / 要素 | CSSプロパティ | 値 | 備考 |
| :--- | :--- | :--- | :--- |
| `body` | `font-family` | `'Meiryo', 'Yu Gothic', sans-serif` | 基本フォント |
| | `font-size` | `10pt` | 基本フォントサイズ |
| | `color` | `#333333` | 基本文字色 |
| `.container` | `width` | `210mm` | A4横幅 |
| | `padding` | `20mm` | 上下左右の余白 |
| `h1.invoice-title` | `font-size` | `24pt`| 請求書タイトル |
| | `font-weight` | `bold` | |
| | `text-align` | `center` | |
| | `border-bottom` | `3px double #333333` | |
| | `margin-bottom` | `30px` | |
| `#customer-info` | `font-size` | `12pt` | 宛先情報 |
| | `border-bottom` | `1px solid #cccccc` | |
| | `padding-bottom` | `10px` | |
| `#customer-info .company-name` | `font-weight` | `bold` | 宛先の会社名 |
| `#total-amount-table` | `background-color`| `#e0e0e0` | 合計請求額テーブル |
| | `font-weight` | `bold` | |
| `#total-amount-table td:last-child` | `font-size` | `18pt` | 合計請求額の金額 |
| `#invoice-items-table` | `width` | `100%` | 明細テーブル |
| | `border-collapse`| `collapse` | |
| `#invoice-items-table th, td` | `border` | `1px solid #cccccc` | |
| | `padding` | `8px` | |
| `#invoice-items-table thead th` | `background-color`| `#f2f2f2` | 明細テーブルヘッダー |
| `#company-info .special-char` | `background-color`| `red` | 発行元情報の「株式会社」など |
| | `color` | `white` | |
| | `padding` | `2px` | |

#### 5. 印刷とPDF出力

- **印刷トリガー**: `invoice-print.html` のページロード完了後、JavaScriptで `window.print()` を自動的に呼び出す。
- **改ページ制御**: 複数ページにわたる場合、CSSの `page-break-inside: avoid;` をテーブルの行 (`tr`) に適用し、行の途中で改ページされるのを防ぐ。
- **PDFダウンロード**: `invoice-detail.html` の「PDFダウンロード」ボタンは、現時点ではサンプルPDF (`seikyuusyo_sample.pdf`) へのリンクとする。将来的には、表示されているHTMLから動的にPDFを生成するライブラリ（例: `html2pdf.js`）の導入を検討する。