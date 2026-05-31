---
owner: product
status: draft
last_reviewed: 2026-05-31
---

# BUG-003 AI観測ルール

## 位置づけ

AIエージェントの調査結果は、確定不具合ではなく observation として扱います。

AIは調査補助者であり、未確認のまま不具合確定、Backlog起票、クローズ判断を行いません。

## 登録条件

AI観測は `defect_observations` に次の条件で登録します。

| 項目 | 値 |
| --- | --- |
| `source_type` | `ai` 固定 |
| `source_role` | `AI agent` |
| `verification_status` | 初期値 `unverified` |
| `agent_run_id` | 実行単位を追跡できるID |
| `confidence` | AI自身の確信度。確定判断ではない |

## noteに分けて書く内容

AI観測の `note` には、次の見出しを使います。

```md
調査対象:
実行環境:
確認手順:
根拠:
推論:
限界:
```

## 昇格条件

AI観測を代表ケースやBacklog本文の根拠に使うには、人間確認が必要です。

| 状態 | 扱い |
| --- | --- |
| `unverified` | DBに保存するがBacklog本文生成対象外 |
| `confirmed` | 代表ケースの根拠にできる。ただし人間確認済みとして記録する |
| `rejected` | 代表ケース化しない。必要なら却下理由を `triage_events` に残す |

## 禁止事項

- AI観測だけでBacklog課題を作らない。
- AI推論を事実として書かない。
- 個人名、メール、認証情報、社内限定判断をDBへ保存しない。
- 証跡のマスク状態が不明なまま外部共有しない。

## 証跡の扱い

AIが取得したスクリーンショット、HTML、consoleログ、networkログは、実体をDBに保存しません。

`defect_evidence` には、URLまたはローカルパス、証跡概要、マスク状態だけを保存します。
