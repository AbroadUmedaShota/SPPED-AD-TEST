---
owner: product
status: draft
last_reviewed: 2026-04-24
---

# グラフ分析画面 要件定義書

> **TL;DR**
> - 対象は `02_dashboard/graph-page.html`（200 行）と `02_dashboard/src/graph-page.js`（2,434 行）の 2 ファイル。依存として `constants/chartPalette.js`、`services/dateFilterService.js`、共通 `utils.js`、`breadcrumb.js`、`modals/exportOptionsModal.html`（fetch 後注入）を伴う。本書はこれら現行実装を根拠にした「実装トレースドキュメント」。
> - 従来 2 本存在した `07_graph_analysis.md`（v1.x「Insight Finder」構想）と `07_graph_page_requirements.md`（v1.x ApexCharts ベースの機能定義）を本書 v2.0 に統合。`07_graph_analysis.md` が要求していた 3-Pane / Premium Upsell / 属性フィルタ / クロス集計 / VS モード / PDF レポート / ドリルダウン等は **すべて未実装**であり、§9 将来計画に送る。実装は「期間フィルタ + 設問別カード + Excel 一括出力」の単一画面。
> - チャートライブラリは **ApexCharts 3.45.2**（CDN）、画像化は **html2canvas 1.4.1**、Excel 化は **ExcelJS 4.4.0**、日付入力は **flatpickr**（ja ロケール）。画面は Tailwind CDN + Material Icons。ログイン認可ゲートは現状なし（§9-3）。
> - 表示設定 5 項目（サマリー / 数値ラベル / 中央合計 / 詳細表 / グリッド線）は `localStorage.graphPage_displayOptions` で永続化。期間フィルタは `URLSearchParams.surveyId` のみ受け取り、期間等の URL ハンドオフは未実装。
> - 多言語対応は画面文言が日本語ハードコードで、設問テキストのみ `question.text` を直接表示（`survey.name.ja` を固定参照）。i18n 化は **未着手**（§9-9）。
> - `07_graph_analysis.md` は本書に吸収完了。親エージェントが `_archive/` へ退避する。

## 1. 概要

### 1.1 優先度凡例

| 区分 | 意味 |
|------|------|
| **MVP** | 本版で必須。リリース条件。 |
| **Should** | 推奨。合理的理由があれば延期可。 |
| **Nice** | 任意。余力があれば対応。 |
| **Phase 2** | 本版対象外。§9 に集約。 |

### 1.2 目的・想定利用者

SPEED レビュー画面（`speed-review.html`）で個票を確認した広告運用担当が、同一アンケート `surveyId` に紐づく回答データ全体を「設問別の集計グラフ」として一覧し、会期内の期間絞り込み・表示設定切り替え・Excel 一括レポート化を行うための分析画面。主な想定利用者:

- 広告運用担当（SPEED レビューの「グラフ化」導線からプレミアム判定後に遷移）。
- 管理者（チーム内共有用の Excel レポートを生成して外部に配布する）。

### 1.3 対象範囲 / 対象外

**対象**:
- `02_dashboard/graph-page.html`（単一ページ）
- `02_dashboard/src/graph-page.js`（2,434 行、`initGraphPage` は `DOMContentLoaded` で起動）
- `02_dashboard/src/constants/chartPalette.js`（`COMMON_CHART_DONUT_PALETTE`、19 色）
- `02_dashboard/src/services/dateFilterService.js`（期間オプション生成・解決）
- `02_dashboard/modals/exportOptionsModal.html`（Excel 出力時に動的 fetch）
- `02_dashboard/src/breadcrumb.js`（パンくず注入）

**対象外**（§9 参照のみ）:
- 属性フィルタ / クロス集計 / ドリルダウン（旧 `07_graph_analysis.md` 要求、未実装）
- VS モード（左右分割比較、未実装）
- PDF レポート / 自動考察コメント（未実装）
- プレミアム判定ゲートの本実装（現状はフリー判定が呼出元 speed-review.js 側にあるが、graph-page.html 自体は URL 直打ちでアクセス可能、§9-3）
- 個別グラフ PNG ダウンロード（ApexCharts ネイティブツールバーは非表示で実質無効、§9-4）
- サーバーサイドデータ集計（現行は全件クライアント集計）

### 1.4 主要設定値一覧

実装に散在するマジックナンバー・初期値の集約。**太字**は「現行未実装・本書で仕様規定する対象外」項目（§9 に送る）。

| 設定値 | 現行値 | ソース / 参照 |
|--------|--------|--------|
| 既定 `surveyId` フォールバック | `sv_0001_24001` | [graph-page.js:88](../../../02_dashboard/src/graph-page.js#L88) |
| 表示設定 localStorage キー | `graphPage_displayOptions` | [graph-page.js:45](../../../02_dashboard/src/graph-page.js#L45) |
| 表示設定既定 | `showSummary=true / showDataLabels=true / showCenterText=true / showTable=true / showGrid=false` | [graph-page.js:46-52](../../../02_dashboard/src/graph-page.js#L46) |
| ドーナツ chart `size` | `72%` | [graph-page.js:821](../../../02_dashboard/src/graph-page.js#L821) |
| 棒グラフ `barHeight` | `60%` | [graph-page.js:845](../../../02_dashboard/src/graph-page.js#L845) |
| ApexCharts アニメ時間 | `800ms easeinout` | [graph-page.js:809](../../../02_dashboard/src/graph-page.js#L809) |
| グラフ基準高さ | `350px`（ドーナツ時は `legendConfig.chartHeight`=350 または 380） | [graph-page.js:769](../../../02_dashboard/src/graph-page.js#L769) |
| 凡例右寄せ判定閾値 | 項目 > 6 or 最長 ≥ 12 or 合計 ≥ 60 文字 | [graph-page.js:1720](../../../02_dashboard/src/graph-page.js#L1720) |
| マトリクス行あたり高さ | `rowHeight=40, baseHeight=100` | [graph-page.js:762-763](../../../02_dashboard/src/graph-page.js#L762) |
| Excel 書出し `html2canvas` | `scale: 2`, `backgroundColor: '#ffffff'` | [graph-page.js:1410](../../../02_dashboard/src/graph-page.js#L1410) / [:1594](../../../02_dashboard/src/graph-page.js#L1594) |
| マトリクス行チャート描画待機 | `500ms setTimeout` | [graph-page.js:1406](../../../02_dashboard/src/graph-page.js#L1406) |
| Excel メインループ yield | `50ms setTimeout` | [graph-page.js:1206](../../../02_dashboard/src/graph-page.js#L1206) |
| Excel シート名規則 | `Q{番号}`（除外系は `Ex_Q{番号}`） | [graph-page.js:1264](../../../02_dashboard/src/graph-page.js#L1264) |
| Excel 通常チャート画像幅 | 480px（高さ比例） | [graph-page.js:1599](../../../02_dashboard/src/graph-page.js#L1599) |
| Excel マトリクス行画像幅 | 400px | [graph-page.js:1415, 1509](../../../02_dashboard/src/graph-page.js#L1415) |
| 出力完了オーバーレイ表示時間 | 2,500ms + 700ms フェード | [graph-page.js:1744-1750](../../../02_dashboard/src/graph-page.js#L1744) |
| フォント | Inter / Noto Sans JP（`font-weight=400/500/700/900`） | [graph-page.html:20](../../../02_dashboard/graph-page.html#L20) |
| devicePixelRatio 固定 | **実装なし**（HTML/JS に `devicePixelRatio` 設定なし） | §9-5 |
| **属性フィルタ / ドリルダウン** | **未実装** | §9-1 |
| **VS モード / クロス集計** | **未実装** | §9-1 |
| **PDF レポート** | **未実装** | §9-2 |
| **i18n** | **未実装**（日本語ハードコード / `survey.name.ja` 直参照） | §9-9 |
| **認可チェック** | **未実装**（graph-page.html へは URL 直打ちでアクセス可能） | §9-3 |

---

## 2. 対象画面・関連ファイル

- `02_dashboard/graph-page.html`（200 行、単一 HTML）
- `02_dashboard/src/graph-page.js`（2,434 行。`DOMContentLoaded` で `initGraphPage()`、本画面専用。エクスポートなし、グローバル state は module scope）
- `02_dashboard/src/constants/chartPalette.js`（20 行。`COMMON_CHART_DONUT_PALETTE`：19 色のカラーパレット）
- `02_dashboard/src/services/dateFilterService.js`（113 行。`getSurveyPeriodRange` / `buildDateFilterOptions` / `applyDateFilterOptions` / `resolveDateRangeFromValue` / `formatDateYmd`）
- `02_dashboard/src/utils.js`（`resolveDashboardDataPath` / `resolveDemoDataPath` / `showToast` を利用）
- `02_dashboard/src/breadcrumb.js`（`initBreadcrumbs()` で `#breadcrumb-container` を描画。[breadcrumb.js:15-19](../../../02_dashboard/src/breadcrumb.js#L15) に `graph-page.html` 専用パンくず定義）
- `02_dashboard/modals/exportOptionsModal.html`（72 行。初回 `excel-export-all` クリック時に `fetch` で注入）
- 共通注入（`main.js` 経由、本 HTML は個別に `#header-placeholder` / `#sidebar-placeholder` / `#footer-placeholder` / `#breadcrumb-container` のプレースホルダ div を持つ）

**依存 CDN**（`graph-page.html` 冒頭）:
- Tailwind CDN（`plugins=forms,container-queries`、[graph-page.html:9](../../../02_dashboard/graph-page.html#L9)）
- Material Icons（同:11）
- ApexCharts 3.45.2（`defer` 属性付き、同:13）
- flatpickr CSS / JS（同:15, 191-192）+ ja ロケール
- html2canvas 1.4.1（同:193）
- ExcelJS 4.4.0（同:194）
- Google Fonts Inter / Noto Sans JP（同:20）
- プロジェクト内: `service-top-style.css`（同:17）

**流入元**:
- [speed-review.js:1871-1886](../../../02_dashboard/src/speed-review.js#L1871) `#graphButton` クリック時、`isFreeAccountUser=false` のときのみ `location.href = graph-page.html?surveyId=...`。フリーアカウントは `openPremiumFeatureModal()` でブロックされる（speed-review.js 側ゲート）。`surveyId` が取得できない場合は `sv_0001_24001` にフォールバック。
- URL 直打ち（`graph-page.js:88` でも同じフォールバック）。

**離脱先**:
- パンくず「アンケート一覧」→ `../02_dashboard/index.html`
- パンくず「SPEED レビュー」→ `../02_dashboard/speed-review.html?surveyId=...`
- サイドバー / ヘッダー経由の通常ナビゲーション

---

## 3. 改訂履歴

- **v2.0 (2026-04-24)**: 2 本統合 + 実装トレース型へ全面刷新。`07_graph_analysis.md`（v1.x「Insight Finder」構想 / 3-Pane / Premium Upsell / 属性フィルタ / VS モード / PDF レポート 等）と `07_graph_page_requirements.md` v1.x（ApexCharts + `scale:2` 一括出力 + 表示設定 5 項目）の抽象記述を破棄し、`graph-page.html` 200 行 + `graph-page.js` 2,434 行の現行実装を逐行トレース。旧 `07_graph_analysis.md` が要求していた属性フィルタ・クロス集計・VS モード・ドリルダウン・PDF 出力・Premium Upsell Modal はすべて未実装であるため §9 将来計画に送り、現行は「期間フィルタ + 設問別カード + Excel 一括出力 + 表示設定 5 項目」のみを MVP とする。`07_graph_analysis.md` は本書に吸収完了、`_archive/` へ退避予定。
- **v1.x (〜 2026-02-25)**: `07_graph_page_requirements.md` が機能要件（ApexCharts、ハイブリッド Excel、バックグラウンド出力、離脱防止、フローティング進捗、ApexCharts `scale:3` 個別 PNG 等）を本番要件として記述、`07_graph_analysis.md` は 3-Pane / Premium Upsell / クロス集計の別構想。2 本が並走して整合性取れず、v2.0 で統合・実装トレース化した。

---

## 4. 画面構成

### 4.1 全体レイアウト（ASCII ツリー）

`body.bg-background` 直下に 1 カラム構成（左サイドバー + メイン）。メイン `<main id="main-content">` 内は `max-w-6xl mx-auto`、上部パンくず → タイトル → 分析フィルター（sticky） → 表示設定 → チャートカード 2 列グリッドの縦積み。

```
<body class="bg-background text-on-background">
├── #header-placeholder                                  … 共通ヘッダー注入
├── #sidebar-placeholder                                 … 共通サイドバー注入
├── #mobileSidebarOverlay                                … モバイル用オーバーレイ
└── <div class="flex flex-1 bg-background">
    └── <main id="main-content">
        └── <div class="flex flex-col w-full max-w-6xl mx-auto flex-1">
            ├── #breadcrumb-container                    … パンくず注入（§4.2）
            ├── <h1 id="survey-title">                   … 「グラフ分析」→ 読込完了後「グラフ分析: {survey.name.ja}」
            ├── <button id="excel-export-all">           … Excel 一括出力トリガ
            ├── 分析コントロール（sticky top-16 z-30）
            │   ├── メインツールバー（期間セレクタ + リセット）
            │   │   ├── #dayFilterSelect                 … 「会期全体」+「X日目」+「カスタム範囲」
            │   │   └── #resetFiltersButton              … 期間フィルタのリセット
            │   ├── #detailed-search-content (.hidden)   … カスタム時のみ展開
            │   │   ├── #startDateInput                  … flatpickr (ja)
            │   │   └── #endDateInput                    … flatpickr (ja)
            │   └── 表示設定バー（5 チェックボックス）
            │       ├── #opt-show-summary                … サマリーバッジ
            │       ├── #opt-show-datalabels             … グラフ内数値
            │       ├── #opt-show-center-text            … ドーナツ中央合計
            │       ├── #opt-show-table                  … 詳細データ表
            │       └── #opt-show-grid                   … グリッド線（棒グラフのみ）
            ├── #loading-indicator                       … 初期ローディング（role="status"）
            ├── #error-display (.hidden)                  … エラー表示（role="alert"）
            └── #charts-container (grid md:grid-cols-2 gap-8)
                └── <div data-chart-card-id="...">*      … renderCharts() で動的生成
                    ├── ヘッダ (chip / title / valid-answers / insight-badge)
                    ├── chart-type-btn 群（allowToggle=true のときのみ）
                    ├── #chart-{id}                      … ApexCharts マウントポイント
                    └── #summary-{id}                    … 詳細データ表

├── #export-progress-overlay (fixed bottom-8 right-8 hidden)
│   └── 進捗アイコン + テキスト + バー（#export-progress-icon / text / bar / percent）
├── #footer-placeholder
└── #export-options-modal-container                      … 初回クリック時に fetch 注入
```

### 4.2 パンくず・タイトル

- パンくず定義 [breadcrumb.js:15-19](../../../02_dashboard/src/breadcrumb.js#L15):
  ```
  アンケート一覧 > SPEED レビュー > グラフ分析
  ```
  「SPEED レビュー」は動的リンク（[breadcrumb.js:73-77](../../../02_dashboard/src/breadcrumb.js#L73)）で、`surveyId` が URL にあれば `../02_dashboard/speed-review.html?surveyId=...`、無ければ親ディレクトリパスにフォールバック。`graph-page.html` が別ディレクトリ想定のため `../02_dashboard/` プレフィックス付き。
- タイトル `<h1 id="survey-title">` は初期値「グラフ分析」。`loadAndRenderCharts()` 成功後に「グラフ分析: {survey.name.ja}」へ上書き（[graph-page.js:303](../../../02_dashboard/src/graph-page.js#L303)）。`survey.name.en` など他ロケールは参照しない（§9-9）。

### 4.3 分析コントロール（sticky ツールバー）

- 親ラッパ `.sticky top-16 z-30 backdrop-blur-md` で画面上端に追従。
- メイン行: `filter_alt` アイコン + 「分析フィルター」ラベル（uppercase tracking-[0.24em]）+ `#dayFilterSelect` + 右端 `#resetFiltersButton`。
- `#dayFilterSelect` の初期 options は HTML に `all` / `custom` の 2 件しかなく、`loadAndRenderCharts()` 完了後に `buildDateFilterOptions(availableDateRange)` が `all / {YYYY-MM-DD}*N / custom` に再構築し `applyDateFilterOptions()` で流し込む（[graph-page.js:115-117](../../../02_dashboard/src/graph-page.js#L115)）。
- 「カスタム範囲」選択時のみ `#detailed-search-content` から `.hidden` を外し、`#startDateInput` / `#endDateInput`（flatpickr, `enableTime: true, dateFormat: 'Y-m-d H:i'`）を表示（[graph-page.js:145-148](../../../02_dashboard/src/graph-page.js#L145)）。
- `flatpickr` の `minDate` / `maxDate` は `availableDateRange.start` / `.end`。`onChange` で両ピッカーの選択値が揃ったら `currentDateFilter = [start, end]` に格納し `triggerChartUpdate()`（[graph-page.js:124-132](../../../02_dashboard/src/graph-page.js#L124)）。
- 表示設定バー: `filter-chip-input` + `filter-chip-label` の 5 チェック。初期値は `localStorage.graphPage_displayOptions` から復元（§5.7）。各チェックは `change` で `displayOptions[key]` を更新し `saveDisplayOptions()` → `triggerChartUpdate()` で **全チャート再描画**（[graph-page.js:180-185](../../../02_dashboard/src/graph-page.js#L180)）。「グリッド線（棒グラフのみ）」はラベル上で明示。

### 4.4 チャートカード（`#charts-container` 内）

`renderCharts()` が `chartsData` 配列を走査して動的に挿入（[graph-page.js:431-575](../../../02_dashboard/src/graph-page.js#L431)）。1 カード = 1 設問（マトリクスはカード 1 枚内でセレクタ切替）。

| 領域 | クラス / id | 内容 |
|------|--------------|------|
| 外枠 | `[data-chart-card-id="chart-{id}"]` | `bg-surface rounded-2xl border border-outline-variant shadow-sm` |
| 左縦線（マトリクス時） | `.bg-primary/40 absolute left-0 top-0 bottom-0 w-1` | マトリクス識別用のビジュアル差別化 |
| ヘッダ | `p-5 border-b` | アイコン + chip（`Q1`/`Ex_Q5` 等） + タイトル + 有効回答件数 + インサイトバッジ |
| アイコン | `material-icons text-lg` | `analytics`（通常）/ `subject`（`blank` / `list`） |
| chip | `[data-role="question-chip"]` | `formatQuestionChip(questionId)` 結果（`Q{数値}`、マトリクスなら `[選択 index / 総数]` 付き） |
| インサイトバッジ | `.bg-primary/5 border border-primary/10` | `displayOptions.showSummary=true` かつ非 blank/list/matrix のみ表示。通常: `Top {label} {percent}%`、rating_scale: `Avg {avg} / {points}` |
| コントロール行 | `.flex flex-wrap items-center justify-between` | `buildChartTypeButtons()`（棒/円切替） |
| グラフ領域 | `#chart-{id}` (div, `min-h-[350px]`) | ApexCharts マウント |
| 詳細表 | `#summary-{id}` | `renderChartSummaryTable()` で `innerHTML` 注入 |
| マトリクス行セレクタ | `[data-role="matrix-row-selector"]` | ヘッダ右側の `<select>`。`matrixSelectorType` が `row` なら行、`column` なら列を切替 |

**card.innerHTML** の構造要点（[graph-page.js:513-551](../../../02_dashboard/src/graph-page.js#L513)）:
- ヘッダ内 `.flex.justify-between` の左側に `アイコン + chip + タイトル`、右側に `matrixSelectorHtml + actionButtons`（ただし `buildActionButtons` は空文字を返し現状無効、§9-4）。
- コントロール行は `list` 型を除き常に描画するが、`chartTypeButtons` は `allowToggle=false` の現行実装では常に空文字のため**実質無い**（§9-6）。

### 4.5 ローディング・エラー・空

| 状態 | ノード | 挙動 |
|------|--------|------|
| 読み込み中 | `#loading-indicator (.text-center py-16)` | `showLoading(true)` で `display=block` + `#charts-container` をスケルトンカード×4 に上書き（[graph-page.js:1660-1688](../../../02_dashboard/src/graph-page.js#L1660)） |
| エラー | `#error-display`（`role="alert"`） | `showError(message)` で `.hidden` を外し `#error-message` にメッセージ注入 |
| グラフ 0 件 | `#charts-container.innerHTML` | 「このアンケートにグラフ化可能な質問がありません。」を 1 段落で表示 |

### 4.6 Excel 出力 UI

- `<button id="excel-export-all">`: ヘッダ右端、通常時は `file_download` + 「Excel 一括出力」。実行中は `sync`（spinner）+ 「出力タスク実行中」+ `opacity-0.7`（[graph-page.js:1210-1217](../../../02_dashboard/src/graph-page.js#L1210)）。
- `#export-options-modal-container`: 初回クリックで `fetch('modals/exportOptionsModal.html')` → `innerHTML` 注入。以後はキャッシュ利用。モーダル構造は [exportOptionsModal.html:2-71](../../../02_dashboard/modals/exportOptionsModal.html#L2)。
  - `#export-opt-toc`（目次シート）
  - `#export-opt-charts`（グラフ画像を含める）
  - `#export-opt-matrix-all`（マトリクス全項目を出力）
  - `#export-opt-exclusions`（対象外設問リストを含める）
  - 4 項目すべて `checked` 初期、確定ボタン `#confirm-export-btn`。
- 進捗 `#export-progress-overlay`: `fixed bottom-8 right-8 z-[100] hidden` の浮遊パネル。アイコン `#export-progress-icon`（`sync` → 完了時 `check_circle` + `text-success`）、テキスト `#export-progress-text`、バー `#export-progress-bar`（width: `{percent}%`）、パーセント `#export-progress-percent`（[graph-page.html:161-184](../../../02_dashboard/graph-page.html#L161)）。
- 離脱警告: `isExporting=true` 中に `beforeunload` で `e.preventDefault()` + `e.returnValue=''`（[graph-page.js:91-96](../../../02_dashboard/src/graph-page.js#L91)）。

### 4.7 レスポンシブ

- チャートグリッドは `grid grid-cols-1 md:grid-cols-2 gap-8`。`md`（768px）以上で 2 列、未満で 1 列（[graph-page.html:153](../../../02_dashboard/graph-page.html#L153)）。
- メイン最大幅 `max-w-6xl`（1152px）。外側 padding `px-4 sm:px-6 lg:px-8`。
- 期間ツールバーの期間セレクタは `flex-1 min-w-[240px] max-w-md`。
- ApexCharts 側は `width: '100%'` + 固定 `height`（§5.6）で、コンテナ幅変化に追従する。
- flatpickr / ApexCharts のモバイル最適化（タッチ操作向け）は特段の追加設定なし。

---

## 5. 機能要件

### 5.1 初期化フロー [**MVP**]

`DOMContentLoaded` → `initGraphPage()`（[graph-page.js:6-8](../../../02_dashboard/src/graph-page.js#L6) / [:85-100](../../../02_dashboard/src/graph-page.js#L85)）。

1. `initBreadcrumbs()` でパンくず注入。
2. `URLSearchParams(window.location.search)` から `surveyId` を取得。未指定なら `sv_0001_24001` にフォールバック（[:88](../../../02_dashboard/src/graph-page.js#L88)）。
3. `window.addEventListener('beforeunload', ...)` で `isExporting=true` 時のみ標準警告を発火（[:91-96](../../../02_dashboard/src/graph-page.js#L91)）。
4. `await loadAndRenderCharts(surveyId)` を実行（§5.2）。
5. `setupFilterEventListeners()` で期間セレクト・flatpickr・表示設定・リセットをバインド（§5.3）。

現行実装は **認可チェックを行わない**。`graph-page.html?surveyId=xxx` を直接開くと、ゲスト・フリーユーザーを含め誰でも到達可能（§9-3）。

### 5.2 データ取得（loadAndRenderCharts） [**MVP**]

エントリ [graph-page.js:247-313](../../../02_dashboard/src/graph-page.js#L247)。

1. `showLoading(true)`。
2. `fetchWithFallback(relativePath, type)` を 2 段ブート:
   - 1 段目 `resolveDashboardDataPath(relativePath)`（`02_dashboard/data/...`）を試行。
   - 2 段目で `resolveDemoDataPath(relativePath)`（`docs/サンプル/...`）を試行。
   - どちらも失敗し `type==='survey'` なら `throw`、`answers` なら空配列を返す。
3. `Promise.all`:
   - `fetchWithFallback('surveys/{surveyId}.json', 'survey')`
   - `fetchWithFallback('responses/answers/{surveyId}.json', 'answers')` → 空なら `answers/{surveyId}.json` にフォールバック（[:278-285](../../../02_dashboard/src/graph-page.js#L278)）。
4. 生 answers が `{ surveyId, answers: [...] }` 形式の場合は `answers.answers` を取り出す（[:293-298](../../../02_dashboard/src/graph-page.js#L293)）。
5. `originalAnswers = answersArray` に格納、`availableDateRange = getSurveyPeriodRange(currentSurvey, originalAnswers)`（[:301](../../../02_dashboard/src/graph-page.js#L301)）。
6. タイトルを `グラフ分析: {survey.name.ja}` へ更新。
7. `processDataForCharts()` → `renderCharts()` で初回描画。
8. 失敗時は `showError(e.message)`、`finally` で `showLoading(false)`。

### 5.3 期間フィルタ設定（setupFilterEventListeners） [**MVP**]

エントリ [graph-page.js:105-199](../../../02_dashboard/src/graph-page.js#L105)。

- `flatpickr.localize(flatpickr.l10ns.ja)` でロケール固定。
- `buildDateFilterOptions(availableDateRange)` がオプション配列を返し `applyDateFilterOptions()` で `<select>` を再構築。
  - `range` が null（回答 0 件）なら `['全期間', 'カスタム範囲']` のみ。
  - `range` ありなら `会期全体 (M/D - M/D)` → `1日目 (M/D)` → `2日目 (M/D)` → … → `カスタム範囲` を並べる（[dateFilterService.js:69-86](../../../02_dashboard/src/services/dateFilterService.js#L69)）。
- `#dayFilterSelect.change` ハンドラ:
  - `custom` → 詳細パネル展開、`currentDateFilter` は変更しない（flatpickr 側の onChange 待ち）。
  - それ以外 → 詳細パネル隠蔽 → `resolveDateRangeFromValue(val, availableDateRange)` を呼び、`all` なら `[start, end]`、`YYYY-MM-DD` 値なら `[startOfDay, endOfDay]` を返す → `currentDateFilter` に格納 → 両 flatpickr の selectedDates を同期 → `triggerChartUpdate()`（[:141-159](../../../02_dashboard/src/graph-page.js#L141)）。
- 初期表示は `resolveDateRangeFromValue('all', availableDateRange)` で会期全体を既定化（[:188-198](../../../02_dashboard/src/graph-page.js#L188)）。

`handleResetFilters()` は `currentDateFilter` を再度 'all' 範囲に戻し、セレクトを `all` に、詳細パネルを隠す、flatpickr も再セット（[:204-222](../../../02_dashboard/src/graph-page.js#L204)）。

### 5.4 triggerChartUpdate（フィルタ連動再描画） [**MVP**]

[graph-page.js:227-241](../../../02_dashboard/src/graph-page.js#L227)。

- `currentDateFilter` が `[start, end]` 形式なら `originalAnswers.filter(a => { date = new Date(a.answeredAt); return date >= start && date <= end; })`（`answeredAt` 欠損は除外）。
- フィルタ後の回答配列で `processDataForCharts(currentSurvey, answersToProcess)` を再実行 → `renderCharts()`。
- 発火元は期間セレクト、カスタム flatpickr `onChange`、リセットボタン、表示設定 5 チェック、の計 8 経路。**debounce なし**（§9-7）。

### 5.5 設問別集計・可視化（processDataForCharts） [**MVP**]

エントリ [graph-page.js:321-408](../../../02_dashboard/src/graph-page.js#L321)。`survey.details` を設問 ID 中の数字で昇順ソートし（`Q1, Q2, ..., Q10` 順を保証）、設問タイプ別にチャートデータを生成。

#### 5.5.1 設問タイプ分類

[graph-page.js:60-80](../../../02_dashboard/src/graph-page.js#L60) の Set 定義:

| 分類 | タイプ値 | 処理関数 | 既定チャート |
|------|----------|-----------|--------------|
| **SINGLE_CHOICE_TYPES** | `single_choice`, `dropdown`, `rating` | `buildChoiceSummary(isMulti=false)` | `pie`（ドーナツ） |
| **MULTI_CHOICE_TYPES** | `multi_choice`, `ranking` | `buildChoiceSummary(isMulti=true)` | `bar`（横棒、件数降順ソート） |
| **MATRIX_SINGLE_TYPES** | `matrix_sa`, `matrix_single` | `buildMatrixCharts(isMulti=false)` | `pie`（行セレクタで切替） |
| **MATRIX_MULTI_TYPES** | `matrix_ma`, `matrix_multi`, `matrix_multiple` | `buildMatrixCharts(isMulti=true)` | `bar`（列セレクタで切替） |
| **rating_scale** | `rating_scale`（ピンポイント） | `buildRatingScaleSummary` | `bar`（色: `generateScaleGradient`） |
| **BLANK_TYPES** | `text, free_text, free_answer, number, date, datetime, datetime_local, time, handwriting, image, photo, file, file_upload, upload, explanation` | `buildListChart` で一覧化（`explanation` は完全スキップ） | `list`（回答一覧表示） |
| その他（未対応） | — | `buildListChart(reason='未対応の設問タイプ')` | `list` |

#### 5.5.2 単一選択集計（buildChoiceSummary isMulti=false）

[graph-page.js:1870-1901](../../../02_dashboard/src/graph-page.js#L1870)。

- `normalizeChoiceOptions(question.options, question.type)` で選択肢を `{labels, map}` に正規化。`rating` タイプは `formatRatingLabel()` で `{数値} (★★★)` 形式のラベルへ変換（[:1822-1856](../../../02_dashboard/src/graph-page.js#L1822)）。
- 各回答の `findAnswerDetail()` で該当設問の `detail.answer` を取得。`Array.isArray` なら展開（単一選択でも配列入りのことがある）。
- 回答値ごとに `resolveOptionLabel()` でラベル確定 → `counts[label]++`。
- 出力: `{ labels, data, totalAnswers }`、ラベル順は `optionsInfo.labels`（定義順）を踏襲。
- `chartType='pie'`、`summaryType='table'`、`includeTotalRow=true`、`allowToggle=false`（[:352-364](../../../02_dashboard/src/graph-page.js#L352)）。

#### 5.5.3 複数選択集計（buildChoiceSummary isMulti=true）

- 同じロジックで `counts` を作るが、最後に `sort((a,b) => (b.count-a.count) || (a.index-b.index))` で **件数降順** に並べ替える（[:1893-1895](../../../02_dashboard/src/graph-page.js#L1893)）。
- `chartType='bar'`、`summaryType='table'`、`includeTotalRow=false`。

#### 5.5.4 rating_scale 集計

[graph-page.js:1903-1947](../../../02_dashboard/src/graph-page.js#L1903)。

- `question.config.points`（既定 5）で段階数確定（2 以上に clamp）。
- `minLabel / maxLabel / midLabel` を設問 config から取得、各段階カウント。平均 `totalScore / answeredCount`。
- ラベル例: `1 (最低)`, `2`, `3 (普通)`, `4`, `5 (最高)`（ミッドラベルは `showMidLabel=true` のときのみ）。
- `chartType='bar'`、`questionType='rating_scale'`、`ratingScaleAverage / ratingScalePoints` を付加。カードヘッダには `Avg {avg} / {points}` バッジ。
- 色は `generateScaleGradient(points)` で赤 → 緑のグラデーション（[:10-30](../../../02_dashboard/src/graph-page.js#L10)）。

#### 5.5.5 マトリクス集計（buildMatrixCharts）

[graph-page.js:2051-2150](../../../02_dashboard/src/graph-page.js#L2051)。

- `normalizeMatrixRows(question.rows)` / `normalizeMatrixColumns(question.columns ?? question.options)` で正規化。`rows` または `columns` が 0 件なら `buildBlankChart()` にフォールバック。
- 各 `row` に対し `extractMatrixRowResponses(detail.answer, row)` で該当行の回答を抽出。キー候補は `row.id`, `row.text`, `r{n}`, `row{n}`, 数字のみ（`normalizeMatrixKey` で空白・記号を削除して比較）。
- `rowDetails[]`: `{ rowIndex, rowId, rowText, data: columns.map(col=>count), labels: columns.map(c=>c.text), totalAnswers }`。
- `matrixSeries[]`: 各列を 1 シリーズとし `rowDetails.map(d => d.data[colIndex])` を転置格納。
- **SA（isMulti=false）**: `initialChartType='pie'`、`selectorType='row'`（行ごとに個別ドーナツ）、初期表示は `rowDetails[0]`。
- **MA（isMulti=true）**: `initialChartType='bar'`、`selectorType='row'`（※コード上は常に `row` のまま、変数 `selectorType` は `'row'` 固定で未代入、[:2105](../../../02_dashboard/src/graph-page.js#L2105)）。`totalAnswers` は全行合計。
- `summaryType='matrix_table'`、`isMatrix=true`、`matrixIndex=1`、`matrixTotal=rows.length`。

#### 5.5.6 自由記述・添付（buildListChart）

[graph-page.js:2199-2220](../../../02_dashboard/src/graph-page.js#L2199)。

- `collectListEntries()` で `{ value, answeredAt, answeredAtLabel, answerId, surveyId, type }` の配列を作成、`answeredAt` 降順ソート（最新が先頭）。
- `listAll`（全件）と `listItems`（先頭 3 件）を保持。
- `chartType='list'`、`summaryType='table'`。メイングラフ領域は空（`buildChartArea` が `''` を返す、[:2250-2252](../../../02_dashboard/src/graph-page.js#L2250)）。
- 画像・ファイル系の値は `renderChartSummaryTable` 内で「`{surveyId}_{seq}_{qNum}_{type}.{ext}`」形式のリンク名に整形され、`window.previewImage()` 経由でモーダルプレビュー可能（[:1031-1066](../../../02_dashboard/src/graph-page.js#L1031)）。

#### 5.5.7 チャート描画（createChart）

ApexCharts 3.45.2 で描画。主な制御パラメータ [graph-page.js:799-911](../../../02_dashboard/src/graph-page.js#L799)。

| 項目 | 値 / 振舞い |
|------|-----------|
| `chart.type` | `pie` → `'donut'`、それ以外 → `'bar'` |
| `chart.height` | マトリクス stacked / 水平棒 → `baseHeight(100) + categoryLabels.length*40 + legend.height` を `max(350, ...)`、ドーナツ → `legendConfig.chartHeight`（350 / 380）、それ以外 → 350 |
| `chart.width` | `'100%'` |
| `chart.fontFamily` | `'Noto Sans JP', sans-serif` |
| `chart.toolbar.show` | **false**（= ApexCharts ネイティブ PNG エクスポートバー非表示、§9-4） |
| `chart.animations` | `enabled:true, easing:'easeinout', speed:800` |
| `colors` | matrix stacked → `COMMON_CHART_DONUT_PALETTE`、`rating_scale` → `generateScaleGradient`、ドーナツ・棒 → `GRAPH_CHART_DONUT_PALETTE`（= COMMON_CHART_DONUT_PALETTE、[:54](../../../02_dashboard/src/graph-page.js#L54)） |
| `plotOptions.pie.donut.size` | `72%` |
| `plotOptions.pie.donut.labels` | `show: displayOptions.showCenterText`、合計ラベル「有効回答数」、値 `totalAnswers.toLocaleString()` |
| `plotOptions.bar.horizontal` | `true`（マトリクス bar もしくは 通常 bar、ほぼ常に水平棒） |
| `plotOptions.bar.distributed` | `!isDoughnut && !isMatrixStacked`（色分け） |
| `plotOptions.bar.borderRadius` | `4` |
| `plotOptions.bar.barHeight` | `60%` |
| `dataLabels.enabled` | matrix stacked は `true` 固定、それ以外は `displayOptions.showDataLabels` に従う |
| `dataLabels.formatter` | doughnut → `Math.round(val)+'%'`、stacked100 → `Math.round(val)+'%'`、それ以外 → `val>0 ? val : ''` |
| `legend.show` | ドーナツ or マトリクス stacked のみ |
| `legend.position` | `getLegendConfig` で `right`（項目多数時）/ `bottom`（既定） |
| `grid.show` | `displayOptions.showGrid`（棒のみ有効、ラベル明示） |
| `xaxis.labels.show` | `!isDoughnut` |
| `yaxis.labels.formatter` | 15 文字超は `...` で切詰 |
| `tooltip` | 非 stacked は既定、matrix stacked は `custom: tooltipForStacked`（件数 + 割合 + 行合計の 3 値表示） |

#### 5.5.8 マトリクス行セレクタ（applyMatrixRowSelection）

[graph-page.js:602-730](../../../02_dashboard/src/graph-page.js#L602)。

- `buildMatrixRowSelector()` は `matrixSelectorType='column'` なら列、それ以外（`row`）なら行を `<select>` に展開。項目数 ≤ 1 のときは非表示。
- `applyMatrixRowSelection(chartId, rowIndex)`:
  - `selectorType='column'` のパス: 選択された列 index の `matrixSeries[rowIndex]` を取り出し `chartData.data` を差替。`chartData.matrixRowText = selectedColumn.text`、chip を `[idx / columns.length]` に更新、`createChart` + `renderChartSummaryTable` を再実行。
  - `selectorType='row'` のパス（SA 既定）: `matrixRowDetails[rowIndex]` から `labels / data / totalAnswers` を差替、chip を `[idx / matrixTotal]`、有効回答件数を更新、`createChart` + `renderChartSummaryTable` を再実行。
- 注意: `buildMatrixCharts` の `selectorType` は実装上常に `'row'`（[:2105](../../../02_dashboard/src/graph-page.js#L2105)）で、`column` パスはコメント内で「`MA` を `column` にする想定」が言及されるが現行コードでは有効化されていない（§9-8）。

### 5.6 詳細データ表（renderChartSummaryTable） [**MVP**]

エントリ [graph-page.js:917-1149](../../../02_dashboard/src/graph-page.js#L917)。`summaryType` で分岐:

- **`matrix_table`**（[:921-982](../../../02_dashboard/src/graph-page.js#L921)）: 行 × 列の 2 次元表。各セルに `{count}件 ({ratio}%)`、行末に行合計、表末に列合計・全合計行。
- **`rating_table`**（[:984-1029](../../../02_dashboard/src/graph-page.js#L984)）: スコア / 件数 / 割合の 3 列 + 平均スコア行。
- **`list`**（[:1031-1101](../../../02_dashboard/src/graph-page.js#L1031)）: 回答文字列 / 回答日時。画像・添付系は `window.previewImage()` へのボタン化 + ファイル名推定（`{surveyId}_{seq}_{qNum}_{type}.{ext}`）。
- **通常（choice）**（[:1103-1148](../../../02_dashboard/src/graph-page.js#L1103)）: 項目 / 件数 / 割合 + `includeTotalRow` 時に合計行。

スクロール領域は `.chart-summary-scroll-area` クラスで縦スクロール可（`list` タイプは 15 行固定高 `.chart-summary-scroll-area--list-15`）。

### 5.7 表示設定（5 項目 + localStorage 永続化） [**MVP**]

| キー | UI ラベル | 初期値 | 影響範囲 |
|------|-----------|--------|----------|
| `showSummary` | サマリー | true | カードヘッダのインサイトバッジ（Top {n}% / Avg {x}） |
| `showDataLabels` | 数値ラベル | true | ApexCharts `dataLabels.enabled`（非 stacked） |
| `showCenterText` | 中央合計 | true | ドーナツ `plotOptions.pie.donut.labels.show` |
| `showTable` | 詳細表 | true | `shouldShowSummary` 判定。`list` タイプは false でも表示 |
| `showGrid` | グリッド線（棒グラフのみ） | false | ApexCharts `grid.show` |

- `loadDisplayOptions()` は `JSON.parse(localStorage.getItem('graphPage_displayOptions'))` を `DISPLAY_OPTIONS_DEFAULTS` にマージ（[:1646-1652](../../../02_dashboard/src/graph-page.js#L1646)）。壊れた JSON や未対応キーがあっても既定値で穴埋め。
- `saveDisplayOptions()` は `JSON.stringify(displayOptions)` をそのまま書込。
- 変更時は `saveDisplayOptions()` → `triggerChartUpdate()` で全カード再描画。サーバ永続化・マルチユーザー共有なし（[:180-185](../../../02_dashboard/src/graph-page.js#L180)）。

### 5.8 Excel 一括出力（executeExcelExport） [**MVP**]

エントリ [graph-page.js:1189-1642](../../../02_dashboard/src/graph-page.js#L1189)。サイズが大きいので処理フェーズ単位で整理。

#### 5.8.1 事前チェック・UI 準備

- `ExcelJS` が `window.ExcelJS` に存在しなければ `alert()` で終了（[:1190-1194](../../../02_dashboard/src/graph-page.js#L1190)）。
- `isExporting=true`、`excel-export-all` ボタンを disabled + spinner 表示、`#export-progress-overlay` をフェードイン、進捗アイコン `sync`・バー 0%。

#### 5.8.2 目次シート（options.includeTOC）

- `workbook.addWorksheet('目次', { views: [{ showGridLines: false }] })`。
- 1 行目: 「分析レポート 目次」（bold size 18）
- 2 行目: `アンケート: {survey.name.ja}`
- 3 行目: `出力日時: {new Date().toLocaleString('ja-JP')}`
- 5 行目: ヘッダ `No. / 設問内容 / シート`（太字 + `FFE0EDFF` 背景）
- 以降、各シート行が `hyperlink: #'{sheetName}'!A1` 形式のクリッカブルリンクで追加（[:1268-1271](../../../02_dashboard/src/graph-page.js#L1268)）。

#### 5.8.3 メインループ

`for (let i=0; i<chartsData.length; i++)` で各設問を処理。間に `await yieldToMain()`（50ms setTimeout）を挟みメインスレッドを解放、UI 操作継続可能（[:1206, 1257](../../../02_dashboard/src/graph-page.js#L1206)）。

- 進捗更新: `{total}件中 {n}件目を処理中...` + バー % 更新。
- シート名: `formatQuestionChip(questionId)`（例 `Q1`）。`blank` タイプは `Ex_{Q}` 形式（例 `Ex_Q5`）。`includeExclusions=false` かつ `blank` のときはシート作成スキップ（[:1262](../../../02_dashboard/src/graph-page.js#L1262)）。
- タイトル行: `{Q1}: {questionText}`（bold size 16）。

#### 5.8.4 データ表 + 画像（summaryType 別）

| `summaryType` / `chartType` | テーブル構造 | 画像処理 |
|------------------------------|--------------|----------|
| `matrix_table` (isMatrix pie) | `[行項目, col1, col2, ..., 合計]` + 全行 + 合計列 | includeCharts + SA → **各行を個別ドーナツに一時描画し html2canvas → addImage**（[:1325-1434](../../../02_dashboard/src/graph-page.js#L1325)）。`tempContainer` を画面外に生成して個別 ApexCharts インスタンスを作成、`animations.enabled=false`、`500ms` レンダ待機後キャプチャ。画像幅 400px。 |
| `matrix_table` (isMatrix bar) | 同上 | includeCharts + MA → **各行を個別横棒に一時描画**（[:1436-1525](../../../02_dashboard/src/graph-page.js#L1436)）。構造は SA と同様。 |
| `list` | `[回答, 回答日時]`。回答ゼロなら `['回答なし', '']` | 画像なし |
| 通常 choice | `[項目, 回答数, 割合]`（`totalsRow` は `includeTotalRow` に従う）。`numFmt = '#,##0"件"'`, `'0.0%'` | includeCharts → 画面上のチャート DOM `#chart-{id}` を html2canvas キャプチャ、表右側（col 4, row 2）に 480px 幅で配置（[:1591-1607](../../../02_dashboard/src/graph-page.js#L1591)） |

- `sheet.addTable` は ExcelJS のテーブル機能でフィルタ・ソート可能な表として出力される（現行実装では `filterButton: false` でヘッダフィルタは無効化）。
- `options.includeMatrixFull=false` の分岐は UI チェックボックスで選択可能だが、コードでは `options.includeMatrixFull` が参照されない（現状すべての行を出力する実装、§9-10）。

#### 5.8.5 保存・完了

- `workbook.xlsx.writeBuffer()` → `Blob` → `<a>.click()` で `{sanitizedSurveyName}_分析レポート.xlsx` としてダウンロード（[:1611-1620](../../../02_dashboard/src/graph-page.js#L1611)）。
- `showToast('分析レポートの出力が完了しました！', 'success')`。
- `finally` で `isExporting=false`、ボタン復旧、`showExportCompletion()`（アイコン `check_circle` + テキスト「完了しました」+ 100%、2.5 秒表示後フェードアウト）。

#### 5.8.6 エラー時

`catch` で `console.error` + `showToast('Excelの生成中にエラーが発生しました。', 'error')`。進捗オーバーレイは `hidden` へ。

### 5.9 URL パラメータ [**MVP**]

| パラメータ | 値 | 影響 |
|------------|----|------|
| `surveyId` | 任意文字列 | データソース特定。未指定時は `sv_0001_24001` フォールバック |

現行実装は `from=` 等の他パラメータは参照しない（`bizcardSettings.html` とは異なる）。期間フィルタ・表示設定の URL ハンドオフも未対応（§9-11）。

### 5.10 beforeunload 離脱警告 [**MVP**]

[graph-page.js:91-96](../../../02_dashboard/src/graph-page.js#L91)。`isExporting=true` の間のみ `e.preventDefault()` + `e.returnValue=''`。それ以外（通常操作中の戻る・閉じる）は警告しない。

---

## 6. データモデル

### 6.1 入力データスキーマ（fetch 結果）

**survey（設問定義）** `surveys/{surveyId}.json`:

```jsonc
{
  "id": "sv_0001_24001",
  "name": { "ja": "アンケート名" },
  "periodStart": "2026-01-04T00:00:00+09:00",
  "periodEnd": "2026-01-17T23:59:59+09:00",
  "details": [
    {
      "id": "q1",
      "type": "single_choice",
      "text": "設問本文",
      "options": [
        { "value": "a", "text": "選択肢A" },
        { "value": "b", "text": "選択肢B" }
      ]
    },
    // マトリクス設問
    {
      "id": "q10",
      "type": "matrix_sa",
      "text": "...",
      "rows": [{ "id": "r1", "text": "行1" }, ...],
      "columns": [{ "value": "c1", "text": "列1" }, ...]
    },
    // 5 点スケール
    {
      "id": "q12",
      "type": "rating_scale",
      "text": "...",
      "config": { "points": 5, "minLabel": "最低", "maxLabel": "最高", "showMidLabel": true, "midLabel": "普通" }
    }
  ]
}
```

**answers（回答）** `responses/answers/{surveyId}.json` または `answers/{surveyId}.json`:

```jsonc
// 新形式
{
  "surveyId": "sv_0001_24001",
  "answers": [
    {
      "answerId": "A001",
      "surveyId": "sv_0001_24001",
      "answeredAt": "2026-01-05T10:23:00+09:00",
      "details": [
        { "questionId": "q1", "answer": "a" },
        { "questionId": "q2", "answer": ["b", "c"] },        // 複数選択
        { "questionId": "q10", "answer": { "r1": "c2" } },   // マトリクスSA
        { "questionId": "q11", "answer": [                   // マトリクスMA
            { "rowId": "r1", "value": ["c1", "c2"] }
        ]},
        { "questionId": "q12", "answer": 4 }
      ]
    }
  ]
}

// 旧形式（配列直）
[ { ... }, { ... } ]
```

`findAnswerDetail()`（[:1781-1820](../../../02_dashboard/src/graph-page.js#L1781)）が `questionId` / `id` 完全一致 → 設問テキスト完全一致 → `normalizeQuestionText()` で正規化一致 → 部分一致ファジー の順に探索。

### 6.2 チャート設定（chartData）

`buildChartData(data)`（[:2152-2186](../../../02_dashboard/src/graph-page.js#L2152)）が返すオブジェクト。`chartSequence` で自動採番。

| フィールド | 型 | 意味 |
|------------|----|------|
| `chartId` | string | `{questionId}_{chartSequence}` の一意 ID |
| `questionId` | string | 設問 ID |
| `questionBaseId` | string | マトリクス時に元設問 ID を保持 |
| `questionText` | string | 設問本文（`survey.details[].text`） |
| `labels` | string[] | カテゴリ（棒）or 系列（ドーナツ）ラベル |
| `data` | number[] | 各ラベルの件数 |
| `totalAnswers` | number | 有効回答数 |
| `chartType` | `'pie' \| 'bar' \| 'list' \| 'blank' \| 'matrix_stacked' \| 'matrix_stacked_100'` | 表示形式 |
| `summaryType` | `'table' \| 'matrix_table' \| 'rating_table' \| 'none'` | 詳細表のテンプレ |
| `includeTotalRow` | boolean | 詳細表の合計行表示 |
| `allowToggle` | boolean | 棒/円切替ボタン表示（**常に false**、§9-6） |
| `blankMessage` / `blankReason` | string | `blank` タイプ時の理由テキスト |
| `listItems` / `listAll` | Array | list タイプの先頭 3 件 / 全件 |
| `isMatrix` | boolean | マトリクス判定 |
| `matrixRows` / `matrixColumns` / `matrixSeries` / `matrixRowTotals` / `matrixRowDetails` | Array | マトリクス用データ |
| `matrixSelectedIndex` / `matrixIndex` / `matrixTotal` / `matrixRowText` | number/string | 表示中の行番号と表示テキスト |
| `matrixSelectorType` | `'row' \| 'column'` | セレクタ単位（現行は常に `'row'`、§9-8） |
| `questionType` | string | `rating_scale` などの特殊扱いフラグ |
| `ratingScaleAverage` / `ratingScalePoints` | number | rating_scale の平均と段階数 |

### 6.3 現在のフィルタ状態

モジュールスコープのグローバル変数（[:32-42](../../../02_dashboard/src/graph-page.js#L32)）:

| 変数 | 型 | 説明 |
|------|----|------|
| `chartInstances` | `{ [chartId]: ApexCharts }` | 描画済みインスタンス。再描画時に `destroy()` |
| `chartDataStore` | `Map<chartId, chartData>` | カードの chartData キャッシュ。マトリクス行切替時に参照 |
| `originalAnswers` | `Array` | 全回答（フィルタ前） |
| `currentSurvey` | `object` | survey 定義 |
| `startDatePicker` / `endDatePicker` | `flatpickr` | カスタム範囲の選択状態 |
| `currentDateFilter` | `[Date, Date] \| null` | 有効な期間。null なら全件 |
| `availableDateRange` | `{ start: Date, end: Date } \| null` | 会期範囲。flatpickr の min/max 兼セレクタ項目の基礎 |
| `chartSequence` | number | `buildChartData` の ID 採番カウンタ（`processDataForCharts` 内で 0 リセット） |
| `isExporting` | boolean | Excel 出力中フラグ（beforeunload 連動） |
| `displayOptions` | object | §5.7 の 5 項目 |

### 6.4 カラー定義

`COMMON_CHART_DONUT_PALETTE`（[chartPalette.js:1-21](../../../02_dashboard/src/constants/chartPalette.js#L1)、19 色のハードコード HEX）。ドーナツ・棒とも同配列を使用。`rating_scale` のみ `generateScaleGradient(points)` で赤 → 緑のグラデを都度生成（[:10-30](../../../02_dashboard/src/graph-page.js#L10)）。

| 用途 | 値 |
|------|----|
| ドーナツ / 棒 | `COMMON_CHART_DONUT_PALETTE` |
| マトリクス stacked | 同上（ただし将来 stacked100 対応時は別パレット検討） |
| rating_scale | 段階数に応じた 5 色グラデ（red-600 → green-700） |
| `GRAPH_CHART_MUTED_TEXT` | `#6B6B6B`（ドーナツ中央「有効回答数」ラベル色） |
| `GRAPH_CHART_TEXT` | `#1A1A1A`（データラベル色） |
| `GRAPH_CHART_GRID` | `#F1F1F1`（グリッド線） |

---

## 7. 非機能要件

### 7.1 パフォーマンス [**Should**]

- 初期描画: `surveys/{id}.json` + `responses/answers/{id}.json` の並列 fetch → 全件クライアント集計 → ApexCharts 描画。設問数 N に対して概ね O(N * answers) の集計時間。
- 期間フィルタ・表示設定の変更は `triggerChartUpdate()` で**全カード再生成**。ApexCharts インスタンスを `destroy()` → `new ApexCharts()` で作り直すため、設問数が多いと数百 ms かかる可能性（debounce なし、§9-7）。
- Excel 出力: メインループ内で 50ms `yieldToMain()`、マトリクス行チャートは 500ms レンダ待機 + html2canvas `scale:2` キャプチャ。設問 20 問 × マトリクス 5 行と仮定すると数十秒オーダー。出力中も `yieldToMain` によりスクロール等の UI 操作は継続可能。
- localStorage アクセスは `loadDisplayOptions` / `saveDisplayOptions` の 2 箇所のみで、フォールバック済 try-catch 付き。

### 7.2 アクセシビリティ [**Should**]

- `#loading-indicator` に `role="status" aria-live="polite"` 付与（[graph-page.html:136](../../../02_dashboard/graph-page.html#L136)）。
- `#error-display` に `role="alert"` 付与（同:142）。
- マトリクス行セレクタ `<select>` に `aria-label="マトリクス表示項目"`（[:630](../../../02_dashboard/src/graph-page.js#L630)）。
- 表示設定チェックボックスには個別 `<label>` 紐付け。

**欠落**:
- `#charts-container` に `aria-live` なし → 期間フィルタや表示設定の変更による再描画が支援技術に通知されない（§9-12）。
- インサイトバッジ / 有効回答件数の動的更新に `aria-live` なし。
- グラフ自体の代替テキスト / `summary` / `aria-describedby` なし。スクリーンリーダー利用者は詳細データ表の読み上げに頼る必要がある（§9-12）。
- 色覚多様性: `COMMON_CHART_DONUT_PALETTE` はコントラスト・色弱配慮が明示的になされていない。パターンやテクスチャ等のセカンダリ符号は未実装（§9-13）。

### 7.3 セキュリティ [**Should**]

- `graph-page.html` 自体にアクセス制御なし。URL 直打ちでゲスト・未認証でも到達可能（§9-3）。
- fetch 先は同一オリジン or 相対パスの JSON。外部 API 呼出しなし。
- `escapeHtml()`（[:1754-1757](../../../02_dashboard/src/graph-page.js#L1754)）でユーザ入力系（設問テキスト・回答値・マトリクス行列テキスト）をエスケープしてから `innerHTML` に差し込み。list タイプの画像値は `data-preview-url="..."` に escape 済みの値を埋め、`onclick="window.previewImage(this.dataset.previewUrl)"` で起動する。
- URL の `surveyId` は `URLSearchParams.get` で取得後そのままファイルパスに連結する（`fetchWithFallback('surveys/{surveyId}.json')`）ため、不正な文字列を与えると任意のパスに fetch できる可能性がある。同一オリジン制約で被害は限定的だが、ホワイトリスト/形式チェックが望ましい（§9-14）。
- localStorage `graphPage_displayOptions` は個人設定のみで PII を含まない。

### 7.4 対応ブラウザ [**Should**]

- 最新 2 バージョンの Chrome / Firefox / Safari / Edge を暫定（他ページと同水準）。
- ExcelJS / html2canvas は IE 非対応（サポート対象外）。
- flatpickr は Safari / モバイル Safari で動作確認済み（ライブラリ側の公式対応）。

### 7.5 保守性

- `graph-page.js` は 2,434 行の単一モジュール（`export` なし）。設問タイプ追加・チャートライブラリ差替えのたびに `processDataForCharts` / `createChart` / `renderChartSummaryTable` の 3 関数を同時修正する必要があり、責務分離が甘い（§9-15）。
- ApexCharts オプションは `createChart` 内で 1 関数 100 行以上のオブジェクトリテラル。`matrix_stacked_100` / `isHorizontalBar` / `isDoughnut` / `isMatrixStacked` の 4 フラグ分岐が絡む。
- Excel 出力ロジックは `summaryType` × `chartType` × `isMatrix` の組合せで分岐多数、重複実装（SA マトリクスのドーナツ生成と MA マトリクスの棒生成）がある。

### 7.6 国際化対応 [**Phase 2**]

- 画面固定文言（`分析フィルター`, `会期全体`, `カスタム範囲`, `表示設定`, `Excel一括出力`, `分析レポート 目次` 等）は日本語ハードコード。
- 設問タイトル `survey.name.ja` 直参照（`.en` / `.zh` 等は未考慮）。
- 将来的な多言語化は §9 将来計画で集約。

---

## 8. Definition of Done

リリース判定権限者: プロダクトオーナー（TBD）。

**機能要件（現行 MVP）**:
- [ ] §5.1 `?surveyId=sv_0001_24001` で遷移した際、パンくず「アンケート一覧 > SPEED レビュー > グラフ分析」が注入され、タイトルが `グラフ分析: {name.ja}` に更新される
- [ ] §5.2 `surveys/{id}.json` と `responses/answers/{id}.json` の両方が取得され、後者が空のときは `answers/{id}.json` にフォールバックする
- [ ] §5.3 期間セレクタが会期全体 + N日目 + カスタム範囲の順に自動生成され、「カスタム範囲」選択時のみ `#detailed-search-content` が展開する
- [ ] §5.4 期間変更で全カードが再描画される（ApexCharts インスタンスを destroy → new）
- [ ] §5.5 single_choice はドーナツ、multi_choice は件数降順の横棒、rating_scale は赤→緑グラデの棒、matrix_sa は行セレクタ + ドーナツ、matrix_ma は行セレクタ + 横棒、text/file 系は list 一覧で描画される
- [ ] §5.5.8 マトリクス行セレクタで行を切替るとグラフ・chip・有効回答件数が更新される
- [ ] §5.6 詳細表が 4 テンプレ（`matrix_table` / `rating_table` / `list` / 通常）で正しく描画される
- [ ] §5.7 表示設定 5 項目が `localStorage.graphPage_displayOptions` に永続化され、再読込後も復元される
- [ ] §5.8 Excel 一括出力が「目次 / グラフ画像 / マトリクス全項目 / 対象外設問」の 4 チェックで制御され、`{survey.name.ja}_分析レポート.xlsx` で保存される
- [ ] §5.8.6 出力中に `#export-progress-overlay` が右下にフェードインし、完了時は `check_circle` + 2.5 秒フェードアウト
- [ ] §5.10 出力中のタブ閉じ・ページ離脱でブラウザ標準警告が出る

**非機能要件**:
- [ ] §4.7 `md` 以上で 2 列、未満で 1 列レイアウトになる
- [ ] §7.2 `#loading-indicator` `#error-display` マトリクスセレクタに `role` / `aria-label` が付与されている
- [ ] §7.3 ユーザ入力経路（設問テキスト・回答値）が `escapeHtml` でエスケープされ、XSS 発火しない

**受入シナリオ**:

| # | 手順 | 期待結果 |
|---|------|---------|
| A1 | `graph-page.html` を `surveyId` なしで開く | `sv_0001_24001` にフォールバックして通常描画 |
| A2 | single_choice 設問の「サマリー」を OFF | インサイトバッジが全カードから消え、再読込後も OFF のまま |
| A3 | 期間セレクタで「3日目」を選択 | 該当日の回答のみで集計され、詳細表・インサイトが更新される |
| A4 | 「カスタム範囲」選択 + 開始/終了日時を任意設定 | `currentDateFilter` が更新され、全カードが再描画 |
| A5 | マトリクス設問の行セレクタを次行に変更 | chip `[2/N]`、グラフ、有効回答件数が切り替わる |
| A6 | 「Excel一括出力」クリック → 目次 ON・グラフ画像 ON で実行 | `{name}_分析レポート.xlsx` がダウンロードされ、目次シート + 各設問シート（Q1, Q2, ...）+ グラフ画像が含まれる |
| A7 | Excel 出力中にブラウザ「戻る」操作 | 標準警告「このサイトを離れますか？」が出る |
| A8 | BLANK タイプ（free_text）設問 | リスト表示 + `Ex_Q{番号}` シート名（対象外設問 ON 時） |

---

## 9. 将来計画（Phase 2 以降）

本画面の実装ギャップ一覧。番号が小さいほど優先度が高い。「将来計画」と「実装ギャップ棚卸し」を同一章で扱う。

※旧 `07_graph_analysis.md` で本番要件として語られていた多くの機能（属性フィルタ・クロス集計・VS モード・Premium Upsell Modal・PDF レポート・自動考察）はすべて未実装のため、ここに集約する。

1. **属性フィルタ・ドリルダウン・クロス集計・VS モード未実装（最重要）**: 旧 `07_graph_analysis.md` が「Premium 機能」として規定していた 4 機能群（属性での絞り込み、グラフ点クリックによる cross-filtering、任意軸でのクロス集計、左右分割比較 VS モード）は**一切の UI もロジックも存在しない**。仕様再合意 + Premium Upsell Modal の設計が必要。
2. **PDF レポート未実装**: 旧 `07_graph_analysis.md` の Premium 機能。現行は Excel のみ。PDF 化する場合は ExcelJS → PDF 変換 or 直接 `jsPDF` / ブラウザ印刷 API のいずれかを選定する必要。
3. **認可ゲートなし**: `graph-page.html` 自体は URL 直打ちで誰でもアクセス可能。`speed-review.js` 側で `isFreeAccountUser` 判定してから遷移させているが、本画面側に二重防御なし。SPA ルータ側 or サーバセッション確認の追加を要検討。
4. **ApexCharts ネイティブ PNG 出力の封印**: `chart.toolbar.show=false` で無効化されているため、旧仕様書で謳われていた「`scale:3` 最高画質 PNG」は現行利用不可。復活させる場合は Excel 出力との棲み分けを決める必要（個別 DL vs 統合レポート）。
5. **`devicePixelRatio: 3` 固定未実装**: 旧 `07_graph_page_requirements.md` §5 で明記されていたが、実装には見当たらない。高 DPI ディスプレイでのキャプチャ品質は `html2canvas scale: 2` に依存する現状。
6. **`allowToggle` が常に false**: `buildChartTypeButtons` は `allowToggle=true` のときのみ描画するが、`processDataForCharts` 内で `allowToggle=false` 固定（[:360-376](../../../02_dashboard/src/graph-page.js#L360)）。旧仕様書の「棒/円切替」機能は**実質無効**。再有効化するか、旧仕様を降ろすか要決定。
7. **`triggerChartUpdate` に debounce なし**: 表示設定チェック・flatpickr `onChange` が連続発火すると、全カード destroy → new が毎回走る。設問数が多いアンケートで UI ジャンク。`setTimeout` ベースの 200ms debounce 導入を検討。
8. **`matrixSelectorType` が常に `'row'`**: コード内コメントで「MA は `column` 選択器にする」想定が記述されているが、`buildMatrixCharts` は `selectorType='row'` で固定（[:2105](../../../02_dashboard/src/graph-page.js#L2105)）。MA で列セレクタに切替える機能は休眠。
9. **i18n 未対応**: 画面文言が日本語ハードコード（20 箇所超）、`survey.name.ja` 直参照。旧仕様書 §5 で「外部化されたリソースファイルから読み込む設計とする」と規定されていたが未実装。
10. **`options.includeMatrixFull` が参照されない**: Excel モーダルで選択可能だが、`executeExcelExport` 内で `options.includeMatrixFull` が参照されず、常に「全行出力」となる（[exportOptionsModal.html:43](../../../02_dashboard/modals/exportOptionsModal.html#L43)）。UI とロジックの不整合。
11. **期間フィルタの URL ハンドオフなし**: `?surveyId` のみ受付、期間や表示設定の URL 引き継ぎは不可。URL 共有・ブックマークからの再現ができない。`sessionStorage` への引き継ぎも旧仕様書で「検討」と書かれたまま未実装。
12. **`aria-live` 欠落**: `#charts-container` や `#survey-title`、インサイトバッジ、有効回答件数に `aria-live` なし。期間変更・表示設定変更時の動的更新がスクリーンリーダーに通知されない。
13. **色覚配慮の不足**: `COMMON_CHART_DONUT_PALETTE` は 19 色の HEX 直列で、色弱シミュレーションや明暗コントラスト比の検証が行われていない。パターン/テクスチャのセカンダリ符号も未導入。
14. **`surveyId` 形式チェックなし**: URL から取得後そのまま fetch パスへ連結。ホワイトリスト形式チェック（例: `/^sv_[0-9]{4}_[0-9]{5}$/`）導入が望ましい。
15. **`graph-page.js` の責務過大**: 2,434 行単一ファイル・`export` なし。チャート生成・集計・描画・Excel 出力・モーダル注入・プレビューモーダルが同居。`./graphPage/` ディレクトリへの分割（集計ロジック / 描画 / Excel 出力 / モーダル）が保守性改善に有効。
16. **`buildChartAreaStatic` デッドコード**: [graph-page.js:2256-2258](../../../02_dashboard/src/graph-page.js#L2256) にコメント「This was duplicated, merged into buildChartArea」とあり空関数として残存。削除候補。
17. **`buildActionButtons` が空文字を返す**: [graph-page.js:2222-2224](../../../02_dashboard/src/graph-page.js#L2222) は `return ''`。かつて個別アクション（PNG 保存等）を返していた痕跡。未使用のまま残存。
18. **`window.previewImage` がグローバルに公開**: モジュール `export` ではなく `window.previewImage = function(...)`。`onclick="window.previewImage(...)"` のインラインハンドラと結びついており、CSP 導入時に阻害要因となる（次項 19 と併せて改修）。
19. **インライン `onclick` ハンドラ**: list タイプの画像プレビューボタンに `onclick="window.previewImage(this.dataset.previewUrl)"` を直書き（[:1062-1065](../../../02_dashboard/src/graph-page.js#L1062)）。`delegated addEventListener` への置換が望ましい。
20. **Excel 出力中のボタン disable 不完全**: `excel-export-all` ボタンは `disabled=true` にするが、モーダル側の `confirm-export-btn` は二重押下防止なし（モーダル閉鎖で代用）。重い処理なので `confirm-export-btn` 側にも `disabled` + `isExporting` ガードが必要。
21. **`matrix_stacked` / `matrix_stacked_100` は description 定義のみ**: `createChart` の `isMatrixStacked` / `isStacked100` 分岐コードは存在するが、`processDataForCharts` / `buildMatrixCharts` からは `chartType='matrix_stacked'` を生成する経路が**ない**。将来の積み上げ棒グラフ対応用の先行実装。
22. **Excel 出力のセル/画像配置が段組計算で混在**: `currentRowStart += Math.ceil(displayHeight / 20) + 2;` のように画像高さ ÷ 20 で行番を進める素朴計算。Excel の行高は一定でないので重なるリスクあり（マトリクス SA で行数が多いと顕在化）。

---

## 10. 用語集

| 用語 | 説明 |
|------|------|
| 設問ID（`questionId`） | `q1`, `q10` などの識別子。`formatQuestionChip()` で `Q1`, `Q10` 形式の chip に整形 |
| 設問タイプ | `single_choice` / `multi_choice` / `matrix_sa` / `matrix_ma` / `rating` / `rating_scale` / `dropdown` / `ranking` / `text` / `free_text` / `number` / `date` / `datetime` / `time` / `handwriting` / `image` / `photo` / `file` / `file_upload` / `upload` / `explanation` |
| SA / MA | シングルアンサー（単一選択）/ マルチアンサー（複数選択） |
| マトリクス設問 | 複数行 × 複数列の表形式設問。SA = 行ごとに 1 列選択、MA = 行ごとに複数列選択 |
| `rating_scale` | N 点スケール（既定 5 点）。`minLabel` / `midLabel` / `maxLabel` で端点と中央のラベル付け |
| `blank` タイプ | 集計グラフ対象外。自由記述・数値・日付・添付など。list 一覧で個別回答を表示 |
| `chartType` | `'pie' \| 'bar' \| 'list' \| 'blank' \| 'matrix_stacked' \| 'matrix_stacked_100'`。後 2 者は描画コードのみ存在（§9-21） |
| `summaryType` | 詳細表のテンプレート種別（`table` / `matrix_table` / `rating_table` / `none`） |
| インサイトバッジ | カード右上の `Top {label} {percent}%` or `Avg {score} / {points}` 小バッジ |
| 有効回答（`totalAnswers`） | 該当設問に実際に回答のあった回答件数。未回答・空値は除外 |
| 表示設定 | 5 項目のトグル（サマリー / 数値ラベル / 中央合計 / 詳細表 / グリッド線）。`localStorage.graphPage_displayOptions` に保存 |
| 期間フィルタ | `#dayFilterSelect` で選ぶ `会期全体` / `N日目` / `カスタム範囲`。内部は `[Date, Date]` のタプル |
| `currentDateFilter` | モジュールスコープ変数。`triggerChartUpdate` の基礎 |
| `availableDateRange` | 会期開始/終了。flatpickr の min/max と `buildDateFilterOptions` の入力 |
| `chartsData` | `processDataForCharts` が返す `chartData[]` |
| `chartInstances` | 描画中の ApexCharts インスタンス辞書（`{[chartId]: ApexCharts}`） |
| `chartDataStore` | `Map<chartId, chartData>`。マトリクス行切替・チャート種別切替で参照 |
| Excel 一括出力 | `ExcelJS` で `.xlsx` を生成。目次 + 各設問シート（Q1, Q2, ... / Ex_Q5 等） |
| `Ex_Q{n}` シート | 対象外設問の Excel シート名プレフィックス（`includeExclusions=true` 時のみ生成） |
| `yieldToMain()` | `Promise(r => setTimeout(r, 50))`。Excel 出力ループ内でメインスレッドを解放 |
| `html2canvas scale:2` | DOM → Canvas キャプチャ時の解像度倍率。Excel 画像はこれで生成 |
| `COMMON_CHART_DONUT_PALETTE` | 19 色のハードコードカラーパレット |
| インサイト / 3-Pane / VS モード | 旧 `07_graph_analysis.md` の構想用語。すべて未実装（§9-1） |

---

## 11. 関連ファイル・デッドコード棚卸し

### 11.1 メインファイル

- `02_dashboard/graph-page.html`（200 行）
- `02_dashboard/src/graph-page.js`（2,434 行、`DOMContentLoaded` 起動、`export` なし）
- `02_dashboard/modals/exportOptionsModal.html`（72 行）

### 11.2 依存モジュール

- `02_dashboard/src/breadcrumb.js`（パンくず、`graph-page.html` 専用エントリあり、[breadcrumb.js:15-19](../../../02_dashboard/src/breadcrumb.js#L15)）
- `02_dashboard/src/utils.js`（`resolveDashboardDataPath` / `resolveDemoDataPath` / `showToast` を利用）
- `02_dashboard/src/services/dateFilterService.js`（113 行、`getSurveyPeriodRange` / `buildDateFilterOptions` / `applyDateFilterOptions` / `resolveDateRangeFromValue` / `formatDateYmd` をエクスポート）
- `02_dashboard/src/constants/chartPalette.js`（20 行、`COMMON_CHART_DONUT_PALETTE`）

### 11.3 流入元

- [speed-review.js:1871-1886](../../../02_dashboard/src/speed-review.js#L1871) `#graphButton`。プレミアム判定をクリア（`!isFreeAccountUser`）したときのみ `window.location.href = graph-page.html?surveyId=...`。フリーユーザーは `openPremiumFeatureModal()` で阻止。
- 旧仕様書 §2 には「SPEED レビューから URL パラメータ `surveyId` 付きで遷移」と規定されており、現行実装と一致。

### 11.4 離脱先

- パンくず「アンケート一覧」→ `../02_dashboard/index.html`
- パンくず「SPEED レビュー」→ `../02_dashboard/speed-review.html?surveyId=...`（動的リンク）

### 11.5 共有ストレージ

- `localStorage.graphPage_displayOptions`（本画面専用、5 項目 JSON）

### 11.6 デッドコード・休眠コード一覧

| 対象 | 状態 | §9 参照 |
|------|------|---------|
| `buildChartAreaStatic` | 空関数コメントのみ（[:2256](../../../02_dashboard/src/graph-page.js#L2256)） | 9-16 |
| `buildActionButtons` | `return ''` 固定（[:2222](../../../02_dashboard/src/graph-page.js#L2222)） | 9-17 |
| `allowToggle` / `buildChartTypeButtons` | `allowToggle=false` 固定で常に描画されない（[:2227](../../../02_dashboard/src/graph-page.js#L2227)） | 9-6 |
| `matrix_stacked` / `matrix_stacked_100` | `createChart` 分岐コードのみ存在、生成元なし | 9-21 |
| `options.includeMatrixFull` | モーダルで選択可能だがコードが参照しない | 9-10 |
| `matrixSelectorType='column'` パス | `applyMatrixRowSelection` に実装はあるが生成元が `'row'` 固定 | 9-8 |
| `window.previewImage` | モジュール外 API として `window` に直付け、インライン `onclick` と結合 | 9-18, 9-19 |
| `ensureUniqueSheetName` / `sanitizeSheetName` | 実装はあるが `executeExcelExport` からは呼ばれず、`formatQuestionChip` に依存 | 棚卸し候補 |

---

## 12. 関連仕様書との関係

- **`06_speed_review`（SPEED レビュー）**: データソースが同一（`surveys/{id}.json` + `responses/answers/{id}.json`）。本画面への流入元であり、グラフ化ボタンの可否判定（プレミアム判定）も speed-review 側が担う。回答データの構造変更は両画面同時修正が必要。
- **`01_survey_creation_requirements`（アンケート作成・編集）**: 設問定義（`survey.details[].type` / `options` / `rows` / `columns` / `config.points` 等）の書き出し先で、本画面はその消費側。設問タイプの追加・スキーマ変更は本書 §5.5 と §6.1 の同期改訂が必要。
- **`07_graph_analysis.md`（旧 Insight Finder 構想）**: 本書に吸収完了。属性フィルタ / クロス集計 / VS モード / Premium Upsell Modal / PDF レポートは §9-1 / §9-2 / §9 将来計画で継承。本書 v2.0 リリース後に `_archive/` 送り。
- **`11_plan_feature_restrictions`（プラン別機能制限）**: `isFreeAccountUser` 判定のロジック先。旧 `07_graph_analysis.md` で規定されていた「属性フィルタ / VS モード / PDF が Premium」のマトリクスを復活させる場合、`plan-capabilities.json` 連動実装と合わせて本書 §9 を再設計する必要。
- **`13_survey_answer_screen`（アンケート回答画面）**: `answeredAt` / `details[].answer` の形式決定元。本画面の `findAnswerDetail` ロジックはこのスキーマ前提。

---

## 13. 旧仕様書からの移行マップ

| 旧仕様書 | 対応 | 本書での扱い |
|----------|------|--------------|
| `07_graph_analysis.md` §1 コア・コンセプト（Insight Finder / Dynamic Analysis / Premium Showcase） | **破棄** | 現行実装はこれら抽象スローガンを反映していないため削除。必要ならプロダクトビジョン文書へ転記 |
| `07_graph_analysis.md` §3.1 3-Pane Layout（左サイドバー / ヘッダ / Canvas Masonry） | **未実装** | 本書 §4.1 で実際の単一メインカラム + 期間ツールバー sticky 構成に差替。§9-1 将来計画で追跡 |
| `07_graph_analysis.md` §3.2 グラフタイプ切替（棒 / 円 / 積み上げ棒） | **部分実装** | `matrix_stacked` 分岐は残骸あり（§9-21）、ユーザ切替は `allowToggle=false` で無効（§9-6）。本書 §5.5 で現状を明記 |
| `07_graph_analysis.md` §3.2 クロス集計 / 自動考察 | **未実装** | §9-1 将来計画。ドリルダウンも同様 |
| `07_graph_analysis.md` §3.3 機能マトリクス（Free/Standard/Premium 表） | **保留** | プラン連動が現状未実装のため §9-1 / §9 参照。機能ごとの Free/Premium 振り分けは再合意必要 |
| `07_graph_analysis.md` §4 Premium Upsell Modal | **未実装** | §9-1 将来計画 |
| `07_graph_analysis.md` §5 データストア（正規化構造） | **不要（現状の粒度で足りる）** | 現行は設問定義 + 回答配列をそのまま fetch して都度集計。§6.1 で実スキーマを明記 |
| `07_graph_analysis.md` §6 Phase 1/2/3 段階計画 | **参考保持** | §9 将来計画で代替 |
| `07_graph_page_requirements.md` §2 ページ遷移（surveyId 形式） | **継承** | 本書 §5.9 で URL パラメータに集約。ただし `/speed-review.html` → `/graph-page.html` の遷移先 URL は `graph-page.html`（`/` プレフィックスなし、相対）と実装に合わせて修正 |
| `07_graph_page_requirements.md` §3.1 ドーナツ/横棒の使い分け | **継承** | 本書 §5.5.1 の分類表で同一定義。matrix 系・rating_scale などの追加を明記 |
| `07_graph_page_requirements.md` §3.1 クイックインサイト（最多回答バッジ） | **継承** | 本書 §4.4 `insightHtml` 描画で正確に反映（`showSummary` 連動） |
| `07_graph_page_requirements.md` §3.1 表示設定（4 項目） | **継承 + 拡張** | 現行実装では **5 項目**（「詳細表」追加）。本書 §5.7 で補正 |
| `07_graph_page_requirements.md` §3.2 フィルタ連動 | **継承** | 本書 §5.4 `triggerChartUpdate` で記述 |
| `07_graph_page_requirements.md` §3.3 簡易検索 / 詳細検索 | **継承** | 本書 §5.3 で記述、flatpickr ja ロケール固定 + `availableDateRange` による min/max 制約を追記 |
| `07_graph_page_requirements.md` §3.4 Excel 一括出力（シート名 Q1,... / Ex_ / `html2canvas scale:2` / 進捗浮遊パネル / 離脱防止） | **継承（詳細追補）** | 本書 §5.8 で実装通りに記述。`includeMatrixFull` 未参照・目次シート HTML/列幅・`yieldToMain` 50ms 等を新規追記 |
| `07_graph_page_requirements.md` §3.4 個別画像ダウンロード（ApexCharts scale:3 + 30px 余白） | **未実装** | 本書 §9-4。`toolbar.show=false` で封印中 |
| `07_graph_page_requirements.md` §4 バーティカル・インサイト・レイアウト / スマートフィルターバー | **継承** | 本書 §4.3 / §4.4 で実装に沿って詳細化 |
| `07_graph_page_requirements.md` §5 ApexCharts / `devicePixelRatio:3` / レスポンシブ / セキュリティ / i18n | **部分継承** | ApexCharts と CDN 構成は実装一致。`devicePixelRatio:3` は未実装（§9-5）、認可ゲートなし（§9-3）、i18n 未実装（§9-9）を明記 |
| `07_graph_page_requirements.md` §6 今後の検討事項（ワードクラウド / ヒートマップ / ツールチップ / PNG DL / 横断比較 / 設定保存 / テスト要件） | **継承** | 本書 §9 将来計画で追跡。`localStorage.graphPage_displayOptions` による設定保存は実装済みで §5.7 に記載 |

---

**本書は `07_graph_analysis.md` を吸収完了した主幹仕様書である。** 以後、グラフ分析画面の仕様変更は本書を正とし、`07_graph_analysis.md` は `_archive/` へ退避する。
