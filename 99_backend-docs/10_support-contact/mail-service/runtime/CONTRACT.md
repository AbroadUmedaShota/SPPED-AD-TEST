# メール連携サービスの実行契約

Node.js 24、Cloud Run、Firestore、Secret Managerを使う。既存GASのSheet/Drive更新APIから独立し、メール取得・照合・確認記録の操作はSheetの対応ステータスを書き換えない。

手動削除は[管理者用手順](../../../../docs/ハンドブック/運用/10_SUPPORT_CONTACT_MAIL_PURGE.md)を使う。削除中は`meta/purgeControl`で全メール操作を停止し、要求開始時の保存世代と応答直前・書込みtransaction内の世代を照合する。途中失敗は同じ計画で再開する。最小hashマーカーで原メールの再取込・削除済み案件への紐付け・旧receipt再生を拒否する。新規返信は新しい照合待ちとして残り得る。手動除外は`excludedAt`をサーバー時刻で記録する。

## 認証

Cloud RunはIAM認証必須とし、Apps ScriptのOAuth client IDをcustom audienceに登録する。呼出し権限は配備者に限定し、`allUsers`を追加しない。GASで`requireViewer_()`が実利用者を確認してから、サーバー内の`ScriptApp.getIdentityToken()`を使ってPOSTする。backendでも署名検証済みtokenのaudience、issuer、azp、配備者subject/email、verified emailを確認する。ID tokenの配備者をメール確認者として記録しない。

環境変数は`MAIL_SCRIPT_AUDIENCE`、`MAIL_DEPLOYER_EMAIL`、`MAIL_DEPLOYER_SUBJECT`、`MAILBOX_OAUTH_SECRET_VERSION`、任意の`FIRESTORE_DATABASE_ID`、`PORT`。Secret ManagerのJSONは`{clientId,clientSecret,refreshToken}`。初回およびアクセストークン更新時にGoogle tokenInfoでscopeが正確に`gmail.readonly`だけであることを確認し、不一致は`MAIL_SCOPE_MISMATCH`、確認失敗は`MAIL_AUTH_REQUIRED`としてGmail GET前に停止する。固定窓口`customer@speed-ad.com`のprofile確認後だけメールを取得する。Google tokenやsecretは応答・ログに出さない。

## POST /rpc

入力は`{contractVersion:1,operation,requestId,issuedAt,actor:{email,authMode},payload}`。`actor`は認証済みGASが作り、browserが指定しない。`authMode`は社員の`domain`または検証済み窓口利用者の`customer-oauth`。issuedAtの許容差は120秒。

| operation | payload |
| --- | --- |
| listCaseMail | caseId、任意pageToken |
| listUnreviewedMail / listPendingMail | 任意pageToken |
| getMail | scope:case/pending/unreviewed、messageId、case scopeではcaseId |
| getAttachmentChunk | getMailと同じscope、partId、offset |
| markReviewed | getMailと同じscope、messageId、expectedVersion |
| resolvePending | messageId、action:match/exclude、match時caseId、expectedVersion、理由reason（1〜1000文字） |
| getSyncStatus | 空object |
| getSyncRequestResult | requestId、元のadvanceSync requestPayload。読取り専用で同じactor・内容の保存済みレシートと現在の同期状態を返す |
| listMailIssues | kind:pending/unreviewed/unavailable/bodyUnverified/bodyUnavailable/attachmentUnverified/attachmentUnavailable/failed/coverage/deleted/unknownClosure/expiredRetention、任意pageToken |
| uploadCaseCatalog | snapshotId、pageIndex、pageCount、total、digest、cases（200件以下、各要素はcaseId/handledStatus/closedAt） |
| advanceSync | executionId、開始時mode:full/historyと必須startAt、catalogSnapshotId/catalogDigest。失敗した同じ実行の明示再開だけresume:true |
| reconcilePending | 任意pageToken |

catalog・同期・再照合は社員操作だけに限定する。catalog digestは、小文字UUID順のJSON tuple `[caseId, handledStatus, closedAt]` を改行で結合したUTF-8文字列のSHA-256。全ページ・件数・digestが一致するまでは新catalogを有効化しない。同期は開始時の不変catalog snapshotを使用し、処理中に有効catalogが変われば書込みを拒否する。

同期要求が応答不明になった場合、GASは元の受付ID計画と開始日を保持し、正本Sheetの現在値で要求を作り直さず`getSyncRequestResult`で確認する。この操作もdomain認証必須で、`advanceSync`・元payload（実行IDを含む）・実利用者actorのfingerprintが一致するレシートだけを返す。レシート内の同期メタ情報と現在の同期状態以外は返さず、同期・Gmail取得・状態更新は実行しない。未作成レシートは`found:false`とし、自動再送しない。別利用者が同じ実行を進めた場合、古いレシートは元要求の成立確認に使い、画面の新しい進捗を戻さない。

GASの`advanceSync`送信前に、正本検査での計画変更・読取り失敗・受付日時欠落/不正、固定URLの未設定・不正、ID tokenの取得例外・空値を検出した場合だけ、`MAIL_SYNC_NOT_DISPATCHED`と原因コード、一致する要求ID・実行ID、`sent:false`を直接返す。計画変更・正本読取り失敗なら明示的な計画再作成を案内し、受付日時・設定・token取得失敗なら同じ未送信要求を保持して回復後の明示送信を待つ。このコードはCloud Runのエラーallowlistへ含めず、upstream応答から同じ未送信結果を再構成しない。fetch開始後の認証エラー・通信失敗は未送信の証拠にはせず、元要求のレシート照会へ進む。レシート照会自体のtoken取得失敗も元要求の未送信を証明しない。

残件一覧は種類を選び、保存済みメールを日時・messageId降順に50件ずつ走査する。該当0件のページにも次ページが残る場合がある。同期失敗で未登録のメールID、案件別の関連メール有無が未確認の受付ID、取得前削除で種類未確認のIDも50件ずつ列挙する。受付ID一覧・失敗ID一覧の対象集合が変化したcursorは拒否し、更新して先頭から確認する。取得不能のメールは保存済みメタ情報と添付descriptorを表示し、本文取得不能でも添付確認経路を維持する。

一覧は日時・messageId降順の50件。返却は`{ok:true,messages,page:{nextPageToken,previousPageToken,pageSize},sync}`。詳細は`message.bodyText`と添付descriptorを返す。MIME partIdはrootを`0`、子を`0.1`のように表す。本文は安全なテキストとし、HTML・remote画像を実行しない。同じ`multipart/alternative`内だけ、デコード・安全化後に空白以外の表示文字があるプレーンテキスト、その他の表現の順で1表現を選び、全表現が空なら空本文を維持する。選択のために取得した各表現の元バイト数も本文上限に合算する。独立した本文partは順に連結する。旧秘密付きURLを表示・ログ前に除去する。

添付は元サイズ・配信サイズとも最大64MiBとし、各要求でmessage内の所有partを再検証して512KiB以下のbase64 chunkを返す。返却は`{attachment:{partId,name,mimeType,size,previewKind},offset,nextOffset,totalSize,dataBase64,done}`。画像・PDFはsignature確認、テキストは安全なUTF-8プレビュー、それ以外はoctet-stream取得。転送メール添付などで元のバイト列が取得できず子MIME partだけが存在する場合は、空ファイルに置き換えず取得不能とする。テキスト添付の表示用データも秘密URLを除去する。

Gmail adapterは添付取得応答を固定窓口・message ID・attachment IDで識別し、Cloud Runのプロセスメモリに1添付分だけ保持する。64MiBのdecoded相当（base64では約85.4MiB）が上限で、アイドル120秒・取得開始から絶対5分の短い方で破棄する。同じキーの取得中要求は共有し、別添付の取得が進行中なら`MAIL_ATTACHMENT_BUSY`で明示再操作を求める。busyは取得不能や確認済みへ変更しない。各chunkの利用者・案件・最新messageとpartの確認はcacheにかかわらず行う。cache hitでも現在のOAuth scopeを検証し、本文・添付をFirestore・ファイル・ログへ保存しない。別instance、期限切れ、再起動、別添付への切替では再取得するため、取得1回は保証しない。デコード・安全化・digest計算はchunkごとに行うので、大容量添付の待ち時間・メモリ・API回数・費用は本番接続前に実測する。

初回確認者・日時はCloud Run側の時刻と、GASで確認した実利用者をtransactionで一度だけ保存する。同一requestId・同内容は同じreceiptを返し、内容相違は409。分類変更はversion照合と理由付きeventを残す。

添付の取得確認は512KiBごとの全範囲が応答へ渡った時だけ完了とする。Firestoreにはcontent digest、転送サイズ、取得済みチャンク位置を最大128個保存し、順不同・再取得・並行取得をtransactionで統合する。1チャンクだけ、末尾だけ、途中失敗では未検証を維持し、内容が変われば取得範囲をリセットする。0byte添付も明示取得を要する。再同期では同一part・名前・元サイズの取得範囲を保持する。確認済み操作は本文取得済みかつ全添付の全範囲取得済みの場合だけサーバーで許可し、画面は`reviewReady`と添付の取得状態を応答から読み戻す。これはデータ到達の証拠であり、利用者が内容を読んだことは明示操作で記録する。

## 同期と未達の扱い

全同期はspam/trashを含むmailboxの確定した開始日〜開始時cutoffを列挙し、GmailページごとのIDだけを一時保持する。開始日は正本Sheetの全受付日時が有効な場合だけ最古JST日の前日から導出する。受付なし・日時欠損・不正日付ではGAS登録とGmail呼出しの前に`MAIL_PERIOD_REQUIRED`で停止し、全期間へ広げない。Cloud RunとGmail adapterも開始日なしの列挙を拒否する。1要求のGmail本文処理は最大5通。全列挙後、過去indexの同じ対象期間を50件ずつ確認し、今回列挙されなかったものは取得不能へ残す。開始時historyIdを保存し、その後のhistory同期で全同期中の新着を回収する。開始要求の期間が保存済み期間と異なる場合はhistory要求でも全同期へ切り替え、新しい期間を全件照合する。継続中の実行は開始時の期間を保持する。history期限切れは全同期必要として表示する。

現在の開始日より前の保存済みメールはmetadata・確認記録・監査履歴を保持したまま、案件・照合待ち・未確認・残件一覧、件数、案件coverageから除外する。本文・添付の直接取得、確認済み・手動照合もサーバーで拒否する。期間変更前のcursorは再利用できない。開始日を持たない旧同期状態ではメールを公開せず、新しい全同期を要する。期間内coverageは対象メールのcase IDを投影して集計するため、実環境でFirestore読取量を確認する。
取得前削除で元日時が分からない診断は、期間外と推定せず残件として保持する。
画面が同期応答から開始日の変更を観測した時は、旧一覧・本文・添付previewを消去し、進行中の旧一覧・詳細・添付応答を採用しない。Firestoreの期間付きpending件数とunreviewed件数には、それぞれ`matchState/internalDate`と`matchState/firstReview/internalDate`の完全な複合index定義を含める。定義試験は実Firestoreでのindex構築完了・クエリ受入を証明しない。

履歴同期の`cutoffAt`は開始時のprofile取得直前に固定し、最終履歴ページのhistoryIdがそのprofileで観測したhistoryId以上になるまで完了しない。本文処理が長引いた場合や同じ実行を失敗から再開した場合も、この基準日時と開始時の履歴位置を保持する。`lastSuccessAt`は処理完了日時であり、同期済み範囲をその時刻まで広げる値ではない。履歴応答に含まれた基準日時後のメールも取得し、返却されたhistoryIdを次回の開始位置に使う。最終ページ取得後の新着は次回の履歴同期で回収する。全同期はprofileのhistoryIdを観測してからcutoffを固定し、次回の履歴同期でその観測後の新着を回収する。

未送信の下書きは送受信メールの対象外とする。全件検索に`-in:drafts`を付け、閲覧・同期時も取得したmessageの`DRAFT`ラベルを確認して除外する。履歴同期は追加・削除に加えてラベル変更も観測し、既知の下書きIDは非表示の除外メタ情報として保持する。[Gmailの下書き](https://developers.google.com/workspace/gmail/api/guides/drafts)は編集時にmessage IDが変わり、送信時は新しい`SENT`メールが作られるため、下書きの削除を送受信済みメールの取得不能として数えない。履歴だけでは下書きと証明できない未観測の削除IDは、メール行を作らず`deletionDiagnostics`へ保存する。`unobservedDeletedCount`は技術的受入を妨げる残件とし、`listUnobservedDeletions`で日時・ID順に全対象をページ取得できる。次の同期だけで診断を消去しない。

現在の既定実装は`trustedAnchor=false`。UUID・From・件名・threadIdだけで自動確定しない。手動確定済みmailに一意な返信関係がある場合だけ自動照合する。同じスレッド内の別案件の根拠も確認し、混在・未知・未解決の親・本文取得不能は照合待ち。後から混在が判明した場合、明示的な手動確定を保持し、自動照合だけをversion・監査イベント・案件到達件数とともにtransactionで照合待ちへ戻す。初回確認記録は保持する。親の確定後は明示再照合で5通ずつ再評価できる。深い返信関係は次のpassで再評価する。

`sync.state=complete`と`enumerationComplete`は列挙完了だけを示す。未確認、照合待ち、失敗、本文/添付の未検証・取得不能、案件ごとの関連mail有無の未照合を別に返す。`acceptanceReady`はこれらが残らない技術的準備指標であり、業務上の最終受入ではない。関連mailがない案件は正本との業務受入記録で確認する。対象外と明示分類したmailの本文/添付は達成条件から除く。

本文・添付bytesはFirestoreへ保存せず、メタ情報、取得確認状態、照合根拠、初回確認、cursor、receipt、eventを保存する。同期処理の自動scheduleと自動retryは追加しない。

## ローカル検証と配備資材

統合後は`npm ci --ignore-scripts`、`npm test`。Cloud Run imageはmail-serviceをcontextとして`docker build -f runtime/Dockerfile .`で作る。`.dockerignore`でnode_modules・秘密候補・test/toolsを除外する。Firestoreの必要複合indexは`runtime/firestore.indexes.json`に置く。

合成adapterの試験は、GAS token→Cloud Run IAM、Firestoreの実transaction/index、公式窓口の送受信保持、実メール/添付の到達、別利用者での確認記録読戻しを証明しない。Gmailの同意・審査、Cloud請求/予算、IAM/secret/index設定、実配備は別の判断を要する。

開始日が未確定の`not_started`または旧状態からの`needs_full_sync`では、対象期間依存の残件数は`null`として返す。画面は不明と表示し、0件や達成済みには変換しない。開始日のないrunning/complete応答は採用しない。

画面は一覧・残件・再照合を含む全入口で同期状態の完全な形式と残件/達成条件を検証してから採用する。同期実行・レシート照会の待機中に別応答から新しい状態を観測した場合、遅い応答は表示へ戻さず、元の不変要求を保持して明示的な再確認を待つ。

新しい同期状態を観測済みでも、要求ID・実行IDが一致するGAS確定未送信結果は元要求へ反映する。未送信要求を結果不明に変えず、新しい期間・件数表示を保持して同じ要求の明示送信または受付ID計画の作り直しを案内する。送信後のtimeoutや認証失敗には適用しない。

## Case closure catalog and retention residuals

`uploadCaseCatalog` requires `cases` (up to 200) instead of an ID-only `caseIds` payload. Each entry has exactly `{caseId, handledStatus, closedAt}`: a lower-case UUID, one of 未対応/対応中/対応済み/保留, and canonical UTC ISO or null. Non-completed entries cannot have a closure timestamp; future or malformed dates fail closed. GAS also requires receipt time ≤ closure time ≤ current time before uploading. The digest covers sorted JSON tuples `[caseId, handledStatus, closedAt]` joined by newline. Firestore verifies the complete snapshot count/digest on read and returns both full `cases` and derived `caseIds`. Legacy ID-only pages must be re-uploaded; no dates are inferred.

`caseRetention.mjs` exports `normalizeCatalogCases`, `retentionExpiresAt`, and `catalogRetention`. Expiry is the UTC calendar anniversary plus three years, clamping Feb 29 to Feb 28. `catalogRetention` accepts optional `suppressedCaseIds` as attestation from the separate purge store: snapshot metadata stays intact, but these cases are excluded from outstanding retention residuals.

Sync status includes `unknownClosureCaseCount` and `expiredCaseCount` (null only when no complete catalog exists). Both must be zero for `acceptanceReady`. `listMailIssues` adds `unknownClosure` and `expiredRetention`, returning paged case targets. Expired case list/body/attachment/review/manual match operations return `MAIL_RETENTION_EXPIRED`. Indexing checks the pinned and latest catalogs before storing a new matching message and fails without storing its metadata if expired-case evidence is present. The manual purge supports an expiry-only case plan bound to the current closure catalog. Completed purge hashes suppress coverage/retention residuals while immutable Sheet-derived catalog tuples remain intact. Expired/removed case metadata is withheld from cross-case and failure lists; navigation uses scanned row boundaries even when a page has no visible rows.

Record mutation and index writes carry `expectedCatalogDigest`; Firestore reads activeCatalog inside the same transaction and rejects a changed digest before replaying a receipt or writing metadata. This prevents a closure-only catalog change between service preflight and commit from applying a stale decision.

Final merged manual index records are checked against the catalog-bound retention policy inside the transaction before any message, event, diagnostic or coverage write. Removed cases return `MAIL_CASE_NOT_FOUND`; purged cases return `MAIL_RECORDS_DELETED`.

Manual `tools/cleanupMailMarkers.mjs` shares the purge generation gate and operates only on `suppressedMessages`. A dry-run pins up to 250 marker hashes and the complete sync state. Explicit advances enumerate all Gmail IDs, including drafts/Spam/Trash and without a period query, in 50-ID pages. Every ID must be a well-formed string and unique across the whole enumeration; the unique count must exactly match a stable profile `messagesTotal`. Missing/malformed responses are not coerced to an empty list. Only an unchanged profile history ID and total before/after the complete enumeration establishes absent candidates; an explicit deletion hash then permits 25-marker transactional batches, rechecking the profile and pinned sync state each time. The committed sync history position must equal the profile watermark before enumeration or deletion, so pending deletion history is consumed while the suppression marker still exists. Unknown/failed/changed enumeration retains unprocessed markers. Temporary seen-ID hashes are capped at 10,000 and 1,000 pages; exceeding either limit fails closed and is not completion. This conservatively retains a mail-ID hash while its original exists anywhere in Gmail, preventing reimport if the active period is later widened. The owner approved this retention condition. Advance/apply require a Secret consent receipt for the current disclosure version, which covers the all-mail ID scan and temporary hash set. Case/request hashes are outside this cleanup operation.
