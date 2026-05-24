# Handoff: ログイン前お知らせ動線

このバンドルは、ログイン前ページから到達するお知らせ画面群（**帯・一覧・詳細**）の実装ハンドオフ資料です。

---

## 1. このバンドルについて

- `mocks/` 配下の HTML はデザイン参照用です。**そのまま production にデプロイするものではなく**、SPEED AD の既存環境にあるパターン・コンポーネントで再現してください。
- 既存コードベースがある場合は、そこにある CSS/JS の規約（命名・分割・支援スクリプト `support-shell.js` など）に必ず従ってください。
- フィデリティは **高（Hi-Fi）** です。色・タイポ・間隔・状態 UI まで最終想定で作ってあります。ピクセル合わせで再現してください。

## 2. スコープ・成果物

仕様正本: 同梱の **`SPEC.md`**（ログイン前お知らせ動線 要件定義書）。本 README は仕様を補強する実装メモです。

| # | 画面 / 成果物 | パス | モック |
| --- | --- | --- | --- |
| P1 | お知らせ帯（LP ヒーロー直下） | `index.html` `#public-news-section` | `mocks/proposal-index.html` 内「LP Hero Band」プレビュー |
| P2 | お知らせ一覧 | `05_support/news/index.html` | `mocks/news-list.html` |
| P3 | お知らせ詳細 | `05_support/news/<slug>/index.html` | `mocks/news-detail.html` |
| D  | データ正本 | `data/news.json` | `data/news.sample.json`（本バンドル同梱） |

> `mocks/proposal-index.html` は提案全体の概観で、本実装には不要です。レビュー時の参照用に同梱しています。

## 3. 関連ファイル（既存）

- `data/news.json` — お知らせの唯一のデータ正本。クライアント完結 fetch。
- `index.html` — `#public-news-section`（既存）・フッター「お知らせ」リンク
- `js/login-front.js` — `loadPublicNews()` / `pickPublicNewsUrl()` / `resolveAppPath()` を踏襲
- `05_support/assets/js/support-shell.js` — `/common/header.html` `/common/footer.html` 注入
- 17 番 サポートサイト分離 補足メモ — URL 方針はこちらに従う

## 4. データスキーマ

`data/news.json`:

```json
{
  "updatedAt": "2026-05-21",
  "items": [
    {
      "date": "2026-05-21",
      "displayDate": "2026.05.21",
      "title": "QR回答フローを刷新 ― 来場者の離脱率を約 32% 改善する新UIをリリースしました",
      "summary": "会場でのQR読み取り後の導線を全面刷新。設問遷移・自動保存・回答中断/再開に対応し、テーマカラー設定と多言語対応（日・英・中）を追加しました。",
      "url": "05_support/news/qr-flow-refresh-2026/",
      "category": "アップデート",
      "tags": ["アップデート"]
    }
  ]
}
```

**ルート**

| key | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `updatedAt` | `YYYY-MM-DD` | ◯ | ファイル最終更新日 |
| `items` | array | ◯ | お知らせ配列（**新しい順で格納**） |

**items[]**

| key | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `date` | `YYYY-MM-DD` | ◯ | `<time datetime>` に使用 |
| `displayDate` | `YYYY.MM.DD` | ◯ | 画面表示用 |
| `title` | string | ◯ | タイトル |
| `summary` | string | ◯ | 一覧・帯で表示する要約 |
| `url` | string | ◯ | `05_support/news/<slug>/` 形式の相対パス |
| `category` | string | 任意 | タグ表示のフォールバック |
| `tags` | string[] | 任意 | 先頭 1 件のみ一覧カードで表示 |

サンプル: `data/news.sample.json` 参照。

### タグ表示のルール（仕様 §3.2 / §4.2）

- `tags` が指定されていれば `tags[0]` を 1 件表示。
- `tags` が無く `category` がある場合は `category` を 1 件表示。
- **複数タグの同時表示は不可**。

### 並び順

- `date` 降順。同日内は配列の出現順を維持。
- 並び替えは**クライアント側**で行う。

### URL 規則

- `items[].url` は `05_support/news/<slug>/` 形式の相対パスのみ許容。
- 表示時は `js/login-front.js` の `resolveAppPath()` で同一オリジン絶対 URL に解決。
- 規定外形式は描画スキップ（XSS と誤遷移の防止）。

---

## 5. 画面別 実装メモ

### 5.1 お知らせ帯（P1）｜ `index.html` `#public-news-section`

- ヒーロー直下に配置。**LCP を阻害しない**こと（初回ペイント後の遅延注入推奨）。
- `data/news.json` → 先頭最大 3 件 → カード描画。
- カード表示: `displayDate` / `title` / `summary`（仕様 §3.1）。
- カードクリック → 詳細ページ。同一オリジン遷移、新規タブ禁止。
- セクション末尾「一覧を見る」 → 一覧へ。
- `items` 0 件または取得失敗時は **セクション全体を非表示**（仕様 §3.1）。エラー UI は出さない。
- 既存 `loadPublicNews()` の挙動を踏襲。
- `aria-live="polite"` を維持。

レイアウト（モックの幅 1200px 基準）:

```
┌──────┬──────────────┬──────────────┬──────────────┬─────────┐
│ NEWS │ 2026.05.21   │ 2026.05.18   │ 2026.05.15   │ 一覧を  │
│ お知 │ [UPDATE]     │ [UPDATE]     │ [MAINT]      │ 見る → │
│ らせ │ タイトル…    │ タイトル…    │ タイトル…    │         │
│      │ 要約 2 行    │ 要約 2 行    │ 要約 2 行    │         │
└──────┴──────────────┴──────────────┴──────────────┴─────────┘
   120px        1fr            1fr            1fr        130px
```

要約は 2 行クランプ（`-webkit-line-clamp: 2`）。

### 5.2 一覧（P2）｜ `05_support/news/index.html`

- `support-shell.js` が `/common/header.html` `/common/footer.html` を注入。本画面では既存の共通ヘッダー/フッターを利用。
- パンくず: `ヘルプセンター › お知らせ`
- 表示順: `date` 降順、**全件**（ページネーション無し）。
- カード表示要素: `displayDate` / 単一タグ（`tags[0]` または `category`）/ `title` / `summary`（仕様 §3.2）。
- カードは `<article>` 構造で囲み、リンク全体を **1 つのクリック領域**にする（仕様 §7.2）。
- カード上で `cursor: pointer` & ホバーで背景 `#fbf8f1`・矢印にゴールド遷移。
- セクション `<section id="public-news-list" aria-live="polite">` を維持。
- **0 件時**: 「現在お知らせはありません」を同セクション内に表示。
- **取得失敗時**: 同セクション内にエラーメッセージを表示。ヘルプセンター・FAQ 動線（共通ヘッダー）は維持。

#### 0 件 / エラーの文言

```
[0件]  「現在お知らせはありません」
       「新しいお知らせが公開され次第、こちらに表示されます。」

[エラー] 「お知らせの取得に失敗しました」
        「時間をおいてもう一度お試しください。問題が解消しない場合は、
         ヘルプセンター上部の『お問い合わせ』よりご連絡ください。」
```

### 5.3 詳細（P3）｜ `05_support/news/<slug>/index.html`

- 1 記事 = 1 ディレクトリ = 1 HTML ファイル。
- 同一テンプレート骨格。記事ごとの差分は **5 箇所のみ**:
  1. `<title>`
  2. パンくず末尾の記事タイトル
  3. `<time datetime="YYYY-MM-DD">YYYY.MM.DD</time>` の属性と表示
  4. `.news-tag` の内容
  5. 本文（導入段落・見出し・本文・リスト）
- パンくず: `ヘルプセンター › お知らせ › <記事タイトル>`
- 末尾「お知らせ一覧へ」リンクを必ず配置（仕様 §3.3 / §5.3）。
- 本文は社内編集者が直接コミットする HTML として扱う。**ユーザー入力は受け付けない**（仕様 §6）。
- 右サイドの「目次」「関連記事」は仕様外の追加要素のため、**初期実装には含めない**。組み込む場合は別途相談。

---

## 6. デザイントークン

### 6.1 カラー

| token | hex | 用途 |
| --- | --- | --- |
| `--navy` | `#0c1a2e` | プライマリ ・ ヘッダー背景 |
| `--navy-2` | `#0a1626` | ダーク派生 |
| `--navy-deep` | `#070f1c` | フッター ・ 共通ヘッダー背景 |
| `--cream` | `#f5efe5` | ページ背景（センターカラム） |
| `--cream-2` | `#efe7d8` | 派生 |
| `--paper` | `#faf6ee` | サブ背景 ・ パンくずバー |
| `--shell` | `#d9d2c2` | 外側ガター（1200px 外） |
| `--line` | `#e3dccb` | 罫線 |
| `--line-soft` | `#ece4d2` | 薄い罫線 |
| `--ink` | `#1a1a1a` | 本文・見出し |
| `--ink-2` | `#3a3a3a` | サブ本文 |
| `--ink-3` | `#6b6b6b` | 補助 |
| `--ink-4` | `#9a9489` | 弱い補助・プレースホルダ |
| `--gold` | `#b59561` | アクセント・タグ既定 |
| `--gold-2` | `#caa770` | アクセント明 |

#### タグ別色（仕様外だが UX 上重要）

| category | text | border | bg |
| --- | --- | --- | --- |
| アップデート | `#0c1a2e` | `#0c1a2e` | （透過） |
| お知らせ | `#5b6a4e` | `#5b6a4e` | （透過） |
| メンテナンス | `#8a5a0c` | `#c79338` | `#fbf2dc` |
| 障害情報 | `#a8312a` | `#a8312a` | `#fbe9e6` |
| プレスリリース | `#b59561` | `#b59561` | （透過） |

ロジック: `tag` 文字列から上記マップで色を決める。不一致は既定（gold ）。

### 6.2 タイポグラフィ

```
--serif         : "Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif
--sans          : "Noto Sans JP", -apple-system, "Hiragino Sans", sans-serif
--latin-serif   : "Cormorant Garamond", "Noto Serif JP", serif
```

| 用途 | family | weight | size | line-height | letter-spacing |
| --- | --- | --- | --- | --- | --- |
| ページ H1 | serif | 600 | 48px | 1.15 | .02em |
| 記事 H1 | serif | 600 | 38px | 1.45 | .02em |
| H2 セクション | serif | 600 | 24px | 1.5 | .02em |
| H3 サブ | serif | 600 | 17px | — | .04em |
| カードタイトル | serif | 600 | 18px | 1.55 | .02em |
| 本文 | sans | 400 | 14.5px | 2.0 | — |
| カード要約 | sans | 400 | 13px | 1.9 | — |
| 日付・数字 | latin-serif | 500 | 22px | 1.0 | .04em |
| ラベル小 (NEWS など) | latin-serif | 500 | 11–13px | — | .32–.45em / TT upper |
| タグ | latin-serif | 500 | 10.5px | — | .18em / TT upper |

ラテン語の小キャップス（**NEWS / News & Updates** など）はすべて `text-transform: uppercase` + Cormorant Garamond。

### 6.3 スペーシング

- セクション余白（PC 1200px）: 縦 `64px` / 横 `56px`
- カード内パディング: `28px 8px` 〜 `36px 36px`
- リスト行間: 28px の縦パディング + 1px 罫線
- カラム gap: 24px / 32px / 64px の 3 段

### 6.4 罫線・影

- 罫線: 1px solid `--line` ／ 弱: `--line-soft`
- ホバー時の浮き上がり: `box-shadow: 0 12px 36px rgba(40,30,15,.08); transform: translateY(-2px);`
- 角丸は **使わない**（直角を基調とした編集的トーン）。

### 6.5 ブレークポイント

モックは PC 1280px 想定。仕様 §7.3 のとおり 13 番ヘルプセンター §9.4 の対応環境に準ずる。レスポンシブはヘルプセンター側既存規約に合わせる。

---

## 7. コンポーネント仕様

### 7.1 ニュースタグ `.news-tag`

```css
.news-tag {
  display: inline-block;
  font-family: var(--latin-serif);
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: .18em;
  text-transform: uppercase;
  padding: 4px 10px;
  border: 1px solid var(--gold);
  color: var(--gold);
}
.news-tag.update    { color: var(--navy); border-color: var(--navy); }
.news-tag.info      { color: #5b6a4e; border-color: #5b6a4e; }
.news-tag.maint     { color: #8a5a0c; border-color: #c79338; background: #fbf2dc; }
.news-tag.incident  { color: #a8312a; border-color: #a8312a; background: #fbe9e6; }
.news-tag.press     { color: var(--gold); border-color: var(--gold); }
```

文字列はそのまま日本語表示（`アップデート` `お知らせ` `メンテナンス` `障害情報` `プレスリリース`）。

### 7.2 一覧カード `.news-item`

- grid: `140px 110px 1fr 40px` / gap 32px
- ホバー: 背景 `#fbf8f1`、矢印 `translateX(4px)` & `color: var(--gold)`、タイトル `color: var(--gold)`
- クリック領域は `<article>` 全体（`<a>` ラップ or `data-url` + JS）

### 7.3 LP 帯 `.band`

- grid: `120px 1fr 1fr 1fr 130px` / 罫線で区切る
- 各セルの境界は `border-right: 1px solid var(--line-soft)`
- 要約は 2 行クランプ
- ホバー: セル背景 `#fbf8f1`

### 7.4 詳細記事

- グリッド: `1fr 240px` / gap 64px（右ペイン: 目次・関連は将来追加用、初期実装には含めない）
- 本文は `max-width: 760px`
- 導入段落の **ドロップキャップ**（最初の文字を gold 48px serif）はモック仕様。実装可否は要相談。

---

## 8. インタラクション・アクセシビリティ

- すべて同一オリジン遷移（仕様 §5）。`target="_blank"` 禁止。
- 各カードは `<article>` 構造。リンクは全体で 1 つのクリック領域。
- キーボードのみで `LP → 帯 → 詳細 → 一覧 → 詳細` の往復が可能なこと（仕様 §7.2）。
- `aria-live="polite"` を帯・一覧コンテナに付与。
- ホバー遷移は 0.15s 程度の `transition`（CSS）。

---

## 9. セキュリティ（仕様 §6）

- `data/news.json` 由来の文字列を DOM 流し込みする際は **HTML エスケープ必須**。
- 既存の `escapeHtml` を流用すること（独自実装禁止）。
- `items[].url` は `05_support/news/<slug>/` 形式かを検証し、許容外形式は描画スキップ。
- 詳細本文は社内編集者が直接コミットする HTML。ユーザー入力は受け取らない。

---

## 10. 運用フロー（仕様 §8）

### 追加
1. `data/news.json` `items` 先頭に新項目を追記し、`updatedAt` を当日に更新。
2. `05_support/news/<slug>/index.html` を既存テンプレートからコピーし、§5.3 の差分 5 箇所を置換。
3. 帯（最新 3 件）・一覧への反映は自動。

### 削除
1. `data/news.json` の該当項目を削除し、`updatedAt` を当日に更新。
2. `05_support/news/<slug>/` ディレクトリを削除。

### 編集者の責務
- `slug` はディレクトリ名と `items[].url` の最終セグメントを一致させる。
- `date` と `displayDate` を同期表現で保つ（`YYYY-MM-DD` ⇔ `YYYY.MM.DD`）。

---

## 11. Definition of Done

- [ ] `data/news.json` が唯一のお知らせ正本として配置されている
- [ ] お知らせ帯が `items` 先頭最大 3 件を新しい順で表示する
- [ ] 帯のカード・「一覧を見る」リンクが同一オリジンで一覧へ遷移する
- [ ] フッター「お知らせ」リンクが一覧へ遷移する
- [ ] 一覧ページが `data/news.json` から動的描画される
- [ ] 一覧の各カードから詳細へ遷移できる
- [ ] 詳細から一覧 / ヘルプセンターへ戻れる
- [ ] 取得失敗時、帯は非表示、一覧はエラーメッセージを表示する
- [ ] 一覧・帯・詳細とも、JSON 由来文字列の XSS が発生しない
- [ ] §8.1 の手順に従って新規お知らせを 1 件追加できる

---

## 12. ファイル一覧

```
design_handoff_news_flow/
├── README.md                   ← このファイル
├── SPEC.md                     ← 要件定義書（正本）
├── mocks/
│   ├── news-list.html          ← P2 一覧ページのデザインモック
│   ├── news-detail.html        ← P3 詳細ページのデザインモック
│   └── proposal-index.html     ← 提案概観（実装不要、参照用）
└── data/
    └── news.sample.json        ← data/news.json のサンプル
```

実装着手前に、本 README・SPEC.md・モック 2 点（news-list.html / news-detail.html）を必ず確認してください。
