---
owner: product
status: draft
last_reviewed: 2026-04-24
---

# アンケート作成・編集画面 要件定義書

> **TL;DR（この文書の位置づけ）**
> - 対象は `02_dashboard/surveyCreation.html` と実装本体 `02_dashboard/src/surveyCreation-v2.js`（2546 行、v2 系統）。`02_dashboard/src/surveyCreation.js` は同ファイルへの 1 行再エクスポート（`import './surveyCreation-v2.js';`）に過ぎない。
> - 本書は「現行実装のトレースドキュメント」。HTML / JS の実装を根拠に書き、旧仕様書群（`01_survey_creation_*` / `02_survey_creation*` 系 7 本）と実装が食い違っていた箇所は実装側に合わせて整合済み。
> - **グループ機能**・**サンクス画面別ページ** は v2 で廃止済み。本書では扱わない。
> - **プラン制限（`plan-capabilities.json`）は現状 v2 に未連動**。本書 §8 と §11 に集約。
> - 保存 API・条件分岐ロジック・既存データ読込パス不整合・デッドコード整理などは §11 将来計画にまとめる。
> - 実装コードの該当行は `[surveyCreation-v2.js:NN](../../../02_dashboard/src/surveyCreation-v2.js#LNN)` 形式で随時引用する。

---

## 1. 概要

### 1.1 優先度凡例

| 区分 | 意味 |
|------|------|
| **MVP** | 本版で必須。リリース条件。 |
| **Should** | 推奨。合理的理由があれば延期可。 |
| **Nice** | 任意。余力があれば対応。 |
| **Phase 2** | 本版対象外。§11 に集約。 |

### 1.2 目的・想定利用者

- **目的**: イベント・展示会等で回収するアンケートを、非エンジニアの運用担当者が GUI だけで作成・編集し、回答者向け URL / QR コードを発行できるようにする。
- **想定利用者**: SPEED AD ダッシュボードの管理者・運用担当（現状プラン制限は未連動のため全プランが同一権限で全機能にアクセス可）。
- **典型シーン**: (1) 新規アンケートを空から作成 → プレビュー確認 → 保存 → QR 配布、(2) 既存アンケートを複製して微修正、(3) 多言語展開のためタブを追加して翻訳を差し込む。

### 1.3 対象範囲 / 対象外

**対象**: `02_dashboard/surveyCreation.html`（v1 URL）および実装本体 `surveyCreation-v2.js` による UI / 設問ビルダー / プレビュー / QR / 保存ボタン挙動。

**対象外（§11 へ）**: 保存 API、プラン制限連動、条件分岐実行ロジック、`surveyCreation-v2.html`（確認用 URL として残置中、統合完了後に削除検討）、旧デッドコード（`ui/surveyRenderer.js` / `services/surveyService.js` / `showTypeChangeDialog` 等）。

### 1.4 主要設定値一覧（マジックナンバー集約）

| 設定値 | 現行値 | ソース |
|--------|--------|--------|
| 対応言語 | ja / en / zh-CN / zh-TW / vi の 5 言語 | [surveyCreation-v2.js:165](../../../02_dashboard/src/surveyCreation-v2.js#L165) |
| 最大同時選択言語数 | 3（第一言語含む） | [surveyCreation-v2.js:294](../../../02_dashboard/src/surveyCreation-v2.js#L294) |
| 最小言語数 | 1（削除禁止） | [surveyCreation-v2.js:288](../../../02_dashboard/src/surveyCreation-v2.js#L288) |
| 設問タイプ数 | 11 種 | [surveyCreation-v2.js:148](../../../02_dashboard/src/surveyCreation-v2.js#L148) |
| アンケート名 maxlength | 100 字（`input`） | [surveyCreation-v2.js:236](../../../02_dashboard/src/surveyCreation-v2.js#L236) |
| 基本情報 textarea maxlength | 500 字 | [surveyCreation-v2.js:234](../../../02_dashboard/src/surveyCreation-v2.js#L234) |
| 評定尺度ポイント数（固定） | 3 / 4 / 5 | [surveyCreation-v2.js:1370](../../../02_dashboard/src/surveyCreation-v2.js#L1370) |
| 評定尺度ポイント数（カスタム） | 6–10（範囲外は自動クランプ） | [surveyCreation-v2.js:1401-1404](../../../02_dashboard/src/surveyCreation-v2.js#L1401) |
| 手書きキャンバス既定高さ | 200px | [surveyCreation-v2.js:496](../../../02_dashboard/src/surveyCreation-v2.js#L496) |
| スクロールスパイ判定オフセット | 120px | [surveyCreation-v2.js:1990](../../../02_dashboard/src/surveyCreation-v2.js#L1990) |
| カード中央スクロール時間 | 400ms（`smoothScrollIntoView`） | [surveyCreation-v2.js:527](../../../02_dashboard/src/surveyCreation-v2.js#L527) |
| トースト表示時間 | 3500ms | [surveyCreation-v2.js:48](../../../02_dashboard/src/surveyCreation-v2.js#L48) |
| options Sortable 初期化遅延 | 100ms | [surveyCreation-v2.js:1132](../../../02_dashboard/src/surveyCreation-v2.js#L1132) |
| 設問カード挿入後スクロール遅延 | 50ms（`setTimeout` → `smoothScrollIntoView`） | [surveyCreation-v2.js:1775](../../../02_dashboard/src/surveyCreation-v2.js#L1775) |
| Sortable langTabs / outline / questions animation | 150ms | [surveyCreation-v2.js:360](../../../02_dashboard/src/surveyCreation-v2.js#L360) |
| **設問文 / 選択肢 / マトリックスラベル maxlength** | **未指定**（§11） | — |
| **下書き自動保存** | **未接続**（`surveyService.js` に定義のみ） | — |
| **datepicker `minDate`** | **引数無し呼出**（新規でも過去日付可） | [surveyCreation-v2.js:2491](../../../02_dashboard/src/surveyCreation-v2.js#L2491) |

---

## 2. 対象画面・関連ファイル

**HTML（812 行、編集対象外）**:
- `02_dashboard/surveyCreation.html` — 正規 URL。`<template>` 要素は 0 件。全設問カード・言語パネル・FAB メニュー等の動的 DOM は v2 の `el()` ファクトリで生成（[surveyCreation-v2.js:504](../../../02_dashboard/src/surveyCreation-v2.js#L504)）。
- `02_dashboard/surveyCreation-v2.html` — 開発確認用 URL。`isV2Page()` 判定（[surveyCreation-v2.js:187](../../../02_dashboard/src/surveyCreation-v2.js#L187)）で関連設定リンクに `from=v2` を付与する分岐のみ差がある。§11 で削除検討。

**スクリプト（正本）**:
- `02_dashboard/src/surveyCreation-v2.js`（2546 行、唯一の実装）
- `02_dashboard/src/surveyCreation.js`（1 行再エクスポート。実体なし）
- `02_dashboard/src/ui/datepicker.js`（flatpickr ラッパー）
- `02_dashboard/src/services/i18n/messages.js`（ロケール正規化・メッセージカタログ）

**外部モーダル / 画面**:
- `modals/qrCodeModal.html`（QR モーダル、`handleOpenModal` で読込）
- `modals/surveyPreviewModalV2.html`（プレビューモーダル、iframe で `survey-answer.html?preview=1` を表示）
- `bizcardSettings.html` / `thankYouEmailSettings.html` / `thankYouScreenSettings.html`（関連設定ページ、別ページ遷移）

**データソース**:
- `data/surveys/{surveyId}.json`（一覧メタ）
- `data/surveys/enquete/{surveyId}.json`（詳細データ、**現状 v2 はこちらを読んでおらず `../data/surveys/{id}.json` を読むため不整合**、§11）
- `data/core/plan-capabilities.json`（プラン能力、**v2 で未参照**、§11）

**デッドコード（本実装から未接続）** — §13 で棚卸し:
- `02_dashboard/src/ui/surveyRenderer.js`（旧グループ構造ベース、参照する `<template>` が HTML 側に存在せず）
- `02_dashboard/src/services/surveyService.js`（`surveyCreationData` の下書きスキーマ定義あり、呼び出し元なし）
- `showTypeChangeDialog`（[surveyCreation-v2.js:1537](../../../02_dashboard/src/surveyCreation-v2.js#L1537)、定義のみで呼出元なし）

---

## 3. 改訂履歴

- v3.0 (2026-04-24): 既存 7 本の仕様書（`01_survey_creation_ui_spec*`, `01_survey_creation_feature_inventory`, `01_survey_creation_relayout_requirements`, `02_survey_creation*`, `02_survey_creation_wireframe`）を実装トレース型で統合。グループ機能・サンクス画面別ページ関連の記述は廃止済みとして除去。プラン連動・保存 API 未実装を §11 に集約。
- v2.x (2025-11〜): レイアウト再設計・設問グループ廃止・サンクス画面インライン統合・多言語タブのドラッグ並び替え・第一言語概念導入（旧 `01_survey_creation_relayout_requirements.md`）。
- v1.x (2025-10 以前): 初版〜機能インベントリ・ワイヤーフレーム（旧 `01_survey_creation_ui_spec.md` ほか）。

---

## 4. 画面構成

### 4.1 全体レイアウト

```
+-------------------------------------------------------------------------------------+
| [Header] (Fixed, h-16)  #header-placeholder                                         |
+-------------------------------------------------------------------------------------+
| [Sidebar]|                                                                          |
|          | [Breadcrumb] ダッシュボード > アンケート作成・編集                       |
|          | [H1] アンケート作成・編集                                                |
|          |                                                                          |
|          | ╔═════════════════════════════════════════════════════════════════════╗ |
|          | ║  #mainAreaMultilingualTabs (sticky top-16, visibility:hidden)       ║ |
|          | ║   └─ #languageEditorTabsV2 (多言語 ON 時のみ visible)               ║ |
|          | ╚═════════════════════════════════════════════════════════════════════╝ |
|          |                                                                          |
|          | ┌── grid-cols-1 md:grid-cols-12 ────────────────────────────────────┐   |
|          | │ Row 1: #basicInfoBody  (md:col-span-12)                            │   |
|          | │   ├─ 左 col-span-3:  surveyName_ja / displayTitle / surveyID /    │   |
|          | │   │                   periodRange                                   │   |
|          | │   └─ 右 col-span-2:  description                                   │   |
|          | │                                                                    │   |
|          | │ Row 2:                                                             │   |
|          | │   ┌────────────────┐┌──────────────────────────┐┌───────────────┐ │   |
|          | │   │#settings-column││ #questions-column-wrapper ││#outline-column│ │   |
|          | │   │(md:col-span-4) ││  ├ #questionListContainer ││(xl:col-span-3)│ │   |
|          | │   │(xl:col-span-3) ││  │   ├ 設問カード（可変）  ││  sticky top-  │ │   |
|          | │   │ sticky top-24  ││  │   └ insert-separator  ││   [5rem]       │ │   |
|          | │   │ max-h overflow ││  ├ #addQuestionInlineArea││  (xl 以上)     │ │   |
|          | │   │                ││  │   └ inlineMenuBottom  ││  ドロワー (lg) │ │   |
|          | │   │[オプション機能]││  └ サンクスメッセージ欄   ││  非表示 (md↓) │ │   |
|          | │   │  名刺添付      ││                            ││                │ │   |
|          | │   │  多言語        ││                            ││ [プレビュー]   │ │   |
|          | │   │  連続回答      ││                            ││ [QR]           │ │   |
|          | │   │[関連設定]      ││                            ││ [保存]         │ │   |
|          | │   │  名刺リンク →  ││                            ││ [キャンセル]   │ │   |
|          | │   │  お礼メール →  ││                            ││                │ │   |
|          | │   │  サンクス画面→ ││                            ││                │ │   |
|          | │   └────────────────┘└──────────────────────────┘└───────────────┘ │   |
|          | └────────────────────────────────────────────────────────────────────┘   |
+-------------------------------------------------------------------------------------+
| #fab-container (lg 以上、右下 fixed)                                                |
| #mobile-action-bar (lg 未満、bottom-0 fixed、h-20)                                  |
+-------------------------------------------------------------------------------------+
```

### 4.2 3 エリアグリッド仕様

| エリア | 要素 ID | グリッド幅 | スクロール制御 |
|--------|---------|-----------|---------------|
| 基本情報カード | `#basicInfoBody` | `md:col-span-12`（5 分割 3:2） | ページ全体と連動 |
| 設定カラム | `#settings-column` | `md:col-span-4 / xl:col-span-3` | `sticky top-24`、`max-h:calc(100vh-15rem)` で独立スクロール |
| 設問カラムラッパ | `#questions-column-wrapper` | `md:col-span-12 / xl:col-span-9` | ページ全体と連動 |
| 設問カラム内コンテナ | `#questionListContainer` | — | ページ全体と連動 |
| アウトラインパネル | `#outline-column` | `xl:col-span-3 / xl:col-start-10 / xl:row-start-2` | xl 以上 `sticky top-[5rem]`、lg〜xl 未満は `fixed right-0` のドロワー |

`<template>` 要素は HTML に存在せず、設問カード・言語タブ・FAB メニュー・選択肢行など全ての動的 DOM は JS の `el()` ファクトリで生成する（[surveyCreation-v2.js:504](../../../02_dashboard/src/surveyCreation-v2.js#L504)）。

### 4.3 レスポンシブ挙動

| ブレークポイント | レイアウト | 参照 |
|-----------------|-----------|------|
| SP `<768px` | 1 カラム縦積み。`#mobile-action-bar` が `bottom-0 fixed` で表示 | `lg:hidden` クラス |
| MD `≥768px` | 基本情報 5 分割（3:2）、設定+設問の 2 カラム、アウトライン非表示、モバイルバー表示 | — |
| LG `≥1024px` | 設定+設問の 2 カラム、アウトライン **ドロワー**（`fixed right-0 translate-x-full`）、FAB 表示、モバイルバー非表示 | [surveyCreation.html:647](../../../02_dashboard/surveyCreation.html#L647) |
| XL `≥1280px` | 3 エリア並列。アウトライン `xl:col-span-3 sticky top-[5rem]` | [surveyCreation-v2.js:2100](../../../02_dashboard/src/surveyCreation-v2.js#L2100) |

**LG–XL 中間域（1024px〜1279px）の特殊 CSS**（`surveyCreation.html` 冒頭 `<style>`、[surveyCreation.html:75-86](../../../02_dashboard/surveyCreation.html#L75)）:
```css
@media (min-width: 1024px) and (max-width: 1279px) {
  #outline-column { height: auto !important; max-height: calc(100vh - 7rem); top: 6rem; overflow: hidden; }
  #questions-column-wrapper { grid-column: 1 / -1 !important; }
}
```
アウトラインがドロワー退避している間は設問カラムがグリッド全幅を使う。

### 4.4 多言語タブ sticky 動作

- `#mainAreaMultilingualTabs` は `sticky top-16 z-40` で、グリッドの**外側**に配置（[surveyCreation.html:380](../../../02_dashboard/surveyCreation.html#L380)）。
- 多言語 OFF 時は `style="visibility: hidden"` でスペースのみ確保。
- 多言語 ON 時は `initMultilingualToggle` が `visibility: visible` と `body.has-multi-lang-tabs` を付与（[surveyCreation-v2.js:376-393](../../../02_dashboard/src/surveyCreation-v2.js#L376)）。
- `body.has-multi-lang-tabs` が付くと設定カラム（`.sticky-panel`）の sticky top が `8rem` に調整される（HTML 冒頭 `<style>` に定義）。
- `initLangTabWidthTracking`（[surveyCreation-v2.js:395](../../../02_dashboard/src/surveyCreation-v2.js#L395)）が貼り付き時だけ `margin-left + width` でタブの幅と位置を基本情報カード／設問カラムに追従させる（`left/transform` の循環計算バグ回避のためあえて `margin-left` 採用）。

### 4.5 アウトラインパネルの表示モード

| ブレークポイント | モード | 実装 |
|-----------------|--------|------|
| XL `≥1280px` | **グリッド内 sticky** | `xl:col-span-3 xl:col-start-10 xl:row-start-2 sticky top-[5rem]` |
| LG `1024px〜1279px` | **右端ドロワー** | `fixed right-0 translate-x-full`（初期非表示）、`#outline-map-toggle-btn` で開閉、アイコンが `chevron_left` ↔ `chevron_right` に入れ替わる（[surveyCreation-v2.js:2100](../../../02_dashboard/src/surveyCreation-v2.js#L2100)） |
| MD 以下 `<1024px` | **非表示** | `hidden lg:flex` クラス。代わりに `#mobile-action-bar` が表示される |

ドロワー展開時はトグルボタン自体を `translateX(-288px)`（`w-72` = 288px 分）シフトして画面内に残す（[surveyCreation-v2.js:2112](../../../02_dashboard/src/surveyCreation-v2.js#L2112)）。

### 4.6 モバイル固定アクションバー / FAB

**`#mobile-action-bar`**（[surveyCreation.html:697](../../../02_dashboard/surveyCreation.html#L697)）:

| ボタン | ID | 状態制御 |
|--------|-----|---------|
| プレビュー表示 | `#showPreviewBtnMobile` | 常に有効 |
| QR コード | `#openQrModalBtnMobile` | `surveyId` 未発行時 `disabled` |
| 設問追加 | `#addQuestionMobileBtn` | 常に有効。タップで `#mobileQuestionTypeMenu` を `bottom-20 fixed` で展開 |
| アンケート保存 | `#createSurveyBtnMobile` | `flex-[2]` で幅広、`bg-primary` 強調。バリデーション失敗時 `disabled` |

> **注**: モバイルバーに「キャンセル」は**含まれない**。キャンセルはデスクトップのアウトラインパネル内 `#cancelCreateSurvey` のみ。

**`#fab-container`**（[surveyCreation.html:716](../../../02_dashboard/surveyCreation.html#L716)、`hidden lg:block fixed bottom-10 right-10`）:
- `#fab-main-button` をクリックで `#fab-menu`（11 種の設問タイプ）を展開。
- FAB 自体がマウスドラッグで画面内を移動可能（[surveyCreation-v2.js:1870-1912](../../../02_dashboard/src/surveyCreation-v2.js#L1870)）。ドラッグ後のクリックは無視される（`hasDragged` フラグ）。
- 外クリック・メニュー項目クリックでクローズ（300ms アニメーション後 `hidden`）。

### 4.7 モーダル（3 種）

v2 が直接制御する native モーダル:

| ID | `role` | 用途 | 実装 |
|----|--------|------|------|
| `#noticeModal` | `alertdialog` | 情報・警告・エラー通知（OK のみ） | [surveyCreation-v2.js:64](../../../02_dashboard/src/surveyCreation-v2.js#L64) |
| `#confirmModal` | `dialog` | 確認ダイアログ（キャンセル / OK） | [surveyCreation-v2.js:107](../../../02_dashboard/src/surveyCreation-v2.js#L107) |
| `#questionTypeChangeDialog` | `dialog` | 設問タイプ変更（**現状 呼出元なし、デッドコード**） | [surveyCreation-v2.js:1537](../../../02_dashboard/src/surveyCreation-v2.js#L1537) |

3 種とも独自の `trapFocus`（[surveyCreation-v2.js:51](../../../02_dashboard/src/surveyCreation-v2.js#L51)）・Escape 閉じ・バックドロップクリック閉じ・前フォーカス復帰を実装。

**`showNotice(message, type, titleOverride)`**（[surveyCreation-v2.js:66-104](../../../02_dashboard/src/surveyCreation-v2.js#L66)）: `type` により `#noticeModalIcon` のアイコンと色、既定タイトルを切替。

| `type` | アイコン（Material Icons） | 色クラス | 既定タイトル |
|--------|----------------------------|----------|--------------|
| `success` | `check_circle` | `text-green-500` | 完了 |
| `error` | `error` | `text-red-500` | エラー |
| `warning` | `warning` | `text-amber-500` | 注意 |
| `info`（既定） | `info` | `text-blue-500` | お知らせ |

未知の `type` が渡された場合は `info` にフォールバック。`titleOverride` 指定時はタイトル文言を上書き。

**`showConfirm(title, message, okLabel, onOk)`**（[surveyCreation-v2.js:107-143](../../../02_dashboard/src/surveyCreation-v2.js#L107)）: `#confirmModal` が DOM に存在しない場合はブラウザ標準の `window.confirm(message)` にフォールバックし、OK 時のみ `onOk()` を呼ぶ（[L113](../../../02_dashboard/src/surveyCreation-v2.js#L113)）。初期フォーカスはキャンセルボタン側。

外部モーダル（`handleOpenModal` で HTML ロード）:
- `modals/qrCodeModal.html`（QR コード）
- `modals/surveyPreviewModalV2.html`（プレビュー、iframe `survey-answer.html?preview=1`）

---

## 5. 機能要件

### 5.1 基本情報カード [**MVP**]

`#basicInfoBody` は画面上部の横長カードで、`md:grid-cols-5` の 3:2 分割（[surveyCreation.html:400](../../../02_dashboard/surveyCreation.html#L400)）。左側に 4 項目、右側に説明文。

| 項目 | ID | 型 | 多言語 | maxlength | 必須 |
|------|-----|-----|-------|-----------|------|
| アンケート名（管理用） | `surveyName_ja` | input text | ✗（ja 固定） | 100 | ○ |
| 表示タイトル | `displayTitle_ja`（他: `displayTitle_en` 等動的生成） | input text | ✓ | 100 | ○ |
| 説明 | `description_ja` ほか | textarea | ✓ | 500 | — |
| アンケート ID 表示 | `#surveyIdDisplay` | span（read only） | — | — | — |
| アンケート期間 | `#periodRange` | input（flatpickr range） | — | — | ○ |

**多言語フィールドの動的生成**（`ensureMultiLangInputExists`、[surveyCreation-v2.js:222](../../../02_dashboard/src/surveyCreation-v2.js#L222)）:
- `.multi-lang-input-group` 要素の `data-field-key` / `data-input-type` / `data-label` / `data-required` を元に、`currentLangs` に含まれる各言語の input を `{fieldKey}_{lang}` の ID で生成する。
- 言語選択変更時に `onLangsChanged` が全 group を走査し不足言語を補完（[surveyCreation-v2.js:342-351](../../../02_dashboard/src/surveyCreation-v2.js#L342)）。

**アンケート名は ja 固定**: HTML で `<input id="surveyName_ja">` が直書きされており、`.multi-lang-input-group` 属性を持たない。管理画面内部でのみ使用するため多言語不要。

**期間ピッカー**: `#periodRange` は range モード、`#deadlineWrapper` は単日（[surveyCreation.html](../../../02_dashboard/surveyCreation.html)）。**現状 `initializeDatepickers()` を引数無しで呼んでおり、新規作成時でも `minDate=tomorrow` が設定されていない**（[surveyCreation-v2.js:2491](../../../02_dashboard/src/surveyCreation-v2.js#L2491)、バグ疑い・§11）。

**ヘルプポップオーバー**: 基本情報・オプション機能・関連設定の各カード内フィールド脇に `.help-trigger` ボタン（`?` アイコン）を多数配置し、`initHelpPopovers`（[ui/helpPopover.js](../../../02_dashboard/src/ui/helpPopover.js)、[surveyCreation-v2.js:2490](../../../02_dashboard/src/surveyCreation-v2.js#L2490) で初期化）がクリック時に `services/tooltipContent.js` の説明文をフローティング表示する。閉じ方は (1) 外側クリック、(2) `Escape` キー、(3) 同一トリガー再クリック、の 3 通り。アコーディオン開閉ハンドラは `help-trigger` 内クリックを除外して伝播させない（[surveyCreation-v2.js:2498](../../../02_dashboard/src/surveyCreation-v2.js#L2498)）。

### 5.2 設定カラム

`#settings-column` は `sticky top-24` で独立スクロール。内部はアコーディオン式。

#### 5.2.1 オプション機能

| 項目 | ID | 初期値 | 連動 |
|------|-----|--------|------|
| 名刺画像添付を有効にする | `#bizcardEnabled` | ON（`checked`） | OFF 時、関連設定の「名刺データ化設定」「お礼メール設定」リンクを `opacity-40 pointer-events-none grayscale` 化し `aria-disabled=true`、`href` 退避（[surveyCreation-v2.js:2506-2525](../../../02_dashboard/src/surveyCreation-v2.js#L2506)） |
| 多言語機能の有効化 | `#multilingualEnabledToggle` | OFF | ON で `#multilingual-controls` 展開、`#mainAreaMultilingualTabs` を visible 化、`body.has-multi-lang-tabs` を付与。OFF に戻すと `currentLangs = ['ja']` / `activeLang = 'ja'` にリセット（[surveyCreation-v2.js:370](../../../02_dashboard/src/surveyCreation-v2.js#L370)） |

> **注**: 現行 v1 HTML（`surveyCreation.html`）にはオプション機能トグルとして上記 2 種（名刺画像添付・多言語）のみが存在する。v2 系 HTML（`surveyCreation-v2.html`）には `#allowContinuousAnswer` が存在するが、v1 には未配置。

#### 5.2.2 関連設定（外部ページ遷移）[**MVP**]

`#bizcardEnabled` OFF 時は前 2 リンクがグレーアウト。サンクス画面リンクは連動対象外（§11 で整合性見直し予定）。

| リンク | 遷移先 | `from=v2` 付与 |
|--------|--------|----------------|
| 名刺データ化設定 | `bizcardSettings.html?surveyId=X[&from=v2]` | `isV2Page()` 判定時 |
| お礼メール設定 | `thankYouEmailSettings.html?surveyId=X[&from=v2]` | 同上 |
| サンクス画面設定 | `thankYouScreenSettings.html?surveyId=X[&from=v2]` | 同上 |

> **注**: 旧仕様書 `01_survey_creation_relayout_requirements.md` §3.3.3 は「サンクス画面は設問カラム末尾にインライン統合」と謳っていたが、**現行 HTML には `#thankYouMessage` / `thankYouMessage` 系の要素は存在しない**。`openThankYouScreenSettingsBtn` による外部ページ遷移のみが実装されている。インライン統合の要件は Phase 2 送り（§11）。

#### 5.2.3 多言語機能（Premium 想定 / 現状未連動）[**Should**]

- `#languageSelectionPanel`: 5 言語のトグルチップ。現在選択中は `bg-blue-50 border-2 border-blue-400` の強調、未選択は薄色。
- 選択ルール（[surveyCreation-v2.js:286-302](../../../02_dashboard/src/surveyCreation-v2.js#L286)）:
  - 選択済みを再タップ → 削除。ただし `currentLangs.length <= 1` のときは toast「最低 1 つの言語を選択してください」で拒否。
  - 未選択をタップ → 追加。ただし `currentLangs.length >= 3` のときは toast「第一言語含む選択可能言語数は 3 言語までです」で拒否。
- **現状プラン連動なし**: `#multilingualEnabledToggle` は plan に関係なく誰でも ON できる。§11。
- `#languageEditorTabsV2`: 選択中の言語タブを `currentLangs` の順に描画。`Sortable.js` で並び替え可能（`group: 'language-tabs'`、[surveyCreation-v2.js:353-368](../../../02_dashboard/src/surveyCreation-v2.js#L353)）。
- **第一言語** = `currentLangs[0]`。回答画面のデフォルト表示言語となる（プレビュー経由で `editorLanguage` として伝達、[surveyCreation-v2.js:2249](../../../02_dashboard/src/surveyCreation-v2.js#L2249)）。
- 各タブは `.lang-tab` クラス、`data-lang` 属性で識別。クリックで `activeLang` を切替、`updateMultiLangVisibility` で全 `[data-lang-wrapper]` の表示を切り替える。

### 5.3 設問ビルダー

#### 5.3.1 設問リスト UI（フラットリスト）[**MVP**]

`#questionListContainer` にフラットな設問カード列を描画。設問グループ機能は v2 で廃止済み。

各カードの状態:

| 状態 | 表示内容 |
|------|----------|
| Collapsed（折り畳み、デフォルト） | ドラッグハンドル / Q 番号 / サマリ（第一言語テキスト truncate）/ タイプバッジ（クリックでポップオーバー）/ 必須バッジ / 複製・削除ボタン / 開閉トグル |
| Expanded（展開） | 上記 + 基本設定（設問文入力、言語数分）+ 回答設定（タイプ別 UI）+ 高度設定（条件分岐、UI のみ） |

カードヘッダー（`.q-card-header`）クリックで開閉（ただしボタン / input 内クリックは除外、[surveyCreation-v2.js:863](../../../02_dashboard/src/surveyCreation-v2.js#L863)）。詳細パネル（`[data-detail-panel]`）の `hidden` トグルで制御。

Q 番号は `renumberQuestions` が DOM 順を `questions[]` に同期しつつ `Q1, Q2, ...` を振り直す（[surveyCreation-v2.js:566](../../../02_dashboard/src/surveyCreation-v2.js#L566)）。

#### 5.3.2 設問追加（4 系統 + セパレータ）[**MVP**]

| 経路 | トリガー | 展開先 | 追加位置 |
|------|---------|--------|---------|
| FAB | `#fab-main-button` | `#fab-menu` | 末尾（`addQuestion`） |
| インライン末尾 | `#addQuestionInlineBtn` | `#inlineQuestionTypeMenuBottom` | 末尾 |
| 空状態 | `#addFirstQuestionBtn` | `#inlineQuestionTypeMenu` | 末尾（初回） |
| モバイル | `#addQuestionMobileBtn` | `#mobileQuestionTypeMenu` | 末尾 |
| セパレータ | カード間 `.insert-separator` の「ここに追加」 | `#insertTypePopover`（動的生成） | `insertIndex` 指定（先頭挿入含む、[surveyCreation-v2.js:1681-1776](../../../02_dashboard/src/surveyCreation-v2.js#L1681)） |

**デスクトップ↔モバイル二重化**: ボタン ID は `-Mobile` サフィックスで識別される。`showPreviewBtn` / `showPreviewBtnMobile`、`createSurveyBtn` / `createSurveyBtnMobile` など。両方に同じハンドラを束縛（[surveyCreation-v2.js:2308](../../../02_dashboard/src/surveyCreation-v2.js#L2308) 等）。

#### 5.3.3 設問タイプ変更ルール [**MVP**]

設問カードヘッダーのタイプバッジ（`[data-type-badge-label]`）クリックで `typePopover` が開く（[surveyCreation-v2.js:884-946](../../../02_dashboard/src/surveyCreation-v2.js#L884)）。

| 変更パターン | 挙動 | 確認 |
|------------|------|------|
| CHOICE ↔ CHOICE（`single_answer` ↔ `multi_answer` ↔ `dropdown`） | 選択肢 `options[]` をそのまま引継ぎ | なし |
| MATRIX ↔ MATRIX（`matrix_sa` ↔ `matrix_ma`） | 行 `matrixRows[]` / 列 `matrixCols[]` を引継ぎ | なし |
| それ以外（`options` / `matrixRows` があれば） | ポップオーバー内にインライン警告表示 + 「変更する」「戻る」で確認 | あり |
| それ以外（空カードから変更） | 即座に変更 | なし |

確認時のメッセージ: `「{新タイプ名}」に変更すると選択肢・詳細設定がリセットされます。`（[surveyCreation-v2.js:919](../../../02_dashboard/src/surveyCreation-v2.js#L919)）

リセット処理（`applyTypeChange`、[surveyCreation-v2.js:1632](../../../02_dashboard/src/surveyCreation-v2.js#L1632)）は `options` / `matrixRows` / `matrixCols` / `config` を `delete` し、新タイプの `defaultQuestion()` から該当フィールドを移植する。`text` / `required` / `id` は保持。

> **デッドコード**: `questionTypeChangeDialog`（モーダル）と `showTypeChangeDialog` 関数（[surveyCreation-v2.js:1537](../../../02_dashboard/src/surveyCreation-v2.js#L1537)）は定義のみで呼出元なし。Popover 版と並存している。§11 で除去。

#### 5.3.4 設問複製・削除・並び替え [**MVP**]

| 操作 | 実装 |
|------|------|
| 複製 | `duplicateQuestion(id)`。`JSON.parse(JSON.stringify())` で深複製し `id` を再生成。各言語の `text` に ` (コピー)` を付与。直後に挿入し `smoothScrollIntoView` で中央表示（[surveyCreation-v2.js:1826](../../../02_dashboard/src/surveyCreation-v2.js#L1826)） |
| 削除 | `deleteQuestion(id)`。`showConfirm` モーダルで確認後、`questions` 配列から除去 + 該当 options Sortable インスタンスを destroy（[surveyCreation-v2.js:1810](../../../02_dashboard/src/surveyCreation-v2.js#L1810)） |
| 並び替え | Sortable.js `group: 'questions'`、`handle: '.q-drag-handle'`（[surveyCreation-v2.js:1840-1852](../../../02_dashboard/src/surveyCreation-v2.js#L1840)）。`onEnd` で `renumberQuestions()` |

**Sortable.js 領域（4 系統）**:

| 領域 | コンテナ | ハンドル | グループ名 | 参照 |
|------|---------|---------|-----------|------|
| 設問カード | `#questionListContainer` | `.q-drag-handle` | `questions` | [surveyCreation-v2.js:1840](../../../02_dashboard/src/surveyCreation-v2.js#L1840) |
| 言語タブ | `#languageEditorTabsV2` | `.lang-tab`（要素全体） | `language-tabs` | [surveyCreation-v2.js:353](../../../02_dashboard/src/surveyCreation-v2.js#L353) |
| アウトライン | `#outline-questions-list` | なし（全体） | なし | [surveyCreation-v2.js:814](../../../02_dashboard/src/surveyCreation-v2.js#L814) |
| 選択肢（設問毎） | `#options-list-{qid}` | `.option-drag-handle` | `options-{qid}`（各カード固有） | [surveyCreation-v2.js:1132](../../../02_dashboard/src/surveyCreation-v2.js#L1132) |

**競合防止**: 各領域の `group` 名が異なるため相互にドロップしない。選択肢 Sortable はカード生成 100ms 遅延で初期化、カード削除時に `destroy()`。

### 5.4 設問タイプ詳細仕様（11 種）[**MVP**]

`QUESTION_TYPES` 定義（[surveyCreation-v2.js:148-160](../../../02_dashboard/src/surveyCreation-v2.js#L148)）:

| タイプキー | ラベル | アイコン | config 初期値 | 選択肢 / 行列 |
|-----------|--------|---------|--------------|--------------|
| `free_answer` | フリーアンサー | `short_text` | `{ minLength: '', maxLength: '' }` | — |
| `single_answer` | シングルアンサー | `radio_button_checked` | — | `options: [{ja:'選択肢1'}, {ja:'選択肢2'}]` |
| `multi_answer` | マルチアンサー | `check_box` | — | 同上 |
| `dropdown` | ドロップダウン回答 | `arrow_drop_down_circle` | — | 同上 |
| `rating_scale` | 評定尺度 | `linear_scale` | `{ points:5, minLabel:{ja:''}, maxLabel:{ja:''}, showMidLabel:false, midLabel:{ja:''} }` | — |
| `number_answer` | 数値回答 | `pin` | `{ min:'', max:'', unit:'', step:'' }` | — |
| `matrix_sa` | マトリックス(SA) | `view_list` | — | `matrixRows: [{ja:'行1'},{ja:'行2'}]`, `matrixCols: [{ja:'列1'},{ja:'列2'}]` |
| `matrix_ma` | マトリックス(MA) | `grid_view` | — | 同上 |
| `date_time` | 日付/時間 | `event` | `{ showDate:true, showTime:false }` | — |
| `handwriting` | 手書きスペース | `draw` | `{ height: 200 }` | — |
| `explanation_card` | 説明カード | `info_outline` | `{ description: {ja:''} }` | — |

各タイプの挙動詳細:

**`free_answer`（フリーアンサー）**: 基本設定のみ表示。`config.minLength` / `config.maxLength` は data モデルに保持されプレビュー時 `meta.validation.text` に転写される（[surveyCreation-v2.js:2189-2194](../../../02_dashboard/src/surveyCreation-v2.js#L2189)）が、**作成画面側にこの設定を入力する UI は未実装**（§11）。

**`single_answer` / `multi_answer` / `dropdown`（CHOICE 系）**: `buildChoiceSection`（[surveyCreation-v2.js:1104](../../../02_dashboard/src/surveyCreation-v2.js#L1104)）で共通 UI。選択肢ごとに `.option-drag-handle` + 言語数分の input + 削除ボタン。最後の 1 件を削除しようとすると toast「選択肢は最低 1 つ必要です」で拒否。追加時は全言語分の「選択肢 N」をデフォルト文として生成（[surveyCreation-v2.js:1123](../../../02_dashboard/src/surveyCreation-v2.js#L1123)）。

**`rating_scale`（評定尺度）**: `buildRatingScaleSection`（[surveyCreation-v2.js:1312](../../../02_dashboard/src/surveyCreation-v2.js#L1312)）。プレビュー表示（左ラベル + ラジオ群 + 右ラベル + 中間ラベル）/ ポイント数選択（3・4・5 固定チップ + 6-10 カスタム入力）/ 最小/最大/中間ラベル入力（多言語）/ 中間ラベル表示トグル。カスタム値は 6 未満なら 6 に、10 超なら 10 にクランプ（[surveyCreation-v2.js:1401-1404](../../../02_dashboard/src/surveyCreation-v2.js#L1401)）。**6-10 段階のみカスタムラベル許可**という意味ではなく、全段階で minLabel/maxLabel 設定可能。

**`number_answer`（数値回答）**: `buildAnswerSection` の汎用分岐（[surveyCreation-v2.js:1095-1101](../../../02_dashboard/src/surveyCreation-v2.js#L1095)）により「{タイプ名}の回答設定」プレースホルダーのみ表示。**min / max / unit / step の入力 UI は現状未実装**（data モデル `config` に初期値だけ持つ、プレビュー時に転写、§11）。

**`matrix_sa` / `matrix_ma`**: `buildMatrixSection`（[surveyCreation-v2.js:1218](../../../02_dashboard/src/surveyCreation-v2.js#L1218)）。行・列それぞれに「ラベル追加」ボタン + 削除ボタン + 多言語 input。最後の 1 件削除は拒否。

**`date_time`（日付/時間）**: `buildAnswerSection` 汎用分岐のみ（設定 UI 未実装、§11）。`config.showDate` / `config.showTime` からプレビュー時に `meta.dateTimeConfig.inputMode` を `datetime` / `time` / `date` に解決（[surveyCreation-v2.js:2202-2211](../../../02_dashboard/src/surveyCreation-v2.js#L2202)）。

**`handwriting`（手書きスペース）**: 汎用分岐のみ（高さ選択 UI 未実装、§11）。`config.height` からプレビュー時 `meta.handwritingConfig.canvasHeight` に転写。

**`explanation_card`（説明カード）**: 汎用分岐のみ（設問文入力とは別の「説明文」入力 UI は未実装）。プレビュー時 `config.description` を `base.text` に上書き（[surveyCreation-v2.js:2233-2239](../../../02_dashboard/src/surveyCreation-v2.js#L2233)）。

**高度設定（条件分岐）**: 全タイプで `buildAdvancedSection`（[surveyCreation-v2.js:1506](../../../02_dashboard/src/surveyCreation-v2.js#L1506)）の「高度設定（条件分岐等）」トグルを表示。展開時は `🔒 この設問の回答に応じてジャンプ先を設定できます。（プレミアム機能）` の固定文言のみ。**実ロジック・選択 UI は現状未実装**（§11）。

### 5.5 アウトラインパネル [**MVP**]

`#outline-column` に固定配置。中身は以下で構成:

- `#outline-map-list`: 静的リンク（基本情報 / オプション機能 / 関連設定）。アンカーのデータ属性 `data-scroll-target` に対応する `#{ID}` へスムーズスクロール（`initOutlineScrollLinks`、[surveyCreation-v2.js:2054](../../../02_dashboard/src/surveyCreation-v2.js#L2054)）。
- `#outline-questions-list`: 設問一覧を動的生成（`updateOutline`、[surveyCreation-v2.js:758](../../../02_dashboard/src/surveyCreation-v2.js#L758)）。各項目は `Q{i}` ＋ 設問文 truncate（第一言語）。

**リアルタイム更新**: `input` / `change` イベントで `updateOutline` が呼ばれる（[surveyCreation-v2.js:208-216](../../../02_dashboard/src/surveyCreation-v2.js#L208)）。

**エラー表示**:
- 基本情報セクションに入力不備があると該当行に赤ドット `●`（[surveyCreation-v2.js:767](../../../02_dashboard/src/surveyCreation-v2.js#L767)）。
- CHOICE 系で `options.length < 2`、または第一言語の設問文未入力だと該当 Q 行末尾に赤ドット（[surveyCreation-v2.js:781-782](../../../02_dashboard/src/surveyCreation-v2.js#L781)）。
- 追加言語タブがアクティブ時、その言語の未翻訳が残っていれば小さな赤丸（`totalMissing` 件数）を表示（[surveyCreation-v2.js:802-807](../../../02_dashboard/src/surveyCreation-v2.js#L802)）。

**スクロールスパイ**（`initOutlineScrollSpy`、[surveyCreation-v2.js:1989](../../../02_dashboard/src/surveyCreation-v2.js#L1989)）:
- 監視対象: `#basicInfoBody` / 各設問カード（`#questionListContainer [data-question-id]`）。
- `scroll` 時に top ≤ 120px のものを active 化、または次ターゲットがビューポート下 60% に入り始めたら順送りで active を進める。
- `MutationObserver` で `#questionListContainer` の子要素変化を監視し再評価。

> **注**: 実装 [surveyCreation-v2.js:2005-2006](../../../02_dashboard/src/surveyCreation-v2.js#L2005) には `#integrationBody` / `#additionalSettingsBody` も候補として列挙されているが、現行 v1 HTML に該当要素は存在せず（休眠 ID）、`if (el)` ガードにより scrollspy からは無視される。§13 デッドコード棚卸しも参照。

**アウトラインの並び替え**: `Sortable.js` で `#outline-questions-list` 自体もドラッグ可能。並び替え結果を DOM 操作で `questionListContainer` に反映し `renumberQuestions` で同期（[surveyCreation-v2.js:812-828](../../../02_dashboard/src/surveyCreation-v2.js#L812)）。

### 5.6 アクションボタン（プレビュー / QR / 保存 / キャンセル）

| ボタン | ID（デスクトップ / モバイル） | 状態制御 |
|--------|-------------------------------|---------|
| プレビュー表示 | `#showPreviewBtn` / `#showPreviewBtnMobile` | 常に有効 |
| QR コード | `#openQrModalBtn` / `#openQrModalBtnMobile` | 初期 `disabled`、`surveyId` 取得後に有効化（`document.body.dataset.currentSurveyId` 経由、[surveyCreation-v2.js:2126](../../../02_dashboard/src/surveyCreation-v2.js#L2126)） |
| アンケート保存 | `#createSurveyBtn` / `#createSurveyBtnMobile` | `validateForm()` 通過後に有効化（`updateSaveButtonState`、[surveyCreation-v2.js:742](../../../02_dashboard/src/surveyCreation-v2.js#L742)） |
| キャンセル | `#cancelCreateSurvey` | 常に有効（アウトラインパネル内のみ） |

> **保存は現状スタブ**: `attemptSave`（[surveyCreation-v2.js:2320](../../../02_dashboard/src/surveyCreation-v2.js#L2320)）はバリデーション通過後に `showToast('アンケートを保存しました', 'success')` を呼ぶのみ。API 呼出 / localStorage 永続化 / ナビゲーションは未実装（§11）。

### 5.7 多言語対応 [**Should**]

対応言語（`SUPPORTED_LANGS`、[surveyCreation-v2.js:165-171](../../../02_dashboard/src/surveyCreation-v2.js#L165)）:

| コード | 表示名 |
|--------|--------|
| `ja` | 日本語 |
| `en` | English |
| `zh-CN` | 中文(简体) |
| `zh-TW` | 中文(繁體) |
| `vi` | Tiếng Việt |

`messages.js` は `zh-Hans` / `zh-Hant` をそれぞれ `zh-CN` / `zh-TW` のエイリアスとして受け付ける（[messages.js:1-7](../../../02_dashboard/src/services/i18n/messages.js#L1)）。**ただし本画面の保存データ形式は `zh-CN` / `zh-TW` で統一されており、エイリアス側の標準化は未規定**（§11）。

**状態変数**:
- `isMultilingual: boolean` — 多言語トグル。
- `currentLangs: string[]` — 選択中言語配列。常に 1〜3 件、先頭が第一言語。
- `activeLang: string` — アクティブタブの言語。

**多言語 OFF 時の挙動**:
- `currentLangs = ['ja']`、`activeLang = 'ja'` に強制リセット（[surveyCreation-v2.js:387-391](../../../02_dashboard/src/surveyCreation-v2.js#L387)）。
- `#mainAreaMultilingualTabs` は visibility:hidden でスペース確保のみ。

**翻訳進捗バッジ**（`updateTranslationBadges`、[surveyCreation-v2.js:674](../../../02_dashboard/src/surveyCreation-v2.js#L674)）:
- 追加言語タブに「未入力 N」バッジ（第一言語には出ない）。
- 追加言語がアクティブな時、設問カードヘッダーに「未翻訳 N」バッジ。

**未翻訳のカウント対象**（`countMissingForLang` / `countMissingForQuestion`）:
- `.multi-lang-input-group` の入力値
- 設問の `text`
- CHOICE 系の `options[].` 各言語値
- MATRIX 系の `matrixRows[].` / `matrixCols[].`
- `rating_scale` の `config.minLabel` / `maxLabel` / （`showMidLabel=true` 時）`midLabel`

### 5.8 URL パラメータ復元 [**Should**]

`loadFromUrlParams`（[surveyCreation-v2.js:2349](../../../02_dashboard/src/surveyCreation-v2.js#L2349)）は以下を受理:

| パラメータ | 処理 |
|-----------|------|
| `surveyName` | `#surveyName_ja` に代入 |
| `displayTitle` | `#displayTitle_ja` に代入 |
| `periodStart` / `periodEnd` | `#periodRange`（flatpickr 存在時は `_flatpickr.setDate([start, end])`、無ければ `"start 〜 end"` 文字列直代入） |
| `surveyId` | `document.body.dataset.currentSurveyId` に保持 + `loadSurveyData(surveyId)` 呼出 + 関連設定リンク URL を `buildRelatedSettingsUrl` で再構築 |

JS から value 代入した場合 `input` / `change` イベントは発火しないため、末尾で `updateSaveButtonState()` を明示的に呼ぶ（[surveyCreation-v2.js:2401](../../../02_dashboard/src/surveyCreation-v2.js#L2401)）。

**既存アンケート読込**（`loadSurveyData`、[surveyCreation-v2.js:2407](../../../02_dashboard/src/surveyCreation-v2.js#L2407)）:
- 読込先: `../data/surveys/{surveyId}.json`（一覧メタ）
- **既知不整合**: 詳細データは実際には `data/surveys/enquete/{surveyId}.json` に存在。現状は一覧メタのみ取得で動作するが、設問詳細は復元されない。`typeMap` で旧タイプ名（`single_choice`→`single_answer` など）を v2 の 11 種に変換するロジックだけは実装済み（§11）。

### 5.9 プレビュー動線 [**MVP**]

`openPreview`（[surveyCreation-v2.js:2255](../../../02_dashboard/src/surveyCreation-v2.js#L2255)）:
1. `buildPreviewData()` で現在の入力状態を正規化（`normalizedQuestions`、[surveyCreation-v2.js:2160](../../../02_dashboard/src/surveyCreation-v2.js#L2160)）。
2. `localStorage.setItem('surveyPreviewData', JSON.stringify(data))`（[surveyCreation-v2.js:2258](../../../02_dashboard/src/surveyCreation-v2.js#L2258)）。
3. `modals/surveyPreviewModalV2.html` をロードし iframe に `survey-answer.html?preview=1` を読込（iframe 側が localStorage から読み取り）。
4. モーダル内の `#v2-preview-phone-btn` / `#v2-preview-tablet-btn` でデバイスフレームを `390x844` / `768x1024` に切替（iframe を reload）。

### 5.10 初期化フロー [**MVP**]

`init`（[surveyCreation-v2.js:2476-2544](../../../02_dashboard/src/surveyCreation-v2.js#L2476)）:

1. **共通 HTML パーツの並列読み込み** — `header-placeholder` / `sidebar-placeholder` / `footer-placeholder` を `Promise.all` で並列取得。ローカル CORS 失敗時は warn だけ出して続行。
2. **UI 基盤初期化** — `initThemeToggle` / `initSidebarHandler` / `initBreadcrumbs` / `initHelpPopovers` / `initializeDatepickers`（すべて optional 呼出）。
3. **アコーディオン束縛** — `.v2-accordion-trigger` 全てに開閉ハンドラを付与。`help-trigger` 内クリックは親の開閉に伝播させない。
4. **`#bizcardEnabled` 連動** — 初期値を `_applyBizcardLinkState` に渡し、名刺/お礼メールリンクのグレーアウト状態を同期。`change` 時にも適用。
5. **機能別 initializer** — `initMultilingualToggle` / `initLangTabWidthTracking` / `initFab` / `initInlineAddButton` / `initMobileAddButton` / `initOutlineScrollLinks` / `initOutlineScrollSpy` / `initOutlineToggle` / `initSortable` / `initSaveButton` / `initQrButtons` / `initPreviewButtons`。
6. **URL パラメータ復元** — `await loadFromUrlParams()`。
7. **初期描画** — `renderLangSelectionAndTabs()` / `updateOutline()` / `updateEmptyState()`。

エントリポイントは `document.addEventListener('DOMContentLoaded', init)`（[surveyCreation-v2.js:2546](../../../02_dashboard/src/surveyCreation-v2.js#L2546)）。

---

## 6. データモデル

### 6.1 メモリ内 `questions[]` 構造

```json
{
  "id":       "q_<Date.now()>_<seq>",
  "type":     "free_answer | single_answer | multi_answer | dropdown | rating_scale | number_answer | matrix_sa | matrix_ma | date_time | handwriting | explanation_card",
  "text":     { "ja": "", "en": "", "zh-CN": "", "zh-TW": "", "vi": "" },
  "required": false,
  "options":     [{ "ja": "選択肢1", "en": "Option 1" }],
  "matrixRows":  [{ "ja": "行1" }],
  "matrixCols":  [{ "ja": "列1" }],
  "config":   { /* タイプ依存 */ },
  "meta":     {}
}
```

- `id` は `generateId()`（[surveyCreation-v2.js:466](../../../02_dashboard/src/surveyCreation-v2.js#L466)）で採番、セッション内で一意。
- 多言語フィールド（`text` / `options[i]` / `matrixRows[i]` / `matrixCols[i]` / `config.minLabel` / `maxLabel` / `midLabel` / `description`）は言語コードをキーとする object。
- `config` の初期値は §5.4 の表を参照。
- `meta` は現状常に `{}`（プレビュー時 `free_answer.validation.text` / `dateTimeConfig` / `handwritingConfig` / `ratingScaleConfig` を詰める用途、[surveyCreation-v2.js:2167](../../../02_dashboard/src/surveyCreation-v2.js#L2167)）。

### 6.2 localStorage スキーマ

| キー | 内容 | 書込 | 読込 |
|------|------|------|------|
| `surveyPreviewData` | `buildPreviewData()` の出力 JSON | `openPreview`（[surveyCreation-v2.js:2258](../../../02_dashboard/src/surveyCreation-v2.js#L2258)） | `survey-answer.html?preview=1`（iframe 側） |
| `language` | 現在のロケール | 画面外（共通 UI） | `getCurrentLocale`（[surveyCreation-v2.js:25](../../../02_dashboard/src/surveyCreation-v2.js#L25)） |
| `planCapabilitiesCache` / `planCapabilitiesCacheVersion` | プラン能力キャッシュ | `planCapabilityService.js` | 同左（**v2 側からの参照なし**） |
| **`surveyCreationData`（下書き退避）** | **定義のみ未接続** — `services/surveyService.js` にスキーマ定義はあるが v2 から呼び出されていない | — | — |

### 6.3 既存 JSON 読込の期待形（既知不整合）

`loadSurveyData`（[surveyCreation-v2.js:2407](../../../02_dashboard/src/surveyCreation-v2.js#L2407)）は以下の形を期待:

```json
{
  "name":        "管理名",
  "periodStart": "YYYY-MM-DD",
  "periodEnd":   "YYYY-MM-DD",
  "details": [
    { "type": "single_choice | ...", "text": "...", "required": false,
      "options": [{ "text": "..." }],
      "rows":    [{ "text": "..." }] }
  ]
}
```

実パス `../data/surveys/{id}.json` は一覧メタ専用で `details` を持たない。詳細は `data/surveys/enquete/{id}.json` 側。**§11 で統一検討**。

### 6.4 プレビュー送信形式

`buildPreviewData`（[surveyCreation-v2.js:2142](../../../02_dashboard/src/surveyCreation-v2.js#L2142)）の出力:

```json
{
  "displayTitle":    { "ja": "...", "en": "..." },
  "description":     { "ja": "...", "en": "..." },
  "periodStart":     "YYYY-MM-DD",
  "periodEnd":       "YYYY-MM-DD",
  "editorLanguage":  "<currentLangs[0]>",
  "activeLanguages": ["ja", "en", "zh-TW"],
  "questions": [
    {
      "id":       "<string>",
      "type":     "<QUESTION_TYPES キー>",
      "text":     { "ja": "..." },
      "required": false,
      "meta":     { /* タイプ依存 */ },

      "options":  [{ "text": {...}, "value": "opt_0" }],
      "rows":     [{ "id": "row_0", "text": {...} }],
      "columns":  [{ "id": "col_0", "value": "col_0", "text": {...} }],

      "min":  "", "max": "", "step": 1
    }
  ]
}
```

---

## 7. バリデーション

### 7.1 項目別バリデーション

| 項目 | ルール | エラー表示 | 実装 |
|------|-------|----------|------|
| `surveyName_ja` | 空禁止 | `input-error` + `#surveyName_jaError` 表示 | [surveyCreation-v2.js:729](../../../02_dashboard/src/surveyCreation-v2.js#L729) |
| `displayTitle_ja` | 空禁止 | `input-error` + `#displayTitle_jaError` 表示 | [surveyCreation-v2.js:730](../../../02_dashboard/src/surveyCreation-v2.js#L730) |
| `periodRange` | 空禁止 | `input-error` + `#periodRangeError` 表示 | [surveyCreation-v2.js:731](../../../02_dashboard/src/surveyCreation-v2.js#L731) |
| 設問数 | `questions.length >= 1` | 保存試行時に `#noticeModal` で警告 | [surveyCreation-v2.js:734](../../../02_dashboard/src/surveyCreation-v2.js#L734) |
| CHOICE 系の選択肢 | `options.length >= 2` | アウトラインに赤ドット | [surveyCreation-v2.js:736](../../../02_dashboard/src/surveyCreation-v2.js#L736) |
| 第一言語の設問文 | 推奨（警告相当） | アウトラインに赤ドット | [surveyCreation-v2.js:782](../../../02_dashboard/src/surveyCreation-v2.js#L782) |
| 追加言語の翻訳 | 警告のみ | タブ / カードに「未入力 N」「未翻訳 N」バッジ | [surveyCreation-v2.js:674](../../../02_dashboard/src/surveyCreation-v2.js#L674) |
| 基本情報 textarea | `maxlength="500"` | ブラウザ標準 | [surveyCreation-v2.js:234](../../../02_dashboard/src/surveyCreation-v2.js#L234) |
| 基本情報 input | `maxlength="100"` | ブラウザ標準 | [surveyCreation-v2.js:236](../../../02_dashboard/src/surveyCreation-v2.js#L236) |
| `rating_scale` ポイント数 | 6〜10 にクランプ | 自動調整 | [surveyCreation-v2.js:1401-1404](../../../02_dashboard/src/surveyCreation-v2.js#L1401) |
| 選択肢の最後の 1 件 | 削除拒否 | toast「選択肢は最低 1 つ必要です」 | [surveyCreation-v2.js:1204](../../../02_dashboard/src/surveyCreation-v2.js#L1204) |
| マトリックス行 / 列の最後の 1 件 | 削除拒否 | toast「最低 1 つ必要です」 | [surveyCreation-v2.js:1301](../../../02_dashboard/src/surveyCreation-v2.js#L1301) |
| 言語の最小 / 最大 | 1 / 3 | toast | [surveyCreation-v2.js:288-296](../../../02_dashboard/src/surveyCreation-v2.js#L288) |

### 7.2 保存時総合チェック

`validateForm`（[surveyCreation-v2.js:720](../../../02_dashboard/src/surveyCreation-v2.js#L720)）:
1. `surveyName_ja` / `displayTitle_ja` / `periodRange` いずれかが空 → ブロッカー
2. `questions.length === 0` → ブロッカー
3. CHOICE 系設問に `options.length < 2` のものがあれば → ブロッカー

上記を通れば `createSurveyBtn` の `disabled` が外れる。

### 7.3 エラー表示タイミング（touchedFields）

`touchedFields: Set<string>` は一度でも `input` / `change` イベントが発火した field ID を記録する（[surveyCreation-v2.js:205](../../../02_dashboard/src/surveyCreation-v2.js#L205)）。`setFieldError` は `touchedFields` に登録されていない field のエラーを**表示しない**（[surveyCreation-v2.js:604-615](../../../02_dashboard/src/surveyCreation-v2.js#L604)）。

例外: `attemptSave`（[surveyCreation-v2.js:2320](../../../02_dashboard/src/surveyCreation-v2.js#L2320)）時は必須 3 field（`surveyName_ja` / `displayTitle_ja` / `periodRange`）を強制的に touched 化してからバリデーションを実行する（[surveyCreation-v2.js:2322](../../../02_dashboard/src/surveyCreation-v2.js#L2322)）。

保存失敗時の挙動:
- 設問ゼロ: `#noticeModal` を warning で表示 + `#addFirstQuestionBtn` にスクロール。
- その他エラー: toast「保存に失敗しました（詳細は各項目を確認してください）」+ 最初の `.input-error` 要素に `smoothScrollIntoView` で中央スクロール。

---

## 8. プラン連動

### 8.1 `plan-capabilities.json` の想定（`data/core/plan-capabilities.json`）

| 機能 | free | standard | premium | premiumPlus |
|------|------|----------|---------|-------------|
| `maxQuestions` | 20 | 200 | 500 | 1000 |
| `multilingual.enabled` | false | false | true | true |
| `multilingual.maxLocales` | 0 | 0 | 3 | 5 |
| `conditionalBranching` | false | false | true | true |

### 8.2 現状の未適用項目 [**Phase 2**]

v2 は **`plan-capabilities.json` を一切参照していない**（`02_dashboard/src/services/planCapabilityService.js` に取得ロジックはあるが `surveyCreation-v2.js` からの import なし）。以下は現状すべて「誰でも使える」状態:

- **多言語機能の有効化** — 全プランでトグル可能。
- **最大言語数** — 一律 3（premiumPlus の 5 も適用されない）。
- **最大設問数** — 制限なし。
- **条件分岐** — UI のみ、ロジック未実装のため plan に関係なく動作しない。

全項目 §11 へ。

---

## 9. 非機能要件

### 9.1 パフォーマンス [**Should**]

- 主要操作（設問追加 / 並び替え / タイプ変更 / 言語切替）は体感 1 秒以内を目標（計測条件は §11 で確定予定、TBD）。
- `updateOutline` / `updateSaveButtonState` はフォーム入力の都度呼ばれる。大量設問時の debounce は未導入（§11）。
- Sortable.js インスタンスは `destroy()` → `new` で再生成する箇所があるため、100+ 設問時のメモリ挙動は要計測（TBD）。

### 9.2 アクセシビリティ（WCAG 2.1 AA 目標）[**Should**]

**実装済み**:
- 3 種モーダルに `role=alertdialog` / `role=dialog` + `aria-modal` + `trapFocus` + Escape 閉じ + 前フォーカス復帰（[surveyCreation-v2.js:51](../../../02_dashboard/src/surveyCreation-v2.js#L51)）。
- 設問タイプバッジ / 必須バッジに `role=button` + `tabindex=0` + `aria-label` + `aria-pressed`（[surveyCreation-v2.js:873-995](../../../02_dashboard/src/surveyCreation-v2.js#L873)）。Enter/Space で切替。
- 評定尺度の中間ラベルトグルに `role=checkbox` + `aria-checked`（[surveyCreation-v2.js:1480](../../../02_dashboard/src/surveyCreation-v2.js#L1480)）。
- エラー表示に `aria-live="polite"`（HTML 直書き）。
- 基本情報 input に `aria-describedby="{field}Error"`。

**未実装 / 不整合**（§11）:
- **`.lang-tab` に `role=tab` / `aria-selected` が未付与**。`#languageEditorTabsV2` は `role="tablist"` を持つが、個々のタブは `role=tab` になっていない。
- エラーメッセージノードは現状 `#surveyName_jaError` 等の ja 専用 ID で HTML 直書きされており、他言語のエラー表示先が存在しない（[surveyCreation.html:413 等](../../../02_dashboard/surveyCreation.html#L413)）。
- キーボードのみでの Sortable.js 並び替えは未対応（ライブラリ側の制約）。

### 9.3 対応ブラウザ [**Should**]

Chrome / Firefox / Safari / Edge の最新 2 バージョン（暫定、§11 で確定）。

### 9.4 セキュリティ（交渉不可・必須）

- **XSS 対策**: DOM は `el()` ファクトリ経由で作成し、ユーザー入力は `appendChild(textNode)` / `input.value` に代入。`innerHTML` は初期化目的の空代入・固定断片挿入（`#outline-questions-list` 等）を除き、ユーザー入力で使用しない（[surveyCreation-v2.js:274/318/842/1329 等](../../../02_dashboard/src/surveyCreation-v2.js)）。
- **`localStorage`**: `surveyPreviewData` に PII を含み得る可能性（自由記述の試し入力、等）。端末内のみに留まり外部送信されない。容量超過時の `QuotaExceededError` ハンドラは現状なし（§11、推奨: catch して toast）。
- **URL パラメータ**: `loadFromUrlParams` は `surveyName` / `displayTitle` / `periodStart` / `periodEnd` / `surveyId` を直接 value 代入。flatpickr `setDate` が文字列検証を行うが、`surveyId` は `fetch('../data/surveys/${id}.json')` に補間するためパストラバーサル検証を追加推奨（§11）。
- **`iframe preview`**: `survey-answer.html?preview=1` は同一オリジン。`sandbox` 属性なし。プレビューモーダル内で発生した JS は親ページの DOM にアクセス可能（設計上許容）。

### 9.5 ID 不変の原則 [**MVP**]

以下の ID は外部連携・テスト自動化・モバイル対応二重化のため変更禁止:

- `#createSurveyBtn` / `#createSurveyBtnMobile`
- `#showPreviewBtn` / `#showPreviewBtnMobile`
- `#openQrModalBtn` / `#openQrModalBtnMobile`
- `#cancelCreateSurvey`
- `#surveyName_ja` / `#displayTitle_ja` / `#periodRange`
- `#bizcardEnabled` / `#multilingualEnabledToggle`
- `#fab-main-button` / `#outline-map-toggle-btn`
- `#noticeModal` / `#confirmModal`

---

## 10. Definition of Done

リリース判定権限者: プロダクトオーナー（TBD）。TBD はリリース前に解消済みであること。

**機能要件**:
- [ ] §5.1 基本情報 3 必須項目のバリデーションがブロッカーとして働く
- [ ] §5.3.2 4 系統 + セパレータ全てから 11 タイプが追加できる
- [ ] §5.3.3 CHOICE↔CHOICE / MATRIX↔MATRIX は確認なしで引継ぎ、それ以外はポップオーバー内警告で確認
- [ ] §5.4 全 11 タイプでデフォルト値で追加 → プレビュー表示が機能
- [ ] §5.5 アウトラインのエラードット / 未翻訳ドットが `input` に同期
- [ ] §5.7 多言語 3 言語切替でタブ・カード・選択肢が全て正しく描画される
- [ ] §5.9 プレビューが iframe で表示され、デバイス切替が機能

**非機能要件**:
- [ ] §9.2 モーダルの Escape / バックドロップ / trapFocus が機能
- [ ] §9.4 ユーザー入力が `innerHTML` に流入しない（コードレビュー）
- [ ] §9.5 ID 不変（CI 正規表現チェック、TBD）
- [ ] SP / Tablet / Desktop で表示崩れなし（ビジュアル回帰、TBD）

**受入シナリオ**:

| # | 手順 | 期待結果 |
|---|------|---------|
| A1 | 空の状態で保存ボタンをクリック | `#noticeModal` 警告「アンケートには設問が必要です」、`#addFirstQuestionBtn` にスクロール |
| A2 | 名前・タイトル・期間を埋めず 1 設問追加して保存 | 3 必須 field にエラー表示、最初の error にスクロール、toast エラー |
| A3 | 多言語を ON にして en を追加、タブドラッグで順序入替 | `currentLangs[0]` が en に変化、第一言語が en になる |
| A4 | FAB → マトリックス (SA) → MATRIX (MA) に変更 | 行・列を保持したまま変更される（確認なし） |
| A5 | FAB → single_answer → free_answer に変更 | ポップオーバー内警告「リセットされます」→「変更する」で options 破棄 |
| A6 | 設問 3 件作成 → アウトラインでドラッグ並び替え | Q 番号が即座に振り直される |
| A7 | `surveyCreation.html?surveyName=テスト&displayTitle=TITLE&periodStart=...&periodEnd=...` で開く | 各 field が復元され、保存ボタンが有効化 |

---

## 11. 将来計画（Phase 2 以降）

現行スコープ外の検討課題。

| # | 項目 | 概要 | 優先度 |
|---|------|------|-------|
| 1 | **保存 API 実装** | `attemptSave` は toast だけで永続化せず（[surveyCreation-v2.js:2342](../../../02_dashboard/src/surveyCreation-v2.js#L2342)）。サーバー送信・成功/失敗時のナビゲーション・楽観的ロックを実装 | 高 |
| 2 | **プラン制限連動** | `multilingual.enabled` / `maxLocales` / `maxQuestions` / `conditionalBranching` すべて未連動。`planCapabilityService.js` を v2 から import し制限 UI を付与 | 高 |
| 3 | **既存アンケート読込パス不整合** | `../data/surveys/{id}.json` は一覧メタのみ。詳細は `data/surveys/enquete/{id}.json` 側。`loadSurveyData` を 2 ファイル取得に拡張するか、一覧側に `details` を集約 | 高 |
| 4 | **条件分岐ロジック実装** | `buildAdvancedSection` は UI プレースホルダーのみ（[surveyCreation-v2.js:1506-1532](../../../02_dashboard/src/surveyCreation-v2.js#L1506)）。ジャンプ先選択 UI、回答側の分岐エンジンとの接続 | 中 |
| 5 | **デッドコード除去** | `ui/surveyRenderer.js`（旧グループ構造）、`services/surveyService.js` の下書き API、`showTypeChangeDialog` + `#questionTypeChangeDialog` モーダル、`typeMap` の旧タイプ名対応（`single_choice` 等） | 中 |
| 6 | **設問文 / 選択肢 / マトリックスラベル maxlength 未指定** | 基本情報は 100/500 だが、設問文 input・選択肢 input・matrix input には `maxlength` 属性が無い。ブラウザ制限に依存 | 中 |
| 7 | **`free_answer` の minLength / maxLength UI 未実装** | data モデルと preview 転写は実装済みだが、作成画面に入力欄が無い（[surveyCreation-v2.js:489](../../../02_dashboard/src/surveyCreation-v2.js#L489), [2189](../../../02_dashboard/src/surveyCreation-v2.js#L2189)） | 中 |
| 8 | **datepicker 新規時 minDate 引数漏れ** | `initializeDatepickers?.()` を引数無しで呼んでいる（[surveyCreation-v2.js:2491](../../../02_dashboard/src/surveyCreation-v2.js#L2491)）。新規作成時は `minDate=tomorrow` を渡すべき | 中 |
| 9 | **`surveyCreation-v2.html` の扱い** | 確認用 URL として残置中。統合完了後に削除検討 | 低 |
| 10 | **`zh-CN`/`zh-TW` vs `zh-Hans`/`zh-Hant` の保存フォーマット標準化** | `messages.js` はエイリアス受付するが、保存側の標準形を確定する必要あり（[messages.js:1-14](../../../02_dashboard/src/services/i18n/messages.js#L1)） | 低 |
| 11 | **WAI-ARIA tab パターン完全化** | `.lang-tab` に `role=tab` / `aria-selected` 未付与。`#languageEditorTabsV2` は `role=tablist` あり | 低 |
| 12 | **非 ja 言語のエラーメッセージノード** | `#surveyName_jaError` 等 ja 専用で HTML 直書き。他言語用のエラー表示先がない | 低 |
| 13 | **お礼メール ↔ 名刺連動の妥当性** | 「サンクス画面」は連動対象外だが「お礼メール」は `bizcardEnabled` に連動（[surveyCreation-v2.js:2508](../../../02_dashboard/src/surveyCreation-v2.js#L2508)）。仕様妥当性のレビュー要 | 低 |
| 14 | **サンクス画面のインライン統合** | 旧仕様書は「設問カラム末尾に統合」と謳うが現行 HTML には `#thankYouMessage` が存在しない。外部ページ遷移を維持するか、要件を実装するか決定 | 中 |
| 15 | **数値 / 日付時間 / 手書き / 説明カードの回答設定 UI** | data モデルは保持するが作成画面の入力 UI 未実装（§5.4 の該当タイプを参照） | 中 |
| 16 | **下書き自動保存** | `services/surveyService.js` の `surveyCreationData` スキーマを v2 に接続し `beforeunload` 警告を付与 | 中 |
| 17 | **`QuotaExceededError` ハンドリング** | `localStorage.setItem('surveyPreviewData', ...)` は catch 無し。容量超過時に UI 側で通知 | 低 |
| 18 | **`loadSurveyData` の MATRIX 列マッピング疑義** | [surveyCreation-v2.js:2461-2464](../../../02_dashboard/src/surveyCreation-v2.js#L2461) で `matrixCols` を `q.options` から復元している（`matrixRows` は `q.rows`）。非対称マッピングで `q.columns` が正しいと推測される。既存 MATRIX 設問データの読込で列が消える可能性。要実装確認 | 高 |
| 19 | **`periodRange` 書式不整合** | `buildPreviewData` は全角「 〜 」で連結（[surveyCreation-v2.js:2157](../../../02_dashboard/src/surveyCreation-v2.js#L2157)）、`loadSurveyData` 側は異なる区切りで split される箇所あり。保存と読込の書式を統一要 | 中 |

---

## 12. 用語集

| 用語 | 説明 |
|------|------|
| 設問タイプ | 11 種の回答形式（フリーアンサー・シングルアンサー等、§5.4） |
| CHOICE 系 | `single_answer` / `multi_answer` / `dropdown` の 3 タイプ。`options[]` を持つ |
| MATRIX 系 | `matrix_sa` / `matrix_ma` の 2 タイプ。`matrixRows[]` / `matrixCols[]` を持つ |
| 第一言語 | `currentLangs[0]`。アウトラインのサマリ・回答画面のデフォルト表示言語 |
| `activeLang` | 現在編集中のタブの言語コード |
| `touchedFields` | 一度でも入力された field ID の Set。未 touched の field はエラー表示しない |
| FAB | Floating Action Button。`#fab-container` / `#fab-main-button`、lg 以上の右下固定 |
| モバイルバー | `#mobile-action-bar`、lg 未満の bottom-0 固定アクションバー |
| セパレータ | 設問カード間の「ここに追加」ボタン（`.insert-separator`、§5.3.2） |
| ブロッカー | 保存を阻止するバリデーション結果（§7） |
| Sortable.js | ドラッグ並び替えライブラリ。本画面では 4 系統のインスタンスを使用（§5.3.4） |
| flatpickr | 日付ピッカーライブラリ（`ui/datepicker.js` でラップ） |
| デッドコード | 呼出元が存在しない関数 / モジュール（§13） |

---

## 13. 関連ファイル・デッドコード棚卸し

**実装本体**:
- `02_dashboard/surveyCreation.html`（812 行）
- `02_dashboard/src/surveyCreation-v2.js`（2546 行、正本）
- `02_dashboard/src/surveyCreation.js`（再エクスポート 1 行）

**共通ユーティリティ**:
- `02_dashboard/src/utils.js`（`loadCommonHtml`、`resolveDashboardAssetPath`）
- `02_dashboard/src/sidebarHandler.js`
- `02_dashboard/src/breadcrumb.js`
- `02_dashboard/src/ui/datepicker.js`
- `02_dashboard/src/ui/helpPopover.js`
- `02_dashboard/src/lib/themeToggle.js`
- `02_dashboard/src/modalHandler.js`
- `02_dashboard/src/qrCodeModal.js`
- `02_dashboard/src/services/i18n/messages.js`

**外部依存**:
- Sortable.js（CDN、`window.Sortable`）
- flatpickr（`ui/datepicker.js` 経由）

**デッドコード（§11-5 で除去）**:

| ファイル / 関数 | 状態 | 備考 |
|----------------|------|------|
| `02_dashboard/src/ui/surveyRenderer.js` | 未接続 | 旧グループ構造ベース。参照する `<template>` が HTML に存在せず動作不能 |
| `02_dashboard/src/services/surveyService.js` | 未接続 | `surveyCreationData` 下書きスキーマ定義のみ |
| `showTypeChangeDialog`（[surveyCreation-v2.js:1537](../../../02_dashboard/src/surveyCreation-v2.js#L1537)）| 未呼出 | Dialog 版タイプ変更 UI。Popover 版（[L884](../../../02_dashboard/src/surveyCreation-v2.js#L884)）が現役 |
| `#questionTypeChangeDialog`（HTML）| 未使用 | 上記 Dialog 版が参照する対象モーダル |
| `typeMap` 内の旧タイプ名（[surveyCreation-v2.js:2434-2447](../../../02_dashboard/src/surveyCreation-v2.js#L2434)）| 互換目的 | `single_choice` / `text` 等、旧データ形式から v2 形式への変換マッピング。`loadSurveyData` 修正時に整理 |
| `#deadlineWrapper`（[ui/datepicker.js:42-48](../../../02_dashboard/src/ui/datepicker.js#L42)）| 休眠 ID | `initializeDatepickers` が単日 flatpickr 初期化対象として参照するが、現行 v1 HTML に該当要素なし。初期化は存在チェックで no-op になる |
| `#integrationBody` / `#additionalSettingsBody`（[surveyCreation-v2.js:2005-2006](../../../02_dashboard/src/surveyCreation-v2.js#L2005)）| 休眠 ID | scrollspy 候補として列挙されるが現行 v1 HTML に該当要素なし。`if (el)` ガードで無視される |

**データファイル**:
- `data/surveys/{id}.json`（一覧メタ）
- `data/surveys/enquete/{id}.json`（詳細）
- `data/core/plan-capabilities.json`（v2 未参照）

---

## 14. 旧仕様書からの移行マップ

| 旧ファイル | 本書での該当節 | 扱い |
|-----------|--------------|------|
| `01_survey_creation_ui_spec.md` | — | コードレビュー用の一次メモ。統合対象外、削除可 |
| `01_survey_creation_ui_spec_v2.md` | §2 関連ファイル・§4 レイアウト | 吸収 |
| `01_survey_creation_feature_inventory.md` | §5 機能要件 | 吸収（グループ関連は破棄） |
| `01_survey_creation_relayout_requirements.md` | 本書の主幹 | 吸収完了 |
| `02_survey_creation.md` | §5.4 設問タイプ詳細・§6 データモデル・§7 バリデーション | 吸収（グループ・古いプラン記述は破棄） |
| `02_survey_creation_current_impl.md` | §2 関連ファイル・§13 デッドコード棚卸し | 吸収 |
| `02_survey_creation_wireframe.md` | §4.1 ASCII ツリー | 吸収 |

旧ファイルの削除 / アーカイブは本書確定後に別工程で判断する。
