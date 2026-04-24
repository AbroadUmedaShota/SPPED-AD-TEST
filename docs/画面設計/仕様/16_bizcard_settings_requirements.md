---
owner: product
status: draft
last_reviewed: 2026-04-24
---

# 名刺データ化設定画面 要件定義書

> **TL;DR**
> - 対象は `02_dashboard/bizcardSettings.html`（401 行）と `02_dashboard/src/bizcardSettings.js`（607 行）、関連サービス `bizcardCalculator.js` / `bizcardPlans.js` / `bizcardSettingsService.js`、レンダラ `ui/bizcardSettingsRenderer.js`。本書はこれら現行実装を根拠にする「実装トレースドキュメント」である。
> - v1.x まで採用していた「本書が正・モックは参照実装」スタンスを破棄し、`15_help_center_requirements.md` と同方針で「画面が正（実装に書かれていないことは要件化しない）」へ刷新した。
> - プランは `trial / normal / express / superExpress / onDemand` の 5 種で `bizcardPlans.js` にハードコードされており、`plan-capabilities.json` は **参照されていない**。プラン別の出し分け（allowedFields, speedPlans, maxAdditionalFields 等）は **完全に未実装**。§11 最重要項目として追跡する。
> - 実サーバ保存（`saveBizcardSettings`）、クーポン検証（`validateCoupon`）、プレミアム多言語の料金加算（`multilingualGroup.unitPrice`）、追加項目の単価加算、いずれもモック・休眠状態。§11 に集約。
> - 2 カラム（左 65% / 右 35% sticky）構成、スキップトグルで左カラム入力エリアと右カラムオーバーレイを同期。見積は入力変更の都度クライアント計算で再描画される。

## 1. 概要

### 1.1 優先度凡例

| 区分 | 意味 |
|------|------|
| **MVP** | 本版で必須。リリース条件。 |
| **Should** | 推奨。合理的理由があれば延期可。 |
| **Nice** | 任意。余力があれば対応。 |
| **Phase 2** | 本版対象外。§11 に集約。 |

### 1.2 目的・想定利用者

アンケート単位で「取得した名刺画像のデータ化を依頼するかどうか」「どのプランで」「何枚見込むか」「追加オプションはどうするか」「クーポンを適用するか」「社内メモに何を残すか」を一画面で確定させ、右カラムの見積サマリーに即時反映する。想定利用者:

- 広告運用担当（新規アンケート作成フローの途中から `surveyCreation.html` / `surveyCreation-v2.html` 経由で遷移し、依頼条件を確定する）。
- 管理者（既存アンケートの編集として `surveyDetailsModal` / ダッシュボード側から `surveyId` 付きで直接遷移する）。

### 1.3 対象範囲 / 対象外

**対象**:
- `02_dashboard/bizcardSettings.html`
- `02_dashboard/src/bizcardSettings.js`
- `02_dashboard/src/services/bizcardPlans.js`
- `02_dashboard/src/services/bizcardCalculator.js`
- `02_dashboard/src/services/bizcardSettingsService.js`
- `02_dashboard/src/ui/bizcardSettingsRenderer.js`

**対象外**（§11 参照のみ）:
- サーバサイドの名刺データ化ワークフロー本体
- 契約プラン（`plan-capabilities.json`）連動による画面制御
- 請求書発行・支払い処理（`invoiceList.html` 系）
- 名刺画像の取得・アップロード側の仕様（アンケート回答画面側）

### 1.4 主要設定値一覧

実装に散在するマジックナンバー・初期値の集約。**太字**は「現行未実装・本書で仕様規定する対象外」項目（§11 に送る）。

| 設定値 | 現行値 | ソース |
|--------|--------|--------|
| 既定プラン | `normal` | [bizcardPlans.js:144](../../../02_dashboard/src/services/bizcardPlans.js#L144) |
| 既定 `bizcardEnabled` | `true`（`!== false` 判定） | [bizcardSettings.js:109](../../../02_dashboard/src/bizcardSettings.js#L109) |
| `skipBizcardToggle` 初期 | `checked`（= 有効 = 非スキップ） | [bizcardSettings.html:101](../../../02_dashboard/bizcardSettings.html#L101) |
| `bizcardRequest` 既定 | `100`（不正値時も 100 に復旧） | [bizcardSettings.js:117](../../../02_dashboard/src/bizcardSettings.js#L117) |
| `bizcardRequest` 入力制約 | `min=0` / `max=9999` | [bizcardSettings.html:147](../../../02_dashboard/bizcardSettings.html#L147) |
| ステッパー刻み | ±1 / ±10 / ±100 | [bizcardSettings.js:217-252](../../../02_dashboard/src/bizcardSettings.js#L217) |
| 最低請求率 | `Math.ceil(requestedCards * 0.5)` | [bizcardCalculator.js:81](../../../02_dashboard/src/services/bizcardCalculator.js#L81) |
| 見積アニメーション時間 | 400ms（金額カウントアップ） | [bizcardSettingsRenderer.js:114](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L114) |
| クーポン検証遅延（モック） | 500ms | [bizcardSettingsService.js:81](../../../02_dashboard/src/services/bizcardSettingsService.js#L81) |
| 保存遅延（モック） | 1,500ms | [bizcardSettingsService.js:97](../../../02_dashboard/src/services/bizcardSettingsService.js#L97) |
| 保存後リダイレクト遅延 | 800ms（成功トースト後） | [bizcardSettings.js:484](../../../02_dashboard/src/bizcardSettings.js#L484) |
| 共有クーポンキー | `sharedCoupon_{surveyId\|'temp'}` | [bizcardSettings.js:119](../../../02_dashboard/src/bizcardSettings.js#L119) |
| 保存後ハンドオフキー | `sessionStorage.updatedSurvey_{surveyId}` | [bizcardSettings.js:489](../../../02_dashboard/src/bizcardSettings.js#L489) |
| 一時保存キー | `localStorage.tempSurveyData` | [bizcardSettings.js:91](../../../02_dashboard/src/bizcardSettings.js#L91) |
| 詳細モーダル DOM | `<dialog id="bizcardDetailsModal">` | [bizcardSettings.html:315](../../../02_dashboard/bizcardSettings.html#L315) |
| 請求注意モーダル DOM | `<dialog id="billingNotesModal">` | [bizcardSettings.html:373](../../../02_dashboard/bizcardSettings.html#L373) |
| **プラン別表示制御** | **未実装**（`plan-capabilities.json` 未参照） | §8 / §11 |
| **多言語オプション単価** | **未定義**（`multilingualGroup.unitPrice` 未設定） | [bizcardCalculator.js:42](../../../02_dashboard/src/services/bizcardCalculator.js#L42) / §11-3 |
| **追加項目単価加算** | **未実装**（料金ロジックなし） | §11-4 |
| **実サーバ保存** | **モックのみ**（console.log） | [bizcardSettingsService.js:94](../../../02_dashboard/src/services/bizcardSettingsService.js#L94) / §11-2 |

---

## 2. 対象画面・関連ファイル

- `02_dashboard/bizcardSettings.html`（401 行、単一ページ）
- `02_dashboard/src/bizcardSettings.js`（607 行、`initBizcardSettings()` を `export`）
- `02_dashboard/src/services/bizcardPlans.js`（5 プラン定義 + 2 プレミアムグループ定義 + legacy マッピング）
- `02_dashboard/src/services/bizcardCalculator.js`（純関数 `calculateEstimate()`）
- `02_dashboard/src/services/bizcardSettingsService.js`（fetch + モッククーポン + モック保存）
- `02_dashboard/src/ui/bizcardSettingsRenderer.js`（プラン/オプション/見積の描画＋バリデーション）
- 共通ルーティング: [main.js:435](../../../02_dashboard/src/main.js#L435) が `bizcardSettings.html` を検知し `initBizcardSettings()` を呼び出す。`#header-placeholder` / `#sidebar-placeholder` / `#footer-placeholder` / `#breadcrumb-container` は共通注入。
- パンくず定義: [breadcrumb.js:20](../../../02_dashboard/src/breadcrumb.js#L20) 「アンケート一覧 > アンケート作成・編集 > 名刺データ化設定」（中央項目は動的リンクのプレースホルダー `#`）。

**依存 CDN**（`bizcardSettings.html` 冒頭）:
- Tailwind CDN（`plugins=forms,container-queries`、[bizcardSettings.html:8](../../../02_dashboard/bizcardSettings.html#L8)）
- Material Icons（同:10）
- `service-top-style.css`（プロジェクト内、同:12）
- Google Fonts Inter / Noto Sans JP（同:15）

---

## 3. 改訂履歴

- v2.0 (2026-04-24): 実装トレース型へ全面刷新。現行実装 5 プラン（`bizcardPlans.js`）・見積計算（`bizcardCalculator.js`）・モッククーポン・モック保存・localStorage/sessionStorage ハンドオフをすべて文書化。`plan-capabilities.json` 未連動・多言語単価未定義・追加項目単価加算なし等の実装ギャップを §11 将来計画に 17 件集約。v1.x 以前の「本書が正、モックは参照実装」スタンスは破棄。
- v1.x (〜 2026-04-02): 本番要件を先行定義した抽象的仕様書。`_archive` 送り相当。エンドポイント・楽観ロック・サーバ再計算等の抽象記述を含んでいたが、実装は単一 JSON 読込＋モック保存のままのため v2.0 で全削除した。

---

## 4. 画面構成

### 4.1 全体レイアウト（ASCII ツリー）

`body.bg-background` 直下はダッシュボード共通の 2 カラム構造（サイドバー + メイン）。メイン領域 `<main id="main-content">` の最大幅は 1400px、`lg` 以上で左 65% / 右 35% の 2 カラムに分岐する。

```
<body class="bg-background text-on-background">
├── #mobileSidebarOverlay                               … モバイル用サイドバーオーバーレイ
├── #header-placeholder                                 … 共通ヘッダー注入
└── <div class="flex flex-1 pt-16 bg-background">
    ├── #sidebar-placeholder                            … 共通サイドバー注入
    └── <main id="main-content">
        ├── #breadcrumb-container                       … パンくず注入（§2）
        ├── <h1 id="pageTitle">                         … 「アンケート『[名]』の名刺データ化設定」
        └── <div class="flex lg:flex-row gap-8 ...">    … 2 カラムコンテナ
            ├── 左カラム (lg:w-[65%])
            │   ├── アンケート基本情報カード              … 名前 / ID / 会期（renderSurveyInfo）
            │   └── <section id="bizcardSettingsFields">
            │       ├── #skipBizcardToggleContainer     … 有効/無効切替 (#skipBizcardToggle)
            │       └── #bizcardFormActiveArea          … 以下スキップ時に .opacity-40 .pointer-events-none .grayscale
            │           ├── STEP1 データ化プランと見込み枚数
            │           │   ├── #dataConversionPlanSelection (role="radiogroup")
            │           │   ├── ステッパー群 (±1/±10/±100)
            │           │   ├── #bizcardRequest (number, min=0 max=9999, value=100)
            │           │   └── #minChargeNotice (hidden→flex)
            │           ├── STEP2 プレミアムオプション
            │           │   └── #premiumOptionsContainer
            │           │       ├── Service Upgrade: premiumMultilingual (toggle)
            │           │       └── Extraction Details: premiumAdditionalItems (multi x3)
            │           └── STEP3 社内管理用メモ
            │               ├── #toggleMemoSection (折り畳みボタン)
            │               └── #memoSection (default .hidden)
            │                   └── #internalMemo (textarea)
            └── 右カラム (lg:w-[35%] lg:sticky lg:top-24)
                └── 料金見積もりサマリーカード
                    ├── #rightColumnDisabledOverlay     … スキップ時 .absolute で全面を覆う
                    ├── #estimatedAmount                … ¥0 初期表示、400ms カウントアップ
                    ├── #estimatedCompletionDate        … 起算日 + 納期で算出
                    ├── #estimateBreakdown              … 内訳 HTML を innerHTML 更新
                    ├── #openBillingNotesModalBtn       … 請求注意モーダル起動
                    ├── #couponSectionWrapper
                    │   ├── #couponInputContainer (#couponCode / #applyCouponBtn / #couponLoadingIndicator / #couponCodeErrorMessage)
                    │   └── #couponAppliedContainer (#appliedCouponCodeDisplay / #appliedCouponSourceDisplay / #removeCouponBtn)
                    ├── 対応言語テキスト (静的文言)
                    ├── #saveBizcardSettingsBtn         … 主アクション
                    └── #cancelBizcardSettings          … 戻る
└── #footer-placeholder

<dialog id="bizcardDetailsModal">                       … プラン詳細仕様モーダル
<dialog id="billingNotesModal">                         … 請求・お支払注意モーダル
```

### 4.2 2 カラム構成とレスポンシブ

- モバイル・タブレット（`<lg`）: 左右を縦積み。右カラムも sticky ではなく通常フローに入る。
- `lg` 以上（1024px 超）: 左 65% / 右 35%、右カラム `sticky top-24` で `max-h-[calc(100vh-8rem)]` の範囲内にとどまる。
- カラム内カードは `rounded-2xl` / `rounded-3xl` + `border-outline-variant/60` + `shadow-sm` で統一。

### 4.3 左カラム（STEP1 / STEP2 / STEP3）

**スキップトグル** (`#skipBizcardToggleContainer`):
- 見出し「名刺のデータ化を行う」＋ヘルプトリガ `help-inline-button`（`data-help-key="noBizcardDigitization"`）。
- 右端に `input#skipBizcardToggle[type=checkbox]`（`sr-only peer`、初期 `checked`）。
- トグル OFF（= スキップ）時、`applySkipState()` が `#bizcardFormActiveArea` に `opacity-40 pointer-events-none grayscale` を付与し、コンテナ背景を `bg-blue-500/10` / `border-blue-500/30` に変える（[bizcardSettings.js:263-288](../../../02_dashboard/src/bizcardSettings.js#L263)）。

**STEP1 データ化プランと見込み枚数**:
- 見出し「1. データ化プランと見込み枚数」＋ `data-help-key="bizcardPlanAndSpeed"` のヘルプトリガ、右端に「詳細仕様を見る」ボタン `#openBizcardDetailsModalBtn`。
- `#dataConversionPlanSelection` は `role="radiogroup"`、`grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4`。`renderDataConversionPlans()` が 5 プランのカードを動的生成（[bizcardSettingsRenderer.js:233](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L233)）。
- 見込み枚数エリアは `<label for="bizcardRequest">` + ステッパー群 + `<input id="bizcardRequest" type="number" min="0" max="9999" value="100">` + `.input-error-message`（[bizcardSettings.html:147-150](../../../02_dashboard/bizcardSettings.html#L147)）。
- 最低請求バッジ `#minChargeNotice` は `requestedCards > 0` かつ `minCharge > 0` の場合にテキスト「実際の件数が N 枚に満たない場合でも…」を表示。`requestedCards < minChargeCards` の場合は `text-error bg-error/10` の警告色に変化（[bizcardSettingsRenderer.js:213-219](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L213)）。
- 注記文言: 「※未選択の場合は設定を完了できません。請求は毎月末締め・翌月末払いです。…」（HTML 直書き、[bizcardSettings.html:172-174](../../../02_dashboard/bizcardSettings.html#L172)）。

**STEP2 プレミアムオプション**:
- `#premiumOptionsContainer` は初期 `grid gap-4 sm:grid-cols-2` だが、`renderPremiumOptions()` 内で `space-y-8` に上書きされ、2 グループのセクションに再構成される（[bizcardSettingsRenderer.js:395](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L395)）。
- グループ 1 `Service Upgrade`: `premiumMultilingual`（toggle、単一チェックボックス、`unitPriceLabel` があれば価格バッジ描画だが `bizcardPlans.js` には未定義）。
- グループ 2 `Extraction Details`: `premiumAdditionalItems`（multi、3 オプション `secondPhone` / `secondAddress` / `handwrittenMemo`、チェック複数可）。

**STEP3 社内管理用メモ**:
- `#toggleMemoSection` 押下で `#memoSection` の `.hidden` をトグル、矢印アイコンを `rotate-180`（[bizcardSettings.js:187-193](../../../02_dashboard/src/bizcardSettings.js#L187)）。
- `<textarea id="internalMemo">` は `input-group` + `input-field` / `input-label` パターン、最低 100px。

### 4.4 右カラム（見積・確定 sticky）

- カード全体を覆う `#rightColumnDisabledOverlay` は `absolute inset-0 bg-surface/50 backdrop-blur-[1px] z-10 hidden`。スキップ時のみ `hidden` を外して全面を覆う。内部要素は `z-20` に上げてあるが、`pointer-events-none` 付きで操作不可にする。
- `#estimatedAmount` は `text-4xl font-black`、`renderEstimate()` で 400ms の `requestAnimationFrame` カウントアップ描画（[bizcardSettingsRenderer.js:103-138](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L103)）。スキップ時は `state.isSkipped` 分岐で金額 0 を強制。
- `#estimatedCompletionDate` は `innerHTML` で 2 行（完了日 + 「起算日 XX + 納期 N 日」小字）を書き換える（同:145-152）。スキップ時は `data化を実施しない`。
- `#estimateBreakdown` は想定件数・内訳・選択オプション・合計・最低請求の複合 HTML を `innerHTML` に一括代入（同:181-197）。
- `#openBillingNotesModalBtn` 押下で `billingNotesModal.showModal()`。
- クーポンセクション `#couponSectionWrapper`:
  - 未適用時: `#couponInputContainer`（`#couponCode` 入力 + `#applyCouponBtn` + ローディング `#couponLoadingIndicator` + エラー `#couponCodeErrorMessage` / `#couponCodeErrorText`）を表示。
  - 適用中: `#couponAppliedContainer`（コード表示 `#appliedCouponCodeDisplay` + 共有ソース `#appliedCouponSourceDisplay` + 解除 `#removeCouponBtn`）を表示。`#appliedCouponCodeDisplay` は HTML 直書きの `SUMMER2026` で初期表示され（[bizcardSettings.html:274](../../../02_dashboard/bizcardSettings.html#L274)）、初期化完了時に JS が上書きする（§11-13 チラつきリスク）。
  - スキップ時は `#couponSectionWrapper` に `opacity-50 pointer-events-none grayscale bg-surface` を追加してグレーアウト（[bizcardSettings.js:578-584](../../../02_dashboard/src/bizcardSettings.js#L578)）。
- 対応言語: 静的テキスト「日本語 / 英語 / 中国語（繁体字・簡体字） / 韓国語」を HTML 直書き。
- 保存ボタン `#saveBizcardSettingsBtn`（`#saveBizcardSettingsBtnText` + `#saveBizcardSettingsBtnLoading`）と戻るボタン `#cancelBizcardSettings`。

### 4.5 モーダル

2 つの `<dialog>` を HTML 末尾に配置（`showModal()` で表示）。

| モーダル | 起動ボタン | 閉じるボタン | 用途 |
|----------|------------|--------------|------|
| `#bizcardDetailsModal` | `#openBizcardDetailsModalBtn`（「詳細仕様を見る」） | `#closeBizcardDetailsModalBtn` / `#closeBizcardDetailsModalActionBtn` | 「無料 2 項目」「スタンダード 10 項目」「共通の入力規則」の静的解説（[bizcardSettings.html:315-370](../../../02_dashboard/bizcardSettings.html#L315)） |
| `#billingNotesModal` | `#openBillingNotesModalBtn` | `#closeBillingNotesModalBtn` / `#closeBillingNotesModalActionBtn` | 「見込み × 単価」「会期開始後は変更不可」「クーポンはアンケート全体に適用」「最低請求 50%」等の静的注記（同:373-395） |

両モーダルとも `aria-labelledby` は未設定（§11-17）。

---

## 5. 機能要件

### 5.1 スキップトグル [**MVP**]

- DOM: `input#skipBizcardToggle[type=checkbox]`（`sr-only peer`、初期 `checked`）。
- `change` イベントで `state.isSkipped = !checked`、`state.settings.bizcardEnabled = !state.isSkipped` を同期（[bizcardSettings.js:180-185](../../../02_dashboard/src/bizcardSettings.js#L180)）。
- スキップ ON 時:
  - `#bizcardFormActiveArea` に `opacity-40 pointer-events-none grayscale` 付与。
  - `#rightColumnDisabledOverlay.hidden` を外して右カラム全面を覆う。
  - `#couponCode` / `#applyCouponBtn` を `disabled=true`。
  - `#bizcardRequest.border-error` を除去（エラー表示を消す）。
  - 見積計算時に `bizcardRequest: 0, dataConversionPlan: 'none', premiumOptions: 空` を強制して amount=0、`#estimatedCompletionDate` を「データ化を実施しない」に固定（[bizcardSettings.js:520-531](../../../02_dashboard/src/bizcardSettings.js#L520)）。
- スキップ OFF（= 有効）時は上記をすべて解除。

### 5.2 STEP1: プラン選択と見込み枚数 [**MVP**]

**プラン選択**:
- `DATA_CONVERSION_PLANS`（5 件、§6.2）を `renderDataConversionPlans()` が `<label>` + `<input type="radio" name="dataConversionPlan">` カードとして描画。
- クリックで `change` イベントを発火させ `handleFormChange()` が `state.settings.dataConversionPlan` と連動して `dataConversionSpeed`（`plan.speedValue`）を同時更新（[bizcardSettings.js:352-356](../../../02_dashboard/src/bizcardSettings.js#L352)）。
- 未選択状態は `normalizePlanValue()` が `DEFAULT_PLAN='normal'` を返すため、実質「必ず normal 相当が選択済み」になる。
- `dataConversionSpeed` フィールドは state に保持されるが UI の入力要素は存在せず、送信時にも保存ペイロードへ載るだけの死フィールド（§11-12）。

**見込み枚数入力**:
- `<input id="bizcardRequest" type="number" min="0" max="9999" value="100">` が主入力。
- ステッパー ±1 / ±10 / ±100（計 6 ボタン）は `setRequestCount(newVal)` を呼び、`Math.max(0, Math.min(9999, ...))` で clamp したうえで `state.settings.bizcardRequest` とインプットを同期し `updateFullUI()` を呼ぶ（[bizcardSettings.js:208-214](../../../02_dashboard/src/bizcardSettings.js#L208)）。
- `#bizcardRequest` 本体の `input` イベントは `handleFormChange`（L170）と `setRequestCount` ラッパ（L253）の**二重登録**で、両方から発火する（§11-5）。
- `updateFullUI()` は `document.activeElement !== bizcardRequestInput` の条件付きで `input.value` を上書きする（フォーカス中のキャレット位置保持のため）。

**最低請求バッジ**:
- `minChargeCards = Math.ceil(requestedCards * 0.5)`、`minCharge = minChargeCards * unitPrice`。
- `requestedCards < minChargeCards` は論理的に起こり得ない（半分 ≤ 全数）ため、現状この条件分岐はデッドパスに近い。ただし `trial` プラン時は `unitPrice=0` で `minCharge=0` となり表示 off になる。

### 5.3 STEP2: プレミアムオプション [**MVP（表示）/ Phase 2（料金）**]

2 グループを `renderPremiumOptions(PREMIUM_OPTION_GROUPS, state.settings.premiumOptions)` が描画。

- **Service Upgrade（グループ `multilingual`、type=toggle）**:
  - `input[name="premiumMultilingual"]` 単一チェックボックス。
  - 選択中は `state.settings.premiumOptions.multilingual = true`。
  - 料金加算: `premiumUnitAddOn = multilingualGroup.unitPrice ?? 0`。`bizcardPlans.js` に `unitPrice` が **未定義**のため常に 0 を加算する休眠ロジック（§11-3）。
- **Extraction Details（グループ `additionalItems`、type=multi）**:
  - `input[name="premiumAdditionalItems"]` 複数チェック。`value` は `secondPhone` / `secondAddress` / `handwrittenMemo` の 3 種。
  - 選択中アイテムは `state.settings.premiumOptions.additionalItems: string[]` に保持。`normalizePremiumOptions()` が許可リストで絞り込み（[bizcardPlans.js:163-190](../../../02_dashboard/src/services/bizcardPlans.js#L163)）。
  - 料金加算ロジック **なし**。選択中アイテムは見積内訳の「選択オプション: …」に **タイトル表示のみ**（§11-4）。

### 5.4 STEP3: 社内メモ [**MVP**]

- `#toggleMemoSection` ボタンで `#memoSection.hidden` をトグル、`<span.material-icons>` に `rotate-180` をトグル。
- `<textarea id="internalMemo">` は任意入力、バリデーション・文字数上限ともになし。
- 保存時 `savedData.internalMemo = internalMemoInput.value` で直接ペイロードへ入る（[bizcardSettings.js:474](../../../02_dashboard/src/bizcardSettings.js#L474)）。

### 5.5 見積計算（bizcardCalculator） [**MVP**]

入口は `calculateEstimate(settings, appliedCoupon, surveyEndDate)` 純関数（[bizcardCalculator.js:20](../../../02_dashboard/src/services/bizcardCalculator.js#L20)）。

**アルゴリズム**:

```
if (!settings.bizcardEnabled) return { amount: 0, completionDate: '未定' }

normalizedPlan = normalizePlanValue(settings.dataConversionPlan || DEFAULT_PLAN)
planConfig     = getPlanConfig(normalizedPlan) || getPlanConfig(DEFAULT_PLAN)
unitPrice      = planConfig.unitPrice ?? 0
turnaroundDays = planConfig.turnaroundDays ?? 0
requestedCards = max(0, parseInt(settings.bizcardRequest) || 0)

amount = 0
completionDays = turnaroundDays
if (normalizedPlan !== 'trial') amount += requestedCards * unitPrice

premiumSelections = normalizePremiumOptions(settings.premiumOptions)
premiumUnitAddOn  = premiumSelections.multilingual ? (multilingualGroup.unitPrice ?? 0) : 0
premiumTotal      = requestedCards * premiumUnitAddOn
amount += premiumTotal

if (appliedCoupon.type === 'discount'):
    couponAmount = min(preDiscount, max(0, coupon.value || 0))
    amount       = max(0, preDiscount - couponAmount)
if (appliedCoupon.type === 'speedBoost'):
    completionDays = max(0.1, completionDays - coupon.value)

startDate           = surveyEndDate ? new Date(surveyEndDate) : new Date()
calculationBaseDate = new Date(startDate)           // 参考: §11-6 バグあり
completionDate      = startDate.setDate(startDate.getDate() + completionDays)
minChargeCards      = Math.ceil(requestedCards * 0.5)
minCharge           = minChargeCards > 0 ? minChargeCards * unitPrice : 0
couponPercent       = preDiscount > 0 ? Math.round(couponAmount / preDiscount * 100) : 0
```

**戻り値フィールド**（[bizcardCalculator.js:84-100](../../../02_dashboard/src/services/bizcardCalculator.js#L84)）:

| フィールド | 型 | 意味 |
|------------|----|------|
| `amount` | number | ご請求見込み金額（税別、クーポン適用後） |
| `completionDate` | string | `ja-JP` ロケールの完了予定日 |
| `turnaroundDays` | number | クーポン適用後の納期日数 |
| `calculationBaseDate` | string | 起算日（`surveyEndDate` または現在日時） |
| `unitPrice` | number | 選択プランの単価 |
| `requestedCards` | number | 見込み枚数（0 以上の整数に丸め） |
| `preDiscount` | number | クーポン適用前の金額 |
| `couponAmount` | number | クーポン割引額 |
| `couponPercent` | number | 割引率（%） |
| `minCharge` | number | 最低請求金額 |
| `minChargeCards` | number | 最低請求対象枚数 |
| `premiumTotal` | number | プレミアム加算合計（現状常に 0） |
| `premiumUnitAddOn` | number | プレミアム単価加算（現状常に 0） |
| `selectedPremiumOptions` | Array | `{ value, title: { ja, en } }[]` |
| `premiumSelections` | object | 正規化済み選択状態 |

### 5.6 クーポン適用・解除 [**MVP**]

**適用フロー** `handleApplyCoupon()`（[bizcardSettings.js:379-417](../../../02_dashboard/src/bizcardSettings.js#L379)）:

1. `state.isCouponProcessing` チェックで二重実行防止。
2. 入力値を `trim()`、空なら `showCouponError('クーポンコードを入力してください。')`。
3. `updateCouponSectionUI()` で `#applyCouponBtn` を隠し `#couponLoadingIndicator` を表示、`#couponCode.disabled=true`。
4. `validateCoupon(code)` 呼出（500ms モック遅延、§6.4）。
5. 成功時:
   - `state.appliedCoupon = { ...result, code }`、`state.isCouponApplied = true`、`state.isAppliedInThisScreen = true`。
   - `localStorage.setItem('sharedCoupon_{surveyId|temp}', code)`。
   - `#couponCode.value = ''`、エラー領域を隠し、トースト「クーポン『XX』を適用しました。」。
6. 失敗時: `showCouponError(result.message || '無効なクーポンコードです。')`。
7. `finally` で `isCouponProcessing=false` → `updateCouponSectionUI()` + `updateFullUI()`。

**解除フロー** `handleRemoveCoupon()`（同:419-434）:
1. `showConfirmationModal('クーポンを解除すると、アンケート全体の料金お値引きが取り消されます。解除しますか？', ...)`。
2. 確定押下で `state.appliedCoupon=null` / `isCouponApplied=false` / `settings.couponCode=''`。
3. `localStorage.removeItem('sharedCoupon_...')`。
4. `#couponCode.value=''` + トースト「クーポンを解除しました。」+ `updateCouponSectionUI()` + `updateFullUI()`。

**共有クーポン表示**:
- 他設定画面（お礼メール等、同一 `sharedCoupon_{surveyId|temp}` を使う）から適用されたコードの場合、初期化時に `state.isAppliedInThisScreen=false` で取り込み、`#appliedCouponSourceDisplay` に「※他設定より適用（共有）」を表示（[bizcardSettings.js:131](../../../02_dashboard/src/bizcardSettings.js#L131), [bizcardSettings.js:554-560](../../../02_dashboard/src/bizcardSettings.js#L554)）。

### 5.7 保存・キャンセル・離脱警告 [**MVP**]

**保存** `handleSaveSettings()`（[bizcardSettings.js:445-502](../../../02_dashboard/src/bizcardSettings.js#L445)）:

1. スキップ OFF 時のみ `validateForm(false)` 実行。不合格なら `showToast('入力内容に不備があります。確認してください。', 'error')` で終了。
2. `#saveBizcardSettingsBtn.disabled=true`、テキスト `opacity-0`、ローディングアイコン表示、`document.body.style.pointerEvents='none'` で全画面操作不可。
3. ペイロード構築:
   ```
   savedData = { ...state.settings,
                 bizcardEnabled: !state.isSkipped,
                 couponCode: state.appliedCoupon?.code || null,
                 internalMemo: internalMemoInput.value || '' }
   ```
4. 分岐:
   - `!state.surveyId`（新規作成フロー）: `localStorage.tempSurveyData.settings.bizcard = savedData` を書き戻し、トースト「設定を一時保存しました。」、800ms 後 `state.fromPage` に遷移。
   - `state.surveyId` あり: `savedData.surveyId = state.surveyId` を付け `saveBizcardSettings(savedData)`（**モック、1500ms 遅延 + `console.log` のみ**、§11-2）。結果 `success` なら `sessionStorage.updatedSurvey_{surveyId} = JSON.stringify(savedData)` を書き、トースト「名刺データ化設定を保存しました！」、800ms 後 `${state.fromPage}?surveyId=...` に遷移。
5. `catch` でエラートースト。`finally` 内の `if (!state.surveyId || !saveButton.disabled) finalizeSave()` は条件式が直感と逆向きで要精査（§11-8）。

**キャンセル** `handleCancel()`:
- `hasFormChanged()` が true なら `showConfirmationModal('変更が保存されていません。破棄して前の画面に戻りますか？', ...)`。
- false または確定時は `state.fromPage + ?surveyId=...` に遷移。

**離脱警告**:
- `window.addEventListener('beforeunload', e => { if (hasFormChanged()) { e.preventDefault(); e.returnValue=''; } })`（[bizcardSettings.js:325-330](../../../02_dashboard/src/bizcardSettings.js#L325)）。
- `hasFormChanged()` は `bizcardEnabled` / `bizcardRequest` / `dataConversionPlan` / `internalMemo` / `premiumOptions.multilingual` / `premiumOptions.additionalItems`（配列）/ クーポンコードの 7 項目を `state.initialSettings` と比較する（同:290-322）。

### 5.8 URL パラメータ（surveyId / from） [**MVP**]

`new URLSearchParams(window.location.search)` から取得（[bizcardSettings.js:77-79](../../../02_dashboard/src/bizcardSettings.js#L77)）。

| パラメータ | 値 | 影響 |
|------------|----|------|
| `surveyId` | 任意文字列 | 有れば既存アンケート編集、無ければ `tempSurveyData` 経由の新規作成フロー |
| `from` | `'v2'` / その他 | `'v2'` なら `state.fromPage='surveyCreation-v2.html'`、それ以外は `'surveyCreation.html'` |

### 5.9 初期化フロー [**MVP**]

`initializePage()`（[bizcardSettings.js:76-165](../../../02_dashboard/src/bizcardSettings.js#L76)）:

1. URL から `surveyId` / `from` を取得。
2. データソース分岐:
   - **既存アンケート編集** (`surveyId` あり): `Promise.all([fetchSurveyData(surveyId), fetchBizcardSettings(surveyId)])`。両関数とも `data/core/surveys.json` を **個別に fetch** する（§11-14）。`survey.bizcardSettings` が無ければフォールバック（bizcardEnabled=true, bizcardRequest=100, dataConversionPlan='normal', dataConversionSpeed='normal', couponCode='', internalMemo=''）を返す。
   - **新規作成フロー** (`surveyId` なし): `localStorage.tempSurveyData` を JSON パース。無ければエラートースト + 2 秒後 `state.fromPage` へリダイレクト。`surveyData = { id, name, displayTitle, periodStart, periodEnd }`、`settingsData = tempData.settings?.bizcard || {}`。
3. 正規化:
   - `settingsData.bizcardEnabled = settingsData.bizcardEnabled !== false`（明示的 false のみ無効扱い）。
   - `normalizePlanValue()` で legacy 値を変換（§6.5）。
   - `getPlanConfig().speedValue` を `dataConversionSpeed` に代入。
   - `normalizePremiumOptions()` で premium を正規化。
   - `bizcardRequest = Number.isFinite(parsedInt) && >= 0 ? parsedInt : 100`。
4. クーポン初期化:
   - `sharedCoupon_{surveyId|'temp'}` を localStorage から取得。
   - 共有クーポンがあれば優先、無ければ `settingsData.couponCode`。
   - 値があれば `await validateCoupon(code)`。成功なら `state.appliedCoupon`、失敗なら `localStorage.removeItem(sharedCouponKey)`。
5. `state.initialSettings = JSON.parse(JSON.stringify(settingsData))` でディープコピー。
6. レンダリング:
   - `renderSurveyInfo(surveyData, surveyId)`
   - `setInitialFormValues(state.settings)`
   - `skipBizcardToggle.checked = !state.isSkipped` + `applySkipState()`
   - `setupEventListeners()`
   - `updateFullUI()`

### 5.10 リアルタイム再計算トリガー [**MVP**]

以下のいずれかで `updateFullUI()` → `calculateEstimate()` → `renderEstimate()` の連鎖が走る。

| トリガ | ハンドラ | 備考 |
|--------|----------|------|
| `#bizcardRequest` の `input` / `change` | `handleFormChange` + `setRequestCount` | **二重登録**（§11-5） |
| `input[name="dataConversionPlan"]` の `change` | `handleFormChange` | プラン + `dataConversionSpeed` 同時更新 |
| ステッパー ±1/±10/±100 クリック | `setRequestCount(clamped)` | 0〜9999 に clamp |
| `#premiumOptionsContainer` の `change` | `handlePremiumOptionChange` | `multilingual` と `additionalItems` を同ハンドラで分岐 |
| `#skipBizcardToggle` の `change` | インライン関数 → `applySkipState()` + `updateFullUI()` | 金額強制 0 |
| クーポン適用/解除完了 | `handleApplyCoupon` / `handleRemoveCoupon` | `finally` で `updateFullUI()` |
| 初期化直後 | `initializePage()` 末尾 | 初回描画 |

---

## 6. データモデル

### 6.1 `state` オブジェクト構造

`initBizcardSettings()` クロージャ内で保持（[bizcardSettings.js:64-74](../../../02_dashboard/src/bizcardSettings.js#L64)）:

| キー | 型 | 説明 |
|------|----|------|
| `surveyId` | `string \| null` | URL `?surveyId` の取得値。新規作成時は null |
| `fromPage` | `string` | `'surveyCreation.html'` または `'surveyCreation-v2.html'` |
| `settings` | `object` | 現在の編集値（`bizcardEnabled` / `bizcardRequest` / `dataConversionPlan` / `dataConversionSpeed` / `premiumOptions` / `couponCode` / `internalMemo`） |
| `initialSettings` | `object` | `JSON.parse(JSON.stringify(settings))` でディープコピーされた初期値。`hasFormChanged()` の比較元 |
| `surveyData` | `object` | `fetchSurveyData()` または `tempSurveyData` からの基本情報 |
| `appliedCoupon` | `object \| null` | `{ type: 'discount'\|'speedBoost', value, message, code }` |
| `isCouponApplied` | `boolean` | 適用状態フラグ |
| `isCouponProcessing` | `boolean` | API 呼出中フラグ（二重押下防止） |
| `isAppliedInThisScreen` | `boolean` | 本画面で適用 or 他画面から共有されたかの区別（ソースラベル表示用） |
| `isSkipped` | `boolean` | スキップトグル状態（= `!bizcardEnabled`） |

### 6.2 5 プラン定義（`bizcardPlans.js`）

`DATA_CONVERSION_PLANS` 配列（[bizcardPlans.js:1-90](../../../02_dashboard/src/services/bizcardPlans.js#L1)）。

| `value` | 表示名 (ja) | `unitPrice` | `speedValue` | `turnaroundDays` | `turnaroundLabel (ja)` | バッジ |
|---------|-------------|-------------|--------------|------------------|------------------------|--------|
| `trial` | お試し | 0 | `normal` | 6 | 6営業日 | 「無料」 |
| `normal` | 通常 | 50 | `normal` | 6 | 6営業日 | 「おすすめ」 |
| `express` | 特急 | 100 | `express` | 3 | 3営業日 | — |
| `superExpress` | 超特急 | 150 | `superExpress` | 1 | 1営業日 | — |
| `onDemand` | オンデマンド | 200 | `onDemand` | 0 | 当日中 | 「最優先」 |

補足:
- `trial` は `calculateEstimate` で `amount += requestedCards * unitPrice` をスキップする（[bizcardCalculator.js:34-36](../../../02_dashboard/src/services/bizcardCalculator.js#L34)）。`unitPrice=0` なので結果は同じだが「プランとしての例外扱い」は明示される。
- `DEFAULT_PLAN = 'normal'`（[bizcardPlans.js:144](../../../02_dashboard/src/services/bizcardPlans.js#L144)）。

### 6.3 プレミアムオプション定義

`PREMIUM_OPTION_GROUPS`（[bizcardPlans.js:92-142](../../../02_dashboard/src/services/bizcardPlans.js#L92)）。

| `value` | `type` | 表示名 (ja) | 料金加算 | 備考 |
|---------|--------|-------------|----------|------|
| `multilingual` | `toggle` | 多言語対応 | `multilingualGroup.unitPrice ?? 0` = **0**（未定義） | §11-3 |
| `additionalItems.secondPhone` | `multi` 内 | 電話番号2つ目 | なし | §11-4 |
| `additionalItems.secondAddress` | `multi` 内 | 住所2つめ | なし | §11-4 |
| `additionalItems.handwrittenMemo` | `multi` 内 | 手書きメモ | なし | §11-4 |

### 6.4 クーポン定義（モック）

`mockCoupons`（[bizcardSettingsService.js:9-13](../../../02_dashboard/src/services/bizcardSettingsService.js#L9)）。

| コード | `type` | `value` | `message` |
|--------|--------|---------|-----------|
| `SAVE10` | `discount` | 1000 | クーポン「SAVE10」が適用されました (-¥1,000)。 |
| `SPEEDUP` | `speedBoost` | 1 | クーポン「SPEEDUP」が適用されました (納期1営業日短縮)。 |
| `test` | `discount` | 10000 | テスト用クーポン「test」が適用されました (-¥10,000)。 |

- 検証は 500ms `setTimeout` のモック。サーバ連携は §11-7。
- 成功時の返り値: `{ success: true, type, value, message }`。
- 未知コード: `{ success: false, message: '無効なクーポンコードです。' }`。
- 共有キー: `localStorage.sharedCoupon_{surveyId|'temp'}`。`thankYouEmailSettings` 等、同一アンケートの他設定画面と同じキーを使う。

### 6.5 legacy プラン値マッピング

`normalizePlanValue(value)`（[bizcardPlans.js:150-161](../../../02_dashboard/src/services/bizcardPlans.js#L150)）。

| legacy 値 | 変換後 |
|-----------|--------|
| `free` | `trial` |
| `standard` | `normal` |
| `premium` | `superExpress` |
| `enterprise` | `onDemand` |
| `custom` | `onDemand` |

未変換の値は `getPlanConfig()` が見つけられるかを確認し、該当なければ `DEFAULT_PLAN='normal'` にフォールバック。

### 6.6 保存ペイロード形式

`handleSaveSettings()` が組み立てる `savedData`（[bizcardSettings.js:470-475](../../../02_dashboard/src/bizcardSettings.js#L470)）:

```json
{
  "bizcardEnabled": true,
  "bizcardRequest": 100,
  "dataConversionPlan": "normal",
  "dataConversionSpeed": "normal",
  "premiumOptions": {
    "multilingual": false,
    "additionalItems": ["secondPhone"]
  },
  "couponCode": "SAVE10",
  "internalMemo": "...",
  "surveyId": "sv_0001_26008"        // 既存編集時のみ付与
}
```

書き込み先:
- `surveyId` なし: `localStorage.tempSurveyData.settings.bizcard`。
- `surveyId` あり: `sessionStorage.updatedSurvey_{surveyId}` にハンドオフ、`saveBizcardSettings()` は console.log のみで実サーバ未送信。

---

## 7. バリデーション

### 7.1 項目別バリデーション表

現行実装が行っているチェックのみ。整合性チェック（プラン上限・フィールド数制限）は §8・§11-1 で未実装と明示。

| 項目 | 条件 | 違反時 | 実装位置 |
|------|------|--------|----------|
| `bizcardRequest`（スキップ OFF 時） | `parseInt(value) > 0`、`NaN` 不可 | `.input-error-message` に「1枚以上必要です」、`.border-error` 付与、保存ボタン disabled | [bizcardSettingsRenderer.js:559-572](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L559) |
| `bizcardRequest`（スキップ ON 時） | チェックなし（常に valid） | エラー表示除去、保存ボタン enabled | 同:551-557 |
| `bizcardRequest`（入力制約） | `min=0` `max=9999` | HTML5 標準の範囲外警告のみ | [bizcardSettings.html:147](../../../02_dashboard/bizcardSettings.html#L147) |
| `bizcardRequest`（ステッパー） | 0〜9999 に clamp、非数は 0 | 自動補正、エラーなし | [bizcardSettings.js:210](../../../02_dashboard/src/bizcardSettings.js#L210) |
| `dataConversionPlan` | 未選択時は `DEFAULT_PLAN` に復元 | エラーなし | [bizcardPlans.js:150](../../../02_dashboard/src/services/bizcardPlans.js#L150) |
| `premiumOptions.additionalItems` | 許可リスト外は破棄 | エラーなし | [bizcardPlans.js:178-188](../../../02_dashboard/src/services/bizcardPlans.js#L178) |
| `couponCode` | 空文字時は「クーポンコードを入力してください。」、未知コードは「無効なクーポンコードです。」 | `#couponCodeErrorMessage` 表示 | [bizcardSettings.js:382-386, 407](../../../02_dashboard/src/bizcardSettings.js#L382) |
| `internalMemo` | なし | — | — |

`validateForm()` は `#input-error-message` を `bizcardRequestInput.parentElement` 内から 1 件だけ拾う実装で、複数箇所にはスケールしない（§11-15）。

### 7.2 エラー表示仕様

- `bizcardRequest`: `.input-error-message`（高さ 3px 固定プレースホルダ、HTML 直書き）にテキスト挿入、`#bizcardRequest` に `.border-error` 付与。
- クーポン: `#couponCodeErrorMessage`（非表示時 `.hidden`）を外し、`#couponCodeErrorText` にメッセージ。
- 保存失敗: `showToast(message, 'error')`。
- `aria-live` は付与されていない（§11-16）。

### 7.3 離脱警告（beforeunload）

- `hasFormChanged()` が true の場合のみ `e.preventDefault()` + `e.returnValue=''`（標準の「このサイトを離れますか？」ダイアログ発火）。
- `hasFormChanged()` の比較項目は §5.7 の 7 項目。スキップ時は `bizcardRequest` / `dataConversionPlan` / `premiumOptions` の比較をスキップする（[bizcardSettings.js:306-311](../../../02_dashboard/src/bizcardSettings.js#L306)）。

---

## 8. プラン連動（現状ギャップ）

### 8.1 `plan-capabilities.json` 想定スキーマ

他の仕様書（`11_plan_feature_restrictions` 相当）で想定される契約プラン別の表示制御パラメータ:

| フィールド | 想定意味 |
|------------|----------|
| `allowedFields` | プラン別に許可される名刺項目 |
| `speedPlans` | プランで利用可能なデータ化速度（`normal` / `express` / `superExpress` / `onDemand`） |
| `maxAdditionalFields` | 追加項目選択可能数の上限 |
| `multilingualAvailable` | 多言語オプションの利用可否 |

### 8.2 現状の未連動項目

- `bizcardSettings.js` からは `plan-capabilities.json` を **一切 fetch していない**（`Grep` 検証済）。
- プラン別のラジオ disabled / 追加項目上限チェック / 多言語 toggle の非活性化、いずれも未実装。契約プランに関わらず 5 プラン全てが常に選択可能な状態。
- `dataConversionSpeed` フィールドは state 保持のみで UI 入力がなく、`speedPlans` 制限の受け皿にもなっていない。

§11-1 で最重要項目として追跡。

---

## 9. 非機能要件

### 9.1 パフォーマンス [**Should**]

- 計算は全てクライアント純関数。目安: 見込み枚数 0〜9,999 枚 × 5 プラン × 4 オプションの組合せで `calculateEstimate()` は µs オーダー、金額カウントアップ描画は 400ms。
- 再計算トリガは `updateFullUI()` 1 本に集約されており、debounce は未実装。入力連打時は毎 `input` イベントでフル再レンダリングされる。大規模化する場合は debounce 検討（§11）。

### 9.2 アクセシビリティ [**Should**]

- プラン選択コンテナ `#dataConversionPlanSelection` に `role="radiogroup"` 付与（[bizcardSettings.html:120](../../../02_dashboard/bizcardSettings.html#L120)）。
- ステッパーは各 `<button>` に `aria-label`「100枚減らす」「10枚減らす」「1枚減らす」「1枚増やす」「10枚増やす」「100枚増やす」付与（同:137-163）。
- ヘルプトリガ `.help-trigger` に `aria-label` 付与（例: 「アンケート名の説明を表示」）。
- モーダルは `<dialog>` 要素で `showModal()` / `close()`。

**欠落**:
- `#skipBizcardToggle` に `aria-checked` / `aria-label` 未設定。
- `#bizcardDetailsModal` / `#billingNotesModal` に `aria-labelledby` 未設定（§11-17）。
- `#estimatedAmount` / `#estimatedCompletionDate` / `#estimateBreakdown` に `aria-live` 未設定（金額変動が支援技術に通知されない、§11-16）。
- `#couponCodeErrorMessage` / `.input-error-message` に `aria-live` / `role="alert"` 未設定。

### 9.3 対応ブラウザ

- 最新 2 バージョンの Chrome / Firefox / Safari / Edge を暫定（他ページと同水準）。`<dialog>` `showModal()` は Safari 15.4+ が必要。

### 9.4 セキュリティ（localStorage、クーポン共有）

- `tempSurveyData` / `sharedCoupon_{...}` / `sessionStorage.updatedSurvey_{...}` はすべてドメイン内ブラウザストレージ、外部送信しない。
- クーポンコードは同一オリジンの他タブから `storage` イベントで読める状態（ただし現行購読なし）。
- `internalMemo` は社内向け任意入力で、サーバ未送信モック状態ではどこにも転送されないが、実サーバ化時は PII を含み得る前提で扱う必要がある（§11-2）。
- XSS: プラン名・オプション名・クーポンメッセージはすべてコード内ハードコードで、ユーザ入力を `innerHTML` に差し込む経路はない。例外として `#appliedCouponCodeDisplay.textContent = state.appliedCoupon.code` で `textContent` 代入のみのため安全（[bizcardSettings.js:552](../../../02_dashboard/src/bizcardSettings.js#L552)）。

---

## 10. Definition of Done

リリース判定権限者: プロダクトオーナー（TBD）。

**機能要件**:
- [ ] §5.1 スキップトグル ON/OFF で `#bizcardFormActiveArea` と `#rightColumnDisabledOverlay` が連動
- [ ] §5.2 プラン選択で `dataConversionSpeed` も自動更新される
- [ ] §5.2 ステッパー ±1/±10/±100 が 0〜9999 に clamp
- [ ] §5.2 最低請求バッジが `requestedCards > 0` かつ `unitPrice > 0` 時に表示
- [ ] §5.3 プレミアム多言語 toggle と追加項目 3 種の選択が state に保存される
- [ ] §5.4 社内メモ折り畳みが正しく開閉し、保存ペイロードに反映される
- [ ] §5.5 見積計算の 15 フィールドが想定値で返る（test: requestedCards=100, plan=normal, coupon=SAVE10 → amount=4000, couponAmount=1000 等）
- [ ] §5.6 クーポン 3 コードが適用・解除できる、共有ラベル表示
- [ ] §5.7 保存で `tempSurveyData` / `sessionStorage.updatedSurvey_` / `fromPage` 遷移が機能
- [ ] §5.7 離脱警告が変更時のみ発火
- [ ] §5.8 `from=v2` で `surveyCreation-v2.html` に戻る
- [ ] §5.9 既存 `surveyId` 編集時に `survey.bizcardSettings` 値が初期表示される

**非機能要件**:
- [ ] §9.2 プラン選択がキーボードのみで完結する
- [ ] §9.2 スキップ時のオーバーレイが右カラム全体を覆う
- [ ] モバイル・タブレット・デスクトップで崩れなし

**受入シナリオ**:

| # | 手順 | 期待結果 |
|---|------|---------|
| A1 | `?surveyId=sv_0001_26008` で遷移 | 基本情報 + 既存設定が表示、デフォルトは normal プラン |
| A2 | `-100` ステッパーを枚数 50 で押す | 0 に clamp、エラー「1枚以上必要です」表示、保存ボタン disabled |
| A3 | `SAVE10` を適用 | `¥1,000` 値引き、内訳に「ー クーポンお値引き 1,000円」表示 |
| A4 | スキップトグル OFF | 左カラムグレーアウト、右カラム overlay 覆い、`¥0` + 「データ化を実施しない」 |
| A5 | プレミアム多言語 ON | 内訳の「選択オプション」に「多言語対応」表示、金額は変化せず |
| A6 | 編集後キャンセル押下 | 確認モーダル表示、キャンセルで `fromPage` へ戻る |
| A7 | `?surveyId=xx&from=v2` | キャンセル後 `surveyCreation-v2.html?surveyId=xx` へ戻る |

---

## 11. 将来計画（Phase 2 以降）

本画面の実装ギャップ 17 件。番号が小さいほど優先度が高い。

1. **`plan-capabilities.json` 未連動（最重要）**: 契約プラン別の `allowedFields` / `speedPlans` / `maxAdditionalFields` / `multilingualAvailable` による表示・制限切替が完全に未実装。`bizcardSettings.js` は `plan-capabilities.json` を fetch していない。プラン連動は `11_plan_feature_restrictions` の実装と合わせて再設計する必要がある。（§8）

2. **実サーバ保存未実装**: `saveBizcardSettings(settings)` はモック（`console.log` + 1,500ms 遅延）のみ（[bizcardSettingsService.js:94](../../../02_dashboard/src/services/bizcardSettingsService.js#L94)）。楽観ロック（`version`）・エラー応答形式・競合検知はすべて未定義。

3. **`multilingualGroup.unitPrice` 未定義**: `bizcardPlans.js` の `multilingual` グループに `unitPrice` が存在せず、`bizcardCalculator.js:42-46` の `premiumUnitAddOn = multilingualGroup?.unitPrice ?? 0` が常に 0 を加算する。多言語を選んでも料金が増えない休眠ロジック。

4. **追加項目の料金加算なし**: `secondPhone` / `secondAddress` / `handwrittenMemo` の 3 種は料金加算ロジック自体が存在しない。単価仕様もプロダクト側で未決定。

5. **`bizcardRequest` input リスナ二重登録**: `setupEventListeners()` が `bizcardRequestInput` の `input` イベントを 2 回購読（[bizcardSettings.js:170](../../../02_dashboard/src/bizcardSettings.js#L170) の `handleFormChange` と同:253 の `setRequestCount` ラッパ）。どちらも `updateFullUI()` を呼ぶため 1 回の入力で state 更新 + 再描画が 2 回走る。

6. **`calculationBaseDate` と `startDate` 同一参照バグ**: [bizcardCalculator.js:75-77](../../../02_dashboard/src/services/bizcardCalculator.js#L75) で `calculationBaseDate = new Date(startDate)` としているが、直後の `startDate.setDate(startDate.getDate() + completionDays)` は `startDate` Date オブジェクトを破壊変更する。`calculationBaseDate` は `new Date(startDate)` でコピーされた別インスタンスなので現行は影響を受けていないが、`new Date(new Date(x))` の冗長性と可読性の低さが残る。

7. **`validateCoupon` モック実装**: 3 コード（`SAVE10` / `SPEEDUP` / `test`）のみハードコードでサーバ検証なし。有効期限・使用回数制限・対象アンケート絞込み等は未実装（§6.4）。

8. **`finalizeSave` 条件式の直感反**: [bizcardSettings.js:500](../../../02_dashboard/src/bizcardSettings.js#L500) の `if (!state.surveyId || !saveButton.disabled) finalizeSave()` は「`surveyId` が無い or ボタンが既に enabled」の OR 条件で、正常系のどの分岐で呼ばれるか再読しないと判然としない。成功系でも 800ms setTimeout の前に呼ばれる可能性があり、UI ロック時間が縮む懸念。

9. **`updateSettingsVisibility` 死関数**: [bizcardSettingsRenderer.js:89-93](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L89) に no-op として残存。`// 関連するUIが削除されたため、この関数は現在何もしません` とコメントされているが、`export` は維持されており呼出元は存在する可能性がある（要精査）。

10. **`displayCouponResult` 死参照**: [bizcardSettingsRenderer.js:535-539](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L535) で `export` されているが `bizcardSettings.js` 側から `import` されていない。`dom.couponMessage` も HTML 内に該当 ID が無く、呼び出されても NPE になる。削除候補。

11. **`#bizcardRequestPresets` 休眠 ID**: [bizcardSettingsRenderer.js:39](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L39) で `dom.bizcardRequestPresets` をキャッシュするが、HTML にこの ID は存在しない。プリセットボタン群を提供していた過去実装の残骸。

12. **`dataConversionSpeed` フィールド残骸**: state に保持され保存ペイロードにも載るが、UI に入力要素が存在しない。プラン選択時の `plan.speedValue` で自動同期されるため独立した値を持つことはなく、将来的にプラン連動（§11-1）が入れば保存側からも削除候補。

13. **適用済みクーポン表示ハードコード**: [bizcardSettings.html:274](../../../02_dashboard/bizcardSettings.html#L274) の `#appliedCouponCodeDisplay` テキストが `SUMMER2026` ハードコード。JS 実行前の初期レンダで一瞬この値が見える（実際には `#couponAppliedContainer.hidden` で隠れているが、共有クーポンが適用済みの場合は表示処理前に書き換えが間に合わない可能性）。

14. **`fetchSurveyData` / `fetchBizcardSettings` の二重 fetch**: 両関数とも同じ `data/core/surveys.json` を個別に fetch する（[bizcardSettingsService.js:22, 50](../../../02_dashboard/src/services/bizcardSettingsService.js#L22)）。`Promise.all` で並列化されているとはいえ HTTP リクエストは 2 本。共通ロード → 1 レスポンスから 2 値を取り出す形へ統合可能。

15. **`validateForm` 単一箇所チェック**: [bizcardSettingsRenderer.js:559](../../../02_dashboard/src/ui/bizcardSettingsRenderer.js#L559) の `dom.bizcardRequestInput.parentElement.querySelector('.input-error-message')` は `bizcardRequest` 直近親の 1 件しか見ない。将来バリデーション対象項目を増やす際はルール集約の作り替えが必要。

16. **`aria-live` 欠落**: `#estimatedAmount` / `#estimatedCompletionDate` / `#estimateBreakdown` / `.input-error-message` / `#couponCodeErrorMessage` いずれも `aria-live` 無し。見積金額のリアルタイム変動が支援技術に通知されない。

17. **モーダル `aria-labelledby` 未設定**: `#bizcardDetailsModal` / `#billingNotesModal` の `<dialog>` 要素に `aria-labelledby` / `aria-describedby` が付与されておらず、モーダルタイトルのスクリーンリーダー読み上げが不完全。

---

## 12. 用語集

| 用語 | 説明 |
|------|------|
| スキップトグル | `#skipBizcardToggle`。名刺データ化を「行わない」状態に切り替えるトグル。ON=有効（= bizcardEnabled=true） |
| `bizcardRequest` | 見込み枚数。0〜9999 の整数、既定 100 |
| `dataConversionPlan` | 選択プラン値（`trial` / `normal` / `express` / `superExpress` / `onDemand`） |
| `dataConversionSpeed` | プラン連動の速度値（UI 入力はなく `plan.speedValue` 自動同期、§11-12） |
| `premiumOptions` | `{ multilingual: boolean, additionalItems: string[] }` |
| `appliedCoupon` | `{ type: 'discount'\|'speedBoost', value, message, code }` |
| `minCharge` / `minChargeCards` | 最低請求金額 / 枚数（`ceil(requestedCards * 0.5)`） |
| `sharedCoupon_{surveyId\|'temp'}` | アンケート単位で他設定画面と共有するクーポンコードの localStorage キー |
| `tempSurveyData` | 新規作成フロー中のアンケート一時保持 localStorage キー |
| `updatedSurvey_{surveyId}` | 保存完了を親画面に伝えるための sessionStorage ハンドオフキー |
| `<dialog>` | HTML5 モーダルダイアログ要素（`showModal()` / `close()`） |
| legacy プラン値 | `free` / `standard` / `premium` / `enterprise` / `custom`（§6.5） |
| `plan-capabilities.json` | 契約プラン別の許可項目・速度・上限を定義する想定 JSON（現行未連動、§11-1） |

---

## 13. 関連ファイル・デッドコード棚卸し

**メインファイル**:
- `02_dashboard/bizcardSettings.html`（401 行）
- `02_dashboard/src/bizcardSettings.js`（607 行、`initBizcardSettings` を `export`）
- `02_dashboard/src/services/bizcardPlans.js`（200 行）
- `02_dashboard/src/services/bizcardCalculator.js`（101 行、純関数 `calculateEstimate`）
- `02_dashboard/src/services/bizcardSettingsService.js`（101 行、`fetchSurveyData` / `fetchBizcardSettings` / `validateCoupon` / `saveBizcardSettings`）
- `02_dashboard/src/ui/bizcardSettingsRenderer.js`（585 行、`renderSurveyInfo` / `setInitialFormValues` / `renderEstimate` / `renderDataConversionPlans` / `renderPremiumOptions` / `validateForm` / `setSaveButtonLoading` / 死: `updateSettingsVisibility` / `displayCouponResult`）

**流入元**:
- [surveyCreation.html:525](../../../02_dashboard/surveyCreation.html#L525) `#openBizcardSettingsBtn` → `./bizcardSettings.html`
- [surveyCreation-v2.html:552](../../../02_dashboard/surveyCreation-v2.html#L552) 同上（`?from=v2` 付き）
- [surveyDetailsModal.js:105](../../../02_dashboard/src/surveyDetailsModal.js#L105) 直接 `location.href = bizcardSettings.html?surveyId=...`
- [surveyCreation-v2.js:2391-2392](../../../02_dashboard/src/surveyCreation-v2.js#L2391) `buildRelatedSettingsUrl('bizcardSettings.html', surveyId)` で動的 href 設定
- [first-login-tutorial.js:93](../../../02_dashboard/src/first-login-tutorial.js#L93) チュートリアルのハイライト対象

**離脱先**:
- 保存完了 / キャンセル: `state.fromPage + ?surveyId=...`（`surveyId` なしなら `state.fromPage` のみ）
- 初期化失敗: 2 秒後に `state.fromPage` へリダイレクト

**共有ストレージ**:
- `localStorage.tempSurveyData.settings.bizcard`（新規作成中のバッファ）
- `localStorage.sharedCoupon_{surveyId|'temp'}`（他設定画面と共通のクーポンコード）
- `sessionStorage.updatedSurvey_{surveyId}`（保存完了ハンドオフ）

**パンくず**: `アンケート一覧 > アンケート作成・編集 > 名刺データ化設定`（[breadcrumb.js:20-24](../../../02_dashboard/src/breadcrumb.js#L20)）

**死コード・休眠 ID 一覧**:

| 対象 | 状態 | §11 参照 |
|------|------|----------|
| `updateSettingsVisibility` | no-op export | 11-9 |
| `displayCouponResult` | 呼出元なし | 11-10 |
| `#bizcardRequestPresets` | HTML に該当 ID なし | 11-11 |
| `dataConversionSpeed` | UI 入力なし | 11-12 |
| `multilingualGroup.unitPrice` | 未定義、常に 0 加算 | 11-3 |
| `#appliedCouponCodeDisplay` ハードコード `SUMMER2026` | 初期チラつき | 11-13 |
| `setSaveButtonLoading` export | 呼出元は `handleSaveSettings` 内でインライン処理しており未使用 | 棚卸し候補 |

---

## 14. 関連仕様書との関係

- `01_survey_creation_requirements` §5.2.2（アンケート作成・編集画面の関連設定導線）: 本画面への流入元を規定。`surveyCreation.html` / `surveyCreation-v2.html` の `#openBizcardSettingsBtn` を経由する。
- `11_plan_feature_restrictions`（契約プラン別機能制限・想定仕様）: §11-1 の `plan-capabilities.json` 連動実装時に本書 §8 を書き換える必要がある。プラン別の `allowedFields` / `speedPlans` / `maxAdditionalFields` / `multilingualAvailable` の定義先。
- `17_thank_you_email_settings_requirements`（お礼メール設定、同種の「アンケート関連設定」画面）: 共有クーポン `sharedCoupon_{surveyId}` の命名規則・`tempSurveyData.settings` バッファ方式・`sessionStorage.updatedSurvey_` ハンドオフパターンを共通化している。仕様変更時はこの 3 画面と `bizcardSettings` を同時更新する必要がある。
- `15_help_center_requirements`: 本書の「実装トレース型」スタイルの参照元。
- `docs/画面設計/仕様/_archive/` 配下（旧 `01_survey_creation_*` 等）: 過去の「本書が正」スタンスの名残。本書 v2.0 で参照を切り、実装変更後に本書のみ更新する運用へ切替済み。
