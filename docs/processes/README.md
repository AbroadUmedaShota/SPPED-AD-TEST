# 業務プロセスドキュメント

本フォルダは、SPEED ADの運用および開発に関わる業務プロセスを定義したドキュメント群です。新規参入者が迅速にプロジェクトの全体像を理解し、関係者間の共通認識を醸成することを目的としています。

## ドキュメント一覧

1. **[01_business_process_definition.md](./01_business_process_definition.md)**  
   アンケート事業全体のビジネスプロセスを通常／特急／オンデマンドの3プラン別に整理した定義書です。関与アクター、会期前〜後の時系列フロー、Mermaid図による詳細フローチャートを掲載し、`サービス設計_ビジネスプロセス図_2025-01-08.pdf` を根拠にしています。
2. **[02_invoice_order_to_cash.md](./02_invoice_order_to_cash.md)**  
   受注から入金消込までのOrder-to-Cashプロセスを、`invoiceDetail.html` などのUIや `invoiceService.js` と紐づけて解説します。ステータス遷移、必須データ項目、例外／再発行時の処理方針を明文化しています。
3. **[03_support_escalation.md](./03_support_escalation.md)**  
   問い合わせ受付から解決・ナレッジ反映までのサポート運用を定義します。優先度別SLA、RACIベースの役割分担、`03_admin/escalations.html` 等の画面連携、エスカレーション時のMermaidフローを収録しています。
4. **[04_operator_workflows.md](./04_operator_workflows.md)**  
   データ入力オペレーターと入力管理者の日次業務手順をまとめた手順書です。タスク確認〜突合〜差異対応までの流れを可視化し、`data_entry.html` や `reconciliation/list.html` への参照を記載しています。
5. **[05_data_flow_mapping.md](./05_data_flow_mapping.md)**  
   `data/*.json` からサービス層 (`surveyService.js` など) を経てUIに至るデータ連携をマッピングします。主要データセットとフィールド一覧、共通ユーティリティとの関係を開発者向けに整理しています。
6. **[06_kpis_and_reporting.md](./06_kpis_and_reporting.md)**  
   サーベイ／サポート／請求の各領域で追跡するKPIとレポーティング運用を定義します。計測サイクルをMermaid図で示し、アラート発火時の対応先として [03_support_escalation.md](./03_support_escalation.md) を参照しています。
7. **[07_user_persona_flows.md](./07_user_persona_flows.md)**  
   主要ロール（管理者・オペレーター・顧客など）の視点で業務シナリオをMermaidフローに落とし込み、関連画面／サービスを横断的に確認できるカタログです。Order-to-Cashやサポート運用との整合性を図ります。
8. **[99_glossary.md](./99_glossary.md)**  
   SPEED ADで頻出する用語や略語（DSO、SLA、RACI など）を定義し、プロジェクト内の共通言語を提供します。各プロセス文書と併読することで前提の齟齬を防ぎます。

## 運用方針
- **実装との同期**: 実装（画面、ロジックなど）に変更を加える際は、関連するドキュメントを同じブランチ内で必ず更新してください。
- **前提の明記**: 未確定の仕様や将来的な拡張については、「前提・想定（Assumptions）」として各ドキュメントに明記しています。
- **参照の記載**: ドキュメントの記述がどの画面、ソースコード、データに基づいているか、可能な限り参照元を記載してください。
