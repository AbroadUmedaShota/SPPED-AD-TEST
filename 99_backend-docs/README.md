# バックエンド仕組み整理

## 目的

SPEED AD の画面そのものではなく、サービス全体に関わるバックエンド側の処理、状態、バッチ、通知、期限計算、請求、アカウント・グループなどの仕組みを整理するための検討資料置き場です。

ここに置く資料は、実装・仕様化の前段階で、既存資料、現行モック、旧Wiki、実配信、運用上の観測を突き合わせるために使います。正式仕様へ昇格する場合は、必要な範囲だけを `docs/画面設計/仕様/` や該当する正本資料へ再編集します。

## HOME

- HTML入口: [index.html](./index.html)
- 役割: SPEED AD のサービス概要、全体フロー、主要ロジック、カテゴリ別資料への導線をまとめる。

## 共有モックDB

v1では `SPEED AD E2Eシナリオ実行管理` Spreadsheetを、本モックで使用する共有モックDBとして扱います。Apps Script Web Appは `99_backend-docs/08_e2e-testing/gas/` を正本にし、E2Eシナリオ管理とバグ報告受付DBの両方を同じSpreadsheetへ保存します。

- Web App URL: `https://script.google.com/macros/s/AKfycbx3ait9hRE5NkEJUhMWh7o7jFoZ2DAxceibZ4JkH0rORp6a95VO-CZunQGsySF2sQ_aDw/exec`
- E2Eタブ: `scenarios`, `scenario_steps`, `scenario_runs`, `scenario_step_results`
- バグ報告タブ: `defect_cases`, `defect_observations`, `defect_evidence`, `triage_events`

## 全体フロー

| フェーズ | 主な整理対象 |
| --- | --- |
| 受注後準備 | アンケート作成、名刺データ化設定、お礼メール設定、グループ招待 |
| 会期前 | 会期前日通知、開始前チェック |
| 会期中 | 回答受付、名刺登録、想定件数監視 |
| 会期終了 | 終了通知、受付終了、データ化対象確定 |
| データ化中 | OCR、手入力、照合、CSV作成 |
| データ化完了 | CSV/画像DL、御礼メール送信依頼、送信対象確認 |
| DL期限・請求 | ダウンロード期限、請求明細、請求通知 |

## 資料一覧

| フォルダ | 対象領域 | 資料件数 | ソース状態 | 未確認事項 | 内容 |
| --- | --- | ---: | --- | --- | --- |
| [00_service-overview](./00_service-overview/) | サービス概要 | 4件 | 既存仕様 / 営業資料 / 現行モック | あり | サービス概要、主要ドメイン、全体業務フロー、情報源マップ |
| [01_system-mail](./01_system-mail/) | 通知・メール | 14件 | Excel / Gmail | あり | システムメールの文面、送信タイミング、Excel版とGmail実配信版の差分整理 |
| [02_survey-lifecycle](./02_survey-lifecycle/) | 会期・ステータス | 3件 | 既存仕様 / 現行モック | あり | 会期、状態判定、DL期限、通知接点 |
| [03_batch-processing](./03_batch-processing/) | バッチ処理 | 3件 | 旧Wiki補助 / 現行資料 | あり | 定時処理、通知起点、未確認実装論点 |
| [04_bizcard-processing](./04_bizcard-processing/) | 名刺データ化 | 3件 | 既存仕様 / 現行モック | あり | 名刺データ化設定、見積、進捗、納品、通知接続 |
| [05_thank-you-email](./05_thank-you-email/) | お礼メール | 3件 | 正本仕様 / 旧Wiki補助 | あり | 送信対象、送信期限、送信実行、失敗系 |
| [06_billing-rules](./06_billing-rules/) | 請求 | 3件 | 正本仕様 / 現行モック / 旧Wiki補助 | あり | 請求の流れ、課金計算の考え方、正本参照先 |
| [07_accounts-groups](./07_accounts-groups/) | アカウント・グループ | 2件 | 既存仕様 / システムメール資料 | あり | アカウント通知、グループ招待、請求関係 |
| [08_e2e-testing](./08_e2e-testing/) | E2Eテスト | 4件 | テストハンドブック / 画面仕様 / 現行モック | あり | 主要業務フロー、実行環境、前提データ、自動化検討 |
| [09_bug-reporting](./09_bug-reporting/) | バグ報告DB | 4件 | 運用設計 / Backlog起票補助 / AI観測 | あり | 人間報告とAI観測を受付DBに集約し、代表ケースとBacklog起票を整理 |
| [10_support-contact](./10_support-contact/) | サポートお問い合わせ受付 | 2件 | 画面仕様 / GAS実装案 | あり | 公開お問い合わせフォームの投稿保存、添付保存、受付メール送信を整理 |
| [11_screen-diff](./11_screen-diff/) | 画面差分（モックアップ↔本番） | 1件 | 観測スクショ / 目視比較 / 未確認あり | あり | モックアップと本番のスクショを画面ごとに左右比較し、本番に足りない・異なる点を整理 |
| [12_release-follow-up](./12_release-follow-up/) | 6/15リリース後優先度整理 | 1件 | Backlog / Chatwork / Gmail要旨 / 共有向け再編集 | あり | 未完了機能をリリース必達、短期導入、通常ロードマップに分類 |
| [13_prod-stg-defects](./13_prod-stg-defects/) | 本番・STG 不具合整理 | 2件 | Backlog観測 / 手動・自動E2E確認 | あり | 未対応の本番・STG不具合を環境差の観点で一覧化（6/23時点） |

## 共通ビュー仕様

- 各カテゴリは `manifest.json` と Markdown を正本として持つ。
- HTMLビューは `assets/docViewer.js` で Markdown を fetch し、エスケープしたうえで見出し・表・リストなどを閲覧用HTMLとして表示する。
- コピー操作では、表示用HTMLではなく正本のMarkdown本文をそのままコピーする。
- 外部Markdownライブラリ、API、DB、保存処理は追加しない。
- 検索、カテゴリ絞り込み、ソース状態フィルタ、差分・未確認フィルタ、本文コピーを共通で使える。

## 追加予定の置き方

- 新しいバックエンド整理テーマを追加する場合は、`10_` 以降の番号付きフォルダを作成する。
- `manifest.json` に `meta`、`documents[]`、必要に応じて `flow[]` を定義する。
- HOME に資料カードを1件追加し、対象領域、資料件数、ソース状態、未確認事項の有無を記載する。

## 扱い

- 実名、実トークン、GmailメッセージID、個人宛先は記載しない。
- 非共有の価格、契約、法務判断、未公開プランは記載しない。
- バックエンド処理の現状整理と検討材料として扱い、正式なAPI/DB/バッチ仕様とは分ける。
- 共有可能な仕様へ移す場合は、背景や観測ログではなく実装に必要な結論だけを転記する。
