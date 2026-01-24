# ドキュメント案内

プロジェクト文書のトップガイドです。
2025-10 時点で「更新された内容」と「参照できる内容」が整理されています。

## カテゴリ別インデックス

### 製品ドキュメント (`docs/product/`)
- `overview/00_PROJECT_OVERVIEW.md`: 製品の背景と目的、主要ユースケース。
- `overview/requirements-overview.md`: 仕様書の読み方と参照先の索引。
- `overview/screen-transition-diagram.md`: 画面遷移図（Mermaid 形式）。
- `architecture/`: 全体アーキテクチャ、データモデリング、データインベントリ。
- `specs/`: 画面仕様・機能要件一式。`admin/` 以下に管理画面の派生要件あり。
- `processes/`: ビジネスプロセスと KPI フロー。`README.md` から導線を確認。
- `ui/`: デザインガイドライン、メッセージ文面、コンポーネント統合手順。
- `standards/02_CODING_STANDARDS.md`: コーディング規約とレビュー基準。

### サービス検討（`docs/service-consideration/`）
- `service-consideration/2026-01-23_service-feature-inventory.md`: サービス機能の全体棚卸し（表・ドラフト）
- `service-consideration/2026-01-23_premium-plan_feature-list.md`: プレミアム選別（標準/オプション/対象外/要決定・ドラフト）

### 運用ハンドブック (`docs/handbook/`)
- `setup/`: 初期セットアップとオンボーディング手順。
- `deployment/`: 展開/公開フローと必要なチェックリスト。
- `operations/06_OPERATIONS_GUIDE.md`: 運用手順と定例タスク。
- `security/07_SECURITY_GUIDELINES.md`: セキュリティポリシーと権限管理。
- `testing/`: 手動テストガイドラインとチェックリスト群。

### 参照資料 (`docs/references/`)
- `templates/`: Issue / PR テンプレートの正規版。
- `reviews/`: UI/仕様レビューの記録。
- `resources/`: クライアント提供資料や比較表などの外部リファレンス。

### 更新履歴 (`docs/changelog/`)
- `CHANGELOG.md`: 開発履歴とマイルストーン。
- `08_DECISION_LOG.md`: 重要な意思決定の記録。
- `status_draft.md`: 進行中トピックや未完了タスクのメモ。

### ノート・テンプレート
- `notes/meetings/`: 日付付きの議事メモ（`YYYY-MM-DD_topic.txt`）。ルート直下に置かず必ずここへ集約。
- `templates/`: Issue / PR / メールテンプレートの正規版。メール系は `templates/email/`。

### アーカイブ (`docs/archive/`)
- `forms/legacy-submissions/`: 過去のフォーム ZIP・スナップショット（`node_modules/` を含むため現行ビルドから隔離）。
- `front-share-2025-10/`: 旧「99.フロント画面の共有」配布物の保管先。
- 今後の整理対象はこの直下に集約し、参照時のみ展開してください。

### ローカライズ資料 (`docs/ja/`)
- `user-permissions.md`: アカウント権限ドキュメント（日本語版）。エンコード調整予定のため閲覧時はエディタ設定に注意。

## 運用ルール
- 正本はこの `00_dev_speed_ad_user/docs` 配下に集約する。別階層に md/txt を置いた場合は必ずここへ移動する。
- ファイル名は英語 + `YYYY-MM-DD_`（時系列）または `NN_`（並び順）を基本とし、本文の言語は任意で可。
- アーカイブ移動時は `docs/archive/README.md` に移動元/移動日を記録する。
- 仕様書・要件書は front-matter で `owner`, `status`, `last_reviewed` を付与し、ドラフト/レビュー済みを明示する。

## 運用メモ
- 共通ヘッダーやサイドバーなどの HTML は `02_dashboard/common/` から `loadCommonHtml(...)` で読み込む仕様です。`window.__COMMON_BASE_PATH` を必ず確認してください。
- ダッシュボード用 JSON は リポジトリ直下の `data/` 配下に統一されています。新規データは `resolveDashboardDataPath` （`./` 起点の相対パスを返却）を介して参照すること。
- 旧リポジトリから移管した添付ファイルは `docs/archive/` に退避済みです。再利用する場合は最新仕様と差異がないか確認してから復元してください。
