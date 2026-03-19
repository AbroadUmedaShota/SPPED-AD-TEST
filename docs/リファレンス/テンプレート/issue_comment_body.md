### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
- `02_dashboard/src/invoiceDetail.js` の `paginateInvoiceItems` 関数内で、1枚目の許容行数（`safeFirstPageCapacity`）が `baseFirstRowHeight * 14` とハードコーディングされている箇所が、A4サイズ超過の主な原因。
- 現状の1枚目レイアウト（ヘッダー、宛名、差出人、金額サマリー、振込先、備考）は合計で A4の約 60% 以上を占有していると推定される。
- PDF出力時に `padding-bottom: 30mm` が動的に付与される際、実質的な有効高さがさらに削られるため、明細が14行あると確実にオーバーフローする。

**Files to be changed:**
- `02_dashboard/src/invoiceDetail.js`
- `02_dashboard/invoice-detail.html`

#### 2. **Contribution to Project Goals**
- 請求書の印刷品質を確保し、プロフェッショナルな帳票出力を実現。
- ページ跨ぎによるレイアウト崩れを防ぎ、ユーザーの不信感を払拭。

#### 3. **Overview of Changes**
- 1枚目の明細行数を 8行程度に制限し、余裕を持って A4に収める。
- ページ番号の配置と余白設定を PDF 出力時と整合させる。
- 行の高さ計算にバッファを設け、フォントサイズや折り返しによる予期せぬ高さ増大に対応。

#### 4. **Specific Work Content for Each File**
- `02_dashboard/src/invoiceDetail.js`:
  - `paginateInvoiceItems`: `safeFirstPageCapacity` を 14行から **8行** 相当に変更。
  - `getDetailPageCapacity`: キャパシティ計算時に **20px のマージン（安全マージン）** を差し引くように修正。
  - `downloadPdfBtn` クリック時のスタイル適用: 30mm の padding-bottom を **15mm** に変更し、その分を `min-height` の計算に反映させる。
- `02_dashboard/invoice-detail.html`:
  - `summary-container` や `notes-area` の上下マージンを微調整（数px単位）し、垂直方向の圧迫を軽減。

#### 5. **Definition of Done**
- [ ] 1枚目の請求書が、明細行数に関わらず A4サイズ（297mm）以内に収まっている。
- [ ] 1枚目に入り切らない明細が、正しく2枚目以降に送られている。
- [ ] PDFダウンロード時に、ページ番号や表の罫線が不自然な位置で切れていない。
- [ ] 手動で「帳票ダウンロード」を実行し、生成されたPDFのレイアウトが正常であることを確認。

---
If you approve, please reply to this comment with "Approve".
