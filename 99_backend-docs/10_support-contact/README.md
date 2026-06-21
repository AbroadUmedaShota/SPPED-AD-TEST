# サポートお問い合わせ受付

`support.speed-ad.com/contact/` の投稿受付、Google Spreadsheet保存、受付メール送信に関するバックエンド整理資料です。

## 方針

- 公開問い合わせフォーム専用の Apps Script Web App を作成します。
- 既存の E2E/バグ報告DB用GASとは分離します。
- 投稿内容は Spreadsheet の `contact_submissions` に保存します。
- 添付画像はフロントエンドでWEBPへ変換してから Drive フォルダに保存し、Spreadsheet にはファイルID/URLを保存します。
- 投稿者向け受付メールは `customer@speed-ad.com` を From にできる場合のみ送信します。
- 確認者向けの閲覧・ステータス更新は、公開投稿用GASとは別の確認者専用GASで行います。

## 現在の進行状態

2026-06-15 時点で、`customer@speed-ad.com` の外部メール受信と外部宛返信は確認済みです。専用GAS、Spreadsheet、Drive フォルダ、Web App URL も作成済みで、`/contact/` から投稿を受け付けられる状態です。

Apps Script エディタで `initializeContactStorage` と `checkContactConfiguration` を実行済みです。`checkContactConfiguration` は `ok: true`、From条件は `primary` で確認済みです。

- Script ID: `1qODYRRKo8X2ps9V6TI5Q8RzR-TswCUS7sx8gZYDEpfgaKeqJhHDl10KT`
- Web App URL: `https://script.google.com/macros/s/AKfycbw6xaQvmfspOOxXEs4DMqfLxQ3Aev6Qi8RcfiFu7iFwOHos48eAPvmmjxSnteN1Lj0D/exec`
- Sheet: `contact_submissions`
- Drive folder: `SPEED AD サポートお問い合わせ添付`
- Verification: `submitContact` のテスト投稿で `storageStatus=stored` / `mailStatus=sent` を確認済み。
- Verification: ローカルHTTP環境の `/05_support/contact/` から画面送信し、完了パネル表示まで確認済み。
- Verification: 添付画像ありの `submitContact` テスト投稿で `storageStatus=stored` / `mailStatus=sent` を確認済み。
- Viewer: 確認者専用GASは `viewer-gas/` に分離し、許可ユーザーだけが一覧、詳細、添付プレビュー、対応ステータス更新を行います。

## 資料

- [GAS実装・配備手順](./gas/README.md)
- [確認者専用GAS実装・配備手順](./viewer-gas/README.md)

## 仕様正本

画面・入力・メール・保存仕様の正本は `docs/画面設計/仕様/23_support_contact_form_requirements.md` です。
