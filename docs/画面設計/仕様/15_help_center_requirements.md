---
owner: product
status: draft
last_reviewed: 2026-04-14
---

# ヘルプセンターページ 要件定義書

## 1. 概要
ヘルプセンター機能（`help-center.html` / `help-content.html`）の現行要件を定義する。
本ドキュメントは `v2.4` 差分メモを正本へ統合したものであり、実装との差分も併記する。

## 2. 対象画面
- `02_dashboard/help-center.html`（トップ）
- `02_dashboard/help-content.html`（カテゴリ一覧・記事詳細・検索結果）

## 3. 改訂履歴（引継ぎ）
- v2.4 (2025-11-10): 「よく読まれているカテゴリ」をSwiperカルーセル化。
- v2.3 (2025-11-10): 「お知らせ欄」を追加。
- v2.2 (2025-11-10): 「よくある質問」「はじめに」「用語集」カテゴリ拡張。
- v2.1 (2025-11-10): 「レビュー機能」を削除し「分析・レポート機能」を追加。
- v2.0 (2025-11-10): 画面仕様・検索仕様・非機能要件の詳細化。
- v1.1 (2025-11-10): カテゴリ案・コンテンツ案を追記。
- v1.0 (2025-11-10): 初版。

## 4. 機能要件（現行実装）

### 4.1 トップページ (`help-center.html`)
- ヒーローセクションに検索フォームを配置し、キーワード送信時に `help-content.html?search=<keyword>` へ遷移する。
- 「よく読まれているカテゴリ」は Swiper.js カルーセルで表示する。
  - 自動再生: 5秒ごと。
  - ナビゲーション: 前後ボタン + ページネーションドット。
  - レスポンシブ: 1列（SP）/2列（>=768px）/3列（>=1024px）。
- 「すべてのカテゴリから探す」はカテゴリカードを表示する。
- 「お知らせ」はアコーディオン + ページネーション（1ページ6件）で表示する。

### 4.2 コンテンツページ (`help-content.html`)
- URLクエリで表示モードを切り替える。
  - `?category=`: カテゴリ内の記事一覧。
  - `?article=`: 記事詳細。
  - `?search=`: 検索結果一覧（複数キーワードAND検索）。
- パンくずを動的生成する。
- 記事詳細には「この記事は参考になりましたか？」のフィードバックUIを表示する。
- 記事詳細には関連記事（`isFeatured`）を表示する。

### 4.3 データソース
- `data/notifications.json`: お知らせ一覧。
- `data/help_articles.json`: カテゴリ・記事一覧。
- パス解決は `resolveDashboardDataPath` を使用する。

## 5. 非機能要件
- 主要操作（検索遷移、ページ切替、アコーディオン開閉）は1秒以内に応答する。
- SP/Tablet/Desktop のレスポンシブ表示を崩さない。
- データ読み込み失敗時は画面内エラーメッセージを表示する。

## 6. 差分メモ（要整合）
- v2.4メモでは「対象カテゴリ3件・各5件表示」とあるが、現行実装は「対象カテゴリ5件・各3件表示」。
- 上記は仕様再確定時に `v2.5` として統一する。

## 7. 関連ファイル
- `02_dashboard/help-center.html`
- `02_dashboard/help-content.html`
- `02_dashboard/src/help-center.js`
- `02_dashboard/src/help-content.js`
- `02_dashboard/src/help-center.css`

## 8. Support 配下サイトの共通アセット運用ルール

`SPDAD2026-73` で整理した support 配下の運用ルールを、共有仕様としてここに統合する。
本章は `02_dashboard/help-center.html` の実装詳細ではなく、`support.speed-ad.com` / `stg.support.speed-ad.com` 配下の FAQ / Help / Tutorial 導線に適用する共通ルールである。

### 8.1 対象 URL
- `/faq/`
- `/help/`
- `/tutorial/`

### 8.2 配置方針
- ページ本体は `/faq/`, `/help/`, `/tutorial/` 配下に置く。
- 共通利用する `css`, `js`, `img` は `/assets/` 配下に集約する。
- 各機能専用のリソースのみを `/assets/img/faq/`, `/assets/img/help/`, `/assets/img/tutorial/` のように用途別で分ける。

想定ディレクトリ構成:

```text
/
  faq/
    index.html
  help/
    index.html
  tutorial/
    index.html
  assets/
    css/
      common.20260414.css
      faq.20260414.css
      help.20260414.css
      tutorial.20260414.css
    js/
      common.20260414.js
      faq.20260414.js
      help.20260414.js
      tutorial.20260414.js
    img/
      common/
      faq/
      help/
      tutorial/
```

### 8.3 参照ルール
- HTML からの参照パスはルート相対で統一する。
- 例:
  - `/assets/css/common.20260414.css`
  - `/assets/js/tutorial.20260414.js`
  - `/assets/img/common/logo.svg`
- `../assets/...` や `../../img/...` のような相対参照は採用しない。

### 8.4 キャッシュ運用
- 共通 CSS / JS の更新時は、キャッシュ影響を避けるためバージョン付きファイル名で運用する。
- 例:
  - `common.20260414.css`
  - `common.20260414.js`
- 本番と検証はドメインのみを変え、ディレクトリ構造とファイル命名規則は統一する。

### 8.5 非採用方針
- `/faq/`, `/help/`, `/tutorial/` 配下へ共通画像や共通 JS を重複配置する構成
- 共通 CSS / JS を同一ファイル名の上書きのみで運用する構成
- 相対参照に依存した配置構成
