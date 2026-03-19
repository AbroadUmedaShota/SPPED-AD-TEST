## 変更概要

名刺データ化設定画面の「見込み枚数」入力エリアを、単純な矩形 input box からインタラクティブなスライダー＋ステッパー構成のUIへ刷新。
展示会での大量名刺収集ユースケース（数千枚規模）を考慮した設計。

## 変更ファイル

- `02_dashboard/bizcardSettings.html`
- `02_dashboard/src/ui/bizcardSettingsRenderer.js`
- `02_dashboard/src/bizcardSettings.js`
- `WEEKLY_CHANGELOG.md`

## 変更内容詳細

### UI改善 (`bizcardSettings.html`)
- ステッパーボタン（`[-]` / `[+]`）: クリックで1枚単位の増減
- レンジスライダー（0〜5,000枚、ステップ50）: ドラッグで直感的に枚数設定。スライダーと数値入力は双方向同期
- 最低請求バッジをインラインカード型に変更（条件で赤/グレー自動切替）
- 旧UIのクイック選択プリセットボタン群は削除

### ロジック (`bizcardSettings.js`)
- `setRequestCount()` ヘルパー追加: スライダー・ステッパー・直接入力の3系統の値変更を一元管理
- ステッパーおよびスライダーのイベントハンドラ追加

### レンダラー (`bizcardSettingsRenderer.js`)
- `minChargeNotice` の更新ロジックを新HTML構造（`<div>` + `<span id="minChargeNoticeText">`）に適合させリファクタリング

## 手動確認事項

- [x] スライダーを動かすと見込み枚数と右カラム金額がリアルタイムに変わること
- [x] ステッパーの `[+]` `[-]` ボタンで1ずつ増減できること
- [x] 最低請求バッジが条件に応じて赤/グレーに変わること
- [x] コンソールエラーなし

Closes #276
