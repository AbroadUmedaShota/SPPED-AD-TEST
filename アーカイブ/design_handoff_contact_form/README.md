# Handoff: お問い合わせフォーム（SPEED AD Support）

## Overview
SPEED AD Support のヘルプセンター内「お問い合わせ」ページのデザインです。来訪者が名前・メール・件名・本文を入力し、必要に応じて**画像（スクリーンショット等）を添付**して送信する、シンプルなコンタクトフォームです。採用案は **「案07：ミニマル（中央・余白重視）」**。項目を絞り、完了率を高めることを狙ったレイアウトです。

## About the Design Files
このバンドルに含まれる HTML は **HTML で作成したデザインの参照（プロトタイプ）** です。意図した見た目と挙動を示すもので、そのまま本番コードとして流用する前提のものではありません。

タスクは、この HTML デザインを **対象コードベースの既存環境（React / Vue / Next.js など）に、その確立されたパターン・コンポーネント・ライブラリを用いて再現する** ことです。まだ環境が無い場合は、プロジェクトに最適なフレームワークを選定して実装してください。`contact-form-reference.html` の `<style>` と `<script>` は値・挙動の根拠資料として参照し、コピペ移植ではなく再構築してください。

## Fidelity
**High-fidelity（hifi）**。最終的な配色・タイポグラフィ・余白・インタラクションを含むピクセル単位のモックです。下記のトークン・寸法に沿ってUIを忠実に再現してください。スタイリングは既存デザインシステムのコンポーネント（Button / Input / Textarea 等）にマッピングしつつ、本ドキュメントの値に一致させてください。

## Screens / Views

### 画面：お問い合わせ（Contact）
- **Name**: お問い合わせ（Contact / 案07 ミニマル）
- **Purpose**: ユーザーが問い合わせ内容を入力し、任意で画像を添付して送信する。
- **Layout**:
  - ページ全体は **ヘッダー → コンタクト本体 → フッター** の縦積み。ヘッダー／フッターはサイト共通。
  - ヘッダー・フッターの内側コンテンツは `max-width: 1180px; margin: 0 auto; padding: 0 40px;`。
  - コンタクト本体（`<main>`）は背景 `#f4f7fb`、`padding: 56px 40px 64px`。
  - フォーム領域は **中央寄せ・`max-width: 520px`**。見出し3要素（eyebrow / title / lead）は**中央揃え**、フォーム本体は左揃え。
  - フォームは縦1カラムの flex（`flex-direction: column; gap: 18px`）。各フィールドはラベル上・入力下。
- **Components**: 下記「フォーム部品」「画像アップローダー」参照。

#### ヘッダー（共通）
- 高さ 66px、背景 `#fff`、下境界 `1px solid #dde5ee`。
- 左：ロゴ（三角形 SVG、`#16324c`）＋ テキスト「SPEED AD（800） Support（600 / `#41566c`）」16px。
- 右：ナビ `ヘルプ / FAQ / お問い合わせ`、14px / 700 / `#2a3848`、間隔 30px、hover で `#16324c`。

#### 見出し
- eyebrow: テキスト `CONTACT`、12px / 800 / `#2c5d97` / `letter-spacing: .14em` / 中央。下マージン 10px。
- title: `お問い合わせ`、30px / 800 / `#16324c` / 中央。下マージン 8px。
- lead: `必要な項目のみ。お気軽にお送りください。`、13.5px / `#6b7c8f` / `line-height: 1.8` / 中央。下マージン 34px。

#### フォーム部品
全項目とも：ラベルは `12.5px / 700 / #41566c`、下マージン 7px。入力コントロールは下記共通。
- 入力共通（input / textarea / select）:
  - `width: 100%; padding: 13px 14px; font-size: 14px; color: #16324c; background: #fff;`
  - `border: 1px solid #d4dce6; border-radius: 9px;`
  - フォーカス時：`border-color: #2c5d97`（box-shadow 等は無し）
  - placeholder 色：`#9aa8b8`
  - textarea のみ：`min-height: 130px; resize: vertical; line-height: 1.7;`
- フィールド一覧（上から順）:
  1. **お名前** — text、placeholder「山田 太郎」、任意
  2. **メールアドレス** — email、placeholder「name@example.com」、任意
  3. **件名** — text、placeholder「お問い合わせの件名」、任意 ← *この案で採用にあたり追加された項目*
  4. **お問い合わせ内容** — textarea、placeholder「ご質問・ご要望をご記入ください。」、任意
  5. **添付ファイル（任意）** — 画像アップローダー（下記）
- **送信ボタン**: ラベル「送信する」、横幅 100%、`padding: 15px`、`background: #16324c`、`color: #fff`、14.5px / 700、`border-radius: 10px`、上マージン 6px。hover で `#1d4368`。

> 注：この案ではフィールドの必須マーク（`*`）は付けていません。バリデーション要件は「Interactions & Behavior」を参照し、プロダクト要件に合わせて設定してください。

#### 画像アップローダー
- **ドロップゾーン**（クリックでファイル選択ダイアログ／ドラッグ＆ドロップ両対応）:
  - `border: 1.5px dashed #c6d2df; border-radius: 11px; background: #f7fafc; padding: 26px 20px;`
  - 中身は縦中央寄せ：アイコン丸（40×40、`background: #e7eff9`、`color: #2c5d97`、上矢印 `↑`、18px / 800）＋ タイトル「クリック、またはドラッグ＆ドロップ」（13.5px / 700 / `#41566c`）＋ サブ「PNG / JPG（複数添付できます） ・ 10MBまで」（12px / `#8595a6`）。
  - ドラッグオーバー中：`border-color: #2c5d97; background: #e7eff9;`（`.is-drag`）。`transition: border-color .15s, background .15s`。
- **サムネイル一覧**（添付後に表示）:
  - `display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 12px; margin-top: 14px;`
  - 各サムネ：`border: 1px solid #e2e9f1; border-radius: 10px; overflow: hidden;`。画像は `height: 92px; object-fit: cover;`。
  - 削除ボタン：右上 22×22 丸、`background: rgba(18,50,76,.78)`、白「×」。
  - ファイル名：下部 `11px / #6b7c8f`、1行省略（ellipsis）。
  - カウント表示：一覧下に `12px / #8595a6`「N 件の画像を添付中」。

## Interactions & Behavior
- **ファイル選択**: ドロップゾーンのクリックで OS のファイル選択を開く（`<input type="file" accept="image/*" multiple>`）。
- **ドラッグ＆ドロップ**: `dragover` で `.is-drag` 付与、`dragleave`/`drop` で解除。`drop` 時に画像ファイルを取り込む。
- **画像フィルタ**: `type` が `image/` で始まるファイルのみ受理（それ以外は無視）。
- **複数添付**: 追加するたびに既存リストへ**追記**。
- **プレビュー**: 取り込み時に `URL.createObjectURL` でサムネ表示。削除時は `URL.revokeObjectURL` で解放。
- **削除**: 各サムネ右上「×」で個別削除し、一覧とカウントを再描画。
- **送信**: 参照実装ではデフォルト送信を抑止しデモalert。実装では下記バリデーション後にエンドポイントへ送信（multipart/form-data 想定）。
- **hover**: ナビ／フッターリンク → `#16324c`、送信ボタン → `#1d4368`。
- **focus**: 入力コントロールのボーダー → `#2c5d97`。
- **レスポンシブ**: フォームは `max-width: 520px` の中央寄せのため狭幅でも自然に縮む。ヘッダー／フッターは現状デスクトップ前提（`padding: 0 40px`）。モバイル対応が必要ならフッターの4カラムグリッドを段組み変更し、ヘッダーナビの折り返し／メニュー化を検討。

### 推奨バリデーション（プロダクト要件に合わせて調整）
- メールアドレス：形式チェック。
- 添付：画像形式のみ／1ファイル上限（例：10MB）／総容量・枚数上限。
- 必須項目を設ける場合はラベルに `*`（色 `#c0492f`）を付与し、エラーメッセージ表示を追加。

## State Management
- `files: Array<{ id, name, url, file }>` — 添付中の画像リスト。
  - 追加：選択／ドロップで `image/*` を追記。
  - 削除：`id` 一致を除外し、`URL.revokeObjectURL` で blob 解放。
- `isDragging: boolean` — ドロップゾーンのドラッグ強調状態。
- フォーム各値（name / email / subject / message）：フレームワークの form state に保持。
- データ取得要件：なし（送信のみ）。送信は添付画像を含む `FormData` を想定。

## Design Tokens

### Colors
| 用途 | 値 |
|---|---|
| プライマリ（ボタン/ロゴ/見出し） | `#16324c` |
| プライマリ hover | `#1d4368` |
| アクセント（eyebrow/フォーカス/リンク） | `#2c5d97` |
| 本文インク | `#2a3848` |
| ラベル | `#41566c` |
| ミュート文字 | `#6b7c8f` |
| ミュート文字（弱） | `#8595a6` |
| placeholder | `#9aa8b8` |
| 区切り線 | `#dde5ee` |
| 入力ボーダー | `#d4dce6` |
| ドロップゾーン破線 | `#c6d2df` |
| ページ背景（コンタクト本体） | `#f4f7fb` |
| ドロップゾーン背景 | `#f7fafc` |
| アイコン丸／ドラッグ時背景 | `#e7eff9` |
| サムネ枠 | `#e2e9f1` |
| 必須マーク | `#c0492f` |
| 面（ヘッダー/フッター/入力） | `#ffffff` |

### Typography
- フォント: `-apple-system, BlinkMacSystemFont, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, system-ui, sans-serif`
- 見出し title: 30px / 800
- eyebrow: 12px / 800 / `letter-spacing: .14em`
- lead: 13.5px / line-height 1.8
- ラベル: 12.5px / 700
- 入力テキスト: 14px
- ボタン: 14.5px / 700
- ナビ・フッター見出し: 14px / 700、フッターリンク 13px

### Spacing / Radius
- コンタクト本体 padding: `56px 40px 64px`
- フォーム max-width: `520px`、項目間 gap: `18px`
- 入力 padding: `13px 14px`、ボタン padding: `15px`
- border-radius: 入力 `9px` / ボタン・ドロップゾーン `10–11px` / サムネ `10px` / アイコン丸 `50%`
- ヘッダー高さ: `66px`、サイト内側 padding: `0 40px`、max-width `1180px`

### Shadows / Borders
- ボックスシャドウは案07では未使用（フラット）。境界線で区切る。
- ボーダー: `1px solid`（線色は上表）、ドロップゾーンのみ `1.5px dashed`。

## Assets
- **ロゴ**: インライン SVG（三角形）。`fill: #16324c`（外）/`#ffffff`（内）。`contact-form-reference.html` のヘッダー内にソースあり。外部画像なし。
- アイコン類は CSS／文字（`↑`、`×`）で表現。アイコンフォント・画像アセットは不要。
- ユーザーが添付する画像はクライアント側で `createObjectURL` プレビュー（保存先は実装側で決定）。

## Files
- `design_handoff_contact_form/contact-form-reference.html` — 採用案（案07）の自己完結デザイン参照。ヘッダー＋フォーム＋フッター、画像アップローダーの動作（クリック／D&D／プレビュー／削除）を含むバニラ実装。依存なしでブラウザで直接開けます。

### 補足（このバンドル外）
- 元の探索ファイル：プロジェクト直下 `Contact.dc.html`（10案を1ページに並べた検討用）。共通ヘッダー／フッターは `SpeedHeader.dc.html` / `SpeedFooter.dc.html`。実装の参照は本バンドルの `contact-form-reference.html` のみで完結します。
