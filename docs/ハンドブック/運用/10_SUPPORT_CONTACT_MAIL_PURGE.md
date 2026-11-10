---
owner: shared-docs
status: prepared-not-executed
last_reviewed: 2026-11-11
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

案件参照を含む履歴や他メールと共有する記録を持つ期限切れ除外メールは、関連記録とともに保持して `unsafeExclusionCount` に数えます。他の安全な期限切れ除外メールの処理は進め、保持した残件は個別に照合します。

削除する返信が保持中の親メールを参照するだけなら、返信側の照合根拠・確認記録を削除し、親メールは保持します。保持する別メールから削除候補への参照がある場合は、削除候補も残件として保持します。

```powershell
node tools/purgeMailMetadata.mjs --project '<approved-project>' --confirm-project '<same-project>' --database '(default)' --expired-exclusions --request-reference '<verified-retention-operation>'
```

適用は同じく `--apply --plan-hash '<returned-hash>'` を必要とします。期限はUTCの暦年で3年加算し、2月29日は3年後の2月28日同時刻とします。

## 本番受入に残る確認

実Firestoreでdry-run無変更、途中失敗後の再開、全関連collection、削除後の同期と別利用者の遅延応答を確認します。新しい無人削除スケジュールは作成しません。

## Gmail原本がなくなったメールIDマーカーの整理

`tools/cleanupMailMarkers.mjs` は管理者の明示操作で、`suppressedMessages` の最小hashだけを整理します。一般利用者のRPCには公開しません。実行には承認済みFirestoreの管理用ADCと、窓口Gmailの読取専用Secretの特定versionが必要です。案件hashと旧要求hashの整理はこの処理に含めません。

現在の期間に見つからないだけでは、将来の期間拡大で再取込する恐れがあります。この実装は期間・ラベルで絞らず、下書き・Spam・Trashを含むGmail全体のIDを全ページ列挙し、原本が不在のときだけ候補にします。**Gmailに原本がある間は、同期対象期間外でも最小hashを保持します。** 原本の本文・件名・アドレスは取得しません。期間外・下書き等を含むIDの列挙と、一時hash集合のFirestore保存は認可時の同意説明に含めます。旧版の同意記録しかないSecretでは整理を開始できません。[Gmail一覧API](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list)

計画は最大250マーカーを文書ID順に読み、同期完了状態と期間・処理済み履歴ID・保存世代を固定します。Gmail profileの履歴IDが処理済み位置と一致しない場合は、マーカーを保持して停止します。cancelで保守を解除し、通常同期で削除履歴まで処理してから新しい計画を作ります。出力は件数・計画hash・次のhash cursor・走査上限だけです。

```powershell
node tools/cleanupMailMarkers.mjs --project '<approved-project>' --confirm-project '<same-project>' --database '(default)' --request-reference '<verified-operation>' --operation plan
```

返された計画hashを確認後、同じ指定に `--operation advance --plan-hash '<returned-hash>' --secret-version '<approved-canonical-numeric-version>'` を指定します。1回につきGmail IDを50件まで読み、IDは直ちにhash比較して破棄します。元IDは一時計画にも保存せず、全IDの重複検査に必要なhash集合だけを一時保存します。`enumerating` の間は同じ操作を明示して進めます。全ページ完了、ID重複なし、unique件数とprofileの `messagesTotal` の完全一致、開始・完了profileの履歴IDと件数の一致を確認した場合だけ `ready` と `deletionHash` を返します。欠落・不正な応答は空一覧に変換しません。profileが0件と示す空メールボックスでは、明示的な空配列または `resultSizeEstimate:0` の応答が必要です。推定件数だけを完全性の証拠にしません。[Gmail profile](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users/getProfile)

再開用一時計画をFirestore文書上限内に保つため、Gmail全体で **10,000 ID・1,000ページ** が上限です。上限超過は `MAIL_MARKER_SCAN_LIMIT` で停止し、全件不在の証明や整理成功とは扱いません。未削除マーカーは保持します。この上限を超える本番メールボックスでは、別の一時hash保管と清掃工程を実装・検証してから整理します。

`ready` の件数を確認後、`--operation apply --plan-hash '<same-plan-hash>' --deletion-hash '<returned-deletion-hash>' --secret-version '<same-version>'` を指定します。1回25マーカーまで、現在のGmail履歴ID・全件数・同期処理済み位置・保存世代・計画を再照合して削除します。`deleting` は同じ操作で再開し、`complete` で一時計画を消して保守を解除します。次のhash cursorがある場合は、別の依頼番号で `--after-marker '<nextMarker>'` を付けたplanから次の250個を処理します。advanceの初回にも同じcursorを付けます。

処理中は既存の保守gateでメール閲覧・確認・同期・別の削除を止め、古い世代の要求を無効にします。API失敗・ページ不正・履歴ID変更・同期状態変更では未削除マーカーを保持して停止します。`--operation status --plan-hash '<same-plan-hash>'` はGmailを取得せず進捗を読みます。処理を取りやめる場合は `--operation cancel --plan-hash '<same-plan-hash>'` で残りを保持して保守を解除し、新しいdry-runから再列挙します。最終応答不明でstatusがidleでも完了の証明にはせず、記録と新しいdry-runを照合します。自動再送・自動scheduleはありません。

合成試験は完全列挙、不安定な履歴、途中失敗、重複ページ、同時進行、25件境界の再開、250個を超えるcursor到達を扱います。実Gmail/Firestoreの全ページ・権限・保守解除・削除後の同期と、この保守的な保持条件は実データ受入前に別途確認します。
