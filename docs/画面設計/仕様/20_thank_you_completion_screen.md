---
owner: product
status: draft
last_reviewed: 2026-04-24
---

# 回答完了画面 要件定義書

> **TL;DR**
> - 対象は [thankYouScreen.html](../../../02_dashboard/thankYouScreen.html)（38 行）と [thankYouScreen.js](../../../02_dashboard/src/thankYouScreen.js)（75 行）の 2 ファイルのみ。本書はこの現行実装を根拠にする「実装トレースドキュメント」である。
> - 役割は「アンケート送信完了後のランディング」。URL クエリ（`surveyId` / `continuous` / `answerLocale`）を受け取り、アンケート定義 JSON（`data/surveys/{surveyId}.json`）を `fetch` してサンクスメッセージを描画する単一カード画面。localStorage/sessionStorage は一切使わない。
> - 見出しは i18n 固定（`thankYouScreen.title`）。**作成者設定のメッセージは本文のみに反映**され、優先順は `thankYouScreenSettings.thankYouMessage` → `.description` → i18n デフォルト `thankYouScreen.body`。設定オブジェクトは `survey.thankYouScreenSettings` または `survey.settings?.thankYouScreen` の先に見つかった方。
> - 連続回答ボタン（`#continuous-answer-button`）は `continuous=true` 厳密一致 AND `surveyId` 非空 AND 該当 DOM 存在の 3 条件 AND のみ表示。プラン判定（`plan === 'premium'` 判定で `continuous=true` を付ける）は呼び出し元 [survey-answer.js:2062](../../../02_dashboard/src/survey-answer.js#L2062) 側に集約されており、本画面は純粋に URL 値のみ見る。
> - JSON 取得失敗時はサイレントフォールバック（`console.error` + i18n デフォルト文言 + 連続回答ボタン非表示）。ユーザー向けエラー UI は存在しない。
> - 設定側（管理画面）との関係: 08 番仕様書（`08_thank_you_screen_settings_requirements`）は `Survey.thankYouMessage` を **フラット単言語** として扱うが、本画面は `thankYouScreenSettings.thankYouMessage` を **ネスト + 多言語オブジェクト** として読み取る。本書（20）の記述を正とし、08 を後続整合化する（§9-1）。

## 1. 概要

### 1.1 優先度凡例

| 区分 | 意味 |
|------|------|
| **MVP** | 本版で必須。リリース条件。 |
| **Should** | 推奨。合理的理由があれば延期可。 |
| **Nice** | 任意。余力があれば対応。 |
| **Phase 2** | 本版対象外。§9 に集約。 |

### 1.2 目的・想定利用者

アンケート回答者が送信ボタンを押し切った直後に遷移するランディング画面。回答者に送信完了の明示的フィードバックを返し、連続回答が許可されている場合は同じアンケートへ戻る導線を提示する。

想定利用者:

- **アンケート回答者（匿名）**: ログイン不要で到達。本画面のみを見る。
- 広告運用担当 / 管理者は本画面を直接操作しない（プレビューは [survey-answer.js:2040-2056](../../../02_dashboard/src/survey-answer.js#L2040) の iframe 内インライン描画で代替され、本ファイルには到達しない）。

### 1.3 対象範囲 / 対象外

**対象**:
- [02_dashboard/thankYouScreen.html](../../../02_dashboard/thankYouScreen.html)
- [02_dashboard/src/thankYouScreen.js](../../../02_dashboard/src/thankYouScreen.js)

**対象外**（§9 または関連仕様書参照のみ）:
- 管理側の「サンクス画面設定」画面（= 08 番、`thankYouScreenSettings.html` / `thankYouScreenSettings.js`）
- お礼メール（= 17 番、別系統）
- アンケート回答画面 → 本画面への遷移ロジック（呼び出し元、= 13 番）
- プレビューモードでの描画（`survey-answer.html` 側の iframe 内インライン HTML）
- バックエンド API 連携（本画面は JSON 静的配信のみ）

### 1.4 主要設定値一覧

実装に散在するマジックナンバー・初期値・i18n キーの集約。**太字**は「現行未実装・本書で仕様規定する対象外」項目（§9 に送る）。

| 設定値 | 現行値 | ソース |
|--------|--------|--------|
| 既定ロケール（最終フォールバック） | `'ja'` | [thankYouScreen.js:23](../../../02_dashboard/src/thankYouScreen.js#L23) |
| 連続回答判定リテラル | 文字列 `'true'` と厳密一致 | [thankYouScreen.js:64](../../../02_dashboard/src/thankYouScreen.js#L64) |
| アンケート定義読込パス | `data/surveys/{surveyId}.json`（`resolveDashboardDataPath` 経由） | [thankYouScreen.js:10](../../../02_dashboard/src/thankYouScreen.js#L10) |
| 本文フォールバック順 | `thankYouMessage` → `description` → i18n `thankYouScreen.body` | [thankYouScreen.js:43-45](../../../02_dashboard/src/thankYouScreen.js#L43) |
| 設定オブジェクト解決順 | `survey.thankYouScreenSettings` → `survey.settings?.thankYouScreen` → `{}` | [thankYouScreen.js:41](../../../02_dashboard/src/thankYouScreen.js#L41) |
| 初期 `<title>` | `SpeedAd - アンケート回答完了`（日本語固定） | [thankYouScreen.html:6](../../../02_dashboard/thankYouScreen.html#L6) |
| 初期 `<html lang>` | `ja` | [thankYouScreen.html:2](../../../02_dashboard/thankYouScreen.html#L2) |
| サイドバー余白打ち消し | `body { padding-left: 0 !important }`（インライン `<style>`） | [thankYouScreen.html:13-17](../../../02_dashboard/thankYouScreen.html#L13) |
| カード最大幅 | `max-w-md`（28rem / 448px） | [thankYouScreen.html:21](../../../02_dashboard/thankYouScreen.html#L21) |
| 連続回答ボタン `href` 初期 | `#`（JS で `survey-answer.html?...` に上書き） | [thankYouScreen.html:30](../../../02_dashboard/thankYouScreen.html#L30) |
| 対応 i18n キー数 | 4（`documentTitle` / `title` / `body` / `continuousAnswerButton`） | [messages.js:49-54](../../../02_dashboard/src/services/i18n/messages.js#L49) |
| **ユーザー向けエラー UI** | **なし**（`console.error` のみ） | [thankYouScreen.js:71](../../../02_dashboard/src/thankYouScreen.js#L71) / §9 |
| **言語切替 UI** | **なし**（URL `answerLocale` のみで決定） | §9 |
| **`vi` ロケール辞書** | **未整備**（`thankYouScreen` キーは ja / en / zh-CN / zh-TW の 4 言語のみ） | [messages.js:6](../../../02_dashboard/src/services/i18n/messages.js#L6) / §9 |
| **自動リダイレクト** | **なし**（`continuous` 未指定時は画面に留まる） | §9 |

---

## 2. 対象画面・関連ファイル

- [02_dashboard/thankYouScreen.html](../../../02_dashboard/thankYouScreen.html)（38 行、単一カード構成、`<script type="module">` で `src/thankYouScreen.js` を読込）
- [02_dashboard/src/thankYouScreen.js](../../../02_dashboard/src/thankYouScreen.js)（75 行、`DOMContentLoaded` で実行される IIFE 相当のモジュール。エクスポート関数なし）

**依存モジュール**:

- [utils.js](../../../02_dashboard/src/utils.js) の `resolveDashboardDataPath()`: ダッシュボード配下のデータファイルパスをベース URL 付きで解決する。
- [services/i18n/messages.js](../../../02_dashboard/src/services/i18n/messages.js) の `formatMessage()` / `normalizeLocale()` / `resolveLocalizedValue()` の 3 関数。

**呼び出し元（本画面に遷移してくるフロー）**:

- [survey-answer.js:2059-2065](../../../02_dashboard/src/survey-answer.js#L2059): アンケート送信完了後に `location.href` で遷移。`surveyId` / `answerLocale` は必須、`continuous=true` は `state.surveyData.plan === 'premium'` のときのみ付与（= プラン判定は呼び出し元側で実施、本画面は純粋に URL 値のみ見る）。
- 13 番仕様書（`13_survey_answer_screen`）§3.6.1 が呼び出し元の責務範囲を規定。

**依存 CDN / アセット**（`thankYouScreen.html` 冒頭）:
- Tailwind CDN（`plugins=forms,container-queries`、[thankYouScreen.html:8](../../../02_dashboard/thankYouScreen.html#L8)）
- Material Icons（同:9）
- `service-top-style.css`（プロジェクト内、同:10）
- Google Fonts Inter / Noto Sans JP（同:12）
- ロゴ SVG `assets/svg/speedad_logo.svg`（favicon とカード内ロゴで共用、同:7 / 23）

**画面に存在しない DOM**（明示）:

- ダッシュボード共通ヘッダー / サイドバー / フッター / パンくず（= 他画面に注入される `#header-placeholder` 等は **一切ない**）
- モーダル、トースト、ローディングインジケーター、スケルトン UI
- エラーコンテナ、言語切替セレクタ、ホームへの戻るリンク

---

## 3. 改訂履歴

- v2.0 (2026-04-24): 実装トレース型へ全面刷新。`02_dashboard/thankYouScreen.html` + `src/thankYouScreen.js` の 113 行全てを文書化。v1.x までの「本書が正」スタンスを破棄し「画面が正」へ揃える。v1.x で誤記だった「サポート言語は ja/en の 2 言語のみ」を訂正し、実辞書の 4 言語（ja / en / zh-CN / zh-TW）+ `vi` 未整備を §9 に送る。プラン判定の責務が呼び出し元側であることを明示。08 との `thankYouMessage` 構造差分を §9 最重要項目として追跡。
- v1.x (〜 2026-04-17): 本番要件を先行定義した抽象的仕様書（v1.0.0 〜 v1.2.0）。エラー通知 UI・AA 準拠・RUM 計測等を「未実装」として列挙していたが、本画面 113 行の実装には元から含まれず v2.0 で再分類。

---

## 4. 画面構成

### 4.1 全体レイアウト（ASCII ツリー）

`thankYouScreen.html` はダッシュボード共通 2 カラム構造を使わず、単独フルスクリーンに中央配置する単一カード構成。インライン `<style>` で `body.padding-left: 0 !important` を強制し、ダッシュボード共通スタイルが付与しうる左余白を打ち消す。

```
<html lang="ja">                                          … JS で確定ロケールに上書き
<head>
  <title>SpeedAd - アンケート回答完了</title>              … JS で i18n 上書き
  <link rel="icon" href="assets/svg/speedad_logo.svg">
  <script src="https://cdn.tailwindcss.com?...">
  <style> body { padding-left: 0 !important } </style>    … サイドバー分の左余白を強制解除
</head>
<body class="bg-gray-50">
  <div class="min-h-screen flex items-center justify-center
              bg-blue-50 py-12 px-4 sm:px-6 lg:px-8">      … 外枠: 画面全高・上下中央配置
    <div class="max-w-md w-full space-y-8 p-10
                bg-white rounded-lg shadow-xl">            … メインカード (max 448px)
      <div>
        <img class="mx-auto h-12 w-auto"
             src="assets/svg/speedad_logo.svg">            … ロゴ (高さ 3rem)
        <h2 id="thank-you-title"
            class="mt-6 text-center text-3xl
                   font-extrabold text-gray-900"></h2>     … 初期空文字 → i18n.title
        <p id="thank-you-body"
           class="mt-2 text-center text-sm
                  text-gray-600"></p>                      … 初期空文字 → 本文解決順で差込
      </div>
      <div id="continuous-answer-container"
           class="hidden">                                 … continuous=true のときのみ解除
        <a id="continuous-answer-button"
           href="#"
           class="mt-4 inline-flex w-full items-center
                  justify-center rounded-full
                  bg-blue-600 px-5 py-3 text-sm
                  font-semibold text-white shadow-sm
                  hover:bg-blue-700"></a>                  … href/テキストは JS で差込
      </div>
    </div>
  </div>
  <script type="module" src="src/thankYouScreen.js"></script>
</body>
```

### 4.2 セクション詳細

| セクション | セレクタ / クラス | 役割 | 初期可視性 |
|------------|-------------------|------|-----------|
| 外枠 | `<div class="min-h-screen flex items-center justify-center bg-blue-50 py-12 px-4 sm:px-6 lg:px-8">` | ビューポート全高を確保しカードを縦横中央に配置。背景は `<body>` の `bg-gray-50` より淡い青（`bg-blue-50`）を重ねる。 | 常時表示 |
| メインカード | `<div class="max-w-md w-full space-y-8 p-10 bg-white rounded-lg shadow-xl">` | `max-w-md`（448px）の白カード。`space-y-8` で「ロゴ+タイトル+本文」ブロックと「連続回答コンテナ」の縦間隔を確保。 | 常時表示 |
| ロゴ | `<img class="mx-auto h-12 w-auto">` | SpeedAd ロゴ。高さ `h-12`、横幅はアスペクト比追従。中央寄せ。 | 常時表示 |
| タイトル | `<h2 id="thank-you-title" class="mt-6 text-center text-3xl font-extrabold text-gray-900">` | お礼見出し。ロゴから `mt-6` の縦余白。 | **初期は空文字**。JS が `thankYouScreen.title` を差し込んで可視化する。 |
| 本文 | `<p id="thank-you-body" class="mt-2 text-center text-sm text-gray-600">` | タイトル直下の本文。 | **初期は空文字**。JS が優先順（§5.2）で差し込んで可視化する。 |
| 連続回答コンテナ | `<div id="continuous-answer-container" class="hidden">` | 連続回答ボタンのラッパ。 | **初期 `hidden`**。`continuous=true` かつ関連条件成立時に JS が `hidden` を除去。 |
| 連続回答ボタン | `<a id="continuous-answer-button" href="#" class="mt-4 inline-flex w-full ... rounded-full bg-blue-600 ... hover:bg-blue-700">` | 「続けて回答する」ピル型青ボタン。横幅いっぱい。 | 親コンテナの可視性に従属。`href` は初期 `#` で JS が `survey-answer.html?...` に上書き、ラベルは i18n で差込。 |

### 4.3 レスポンシブ

- 全ビューポートで中央配置の単一カードを維持。`max-w-md`（448px）を上限に、それ未満では親の `w-full` に追従。
- 外枠の横余白は `px-4` → `sm:px-6` → `lg:px-8` の 3 段階。
- 縦は `min-h-screen` によりビューポート全高を常に充填（短いコンテンツでも上下中央配置が成立する）。
- カード内は縦並び固定。プラットフォーム別分岐・モバイル専用レイアウトは持たない。

---

## 5. 機能要件

### 5.1 初期化フロー（URL パラメータ / JSON 読込） [**MVP**]

`document.addEventListener('DOMContentLoaded', ...)` のトップレベル async 関数（[thankYouScreen.js:61-75](../../../02_dashboard/src/thankYouScreen.js#L61)）。

1. `new URLSearchParams(window.location.search)` で URL クエリを取得。
2. 以下を抽出:
   - `surveyId = params.get('surveyId')`（任意、null 可）
   - `isContinuous = params.get('continuous') === 'true'`（**文字列厳密一致**。`'1'` / `'TRUE'` / `'yes'` は false 扱い）
3. `try` 内で `loadSurveyById(surveyId)` を実行:
   - `surveyId` が falsy なら `null` を即 return し、JSON 取得をスキップ。
   - `resolveDashboardDataPath('surveys/{surveyId}.json')` でパス解決 → `fetch()`。
   - `!response.ok` なら `Error('Survey definition file was not found (ID: {surveyId})')` を throw。
   - 成功時は `response.json()` を返す。
4. `getLocale(params, survey)` でロケール決定（§5.5）。
5. `renderThankYouPage({ surveyId, locale, survey, isContinuous })` を呼び出す（§5.2 〜 5.4）。
6. `catch` で `console.error('Failed to initialize thank-you screen:', error)` を出力後、`locale = normalizeLocale(params.get('answerLocale') || 'ja')` のみで `renderThankYouPage({ surveyId, locale, survey: null, isContinuous: false })` を呼ぶ（**連続回答ボタンは強制 OFF**）。

**URL クエリパラメータ仕様**:

| パラメータ名 | 型 | 必須 | 役割 |
|-------------|----|------|------|
| `surveyId` | 文字列 | 任意 | 未指定時は JSON 取得スキップ、`survey` は null 扱い。本文は i18n デフォルトのみで描画され、連続回答ボタンも非表示になる。 |
| `continuous` | 文字列 | 任意 | 文字列 `'true'` と厳密一致でのみ連続回答ボタン可視化条件に参入。その他の値・未指定は全て false 扱い。 |
| `answerLocale` | 文字列 | 任意 | 表示ロケールの最優先指定。`normalizeLocale()` で正規化。未指定時はアンケート定義側へフォールバック。 |

### 5.2 カスタムメッセージ表示 [**MVP**]

`renderThankYouPage()`（[thankYouScreen.js:32-59](../../../02_dashboard/src/thankYouScreen.js#L32)）。

| 描画対象 | DOM / 対象 | 決定ロジック |
|----------|------------|--------------|
| HTML 言語属性 | `document.documentElement.lang` | 確定ロケールで上書き（§5.5） |
| ドキュメントタイトル | `document.title` | `formatMessage(locale, 'thankYouScreen.documentTitle')`（i18n 固定） |
| 見出し | `#thank-you-title.textContent` | `formatMessage(locale, 'thankYouScreen.title')`（i18n 固定。**作成者設定は反映されない**） |
| 本文 | `#thank-you-body.textContent` | 優先順（下記） |

**本文の優先順**（[thankYouScreen.js:41-45](../../../02_dashboard/src/thankYouScreen.js#L41)）:

1. `thankYouSettings = survey?.thankYouScreenSettings || survey?.settings?.thankYouScreen || {}`（設定オブジェクトを 2 経路で解決）。
2. `getThankYouMessage(thankYouSettings, locale)` = `resolveLocalizedValue(thankYouSettings.thankYouMessage, locale)`。空文字でなければ採用。
3. 無ければ `resolveLocalizedValue(thankYouSettings.description, locale)`。
4. それも無ければ `formatMessage(locale, 'thankYouScreen.body')`（i18n デフォルト）。

**多言語オブジェクトの形式**（08 とのデータモデル差分）:
- `thankYouMessage` は `{ ja: '...', en: '...', 'zh-CN': '...' }` のような **ロケールキー付きオブジェクト** として扱われる。`resolveLocalizedValue()` がロケールキーの完全一致 → エイリアス一致 → `fallbackLocale` → `'ja'` の順で文字列を解決する。
- 08 番仕様書（`08_thank_you_screen_settings_requirements`）§5 データモデルは `Survey.thankYouMessage` を **フラット単言語の文字列** として定義しており、**型が異なる**。本画面（20）のネスト + 多言語構造を正式とし、08 側を後続整合化する（§9-1）。

**`textContent` による代入**:
- 本文・見出し・ボタンラベルは全て `textContent` で差し込み。ユーザー入力を反映するのは本文のみで、HTML タグが含まれていてもエスケープ不要（そのまま文字として表示される）。

### 5.3 連続回答モード [**MVP**]

連続回答ボタンは以下 3 条件の **AND** を全て満たすときのみ可視化される（[thankYouScreen.js:54-58](../../../02_dashboard/src/thankYouScreen.js#L54)）。

- `isContinuous === true`（= URL の `continuous` が文字列 `'true'` と厳密一致）
- `surveyId` が真値（非空の文字列）
- 対象 DOM（`#continuous-answer-container` と `#continuous-answer-button`）が `null` でなく取得できる

**可視化時の処理**:

1. `#continuous-answer-container.classList.remove('hidden')`。
2. `#continuous-answer-button.href` を `survey-answer.html?surveyId={encoded}&answerLocale={encoded}` に設定。両パラメータとも `encodeURIComponent()` で URL エンコード。
3. `#continuous-answer-button.textContent` に `formatMessage(locale, 'thankYouScreen.continuousAnswerButton')` を差込。

**責務分界**（重要）:
- **プラン判定（`plan === 'premium'` か否か）は本画面で行わない**。`continuous=true` を URL に付与するかどうかの決定は [survey-answer.js:2062](../../../02_dashboard/src/survey-answer.js#L2062) に集約されている（13 番仕様書 §3.6.1）。本画面は URL 値のみを機械的に解釈する。
- `allowContinuousAnswer` フラグ（アンケート定義側のフィールド）も本画面では参照されない。

### 5.4 リダイレクト挙動 [**MVP**]

- 本画面からの **自動リダイレクトは存在しない**。画面は読み込み後、ユーザー操作があるまで静止する。
- 連続回答ボタン押下時のみ `<a href="survey-answer.html?surveyId=...&answerLocale=...">` 経由で回答画面へ戻る（通常のリンク遷移）。
- アンケート定義に `thankYouScreenSettings.redirectUrl` のような外部リダイレクト設定が存在したとしても、**本画面の JS は一切参照しない**（実装に該当コード無し）。外部サイトへの自動遷移機能は本版では未対応（§9）。
- JSON 読込失敗時も「本画面に留まり i18n デフォルトで描画」する挙動で、自動で他画面へ逃がすフローはない。

### 5.5 多言語対応 [**MVP**]

**ロケール決定優先順** `getLocale(params, survey)`（[thankYouScreen.js:18-25](../../../02_dashboard/src/thankYouScreen.js#L18)）。

1. URL パラメータ `answerLocale`
2. アンケート定義の `survey.defaultAnswerLocale`
3. アンケート定義の `survey.editorLanguage`
4. `'ja'`（最終フォールバック）

決定値は `normalizeLocale()` で正規化され、以下 3 箇所に適用される:

- `document.documentElement.lang`（HTML 言語属性）
- `document.title`（ドキュメントタイトル）
- i18n 文言・多言語データの解決ロケール

**サポート言語**（i18n 辞書実装、[messages.js:49-54 / 120-125 / 191-196 / 262-267](../../../02_dashboard/src/services/i18n/messages.js#L49)）:

| ロケール | `thankYouScreen` キー整備 | 備考 |
|----------|---------------------------|------|
| `ja` | あり（4 キー） | デフォルト・最終フォールバック |
| `en` | あり（4 キー） | — |
| `zh-CN` | あり（4 キー） | エイリアス `zh-Hans` 受入 |
| `zh-TW` | あり（4 キー） | エイリアス `zh-Hant` 受入 |
| `vi` | **無し** | `LOCALE_ALIASES` / `LANGUAGE_LABELS` には定義ありだが `messages.vi.thankYouScreen` キーは **未整備**。指定時は `formatMessage()` の fallbackLocale 経由で `ja` 文言に落ちる（§9-2） |

**切替 UI**:
- 本画面に言語切替セレクタは存在しない。ロケールは URL `answerLocale` 到着時点で固定。
- 回答者が言語を変えたい場合は呼び出し元（回答画面）で切り替えたうえで送信する必要がある。

---

## 6. データモデル

### 6.1 URL クエリパラメータスキーマ

本画面が読み取る唯一の「入力」。localStorage / sessionStorage / Cookie は一切使わない。

| パラメータ | 型 | 必須 | 例 |
|-----------|----|------|-----|
| `surveyId` | string | 任意 | `sv_0001_26008` |
| `continuous` | string | 任意 | `true`（厳密一致のみ有効） |
| `answerLocale` | string | 任意 | `ja` / `en` / `zh-CN` / `zh-TW` |

### 6.2 期待されるアンケート定義 JSON 形式

`loadSurveyById()` が `data/surveys/{surveyId}.json` から取得し、本画面が参照するフィールドのみ列挙。他のフィールド（設問定義 等）は本画面では一切読まない。

| フィールド | 型 | 本画面での用途 | 実装参照 |
|-----------|----|----------------|----------|
| `thankYouScreenSettings` | object \| undefined | サンクス画面設定の第 1 経路 | [thankYouScreen.js:41](../../../02_dashboard/src/thankYouScreen.js#L41) |
| `settings.thankYouScreen` | object \| undefined | サンクス画面設定の第 2 経路（上位優先） | 同:41 |
| `thankYouScreenSettings.thankYouMessage` | string \| object（多言語） | 本文第 1 候補 | 同:28 / 43 |
| `thankYouScreenSettings.description` | string \| object（多言語） | 本文第 2 候補 | 同:44 |
| `defaultAnswerLocale` | string | ロケール第 2 優先 | 同:21 |
| `editorLanguage` | string | ロケール第 3 優先 | 同:22 |

**多言語オブジェクトの例**:

```json
{
  "thankYouScreenSettings": {
    "thankYouMessage": {
      "ja": "ご回答ありがとうございました。",
      "en": "Thank you for your response.",
      "zh-CN": "感谢您的回答。"
    },
    "description": {
      "ja": "結果は後日公開いたします。"
    }
  },
  "defaultAnswerLocale": "ja",
  "editorLanguage": "ja"
}
```

### 6.3 設定オブジェクトの 2 経路解決

```
thankYouSettings = survey?.thankYouScreenSettings      // 最優先
                || survey?.settings?.thankYouScreen    // 次点
                || {};                                 // 無ければ空
```

- 新規アンケート作成フローからは `thankYouScreenSettings` のトップレベルに入る想定。
- 旧フォーマットまたは `settings` サブツリーにネストされたデータもフォールバックで吸収する。どちらにも存在しなければ空オブジェクト扱いとなり、本文は i18n デフォルトのみで描画される。

### 6.4 出力先 DOM の一覧

| 論理項目 | 出力先 | 書込 API |
|----------|--------|----------|
| HTML 言語属性 | `document.documentElement.lang` | プロパティ代入 |
| ドキュメントタイトル | `document.title` | プロパティ代入 |
| 見出し文字列 | `#thank-you-title` | `textContent` |
| 本文文字列 | `#thank-you-body` | `textContent` |
| 連続回答コンテナ可視性 | `#continuous-answer-container` | `classList.remove('hidden')` |
| 連続回答ボタン遷移先 | `#continuous-answer-button` | `href` プロパティ代入 |
| 連続回答ボタンラベル | `#continuous-answer-button` | `textContent` |

---

## 7. 非機能要件

### 7.1 レスポンシブ / スタイル

- 単一カード構成で全ビューポート対応。カード最大幅 `max-w-md`（448px）で中央配置。
- 外枠の横余白は `px-4` → `sm:px-6`（640px 以上） → `lg:px-8`（1024px 以上）の 3 段階。
- `bg-gray-50`（`<body>`）+ `bg-blue-50`（外枠）+ `bg-white`（カード）の 3 層背景で視覚階層を作る。
- 共通 `service-top-style.css`、Material Icons、Google Fonts（Inter / Noto Sans JP）を読み込むが、本画面で実利用しているのは Tailwind ユーティリティのみ（Material Icons / Inter / Noto Sans JP は font-family 経由で使用）。
- サイドバー分の左余白打ち消し: `<style>body { padding-left: 0 !important; }</style>`（[thankYouScreen.html:13-17](../../../02_dashboard/thankYouScreen.html#L13)）。ダッシュボード共通スタイルが付与しうる `padding-left` を強制上書きする意図。

### 7.2 パフォーマンス

- 本画面の外部通信は `data/surveys/{surveyId}.json` への単一 `fetch` のみ（`surveyId` 指定時）。
- JSON 取得失敗時はサイレントフォールバックで描画が完了するため、ユーザー体感のブロッキングはない。
- 本画面固有のパフォーマンス目標値は設定しない。RUM / Web Vitals / パフォーマンス計測ロジックは実装されていない（§9）。

### 7.3 セキュリティ

- 本画面は個人情報・認証情報を一切扱わない。localStorage / sessionStorage / Cookie への書込みも無い。
- 受け取る URL クエリ 3 種（`surveyId` / `continuous` / `answerLocale`）はいずれもサーバー送信や永続化を行わない。
- 連続回答ボタンの `href` 組立時、`surveyId` と `locale` は `encodeURIComponent()` で **URL パラメータとしてエンコード** される（[thankYouScreen.js:56](../../../02_dashboard/src/thankYouScreen.js#L56)）。
- 本文は `textContent` で差込のため、アンケート定義 JSON に HTML タグが含まれていても描画時にエスケープされる（= スクリプトインジェクション耐性はある）。

### 7.4 アクセシビリティ

- 現フェーズはベストエフォート対応。WCAG 2.1 Level AA 準拠は本契約スコープ外（§9）。
- 現状対応:
  - `<html lang>` の言語属性を確定ロケールに同期。
  - ロゴ画像に `alt="SpeedAd Logo"` を付与。
  - セマンティック要素（`<h2>` / `<p>` / `<a>`）による構造化。
- 未対応（§9）:
  - フォーカス管理（到達時の `<h2>` への初期フォーカス等）
  - 色コントラスト比の WCAG AA 準拠検証
  - `aria-*` 属性の体系的な付与（`aria-live` / `aria-label` 等）

### 7.5 ブラウザ対応

- PC Chrome 最新 / iOS Safari 最新 / Android Chrome 最新を想定。
- `<script type="module">` / `URLSearchParams` / `fetch` / 分割代入 / optional chaining（`?.`）を使用するため ES2020 相当サポートが必要。

---

## 8. Definition of Done

### 8.1 機能受入項目

- §5.1 URL クエリ 3 種（`surveyId` / `continuous` / `answerLocale`）が正しく読み取られること。
- §5.2 本文が `thankYouMessage` → `description` → i18n デフォルト `thankYouScreen.body` の優先順でフォールバックすること。見出しは常に i18n 固定 `thankYouScreen.title` が描画されること。
- §5.3 連続回答ボタンが 3 条件 AND（`continuous === 'true'` AND `surveyId` 非空 AND 該当 DOM 存在）で表示制御されること。`href` が `encodeURIComponent` でエンコード済みであること。
- §5.5 ロケールが 4 段階の優先順（`answerLocale` → `defaultAnswerLocale` → `editorLanguage` → `'ja'`）で決定されること。
- JSON 取得失敗時にサイレントフォールバック（`console.error` 出力、i18n デフォルトで描画、連続回答ボタン非表示）が動作すること。

### 8.2 非機能受入項目

- §7.1 主要デバイス（PC Chrome / iOS Safari / Android Chrome の最新版）で表示崩れがないこと。
- §5.5 現行実装サポートの 4 言語（ja / en / zh-CN / zh-TW）で文言が切り替わること。`vi` 指定時は ja にフォールバックすること。

### 8.3 明示的な検収対象外

- §9 Phase 2 全項目
- WCAG 2.1 Level AA 準拠検証
- バックエンド API 連携（本画面は JSON 静的配信のみ）
- プラン判定ロジック（呼び出し元 `survey-answer.js` に集約）
- 自動リダイレクト機能 / 外部サイト遷移 / 言語切替 UI

---

## 9. 将来計画（Phase 2）

### 9.1 最重要: 08 番との整合化（優先度 P0）

08 番仕様書（`08_thank_you_screen_settings_requirements`、管理側「サンクス画面設定」画面のリライト版）と、本書（20）のデータモデル記述を統一する。

**差分の実態**:

| 項目 | 08 の記述 | 20 の実装 | 整合方針 |
|------|----------|----------|----------|
| `thankYouMessage` の格納位置 | `Survey.thankYouMessage`（フラット） | `survey.thankYouScreenSettings.thankYouMessage`（ネスト。`survey.settings?.thankYouScreen` フォールバックあり） | **20 の実装（ネスト）を正**として 08 の記述を追従更新 |
| `thankYouMessage` の型 | `string`（単言語） | `string \| { [locale]: string }`（多言語オブジェクト） | **20 の多言語オブジェクト型を正**として 08 を追従 |
| `description` フィールド | 08 に記述なし | 本文フォールバック第 2 優先として読まれる | **20 側で追加**し 08 にも追記 |
| `thankYouScreenSettings` のトップレベルフィールド構造 | 08 に網羅的記述なし | `thankYouMessage` / `description` / （任意で `url` = [survey-answer.js:2059](../../../02_dashboard/src/survey-answer.js#L2059) が参照） | 20 を正として 08 に列挙 |

**タスク**:
1. 08 番リライト版 §5 データモデルを 20 に合わせて更新（`thankYouScreenSettings` ネスト構造、多言語対応、`description` フィールドの追加）。
2. 管理画面側の UI（08 の対象 `thankYouScreenSettings.html` / `thankYouScreenSettings.js`）に多言語対応入力欄を追加（現行は単言語のみ編集可能）。
3. アンケート作成画面（01 系）が書き出す JSON 形式を 20 の読み取り仕様と一致させる。

### 9.2 その他 Phase 2 項目

| # | 項目 | 区分 | 概要 |
|---|------|------|------|
| 9.2.1 | ユーザー向けエラー通知 UI | 機能追加 | JSON 取得失敗時は現行 `console.error` のみ。トースト / インラインエラー表示を追加。 |
| 9.2.2 | `vi`（ベトナム語）の i18n 辞書整備 | 機能追加 | `LOCALE_ALIASES` / `LANGUAGE_LABELS` には定義があるが `messages.vi.thankYouScreen` キーは 4 項目ともに **未実装**（[messages.js:6](../../../02_dashboard/src/services/i18n/messages.js#L6)）。4 キー（`documentTitle` / `title` / `body` / `continuousAnswerButton`）のベトナム語訳を追加する。 |
| 9.2.3 | 言語切替 UI | 機能追加 | 現行は URL `answerLocale` で固定。画面内セレクタで切替えできるようにする。 |
| 9.2.4 | 自動リダイレクト機能 | 機能追加 | `thankYouScreenSettings.redirectUrl` を新設し、設定時は n 秒後に外部サイトへ遷移させる。`target=_blank` ではなく現ウィンドウ遷移。 |
| 9.2.5 | `aria-*` 属性の体系的付与 | アクセシビリティ | `aria-live="polite"` を本文に付け、動的書換をスクリーンリーダーに通知。`<main>` / `role` の整備。 |
| 9.2.6 | フォーカス管理 | アクセシビリティ | ページロード完了時に `<h2 id="thank-you-title">` へ `focus()` し、スクリーンリーダーで見出しから読み上げ開始。 |
| 9.2.7 | 色コントラスト比 AA 準拠検証 | アクセシビリティ | `text-gray-600` on `bg-white` 等の組み合わせで AA を満たすか検証、必要なら色調整。 |
| 9.2.8 | パフォーマンス計測 | 機能追加 | RUM / Web Vitals（LCP / FID / CLS）を計測するスクリプトを共通化して挿入。 |
| 9.2.9 | アンケート送信記録の表示 | Nice | 送信完了日時・送信件数等のメタ情報を表示。バックエンド API 前提のため §8.3 対象外を伴う。 |
| 9.2.10 | お礼メール送信連携の明示表示 | Nice | 17 番（お礼メール）が送信予定の場合に「ご入力のメールアドレス宛にお礼メールを送信いたします」を表示。17 側データモデルへの依存あり。 |

---

## 10. 用語集

| 用語 | 定義 |
|------|------|
| 回答完了画面 | 本画面の正式名称。`02_dashboard/thankYouScreen.html`。画面ファイル名との整合を優先し本書では「回答完了画面」を使用。 |
| サンクス画面 | 本画面の互換呼称。08 番や過去ドキュメント・設定オブジェクト名（`thankYouScreenSettings`）で使用される。 |
| サンクスメッセージ | 作成者が管理画面で入力する「本文」。`thankYouScreenSettings.thankYouMessage`。 |
| 連続回答モード | URL に `continuous=true` が付いている状態。連続回答ボタンが表示され、押下で同一アンケートの回答画面へ戻る。 |
| アンケート定義 JSON | `data/surveys/{surveyId}.json`。本画面は `thankYouScreenSettings` / `defaultAnswerLocale` / `editorLanguage` のみ参照。 |
| i18n デフォルト文言 | `messages.js` の `thankYouScreen.*` キー。作成者設定が無いときの最終的な表示文字列。 |
| ロケール | `ja` / `en` / `zh-CN` / `zh-TW` / `vi` の 5 種（ただし `vi` は `thankYouScreen` キーが未整備）。 |

---

## 11. 関連ファイル・デッドコード棚卸し

### 11.1 関連ファイル

| ファイル | 役割 |
|----------|------|
| [02_dashboard/thankYouScreen.html](../../../02_dashboard/thankYouScreen.html) | 画面 DOM（38 行） |
| [02_dashboard/src/thankYouScreen.js](../../../02_dashboard/src/thankYouScreen.js) | 画面 JS（75 行） |
| [02_dashboard/src/utils.js](../../../02_dashboard/src/utils.js) | `resolveDashboardDataPath()` の定義元 |
| [02_dashboard/src/services/i18n/messages.js](../../../02_dashboard/src/services/i18n/messages.js) | i18n 辞書 + `formatMessage` / `normalizeLocale` / `resolveLocalizedValue` の定義元 |
| [02_dashboard/src/survey-answer.js](../../../02_dashboard/src/survey-answer.js) | 本画面への遷移 URL を組み立てる呼び出し元（[survey-answer.js:2059-2065](../../../02_dashboard/src/survey-answer.js#L2059)） |
| [02_dashboard/assets/svg/speedad_logo.svg](../../../02_dashboard/assets/svg/speedad_logo.svg) | ロゴ SVG（favicon とカード内で共用） |

### 11.2 デッドコード / 死フィールド

現時点で本画面実装内に明確なデッドコードは **無い**（113 行の実装は全て現行フロー上で実行される経路に乗っている）。以下は「実装と仕様書間の読みうる差分」。

| 観点 | 実態 | 注 |
|------|------|------|
| `thankYouScreenSettings.url` | 本画面は読まない。遷移元 `survey-answer.js:2059` 側のみ `thankYouSettings.url || 'thankYouScreen.html'` で参照 | 本画面が読む必要はないため 20 側 Out-of-scope |
| `allowContinuousAnswer` フラグ | 本画面は読まない。`continuous=true` 付与判定は `survey-answer.js:2062`（現状は `plan === 'premium'` のみ）に集約 | 責務分界として正（§5.3） |
| `<title>` 初期値の日本語固定 | 起動直後の極短時間、ja 以外のユーザーにも日本語タイトルが出る可能性 | 実害軽微。§9 対応候補（チラつき解消） |
| `textContent` の初期空文字 | `<h2>` `<p>` が空で描画される瞬間がある。初期化が同期的な DOMContentLoaded 直後のため実害はほぼ無い | 実害軽微 |

---

## 12. 関連仕様書との関係

| 番号 | 仕様書 | 本書との関係 |
|------|--------|--------------|
| 08 | `08_thank_you_screen_settings_requirements`（リライト版あり） | **管理側**（作成者が表示メッセージを設定する画面）。本書（20）がその設定値を読み取って表示する。データモデル（`thankYouMessage` の型・格納位置）に不整合あり、本書を正として 08 を整合化する（§9-1）。 |
| 13 | `13_survey_answer_screen` | **呼び出し元**。アンケート送信完了時に本画面へリダイレクト（`survey-answer.js:2059-2065`）。連続回答モードの発動判定（`plan === 'premium'`）もこちら側の責務。 |
| 17 | `17_thank_you_email_settings_requirements` | **別系統**。送信完了時にメールで届くお礼文面の管理。本画面（20）とはストレージ・描画経路ともに無関係だが、ユーザー体験としては「画面でのお礼」と「メールでのお礼」の両輪になる。 |
