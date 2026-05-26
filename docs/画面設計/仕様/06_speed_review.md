---
owner: product
status: draft
last_reviewed: 2026-04-24
---

# SPEEDレビュー画面 要件定義書

> **TL;DR**
> - 対象は `02_dashboard/speed-review.html`（622 行）と `02_dashboard/src/speed-review.js`（3208 行、単一エージェント内のステートフル モジュール）、レンダラ `ui/speedReviewRenderer.js`（765 行）、データフィルタ `services/dateFilterService.js`（112 行）、CSVパーサ残骸 `services/speedReviewService.js`（355 行、現行フロー未使用）。本書はこれら現行実装を根拠にする「実装トレースドキュメント」である。
> - v1.x まで分散していた 3 本の仕様書（旧 `06_speed_review.md`・`speed_review_requirements_current.md`・`14_..._sample_data_requirements.md`）を、`15_help_center_requirements.md` / `16_bizcard_settings_requirements.md` と同方針の「画面が正（実装に書かれていないことは要件化しない）」へ刷新した。
> - 回答データは **クライアントサイド結合**。`Promise.all` で 4 ソース（`surveys.json` / `demo/answers` / `demo/business-cards` / `demo/surveys`）を並列 fetch し、空応答時は `responses/answers` / `responses/business-cards` / `surveys/enquete` にフォールバックする（§5.1）。
> - 「フリーアカウント判定」は `getCurrentGroupAccountType() === 'free'` と **`surveyId` ハードコードリスト（`sv_0002_26001`〜`sv_0002_26008` の 8 件）** による OR 判定（[speed-review.js:2985-2999](../../../02_dashboard/src/speed-review.js#L2985)）。`graphButton` 押下時のプレミアム誘導モーダルのトリガーに直結している。§11-1 最重要項目として追跡。
> - エクスポート機能は画面に存在しない（ダウンロードボタンなし）。§5.7 で方針整理、プラン別マトリクス（CSV/画像/結合/Excel）は §12-2 関連仕様書側の議題として残す。
> - モーダル詳細の「保存する」は `allCombinedData[index]` のメモリ上書き + `applyFilters()` 再描画のみ、サーバ送信なし（[speed-review.js:1382-1390](../../../02_dashboard/src/speed-review.js#L1382)）。ページリロードで消滅する §11-2。

## 1. 概要

### 1.1 優先度凡例

| 区分 | 意味 |
|------|------|
| **MVP** | 本版で必須。リリース条件。 |
| **Should** | 推奨。合理的理由があれば延期可。 |
| **Nice** | 任意。余力があれば対応。 |
| **Phase 2** | 本版対象外。§11 に集約。 |

### 1.2 目的・想定利用者

アンケートに紐づく回答データ（アンケート回答 + 名刺データ化結果）を、展示会運用の現場で「その日の動き」を短時間で確認・仕分けする単一画面。想定利用者:

- 広告運用担当（展示会当日、ブース離脱後に各回答者の名刺・アンケートを突合・確認）。
- プロダクト営業/マネージャー（回答ボリューム・属性分布・時間帯推移を俯瞰し、翌日以降の運用判断に使用）。
- 管理者（プレミアム機能（詳細分析ページ `graph-page.html`）への遷移起点として利用、フリーアカウント時は誘導モーダル）。

### 1.3 対象範囲 / 対象外

**対象**:
- `02_dashboard/speed-review.html`
- `02_dashboard/src/speed-review.js`
- `02_dashboard/src/ui/speedReviewRenderer.js`
- `02_dashboard/src/services/dateFilterService.js`
- `02_dashboard/src/services/speedReviewService.js`（**現行フロー未使用**、§11-10）
- モーダル HTML: `modals/reviewDetailModal.html` / `modals/questionSelectModal.html` / `modals/cardImagesModal.html` / `modals/premiumFeatureModal.html`

**対象外**（§12 参照のみ）:
- サーバサイド API・DB スキーマ（現行はすべて静的 JSON fetch）
- グラフ分析ページ（`graph-page.html`）の中身・エクスポート処理（遷移先としてのみ言及）
- 名刺データ化設定画面（`bizcardSettings.html`）の設定ロジック（ステータス判定のみ連動）
- お礼メール設定画面（`thankYouEmailSettings.html`）
- サンプルデータ生成条件（14_speed_review_sample_data_requirements.md が独立仕様で保持、§12-1）

### 1.4 主要設定値一覧

実装に散在するマジックナンバー・初期値の集約。**太字**は「現行未実装 / 現行バグの可能性あり」項目。

| 設定値 | 現行値 | ソース |
|--------|--------|--------|
| `rowsPerPage` 初期値 | `25` | [speed-review.js:13](../../../02_dashboard/src/speed-review.js#L13) |
| `rowsPerPage` 許容値 | `25 / 50 / 100 / 200` | [speed-review.html:350-353](../../../02_dashboard/speed-review.html#L350) / [speed-review.js:3074](../../../02_dashboard/src/speed-review.js#L3074) |
| ページネーション最大表示数 | `maxPagesToShow = 5` | [speed-review.js:1563](../../../02_dashboard/src/speed-review.js#L1563) |
| 初期ソート | `answeredAt` / `desc` | [speed-review.js:30-31](../../../02_dashboard/src/speed-review.js#L30) |
| ソート許容キー | `answerId / answeredAt / fullName / companyName / dynamicQuestion` | [speed-review.js:3075](../../../02_dashboard/src/speed-review.js#L3075) |
| 動的列ヘッダ省略 | 括弧除去 → 25 文字超で `...` | [speed-review.js:469-478](../../../02_dashboard/src/speed-review.js#L469) |
| 行内回答テキスト省略 | 22 文字超で `...` | [speedReviewRenderer.js:231](../../../02_dashboard/src/ui/speedReviewRenderer.js#L231) |
| 詳細列ヘッダのデフォルト文言 | `設問回答` | [speed-review.html:333](../../../02_dashboard/speed-review.html#L333) |
| 時間帯別グラフ軸モード | `auto`（初期） / `fixed` | [speed-review.js:19](../../../02_dashboard/src/speed-review.js#L19) |
| 時間帯別グラフ固定モード範囲 | `9:00 - 19:00` | [speed-review.js:2399-2401](../../../02_dashboard/src/speed-review.js#L2399) |
| 時間帯別グラフ自動モードパディング | `min-1h` 〜 `max+1h`（0〜23 に clamp） | [speed-review.js:2403-2406](../../../02_dashboard/src/speed-review.js#L2403) |
| 画像 URL 解決バッチサイズ | `BATCH_SIZE = 10` | [speed-review.js:3132](../../../02_dashboard/src/speed-review.js#L3132) |
| 画像 fetch 失敗閾値 | `FAILED_IMAGE_FETCH_THRESHOLD = 5` | [speed-review.js:340](../../../02_dashboard/src/speed-review.js#L340) |
| 画像ズーム倍率範囲 | `0.5 〜 5.0`、刻み `±0.1` | [speed-review.js:1028](../../../02_dashboard/src/speed-review.js#L1028) |
| サイドバー自動クローズ遅延 | `2500ms` | [speed-review.js:2878](../../../02_dashboard/src/speed-review.js#L2878) |
| LocalStorage 名前空間 | `STORAGE_NAMESPACE = 'speedReview'` | [speed-review.js:28](../../../02_dashboard/src/speed-review.js#L28) |
| UI 状態保存キー | `speedReview:{surveyId\|'unknown'}:uiState` | [speed-review.js:110-113](../../../02_dashboard/src/speed-review.js#L110) |
| **フリーアカウント判定対象 surveyId** | **8 件ハードコード**（sv_0002_26001 〜 sv_0002_26008） | [speed-review.js:2985-2999](../../../02_dashboard/src/speed-review.js#L2985) / §11-1 |
| **回答編集保存** | **メモリ上書きのみ**（サーバ送信なし） | [speed-review.js:1382-1390](../../../02_dashboard/src/speed-review.js#L1382) / §11-2 |
| **エクスポート機能** | **未実装**（画面に UI なし） | §5.7 / §11-3 |

---

## 2. 対象画面・関連ファイル

- `02_dashboard/speed-review.html`（622 行、単一ページ + 末尾インライン `renderMatrixChartApex()` 関数）
- `02_dashboard/src/speed-review.js`（3208 行、`export async function initializePage()`）
- `02_dashboard/src/ui/speedReviewRenderer.js`（765 行、`populateTable` / `renderInlineRow` / `renderModalContent` / `populateModal` / `openCardZoom` / `handleModalImageClick`）
- `02_dashboard/src/services/dateFilterService.js`（112 行、`getSurveyPeriodRange` / `buildDateFilterOptions` / `applyDateFilterOptions` / `resolveDateRangeFromValue` / `formatDateYmd`）
- `02_dashboard/src/services/speedReviewService.js`（355 行、`SpeedReviewService` クラス + CSV パーサ 67 行。`initializePage()` からは **import されていない**、§11-10）
- `02_dashboard/src/modalHandler.js`（`handleOpenModal` / `openModal`）
- `02_dashboard/src/breadcrumb.js`（`initBreadcrumbs`、[breadcrumb.js:11-14](../../../02_dashboard/src/breadcrumb.js#L11) で speed-review 定義）
- `02_dashboard/src/constants/chartPalette.js`（`COMMON_CHART_DONUT_PALETTE`）
- `02_dashboard/src/sidebarHandler.js`（`getCurrentGroupAccountType`、[sidebarHandler.js:300](../../../02_dashboard/src/sidebarHandler.js#L300)）
- 共通ルーティング: [main.js:447-449](../../../02_dashboard/src/main.js#L447) が `speed-review.html` を検知し `initSpeedReviewPage()` を呼び出す。`#header-placeholder` / `#sidebar-placeholder` / `#footer-placeholder` / `#breadcrumb-container` は共通注入。

**依存 CDN**（`speed-review.html` 冒頭 [speed-review.html:8-22](../../../02_dashboard/speed-review.html#L8)）:
- Tailwind CDN（`plugins=forms,container-queries`）
- Chart.js + `chartjs-plugin-datalabels`
- ApexCharts（マトリクス設問のドーナツ/横棒グラフ専用）
- Material Icons
- Flatpickr（本体 + `l10n/ja.js`）
- `service-top-style.css`（プロジェクト内）
- Google Fonts Inter / Noto Sans JP

**関連モーダル**:

| HTML パス | 起動関数 / トリガー | 用途 |
|-----------|---------------------|------|
| `modals/reviewDetailModal.html` | `handleOpenModal` 経由、`handleDetailClick(answerId)` / テーブル行クリック | 回答詳細 + 名刺表示・編集モード切替 |
| `modals/questionSelectModal.html` | `showQuestionSelectModal()`（KPI カード / 「設問を変更」リンク） | 動的カラムの設問切替 |
| `modals/cardImagesModal.html` | `showCardImagesModal(item)` | 名刺画像の拡大ズーム（表/裏） |
| `modals/premiumFeatureModal.html` | `openPremiumFeatureModal()`（フリーアカウントで `graphButton` 押下時） | 詳細分析ページへの誘導 |

---

## 3. 改訂履歴

- v2.0 (2026-04-24): 実装トレース型へ全面刷新。3 本の分散仕様書（旧 `06_speed_review.md` / `speed_review_requirements_current.md` / `14_speed_review_sample_data_requirements.md`）のうち 14 番を独立保持、残り 2 本を本書へ統合。UI 状態 localStorage 永続化 / 4 ソース並列 fetch + 3 パターンフォールバック / バッチ画像 URL 解決 / マトリクス行ハイライト連動 / 非集計設問のサマリー表示 / フリーアカウント 8 件ハードコードなど、旧仕様には存在せず実装にのみ存在する要素を全文書化。エクスポート UI 未実装・回答編集保存モックの実装ギャップを §11 に 11 件集約。
- v1.x (〜 2026-04-02): 本書の旧版は「レイアウト記述は変更なし。ここでは省略」「画面フローは変更なし。ここでは省略」などの曖昧参照を含み、`speed_review_requirements_current.md` は別ファイルで「機能仕様書 - 詳細版」として平行記述されていた。両者の差異（ダッシュボード章の有無、データ連携ロジック記述の詳細度）が運用上のブレを生んでいたため v2.0 で 1 本化。

---

## 4. 画面構成

### 4.1 全体レイアウト（ASCII ツリー）

`body.bg-background h-full` 直下はダッシュボード共通の 2 カラム構造（ヘッダー + サイドバー + メイン）に加え、**右側フローティングサイドバー**（フィルタ）を独立配置する 3 ペイン構造。

```
<body class="bg-background text-on-background h-full">
├── #mobileSidebarOverlay                              … モバイル用サイドバーオーバーレイ
├── #header-placeholder                                … 共通ヘッダー注入
├── #sidebar-placeholder                               … 共通サイドバー注入
└── <main id="main-content">
    └── <div class="max-w-screen-xl mx-auto">
        ├── #breadcrumb-container                      … 「アンケート一覧 > SPEEDレビュー」
        ├── <h1>SPEEDレビュー</h1> + #review-survey-name … 「アンケート名: {name}」
        │
        ├── #analytics-dashboard (初期 .hidden)
        │   ├── KPI Row (grid 1/3)
        │   │   ├── 回答総数カード (#kpi-total-answers)
        │   │   └── #kpi-current-question-card          … 現在選択中の設問（クリックで設問選択モーダル）
        │   │       ├── 左: #dashboard-current-question + #question-change-link
        │   │       └── 右: #graphButton「詳細分析」(プレミアム誘導モーダル起動 or 遷移)
        │   ├── #non-chart-question-notice (初期 .hidden) … グラフ非対応設問の告知
        │   └── Charts Row (grid 1/3 + 2/3)
        │       ├── 時間帯別回答数 Line Chart (#timeSeriesChart)
        │       │   └── 軸切替 #ts-axis-auto-btn / #ts-axis-fixed-btn
        │       └── Shared Card (md:row)
        │           ├── 回答内容の内訳 (#attributeChart / #attributeChartApex + #matrix-controls-container)
        │           └── 集計データテーブル (#graph-data-table-container)
        │
        ├── <div class="relative">
        │   └── #main-content-wrapper (lg:mr-80, トグルで lg:mr-0)
        │       ├── #review-table-scroll-container (overflow-x-auto, min-h-[300px])
        │       │   └── <table id="reviewTable" class="min-w-[960px] table-fixed">
        │       │       ├── <thead> … 5 列 + 動的 1 列（展開ボタン列は populateTable 側で挿入）
        │       │       │   └── 各 th に <button class="sortable-header" data-sort-key="...">
        │       │       │       └── answerId / answeredAt / fullName / companyName / dynamicQuestion
        │       │       └── <tbody id="reviewTableBody">
        │       └── ページネーション (#itemsPerPage + #prevPageBtn + #pagination-numbers + #nextPageBtn + #pageInfo)
        │
        └── #right-sidebar-overlay / <aside id="right-sidebar">
            └── フローティング フィルタサイドバー (fixed top-24 right-8 w-80)
                ├── #right-sidebar-toggle-btn (chevron)
                ├── 検索タブ (#simple-search-tab / #detailed-search-tab)
                ├── 簡易検索 (#simple-search-content)
                │   ├── #dayFilterSelect (表示対象日、動的 options 構築)
                │   └── #statusFilterSelect (全て / 完了 / 進行中)
                ├── 詳細検索 (#detailed-search-content, 初期 .hidden)
                │   ├── #startDateInput (flatpickr, enableTime)
                │   ├── #endDateInput   (flatpickr, enableTime)
                │   └── #statusFilterSelectDetailed
                └── #resetFiltersButton

#footer-placeholder
#modal-container                                        … モーダル動的注入先
```

### 4.2 レスポンシブ

| ブレイクポイント | 挙動 |
|------------------|------|
| `< sm (640px)` | テーブル `min-w-[960px]` のため横スクロール発生。`#review-table-scroll-shadow` がグラデ影を表示。グラフ 2 カラム → 1 カラム縦積み。 |
| `md (768px)〜` | Charts Row の右カード内が左右 2 分割（属性グラフ + 集計データテーブル）。 |
| `lg (1024px)〜` | 右サイドバーが `fixed top-24 right-8 w-80` のフローティングに固定。`#main-content-wrapper.lg:mr-80` でテーブル領域を右サイドバーのぶんだけ左寄せ。トグルで `lg:mr-0` に切替。 |

モバイル時には `graph-data-table-container` の `max-height` を解除し、`overflow: visible` に切替（[speed-review.html:137-143](../../../02_dashboard/speed-review.html#L137)）。

### 4.3 アナリティクスダッシュボード

初期描画は `#analytics-dashboard.hidden` で隠蔽され、`renderDashboard(data)` 内で `classList.remove('hidden')` により一括表示（[speed-review.js:2273-2276](../../../02_dashboard/src/speed-review.js#L2273)）。

**KPI Row**:
- 回答総数カード: `#kpi-total-answers` に `data.length.toLocaleString() + '件'` を描画（[speed-review.js:2280-2281](../../../02_dashboard/src/speed-review.js#L2280)）。
- 現在選択中の設問カード `#kpi-current-question-card`:
  - 左半分: `#dashboard-current-question` に `Q{n}. {truncateQuestion(name)}` 形式で表示（`formatQuestionPrefix()` が `details.findIndex()` ベースで Q 番号を付与、[speed-review.js:99-108](../../../02_dashboard/src/speed-review.js#L99)）。
  - 下段の `#question-change-link`（`edit` アイコン + 「設問を変更」）は `e.stopPropagation()` で独立動作するが、どちらも最終的に `showQuestionSelectModal()` を起動する（[speed-review.js:1859-1869](../../../02_dashboard/src/speed-review.js#L1859)）。
  - 右セクション: `#graphButton`（`analytics` アイコン + 「詳細分析」）。フリーアカウント時は `openPremiumFeatureModal()`、プレミアム時は `graph-page.html?surveyId=...` に遷移（§5.10）。
- 非対応設問注記 `#non-chart-question-notice`: `text`/`number`/`date`/`handwriting`/`image`/`explanation`/`matrix_ma` などの「グラフ非対応設問」選択時のみ表示、`getBlankReason(type)` でメッセージ生成（[speed-review.js:490-517](../../../02_dashboard/src/speed-review.js#L490)）。

**Charts Row**:

| セクション | 技術 | 実装関数 |
|------------|------|----------|
| 時間帯別回答数 `#timeSeriesChart` | Chart.js `type: 'line'`、`fill: true`、`tension: 0.4` | [speed-review.js:2369-2474](../../../02_dashboard/src/speed-review.js#L2369) |
| 回答内容の内訳 `#attributeChart` | Chart.js（single/multi choice、rating_scale）| [speed-review.js:2476-2860](../../../02_dashboard/src/speed-review.js#L2476) |
| 回答内容の内訳 `#attributeChartApex` | ApexCharts（matrix_sa / matrix_ma）| [speed-review.js:2636-2642](../../../02_dashboard/src/speed-review.js#L2636) → [speed-review.html:478-617](../../../02_dashboard/speed-review.html#L478) |
| 集計データ `#graph-data-table-container` | 手書き `<table>` HTML | `renderGraphDataTable()` [speed-review.js:2100-2271](../../../02_dashboard/src/speed-review.js#L2100) |

時間帯グラフの軸モード切替 `#ts-axis-auto-btn` / `#ts-axis-fixed-btn` はグローバル `timeSeriesAxisMode` を更新し `renderTimeSeriesChart(getFilteredData())` を即時再実行する（[speed-review.js:1907-1918](../../../02_dashboard/src/speed-review.js#L1907)）。固定モードは 9-19 時、自動モードは min-1h 〜 max+1h を 0-23 に clamp。

マトリクス設問選択時は `#matrix-controls-container` 内に動的 `<select>` を生成し、行選択で即座に ApexCharts を再描画（[speed-review.js:2591-2618](../../../02_dashboard/src/speed-review.js#L2591)）。`matrix_ma` のみ先頭に `'全行集計'` オプションを追加する。`currentMatrixRowId` は設問変更時に `'all'` へリセット（[speed-review.js:995](../../../02_dashboard/src/speed-review.js#L995)）。

### 4.4 メインテーブル

| 列 | 幅 | ソートキー | 源流プロパティ |
|----|----|-----------|----------------|
| 展開ボタン | `w-[40px]` | なし | `populateTable` が thead に動的挿入 |
| 回答ID | `w-[15%]` | `answerId` | `item.answerId` |
| 回答日時 | `w-[18%] min-w-[160px]` | `answeredAt` | `item.answeredAt`（ISO 文字列そのまま描画） |
| 氏名 | `w-[18%] min-w-[140px]` | `fullName` | `businessCard.group2.lastName + ' ' + group2.firstName` |
| 会社名 | `w-[20%]` | `companyName` | `businessCard.group3.companyName` |
| 設問回答 | `w-[29%] min-w-[180px]` | `dynamicQuestion` | `currentIndustryQuestion` に対応する `details[].answer`（22 文字超で `...` 省略） |

- 全ヘッダボタンは `.sortable-header` クラス、`aria-sort="none\|ascending\|descending"` を動的制御（[speed-review.js:1957-1976](../../../02_dashboard/src/speed-review.js#L1957)）。
- 動的設問ヘッダ `#dynamic-question-header` は `truncateQuestion()` で括弧除去 + 25 文字 `...` 省略（[speed-review.js:469-478](../../../02_dashboard/src/speed-review.js#L469)）。
- 行クリックは `e.target.closest('button')` でボタン押下を除外し、`onDetailClick(row.dataset.answerId)` を発火（[speedReviewRenderer.js:238-245](../../../02_dashboard/src/ui/speedReviewRenderer.js#L238)）。
- ステータス `processing`（`businessCard` なし / `cardStatus === 'processing'`）の行は氏名・会社名列を `<span class="processing-text">データ化進行中</span>` に差し替え、行に `review-row-processing` クラスを付与（[speedReviewRenderer.js:192-202](../../../02_dashboard/src/ui/speedReviewRenderer.js#L192)）。`processing-text` は HTML 冒頭 `<style>` で `::after content: '.'` のアニメーションが定義（[speed-review.html:24-64](../../../02_dashboard/speed-review.html#L24)）。
- 空データ時は `<tr><td colspan="6">該当する回答データがありません。</td></tr>` を単一行描画。

### 4.5 インライン展開行

- 展開ボタン（`keyboard_arrow_right` アイコン）クリックで `toggleInlineRow(row, answerId)` が発火（[speed-review.js:1163-1187](../../../02_dashboard/src/speed-review.js#L1163)）。
- `renderInlineRow(item, colSpan=6)` が `<tr.inline-detail-row>` を生成し、元行の直後に `.after()` で挿入（[speedReviewRenderer.js:254-409](../../../02_dashboard/src/ui/speedReviewRenderer.js#L254)）。
- 展開行の中身:
  - 左側: 名刺画像（表裏タブ切替 `.card-tab-btn`、`data-tab="front\|back"`）+ 回転ボタン（`.rotate-btn data-target="inline" data-dir="±90"`）+ ズームコンテナ（`data-zoom-src` 属性付与）。
  - 右側: 会社名・氏名・部署/役職・Email・電話番号（`group2` / `group3` / `group1` / `group5` からパス参照）。
- 状態フラグ: 親行に `data-expanded="true\|false"`、アイコンを `keyboard_arrow_right` ↔ `keyboard_arrow_down` にトグル。
- 再度クリックで `.inline-detail-row.remove()` により完全削除（再開時は再生成）。
- 展開直後に `setupWheelZoomListeners(detailRow)` でホイールズームハンドラを再アタッチ。

### 4.6 回答詳細モーダル

`handleDetailClick(answerId)` → `handleOpenModal('reviewDetailModalOverlay', modals/reviewDetailModal.html, callback)` で動的読込（[speed-review.js:1189-1208](../../../02_dashboard/src/speed-review.js#L1189)）。

- `currentItemInModal = item`、`isModalInEditMode = false` をグローバルに保持。
- コールバック内でレースコンディション対策として `capturedItem !== currentItemInModal` なら描画スキップ（連打モーダル切替耐性）。
- `renderModalContent(item, isEditMode)` が以下を注入:
  - `#modal-business-card-details`: 名刺表裏画像（`#detail-front-image` / `#detail-back-image`、`data-zoom-src` 付）+ 画像状態バッジ + 名刺項目一覧。常に表示モード。
  - `#modal-survey-answer-details`: 設問・回答の一覧。`isEditMode === true` 時は `<input type="text">` / `<select>` / `<input type="radio">` / `<input type="checkbox">` に差し替え。
- フッタ `#reviewDetailModal .p-4.border-t`:
  - 表示モード: 「編集する」(#editDetailBtn)
  - 編集モード: 「キャンセル」(#cancelEditBtn) + 「保存する」(#saveDetailBtn)
  - 差し替えは `updateModalFooter()` で `innerHTML` 再構築（[speed-review.js:1400-1418](../../../02_dashboard/src/speed-review.js#L1400)）。
- ホイールズーム（0.5〜5.0、0.1 刻み）と回転（±90°）は `setupWheelZoomListeners` / `handleRotateClick` がモーダル DOM に対してイベントデリゲーション登録（二重登録防止用に `data-zoom-listener-attached` / `data-rotate-listener-attached` 属性をチェック、[speed-review.js:1210-1248](../../../02_dashboard/src/speed-review.js#L1210)）。

### 4.7 設問選択モーダル

`showQuestionSelectModal()` → `handleOpenModal('questionSelectModalOverlay', modals/questionSelectModal.html, callback)`（[speed-review.js:1449-1465](../../../02_dashboard/src/speed-review.js#L1449)）。

- コールバック内で `populateQuestionSelector(allCombinedData, container)` を呼び、`container = #modal-question-list` に設問ボタン列を描画。
- `#questionSelectModal` 本体の click は `e.stopPropagation()` でオーバーレイへ伝播させず、オーバーレイ click 時のみ閉じる（`overlay.click()` を明示起動、[speed-review.js:1707](../../../02_dashboard/src/speed-review.js#L1707)）。
- 各設問ボタン:
  - Q 番号プレフィックス（`formatQuestionPrefix()`）+ 設問文
  - グラフ化可能アイコン: `analytics`（`text-primary`）／非対応: `description`（`text-on-surface-variant/60`）。判定は `SINGLE_CHOICE_TYPES / MULTI_CHOICE_TYPES / MATRIX_SINGLE_TYPES / MATRIX_MULTI_TYPES / rating_scale` の Set 照合（[speed-review.js:72-88](../../../02_dashboard/src/speed-review.js#L72)）。
  - 選択中は `bg-primary/5 font-bold border-l-4 border-primary pl-3` + 末尾に `check_circle`。

### 4.8 名刺画像拡大モーダル

`showCardImagesModal(item)` は `modals/cardImagesModal.html` を開き、`#card-image-front-container` / `#card-image-back-container` に画像 + ズーム/回転 UI をセット（[speed-review.js:1250-1296](../../../02_dashboard/src/speed-review.js#L1250)）。現状このモーダルへの直接トリガは確認できず、回答詳細モーダル内の画像クリック（`handleModalImageClick`）経由の派生として残存（§11-9）。

---

## 5. 機能要件

### 5.1 初期化フロー [**MVP**]

エントリ: [main.js:32](../../../02_dashboard/src/main.js#L32) で `import { initializePage as initSpeedReviewPage }`、[main.js:447-449](../../../02_dashboard/src/main.js#L447) で `speed-review.html` 検知時に呼出。

`initializePage()`（[speed-review.js:2971-3208](../../../02_dashboard/src/speed-review.js#L2971)）:

1. **Skeleton 描画**: `renderTableSkeleton()` で `<tr class="animate-pulse">` 5 行を即時表示、`#pageInfo.textContent = '読み込み中...'`（[speed-review.js:1532-1552](../../../02_dashboard/src/speed-review.js#L1532)）。
2. **パンくず注入**: `initBreadcrumbs()` が「アンケート一覧 > SPEEDレビュー」を `#breadcrumb-container` に注入（[breadcrumb.js:11-14](../../../02_dashboard/src/breadcrumb.js#L11)）。
3. **URL パラメータ取得**: `new URLSearchParams(window.location.search).get('surveyId')`。未指定時は `throw new Error("アンケートIDが指定されていません。")` で catch 側に流れ、`<td colspan="5" class="text-error">` にメッセージ表示（[speed-review.js:2978-2980, 3202-3206](../../../02_dashboard/src/speed-review.js#L2978)）。
4. **UI 状態復元**: `loadUiState()` が `localStorage.speedReview:{surveyId}:uiState` から `{currentPage, rowsPerPage, currentSortKey, currentSortOrder, currentStatusFilter, currentIndustryQuestion, currentDateFilter}` を復元（[speed-review.js:133-159](../../../02_dashboard/src/speed-review.js#L133)）。
5. **フリーアカウント判定**: `surveyId` が `['sv_0002_26001', ..., 'sv_0002_26008']` の 8 件リストに含まれる場合のみ `isFreeAccountUser = true` に強制上書き（[speed-review.js:2985-2999](../../../02_dashboard/src/speed-review.js#L2985)、§11-1）。初期値は `getCurrentGroupAccountType() === 'free'` だが、この分岐で **常に上書き** される。
6. **並列 fetch**: `Promise.all` で 4 本同時実行（[speed-review.js:3002-3016](../../../02_dashboard/src/speed-review.js#L3002)）:
   - `data/core/surveys.json`（全アンケート定義）
   - `data/demo/demo_answers/{surveyId}.json`（404 時は `[]`）
   - `data/demo/demo_business-cards/{surveyId}.json`（404 時は `[]`）
   - `data/demo/demo_surveys/{surveyId}.json`（404 時は `{}`）
7. **フォールバック チェーン**:
   - `answersData` が空配列 → `data/responses/answers/{surveyId}.json` を再 fetch（[speed-review.js:3023-3036](../../../02_dashboard/src/speed-review.js#L3023)）。`{answers: [...]}` のラップ形式にも対応。
   - `personalInfoData` が空配列 → `data/responses/business-cards/{surveyId}.json` → `data/business-cards/{surveyId}.json` の順で再 fetch（§11-11 2 段フォールバックのディレクトリ移行残骸）。
   - `enqueteDetailsData.details` が不在 → `data/surveys/enquete/{surveyId}.json` を再 fetch。
8. **設問定義特定**: `currentSurvey = surveys.find(s => s.id === surveyId)`。見つからない場合は `throw new Error(...)`。`enqueteDetailsData.details` を正規化して `currentSurvey.details` に上書き（`text` / `question` キーの両側埋め、[speed-review.js:3064-3073](../../../02_dashboard/src/speed-review.js#L3064)）。
9. **UI 状態反映**: 許容値 Set（`{25,50,100,200}` / 許可ソートキー / 許可ステータス値）に通るものだけ復元（[speed-review.js:3074-3087](../../../02_dashboard/src/speed-review.js#L3074)）。
10. **データ結合** `allCombinedData = answersArr.map(answer => ...)`（[speed-review.js:3095-3126](../../../02_dashboard/src/speed-review.js#L3095)）:
    - `businessCard`: `personalInfoMap.get(answer.answerId)` → 見つからなければ `answer.businessCard` → 無ければ `undefined` のまま（`processing` 判定用）。
    - `details`: `answer.details` の各要素に対し `question` 未設定なら `questionId` から `currentSurvey.details` を検索して注入。
    - `survey` / `cardImageViewState` （`{front: {rotation:0, scale:1}, back: {...}}` のディープコピー）を各レコードに付与。
11. **画像 URL 解決（非同期・非ブロッキング）**: IIFE で `BATCH_SIZE = 10` のバッチ並列 + `setTimeout(r, 10)` の間隔を置いて順次処理。`failedImageFetchCount > FAILED_IMAGE_FETCH_THRESHOLD(=5)` を超えたら全停止（[speed-review.js:3131-3159](../../../02_dashboard/src/speed-review.js#L3131)）。完了時、既に展開済みのインライン行の `img.src` を差し替え。
12. **アンケート名描画**: `#review-survey-name.textContent = 'アンケート名: ' + currentSurvey.name.ja`（多言語は現状 `.ja` を決め打ち、§11-12）。
13. **初期設問決定**: `currentIndustryQuestion = currentSurvey.details[0].question || details[0].text`。`restoredUiState.currentIndustryQuestion` が現行設問リストに存在するなら優先（[speed-review.js:3174-3187](../../../02_dashboard/src/speed-review.js#L3174)）。
14. **起動シーケンス**:
    - `setupTableEventListeners()`（テーブルのイベント デリゲーション、`data-listeners-attached` で二重登録防止）
    - `populateQuestionSelector(allCombinedData)`（非モーダル向けコンテナがあれば描画。現行 HTML には存在しないため実質 no-op、§11-8）
    - `setupEventListeners()`（フィルタ・ソート・タブ・KPI・グラフ軸切替・詳細分析ボタン）
    - `setupSidebarToggle()`（右サイドバー フローティング制御）
    - `updateSortIcons()`
    - `applyFilters()`（初回描画）

### 5.2 回答一覧表示 [**MVP**]

**`displayPage(page, data)`**（[speed-review.js:1510-1530](../../../02_dashboard/src/speed-review.js#L1510)）:

- 引数 `data` は「ソート済みフィルタ後データ」。追加ソートは行わない（呼出側 `applyFilters()` が `sortData(filteredData)` を先行実行）。
- ページネーション スライス: `sortedData.slice((page-1)*rowsPerPage, page*rowsPerPage)`。
- `populateTable(paginatedData, handleDetailClick, currentIndustryQuestion)` に委譲。
- `#pageInfo` に `'{startItem} - {endItem} / 全 {totalItems}件'` 形式で描画。
- 末尾で `saveUiState()` を呼び、現在ページをローカルストレージに永続化。

**`populateTable`**（[speedReviewRenderer.js:164-246](../../../02_dashboard/src/ui/speedReviewRenderer.js#L164)）:

- 初回のみ `<thead>` に `.expand-col-header` の `<th>` を `insertBefore(firstChild)` で先頭挿入（2 回目以降はスキップ）。
- 各行に `data-answer-id="{answerId}"`、行クリック時は `e.target.closest('button')` がなければ `onDetailClick` 発火。
- ステータス `processing` 時は氏名・会社名列を「データ化進行中」アニメーション（`processing-text` CSS）に差替え、行に `review-row-processing` 付与。

### 5.3 検索・フィルタ [**MVP**]

**会期範囲**:
- `availableDateRange = getSurveyPeriodRange(currentSurvey, allCombinedData)` がアンケートの `periodStart` / `periodEnd` を `startOfDay` / `endOfDay` で正規化。欠損時は `answeredAt` の最小・最大から導出、回答 0 件時は `null`（[dateFilterService.js:34-58](../../../02_dashboard/src/services/dateFilterService.js#L34)）。
- flatpickr の `minDate` / `maxDate` に設定、会期外は選択不可。会期内日付には `event-duration-highlight` クラス（`background-color: rgba(26,115,232,0.1)` + `border-bottom: 2px solid #1a73e8`）を `onDayCreate` で付与（[speed-review.html:67-70](../../../02_dashboard/speed-review.html#L67), [speed-review.js:1734-1742](../../../02_dashboard/src/speed-review.js#L1734)）。

**簡易検索 `#dayFilterSelect`**:
- `buildDateFilterOptions(range)` が `[{value:'all', label:'会期全体 (MM/DD - MM/DD)'}, {value:'YYYY-MM-DD', label:'N日目 (MM/DD)'}*, {value:'custom', label:'カスタム範囲'}]` を生成（[dateFilterService.js:60-87](../../../02_dashboard/src/services/dateFilterService.js#L60)）。
- `change` イベント（[speed-review.js:1780-1800](../../../02_dashboard/src/speed-review.js#L1780)）:
  - `custom` 選択 → `#detailed-search-content.hidden` を外し、以降の処理はユーザ入力待ち（flatpickr は変更せず）。
  - それ以外 → `#detailed-search-content` を隠し、`resolveDateRangeFromValue(val, availableDateRange)` で `[start, end]` を算出。両 flatpickr に `setDate(..., false)`（change 発火抑止）でセットし `applyFilters()`。

**詳細検索** `#startDateInput` / `#endDateInput`（flatpickr、`enableTime: true`、`dateFormat: 'Y-m-d H:i'`）:
- `onChange` で両方の `selectedDates[0]` が揃ったら `currentDateFilter = [start, end]` として `applyFilters()`。
- `daySelect.value` の自動追従: 範囲が会期全体と完全一致なら `'all'`、それ以外は `'custom'`。`valFromSelectChange` フラグで select change 由来の setDate 呼び出し時には追従処理をスキップ（[speed-review.js:1749-1766](../../../02_dashboard/src/speed-review.js#L1749)）。

**ステータス `#statusFilterSelect` / `#statusFilterSelectDetailed`**:
- 値は `all` / `completed` / `processing` の 3 値。`syncStatusFilter(value)` で 2 つの select を常に同期、`currentStatusFilter` に反映して `applyFilters()`（[speed-review.js:1829-1852](../../../02_dashboard/src/speed-review.js#L1829)）。
- 判定: `item.cardStatus === 'processing' || !item.businessCard → 'processing'`、それ以外 `'completed'`（[speed-review.js:1494](../../../02_dashboard/src/speed-review.js#L1494)）。

**リセット `#resetFiltersButton`** (`handleResetFilters`、[speed-review.js:1420-1447](../../../02_dashboard/src/speed-review.js#L1420)):
- `currentDateFilter = null` → `resolveDateRangeFromValue('all', range)` で会期全体に復帰。
- `currentStatusFilter = 'all'`、両 select を `'all'` に戻し、`applyFilters()`。

**`getFilteredData()`**（[speed-review.js:1467-1500](../../../02_dashboard/src/speed-review.js#L1467)）:
- 日付フィルタ: `currentDateFilter.length === 2` で範囲絞込、`length === 1` で当日 0:00〜23:59:59.999 に展開。
- ステータス: `'all'` 以外で絞込。
- 検索は日付 + ステータスのみ。**フリーワード検索は実装されていない**（§11-4）。

### 5.4 ソート [**MVP**]

**`sortData(data)`**（[speed-review.js:1921-1955](../../../02_dashboard/src/speed-review.js#L1921)）:

| `currentSortKey` | 値の取り出し |
|------------------|--------------|
| `fullName` | `businessCard.group2.lastName + ' ' + group2.firstName` の trim |
| `companyName` | `businessCard.group3.companyName` |
| `dynamicQuestion` | `details.find(d => d.question === currentIndustryQuestion).answer`（配列は `.join(', ')`） |
| その他 | `item[key]`（`answerId` / `answeredAt`） |

- 文字列同士は `localeCompare(bValue, 'ja')` で日本語ロケール比較。
- 数値 / 混在は `<` / `>` 比較のみで、NaN ガードなし。
- `sortData` は `Array.prototype.sort` を直接呼び in-place 変更。
- 初回 / 復元の初期状態は `answeredAt desc`。

**`setupSortListeners()`**（[speed-review.js:1978-2002](../../../02_dashboard/src/speed-review.js#L1978)）:
- `.sortable-header` クリック時、`currentSortKey === sortKey` なら `asc` ↔ `desc` 反転、異なるキーなら新キー + `'desc'` にリセット。
- `<button>` 以外の要素には Enter / Space の keydown ハンドラを追加（現行 HTML は全て `<button>` で来るため実質デッドパス、§11-7）。
- 末尾で `applyFilters()` + `updateSortIcons()`。アイコンは `arrow_upward` / `arrow_downward` / `unfold_more`（初期・非選択）を切替、`aria-sort` を `ascending` / `descending` / `none` に同期（[speed-review.js:1957-1976](../../../02_dashboard/src/speed-review.js#L1957)）。

> **[NOTE] 旧仕様書の「未回答を末尾に」という記述は実装されていない**。`speed_review_requirements_current.md` §3.2.3 が未回答項目を末尾に寄せる安定ソートを定義していたが、現行 `sortData()` はそのようなロジックを持たず、`localeCompare` の結果順に並ぶ（`''` は先頭寄り）。§11-5 追跡。

### 5.5 詳細表示 [**MVP**]

**行クリック → モーダル**: [speed-review.js:1189-1208](../../../02_dashboard/src/speed-review.js#L1189) `handleDetailClick(answerId)`。
**展開ボタン → インライン行**: [speed-review.js:1163-1187](../../../02_dashboard/src/speed-review.js#L1163) `toggleInlineRow(parentRow, answerId)`。

両者は排他ではなく**両立**可能（同一行に対しインライン展開 + モーダル両方を同時に開ける）。

**モーダル編集モード**（`isModalInEditMode`）:
- `handleEditToggle()` で `isModalInEditMode` を反転、`renderModalContent(currentItemInModal, true/false)` を再実行して DOM を再構築、`updateModalFooter()` でフッタボタンを差し替え、`setupWheelZoomListeners()` を再登録（[speed-review.js:1298-1304](../../../02_dashboard/src/speed-review.js#L1298)）。
- 設問タイプ別の入力要素対応は §5.6 表参照。

**画像操作（モーダル・インライン共通）**:
- 回転: `data-dir="±90"` の差分を `currentRotation` に加算、`transform: rotate(Ndeg) scale(S)` を合成セット（[speed-review.js:1046-1087](../../../02_dashboard/src/speed-review.js#L1046)）。
- ズーム: ホイールで `±0.1`、`[0.5, 5.0]` に clamp（[speed-review.js:1013-1033](../../../02_dashboard/src/speed-review.js#L1013)）。
- 状態は `item.cardImageViewState = { front: {rotation, scale}, back: {...} }` に保持し `syncImageStateFromElement` / `applyImageStateToVisibleElements` が表示中の同一 `answerId` の他 DOM（モーダル・インライン・拡大モーダル）に同期伝播（[speed-review.js:257-268, 422-444](../../../02_dashboard/src/speed-review.js#L257)）。

### 5.6 レビュー操作（回答編集・保存） [**MVP（編集 UI）/ Phase 2（サーバ保存）**]

`handleSave()`（[speed-review.js:1306-1398](../../../02_dashboard/src/speed-review.js#L1306)）:

| 設問タイプ | 入力要素取得セレクタ | `newAnswer` 構築 |
|------------|----------------------|------------------|
| `single_choice` | `select[data-detail-index="{i}"]` | `.value` |
| `multi_choice` | `input[type="checkbox"][data-detail-index="{i}"]:checked` | `Array.map(cb => cb.value)` |
| `matrix_sa` / `matrix_single` | `input[type="radio"][data-detail-index="{i}"][data-matrix-row-index="{r}"]:checked` | `{ [row.id]: value }` を行ごとに集計（空は `''`） |
| `matrix_ma` / `matrix_multi` / `matrix_multiple` | `input[type="checkbox"][data-detail-index][data-matrix-row-index]:checked` | `{ [row.id]: [value, ...] }` |
| その他 (`free_text` など) | `input[type="text"][data-detail-index="{i}"]` | `.value` |

差分検出は `JSON.stringify(oldAnswer) !== JSON.stringify(newAnswer)`。差分有り → `allCombinedData[index] = updatedItem`（メモリ上書き）→ `currentItemInModal = updatedItem` → `applyFilters()` で画面再描画 → `showToast('回答を更新しました。', 'success')`。差分なし → `showToast('変更はありませんでした。', 'info')`。

**サーバ送信は一切行われない**（§11-2）。ページリロードで変更が消失する。

**キャンセル** (`#cancelEditBtn`): `handleEditToggle()` 再実行で表示モードに戻るのみ。`allCombinedData` への変更は発生しないため「キャンセル＝破棄」が自然に成立。

### 5.7 エクスポート・ダウンロード [**Phase 2**]

**本画面には UI が存在しない**。HTML/JS いずれにも `<button id="*download*" / *export*>` や対応ハンドラは実装されていない。

運用上のエクスポート動線は以下に委譲:
- **アンケート一覧 / ホーム** (`index.html`): ダウンロードオプション（旧仕様書 §5.1）。
- **詳細分析ページ** (`graph-page.html`): Excel 一括出力（本画面からは `#graphButton` で遷移）。

プラン別エクスポート マトリクス（無料 / プレミアム別の CSV / 画像 / 結合 / レポート出力可否）は旧仕様書 §5.2 に記載があるが、本画面実装には反映されていないため本書からは削除。§12-2 関連仕様書側の議題として保持。

### 5.8 ページング [**MVP**]

**`setupPagination(currentData)`**（[speed-review.js:1554-1615](../../../02_dashboard/src/speed-review.js#L1554)）:

- `pageCount = Math.ceil(currentData.length / rowsPerPage)`。
- 表示ウィンドウ: 現在ページを中心とした `maxPagesToShow = 5` ページ。ウィンドウ外側に「1」+ `...`、末尾に `...` + `pageCount` を補完。
- 各ボタンは直接 `displayPage(i, currentData)` を呼ぶ。
- `prevPageBtn.disabled = currentPage === 1`、`nextPageBtn.disabled = currentPage === pageCount || pageCount === 0`。
- `#itemsPerPage.onchange` で `rowsPerPage = parseInt(e.target.value)` → `displayPage(1, currentData)` に戻る。

`saveUiState()` は `displayPage` / `applyFilters` 経由で呼ばれ、`currentPage` / `rowsPerPage` / `currentSortKey/Order` / `currentStatusFilter` / `currentIndustryQuestion` / `currentDateFilter (ISO文字列配列)` を `localStorage.speedReview:{surveyId}:uiState` に JSON 書込み。

### 5.9 サイドバー制御（フィルタパネル） [**MVP**]

`setupSidebarToggle()`（[speed-review.js:2861-2967](../../../02_dashboard/src/speed-review.js#L2861)）:

- 初期表示: `isSidebarOpen = true`（開いている）、`mainContentWrapper` は `lg:mr-80`、overlay `active`。
- 自動クローズ: `AUTO_CLOSE_DELAY = 2500ms`、初期化直後・タブ操作なしの状態から自動で閉じる。
- 手動操作（トグルボタン / overlay クリック / 検索タブクリック）で `clearTimeout(autoCloseTimer)`。
- 再初期化耐性: `sidebar._autoCloseTimer` を外部プロパティとして保持し、再呼出時に `clearTimeout` を実行。

**検索タブ**（[speed-review.js:2939-2966](../../../02_dashboard/src/speed-review.js#L2939)）:
- `simple` / `detailed` 切替で `#simple-search-content` / `#detailed-search-content` の `.hidden` を逆転。
- アクティブ側に `bg-surface text-primary shadow-sm is-active` クラスを付与、非アクティブは `text-on-surface-variant hover:text-on-surface`。

### 5.10 プレミアム機能ゲーティング [**MVP**]

`#graphButton` 押下（[speed-review.js:1871-1886](../../../02_dashboard/src/speed-review.js#L1871)）:

```
if (!isFreeAccountUser) {          // プレミアム
    const surveyId = URLSearchParams.get('surveyId') || 'sv_0001_24001';
    window.location.href = `graph-page.html?surveyId=${surveyId}`;
} else {                           // フリー
    openPremiumFeatureModal();     // modals/premiumFeatureModal.html
}
```

- `isFreeAccountUser` の決定は §5.1 ステップ 5 の **8 件 surveyId ハードコード + `getCurrentGroupAccountType()` === 'free'`** の OR 判定（ただし判定時に上書きされる）。
- プレミアム時のフォールバック `sv_0001_24001` は `surveyId` 未指定ケースの保険だが、`initializePage` が `surveyId` 未指定時点で throw するため実質到達しない（§11-6 デッドパス）。

---

## 6. データモデル

### 6.1 `allCombinedData` レコード構造

`initializePage()` のデータ結合後（[speed-review.js:3095-3126](../../../02_dashboard/src/speed-review.js#L3095)）。1 件分:

```json
{
  "answerId": "ans-001",
  "surveyId": "sv_0001_26008",
  "answeredAt": "2026-01-10T10:30:00",
  "cardId": "card-abc",
  "cardStatus": "completed",
  "isTest": false,
  "details": [
    { "questionId": "q1", "question": "業種", "answer": "製造業" },
    { "questionId": "q6", "question": "興味度", "answer": "High" }
  ],
  "businessCard": {
    "group1": { "email": "yamada@example.com" },
    "group2": { "lastName": "山田", "firstName": "太郎" },
    "group3": { "companyName": "株式会社テスト", "department": "技術部", "position": "課長" },
    "group5": { "mobile": "090-xxxx-xxxx", "tel1": "03-xxxx-xxxx" },
    "imageUrl": { "front": "...", "back": "..." }
  },
  "survey": { "id": "...", "name": {"ja": "...", "en": "..."}, "details": [...] },
  "cardImageViewState": {
    "front": { "rotation": 0, "scale": 1 },
    "back":  { "rotation": 0, "scale": 1 }
  }
}
```

- `businessCard` は名刺データ化完了時のみ存在。`undefined` の場合はステータス `processing` とみなす。
- `details[].answer` は型不定（string / number / boolean / array / object）。設問タイプごとに正規化ロジックが分岐（§6.4）。
- `cardImageViewState` は実行時に `ensureCardImageViewState(item)` で必ず付与され、画像操作の状態源泉となる（[speed-review.js:221-237](../../../02_dashboard/src/speed-review.js#L221)）。

### 6.2 `currentSurvey` 構造

`data/core/surveys.json` 内で `id === surveyId` に一致するエントリ + `enqueteDetails.details` を `.details` フィールドに上書き:

```json
{
  "id": "sv_0001_26008",
  "name": {"ja": "展示会アンケート", "en": "..."},
  "periodStart": "2026-01-04",
  "periodEnd": "2026-01-17",
  "details": [
    { "id": "q1", "text": "業種", "question": "業種", "type": "single_choice", "options": [...] },
    { "id": "q6", "text": "興味度", "question": "興味度", "type": "rating_scale", "config": {"points": 5, ...} }
  ]
}
```

`name.ja` は `#review-survey-name` の描画元。`details` は設問選択モーダル・ヘッダ省略・集計・ソート・編集時の入力タイプ切替・プレフィックス Q 番号すべての基盤。

### 6.3 設問タイプ分類

`const` Set として定義（[speed-review.js:72-88](../../../02_dashboard/src/speed-review.js#L72)）:

| 分類 | 含まれるタイプ | グラフ化 | 処理系 |
|------|---------------|----------|--------|
| `SINGLE_CHOICE_TYPES` | `single_choice` / `dropdown` / `rating` | ○ | `buildChoiceSummary` → Chart.js |
| `MULTI_CHOICE_TYPES` | `multi_choice` | ○ | `buildChoiceSummary` → Chart.js |
| `MATRIX_SINGLE_TYPES` | `matrix_sa` / `matrix_single` | ○（ApexCharts） | `buildMatrixSummary` → `renderMatrixChartApex` |
| `MATRIX_MULTI_TYPES` | `matrix_ma` / `matrix_multi` / `matrix_multiple` | ○（ApexCharts） | 同上 |
| `rating_scale`（独立） | `rating_scale` | ○ | `buildRatingScaleSummary` → Chart.js |
| `BLANK_TYPES` | `text` / `free_text` / `number` / `date` / `datetime` / `datetime_local` / `time` / `handwriting` / `image` / `explanation` + MATRIX_MULTI | 空タイプ扱い | `buildNonChartSummary` → 代替カード |

`getBlankReason(type)` が日本語理由テキストを返す（[speed-review.js:490-517](../../../02_dashboard/src/speed-review.js#L490)）。

### 6.4 `details[].answer` の値形状

| 設問タイプ | 値の形 | 例 |
|------------|--------|----|
| `single_choice` / `dropdown` / `rating` | `string` | `"option_a"` |
| `multi_choice` | `string[]` | `["option_a", "option_b"]` |
| `matrix_sa` / `matrix_single` | `{ [rowId]: string }` | `{ row1: "col2", row2: "col3" }` |
| `matrix_ma` / `matrix_multi` | `{ [rowId]: string[] }` | `{ row1: ["col1","col3"] }` |
| `text` / `free_text` | `string` | `"自由記述..."` |
| `number` | `string \| number` | `"1234"` / `1234` |
| `date` / `datetime` / `time` | ISO 風文字列 | `"2026-01-10"` / `"10:30"` |
| `rating_scale` | `string` / `number` | `"4"` |
| `handwriting` / `image` | `string`（パス） or オブジェクト | `{ value: "...", ... }` |

`findAnswerDetail(answer, question)` が `normalizeQuestionText()`（lowercase + `Q1.` プレフィックス除去 + 空白圧縮）で完全一致 → 正規化一致の 2 段マッチ（[speed-review.js:519-535](../../../02_dashboard/src/speed-review.js#L519)）。

`flattenAnswerValue(value)` がネスト オブジェクト / 配列を再帰展開し、`value.value ?? value.text ?? value.label ?? value.id ?? value.answer` の順でフィールドを優先取り出し（[speed-review.js:721-738](../../../02_dashboard/src/speed-review.js#L721)）。

### 6.5 UI 状態永続化

`saveUiState()` / `loadUiState()` / `parseStoredDateFilter()`（[speed-review.js:133-159](../../../02_dashboard/src/speed-review.js#L133)）:

- キー: `speedReview:{surveyId || currentSurvey?.id || 'unknown'}:uiState`（`getScopedStorageKey('uiState')`、[speed-review.js:110-113](../../../02_dashboard/src/speed-review.js#L110)）。
- 保存対象フィールド:
  ```
  { currentPage, rowsPerPage, currentSortKey, currentSortOrder,
    currentStatusFilter, currentIndustryQuestion,
    currentDateFilter: [ISO文字列, ISO文字列] | null }
  ```
- 復元時のバリデーション: §5.1 ステップ 9 の Set 照合。不正値は無視し初期値のまま。
- `currentIndustryQuestion` は `currentSurvey.details` に同名が存在する場合のみ採用。

### 6.6 サーバ連携（現行モック）

現行は「クライアント結合型」モック:

| 用途 | エンドポイント（静的 JSON） | 備考 |
|------|-----------------------------|------|
| 設問定義（主） | `data/core/surveys.json` | 全アンケート定義の配列 |
| 設問詳細（主） | `data/demo/demo_surveys/{surveyId}.json` | `details[]` のみ利用 |
| 設問詳細（フォールバック） | `data/surveys/enquete/{surveyId}.json` | 旧ディレクトリ構造 |
| 回答データ（主） | `data/demo/demo_answers/{surveyId}.json` | `[answer, ...]` |
| 回答データ（フォールバック） | `data/responses/answers/{surveyId}.json` | `[answer, ...]` or `{answers: [...]}` |
| 名刺データ（主） | `data/demo/demo_business-cards/{surveyId}.json` | `[{answerId, businessCard}, ...]` |
| 名刺データ（フォールバック 1） | `data/responses/business-cards/{surveyId}.json` | — |
| 名刺データ（フォールバック 2） | `data/business-cards/{surveyId}.json` | §11-11 |
| 名刺画像（推定パス） | `../media/{path}` / `../media/generated/{surveyId}/bizcard/{basename}` など | `buildImageUrlCandidates()` / `buildMissingImageCandidates()` |

POST/PUT/DELETE は **一切発行されない**（`handleSave` も含めメモリ上書きのみ）。

---

## 7. 非機能要件

### 7.1 パフォーマンス [**Should**]

- データ量想定: 展示会 1〜5 日・1 日 300 件・総数 300〜1,500 件（14_speed_review_sample_data_requirements §2）。
- `allCombinedData` の結合はインメモリ `Array.map` + `Map.get` で O(N)。ソート・フィルタは都度 O(N log N) / O(N)。
- 画像 URL 解決は `BATCH_SIZE = 10` の並列 + 10ms 間隔の直列化。`FAILED_IMAGE_FETCH_THRESHOLD = 5` を超えると HEAD/GET を停止し、以降はキャッシュから推定パス `../media/{path}` を返す（[speed-review.js:340-396](../../../02_dashboard/src/speed-review.js#L340)）。
- テーブル描画は全行 `tableBody.innerHTML = ''` → `forEach append` で再構築（仮想スクロールなし）。数千件規模で劣化する懸念（§11-13）。
- Chart.js / ApexCharts のインスタンスはフィルタ適用ごとに `destroy()` + 新規生成。連続操作時の CPU ピークを伴う。

### 7.2 アクセシビリティ [**Should**]

- ソートヘッダに `aria-sort="none\|ascending\|descending"` を動的設定（[speed-review.js:1957-1976](../../../02_dashboard/src/speed-review.js#L1957)）。
- ページ送りボタンに `aria-label="前のページへ" / "次のページへ"`（[speed-review.html:357-365](../../../02_dashboard/speed-review.html#L357)）。
- ステータス・日付セレクトに `<label>` + `aria-label`。
- 詳細モーダル / 設問選択モーダル / 名刺ズームモーダルは独立 `<div>` であり `<dialog>` ではない（§11-14）。
- 時間帯グラフの軸切替ボタン（`自動` / `固定`）に `title="投稿がある範囲のみ表示"` / `"9:00-19:00で固定表示"`。

**欠落**:
- `#kpi-current-question-card` は `div` で実装されクリック可能だがキーボード操作（`Enter` / `Space`）不可、`role="button"` 未付与（§11-14）。
- `processing-text` アニメーションに `aria-live` なし、支援技術に進行中通知されない。
- `review-detail-modal` / `questionSelectModal` / `cardImagesModal` / `premiumFeatureModal` に `aria-labelledby` / `aria-describedby` / 焦点戻し未設定。
- 回答詳細モーダル内の編集モード切替時、フォーカス管理（最初の入力欄へ移動）未実装。

### 7.3 対応ブラウザ

- 最新 2 バージョンの Chrome / Firefox / Safari / Edge を暫定（他ページと同水準）。ApexCharts / Chart.js / flatpickr ともに IE 非対応。

### 7.4 セキュリティ

- 全データ・全画像はクライアントサイドから取得する静的 JSON ファイル。外部送信は 0 件。
- `localStorage.speedReview:{surveyId}:uiState` はオリジン内スコープ。
- XSS 防護: `populateTable` / `renderInlineRow` / `renderModalContent` は一部 `innerHTML` で値を差し込むが、多くは `escapeHtml()` 経由（`renderGraphDataTable` / `renderNonChartSummary*` など）。**一方、インライン展開行の会社名・氏名・メール等は直接テンプレート文字列に埋め込まれており、`escapeHtml` を通していない**（[speedReviewRenderer.js:385-404](../../../02_dashboard/src/ui/speedReviewRenderer.js#L385)）。§11-15 として追跡。
- 画像 `onerror` ハンドラはインライン属性で `this.dataset.fallbackApplied = '1'` の 1 段フォールバック後に `display: none`。

### 7.5 国際化（i18n）

- UI 文字列: 日本語ハードコード（HTML 直書き）。多言語化の枠組みはない。
- データ側: `currentSurvey.name.ja` を画面タイトル源泉として参照（[speed-review.js:3171](../../../02_dashboard/src/speed-review.js#L3171)）。`.en` 等の言語切替ロジックは未実装（§11-12）。
- flatpickr は `locale: 'ja'` で日本語固定、会期外日付は `event-duration-highlight` 以外は通常のグレーアウト。

---

## 8. Definition of Done

リリース判定権限者: プロダクトオーナー（TBD）。

**機能要件**:
- [ ] §5.1 `?surveyId=xxx` 付き URL で初期化、4 ソース並列 fetch + 3 パターンフォールバックが機能
- [ ] §5.1 `?surveyId` 未指定時にエラー行「アンケートIDが指定されていません。」を描画
- [ ] §5.2 テーブル 5 列 + 展開列 + `processing` 行アニメーション
- [ ] §5.3 会期内日付のみ flatpickr で選択可能、会期外はグレーアウト
- [ ] §5.3 `dayFilterSelect` 変更で flatpickr が自動追従、`custom` 選択で詳細検索が開く
- [ ] §5.3 ステータス 2 select が双方向同期（`syncStatusFilter`）
- [ ] §5.4 5 ソートキー × 昇降が `localeCompare` ベースで動作、アイコン + `aria-sort` 同期
- [ ] §5.5 行クリックで詳細モーダル、展開ボタンでインライン行が開閉
- [ ] §5.5 モーダル編集モードで 5 設問タイプ（single / multi / matrix_sa / matrix_ma / text）の入力収集と差分検出
- [ ] §5.5 画像回転 `±90°` と ホイールズーム `[0.5, 5.0]` がモーダル・インライン・拡大モーダルで同期
- [ ] §5.8 ページネーション（25/50/100/200）+ 5 ページ ウィンドウ + 省略記号補完
- [ ] §5.9 フィルタサイドバー 2.5s 自動クローズ、手動操作でキャンセル
- [ ] §5.10 フリーアカウント 8 件 surveyId でプレミアム モーダル誘導、それ以外で `graph-page.html` 遷移
- [ ] §6.5 UI 状態が `localStorage.speedReview:{surveyId}:uiState` に保存・復元

**ダッシュボード**:
- [ ] KPI 回答総数が `toLocaleString()` + 件単位で表示
- [ ] 時間帯グラフ `auto` / `fixed` の切替で X 軸範囲が切替
- [ ] 選択中設問がグラフ化不可のとき `#non-chart-question-notice` が表示
- [ ] マトリクス設問選択時に `#matrix-controls-container` に行セレクタが出現、`matrix_ma` のみ `全行集計` が追加
- [ ] マトリクス設問の集計データテーブル（行ごとの小テーブル）と ApexCharts の連動

**非機能要件**:
- [ ] 900 件データセットでフィルタ/ソート/ページネーションが実用速度（旧 14_sample_data §8）
- [ ] 画像 5 件連続 404 で以降の HEAD/GET を停止（リソース節約）
- [ ] モバイル幅でテーブル横スクロール + グラフ縦積みが成立

**受入シナリオ**:

| # | 手順 | 期待結果 |
|---|------|---------|
| A1 | `?surveyId=sv_0001_24001` で遷移 | Skeleton → 900 件前後のデータ描画、初期ソート `answeredAt desc` |
| A2 | 「表示対象日」で N 日目を選択 | flatpickr が該当日 0:00〜23:59:59.999 にセット、その日のデータのみ表示 |
| A3 | ステータスを「進行中」に変更 | `businessCard` なしの行のみ表示、氏名/会社名は processing-text アニメーション |
| A4 | KPI カード/「設問を変更」リンククリック | 設問選択モーダル表示、分析可否アイコン（analytics / description）で視覚区別 |
| A5 | 行クリック | 回答詳細モーダル表示、名刺画像 + 設問・回答 |
| A6 | 「編集する」→ single_choice を変更 → 「保存する」 | トースト「回答を更新しました。」、テーブル再描画、リロードで元に戻る |
| A7 | 詳細分析ボタン（プレミアムアカウント） | `graph-page.html?surveyId=...` に遷移 |
| A8 | 詳細分析ボタン（`sv_0002_26001` 等） | `modals/premiumFeatureModal.html` 誘導モーダル表示 |
| A9 | ページネーション「50」→「200」 | `rowsPerPage` 更新、`displayPage(1, ...)` 再実行、localStorage 保存 |
| A10 | リロード | 前回の設問選択・ソート・フィルタ・ページングが復元 |

---

## 9. 将来計画（Phase 2 以降）

本画面の実装ギャップ 16 件。番号が小さいほど優先度が高い。

1. **フリーアカウント判定の surveyId 8 件ハードコード（最重要）**: [speed-review.js:2985-2999](../../../02_dashboard/src/speed-review.js#L2985)。契約プラン連動は `plan-capabilities.json` の正規定義で解決すべきで、現行は `sv_0002_26001`〜`sv_0002_26008` の 8 件を配列リテラルで直書きし、マッチすると `isFreeAccountUser = true` を強制する。`getCurrentGroupAccountType()` の結果よりも優先される。グラフ分析への遷移 / プレミアム誘導モーダルの分岐に直結するため、プラン連動の再設計が入ったら最初に差し替える。

2. **回答編集のサーバ保存未実装**: `handleSave()`（[speed-review.js:1306-1398](../../../02_dashboard/src/speed-review.js#L1306)）は `allCombinedData[index] = updatedItem` のメモリ上書きのみ。PUT/POST 経路・楽観ロック・応答エラー形式・競合検知いずれも未定義。`speed_review_requirements_current.md` §2.2.2 でも「現状の保存はメモリ上の allCombinedData を更新するのみのモック実装」と明示されていた。

3. **エクスポート機能完全未実装**: 本画面には `#downloadBtn` / `#exportBtn` 等の DOM も存在せず、CSV / Excel / 画像一括ダウンロードは `index.html` / `graph-page.html` 側に委譲。旧仕様書 §5 の「無料 / プレミアム プラン別出力マトリクス」は本画面実装には反映されていない。

4. **フリーワード検索未実装**: 氏名 / 会社名 / 回答テキストを対象とした検索ボックスが存在しない。フィルタは日付範囲 + ステータスの 2 軸のみ。`getFilteredData()` にフリーワード検索の余地なし。

5. **「未回答を末尾へ」ソートが未実装**: 旧 `speed_review_requirements_current.md` §3.2.3 に明記されていた「`dynamicQuestion` の未回答項目を末尾に寄せる安定ソート」は `sortData()` に存在しない。現行は `localeCompare` の既定順で空文字列は先頭寄り。

6. **`graphButton` フリーアカウント時フォールバック surveyId デッドパス**: [speed-review.js:1879](../../../02_dashboard/src/speed-review.js#L1879) の `surveyId = 'sv_0001_24001'` は `URLSearchParams.get('surveyId')` が無い時のフォールバックだが、`initializePage` が surveyId 未指定時点で throw しているためここには到達しない。削除候補。

7. **`setupSortListeners` の keydown 分岐デッドパス**: [speed-review.js:1993-2000](../../../02_dashboard/src/speed-review.js#L1993) の `if (header.tagName !== 'BUTTON')` 分岐は、現行 HTML では `.sortable-header` がすべて `<button>` で来るため到達しない。`<div>` / `<th>` で `.sortable-header` を使う拡張時の保険として残存しているが、現状は死コード。

8. **`populateQuestionSelector` の非モーダル呼出死パス**: `initializePage()` 末尾（[speed-review.js:3195](../../../02_dashboard/src/speed-review.js#L3195)）で `populateQuestionSelector(allCombinedData)` が `targetContainer` 指定なしで呼ばれるが、HTML に `#question-selector-container` が存在しないため即座に `return` される。設問選択モーダル開閉時にのみ意味を持つ。

9. **`showCardImagesModal` 起点の未利用**: 関数本体は実装済み（[speed-review.js:1250-1296](../../../02_dashboard/src/speed-review.js#L1250)）だが、現行 UI から呼ぶ経路が未配線。回答詳細モーダル内の `data-zoom-src` 画像クリックからの拡張予定だったと推測される。

10. **`speedReviewService.js` 全体が未使用**: 355 行の `SpeedReviewService` クラス + CSV パーサ（67 行）が import されているのは名前空間の `speedReviewService` インスタンスのみで、`initializePage` 内から一度もメソッドが呼ばれない。CSV 取込経路の廃止に伴うデッドファイル化の可能性。削除候補。

11. **名刺データ 2 段フォールバック（`responses/business-cards` → `business-cards`）**: [speed-review.js:3037-3052](../../../02_dashboard/src/speed-review.js#L3037)。ディレクトリ構造移行の名残。`data/business-cards/` への配置ケースを除去できれば 1 段で済む。

12. **`currentSurvey.name.ja` の決め打ち**: 多言語拡張時に `lang` パラメータやユーザ設定で切替える必要があるが、現行は `.ja` 固定。`#review-survey-name` のみが影響点。

13. **大規模データの仮想スクロール未対応**: `tableBody.innerHTML = ''` + forEach append は数千件で DOM 膨張。ページネーション 200/頁 がバッファの上限。Web Worker / 仮想スクロール検討は旧仕様書 §7 に記載があったが実装されていない。

14. **モーダル `<dialog>` 化・アクセシビリティ補強**: `reviewDetailModalOverlay` / `questionSelectModalOverlay` / `cardImagesModalOverlay` / `premiumFeatureModalOverlay` はいずれも `<div>` の手動実装。`<dialog>` の `showModal()` + フォーカストラップ + Esc 閉じに切替予定。`#kpi-current-question-card` も `role="button"` + tabindex 未付与。

15. **インライン展開行の XSS 未エスケープ**: [speedReviewRenderer.js:385-404](../../../02_dashboard/src/ui/speedReviewRenderer.js#L385) で `company` / `fullName` / `dept` / `pos` / `email` / `tel` が `escapeHtml` を通さずテンプレート文字列に埋め込まれている。現行は静的 JSON 由来の信頼済みデータだが、実サーバ化時は必ずエスケープ処理を追加する。

16. **`renderMatrixChartApex` がインライン定義**: [speed-review.html:478-617](../../../02_dashboard/speed-review.html#L478) で 140 行の JS が HTML の `<script>` ブロックに直書き。モジュール化せず `window.renderMatrixChartApex` 相当で公開されているため、`speed-review.js:2636` の `if (typeof renderMatrixChartApex === 'function')` チェックに依存している。スクリプト読込順依存で脆い。

---

## 10. 用語集

| 用語 | 説明 |
|------|------|
| SPEEDレビュー | 本画面。アンケート回答 + 名刺データ化結果を即時確認する一覧 + 詳細画面 |
| `allCombinedData` | 回答データ + 名刺データ + 設問定義を結合済みのインメモリ配列（§6.1） |
| `currentSurvey` | 現在表示中アンケートの定義オブジェクト（`id`、`name`、`periodStart/End`、`details[]`）（§6.2） |
| `currentIndustryQuestion` | 動的カラム / 属性グラフ / 集計データの表示対象となっている「選択中の設問」 |
| `currentDateFilter` | 日付フィルタの現値。`[startDate, endDate]` または `null` |
| `currentStatusFilter` | ステータスフィルタの現値。`'all' / 'completed' / 'processing'` |
| `cardStatus` | 名刺データ化の進捗。`'processing'`（`businessCard` なし）または `'completed'` |
| `processing-text` | データ化進行中の氏名・会社名セルに付与される CSS クラス。`::after` で `.` `..` `...` のアニメーション（[speed-review.html:24-64](../../../02_dashboard/speed-review.html#L24)） |
| `sortable-header` | ヘッダボタン共通クラス。`data-sort-key` 属性でソート対象列を指定 |
| `dayFilterSelect` | 簡易検索の「表示対象日」セレクト。会期全体 / N 日目 / カスタム |
| `availableDateRange` | `getSurveyPeriodRange()` から得る `{start: Date, end: Date}` の会期範囲 |
| `timeSeriesAxisMode` | 時間帯グラフの X 軸モード。`'auto' / 'fixed'`（固定は 9-19 時） |
| `currentMatrixRowId` | マトリクス設問で選択中の行 id。`'all'`（`matrix_ma` のみ）または行 id |
| `isFreeAccountUser` | プレミアム機能（`graphButton`）のゲーティング判定値（§5.10、§11-1） |
| `FAILED_IMAGE_FETCH_THRESHOLD` | 画像 URL 解決の失敗許容回数（= 5）。超過で HEAD/GET 停止 |
| `BATCH_SIZE` | 画像 URL 解決のバッチサイズ（= 10）。同時 fetch 数の上限 |
| `STORAGE_NAMESPACE` | UI 状態保存の localStorage 名前空間（= `'speedReview'`） |
| インライン展開行 | テーブル行直下に `<tr class="inline-detail-row">` を挿入して名刺画像 + 簡易情報を表示する機能 |
| フリーアカウント誘導モーダル | `modals/premiumFeatureModal.html`。`isFreeAccountUser=true` で「詳細分析」押下時に表示 |

---

## 11. 関連ファイル・デッドコード棚卸し

**メインファイル**:

| パス | 行数 | 役割 |
|------|------|------|
| `02_dashboard/speed-review.html` | 622 | 単一ページ DOM + 冒頭 CSS + 末尾インライン `renderMatrixChartApex()` |
| `02_dashboard/src/speed-review.js` | 3208 | `initializePage` エントリ + 全イベントハンドラ + 集計ロジック |
| `02_dashboard/src/ui/speedReviewRenderer.js` | 765 | `populateTable` / `renderInlineRow` / `renderModalContent` / `populateModal` / `openCardZoom` / `handleModalImageClick` |
| `02_dashboard/src/services/dateFilterService.js` | 112 | 会期範囲取得・日付フィルタ オプション構築 |
| `02_dashboard/src/services/speedReviewService.js` | 355 | **全体未使用（§11-10）**。CSV パーサ + `fetchSurveys/Answers/BusinessCards` メソッド |
| `02_dashboard/src/modalHandler.js` | — | `handleOpenModal` / `openModal`（共通モーダル基盤） |
| `02_dashboard/src/constants/chartPalette.js` | — | `COMMON_CHART_DONUT_PALETTE` を export |
| `02_dashboard/src/breadcrumb.js` | — | `initBreadcrumbs` + `generateBreadcrumbs` |
| `02_dashboard/src/sidebarHandler.js` | — | `getCurrentGroupAccountType()` を export（`'free' / その他`） |

**モーダル HTML**:

| パス | 読込関数 | 備考 |
|------|----------|------|
| `modals/reviewDetailModal.html` | `handleOpenModal('reviewDetailModalOverlay', ...)` | 詳細 + 編集切替 |
| `modals/questionSelectModal.html` | `handleOpenModal('questionSelectModalOverlay', ...)` | 設問リスト |
| `modals/cardImagesModal.html` | `handleOpenModal('cardImagesModalOverlay', ...)` | **配線未完（§11-9）** |
| `modals/premiumFeatureModal.html` | `handleOpenModal('premiumFeatureModalOverlay', ...)` | フリーアカウント向け |

**流入元**:

| 元 | 経路 |
|----|------|
| `index.html`（アンケート一覧） | カード / 行クリック → `speed-review.html?surveyId=...` |
| `graph-page.html` | パンくず「SPEEDレビュー」リンク（[breadcrumb.js:73-77](../../../02_dashboard/src/breadcrumb.js#L73) が `../02_dashboard/speed-review.html?surveyId=...` に動的解決） |
| `surveyDetailsModal` / `first-login-tutorial` 等 | (要精査) 子エージェント推定範囲外 |

**離脱先**:

| 先 | トリガー |
|----|---------|
| `graph-page.html?surveyId=...` | `#graphButton`（プレミアムアカウント）|
| 同一 URL | ステート変更後のリロード（UI 状態は localStorage から復元） |

**LocalStorage キー**:
- `speedReview:{surveyId \| currentSurvey?.id \| 'unknown'}:uiState`（§6.5）

**死コード・未配線箇所 一覧**:

| 対象 | 状態 | §11 参照 |
|------|------|----------|
| `speedReviewService.js` 全体（355 行） | import されているがメソッド呼出なし | 11-10 |
| `showCardImagesModal` 関数（`modals/cardImagesModal.html`） | 配線未完 | 11-9 |
| `populateQuestionSelector(allCombinedData)`（非モーダル呼出） | `#question-selector-container` なしで no-op | 11-8 |
| `setupSortListeners` keydown 分岐 | `<button>` のみが来るため到達不能 | 11-7 |
| `#graphButton` フォールバック surveyId `sv_0001_24001` | `initializePage` throw で到達不能 | 11-6 |
| 名刺データ `data/business-cards/` フォールバック | ディレクトリ移行残骸 | 11-11 |

---

## 12. 関連仕様書との関係

本書の周辺に位置する別スコープ仕様書。相互依存ではなく「共通データ源泉」「類似画面パターン」「別スコープ資料」に分類。

### 12.1 関連仕様書一覧

| 仕様書 | 関係種別 | 接点 |
|--------|----------|------|
| `14_speed_review_sample_data_requirements.md` | **別スコープ保持（サンプルデータ要件）** | 本書の §7.1 / §8 受入基準の「900 件データセット」条件の根拠。`data/demo/demo_surveys/` + `demo_answers/` + `demo_business-cards/` の 3 ファイル整合条件（surveyId / answerId 一致）を規定。本書は消費側、14 番は生成側で分担。 |
| `16_bizcard_settings_requirements.md` | 連動（ステータス源泉） | 名刺データ化設定で `bizcardRequest` / `dataConversionPlan` を確定した回答が `cardStatus` として本画面に流入。本書は表示側、16 番は設定側。両者の連結は `businessCard` オブジェクトの有無と `cardStatus === 'processing'` 判定（[speed-review.js:1494](../../../02_dashboard/src/speed-review.js#L1494)）のみ。 |
| `17_thank_you_email_settings_requirements.md` | 連動（共有クーポン・同一 surveyId） | 現行 SPEEDレビュー画面には直接連動経路はないが、同一 `surveyId` でアンケート単位の設定を共有する兄弟画面。将来クーポン適用状態を本画面で可視化する場合の起点。 |
| `07_graph_page_requirements.md`（グラフページ要件） | 連動（遷移先） | `#graphButton` → `graph-page.html?surveyId=...`。データ源泉は同一（`data/core/surveys.json` + `demo_answers` + `demo_business-cards`）で、本画面は「一覧 + 簡易ダッシュボード」、グラフページは「全設問分析 + Excel 出力」の分担。 |
| `11_plan_feature_restrictions.md`（想定） | 参照のみ | フリーアカウント判定の正規定義先。§11-1 の `plan-capabilities.json` 連動実装時に本書 §5.10 を書換える。 |
| `15_help_center_requirements.md` / `16_bizcard_settings_requirements.md` | スタイル参照元 | 本書 v2.0「実装トレース型」の書式リファレンス。`_archive` 運用方針を共有。 |

### 12.2 エクスポート機能の取扱い

旧仕様書 §5「プラン別エクスポート権限マトリクス」は **本画面には存在しない機能**（§5.7 / §11-3）であり、以下の所管で扱う:

- **アンケート回答 CSV/Excel** → `index.html`（アンケート一覧のダウンロードオプション）
- **分析 Excel レポート** → `graph-page.html` の一括出力
- **名刺入力データ / 名刺画像 / 結合データ** → プラン別機能制限仕様書（`11_plan_feature_restrictions` 想定）

したがって本書は「本画面にはエクスポート UI なし、上記画面に委譲」の 1 文で管理し、マトリクス詳細は関連仕様書側で維持する。

---

## 13. 旧仕様書からの移行マップ

本書 v2.0 は以下 3 本の統合結果。

| 旧ファイル | 行数 | 本書への扱い | 備考 |
|------------|------|--------------|------|
| `06_speed_review.md`（旧） | 138 | **本書にマージ（主幹）** | 章立て「概要 / 画面目的 / レイアウト / 機能 / 画面フロー / データ連携 / 非機能」を本書の §1-7 に再配置。省略記述（「変更なし、ここでは省略」）は実装起点で書き起こし。 |
| `speed_review_requirements_current.md` | 130 | **本書に吸収完了** | 「2. 画面体験仕様」「3. 機能仕様とロジック」「5. データエクスポートとプラン制限」を §4 画面構成 / §5 機能要件 / §5.7 エクスポート に振り分け。§11-5「未回答を末尾へ」の未実装指摘を §11 に継承。親エージェントにて `_archive/` へ移動予定。 |
| `14_speed_review_sample_data_requirements.md` | 76 | **独立保持（別スコープ）** | サンプルデータ生成条件（S/M/L・12 形式・会期分布）は本画面の消費側要件ではなく生成側要件のため、別仕様書として維持。本書 §12.1 に関係性のみ明記。 |

**吸収時の注意点**:

- 旧 `06_speed_review.md` §3.3 の「モーダル データマッピング表」（`businessCard.name` → `group2.lastName + firstName` 等）は実装側で `businessCard.group2.lastName + ' ' + group2.firstName` に進化しており、本書 §5.4 / §6.1 を正とする。
- 旧 `speed_review_requirements_current.md` §3.1 の状態管理変数リスト（`allCombinedData` / `currentSurvey` / `currentIndustryQuestion` / `currentDateFilter` / `currentPage`）は現行 `speed-review.js` 冒頭（[speed-review.js:11-27](../../../02_dashboard/src/speed-review.js#L11)）に `currentStatusFilter` / `currentMatrixRowId` / `timeSeriesAxisMode` / `restoredUiState` / `imageUrlResolutionCache` / `failedImageFetchCount` など 6 変数が追加されているため、本書 §6.5 / §10 を正とする。
- 旧仕様の「ダウンロードボタン」記述（2 ヶ所）は画面実装に存在しないため削除。§12.2 エクスポート機能の取扱に限定。
- 旧仕様書間の矛盾（例: `speed_review_requirements_current.md` §3.2.3 「未回答末尾ソート」 vs 現行実装）は §11-5 の Phase 2 項目として継承し、実装時に決着。

---

**文書履歴**:
- 2026-04-24: v2.0 発行（3 本統合 + 実装トレース化）
