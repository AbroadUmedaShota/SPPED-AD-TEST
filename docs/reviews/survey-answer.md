# Survey Answer Screen Review

## 概要
- **完了（高）** 回答者向け画面から管理者ナビゲーションとフッターを排除し、連絡先付きの軽量ヘッダーと簡潔なフッターでブランドの信用を保ちながら体験を専用化しました。【F:02_dashboard/survey-answer.html†L20-L48】
- **完了（中）** 設問カードを `<fieldset>` / `<legend>` 構造に刷新し、必須文言をスクリーンリーダーで読ませる補助テキストと `aria-describedby` を追加しました。【F:02_dashboard/src/survey-answer.js†L65-L147】
- **完了（中）** 送信ボタンに高コントラストの `:focus-visible` アウトラインとシャドウを実装し、キーボード操作時の焦点喪失を防止しました。【F:02_dashboard/service-top-style.css†L197-L206】

## 対応詳細

### 1. 回答者専用レイアウトの分離
- `survey-answer.html` から共通プレースホルダーと `main.js` 読み込みを外し、最大幅3xlのスタンドアロンレイアウトへ置き換えました。【F:02_dashboard/survey-answer.html†L20-L51】
- ヘッダーにブランド名と問い合わせリンクを明示し、フッターでは利用目的と連絡導線を再掲することで、回答者に必要十分な文脈のみ提供しています。【F:02_dashboard/survey-answer.html†L20-L48】

### 2. 設問構造と必須表示のアクセシビリティ強化
- グループごとに `<section aria-labelledby>` と見出しを生成し、設問は `<fieldset>` 単位で `aria-required` / `aria-describedby` を設定して読み上げ精度を高めました。【F:02_dashboard/src/survey-answer.js†L65-L147】
- 自由記述は不可視ラベルで支援し、単一選択肢は各ラジオボタンへ一意の `id` と `required` を付与してフォーカス移動時も質問文が伝わるようにしています。【F:02_dashboard/src/survey-answer.js†L111-L137】

### 3. キーボードフォーカスの可視化
- `.button-primary:focus-visible` にアウトラインと外側シャドウを追加し、テーマカラーと調和した視覚的フィードバックでWCAG 2.4.7を満たす設計に更新しました。【F:02_dashboard/service-top-style.css†L197-L206】
- 完了メッセージは `role="status"` と `aria-live="polite"` を付与し、送信処理後に支援技術へ完了を即座に通知します。【F:02_dashboard/survey-answer.html†L33-L40】

## 継続観察ポイント
- **優先度: 低** 取得エラー時のメッセージは段落表示のみのため、`role="alert"` を付与するかページ先頭へフォーカスを戻す処理を追加すると状況通知が確実になります。【F:02_dashboard/src/survey-answer.js†L13-L51】

## ポジティブポイント
- 余白と影を備えた単一コンテナが読みやすさと集中度を両立し、回答完了後も同エリアでサンクスメッセージを返せるため動線がシンプルです。【F:02_dashboard/survey-answer.html†L32-L40】
- 質問グループ見出しと設問番号が視覚・音声双方で一貫して提示され、長尺アンケートでもテーマ切り替えを把握しやすくなりました。【F:02_dashboard/src/survey-answer.js†L68-L138】
