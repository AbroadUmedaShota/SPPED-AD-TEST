# 関連メールなし確認の合成画面証跡

- 対象ソース: `3ff6f5f3c5de2eee92ee5e2ef9ce94eba79614e8` の `viewer-workspace-gas/Index.html`
- 確認日: 2026-11-11 JST
- ブラウザ: インストール済みGoogle Chrome `157.0.8103.50`（Playwright `1.59.1`から起動）
- 表示条件: viewport 1440×1100、`ja-JP`、`Asia/Tokyo`、ページ全体を撮影

一時的なlocalhost fixtureへ実HTMLを読み込み、GASのテンプレート初期値と `google.script.run` だけを合成データへ置き換えました。自動起動を外し、実装の `renderStatusSummary`・`renderList`・`renderDetail` で合成案件1件を表示しています。実装のボタン、確認ダイアログ、RPC呼出し、応答検証、確認記録の描画を通しました。画面上部の合成データ表示はfixtureだけに加えた表示です。

1. [確認前](phase2-no-mail-synthetic-chrome-before.png): 関連メール0件、未確認の案内、明示確認ボタンを表示。
2. 確認ダイアログを受諾し、`confirmContactCaseNoMail` を1回呼出し。
3. [確認後](phase2-no-mail-synthetic-chrome.png): 合成応答の確認者・日時・対象期間を表示。
4. [基準日時後のメールとの併記](phase2-no-mail-post-cutoff-synthetic-chrome.png): 別の合成シナリオで、基準日時後のメール1通を表示したまま、対象期間内の関連メールなしを明示確認。確認記録、対象外であることの案内、基準日時後のメール本文を同じ案件画面で表示。

ブラウザのコンソール・ページエラーは0件でした。0件シナリオの呼出しは `listContactMail` と `confirmContactCaseNoMail`、基準日時後シナリオは `listContactMail`・`getContactMailMessage`・`confirmContactCaseNoMail` でした。各確認で固定されたcontextTokenと新規requestIdを送信しました。確認前後で対応ステータス「対応中」と内部メモが一致しました。localhost以外のネットワーク要求は遮断しています。

これはローカル合成画面の表示・操作証跡です。実Gmail、正本Sheet、Firestoreへの保存、認証、別利用者の読戻し、本番配備画面の受入は対象に含みません。
