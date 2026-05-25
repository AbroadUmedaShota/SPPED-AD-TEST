# Handoff: お知らせページ（News）

## Overview

SPEED-AD サポートサイト配下に置かれる「お知らせ」動線のうち、**一覧ページ**と**詳細ページ**のデザインリファレンス。要件定義書（17 番のサポートサイト分離方針を踏まえた `お知らせ動線 要件定義書`）に従い、「シンプル・イズ・ベスト」方針で構成した B案（Compact Newspaper）を採用したものです。

スコープ:

- 一覧ページ（`05_support/news/index.html`）
- 詳細ページ（`05_support/news/<slug>/index.html`、サンプル: `branch-logic-renewal/`）

**スコープ外**（要件書 §1 参照）:

- ログイン前トップのお知らせ帯（`#public-news-section`）
- ヘルプ／FAQ／お問い合わせ等の他サポート画面

## About the Design Files

このバンドル内の HTML/CSS/JS は **デザインリファレンス**（プロトタイプ）です。  
目的は「最終的な見た目・挙動・データ構造」を伝えることであり、**そのまま本番デプロイするコードではありません**。

実装者は、対象コードベースの既存環境（既存の `support-shell.js` によるヘッダー／フッター注入、`resolveSupportDataPath()` などのユーティリティ、CSS 命名規約など）に合わせて、このプロトタイプを **再実装** してください。  
クライアント完結（サーバー処理なし）、`05_support/assets/data/news.json` を唯一のデータ正本として扱う点は要件定義書（§4）どおりです。

## Fidelity

**High-fidelity (hifi)**

- 色・タイポグラフィ・余白・角丸・ホバーや遷移は最終仕様として確定。
- `news.css` の各値はそのまま使ってよい想定です（既存命名規約に合わせるリネームは可）。
- アイコンは share ボタン4種のみ inline SVG として記載。他のアイコン素材は使用していません。

## 採用案について（参考）

3案検討し、**B案（Compact Newspaper）** を採用しました。  
- A案 / C案のソースは `_variants_reference/` に参考として残してあります。
- 採用理由: 一覧の役割を「素早く俯瞰できること」に絞り、装飾（PICK カード／月別ブロック／3列カード）を排除し、1行=1記事の最小構成にした方が SPEED-AD ダッシュボードの実用的なトーンと整合するため。

---

## Screens

### 1. 一覧ページ（`05_support/news/index.html`）

#### Purpose
公開済みお知らせを全件、新しい順に閲覧する。カテゴリで絞り込み可能。

#### Layout（PC 1280px〜）

```
┌─ Support Header ──────────────────────────────────┐
│ ▲ SPEED-AD Support           ヘルプ FAQ [お知らせ] お問い合わせ │
├─ Tint Band ───────────────────────────────────────┤
│ ヘルプセンター / お知らせ                          │
├─ .page (max-width 1080, padding 0 32) ────────────┤
│                                                    │
│  Hero                                              │
│   NEWS & UPDATES        (eyebrow / 12px / brand)   │
│   お知らせ              (h1 / 40px / 700)          │
│                          10 件 / 最終更新 2026.05.22│
│  ─── 1px ink solid ───                             │
│                                                    │
│  Toolbar (filters)                                 │
│  [All][アップデート][重要][メンテナンス]…         │
│  ─── 1px line ───                                  │
│                                                    │
│  List                                              │
│  ─── 2026 (uppercase, 12px, muted) ───             │
│  2026.05.22 FRI | アップデート | タイトル / summary →│
│  ─── separator ───                                 │
│  2026.05.14 THU | 重要        | ...             →│
│  …                                                 │
│  ─── 2025 ───                                      │
│  …                                                 │
│                                                    │
├─ Support Footer ──────────────────────────────────┤
│ © 2026 SPEED-AD. All rights reserved.              │
└────────────────────────────────────────────────────┘
```

#### Components

| Component | 仕様 |
| --- | --- |
| **Support Header** | 背景 `#EEF3FB`、下罫 `#DCE6F4` 1px、padding `14px 32px`。左にロゴ（22px三角形 + "SPEED-AD Support" 15px/700）、右にナビ（`14px`）。アクティブリンクは `border:1px solid #BFD1EF` + 角丸 `999px` + 半透明白背景。 |
| **Tint Band (Breadcrumb)** | 背景 `#F6F9FE`、下罫 `#F1F3F6`。中身 `font-size:12.5px`, color `--muted #6B7280`、区切り `/`（`#9CA3AF`）、末尾要素は `--ink-2 #374151` / weight 500。`max-width:1080px`、`padding:14px 32px`。 |
| **Hero** | padding `56px 0 28px`、下罫 1px solid `--ink #111827`。Eyebrow → h1 → 件数の縦並び。Eyebrow `12px / 600 / 0.18em / uppercase / --brand`。h1 `40px / 700 / line-height 1.2 / letter-spacing -0.01em`。件数表示は `13px / --muted`、件数は `--ink / 600`、`font-variant-numeric: tabular-nums`。 |
| **Filter Toolbar** | padding `18px 0`、下罫 `--line #E5E7EB`。 横スクロール可。チップ `font-size:12px`, `padding:6px 12px`, border-radius `999px`, border `1px solid --line`, 背景 `#fff`。アクティブ: 背景 `--ink #111827`、色 `#fff`、border-color `--ink`。非アクティブ hover で border-color `--brand`, color `--brand-ink`。 |
| **Year Separator** | `display:flex`、左右に `flex:1` の `1px` 罫線、中央に `12px / 0.18em / uppercase / --muted-2 #9CA3AF`。 padding `32px 0 14px`。 |
| **Row (1記事1行)** | `display:grid`、`grid-template-columns: 120px 110px 1fr 32px`、`gap:24px`、`align-items:baseline`、`padding:22px 0`、下罫 `1px solid --line`。 hover で背景 `--brand-softer #F6F9FE`。 |
|  - 日付 | `13.5px / --ink-2 / tabular-nums / 0.04em`、曜日(3文字) は `11px / --muted-2 / 0.1em`、左 margin `6px`。表示形式 `YYYY.MM.DD DOW`（DOW は SUN/MON/.../SAT）。 |
|  - タグ | tag 1個のみ表示。tag は `--tag-bg #EEF3FB / --tag-ink #1D4ED8 / 11px / 500 / padding 3px 8px / radius 4px`。 |
|  - 本文 | タイトル `15px / 600 / --ink / line-height 1.55 / margin 0 0 4px`、要約 `12.5px / --muted / line-height 1.65`。 |
|  - 矢印 | `→`、color `--muted-2`。 hover で `--brand` + `transform: translateX(3px)`、 transition `.15s`。 |

#### Responsive (`@media (max-width: 900px)`)

- Header / Tint / Hero / Toolbar はそのまま。
- Row は `grid-template-columns: 1fr` に折りたたみ。`tl-item__arrow` は `display:none`。

#### Empty / Error states

- 0件: `.news-state` で「該当するお知らせはありません。」（カテゴリフィルタの結果として 0 件のときも同様）
- fetch 失敗: 「読み込みに失敗しました。」

#### Behavior

- 初期表示: `news.json` を `fetch` → `items` を `date` 降順でソート → 全件描画。
- Hero の件数・最終更新は描画完了時にセット。
- フィルタチップは `items` から `tags[0] || category` の集合を生成。`All` が常時先頭。
- 行クリックで詳細ページへ遷移（**同一オリジン遷移、`target="_blank"` 不使用**）。

---

### 2. 詳細ページ（`05_support/news/<slug>/index.html`）

#### Purpose
1記事の本文を読む。目次・関連記事・SNSシェアを伴う。

#### Layout

```
┌─ Support Header ──────────────────────────────────┐
├─ Tint Band ───────────────────────────────────────┤
│ ヘルプセンター / お知らせ / <記事タイトル>          │
├─ .page (max-width 1080, padding 0 32) ────────────┤
│                                                    │
│  Article Hero                                      │
│   NEWS & UPDATES · ARTICLE   (eyebrow)             │
│   2026.05.22 FRI · [タグ] · READ 1 MIN  (meta)     │
│   h1 / 34px / 700 / line-height 1.45               │
│  ─── 1px line solid ───                            │
│                                                    │
│  Article Grid (1fr 240px, gap 64)                  │
│  ┌───────────────────────────┐ ┌────────────────┐ │
│  │ Article Main (max 720)     │ │ Aside (240)    │ │
│  │  .article-lede             │ │  ┌Contents───┐ │ │
│  │   17px / line-height 2     │ │  │ • 概要    │ │ │
│  │  .article-body             │ │  │ • 主な変更│ │ │
│  │   h2 (border-left 3px brand)│ │  │ • 影響範囲│ │ │
│  │   p / ul (◇ ゴールドなし、 │ │  └───────────┘ │ │
│  │            ブランド四角)    │ │  ┌Related────┐ │ │
│  │   blockquote (softer bg)    │ │  │ 2026.05.14 │ │ │
│  │   code (mono / softer bg)   │ │  │ 記事タイトル│ │ │
│  │                              │ │  │ ...        │ │ │
│  │  Article Foot                │ │  └───────────┘ │ │
│  │  ← お知らせ一覧へ   [○○○○]│ └────────────────┘ │
│  └───────────────────────────┘                     │
│                                                    │
├─ Support Footer ──────────────────────────────────┤
└────────────────────────────────────────────────────┘
                              [URLをコピーしました] ← toast
```

#### Components

| Component | 仕様 |
| --- | --- |
| **Article Hero** | padding `56px 0 36px`、下罫 1px `--line`。 eyebrow `11.5px / 0.18em / --brand`、 meta `12.5px / --muted` 横並び（`<time>` は `--ink-2 / 0.04em / tabular-nums`、間にφ3px のドット）、 h1 `34px / 700 / 1.45 / -0.005em / --ink`。 |
| **READ N MIN** | `news-detail` 相当のJSが、 lede + body の合計文字数を `Math.round(len / 450)` で算出（最低1分）。 |
| **Article Grid** | `grid-template-columns: minmax(0,1fr) 240px`、`gap:64px`、`align-items:start`、padding `48px 0 80px`。 |
| **Article Lede** | `17px / 500 / line-height 2 / --ink-2`、 margin 下 32px。 ※採用版ではドロップキャップ・ゴールド指定は撤去。 |
| **Article Body h2** | `20px / 700 / --ink`、 padding-left 14px、 `border-left: 3px solid --brand`、 `scroll-margin-top: 32px`（TOC ジャンプのオフセット用）。 ID は `section-N` を JS で自動付与。 |
| **Article Body h3** | `16px / 700 / --ink`。 |
| **Article Body p** | `15px / line-height 1.95 / --ink-2`、 margin下 16px。 |
| **Article Body ul** | リストマーカーは `::before` の `5px` 四角 (`--brand`)、 padding-left 18px、 li 下 6px。 |
| **Article Body ol** | カウンタ + `--brand` 数字。 |
| **Article Body figure** | `border 1px solid --line`、 radius 8px、 中身 16:9 のストライプ placeholder。 |
| **Article Body blockquote** | 背景 `--brand-softer`、 左 `3px #C7D6EE`、 padding `14px 18px`、 `14px / --ink-2`。 |
| **Article Body code** | monospace、 `--brand-ink`、 背景 `#F1F3F6`、 padding `2px 6px`、 radius 4px。 |
| **Aside Card** | `position:sticky; top:24px`、 border 1px `--line`、 radius 10px、 padding `20px 18px`、 背景 #fff、 margin-bottom 20px。 |
| **Aside Title** | `11px / 700 / 0.18em / uppercase / --muted`、 下罫 `1px --line-2`、 padding下 12px。 |
| **TOC li a** | `13px / --muted / padding 5px 8px / border-left 2px transparent`。 hover で `--ink` + 背景 `--brand-softer`。 アクティブ(`.on`) で `--brand-ink` + border-left `--brand` + 背景 `--brand-softer` + weight 500。 |
| **Related li** | `r-date 11px / --muted-2 / tabular-nums`、 `r-title 13px / --ink-2 / line-height 1.5`、 li間下罫 `--line-2`。 hover で `--brand-ink`。 |
| **Article Foot** | margin-top 56px、 padding-top 28px、 上罫 `--line`、 `justify-content: space-between`。 |
| **Back link** | `13px / 500 / --ink-2`、 hover で `--brand-ink`。 矢印 `←` 付き。 |
| **Share** | 4ボタン（`native / twitter / linkedin / copy`）、 各 `36×36`、 radius 50%、 border 1px `--line`、 背景 #fff、 SVG `15×15`、 color `--ink-2`。 hover で border `--brand`、color `--brand`、bg `--brand-softer`。 |
| **Toast** | `position:fixed; bottom:32px; left:50%; transform:translateX(-50%)`、背景 `--pick-bg #111827`、 #fff、 padding `10px 18px`、 radius 999px、 13px。 `.show` で `opacity:1; transform: translateX(-50%) translateY(0)`、 1600ms 後 解除。 |

#### Responsive (`@media (max-width: 900px)`)

- Article Grid を `1fr` に折り畳み、 Aside は `position:static`。
- h1 は 26px に縮小。

#### Behavior

- 初期化（インラインJS）:
  1. `calculateReadMin()` で lede + body 文字数から `READ N MIN` を設定。
  2. `buildTOC()` で `#article-body > h2` を列挙し、 id 付与 + TOC li 生成。
  3. `initScrollSpy()` で `IntersectionObserver({rootMargin:"-30% 0px -50% 0px"})` を仕掛けて TOC リンクに `.on` を付け替え。
  4. `loadRelated()` で `news.json` を fetch、 自記事を除外して `date` 降順で最大4件を Related に。 0件のとき Related カードごと `hidden`。
- Share ボタン:
  - `native`: `navigator.share()` があれば起動、 なければ `clipboard.writeText` フォールバック → toast。
  - `twitter`: `https://twitter.com/intent/tweet?url=...&text=...` を `target=_blank, noopener` で開く。
  - `linkedin`: `https://www.linkedin.com/sharing/share-offsite/?url=...` 同上。
  - `copy`: `clipboard.writeText(location.href)` → toast。
- TOC アンカークリックは標準 `<a href="#section-N">`。 `scroll-margin-top: 32px` でオフセット。

#### 自記事除外 ロジック注意点

`location.pathname` の末尾セグメントが `index.html` のとき slug は **末尾から2番目** のセグメントを採用すること（要件 §3.3 の Related 仕様）。
```js
const segs = location.pathname.replace(/\/$/, "").split("/");
const self = segs.at(-1) === "index.html" ? segs.at(-2) : segs.at(-1);
const items = (data.items || []).filter(it => !it.url.includes("/" + self + "/"));
```

---

## Interactions & Behavior（共通）

- すべての画面でクライアント完結（サーバー処理なし）。
- HTML エスケープは `news.json` 由来の全文字列で必須（簡易関数 `esc()` を各ファイルに同梱）。
- `items[].url` は `/^05_support\/news\/[\w\-]+\/$/` で検証し、許容外形式の項目は描画しない。
- `aria-live="polite"` を一覧コンテナと TOC コンテナに付与。
- キーボードのみで一覧→詳細→一覧の往復が可能。

---

## State Management

- 一覧:
  - `ALL: Item[]` — fetch 完了後の全件（date 降順）
  - `activeCat: string` — 現在選択中のカテゴリ。デフォルト `"All"`。
- 詳細:
  - DOM だけで完結（TOC は `<a href="#">`、scroll-spy は IO で `.on` 付け替え）。
  - Related は fetch 完了時に一度だけ生成。

---

## Design Tokens

`05_support/assets/css/news.css` 冒頭の `:root` を参照。

| 用途 | 変数 | 値 |
| --- | --- | --- |
| Brand | `--brand` | `#2563EB` |
| Brand (deep) | `--brand-ink` | `#1D4ED8` |
| Brand bg soft | `--brand-soft` | `#EEF3FB` |
| Brand bg softer | `--brand-softer` | `#F6F9FE` |
| Ink | `--ink` | `#111827` |
| Ink 2 | `--ink-2` | `#374151` |
| Muted | `--muted` | `#6B7280` |
| Muted 2 | `--muted-2` | `#9CA3AF` |
| Line | `--line` | `#E5E7EB` |
| Line 2 | `--line-2` | `#F1F3F6` |
| Tag bg | `--tag-bg` | `#EEF3FB` |
| Tag ink | `--tag-ink` | `#1D4ED8` |
| Pick bg (toast) | `--pick-bg` | `#111827` |
| Shadow sm | `--shadow-sm` | `0 1px 2px rgba(17,24,39,0.04)` |
| Shadow md | `--shadow-md` | `0 4px 16px rgba(17,24,39,0.06)` |
| Radius | `--radius` | `10px` |

### Type Scale

- Font family: `"Noto Sans JP", -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic UI", "Meiryo", sans-serif`
- Body base: `15px / line-height 1.7`
- 主な見出し: 一覧 h1 `40px/700`、詳細 h1 `34px/700`、 body h2 `20px/700`、 body h3 `16px/700`。
- 12〜13px は muted ラベル類、 10.5〜11px は eyebrow/badge。

### Spacing

`8px` を基本単位とした暗黙スケール。 主要値は `16 / 18 / 22 / 24 / 28 / 32 / 48 / 56 / 64 / 80px`。

### Iconography

- ロゴ: `<path d="M12 2 L22 20 H2 Z"/>` の三角形（fill `#111827`）。
- Share 4種: native（共有グラフ）、 X（公式マーク）、 LinkedIn（公式マーク）、 copy（リンクチェーン）。 すべて `currentColor` の inline SVG。

---

## Data Schema

正本: `05_support/assets/data/news.json`。

```json
{
  "updatedAt": "YYYY-MM-DD",
  "items": [
    {
      "date":        "YYYY-MM-DD",      // 必須。<time datetime> に使う
      "displayDate": "YYYY.MM.DD",      // 必須。Related カードの表示など
      "title":       "string",          // 必須
      "summary":     "string",          // 必須
      "url":         "05_support/news/<slug>/",  // 必須・相対パス・正規表現で検証
      "category":    "string",          // 任意
      "tags":        ["string", ...]    // 任意。先頭1件のみ表示
    }
  ]
}
```

並び順は `date` 降順。同日内は配列順を維持。

URL 解決:

- 一覧 → 詳細: `items[].url` の先頭 `05_support/news/` を取り除いた `<slug>/`（同階層相対）。
- 詳細 → 一覧: `../`。
- 詳細 → 他詳細（Related）: `../<slug>/`。

---

## Assets

- 外部フォント: Google Fonts `Noto Sans JP` (`400/500/600/700`)。 link rel preconnect 同梱。
- 画像アセット: なし（記事本文 `<figure>` の 16:9 ストライプはCSSのみ）。
- SVG: すべて inline。 外部スプライト不要。

---

## Files

```
design_handoff_news/
├── README.md                                          ← このファイル
└── files/
    └── 05_support/
        ├── news/
        │   ├── index.html                             ← 一覧（B案採用）
        │   └── branch-logic-renewal/
        │       └── index.html                         ← 詳細のテンプレート兼サンプル
        └── assets/
            ├── css/news.css                           ← 一覧・詳細共通スタイル
            └── data/news.json                         ← データ正本（10件のサンプル）
```

### 実装時の対応ファイル（要件定義書 §10）

| プロトタイプ | 既存コードベース上の対応 |
| --- | --- |
| `05_support/news/index.html` のインライン JS | `05_support/assets/js/news-list.js` に分離 (`loadNewsList()` / `groupByMonth()` 等) |
| `05_support/news/<slug>/index.html` のインライン JS | `05_support/assets/js/news-detail.js` に分離 (`calculateReadMin()` / `buildTOC()` / `initScrollSpy()` / `loadRelated()`) |
| プロトタイプ内のヘッダー / フッター JSX 風 HTML | `support-shell.js` による `/common/header.html` `/common/footer.html` 注入に置き換え |
| 直書きパス `../assets/data/news.json` | `resolveSupportDataPath('news.json')` を利用 |

---

## Acceptance（要件定義書 §9 抜粋）

- [ ] 一覧が `news.json` から動的描画（新しい順、 全件表示）。
- [ ] 1行=1記事のレイアウト。年セパレータあり。
- [ ] カテゴリフィルタで絞り込み可。
- [ ] 各行から詳細へ同一オリジン遷移できる（`target="_blank"` **不使用**）。
- [ ] 詳細に Article Hero / Lede / 本文 / Article Foot / 右ペイン Aside (TOC + Related) が描画される。
- [ ] TOC クリックでスムーズスクロール（`scroll-margin-top:32px`）。
- [ ] Scroll-spy で表示中の `<h2>` に対応する TOC `.on`。
- [ ] `READ N MIN` が本文文字数から自動算出（450文字/分・下限1分）。
- [ ] Share/X/LinkedIn/Copy の4ボタンが正しく機能。 Copy 時にトーストを 1.6 秒表示。
- [ ] Related に自記事を含めない（slug 検出は `index.html` 末尾形式に対応すること）。
- [ ] JSON 由来文字列の XSS が発生しない（全文字列 escape）。
- [ ] 取得失敗時、一覧は `.news-state` でエラーメッセージを表示。
- [ ] ローカル開発（`python scripts/dev-server.py` / Live Server 5500）でも動作。

---

## 補足

- このプロトタイプは要件定義書のうち「シンプル・イズ・ベスト」を優先し、 要件書 §3.2 / §3.3 が想定していた **Timeline Cool（ゴールド + セリフ + ドロップキャップ + Featured PICK）** の意匠は撤去しています。 実装時、要件書ドキュメント側の表現も実装に合わせて更新するかを別途確認してください。
- 詳細ページの本文は 2 スクロール程度に収まる軽量構成を意図しています（h1 → lede → h2×3）。 本文が長くなるケースでは aside の Related 件数（最大4）と TOC のみで十分対応できます。
