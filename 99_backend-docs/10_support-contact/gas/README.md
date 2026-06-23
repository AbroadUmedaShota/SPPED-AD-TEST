# サポートお問い合わせフォーム GAS

`support.speed-ad.com/contact/` から Google Spreadsheet へ投稿内容を保存し、`customer@speed-ad.com` から受付メールを送るための専用 Apps Script Web App です。

## 前提

- 既存の E2E/バグ報告DB用GASは流用しません。
- Web App は `executeAs: USER_DEPLOYING` / `access: ANYONE_ANONYMOUS` で配備します。
- 投稿は GAS の CORS 制約を避けるため `Content-Type: text/plain;charset=utf-8` で送信します。
- `customer@speed-ad.com` がデプロイユーザー本人、または `GmailApp.getAliases()` に含まれる送信エイリアスであることを本番有効化条件にします。

## Script Properties

| Key | 必須 | 内容 |
| --- | --- | --- |
| `SPREADSHEET_ID` | 必須 | `contact_submissions` を作成する Spreadsheet ID |
| `DRIVE_FOLDER_ID` | 添付ありの場合必須 | 添付画像を保存する Drive フォルダ ID |
| `CONTACT_FROM_EMAIL` | 必須 | 既定は `customer@speed-ad.com` |
| `CONTACT_REPLY_TO_EMAIL` | 任意 | 投稿者向け受付メールの Reply-To |
| `CONTACT_NOTIFY_EMAIL` | 必須 | 社内通知先 |
| `CONTACT_SHEET_NAME` | 任意 | 既定は `contact_submissions` |
| `CONTACT_MAX_ATTACHMENT_MB` | 任意 | 既定は `10` |

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
        "name": "screenshot.png",
        "mimeType": "image/png",
        "size": 12345,
        "data": "<base64>"
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

`customer@speed-ad.com` を From にできない場合:

```json
{
  "ok": false,
  "submissionId": "...",
  "storageStatus": "stored",
  "mailStatus": "failed_from_not_available",
  "error": "customer@speed-ad.com を送信元にできないため送信を停止しました。"
}
```

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

`CONTACT_FROM_EMAIL`、`CONTACT_REPLY_TO_EMAIL`、`CONTACT_NOTIFY_EMAIL` は未設定の場合 `customer@speed-ad.com` で初期化されます。社内通知先を別アドレスにする場合は、初期化後に `CONTACT_NOTIFY_EMAIL` を変更します。

`checkContactConfiguration` の戻り値で `ok: true` になることを本番有効化条件にします。特に `from.available` が `true` でない場合、フォーム投稿は保存済みでも成功扱いにしません。

## 本番有効化チェック

- デプロイユーザーが `customer@speed-ad.com` 本人、または Gmail の送信エイリアスに `customer@speed-ad.com` を持っていること。
- `initializeContactStorage` が成功し、Spreadsheet ID と Drive Folder ID が Script Properties に保存されること。
- `initializeContactSheet` が成功し、`contact_submissions` のヘッダーが作成されること。
- `checkContactConfiguration` が `ok: true` を返すこと。
- Web App URL へ `submitContact` テスト投稿し、`storageStatus=stored` / `mailStatus=sent` が返ること。
- フォームからテスト投稿し、Sheetに1行追加されること。
- 添付あり投稿でDriveに画像が保存され、Sheetの `attachment_refs` と一致すること。
- 投稿者向け受付メールの From が `customer@speed-ad.com` で届くこと。
- 社内通知メールに `submission_id`、問い合わせ種別、投稿者メールアドレスが含まれること。
