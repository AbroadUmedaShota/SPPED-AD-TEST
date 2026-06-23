# Handoff: SPEED AD Support — FAQ & ヘルプセンター

## Overview
SPEED AD Support サイトの 2 ページのリデザインです。

- **ヘルプセンター（ヘルプ シンプル.dc.html）** … 目的・テーマから記事を探す「入口」ページ。
- **FAQ（FAQ シンプル.dc.html）** … よくある質問をフラットなアコーディオンで読むページ。

設計の狙いは「**シンプル イズ ベスト**」と「**色数を絞る**」こと。元の本番サイトはカテゴリカードごとに色帯＋カラフルなアイコン（青/緑/紫/黄/赤/灰/橙）を使っており「カラフルすぎる」という課題があったため、**アクセントをネイビー1色に統一**し、アイコンは **Material Symbols（Google公式アイコンフォント）** に置き換えています。

役割分担：**ヘルプ＝カテゴリで探す / FAQ＝フラットに読む**。そのため FAQ 側にはカテゴリ分けを設けていません（重複回避）。

## About the Design Files
このバンドル内の `.dc.html` ファイルは **HTML で作られたデザイン参照（プロトタイプ）** です。見た目と挙動の意図を示すもので、そのまま本番に貼り付けるコードではありません。

タスクは、これらのデザインを **対象コードベースの既存環境（React / Vue / 既存テンプレート等）に、その作法・コンポーネント・ライブラリを使って再現する** ことです。環境がまだ無ければ、プロジェクトに最適なフレームワークを選んで実装してください。

> 補足：`.dc.html` は社内のデザインツール用フォーマットで、`support.js` ランタイムと一緒にブラウザで開くとプレビューできます。`<dc-import name="SpeedHeader">` は同階層の `SpeedHeader.dc.html` を読み込む独自タグです。**実装時はこの仕組みを再現する必要はなく、マークアップとスタイルの値を参照してください。**

## Fidelity
**High-fidelity（ハイファイ）**。最終的な配色・タイポグラフィ・余白・角丸・インタラクションを含みます。既存コードベースのライブラリ／パターンでピクセル単位に近い再現を行ってください。

---

## Screens / Views

### 1. ヘルプセンター（`ヘルプ シンプル.dc.html`）
**Purpose**: ユーザーがテーマ（カテゴリ）から記事や質問へ到達する入口。

**Layout**（縦積み・中央寄せ、全体 `background:#fff`、本文コンテナ `max-width:1080px; margin:0 auto; padding:0 32px`）:
1. **共通ヘッダー**（`SpeedHeader`）
2. **ページヘッダー**（中央寄せ・`padding-top:64px`）
   - eyebrow: `HELP CENTER` — 12px / 800 / `letter-spacing:.24em` / `#9aa8b8`
   - H1: `カテゴリから探す` — 32px / 800 / `#16324c`
   - リード文: 14px / `line-height:1.9` / `#6b7c8f` / `max-width:460px`
3. **カテゴリグリッド**（`padding-top:40px`）: `display:grid; grid-template-columns:repeat(3,1fr); gap:16px`。カード8枚（3+3+2）。
4. **よく読まれている記事**（`padding-top:64px`）: 中央寄せ見出し＋`grid; repeat(3,1fr); gap:14px` の記事カード6枚。
5. **問い合わせ帯**（`padding:48px 0 80px`）
6. **共通フッター**（`SpeedFooter`）

**Components**

- **カテゴリカード**（通常 7枚）
  - コンテナ: `display:flex; flex-direction:column; border:1px solid #e7ecf2; border-radius:14px; padding:24px`
  - hover: `border-color:#c3cfdd`
  - 上段: アイコンタイル＋（タイトル＋サブ）を `display:flex; gap:14px; align-items:flex-start; margin-bottom:18px`
    - アイコンタイル: `width:44px; height:44px; border-radius:11px; background:#f1f4f8`、中央に Material アイコン（`font-size:24px; color:#2c5d97`）
    - タイトル: 15.5px / 800 / `#16324c`
    - サブ: 12px / `#8595a6`（`margin-top:3px`）
  - 中段: 質問リンク（`flex:1`、`display:flex; flex-direction:column; gap:11px`）
    - 各行: `display:flex; gap:9px`、先頭に `›`（`#aebccd`）＋テキスト 13px / `#50637a` / `line-height:1.5`
  - 下段: `5件の記事 →` — 12.5px / 700 / `#2c5d97`（`margin-top:18px`）
- **「よくある質問」カード**（8枚目・特別扱い）
  - カードに `background:#f7f9fc`
  - アイコンタイルは白地: `background:#fff; border:1px solid #e7ecf2`、中に `quiz`
  - 本文は質問リンクではなく説明文 1 行、下段 CTA は `FAQ を見る →`
- **人気記事カード**（6枚）
  - `display:flex; justify-content:space-between; align-items:flex-start; gap:14px; border:1px solid #e7ecf2; border-radius:12px; padding:20px 22px`、hover `border-color:#c3cfdd`
  - 左: カテゴリ名 eyebrow（11.5px / 700 / `#9aa8b8` / `margin-bottom:6px`）＋ 記事タイトル（14px / 700 / `#16324c` / `line-height:1.55`）
  - 右: `→`（`#c3cfdd`）
- **問い合わせ帯**
  - `display:flex; justify-content:space-between; align-items:center; gap:24px; flex-wrap:wrap; border:1px solid #e7ecf2; border-radius:16px; padding:32px 36px; background:#f7f9fc`
  - 左: 見出し 18px / 800 / `#16324c` ＋ 補足 13.5px / `#6b7c8f`
  - 右ボタン群（`gap:12px`）:
    - Primary `お問い合わせ`: `background:#16324c; color:#fff; font-size:14px; font-weight:700; padding:13px 26px; border-radius:10px`
    - Secondary `よくある質問を見る`: `background:#fff; color:#16324c; border:1px solid #d4dce6`、他は同じ

**カテゴリ → Material Symbol アイコン対応**
| カテゴリ | サブ | アイコン | 件数 |
|---|---|---|---|
| はじめに | 初期設定や画面の見方など | `rocket_launch` | 5 |
| SPEED AD の使い方 | 各機能の具体的な操作方法 | `tune` | 5 |
| アカウント設定 | 登録情報やセキュリティ設定 | `manage_accounts` | 5 |
| 料金・請求 | プラン内容・お支払い・請求書 | `receipt_long` | 10 |
| 困ったときは | ログインや表示の問題など | `troubleshoot` | 5 |
| チュートリアル | 動画で使い方を学ぶ | `play_circle` | 5 |
| お役立ち情報 | 上記以外のお役立ち情報 | `lightbulb` | 5 |
| よくある質問 | サービス全般に関するご質問 | `quiz` | — |

---

### 2. FAQ（`FAQ シンプル.dc.html`）
**Purpose**: よくある質問を 1 本のフラットなアコーディオンで読む。**カテゴリ分けなし。**

**Layout**（中央寄せ、本文コンテナ `max-width:820px; margin:0 auto; padding:0 32px`）:
1. **共通ヘッダー**（`SpeedHeader`）
2. **ページヘッダー**（中央寄せ・`padding-top:64px`）
   - eyebrow `FAQ`（同上スタイル）/ H1 `よくあるご質問`（32px / 800 / `#16324c`）/ リード文（14px / `#6b7c8f` / `max-width:460px`）
3. **アコーディオン**（`padding-top:40px`）: `<details>` を縦に7件。初期は先頭のみ `open`。
4. **問い合わせ帯**（ヘルプと同一。Secondary ボタンのみ `ヘルプセンター`）
5. **共通フッター**（`SpeedFooter`）

**Components**

- **アコーディオン項目（`<details>`）**
  - 各 `<details>` に `border-top:1px solid #e7ecf2`、最後の項目のみ `border-bottom:1px solid #e7ecf2` も付与
  - `<summary>`: `display:flex; justify-content:space-between; align-items:center; gap:18px; padding:24px 0; cursor:pointer`
    - 質問文: 16px / 700 / `#16324c` / `line-height:1.55`
    - 開閉アイコン: Material `expand_more`、24px / `#aebccd`、`transition:transform .22s ease`、**開いている時 `transform:rotate(180deg)`**
  - 回答本文: `padding:0 0 28px; color:#50637a; font-size:14.5px; line-height:2`
  - 開く時アニメーション: 本文に `@keyframes faqIn`（opacity 0→1, translateY(-4px)→0, .22s ease）
  - `<summary>` のデフォルトマーカーは消す（`list-style:none` ＋ `::-webkit-details-marker{display:none}`）

**質問・回答（全文）**
1. **SPEED AD は無料で使えますか？** — 無料の基本プランをご用意しています。アンケート作成・QR回答・名刺情報の整理まで、費用をかけずにお試しいただけます。より多くの送信数や高度な集計が必要な場合は、有料プランへ移行できます。
2. **無料プランと有料プランの違いは？** — 無料プランでも基本機能をご利用いただけます。送信数や集計の上限、より高度な機能の有無が有料プランとの主な違いです。詳しくは料金プランのページをご覧ください。
3. **名刺のデータ化はどのくらい正確ですか？** — BPO 事業で培ったデータ入力の運用ノウハウをもとに、高い精度で名刺情報をデータ化します。読み取りづらい項目は確認プロセスを通して整えるため、安心してご利用いただけます。
4. **回答データは CSV で書き出せますか？** — 集計したアンケート結果や名刺情報は、CSV 形式でエクスポートできます。書き出したデータは、他のツールでの分析や顧客管理にもご活用いただけます。
5. **御礼メールはまとめて送れますか？** — 来場者リストから一括で御礼メールを送信できます。テンプレートを用意しておけば、イベント終了後すぐにお礼の連絡が可能です。
6. **スマートフォンからも操作できますか？** — ブラウザベースのサービスのため、PC・スマートフォンのどちらからでも同じ管理画面をご利用いただけます。外出先や会場でも操作が可能です。
7. **解約はいつでもできますか？** — 管理画面の「プラン設定」からいつでも解約でき、日割りの追加請求は発生しません。再開もいつでも可能です。

---

## 共通コンポーネント

### SpeedHeader（`SpeedHeader.dc.html`）
- `<header>` `background:#fff; border-bottom:1px solid #dde5ee`
- 内側: `display:flex; align-items:center; justify-content:space-between; max-width:1180px; margin:0 auto; padding:0 40px; height:66px`
- ロゴ: 三角形 SVG（塗り `#16324c`、内側に白の小三角）＋ テキスト `SPEED AD`（800 / `#16324c`）`Support`（600 / `#41566c`）、16px
- ナビ（`gap:30px`）: `ヘルプ` / `FAQ` / `お問い合わせ` — 14px / 700 / `#2a3848`、hover `#16324c`

### SpeedFooter（`SpeedFooter.dc.html`）
- `<footer>` `background:#fff; border-top:1px solid #dde5ee`
- `display:grid; grid-template-columns:1.4fr 1fr 1fr 1.1fr; gap:32px; max-width:1180px; margin:0 auto; padding:42px 40px 50px`
- 1列目: `© SPEED AD`（13px / 700 / `#8595a6`）
- 2–4列目: 見出し（12px / 800 / `#16324c` / `letter-spacing:.06em`）＋ リンク群（13px / `#41566c`、hover `#16324c`、`gap:11px`）
  - サポート: ヘルプ / FAQ / チュートリアル / お問い合わせ
  - 公開情報: 公式サイト / 導入事例 / 料金プラン / お知らせ
  - 規約等: 利用規約 / プライバシーポリシー / 特定商取引法に基づく表示

---

## Interactions & Behavior
- **アコーディオン**: ネイティブ `<details>/<summary>`。クリックで開閉。開閉アイコン `expand_more` が 180° 回転（.22s ease）。本文表示時に `faqIn` フェードイン。複数同時開閉可（排他ではない）。初期は先頭1件のみ open。
- **カード hover**: `border-color` を `#e7ecf2 → #c3cfdd` に。
- **ヘッダー／フッターのリンク hover**: 文字色を `#16324c` へ。
- すべてのリンクは現状 `href="#"`（実装時に実 URL を割当）。
- レスポンシブ: グリッドは実装側で適宜 1〜2 カラムへ折り返し可。問い合わせ帯は `flex-wrap:wrap` で縦積みに崩れる前提。

## State Management
- アコーディオンの開閉状態のみ。ネイティブ `<details>` で完結し、専用の状態管理は不要（React 等で作る場合は各項目に `open` boolean、または `<details>` をそのまま利用）。

## Design Tokens
**Colors**
- 文字（濃）`#16324c` / 本文 `#50637a` / サブ文字 `#6b7c8f` / 弱い文字・件数 `#8595a6` / さらに薄い `#9aa8b8`
- アクセント（リンク・アイコン）`#2c5d97` / アイコンの図形補助 `#41566c`
- 矢印・チェブロン薄色 `#aebccd` / `#c3cfdd`
- 罫線・枠 `#e7ecf2`（主）/ `#d4dce6`（ボタン枠）/ `#dde5ee`（ヘッダー・フッター境界）
- 面（淡）`#f1f4f8`（アイコンタイル）/ `#f7f9fc`（問い合わせ帯・FAQカード背景）
- 背景 `#ffffff`

**Typography**
- フォント: `-apple-system, BlinkMacSystemFont, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, system-ui, sans-serif`
- スケール: H1 32px/800、セクション見出し 18–22px/800、カードタイトル 15.5–16px/800、本文 13–14.5px、eyebrow 12px/800（`letter-spacing:.24em`）
- 本文 line-height: 1.55〜2.0

**Spacing**: コンテナ `padding:0 32px`、セクション間 `40–64px`、カード内 `padding:20–24px`、`gap` は 9/11/12/14/16px を多用

**Radius**: カード 14px / 小カード・ボタン 10–12px / アイコンタイル 10–11px / 問い合わせ帯 16px

**Container width**: ヘルプ 1080px / FAQ 820px / 共通ヘッダー・フッター 1180px

**Shadow**: ほぼ未使用（フラット）。区別は罫線と淡い面色で行う。

## Assets
- **アイコン**: [Material Symbols Outlined](https://fonts.google.com/icons)（Google・Apache 2.0）。読み込み: `https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,400,0,0`。リガチャでアイコン名を指定（`font-variation-settings` は `'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24`）。実装側に既存のアイコンライブラリがあれば、同等のアイコンに置き換え可（対応表は各ページ記載）。
- **ロゴ**: SpeedHeader 内のインライン SVG（三角形マーク）。
- 画像アセットは無し（フラットデザイン）。

## Files
- `ヘルプ シンプル.dc.html` — ヘルプセンターのデザイン参照
- `FAQ シンプル.dc.html` — FAQ のデザイン参照
- `SpeedHeader.dc.html` — 共通ヘッダー
- `SpeedFooter.dc.html` — 共通フッター
- `support.js` — `.dc.html` をブラウザでプレビューするためのランタイム（**実装には不要**。プレビュー目的のみ）

### プレビュー方法
同じフォルダ内で `ヘルプ シンプル.dc.html` または `FAQ シンプル.dc.html` をブラウザで開くと、`support.js` 経由でレンダリングされます（`SpeedHeader/SpeedFooter` も自動読み込み）。
