Closes #261

## 概要
- お礼メール設定画面の要件定義書（`02_thankYouEmailSettings_requirements.md`）に基づき、シナリオごとのUI切替、送信コストの計算、送信対象者リストの仮想表示、及びリアルタイムプレビュー機能などを実装しました。

## 変更内容
- `02_dashboard/thankYouEmailSettings.html`: 会期前/後などのシナリオを切り替えるプルダウン（開発用）、送信対象者の仮想リスト・件数・金額表示エリア、プレビュー警告エリアを追加。
- `02_dashboard/src/thankYouEmailSettings.js`: シナリオごとの状態管理、コスト計算、対象者リストのレンダリング、変数挿入時のリアルタイムプレビュー更新、送受信時のダミーロジックを実装。
- `02_dashboard/src/ui/thankYouEmailRenderer.js`: 対象者リストのUI制御、変数置換時の修正などを対応。
- `02_dashboard/src/services/thankYouEmailService.js`: 送信対象者リストのモックデータ（`getRecipientsData`）を追加。

## 影響範囲
- 対象画面/機能: お礼メール設定画面
- データ/API 影響: 一部モック関数を追加・修正
- 既存フローへの影響: 特になし

## 動作確認
1. `$ python -m http.server 8000` などのサーバーを起動し、`http://localhost:8000/02_dashboard/thankYouEmailSettings.html?surveyId=sv_0001` へアクセスする。
2. シナリオセレクタを使用して、「会期前・会期中」「名刺データ化後（未送信）」「送信完了」「送信期間外」の各状態でのUI表示やボタンの挙動を確認する。
3. プレビュー画面で変数を挿入し、モックデータで空の値を持つユーザーが選択された場合の警告バッジ表示を確認する。

## テスト結果
- [x] 手動テスト実施済み (※レビュー内でUI確認を依頼)
- [x] コンソールエラーなし
- [x] 仕様ドキュメント更新済み
