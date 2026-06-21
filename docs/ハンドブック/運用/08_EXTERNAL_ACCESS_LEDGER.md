---
owner: ops-access
status: draft
last_reviewed: 2026-06-21
---

# 外部環境操作権限台帳

## 1. 目的

SPEED AD の運用面について、`s-umeda@abroad-o.com` が日常確認、編集、デプロイ、ログ確認、障害時の戻しまで単独で実行できる状態を目指す。

ただし、権限は個人直付けを原則にせず、`abroad-o.com` 側の管理グループ、共有ドライブ、専用所有者アカウントを受け皿にする。危険操作も技術的には単独実行可能にするが、実行前後の記録と戻し手順を必須にする。

## 2. 記録禁止情報

以下はこのリポジトリ、チャット、memory に記録しない。

- パスワード、API キー、秘密鍵、OAuth クライアントシークレット
- MFA コード、復旧コード、AuthCode、支払い情報
- サービスアカウントキー本体、SSH 秘密鍵、FTP/SFTP パスワード
- 社内体制や担当者評価など、実装・運用に直結しない private 情報

秘密情報が必要な場合は、private 管理先の参照名だけを記録する。

## 3. 権限設計

### 3.1 Google 系資産の所有境界

- 第一候補は `abroad-o.com` の Google 共有ドライブ配下に、サポート問い合わせ GAS、Spreadsheet、Drive 添付フォルダを集約する。
- 共有ドライブで Apps Script Web App 運用に制約が出る場合は、`speed-ad-ops-owner@abroad-o.com` を専用所有者アカウントにする。
- `s-umeda@abroad-o.com` は日常操作ユーザー、`speed-ad-breakglass@abroad-o.com` は復旧専用アカウントとする。
- `customer@speed-ad.com` 所有の既存 GAS / Spreadsheet は、移行完了まで稼働中の戻し先として保持する。

### 3.2 標準グループ

| グループ | 用途 | 初期メンバー |
| --- | --- | --- |
| `speed-ad-ops-admin@abroad-o.com` | SPEED AD 運用面の全編集、デプロイ、IAM/DNS/AWS本番変更 | `s-umeda@abroad-o.com` |
| `speed-ad-ops-deploy@abroad-o.com` | 将来の追加担当者向け。デプロイ、ログ確認、ロールバック準備 | 未定 |
| `speed-ad-ops-viewer@abroad-o.com` | 監査、確認、レビュー用の閲覧権限 | 未定 |

### 3.3 危険操作の扱い

`s-umeda@abroad-o.com` は以下も単独実行可能にする。ただし、実行前に「対象ID、現状値、変更内容、想定影響、戻し手順」、実行後に「実行ログ、確認結果、戻し可否」を記録する。

- DNS レコード、ネームサーバー、MX、DKIM、DMARC の変更
- AWS IAM、Route 53、CloudFront、S3 公開設定、請求に関わる変更
- Google Cloud IAM、課金、OAuth、公開 API、サービスアカウントキー発行
- 本番サーバーのファイル削除、SSL、メール配送設定、SSH/SFTP認証変更
- Apps Script Web App URL が変わる新規デプロイ

## 4. 現在確認済みの状態

| 環境 | 対象リソース | 所有者境界 | 付与グループ | `s-umeda@abroad-o.com` の操作範囲 | 危険操作 | 戻し手順 | 最終確認日 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Apps Script | サポートお問い合わせ受付 `1qODYRRKo8X2ps9V6TI5Q8RzR-TswCUS7sx8gZYDEpfgaKeqJhHDl10KT` | 現状は `customer@speed-ad.com` 所有 | 未設定 | `clasp list`、`clasp push --force`、バージョン作成、デプロイ一覧確認 | 既存 Web App の更新は所有者ドメイン制約で不可 | 公開デプロイ `AKfycbw6xaQvmfspOOxXEs4DMqfLxQ3Aev6Qi8RcfiFu7iFwOHos48eAPvmmjxSnteN1Lj0D` はバージョン `12`。戻しは直前安定版 `11` へ redeploy する。 | 2026-06-21 |
| Apps Script | サポートお問い合わせ確認アプリ `1tG0AXoDPAG86OurWepwGnZRoZNbplnq_VsiYUINIrv_NbVnMl1Mj7NwW` | 現状は `customer@speed-ad.com` 所有 | 未設定 | 短期運用では通知URLフラグメント内の確認用トークンで一覧、詳細、添付プレビュー、対応ステータス更新が可能。Googleアカウント単位制御は中期対応 | Web App URL変更、確認用トークン変更、Spreadsheet/Drive参照先変更 | 現行デプロイ `AKfycbxz4foQKPlgAeF5ShuM2RBudUpYD8VOvIi7riU1j4QtghnHzvpw9JSKQgfcm61hJKh3` はバージョン `7`。不具合時は公開投稿GASの `CONTACT_VIEWER_BASE_URL` を空に戻し、通知内のSpreadsheetリンクをフォールバックにする。 | 2026-06-21 |
| Spreadsheet | お問い合わせ保存先 `1tv6xEckXPd8bIwbGfE-aJ-XxkIUDreglmcioCpkH-98` | 現状は `customer@speed-ad.com` owner | 個人 writer で暫定付与 | `s-umeda@abroad-o.com` / `t-hayashi@abroad-o.com` は writer。API 読取確認済み | 共有権限変更 | `customer@speed-ad.com` で共有権限を戻す | 2026-06-21 |
| Drive | 添付保存フォルダ `1rcFGJh9l3NwUeYt2MIR8p2A-DVYxxEwY` | 現状は `customer@speed-ad.com` owner | 個人 writer で暫定付与 | `s-umeda@abroad-o.com` / `t-hayashi@abroad-o.com` は writer。Drive UI で付与し API 読取確認済み | 添付削除、共有範囲変更 | フォルダ共有を `customer@speed-ad.com` owner 側で戻す | 2026-06-21 |
| Google Workspace | Groups / Gmail alias / Drive / Apps Script | `abroad-o.com` 管理へ寄せる | `speed-ad-ops-admin` 予定 | 管理コンソール権限は未確認 | ユーザー、グループ、メール認証、Alias 変更 | 管理コンソール監査ログと変更前値で戻す | 未確認 |
| Google Cloud | Apps Script連携、API、ログ、IAM | 対象プロジェクト未特定 | `speed-ad-ops-admin` 予定 | `gcloud auth list` で `s-umeda@abroad-o.com` がアクティブ。`gcloud projects list` は再認証要求で未確認 | IAM、課金、OAuth、API有効化 | 変更前 IAM policy / API 状態へ戻す | 2026-06-21 |
| AWS | support サイト配信、S3、CloudFront、Route 53 | AWS account `816069150667` | `AdministratorAccess` / SSO `s-umeda` | `s-umeda@abroad-o.com` で AWS SSO ログイン、S3 sync、CloudFront invalidation を確認済み。STG distribution `EDJ1GHHD1FP7Q`、prod distribution `E2ESLIURIYZA6G` | IAM、Route 53、CloudFront、S3公開設定、請求 | 変更前ポリシー、DNSレコード、S3/CloudFront設定へ戻す。supportサイト静的配信は直前コミットまたはS3同期元を戻し、CloudFront `/*` invalidation を実行する。 | 2026-06-21 |
| さくらサーバー | corporate site / サーバー公開面 | 契約未確認 | 未設定 | 未確認 | 本番ファイル、SSL、メール、SSH/SFTP | 変更前バックアップから戻す | 未確認 |
| お名前.com | ドメイン/DNS管理 | 対象ドメイン未確認 | 未設定 | 未確認 | DNS/NS変更、更新設定 | 変更前レコード、TTL、NSへ戻す | 未確認 |

補足: Drive 添付保存フォルダは API での権限付与が `appNotAuthorizedToFile` で失敗したため、`customer@speed-ad.com` の Google Drive UI から編集者として共有した。付与後は Drive API の権限一覧読み取りで `s-umeda@abroad-o.com` / `t-hayashi@abroad-o.com` が `writer` であることを確認済み。添付ありテスト投稿 `3d6bd3bc-a065-4908-9f73-b0b048ad0b06` は `storageStatus=stored` / `mailStatus=sent` で成功し、作成ファイル `15eel6WUJZ_p1ESKBRPYskeZOSmVY58ev` でも両名の `writer` 継承を確認した。`s-umeda@abroad-o.com` 指定の Drive プレビューでもアクセス拒否なく表示できることを確認した。

## 5. サポートお問い合わせ移行手順

### 5.1 現行維持手順

現行の公開 Web App は以下で維持する。

```powershell
cd "C:\SharedFolder\WorkSpace\00.NewTopics\03_自社サービス・アプリ開発\01_SPEED_AD_Project\00_dev_speed_ad_user\99_backend-docs\10_support-contact\gas"
npx --yes @google/clasp -u customer redeploy AKfycbw6xaQvmfspOOxXEs4DMqfLxQ3Aev6Qi8RcfiFu7iFwOHos48eAPvmmjxSnteN1Lj0D --versionNumber 12 --description "support contact viewer fragment token links"
```

Script Properties:

```text
CONTACT_NOTIFY_EMAIL=customer@speed-ad.com,s-umeda@abroad-o.com,t-hayashi@abroad-o.com
CONTACT_VIEWER_BASE_URL=https://script.google.com/macros/s/AKfycbxz4foQKPlgAeF5ShuM2RBudUpYD8VOvIi7riU1j4QtghnHzvpw9JSKQgfcm61hJKh3/exec
CONTACT_VIEWER_ACCESS_TOKEN=<Script Properties only>
```

2026-06-21 実行ログ:

- 確認者GASを新規作成し、Script ID `1tG0AXoDPAG86OurWepwGnZRoZNbplnq_VsiYUINIrv_NbVnMl1Mj7NwW`、Web App デプロイ `AKfycbxz4foQKPlgAeF5ShuM2RBudUpYD8VOvIi7riU1j4QtghnHzvpw9JSKQgfcm61hJKh3`、バージョン `4` で配備した。
- 公開投稿GASは既存デプロイ `AKfycbw6xaQvmfspOOxXEs4DMqfLxQ3Aev6Qi8RcfiFu7iFwOHos48eAPvmmjxSnteN1Lj0D` をバージョン `9` へ redeploy した。
- Script Properties の `CONTACT_NOTIFY_EMAIL` と `CONTACT_VIEWER_BASE_URL` は OAuth 再認証がGoogle側でブロックされたため、最小スコープの一時デプロイで設定後、一時デプロイを削除した。
- 添付ありテスト投稿 `70a13837-4725-4b56-ab5f-22a5135ea3ca` は `storageStatus=stored` / `mailStatus=sent` で成功した。Drive保存ファイル `1tAxw8xgyF5mvt762VMd3fHcpYTBnAUjh` は MIME `image/webp`。
- `s-umeda@abroad-o.com` のGmailで社内通知を確認し、To に `customer@speed-ad.com` / `s-umeda@abroad-o.com` / `t-hayashi@abroad-o.com`、本文に確認アプリ詳細URLが含まれることを確認した。
- 確認アプリの短期認証方式として `CONTACT_VIEWER_ACCESS_TOKEN` を確認者GASと公開投稿GASの Script Properties に設定した。実値はrepoと台帳には記録しない。
- 確認者GASの既存デプロイ `AKfycbxz4foQKPlgAeF5ShuM2RBudUpYD8VOvIi7riU1j4QtghnHzvpw9JSKQgfcm61hJKh3` をバージョン `6` (`support contact viewer token access`) へ redeploy した。
- 公開投稿GASの既存デプロイ `AKfycbw6xaQvmfspOOxXEs4DMqfLxQ3Aev6Qi8RcfiFu7iFwOHos48eAPvmmjxSnteN1Lj0D` をバージョン `11` (`support contact viewer token links`) へ redeploy した。
- トークンなしの確認アプリURLは Google 認証へリダイレクトせず、アプリ内で無効URLとして表示されることを確認した。
- 短期認証方式反映後のテスト投稿 `93f9c46a-b306-4238-b14b-5169811b58f4` は `storageStatus=stored` / `mailStatus=sent` で成功した。
- 確認アプリの既存デプロイ `AKfycbxz4foQKPlgAeF5ShuM2RBudUpYD8VOvIi7riU1j4QtghnHzvpw9JSKQgfcm61hJKh3` をバージョン `7` (`support contact viewer fragment token`) へ redeploy した。
- 公開投稿GASの既存デプロイ `AKfycbw6xaQvmfspOOxXEs4DMqfLxQ3Aev6Qi8RcfiFu7iFwOHos48eAPvmmjxSnteN1Lj0D` をバージョン `12` (`support contact viewer fragment token links`) へ redeploy した。
- 確認アプリ公開HTMLに `location.hash` 読み取りが反映され、`?token=` ではなく `#token=` を使う構成であることを確認した。
- URLフラグメント方式反映後のテスト投稿 `51cbb89e-b7e8-42ea-8890-0b4ce7645474` は `storageStatus=stored` / `mailStatus=sent` で成功した。
- AWS SSO profile `speed-ad` を `s-umeda` / account `816069150667` / `AdministratorAccess` として再認証した。
- STG supportサイトを `s3://stg.support.speed-ad.com/` へ同期し、CloudFront `EDJ1GHHD1FP7Q` の invalidation `IAB5IWMWX11Z8NUFGB23APVZCS` を完了した。`https://stg.support.speed-ad.com/contact/` は 200、WEBP版JSと `data-webp-quality="0.82"` を確認済み。
- 本番 supportサイトを `s3://support.speed-ad.com/` へ同期し、CloudFront `E2ESLIURIYZA6G` の invalidation `I5RY8OBBI0T0EAQGNN6DVJGDD2` を完了した。`https://support.speed-ad.com/contact/` は 200、WEBP版JSと `data-webp-quality="0.82"` を確認済み。
- STG / 本番とも、画面上でPNG添付が `*.png → *.webp` と表示されること、ブラウザコンソールエラーがないことを確認した。

### 5.2 `abroad-o.com` 側への移行手順

1. `abroad-o.com` 管理者で `speed-ad-ops-admin`、`speed-ad-ops-deploy`、`speed-ad-ops-viewer` を作成する。
2. `speed-ad-ops-admin` に `s-umeda@abroad-o.com` を追加する。
3. `abroad-o.com` の共有ドライブまたは `speed-ad-ops-owner@abroad-o.com` で、GAS、Spreadsheet、添付フォルダを新規作成または複製する。
4. 新GASの Script Properties に `SPREADSHEET_ID`、`DRIVE_FOLDER_ID`、`CONTACT_REPLY_TO_EMAIL=customer@speed-ad.com`、`CONTACT_NOTIFY_EMAIL` を設定する。
5. 新GASを Web App として公開し、テスト投稿で `storageStatus=stored` / `mailStatus=sent` を確認する。
6. Supportサイトの `/contact/` の Web App URL を新URLに差し替える。
7. STG でフォーム送信、Spreadsheet保存、Drive添付保存、社内通知、投稿者メールを確認する。
8. prod 反映後、旧Web App URLとバージョン `6` を戻し先として保持する。

### 5.3 From / Reply-To 方針

- `CONTACT_FROM_EMAIL` が実行ユーザー本人または Gmail alias の場合は、そのアドレスを From にする。
- From として使えない場合も送信は止めず、GAS実行ユーザーから送信し、`CONTACT_REPLY_TO_EMAIL` を Reply-To にする。
- 返信導線は `customer@speed-ad.com` を正とする。

## 6. 実行ログテンプレート

危険操作または所有境界変更を行う場合は、以下を作業ログに残す。

| 項目 | 記録内容 |
| --- | --- |
| 実行日時 | JST |
| 実行者 | `s-umeda@abroad-o.com` など |
| 環境 | Google Workspace / GCP / AWS / Sakura / onamae.com |
| 対象ID | プロジェクトID、AWSアカウント、ドメイン、Spreadsheet ID など |
| 変更前 | 現状値、権限、設定 |
| 変更内容 | 追加/削除/更新した権限や設定 |
| 想定影響 | なし / 低 / 中 / 高 |
| 戻し手順 | 具体的なロールバック手順 |
| 実行ログ | コマンド、画面操作、監査ログ参照 |
| 確認結果 | 成功/失敗、確認URL、テスト結果 |

## 7. 確認チェックリスト

- `s-umeda@abroad-o.com` で GAS 編集、バージョン作成、Web App デプロイができる。
- `s-umeda@abroad-o.com` で Spreadsheet と Drive 添付フォルダを編集できる。
- `/contact/` から投稿し、Sheet保存、Drive添付保存、複数通知、該当行リンク、受付メールが通る。
- `s-umeda@abroad-o.com` で Google Cloud ログ、API、IAM、課金状態を確認できる。
- `s-umeda@abroad-o.com` で AWS SSO ログイン、S3 deploy dry-run、CloudFront invalidation dry-run または小さな無害操作ができる。
- DNS、Sakura、メール認証の現状値と戻し手順が記録されている。

## 8. 関連文書

- `docs/ハンドブック/デプロイ/05_DEPLOYMENT.md`
- `docs/画面設計/仕様/23_support_contact_form_requirements.md`
- `99_backend-docs/10_support-contact/gas/README.md`
- `docs/リファレンス/共有規約/02_SHARED_DOC_BOUNDARY_RULES.md`
- `docs/リファレンス/共有規約/04_AI_RESPONSIBILITY_BOUNDARY.md`
