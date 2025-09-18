# ドキュメント案内

プロジェクト構成や開発ルールに関する資料への入口です。

## 主要ドキュメント
- `docs/00_PROJECT_OVERVIEW.md` : 画面構成と主要機能の概要。
- `docs/01_ARCHITECTURE.md` : データフローと依存関係の整理。
- `docs/02_CODING_STANDARDS.md` : コーディング規約とレビュー方針。
- `docs/data-inventory.md` : モックデータとデモ用データの配置。
- `docs/cleanup-plan.md` : プロジェクト整理の進捗と残課題。

## フロントエンドでの共通パーツ利用
- 共通ヘッダー / サイドバー / フッターは `loadCommonHtml(placeholderId, 'common/header.html')` の形で読み込みます。
- `02_dashboard/` 直下以外（例: `group-edit` デモ）から呼び出す場合は、先に `window.__COMMON_BASE_PATH` を設定し、`loadCommonHtml` が正しいパスを解決できるようにしてください。

## データ参照の原則
- ダッシュボード向けの JSON は `data/dashboard/` に集約されています。
- フェッチ時は `resolveDashboardDataPath('core/surveys.json')` のように `resolveDashboardDataPath` を経由し、相対パスのずれを防ぎます。
- 大容量ダンプは `archive/data-dumps/` に退避しており、ランタイムでは使用しません。

## デモとモック
- `02_dashboard/group-edit/` : グループ管理デモ画面。サイドバーの「グループ管理デモ」リンクからアクセスできます。
- `data/dashboard/demos/sample-3/` : グラフ・回答分析用のモックデータ。`speed-review.js` や `graph-page.js` が参照します。

詳細は各ドキュメントを参照してください。
