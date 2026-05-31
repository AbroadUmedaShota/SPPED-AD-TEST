---
owner: product
status: draft
last_reviewed: 2026-05-31
---

# BUG-001 バグ報告DBの位置づけ

## 目的

人間の報告、テスト中の発見、AIエージェントの調査結果を、Backlog起票前に同じ受付DBへ集約します。

v1では `SPEED AD E2Eシナリオ実行管理` Spreadsheetを、本モックで使用する共有モックDBとして扱います。Apps Script Web AppはE2Eシナリオ管理とバグ報告DBの両方を担当します。

## 正本の分け方

| 対象 | 正本 | 役割 |
| --- | --- | --- |
| 受付・観測・重複整理 | 共有モックDB内のバグ報告タブ | 報告、AI観測、証跡、代表ケースを管理する |
| 修正・調査の進行 | Backlog | 開発会社との対応課題、コメント、ステータスを管理する |
| UI仕様・送信方式 | `docs/画面設計/仕様/` | 画面仕様や正式なAPI仕様を管理する |
| 社内判断・個人連絡先 | private管理 | shared repoには残さない |

## 基本ルール

- 1不具合1代表ケースを基本にします。
- 複数人の報告は、代表ケースに紐づく `defect_observations` として蓄積します。
- AIエージェントの調査結果も observation として保存しますが、初期状態は必ず `unverified` です。
- AI観測だけではBacklog起票しません。
- 人間確認済みの代表ケースだけをBacklog本文生成対象にします。

## 共有可能な情報

- 画面名、環境、再現手順、期待結果、実際結果。
- 役割名としての報告者区分（営業、管理者、開発、QA、AI agentなど）。
- マスク済みのスクリーンショットURL、動画URL、ログパス。
- Backlog課題キー。

## 共有しない情報

- 個人名、メールアドレス、電話番号。
- 実トークン、セッション情報、Cookie。
- GmailメッセージID、個人宛先。
- 価格、契約、非公開プラン、社内判断の経緯。

## DBの最小構成

共有モックDBでは、E2E管理タブとバグ報告タブを同じSpreadsheetに置きます。E2E側の `scenarios`, `scenario_steps`, `scenario_runs`, `scenario_step_results` はテスト実行管理、以下の `defect_*` タブは不具合受付管理を担当します。

| タブ | 用途 |
| --- | --- |
| `defect_cases` | 代表不具合ケース |
| `defect_observations` | 人間報告とAI観測 |
| `defect_evidence` | 証跡メタ情報 |
| `triage_events` | 昇格、統合、Backlog連携などの履歴 |

## 将来RDB化の判断

以下が必要になった段階で、Spreadsheet/GASからRDB/APIへ移行します。

- ユーザー単位の認可。
- 添付ファイルの直接保存。
- Backlogとの自動同期。
- 監査ログの長期保存。
- 複数プロジェクト横断の検索。
