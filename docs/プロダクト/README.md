# Internal Docs Stub

`docs/プロダクト/` に含まれていた事業方針、価格、契約、体制、アーキテクチャ検討、会議起点の判断資料は shared repo から外し、社内 private 管理へ移管しました。

- shared repo では本文を保持しません
- 実装に必要な仕様判断は `docs/画面設計/仕様/` に昇格させて管理します
- 開発会社と共有する必要がある情報だけを shared 側に再編集して戻します
- AI 開発向けの責任分界ルールは shared 側では `docs/リファレンス/共有規約/04_AI_RESPONSIBILITY_BOUNDARY.md` に再編集して保持し、社内体制の正本は private 管理で扱います

## ローカル・private 資料の扱い

WEBMTG 関連資料、Backlog 返答案、社内向け状況整理、担当者別アクション履歴などの本文資料は private 管理対象です。
ローカル作業用にこの配下へ一時配置しても、shared repo へは追加せず、必要な実装仕様だけを `docs/画面設計/仕様/` または `docs/リファレンス/共有規約/` へ再編集して転記します。

## main マージ時の扱い

- `docs/プロダクト/` 配下の Markdown / Excel / 会議記録は、README 本体を除き shared main の管理対象にしません。
- main に残す必要がある内容は、以下のいずれかへ統合します。
  - 実装仕様: `docs/画面設計/仕様/`
  - 共有規約・責任分界: `docs/リファレンス/共有規約/`
- 例:
  - support 配下の URL / assets ルールは `docs/画面設計/仕様/15_help_center_requirements.md` 側へ統合する
  - Backlog 返答案、WEBMTG メモ、状況管理 Excel は local/private のままとし、shared 側へは載せない
