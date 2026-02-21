# SPEED AD 管理者画面 要件定義ドキュメント集

本ディレクトリは管理者画面 (`03_admin/`) 向けの画面別要件定義書をまとめています。サービス画面側と同様に、個別画面の目的・構成・機能要件を明文化することで、実装・レビュー・運用の基準を共有します。

## 収録ドキュメント
- [管理者ダッシュボード 要件定義書](./dashboard_requirements.md)
- [利用者アカウント管理画面 要件定義書](./user_management_requirements.md)
- [利用者詳細画面 要件定義書](./user_detail_requirements.md)
- [オペレーター管理画面 要件定義書](./operator_management_requirements.md)
- [データ入力状況 要件定義書](./data_entry_requirements.md)
- [照合管理画面 要件定義書](./reconciliation_management_requirements.md)
- [実績管理画面 要件定義書](./performance_management_requirements.md)
- [請求管理画面 要件定義書](./billing_management_requirements.md)
- [クーポン管理画面 要件定義書](./coupon_management_requirements.md)
- [エスカレーション対応画面 要件定義書](./escalation_management_requirements.md)
- [アンケート管理画面 要件定義書](./survey_management_requirements.md)
- [アンケート詳細画面 要件定義書](./survey_detail_requirements.md)
- [営業日カレンダー管理 要件定義書](./calendar-management_requirements.md)
- [管理者機能 全体設計ドキュメント](./00_admin_requirements_design.md)

## 運用メモ
- 画面別ドキュメントはバージョン管理し、UI変更時は該当ファイルを更新してください。
- データモデル例はモック実装 (`03_admin/src/` および `data/`) と整合するよう更新します。
- 追加画面を作成する際は本ディレクトリに新しい要件定義書を追加し、READMEの一覧を更新してください。
