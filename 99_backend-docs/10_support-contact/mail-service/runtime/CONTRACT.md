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
| uploadCaseCatalog | snapshotId、pageIndex、pageCount、total、digest、caseIds（200件以下） |
| advanceSync | executionId、開始時mode:full/history、任意startAt、catalogSnapshotId/catalogDigest。失敗した同じ実行の明示再開だけresume:true |
| reconcilePending | 任意pageToken |

catalog・同期・再照合は社員操作だけに限定する。catalog digestは、小文字UUIDの重複を除いて昇順に並べ、改行で結合したUTF-8文字列のSHA-256。全ページ・件数・digestが一致するまでは新catalogを有効化しない。同期は開始時の不変catalog snapshotを使用する。

一覧は日時・messageId降順の50件。返却は`{ok:true,messages,page:{nextPageToken,previousPageToken,pageSize},sync}`。詳細は`message.bodyText`と添付descriptorを返す。MIME partIdはrootを`0`、子を`0.1`のように表す。本文は安全なテキストとし、HTML・remote画像を実行しない。旧秘密付きURLを表示・ログ前に除去する。

添付はmessage内の所有partを再検証し、512KiB以下のbase64 chunkを返す。返却は`{attachment:{partId,name,mimeType,size,previewKind},offset,nextOffset,totalSize,dataBase64,done}`。画像・PDFはsignature確認、テキストは安全なUTF-8プレビュー、それ以外はoctet-stream取得。テキスト添付の表示用データも秘密URLを除去する。実装は各chunkでGmail添付全体を読んで切り出すため、大容量添付の実測による待ち時間・API読取回数・費用判断が本番接続前に必要。

初回確認者・日時はCloud Run側の時刻と、GASで確認した実利用者をtransactionで一度だけ保存する。同一requestId・同内容は同じreceiptを返し、内容相違は409。分類変更はversion照合と理由付きeventを残す。

## 同期と未達の扱い

全同期はspam/trashを含む全mailboxの指定開始日〜開始時cutoffを列挙し、GmailページごとのIDだけを一時保持する。1要求のGmail本文処理は最大5通。全列挙後、過去indexの同じ対象期間を50件ずつ確認し、今回列挙されなかったものは取得不能へ残す。開始時historyIdを保存し、その後のhistory同期で全同期中の新着を回収する。history同期は同じ開始日を保ち、新着を含める。history期限切れは全同期必要として表示する。

現在の既定実装は`trustedAnchor=false`。UUID・From・件名・threadIdだけで自動確定しない。手動確定済みmailに一意な返信関係がある場合だけ自動照合する。同じスレッド内の別案件の根拠も確認し、混在・未知・未解決の親・本文取得不能は照合待ち。後から混在が判明した場合、明示的な手動確定を保持し、自動照合だけをversion・監査イベント・案件到達件数とともにtransactionで照合待ちへ戻す。初回確認記録は保持する。親の確定後は明示再照合で5通ずつ再評価できる。深い返信関係は次のpassで再評価する。

`sync.state=complete`と`enumerationComplete`は列挙完了だけを示す。未確認、照合待ち、失敗、本文/添付の未検証・取得不能、案件ごとの関連mail有無の未照合を別に返す。`acceptanceReady`はこれらが残らない技術的準備指標であり、業務上の最終受入ではない。関連mailがない案件は正本との業務受入記録で確認する。対象外と明示分類したmailの本文/添付は達成条件から除く。

本文・添付bytesはFirestoreへ保存せず、メタ情報、取得確認状態、照合根拠、初回確認、cursor、receipt、eventを保存する。同期処理の自動scheduleと自動retryは追加しない。

## ローカル検証と配備資材

統合後は`npm ci --ignore-scripts`、`npm test`。Cloud Run imageはmail-serviceをcontextとして`docker build -f runtime/Dockerfile .`で作る。`.dockerignore`でnode_modules・秘密候補・test/toolsを除外する。Firestoreの必要複合indexは`runtime/firestore.indexes.json`に置く。

合成adapterの試験は、GAS token→Cloud Run IAM、Firestoreの実transaction/index、公式窓口の送受信保持、実メール/添付の到達、別利用者での確認記録読戻しを証明しない。Gmailの同意・審査、Cloud請求/予算、IAM/secret/index設定、実配備は別の判断を要する。
