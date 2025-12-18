# 利用者画面（SPEEDレビュー）の機能レビュー

## 1. 本番データへのフォールバック時に設問情報が欠落する
- **内容**: `initializePage` はデモ用 `docs/examples/demo_surveys` に設問定義がない場合、`data/surveys/enquete/<surveyId>.json` へフォールバック取得していますが、取得結果を `currentSurvey.details` に反映する際に元の `enqueteDetails` 変数を参照しています。そのためフォールバックが成功しても `currentSurvey.details` が空配列のままとなり、設問ヘッダーや回答絞り込みが利用できません。
- **根拠**: フォールバック結果を `enqueteDetailsData` に格納しつつ、後続処理が `enqueteDetails.details` を参照しているため、フォールバック経路では常に空配列になります。【F:02_dashboard/src/speed-review.js†L421-L466】 `data/surveys/enquete` 配下には設問詳細を保持するJSONがあり、本来はここからメタ情報を復元できます。【F:data/surveys/enquete/sv_0001_25022.json†L1-L7】
- **影響**: 本番相当のデータ構成（`data/responses`・`data/surveys/enquete` 配下のみ用意されているケース）では設問メタが読み込めず、表示設問の初期化、未回答優先ソート、回答フィルター生成など画面の主要機能が崩壊します。
- **提案**: フォールバック後に `currentSurvey.details = enqueteDetailsData.details || []` とするなど、実際に利用可能なデータソースを参照するよう修正してください。

## 2. 回答がゼロ件のアンケートで設問切り替え UI が消失する
- **内容**: 設問切り替えのボタン群は `populateQuestionSelector(allCombinedData)` が回答レコードから質問文を収集する設計ですが、回答が一件もないと `data.length === 0` で即リターンし、サイドバーの「表示設問」セクションが空になります。新規アンケートやリアルタイム集計直後など回答未取得のタイミングで設問を選べない状態になります。
- **根拠**: `populateQuestionSelector` が `data` 引数に対して空チェックを行い、アンケート定義（`currentSurvey.details`）を参照していません。【F:02_dashboard/src/speed-review.js†L340-L366】
- **影響**: 回答数が0件でも設問構成は把握したいため、UIが消えるとレビュー担当者が設問を選択できず、表示ヘッダーやフィルターが初期値のまま固定されます。
- **提案**: 回答配列ではなく `currentSurvey.details` を用いてボタンを生成する、または回答が無い場合に限り設問定義をフォールバックとして描画する処理を追加してください。
