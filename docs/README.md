# ドキュメント案内

プロジェクト構成や開発ルールに関する資料への入口です。  
2025-10 時点で「何を実現するか（要件）」と「どう実現するか（設計）」で整理しています。

## カテゴリ別インデックス

### サービス要件 (`docs/requirements/`)
- `docs/requirements/00_PROJECT_OVERVIEW.md`: 画面構成と機能スコープの概要。
- `docs/requirements/data-inventory.md`: モックデータ配置と利用モジュールの対照表。
- `docs/requirements/04_SETUP.md` / `05_DEPLOYMENT.md` / `06_OPERATIONS_GUIDE.md` / `07_SECURITY_GUIDELINES.md`: 導入・運用・セキュリティの前提条件。
- `docs/requirements/processes/`: 業務プロセスと運用フロー。導入は `docs/requirements/processes/README.md`、詳細は `04_operator_workflows.md` などを参照。
- `docs/requirements/specifications/`: 画面・機能の要件仕様。例: `01_screen_flow.md`, `06_speed_review.md`, `admin/00_admin_requirements_design.md`。
- `docs/requirements/resources/`: クライアント提供資料やフォーム雛形。例: `client-materials/service-plan-comparison.md`。
- `docs/requirements/testing/`: テスト指針とチェックリスト。例: `03_TESTING_GUIDELINES.md`, `invoice_manual_checklist.md`。
- `docs/requirements/��ʐ��ڐ}.md`: 画面遷移図などの補足資料。

### 設計・実装 (`docs/design/`)
- `docs/design/01_ARCHITECTURE.md`: フロントエンド構成と将来のバックエンド連携方針。
- `docs/design/architecture/02_data_model.md`: モックデータおよび将来のデータモデル定義。
- `docs/design/02_CODING_STANDARDS.md`: コーディング規約、レビューの観点。
- `docs/design/00_design_guideline.md` / `02_UI_COMPONENT_INTEGRATION.md`: UI ガイドラインとコンポーネント統合手順。
- `docs/design/01_ui_messages.md`: UI メッセージの用語統一ガイド。

## 共通リソース
- `docs/cleanup-plan.md`: リポジトリ整理の進捗と残課題。
- `docs/templates/`: Issue/PR テンプレート。例: `docs/templates/pr_body.md`。
- `docs/reviews/`: レビュー記録。例: `docs/reviews/bizcard-settings.md`。
- `tools/README.md`: 各種スクリプトの利用方法。
- `archive/temp/`: 一時退避用。常用せず必要時のみ参照。

## 開発の際に押さえておきたいポイント
- 共通ヘッダー / サイドバー / フッターは `loadCommonHtml(placeholderId, 'common/header.html')` で読み込みます。特殊配置時のみ `window.__COMMON_BASE_PATH` を上書きしてください。
- ダッシュボード用 JSON は `data/` に集約。`resolveDashboardDataPath` を経由して相対パスずれを防ぎます。
- デモデータは `data/demo_surveys/`, `data/demo_answers/`, `data/demo_business-cards/` などに配置され、`speed-review.js` や `graph-page.js` が参照します。

