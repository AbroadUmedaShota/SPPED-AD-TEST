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

### アーカイブ (`docs/archive/`)
- `forms/legacy-submissions/`: 過去のフォーム ZIP・スナップショット（`node_modules/` を含むため現行ビルドから隔離）。
- 今後の整理対象はこの直下に集約し、参照時のみ展開してください。

### ローカライズ資料 (`docs/ja/`)
- `user-permissions.md`: アカウント権限ドキュメント（日本語版）。エンコード調整予定のため閲覧時はエディタ設定に注意。

## 運用メモ
- 共通ヘッダーやサイドバーなどの HTML は `02_dashboard/common/` から `loadCommonHtml(...)` で読み込む仕様です。`window.__COMMON_BASE_PATH` を必ず確認してください。
- ダッシュボード用 JSON は `data/` 配下に統一されています。新規データは `resolveDashboardDataPath` を介して参照すること。
- 旧リポジトリから移管した添付ファイルは `docs/archive/` に退避済みです。再利用する場合は最新仕様と差異がないか確認してから復元してください。
