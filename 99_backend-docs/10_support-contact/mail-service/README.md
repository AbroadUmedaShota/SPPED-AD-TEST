# 問い合わせ確認アプリのメール連携（第2段階）

受付データのGAS viewerを維持し、公式窓口メールの読取・照合・確認記録だけを別のCloud Runサービスで扱う。画面とサーバーの詳細な受入条件は[仕様24](../../../docs/画面設計/仕様/24_support_contact_workspace_viewer_requirements.md)を参照する。現行のCloudflare/D1試用と公開フォームの保存経路は変更しない。

本番配備の順序、手動同期、失敗時の復旧、全件照合と巻戻しは[運用手順](OPERATIONS.md)を参照する。手順の準備と実行・受入の完了は別に記録する。

## 構成

- GASは既存の利用者認証を通した後、サーバー側で取得したApps ScriptのID tokenを使ってIAM非公開のCloud Run `/rpc` を呼ぶ。画面から確認者メールや任意のサービスURLを指定できない。
- Cloud Runは公式窓口のGmailを `gmail.readonly` で読み、FirestoreにメールID、メール単位の案件照合、最初の確認者・日時、同期位置と監査イベントを記録する。本文と添付バイト列は閲覧時に取得し、Firestoreへ保存しない。
- 添付はGAS経由の分割取得で画面へ渡す。対応ステータスと内部メモは従来のSheet RPCだけが更新し、メール側の処理から変更しない。

## HTML本文の依存ライブラリと制限

HTMLの構文解釈には [parse5](https://github.com/inikulin/parse5) `8.1.1`（MIT、package-lockで推移依存も固定）を使う。手書きのタグ除去では、通常文章の `<` やSVG/object内のコメントを誤って処理し、本文欠落や非表示の受付IDが照合へ漏れるため導入した。`parseFragment`の構文木からテキストだけを反復走査し、script・style・iframe・object・svgの配下とコメントを除外する。HTMLを実行せず、外部リソースも取得しない。解析済み文字参照を二重にデコードせず、収集後に既存の秘密付きURL除去を適用する。

既存の本文元バイト上限2MiBに加え、構文木のメモリ増大を避けるため、解析前に`<`の直後が英字・`/`・`!`・`?`の候補を最大20,000箇所に制限する。候補はコメント等の内部も数える保守的な資源制限で、HTMLの表示解釈には使わない。さらにparse5のtree adapterで、補完生成された書式要素の複製、テキスト、コメント、解析用の文書・fragmentを含む実際の作成ノードも最大20,000件に制限する。元ソースのタグが少なくても構文木が増幅するため、割当て前に同じ規模の上限で停止する。テキストの結合は新規ノードに数えず、内部で新規作成する挿入操作も数える。超過は`MAIL_HTML_STRUCTURE_LIMIT`を返し、同期・閲覧では本文取得不能の残件となる。本文を黙って切り詰めたり、取得確認済みの空本文にしたりせず、そのメールを確認できる状態へ解消するまで全件受入は未達とする。HTMLの改行コードと無効な文字参照はHTML標準の規則で正規化する。

## ローカル検証

`mail-service/` で `npm ci` → `npm test`。GAS viewerはリポジトリ直下で `node --test tests/support-contact-workspace-viewer.test.mjs tests/support-contact-mail-viewer.test.mjs` を実行する。テストは合成データと偽のGmail/Firestore/Google認証を使い、実メールやCloudの受入結果ではない。

[合成データのChrome画面](evidence/phase2-mail-synthetic-chrome.png)は、案件詳細内のメール本文、確認記録、PDF・画像・テキスト添付の表示例である。実メール画面の証拠ではない。

「全件確認の残件」から種類別に対象を送り、未登録の失敗メールID、関連メールの有無が未確認の受付ID、取得不能の本文・添付を特定できる。[添付取得不能の画面](evidence/phase2-residual-attachment-synthetic-chrome.png)と[未登録の失敗IDの画面](evidence/phase2-residual-failed-synthetic-chrome.png)は合成データによるChrome確認例。

正本Sheet・独立したGmail列挙・app記録の照合は[独立照合CLIとmanifest契約](tools/ACCEPTANCE.md)を使う。IDをhash化した入力の完全性と双方向一致を検査し、本文・添付・確認記録の残件を返す。合成試験済みの照合器と、本番source採取・業務受入の実施を区別する。

Gmailのsource採取は `tools/captureGmailAcceptanceCli.mjs` を使う。計画表示を既定とし、明示実行・同じprojectの数値固定Secret version・窓口・受入期間・private保存先を必要とする。関連メールなしの案件確認を含む説明version `2026-11-11.10` を通常サービスとマーカー整理でも検証し、旧同意記録では接続しない。登録ツールと実行時が共有する正本から説明全文を再構成し、保存方法・削除窓口を含むパラメータ、全文・hash・窓口・UTC同意日時を照合する。5分を超える未来日時、説明の省略・改変、固定数値以外のSecret versionはOAuthクライアント生成前に拒否する。Google審査・人による閲覧条件・本人同意を解決した後にだけ実採取する。

## 公開前に必要な設定と判断

1. 公式窓口本人による読取同意と、対象期間の受信・送信メールがそのメールボックスに保存されていることの確認。過去分は受付IDだけで自動確定せず、照合待ちから利用者が確定・除外する。
2. `gmail.readonly` に適用されるGoogleの制限付きスコープ審査・セキュリティ評価または適用除外を確認する。窓口用のrefresh tokenは本人同意後、`node tools/authorizeMailbox.mjs --execute --desktop-client --confirm-mailbox customer@speed-ad.com --secret projects/PROJECT/secrets/EXISTING_SECRET` で既存Secret Managerへ直接登録できる。事前に承認済みDesktop OAuth clientのIDとsecretをそれぞれ `MAIL_OAUTH_CLIENT_ID` / `MAIL_OAUTH_CLIENT_SECRET` のプロセス環境へ渡し、既存secretへの追加権限を用意する。補助ツールは認可URL・code・token・secretを標準出力や端末ファイルに書かず、実行指示が揃わない場合は開始しない。**上記は手順であり、この変更では実行しない。**
3. 専用Cloudプロジェクトの請求先、予算と通知先を決める。Cloud Run、Firestore、Secret Manager、Gmail APIの利用条件と料金を確認してから、API/IAM/secret/サービスの設定と本番配備を判断する。
4. Cloud Runは`allUsers`を許可せず、GAS配備者だけにinvokerを付ける。Apps ScriptのOAuth client IDをcustom audienceに設定し、サービス内でもaudienceと配備者subject/emailを固定値で検証する。設定値は`MAIL_SCRIPT_AUDIENCE`、`MAIL_DEPLOYER_EMAIL`、`MAIL_DEPLOYER_SUBJECT`、`MAILBOX_OAUTH_SECRET_VERSION`、必要なら`FIRESTORE_DATABASE_ID`。GAS側は新しい`openid`認可とScript Property `MAIL_SERVICE_URL` が必要。実値をrepoへ保存しない。
5. 画面とAPIの認証、Firestore複合index、初回全件同期、後続履歴同期、照合待ち、添付の到達、別利用者の確認者・日時読戻しを実環境で検証する。対象期間・同期基準日時を記録し、正本Sheet全受付IDと窓口の対象送受信メールを照合する。

2026-11-10時点の読戻しでは、Gmail読取用の検証環境として `speed-ad.com` 組織内に `spd-contact-mail-oauth-261110`（番号 `47432854912`）を用意し、Gmail API有効、External / Testing、テスト利用者0件、`gmail.readonly`だけの宣言、Desktop client `SPEED AD Contact Mailbox - Gmail Readonly` の作成を確認した。窓口本人のGmail同意、refresh token、資格情報のSecret version登録、実メール読取は未実施である。

正式な運営主体はアブロードアウトソーシング株式会社である。同社の `abroad-o.com` 組織に本番メール認可専用OAuth project `spd-contact-mail-prod-261110`（番号 `322596549698`）を作成し、Gmail API、External / Testing、`gmail.readonly`、Desktop clientを設定した。上記の既存projectは検証用として維持する。`customer@speed-ad.com` の本人だけが本番用の `gmail.readonly` を認可し、`@abroad-o.com` 利用者は既存GASの本人確認を使う。第1段階のログイン用projectにはGmail認可を統合しない。OAuth clientとCloud Runを同じprojectに置く必要はなく、資格情報は実行基盤側のSecret Managerに保存する。本番projectは請求先未接続、テスト利用者0人、Gmail本人同意・Secret version未作成である。

アプリの業務利用者は組織をまたぐため、窓口本人だけがGmail認可することを根拠に[Internal用途の審査除外](https://support.google.com/cloud/answer/13464323?hl=en)を確定しない。External / Testingで取得するこのscopeの認可とrefresh tokenは[7日で失効](https://support.google.com/cloud/answer/15549945?hl=en)する。本番接続前にアプリ専用の公開ホームとプライバシー案内を整え、ホームに利用規約とプライバシー方針をリンクし、[制限付きscopeの審査とサーバー処理に対する年次CASA評価](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)の適用または除外根拠を確認する。[OAuthの本番ポリシー](https://developers.google.com/identity/protocols/oauth2/policies)はホームの両リンクと、本番・試験用のproject分離を求める。既存の公開 `/privacy/` にはGmail取得・利用者への共有・保存期間の説明が不足するため、改訂案を作成し、公開条件を確認してから反映する。審査申請・公開と、評価費用の判断は別に行う。

Cloud Run・Firestore・Secret Managerは `abroad-o.com` 組織内の `spd-contact-viewer-20261110` に置き、同projectの請求先と月額3,000円の予算通知は設定済み。OAuth clientのprojectと資格情報を保存するSecretのprojectをそれぞれ照合し、初回Gmail読取後にOAuth側のquotaと費用を確認する。既存の予算通知はOAuth側projectを含まない。Cloud Run・GAS第2段階の配備と実環境受入は未完了であり、実行時の状態と受入結果は切替記録で再確認する。

GASの第1段階version 7は単独で受入済み。第2段階が未配備または未設定の場合、メール欄は明示的な利用不可状態とする。第2段階の合成試験や同期の技術残件0だけで「シートやメールボックスを探さず全件確認できる」と判定しない。実環境での第2段階受入まで、現行メールボックス確認は必要。

## データの管理・削除

[データ管理・削除の案内](../../../docs/ハンドブック/運用/09_SUPPORT_CONTACT_MAIL_DATA_CONTROL.md)に、読取り・共有・保存先、Google側のアクセス取消し、アプリ側データの削除申請と現状の制約を記載する。

認可補助ツールは、対象期間の全送受信メール（迷惑メール・ゴミ箱を含み下書きを除く）の同期時照合、`abroad-o.com` の認証済み社員全員による照合待ちを含む本文・添付の閲覧と、「Gmail由来の照合・確認記録を案件終了後3年間保存する」方針を表示する。マーカー整理時だけは、原本不在の確認に同期期間外・下書きを含むGmail全体のメールIDを列挙し、一時hash集合をFirestoreへ保存することも説明する。その実施説明 `MAIL_DATA_RETENTION_NOTICE` と削除申請先メール `MAIL_DATA_DELETION_CONTACT` が必須で、既定値は設けない。正本Sheetの `closed_at` と案件カタログから起算日・期限残件を扱い、期限到来分は下記の手動削除CLIで処理する。終了日時が不明の対応済み案件は残件として表示し、推定しない。自動期限削除は用意していないため、期限確認と手動削除の実施担当・頻度を運用で定める。対話端末で説明を読み「同意します」と入力した直後にだけGoogle同意画面を開く。非対話実行やフラグだけで同意を代行しない。Googleの窓口・scope確認後、同意した説明全文・version・SHA-256・同意日時・窓口を資格情報と同じSecret versionへ保存し、秘密を含まないreceiptを返す。

補助ツールのCloud実行者には対象Secretだけの `secretmanager.secrets.get` と `secretmanager.versions.add` が必要。Secret値（資格情報）は読み取らず、指定したSecretのメタデータからproject IDを正式なproject number名へ解決し、その同じ親名へ保存する。返されたversionが別project・別Secretなら成功扱いにしない。保存応答不明時に自動再登録しない。

## メール記録の手動削除

管理者用CLI `node tools/purgeMailMetadata.mjs` はdry-runを既定とし、対象project/database、確認済み依頼番号、同じ計画hashの明示適用を必要とします。[削除手順](../../../docs/ハンドブック/運用/10_SUPPORT_CONTACT_MAIL_PURGE.md)に、保守状態、途中失敗からの再開、最小hashマーカーと期限削除の残る統合条件を記載しています。


操作要求IDは発行時刻を固定した新形式を使い、明示更新の再実行期限は発行から7日です。期限後は結果を読み戻して照合し、応答不明の要求を自動で新しいIDへ置き換えません。削除済みレシートの要求ID hashはこの期限までだけ必要で、`tools/cleanupRequestMarkers.mjs` のdry-run/明示applyにより期限済みの新形式を最大250件ずつ整理できます。旧形式の期限不明hashは残し、案件ID hashや旧カタログの整理とは分けます。契約と実行手順はruntime/CONTRACT.mdと本番運用手順を参照してください。
