## 概要

名刺データ化設定画面（`bizcardSettings.html`）の「見込み枚数」入力エリアのUI/UXを改善する。
現状の単純な矩形 `<input type="number">` を、直感的に操作可能なスライダー＋プリセットボタン＋ステッパー構成のインタラクティブUIへ刷新する。

---

## 背景・理由

現状の「見込み枚数」入力は矩形の数値入力ボックス1つのみで、以下の課題がある：

1. **数値のスケール感が伝わらない**: 何百枚という数値を単純なボックスに手入力するだけで、量の感覚や値段変化が直感に訴えない
2. **最低請求に関する注意書きの視認性が低い**: 料金に直結する重要情報（50枚未満でも50枚分課金）が画面下部の小テキストに埋もれている
3. **入力操作のフリクションが高い**: スマートなSaaSの料金設定UIと比較してUX品質に差がある

---

## 事前調査サマリー

- `bizcardSettings.html` L101–L118: 現在の「見込み枚数」セクション。`<input type="number" id="bizcardRequest">` + 「枚」ラベルのみ
- `bizcardSettingsRenderer.js` L97–L167: `renderEstimate` が `minChargeNotice` の表示制御を担当
- `bizcardSettings.js`: 数値変更時に `handleBizcardRequestChange` が呼ばれ、見積もりが再計算される

---

## 変更内容

### `bizcardSettings.html`
- 「見込み枚数」セクションのHTMLを以下の構成に全面書き換え：
  - **ステッパーボタン**（`[-]` `[+]`）: クリックで1枚単位増減
  - **スライダー**（`<input type="range">`）: 50〜1000の範囲でドラッグ操作
  - **プリセットボタン群**（50 / 100 / 200 / 500 枚）: クリックで即座にセット
  - **最低請求バッジ**のインライン表示エリア（条件で赤/グレー切替）

### `bizcardSettingsRenderer.js`
- 新規DOM要素（スライダー、プリセットボタン）のキャッシュ追加
- モジュール内のスライダー/入力値の双方向同期ロジック

### `bizcardSettings.js`
- スライダー `input` イベントハンドラ追加
- プリセットボタン `click` イベントハンドラ追加（50/100/200/500）
- ステッパーボタン `click` イベントハンドラ追加（最小0、上限1000ガード）

---

## Definition of Done

- [ ] スライダーを動かすと見込み枚数と右カラム金額がリアルタイムに変わること
- [ ] プリセットボタン（50/100/200/500）クリックで数値が即座にセットされること
- [ ] ステッパーの `[+]` `[-]` ボタンで1ずつ増減できること
- [ ] 最低請求バッジが50枚未満で赤、それ以上でグレーに変わること
- [ ] コンソールエラーがないこと
- [ ] WEEKLY_CHANGELOG.md が更新されていること

---

## 関連ファイル

- `02_dashboard/bizcardSettings.html`
- `02_dashboard/src/ui/bizcardSettingsRenderer.js`
- `02_dashboard/src/bizcardSettings.js`
- `docs/要件定義/03_bizcardSettings_requirements.md`

---

*CLIにてユーザー承認済み（2026-03-19）*
