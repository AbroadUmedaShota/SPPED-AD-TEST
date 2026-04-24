---
owner: product
status: draft
last_reviewed: 2026-04-24
---

# アンケート回答画面 要件定義書

> **TL;DR**
> - 対象は `02_dashboard/survey-answer.html`（167 行）と `02_dashboard/src/survey-answer.js`（2,244 行）。本書は現行実装を根拠にする「実装トレースドキュメント」である。
> - v1.x 系の抽象記述（モーダル遷移の Mermaid 図・プラン区分 3 段宣言・未実装項目 20 件の対外提出版）はすべて破棄し、`16_bizcard_settings_requirements.md` と同方針で「画面が正（実装に書かれていないことは要件化しない）」へ刷新した。
> - 設問タイプは `normalizeQuestionType()` で **12 種**（`free_answer` / `single_answer` / `multi_answer` / `dropdown` / `number_answer` / `rating_scale` / `matrix_sa` / `matrix_ma` / `date_time` / `handwriting_space` / `explanation_card` / `image_upload`）にマッピングされる。`rating_scale` は段階数カスタムをクライアント側で制限せず、`meta.ratingScaleConfig.points` をそのまま描画する。
> - 保存系は `localStorage` 一辺倒で、実送信 API は未接続。送信処理 `simulateUpload()` は 200ms 周期の擬似プログレスのみで常に成功を返し、`catch` 節はデッドパス。
> - 回答データ保存キー `survey_response_{surveyId}_{timestamp}`、ドラフト保存キー `survey_draft_{surveyId}_{sessionId}`、プレビュー入力ソース `localStorage.surveyPreviewData` の 3 種が全ての永続層。
> - 死参照・死関数を §11 / §13 に 18 件集約。`survey-page-header` / `survey-header-text` の HTML 側欠落、`header-unpinned` CSS の呼び出し元不在、`state.idleTimer` / `isIdle` の未使用、`t('survey.tapToCapture')` 未定義キー、`setupHeaderScrollBehavior()` no-op、`setupLeaveConfirmation()` 内の `beforeunload` 未登録等を含む。

## 1. 概要

### 1.1 優先度凡例

| 区分 | 意味 |
|------|------|
| **MVP** | 本版で必須。リリース条件。 |
| **Should** | 推奨。合理的理由があれば延期可。 |
| **Nice** | 任意。余力があれば対応。 |
| **Phase 2** | 本版対象外。§11 に集約。 |

### 1.2 目的・想定利用者

配信 URL または QR コードから匿名でアクセスした回答者が、アンケート作成画面（`01_survey_creation_requirements`）で定義された 12 種の設問タイプに対して回答を入力し、必要に応じて名刺画像または手入力情報を添付して送信する画面。送信完了後はサンクス画面（`20_thank_you_completion_screen`）へ遷移する。想定利用者:

- **エンドユーザー（来場者・被調査者）**: 匿名アクセス、ログイン不要。モバイルファースト。
- **プレビュー利用者（アンケート作成者）**: アンケート作成画面からの「プレビュー」押下で `?preview=1` 付き URL を開き、実回答を伴わずに見た目と挙動を検証する。
- **開発・QA**: `localStorage.surveyPreviewData` を直接投入するなどの検証手段も想定。

### 1.3 対象範囲 / 対象外

**対象**:
- `02_dashboard/survey-answer.html`
- `02_dashboard/src/survey-answer.js`
- `02_dashboard/src/utils.js`（`resolveDashboardDataPath()`）
- `02_dashboard/src/services/i18n/messages.js`（`LANGUAGE_LABELS` / `messages` / `formatMessage` / `normalizeLocale` / `resolveLocalizedValue`）

**対象外**（§11 / §14 参照のみ）:
- サンクス画面本体の表示仕様（`20_thank_you_completion_screen`）
- サンクス画面・お礼メールの文言設定（`17_thank_you_email_settings_requirements` / 旧 `08_thank_you_screen_settings`）
- アンケート作成画面の設問定義・プレビュー起動仕様（`01_survey_creation_requirements`）
- 名刺データ化の料金見積・プラン設定（`16_bizcard_settings_requirements`）
- バックエンド API・認証・OCR 本実装

### 1.4 主要設定値一覧

実装に散在するマジックナンバー・初期値の集約。**太字**は「現行未実装・本書で仕様規定する対象外」項目（§11 に送る）。

| 設定値 | 現行値 | ソース |
|--------|--------|--------|
| 画面最大幅 | 768px（`.survey-content-wrapper`） | [survey-answer.html:20](../../../02_dashboard/survey-answer.html#L20) |
| 背景色 | `#E0F2F7`（`#survey-main-wrapper` inline style） | [survey-answer.html:73](../../../02_dashboard/survey-answer.html#L73) |
| 自動ドラフト保存間隔 | 30 秒 (`setInterval(saveDraft, 30000)`) | [survey-answer.js:1244](../../../02_dashboard/src/survey-answer.js#L1244) |
| セッション識別子 | `session_{Date.now()}`（ページロード時生成） | [survey-answer.js:20](../../../02_dashboard/src/survey-answer.js#L20) |
| 回答データ保存キー | `survey_response_{surveyId}_{timestamp}` | [survey-answer.js:2023](../../../02_dashboard/src/survey-answer.js#L2023) |
| ドラフト保存キー | `survey_draft_{surveyId}_{sessionId}` | [survey-answer.js:1168](../../../02_dashboard/src/survey-answer.js#L1168) |
| プレビューデータキー | `localStorage.surveyPreviewData` | [survey-answer.js:288](../../../02_dashboard/src/survey-answer.js#L288) |
| 擬似送信進捗間隔 | 200ms × 乱数 0〜20% 加算 → 100% 到達後 300ms wait | [survey-answer.js:2082-2094](../../../02_dashboard/src/survey-answer.js#L2082) |
| トースト表示時間 | 一律 3,000ms | [survey-answer.js:2110](../../../02_dashboard/src/survey-answer.js#L2110) |
| `rating_scale` デフォルト段階数 | 5（`meta.ratingScaleConfig.points` 省略時） | [survey-answer.js:1459](../../../02_dashboard/src/survey-answer.js#L1459) |
| `handwriting_space` デフォルト高さ | 200px（`meta.handwritingConfig.canvasHeight` 省略時） | [survey-answer.js:1563-1564](../../../02_dashboard/src/survey-answer.js#L1563) |
| `handwriting_space` 線幅 | 初期 5、範囲 1〜20（`<input type="range">`） | [survey-answer.js:1580](../../../02_dashboard/src/survey-answer.js#L1580) |
| 対応言語 | `ja` / `en` / `zh-CN` / `zh-TW` / `vi` の 5 種 | [messages.js:16-22](../../../02_dashboard/src/services/i18n/messages.js#L16) |
| 連続回答フラグ付与条件 | `state.surveyData.plan === 'premium'` | [survey-answer.js:2062](../../../02_dashboard/src/survey-answer.js#L2062) |
| サンクス画面 URL 既定 | `thankYouScreen.html` | [survey-answer.js:2059](../../../02_dashboard/src/survey-answer.js#L2059) |
| Pull-to-Refresh 抑止 | `document.body.style.overscrollBehaviorY = 'contain'` | [survey-answer.js:2185](../../../02_dashboard/src/survey-answer.js#L2185) |
| 必須未入力エラー強調スタイル | `.border-error.border-2`（fieldset に付与） | [survey-answer.js:1979-1981](../../../02_dashboard/src/survey-answer.js#L1979) |
| **実送信 API** | **モックのみ**（`simulateUpload()` 擬似プログレス） | [survey-answer.js:2076-2095](../../../02_dashboard/src/survey-answer.js#L2076) / §11-1 |
| **`beforeunload` 警告** | **未実装**（`setupLeaveConfirmation()` 内は `popstate` + `click` のみ） | [survey-answer.js:2135-2182](../../../02_dashboard/src/survey-answer.js#L2135) / §11-2 |
| **OCR 言語判別** | **ダミー表示のみ**（「OCR言語: 日本語 (ダミー)」固定） | [survey-answer.js:743](../../../02_dashboard/src/survey-answer.js#L743) / §11-3 |
| **名刺必須/任意の送信前確認** | **未実装**（送信バリデーションでは参照しない） | §11-4 |
| **`state.surveyData.plan` 判定の単独性** | `=== 'premium'` 単独判定、`allowContinuousAnswer` 不参照 | [survey-answer.js:2062](../../../02_dashboard/src/survey-answer.js#L2062) / §11-5 |

---

## 2. 対象画面・関連ファイル

- `02_dashboard/survey-answer.html`（167 行、単一ページ、モーダル DOM はすべて空 `<div>` プレースホルダで JS から `innerHTML` 注入）
- `02_dashboard/src/survey-answer.js`（2,244 行。`DOMContentLoaded` 起点でモジュール一枚、`export` なし）
- `02_dashboard/src/utils.js` `resolveDashboardDataPath()`（アンケート JSON のパス解決。`data/surveys/{surveyId}.json` を相対→絶対へ変換）
- `02_dashboard/src/services/i18n/messages.js`（`LANGUAGE_LABELS` 5 言語 + `messages.{locale}.*` の翻訳辞書、`formatMessage` / `normalizeLocale` / `resolveLocalizedValue`）
- 共通スタイル: `02_dashboard/service-top-style.css`、`02_dashboard/src/toolbox.css`（`handwriting_space` 用ツールボックス）

**依存 CDN**（`survey-answer.html` 冒頭）:
- Tailwind CDN（`plugins=forms,container-queries`、[survey-answer.html:8](../../../02_dashboard/survey-answer.html#L8)）
- Material Icons（[survey-answer.html:9](../../../02_dashboard/survey-answer.html#L9)）
- Google Fonts Inter / Noto Sans JP（[survey-answer.html:13](../../../02_dashboard/survey-answer.html#L13)）

**HTML 側のインライン CSS**（`<head>` 内 `<style>`、[survey-answer.html:14-69](../../../02_dashboard/survey-answer.html#L14)）:
- `body { padding-left: 0 !important; }`（ダッシュボード共通スタイルの左サイドバー分パディングを打ち消す）
- `.survey-content-wrapper`（max-width 768px、左右中央寄せ）
- `.survey-question-card`（背景白、角丸 8px、`border-left: 4px solid transparent`（`.is-required` 付き時のみ動的色）、影 `0 1px 2px 0 rgba(0,0,0,0.05)`、ホバー transition）
- `.header-unpinned`（**死スタイル**、呼出元なし、§11-6）
- `.bizcard-preview-img` / `.bizcard-preview-back-empty` / `.bizcard-preview-back-actions-hidden`（名刺プレビューエリア用）
- `#submitting-progress-bar { width: 0%; }`（送信モーダル初期値）

---

## 3. 改訂履歴

- v2.0 (2026-04-24): 実装トレース型へ全面刷新。現行 `survey-answer.js` 2,244 行を正本とし、v1.x で定義していた「モーダル遷移 Mermaid 図」「プラン区分 3 段」「対外提出用 変更履歴 9 段」等の抽象記述はすべて破棄。12 設問タイプの描画ロジック・バリデーション・多言語抽出・ドラフト保存・名刺アップロードフロー・プレビュー分岐・送信後遷移を §5 / §6 に展開し、実装ギャップ 18 件を §11 に集約。
- v1.x (〜 2026-04-17): 対外提出版レビュー反映の抽象的仕様書（567 行）。モーダル閉じる手段・プラン別 `continuous` フラグ・WCAG スコープ外宣言等を含むが、実装の `createQuestionElement()` switch 分岐や `normalizeQuestionType()` の 11 分岐については未文書化だった。v2.0 で `_archive` 相当として破棄。

---

## 4. 画面構成

### 4.1 全体レイアウト（ASCII ツリー）

`<body class="bg-gray-50">` 直下に `#survey-main-wrapper`（背景 `#E0F2F7`、`min-h-screen`）を置き、その中にローディング・メインコンテンツ・フッター・モーダル群を配置する。サイドバー・共通ヘッダーは使用しない（ダッシュボードの共通パディング `body { padding-left: 0 !important; }` で打ち消し）。

```
<body class="bg-gray-50">
└── #survey-main-wrapper (bg:#E0F2F7, min-h-screen)
    ├── #loading-indicator (fixed inset-0 bg-black/50 z-50)    … 初期表示、JS完了で display:none
    ├── <main id="main-content" class="py-2">
    │   └── .survey-content-wrapper (max-w:768px, mx-auto, px-4)
    │       ├── #language-switcher-container (flex justify-end mb-4)
    │       │   └── #language-select (<select>, w-40, 動的option注入)
    │       ├── #survey-title-container (mb-6)                  … renderSurveyTitle() が innerHTML で差替
    │       ├── #error-container (hidden, bg-red-100 p-4)       … 致命エラー時のみ表示、フォーム非表示
    │       ├── <form id="survey-form" class="space-y-6">       … renderQuestions() が fieldset を append
    │       └── #bizcard-preview-area (hidden, mt-6)
    │           ├── #bizcard-preview-front-container (group)
    │           │   ├── #bizcard-preview-front (<img>)
    │           │   └── hover overlay
    │           │       ├── #bizcard-retake-front (<button> 再撮影)
    │           │       └── #bizcard-delete-front (<button> 削除)
    │           └── #bizcard-preview-back-wrapper
    │               └── #bizcard-preview-back-container (group)
    │                   ├── #bizcard-preview-back (<img>, 初期hidden)
    │                   ├── #bizcard-preview-back-empty (div, 初期visible)    … 「裏面を追加」クリック領域
    │                   └── #bizcard-preview-back-actions (hidden overlay)
    │                       ├── #bizcard-retake-back
    │                       └── #bizcard-delete-back
    └── <footer class="bg-white shadow-md py-6">
        └── .survey-content-wrapper (flex-col items-center gap-4)
            ├── 2-col grid (w-full, gap-4)
            │   ├── #bizcard-camera-button ("名刺を撮影" / 登録後 "撮影済み" disabled)
            │   └── #submit-survey-button ("送信する")
            └── #bizcard-manual-button ("名刺が手元に無い方", text-link)

<!-- モーダル群 (すべて #survey-main-wrapper 配下、初期 hidden、JS から innerHTML 注入) -->
#submitting-modal         (fixed inset-0 z-50, キャンセル不可)
#bizcard-upload-modal     (empty div, showModal() 経由で注入)
#manual-input-modal       (empty div)
#leave-confirm-modal      (empty div、離脱確認 / 手入力保存確認 兼用)
#draft-restore-modal      (empty div、ドラフト復元)
#image-magnify-modal      (empty div, z-60, 画像拡大)
#toast-notification       (fixed top-1/2 left-1/2, 3秒で自動非表示)
```

### 4.2 セクション詳細

#### 4.2.1 ローディングインジケーター `#loading-indicator`

- 初期 `display: flex` で画面全面を覆う（[survey-answer.html:75-77](../../../02_dashboard/survey-answer.html#L75)）。
- `showLoading(true/false)` が `style.display` を `'flex' / 'none'` で切替（[survey-answer.js:2115-2117](../../../02_dashboard/src/survey-answer.js#L2115)）。
- `DOMContentLoaded` の `finally` ブロックで必ず `showLoading(false)`（同:204-206）。例外発生時も非表示化されるため、致命エラーの場合は `#error-container` にメッセージを出して終了する。

#### 4.2.2 言語切替 `#language-switcher-container` / `#language-select`

- `<select>` 単体で `<option>` は JS から動的注入（`setupPremiumFeatures()`、[survey-answer.js:1885-1942](../../../02_dashboard/src/survey-answer.js#L1885)）。
- 既定 `<option value="" disabled>` に `t('surveyAnswer.languageLabel')` を設定（日本語で「Language」、英語でも「Language」）。
- `inferAvailableLanguages()` が `getSurveyAvailableLocales()` 経由で利用可能言語を抽出（§5.6）。
- 抽出結果が `1 以下` の場合、`#language-switcher-container` に `.hidden` を付与して **コンテナごと非表示** にする（[survey-answer.js:1924-1927](../../../02_dashboard/src/survey-answer.js#L1924)）。
- リスナ重複登録防止: `languageSelect.dataset.listenerAttached` フラグで `change` イベント登録は 1 回のみ（同:1930-1941）。

#### 4.2.3 タイトルカード `#survey-title-container`

- `renderSurveyTitle()` が `innerHTML` で以下を差し込む（[survey-answer.js:1263-1274](../../../02_dashboard/src/survey-answer.js#L1263)）:
  ```
  <div class="bg-white border-2 border-gray-200 rounded-lg shadow-md p-6">
    <h1 class="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">{displayTitle}</h1>
    <p class="text-gray-600 mt-2">{description}</p>
  </div>
  ```
- `displayTitle` / `description` は `resolveLocalizedValue()` で現在ロケール向けに解決。未定義時は `t('surveyAnswer.titleFallback')`（「アンケート」）。

#### 4.2.4 エラー領域 `#error-container`

- 初期 `hidden`、`displayError(message)` で `classList.remove('hidden')` + `innerHTML = <p>${message}</p>`（[survey-answer.js:2123-2127](../../../02_dashboard/src/survey-answer.js#L2123)）。
- 同時に `DOMElements.surveyForm.classList.add('hidden')` でフォーム非表示。全画面エラー UI。

#### 4.2.5 設問フォーム `<form id="survey-form">`

- `renderQuestions()` が `state.surveyData.questions` をループし `createQuestionElement()` の返り値 `<fieldset>` を append（[survey-answer.js:1276-1289](../../../02_dashboard/src/survey-answer.js#L1276)）。
- 設問 0 件の場合は `<p>${t('common.noQuestions')}</p>` を表示。
- フォームタグ自体に submit ハンドラは無い。送信は `#submit-survey-button` の click ハンドラから `handleSubmit()` を呼ぶ。
- ページネーションは実装されていない（全設問を縦一列に表示）。

#### 4.2.6 設問カード `<fieldset class="survey-question-card">`

- `createQuestionElement(question, index)` が生成（[survey-answer.js:1291-1881](../../../02_dashboard/src/survey-answer.js#L1291)）。
- 共通構造:
  ```
  <fieldset class="survey-question-card[ is-required]" data-question-id="{id}">
    <div class="question-content">
      <div class="accordion-header" data-state="open">
        <div>
          <span>Q.01</span><span>必須</span>            … 必須時のみバッジ
          <p>{question.text}</p>
        </div>
        <span class="material-icons accordion-icon">expand_less</span>
      </div>
      <div class="control-area accordion-body">
        {設問タイプ別コントロール}
      </div>
    </div>
  </fieldset>
  ```
- `.is-required` の左ボーダー色は `updateDynamicColors(backgroundColor)` が動的に塗る。初期色は `#FFFFFF` を 40 段階暗くした値（`adjustColor('#FFFFFF', 40)` = `#D7D7D7`、[survey-answer.js:2218-2225](../../../02_dashboard/src/survey-answer.js#L2218)）。
- `accordion-header` クリックで `.accordion-body` に `hidden` トグル、アイコンが `expand_less` / `expand_more` 切替（`setupEventListeners()` 冒頭、[survey-answer.js:319-342](../../../02_dashboard/src/survey-answer.js#L319)）。

#### 4.2.7 名刺プレビュー `#bizcard-preview-area`

初期 `hidden`。`updateBizcardPreview()`（[survey-answer.js:496-531](../../../02_dashboard/src/survey-answer.js#L496)）が `state.answers.bizcardImages` を見て表示／非表示を切り替える。

| 要素 | 可視性ルール | 実装 |
|------|--------------|------|
| `#bizcard-preview-area` | `hasFront \|\| hasBack` で `hidden` 除去 | [survey-answer.js:508-513](../../../02_dashboard/src/survey-answer.js#L508) |
| `#bizcard-preview-front` | `hasFront` 時に `src` 更新、`hidden` クラスは HTML 側から付けられていない | [survey-answer.js:516-518](../../../02_dashboard/src/survey-answer.js#L516) |
| `#bizcard-preview-back` | 裏面登録時 `src` 更新 + `hidden` 除去、未登録時 `hidden` 付与 | [survey-answer.js:521-528](../../../02_dashboard/src/survey-answer.js#L521) |
| `#bizcard-preview-back-empty` | 裏面登録時 `hidden` 付与、未登録時 `hidden` 除去 | 同上 |
| `#bizcard-preview-back-actions` | 裏面登録時 `.bizcard-preview-back-actions-hidden` 除去（ホバーオーバーレイ可視化）、未登録時付与 | 同上 |

#### 4.2.8 フッター

| 要素 | ラベル | 役割 |
|------|--------|------|
| `#bizcard-camera-button` | 初期「名刺を撮影」/ 登録後「撮影済み」（disabled） | 押下で `startBizcardUploadFlow()` 起動。プレビューモード時はトーストのみ。`updateBizcardButtonState()` がクラスを切替（`bg-blue-100 text-blue-800` ↔ `bg-gray-100 text-gray-400 cursor-not-allowed`）。 |
| `#submit-survey-button` | 「送信する」 | 押下で `handleSubmit()`。プレビューモード時も実行されるが、`simulateUpload()` 後に `document.write()` で完了画面をインライン描画する。 |
| `#bizcard-manual-button` | 「名刺が手元に無い方」 | text-link スタイル。押下で手入力モーダル起動（§5.4）。 |

ラベル文言は `applyStaticTranslations()` が `t('surveyAnswer.*')` で現在ロケール向けに差し替える（[survey-answer.js:141-161](../../../02_dashboard/src/survey-answer.js#L141)）。

### 4.3 モーダル群（DOM 列挙）

すべて `#survey-main-wrapper` 配下の空 `<div>` プレースホルダで、`showModal(modalElement, title, body, options)`（[survey-answer.js:1082-1129](../../../02_dashboard/src/survey-answer.js#L1082)）が `innerHTML` で以下を注入する:

```
<div class="bg-surface rounded-lg shadow-xl max-w-lg w-full m-4">
  <div class="flex justify-between p-4 border-b">
    <h3>{title}</h3>
    <button class="close-modal-button">&times;</button>
  </div>
  <div class="p-6">{body}</div>
  <div class="flex justify-end p-4 bg-surface-container rounded-b-lg gap-3">
    {cancelButton?} {saveButton?}
  </div>
</div>
```

表示は `modalElement.style.display = 'flex'`、非表示は `= 'none'`。

| モーダル | セレクタ | 表示条件 | 閉じる手段 |
|----------|----------|----------|------------|
| 送信中 | `#submitting-modal` | `handleSubmit()` 開始時に `showSubmittingModal(true)` | **閉じる手段なし**。送信完了でサンクス画面へ遷移、失敗時のみ `showSubmittingModal(false)` で閉じる（§5.5） |
| 名刺アップロード | `#bizcard-upload-modal` | `#bizcard-camera-button` / サムネイル再撮影 / 裏面追加 押下 | × / オーバーレイクリック / ESC（ブラウザ標準動作は無し、`showModal()` 内の `modalElement.addEventListener('click', ...)` でオーバーレイクリックを検知） |
| 手入力 | `#manual-input-modal` | `#bizcard-manual-button` 押下 | × / オーバーレイクリック（onCancel が未設定でも `close-modal-button` は存在し、modal の `display='none'`） |
| 離脱／保存確認 | `#leave-confirm-modal` | `popstate` / 外部リンククリック / 手入力「保存」の確認ステップ | × / オーバーレイクリック（`onCancel` コールバックがあれば実行） |
| ドラフト復元 | `#draft-restore-modal` | `checkForDraft()` が `survey_draft_{surveyId}_{sessionId}` 検出時 | × / オーバーレイクリック → `onCancel`（ドラフト破棄） |
| 画像拡大 | `#image-magnify-modal` | 名刺サムネイルクリック | × / オーバーレイクリック。`.magnify-image-container` 内クリックは `stopPropagation()` で閉じない |

### 4.4 レスポンシブ

- すべてのビューポートで 1 カラム（最大幅 768px 固定）。モバイル・タブレット・デスクトップで同一レイアウト。
- `#bizcard-preview-area` 内は 2 カラム（表面 / 裏面）固定（`.flex.gap-4` + 各 `.flex-1`、[survey-answer.html:99-123](../../../02_dashboard/survey-answer.html#L99)）。
- 日付・時刻入力は `.flex.flex-col.sm:flex-row.gap-2` でモバイル縦積み / SM 以上横並び（[survey-answer.js:1420-1424](../../../02_dashboard/src/survey-answer.js#L1420)）。
- 名刺アップロードモーダル内の選択カード（ストレージ / カメラ）は `grid-cols-1 md:grid-cols-2`（[survey-answer.js:681](../../../02_dashboard/src/survey-answer.js#L681)）。

### 4.5 言語切替 UI

- ドロップダウンの選択肢順: `inferAvailableLanguages()` の返り値順。先頭に空値 + `surveyAnswer.languageLabel` の無効オプション（「Language」）が固定で入る。
- 選択肢ラベル: `LANGUAGE_LABELS[locale]`（`ja: 日本語` / `en: English` / `zh-CN: 中文(简体)` / `zh-TW: 中文(繁體)` / `vi: Tiếng Việt`）。未ラベルのコードはコード文字列そのまま表示（[survey-answer.js:1913](../../../02_dashboard/src/survey-answer.js#L1913)）。
- 切替時: `state.currentLanguage` を `normalizeLocale()` で正規化し、`renderSurvey()` で全設問を再描画後 `populateFormWithDraft()` で既入力値を復元、トースト `t('surveyAnswer.switchedLocale', { locale })` を表示（同:1932-1941）。

---

## 5. 機能要件

### 5.1 初期化フロー [**MVP**]

`document.addEventListener('DOMContentLoaded', async () => { ... })`（[survey-answer.js:164-207](../../../02_dashboard/src/survey-answer.js#L164)）内の流れ:

1. `initializeDOMElements()`: `DOMElements` オブジェクトに 17 個の getElementById 結果をキャッシュ（[survey-answer.js:31-58](../../../02_dashboard/src/survey-answer.js#L31)）。**うち `header` / `headerText` は HTML 側に該当 ID が存在しないため常に `null`**（§11-7）。
2. `showLoading(true)`: `#loading-indicator` を `display:flex` で表示。
3. `initializeParams()`: URL から `preview` / `surveyId` / `answerLocale` を取得（[survey-answer.js:211-219](../../../02_dashboard/src/survey-answer.js#L211)）。
   - `state.isPreviewMode = params.get('preview') === '1'`
   - `state.surveyId = params.get('surveyId') || (isPreviewMode ? '__preview__' : null)`
   - `surveyId` 不在でプレビューでもない場合、`t('surveyAnswer.missingSurveyId')`（「URLに surveyId が指定されていません。」）を throw。
   - `state.currentLanguage = normalizeLocale(params.get('answerLocale') || '')`
4. `await loadSurveyData()`: データソース分岐（[survey-answer.js:286-316](../../../02_dashboard/src/survey-answer.js#L286)）。
   - **プレビューモード**: `localStorage.getItem('surveyPreviewData')` を JSON.parse。存在しなければ throw。
   - **本番モード**: `resolveDashboardDataPath('surveys/{surveyId}.json')` を `fetch()`。`response.ok === false` で `t('surveyAnswer.surveyNotFound', { surveyId })` を throw。
   - 取得後 `state.surveyData.questions`（または `details`）を `normalizeQuestion()` でループ正規化。
   - `state.currentLanguage` が空なら `defaultAnswerLocale` / `editorLanguage` / `'ja'` の順でフォールバック。
   - `setupPremiumFeatures()` 呼び出し（§5.6）。**関数名は多言語対応の付番の残りで、実質は言語切替 UI の初期化のみ**（§11-8）。
5. **プレビュー分岐**:
   - `isPreviewMode === true`: `renderSurvey()` + 送信ボタン + 名刺ボタン（名刺ボタン類は「プレビューのため使用不可」トースト）のみ。
   - `isPreviewMode === false`: `setupEventListeners()` → `await checkForDraft()` → `renderSurvey()` → （ドラフトあれば `populateFormWithDraft()`）→ `startAutoSaveTimer()` → `setupLeaveConfirmation()` → `disablePullToRefresh()` → `history.pushState(null, '', location.href)`（ブラウザバック捕捉用の履歴エントリ追加）。
6. `DOMElements.surveyForm.addEventListener('input')`: textarea なら `autoResizeTextarea()` で `scrollHeight` 追従。
7. `finally` で `showLoading(false)`。
8. `catch`: `displayError(error.message || t('surveyAnswer.loadingFailed'))`。

**`state` 初期値**（[survey-answer.js:15-26](../../../02_dashboard/src/survey-answer.js#L15)）:

| キー | 初期値 | 用途 |
|------|--------|------|
| `surveyId` | `null` | URL 指定の ID。`__preview__` はプレビューダミー |
| `surveyData` | `null` | 正規化済みアンケート定義全体 |
| `answers` | `{}` | `{questionId: value}` 形式の回答集約 |
| `draftExists` | `false` | **未使用**、`checkForDraft()` は代わりに `draftToRestore` を立てる（§11-9） |
| `sessionId` | `session_{Date.now()}` | タブ単位の識別子 |
| `isSubmitting` | `false` | 送信中二重押下防止 |
| `idleTimer` | `null` | **未使用**（§11-10） |
| `isIdle` | `false` | **未使用**（§11-10） |
| `currentLanguage` | `''` | 現在表示ロケール |
| `hasUnsavedChanges` | `false` | 離脱警告判定 |
| `isPreviewMode` | 動的付与 | `initializeParams()` が立てる |
| `draftToRestore` | 動的付与 | `checkForDraft()` の `onSave` で立つ |

### 5.2 設問タイプ別の回答 UI [**MVP**]

`createQuestionElement(question, index)` 内の `switch (question.type)` 分岐。型は `normalizeQuestionType(rawType)`（[survey-answer.js:257-271](../../../02_dashboard/src/survey-answer.js#L257)）で以下に正規化される:

| 正規化後 | 入力文字列の判定ルール（substring match） |
|----------|------------------------------------------|
| `single_answer` | `includes('single')` or `includes('radio')` |
| `multi_answer` | `includes('multi')` or `includes('check')` |
| `free_answer` | `includes('free')` or `includes('text')` |
| `number_answer` | `includes('number')` |
| `date_time` | `includes('date')` or `=== 'time'` |
| `image_upload` | `includes('image')` |
| `dropdown` | `includes('dropdown')` |
| `matrix_sa` | `includes('matrix_sa')` |
| `matrix_ma` | `includes('matrix_ma')` |
| `handwriting_space` | `includes('handwriting')` |
| `explanation_card` | `includes('explanation')` |
| その他 | 原文字列のまま（`rating_scale` はここで該当なしなので原文字列が return される） |

**注意**: `rating_scale` は `normalizeQuestionType()` に専用分岐がなく、`switch` 側が `case 'rating_scale':` を直接受ける。アンケート作成画面側から `rating_scale` と明記されている前提（[survey-answer.js:1457](../../../02_dashboard/src/survey-answer.js#L1457)）。

また `normalizeQuestion()`（[survey-answer.js:221-255](../../../02_dashboard/src/survey-answer.js#L221)）は旧タイプ名 `date` / `time` を受けたときに `meta.dateTimeConfig.inputMode` を自動補完（`date` のみ / `time` のみ表示）する。

以下、各設問タイプの詳細。

#### 5.2.1 `free_answer` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `<textarea name="{id}" class="w-full rounded-md border-gray-300 shadow-sm" rows="4">` + 警告 `<div class="text-error text-sm mt-1">` |
| 実装 | [survey-answer.js:1323-1358](../../../02_dashboard/src/survey-answer.js#L1323) |
| config | `meta.validation.text.minLength` / `maxLength` |
| HTML 属性 | `minLength=min`（`min > 0` のとき設定、ただしブラウザ標準の submit 時検証は走らない） |
| リアルタイム警告 | `input` イベントで `len > max` → `validation.maxLength`（「{count}文字超過しています。」）、`len < min` → `validation.minLength`（「あと{count}文字必要です。」）。両方範囲内なら非表示。 |
| 送信時バリデーション | 最小/最大文字数は **送信ブロッカにならない**。`required` のみチェック。§11-11 |
| 自動リサイズ | `surveyForm` の `input` リスナで `autoResizeTextarea()` が呼ばれ、`textarea.style.height = scrollHeight + 'px'`（[survey-answer.js:469-472](../../../02_dashboard/src/survey-answer.js#L469)） |

#### 5.2.2 `single_answer` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `<input type="radio" id="{id}-{value}" name="{id}" value="{value}" class="form-radio text-primary">` + `<label>` を `options.forEach` で `innerHTML +=` |
| 実装 | [survey-answer.js:1359-1367](../../../02_dashboard/src/survey-answer.js#L1359) |
| config | `options: [{text, value}, ...]`（`normalizeOptions()` で `{text: label \|\| text, value: value \|\| text \|\| label}` に整形、[survey-answer.js:273-284](../../../02_dashboard/src/survey-answer.js#L273)） |
| 回答収集 | `new FormData(surveyForm).getAll(questionId)` で単一値 string |

#### 5.2.3 `multi_answer` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `<input type="checkbox" id="{id}-{value}" name="{id}" value="{value}" class="form-checkbox text-primary">` + `<label>` を `createElement` + `appendChild` |
| 実装 | [survey-answer.js:1368-1401](../../../02_dashboard/src/survey-answer.js#L1368) |
| config | `options` / `meta.maxSelections` |
| 上限挙動 | `maxSelections > 0` 時、`controlArea` の `change` で既選択数を数え、上限到達で未選択の checkbox に `disabled = true`。解除時は全てを `disabled = false`。**上限到達トーストは表示しない**。 |
| 回答収集 | `entries.length > 1` なら `string[]`、1 個なら string |

#### 5.2.4 `number_answer` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `<input type="number" name="{id}" min="{min}" max="{max}" step="{step || 1}">` |
| 実装 | [survey-answer.js:1402-1404](../../../02_dashboard/src/survey-answer.js#L1402) |
| config | `question.min` / `question.max` / `question.step`（`meta` ではなく直接フィールド） |
| バリデーション | HTML5 標準の範囲外警告のみ。JS 側の型・範囲チェックなし。§11-11 |

#### 5.2.5 `date_time` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `<div class="flex flex-col sm:flex-row gap-2">` 内に `<input type="date" name="{id}_date" aria-label="Date" max="9999-12-31">` および `<input type="time" name="{id}_time" aria-label="Time">` |
| 実装 | [survey-answer.js:1405-1425](../../../02_dashboard/src/survey-answer.js#L1405) |
| config | `meta.dateTimeConfig.inputMode`: `'date'` / `'time'` / `'datetime'`（省略時 `'datetime'`） |
| 正規化 | 旧 `type: 'date'` / `'time'` は `normalizeQuestion()` が `dateTimeConfig.inputMode` を補完 |
| 回答収集 | `fieldset` の `change` リスナ内で `_date` と `_time` を結合。両方あれば `YYYY-MM-DDTHH:mm`、片方だけならその値、両方空なら `delete state.answers[qid]`（[survey-answer.js:1848-1862](../../../02_dashboard/src/survey-answer.js#L1848)） |
| ドラフト復元 | `answer` を `split('T')` で分解し各 input に代入（[survey-answer.js:1204-1209](../../../02_dashboard/src/survey-answer.js#L1204)） |

#### 5.2.6 `dropdown` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `<select name="{id}" class="w-full rounded-md">` + `<option value="{value}">{text}</option>` |
| 実装 | [survey-answer.js:1426-1432](../../../02_dashboard/src/survey-answer.js#L1426) |
| config | `options: [{text, value}, ...]` |
| 注意 | プレースホルダの空 `<option>` は **生成されない**（既定で先頭オプションが自動選択される）。必須判定時に初期値が選択済扱いになる可能性あり（§11-12） |

#### 5.2.7 `matrix_sa` / `matrix_ma` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `<table>` の行×列グリッド。左端セルに `rows[].text`、ヘッダに `columns[].text` |
| 実装 | [survey-answer.js:1433-1456](../../../02_dashboard/src/survey-answer.js#L1433) |
| config | `rows: [{id, text}]` / `columns: [{id, text, value}]`（`columns` 無ければ `options` をカラムとして使用、`normalizeQuestion()`） |
| SA の name 属性 | `{questionId}-{rowId}`（行単位に 1 ラジオグループ） |
| MA の name 属性 | `{questionId}-{rowId}-{colId}`（行×列ごとに独立チェックボックス） |
| 回答収集 | 既存の `FormData.getAll(questionId)` は `questionId` そのままの name に対して動作するため、**マトリクスの回答は `state.answers[questionId]` には集約されない**。行ごとの回答は `questionId-{rowId}` / `{rowId}-{colId}` の name 空間に分散したまま。§11-13 |

#### 5.2.8 `rating_scale` [**MVP（描画）**]

| 項目 | 内容 |
|------|------|
| DOM | 左右ラベル + N 個のカスタムラジオ（`<label>` + `<input type="radio" class="sr-only peer">` + `<span>` カスタム円 + 数字テキスト）。中間ラベルはコンテナ末尾に `<div>` |
| 実装 | [survey-answer.js:1457-1556](../../../02_dashboard/src/survey-answer.js#L1457) |
| config | `meta.ratingScaleConfig.{ points, minLabel, midLabel, maxLabel, showMidLabel }` |
| デフォルト | `points` 省略時 5。`showMidLabel: true` のときのみ中間ラベル表示 |
| 中間インデックス | `Math.ceil(points / 2)`（[survey-answer.js:1464](../../../02_dashboard/src/survey-answer.js#L1464)）。**現行実装では計算されるが描画ロジック側で参照していない**（中間ラベルは全体ラジオ群の下に中央配置、§11-14） |
| プラン分岐 | 回答画面では **プラン区分を参照しない**。作成側で段階数制限を適用する前提。`11_plan_feature_restrictions` に従う |
| peer-checked フォールバック | Tailwind の `peer-checked:*` が動かない環境向け JS 制御。各 `change` で全 `<label>` を舐めて border / scale を更新（[survey-answer.js:1520-1535](../../../02_dashboard/src/survey-answer.js#L1520)） |

#### 5.2.9 `explanation_card` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `<p class="text-on-surface-variant">{question.text}</p>` のみ |
| 実装 | [survey-answer.js:1557-1560](../../../02_dashboard/src/survey-answer.js#L1557) |
| 回答 | なし（`state.answers` に保存されない） |
| 必須 | 仕様上は設定されても必ず valid（回答値がないため `validateField()` は常に true を返さない、§11-15） |

#### 5.2.10 `handwriting_space` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `.handwriting-container` 内にツールボックス（ペン・消しゴム・色・太さ・undo・redo・クリア）+ `<canvas>` + オーバーレイ |
| 実装 | [survey-answer.js:1561-1803](../../../02_dashboard/src/survey-answer.js#L1561) |
| config | `meta.handwritingConfig.canvasHeight`（既定 200px） |
| DPI 対応 | `canvas.width = rect.width * devicePixelRatio`、`ctx.scale(dpr, dpr)`（[survey-answer.js:1615-1619](../../../02_dashboard/src/survey-answer.js#L1615)） |
| ペンモード | 初期 OFF。オーバーレイ（`#{id}-canvas-overlay`）で「ペンモードがオフです」表示。`#{id}-pen-tool` クリックで ON |
| ツール | ペン / 消しゴム（`globalCompositeOperation = 'destination-out'`） |
| 色 | `<input type="color" value="#000000">` |
| 太さ | `<input type="range" min="1" max="20" value="5">` |
| 履歴 | 直近 `ctx.getImageData()` を配列に push、undo/redo でインデックス移動 |
| 保存 | `saveState()` で `state.answers[question.id] = canvas.toDataURL()`（base64 データ URL） |
| ドラフト復元 | `<img>` に `src = answer` を代入後 `ctx.drawImage()`（[survey-answer.js:1210-1219](../../../02_dashboard/src/survey-answer.js#L1210)） |
| ドラフト除外 | 画像系と異なり **ドラフト保存にも含まれる**（`bizcardImages` のみ除外、§5.8） |

#### 5.2.11 `image_upload` [**MVP**]

| 項目 | 内容 |
|------|------|
| DOM | `<input type="file" accept="image/*">` + アップロードカード（material-icon `photo_camera` + `t('survey.tapToCapture')`）+ プレビュー `<div>` |
| 実装 | [survey-answer.js:1804-1839](../../../02_dashboard/src/survey-answer.js#L1804) |
| 保存 | `FileReader.readAsDataURL()` 後 `state.answers[question.id] = e.target.result`（base64） |
| プレビュー | `<img class="max-w-full max-h-64 rounded-lg">` |
| i18n 注記 | `t('survey.tapToCapture')` は **i18n 辞書に未定義**。`formatMessage()` が未定義キーで何を返すかに依存し、実装上はフォールバック文字列「写真を撮影またはファイルを選択」が使われる（§11-16） |

#### 5.2.12 `default`（未対応タイプ） [**Should**]

- `<p class="text-sm text-error">未対応の設問タイプです: {type}</p>` を表示（[survey-answer.js:1840-1841](../../../02_dashboard/src/survey-answer.js#L1840)）。
- `normalizeQuestionType()` が該当しない新規タイプ（例: `slider` 等）はここに落ちる。

### 5.3 バリデーション [**MVP**]

| トリガ | 実装 | 挙動 |
|--------|------|------|
| 各 fieldset の `change` | [survey-answer.js:1844-1878](../../../02_dashboard/src/survey-answer.js#L1844) | 回答を `state.answers[qid]` に取り込み、`validateField(qid)` を即時実行 |
| 送信ボタン押下 | `validateForm()` → 全設問に `validateField()` | 1 件でも失敗すれば `showToast(t('common.required'))` + return |
| `validateField(qid)` | [survey-answer.js:1964-1984](../../../02_dashboard/src/survey-answer.js#L1964) | `question.required === true` のとき `state.answers[qid]` が空文字・空配列・undefined なら失敗。失敗時 `fieldset.classList.add('border-error', 'border-2')`、成功時 remove |

**検証対象は `required` のみ**。`maxSelections` 最小件数、`minLength` / `maxLength`、`min` / `max`（number）、メール形式、マトリクスの行単位充填、日付範囲、画像サイズ等は **送信時に検証されない**（§11-11）。

### 5.4 回答以外の UI アクション

#### 5.4.1 名刺撮影フロー [**MVP**]

`startBizcardUploadFlow(targetSide = null)`（[survey-answer.js:614-1077](../../../02_dashboard/src/survey-answer.js#L614)）のステートマシン:

1. 隠し `<input type="file" accept="image/*">` を body に 1 個追加。`hiddenFileInput.onchange` でファイル選択時に `FileReader.readAsDataURL()` → `localImages[currentSide]` に base64 を格納 → `showFrontPreview()` or `showBackPreview()`。
2. `triggerFileInput(useCamera, side, isEdit)`: `useCamera` true なら `hiddenFileInput.setAttribute('capture', 'environment')`。`click()` で OS のピッカー起動。
3. `showChoice(side, isEdit)`: ストレージ / カメラ の 2 カード選択モーダル。ステップインジケータ（1→2→3）付き。
4. `showFrontPreview()`: 表面プレビュー + 「OCR言語: 日本語 (ダミー)」固定表示。フッターボタンは `showModal()` 標準の 2 ボタンでは足りないため `footer.innerHTML = ''` でリセットし「撮り直す」「裏面をスキップ」「裏面を追加する」の 3 ボタンを手動注入（[survey-answer.js:753-789](../../../02_dashboard/src/survey-answer.js#L753)）。
5. `showBackChoice()` → `showBackPreview()` → `showFinalConfirmation()` の順で遷移。裏面スキップは任意。
6. `showFinalConfirmation()`: 表面・裏面サムネイルを並列表示し「保存して回答に戻る」押下で `state.answers.bizcardImages = { ...localImages }`、`updateBizcardButtonState()` + `updateBizcardPreview()` を呼ぶ。
7. 既存画像ありで再撮影時（`targetSide` 指定時）は `showChoice(targetSide, true)` から開始し、`isEditingSide = true` で該当面のみ更新。

**「名刺を撮影」→「撮影済み」トグル**: `updateBizcardButtonState()`（[survey-answer.js:476-493](../../../02_dashboard/src/survey-answer.js#L476)）が `state.answers.bizcardImages` の有無で:
- ラベル: 「名刺を撮影」 ↔ 「撮影済み」
- disabled: false / true
- クラス: `bg-blue-100 text-blue-800 hover:bg-blue-200` ↔ `bg-gray-100 text-gray-400 cursor-not-allowed`

**削除確認**: `showBizcardDeleteConfirm(side)`（[survey-answer.js:578-608](../../../02_dashboard/src/survey-answer.js#L578)）で `#bizcard-upload-modal` を流用し、確認モーダル表示。保存ボタンを赤く染色（`bg-red-600 hover:bg-red-700`）してから確定。

#### 5.4.2 手入力フロー [**MVP**]

`#bizcard-manual-button` click ハンドラ内にインラインで定義（[survey-answer.js:356-460](../../../02_dashboard/src/survey-answer.js#L356)）。

**入力項目**（全 9 欄、すべて任意、形式バリデーション無し）:

| 論理名 | DOM id / name | type |
|--------|---------------|------|
| 姓 | `manual-last-name` / `lastName` | text |
| 名 | `manual-first-name` / `firstName` | text |
| メールアドレス | `manual-email` / `email` | email |
| 会社名 | `manual-company` / `company` | text |
| 部署名 | `manual-department` / `department` | text |
| 役職名 | `manual-title` / `title` | text |
| 電話番号 | `manual-phone` / `phone` | tel |
| 郵便番号 | `manual-postal-code` / `postalCode` | text |
| 住所 | `manual-address` / `address` | text |
| 建物名 | `manual-building` / `building` | text |

**2 段階保存**:

1. 手入力モーダル内「保存」押下 → `FormData` 収集 → `lastName` + `firstName` を連結して `manualInfo.name` 生成 → `#manual-input-modal` を一時的に `display:none` に → `#leave-confirm-modal` を流用して「入力内容の確認」表示。
2. 確認モーダルの「保存」（ラベル上書き `saveText: '保存'`）→ `state.answers.manualBizcardInfo = manualInfo`、`state.hasUnsavedChanges = true`、トースト「名刺情報を保存しました。」。
3. 「修正する」（`cancelText: '修正する'`）→ `#leave-confirm-modal` を閉じて `#manual-input-modal` を再表示。

**注**: `email` 欄は `<input type="email">` だが、保存処理は通常フォーム送信を伴わない click ハンドラ経由のため HTML5 標準検証は発火しない（§11-17）。

#### 5.4.3 画像拡大 [**MVP**]

`openMagnifyModal(src)`（[survey-answer.js:1131-1164](../../../02_dashboard/src/survey-answer.js#L1131)）。`#image-magnify-modal`（z-60）に `innerHTML` で閉じるボタン + 画像を注入、`max-w-[90vw] max-h-[90vh] object-contain`。背景クリック / × で閉じる、画像自体のクリックは `stopPropagation()`。

`initBizcardPreviewListeners()`（[survey-answer.js:534-576](../../../02_dashboard/src/survey-answer.js#L534)）で以下をバインド:
- `#bizcard-preview-front-container` / `#bizcard-preview-back-container` のクリック: 画像拡大（`#bizcard-preview-back` は `hidden` なら無視）
- `#bizcard-preview-back-empty` のクリック: `startBizcardUploadFlow('back')`（`stopPropagation()`）
- `#bizcard-retake-front` / `-back`: `startBizcardUploadFlow('front'/'back')`
- `#bizcard-delete-front` / `-back`: `showBizcardDeleteConfirm('front'/'back')`

### 5.5 進捗表示・ページング [**MVP**]

- **ページング**: **実装されていない**。全設問を縦に並べて表示。
- **進捗表示**: 設問単位の進捗バー・ステップインジケータは回答画面本体には無い（名刺アップロードモーダル内にのみ 1→2→3 のステップ表示あり）。
- **送信進捗**: `#submitting-modal` のプログレスバー `#submitting-progress-bar`（`width: 0%` 初期）と `#submitting-percentage`（`0%` → `100%`）を `simulateUpload()` が 200ms 周期で更新（[survey-answer.js:2076-2095](../../../02_dashboard/src/survey-answer.js#L2076)）。

### 5.6 多言語対応 [**MVP**]

#### 5.6.1 利用可能言語の抽出

`getSurveyAvailableLocales()`（[survey-answer.js:101-125](../../../02_dashboard/src/survey-answer.js#L101)）が以下の順に抽出:

1. 初期値 `new Set(['ja'])` で **常に `ja` を含む**。
2. `surveyData.settings.supportedLocales`
3. `surveyData.activeLanguages`
4. `surveyData.languages`
5. `displayTitle` / `description` の多言語テキストキー（`isLocalizedTextObject()` が true の場合）
6. 各 `question.text` / `option.text` / `row.text` / `column.text` の多言語テキストキー

各ロケールは `normalizeLocale()` を通し、`LANGUAGE_LABELS` に存在するキーのみを採用。返り値は `Set` を展開した配列で、挿入順序が維持される。

#### 5.6.2 現在言語の決定とフォールバック

`setupPremiumFeatures()` 内:
1. `availableLanguages = inferAvailableLanguages()` を取得。
2. `state.currentLanguage` が `availableLanguages` に **含まれない場合**、`normalizeLocale(state.currentLanguage)` で再正規化してもう一度チェック。まだ含まれなければ `availableLanguages[0]`（通常 `ja`）にフォールバック。
3. `<select>` の `value` を `getCurrentLocale()` にセット。

単一言語アンケートでは `availableLanguages.length <= 1` で `#language-switcher-container.hidden` が立つ。

#### 5.6.3 表示文言の解決

- `t(path, params)`（[survey-answer.js:69-71](../../../02_dashboard/src/survey-answer.js#L69)）: 静的 UI ラベル用。`formatMessage(currentLocale, path, params)` に委譲。
- `resolveSurveyText(value)`（同:73-75）: アンケート定義内の多言語テキストオブジェクト解決用。`resolveLocalizedValue(value, currentLocale)` に委譲。現在ロケール値 → `ja` → 任意の最初のキーの順でフォールバック（`messages.js` の実装に依存）。
- `applyStaticTranslations()`（同:141-161）: 送信ボタン・名刺撮影ボタン・手入力ボタン・送信中テキストを `t()` で差替。言語切替時に `renderSurvey()` 経由で毎回再実行。

#### 5.6.4 `<html lang>` 属性

`applyStaticTranslations()` 内で `document.documentElement.lang = getCurrentLocale()` を都度更新（[survey-answer.js:142](../../../02_dashboard/src/survey-answer.js#L142)）。

### 5.7 回答送信処理 [**MVP**]

`handleSubmit()`（[survey-answer.js:1998-2074](../../../02_dashboard/src/survey-answer.js#L1998)）:

1. `state.isSubmitting` が true なら即 return（二重送信防止）。
2. `validateForm()` で全設問の `required` チェック。失敗なら `showToast(t('common.required'))`（日本語時「必須項目を入力してください。」）+ return。
3. `state.isSubmitting = true`、`submitSurveyButton.disabled = true`、`showSubmittingModal(true)`。
4. ペイロード構築:
   ```
   finalAnswers = {
     surveyId: state.surveyId,
     submittedAt: new Date().toISOString(),
     answerLocale: getCurrentLocale(),
     answers: state.answers        // bizcardImages / manualBizcardInfo / 各設問回答 を含む
   }
   ```
5. `await simulateUpload(finalAnswers)`: 200ms 周期 `setInterval` で 0〜20% ずつ進行。100% 到達後 `setTimeout(resolve, 300)`（[survey-answer.js:2076-2095](../../../02_dashboard/src/survey-answer.js#L2076)）。**常に成功する擬似プログレスのみ**。
6. `localStorage.setItem('survey_response_{surveyId}_{Date.now()}', JSON.stringify(finalAnswers))`。
7. `localStorage.removeItem('survey_draft_{surveyId}_{sessionId}')`。`state.hasUnsavedChanges = false`。
8. サンクス画面遷移先解決:
   - `thankYouSettings = surveyData.thankYouScreenSettings || surveyData.settings?.thankYouScreen || {}`
9. **プレビュー分岐**: `state.isPreviewMode === true` の場合、`document.open() / document.write(...) / document.close()` で現在ページを完了画面で置換（「回答完了」+ thankYouMessage + 「※ プレビューモードのため回答データは送信されていません」）。`return`。
10. **本番**: URL を以下の順で組み立て遷移:
    - `thankYouUrl = thankYouSettings.url || 'thankYouScreen.html'`
    - `+= '?surveyId=' + state.surveyId`
    - `+= '&answerLocale=' + encodeURIComponent(getCurrentLocale())`
    - `surveyData.plan === 'premium'` の場合のみ `+= '&continuous=true'`
    - `window.location.href = thankYouUrl`
11. `catch`: `displayError(t('surveyAnswer.submitFailed'))`（「回答の送信に失敗しました。」）、`isSubmitting = false`、`submitSurveyButton.disabled = false`、`showSubmittingModal(false)`。**`simulateUpload()` は常に成功するため、この catch 節は事実上デッドパス**（§11-1）。

**注意**: `thankYouUrl` に既存クエリ文字列が含まれる場合（例: `thankYouScreen.html?foo=bar`）、`+= '?surveyId=...'` 連結でクエリが壊れる（§11-18）。

### 5.8 ドラフト保存・復元 [**MVP**]

#### 5.8.1 自動保存

`startAutoSaveTimer()`（[survey-answer.js:1243-1245](../../../02_dashboard/src/survey-answer.js#L1243)）: `setInterval(saveDraft, 30000)` で 30 秒ごとに `saveDraft()` を起動。

`saveDraft()`（同:1944-1962）:
1. `state.hasUnsavedChanges === false` なら即 return。
2. `answersToSave = { ...state.answers }` をコピーし、`bizcardImages` プロパティを delete（base64 画像でストレージ容量が膨らむのを回避）。
3. `localStorage.setItem('survey_draft_{surveyId}_{sessionId}', JSON.stringify(answersToSave))`。
4. `state.hasUnsavedChanges = false`。

**手入力の個人情報（`manualBizcardInfo`）はドラフトに含まれる**（画像のみ除外）。`handwriting_space` の回答も base64 だが除外対象外。§11-19 で注記。

#### 5.8.2 復元

`checkForDraft()`（[survey-answer.js:1167-1190](../../../02_dashboard/src/survey-answer.js#L1167)）: ページロード直後に `localStorage.getItem(draftKey)` を確認し、存在すれば `#draft-restore-modal` を表示。

- 「復元する」（onSave）: `state.answers = JSON.parse(draftData)`、`state.draftToRestore = true`、`updateBizcardButtonState()`、トースト「下書きを復元しました。」
- 「新しく始める」（onCancel）: `localStorage.removeItem(draftKey)`

`populateFormWithDraft()`（[survey-answer.js:1192-1241](../../../02_dashboard/src/survey-answer.js#L1192)）: `state.answers` の各キーについて、設問タイプ別にフォーム要素へ値を流し込む。

| タイプ | 流し込み方法 |
|--------|--------------|
| `date_time` | `split('T')` で日付・時刻に分解し個別 input に代入 |
| `handwriting_space` | `<canvas>` に `<img>` 経由で `drawImage()` |
| radio | `elements.forEach` で `value` 一致に `checked = true` + `dispatchEvent('change')` |
| checkbox | `answerArray.includes(el.value)` で `checked = true` |
| その他 | `elements[0].value = answer` |

### 5.9 離脱警告 [**MVP**]

`setupLeaveConfirmation()`（[survey-answer.js:2135-2182](../../../02_dashboard/src/survey-answer.js#L2135)）:

| トリガ | 実装 | 挙動 |
|--------|------|------|
| ブラウザバック（`popstate`） | `window.addEventListener('popstate')` | `hasUnsavedChanges` が true なら `#leave-confirm-modal` 表示。「離れる」なら `history.back()`、「留まる」なら `history.pushState(null, '', location.href)` で履歴を現在ページに戻す |
| 外部リンククリック（`click` キャプチャ） | `document.body.addEventListener('click', handler, true)` | `a[href]` に対し、`location.origin !== anchor.origin || !anchor.hash`（＝ 外部 URL or ハッシュなし内部リンク）なら `preventDefault()` + モーダル表示。「離れる」で `window.location.href = anchor.href` |
| `beforeunload` | **未登録**（§11-2） | ブラウザ再読み込み・タブ閉じでの警告は発火しない |

履歴スタックフック: `DOMContentLoaded` の末尾で `history.pushState(null, '', location.href)`（[survey-answer.js:192](../../../02_dashboard/src/survey-answer.js#L192)）を 1 回実行し、戻るボタン 1 回目で `popstate` を発火させる。

### 5.10 プレビュー/本番モード分岐 [**MVP**]

| 項目 | プレビュー (`?preview=1`) | 本番 |
|------|---------------------------|------|
| データソース | `localStorage.surveyPreviewData` | `fetch(data/surveys/{surveyId}.json)` |
| `state.surveyId` | `'__preview__'`（`surveyId` パラメータが無い場合のフォールバック） | クエリ指定値 |
| ドラフト検査 | **実行しない**（`checkForDraft()` 呼ばれない） | 実行 |
| 自動保存タイマー | **起動しない**（`startAutoSaveTimer()` 呼ばれない） | 起動 |
| 名刺撮影ボタン | 押下でトースト「プレビューのため、この機能は使用できません」 | `startBizcardUploadFlow()` |
| 手入力ボタン | 同上 | 手入力モーダル |
| 送信ボタン | 押下 OK、`simulateUpload()` 実行後 `document.write()` で完了画面をインライン描画 | 実保存 + サンクス画面遷移 |
| 離脱警告 | **セットアップしない** | セットアップ |
| 履歴 pushState | **しない** | する |

分岐点は `DOMContentLoaded` 内の `if (state.isPreviewMode) { ... } else { ... }`（[survey-answer.js:170-193](../../../02_dashboard/src/survey-answer.js#L170)）および `setupEventListeners()` 内の `isPreview` チェック（同:348-358）。

### 5.11 完了時の動線 [**MVP**]

送信成功後の遷移は §5.7 step 9〜10 参照。

- **本番**: `thankYouScreenSettings.url || 'thankYouScreen.html'` に `?surveyId={id}&answerLocale={locale}[&continuous=true]` を付与して `window.location.href` 遷移。
- **プレビュー**: `document.write()` で現在ページを置換。ブラウザの戻るでアンケート画面には戻れない（document 全置換のため）。
- **送信失敗**: `#error-container` にエラー文言を表示（`displayError()` 呼出でフォーム非表示）。送信ボタンが非表示領域にあるわけではないが、フォームが消えるため再送信導線は実質見えない。§11-20。

### 5.12 動的カラー更新 [**Nice**]

`updateDynamicColors(backgroundColor)`（[survey-answer.js:2218-2244](../../../02_dashboard/src/survey-answer.js#L2218)）:
- `adjustColor(backgroundColor, 40)` で RGB 各チャネルを 40 減じた色を `.is-required` の `borderLeftColor` に適用。
- `<style id="dynamic-styles">` を動的注入し、`.survey-question-card:focus-within` に border-color / translateY / box-shadow（`rgba(r,g,b,0.25)`）を当てる。
- 初期値は `'#FFFFFF'` 固定渡し（[survey-answer.js:1254](../../../02_dashboard/src/survey-answer.js#L1254)）。**本来は背景色を動的に渡す設計だったと推測されるが、実装上は白固定**（§11-21）。

---

## 6. データモデル

### 6.1 `state` オブジェクト構造

§5.1 参照。主要フィールド:

| キー | 型 | 意味 | 備考 |
|------|----|------|------|
| `surveyId` | `string \| null` | URL `?surveyId` 値 | プレビュー時は `'__preview__'` |
| `surveyData` | `object \| null` | 正規化済みアンケート定義 | §6.2 |
| `answers` | `object` | `{questionId: value \| value[]}` + 特殊キー `bizcardImages` / `manualBizcardInfo` | §6.3 |
| `sessionId` | `string` | `session_{Date.now()}` | ドラフトキー生成に使用 |
| `currentLanguage` | `string` | 正規化済みロケール | `ja` / `en` / `zh-CN` / `zh-TW` / `vi` |
| `hasUnsavedChanges` | `boolean` | 離脱警告 + 自動保存のスキップ判定 | `save` 成功で false 戻し |
| `isSubmitting` | `boolean` | 送信中二重押下防止 | |
| `isPreviewMode` | `boolean` | プレビュー分岐 | 動的付与 |
| `draftToRestore` | `boolean` | ドラフト復元済みフラグ | 動的付与、`populateFormWithDraft()` の実行ガード |

### 6.2 `surveyData` スキーマ

`normalizeQuestion()` 後の形式（[survey-answer.js:244-254](../../../02_dashboard/src/survey-answer.js#L244)）:

```json
{
  "id": "sv_xxx",
  "displayTitle": "...",              // string | {ja: "...", en: "..."} （多言語テキストオブジェクト）
  "description": "...",
  "plan": "premium",                  // 連続回答フラグ判定に使用 (§5.7)
  "defaultAnswerLocale": "ja",        // 初期表示ロケール
  "editorLanguage": "ja",             // defaultAnswerLocale 無いときのフォールバック
  "settings": {
    "supportedLocales": ["ja", "en"]  // §5.6.1 抽出元
  },
  "activeLanguages": ["ja"],          // 同上
  "languages": ["ja"],                // 同上 (legacy)
  "thankYouScreenSettings": {         // または settings.thankYouScreen
    "url": "thankYouScreen.html",
    "thankYouMessage": "..."          // string | 多言語オブジェクト
  },
  "questions": [
    {
      "id": "q1",
      "type": "single_answer",        // 正規化後
      "text": "...",                  // string | 多言語オブジェクト
      "required": false,
      "options": [{"text": "...", "value": "..."}, ...],  // 正規化後
      "columns": [{"text": "..."}, ...],                  // matrix のみ
      "rows": [{"id": "r1", "text": "..."}, ...],         // matrix のみ
      "min": 0, "max": 100, "step": 1,                    // number_answer
      "meta": {
        "validation": {
          "text": {"minLength": 10, "maxLength": 200}
        },
        "maxSelections": 3,                               // multi_answer
        "dateTimeConfig": {"inputMode": "date"},          // date_time
        "ratingScaleConfig": {
          "points": 5,
          "minLabel": "...",
          "midLabel": "...",
          "maxLabel": "...",
          "showMidLabel": true
        },
        "handwritingConfig": {"canvasHeight": 300}        // handwriting_space
      }
    }
  ]
}
```

`questions` が無い場合 `details` を代替に使う（`state.surveyData.details`、[survey-answer.js:303](../../../02_dashboard/src/survey-answer.js#L303)）。

### 6.3 `state.answers` 構造

| キー | 値の型 | 生成箇所 |
|------|--------|----------|
| `{questionId}` | string（radio / text / number / dropdown / date_time） | fieldset の change リスナ |
| `{questionId}` | string[]（multi_answer） | 同上、`entries.length > 1` |
| `{questionId}` | `data:image/png;base64,...`（handwriting_space） | `saveState()` |
| `{questionId}` | `data:image/*;base64,...`（image_upload） | `FileReader.onload` |
| `bizcardImages` | `{front: dataURL, back: dataURL \| null} \| null` | `showFinalConfirmation()` onSave |
| `manualBizcardInfo` | `{lastName, firstName, name, email, company, department, title, phone, postalCode, address, building}` | 手入力確認モーダル onSave |

**マトリクス設問は `state.answers` に集約されない**（FormData が `{questionId}-{rowId}` の name 空間を拾えないため、§11-13）。送信ペイロードには `state.answers` がそのまま `answers` フィールドとして載るため、マトリクスの回答は実質的に欠落する。

### 6.4 送信ペイロード

`handleSubmit()` step 4 参照。`localStorage.setItem` 先のキー `survey_response_{surveyId}_{timestamp}` の値:

```json
{
  "surveyId": "sv_xxx",
  "submittedAt": "2026-04-24T09:00:00.000Z",
  "answerLocale": "ja",
  "answers": {
    "q1": "option_a",
    "q2": ["opt_x", "opt_y"],
    "q3": "2026-05-01T10:00",
    "bizcardImages": {"front": "data:image/...", "back": null},
    "manualBizcardInfo": {"lastName": "山田", ...}
  }
}
```

### 6.5 `localStorage` / `sessionStorage` キー一覧

| キー | 種別 | 書込 | 読込 | 削除 |
|------|------|------|------|------|
| `surveyPreviewData` | localStorage | （アンケート作成画面側で書込） | `loadSurveyData()` プレビューモード時 | 対象外 |
| `survey_draft_{surveyId}_{sessionId}` | localStorage | `saveDraft()` 30 秒毎 | `checkForDraft()` ページロード時 | 送信完了時 / ドラフト破棄時 |
| `survey_response_{surveyId}_{timestamp}` | localStorage | `handleSubmit()` 送信時 | （なし、送信後読まれない） | （なし、自動削除されない、§11-22） |
| `sessionStorage` | — | 本画面では未使用 | — | — |

---

## 7. バリデーション・エラー表示

### 7.1 項目別バリデーション表

| 項目 | 条件 | 違反時 | 実装位置 |
|------|------|--------|----------|
| 必須設問（`required: true`） | `state.answers[qid]` が非空 | fieldset に `.border-error.border-2`、送信時は `showToast(common.required)` | [survey-answer.js:1970-1981](../../../02_dashboard/src/survey-answer.js#L1970) |
| `free_answer` 文字数 | `min <= len <= max` | 警告 `<div>` にメッセージ表示のみ、送信ブロックなし | [survey-answer.js:1341-1357](../../../02_dashboard/src/survey-answer.js#L1341) |
| `number_answer` 範囲 | `min <= value <= max` | HTML5 標準の範囲外警告のみ、JS 検証なし | [survey-answer.js:1403](../../../02_dashboard/src/survey-answer.js#L1403) |
| `multi_answer` 上限 | `checked.length <= maxSelections` | 未選択項目を DOM レベルで `disabled`、トースト無し | [survey-answer.js:1387-1400](../../../02_dashboard/src/survey-answer.js#L1387) |
| `multi_answer` 最小件数 | 未検証 | — | §11-11 |
| `email` 形式 | 未検証 | — | §11-17 |
| `matrix_*` 行単位充填 | 未検証（state にも取り込まれない） | — | §11-13 |
| `image_upload` サイズ・形式 | 未検証 | — | §11-23 |
| 名刺必須/任意 | 未検証 | — | §11-4 |

### 7.2 エラー表示仕様

- **必須未入力**: fieldset に `.border-error.border-2`。`.border-error` の色定義は Tailwind カスタムカラー（`service-top-style.css` で定義される想定）。
- **送信バリデーション失敗**: `showToast(t('common.required'))`（日本語「必須項目を入力してください。」）、3 秒で自動非表示。
- **致命エラー（JSON 取得失敗等）**: `displayError(message)` で `#error-container` に表示、`#survey-form` を `hidden`。
- **送信失敗**: 同上（ただし現行は擬似プログレスで到達不可）。
- **フォーカス自動移動・スクロール**: **未実装**（§11-24）。

### 7.3 トースト通知

| 発生タイミング | メッセージ | 実装 |
|---------------|-----------|------|
| 必須未入力での送信 | `t('common.required')`（「必須項目を入力してください。」） | [survey-answer.js:2002](../../../02_dashboard/src/survey-answer.js#L2002) |
| ドラフト復元成功 | 「下書きを復元しました。」 | [survey-answer.js:1178](../../../02_dashboard/src/survey-answer.js#L1178) |
| 名刺画像保存 | 「名刺画像を保存しました。」 | [survey-answer.js:925](../../../02_dashboard/src/survey-answer.js#L925) |
| 名刺片面更新 | 「{面}画像を更新しました。」 | [survey-answer.js:720, 865](../../../02_dashboard/src/survey-answer.js#L720) |
| 名刺片面削除 | 「{面}の画像を削除しました。」 | [survey-answer.js:595, 1055](../../../02_dashboard/src/survey-answer.js#L595) |
| 名刺全削除 | 「名刺画像をすべて削除しました。」 | [survey-answer.js:1049](../../../02_dashboard/src/survey-answer.js#L1049) |
| 名刺削除対象なし | 「削除する画像がありません。」 | [survey-answer.js:1039](../../../02_dashboard/src/survey-answer.js#L1039) |
| 手入力保存 | 「名刺情報を保存しました。」 | [survey-answer.js:447](../../../02_dashboard/src/survey-answer.js#L447) |
| 言語切替 | `t('surveyAnswer.switchedLocale', { locale })`（「{lang}に切り替えました」） | [survey-answer.js:1938](../../../02_dashboard/src/survey-answer.js#L1938) |
| プレビューで名刺/手入力押下 | 「プレビューのため、この機能は使用できません」 | [survey-answer.js:176, 179, 351, 358](../../../02_dashboard/src/survey-answer.js#L176) |

`showToast(message)`（[survey-answer.js:2100-2113](../../../02_dashboard/src/survey-answer.js#L2100)）は単一引数のみ。種別による色・表示時間の切替は未実装。連続呼出時はタイマーをクリアせず新規 `setTimeout` を起動するため、後続が先行を早期に隠す可能性あり（§11-25）。

---

## 8. プレビュー/本番モード分岐

§5.10 参照。追加補足:

- **プレビュー起動元**: アンケート作成画面（`01_survey_creation_requirements`）が `localStorage.setItem('surveyPreviewData', JSON.stringify(surveyDefinition))` した後に `window.open('survey-answer.html?preview=1', ...)` を叩く想定（本書対象外）。
- **プレビュー完了画面**: `handleSubmit()` 内で `document.open() / document.write(...) / document.close()` によって現在 HTML ごと置換される。Tailwind CDN を含む独立した HTML を書き出し、`bg-blue-50` + 成功アイコン + 「※ プレビューモードのため回答データは送信されていません」の固定メッセージを表示。
- **プレビュー時のドラフト保存**: `startAutoSaveTimer()` が呼ばれないため `saveDraft()` は走らない。プレビュー中の入力は保存されない。
- **プレビュー時の送信**: `localStorage.setItem('survey_response_...')` は **実行される**（`handleSubmit()` step 6 がプレビュー分岐の前に位置するため）。意図としてはプレビューで `localStorage` を汚さない方が望ましいが、現行実装では残る（§11-26）。

---

## 9. 非機能要件

### 9.1 パフォーマンス [**Should**]

- 設問数 50 問想定での初期レンダリング: `createQuestionElement()` は同期処理、`<canvas>` 初期化のみ `setTimeout(..., 0)` で非同期化。目安として µs〜数 ms オーダー。
- 自動保存: 30 秒間隔、`state.hasUnsavedChanges` が false なら即 return するためアイドル時はほぼ無負荷。
- 画像の base64 化: `FileReader.readAsDataURL()` は画像サイズに比例（数 MB の写真で数百 ms）。メインスレッドをブロックせず `onload` コールバック。
- 計測ロジック（`performance.mark` / Long Task Observer 等）は未実装。§11-27

### 9.2 アクセシビリティ [**Should**]

**対応済み**:
- `<label for>` と `<input id>` の紐付け（single_answer / multi_answer / rating_scale）
- `<input type="date">` / `<input type="time">` に `aria-label="Date" / "Time"`（[survey-answer.js:1411, 1416](../../../02_dashboard/src/survey-answer.js#L1411)）
- キーボード操作（Tab / Shift+Tab / Enter / Space）は `<input>` / `<button>` / `<select>` が標準サポート
- セマンティック HTML: `<form>` / `<fieldset>` / `<label>` / `<button type="button">`

**未対応**（§11-28）:
- `aria-required` / `aria-live` / `aria-invalid` の体系的付与
- モーダル内のフォーカストラップ
- `#bizcard-preview-back-empty`（div クリック領域）のキーボードアクセシビリティ（`role="button"` / `tabindex` / キーハンドラ）
- `#loading-indicator` に `role="status"` / `aria-live="polite"`
- `#error-container` に `role="alert"`
- 色コントラスト比の WCAG AA 検証
- スクリーンリーダー検証（NVDA / VoiceOver / TalkBack）
- `prefers-reduced-motion` の個別考慮（`.header-unpinned` の transition、送信モーダルのプログレスバー transition、`rating_scale` の scale transition 等）

### 9.3 対応ブラウザ

- 最新 2 バージョンの Chrome / Firefox / Safari / Edge（モバイル含む）。
- `<canvas>` の DPI スケーリング、`FileReader`、`localStorage` / `sessionStorage`、`fetch`、`URLSearchParams`、`history.pushState` / `popstate` がすべて前提。
- iOS Safari の `overscroll-behavior: contain` 対応は不完全で、Pull-to-Refresh を完全には抑止できない場合あり（§4.10 相当）。

### 9.4 セキュリティ

- **回答データ・手入力の個人情報は `localStorage` に平文保存**。モックアップの暫定措置であり、本番運用前に廃止必須。§11-29
- 名刺画像・手書き画像・アップロード画像は base64 データ URL として `state.answers` に保持し、ドラフトには画像系のうち `bizcardImages` のみ除外（`handwriting_space` / `image_upload` の画像は **ドラフトに含まれる**）。容量超過時の挙動は未制御。§11-30
- XSS: `resolveSurveyText(value)` の返り値を `innerHTML` に差し込む箇所が複数（タイトル・設問文・選択肢・マトリクス行列ラベル）。アンケート定義 JSON の供給元が信頼可能である前提に依存。§11-31
- HTTPS / 保管時暗号化等は実サーバ連携時の要件。本画面スコープ外。

### 9.5 モバイル固有動作

- `disablePullToRefresh()` で `document.body.style.overscrollBehaviorY = 'contain'`（[survey-answer.js:2184-2186](../../../02_dashboard/src/survey-answer.js#L2184)）。
- `<canvas>` の `touch-action` は初期 `'auto'`、ペンモード ON で `'none'`（描画時のスクロール抑止）。
- 名刺撮影の `capture="environment"` は iOS / Android の背面カメラ起動用。ブラウザサポート範囲に依存。

---

## 10. Definition of Done

リリース判定権限者: プロダクトオーナー（TBD）。

**機能要件**:
- [ ] §5.1 `?preview=1` / `?surveyId=xxx` / `?answerLocale=en` の 3 パラメータが期待通り分岐する
- [ ] §5.2 全 12 設問タイプ（`default` 含む）が設問定義に応じてレンダリングされる
- [ ] §5.2.10 `handwriting_space` が DPI スケーリング込みで動作、undo / redo / クリアが期待通り
- [ ] §5.3 `required: true` 設問の空回答で送信がブロックされる
- [ ] §5.4.1 名刺撮影フロー（表面→裏面→最終確認）で `state.answers.bizcardImages` が格納される
- [ ] §5.4.2 手入力の 2 段階保存が動作する
- [ ] §5.6 多言語切替で設問文 / 選択肢ラベル / UI ラベルがすべて切り替わる
- [ ] §5.6.2 単一言語アンケートで `#language-switcher-container` が非表示になる
- [ ] §5.7 送信成功で `localStorage.survey_response_{id}_{ts}` に保存、ドラフト削除、`thankYouScreen.html?...` 遷移
- [ ] §5.7 `plan === 'premium'` の場合のみ `continuous=true` が付与される
- [ ] §5.8 30 秒自動保存と `#draft-restore-modal` 復元が動作する
- [ ] §5.9 ブラウザバック・外部リンクで離脱確認モーダルが出る
- [ ] §5.10 プレビュー時は `document.write()` で完了画面が出る
- [ ] §5.11 サンクス画面遷移先 URL に `surveyId` / `answerLocale` が付与される

**非機能要件**:
- [ ] §9.2 キーボードのみで全設問に回答し送信できる
- [ ] §9.3 PC Chrome / iOS Safari / Android Chrome で崩れなし
- [ ] §9.5 Pull-to-Refresh が抑止される（iOS Safari 限定的挙動は除外）

**受入シナリオ**:

| # | 手順 | 期待結果 |
|---|------|---------|
| A1 | `?surveyId=sv_xxx` で遷移 | アンケート定義通りに全設問が描画される、タイトル・説明が表示される |
| A2 | `?preview=1` でアクセス（`localStorage.surveyPreviewData` あり） | 設問が描画され、名刺ボタンはトースト警告、送信でインライン完了画面 |
| A3 | `?preview=1` でアクセス（データなし） | エラー「プレビューデータが見つかりません。」が `#error-container` に表示 |
| A4 | 必須設問を空のまま送信ボタン押下 | トースト「必須項目を入力してください。」、該当 fieldset が赤枠、送信されず |
| A5 | `rating_scale` で中央ラジオを選択 | 円が青く塗られ、数字の下の中間ラベルが表示される |
| A6 | `multi_answer`（`maxSelections: 3`）で 3 個選択 | 未選択の残りが `disabled` になる |
| A7 | `handwriting_space` でペン → 消しゴム → undo → redo | それぞれ期待通り動作、canvas の `toDataURL()` が `state.answers[qid]` に格納 |
| A8 | 30 秒放置後、ブラウザバック | `#leave-confirm-modal` 表示、「留まる」で現在ページ維持 |
| A9 | 別タブで同じアンケートを開く | `sessionId` が別値なのでドラフトは独立、互いに干渉しない |
| A10 | `plan === 'premium'` のアンケートを送信完了 | `thankYouScreen.html?surveyId=xxx&answerLocale=ja&continuous=true` へ遷移 |
| A11 | 言語切替で `en` 選択 | 設問文・選択肢・UI ラベルが英語化、入力済み値は保持 |

---

## 11. 将来計画（Phase 2 以降）

本画面の実装ギャップ 31 件。番号が小さいほど優先度が高い。

1. **実送信 API 未実装（最重要）**: `simulateUpload()` は 200ms 周期の擬似プログレスで常に成功。`handleSubmit()` の `catch` 節はデッドパス。実サーバ連携時は POST エンドポイント定義、認証ヘッダ、レスポンス形式、リトライ、指数バックオフを別途設計する必要がある。

2. **`beforeunload` 警告未登録**: `setupLeaveConfirmation()` は `popstate` と `click` のみフックし、`beforeunload` は未登録。ブラウザ再読み込み・タブ閉じでの警告が発火しない（[survey-answer.js:2135](../../../02_dashboard/src/survey-answer.js#L2135)）。`hasUnsavedChanges === true` 時のみ `e.preventDefault() + e.returnValue = ''` を付ければ解消。

3. **OCR 言語判別未実装**: `showFrontPreview()` 内に「OCR言語: 日本語 (ダミー)」固定文字列のみ（[survey-answer.js:743](../../../02_dashboard/src/survey-answer.js#L743)）。OCR エンジン選定、精度目標、対応言語、フォールバック規則（現表示言語を既定とする）すべて別途要件定義が必要。

4. **名刺必須/任意の送信前確認未実装**: アンケート設定に名刺必須フラグがあっても、`handleSubmit()` は `state.answers.bizcardImages` を参照しない。送信前に未添付確認モーダルを出す仕様は作成側の設定項目と合わせて別途実装。

5. **連続回答の `allowContinuousAnswer` 不参照**: `state.surveyData.plan === 'premium'` 単独判定で `continuous=true` を付与（[survey-answer.js:2062](../../../02_dashboard/src/survey-answer.js#L2062)）。アンケート作成画面の `allowContinuousAnswer` 設定（`17_thank_you_email_settings_requirements` / 旧 `08_thank_you_screen_settings`）は参照していない。

6. **死スタイル `.header-unpinned`**: `survey-answer.html:46-49` に定義されているが、対応する要素の ID `#survey-page-header` が HTML に存在せず、`setupHeaderScrollBehavior()` は `// Header has been removed.` の空実装（[survey-answer.js:2131-2133](../../../02_dashboard/src/survey-answer.js#L2131)）。CSS とコメントアウトされた呼出し（同:190）も含めて削除候補。

7. **死参照 `#survey-page-header` / `#survey-header-text`**: `DOMElements.header` / `headerText` に `getElementById` で拾うが HTML に該当 ID 無し。常に `null`。`renderHeader()` はコメントアウト済みコード（[survey-answer.js:1259](../../../02_dashboard/src/survey-answer.js#L1259)）で触らないため実害はないが、`DOMElements` 定義そのものが誤解を招く。

8. **`setupPremiumFeatures()` の関数名**: 実体は言語切替 UI の初期化のみで「プレミアム機能」と無関係（[survey-answer.js:1885](../../../02_dashboard/src/survey-answer.js#L1885)）。過去に多言語を premium 限定にしていた名残。`setupLanguageSwitcher()` 等にリネーム推奨。

9. **`state.draftExists` 未使用**: 初期値 false だが、代わりに `state.draftToRestore` が `checkForDraft()` で立てられる（[survey-answer.js:19, 1177](../../../02_dashboard/src/survey-answer.js#L19)）。`draftExists` はどこからも読まれない死フィールド。

10. **`state.idleTimer` / `isIdle` 未使用**: 初期値のみ定義され、`clearTimeout` / `setTimeout` の登録箇所は存在しない（[survey-answer.js:22-23](../../../02_dashboard/src/survey-answer.js#L22)）。アイドル検知機能の残骸と推測。

11. **送信時バリデーションが `required` のみ**: `minLength` / `maxLength` / `min` / `max` / `maxSelections`（最小件数）/ メール形式 / 画像サイズ / 画像形式はすべて送信ブロックにならない（§7.1 参照）。

12. **`dropdown` のプレースホルダオプション未生成**: 先頭に空 `<option>` が無いため、ブラウザは最初の選択肢を初期値として扱う。必須判定が初期値ありと見なされ、未選択でも通過する可能性（[survey-answer.js:1426-1432](../../../02_dashboard/src/survey-answer.js#L1426)）。

13. **マトリクス設問の回答が `state.answers` に集約されない**: `fieldset` の change リスナは `FormData.getAll(questionId)` で値を集めるが、マトリクスは `{questionId}-{rowId}` / `{rowId}-{colId}` の name 空間に分散しており、`questionId` 単独で getAll しても 0 件返る（[survey-answer.js:1864-1873](../../../02_dashboard/src/survey-answer.js#L1864)）。送信ペイロード `finalAnswers.answers` から欠落する重大なバグ。

14. **`rating_scale` の `rsMidIndex` 未使用**: 中間インデックスを計算するが参照されていない（[survey-answer.js:1464](../../../02_dashboard/src/survey-answer.js#L1464)）。中間ラベルはラジオ群の下に中央配置され、特定ラジオ位置に紐づかない実装。

15. **`explanation_card` の `required` 扱い**: 説明カードに `required: true` を設定すると `validateField()` は `state.answers[qid]` を見に行くが、説明カードは回答を生成しないため常に失敗扱いになる（[survey-answer.js:1557-1560](../../../02_dashboard/src/survey-answer.js#L1557)）。設問タイプ側で `required` 無効化すべき。

16. **`t('survey.tapToCapture')` 未定義 i18n キー**: `image_upload` のアップロードカードで参照されるが `messages.js` に存在しない（[survey-answer.js:1818](../../../02_dashboard/src/survey-answer.js#L1818)）。`|| '写真を撮影またはファイルを選択'` のフォールバックで動作するが、正しくは `surveyAnswer.imageUploadPrompt` 等として定義し直すべき。

17. **手入力メールの形式バリデーション無し**: `<input type="email">` は click ハンドラ経由保存のため HTML5 検証未発火。JS 側の形式チェックも無し（[survey-answer.js:373-374, 444-446](../../../02_dashboard/src/survey-answer.js#L373)）。RFC 5322 準拠簡易チェックの追加候補。

18. **サンクス画面 URL の既存クエリマージ未対応**: `thankYouSettings.url` に `?foo=bar` が含まれる場合、`+= '?surveyId=...'` でクエリが壊れる（[survey-answer.js:2059-2064](../../../02_dashboard/src/survey-answer.js#L2059)）。`URL.searchParams.append()` への書き換えで解消可能。

19. **ドラフトに手書き・アップロード画像が含まれる**: 除外対象は `bizcardImages` のみで、`handwriting_space` / `image_upload` の base64 画像は localStorage に書かれる（[survey-answer.js:1954-1956](../../../02_dashboard/src/survey-answer.js#L1954)）。ストレージ容量超過リスクあり。

20. **送信失敗時のリトライ導線なし**: `displayError()` でフォームが非表示になり、ユーザが取れるのはブラウザリロードのみ。トースト通知 + 再送信ボタンの刷新候補（§5.11）。

21. **`updateDynamicColors('#FFFFFF')` の固定引数**: 背景色を動的に受け取る設計だが白固定で呼ばれる（[survey-answer.js:1254](../../../02_dashboard/src/survey-answer.js#L1254)）。アンケート定義の `themeColor` 等から渡す拡張余地あり。

22. **送信済み `survey_response_*` の自動削除なし**: `handleSubmit()` で書き込むが削除ロジックが無い。ブラウザの localStorage が増え続ける。送信後に遷移するため実害は低いが、同一端末で大量回答すると容量圧迫。

23. **`image_upload` のサイズ・形式バリデーション無し**: `accept="image/*"` のみで、実ファイルサイズ・MIME チェックは無し。

24. **必須未入力時のフォーカス自動移動・スクロールなし**: `showToast` のみで、どの設問がエラーかはユーザが目視で探す必要あり。

25. **`showToast` の連続呼出時タイマー未クリア**: `setTimeout` が並走し、後続が先行を早期に隠す可能性（[survey-answer.js:2110](../../../02_dashboard/src/survey-answer.js#L2110)）。

26. **プレビュー時も `localStorage.survey_response_*` が書かれる**: プレビュー分岐が `localStorage.setItem()` の後に位置するため（[survey-answer.js:2023-2056](../../../02_dashboard/src/survey-answer.js#L2023)）。プレビュー時はスキップすべき。

27. **パフォーマンス計測ロジック未実装**: §9.1 の目標値検証のための `performance.mark` / Long Task Observer 等が不在。

28. **WCAG 2.1 AA 準拠未検証**: `aria-required` / `aria-live` / `aria-invalid` / フォーカストラップ / カラーコントラスト / div クリック領域のキーボード対応、いずれも未実装（§9.2）。

29. **`localStorage` 上の PII 平文保存**: 手入力の氏名 / メール / 電話 / 住所等。本番運用前に `sessionStorage` または JS メモリ状態へ置換必須。

30. **画像系ドラフトの容量超過対策なし**: `handwriting_space` / `image_upload` の base64 をそのまま `localStorage` に書く。容量超過時の `setItem` 例外を catch していない。

31. **アンケート定義 JSON の XSS 信頼境界**: `resolveSurveyText()` の返り値を `innerHTML` に差し込む複数箇所（タイトル・設問文・選択肢・マトリクスラベル）。アンケート定義がユーザー生成コンテンツを含む場合、サニタイズ層が必要。

---

## 12. 用語集

| 用語 | 説明 |
|------|------|
| プレビューモード | `?preview=1` 付き URL。`localStorage.surveyPreviewData` を入力源にし、実送信なしでインライン完了画面を表示する |
| 本番モード | `?surveyId=xxx` 付き URL。`data/surveys/{surveyId}.json` を fetch して回答、送信後サンクス画面遷移 |
| セッション ID | `session_{Date.now()}`。タブ単位で独立。ドラフトキーの一部 |
| ドラフト | 30 秒間隔の自動保存データ。画像系の `bizcardImages` のみ除外 |
| `state.answers` | `{questionId: value \| value[]}` + 特殊キー `bizcardImages` / `manualBizcardInfo` |
| `state.hasUnsavedChanges` | 自動保存スキップと離脱警告の両方で使う「変更あり」フラグ |
| 連続回答 (`continuous=true`) | サンクス画面で「続けて回答する」導線を有効化するクエリ。`plan === 'premium'` 単独判定 |
| `normalizeQuestionType()` | `rawType` を 11 種の正規化キー（+ `rating_scale` は passthrough）にマップ |
| `resolveSurveyText()` | アンケート定義内の多言語テキストオブジェクトを現在ロケール向けに解決 |
| `t()` | 静的 UI ラベル用の翻訳関数。`formatMessage` に委譲 |
| `inferAvailableLanguages()` | `getSurveyAvailableLocales()` の返り値をそのまま返すラッパ（現行実装で挙動は完全一致） |
| 多言語テキストオブジェクト | `{ja: "...", en: "...", ...}` 形式。`LANGUAGE_LABELS` に存在するロケールキーを持つ |
| `handwriting_space` | 手書きキャンバス設問。DPR 対応、undo / redo 付き、base64 データ URL で保存 |
| 死スタイル | CSS に定義されているが対応する DOM 要素が存在しないため適用されないスタイル |

---

## 13. 関連ファイル・デッドコード棚卸し

**メインファイル**:
- `02_dashboard/survey-answer.html`（167 行）
- `02_dashboard/src/survey-answer.js`（2,244 行、`DOMContentLoaded` 起点、export なし）

**共通ユーティリティ**:
- `02_dashboard/src/utils.js`（`resolveDashboardDataPath()`）
- `02_dashboard/src/services/i18n/messages.js`（418 行、`LANGUAGE_LABELS` 5 種 + `messages.{ja,en,zh-CN,zh-TW,vi}.*` 翻訳辞書）
- `02_dashboard/service-top-style.css`（共通スタイル、`.border-error` / `.text-error` / `.bg-primary` 等のカスタムカラー定義源）
- `02_dashboard/src/toolbox.css`（`.handwriting-container` / `.toolbox` / `.tool-button` / `.color-palette` / `.thickness-slider` 等）

**流入元**:
- アンケート配信 URL / QR コード（実運用）: `survey-answer.html?surveyId=xxx[&answerLocale=ja]`
- アンケート作成画面のプレビュー: `survey-answer.html?preview=1`（`localStorage.surveyPreviewData` を事前セット）

**離脱先**:
- 送信成功（本番）: `thankYouSettings.url || 'thankYouScreen.html'` + `?surveyId={id}&answerLocale={locale}[&continuous=true]`
- 送信成功（プレビュー）: `document.write()` で現在ページを置換
- 離脱確認モーダル「離れる」: `history.back()` または `anchor.href`

**`DOMElements` キャッシュ内容**（[survey-answer.js:31-58](../../../02_dashboard/src/survey-answer.js#L31)）:

| プロパティ | ID / セレクタ | 状態 |
|-----------|--------------|------|
| `loadingIndicator` | `#loading-indicator` | 生存 |
| `header` | `#survey-page-header` | **死参照**（§11-7） |
| `headerText` | `#survey-header-text` | **死参照**（§11-7） |
| `languageSelect` | `#language-select` | 生存 |
| `mainContent` | `#main-content` | 生存（参照箇所は少ない） |
| `errorContainer` | `#error-container` | 生存 |
| `surveyForm` | `#survey-form` | 生存 |
| `bizcardManualButton` | `#bizcard-manual-button` | 生存 |
| `bizcardCameraButton` | `#bizcard-camera-button` | 生存 |
| `submitSurveyButton` | `#submit-survey-button` | 生存 |
| `bizcardUploadModal` | `#bizcard-upload-modal` | 生存 |
| `manualInputModal` | `#manual-input-modal` | 生存 |
| `leaveConfirmModal` | `#leave-confirm-modal` | 生存 |
| `draftRestoreModal` | `#draft-restore-modal` | 生存 |
| `toastNotification` | `#toast-notification` | 生存 |
| `toastMessage` | `#toast-message` | 生存 |
| `submittingModal` | `#submitting-modal` | 生存 |
| `submittingProgressBar` | `#submitting-progress-bar` | 生存 |
| `submittingPercentage` | `#submitting-percentage` | 生存 |
| `submittingText` | `#submitting-text` | 生存 |
| `surveyMainWrapper` | `#survey-main-wrapper` | 生存（「カラーピッカーテスト機能用」コメント、参照箇所は無し） |
| `footer` | `<footer>` | 生存（参照箇所は無し） |

**死コード・休眠 ID 一覧**:

| 対象 | 状態 | §11 参照 |
|------|------|----------|
| `.header-unpinned` CSS | 対応 DOM 無し | 11-6 |
| `#survey-page-header` / `#survey-header-text` | `DOMElements` に取り込むが HTML 無し | 11-7 |
| `setupHeaderScrollBehavior()` | 空実装、コメントアウトされた呼出しが残存 | 11-6 |
| `state.draftExists` | どこからも読まれない | 11-9 |
| `state.idleTimer` / `state.isIdle` | 初期値のみ、参照なし | 11-10 |
| `DOMElements.mainContent` / `surveyMainWrapper` / `footer` | キャッシュするが未参照 | — |
| `DOMElements.header` / `headerText` | 常に null | 11-7 |
| `renderHeader()` 内の innerHTML 代入 | コメントアウト済み（`document.title` 設定のみ残る） | 11-7 関連 |
| `t('survey.tapToCapture')` | i18n 辞書に未定義キー | 11-16 |
| `rating_scale.rsMidIndex` | 計算するが未参照 | 11-14 |
| プレビュー時の `localStorage.setItem('survey_response_...')` | プレビュー分岐より前で実行される | 11-26 |
| `setupLeaveConfirmation()` 関数冒頭のコメント2行空白 | 削除しても無影響 | — |
| `inferAvailableLanguages()` 単純ラッパ | `getSurveyAvailableLocales()` と挙動完全一致、統合候補 | — |

**`state` 動的プロパティ**（初期オブジェクトに無いが実行中に付与される）:
- `state.isPreviewMode`（`initializeParams()` 付与）
- `state.draftToRestore`（`checkForDraft()` onSave で付与）

---

## 14. 関連仕様書との関係

- **`01_survey_creation_requirements`（アンケート作成画面）**: 本画面の入力となる設問定義 JSON を生成する。設問タイプ別の `meta` 構造（`ratingScaleConfig` / `dateTimeConfig` / `handwritingConfig` / `validation.text.minLength` 等）は作成画面の責務。本書 §5.2 の各タイプはこの作成画面の出力を受けて描画する。作成画面側が `?preview=1` 付きで本画面を開く経路も規定。
- **`16_bizcard_settings_requirements`（名刺データ化設定画面）**: 本画面の「名刺撮影ボタン」「手入力ボタン」で取得した画像・情報を、管理者側の名刺データ化依頼対象として扱う。本画面は取得のみを担当し、データ化プラン・料金・OCR は対象外。
- **`17_thank_you_email_settings_requirements` / 旧 `08_thank_you_screen_settings`（サンクス画面・お礼メール設定）**: 送信後の遷移先 `thankYouScreenSettings.url` とサンクスメッセージ `thankYouMessage` の定義元。本書 §5.7 / §5.11 の遷移先解決がこの設定に依存する。`allowContinuousAnswer` は §11-5 で未参照として追跡中。
- **`20_thank_you_completion_screen`（回答完了画面）**: 本画面からの遷移先。`?surveyId=...&answerLocale=...&continuous=true` のクエリを受け取って連続回答導線を切り替える責務。
- **`11_plan_feature_restrictions`（プラン別機能制限）**: `rating_scale` の段階数カスタム可否、多言語対応可否、手書きスペース可否等は作成画面側でプラン制限を適用する前提。本画面は制限ロジックを持たず、受け取ったアンケート定義をそのまま描画する。齟齬が出た場合は 11 側が優先。
- **`15_help_center_requirements` / `16_bizcard_settings_requirements`**: 本書の「実装トレース型」スタイルの参照元。
- **`docs/画面設計/仕様/_archive/` 配下**: v1.x までの「本書が正、実装は参考」スタンスの名残。本書 v2.0 で参照を切り、実装変更後に本書のみ更新する運用へ切替済み。
