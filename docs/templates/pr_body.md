Closes #157

## 概要 (Overview)
請求書詳細画面（`invoice-detail.html`）からのPDFダウンロード時に、ページ下部が見切れてしまう問題を修正しました。

## 主な変更点 (Key Changes)
- **`src/invoiceDetail.js`**:
    - PDF生成処理の前後で、`.invoice-sheet` の `margin-bottom` と `box-shadow` を一時的に削除し、生成後に復元する処理を追加しました。
    - `html2pdf` のオプションに `pagebreak: { mode: ['css', 'legacy'] }` を追加し、ページ分割の挙動を安定させました。

## チェックリスト (Checklist)
- [x] 一時的なスタイル変更により、PDF生成時のレイアウト崩れが防がれていること
- [x] PDF生成後にスタイルが元に戻る（画面表示が崩れない）こと
- [x] `GEMINI.md`のワークフローに従っている
