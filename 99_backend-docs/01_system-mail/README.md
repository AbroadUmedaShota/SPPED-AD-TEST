---
owner: product
status: draft
last_reviewed: 2026-05-28
---

# システムメール仕組み整理

## 目的

SPEED AD が自動または操作起点で送信するシステムメールの文面、送信タイミング、確認済みソースを整理する。

この資料は、バックエンド側の通知処理、バッチ起点、操作起点メールの検討材料であり、お礼メール本文そのものは対象外とする。ただし、御礼メール一括送信をユーザーに促すシステム通知は対象に含める。

## 対象外

- 回答者に送るお礼メール本文そのもの
- 本番メール配信基盤、SMTP、キュー、バッチ実装
- 本番認可、送信履歴DB、監査ログ設計
- 実トークンURL、GmailメッセージID、個人宛先、実名入り配信例

## 判断根拠

| ソース | 扱い |
| --- | --- |
| 2024-10-10版ログメールテンプレートExcel | 旧テンプレート、網羅性確認用 |
| Gmail実配信例 | 観測済みの現行候補 |
| `docs/アーカイブ/speedad-backlog-wiki-2026-03-24/pages/19_1107907_batch-processing.md` | バッチ起点・時刻の補助根拠 |
| `docs/テンプレート/email/invoice-notification-email-template_jp.txt` | 請求通知の既存補助テンプレート |

## 資料一覧

| ID | 資料 | 状態 |
| --- | --- | --- |
| SM-001 | [新規アカウント作成時](./01_account-registration.md) | Excel・Gmail確認 |
| SM-002 | [パスワード再設定時](./02_password-reset.md) | Gmail側更新可能性あり |
| SM-003 | [名刺データ化申込時](./03_bizcard-order.md) | Excel・Gmail確認 |
| SM-004 | [会期前日](./04_period-previous-day.md) | Excel・Gmail確認、置換漏れ注意 |
| SM-005 | [会期開始](./05_period-start.md) | Excel・Gmail確認 |
| SM-006 | [会期終了](./06_period-end.md) | Excel・Gmail確認 |
| SM-007 | [名刺データ化完了](./07_bizcard-completed.md) | Excel・Gmail確認 |
| SM-008 | [ダウンロード期限](./08_download-deadline.md) | Excelのみ確認 |
| SM-009 | [請求確定・請求書送付](./09_invoice-confirmed.md) | Excel・Gmail確認、既存補助テンプレート差分あり |
| SM-010 | [想定件数到達](./10_expected-count-threshold.md) | Excel・Gmail確認 |
| SM-011 | [御礼メール送信依頼](./11_thank-you-send-request.md) | Excel・Gmail確認 |
| SM-012 | [グループ招待メール（既存ユーザー）](./12_group-invitation-existing.md) | Excel・Gmail確認 |
| SM-013 | [アカウント作成依頼メール（新規ユーザー）](./13_group-invitation-new-user.md) | Excel・Gmail確認 |
| SM-014 | [共通フッター](./14_common-footer.md) | Excel・Gmail確認、住所差分注意 |

## 記載ルール

- 実配信例は、氏名、会社名、アンケート名、金額、URLをプレースホルダー化して記載する。
- Gmailで確認できないものは `Gmail実配信版` に「未確認」と明記する。
- Excel版とGmail実配信版が同じ系統でも、件名・本文・URL文言・補足注記に差分がある場合は `差分メモ` に残す。
- 本資料のHTML閲覧UIは `99_backend-docs/01_system-mail/index.html` から確認できる。
