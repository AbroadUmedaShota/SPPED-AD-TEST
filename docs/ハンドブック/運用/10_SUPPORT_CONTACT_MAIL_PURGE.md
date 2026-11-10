---
owner: shared-docs
status: prepared-not-executed
last_reviewed: 2026-11-10
---

# お問い合わせメール記録の手動削除

保存方針は案件終了後3年、案件へ結び付けず除外したメールは除外確定後3年です。個別削除の依頼窓口は認可時に表示した管理連絡先です。対象はFirestoreのメール由来記録です。Gmail原本、受付Sheet、Drive添付の削除は別に判断します。

## 実行条件

管理者は対象project、database `(default)`、案件ID、確認済み依頼番号を照合します。CLIはApplication Default Credentialsを使います。一般利用者向け削除RPCは公開しません。

通常の案件削除は確認済み個別依頼を明示します。期限削除には `--expired-case` を付け、現在のcatalogにある対応済み・終了日時と3暦年の経過を検査します。事前に正本Sheetのcatalogを更新し、案件状態・終了日時の編集を止めてから計画と適用を行います。終了日不明・再開済みは期限削除を拒否し、計画後のcatalog変更も拒否します。同期中の処理を終え、利用者へ保守時間を案内してから実行します。未解決メールの案件参照、別案件と共有する履歴、未知のcollectionやsubcollectionがあれば削除前に停止します。

## dry-runと適用

`mail-service`で次を実行します。既定はdry-runで、出力は対象・件数・計画hashだけです。件名、アドレス、本文、確認者を出しません。

```powershell
node tools/purgeMailMetadata.mjs --project '<approved-project>' --confirm-project '<same-project>' --database '(default)' --case-id '<verified-case-uuid>' --request-reference '<verified-deletion-request>'
```

計画を確認し、同じ引数へ `--apply --plan-hash '<returned-hash>'` を付けます。記録が変わった計画は拒否します。走査は1collectionあたり10,000文書・合計50MiB、削除は2,000文書・計画500KBまでとし、超える場合は変更前に停止します。

適用中はメール機能全体を保守状態にして保存世代を進めます。旧世代の本文・添付・同期・確認要求は結果を返せず、更新も拒否します。対象メール、関連event・receipt、案件coverage、削除診断、対象IDを含む同期状態を削除します。Sheet由来の案件ID catalogは残し、削除済み案件を照合先から外します。

GmailメールIDと案件IDをSHA-256で変換した最小マーカーを保持します。文書IDがhash、値が `{version:1}` で、元ID・件名・宛先・確認者は持ちません。削除receiptの要求IDもhashだけを残して旧要求の再生を拒否します。hashは匿名化の保証ではなく、同じアクセス制御下の再取込防止情報です。RFC Message-ID・スレッドIDのマーカーは保持しません。

同じGmail IDはfull/history同期・下書き・削除診断から復元されません。新しい返信は照合待ちになり得ますが、削除済み案件への自動・手動紐付けは拒否します。照合待ちは全件受入の残件です。

途中失敗は保守状態と内部計画を残します。削除前の再照合中と、再照合を完了して削除を開始できる状態を区別して保存します。同じ依頼番号・案件ID・計画hashで再開し、未検証なら再照合を行い、削除開始後は保存済み進捗から残りを処理します。25件ごとの削除と進捗更新は、同じ保守世代・計画・文書内容を確認するトランザクションで行います。完了時に一時計画を消して保守状態を解除します。

再開済み案件や検証エラーで削除前に停止した場合、同じ引数の `--apply` を `--cancel-unvalidated` に置き換え、同じ `--plan-hash` で未検証計画を破棄できます。この操作は検証前・進捗0かつ全対象文書が残っている場合だけ保守状態を解除し、文書は削除しません。検証済み・削除開始後の計画は取消しを拒否するため、同じ計画で再開します。別計画への切替や保守状態の手動解除は行いません。

## 案件の保存期限

上の案件ID付きdry-runへ `--expired-case` を追加します。適用時も同じ指定と計画hashを使います。完了後は最小の案件hashを削除済みの証拠として使い、期限残件・関連メール未照合の件数から外します。案件画面にはメール記録が削除済みと表示します。

## 除外メール

人が除外を確定した時刻 `excludedAt` をサーバーで記録します。旧記録の空欄は推定せず、削除対象から外して `unknownExclusionCount` に表示します。下書きの自動除外は対象外です。

```powershell
node tools/purgeMailMetadata.mjs --project '<approved-project>' --confirm-project '<same-project>' --database '(default)' --expired-exclusions --request-reference '<verified-retention-operation>'
```

適用は同じく `--apply --plan-hash '<returned-hash>'` を必要とします。期限はUTCの暦年で3年加算し、2月29日は3年後の2月28日同時刻とします。

## 本番受入に残る確認

実Firestoreでdry-run無変更、途中失敗後の再開、全関連collection、削除後の同期と別利用者の遅延応答を確認します。完全な同期列挙から原本が対象外になったと証明して最小マーカーを整理する運用が必要です。新しい無人削除スケジュールは作成しません。
