---
owner: product
status: draft
last_reviewed: 2026-05-31
---

# BUG-004 トリアージと重複確認

## 判断順

1. 投稿フォーム、AI観測、手動入力のいずれかで observation を登録する。
2. `reports.html` の「未紐づけ投稿」で、`case_id` が空の投稿を選択する。
3. 候補代表ケースを確認する。候補は `dedupe_key` 完全一致、同じ画面/カテゴリ、本文キーワード一致の順で見る。
4. 同一なら `linkObservationToCase` で既存 `case_id` に紐づける。
5. 別原因または別条件なら `promoteObservationToCase` で新しい代表ケースに昇格する。
6. 代表ケース化せず確認だけ済ませる場合は `verification_status=confirmed` に更新する。
7. 人間確認済み observation がある場合だけBacklog本文生成対象にする。
8. Backlog起票後は `backlog_key` をDBへ戻す。

## 同一判定の目安

| 観点 | 同一と見なす条件 |
| --- | --- |
| 画面/機能 | 同じ画面または同じ処理導線 |
| 環境 | 同じ環境、または環境差分が原因に影響しない |
| 発生条件 | 入力値、権限、状態、操作順が概ね一致 |
| 実際結果 | 同じエラー、同じ表示崩れ、同じデータ不整合 |

## 候補表示の優先順

| 優先 | 条件 | 管理者操作 |
| --- | --- | --- |
| 1 | 投稿の `dedupe_key` と代表ケースの `symptom_key` または算出キーが一致 | 原則として既存ケースへ紐づける |
| 2 | `screen` と `category` が近く、概要や実際結果が類似 | 内容を読み、同一なら紐づける |
| 3 | 本文キーワードの一致のみ | 参考候補として扱い、安易に確定しない |

候補表示は自動確定ではない。必ず管理者が投稿本文、再現手順、実際結果、既存代表ケースの概要を見て判断する。

## 別ケースにする条件

- 見た目は同じでも、発生条件や原因候補が明確に異なる。
- 一方は仕様確認で、もう一方は実装不具合。
- 影響範囲やデータ破壊リスクが大きく異なる。
- 片方が本番のみ、もう片方がstgのみで、環境差分が重要。

## 統合時の扱い

- 統合先を代表ケースにする。
- 統合元の `status` は `duplicate` にする。
- 統合元の `duplicate_of_case_id` に代表ケースIDを入れる。
- observationとevidenceは削除しない。
- `triage_events` に統合理由を残す。

## 却下・保留

| 状態 | 使う場面 |
| --- | --- |
| `rejected` | 再現不能、仕様通り、証跡不足で不具合扱いしない |
| `draft` | 受付済みだが代表ケースとして未確定 |
| `triage` | 切り分け中 |
| `confirmed` | 人間確認済みでBacklog起票可能 |
| `backlog_linked` | Backlog課題キーを紐づけ済み |

## 記録するイベント

- `observation_appended`
- `observation_linked`
- `case_promoted`
- `backlog_linked`
- `case_merged`
- `case_rejected`
- `case_reopened`
