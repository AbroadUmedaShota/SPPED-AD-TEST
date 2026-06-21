# サポートお問い合わせ確認アプリ GAS

問い合わせ対応者が Spreadsheet と Drive を直接行き来せず、問い合わせ内容、添付画像、対応ステータスを 1 画面で確認するための Apps Script Web App です。

## 配備方針

- 公開投稿用 GAS とは別プロジェクトとして作成します。
- Web App は `executeAs: USER_ACCESSING` / `access: ANYONE` で配備します。
- アプリ内で `CONTACT_VIEWER_EMAILS` を確認し、許可ユーザー以外には問い合わせ情報を表示しません。
- 投稿データの正本は既存 Spreadsheet `contact_submissions`、添付本体は既存 Drive フォルダです。

## 現行デプロイ

- Script ID: `1tG0AXoDPAG86OurWepwGnZRoZNbplnq_VsiYUINIrv_NbVnMl1Mj7NwW`
- Web App URL: `https://script.google.com/macros/s/AKfycbxz4foQKPlgAeF5ShuM2RBudUpYD8VOvIi7riU1j4QtghnHzvpw9JSKQgfcm61hJKh3/exec`
- Current version: `4` (`support contact viewer initial`)
- Owner: `customer@speed-ad.com`

## Script Properties

| Key | 必須 | 内容 |
| --- | --- | --- |
| `SPREADSHEET_ID` | 必須 | 問い合わせ保存先 Spreadsheet ID |
| `DRIVE_FOLDER_ID` | 必須 | 添付画像保存先 Drive フォルダ ID |
| `CONTACT_SHEET_NAME` | 任意 | 既定は `contact_submissions` |
| `CONTACT_VIEWER_EMAILS` | 必須 | 確認アプリ利用者。カンマ、セミコロン、改行区切りで複数指定可能 |

初期値:

```text
CONTACT_VIEWER_EMAILS=customer@speed-ad.com,s-umeda@abroad-o.com,t-hayashi@abroad-o.com
```

2026-06-21 時点の運用値:

```text
SPREADSHEET_ID=1tv6xEckXPd8bIwbGfE-aJ-XxkIUDreglmcioCpkH-98
DRIVE_FOLDER_ID=1rcFGJh9l3NwUeYt2MIR8p2A-DVYxxEwY
CONTACT_SHEET_NAME=contact_submissions
CONTACT_VIEWER_EMAILS=customer@speed-ad.com,s-umeda@abroad-o.com,t-hayashi@abroad-o.com
```

## 配備後設定

1. 確認アプリの Web App URL を発行する。
2. 公開投稿用 GAS の Script Property `CONTACT_VIEWER_BASE_URL` に確認アプリの Web App URL を設定する。
3. 公開投稿用 GAS を再デプロイし、社内通知メールの `確認アプリ` リンクから詳細を開けることを確認する。

## 確認項目

- 許可ユーザーで一覧、詳細、添付プレビューを表示できる。
- `未対応` / `対応中` / `対応済み` / `保留` と内部メモを更新できる。
- 未許可ユーザー、匿名ユーザーでは問い合わせ情報が表示されない。
- 添付ファイルの Drive リンクはフォールバックとして開ける。

2026-06-21 検証:

- 公開投稿GASの通知メールに確認アプリ詳細URLが入ることを確認済み。
- テスト受付ID `70a13837-4725-4b56-ab5f-22a5135ea3ca` で `storageStatus=stored` / `mailStatus=sent` を確認済み。
- 添付ファイル `70a13837-4725-4b56-ab5f-22a5135ea3ca-1-codex-production-check.webp` が Drive に `image/webp` として保存されることを確認済み。
