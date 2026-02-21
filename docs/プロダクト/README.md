# 製品ドキュメント概要

`docs/プロダクト/` は、サービス企画・アーキテクチャ・運用プロセスをまとめた製品ドキュメントの正本ディレクトリです。

## ディレクトリ構成
- `overview/`: プロジェクト全体像、要件インデックス、画面遷移。
- `architecture/`: アーキテクチャ方針、データモデル、データインベントリ。
- `サービス企画/`: サービス企画の検討資料（機能棚卸し、プラン比較、方針ドラフト）。
- `processes/`: 業務プロセス、データフロー、KPI フロー。
- `ui/`: デザインガイド、UI メッセージ、コンポーネント統合手順。
- `standards/`: コーディング規約、レビュー観点。

## 主要参照
- アーキテクチャ: `architecture/01_ARCHITECTURE.md`
- データモデル: `architecture/02_data_model.md`
- データ配置: `architecture/data-inventory.md`
- サービス企画: `サービス企画/README.md`
- 画面仕様: `../画面設計/仕様/README.md`
- コーディング規約: `standards/02_CODING_STANDARDS.md`

## 運用ルール
- 仕様を更新した場合は、関連する `processes/` と `architecture/` の参照整合を確認する。
- 実装差分を反映した場合は、必要に応じて `docs/変更履歴/CHANGELOG.md` に追記する。
