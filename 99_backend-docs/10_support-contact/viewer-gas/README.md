# サポートお問い合わせ確認アプリ GAS

問い合わせ対応者が Spreadsheet と Drive を直接行き来せず、問い合わせ内容、添付画像、対応ステータスを 1 画面で確認するための Apps Script Web App です。

## 配備方針

- 公開投稿用 GAS とは別プロジェクトとして作成します。
- 短期運用では Web App を `executeAs: USER_DEPLOYING` / `access: ANYONE_ANONYMOUS` で配備します。
- 閲覧者ごとの OAuth 承認ループを避けるため、通知URLのフラグメントに含める `CONTACT_VIEWER_ACCESS_TOKEN` で問い合わせ情報の表示を制御します。読み取り後は可視URLからトークンを消し、同じタブ内の再読み込みに限って `sessionStorage` から復帰します。
- `CONTACT_VIEWER_EMAILS` は将来の Google アカウント単位制御へ戻す場合の許可ユーザー一覧として維持します。
- 投稿データの正本は既存 Spreadsheet `contact_submissions`、添付本体は既存 Drive フォルダです。

## 現行デプロイ

- Script ID: `1tG0AXoDPAG86OurWepwGnZRoZNbplnq_VsiYUINIrv_NbVnMl1Mj7NwW`
- Web App URL: `https://script.google.com/macros/s/AKfycbxz4foQKPlgAeF5ShuM2RBudUpYD8VOvIi7riU1j4QtghnHzvpw9JSKQgfcm61hJKh3/exec`
- Current version: `9` (`support contact viewer ux fixes`)
- Owner: `customer@speed-ad.com`

## Script Properties

| Key | 必須 | 内容 |
| --- | --- | --- |
| `SPREADSHEET_ID` | 必須 | 問い合わせ保存先 Spreadsheet ID |
| `DRIVE_FOLDER_ID` | 必須 | 添付画像保存先 Drive フォルダ ID |
| `CONTACT_SHEET_NAME` | 任意 | 既定は `contact_submissions` |
| `CONTACT_VIEWER_EMAILS` | 必須 | 確認アプリ利用者。カンマ、セミコロン、改行区切りで複数指定可能 |
| `CONTACT_VIEWER_ACCESS_TOKEN` | 必須 | 通知URLの `#token=` に付与する確認用トークン。repoには実値を記録しない |

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
CONTACT_VIEWER_ACCESS_TOKEN=<Script Properties only>
```

## 配備後設定

1. 確認アプリの Web App URL を発行する。
2. 確認アプリと公開投稿用 GAS の Script Property `CONTACT_VIEWER_ACCESS_TOKEN` に同じ値を設定する。
3. 公開投稿用 GAS の Script Property `CONTACT_VIEWER_BASE_URL` に確認アプリの Web App URL を設定する。
4. 公開投稿用 GAS を再デプロイし、社内通知メールの `確認アプリ` リンクに `id` と `#token` が含まれ、詳細を開けることを確認する。

## 確認項目

- 初期一覧は対応が必要な問い合わせを優先し、上部にステータス件数が出る。
- 通知メール内の確認アプリURLで一覧、詳細、添付プレビューを表示できる。
- `未対応` / `対応中` / `対応済み` / `保留` と内部メモを更新できる。対応中・対応済み・保留のクイック操作も使える。
- 添付はその場で大きく開け、複数添付は前後移動できる。
- `token` がない、または不正なURLでは問い合わせ情報が表示されない。
- `token` / `accessToken` のクエリやフラグメントは読み取り後に可視URLから消える。同じタブ内の再読み込みでは保持済みトークンで復帰し、不正トークン判定時は保持値を消す。
- 添付ビューアは開いた時に閉じるボタンへフォーカスし、閉じた時に元の添付サムネイルへ戻る。
- 添付ファイルの Drive リンクはフォールバックとして開ける。

2026-06-21 検証:

- 公開投稿GASの通知メールに確認アプリ詳細URLが入ることを確認済み。
- テスト受付ID `70a13837-4725-4b56-ab5f-22a5135ea3ca` で `storageStatus=stored` / `mailStatus=sent` を確認済み。
- 添付ファイル `70a13837-4725-4b56-ab5f-22a5135ea3ca-1-codex-production-check.webp` が Drive に `image/webp` として保存されることを確認済み。
- トークンなしの確認アプリURLはGoogle認証へリダイレクトせず、アプリ内で無効URL表示になることを確認済み。
- 確認アプリURLのトークンをURLフラグメントへ移行し、公開HTMLに `location.hash` 読み取りが反映されていることを確認済み。
- 確認アプリのUX改善をバージョン `8` へ反映し、公開HTMLに対応が必要フィルタ、ステータス件数、返信リンク、添付ビューア、サーバー側トークン検証が含まれることを確認済み。
- 確認アプリのUX修正をバージョン `9` へ反映し、公開HTMLに `sessionStorage` 復帰、添付ビューアのフォーカス復帰、閉じるボタンへの初期フォーカスが含まれることを確認済み。
