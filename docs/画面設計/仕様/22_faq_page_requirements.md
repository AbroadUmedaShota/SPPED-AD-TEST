---
owner: product
status: draft
last_reviewed: 2026-04-23
---

# FAQページ 要件定義書

## 1. 概要

**TL;DR**
- これは SPEED-AD ダッシュボード内の **FAQ ページ**（`02_dashboard/faq.html`）単体の要件定義書。
- 仕様の範囲は「画面構成／検索／カテゴリカード／アコーディオン／フィードバック／データ構造」までで、**フロントエンド完結のクライアントアプリ**としての挙動を定義する。
- バックエンドは `data/faq.json` の静的ファイル fetch のみ。サーバ連携・DB・認証は扱わない。

本ドキュメントは HTML / JS / CSS / JSON の現行実装を根拠に、FAQ ページ固有の仕様を単独で定義する。以前は `00_screen_requirements.md` §5.10.11 や `15_help_center_requirements.md` に埋め込まれていたが、検索・アコーディオン・フィードバックなど FAQ 固有の振る舞いを明文化するため独立させた。

## 2. 対象画面

- `02_dashboard/faq.html`（エンドユーザー向けよくある質問ページ）

## 3. 改訂履歴

- v1.0 (2026-04-23): 初版。画面側の現行実装（HTML / JS / CSS / `data/faq.json`）を根拠に単独要件として起票。

## 4. 根拠資料（現行実装）

本要件の根拠は以下の画面側実装である。実装変更時は本ドキュメントも同時更新する。

- HTML: `02_dashboard/faq.html`
- ページ専用 JS: `02_dashboard/src/faq.js`
- ページ専用 CSS: `02_dashboard/assets/css/faq.css`
- 共通 CSS（流用クラス）: `02_dashboard/src/help-center.css`（`.hc-sticky-search` / `.hc-breadcrumb-top` / `.hc-section-heading` / `.hc-category-grid` / `.hc-cta` ほか）
- 共通ユーティリティ: `02_dashboard/src/utils.js`（`resolveDashboardDataPath`, `debounce`）, `02_dashboard/src/shared/escape.js`（`escapeHtml`, `highlightText`）
- データ: `data/faq.json`

---

## 5. 画面構成

**要約**
この章は「どの HTML 要素がどこにあり、何を担当しているか」を定義する。全体像は §5.1 のツリー、個別仕様（検索バー・カード詳細など）は §5.2 以降で確認する。CSS クラス名は JS/CSS の命綱であり、変更不可。

### 5.1 ページ全体レイアウト（ツリー図）

```
<body data-page-id="faq">                           … ページ識別子
├── #header-placeholder                             … 共通ヘッダー差し込み先
├── #sidebar-placeholder                            … 共通サイドバー差し込み先
├── <main id="main-content">                        … 本体
│   ├── #faq-sticky-search.hc-sticky-search [hidden] … スクロール時に現れる縮小版検索バー (§5.3)
│   ├── .hc-breadcrumb-top > #breadcrumb-container  … パンくず（JSで注入）
│   ├── <section class="faq-hero">                  … ヒーロー（タイトル＋検索窓）(§5.2)
│   └── <div class="faq-main">                      … メインコンテナ
│       ├── #loading-indicator  [role=status]       … 読み込み中 (§6.1)
│       ├── #error-message      [role=alert]        … 読み込み失敗 (§6.1)
│       └── #faq-container      [hidden]            … 成功時の本体
│           ├── #category-cards-section             … Bento風カテゴリカード群 (§5.4)
│           │   └── #category-cards.hc-category-grid
│           ├── #search-status  [aria-live=polite]  … 検索結果件数 (§5.7)
│           ├── #faq-list-section                   … 全質問リスト (§5.5)
│           │   ├── #faq-list                       …   カテゴリ塊の集合
│           │   └── #no-results-message [hidden]    …   結果0件時 (§5.8)
│           └── .faq-cta-wrap > .hc-cta             … 解決しなかった場合のCTA (§5.9)
└── #footer-placeholder                             … 共通フッター差し込み先
```

- ルート要素は `<body class="bg-background text-on-background" data-page-id="faq">`。
- スクリプトは `src/main.js`（共通）と `src/faq.js`（ページ専用）を `type="module"` で読み込む。

### 5.2 ヒーローセクション

ページ最上部の大きな青いブロック。タイトルとメイン検索窓を置く。

- ルート: `.faq-hero`。背景は `linear-gradient(135deg, #1f3a8a 0%, #4285F4 55%, #6ba4ff 100%)` に装飾グリッド `.faq-hero__grid` とグロー `.faq-hero__glow--1/2` を重ねる。装飾レイヤー `.faq-hero__bg` は `aria-hidden="true"`（装飾のためスクリーンリーダーから隠す）。
- 中身（`.faq-hero__inner`, `max-width: 48rem`）
  - エアブロウ `.faq-hero__eyebrow`「SPEED-AD FAQ」
  - タイトル `h1#faq-hero-title.faq-hero__title`「よくある質問」
  - サブタイトル `.faq-hero__subtitle`
- 検索フォーム `<form role="search" aria-label="FAQ検索" id="faq-search-form" class="faq-search">`
  - アイコン `.faq-search__icon`（`material-icons: search`, `aria-hidden="true"`）
  - 入力欄 `input#search-box[type="search"].faq-search__input`、`name="query"`、`aria-label="質問をキーワードで検索"`、`placeholder="例：パスワード、料金プラン、名刺データ化"`、`autocomplete="off"`
  - クリアボタン `button#clear-search-btn.faq-clear-btn`（初期 `hidden`、`aria-label="検索キーワードをクリア"`、`material-icons: close`）
- 人気キーワード `#popular-keywords-wrapper.faq-keywords`（`aria-label="人気のキーワード"`）。`.keyword-chip` が JS から動的に差し込まれる。

### 5.3 スティッキー検索バー

ユーザーが下にスクロールしてヒーローが画面外に出たあと、上部に固定で現れる縮小版の検索バー。

- ルート `#faq-sticky-search.hc-sticky-search`（初期 `hidden`）。
- 表示切替ロジックは §6.6 を参照。
- 構成: `.hc-sticky-search__inner` > `<form role="search" aria-label="FAQ検索(縮小版)" id="faq-sticky-form" class="hc-sticky-search__form">` > アイコン `.hc-sticky-search__icon` ＋ 入力欄 `input#faq-sticky-search-input`（`aria-label="質問をキーワードで検索"`、`placeholder="FAQを検索..."`、`autocomplete="off"`）。
- スタイルはヘルプセンター共通の `.hc-sticky-search*` クラスに準拠。

### 5.4 カテゴリカード（Bento）

質問をテーマ別にまとめたカードのグリッド。クリックすると同ページ内の該当カテゴリセクションにハッシュジャンプする。

- コンテナ `#category-cards.hc-category-grid`（共通 CSS により、`640px` で 2 カラム、`1024px` で 3 カラム）。
- 各カード `<a class="faq-category-card" href="#cat-<id>" style="--hc-accent: <color>">`
  - `--hc-accent`（CSS カスタムプロパティ。上辺ボーダー／アイコン地色／バッジ／矢印アイコンに反映）
  - 右上: カウントバッジ `.faq-category-card__count-badge`「○件」
  - ヘッダー `.faq-category-card__header`: アイコン＋タイトル＋説明
  - プレビュー `ul.faq-category-card__questions`: 最大 3 件の注目質問（§6.4 の選定ロジック）
  - 末尾: 「すべて見る」導線 `.faq-category-card__more`
- Hover: `translateY(-4px)` と影増強、ボーダーが `--hc-accent` に変化、矢印アイコンが `translateX(3px)`。
- `:focus-visible`: `--hc-accent` 色のアウトラインを `offset: 3px` で表示（キーボード操作時にフォーカス位置がわかる必要があるため）。

### 5.5 すべての質問（FAQ 一覧）

- セクション `#faq-list-section`、見出し `.hc-section-heading`（「すべての質問」／「カテゴリごとに展開してご覧いただけます」）。
- カテゴリ単位の塊 `.faq-category-block`（`#faq-list` 直下、`space-y-10`）。
- カテゴリ見出し `.faq-category-heading`: 左端に `--hc-accent` 色の `border-left: 4px solid`、アイコン＋カテゴリ名＋`.faq-category-desc`。
- 個別 QA アイテム `.faq-item`
  - 質問行 `<button class="faq-question">`: 左に `.faq-question-label > .faq-q-mark`（Q バッジ）＋テキスト、右に `.faq-icon`（`material-icons: expand_more`）。`.faq-item.is-open` をトグル。
  - 回答 `.faq-answer`（`role="region"`）: 展開時のみ `hidden` 解除。高さは CSS 変数 `--faq-answer-height` を JS から設定し `max-height` トランジションで展開（未指定時フォールバックは `2000px`）。
  - 注目質問（`isFeatured === true`）は `.faq-item.is-featured` で `Pick` バッジを表示（質問部の `padding-right` を `4.5rem` に拡張）。
- `.faq-item.is-open` 時: ボーダー色＋シャドウ強調、`.faq-icon` が 180 度回転。

### 5.6 フィードバック UI（各回答末尾）

- `.feedback-section`（上辺 `border-top: 1px dashed` 区切り）
  - ラベル `.feedback-label`「この回答は役に立ちましたか？」
  - ボタン群 `.feedback-buttons`:「はい」「いいえ」の `<button class="feedback-btn">`
- 投票後は `.feedback-buttons` を `.feedback-thanks`（`material-icons: check_circle` ＋「ご協力ありがとうございました」）に差し替え。`faqFadeIn` アニメーションでフェードイン。
- `.feedback-btn` は Hover でブランドカラー、`:focus-visible` アウトライン、`:active` で `transform: scale(0.97)`、`:disabled` で `opacity: 0.6`。

### 5.7 検索結果ステータス

- コンテナ `#search-status`（`aria-live="polite"`, `aria-atomic="true"`、初期 `hidden`）。
- 検索実行中のみ表示。内部は `.faq-search-status`（淡青グラデ背景・角丸・薄ボーダー）。
- 内容:「`"<keyword>"` の検索結果：`<N>` 件」（件数は `.count` で太字）＋「クリア」導線ボタン。
- 検索キーワードが空になったら `hidden` に戻す。

### 5.8 結果なしメッセージ

- `#no-results-message`（初期 `hidden`）
  - アイコン `material-icons: search_off`（5xl, `text-on-surface-variant`）
  - 見出し「ご指定のキーワードに一致する質問は見つかりませんでした。」
  - 補助文
  - 導線（`flex-wrap`, `gap-3`）
    - `<button id="reset-search-btn" class="hc-cta__btn hc-cta__btn--ghost">`「検索をクリアしてすべて表示」
    - `<a href="bug-report.html" class="hc-cta__btn hc-cta__btn--primary">`「サポートに問い合わせる」

### 5.9 CTA セクション（解決しなかった場合）

- `.faq-cta-wrap > .hc-cta`（ヘルプセンター共通クラス）、`aria-labelledby="faq-cta-title"`。
- テキスト: `h2#faq-cta-title`「解決しませんでしたか？」／サブ「ヘルプセンターの記事やサポートチームがお手伝いします。」
- アクション
  - ゴースト: `<a href="help-center.html" class="hc-cta__btn hc-cta__btn--ghost">`「ヘルプセンターを見る」
  - プライマリ: `<a href="bug-report.html" class="hc-cta__btn hc-cta__btn--primary">`「お問い合わせ」

### 5.10 レスポンシブ

- ヒーロー `.faq-hero`: デフォルト `padding: 3rem 1.25rem 3.5rem` / `border-radius: 1.5rem`、`768px` 以上で `padding: 4rem 2.5rem 4.5rem` / `border-radius: 1.75rem`。
- メイン `.faq-main`（`max-width: 72rem`）: デフォルト左右 `padding: 1rem`、`640px` で `1.5rem`、`1024px` で `2rem`。
- カテゴリグリッド `.hc-category-grid`: 1 → 2（`640px`）→ 3 カラム（`1024px`）。
- `prefers-reduced-motion: reduce`（OS 設定で「動きを抑える」にしている人向けの CSS メディアクエリ）指定時は、`.faq-item` / `.faq-answer` / `.faq-icon` / `.faq-clear-btn` / `.feedback-btn` / `.feedback-thanks` / `.faq-category-card` / `.faq-category-card__icon` の `animation` と `transition` を無効化する。

---

## 6. 機能要件

**要約**
JS の主な責務は「JSON ロード → 検索／フィルタ → DOM 再描画」の 3 段ループ。状態は `state` オブジェクトに集約され、`renderUI()` が唯一の描画関数。入力は 2 箇所（ヒーロー／スティッキー）から来るが、必ず `#search-box` を単一の真実（source of truth）として経由させる。

### 6.1 データ取得ライフサイクル

**概要**
画面には「読み込み中」「本体」「エラー」の 3 領域（`#loading-indicator` / `#faq-container` / `#error-message`）があり、`renderUI()` が `hidden` クラスの付け外しでいずれか 1 つのみを表示する。状態遷移は `loading → success` または `loading → error` の 2 パターン。

- データソースは `faq.json` 固定。取得パスは `resolveDashboardDataPath('faq.json')` で解決（`window.location` から `02_dashboard/data/` を推定）。
- `faqApp.fetchFaqData()` のライフサイクル
  1. 開始: `state.isLoading = true` → `renderUI()`（`#loading-indicator` のみ表示）
  2. `fetch()` 実行
  3. `response.ok === false` → `throw new Error('HTTP <status>')` → `catch` で `state.error` に格納し `console.error` 出力
  4. 成功 → `await response.json()` を `state.allData` に格納
  5. `finally`: `state.isLoading = false` → `renderUI()`
- 表示ルール（`renderUI()` 内の排他制御）
  - `isLoading` のとき → `#loading-indicator` のみ
  - `error` のとき → `#error-message` に `情報の読み込みに失敗しました。時間をおいて再度お試しください。` を `textContent` で設定
  - `!isLoading && !error && allData` すべて満たすとき → `#faq-container`

### 6.2 検索

#### 6.2.1 入力方式（ヒーロー版とスティッキー版の同期）

**なぜ 2 箇所あるのか**
ヒーロー検索窓はページ上部の装飾的な大きい窓、スティッキー検索窓はスクロール後も常に手の届くところに残る縮小版。UX 上は別要素だが、裏で同じ検索状態を共有する必要がある。

**どう同期するか**
スティッキー側で入力された値は、一度 `#search-box`（ヒーロー側）の `value` にコピーされてから `handleSearch()` を呼ぶ。つまり「真の入力値は常に `#search-box`」。これにより状態が 2 系統に分岐するバグを防ぐ。

- `#search-box` の `input` イベント: `clearTimeout` + `setTimeout(..., 250)` で 250ms 遅延（debounce: 連続イベントを一定時間待って最後の 1 回だけ実行する制御）。
- `#faq-sticky-search-input` の `input`: `debounce(..., 250)` ユーティリティでラップ。
- `#search-box` の `keydown`: `event.key === 'Escape'` かつ非空のとき、`preventDefault()` → `clearSearch()`。
- `#faq-search-form` / `#faq-sticky-form` の `submit`: `event.preventDefault()` → `handleSearch()`（フルリロード抑止）。
- IME（日本語入力の変換モード。入力確定前と確定後でイベント発火順が変わる）対応
  - `compositionstart` で `state.isComposing = true` → この間 `input` ハンドラは `handleSearch()` を呼ばない
  - `compositionend` で `false` に戻し、250ms 遅延で再度 `handleSearch()`

#### 6.2.2 フィルタリング（AND 検索）

- `state.searchTerm` は `trim()` 後に判定。空なら `allData` をそのまま返す。
- 非空なら `toLowerCase()` → `/\s+/` で分割 → `filter(Boolean)` で空文字除去 → **AND 検索**（全ての単語が `question + answer` の結合文字列に部分一致する質問だけ残す方式）。
- 結果はカテゴリ構造を維持したまま、各カテゴリの `questions` を差し替えた新オブジェクト。
- 検索語が非空の間は `#category-cards-section` に `hidden` を付与（カテゴリカードのジャンプ先が検索結果側に存在しないため）。

#### 6.2.3 検索ステータス

- 検索語が空: `#search-status` に `hidden` を付与し `innerHTML` を空にする。
- 検索語が非空: `faq-search-status` クラスを付与し `hidden` を外す。内容
  - `material-icons: filter_alt`
  - `「<strong>{エスケープ済み検索語}</strong>」の検索結果：<span class="count">{N}</span>件`（N は全カテゴリの `questions.length` 合計）
  - `data-action="clear-search"` の「クリア」ボタン。`#search-status` 上のクリックを委譲して `clearSearch()` を起動。
- HTML 側で `aria-live="polite"` / `aria-atomic="true"` 付与済み（ライブリージョン：`aria-live` 付きの領域。内容更新をスクリーンリーダーに自動で読ませる仕組み。検索結果件数を聴覚的に通知するために必要）。

#### 6.2.4 ハイライト（なぜ OR パターンなのか）

**整合性の考え方**
フィルタは AND（全単語を含む質問だけ残す）だが、ハイライトは OR（どれか 1 つでも一致した箇所を `<mark>` で囲む）。
理由: AND でフィルタ済みの質問には「全キーワード」が必ず含まれているため、ハイライト側で OR を使っても各キーワードが確実に 1 回以上マーキングされる。AND ロジックをハイライトにも適用すると実装が複雑になる（近接判定等）ため、OR で十分・かつ見た目も自然に仕上がる。

`highlightText()`（`02_dashboard/src/shared/escape.js`）の処理手順
1. 入力テキストを `escapeHtml`（文字列を HTML として安全に表示できる形に変換する処理。XSS 対策）で先にエスケープ。
2. キーワードが空/空白のみならエスケープ済みテキストをそのまま返す。
3. `/\s+/` で分割 → `escapeRegex()` 適用 → `tokens.join('|')` で OR パターン → `RegExp(..., 'gi')`。
4. 一致箇所を `<mark>${match}</mark>` に置換。正規表現構築が例外を投げた場合はエスケープ済みテキストを返す（安全側フォールバック）。
- `answer` の描画では `highlightText()` の戻り値に `.replace(/\n/g, '<br>')` を適用して改行を反映。

#### 6.2.5 結果なし

- フィルタ後に全カテゴリで `questions.length === 0` の場合: `#faq-list` の `innerHTML` を空 → `hidden` 付与、`#no-results-message` の `hidden` を外す。
- `#reset-search-btn` クリックで `clearSearch()` 起動。「サポートに問い合わせる」は `bug-report.html` に遷移。

#### 6.2.6 クリア

クリアの起動経路は 4 つ（`#clear-search-btn` / `#search-status` 内の `data-action="clear-search"` / `#reset-search-btn` / `#search-box` での `Escape`）。

`clearSearch()` の処理
- `#search-box` と（存在時）`#faq-sticky-search-input` の `value` を空文字化。
- `state.searchTerm = ''`、`#clear-search-btn` に `hidden` 付与。
- `state.activeQuestionId` を `preSearchActiveQuestionId` から復元し、`preSearchActiveQuestionId = null`。
- `renderUI()` 後、`#search-box` にフォーカス復帰。スクロール位置は明示操作しない（ブラウザ既定に委ねる）。
- 復元対象質問があれば `queueMicrotask()` で `.faq-answer` の `hidden` を外し、`scrollHeight + 16px` を `--faq-answer-height` に設定してアコーディオンを再展開。

### 6.3 人気キーワード

- `faq.json` の `popularKeywords` が `Array.isArray` を満たす場合のみ描画。空配列なら `#popular-keywords-wrapper` の `innerHTML` を空にする。
- 描画: 先頭に `よく検索されるキーワード:` ラベル、以降 `.keyword-chip` の `<button type="button">` 群。`data-keyword` と `textContent` の両方にエスケープ済みキーワードを保持。
- クリック: `data-keyword` または `textContent.trim()` を `#search-box` にセット → `handleSearch()` → `#search-box` にフォーカス復帰。

### 6.4 カテゴリカード

- 描画対象: `faq.json` の `categories` のうち `Array.isArray(questions) && questions.length > 0` を満たすもの。
- 表示可能カテゴリが 0 件 または 検索語が非空なら `#category-cards-section` に `hidden` 付与。
- プレビュー質問の選定（最大 3 件）
  1. `isFeatured === true` の質問を先頭から最大 3 件
  2. 不足分を `isFeatured` が偽の質問で先頭から補完
- カード要素: `<a href="#cat-{id}" class="faq-category-card" data-category-id="{id}">`。件数バッジ、アイコン（`CATEGORY_META`）、タイトル、説明（あれば）、プレビュー `<ul>`、「すべて見る」リンク。
- アクセントカラーは `CATEGORY_META` の `accent` を `--hc-accent` として注入。未知 ID のフォールバックは `#4285F4` / `help_outline`。
- クリック時は標準ハッシュ遷移に任せつつ、`setTimeout(..., 0)` で到着先 `section#cat-{id}`（`tabindex="-1"`）に `focus({ preventScroll: true })` を実行（キーボード操作者がジャンプ後そのまま Tab で読み進められるようにするため）。

### 6.5 アコーディオン

**単一選択制の理由**
同時に複数開けるとユーザーがページ構造を見失いやすく、長文回答が縦に連なってスクロール負荷が大きいため、1 件だけ開ける単一選択制とする。

**`--faq-answer-height` で高さを制御する理由**
CSS の `max-height: auto` はトランジションの対象外（auto から数値への補間ができない）。そのため JS で `scrollHeight` を測って CSS カスタムプロパティに数値として渡し、CSS トランジションに乗せる必要がある。`+ 16px` は下余白のバッファ。

- 展開状態は `state.activeQuestionId`（1 件）で保持。
- `.faq-question` クリック時の手順
  1. クリック対象 `.faq-item` が既に `is-open` かを `wasOpen` に記録
  2. 全 `.faq-item.is-open` を閉じる（`is-open` 除去／`aria-expanded="false"`／`--faq-answer-height` 削除 ＋ `hidden` 付与）
  3. `wasOpen === false` のとき: 対象に `is-open` 付与、`aria-expanded="true"`、`state.activeQuestionId` 更新、`.faq-answer` の `hidden` 解除、`scrollHeight + 16` を `--faq-answer-height` に設定
  4. `wasOpen === true` のとき: `state.activeQuestionId = null`（閉じるのみ）
- 初期描画: `getQuestionHtml()` は `isOpen === false` なら `.faq-answer` に `hidden` を付け、`aria-expanded="false"` を出力。展開中は `syncAccordionVisibility()` で `hidden` を外す。
- `aria-*` 属性（なぜ必要か）
  - `.faq-question`: `id="faq-question-{id}"`、`aria-controls="faq-answer-{id}"`、`aria-expanded`
  - `.faq-answer`: `id="faq-answer-{id}"`、`role="region"`、`aria-labelledby="faq-question-{id}"`
  - 理由: スクリーンリーダー利用者がボタンと本文の対応関係・開閉状態を把握できるようにするため。

#### 6.5.1 再レイアウト

- `window.resize` を `debounce(..., 150)` でラップし、現在開いているアコーディオンの `--faq-answer-height` を一旦削除してから `scrollHeight + 16px` で再設定（幅変更に伴い本文の高さが変わっても追従できるようにするため）。

### 6.6 スティッキー検索バーの表示制御

**二重制御（`hidden` と `is-visible`）の理由**
CSS トランジション（フェードイン／アウト）を使いたいが、ずっと DOM に残すとスクリーンリーダーから重複読み上げされる。そこで
- 見た目のフェード → `.is-visible` クラスで `opacity`／`transform` を切り替え
- スクリーンリーダー／タブ順からの除外 → `hidden` 属性でまとめて隠す
の 2 段階に分ける。表示時は `hidden` を外してから `requestAnimationFrame` で `is-visible` を付与（外した直後だとトランジションが効かないため 1 フレーム待つ）。非表示時は `is-visible` を先に外し、トランジション完了を待ってから `hidden` を付ける。

- `window.scroll` に `{ passive: true }` で登録（スクロール性能への影響を最小化）。
- 閾値: `hero.offsetTop + hero.offsetHeight - 80`
- 閾値超（表示）
  - `sticky.hidden === false` なら処理終了（再描画抑止）
  - `hidden = false` → `requestAnimationFrame` で `is-visible` 付与
- 閾値以下（非表示）
  - `is-visible` 除去 → `setTimeout(..., 250)` 後に `is-visible` が再付与されていないことを確認して `hidden = true`
- 初期化時に `onScroll()` を 1 回呼んで状態整合。
- 入力欄 `#faq-sticky-search-input` は §6.2.1 の同期仕様に従う。

### 6.7 カテゴリカード検索中の取り扱い

- 検索語が非空の間は `#category-cards-section` に `hidden`。クリア後（`state.searchTerm.trim()` が空）に `renderCategoryCards()` が再実行され、可視カテゴリが 1 件以上あれば `hidden` を除去。

### 6.8 フィードバック

**sessionStorage に保存する意味**
- sessionStorage（タブを閉じると消える一時保存領域。localStorage より短命）を使う。
- 意図: 同一タブ内で同じ質問を開き直したときに「投票済み」状態を復元し、二重投票を防ぐ。一方、タブを閉じたら消えるので、長期的な個人データ保持にはならない（匿名性と UX のバランス）。

- 各回答末尾に「この回答は役に立ちましたか？」セクションを描画。「はい」(`data-vote="useful"`) と「いいえ」(`data-vote="not-useful"`) の 2 ボタン。
- ボタン押下時
  - `console.log('GA Event:', { category: 'FAQ', action: 'Feedback', label: '{id} - {vote}' })`（実 GA 送信はスタブ）
  - `state.feedbackStatus[questionId] = true` → `sessionStorage['faqFeedbackStatus']` に JSON 文字列で保存（`saveFeedbackStatus()`）
  - ボタン領域を `.feedback-thanks`（`check_circle` ＋「ご協力ありがとうございました」）に差し替え。親の `.feedback-section` に `role="status"` と `aria-live="polite"` を付与（投票完了をスクリーンリーダーへ通知するため）。
- `sessionStorage` の読み書きが例外時はコンソールにエラー出力。読み込み側は `state.feedbackStatus = {}` にフォールバック。
- 投票は 1 質問 1 回。再描画時の `getFeedbackHtml()` は `feedbackStatus[questionId]` が真なら最初から `.feedback-thanks` のみを出力。

### 6.9 ローディング / エラー

- 初期ロード中: `#loading-indicator`（`role="status"` / `aria-live="polite"`）を表示しスピナーと「読み込み中...」を提示。
- JSON 取得失敗時: `#error-message`（`role="alert"` / `aria-live="assertive"`）に定型メッセージ。
- 3 領域は `hidden` クラスで排他制御（`renderUI()` が `classList.toggle('hidden', ...)` を呼ぶ）。

---

## 7. データ仕様

### 7.1 データソース

- 実ファイル: `data/faq.json`
- パス解決: `resolveDashboardDataPath('faq.json')`
- 取得方式: `fetch` の GET。`response.ok` が偽なら `HTTP <status>` を throw し、`#error-message` に定型メッセージ表示。
- 取得後は `state.allData` に全体保持。以降の検索・描画はすべてクライアントメモリ上で完結（再フェッチなし）。

### 7.2 ルートスキーマ

```json
{
  "popularKeywords": ["string", "..."],
  "categories": [ /* Category[] */ ]
}
```

| キー | 型 | 必須 | 説明 |
|---|---|---|---|
| `popularKeywords` | string[] | 必須 | 検索ボックス下の人気キーワードチップ群。配列でない場合は空として扱う |
| `categories` | Category[] | 必須 | カテゴリ配列。`questions` が空のカテゴリは表示対象から除外 |

#### 7.2.1 Category

| キー | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | 必須 | カテゴリ識別子。`CATEGORY_META` のキーと一致すると専用アイコン／色が適用。`cat-<id>` の DOM ID、アンカー `href="#cat-<id>"` にも使用 |
| `name` | string | 必須 | 表示名。カード見出しおよび一覧見出し `<h3 class="faq-category-heading">` に使用 |
| `icon` | string | 任意 | Material Icons 名。`CATEGORY_META` 一致時は上書き。未指定最終フォールバックは `help_outline` |
| `description` | string | 任意 | カード説明文および一覧見出し脇の補助文言。空または未指定なら非表示 |
| `questions` | Question[] | 必須 | 質問配列。空ならカード・一覧とも描画されない |

#### 7.2.2 Question

| キー | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | string | 必須 | 質問識別子。`faq-question-<id>`（ボタン）／`faq-answer-<id>`（本文）／フィードバック状態キー／`data-id` 属性に使用 |
| `question` | string | 必須 | 質問文。検索ヒット時は `highlightText` で `<mark>` を挿入 |
| `answer` | string | 必須 | 回答文。`highlightText` 適用後、`\n` を `<br>` に変換して `<p>` に描画 |
| `isFeatured` | boolean | 任意 | `true` でプレビュー優先選定・`.faq-item.is-featured` クラス付与・`Pick` バッジ表示 |

### 7.3 CATEGORY_META

`02_dashboard/src/faq.js` に定義。未知 `id` のフォールバックは `icon` プロパティ（未指定なら `help_outline`）、アクセント `#4285F4`。

| id | icon | accent |
|---|---|---|
| `general` | `help_outline` | `#4285F4` |
| `account` | `account_circle` | `#7e57c2` |
| `plans` | `workspace_premium` | `#f4b400` |
| `billing` | `receipt_long` | `#0f9d58` |
| `features` | `tune` | `#00acc1` |

アクセントカラーは `--hc-accent` としてカテゴリカード・カテゴリブロックにインラインで注入される。

### 7.4 現行カテゴリ（参考、2026-04-23 時点）

| id | 表示名 | 説明文 | 件数 | `isFeatured` 件数 |
|---|---|---|---|---|
| `general` | 基本機能について | 基本機能・サービスの概要 | 2 | 1 |
| `account` | アカウント・セキュリティ | ログイン・アカウント設定 | 6 | 1 |
| `plans` | 料金プランについて | プラン比較・アップグレード | 3 | 2 |
| `billing` | 請求・お支払いについて | 請求書・お支払い | 4 | 0 |
| `features` | 機能の詳細について | 各機能の詳細と使い方 | 9 | 2 |

`popularKeywords` は現状 6 件: `料金プラン` / `パスワード` / `アンケート作成` / `請求書` / `名刺データ化` / `お礼メール`。

---

## 8. 外部リンク / 他画面との関係

- ヘルプセンター導線: `help-center.html` 側のカテゴリグリッド末尾カード・CTA から FAQ へ遷移。FAQ 側のノーリザルト時 CTA もヘルプセンターを参照。
- お問い合わせ: `bug-report.html`。検索結果 0 件時の「お問い合わせ」導線として使用。
- パンくず: `#breadcrumb-container` に `src/main.js` から「ダッシュボード > FAQ」を注入。
- ヘッダー／サイドバー／フッター: 各プレースホルダに `src/main.js` が共通パーツを注入。フッターのプライバシー・特商法リンクは最新のプライバシーページに接続。
- ハッシュ遷移: カテゴリカード `href="#cat-<id>"` でブラウザ標準ジャンプ → `setTimeout(..., 0)` で到着セクションに `focus({ preventScroll: true })`。

## 9. 非機能要件

### 9.1 アクセシビリティ

- 検索フォーム: `role="search"`。ヒーロー版／スティッキー版で `aria-label` を `FAQ検索` / `FAQ検索(縮小版)` と区別（同一ラベルだとスクリーンリーダー上で区別できないため）。
- ライブリージョン
  - `#loading-indicator`: `role="status"`, `aria-live="polite"`（読み込み中の告知）
  - `#error-message`: `role="alert"`, `aria-live="assertive"`（エラーは即時通知が必要）
  - `#search-status`: `aria-live="polite"`, `aria-atomic="true"`（件数変化を都度読ませる）
- アコーディオン: `aria-expanded` と `aria-controls="faq-answer-<id>"`、本文に `role="region"` と `aria-labelledby="faq-question-<id>"`。閉状態は `hidden` 属性で DOM から非可視化（キーボード操作者が閉じた本文に誤って入らないようにするため）。
- キーボード: 検索ボックスの `Escape` で `clearSearch()`。カテゴリジャンプ後は `tabindex="-1"` のセクションへプログラムフォーカス。`:focus-visible` でフォーカス可視化。

### 9.2 パフォーマンス

- 入力検索の debounce: 250ms（`#search-box` の `input` / `compositionend`、スティッキー入力の `input`）
- ウィンドウリサイズの debounce: 150ms（開いているアコーディオンの高さ再計算）
- `scroll` ハンドラは `{ passive: true }` で登録
- 検索フィルタ: `toLowerCase` → ホワイトスペース区切りで AND 判定。全キーワードが `question + answer` に含まれる質問のみ残す

### 9.3 モーション / 視覚

- `prefers-reduced-motion: reduce` 指定ユーザーにはアコーディオン展開・フィードバック切替・カード Hover／Focus アニメーションを無効化（`02_dashboard/assets/css/faq.css`）。
- アコーディオン展開の高さは JS 算出の `--faq-answer-height` を CSS トランジションに渡す。

### 9.4 永続化

- フィードバック状態: `sessionStorage['faqFeedbackStatus']` に `{ [questionId]: true }` を JSON 文字列で保存。タブを閉じるまで保持、別タブや再訪では共有しない。
- ロード時 `loadFeedbackStatus()` でパース、投票時 `saveFeedbackStatus()` で再保存。JSON パース失敗時は空オブジェクトにフォールバック。
- 検索語・展開中質問 ID はメモリ状態のみで管理、永続化しない。

### 9.5 ブラウザ / 国際化

- 検索はクライアント側のみで完結（外部 API 非使用）。
- IME `compositionstart` 中は `input` イベントでの検索反映を抑止、`compositionend` 後に 250ms 遅延で再計算。
- （未対応）カテゴリ名・質問文の多言語切替。ヘルプセンターの `resolveLocalizedValue()` のような購読は行わない。

### 9.6 セキュリティ

**`escapeHtml` → `<mark>` 挿入の順序と理由**
流れは以下で固定する（逆にすると XSS リスクが発生）。
1. JSON から取得した生文字列を `escapeHtml()` でエスケープ（`<`, `>`, `&`, `"`, `'` を実体参照化）
2. エスケープ済みテキストに対してのみ、検索キーワード一致部分を `<mark>` で囲む（`highlightText()`）
3. `answer` は最後に `\n` → `<br>` 置換

もし順序を逆にして「`<mark>` 挿入後にエスケープ」すると、挿入した `<mark>` 自体がエスケープされて表示が壊れる。逆に「生文字列に `<mark>` を挿入してからそのまま `innerHTML`」するとユーザー入力中の `<script>` 等が実行され得る。現行順序はこの両方を避けるための必然。

- JSON 由来の全文字列は `escapeHtml` 後に HTML 挿入。
- 検索ハイライトはエスケープ済みテキストに対してのみ `<mark>` を挿入。
- カテゴリカードのアンカーは `href="#cat-<escapeHtml(id)>"`。`id` に制御文字が混入しても属性値としてエスケープされる。

## 10. 将来計画 / 未対応事項

- サポートサイト分離計画: `21_support_site_separation_spec.md` に基づき、将来的に `faq.html` は WordPress 側 `https://support.speed-ad.com/faq/` に移設予定。検索クエリ `?search=<query>` を同一仕様で受け渡し、ダッシュボード側は外部リンクへ切替。
- 多言語化（i18n）未対応。対応時は `resolveLocalizedValue()` の適用範囲（`question` / `answer` / `name` / `description` / `popularKeywords`）とデータ構造（辞書化または言語別ファイル分割）を別途設計。
- フィードバック集計はクライアント側 `console.log` のみ。サーバ連携・GA 実送信は未実装。
- 検索結果のページング・並び替え UI は未提供。全件クライアントフィルタで支障が出た時点で再検討。
- カテゴリカードのプレビュー 3 件選定は `isFeatured` 優先＋先頭補完の単純実装。クリック履歴は反映されない。

## 11. 関連ドキュメント

- `docs/画面設計/仕様/00_screen_requirements.md` §5.10.11（サポートページ一括記述）
- `docs/画面設計/仕様/15_help_center_requirements.md`（ヘルプセンター側からの FAQ 遷移、共通トークン設計）
- `docs/画面設計/仕様/18_screen_inventory_current.md` U-18（画面棚卸し上の FAQ 画面位置づけ）
- `docs/画面設計/仕様/21_support_site_separation_spec.md`（将来のサポートサイト分離計画、検索クエリパラメータ仕様）
