---
owner: shared-docs
status: prepared-not-executed
last_reviewed: 2026-11-10
---

# お問い合わせメール連携のデータ管理・削除

公式窓口の所有者とアプリ利用者向けの案内です。**Gmail由来の照合・確認記録は案件終了後3年間保存する方針です。** 削除申請先は運用記録で決定したメールアドレスを認可時に表示します。現実装に自動期限削除や利用者自身の削除画面はありません。期限削除の手段・実行担当・確認方法まで用意してから本番認可します。

## 読取りと共有

SPEED AD お問い合わせ確認アプリは `customer@speed-ad.com` に `https://www.googleapis.com/auth/gmail.readonly` を要求します。対象期間の送受信メールを問い合わせ案件と照合し、本文・添付・確認記録をアプリ内で確認する用途です。この権限はメールの送信・変更・削除を許しません。判断できないメールは照合待ちとして扱います。

アプリの認証を通った `abroad-o.com` の社員と公式窓口の利用者が、案件メール・照合待ち・確認記録を閲覧します。処理と保存にはGoogle Cloudを使います。Google Workspaceから得た情報の利用は、[Google User Data Policy](https://developers.google.com/terms/api-services-user-data-policy)のLimited Use要件に従います。広告、販売、一般的なAIモデルの学習には利用しません。

| データ | 保存・処理先 |
| --- | --- |
| 件名、差出人・宛先、日時、メール/スレッドID、添付メタデータ、案件との照合、最初の確認者・日時、同期位置、監査・処理記録 | Firestoreの専用メール領域 |
| メール本文・添付本体 | Gmailから取得し、サーバーの一時メモリと利用者画面で処理。Firestoreへ保存しない。利用者が保存したファイルは利用者側の管理対象 |
| 継続読取り用のOAuth資格情報 | Secret Managerの特定version。利用者画面やログへ渡さない |
| フォーム受付本文・フォーム添付・対応状態・内部メモ | 既存Sheet/Drive。Gmail連携を止めても残る |

## 認可前の説明

認可補助ツールは「案件終了後3年間」の方針を表示します。その実施方法の説明を `MAIL_DATA_RETENTION_NOTICE`、運用記録で決定した削除申請先メールを `MAIL_DATA_DELETION_CONTACT` としてプロセス環境に渡します。秘密ではありませんが、個人の連絡先や運用判断の実値は共有repoへ保存しません。説明は現実の運用と一致させます。単に設定した文章に自動削除の効力はありません。

両方がない場合、または窓口がメールアドレスでない場合、ツールは認可を開始しません。対話端末で説明全文を表示し、所有者が「同意します」と入力した直後にGoogleの同意画面を開きます。`--execute`やパイプ入力だけでは同意になりません。Google画面でもアカウントと要求権限を確認してください。

WindowsのPowerShell 7では、`mail-service` ディレクトリから次の補助スクリプトを実行できます。実際の既存Secret名、承認済みの保存期間説明、削除申請先を指定してください。前提はNode.js 24以降、依存パッケージの導入、Secret Managerへの認可済みADCです。

```powershell
pwsh -NoProfile -File ./tools/authorizeMailbox.ps1 -SecretName 'projects/PROJECT_NUMBER/secrets/EXISTING_SECRET' -RetentionNotice '承認済みの保存期間・削除方法の説明' -DeletionContact '承認済みの削除申請先メール'
```

DesktopクライアントのIDとsecretは続けて非表示入力します。コマンド行、入力履歴、設定ファイルへ貼り付けず、Google画面の同意は窓口本人が行います。補助は子Nodeプロセスの環境だけへ認可情報を渡し、終了・起動失敗時に環境の参照と一時変数を片付けます。資格情報を端末ファイルへ保存しませんが、処理中のメモリには必要です。入力したsecretをチャットや実行ログへ転記しないでください。

## アクセスを止める

窓口の所有者は[Googleアカウントの接続管理](https://myaccount.google.com/connections)で、実際に認可したアプリ名を確認してアクセスを取り消せます。Workspace管理者によるアクセス制限も利用できます。取消し後は新しいGmail読取りができなくなりますが、Firestoreの保存済みデータと利用者が保存したファイルは自動で消えません。

アプリ管理者は同期・閲覧を停止し、採用Secret versionの無効化、必要なCloud Run停止を対象と権限を確認して行います。取消しや停止の結果を読み戻すまで、再認可や同期を再開しません。Gmailの元メールはこのアプリから削除できません。

## 保存済みデータの削除を申請する

認可時に表示した削除申請先へ、対象アカウント、案件ID/メールID、対象期間、アプリ側データの削除希望を伝えてください。本文・添付や認可tokenを申請メールへ貼る必要はありません。表示された申請先が分からない場合は、認可を案内した管理者へ確認してください。

管理者は次の順序で対応します。

1. 申請者と対象を確認し、同期・再照合・閲覧による再取得を停止します。保存期間、保持が必要な範囲、削除対象を申請者と確定します。
2. Firestoreの `contactMailboxes/customer-speed-ad` 以下の対象を列挙します。`messages`だけでなく、`events`、`receipts`、`caseCoverage`、`catalogSnapshots`とその`pages`、`deletionDiagnostics`、`meta`の参照・派生データを確認します。親documentだけの削除で子collectionが消えたとは扱いません。
3. 対象だけを削除する操作計画と読戻しを用意し、適用される承認を確認して実行します。全利用終了の場合は資格情報の失効・Secret versionの処理も対象にします。Sheet/DriveやGmailの正本を同時に削除しません。
4. 対象データ・派生参照が残っていないこと、再取得が停止していることを読み戻し、申請者へ結果を伝えます。利用者がダウンロードしたファイルの削除は、その利用者へ依頼します。削除記録に本文・添付・tokenを複製しません。

案件終了日時は第2段階で追加するSheetの `closed_at` を使います。`対応済み` への移行時だけ記録し、同じ状態のメモ編集では維持、再開時には空にします。既存の対応済みで終了日時が不明な行は空のまま保持し、証拠を確認して補完するまで期限削除の対象にしません。`handled_at` は対応状態や内部メモの保存ごとに更新されるため、起算日には使いません。

`closed_at`を更新しない旧版へ巻戻す場合は期限削除を停止し、期間中の状態更新を全件監査します。現行版へ戻した後、影響した終了日時を根拠で再確認するか空にするまで再開しません。監査範囲が不明なら全案件を終了日未確認として扱います。詳細は[巻戻し手順](../デプロイ/10_SUPPORT_CONTACT_MAIL_OPERATIONS.md#7-巻戻し)に従います。

確認済みの個別案件削除と、除外確定後3年を過ぎたメールの削除には[管理者用のdry-run・適用手順](10_SUPPORT_CONTACT_MAIL_PURGE.md)を使います。同じGmailメールIDと削除済み案件IDのhashだけを再取込防止情報として保持し、件名・宛先・確認者は削除します。新しい返信は新しい照合待ちになり得ます。原本が同期対象外になったことを完全な列挙で証明してから、最小マーカーを整理する運用が必要です。


通知と同意の要件は[Google Workspace user data policy](https://developers.google.com/workspace/workspace-api-user-data-developer-policy#transparent-and-accurate-notice-and-control)、Google側の接続解除は[Googleアカウントの接続管理](https://myaccount.google.com/connections)を参照してください。

**本番受入に残る確認:** 正本終了日時の配備後読戻し、旧案件・旧除外の日時不明記録の確認、実Firestoreでの削除後読戻しと、原本が対象外になった後の最小マーカー整理を確認します。利用者がダウンロードしたファイルの管理は別に必要です。
