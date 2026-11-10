---
owner: shared-docs
status: prepared-not-executed
last_reviewed: 2026-11-10
---

# お問い合わせ確認アプリ・メール連携の本番運用手順

第2段階の配備、手動同期、復旧、業務受入に使う手順です。画面・データの仕様は[仕様24](../../画面設計/仕様/24_support_contact_workspace_viewer_requirements.md)、RPCと同期の契約は[実行契約](../../../99_backend-docs/10_support-contact/mail-service/runtime/CONTRACT.md)を参照してください。

この文書は準備した手順であり、実行成功の記録ではありません。2026-11-10の読取り時点では専用Cloudプロジェクトに請求先がなく、第2段階のAPI・Cloud資源は未準備でした。実行直前に状態を再照合し、対象project、region、Git SHA、GAS配備version、image digest、設定・検証結果を既存の切替・受入記録へ残します。秘密値や実メール本文は記録へ貼りません。

## 1. 接続前に確定すること

| 確認事項 | 進められる条件 |
| --- | --- |
| 公式窓口 | `customer@speed-ad.com` 本人がGmail読取に同意し、対象期間の受信・送信メールと添付がこのメールボックスに保存されている。別アカウントからの代理送信など、保存されない経路は先に特定する。 |
| OAuthの本番条件 | 実際のOAuth project所有組織、Audience、公開状態、要求scopeを確認し、`gmail.readonly` の審査・セキュリティ評価または適用除外の根拠を確定する。ドメイン名の違い、利用人数の少なさ、窓口1件だけという理由でInternal・個人利用の例外を推定しない。 |
| 継続認可 | ExternalかつTestingのOAuth projectでは、このscopeのrefresh tokenは7日で失効する。本番の継続認可条件を整えてから窓口同意を取得する。毎週の再同意を本番運用の代用にしない。 |
| 費用 | Cloud Run、Firestore、Secret Manager、Artifact Registry、ビルドに使うサービスの請求先、予算、費用確認の担当と頻度を確定する。審査・評価に費用が発生する場合はCloud利用料と分けて判断する。 |
| 配備対象 | project、region、Firestore database ID、Cloud Runサービス名、実行サービスアカウント、Secret名、GAS配備IDと復旧候補versionを確定する。Firestoreの配置場所は作成前に決める。 |

Googleの条件は[制限付きscopeの審査・例外](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)と[refresh tokenの失効条件](https://developers.google.com/identity/protocols/oauth2#expiration)で実行時に再確認します。既存viewerの本人確認用OAuthと、窓口Gmail読取用OAuth clientを取り違えないでください。

予算通知や[spend cap](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)を利用する場合は対象サービスと停止範囲を確認し、Cloud Run以外も含む総費用の上限とは扱いません。Firestore・Secret Manager・image保存・ビルドを含めて費用を確認し、超過時に止める操作を決めます。

## 2. 配備する順序

各行の読戻しに成功してから次へ進みます。APIの有効化、請求接続、IAM変更、Secret登録、配備の実施は、対象と適用される承認を照合して行います。

| 順序 | 操作 | 読戻し・停止条件 |
| --- | --- | --- |
| 1 | 現行GASの配備version、コード、manifest、Script Propertiesの設定名、Sheet/Drive参照先を保全する。 | 現行第1段階の利用経路と復旧先を特定する。secretの値を出力しない。 |
| 2 | 承認済み請求先と費用管理を設定し、Run、Firestore、Secret Manager、Gmail、Artifact Registry、必要なビルドAPIを有効化する。 | projectとAPI一覧、請求状態を再取得する。使わないビルドAPIは追加しない。 |
| 3 | Cloud Run専用実行サービスアカウント、Firestore database、Secret、image保存先を作成する。 | 実行アカウントにはFirestore操作と対象Secretの読取りに必要な権限だけを付ける。ブラウザや一般利用者へFirestore/Secretを直接共有しない。 |
| 4 | [index定義](../../../99_backend-docs/10_support-contact/mail-service/runtime/firestore.indexes.json)を対象databaseへ反映する。 | 必要indexが利用可能になるまで待つ。index作成中の一覧失敗を0件と扱わない。 |
| 5 | 窓口本人の同意で、scopeが正確に`gmail.readonly`だけの資格情報をSecret Managerへ登録する。 | [認可補助ツール](../../../99_backend-docs/10_support-contact/mail-service/README.md#公開前に必要な設定と判断)を使い、code/tokenを端末ファイル・ログへ出さない。登録先Secretとversionを確認する。 |
| 6 | 下記の検証・imageビルドを行い、承認済みimage保存先へpushする。 | Git SHAとimage digestを対応付ける。ビルド未実施をテスト合格で代用しない。 |
| 7 | Cloud RunをIAM認証必須で配備する。 | `allUsers`を付けない。GAS配備者だけにinvokerを付け、GASの実ID tokenのaudienceをcustom audienceへ登録する。[Cloud Runの認証](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)を参照する。 |
| 8 | GASへメール連携コードと`openid` scopeを反映し、固定`MAIL_SERVICE_URL`を設定して必要な再認可を行う。 | 配備ID・version・コード・scope・設定を読戻す。既存Sheet/Drive参照先と利用者認証を維持する。 |
| 9 | 社員と窓口の利用経路、IAM拒否、メール読取、実Firestore更新とindexを実環境で確認する。 | 確認者が配備者へ置き換わらず、実利用者として記録される。認証失敗時は業務データが消える。 |

Cloud Runの設定は次の対応で照合します。値はrepoへ保存せず、実tokenをログへ出して取得しないでください。

| 設定 | 内容 |
| --- | --- |
| `MAIL_SCRIPT_AUDIENCE` | `ScriptApp.getIdentityToken()`で使われるGAS自身のOAuth client ID。窓口ログイン用client IDから推定しない。 |
| `MAIL_DEPLOYER_EMAIL` / `MAIL_DEPLOYER_SUBJECT` | 検証済みGAS配備者のemailとsubject。 |
| `MAILBOX_OAUTH_SECRET_VERSION` | 窓口資格情報を持つSecretの特定version。 |
| `FIRESTORE_DATABASE_ID` | default以外を使う場合のdatabase ID。 |

ビルドは採用するGit SHAの`99_backend-docs/10_support-contact/mail-service/`を作業ディレクトリにして行います。`IMAGE_REFERENCE`は承認済み保存先とSHAに対応するタグへ置き換えます。

```powershell
npm ci --ignore-scripts
npm test
docker build -f runtime/Dockerfile -t IMAGE_REFERENCE .
```

リポジトリ直下ではGAS側の対象試験を実行します。

```powershell
node --test tests/support-contact-workspace-viewer.test.mjs tests/support-contact-mail-viewer.test.mjs
git diff --check
```

最初のCloud Run設定は、最小instanceを0にし、承認したinstance上限・CPU/メモリ・timeoutを記録します。費用、応答時間、添付の実測で設定値を確定し、上限が実利用可能性を損なわないことを確認します。

## 3. 初回同期と通常の確認

同期・受付ID登録・再照合は社員ログインで操作します。通常の窓口ログインで同期ボタンが出ないことは仕様です。

1. 「同期状態を更新」で現在の状態を取得し、進行中の同期があるか確認します。
2. 「メール同期」で正本Sheetの受付IDを登録します。画面に受付ID登録の続きが出た場合は、同じ画面の続行操作で末尾まで進めます。
3. 初回は全件同期になります。対象開始日は、最も古い有効受付日時のJST日付の前日です。受付なし・日時欠落・日時不正がある場合は公式窓口の全保存メールが対象です。画面の期間が業務受入範囲を含むことを開始時に照合します。
4. 「メール同期を続行」を押して列挙を完了させます。1回の操作は最大5通を処理するため、続行が必要な間は完了ではありません。下書きは対象外、spam/trash内の送受信済みメールは対象です。
5. 「照合待ち」で本文・添付と受付IDを確認し、理由を付けて既存案件へ紐付けるか対象外にします。確定済みの親メールを根拠に後続の返信を取り込むときは、明示的な再照合を末尾まで進めます。
6. 各案件、未確認メール、全件確認の残件を末尾まで確認します。本文と全添付の取得後に「確認済み」を明示操作します。取得完了だけでは、人が内容を読んだ記録になりません。

通常運用では、業務開始時と全件確認を判定する直前に手動で同期します。作業中に新着の有無を確認する場合も手動同期します。履歴位置が有効なら後続は履歴同期となり、失効時は全件同期へ戻ります。この手順は自動スケジュール・自動retryを作成しません。

画面の`基準日時`が確認対象の終点です。`最終成功`は処理が終わった時刻であり、その時刻までの新着をすべて取得した意味ではありません。全件同期中や履歴同期の基準日時後の新着は、次の履歴同期でも回収して確認します。

## 4. 失敗時の復旧

| 状態 | 操作 |
| --- | --- |
| 応答不明・timeout | 「同期状態を更新」で実状態を読み、保存済み結果と対象実行IDを確認する。同じ操作を新しい実行IDで再送しない。 |
| `同期中` / `MAIL_SYNC_BUSY` | 別の同期を開始せず状態を更新する。自分の実行なら続行し、進行担当が不明なら既存記録で照合する。 |
| `同期失敗` | 原因を解消後、同じ実行の「メール同期を再開」を明示操作する。自動retryにしない。 |
| 履歴失効 / 全件同期が必要 | 状態を更新して全件同期を開始し、再び末尾まで照合する。履歴失効前の成功時刻を現在の完了証拠にしない。 |
| 受付ID登録の変更・競合 | 正本Sheetの現在のID集合を確認し、状態更新後に受付ID登録からやり直す。進行中の実行がある場合は先にその状態を特定する。 |
| `MAIL_AUTH_REQUIRED` / scope不一致 | メール取得を止め、OAuth公開状態・期限・同意・scopeを確認する。窓口本人の再同意と新Secret versionが必要ならその操作だけを実施し、採用versionを配備設定へ反映する。権限を広げて回避しない。 |
| 本文・添付の取得不能 | 「全件確認の残件」から対象IDと添付を特定し、正本の存在・形式・認可を確認する。本文取得不能でも取得できる添付への経路を確認する。取得できない対象を確認済みへ変更しない。 |
| 紐付けの版競合 | メールの最新状態と履歴を読み直し、理由と対象を再判断する。古い版で上書きしない。 |

復旧記録には固定のエラーコード、実行ID、対象ID、発生・復旧時刻、採用版、実施操作と残件を残します。認可code/token、Secret、本文・添付bytesをログへ追加しません。

## 5. 大容量添付の実測

本実装は512KiB以下の応答に分割しますが、各応答のためにGmailから添付全体を取得します。添付サイズを`N`bytesとすると、初回の読取り回数は概ね`max(1, ceil(N / 524288))`回、Gmailからの取得量は概ね`N × 読取り回数`です。再取得は追加になります。

本番採用前に、利用が認められた小容量・代表容量・最大想定容量の画像/PDF/テキスト/その他形式で、全量到達、所要時間、timeout、Gmail API読取り回数、Cloud費用を実測します。合格に必要な待ち時間・最大想定容量と再取得手順を記録し、満たせなければ実装・配備設定を修正します。途中のchunkや末尾だけの取得で確認済みにできないことも確認します。0byte添付も明示取得の対象です。

## 6. 本番の受入

受入対象期間、同期基準日時、採用Git SHA・GAS version・Cloud Run revision/image digestを固定して、既存記録へ次を残します。

1. 正本Sheetの全受付IDと、対象期間の公式窓口の全送受信メールIDを照合する。合成受付は実顧客分と分ける。期間外・対象外メールの扱いは理由とともに確認する。
2. 全受付から受付本文・フォーム添付・関連メール本文・メール添付へ到達する。関連メールなしの受付は正本との照合根拠を記録する。
3. 照合待ち、未完了ページ、同期失敗、取得不能、本文/添付の未検証、種類不明の削除履歴、関連メール有無が未確認の受付を対象別・件数別に確認する。対象範囲に残るものを達成扱いにしない。
4. 利用者Aが本文・全添付を確認してメールを確認済みにし、別の利用者Bが最初の確認者と日時を読み戻す。再操作で最初の記録が変わらないこと、メール操作でSheetの対応状態・内部メモが変わらないことを確認する。
5. Chromeの実配備画面で主要操作を確認する。Edge・Firefoxの実配備画面試験は本人指定により省略し、PASSと記録しない。

`メール列挙完了`や`acceptanceReady`は技術的な進捗です。上記の正本照合と別利用者の読戻しが完了した場合だけ、「シートやメールボックスを探さず全件確認できる」と判定します。第1段階の受入・合成試験・手順作成だけでは、この業務受入を満たしません。

## 7. 巻戻し

1. 不具合の範囲、採用版と残件を記録し、必要な新規操作を止めます。対象不明の保存操作を繰り返しません。
2. GASを保全した第1段階の受入済みversionへ戻し、通常URLから受付本文・フォーム添付・状態・メモが利用できることを確認します。メール欄を残す場合は`MAIL_SERVICE_URL`を外して利用不可を明示します。
3. Cloud Runに前の受入済みrevisionがあれば、そのrevisionへtrafficを戻してimage digest・IAM・環境変数を読戻します。初回配備で復旧先がなければ、GASのメール呼出しを止めた状態を復旧先とします。
4. Sheet/DriveとFirestoreの確認・照合・監査記録は消去しません。Secretの失効・version変更やCloud資源の削除は別途必要性を判断します。
5. 第2段階の利用不可と確認範囲を記録し、必要なメールボックス確認へ戻します。原因修正後は影響を受けた同期・全件照合・確認記録読戻しをやり直して受入します。
