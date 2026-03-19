### Pre-investigation Summary
- `02_dashboard/invoice-detail.html` および `02_dashboard/src/invoiceDetail.js` を調査。
- 1枚目の請求書シート（`.page-1`）には、ヘッダー、宛名、差出人、金額サマリー、振込先情報、備考など、固定の表示項目が非常に多く配置されている。
- `invoiceDetail.js` 内の `paginateInvoiceItems` 関数において、1枚目の許容行数が `baseFirstRowHeight * 14`（約14行）と設定されているが、これに固定項目を合わせると A4サイズ（297mm）を確実に超過する計算になる。
- 実際に画面表示やPDF出力時（特に `padding-bottom` が追加される際）に、1枚目が縦に伸びすぎてしまい、印刷時にページが途中で切れるリスクが高い。

### Contribution to Project Goals
- 請求書の印刷品質の向上（プロフェッショナルな帳票出力）
- ユーザーが安心してPDFダウンロード・印刷を行えるUXの提供

### Overview of Changes
- 1枚目の請求書明細の許容行数を削減し、確実にA4サイズに収まるように調整。
- 2枚目以降への自動ページ送りロジックの閾値を最適化。
- ページ番号の表示位置や、PDF出力時の余白設定を微調整。

### Specific Work Content for Each File
- `02_dashboard/src/invoiceDetail.js`:
  - `paginateInvoiceItems` 内の `safeFirstPageCapacity` の計算式を見直し、14行から8〜10行程度に制限。
  - `getDetailPageCapacity` の計算ロジックに余裕（バッファ）を持たせ、要素の高さ変動に対応。
  - `downloadPdfBtn` のクリックイベント内での一時的なスタイル適用（特に `padding` 設定）を、レイアウトが崩れない値に修正。
- `02_dashboard/invoice-detail.html`:
  - 必要に応じて、固定表示項目のマージンやフォントサイズを微調整して、垂直方向のスペースを節約。

### Definition of Done
- [ ] 1枚目の請求書が、明細行数に関わらず A4サイズ（297mm）以内に収まっている。
- [ ] 1枚目に入り切らない明細が、正しく2枚目以降に送られている。
- [ ] PDFダウンロード時に、ページ番号や表の罫線が不自然な位置で切れていない。
- [ ] 手動で「帳票ダウンロード」を実行し、生成されたPDFのレイアウトが正常であることを確認。
