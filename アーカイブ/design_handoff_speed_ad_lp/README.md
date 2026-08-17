# Handoff: SPEED AD ランディングページ

## Overview
展示会で回収したアンケートと名刺のデータ化を1つのWeb導線に置き換えるサービス「SPEED AD」の1枚もののLP。ヒーロー → 3つの料金 → 業務フロー比較 → 料金の仕組み → CTA → フッターの6ブロック構成。目的は「無料ではじめる」および「お見積り・お問い合わせ」への送客。

## About the Design Files
このバンドルに入っているHTMLは **HTMLで作られたデザインリファレンス（プロトタイプ）** であり、そのまま本番投入するコードではありません。狙いは、見た目・レイアウト・挙動の意図を正確に伝えることです。実装時は対象コードベースの既存環境（React / Next.js / Vue / Astro など）と既存のコンポーネント・命名規約・ユーティリティに沿って **作り直して** ください。既存環境がない場合は、静的LPとして適切なフレームワーク（例: Next.js + Tailwind、または素のHTML/CSS）を選定して実装してください。

## Fidelity
**High-fidelity (hifi)。** 色・タイポグラフィ・余白・アニメーションまで確定値です。ピクセル単位で再現してください。ただしイラスト/アイコンはインラインSVGの簡易線画で、実案件では正式なイラスト素材への差し替えを想定しています。

## Files
- `speed-ad-lp.html` — 完全埋め込み（画像・スクリプト・フォント参照をすべてインライン化）した単体HTML。ブラウザで直接開けます。**実装の一次リファレンス。**
- （プロジェクト内の元ファイル: `SPEED AD LP.dc.html`、画像は `assets/hero-photo-v2.png`, `assets/pmark.png`）

## Design Tokens
**Colors**
| 用途 | 値 |
|---|---|
| テキスト基本 | `#1a1d24` |
| ダーク面（CTA/ボタン/フッター） | `#171a21` / フッター `#15181f` |
| アクセント（オレンジ） | `#ee8500`（文字）/ `#f0930f`（線・図・バッジ） |
| アクセント淡（枠線） | `#f2a94f` |
| ヒーロー背景 | `#f2efe9` |
| セクション背景 | `#fbfaf8`（料金） / `#ffffff`（フロー） / `#fcfbf8`（仕組み・CTA） |
| 補助面 | `#faf9f5`, `#f0ede5`, `#f6f2ea`（数式帯）, `#f7f0e2`（表ハイライト行） |
| 罫線・枠 | `#ebe8e1`, `#e6e3dc`, `#eceae4`, `#c9c5bc`（区切り線） |
| 淡色テキスト | `#9a968e`（ラベル） / `#6f6b64`（値） |
| 図版ストローク | `#c9c5bc`（グレー線画） / `#2b2e33`（QR） / `#c8c4bc`（右列アイコン） |
| 成功/CSV緑 | `#2aa552`（有望リード） / `#1ba54c`（CSVバッジ） |

**Typography** — `Noto Sans JP`（Google Fonts, 400/500/700/900）、ロゴのみ Helvetica。
- H1: 45px / 700 / line-height 1.6 / letter-spacing 3px（強調数字 54px / 900 / `#ee8500`）
- セクション見出し H2: 26–30px / 700 / letter-spacing 3–6px
- 本文: 13–16px / 500–700 / line-height 1.9–2.15 / letter-spacing 1–2px
- 大数字: 74px / 900（3料金カード）、44–46px / 900（料金の仕組み）

**Radius**: 3 / 4 / 6 / 8 / 10px、ピル `999px`
**Shadow**: `0 1px 3px rgba(30,30,30,.05)`, `0 1px 5px rgba(30,30,30,.07)`, `0 1px 6px rgba(30,30,30,.08)`, ヒーローCTA `0 4px 12px rgba(20,22,28,.25)`
**Layout width**: デザイン基準幅 1440px。内側コンテナ最大幅 1160px（料金の仕組み）/ 1330px（フロー）。

## Screens / Sections

### 1. ヒーロー（`.hero`）
- 背景 `#f2efe9`、`position:relative; overflow:hidden`。1440px以上では `min-height:100vh`, `display:flex; flex-direction:column; justify-content:space-between`（ヘッダー／本文／認証バッジを上下に配置）。
- **ヘッダー（`.topbar`）** padding `22px 44px 0`。左: ロゴ「SPEED AD」27px/900/letter-spacing 1px/Helvetica。中央: `position:absolute` で水平中央のナビ（料金 ｜ 料金の仕組み ｜ よくあるご質問、14px/700、区切り `|` は `#b9b5ac`）。右: 「無料ではじめる」ボタン（`#171a21` 背景 / `1.5px solid #ee8500` / radius 8 / padding 11px 30px / 14px 700）。
- **本文（`.hero-copy`）** max-width 640px, padding `46px 0 0 44px`。H1「アンケートも名刺も、／ 月額基本料金 **0** 円から。」→ 本文4行（15.5px/500/lh 2.15）→ CTA（`.hero-cta` 396×74、`#171a21`、白文字22px/700/letter-spacing 4px、右にオレンジのシェブロン、gap 40px）。
- **背景画像（`.hero-img`）** `position:absolute; top:0; right:0; width:880px`。マスク: 左端 `linear-gradient(to right, transparent 0, #000 9%)` × 下端 `linear-gradient(to bottom, #000 74%, transparent 93%)` の交差（`mask-composite: intersect`）。1440px以上では `height:100%; width:auto`、左マスク15%・下マスク78→96%。**1100px以下では非表示。**
- **認証バッジ列（`.trust`）** padding `52px 44px 34px 110px`, gap 34px。盾アイコン+提供会社表記／プライバシーマーク画像（54px幅）+ラベル／地球アイコン+「ISO/IEC 27001:2013 / ISO 9001:2015」。項目間に `1px × 44px` の `#c9c5bc` 区切り。

### 2. まず知りたい、３つの料金（`#ryokin`）
- 背景 `#fbfaf8`、padding `58px 40px 60px`。H2 30px/700/letter-spacing 5px。
- カード3枚（`.price-row`, gap 44px）: 各 352px、白、radius 6、`border-top: 3px solid #ee8500`、padding `26px 20px 30px`、中央寄せ。ラベル17px/700 → 数字74px/900 + 単位26px/900（`#ee8500`）→ 補足17px/700。
  1. 月額基本料金 / **0**円 / スタンダードプラン
  2. 初期費用・システム導入費用 / **0**円（下段は空 25px のスペーサーで高さ合わせ）
  3. 通常 / **50**円／枚（税別14px）/ データ化10項目
- 下部に注記15px/700（「プラン」のみ `#ee8500`）と、`#shikumi` へのアンカー「料金の仕組みは下へ ↓」。

### 3. 展示会の回収から追客までを、ひとつの流れへ（`.flow-sec`）
- 白背景、padding `62px 40px 70px`。H2 29px/700/letter-spacing 6px + リード文15px/700。
- **左カラム（`.flow-side`）** 268px、`#faf9f5`。見出し帯 `#f0ede5` 17px/700/letter-spacing 3px。以下グレー線画SVG（stroke `#c9c5bc`, width 1.6）を3組: 紙で配って回収（クリップボード）／名刺を持ち帰って入力（ノートPC＋オレンジの名刺束）／集計・メールを個別作業（書類＋封筒）。
- **右カラム（`.flow-main`）** `flex:1`、`1px solid #ebe8e1`、radius 6、padding `30px 34px 38px`。見出し「SPEED ADなら」20px/700/letter-spacing 4px/`#ee8500` + 説明16px/700。
- **図（`.diagram`）** 944×392 の絶対配置キャンバス:
  - 左: `QRで回答`（188×158, top 10）／`名刺を撮影してデータ化`（188×152, top 230）。
  - 中央: `.dcenter` 430×372（left 276, top 10）、`1.5px solid #f2a94f`、背景 `#fffefc`。見出し「回答と名刺を紐付けたリード」17.5px/700 + 「同じ管理画面で確認」14px/700。内側にリード詳細カード（左に幅52pxのダークサイドバー、右に `112px 1fr` のグリッド。項目: 会社名／氏名／役職／メールアドレス／電話／興味テーマ／アンケート回答温度＝緑ピル「有望リード」）。右下に「詳細を見る」ボタン（`#171a21`, 11px/700, radius 3）。
  - 右: `お礼メール送信`（184×114, top 0）／`集計`（184×112, top 140）／`CSV出力`（184×114, top 278）。
  - **コネクタ（`.conn`）** 2px幅の `#f0930f` の矩形divで直交配線（左2本→縦バス→中央、中央→縦バス→右3本）。SVGではなく矩形。**1100px以下では `display:none`、図は縦積みのflexへ切替。**

### 4. 料金の仕組み（`#shikumi`）
- 背景 `#fcfbf8`、padding `60px 40px 30px`（1440px以上は上下72px）。H2 27px/700 + サブ15px/700。
- **数式帯（`.formula`）** 最大1160px、`#f6f2ea`、17px/700、gap 56px:「基本プランの月額基本料金 **＋** 速度プランの単価 **×** 実際の件数」（記号は `#ee8500` 22–24px）。
- **左カード（`.plan-card`）** 474px。中に2枚: スタンダード（0円 / 保存30日 / お試し／通常／特急／超特急）と、プレミアム（`border-top:3px solid #ee8500`, 背景 `#fffdf9`、月額 **10,000**円（税別）/ 保存最長1年 / 多項目・多言語対応の名刺データ化／オンデマンド）。
- **中央の `＋`（`.plus`）** 46pxの円、`#f0930f`、白文字28px/900。
- **右カード（`.speed-card`）** `flex:1`。見出し「速度プラン（名刺データ化）」。表はCSS Grid `1.3fr 1.2fr 1fr 1fr`、ヘッダー14px/700、行15px/700 padding `11px 14px`。行データ:
  | プラン | 単価（税別） | 項目数 | 納期 |
  |---|---|---|---|
  | お試し | 0円／枚 | 2項目 | 6営業日 |
  | 通常（ハイライト `#f7f0e2`） | 50円／枚 | 10項目 | 6営業日 |
  | 特急 | 100円／枚 | 10項目 | 3営業日 |
  | 超特急 | 150円／枚 | 10項目 | 1営業日 |
  | オンデマンド | 200円／枚 | 10項目 | 当日 |
  - オンデマンド行のプラン名の直下に「プレミアム限定」ピル（`#171a21` 背景 / `#f0930f` 文字 / 11px/700 / radius 999）。
- **注記（`.note-row`）** ¥コインSVG + 3行の注記（14.5px/700, lh 2）。
- **お礼メール料金帯（`.mail-band`）** `1.5px solid #f0930f`, radius 10。封筒SVG + 「お礼メール送信料金」20px/700 ｜ 100通まで **0**円 ｜ 101通目以降 **1**円／通（税別）。区切りは `1.5px × 78px` の `#f0930f`。下段に注記14px/700。

### 5. CTA（`#contact`）
- H2 26px/700「まずは無料で。　料金・運用のご相談もお気軽に。」
- カード2枚（各560px, gap 40px）。左: ダーク `#171a21`（小見出し14px → 見出し27px/900 → 本文13px/500 `#d9d7d2` → オレンジピル「お試し2項目は料金0円」→ 枠線ボタン52px高）。右: 白＋`1.5px solid #f0930f`（同構成、ボタンはダーク文字）。

### 6. フッター（`.footer`）
`#15181f`、padding `28px 60px`。左にリンク3件（13px/500、区切り `|` は `#5a5e66`、hoverで `#f0930f`）、右に `© Abroad Outsourcing Co., Ltd.`（12.5px, `#c9c7c2`）。

## Interactions & Behavior
- **スクロールリビール**: `IntersectionObserver`（threshold 0.06 / rootMargin `0px 0px -10% 0px`）で対象要素に `.in` を付与。初期 `opacity:0; translateY(26px)` → `opacity:1; none`、`transition: .75s cubic-bezier(.22,.61,.36,1)`。同一親の兄弟は 90ms ずつスタガー（最大6段）。ヒーロー画像のみ `scale(1.04) → none`、1.1s/1.4s。
  - 対象: `.hero-img`, `.hero-copy > *`, `.trust > div`, `h2`, `#ryokin > p`, `.price-row > div`, `.flow-sec > p`, `.flow-side`, `.flow-main`, `.formula`, `.plan-card`, `.plus`, `.speed-card`, `.note-row`, `.mail-band`, `.cta-row > div`, `.footer > div`
  - **JS無効時・`prefers-reduced-motion: reduce` では常時表示**（`.reveal` はJSで付与する設計）。
- **アンカー遷移**: `html { scroll-behavior: smooth }`、ナビ→`#ryokin` / `#shikumi` / `#contact`。
- **hover**: ダークボタン `#2a2e38`、白ボタン `#fdf6ec`、テキストリンク `#ee8500`、フッターリンク `#f0930f`。
- フォーム・API・バリデーションはこのデザインには含まれません（CTAは遷移のみ）。

## Responsive behavior
| ブレークポイント | 変更点 |
|---|---|
| `min-width:1440px and min-height:760px` | 各セクション `min-height:100vh`。ヒーローは `space-between`、他は上下中央。ヒーロー画像は `height:100%`。 |
| `max-width:1439px` | `.lp` の `min-width` 解除。ヒーロー画像 52%幅 / 本文 46%幅（合計100%以下＝重なり防止。**この相補関係を崩さないこと**）。 |
| `max-width:1200px` | 料金カード折返し（300px）、フロー2カラム→縦積み、左カラムの3項目は横並び折返し、料金の仕組み2カラム→縦積み、`＋`は中央、メール帯・CTA折返し。 |
| `max-width:1100px` | **ヒーロー画像を非表示**、ヒーローはflex縦積み。フロー図を `position:static` の縦積みflexへ（コネクタ非表示）。 |
| `max-width:820px` | ナビを本文下の折返し行へ、H1 27px、CTA全幅、認証バッジ縦積み（区切り線非表示）、セクション左右padding 18px、H2 20px、表のfont 13px、メール帯の区切り非表示、フッター縦積み。 |

横スクロールは全幅域で発生しない設計です（`overflow-x` に頼らない縦積み切替）。

## State Management
静的LPのため状態はありません。プロトタイプ側にのみ2つの表示切替パラメータがあります（実装時は不要、またはCMS項目化）:
- `showHeroPhoto: boolean` — ヒーロー画像の表示/非表示
- `highlightRow: 'お試し'|'通常'|'特急'|'超特急'|'オンデマンド'` — 速度プラン表のハイライト行（既定「通常」）

## Assets
- `assets/hero-photo-v2.png` — ヒーローの写真（破れた紙のアンケート＋QR＋スマホ回答画面）。ユーザー提供画像をトリミングしたもの。**本番では権利確認済みの元データを使用してください。**
- `assets/pmark.png` — プライバシーマーク（登録番号 10862401）。公式指定の比率・余白規定に従うこと。
- その他のアイコン・イラスト（クリップボード、ノートPC、書類/封筒、QR、タブレット、封筒、円グラフ、CSV、¥コイン、盾、地球）はすべて**インラインSVGの線画**。実装時は既存のアイコンライブラリ、または正式なイラスト素材への差し替えを推奨します。
- フォントは Google Fonts の `Noto Sans JP`（400/500/700/900）。

## 実装時の注意
1. ヒーローの本文幅と画像幅は**合計が100%を超えないこと**（超えると本文が写真に重なります）。
2. フロー図は1100px以上でのみ絶対配置。縦積み時はコネクタを消す前提のマークアップにしてください。
3. リビールアニメーションは「初期状態を非表示にするクラスをJSで付与する」順序を守ってください（先にCSSで隠すとJS失敗時にコンテンツが消えます）。
4. 会社名は「アブロードアウトソーシング株式会社」/ `Abroad Outsourcing Co., Ltd.`。上場に関する記載は入れないこと。
5. 速度プラン「オンデマンド」の納期表記は暫定「当日」。正式表記を確認のうえ差し替えてください。
