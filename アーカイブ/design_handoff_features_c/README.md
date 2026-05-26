# Handoff: SPEEDAD Premium — Features セクション（案C / Tabbed Detail）

## Overview

SPEEDAD Premium 加入ページの **Features セクション**「Premiumに含まれる機能」の改修案。
6つの機能（最長1年保存 / 高度な入力 / Excel・CSV出力 / SPEEDレビュー / 独自ドメイン送信 / 多言語対応）を、横並びタブと詳細パネル（テキスト + UIモックプレビュー）の組み合わせで提示する。

旧UIは6カードの2x3グリッド。新UIは「タブで選択 → 詳細を大きく見せる」構造に変更し、各機能ごとに専用のミニUIモックを併置することで「何ができるか」を視覚的に伝える。

---

## About the Design Files

このフォルダ内のファイルは **HTML で作成された設計リファレンス（プロトタイプ）** です。最終的な見た目と挙動の指針を示すものであり、そのままプロダクションコードとしてコピーする想定ではありません。

実装タスクは、**対象コードベースの既存環境（React / Vue / Next.js / 他）と既存デザインシステムを使ってこの HTML デザインを再構築すること**です。環境がまだ存在しない場合は、プロジェクトに最も適したフレームワークを選定して実装してください。

## Fidelity

**High-fidelity (hifi)** — 色・タイポグラフィ・余白・インタラクションを最終に近い精度で作成しています。コードベースの既存ライブラリ・パターンを使って、可能な限りピクセル精度で再現してください。

---

## Screens / Views

### Features Section（単一セクション）

- **Name**: Features Section — Tabbed Detail
- **Purpose**: Premium プランに含まれる 6 機能を、タブ切替で 1 機能ずつ詳細閲覧できるようにする。各機能には説明文・活用シーン・スペック表・UIモックの 4 要素を含む。

#### Layout

- セクション全体: 白背景カード、`border: 1px solid #e2e8f0`、`border-radius: 24px`、`padding: 36px 40px`
- 上部ヘッダー（s-head）: 左寄せのラベル/タイトル/サブと、右寄せの `01 / 06` カウンター。`display: flex; justify-content: space-between; align-items: flex-end`
- タブバー: 6カラム等分グリッド、薄グレー背景（#f8fafc）の中に白いアクティブタブが浮かぶ
- 詳細パネル: 2カラム（左: テキスト、右: UIモック）`grid-template-columns: 1fr 1.05fr`、`min-height: 420px`

#### Components

##### s-head

- ラベル: `FEATURES`、Inter / 11px / weight 700 / letter-spacing .14em / uppercase / color `#1d4ed8`
- 見出し（h2）: `Premiumに含まれる機能`、Noto Sans JP / 26px / weight 800 / letter-spacing -.01em / color `#020617`
- サブテキスト: 14px / color `#475569`、max-width 560px
- カウンター（右上）: `01 / 06` 形式、Inter / weight 700 / letter-spacing .14em / uppercase。現在番号は 14px / color `#020617`、それ以外は 11px / color `#94a3b8`

##### タブバー（featC-tabbar）

- グリッド: `grid-template-columns: repeat(6, 1fr)`
- 背景: `#f8fafc`、`border: 1px solid #e2e8f0`、`border-radius: 12px`、`padding: 4px`
- 各タブ（featC-tab）:
  - パディング 12px 14px、border-radius 8px
  - 左にアイコン（28×28、border-radius 7px）、右にテキスト（12.5px / weight 600）
  - アイコン背景: 非アクティブ `#f1f5f9` / アイコン色 `#64748b`
  - アクティブ時: タブ自体を白背景に、box-shadow `0 1px 3px rgba(15,23,42,.08)`、アイコン背景 `#eff6ff` / アイコン色 `#1d4ed8`、テキスト色 `#020617` / weight 700
  - hover: `rgba(255,255,255,.6)`
  - transition: `background .15s ease, color .15s ease`

##### 詳細パネル（featC-panel）

- 背景: 白、`border: 1px solid #e2e8f0`、`border-radius: 14px`、min-height 420px、overflow hidden
- 切替時アニメーション: `featC-fade .35s ease`（opacity 0→1、translateY 4px→0）

###### 左カラム（.left）

- パディング: 36px 36px 32px、`display: flex; flex-direction: column`
- `ptag`: 番号バッジ（`01` 等、Inter / 10px / weight 700、bg `#eff6ff` / color `#1d4ed8`、padding 3px 8px、border-radius 4px）と SPEC ラベル（`365 DAYS` 等）を並列表示
- 見出し（h3）: 24px / weight 800 / letter-spacing -.01em / color `#020617`、line-height 1.4
- 説明文（pdesc）: 14px / color `#334155` / line-height 1.85、margin-bottom 18px
- 活用シーン（scenario）:
  - bg `#eff6ff`、`border-left: 3px solid #1d4ed8`、border-radius 6px、padding 14px 16px
  - 左にライトバルブアイコン（color `#1d4ed8`）
  - ラベル `こんな場面で` (Inter / 10px / weight 700 / uppercase / color `#1d4ed8`)
  - 本文 13px / color `#1e293b` / line-height 1.65
- スペック表（specs）:
  - `margin-top: auto` で下端固定
  - `border-top: 1px solid #e2e8f0`、padding-top 18px
  - 2x2 グリッド、`gap: 14px 24px`
  - キー（k）: Inter / 10.5px / weight 700 / uppercase / letter-spacing .12em / color `#64748b`
  - 値（v）: 13.5px / weight 600 / color `#020617`

###### 右カラム（.right）

- 背景: グラデーション `linear-gradient(180deg, #f1f5f9 0%, #e8eef5 100%)`
- `border-left: 1px solid #e2e8f0`、padding 28px、center align
- グリッド背景パターン（疑似要素）: 24×24px のドット罫線
- UI モックカード（featC-mock）:
  - 白背景、`border: 1px solid #e2e8f0`、border-radius 10px、box-shadow `0 12px 32px rgba(15,23,42,.08)`
  - 上部にウィンドウバー（3つの色付きドット + タイトル）
  - 機能ごとに専用のモック内容（次節）

##### 各機能のモック内容

| # | Feature | Mock Type | 内容 |
|---|---|---|---|
| 01 | 最長1年データ保存 | `storage` | 4件のイベント一覧（保存日数バッジ付き）+ 使用量メーター |
| 02 | 設問分岐・画像・手書き | `form` | Q1（業種）→ branch → Q2-A（製造規模）+ 手書きサインパッド |
| 03 | Excel / CSV 出力 | `excel` | XLSX/CSV/TSV 切替ツールバー + 5行のスプレッドシート |
| 04 | SPEEDレビュー | `review` | 名刺画像（アンバー）vs 抽出データ（編集マーク付き）の2ペイン |
| 05 | 独自ドメイン送信 | `mail` | From/To/Subject ヘッダー + 本文。From のドメイン部分を青で強調 |
| 06 | 多言語対応 | `lang` | JA/EN/ZH/KO 切替ピル（ZH active）+ 中国語フォーム3行 |

---

## Interactions & Behavior

- タブクリックで `active` ステートを更新。詳細パネル全体が `featC-fade` アニメーション（0.35s）で再描画される（React で `key={active}` を切替トリガーに）
- カウンター `01 / 06` の左数字もアクティブインデックス連動で更新
- ホバー: タブは半透明白に。タブ自体に微小な背景変化のみ、translate なし
- レスポンシブ: 設計は デスクトップ ≥1280px 想定。タブレット以下では未定義（要相談）

---

## State Management

```ts
const [active, setActive] = useState(0);
const f = FEATURES[active];
```

- `active`: 現在表示中の機能インデックス（0〜5）
- `FEATURES`: 配列。各要素は以下のフィールドを持つ:
  - `icon`: Material Icons の名前
  - `t`: 機能名（フル）
  - `short`: タブ用の短い名前
  - `d`: 説明（旧UIで使用、現案では未使用）
  - `spec`: スペックラベル（`365 DAYS` 等）
  - `panelDesc`: 詳細パネルの説明文
  - `scenario`: 活用シーン1行
  - `mock`: モック種別（`storage` | `form` | `excel` | `review` | `mail` | `lang`）
  - `specs`: `[{k, v}, ...]` のスペック項目4件

---

## Design Tokens

### Colors

| Token | Hex | 用途 |
|---|---|---|
| blue-50 | #eff6ff | アイコン bg / scenario bg / 番号バッジ bg |
| blue-700 | #1d4ed8 | アイコン色 / ラベル / scenario border / number text |
| slate-50 | #f8fafc | タブバー bg |
| slate-100 | #f1f5f9 | 非アクティブアイコン bg / 右カラム bg start |
| slate-200 | #e2e8f0 | 罫線・ボーダー全般 |
| slate-300 | #cbd5e1 | ウィンドウバーのグレードット |
| slate-500 | #64748b | キー（小ラベル）text |
| slate-600 | #475569 | サブテキスト |
| slate-700 | #334155 | 本文（説明文） |
| slate-800 | #1e293b | scenario 本文 |
| slate-950 | #020617 | 見出し / 値 |
| white | #ffffff | パネル bg / アクティブタブ bg |
| amber-100 | #fef3c7 | 名刺画像モック bg start |
| amber-700 | #b45309 | 名刺画像モック text / edited row text |
| emerald-500 | #10b981 | ウィンドウバーの緑ドット |
| amber-500 | #fbbf24 | ウィンドウバーの黄ドット |

### Typography

| Token | Stack |
|---|---|
| --font-jp | 'Noto Sans JP', system-ui, -apple-system, sans-serif |
| --font-en | 'Inter', system-ui, -apple-system, sans-serif |

主要サイズ:
- セクション h2: 26px / 800
- パネル h3: 24px / 800
- 説明文: 14px
- 活用シーン本文: 13px
- スペック値: 13.5px / 600
- キー・ラベル類: 10.5〜11px / 700 / .12〜.14em / uppercase（Inter）

### Spacing

| Token | Value |
|---|---|
| section padding | 36px 40px |
| panel left padding | 36px 36px 32px |
| panel right padding | 28px |
| tab padding | 12px 14px |
| scenario padding | 14px 16px |

### Border Radius

| Token | Value |
|---|---|
| section / panel outer | 24px / 14px |
| tabbar | 12px |
| tab | 8px |
| mock card | 10px |
| icon box | 7px |
| scenario | 6px |

### Shadows

- card subtle: `0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)`
- mock card: `0 12px 32px rgba(15,23,42,.08), 0 4px 8px rgba(15,23,42,.04)`

### Animations

- パネル切替: `@keyframes featC-fade` — opacity 0→1, translateY 4px→0, duration .35s ease
- transition (タブ): `background .15s ease, color .15s ease`

---

## Assets

- アイコン: Google Material Icons（`inventory_2` `gesture` `monitoring` `rate_review` `domain` `language` `lightbulb` `chevron_right`）
  - 既存コードベースに `lucide-react` 等がある場合は同等アイコンに置換可
- 名刺画像モックはダミー。本番ではプレースホルダー画像 or 実画像に差し替え

---

## Files

このフォルダ内：

- `features_v2.html` — オリジナルのプロトタイプ（A/B/C 全3案。**案C が本ハンドオフの対象**、ファイル下部 `VariantC` 関数）
- `styles.css` — 共有デザイントークン（CSS 変数、ボタン、カード等）
- `sections.css` — セクション別スタイル（参考のみ。本案のスタイルは features_v2.html の `<style>` 内に閉じている）

実装時に直接参照すべき箇所：

- 案C のすべての CSS は `features_v2.html` の `<style>` ブロック内、`/* ===== Variant C: 横タブ + UIモックプレビュー（揉み直し） ===== */` 以降
- 案C の React コンポーネントは同ファイル内 `function VariantC()` 以降。モック群は `MockStorage` `MockForm` `MockExcel` `MockReview` `MockMail` `MockLang` および `FeatureMock` ディスパッチャ
- データ構造は同ファイル内の `FEATURES` 配列を参照
