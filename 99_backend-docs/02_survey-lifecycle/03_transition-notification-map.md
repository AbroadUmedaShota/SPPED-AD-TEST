---
owner: product
status: draft
last_reviewed: 2026-05-28
---

# 状態遷移と通知の接点

## 状態と通知

| 状態・イベント | 関連通知 | 関連カテゴリ |
| --- | --- | --- |
| 会期前日 | 会期前日メール | `01_system-mail` |
| 会期開始日 | 会期開始メール、ステータス更新 | `01_system-mail`, `03_batch-processing` |
| 会期終了日 | 会期終了メール | `01_system-mail`, `03_batch-processing` |
| データ化完了 | 名刺データ化完了メール | `01_system-mail`, `04_bizcard-processing` |
| データ化完了後 | 御礼メール送信依頼 | `01_system-mail`, `05_thank-you-email` |
| DL期限前 | ダウンロード期限メール | `01_system-mail` |
| 月末 | 請求書作成、請求通知 | `01_system-mail`, `06_billing-rules` |

## 設計上の注意

- 状態更新と通知送信は同じタイミングに見えても、冪等性と再実行可否を分けて考える必要があります。
- 通知が送られた事実と、状態が変わった事実は別の履歴として扱う方が安全です。
- 旧Wikiの時刻は補助根拠であり、本番ジョブ定義との突合が必要です。
