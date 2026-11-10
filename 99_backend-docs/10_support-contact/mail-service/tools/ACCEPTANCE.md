# 全件受入の独立照合

`verifyMailAcceptance.mjs` は、正本Sheet・同期と独立したGmail列挙・Firestoreの3sourceを照合する。Sheetは専用画面が前後に出力した `{manifest,receipt}` のJSONファイルをそのまま渡す。CLIはreceiptの件数・二重読取り・前後catalogDigest一致を検査し、manifestだけの入力を拒否する。本文・件名・宛先・添付名・添付本体を入力しない。IDは実行ごとの32byte以上の乱数keyを使い、`hashAcceptanceId(kind, value, key)` のHMAC-SHA256へ変換する。keyはmanifestやログへ書かず、全sourceに同じkeyを使う。`hashKeyId` はkey bytesのSHA-256。hashも匿名情報とは扱わず、アクセス制限された一時フォルダで扱い、照合後に削除する。

## 実行と判定

```sh
node tools/verifyMailAcceptance.mjs --sheet PRIVATE/sheet-before.json --gmail PRIVATE/gmail.json --app PRIVATE/app.json --sheet-after PRIVATE/sheet-after.json
```

標準出力は件数と固定エラーコードだけ。終了codeは技術残件なしが0、照合不一致・残件ありが1、引数・JSON・ファイル読取不正が2。Sheetは1件以上を必須とし、Sheet前・Gmail・App・Sheet後の取得時刻は厳密に昇順でなければ不合格にする。同じSheetファイルやコピーを前後に渡しても合格しない。`idReconciliationPass` はID集合・source完全性・案件状態の一致、`technicalReady` はさらに本文・添付・初回確認・照合残件なしを表す。`businessAcceptance` は常に `unverified`。入力の真正性、内容の目視確認、フォーム添付への到達、別利用者の確認記録読戻しはこのCLIだけでは証明しない。

## manifest version 1

全sourceの共通キーは以下だけとする。余分なキーを含むデータは受入不可。

- `schemaVersion: 1`、`source: sheet|gmail|app`、`runId`（英数字・`.`・`_`・`-`、80字以内）、`hashKeyId`（64桁hex）。
- `startAt`、`cutoffAt`、`capturedAt` はミリ秒付きUTC ISO日時。期間は両端を含み、captureはcutoff以降。全manifestでrunId・key・期間が同じでなければ失敗する。capturedAtはSheet-before < Gmail < app < Sheet-afterとし、前後Sheetの受付日時・状態・終了日時を含む全行が同じであること。
- `sourceComplete` はtrue、`errors` は空配列であること。失敗時は内容を含まない大文字コードを保存する。
- `pages`: `{index, requestTokenHash, nextTokenHash, rowCount}` 配列。先頭requestと末尾nextはnull、中間は同じkeyによるpage token hashで連結し、indexは0始まり連続。循環・未終了・件数不一致を拒否する。ページなしは空結果と扱わない。正常な0件はrowCount 0の1ページとする。
- `rows` は最大100,000件。Set化前に全行の重複を検出する。

Sheet行は `{caseHash, submittedAt, handledStatus, closedAt}`。正本の全非空受付IDを対象にし、受付日時の欠落・不正・宣言期間外を拒否する。app catalog行は `{caseHash, handledStatus, closedAt}`。受付ID集合と状態・終了日時の組を比較する。statusは既存4状態、終了日時はnullまたは「対応済み」のUTC ISO日時。

Gmail行は `{messageHash, internalDate, draft}`。列挙は全メールボックス（迷惑メール・ゴミ箱・下書き・期間外を含む）とし、照合器で正確な期間とDRAFT以外へ絞る。同期と同じ検索式を再利用しない。

app行は `{messageHash, internalDate, classification, caseHash, manualExclusion, unavailable, bodyVerified, attachmentCount, attachments, firstReview}`。分類はmatched・pending・excluded。明示的な手動除外だけを対象外として認める。suppression markerだけを到達済みメールへ変換しない。matchedは既知案件・本文取得成功・確認記録・全添付の取得成功が必要。firstReviewはnullまたは `{actorHash, at}`。attachmentsは `{availability, transferVersion, transferSize, servedChunks}` の配列で、名前等を含めない。未観測transfer値はnull/null/[]とする。verified・version1でも512KiB刻みの全offsetが揃わなければ未完了とする（0byte添付もoffset0が必要）。

app固有キーは `catalog`、`syncComplete`、`residualCount`、`noMailConfirmations`。後者は `{caseHash, evidenceHash}` の配列で、関連メールなしを人が正本と照合したprivate記録を参照する。関連メールあり案件への確認・未知案件・重複記録を拒否する。確認根拠がないメールなし案件は残件とする。

## source採取の条件

1. 受入の期間とcutoffを固定し、業務更新・同期・削除と重ならない採取窓を用意する。Sheet-before → Gmail → app → Sheet-afterの順で採る。Sheet採取はそれぞれ全グリッドを2回読み、A/B/N/R列に相当するID・受付日時・状態・終了日時のprojectionが一致した場合だけmanifestを確定する。採取窓の前後Sheetも照合器で比較する。sourceをまたぐ原子的snapshotではなく、変更が観測されない限定された観測窓である。catalogとSheetの内容が変われば新しいrunで採り直す。
2. `captureGmailAcceptance.mjs` は注入したGmail adapterの`getProfile`、検索条件なしの`listAllMessageIds`、本文を返さない`getMessageMetadata`だけを使う。全ID重複なし、全ページ末尾到達、全ID metadata成功、前後profileのhistoryId/messagesTotal不変、列挙実数とmessagesTotal一致を要求する。Gmailの`resultSizeEstimate`は完全性の証拠に使わない。途中失敗・変更・上限到来は失敗として保存し、自動retryしない。
3. Firestoreはread-only transactionの同じsnapshotからcatalog・sync/lease/保守状態・全messages・削除診断・suppressionを読み、ID/doc整合とcatalog完全性を検証する。本文や宛先等はmanifestへ出さず、active lease・purge・同期失敗・未解決診断を残件とする。
4. 採取元・時刻・version/digestと受入担当を既存のprivate記録へ残す。manifest自体は署名付き証拠ではないため、手作りの値から本番PASSを作らない。

## Gmail採取CLI（本番実行前の準備）

`captureGmailAcceptanceCli.mjs` は引数なしで計画だけを表示する。以下の例も `--execute` を付けるまではローカル引数・保存先の検査だけを行い、Google clientの読込み、Secret参照、Gmailアクセス、出力ファイル作成を行わない。

```powershell
node tools/captureGmailAcceptanceCli.mjs --project APPROVED_PROJECT --confirm-project APPROVED_PROJECT --secret-version projects/APPROVED_PROJECT/secrets/EXISTING_SECRET/versions/NUMBER --confirm-mailbox customer@speed-ad.com --run-id ACCEPTANCE_RUN --start-at START_ISO --cutoff-at CUTOFF_ISO --private-dir C:\PRIVATE\ACCEPTANCE_RUN --key-file C:\PRIVATE\ACCEPTANCE_RUN\run.key --out C:\PRIVATE\ACCEPTANCE_RUN\gmail.json
```

対象projectはSecret versionのproject表記と完全一致、versionは正の数値を指定する。Secretのproject ID/number表記を混在させず、既存記録から同じ正本名へ揃える。日時はミリ秒付きUTC ISOで、cutoffは未来にしない。保存先は事前に管理者がアクセスを制限した既存の絶対パスのディレクトリとし、32byteの一時keyファイルと新規JSON出力をその直下へ置く。全sourceで同じkey bytesを使う。app採取も同じ `--private-dir` / `--key-file` 方式とし、Sheetには同じbytesのbase64を渡す。keyをコマンド引数・ログ・共有repoへ渡さない。

実行前にGoogle審査・評価要件と社員全員の人による閲覧条件を解決し、現行の受入照合目的を含む説明version `2026-11-11.6` へ本人が明示同意したSecret versionを用意する。CLIは既存の `createRuntimeGmailAdapter` で同意記録を検証してからOAuth clientを作る。全メールmetadataを1通ずつ読むため、profile件数、Gmail quotaと月額3,000円の予算通知を確認して実行規模を判断する。予算通知は支出停止の上限ではない。上限100,000件、10,000ページを超える場合や途中変更・失敗は未完了とし、黙って省略・自動retryしない。

実採取だけは同じ引数へ `--execute` を追加する。出力はSecret参照前に排他的に新規作成し、既存ファイルを上書きしない。本文や資格情報を表示せず、成功/未完了の固定コード・件数・固定エラーだけを端末へ返す。失敗時に空または不完全な予約ファイルが残ることがある。その内容は受入証拠にならない。管理者が状態を調べ、当該の空・不完全ファイルを明示削除した後に、新しい採取を明示実行する。自動再実行や自動上書きは行わない。

POSIXでは所有者とmode、Windowsでは読み取れたACLの所有者・許可先を検査する。Windowsは現在の利用者、SYSTEM、Administrators以外への許可、解決不能なACLを拒否する。ACLやmodeの検査は管理者・バックアップ・端末侵害まで排除する普遍的な保証ではなく、実行環境で保存先の管理者が確認する。テストは固定ACL例と隔離した合成ファイルを使い、実本番保存先のACL受入を代替しない。

当該受入作業の終了時に、一時keyファイルとSheet/Gmail/appのsource manifestを管理者が削除し、件数・一致判定と内容を含まないdigest等の結果だけを既存記録へ残す。CLIは使用したkey Bufferを終了時にゼロ埋めするが、端末メモリやSSD上の物理消去を保証する機能ではない。共有フォルダや通常のバックアップ対象へ一時key/sourceを置かない。合成manifestのPASS、説明version更新、CLI準備は本番採取・本番受入の完了ではない。
