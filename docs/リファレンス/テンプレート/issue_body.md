### 概要
お礼メール設定画面 (`thankYouEmailSettings.html`) における差し込み変数の UI を改善し、ユーザーの利便性を向上させます。

### 目的
- 不要な変数（自社担当者名）を削除し、選択肢を整理する。
- 変数の役割（他社宛情報 vs 自社情報）を色分けし、視覚的に区別しやすくする。

### 主な変更内容
- `02_dashboard/src/services/thankYouEmailService.js`:
    - `mockVariables` から「自社担当者名」を削除。
    - デフォルトテンプレートから `{{自社担当者名}}` を削除。
- `02_dashboard/src/ui/thankYouEmailRenderer.js`:
    - `populateVariables` を更新し、変数の種類に応じた Tailwind CSS クラスを適用（他社：青系、自社：オレンジ系）。
- `02_dashboard/src/thankYouEmailSettings.js`:
    - `handleRealtimePreview` の `dataMap` から「自社担当者名」を削除。
    - 変数定義に色分け用の情報を追加。

### 完了定義
- [ ] 「自社担当者名」が差し込み変数の選択肢から削除されていること。
- [ ] 差し込み変数のバッジが、他社宛情報（会社名/部署名/役職/氏名）と自社情報（アンケート名）で異なる色で表示されていること。
- [ ] プレビュー機能において、「自社担当者名」が正しく除外されていること。
- [ ] `WEEKLY_CHANGELOG.md` が更新されること。
