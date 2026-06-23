# Handoff: 追加料金・超過料金セクション ／ 案5「注記・帯型」

## Overview
料金プランページ末尾の **「追加料金・超過料金」** セクションのレイアウト改修。
従来は2枚並びだったカードのうち右側を削除した結果、左に1枚だけ残って間延びして見える問題を解消するための案。

案5は **カード表現をやめ、内容を1本の「注記（帯）」として本文に溶け込ませる** アプローチ。
情報量が「グループアカウントの追加料金」1件だけという実態に対して、最も素直で軽い見せ方。
1件しかない料金を大きなカードで強調しすぎず、補足情報として自然に収める。

## About the Design Files
このバンドルに含まれる HTML/CSS は **HTML で作成したデザイン参照（プロトタイプ）** です。
意図した見た目と構造を示すもので、そのまま本番に貼り付けるための製品コードではありません。

タスクは、この HTML デザインを **対象コードベースの既存環境（React / Vue / 既存テンプレート等）で、その確立されたパターン・コンポーネント・トークンを使って再現する** ことです。
（既存ページは静的 HTML のため、同じマークアップ構造をそのまま流用しても問題ありません。）

## Fidelity
**High-fidelity (hifi)**。色・タイポグラフィ・余白・角丸は確定値です。
ピクセル精度で再現してください。色値・サイズは下記「Design Tokens」「Components」に明記しています。

## Screens / Views

### 追加料金・超過料金 セクション（ページ内の1ブロック）
- **Name**: 追加料金・超過料金（Extra / Overage fees）
- **Purpose**: プラン本体・速度別単価とは別に発生する従量／グループ利用料金をユーザーに知らせる。
- **配置**: 料金プランページの「名刺データ化の速度別単価」セクションの直後、フッター（問い合わせ／FAQ ボタン）の直前。
- **Layout**:
  - 外側コンテナ `.extra-section`：`max-width: 1000px; margin: 0 auto; padding: 34px 40px 40px;`（既存ページの `.wrap` と同じ中央寄せ幅）
  - 上から縦に：見出し → サブ説明文 → 帯（fee-band）→ CTA ボタン群
- **Components**:

  1. **見出し `.sec`**
     - テキスト: `追加料金・超過料金`
     - font-size: 22px / font-weight: 800 / letter-spacing: -0.01em / color: `#10294d`

  2. **サブ説明 `.sub`**
     - テキスト: `上記の料金体系とは別に、利用量やグループ利用状況に応じて発生する料金です。`
     - font-size: 13.5px / color: `#3f567a` / margin: 8px 0 20px

  3. **帯 `.fee-band`**（このセクションの主役）
     - レイアウト: `display:flex; gap:14px; align-items:flex-start;`
     - 背景: `#f3f7fd`（淡いブルーグレー）/ border-radius: 12px / padding: 18px 24px / 枠線なし
     - 子要素A — アイコン `.ic`:
       - 36×36px / border-radius: 9px / 背景 `#ffffff` / アイコン色 `#1d4ed8`
       - `display:flex; align-items:center; justify-content:center; flex:none;`
       - 中身は人物2名の inline SVG（24×24 viewBox, stroke 1.7, グループ＝アカウントを示すアイコン）
     - 子要素B — テキスト `.txt`:
       - font-size: 13px / font-weight: 500 / color: `#3f567a` / margin-top: 1px
       - 1行目 `.lbl`（`display:block; margin-bottom:2px`）: `グループアカウントの追加料金`
         — font-weight: 800 / font-size: 14.5px / color: `#10294d`
       - 続く本文（同じ段落内）:
         `グループ機能をご利用の場合、3アカウント目以降は 1アカウントあたり 300円（税別） が発生します。2アカウントまでは無料です。`
       - 金額 `300円（税別）` のみ `.yen` で強調: color `#10294d` / font-size 15px / font-weight 800

  4. **CTA ボタン群 `.extra-cta`**（※既存ページのフッターに同等ボタンが既にある場合は流用し、この帯セクションには含めなくてよい）
     - `display:flex; gap:14px; margin-top:30px;`
     - Primary `.btn.primary`: `料金について問い合わせる` — 背景 `#1d4ed8` / 文字 #fff / radius 999px / padding 12px 24px / font-weight 700 / box-shadow `0 8px 18px -10px rgba(29,78,216,.55)`
     - Ghost `.btn.ghost`: `料金FAQを見る` — 背景 #fff / 文字 `#1d4ed8` / 1.5px solid `#c9d9f2` / radius 999px

## Interactions & Behavior
- 静的セクション。ホバー／アニメーションは必須ではない。
- ボタンは既存のホバー挙動に合わせる（例: primary は明度を少し下げる、ghost は背景を `#eef4fd` に）。
- レスポンシブ: 画面幅が狭い場合、帯（fee-band）はそのまま（アイコン＋テキストの flex row で自然に折り返す）。CTA ボタンは縦積み（`flex-direction: column; align-items: stretch;`）にしてよい。

## State Management
- 状態管理は不要（静的表示）。金額・条件はコンテンツ（CMS/定数）から差し込める形にしておくと将来の項目追加に対応しやすい。
- 将来「お礼メール送信費用」等の追加項目が復活する場合は、`.fee-band` を縦に複数並べる（`gap` を持つラッパで重ねる）だけで拡張可能。

## Design Tokens
| 用途 | 値 |
|---|---|
| アクセント（ブルー） | `#1d4ed8` |
| 見出し・強調テキスト | `#10294d` |
| 本文テキスト | `#3f567a` |
| 補助テキスト | `#90a3c0` |
| 罫線 | `#e3ebf6` |
| 帯の背景 | `#f3f7fd` |
| カード／アイコン背景（白） | `#ffffff` |
| Ghostボタン枠線 | `#c9d9f2` |
| フォント | `"Noto Sans JP", system-ui, sans-serif` |
| セクション最大幅 | 1000px（中央寄せ） |
| 角丸（帯） | 12px |
| 角丸（アイコン） | 9px |
| 角丸（ボタン） | 999px（pill） |
| Primaryボタン影 | `0 8px 18px -10px rgba(29,78,216,.55)` |

## Assets
- グループアイコンは inline SVG（外部画像なし）。`extra-fees-note.html` 内のものをそのまま使用可。
- 画像アセットなし。

## Files
- `extra-fees-note.html` — 案5のみを切り出した実装参照ファイル（このセクション単体で表示・確認できる完結HTML）。
- 参考（このプロジェクト内）:
  - `追加料金セクション 6案.html` — 6案を並べた比較キャンバス（案5以外も含む）
  - `design_handoff_pricing_plan/plan-styles.css` — 既存料金ページの共通スタイル（トークンの出典）
