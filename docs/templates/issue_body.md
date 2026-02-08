### Implementation Proposal

To resolve this Issue, I will proceed with the implementation according to the following plan.

#### 1. **Pre-investigation Summary**
- グラフ分析画面のExcelエクスポート機能において、ユーザーから出力内容の選択（目次、画像、マトリックス全項目、対象外リスト）を行いたいという要望があった。
- 現状のエクスポート機能は、画面の表示状態に依存しており、マトリックス設問の全行出力などが困難であった。

**Files to be changed:**
- `02_dashboard/graph-page.html`
- `02_dashboard/src/graph-page.js`
- `02_dashboard/modals/exportOptionsModal.html` (New file)
- `02_dashboard/src/services/speedReviewService.js`
- `02_dashboard/src/speed-review.js`
- `02_dashboard/src/ui/speedReviewRenderer.js`
- `WEEKLY_CHANGELOG.md`

#### 2. **Contribution to Project Goals**
- ユーザーが印刷用や報告用に適した、より詳細でカスタマイズ可能なExcelレポートを作成できるようにすることで、ツールの利便性を大幅に向上させる。

#### 3. **Overview of Changes**
- エクスポート設定モーダルの導入。
- 目次シートの自動生成機能。
- マトリックス設問の全行一括出力機能の実装。
- パフォーマンスとメモリ管理の最適化。

#### 4. **Specific Work Content for Each File**
- `02_dashboard/graph-page.html`: モーダルコンテナの追加とスタイル調整。
- `02_dashboard/src/graph-page.js`: モーダル表示ロジックとExcelエクスポートロジックの強化（目次生成、マトリックス全出力対応）。
- `02_dashboard/modals/exportOptionsModal.html`: 出力オプション選択UIの実装。
- `02_dashboard/src/services/speedReviewService.js`: 名前分割ロジック（姓・名）の改善。
- `02_dashboard/src/speed-review.js`: 画像パス解決ロジックの強化と表示状態管理の改善。
- `02_dashboard/src/ui/speedReviewRenderer.js`: マトリックス設問の表示ロジックと回答フォーマットの改善。
- `WEEKLY_CHANGELOG.md`: 変更内容の記録。

#### 5. **Definition of Done**
- [x] 全ての必要なコード変更が実装された。
- [x] エクスポートオプションモーダルが正しく表示され、選択内容がエクスポートに反映される。
- [x] 目次シートが生成され、各シートへのリンクが機能する。
- [x] マトリックス設問の全行が正しくExcelに出力される。
- [x] ドキュメント（WEEKLY_CHANGELOG.md）が更新された。
- [x] 実装が手動で検証された。

---
If you approve, please reply to this comment with "Approve".