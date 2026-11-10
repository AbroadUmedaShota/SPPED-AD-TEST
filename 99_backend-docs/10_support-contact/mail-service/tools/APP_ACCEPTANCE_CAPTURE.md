# アプリ記録の受入用採取

`captureAppAcceptance.mjs` は、既存のADCで許可されたFirestoreを読取専用transactionで観測する管理者向けCLIです。通常のアプリ利用者へFirestore権限を追加しません。配備、同期、メール取得、データ変更を行いません。

引数なしでは計画だけを表示します。必要引数を指定しても、`--execute` がなければローカル保存先の検査だけを行い、Firestore clientの読込み・生成、ADC利用、Firestore読取り、出力作成を行いません。実採取はGoogle認可・本番配備・同期の条件を満たした後に、対象project/database、既存の読取権限とprivate保存先を確認して明示実行します。

```powershell
node tools/captureAppAcceptance.mjs --project APPROVED_PROJECT --database '(default)' --run-id ACCEPTANCE_RUN --start-at START_ISO --cutoff-at CUTOFF_ISO --private-dir C:\PRIVATE\ACCEPTANCE_RUN --key-file C:\PRIVATE\ACCEPTANCE_RUN\run.key --out C:\PRIVATE\ACCEPTANCE_RUN\app.json
```

実採取には上の引数へ `--execute` を追加します。`--private-dir` は事前にアクセスを制限した既存の絶対パスのフォルダとし、Gmail採取と同じ32byteの一時キーと、新規JSON出力をその直下へ置きます。環境変数 `MAIL_ACCEPTANCE_HASH_KEY` は使いません。Sheetには同じkey bytesをbase64へ変換して渡し、key自体はmanifest・ログ・リポジトリへ保存しません。`hashKeyId` はkeyのSHA-256、IDは種別名とNULを前置したHMAC-SHA-256です。

Gmail採取と共通の保存先検査で、POSIXの所有者・mode、Windowsの読み取れたACL、symlinkと既存出力を確認します。Windowsは現在の利用者、SYSTEM、Administrators以外への許可や解決不能なACLを拒否します。実行時は出力を排他的に新規作成してからFirestore clientを生成するため、共有先・既存ファイル・フォルダ外への指定ではFirestoreを読みません。成功・接続失敗・証拠不備のいずれでも、使用したkey Bufferを消去してファイルを閉じます。失敗後に空または不完全な予約出力が残ることがあり、管理者が確認して明示削除するまで再実行で上書きしません。端末メモリやSSDの物理消去までは保証しません。

active catalog、catalog snapshot全ページ、sync/lease/purge状態、全message、削除診断と最小マーカーを、同じFirestore読取りsnapshotで採取します。queryの全結果を使い、100件・200件で打ち切りません。transactionや行数上限で取得できなければ未完了です。大きなdatabaseでFirestoreのtransaction制限に到達した場合も、別ページを足して完全と推定せず採取方法を見直します。

件名・本文・送受信者・添付名・添付bytesは出力しません。添付の到達判定に必要な転送状態、最初の確認者のhashと日時だけを投影します。hashもprivate受入記録として扱います。ID不一致、catalogページ欠落・digest不一致、進行中のlease/purge、同期失敗、削除診断、保存期限の未解決を固定エラーコードで残します。抑止マーカーだけでは到達できたメールと扱いません。

`sourceComplete` は採取が検証条件を満たしたことを示します。関連メールなし案件は、アプリ内の明示確認で保存した確認者・日時・対象範囲を、既存の `caseCoverage` から同じread-only transactionで読みます。カタログ・同期実行・期間・履歴位置・分類revision・削除generationが現在と一致し、紐付けメール、照合待ち、失敗、種類不明削除、進行中leaseがない確認だけを `{caseHash,evidenceHash}` へ投影します。evidenceHashは記録全体の固定参照から同じ一時keyで作るHMACです。確認者のメールアドレスや受付IDは出力しません。古い確認は採用せず、不正な確認記録は採取不合格にします。手作りの `--no-mail-confirmations` 入力は受け付けません。

照合後は一時キーとsource manifestを削除し、件数・判定と内容を含まないdigest等を既存記録へ残します。全件照合器の結果、人による内容確認、別利用者による確認記録の読戻しを合わせて本番受入を判定します。このCLIの合成試験は実Firestoreと本番保存先ACLの受入結果ではありません。
