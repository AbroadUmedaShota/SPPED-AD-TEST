# Handoff: お知らせ動線 — Timeline Cool（案C）

## Overview

SPEED AD Support サイト配下のお知らせ動線を構成する 2 画面（一覧 / 詳細）のデザインリファレンスです。タイムライン型の月別グルーピング + Featured（PICK）+ 月内記事リストで構成し、配色はヘッダーの淡いブルー（既存実装）と調和するクールトーン + ゴールドアクセントに統一しています。

仕様の正本は `要件定義書（お知らせ動線）` で、本パッケージはその UI 側の正本となるデザインリファレンスです。

## About the Design Files

本フォルダに同梱した HTML ファイルは **デザインリファレンス（プロトタイプ）** です。製品コードとしてそのまま転用することを想定していません。実装側のコードベース（React / Vue / 静的 HTML + JS など、現在のサポートサイトの実装環境）に合わせて、同じビジュアル・タイポ・余白・配色・インタラクションを再現してください。

データソースは `05_support/assets/data/news.json` を正本とし、`items` を `date` 降順で並べて描画します（クライアント完結）。

## Fidelity

**High-fidelity (hifi)**。配色・タイポ・余白・装飾線まで本番実装で再現する前提です。HTML / CSS / 軽量 JS をそのまま読み、値を抽出して既存コードベースのコンポーネント／スタイル体系に落とし込んでください。

- 配色: 本書「Design Tokens」セクションの値を厳密に踏襲
- タイポ: Noto Serif JP / Noto Sans JP / Cormorant Garamond の 3 種固定
- 装飾: 左ゴールドバー見出し・ドロップキャップ・◆ゴールド箇条書きは仕様 §3.3 上の必須要件

## Screens / Views

### 1. お知らせ一覧（`05_support/news/index.html`）

ファイル: `News List - 案C Timeline Cool.html`

**Purpose**: `05_support/assets/data/news.json` の `items` を新しい順で全件描画する。ヘルプセンター配下のサブページとして、月別タイムラインで時系列を可視化する。

**Layout (1280px design width)**:
```
┌─────────────────────────────────────────────────────┐
│ Header (h=72, padding 0 56, background:#fff)        │
├─────────────────────────────────────────────────────┤
│ Tint Band (gradient #dde7f3 → #eef2f8, padding 18 56 24) │
│   breadcrumb: ヘルプセンター › お知らせ              │
├─────────────────────────────────────────────────────┤
│ Hero (padding 56 56 24, background:#eef2f8)         │
│   eyebrow: "News & Updates · Timeline"               │
│   ┌─────────────────────────────┬──────────────┐    │
│   │ h1 (72px serif "お知らせ")   │ Meta (3列)    │    │
│   │ sub (14px, max-w 620)        │              │    │
│   └─────────────────────────────┴──────────────┘    │
├─────────────────────────────────────────────────────┤
│ Feat Wrap (padding 24 56 8)                          │
│   ┌─Featured card (PICK)──────────────────────────┐ │
│   │ Date(280) │ Tag + Title + Summary │ Arrow    │ │
│   └────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Timeline (padding 48 56 80)                          │
│   tl-status: 全 N 件 · 新しい順                       │
│   ┌─Month group (grid 200px 1fr, border-top)─────┐  │
│   │ Month label (sticky, top:24) │ Items col    │  │
│   │  - num: 05 (latin-serif 44)  │  ◯ item       │  │
│   │  - name: May 2026 (gold)     │  ◯ item       │  │
│   │  - ct: 4 Articles            │  ◯ item       │  │
│   └─────────────────────────────────────────────────┘ │
│   (...月ごとに繰り返し...)                            │
├─────────────────────────────────────────────────────┤
│ Footer (h=72+padding, background:#fff)              │
└─────────────────────────────────────────────────────┘
```

**Components**:

- **`.hc-header`** — 既存サポートシェル。変更不可。height 72, padding 0 56, gap 32, background `#fff`, border-bottom なし。本パッケージはこの上に被さらない。
- **`.hc-tint`** — header 直下のブルーフェード帯。`linear-gradient(180deg, #dde7f3 0%, #e8edf4 60%, #eef2f8 100%)`. padding 18 56 24.
- **`.hero`** — `padding: 56 56 24`. `.ph-eyebrow` は Cormorant Garamond 12.5px / letter-spacing .42em / color `#b08544` / uppercase / 後ろに 60px の goldルール (`::after`)。h1 は Noto Serif JP 72px / weight 600 / line-height 1.0 / letter-spacing .04em / color `#14202f`. `.sub` は 14px / line-height 1.9 / color `#6a7689` / max-width 620. `.ph-meta` は右寄せ 3 列、`b` は 28px serif、ラベルは 11px latin-serif uppercase letter-spacing .28em。
- **`.feat`** — Featured 記事カード。`grid-template-columns: 280px 1fr auto`. padding 36 40. border 1 `#d4dde9`. background `#fff`. ホバー時 `box-shadow:0 24px 56px rgba(20,32,47,.10)`. 左上に `PICK` ラベル（`::before` 絶対配置、`#b08544` background、白文字、Cormorant 10.5px letter-spacing .4em padding 5 12）。
  - `.feat-date .day` — Cormorant 88px / weight 500 / line-height .9.
  - `.feat-date .mo` — Cormorant 14px uppercase letter-spacing .32em `#6a7689`.
  - `.feat-date .yr` — Cormorant 11px letter-spacing .32em `#9aa4b6`.
  - `.feat-body h2` — Noto Serif JP 26px / weight 600 / line-height 1.45 / letter-spacing .02em. ホバー時 color `#b08544`.
  - `.feat-body p` — 13.5px / line-height 1.95 / `#344256` / max-width 680.
  - `.feat-arr` — Cormorant 34px `#6a7689`. ホバー時 `translateX(8px)` + color `#14202f`.
- **`.timeline`** — `padding: 48 56 80`.
  - `.tl-status` — Cormorant 11px uppercase letter-spacing .32em `#9aa4b6`. `::before` で 6px gold ドット。
  - `.tl-month` — `grid-template-columns: 200px 1fr`, gap 32. padding 36 0 12. border-top 1 `#d4dde9`.
  - `.tl-month-label` — sticky, top 24. `.num` 44px Cormorant weight 500. `.name` 13px Cormorant uppercase letter-spacing .36em color `#b08544`. `.ct` 11px Cormorant uppercase letter-spacing .24em `#9aa4b6`, border-top 1 `#e6ecf4`, padding-top 10.
  - `.tl-items` — padding-left 32. `::before` で 1px 縦ライン（`#d4dde9`, left 6, top/bottom 6）.
  - `.tl-item` — `grid-template-columns: 90px 110px 1fr 28px`, gap 24. padding 18 0. border-top 1 dashed `#e6ecf4`（最初の子は透明）. `::before` で左に 13px 丸（`background:#eef2f8`, `border:1px solid #9aa4b6`）。ホバー時 dot を `#b08544` 塗りに、タイトルを `#b08544` に。
  - `.ti-date` — Cormorant 20px weight 500 letter-spacing .04em. `small` 10px uppercase letter-spacing .3em `#9aa4b6`.
  - `.ti-title` — Noto Serif JP 15.5px weight 600 line-height 1.55 letter-spacing .02em.
  - `.ti-sum` — 12.5px line-height 1.85 `#6a7689`.

### 2. お知らせ詳細（`05_support/news/<slug>/index.html`）

ファイル: `News Detail - 案C Timeline Cool.html`

**Purpose**: 1 記事 1 ディレクトリ 1 HTML。仕様 §3.3 のテンプレート骨格を踏襲し、記事ごとの差分は次の 5 箇所のみ：① `<title>`、② breadcrumb 末尾、③ `<time datetime>` + 表示日付、④ `.news-tag`、⑤ `.article-body` 本文。

**Layout (1280px design width)**:
```
┌─────────────────────────────────────────────────────┐
│ Header (共通)                                         │
├─────────────────────────────────────────────────────┤
│ Tint Band                                            │
│   breadcrumb: ヘルプセンター › お知らせ › <title>     │
├─────────────────────────────────────────────────────┤
│ Article Hero (padding 48 56 36)                      │
│   eyebrow: "News & Updates · Article" + gold rule    │
│   meta: <time> · tag · "READ 4 MIN"                  │
│   h1 (38px serif, max-width 920)                     │
│   double rule (line + offset gold line)              │
├─────────────────────────────────────────────────────┤
│ Article Grid (padding 40 56 80, grid 1fr 240, gap 64)│
│   ┌─.article-main (max-w 780)──┬─.article-aside───┐ │
│   │ .article-lede (drop cap)    │ Contents (TOC)   │ │
│   │                              │ Related (max 4)  │ │
│   │ .article-body               │ (sticky top 24)  │ │
│   │   - h2 (left gold border)   │                  │ │
│   │   - p, ul (◆ gold)          │                  │ │
│   │   - figure, blockquote, code│                  │ │
│   │                              │                  │ │
│   │ .article-foot               │                  │ │
│   │   ← back-link | share btns  │                  │ │
│   └──────────────────────────────┴──────────────────┘ │
├─────────────────────────────────────────────────────┤
│ Footer                                               │
└─────────────────────────────────────────────────────┘
```

**Components**:

- **`.article-hero`** — padding 48 56 36, background `#eef2f8`.
  - `.ah-eyebrow` — Cormorant 12.5px uppercase letter-spacing .42em color `#b08544` + 48px gold rule on `::after`.
  - `.ah-meta` — flex / gap 14. `time` Cormorant 15px weight 500 letter-spacing .04em `#14202f`. tag / 区切り `·` `#9aa4b6`.
  - h1 — Noto Serif JP 38px / weight 600 / line-height 1.45 / letter-spacing .02em / max-width 920.
  - `.ah-rule` — 2 本の細罫線。1 本目 `#d4dde9` フル幅、2 本目 gold (`#b08544`/40% opacity) で left:36px オフセット。
- **`.article-grid`** — `grid-template-columns: 1fr 240px`, gap 64. align-items: start.
- **`.article-main`** — max-width 780.
  - **`.article-lede`** — Noto Serif JP 18px / weight 500 / line-height 2.0 / margin-bottom 32. `::first-letter` で **ドロップキャップ**: Noto Serif JP **48px** / weight 600 / color **`#b08544`** / float left / line-height 1 / padding 6 12 0 0.（§3.3 必須要件）
  - **`.article-body`** — 14.5px / line-height 2.0 / color `#344256`.
    - `h2` — Noto Serif JP 22px weight 600 line-height 1.5 letter-spacing .02em. **`border-left: 3px solid #b08544; padding-left: 18px;`** margin 48 0 20 0. `scroll-margin-top: 32` で TOC ジャンプ時のオフセット。（§3.3 必須）
    - `h3` — Noto Serif JP 17px weight 600 margin 32 0 14.
    - `ul li` — padding-left 22. `::before` で **`◆`** color `#b08544` font-size 11px line-height 2.4.（§3.3 必須）
    - `figure` — border 1 `#d4dde9` background `#fff` padding 18. `.placeholder` aspect 16:9, ストライプパターン `repeating-linear-gradient(135deg, #e6ecf4 0 12px, #eef2f8 12px 24px)` + uppercase ラベル。
    - `blockquote` — padding 18 22, background `#e6ecf4`, border-left 3 `#9aa4b6`, Noto Serif JP 15px line-height 1.85.
    - `code` — JetBrains Mono / Consolas 12.5px background `#e6ecf4` padding 2 6 radius 3.
- **`.article-foot`** — margin-top 56, padding-top 32, border-top 1 `#d4dde9`. flex space-between.
  - `.back-link` — Cormorant 13px uppercase letter-spacing .24em `#344256`, border-bottom 1 `#9aa4b6`, `::before` で "← " (16px). ホバーで color/border `#b08544`.
  - `.share` — flex gap 8. ラベル "SHARE" Cormorant 11px uppercase letter-spacing .36em `#9aa4b6`. ボタン w/h 36, border 1 `#d4dde9`, background `#fff`, border-radius 999, color `#344256`. ホバーで border/color `#14202f`.
  - 4 ボタン: 汎用 Share / X (Twitter) / LinkedIn / URL コピー（クリップボード書込み + トースト「URLをコピーしました」）。
- **`.article-aside`** — sticky top 24, flex column gap 24.
  - **`.aside-card`** — background `#fff` border 1 `#d4dde9` padding 22 22 24.
  - `.aside-eyebrow` — Cormorant 10.5px uppercase letter-spacing .42em color `#b08544` + flex line `::after` (`#d4dde9`).
  - `.aside-title` — Noto Serif JP 15px weight 600 letter-spacing .04em.
  - **TOC** (`.toc`) — `.article-body > h2` から自動列挙する想定（`news-detail.js` の `buildTOC()`）。各 h2 に `id="section-N"` を自動付与する。スタイル: 12.5px / padding 6 8 / border-left 2 `#d4dde9` / ホバーで `#b08544` + 背景 `#e6ecf4`。`.on` クラスでアクティブ表示。
  - **Related** (`.related`) — `news.json` から自身を除いた最新最大 4 件を表示する想定（`news-detail.js` の `loadRelated()`）。0 件時は Related カードごと非表示。
    - `.related-item` — flex column gap 6, padding 12 0, border-top 1 dashed `#e6ecf4`（最初の子は透明）.
    - `.r-meta` — Cormorant 11px uppercase letter-spacing .18em `#6a7689` + tag pill (10px / padding 2 8).
    - `.r-title` — Noto Serif JP 12.5px weight 500 line-height 1.55. ホバーで color `#b08544`.

## Interactions & Behavior

### 一覧ページ

- **カードクリック** → 詳細ページへ遷移。リンク先は `items[].url` を `resolveAppPath()` で同一オリジン絶対 URL 化。
- **Featured (PICK)** カードホバー: `box-shadow:0 24px 56px rgba(20,32,47,.10)`、見出しが gold に、矢印が `translateX(8px)`。トランジション .2s。
- **タイムラインアイテム**ホバー: 左ドットが gold 塗りに、タイトル color が gold に、矢印 `translateX(4px)`。
- **月見出し**は `position:sticky; top:24px` で、月をスクロールしながら確認できる。
- **空状態**: 「現在お知らせはありません」を `.timeline` 内に表示。
- **エラー状態**: 「お知らせの取得に失敗しました」を `.timeline` 内に表示。ヘッダー・フッターは維持。

### 詳細ページ

- **TOC クリック** → 対応する `<h2 id="section-N">` へ `window.scrollTo({behavior:'smooth'})` でスクロール。`scroll-margin-top:32px` で固定ヘッダー分のオフセット。クリック時に `.on` クラスを移動。
- **URL コピー**: `navigator.clipboard.writeText(location.href)` 実行後、`.toast` を 1.6 秒表示。
- **X / LinkedIn / Share**: 仕様上は外部シェア API。X = `https://twitter.com/intent/tweet?url=...&text=...`、LinkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=...`、Share = `navigator.share()`（対応端末のみ）。
- **戻りリンク**: 「お知らせ一覧へ」で一覧ページへ。breadcrumb の「お知らせ」リンクからも同じ。

### Accessibility (仕様 §7.2)

- `.timeline`, `.tl-items` は `aria-live="polite"` を付与。
- 各カードは `<article>` 構造で、リンク全体（`<a>`）を 1 つのクリック領域に。
- キーボードのみで 帯 → 詳細 → 一覧 → 詳細 → 一覧 の往復ができること。`.tl-item`, `.feat`, `.related-item` を `<a>` で実装すれば自然に達成可能。

## State Management

- `newsItems: NewsItem[]` — `news.json` の `items` をそのまま保持。
- `loading: boolean` / `error: string | null` — fetch 状態。
- **詳細ページ**:
  - `relatedItems: NewsItem[]` — 自身を除いた最新最大 4 件。
  - `tocSections: { id: string; text: string }[]` — `.article-body > h2` をスキャンして生成。
  - `activeSection: string` — IntersectionObserver で現在画面に表示中の section id を追跡（scroll-spy）。

### Data fetching

```ts
// 一覧
async function loadNewsList(): Promise<NewsItem[]> {
  const res = await fetch(resolveSupportDataPath('news.json'));
  const data = await res.json();
  return [...data.items].sort((a, b) => b.date.localeCompare(a.date));
}

// 月別グルーピング
function groupByMonth(items: NewsItem[]): { ym: string; items: NewsItem[] }[] {
  // date "YYYY-MM-DD" の "YYYY-MM" でグルーピング
}
```

`NewsItem` 型は要件定義書 §4.2 を参照。

## Design Tokens

### Colors

```css
/* Header chrome (既存・変更不可) */
--hc-white:    #ffffff;
--hc-tint-top: #dde7f3;
--hc-tint-mid: #e8edf4;
--hc-pill-bg:  #aac8de;
--hc-pill-fg:  #1f3144;
--hc-cta:      #1a1f2a;
--hc-link:     #2a2a2a;

/* Body (本パッケージで導入する新パレット) */
--canvas:    #eef2f8;  /* ボディ背景 — ヘッダー帯から連続させる cool ペーパー */
--canvas-2:  #e6ecf4;  /* 一段濃い背景 (引用・コードなど) */
--paper:     #ffffff;  /* カード面 */
--line:      #d4dde9;  /* 通常境界線 */
--line-soft: #e6ecf4;  /* 弱い境界線 (dashed や内部仕切り) */
--ink:       #14202f;  /* 主要テキスト (見出し・タイトル) */
--ink-2:     #344256;  /* 本文 */
--ink-3:     #6a7689;  /* 補助テキスト */
--ink-4:     #9aa4b6;  /* メタ・ラベル */
--gold:      #b08544;  /* アクセント (見出しバー・ドロップキャップ・ホバー・◆) */
--gold-2:    #caa770;  /* gold 派生 */
--gold-soft: #d8c79b;  /* gold 派生 (使用箇所少) */

/* カテゴリタグ (意味色) */
--tint-update:   #d6e3ee; /* fg #1f3144 */
--tint-info:     #aac8de; /* fg #1f3144 (お知らせ・既存ピル形状を継承) */
--tint-maint:    #e8d6a3; /* fg #5e4413 (警告は暖色を残す方が直感的) */
--tint-incident: #e6b6b0; /* fg #7a221d */
--tint-press:    #cfd6a8; /* fg #4a4d2a */
```

### Typography

```css
--serif:        'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho',serif;
--sans:         'Noto Sans JP',-apple-system,'Hiragino Sans',sans-serif;
--latin-serif:  'Cormorant Garamond','Noto Serif JP',serif;
```

Weights ロード: Noto Serif JP 500/600/700 · Noto Sans JP 300/400/500/600/700 · Cormorant Garamond 400/500/600/700.

Scale（実測値）:

| Role | Family | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|---|
| Hero h1 (list) | serif | 72px | 600 | 1.0 | .04em |
| Article h1 (detail) | serif | 38px | 600 | 1.45 | .02em |
| Article h2 | serif | 22px | 600 | 1.5 | .02em |
| Article h3 | serif | 17px | 600 | 1.5 | .02em |
| Lede (drop cap) | serif | 18px | 500 | 2.0 | — |
| Lede first-letter | serif | **48px** | 600 | 1.0 | — |
| Body | sans | 14.5px | 400 | 2.0 | — |
| Featured h2 | serif | 26px | 600 | 1.45 | .02em |
| Featured date day | latin-serif | 88px | 500 | .9 | .02em |
| Timeline month num | latin-serif | 44px | 500 | 1.0 | .04em |
| Timeline ti-date | latin-serif | 20px | 500 | 1.1 | .04em |
| Timeline ti-title | serif | 15.5px | 600 | 1.55 | .02em |
| Eyebrows | latin-serif | 12.5–13.5px | 400 | — | .28–.42em |
| Tags / pills | sans | 12px | 500 | 1.0 | .04em |
| Aside title | serif | 15px | 600 | 1.5 | .04em |
| TOC items | sans | 12.5px | 400 | 1.6 | — |
| Related title | serif | 12.5px | 500 | 1.55 | — |

### Spacing

横方向の本文ガター: **56px**（全画面共通）。コンテンツ最大幅: 一覧は viewport-fluid、詳細 main は **780px** max、aside は **240px** 固定。

### Borders & Radii

- カード/カバー: border 1px solid `var(--line)`. radius 0（角は立てる）。
- タグ（ピル）: radius 999px。
- aside card: radius 0.
- share button: radius 999px, 36×36.

### Shadows

- 通常: 影なし（編集物トーン）。
- カードホバー: `box-shadow: 0 16px 48px rgba(20,32,47,.10)`.
- Featured ホバー: `box-shadow: 0 24px 56px rgba(20,32,47,.10)`.
- カードリフト: `transform: translateY(-3px)` (transition .15–.2s).

### Decorative motifs

- **Gold rule**: 1px gold line. eyebrow の右に短く `::after` で添える / `.ah-rule` で本文境界に二重線として使う。
- **Drop cap**: `::first-letter` 48px serif gold（仕様 §3.3）。
- **Bullet ◆**: ul の `::before` に `◆` gold（仕様 §3.3）。
- **左ボーダー見出し**: `.article-body h2` に `border-left:3px solid var(--gold); padding-left:18px;`（仕様 §3.3）。
- **PICK badge**: 案 C 固有。Featured 記事の左上に gold 矩形。
- **ストライプ**: figure プレースホルダーで `repeating-linear-gradient(135deg, #e6ecf4 0 12px, #eef2f8 12px 24px)`。

## Assets

固有画像なし。SVG は次の 3 種をインラインで使用：

- ロゴ三角形（ヘッダー）: `<path d="M16 4 L28 26 L4 26 Z" fill="#1a1a1a"/>`、viewBox 0 0 32 32, 34×34.
- X (Twitter) アイコン: 公式マーク (fill currentColor)
- LinkedIn アイコン: 公式マーク (fill currentColor)
- Share / Copy アイコン: feather-icons 相当のストロークアイコン (stroke-width 1.6)

実装側ではこれらを既存のアイコンライブラリ（lucide / heroicons など）に差し替えても可。

## Files

本パッケージに同梱：

- `News List - 案C Timeline Cool.html` — 一覧ページのデザインリファレンス
- `News Detail - 案C Timeline Cool.html` — 詳細ページのデザインリファレンス
- `README.md` — このファイル

参考（プロジェクト本体側で参照）：

- `要件定義書（お知らせ動線）` — 動作・データ・連携要件の正本
- `05_support/assets/data/news.json` — データ正本
- `05_support/assets/js/news-list.js` — 一覧の動的描画
- `05_support/assets/js/news-detail.js` — 詳細の TOC + Related
- `05_support/assets/js/support-shell.js` — 共通ヘッダー/フッター注入
- `05_support/assets/js/utils.js` — `resolveSupportDataPath()` 等

## 実装時の優先順位

1. **配色トークン** を CSS 変数として導入（既存のサポートサイト変数と衝突する場合は `--news-*` などプレフィックスを付ける）。
2. **タイポ** を Google Fonts 経由でロード（既にロード済みのプロジェクトはそのまま使用）。
3. **一覧ページ**を実装 — 既存の `news-list.js` を流用しつつ、DOM 構造を本リファレンスに合わせて再構築。月別グルーピングのロジックを追加。
4. **詳細ページ**のテンプレートを 1 本作り、`05_support/news/<slug>/index.html` 各記事はそこから差分 5 箇所のみを置換する形で量産。`news-detail.js` の `buildTOC()` / `loadRelated()` はそのまま再利用。
5. **状態とエラーパターン** を実装し、`aria-live` を付与。

## レビューポイント（実装後）

- [ ] PC 1920×1080 で hero が full viewport を阻害していないか
- [ ] sticky な `.tl-month-label` が長月でも崩れず追従するか
- [ ] ドロップキャップが `::first-letter` で 48px gold に描画されるか
- [ ] `<h2>` の左 gold バーが TOC ジャンプ後もずれないか（`scroll-margin-top`）
- [ ] URL コピー後にトーストが出るか
- [ ] 0 件・取得失敗の各状態が `.timeline` 内に収まり、ヘッダー / フッターは維持されるか
