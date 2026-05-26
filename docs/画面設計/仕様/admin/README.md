---
owner: product
status: draft
last_reviewed: 2026-05-15
---

# 管理者画面仕様

## 目的

このディレクトリは、SPEED AD 管理者画面資料の正本置き場です。

既存の管理者画面資料は削除済みとして扱い、ここから完全新規で再作成します。`03_admin/` のHTMLは「参考: 現行モック」として確認できますが、仕様上の正解や正本根拠にはしません。

## 対象外

- 既存 `03_admin/` HTMLの追認。
- 本番DB/API、Backlog進捗、スケジュールの整理。
- 業務フェーズ定義、受注前営業領域、社内体制や担当者情報の整理。
- 個別HTML/JSの実装、画面デザイン、API設計、DB設計。

## 判断根拠

- 管理者画面資料は `docs/画面設計/仕様/admin/` を正本置き場とする。
- 資料は画面名ではなく、サービス上の管理対象と責務から作る。
- `03_admin/`、`BY-*`、`sample/`、`Moved` HTMLは「参考: 現行モック」としてのみ扱う。
- 要件定義の完了水準は、モック実装または詳細設計へ進める状態とする。

## まず読む資料

| 資料 | 目的 |
| --- | --- |
| [00_admin_documentation_rules.md](./00_admin_documentation_rules.md) | 管理者画面資料の作成ルール、番号帯、禁止事項 |
| [01_admin_service_structure.md](./01_admin_service_structure.md) | 管理者画面全体のサービス構造、管理対象、責務境界 |
| [10_admin_account_management.md](./10_admin_account_management.md) | 顧客、企業、ユーザー、グループ管理要件 |
| [20_admin_survey_management.md](./20_admin_survey_management.md) | アンケート、設問、公開、回答管理要件 |
| [30_admin_data_operation.md](./30_admin_data_operation.md) | 名刺データ化、入力、照合、エスカレーション要件 |
| [40_admin_billing_and_rules.md](./40_admin_billing_and_rules.md) | 請求、クーポン、営業日、期限前提要件 |
| [50_admin_operator_management.md](./50_admin_operator_management.md) | オペレーター、権限、実績管理要件 |
| [60_admin_screen_structure.md](./60_admin_screen_structure.md) | 責務別要件から導いた画面構成 |
| [70_admin_acceptance_criteria.md](./70_admin_acceptance_criteria.md) | 開発着手条件、受け入れ観点、画面外確認事項 |
| [90_admin_mock_reference.md](./90_admin_mock_reference.md) | 参考: 現行モックの隔離メモ |

## 作成順序

1. `00_`: 資料ルール、全体方針、用語
2. `01_`: サービス構造、管理対象、責務境界
3. `10_`: 顧客・企業・ユーザー・グループ
4. `20_`: アンケート、設問、公開、回答
5. `30_`: 名刺データ、入力、照合、エスカレーション
6. `40_`: 請求、クーポン、営業日、期限前提
7. `50_`: オペレーター、権限、実績
8. `60_`: 画面構成、一覧/詳細/設定/作業画面、モーダル所有元
9. `70_`: 開発着手条件、受け入れ観点、画面外確認事項
10. `90_`: 参考、差分、移行メモ

## 禁止事項

- 削除済みの旧管理者資料を正本として参照しない。
- 本番DB/API、Backlog進捗、スケジュールを仕様根拠にしない。
- `03_admin/`、`BY-*`、`sample/`、`Moved` HTMLをそのまま正解扱いしない。
- 個別画面仕様から先に作らず、先にサービス構造と責務境界を定義する。

## 未確定事項

- 各責務資料を正式承認するレビュー担当。
- 画面外確認事項をAPI、DB、権限、監査ログのどの資料へ引き継ぐか。
- 管理者画面の個別画面仕様を作成する次工程の開始条件。
