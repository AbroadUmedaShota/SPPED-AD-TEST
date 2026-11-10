# 社内向けお問い合わせ確認 GAS

社内用の独立した複製です。実装仕様・配備後の受入項目は
[社内確認アプリ仕様](../../../docs/画面設計/仕様/24_support_contact_workspace_viewer_requirements.md)を参照してください。

## 別プロジェクトへの配備手順（配備作業は本変更に含まない）

1. `s-umeda@abroad-o.com` で新しい Apps Script プロジェクトを作成し、このフォルダーの `Code.gs`、`Index.html`、`appsscript.json` だけをコピーする。既存 `viewer-gas` のプロジェクトとデプロイは維持する。旧 `.clasp.json` はコピーしない。
2. Apps Script のプロジェクト設定画面で Script Properties を設定する。`SPREADSHEET_ID` と `DRIVE_FOLDER_ID` は既存運用の設定値と同じものを使い、実値をリポジトリへ記載しない。`CONTACT_SHEET_NAME` は既存と同じ値（省略時 `contact_submissions`）。新しい保存先や共有設定は作成しない。
3. 同アカウントで Web App として新規デプロイする。実行ユーザーは配備者（`USER_DEPLOYING`）、アクセスは組織内（`DOMAIN`）。manifest と配備画面の両方で確認する。
4. 通常の `/exec` URLをブックマークして利用する。`/exec?id=<submission_id>` で詳細を指定できる。トークンの設定・URL付与・ブラウザ保存は不要。既存の通知送信処理や旧viewerへのリンクの切替は本複製の配備と分けて扱う。
5. 仕様書の配備後確認を実施する。Sessionのメールが空なら、社内利用者でも拒否する。配備者のメールへの代替やUIからの本人指定は行わない。

必要なスコープは Spreadsheetの読取り/更新、Drive読取り、利用者メールのみ。Driveの書込み・共有、外部OCR、外部通信は行わない。利用者へのSpreadsheet/Driveの新しい直接共有は不要であり、配備者の既存アクセス権を使用する。

公開関数は `doGet`、`getViewerContext`、`listContactSubmissions`、`getContactSubmission`、`getAttachmentPreview`、`updateContactSubmissionStatus` のみ。全関数がサーバーの `Session.getActiveUser().getEmail()` を検証する。削除、テストデータ整理、セットアップ、Properties変更の公開入口は持たない。

## ローカル検証

リポジトリルートで実行する。

```powershell
node --test tests/support-contact-workspace-viewer.test.mjs
```

実際のCode.gsをVMで実行し、認証・RPC直接呼出し・更新者・添付境界を検証する。Googleの配備状態、実アカウントのSessionメール提供、ブラウザ描画は配備後に別途確認する。
