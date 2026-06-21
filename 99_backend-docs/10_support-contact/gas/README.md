# サポートお問い合わせフォーム GAS

`support.speed-ad.com/contact/` から Google Spreadsheet へ投稿内容を保存し、`customer@speed-ad.com` から受付メールを送るための専用 Apps Script Web App です。

## 前提

- 既存の E2E/バグ報告DB用GASは流用しません。
- Web App は `executeAs: USER_DEPLOYING` / `access: ANYONE_ANONYMOUS` で配備します。
- 投稿は GAS の CORS 制約を避けるため `Content-Type: text/plain;charset=utf-8` で送信します。
- `CONTACT_FROM_EMAIL` がデプロイユーザー本人、または `GmailApp.getAliases()` に含まれる送信エイリアスである場合は、そのアドレスを From にします。利用できない場合でも送信は停止せず、Gmail の既定送信者から送信し、`CONTACT_REPLY_TO_EMAIL` を Reply-To として保持します。

## 現行デプロイ

- Script ID: `1qODYRRKo8X2ps9V6TI5Q8RzR-TswCUS7sx8gZYDEpfgaKeqJhHDl10KT`
- Web App URL: `https://script.google.com/macros/s/AKfycbw6xaQvmfspOOxXEs4DMqfLxQ3Aev6Qi8RcfiFu7iFwOHos48eAPvmmjxSnteN1Lj0D/exec`
- Current version: `9` (`support contact viewer link and webp metadata`)
- Rollback candidate: version `7` (`support contact reply-to fallback for ops owner migration`)
- Owner: `customer@speed-ad.com`

## Script Properties

| Key | 必須 | 内容 |
| --- | --- | --- |
| `SPREADSHEET_ID` | 必須 | `contact_submissions` を作成する Spreadsheet ID |
| `DRIVE_FOLDER_ID` | 添付ありの場合必須 | 添付画像を保存する Drive フォルダ ID |
| `CONTACT_FROM_EMAIL` | 必須 | 既定は `customer@speed-ad.com` |
| `CONTACT_REPLY_TO_EMAIL` | 任意 | 投稿者向け受付メールの Reply-To |
| `CONTACT_NOTIFY_EMAIL` | 必須 | 社内通知先。カンマ、セミコロン、改行区切りで複数宛先を指定できます。 |
| `CONTACT_SHEET_NAME` | 任意 | 既定は `contact_submissions` |
| `CONTACT_MAX_ATTACHMENT_MB` | 任意 | 既定は `10` |
| `CONTACT_VIEWER_BASE_URL` | 任意 | 確認者専用GAS Web App URL。設定時は社内通知の主リンクになります。 |

2026-06-21 時点の追加運用値:

```text
CONTACT_NOTIFY_EMAIL=customer@speed-ad.com,s-umeda@abroad-o.com,t-hayashi@abroad-o.com
CONTACT_VIEWER_BASE_URL=https://script.google.com/macros/s/AKfycbxz4foQKPlgAeF5ShuM2RBudUpYD8VOvIi7riU1j4QtghnHzvpw9JSKQgfcm61hJKh3/exec
```

## OAuth scopes

`GmailApp.getAliases()` と `GmailApp.sendEmail()` を使うため、`appsscript.json` には Gmail 権限 `https://mail.google.com/` を含めます。`https://www.googleapis.com/auth/script.send_mail` のみでは `GmailApp` の送信権限が不足するため、受付メール送信時に権限エラーになります。

## API

```http
POST <Web App URL>
Content-Type: text/plain;charset=utf-8
```

```json
{
  "action": "submitContact",
  "payload": {
    "contactType": "general",
    "contactTypeLabel": "一般的なお問い合わせ",
    "name": "山田 太郎",
    "email": "name@example.com",
    "subject": "お問い合わせの件名",
    "message": "お問い合わせ内容",
    "attachments": [
      {
        "name": "screenshot.webp",
        "mimeType": "image/webp",
        "size": 9876,
        "data": "<base64>",
        "originalName": "screenshot.png",
        "originalMimeType": "image/png",
        "originalSize": 12345
      }
    ],
    "sourceUrl": "https://support.speed-ad.com/contact/",
    "userAgent": "...",
    "privacyConsent": true
  }
}
```

成功時:

```json
{
  "ok": true,
  "submissionId": "...",
  "receivedAt": "2026-06-14T00:00:00.000Z",
  "storageStatus": "stored",
  "mailStatus": "sent"
}
```

`CONTACT_FROM_EMAIL` を From にできない場合も、送信自体は継続します。返信先は `CONTACT_REPLY_TO_EMAIL` に設定されます。

## 配備手順

```powershell
npx --yes @google/clasp login
npx --yes @google/clasp create --title "SPEED AD サポートお問い合わせ受付" --type standalone
npx --yes @google/clasp push --force
npx --yes @google/clasp deploy --description "support contact receiver"
```

Script Properties に `SPREADSHEET_ID` などを設定します。`clasp run` が使える場合は補助関数を追加して設定してもよいですが、初回は Apps Script エディタの Project Settings から手動設定するのが安全です。

## 初期化・設定確認

Apps Script エディタ上で、Web App 公開前に以下の関数を手動実行します。

| 関数 | 目的 |
| --- | --- |
| `initializeContactStorage` | `SPREADSHEET_ID` と `DRIVE_FOLDER_ID` が未設定の場合、GAS実行ユーザーのDriveに保存先を作成し、既定のメール設定とあわせて Script Properties へ保存します。 |
| `initializeContactSheet` | `contact_submissions` シートを作成し、ヘッダー行を初期化します。 |
| `checkContactConfiguration` | Spreadsheet、Drive Folder、通知先、From条件をまとめて確認します。 |

既存の Spreadsheet / Drive フォルダを使う場合は、先に Script Properties の `SPREADSHEET_ID` / `DRIVE_FOLDER_ID` を手動設定します。未設定のまま `initializeContactStorage` を実行した場合は、新規作成した ID が Script Properties に保存されます。

`CONTACT_FROM_EMAIL`、`CONTACT_REPLY_TO_EMAIL`、`CONTACT_NOTIFY_EMAIL` は未設定の場合 `customer@speed-ad.com` で初期化されます。社内通知先を追加する場合は、初期化後に `CONTACT_NOTIFY_EMAIL` をカンマ、セミコロン、または改行区切りの複数宛先へ変更します。`setContactNotifyEmail` を使う場合は、メールアドレスリストを引数に渡すと Script Properties の `CONTACT_NOTIFY_EMAIL` を更新できます。

確認者専用GASを配備した後は、公開投稿GASの `CONTACT_VIEWER_BASE_URL` に確認者専用GAS Web App URLを設定します。設定済みの場合、社内通知メールの主導線は `CONTACT_VIEWER_BASE_URL?id=<submission_id>` になります。

`checkContactConfiguration` の戻り値で `ok: true` になることを本番有効化条件にします。`from.available` が `false` の場合は From 表示がGAS実行ユーザーになるため、メール実着信時に Reply-To が `CONTACT_REPLY_TO_EMAIL` になっていることを確認します。

## 本番有効化チェック

- `CONTACT_FROM_EMAIL` が From として使える場合はその表示で届くこと。使えない場合は、GAS実行ユーザーから届き、Reply-To が `CONTACT_REPLY_TO_EMAIL` になること。
- `initializeContactStorage` が成功し、Spreadsheet ID と Drive Folder ID が Script Properties に保存されること。
- `initializeContactSheet` が成功し、`contact_submissions` のヘッダーが作成されること。
- `checkContactConfiguration` が `ok: true` を返すこと。
- Web App URL へ `submitContact` テスト投稿し、`storageStatus=stored` / `mailStatus=sent` が返ること。
- フォームからテスト投稿し、Sheetに1行追加されること。
- 添付あり投稿でDriveにWEBP画像が保存され、Sheetの `attachment_refs` と一致すること。
- 投稿者向け受付メールの From または Reply-To から `customer@speed-ad.com` に返信できること。
- 社内通知メールが `CONTACT_NOTIFY_EMAIL` の全宛先に届くこと。
- 社内通知メールの件名に問い合わせ種別が含まれること。
- 社内通知メールに `submission_id`、問い合わせ種別、投稿者メールアドレス、確認アプリ詳細URLが含まれること。

2026-06-21 検証:

- Web App URL への添付ありテスト投稿で `storageStatus=stored` / `mailStatus=sent` を確認済み。
- テスト受付ID: `70a13837-4725-4b56-ab5f-22a5135ea3ca`
- Drive保存ファイル: `1tAxw8xgyF5mvt762VMd3fHcpYTBnAUjh`、MIME `image/webp`
- `s-umeda@abroad-o.com` のGmailで社内通知を確認済み。To は `customer@speed-ad.com,s-umeda@abroad-o.com,t-hayashi@abroad-o.com`、本文に確認アプリ詳細URL、Spreadsheet URL、該当行リンク、添付Driveリンクを含む。
