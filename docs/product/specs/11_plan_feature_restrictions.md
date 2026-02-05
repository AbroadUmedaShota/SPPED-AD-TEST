# 利用者画面向けプラン別機能制限設計方針

## 1. 背景と目的
- 利用者画面では契約プランに応じて利用できる機能が異なり、契約内容に基づく体験制御が求められる。
- 既存仕様では `surveys.plan` やアカウント契約プランがデータモデルに存在するものの、画面/UI・APIの判定ロジックが散在し、追加プランやキャンペーンに対応しづらい。
- プラン追加・改訂に対する柔軟性、アップセル導線の明確化、監査ログの一元化を実現するため、**共通の能力定義を基に UI・サービス・API で一貫した制御**を行う設計を策定する。

## 2. 対象プランと識別キー
| プラン表示名 | システムキー (`planTier`) | 価格（税別） | 主な特徴 | 備考 |
| :-- | :-- | :-- | :-- | :-- |
| Free (無料) | `free` | 0円 | 基本アンケート、回答テキストのみDL、無料範囲内での名刺データ化。 | 期間30日、ロゴ表示あり。 |
| Premium (月額) | `premium` | 10,000円 | 画像/名刺結合データDL、Excelレポート、自社ドメイン、保存期間無期限。 | 2026-05-18 展開予定。 |
| Enterprise | `enterprise` | 個別見積 | Premium＋SSO対応、SLA、高度な外部連携（Slack/CRM等）。 | 2026-07 以降（見直し対象）。 |

- `planTier` は UI/サービス/保存API で共通利用する判定キー。請求情報の `plan.displayName` とは別に保持する。
- `Premium` プランは 2026-05-18 のサービス展開に向けた主力プラン。

## 3. 機能カテゴリ別の制限マトリクス
| 機能カテゴリ | Free | Premium | UI制御方針 (Abroad) | 保存/API制御方針 (Rep) |
| :-- | :-- | :-- | :-- | :-- |
| ダウンロード | **回答テキストのみ** | **全データ**（画像・名刺結合含む） | 非対象の選択肢をロック、加入LPへ誘導。 | `downloadOptions` の認可チェック。 |
| グラフ分析出力 | 閲覧のみ | **Excel一括出力** 可能 | 出力ボタンに鍵アイコン＋ポップアップ。 | エクスポートAPIの権限検証。 |
| 設問タイプ | 基本12種 | + **手書き / 画像添付** | プレミアム専用設問を「新規」タグで強調。 | 設問定義保存時のプラン検証。 |
| 名刺データ化 | 通常スピード | **オンデマンド納期** 等 | 納期選択肢を制限。 | 完了予定日計算ロジックの切替。 |
| 御礼メール | テンプレ/ADドメイン | **自社ドメイン** / 条件付き | 設定画面で認証ステータスを表示。 | DNS認証済みドメインのみ送信許可。 |
| ロゴ表示 | SPEED ADロゴ表示 | ロゴ非表示設定が可能 | ヘッダー等のロゴ表示切り替え。 | アカウント設定の反映。 |
| 保存期間 | 30日間 | **無期限** | 期限切れ間近の警告、アーカイブ案内。 | クリーンアップバッチの対象外設定。 |
| 外部連携 | なし | 順次追加（Slack等） | 連携設定タブを限定表示。 | 外部Webhook/APIの有効化。 |

- UI制御（Abroad担当）は「非表示＞非活性＋アップセルCTA＞説明付き活性」の順に適用し、期待する誘導を明示する。
- 保存/API層（Rep担当）は `planCapabilityService.hasFeature(accountId, featureKey)` で判定し、UIの制御と同一ロジックを共有する。

## 4. 実装構成
### 4.1 データソース構成
```json
// data/core/plan-capabilities.json (新規)
{
  "free": {
    "maxQuestions": 20,
    "bizcard": {
      "allowedFields": ["email", "fullName"],
      "speedPlans": ["normal"]
    },
    "features": {
      "download": { "allowImages": false, "allowCombined": false },
      "excelExport": false,
      "logoHidden": false
    },
    "limits": { "activeSurveys": 1, "retentionDays": 30 }
  },
  "premium": {
    "maxQuestions": 500,
    "bizcard": {
      "allowedFields": ["all"],
      "speedPlans": ["normal", "rush", "express", "on-demand"]
    },
    "features": {
      "download": { "allowImages": true, "allowCombined": true },
      "excelExport": true,
      "logoHidden": true
    },
    "limits": { "activeSurveys": 50, "retentionDays": -1 }
  }
}
```
- JSONでプラン毎の数値・配列・ブール値を管理し、フロントとバックエンドで共用する。
- `tools/generate-plan-types.js` を追加し、JSONから TypeScript/Flow 型定義を生成して IDE 補完とバリデーションを実現する。
- 追加キャンペーンを扱う場合は `addOns` セクションを用意し、`planCapabilityService` 側でマージする仕組みを実装する。

### 4.2 サービスレイヤ
- `02_dashboard/src/services/planCapabilityService.js`（新規）
  - `loadPlanCapabilities()` で JSON をフェッチし、ローカルキャッシュ（`Map`）に格納。Etag/バージョンヘッダーで更新検知。
  - `getAccountPlanTier(account)` で `account.planTier` からキー取得。未定義は `free` を既定とし、データ異常時はモニタリング送信。
  - 主要API: `hasFeature(featureKey)`, `getLimit(limitKey)`, `listAllowedValues(categoryKey)`, `assertLimit(limitKey, value)`。
  - `observePlanChange(accountId, planTier)` を提供し、プラン変更時にキャッシュ更新イベントを発火して UI を再レンダリング。
- 既存サービス (`surveyService.js`, `bizcardService.js`, `analyticsService.js`) は `planCapabilityService` を依存注入し、保存前検証を共通化する。

### 4.3 UI適用ポイント
1. **アンケート作成ページ**
   - 質問追加ボタン・多言語セクション・御礼メール設定に `planRestrictedComponent` を適用。
   - Free/Standard アカウントでは目次に「アップグレード」CTAを表示し、クリックでアップセルモーダル。
2. **名刺データ化設定ページ**
   - 項目選択リストは `allowedFields` でフィルタ。特急以上は非表示だがカード枠を残し説明ツールチップを表示。
3. **ダッシュボード/設定ナビゲーション**
   - 集計メニューや外部連携タブは `featureFlags.analytics`、`integrations` をもとにロック表示（鍵アイコン＋理由）。
4. **新規アンケート作成CTA**
   - `limits.activeSurveys` 超過時はCTAを無効化し、モーダルで利用状況とアップグレード導線を提示。
5. **共通ヘッダーのプランバッジ**
   - プラン名と次回更新日、アップグレードボタンを表示。`planCapabilityService.observePlanChange` に応答して更新。

### 4.4 能力判定フロー
```mermaid
sequenceDiagram
  participant UI
  participant PlanService as planCapabilityService
  participant API as backend API
  UI->>PlanService: requireFeature('multilingual')
  PlanService->>PlanService: fetch capabilities (cached)
  alt feature available
    PlanService-->>UI: ok
    UI->>API: POST /surveys (payload)
    API->>PlanService: assert('multilingual')
    PlanService-->>API: ok
    API-->>UI: 200
  else feature unavailable
    PlanService-->>UI: deny(reason)
    UI->>UI: showUpsellModal(reason)
  end
```
- UIとAPIで同一の `planCapabilityService` 判定ロジックを利用し、プリフライト判定の不一致を防ぐ。
- API側はリクエスト失敗時に `PLAN_DENY` エラーコードと追加メタ（`featureKey`, `currentPlan`, `requiredPlan`）を返す。

### 4.5 キャッシュおよびフォールバック
- `plan-capabilities.json` は CDN キャッシュ1分、ブラウザキャッシュ10分。強制更新が必要な場合はバージョンパラメータを変更。
- 読み込み失敗時は直近の成功レスポンスを `localStorage` に保持してフォールバック、失敗を Sentry に送信。
- 旧ロジックからの移行期間は `?disable_plan_enforcement=1` のクエリでサポートモードを有効化し、サポートチームが一時的に制限解除できる。

## 5. バックエンド/APIとの整合
- 管理者画面（`03_admin`）のプラン変更操作、請求APIのレスポンスに `planTier` および `planCapabilitiesVersion` を含める。
- 保存・更新APIは `planCapabilityService` と同じ JSON を利用して検証し、UI改変による不正利用を防止。`assertLimit` 失敗時は 409 を返却。
- イベントログには `PLAN_DENY` と `PLAN_LIMIT_WARN` を記録し、サポート調査・アップセル分析に活用する。
- プラン変更時は Webhook (`/webhooks/plan-change`) を発火し、利用者画面が SSE/WebSocket 経由で受信して UI を再描画する。

## 6. アップセル体験設計
- 制限に遭遇したユーザーには共通モーダルを表示し、以下を含める。
  1. 現在のプラン概要と残りリソース（例: 残り公開枠）。
  2. 該当機能が利用可能なプランと主要ベネフィット、差額の概算。
  3. 「アップグレードを依頼」ボタン（問い合わせフォーム／社内管理者メールリンク）。
  4. FAQリンクとライブチャット導線。
- モーダル内の文言は `data/marketing/plan-upsell-copy.json` で管理し、ローカライズを考慮したキー構造 (`{ featureKey: { ja, en } }`) を採用する。
- アップセルCTAのクリックイベントは `upsell_event` として計測し、どの機能で制限に遭遇したかを記録する。

## 7. 監視とアラート
- `PLAN_DENY` 発生数をプラン別にダッシュボード化し、異常増加時にサポートへ通知。
- `plan-capabilities.json` 読み込み失敗率、キャッシュヒット率を監視し、3分以上連続失敗でアラート発報。
- サポートモード (`disable_plan_enforcement`) の利用ログを監査テーブルへ保存し、月次レビューを実施する。

## 8. テスト戦略
- **ユニットテスト:** `planCapabilityService` の `hasFeature`・`assertLimit` のパラメトリックテスト。プラン境界値、フォールバック経路を網羅。
- **UIスナップショット:** Storybook で Free/Standard/Premium/Premium+ アカウントの画面差分を確認。アップセルモーダル表示も含む。
- **E2Eテスト:** Cypressで Free プランユーザーが多言語セクションにアクセスできないこと、Premium+ がオンデマンドスピードを選択できることを検証。
- **API契約テスト:** Pact で UI ↔ API 間の `PLAN_DENY` レスポンス仕様を固定化。プラン変更Webhookの受信テストを含む。
- **監査テスト:** `PLAN_DENY` イベントがログストリームに出力されること、サポートモード利用時に監査レコードが残ることを確認。

## 9. 移行計画
1. 既存アカウントの `plan` を `planTier` にマッピングし、旧名称（例: Pro）を `premiumPlus` へ移行するマスタを整備。
2. ハードコードされているプラン判定ロジックを検索 (`rg 'premium' 02_dashboard`) し、段階的に `planCapabilityService` 呼び出しへ置換。
3. `plan-capabilities.json` をデプロイし、管理APIと利用者画面双方で参照するよう Feature Flag 付きでリリース。
4. ローンチ後1週間は `PLAN_DENY` イベントを監視し、誤判定やUI表示不備をサポートと共有する。必要に応じてフォールバックフラグで旧挙動へ戻す。
5. FAQ/ヘルプ/営業資料を更新し、プラン制限の問い合わせ窓口を明示する。

## 10. 今後の拡張余地
- 期間限定キャンペーンやアドオン機能を `addOns` として定義し、`planCapabilityService` がプランと組み合わせて判定できるようにする。
- プラン別利用状況ダッシュボードを追加し、制限値に近づいているユーザーに対して自動通知やアップセルを行う。
- 機能単位でサーバーサイド実行時間やコストを記録し、プランごとの採算管理に活用する。
