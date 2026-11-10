# 問い合わせ確認アプリのメール連携（第2段階）

受付データのGAS viewerを維持し、公式窓口メールの読取・照合・確認記録だけを別のCloud Runサービスで扱う。画面とサーバーの詳細な受入条件は[仕様24](../../../docs/画面設計/仕様/24_support_contact_workspace_viewer_requirements.md)を参照する。現行のCloudflare/D1試用と公開フォームの保存経路は変更しない。

## 構成

- GASは既存の利用者認証を通した後、サーバー側で取得したApps ScriptのID tokenを使ってIAM非公開のCloud Run `/rpc` を呼ぶ。画面から確認者メールや任意のサービスURLを指定できない。
- Cloud Runは公式窓口のGmailを `gmail.readonly` で読み、FirestoreにメールID、メール単位の案件照合、最初の確認者・日時、同期位置と監査イベントを記録する。本文と添付バイト列は閲覧時に取得し、Firestoreへ保存しない。
- 添付はGAS経由の分割取得で画面へ渡す。対応ステータスと内部メモは従来のSheet RPCだけが更新し、メール側の処理から変更しない。

## ローカル検証

`mail-service/` で `npm ci` → `npm test`。GAS viewerはリポジトリ直下で `node --test tests/support-contact-workspace-viewer.test.mjs` とメールUI追加試験を実行する。テストは合成データと偽のGmail/Firestore/Google認証を使い、実メールやCloudの受入結果ではない。

## 公開前に必要な設定と判断

1. 公式窓口本人による読取同意と、対象期間の受信・送信メールがそのメールボックスに保存されていることの確認。過去分は受付IDだけで自動確定せず、照合待ちから利用者が確定・除外する。
2. `gmail.readonly` に適用されるGoogleの制限付きスコープ審査・セキュリティ評価または適用除外を確認する。窓口用のrefresh tokenは本人同意後、`node tools/authorizeMailbox.mjs --execute --desktop-client --confirm-mailbox customer@speed-ad.com --secret projects/PROJECT/secrets/EXISTING_SECRET` で既存Secret Managerへ直接登録できる。事前に承認済みDesktop OAuth clientのIDとsecretをそれぞれ `MAIL_OAUTH_CLIENT_ID` / `MAIL_OAUTH_CLIENT_SECRET` のプロセス環境へ渡し、既存secretへの追加権限を用意する。補助ツールは認可URL・code・token・secretを標準出力や端末ファイルに書かず、実行指示が揃わない場合は開始しない。**上記は手順であり、この変更では実行しない。**
3. 専用Cloudプロジェクトの請求先、予算と通知先を決める。Cloud Run、Firestore、Secret Manager、Gmail APIの利用条件と料金を確認してから、API/IAM/secret/サービスの設定と本番配備を判断する。
4. Cloud Runは`allUsers`を許可せず、GAS配備者だけにinvokerを付ける。Apps ScriptのOAuth client IDをcustom audienceに設定し、サービス内でもaudienceと配備者subject/emailを固定値で検証する。設定値は`MAIL_SCRIPT_AUDIENCE`、`MAIL_DEPLOYER_EMAIL`、`MAIL_DEPLOYER_SUBJECT`、`MAILBOX_OAUTH_SECRET_VERSION`、必要なら`FIRESTORE_DATABASE_ID`。GAS側は新しい`openid`認可とScript Property `MAIL_SERVICE_URL` が必要。実値をrepoへ保存しない。
5. 画面とAPIの認証、Firestore複合index、初回全件同期、後続履歴同期、照合待ち、添付の到達、別利用者の確認者・日時読戻しを実環境で検証する。対象期間・同期基準日時を記録し、正本Sheet全受付IDと窓口の対象送受信メールを照合する。

GASの第1段階version 7は単独で受入済み。第2段階が未配備または未設定の場合、メール欄は明示的な利用不可状態とする。第2段階の合成試験や同期の技術残件0だけで「シートやメールボックスを探さず全件確認できる」と判定しない。実環境での第2段階受入まで、現行メールボックス確認は必要。
