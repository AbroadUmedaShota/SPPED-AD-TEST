Closes #131

## 概要 (Overview)

`surveyCreation.html` の初回ログインチュートリアルにおける2つの問題を修正しました。

1.  プレビュー画面のハイライトが効かない問題
2.  チュートリアル完了後の画面遷移時に不要な確認モーダルが表示される問題

## 主な変更点 (Key Changes)

- **`first-login-tutorial.js`:**
    - プレビューモーダルのチュートリアルステップ (`#surveyPreviewModal`) に `highlight: false` を追加し、モーダル自体ではなく背景が暗くなるように修正しました。
    - チュートリアル完了時の処理に `window.disableUnloadConfirmation()` の呼び出しを追加し、画面遷移前の確認ダイアログを抑制するようにしました。
- **`surveyCreation.js`:**
    - `beforeunload` イベントリスナーを名前付き関数にリファクタリングし、`window.disableUnloadConfirmation` というグローバル関数を公開して、外部からリスナーを削除できるようにしました。

## チェックリスト (Checklist)

- [x] `GEMINI.md`のワークフローに従っている
- [x] 変更点がIssueの要件を満たしている
- [ ] CI/CDパイプラインがすべて成功している (セルフレビュー後に確認)
- [ ] 関連ドキュメントが更新されている (今回はドキュメントの変更はありません)
