# Handoff: SPEEDAD プレミアムプラン申し込みページ

## Overview

展示会後の名刺・アンケート対応業務をターゲットにした、SPEEDAD プレミアムプラン（月額 ¥10,000・税別）の申し込み・LP ページ。Notion 風の整理されたドキュメント感で、機能比較・料金プラン・ワークフローを訴求する。

ターゲットは中小〜SMB の現場リード（マーケティング・営業企画担当）。Standard プランから Premium プランへのアップグレードを促すことが目的。

---

## About the Design Files

このバンドルに含まれる HTML/CSS/JSX ファイルは、**最終的な見た目と挙動を示すデザインリファレンス（プロトタイプ）**です。本番コードとしてそのまま使うものではなく、対象コードベースの既存環境（React / Vue / Next.js / 既存テンプレートなど）で **このデザインを再現実装する** ことを想定しています。

対象コードベースが未確定の場合は、プロジェクト全体に最も適したフレームワークを選択して実装してください（推奨: React / Next.js + CSS Modules または Tailwind）。

実装時は以下のファイルを参照してください：

- `premium_themeC.html` — エントリポイント（ブラウザで直接開いて全体を確認できる）
- `redesign-themes.jsx` — `ThemeC` コンポーネント本体（このページのレイアウト全体）
- `redesign-shared.jsx` — `BeforeAfter` / `ExcelExportMock` / `PostEventTimeline` の3つの共通ビジュアルパーツ
- `redesign-tokens.css` — デザイントークン（色・タイポ・スペーシング・シャドウなど CSS 変数）
- `theme-c.css` — Theme C 専用スタイル
- `redesign-extras.css` — 共通ビジュアルパーツのスタイル

---

## Fidelity

**High-fidelity（ハイファイ）**
- 色・タイポグラフィ・余白・角丸・影は確定値です。CSS 変数経由で `redesign-tokens.css` と `theme-c.css` に定義されています。
- 文言（コピー）も確定。`redesign-themes.jsx` 内 `RD_COPY` オブジェクトと `ThemeC` JSX 内に記載。
- 既存のデザインシステムがある場合は、まずトークンをマッピングし、近い値で揃えてください。

---

## Page Structure（上から順）

1. **Nav（ヘッダー）** — ロゴ / ナビゲーションリンク / ログイン・申し込みボタン
2. **Hero** — パンくず・H1・リード文・**料金サマリー**（¥10,000/月）・CTA・右側に Excel 出力モック
3. **Before / After セクション** — 運用の困りごと → Premium で解消（4ペア）
4. **ワークフロータイムライン** — 当日 → 翌日 → 1週間 → 1ヶ月 → 1年（5ステップ）
5. **Premium 機能ブロック** — 6機能のカード（最長1年保存／設問分岐／Excel・CSV 出力／SPEEDレビュー／独自ドメイン送信／多言語対応）
6. **料金プラン** — Standard（¥0）と Premium（¥10,000）の2列カード
7. **機能比較表** — Standard vs Premium の7行比較
8. **最終 CTA** — 申し込みボタン + 補足メタ情報

---

## Screens / Views

### 1. Nav

- 高さ: 自然高（パディング 16px 0）
- 配置: `display: flex; justify-content: space-between; align-items: center;`
- ブランド: "S" のスクエアロゴ（背景: `--primary` / 白文字）+ "SPEEDAD"
- リンク: 機能 / 料金 / 導入事例 / テンプレート / ヘルプ
- 右側: ログインボタン（ghost）+ 申し込みボタン（primary）

### 2. Hero

- 2カラムグリッド `grid-template-columns: 1.2fr 1fr; gap: 56px;`
- 左カラム:
  - パンくず（"📊 ホーム / 料金 / Premium"）
  - H1: "展示会後のリードを、**きちんと整える**仕組み。" — 太字下線でアクセント
  - リード文: 機能サマリー
  - **料金サマリー**（重要 — `c-price-summary`）
    - `¥10,000 / 月（税別）`、その下に補足: ✨ 初月無料 / 💳 初期費用 ¥0 / 📄 請求書払い対応
  - CTA: "プレミアムプランに申し込む"（primary）+ "資料をダウンロード"（ghost）
- 右カラム: `ExcelExportMock`（Excel 出力ウィンドウのモック）

### 3. Before / After

- 共通コンポーネント `BeforeAfter`（`redesign-shared.jsx`）
- 4ペアの Before / After カード
- 訴求: Standard で止まる業務 → Premium で続けられる

### 4. ワークフロータイムライン

- 共通コンポーネント `PostEventTimeline`
- 5ステップ: 当日（受付・名刺取得）→ 翌日（データ化）→ 1週間（フォローアップ）→ 1ヶ月（アンケート）→ 1年（再活性化）

### 5. Premium 機能ブロック

- グリッド `c-blocks` — 3列 × 2行
- 各ブロック: 絵文字 + タイトル + 説明文
- `featured` 属性付きのブロックは強調表示（差分機能）
- 6機能:
  1. 📦 最長1年データ保存（featured）
  2. ✏️ 設問分岐・画像・手書き
  3. 📊 Excel / CSV 出力（featured）
  4. 🔍 SPEEDレビュー
  5. 🏢 独自ドメイン送信
  6. 🌐 多言語対応

### 6. 料金プラン

- 2列カード `c-pricing`
- 左: STANDARD（¥0/月）— 機能リストにチェック✓と無効×を併記
- 右: PREMIUM（¥10,000/月）— `pro` クラスで強調、機能リストすべてチェック✓
- 各カードに CTA ボタン

### 7. 機能比較表

- `c-cmp` グリッド — 3列（機能名 / Standard / Premium）
- 7行: 追加設問・機能 / 多言語対応 / お礼メール / 分析・レポート / データ保存期間 / ブランド非表示 / 外部ツール連携

### 8. 最終 CTA

- センター揃え `c-cta-final`
- 🚀 絵文字 + H2 + 補足文 + 大きな申し込みボタン + メタ情報行（月額・初月無料・請求書払い）

---

## Design Tokens（`redesign-tokens.css` 参照）

タイポ:
- `--font-display`: 'Inter Tight', 'Noto Sans JP', sans-serif（見出し）
- `--font-sans`: 'Inter', 'Noto Sans JP', sans-serif（本文）
- `--font-mono`: 'JetBrains Mono', monospace（ラベル・コード風）

Theme C 固有色（`theme-c.css` の `.theme-c` スコープ）:
- `--primary`: ブルー基調（#2F6BFF 系）
- `--fg`: 本文色
- `--fg-muted`: 補助テキスト
- `--surface-1` / `--surface-2`: 背景・カード
- `--line`: 罫線

スペーシング・角丸:
- 角丸: 6–10px（カード）/ 999px（バッジ・ピル）
- カードパディング: 18–32px
- セクション間: 64–96px

---

## Interactions & Behavior

- **CTA ボタン**: ホバーで色が濃くなる。クリックで申し込みフォームへ遷移（実装側で `/signup?plan=premium` などへ）
- **ナビゲーションリンク**: ページ内アンカーまたは別ページ遷移
- **「資料をダウンロード」**: PDF ダウンロード（実装側で資料を用意）
- **「無料で始める」**: Standard プランの登録フローへ
- 静的ページ。スクロール以外の動的挙動は最小限

---

## State Management

このページは基本的に静的。バックエンドが必要なのは：
- 「申し込む」ボタン → 申し込みフォーム（別ページ／モーダル）
- 「資料ダウンロード」 → メール入力 → PDF 配信
- ログイン状態の表示切替（ヘッダー右側）

---

## Responsive Behavior

- Hero の 2カラムグリッドは `~768px` 以下で 1カラムに
- 機能ブロックの 3列グリッドは `~960px` 以下で 2列、`~640px` 以下で 1列
- 比較表は横スクロールまたは縦並びに切替

---

## Assets

- アイコン: 絵文字を使用（📊 📦 ✏️ 🔍 🏢 🌐 🚀 ✨ 💳 📄 🔄 📅 ⚙️ 💰）
- 画像: 不要（すべて CSS と SVG で構成）
- フォント: Google Fonts から Inter / Inter Tight / Noto Sans JP / JetBrains Mono

---

## 注意事項

- **削除済み**: 当初 Slack / CRM 連携機能を含んでいたが、**現状この連携機能は実装されていない**ため、このデザインからは削除済み（コピー・機能ブロック・比較表すべて）。実装時にも追加しないこと。
- **多言語対応** は機能として残してある（Slack 連携を多言語対応に差し替え）。
- **数値の根拠が薄い表現は避ける**: 「99.4%」「24時間SLA」など、出典のない数値は使用していない。実装時も同様に守ること。

---

## Files

```
design_handoff_speedad_premium/
├── README.md                    ← このファイル
├── premium_themeC.html          ← エントリポイント（ブラウザで開いて確認）
├── redesign-themes.jsx          ← ThemeC コンポーネント
├── redesign-shared.jsx          ← BeforeAfter / ExcelExportMock / PostEventTimeline
├── redesign-tokens.css          ← デザイントークン（CSS 変数）
├── theme-c.css                  ← Theme C 専用スタイル
└── redesign-extras.css          ← 共通ビジュアルパーツのスタイル
```

ローカルで確認する場合は、フォルダごと配信できる任意のローカルサーバ（`python3 -m http.server` 等）でルートを指定して `premium_themeC.html` を開いてください。
