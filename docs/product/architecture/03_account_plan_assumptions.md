# アカウント別プラン想定と検証シナリオ

最終更新: 2026-02-07

## 1. 想定マッピング

| groupId | accountId | アカウント名 | 想定プラン | 備考 |
| --- | --- | --- | --- | --- |
| `personal` | `ACC-001` | 個人アカウント | 非プレミアム | Standard 想定 |
| `group_sales` | `ACC-002` | 営業部 (組織) | 非プレミアム | Standard 想定 |
| `group_marketing` | `ACC-003` | マーケティング部 (組織) | プレミアム加入 | Premium+ 想定 |
| `group_bpo` | `ACC-004` | BPO部 (組織) | プレミアム加入後に期限切れ | DL期限切れシナリオを保持 |

## 2. 代表アンケートの配置

| surveyId | groupId | 目的 |
| --- | --- | --- |
| `sv_0003_26009` | `group_marketing` | プレミアム機能 (画像/名刺含む) の検証 |
| `sv_0004_26001` | `group_bpo` | 会期終了 + DL期限切れの状態検証 |

## 3. BPO 期限切れシナリオ固定値

`sv_0004_26001` は次の固定値で管理する。

- `status`: `アーカイブ`
- `periodStart`: `2025-09-01`
- `periodEnd`: `2025-09-30`

本システムでは `periodEnd + 90日` を DL期限として判定するため、
2026-02-07 時点では `会期終了（DL期限終了）` になる。

## 4. 参照データ

- `data/core/groups.json`
- `data/core/invoices.json`
- `data/core/surveys.json`
- `docs/examples/demo_surveys/sv_0003_26009.json`
- `docs/examples/demo_surveys/sv_0004_26001.json`
