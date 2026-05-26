# Private Docs Migration Map

shared repo から外した社内文書の移管マップです。shared 側には本文を残さず、カテゴリと旧配置だけを記録します。

## 1. 現在の社内保管先

- 現在の退避先: `C:\SharedFolder\WorkSpace\00.NewTopics\01_SPEED_AD_Project\00_dev_speed_ad_internal_docs_seed\shared-docs\`
- この退避先は private repo 正式化までの保管先です。
- shared repo には private URL や認証前提のリンクを埋め込みません。

## 2. shared 旧配置と private 再編先

| shared 旧配置 | private 再編先 |
| --- | --- |
| `docs/プロダクト/概要/` | `product/strategy/` |
| `docs/プロダクト/サービス企画/` | `product/strategy/` |
| `docs/プロダクト/要件/` | `product/operations/` |
| `docs/プロダクト/プロセス/` | `product/process/` |
| `docs/プロダクト/体制/` | `product/org/` |
| `docs/プロダクト/法務・規約/` | `product/operations/` |
| `docs/プロダクト/アーキテクチャ/` | `product/operations/` |
| `docs/会議録/` | `meeting-notes/` |
| `docs/メモ/meetings/` | `meeting-notes/` |
| `docs/legacy-要件定義/` | `decision-log/legacy-specs/` |
| `docs/変更履歴/08_DECISION_LOG.md` | `decision-log/` |
| `docs/変更履歴/status_draft.md` | `decision-log/drafts/` |

## 3. shared 側で残す stub の役割

- `docs/プロダクト/`: 社内 private 管理に移管済みであることだけを案内します。
- `docs/会議録/`: 会議本文を shared に置かないことを案内します。
- `docs/メモ/meetings/`: ラフメモを shared に置かないことを案内します。
- `docs/legacy-要件定義/`: 旧要件本文を shared に置かないことを案内します。

## 4. 正式 private repo 化の作業順

1. `shared-docs` 退避物を private repo に移します。
2. private repo で `product/strategy` `product/process` `product/operations` `product/org` `meeting-notes` `decision-log` を作ります。
3. 退避物を上のカテゴリへ並べ替えます。
4. shared 側 stub の文言を「正式 private 管理」に更新します。
5. 実装に必要な判断だけ shared 文書へ再編集して戻します。
