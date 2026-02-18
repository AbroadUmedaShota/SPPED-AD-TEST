# 画面仕様ドキュメント運用ルール

`docs/product/specs/` は、サービス画面と管理画面の要件定義・機能仕様の正本です。

## 読み方
- `00_*` から `14_*`: 主要画面の仕様書。
- `*_current_impl.md`: 現行実装に合わせた補足仕様（実装優先の記録）。
- `design_memo_*.md`: 設計検討メモ。確定仕様とは分けて扱う。
- `admin/`: 管理画面の要件群。
- `premium/`: プレミアム登録・契約管理の要件群。

## 正本ルール
- 新規仕様は必ず `docs/product/specs/` または `docs/product/specs/admin/` に作成する。
- `docs/requirements/` 配下は移行中の旧要件として扱い、参照は段階的に置換する。
- 同一テーマで複数ファイルがある場合は、片方を「参照専用（legacy）」と明記する。

## 記載ルール
- 仕様書には front-matter で `owner`, `status`, `last_reviewed` を付与する。
- 実装依存の記述は「現行実装」と「理想仕様」を混在させず、必要なら節を分ける。
- データパス記述は `data/` と `docs/examples/` のどちらを参照するか明示する。

## 当面の整理対象
- [完了: 2026-02-18] `13_survey_answer_screen.md` を正本へ統合し、`docs/requirements/specifications/13_survey_answer_screen.md` は legacy redirect 化。
- [完了: 2026-02-18] `premium_*_requirements.md` を `docs/product/specs/premium/` へ移管し、旧配置は legacy redirect 化。
- [完了: 2026-02-18] `01_first-login-tutorial.md` と `performance_management.md` を正本へ統合し、旧配置は legacy redirect 化。
- [完了: 2026-02-18] `help-center_requirements.md` を `15_help_center_requirements.md` として正本化し、旧配置は legacy redirect 化。
- `speed_review` / `graph` 系仕様の参照先統一（仕様・実装・データフロー）。
- front-matter 未付与の既存仕様への段階適用。
