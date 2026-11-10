# メール連携サービスの実行契約

Node.js 24、Cloud Run、Firestore、Secret Managerを使う。既存GASのSheet/Drive更新APIから独立し、メール取得・照合・確認記録の操作はSheetの対応ステータスを書き換えない。

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
| listMailIssues | kind:pending/unreviewed/unavailable/bodyUnverified/bodyUnavailable/attachmentUnverified/attachmentUnavailable/failed/coverage/deleted、任意pageToken |
| uploadCaseCatalog | snapshotId、pageIndex、pageCount、total、digest、caseIds（200件以下） |
| advanceSync | executionId、開始時mode:full/history、任意startAt、catalogSnapshotId/catalogDigest。失敗した同じ実行の明示再開だけresume:true |
| reconcilePending | 任意pageToken |

catalog・同期・再照合は社員操作だけに限定する。catalog digestは、重複のない小文字UUIDを昇順に並べ、改行で結合したUTF-8文字列のSHA-256。全ページ・件数・digestが一致するまでは新catalogを有効化しない。同期は開始時の不変catalog snapshotを使用する。

残件一覧は種類を選び、保存済みメールを日時・messageId降順に50件ずつ走査する。該当0件のページにも次ページが残る場合がある。同期失敗で未登録のメールID、案件別の関連メール有無が未確認の受付ID、取得前削除で種類未確認のIDも50件ずつ列挙する。受付ID一覧・失敗ID一覧の対象集合が変化したcursorは拒否し、更新して先頭から確認する。取得不能のメールは保存済みメタ情報と添付descriptorを表示し、本文取得不能でも添付確認経路を維持する。

一覧は日時・messageId降順の50件。返却は`{ok:true,messages,page:{nextPageToken,previousPageToken,pageSize},sync}`。詳細は`message.bodyText`と添付descriptorを返す。MIME partIdはrootを`0`、子を`0.1`のように表す。本文は安全なテキストとし、HTML・remote画像を実行しない。同じ`multipart/alternative`内だけプレーンテキスト優先で1表現を選び、独立した本文partは順に連結する。旧秘密付きURLを表示・ログ前に除去する。

添付はmessage内の所有partを再検証し、512KiB以下のbase64 chunkを返す。返却は`{attachment:{partId,name,mimeType,size,previewKind},offset,nextOffset,totalSize,dataBase64,done}`。画像・PDFはsignature確認、テキストは安全なUTF-8プレビュー、それ以外はoctet-stream取得。転送メール添付などで元のバイト列が取得できず子MIME partだけが存在する場合は、空ファイルに置き換えず取得不能とする。テキスト添付の表示用データも秘密URLを除去する。実装は各chunkでGmail添付全体を読んで切り出すため、大容量添付の実測による待ち時間・API読取回数・費用判断が本番接続前に必要。

初回確認者・日時はCloud Run側の時刻と、GASで確認した実利用者をtransactionで一度だけ保存する。同一requestId・同内容は同じreceiptを返し、内容相違は409。分類変更はversion照合と理由付きeventを残す。

添付の取得確認は512KiBごとの全範囲が応答へ渡った時だけ完了とする。Firestoreにはcontent digest、転送サイズ、取得済みチャンク位置を最大64個保存し、順不同・再取得・並行取得をtransactionで統合する。1チャンクだけ、末尾だけ、途中失敗では未検証を維持し、内容が変われば取得範囲をリセットする。0byte添付も明示取得を要する。再同期では同一part・名前・元サイズの取得範囲を保持する。確認済み操作は本文取得済みかつ全添付の全範囲取得済みの場合だけサーバーで許可し、画面は`reviewReady`と添付の取得状態を応答から読み戻す。これはデータ到達の証拠であり、利用者が内容を読んだことは明示操作で記録する。

## 同期と未達の扱い

全同期はspam/trashを含む全mailboxの指定開始日〜開始時cutoffを列挙し、GmailページごとのIDだけを一時保持する。1要求のGmail本文処理は最大5通。全列挙後、過去indexの同じ対象期間を50件ずつ確認し、今回列挙されなかったものは取得不能へ残す。開始時historyIdを保存し、その後のhistory同期で全同期中の新着を回収する。history同期は同じ開始日を保ち、新着を含める。history期限切れは全同期必要として表示する。

履歴同期の`cutoffAt`は開始時のprofile取得直前に固定し、最終履歴ページのhistoryIdがそのprofileで観測したhistoryId以上になるまで完了しない。本文処理が長引いた場合や同じ実行を失敗から再開した場合も、この基準日時と開始時の履歴位置を保持する。`lastSuccessAt`は処理完了日時であり、同期済み範囲をその時刻まで広げる値ではない。履歴応答に含まれた基準日時後のメールも取得し、返却されたhistoryIdを次回の開始位置に使う。最終ページ取得後の新着は次回の履歴同期で回収する。全同期はprofileのhistoryIdを観測してからcutoffを固定し、次回の履歴同期でその観測後の新着を回収する。

未送信の下書きは送受信メールの対象外とする。全件検索に`-in:drafts`を付け、閲覧・同期時も取得したmessageの`DRAFT`ラベルを確認して除外する。履歴同期は追加・削除に加えてラベル変更も観測し、既知の下書きIDは非表示の除外メタ情報として保持する。[Gmailの下書き](https://developers.google.com/workspace/gmail/api/guides/drafts)は編集時にmessage IDが変わり、送信時は新しい`SENT`メールが作られるため、下書きの削除を送受信済みメールの取得不能として数えない。履歴だけでは下書きと証明できない未観測の削除IDは、メール行を作らず`deletionDiagnostics`へ保存する。`unobservedDeletedCount`は技術的受入を妨げる残件とし、`listUnobservedDeletions`で日時・ID順に全対象をページ取得できる。次の同期だけで診断を消去しない。

現在の既定実装は`trustedAnchor=false`。UUID・From・件名・threadIdだけで自動確定しない。手動確定済みmailに一意な返信関係がある場合だけ自動照合する。同じスレッド内の別案件の根拠も確認し、混在・未知・未解決の親・本文取得不能は照合待ち。後から混在が判明した場合、明示的な手動確定を保持し、自動照合だけをversion・監査イベント・案件到達件数とともにtransactionで照合待ちへ戻す。初回確認記録は保持する。親の確定後は明示再照合で5通ずつ再評価できる。深い返信関係は次のpassで再評価する。

`sync.state=complete`と`enumerationComplete`は列挙完了だけを示す。未確認、照合待ち、失敗、本文/添付の未検証・取得不能、案件ごとの関連mail有無の未照合を別に返す。`acceptanceReady`はこれらが残らない技術的準備指標であり、業務上の最終受入ではない。関連mailがない案件は正本との業務受入記録で確認する。対象外と明示分類したmailの本文/添付は達成条件から除く。

本文・添付bytesはFirestoreへ保存せず、メタ情報、取得確認状態、照合根拠、初回確認、cursor、receipt、eventを保存する。同期処理の自動scheduleと自動retryは追加しない。

## ローカル検証と配備資材

統合後は`npm ci --ignore-scripts`、`npm test`。Cloud Run imageはmail-serviceをcontextとして`docker build -f runtime/Dockerfile .`で作る。`.dockerignore`でnode_modules・秘密候補・test/toolsを除外する。Firestoreの必要複合indexは`runtime/firestore.indexes.json`に置く。

合成adapterの試験は、GAS token→Cloud Run IAM、Firestoreの実transaction/index、公式窓口の送受信保持、実メール/添付の到達、別利用者での確認記録読戻しを証明しない。Gmailの同意・審査、Cloud請求/予算、IAM/secret/index設定、実配備は別の判断を要する。
