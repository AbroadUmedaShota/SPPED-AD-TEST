---
owner: shared-docs
status: implementation-local-verified
last_reviewed: 2026-11-10
---

# 社内向けお問い合わせ確認アプリ

## 目的と配置

`abroad-o.com` の利用者および単一の外部例外 `customer@speed-ad.com` が同じ通常URLのブックマークから問い合わせ一覧・詳細・添付画像を確認し、対応ステータスと内部メモを更新できるようにする。

実装は `99_backend-docs/10_support-contact/viewer-workspace-gas/`。旧 `viewer-gas` の `Code.gs` と `Index.html` を複製し、認証と添付境界を変更する。旧viewerと既存送信GASはこの実装の変更対象に含めない。

## 認証と権限

- 配備者は会社アカウント `s-umeda@abroad-o.com`。manifestは `USER_DEPLOYING` / `ANYONE`（Googleログイン必須）。匿名公開しない。
- 社員は従来どおりサーバーの `Session.getActiveUser().getEmail()` を前後空白除去・小文字化し、ローカル部が空でなくドメインが厳密に `abroad-o.com` の場合に許可する。
- 外部例外は `customer@speed-ad.com` の専用Google OAuth認可コードフローだけ。Sessionメール一致だけの例外は廃止する。通常GETは外部利用者にメール/問い合わせを含まないIndex画面枠だけを返し、証明付きgetViewerContextが成功するまで業務データを取得しない。認証失敗/期限切れ時は画面の既存データを消して専用ログインを案内し、`?login=google` でデータのない `Login.html` を表示する。画面・認可URLに許可メールを露出しない。
- 既知のSessionメールが外部例外と異なる場合、専用OAuth開始・grant発行・cached grant参照を拒否する。社員は自分のSession経路を維持する。Sessionメール空欄の場合は有効なOAuth grantがなければRPCを拒否する。`getEffectiveUser`、UIの本人指定、クライアントtokenを代替にしない。
- OAuth画面入口は `doGet ?login=google` と同じ `/exec` の標準 `code/state/error` callback。予約クエリ `c` / `sid` は使用しない。callback GETはstate消費/コード交換/grant発行をせず、コードとstateを安全なJSONでLoginへ渡す。新規認証RPCは `beginCustomerOAuthLogin(proofHash, submissionId)` と `completeCustomerOAuthLogin(params, authProof)` の2本だけ。後者が同じタブのproofを確認してから認証を完了し、通常URLを返す。問い合わせデータやGoogle tokenは返さない。
- state、nonce、PKCE verifierは秘密鍵付きHMAC-SHA256（UUID+時刻+用途）で生成。stateは600秒・単回。ScriptLock内でstateを取り出し、タブproofのhashと一時利用者キーの一致を検証してから削除・期限確認し、ネットワーク前に消費する。不正proofではstateを消費せず、コード交換/業務データアクセスもしない。認可を拒否した応答・交換失敗の試行も再利用しない。
- 紐づけには非空の `Session.getTemporaryActiveUserKey()` を使う。これはGoogle利用者とスクリプト単位の一時キーであり、ブラウザ/タブ固有キーではない。このキーだけでは認可しない。LoginでWebCrypto CSPRNG 32byteのproofを生成してsessionStorageに保存し、SHA-256 hashと一時キーの両方にstateを拘束する。新しい開始時には保存済み値を再利用せず毎回32byteを生成・上書きする。callbackは開始時の既存proofを読むだけで再生成しない。空/異なるproofや一時キーの変化時は拒否する。
- Googleの固定 `https://oauth2.googleapis.com/token` へサーバーからclient secret・認可コード・PKCE verifier・固定redirectをPOST。TLSを検証しリダイレクトを追わず、エラー詳細や秘密をログ/画面に出さない。ID tokenはこの直接HTTPS応答からのみ受け取り、クライアント入力は拒否する。追加RSA署名検証を省く条件は [Google公式OIDC第5節](https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo) に限定する。
- ID tokenはissuer、`alg=RS256`、aud、存在するazp、非空sub、整数exp/iat、state開始に対する鮮度（60秒の時刻差許容）、nonce一致、verified email、厳密な対象メール、`hd=speed-ad.com` を検証。HDのない外部メールは拒否する。
- grantは一時利用者キー+proof hash+設定のHMACをキーとするv2 namespaceのScriptCache内のみ。旧GASキー単独のgrant/stateは読まず移行しない。メール・sub・期限だけを保存し、ID/access/refresh tokenは保存しない。期限はtokenのexpと1時間の短い方。通常URLで再利用し、全業務RPCで任意の末尾 `authProof` 引数を受け取り、期限・一時キー・proof・既知メールを再確認する。社員の既存呼出しはproofなしで維持する。共通callServerがproofを追加し、更新から詳細取得への内部呼出しにも引き継ぐ。キー変更・キャッシュ消失・設定変更・期限切れなら再認証する。
- 社員・検証済みcustomerとも同じ閲覧・更新権限。`handled_by` にサーバーで確認した実利用者メール、`handled_at` に更新日時を記録する。Google tokenや共通メールtoken、grant識別子をURL/ブラウザ保存/クライアントcontextへ渡さない。例外として上記のタブproofのみsessionStorageに保存しTLSのRPC引数で提示する。proofそのものはURLやサーバー保存contextへ渡さない。OAuth標準の一回限りの認可コード/stateのcallbackクエリは完了画面から通常URLへ移動して離れる。

## 保存先とRPC

既存の保存先だけを Script Properties `SPREADSHEET_ID` / `DRIVE_FOLDER_ID` から参照する。`CONTACT_SHEET_NAME` は省略時 `contact_submissions`。ID実値や認証情報をソースへ埋め込まない。設定はApps Script設定画面で行い、公開installerやProperties変更RPCは設けない。既存リソースの共有変更や新しい直接共有を要求しない。

| 公開入口 | 引数 / 用途 |
| --- | --- |
| `doGet(e)` | 通常URL / 初期 `?id=` |
| `getViewerContext(authProof?)` | 認証済み利用者情報 |
| `listContactSubmissions(options, authProof?)` | 検索・ステータス絞込み・件数・一覧（最大200件） |
| `getContactSubmission(submissionId, authProof?)` | 本文・対応状態・添付メタ情報 |
| `getAttachmentPreview(submissionId, fileId, authProof?)` | 対象行に紐づく添付画像のbase64プレビュー |
| `updateContactSubmissionStatus(submissionId, status, note, authProof?)` | ステータス・メモ・更新者・更新日時の保存 |

上記2本の認証RPC以外の内部関数は末尾 `_` とし、削除・テスト・整理・セットアップの公開入口を設けない。必須列がないシートはエラーとし、閲覧時に列を作成しない。

添付は対象行の `attachment_refs` に含まれ、送信GASの命名規則どおりファイル名が `<submission_id>-` で始まり、設定済み保存フォルダーの直接配下にある、ゴミ箱以外のファイルだけを許可する。他行のファイル、未参照ファイル、保存フォルダー外のファイルは拒否する。拒否した添付について代替URLからの参照を許可しない。

## 画面・更新

- 既存の一覧、検索、状態別件数、詳細、添付拡大/前後移動、内部メモ、クイック操作、未保存変更確認を維持する。
- 初期 `?id=` の詳細は初期一覧の絞込みや件数上限にかかわらず開く。ID省略時は通常の一覧を表示する。
- `未対応` / `対応中` / `対応済み` / `保留` のみ保存可能。存在しないIDや不正ステータスでは書き込まない。
- 保存対象は対応状態、内部メモ、実更新者、更新日時だけ。メモは前後空白を除去し、数式として評価されない文字列で保存する。同時編集は従来どおり後から保存した値が残る。
- 投稿内容・メモ・添付名をHTMLとして実行せずエスケープする。テンプレート内JSONは `<` をUnicodeエスケープし、投稿元/添付リンクはHTTP(S)のみに制限する。
- 外部OCRや外部解析を追加しない。manifestスコープは `spreadsheets`、`drive.readonly`、`userinfo.email`、`script.external_request` のみ。OAuth要求は `openid email` のみ。

## 検証と配備後受入

ローカル検証: `node --test tests/support-contact-workspace-viewer.test.mjs`。実際のCode.gs/OAuth.gs/UIをVMで実行し、Google HTTPS交換/Session/Cache/Lock/Sheet/Drive境界を代替する。合成ID tokenの成功をライブ認証成功と扱わない。

配備後に別途確認する事項（本変更では実施しない）:

1. 配備者、実行者、Googleログイン必須のアクセス設定が上記と一致する。
2. 異なる社内利用者2名で通常ブックマークから一覧/詳細/添付/更新を利用でき、`handled_by` が各本人になる。
3. 初期一覧対象外の受付IDも `?id=` から開け、再読込でも利用できる。
4. 専用OAuthクライアントを設定し、`OAUTH_CLIENT_ID` / `OAUTH_CLIENT_SECRET` / `OAUTH_REDIRECT_URI` を設定する。redirectは現在のグローバル `/exec` 固定値。任意の `OAUTH_HMAC_SECRET` 省略時はclient secretを使う。秘密の実値はrepoへ保存しない。
5. 対象customer本人で専用ログイン→callback→同じ通常URL→RPCの一時利用者キーの継続性と、実ID tokenの `hd=speed-ad.com` を確認する。両方とも未確認であり、ログイン可能とはまだ判定しない。
6. **統合hold: 独立構造レビュー、Sessionメール空欄の別Google利用者/同じGASキーの別ブラウザから同じURLを開く負のライブ試験を必須とする。** 一時キーが他利用者と分離され、他人のgrantを参照できないことを確認する。同じ一時キーでも異なるタブproof、proof欠落、callbackパラメータだけの流用が、state消費/交換/データ取得より前に拒否されることを確認する。Login/callback/Index間のHTML Service origin・sessionStorage継続性と同タブ再読込を確認する。モックのキー分離成功では受入しない。分離不能なら停止し、effectiveUserやUI識別で代替しない。
7. 既知の別メール、他の `speed-ad.com` 利用者、未認証・空キー、hd欠落、不正state、期限切れ・キャッシュ消失・キー変更時はデータを取得できず、必要な再認証へ戻ることを確認する。
8. 対象Sheet/Driveへの配備者の既存権限を使い、新しい共有なしで操作する。旧viewerの利用経路を維持する。
9. Chrome / Firefox / Edgeで一覧・編集・保存ボタンクリック・クイック操作・添付拡大・未保存確認を確認する。

配備手順は [新viewer README](../../../99_backend-docs/10_support-contact/viewer-workspace-gas/README.md) を参照。ローカル検証の合格は実配備・実アカウントでの受入完了を意味しない。

タブ複製/openerによるsessionStorageコピーやproofの明示持出しは同じセッション能力の複製となる。proofは物理ブラウザの身元証明ではない。正規導線は同じタブの `_top` 移動とする。ライブ確認と独立レビューが終わるまでcustomerの利用完了/配備可とは報告しない。
