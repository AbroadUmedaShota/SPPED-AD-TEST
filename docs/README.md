# ドキュメント案内

プロジェクト文書のトップガイドです。`docs/` 配下の正本ディレクトリと、移行中ディレクトリの扱いを定義します。

## カテゴリ別インデックス

### 製品ドキュメント (`docs/product/`)
- `overview/00_PROJECT_OVERVIEW.md`: 製品の背景と目的、主要ユースケース。
- `overview/requirements-overview.md`: 仕様書の読み方と参照先の索引。
- `overview/screen-transition-diagram.md`: 画面遷移図（Mermaid 形式）。
- `architecture/`: 全体アーキテクチャ、データモデリング、データインベントリ。
- `specs/`: 画面仕様・機能要件一式。`admin/` 配下に管理画面要件、`premium/` 配下にプレミアム契約関連要件。
- `processes/`: ビジネスプロセスと KPI フロー。
- `ui/`: デザインガイドライン、メッセージ文面、コンポーネント統合手順。
- `standards/02_CODING_STANDARDS.md`: コーディング規約とレビュー基準。

### サービス検討 (`docs/service-consideration/`)
- プレミアム関連を含む機能棚卸し、方針メモ、要否判定のドラフトを管理。

### 運用ハンドブック (`docs/handbook/`)
- `setup/`: 初期セットアップとオンボーディング手順。
- `deployment/`: 展開/公開フローと必要なチェックリスト。
- `operations/06_OPERATIONS_GUIDE.md`: 運用手順と定例タスク。
- `security/07_SECURITY_GUIDELINES.md`: セキュリティポリシーと権限管理。
- `testing/`: 手動テストガイドラインとチェックリスト群。

### 参照資料 (`docs/references/`)
- `templates/`: Issue / PR テンプレートの正規版（正本）。
- `reviews/`: UI/仕様レビューの記録。
- `resources/`: クライアント提供資料や比較表などの外部リファレンス。

### 会議資料・メモ
- `meetings/`: 会議当日用の配布パケット（`YYYY-MM-DD/00_agenda.md` など）。
- `notes/meetings/`: 日付付き議事メモ（`YYYY-MM-DD_topic.txt`）。

### 運用補助テンプレート (`docs/templates/`)
- `email/`: メール文面テンプレート。
- `examples/`: Issue / PR 記載例（過去実績ベースのサンプル）。

### 更新履歴 (`docs/changelog/`)
- `CHANGELOG.md`: 開発履歴とマイルストーン。
- `08_DECISION_LOG.md`: 重要な意思決定の記録。
- `status_draft.md`: 進行中トピックや未完了タスクのメモ。

### アーカイブ (`docs/archive/`)
- 過去のフォーム ZIP・配布物・一時退避資料を保管。
- 整理対象はこの直下に集約し、参照時のみ展開。

### ローカライズ資料 (`docs/ja/`)
- 日本語版/翻訳版のドキュメントを管理。

### 移行中ディレクトリ (`docs/requirements/`)
- 旧要件ファイル群。新規・改訂時は `docs/product/specs/` へ寄せる。
- 既存参照が残るため、即時削除せず段階移行する。

## 運用ルール
- 正本は `docs/` 配下に集約する。別階層に `md/txt` を置いた場合は必ず移管する。
- ファイル名は英語 + `YYYY-MM-DD_`（時系列）または `NN_`（並び順）を基本とし、本文言語は任意。
- 仕様書・要件書は front-matter で `owner`, `status`, `last_reviewed` を付与し、ドラフト/レビュー済みを明示する。
- テンプレートの正本は `docs/references/templates/` とし、`docs/templates/` には補助資料・実例のみを置く。
- アーカイブ移動時は `docs/archive/README.md` に移動元と移動日を記録する。

## 運用メモ
- 共通ヘッダーやサイドバーなどの HTML は `02_dashboard/common/` から `loadCommonHtml(...)` で読み込む。`window.__COMMON_BASE_PATH` を確認すること。
- ダッシュボード用 JSON はリポジトリ直下の `data/` 配下に統一。新規データは `resolveDashboardDataPath` を経由して参照すること。
- `docs/examples/` は `SPEEDレビュー` と `グラフ詳細` のデモ表示にも使われるため、移動時は実装側パスを同時更新すること。
