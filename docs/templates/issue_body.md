## 前提調査サマリー
- `graph-page.html`は`graph-page.js`を使用しており、画像リンクは`collectListEntries`および`renderChartSummaryTable`関数で処理されています。
- 現在はファイルパスやURLがそのまま表示されています。
- アンケート回答データには`answerId`（例: `ans-sv_0003_26009-0001`）が含まれており、ここから連番を抽出可能です。

## 概要
`graph-page.html`内の画像リンクの表示形式を以下の指定フォーマットに変更します。
フォーマット: `[surveyId]_[answerId連番]_[questionId]_[type].png`
例: `sv_0003_26009_0786_09_handwriting.png`

## 変更内容
1. `graph-page.js`の`collectListEntries`関数を修正し、`answerId`と`questionId`をリスト項目データに含めるようにします。
2. `renderChartSummaryTable`関数内のリスト表示ロジックを修正し、指定されたフォーマットでリンクテキストを生成するようにします。