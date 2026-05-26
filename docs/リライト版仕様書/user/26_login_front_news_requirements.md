---
owner: product
status: draft
last_reviewed: 2026-05-24
---

# お知らせ動線 要件定義書

| 項目 | 値 |
| --- | --- |
| 対象画面 | `index.html`（ログイン前トップのお知らせ帯） / `05_support/news/index.html`（一覧） / `05_support/news/<slug>/index.html`（詳細） |
| 正本区分 | 本書を正本とする |
| owner | product |
| last_reviewed | 2026-05-24 |

## 1. 文書目的

- 本書は、お知らせ動線を構成する 3 画面（ログイン前トップのお知らせ帯・一覧・詳細）と、データ正本の運用要件を定義する。
- UI 詳細はモックアップを正本とし、本書は動作・データ・連携要件に絞る。
- サポートサイト分離方針（URL・クロスドメイン・リダイレクト等）は 17 番に従う。本書は 17 番の URL 方針に沿ってサポート配下 `/news/` を扱う。
- ログイン前ページ（`index.html`）のうち、お知らせ帯（`#public-news-section`）部分のみ本書スコープ内とする。ログイン前ページ全体の他セクション（ヒーロー・特長・料金等）は本書スコープ外。

## 2. 画面概要

- 3 画面で構成する。
  - **お知らせ帯**: ログイン前トップ（`index.html`）ヒーロー直下、`#public-news-section`。最新最大 3 件を新しい順で表示する。
  - **一覧**: 公開済みお知らせを新しい順に並べる単一ページ（`05_support/news/index.html`）。全件表示する。
  - **詳細**: 1 記事 = 1 ディレクトリ = 1 HTML ファイル（`05_support/news/<slug>/index.html`）。
- データソースは `05_support/assets/data/news.json` を唯一の正本とする。クライアント完結でサーバー処理は行わない。

## 3. 画面要件

### 3.1 お知らせ帯（`index.html`）

- DOM 配置: ログイン前トップ（`index.html`）のヒーロー直下、`#public-news-section`。
- レイアウト: 既存の3列ハードコード帯（左ラベル 116px / カード3列均等 / 右「一覧を見る」106px）を正本とする。デザインモック上は band 5カラム案もあるが、ログイン前ページのレイアウト互換を維持するため、ログイン前帯は **旧3列を採用** する。
- 縦方向の配置: hero は **常に full viewport（`min-height: 100vh`）** を維持する。帯は hero 直下に積み上げて表示する。帯が表示されていても hero を縮めない（PC 1920x1080 で hero がぴったり 1080px、帯はその下、features-section はさらに下にスクロールで現れる）。
- 描画件数: `items` 配列先頭から最大 3 件（新しい順）。4 件目以降は表示しない。
- 各カードの表示要素:
  - 日付（`displayDate`）
  - タイトル（`title`）
  - 要約（`summary`）
- カテゴリタグは **表示しない**（ログイン前帯の役割は要点の通知に絞り、視覚要素を最小化する）。タグ情報は一覧・詳細側で活用する。
- カードクリックで該当記事の詳細ページへ遷移する。**新規タブで開く** (`target="_blank" rel="noopener noreferrer"`)。
- セクション末尾の「一覧を見る」リンクは一覧ページ（3.2）へ遷移する。**新規タブで開く** (`target="_blank" rel="noopener noreferrer"`)。
- `items` 0 件、または取得失敗時はセクション全体を非表示にする。エラー UI は表示しない（ログイン前ページの体験を阻害しない）。
- 取得処理は `js/login-front.js` の `loadPublicNews()` を踏襲する。
- データ取得先は `data-news-endpoint` 属性で指定する。既定値は `05_support/assets/data/news.json` を解決した相対パス。
- リンク先解決は `pickPublicNewsUrl()` が `items[].url` の相対パス（`05_support/news/<slug>/`）を `resolveAppPath()` 経由で同一オリジン絶対 URL へ変換する。

### 3.2 一覧（`05_support/news/index.html`）

- デザインリファレンス: `アーカイブ/design_handoff_news_timeline_cool/news-list.html`（案C / Timeline Cool）。
- ページ構成: Tint Band（パンくず）→ Hero（eyebrow + h1 72px + サブテキスト + 3 列メタ）→ Featured (PICK) → Timeline（月別グルーピング）→ 共通フッター。
- データ: `05_support/assets/data/news.json` を fetch し、`items` を新しい順にソート。
- **Hero メタ**: `Articles` 件数 / `Last Updated` (`updatedAt` を YYYY.MM.DD 化) / `Months` グループ数の3列を右寄せ表示。
- **Featured (PICK)**: 最新1件を大カードで表示。88px の日 + 月略称 + 年 + 曜日 / カテゴリタグ / h2 (26px serif) / summary / 矢印。左上に `PICK` ゴールドバッジ。ホバーで `transform: translateY(-3px)` と `box-shadow`。
- **Timeline**: 月別グルーピング（`YYYY-MM` 単位）。Featured と重複して全件を含む（PICK は別レイヤー扱い）。
  - 月見出し（200px、`position: sticky; top: 24px`）に月番号 (2 桁) + 月名英字 + `N Article(s)`。
  - 月内アイテム列に左 1px 縦ライン + 各行先頭ドット（ホバー時ゴールド塗り）。
  - 各アイテム: 日付 (`MM.DD` + 曜日 3 文字) / カテゴリタグ / タイトル + summary / 矢印 を `90px 110px 1fr 28px` 4 列グリッド。
- カードクリックで詳細ページへ同一オリジン遷移（`<slug>/` 同階層相対パス、`target="_blank"` 不使用）。
- 0 件時は `.news-state` ブロックを `#timeline-body` 内に描画する。
- 取得失敗時は `.news-state.news-state--error` ブロックを `#timeline-body` 内に描画する。ヘルプセンター・FAQ への導線（共通ヘッダー）は維持する。
- ヘッダー・フッターは `support-shell.js` が `/common/header.html` `/common/footer.html` を注入する（既存仕様）。
- 描画は `05_support/assets/js/news-list.js` の `loadNewsList()` が担う（`groupByMonth()`、`renderFeatured()`、`renderTimeline()` を含む）。

### 3.3 詳細（`05_support/news/<slug>/index.html`）

- デザインリファレンス: `アーカイブ/design_handoff_news_timeline_cool/news-detail.html`（案C / Timeline Cool）。
- ページ構成: Tint Band（パンくず）→ Article Hero（eyebrow + meta + h1 + double rule）→ Article Grid（main 780max + aside 240）→ 共通フッター。
- **Article Hero**:
  - eyebrow: `News & Updates · Article` + 48px ゴールドルール (`::after`)。
  - meta: `<time>` (Cormorant 15px) · カテゴリタグ · `READ N MIN`（`news-detail.js` の `calculateReadMin()` が本文文字数から自動計算、450 文字/分、下限 1 分）。
  - h1: Noto Serif JP 38px / 600 / 1.45。
  - `.ah-rule`: 細罫線 2 本（フル幅 + ゴールド 40% オフセット）。
- **Article Grid**: `grid-template-columns: 1fr 240px`、gap 64、align-items: start。
- **Article Main** (max 780):
  - `.article-lede`: Noto Serif JP 18px / 500 / 2.0。先頭 1 文字に `::first-letter` でドロップキャップ（serif 48px / 600 / ゴールド `#b08544` / float left）。
  - `.article-body`:
    - `<h2>`: serif 22px、`border-left: 3px solid var(--gold); padding-left: 18px;`、`scroll-margin-top: 32px`（TOC ジャンプ用）。
    - `<h3>`: serif 17px。
    - `<ul><li>`: `padding-left: 22px`、`::before` で `◆` ゴールド。
    - `<figure>`: 白カード + border。プレースホルダーは 16:9 ストライプ。
    - `<blockquote>`: 背景 `#e6ecf4` + 左 3px グレーボーダー。
    - `<code>`: 等幅 + 薄背景。
- 各記事 HTML は同一テンプレート骨格を踏襲する。記事ごとの差分は次の 5 箇所のみ。
  - `<title>`
  - breadcrumb 末尾の記事タイトル
  - `<time datetime>` 属性と表示日付
  - `.news-tag` の内容
  - 本文（リード・見出し・本文・リスト）
- ヘッダー・フッター・CSS / JS の読み込みは 3.2 と同じ。加えて `05_support/assets/js/news-detail.js` を `<script type="module">` で読み込む。
- **Article Foot**: `.back-link`（「お知らせ一覧へ」、ホバーでゴールド）と `.share` ボタン群（4 種、36x36 円形）を `space-between` で配置。
  - ボタン: `data-share="native"` / `"twitter"` / `"linkedin"` / `"copy"`。
  - native: `navigator.share()` 対応端末で起動、未対応端末では URL コピーにフォールバック。
  - twitter: `https://twitter.com/intent/tweet?url=...&text=...` を新規タブ。
  - linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=...` を新規タブ。
  - copy: `navigator.clipboard.writeText(location.href)` → トースト「URLをコピーしました」を 1.6 秒表示。
- **Article Aside** (240、`position: sticky; top: 24px`) に以下 2 カードを縦に並べる:
  - **Contents（目次）**: `.article-body > h2` を `news-detail.js` の `buildTOC()` が自動列挙し、`<li><a href="#id">テキスト</a></li>` で出力。各 `<h2>` に `id="section-N"` を自動付与。
  - **Related（関連のお知らせ）**: `news-detail.js` の `loadRelated()` が `05_support/assets/data/news.json` から自身を除いた最新最大 4 件を表示する。0 件時は Related カードごと非表示（`#related-card` に `hidden`）。
- **Scroll-spy**: `news-detail.js` の `initScrollSpy()` が IntersectionObserver で現在表示中の `<h2>` を検出し、対応する TOC リンクに `.on` クラスを付与する（`rootMargin: -30% 0px -50% 0px`）。

## 4. データ要件

### 4.1 データソース

- 正本: `05_support/assets/data/news.json`。
- 配置先は support サブドメイン（`support.speed-ad.com`）配下。既存サポート資産（`faq.json` / `help_articles.json`）と同じ `05_support/assets/data/` 配下に置き、サポート配下の `resolveSupportDataPath()` 規約に揃える。
- 一覧ページ（3.2）は support 配下から `resolveSupportDataPath('news.json')` で同一オリジン fetch する。
- お知らせ帯（3.1）はログイン前オリジンから `05_support/assets/data/news.json` を相対パスで同一オリジン fetch する。
- 17 番「サポートサイト分離 補足メモ」§8 推奨フォルダ構成は `05_support/data/` だが、既存実装が `05_support/assets/data/` のため本書は後者を採用する。17 番が正本化される時点で再整合する。

### 4.2 スキーマ

`05_support/assets/data/news.json` ルート:

| キー | 型 | 必須 | 内容 |
| --- | --- | --- | --- |
| `updatedAt` | 文字列（`YYYY-MM-DD`） | ◯ | ファイル最終更新日 |
| `items` | 配列 | ◯ | お知らせ項目の配列。新しい順に格納 |

`items[]`:

| キー | 型 | 必須 | 内容 |
| --- | --- | --- | --- |
| `date` | 文字列（`YYYY-MM-DD`） | ◯ | 公開日。`<time datetime>` に使用 |
| `displayDate` | 文字列（`YYYY.MM.DD`） | ◯ | 画面表示用日付 |
| `title` | 文字列 | ◯ | 記事タイトル |
| `summary` | 文字列 | ◯ | 一覧・帯で表示する要約（帯は要約全文、一覧はクランプなしで表示） |
| `url` | 文字列 | ◯ | 詳細ページパス。`05_support/news/<slug>/` 形式の相対パス |
| `category` | 文字列 | 任意 | 大分類。タグ表示のフォールバック |
| `tags` | 配列<文字列> | 任意 | 細分類タグ。先頭 1 件を一覧カードのタグ位置に表示（帯ではタグ非表示） |

### 4.3 URL規則

- `items[].url` は `05_support/news/<slug>/` 形式の相対パスとする。
- 一覧ページから詳細への遷移は、先頭の `05_support/news/` を取り除いた相対パス `<slug>/` で行う（同階層遷移）。
- お知らせ帯から詳細への遷移は、ログイン前ルートから `05_support/news/<slug>/` をそのまま使用する。

### 4.4 並び順

- `date` の降順で並べる。同日内は配列の出現順を維持する。
- 並び替えはクライアント側で行う。

## 5. 動線要件

### 5.1 ログイン前ページ

- お知らせ帯（3.1）の各カード → 詳細（3.3） / **新規タブで開く** (`target="_blank"`)
- お知らせ帯（3.1）末尾「一覧を見る」 → 一覧（3.2） / **新規タブで開く** (`target="_blank"`)
- フッター「お知らせ」リンク → 一覧（3.2）
- 帯と一覧のリンクは同一オリジンだが、ログイン前体験を中断させないため新規タブを採用する。
- リンク先パスは相対パス（`05_support/news/<slug>/` / `05_support/news/`）で記述し、`resolveAppPath()` で同一オリジン絶対 URL に解決する。

### 5.2 一覧ページ

- 各カード → 詳細（3.3）
- breadcrumb「ヘルプセンター」 → `/help/`
- 共通ヘッダー・フッターの動線は `support-shell.js` の既存仕様に従う。

### 5.3 詳細ページ

- breadcrumb「ヘルプセンター」 → `/help/`
- breadcrumb「お知らせ」 → 一覧（3.2）
- ページ末尾「お知らせ一覧へ」 → 一覧（3.2）

## 6. セキュリティ要件

- 一覧・帯の描画で `05_support/assets/data/news.json` 由来の文字列を DOM へ流し込む際は HTML エスケープを必須とする。
- `items[].url` は 4.3 の相対パスとして検証する。許容外形式は描画をスキップする。
- 詳細ページの本文は社内編集者が直接コミットする HTML として扱う。ユーザー入力は受け付けない。
- 公開可否は `items` への登録有無で判定する。`items` に存在する項目を公開済みとみなす。

## 7. 非機能要件

### 7.1 パフォーマンス

- 一覧ページの初回描画は `05_support/assets/data/news.json` 取得完了から 200ms 以内に完了する。
- お知らせ帯の初回描画は同 JSON 取得完了から 100ms 以内に完了する（最大 3 件のため）。

### 7.2 アクセシビリティ

- 一覧コンテナ・お知らせ帯コンテナはそれぞれ `aria-live="polite"` を付与する。
- 各カードは見出しと日付を `<article>` 構造で表現し、リンク全体を 1 つのクリック領域とする。
- キーボードのみで 帯 → 詳細 → 一覧 → 詳細 → 一覧 の往復ができること。

### 7.3 対応環境

- 13 番ヘルプセンター §9.4 に準ずる。

## 8. 運用要件

### 8.1 お知らせ追加手順

1. `05_support/assets/data/news.json` の `items` 先頭に新項目を追記し、`updatedAt` を当日へ更新する。
2. `05_support/news/<slug>/index.html` を既存記事のテンプレートからコピーし、3.3 の差分 5 箇所を置換する。
3. 一覧・お知らせ帯への反映は自動で行われる（帯は新しい順最大 3 件のみ）。

### 8.2 お知らせ削除手順

1. `05_support/assets/data/news.json` の該当項目を削除し、`updatedAt` を当日へ更新する。
2. `05_support/news/<slug>/` ディレクトリを削除する。

### 8.3 編集者の運用責務

- `slug` はディレクトリ名と `items[].url` の最終セグメントを一致させる。
- `date` / `displayDate` は同日付の同期表現を保つ（`YYYY-MM-DD` ⇔ `YYYY.MM.DD`）。

## 9. Definition of Done

- [ ] `05_support/assets/data/news.json` が唯一のお知らせ正本として配置されている。
- [ ] お知らせ帯が `items` 先頭最大 3 件を新しい順で表示する（タグ非表示、旧3列レイアウト）。
- [ ] お知らせ帯のカード・「一覧を見る」リンクが `target="_blank"` で新規タブに新ページを開く。
- [ ] フッター「お知らせ」リンクが一覧へ遷移する。
- [ ] PC 1920x1080 のビューポートで hero が **フル 1080px** を占め、帯は hero 直下に積み上げ、features-section は帯のさらに下に来る（hero は帯表示の有無で縮まない）。
- [ ] 一覧ページが `05_support/assets/data/news.json` から動的描画される（Hero メタ + Featured (PICK) + Timeline 月別グルーピング）。
- [ ] Featured カードに 88px の日付・PICK バッジ・summary・矢印が表示される。
- [ ] Timeline の月見出しが `position: sticky` で月をスクロール中も追従する。
- [ ] 月内アイテム列に縦ライン + 各行先頭ドット装飾が描画される。
- [ ] 一覧の各カードから詳細へ遷移できる。
- [ ] 詳細ページに右ペイン aside（Contents 目次 + Related 関連記事）が sticky で表示される。
- [ ] 詳細ページのリード文先頭にドロップキャップ（ゴールド serif 48px）が適用される。
- [ ] 詳細ページの h1 直下に double rule（細罫線 + オフセットゴールド）が引かれる。
- [ ] 詳細ページの `READ N MIN` が本文文字数から自動算出される。
- [ ] 詳細ページ末尾に back-link と SNS シェア（Share / X / LinkedIn / URL コピー、36x36 円形）が並ぶ。
- [ ] URL コピー時にトースト「URLをコピーしました」が 1.6 秒表示される。
- [ ] TOC リンクをクリックすると対応する `<h2>` へスムーズスクロールし、`scroll-margin-top: 32px` でオフセットされる。
- [ ] Scroll-spy で現在表示中の `<h2>` に対応する TOC リンクに `.on` クラスが付く。
- [ ] 詳細から一覧 / ヘルプセンターへ戻れる。
- [ ] 取得失敗時、お知らせ帯は非表示、一覧はエラーメッセージを表示する。
- [ ] 一覧・帯・詳細とも、JSON 由来文字列の XSS が発生しない。
- [ ] §8.1 の手順に従って新規お知らせを 1 件追加できる。
- [ ] 共通ヘッダーの「お知らせ」ナビが `/news/` 配下でアクティブ状態になる。
- [ ] ローカル開発で `python scripts/dev-server.py` または VS Code Live Server (5500) のどちらでも全画面が動作する。

## 10. 関連ファイル

- `05_support/assets/data/news.json`（データ正本）
- `index.html`（`#public-news-section` 旧3列ハードコード帯、フッター「お知らせ」リンク）
- `js/login-front.js`（`loadPublicNews()`、`pickPublicNewsUrl()`、`isValidRelativeNewsPath()`、`resolveAppPath()`）
- `css/login-front.css`（`.public-news-*` 旧スタイル、`@media (min-width:1101px)` の hero min-height 補正）
- `05_support/news/index.html`（一覧）
- `05_support/news/<slug>/index.html`（既存 3 記事および以降の追加分）
- `05_support/assets/js/news-list.js`（一覧の動的描画）
- `05_support/assets/js/news-detail.js`（詳細の TOC + Related）
- `05_support/assets/css/news.css`（一覧・詳細共通スタイル、aside / Share / ドロップキャップ含む）
- `05_support/common/header.html`（共通ヘッダー、「お知らせ」ナビ含む）
- `05_support/assets/js/support-shell.js`（ヘッダー/フッター注入、`rewriteFragmentPaths()` でローカル開発時の絶対パス書き換え）
- `05_support/assets/js/utils.js`（`resolveSupportDataPath()`、`resolveSupportBasePath()`）
- `scripts/dev-server.py`（ローカル開発用パス書き換え HTTP サーバ）
- 17 番 サポートサイト分離 補足メモ
