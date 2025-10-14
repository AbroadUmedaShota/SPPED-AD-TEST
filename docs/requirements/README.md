# Requirements Overview

サービスとして「何を実現するか」をまとめたセクションです。業務要件、画面仕様、運用条件、テスト観点はすべてここから辿れます。

- **プロジェクト全体**: `00_PROJECT_OVERVIEW.md` でスコープと主要機能を把握し、`data-inventory.md` でモックデータの出所と利用モジュールを確認します。
- **導入・運用前提**: `04_SETUP.md`、`05_DEPLOYMENT.md`、`06_OPERATIONS_GUIDE.md`、`07_SECURITY_GUIDELINES.md` が環境構築からセキュリティまでの境界条件を定義します。
- **業務プロセス**: `processes/` 配下にビジネスフローやオペレーション手順を分類。まずは `processes/README.md` から参照してください。
- **画面・機能仕様**: `specifications/` 配下に各画面・機能の要件を収録。例として `specifications/01_screen_flow.md` で全体フロー、`specifications/06_speed_review.md` でスピードレビュー機能の要件を確認できます。
- **支援資料とテスト**: `resources/` は顧客向け資料・書式、`testing/` はテストガイドラインとチェックリストを管理します。

要件の更新が発生した場合は、関連する仕様書とプロセス文書を同時に修正し、`CHANGELOG.md` へ記載してください。
