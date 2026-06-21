---
owner: support-contact
status: draft
last_reviewed: 2026-06-21
---

# サポートお問い合わせフォーム仕様

## 1. 目的

`support.speed-ad.com/contact/` を、SPEED AD 利用者向けの汎用お問い合わせ窓口として整備する。フォーム投稿後は、投稿者に受付メールが届き、投稿内容は後続対応のため Google スプレッドシートに保存される状態を理想仕様とする。確認者は通知メール内の確認アプリURLから、投稿内容、添付画像、対応ステータスを1画面で確認する。返信導線は `customer@speed-ad.com` を正とし、From に使えない所有者環境では Reply-To で担保する。

本仕様は、現行実装の `/contact/` 統合後の仕様整理を目的とする。旧 `/bug-report/` は互換 URL として `/contact/` へ転送する。

## 2. 現行実装

- 実体ページは `05_support/contact/index.html`。
- 旧 `05_support/bug-report/index.html` は `/contact/` へ転送する。
- フォームUIは `05_support/contact/index.html`、送信処理は `05_support/assets/js/contact-form.js` に分離する。
- 送信先は専用 Google Apps Script Web App とし、既存の E2E/不具合報告DB用GASは流用しない。
- 送信先URL未設定時は成功扱いにせず、設定未完了のエラーを表示する。
- 添付画像はフロントエンドでWEBPへ変換してから送信する。
- 確認者向け画面は公開投稿GASと分離した専用 Google Apps Script Web App とする。短期運用では閲覧者ごとのOAuth承認ループを避けるため、GASはデプロイユーザー権限で実行し、通知URL内の確認用トークンで表示を制御する。

## 3. 理想仕様

### 3.1 画面と導線

- 正式 URL: `https://support.speed-ad.com/contact/`
- 互換 URL: `https://support.speed-ad.com/bug-report/`
- ヘッダー、フッター、ヘルプ、FAQ、料金プラン、お知らせ本文からの問い合わせ導線は `/contact/` に統一する。
- `/bug-report/` への既存リンクは当面維持可能だが、ページ到達時は `/contact/` へ転送する。

### 3.2 入力項目

| 項目 | 必須 | 内容 |
| --- | --- | --- |
| 問い合わせ種別 | 必須 | `general`, `bug`, `billing`, `plan`, `feature`, `other` のいずれか。 |
| お名前 | 任意 | 投稿者名。未入力でも送信可能。 |
| メールアドレス | 必須 | 受付メール送信先。形式検証を行う。 |
| 件名 | 任意 | 未入力時は `お問い合わせ` として扱う。 |
| お問い合わせ内容 | 必須 | 本文。前後空白を除いた空文字は不可。 |
| 添付ファイル | 任意 | PNG / JPG / WEBP を複数添付可能。送信前にWEBPへ変換し、上限は環境変数 `SUPPORT_CONTACT_MAX_ATTACHMENT_MB` を基準にする。 |
| 個人情報取扱い同意 | 必須 | `/privacy/` を確認した同意チェック。 |

### 3.3 送信フロー

1. フロントエンドで必須項目とメール形式を検証する。
2. 添付画像をブラウザ側でWEBPへ変換し、WEBPの base64 と元画像メタ情報を `text/plain;charset=utf-8` の JSON として専用GASへ送信する。
3. GAS側でも同じ入力検証を行う。
4. 添付画像がある場合は Drive フォルダへ保存する。
5. 投稿内容を `contact_submissions` シートへ記録する。
6. `CONTACT_FROM_EMAIL` を From にできるか確認し、使えない場合はGAS実行ユーザーから送信して Reply-To を `CONTACT_REPLY_TO_EMAIL` にする。
7. `SUPPORT_CONTACT_NOTIFY_EMAIL` へ社内通知メールを送信する。早期検知を優先し、社内通知は投稿者向け受付メールより先に送る。通知の主導線は確認アプリの詳細URLとする。
8. 投稿者へ受付メールを送信する。
9. 保存、社内通知、投稿者向けメール送信が成功した場合に、完了画面を表示する。

保存失敗時はメール送信せず、送信成功扱いにしない。`CONTACT_FROM_EMAIL` を From にできない場合でも送信は継続し、`CONTACT_REPLY_TO_EMAIL` を返信先として設定する。

### 3.4 API

```http
POST <SUPPORT_CONTACT_GAS_WEB_APP_URL>
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

## 4. メール仕様

### 4.0 メール基盤方針

- `customer@speed-ad.com` は Google Workspace 上に存在するユーザーを正とし、問い合わせの受信・返信・フォーム通知に使用する。
- `info@speed-ad.com` は既存サービスの自動配信用送信元として扱い、問い合わせフォーム用途とは分離する。
- Xserver は既存自動配信の SMTP 用途として残し、`customer@speed-ad.com` の受信先としては使わない。
- `speed-ad.com` の MX は Google Workspace に向ける。Xserver 側で受信を残す宛先は現時点では想定しない。
- SPF は Google Workspace と Xserver の両方の送信元を許可する。Google Workspace 側の DKIM を追加し、DMARC はまず `p=none` で開始して配送結果を確認する。

### 4.1 投稿者向け受付メール

- From: `CONTACT_FROM_EMAIL`。GAS実行ユーザーまたはGmail aliasとして利用できない場合はGAS実行ユーザー。
- To: 投稿者が入力したメールアドレス
- Reply-To: `customer@speed-ad.com`
- 件名: `【SPEED AD】お問い合わせを受け付けました`
- 本文: 受付完了、返信目安、投稿内容の控えを含める。
- Reply-To は `CONTACT_REPLY_TO_EMAIL` を使い、標準値は `customer@speed-ad.com` とする。

### 4.2 社内通知メール

- From: `CONTACT_FROM_EMAIL`。GAS実行ユーザーまたはGmail aliasとして利用できない場合はGAS実行ユーザー。
- To: `SUPPORT_CONTACT_NOTIFY_EMAIL`。カンマ、セミコロン、改行区切りで複数宛先を指定可能。
- Reply-To: 投稿者が入力したメールアドレス
- 件名: `【SPEED AD】お問い合わせ: [{問い合わせ種別}] {件名}`
- 本文: 確認アプリ詳細URL、投稿内容、投稿日時、投稿者メールアドレス、保存先行 ID を含める。確認アプリ詳細URLには `id` と確認用 `token` を付与する。Spreadsheet URL と該当行リンクは予備情報とし、通常確認は確認アプリ上で完結させる。

## 5. 投稿内容の保存仕様

保存先は Google スプレッドシートを第一候補とする。添付ファイル本体はスプレッドシートへ直接保存せず、Drive、S3、または同等のファイル保存先に置き、シートには参照 URL またはファイル ID を保存する。添付ファイルはWEBP保存を標準とし、元ファイル名、元MIME、元サイズはDriveファイル説明など確認アプリが参照できるメタ情報として保持する。

推奨カラム:

| カラム | 内容 |
| --- | --- |
| submission_id | 投稿ごとの一意 ID |
| submitted_at | サーバー受信日時 |
| contact_type | 問い合わせ種別 |
| name | お名前 |
| email | メールアドレス |
| subject | 件名 |
| message | お問い合わせ内容 |
| attachment_count | 添付数 |
| attachment_refs | 添付ファイルの参照 URL または ID |
| user_agent | 投稿時のブラウザ情報 |
| source_url | 投稿元 URL |
| storage_status | 保存結果 |
| mail_status | メール送信結果 |
| handled_status | 未対応、対応中、対応済み等の運用ステータス |
| handled_by | 最終更新者メールアドレス |
| handled_at | 最終更新日時 |
| internal_note | 確認者向け内部メモ |

## 6. 環境変数

ローカル検証用の秘密情報は `.env` に保存する。`.env` は Git 追跡対象外とする。共有可能なキー名は `.env.example` に記載する。

必須予定の主な環境変数:

- `SUPPORT_CONTACT_GAS_WEB_APP_URL`
- `SUPPORT_CONTACT_SPREADSHEET_ID`
- `SUPPORT_CONTACT_DRIVE_FOLDER_ID`
- `SUPPORT_CONTACT_FROM_EMAIL`
- `SUPPORT_CONTACT_REPLY_TO_EMAIL`
- `SUPPORT_CONTACT_NOTIFY_EMAIL`
- `SUPPORT_CONTACT_SUBMISSIONS_SHEET_NAME`
- `SUPPORT_CONTACT_MAX_ATTACHMENT_MB`
- `SUPPORT_CONTACT_WEBP_QUALITY`

GAS側 Script Properties:

- `SPREADSHEET_ID`
- `DRIVE_FOLDER_ID`
- `CONTACT_FROM_EMAIL`
- `CONTACT_REPLY_TO_EMAIL`
- `CONTACT_NOTIFY_EMAIL`
- `CONTACT_SHEET_NAME`
- `CONTACT_MAX_ATTACHMENT_MB`
- `CONTACT_VIEWER_BASE_URL`
- `CONTACT_VIEWER_ACCESS_TOKEN`

確認者GAS側 Script Properties:

- `SPREADSHEET_ID`
- `DRIVE_FOLDER_ID`
- `CONTACT_SHEET_NAME`
- `CONTACT_VIEWER_EMAILS`
- `CONTACT_VIEWER_ACCESS_TOKEN`

## 7. `customer@speed-ad.com` 受信・送信確認

`customer@speed-ad.com` は Google Workspace 上に存在するユーザーを正とする。2026-06-14 時点で、DNS 設定と実メール疎通は以下の状態とする。

| 確認項目 | 状態 |
| --- | --- |
| Google Workspace DKIM レコード生成 | 完了 |
| Google Workspace DKIM 認証開始 | 完了 |
| Route 53 Hosted Zone 確認 | 完了 |
| MX: `speed-ad.com` -> `1 smtp.google.com` | 追加済み、外部DNS反映済み |
| Google DKIM TXT: `google._domainkey.speed-ad.com` | 追加済み、外部DNS反映済み |
| SPF | Google Workspace と Xserver を含む既存設定を維持 |
| Xserver DKIM: `default._domainkey.speed-ad.com` | 維持 |
| DMARC | 未追加。SPF/DKIM結果確認後に `p=none` から開始を検討 |
| 外部アドレスから `customer@speed-ad.com` への受信 | 完了 |
| `customer@speed-ad.com` から外部アドレスへの返信 | 完了 |

フォーム本番化前に残る確認:

- Google Workspace 管理画面上で DKIM 認証が完了していること。
- 実メールヘッダーで SPF、DKIM、DMARC の結果を確認すること。
- `customer@speed-ad.com` を From にできない場合でも、Reply-To が `customer@speed-ad.com` になっていること。
- `info@speed-ad.com` の既存自動配信が Xserver SMTP 経由で継続できること。

## 8. セキュリティと個人情報

- フロントエンド検証だけに依存せず、サーバー側で必須項目、文字数、添付種別、添付サイズを検証する。
- 投稿 API は HTTPS のみ許可する。
- bot 対策として reCAPTCHA v3 または同等の仕組みを検討する。
- 添付ファイルは公開 URL にしない。必要に応じて権限付き URL または期限付き URL を使う。
- スプレッドシートと添付保存先の閲覧権限は最小限にする。
- 確認アプリは短期運用では通知URLの確認用トークンで問い合わせ情報を表示する。中期的には `abroad-o.com` 所有のGASへ移行し、Google アカウント単位の許可リスト制御へ戻す。
- `/privacy/` への同意文言または個人情報取扱いへのリンクをフォーム内に表示する。

## 9. 未確定事項

- bot 対策の採用方式。
- `SUPPORT_CONTACT_GAS_WEB_APP_URL` の本番反映方法。
- 確認アプリURLの社内ブックマーク、通知先メールでの案内方法。

## 10. 完成までのロードマップ

| 順番 | フェーズ | 完了条件 |
| ---: | --- | --- |
| 1 | 保存先初期化 | 既存保存先を使う場合は Spreadsheet ID / Drive Folder ID を設定する。未設定の場合は `initializeContactStorage` でGAS実行ユーザーのDriveに作成する。 |
| 2 | 保存先ID確認 | `SPREADSHEET_ID` と `DRIVE_FOLDER_ID` が Script Properties に保存されている。 |
| 3 | GAS Script Properties 設定 | `SPREADSHEET_ID`、`DRIVE_FOLDER_ID`、`CONTACT_FROM_EMAIL`、`CONTACT_NOTIFY_EMAIL` などを設定する。`CONTACT_NOTIFY_EMAIL` は複数宛先を区切り文字付きで指定できる。 |
| 4 | GAS 初期化 | Apps Script エディタで `initializeContactSheet` を実行し、ヘッダー行が作成される。 |
| 5 | GAS 設定確認 | `checkContactConfiguration` が `ok: true` を返す。 |
| 6 | Web App デプロイ | 専用GASの Web App URL を発行する。 |
| 7 | フォーム接続 | `/contact/` の送信先に Web App URL を反映する。 |
| 8 | E2E確認 | Sheet保存、Drive保存、社内通知、投稿者メール、From/Reply-To条件を確認する。社内通知には確認アプリ詳細URLが含まれることを確認する。 |
| 9 | 導線確認 | `/bug-report/`、`/help/`、`/faq/`、`/plans/`、`/news/` から `/contact/` に到達できる。 |
| 10 | 確認アプリ配備 | 確認者専用GASを配備し、許可ユーザーで一覧、詳細、添付プレビュー、対応ステータス更新を確認する。 |
| 11 | WEBP確認 | PNG/JPG添付がWEBPとしてDrive保存され、元画像メタ情報も確認アプリで参照できる。 |
| 12 | 本番反映 | サポートサイトへ反映し、キャッシュ無効化後に本番でテスト投稿する。 |
| 13 | 運用確認 | 初回投稿のメール到達、迷惑メール判定、確認アプリでの対応ステータス運用を確認する。 |

2026-06-15 時点の進行状態:

- 1〜7 は完了。専用GAS、Spreadsheet、Drive フォルダ、Web App URL を作成し、`/contact/` の送信先へ反映済み。
- `checkContactConfiguration` は `ok: true`、From条件は所有者移行時に `primary` / `alias` / `unavailable` のいずれでも送信継続可能。
- Web App URL への `submitContact` テスト投稿で `storageStatus=stored` / `mailStatus=sent` を確認済み。
- ローカルHTTP環境の `/05_support/contact/` から画面送信し、完了パネル表示まで確認済み。
- 添付画像ありの `submitContact` テスト投稿で `storageStatus=stored` / `mailStatus=sent` を確認済み。
- 残タスクは、本番反映後の実導線確認、DKIM完了・メールヘッダー確認、DMARC `p=none` 追加判断、初回実運用投稿の迷惑メール判定確認。
