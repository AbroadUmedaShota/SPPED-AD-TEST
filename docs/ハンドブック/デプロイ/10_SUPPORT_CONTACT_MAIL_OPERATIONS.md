---
owner: shared-docs
status: infrastructure-prepared-not-deployed
last_reviewed: 2026-11-11
---

# お問い合わせ確認アプリ・メール連携の本番運用手順

第2段階の配備、手動同期、復旧、業務受入に使う手順です。画面・データの仕様は[仕様24](../../画面設計/仕様/24_support_contact_workspace_viewer_requirements.md)、RPCと同期の契約は[実行契約](../../../99_backend-docs/10_support-contact/mail-service/runtime/CONTRACT.md)を参照してください。

対象値を入力して段階ごとに実行するCLIと読戻しは[配備コマンド](11_SUPPORT_CONTACT_MAIL_DEPLOY_COMMANDS.md)を参照してください。変更コマンドは既定で計画表示だけを行い、対象・操作・費用条件を照合してから実行します。

この文書は配備と受入の手順です。2026-11-11時点で実行基盤の請求先・予算通知・API・Cloud資源と、親会社側のGmail認可専用projectは準備済みですが、Cloud Run配備、窓口Gmail同意、実メールの全件照合は完了していません。実行直前に状態を再照合し、対象project、region、Git SHA、GAS配備version、image digest、設定・検証結果を既存の切替・受入記録へ残します。秘密値や実メール本文は記録へ貼りません。

| 用途 | 準備済みのprojectと設定 | 残る確認 |
| --- | --- | --- |
| 窓口Gmail用OAuthの検証環境 | `speed-ad.com` 組織の `spd-contact-mail-oauth-261110`（番号 `47432854912`）。Gmail API有効、External / Testing、テスト利用者0件、宣言scopeは `gmail.readonly` のみ。Desktop client `SPEED AD Contact Mailbox - Gmail Readonly` を作成済み。請求先は紐付けていない。 | 本番用の資格情報・同意をこのprojectへ混在させない。 |
| 窓口Gmail用OAuthの本番環境（準備済み） | アブロードアウトソーシング株式会社の `abroad-o.com` 組織に `spd-contact-mail-prod-261110`（番号 `322596549698`）を作成。Gmail API有効、External / Testing、`gmail.readonly` のみ、Desktop client `SPEED AD Mailbox Production` 1件、テスト利用者0件。請求先未接続。第1段階ログイン用projectとは分ける。 | branding・公開案内、制限付きscope審査とセキュリティ評価、本人のGmail同意、Secret version登録、quota・費用。 |
| Cloud Run・Firestore・Secret Manager | `abroad-o.com` 組織の `spd-contact-viewer-20261110`。承認済み請求先、同project限定の月額3,000円予算通知、必要API、東京の保存先と専用サービスアカウントを準備済み。 | imageとCloud Run配備、数値固定のSecret version、GAS連携と実環境受入。 |

OAuth clientの所属projectとSecret保存先のprojectは別に照合します。実行基盤側の予算通知はOAuth側projectを含みません。この準備状況は本番受入の完了を示さず、以後の変更と読戻しは切替記録を正本にします。

本番のGmail認可専用projectを運営法人の管理組織へ置き、既存の子会社側projectは検証用にします。`customer@speed-ad.com` だけが本番Gmail読取りを認可し、`@abroad-o.com` 利用者は既存GASで本人確認します。Gmail用OAuthの変更範囲を第1段階のログイン設定から分離します。Cloud Runは実行基盤側のSecret Managerから窓口資格情報を取得するため、OAuth clientと実行基盤のprojectを一致させる必要はありません。窓口のGmail同意・refresh token・Secret version・実メール読取は未実施です。

アプリの業務利用者は組織をまたぐため、窓口本人だけがGmail認可することを根拠に[Internal用途の審査除外](https://support.google.com/cloud/answer/13464323?hl=en)を確定しません。[制限付きscopeの要件](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)に沿って、アプリ専用の公開ホーム・プライバシー案内、制限付きscope審査、サーバー処理に対する年次CASA評価の適用または除外根拠を本番接続前に確認します。[OAuthの本番ポリシー](https://developers.google.com/identity/protocols/oauth2/policies)はホームから利用規約とプライバシー方針へのリンクと、本番・試験用projectの分離を求めます。既存の公開 `/privacy/` はGmail取得・利用者への共有・保存期間の説明が不足しています。改訂案を作成し、公開条件を照合してから反映します。審査申請・公開と評価費用はそれぞれ別に判断します。

## 1. 接続前に確定すること

| 確認事項 | 進められる条件 |
| --- | --- |
| 公式窓口 | `customer@speed-ad.com` 本人がGmail読取に同意し、対象期間の受信・送信メールと添付がこのメールボックスに保存されている。別アカウントからの代理送信など、保存されない経路は先に特定する。 |
| 人による閲覧の同意記録 | 迷惑メール・ゴミ箱を含む対象期間の全送受信メール（下書き除外）の同期時本文照合と、認証済み `abroad-o.com` 社員全員・公式窓口による照合待ちを含む本文・添付の閲覧を説明する。マーカー整理時の全Gmail ID列挙（期間外・下書き・迷惑メール・ゴミ箱を含む）と一時hash集合の保存も説明する。窓口本人の明示入力後、Googleで窓口とscopeを確認し、説明全文・version・hash・同意日時・窓口を資格情報と同じSecret versionへ保存する。秘密を含まない成功receiptをprivate運用記録へ残す。 |
| OAuthの本番条件 | 実際のOAuth project所有組織、Audience、公開状態、要求scopeを確認し、`gmail.readonly` の審査・セキュリティ評価または適用除外の根拠を確定する。ドメイン名の違い、利用人数の少なさ、窓口1件だけという理由でInternal・個人利用の例外を推定しない。 |
| 継続認可 | ExternalかつTestingのOAuth projectでは、このscopeの認可とrefresh tokenは[7日で失効する](https://support.google.com/cloud/answer/15549945?hl=en)。本番の継続認可条件を整えてから窓口同意を取得する。毎週の再同意を本番運用の代用にしない。 |
| 費用 | Cloud Run、Firestore、Secret Manager、Artifact Registry、ビルドに使うサービスの請求先、予算、費用確認の担当と頻度を確定する。審査・評価に費用が発生する場合はCloud利用料と分けて判断する。 |
| 配備対象 | project、region、Firestore database ID、Cloud Runサービス名、実行サービスアカウント、Secret名、GAS配備IDと復旧候補versionを確定する。Firestoreの配置場所は作成前に決める。 |

Googleの条件は[制限付きscopeの審査・例外](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)と[refresh tokenの失効条件](https://developers.google.com/identity/protocols/oauth2#expiration)で実行時に再確認します。既存viewerの本人確認用OAuthと、窓口Gmail読取用OAuth clientを取り違えないでください。

予算通知や[spend cap](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)を利用する場合は対象サービスと停止範囲を確認し、Cloud Run以外も含む総費用の上限とは扱いません。Firestore・Secret Manager・image保存・ビルドを含めて費用を確認し、超過時に止める操作を決めます。

## 2. 配備する順序

各行の読戻しに成功してから次へ進みます。APIの有効化、請求接続、IAM変更、Secret登録、配備の実施は、対象と適用される承認を照合して行います。

| 順序 | 操作 | 読戻し・停止条件 |
| --- | --- | --- |
| 1 | 現行GASの配備version、コード、manifest、Script Propertiesの設定名、Sheet/Drive参照先を保全する。 | 現行第1段階の利用経路と復旧先を特定する。secretの値を出力しない。 |
| 2 | 窓口Gmail読取用のOAuth project/clientを作成するか既存設定を確認し、Audience・公開状態・宣言scope・審査/評価または適用除外を本番用に確定する。認可補助ツールを使う場合はDesktop clientを用意する。 | clientの所属projectと用途、`gmail.readonly`だけの要求、本番で継続可能な公開・審査状態または文書化した適用除外を確認する。未確定またはExternal/Testingのままなら窓口同意へ進まない。 |
| 3 | 承認済み請求先と費用管理を設定し、Run、Firestore、Secret Manager、Gmail、Artifact Registry、必要なビルドAPIを有効化する。 | projectとAPI一覧、請求状態を再取得する。使わないビルドAPIは追加しない。 |
| 4 | Cloud Run専用実行サービスアカウント、Firestore database、Secret、image保存先を作成する。 | 実行アカウントにはFirestore操作と対象Secretの読取りに必要な権限だけを付ける。ブラウザや一般利用者へFirestore/Secretを直接共有しない。 |
| 5 | [index定義](../../../99_backend-docs/10_support-contact/mail-service/runtime/firestore.indexes.json)を対象databaseへ反映する。 | 必要indexが利用可能になるまで待つ。index作成中の一覧失敗を0件と扱わない。 |
| 6 | 手順2で確定したclientを使い、窓口本人の同意でscopeが正確に`gmail.readonly`だけの資格情報をSecret Managerへ登録する。 | [データ管理・削除の案内](../運用/09_SUPPORT_CONTACT_MAIL_DATA_CONTROL.md)に従い、案件終了後3年間の保存方針を実施する手段と削除申請先を先に確認する。[認可補助ツール](../../../99_backend-docs/10_support-contact/mail-service/README.md#公開前に必要な設定と判断)へ実施説明と申請先メールを渡し、本人が説明へ対話的に同意する。code/tokenを端末ファイル・ログへ出さず、登録先Secretとversionを確認する。 |
| 7 | 下記の検証・imageビルドを行い、承認済みimage保存先へpushする。 | [配備コマンドの送信元確認](11_SUPPORT_CONTACT_MAIL_DEPLOY_COMMANDS.md#4-imageビルドとdigest固定)で採用SHAの`mail-service`だけを列挙し、送信ファイル24件の完全一致を確認する。Git SHAとimage digestを対応付ける。ビルド未実施をテスト合格で代用しない。 |
| 8 | GAS開発版へメール連携コードと`openid` scopeをpushし、配備者本人が再認可してID tokenの必要claimsだけを確認する。 | 公開配備ID・versionは保全値のまま。tokenを表示せず、実GASのaudience・配備者subject/emailを取得する。窓口ログイン用clientから推定しない。 |
| 9 | Cloud RunをIAM認証必須で配備する。 | `allUsers`を付けない。GAS配備者だけにinvokerを付け、手順8で確認したaudienceをcustom audienceへ登録する。特定の正規Secret versionとbuild/Registryで一致したimage digestを使う。[Cloud Runの認証](https://docs.cloud.google.com/run/docs/authenticating/service-to-service)を参照する。 |
| 10 | GASの固定`MAIL_SERVICE_URL`を設定し、一時claims関数を除いた採用コードから最終versionを作成して公開配備する。 | 配備ID・version・コード・scope・設定を読戻す。既存Sheet/Drive参照先と利用者認証を維持する。 |
| 11 | 社員と窓口の利用経路、IAM拒否、メール読取、実Firestore更新とindexを実環境で確認する。 | 確認者が配備者へ置き換わらず、実利用者として記録される。認証失敗時は業務データが消える。 |

Cloud Runの設定は次の対応で照合します。値はrepoへ保存せず、実tokenをログへ出して取得しないでください。

GASの第2段階反映前に、正本Sheetとヘッダー・全行を保全し、先頭17列の名前・順序・各値の意味が公開フォームの `gas/Code.gs` の `CONTACT_HEADERS` と一致することを照合します。18列目の `closed_at` は2026-11-11時点で追加済みで、既存の対応済み3件にも本人指定の終了日時が入力されています。配備時はこの列の位置と全行の値を読戻し、既存値を機械的に空欄へ戻したり再入力したりしません。列の欠落・順序不一致や予期しない値があれば公開フォームの自動ヘッダー修復に任せず、データの対応と切替記録を確認して停止します。合成受付の追加後も既存の内部メモ・終了日時が保持されることを確認します。viewerは列の欠落・順序不一致で停止し、自動作成しません。

現行の第1段階配備版は `closed_at` を更新しません。終了日時を入力した時点から第2段階への切替まで、3件それぞれの再開・再完了をSheet版履歴と運用記録で追跡し、現在の終了日時が実際の終了日と一致することを確認します。状態が一度でも再開された行は、再完了の根拠日時へ訂正するか、日時を確定できなければ空欄にして読戻します。履歴を追跡できない行も終了日を個別に再確認し、確定できなければ空欄にします。対象を特定できなければ既存3件すべてを終了日未確認として扱い、確認・必要な訂正が済むまで期限削除を開始しません。`handled_at` はメモ保存でも変わるため、日時の大小だけで再完了と判定しません。

| 設定 | 内容 |
| --- | --- |
| `MAIL_SCRIPT_AUDIENCE` | `ScriptApp.getIdentityToken()`で使われるGAS自身のOAuth client ID。窓口ログイン用client IDから推定しない。 |
| `MAIL_DEPLOYER_EMAIL` / `MAIL_DEPLOYER_SUBJECT` | 検証済みGAS配備者のemailとsubject。 |
| `MAILBOX_OAUTH_SECRET_VERSION` | Project IDとproject numberを照合して観測したSecretの正規名に属する、数値で固定した特定version。認可前・登録後・Cloud Runで同じ対象を照合する。 |
| `FIRESTORE_DATABASE_ID` | default以外を使う場合のdatabase ID。 |

2026-11-10の確認時点で作業PCにはDockerがなく、imageビルドは未実施です。Dockerが利用できる環境では、採用するGit SHAの`99_backend-docs/10_support-contact/mail-service/`を作業ディレクトリにして下記を実行します。`IMAGE_REFERENCE`は承認済み保存先とSHAに対応するタグへ置き換えます。

```powershell
npm ci --ignore-scripts
npm test
docker build -f runtime/Dockerfile -t IMAGE_REFERENCE .
```

remote buildは代替手段ですが、請求先・費用・実行権限・利用するビルドサービスを承認した後に選びます。Docker不在だけを理由にremote buildを開始しません。いずれの方法でもimage digestとビルド結果の読戻しが必要です。

リポジトリ直下ではGAS側の対象試験を実行します。

```powershell
node --test tests/support-contact-workspace-viewer.test.mjs tests/support-contact-mail-viewer.test.mjs
git diff --check
```

最初のCloud Run設定は、最小instanceを0にし、承認したinstance上限・CPU/メモリ・timeoutを記録します。費用、応答時間、添付の実測で設定値を確定し、上限が実利用可能性を損なわないことを確認します。

## 3. 初回同期と通常の確認

同期・受付ID登録・再照合は社員ログインで操作します。通常の窓口ログインで同期ボタンが出ないことは仕様です。

1. 「同期状態を更新」で現在の状態を取得し、進行中の同期があるか確認します。
2. 「メール同期」で正本Sheetの受付IDを登録します。最初に画面がsnapshot IDを作り、書込み前に正本のdigest・件数・対象期間を読みます。同じ計画で最大5ページずつ登録し、応答不明時もsnapshotとページ位置を保持します。正本が変わっている場合は競合として停止します。画面に受付ID登録の続きが出た場合は、同じ画面の続行操作で末尾まで進めます。
3. 初回は全件同期になります。全受付日時が有効な場合、対象開始日は最古受付日時のJST日付の前日です。受付なし・日時欠落・日時不正がある場合は`MAIL_PERIOD_REQUIRED`で停止します。正本の日時と業務受入範囲を確定してから再開し、全保存メールへ自動で広げません。開始日が保存済み期間と変わった場合は全同期へ切り替わります。期間外の旧metadata・監査記録は保持されますが、現在の一覧・件数・本文・添付・確認操作から除外されます。
4. 同期操作は画面内で最大20成功バッチ（1要求最大5通、概ね100通）まで続行します。上限に達したら「メール同期を続行」を押して次へ進み、列挙を完了させます。各応答で進捗を確認でき、失敗や応答不明では止まります。「同期の続行を止める」は次の要求を止める操作で、送信済みの処理は応答を待ちます。下書きは対象外、spam/trash内の送受信済みメールは対象です。
5. 「照合待ち」で本文・添付と受付IDを確認し、理由を付けて既存案件へ紐付けるか対象外にします。確定済みの親メールを根拠に後続の返信を取り込むときは、明示的な再照合を末尾まで進めます。
6. 各案件、未確認メール、全件確認の残件を末尾まで確認します。本文と全添付の取得後に「確認済み」を明示操作します。関連メール0件の案件は、同期と照合の残件を解消したうえで、案件画面から対象期間の「関連メールなし」を明示確認します。確認者・日時・対象期間を別の利用者が読み戻し、同期範囲や分類が変わった場合は再確認します。取得完了や0件表示だけでは、人が確認した記録になりません。

通常運用では、業務開始時と全件確認を判定する直前に手動で同期します。作業中に新着の有無を確認する場合も手動同期します。履歴位置が有効なら後続は履歴同期となり、失効時は全件同期へ戻ります。この手順は自動スケジュール・自動retryを作成しません。

画面の`基準日時`が確認対象の終点です。`最終成功`は処理が終わった時刻であり、その時刻までの新着をすべて取得した意味ではありません。全件同期中や履歴同期の基準日時後の新着は、次の履歴同期でも回収して確認します。

## 4. 失敗時の復旧

| 状態 | 操作 |
| --- | --- |
| 応答不明・timeout | 同期RPCは120秒で画面の応答待ちを終了し、自動再試行しない。サーバー側の終了とは扱わない。「続行」は同じ要求ID・元の計画と開始日で読取り専用レシート照会を行う。Sheetの受付日訂正や受付追加があっても元要求を別内容にしない。保存済み結果が未作成・不正なら未確定のまま停止する。「同期状態を更新」で同じ実行の失敗を確認した場合は新しい要求IDで明示再開する。新しい実行IDで再送しない。 |
| `同期中` / `MAIL_SYNC_BUSY` | 別の同期を開始せず状態を更新する。応答不明後の再確認でbusyが返っても、元の実行ID・要求ID・内容を保持する。自分の実行なら同じ要求を明示再確認し、進行担当が不明なら既存記録で照合する。 |
| `同期失敗` | 原因を解消後、同じ実行の「メール同期を再開」を明示操作する。自動retryにしない。 |
| 履歴失効 / 全件同期が必要 | 状態を更新して全件同期を開始し、再び末尾まで照合する。履歴失効前の成功時刻を現在の完了証拠にしない。 |
| 受付ID登録の変更・競合 | 応答不明後は元の計画を保持する。正本Sheetの現在のID集合を確認し、「受付IDの計画を破棄して作り直す」で明示的に破棄した後、メール同期を押して現在のSheetから登録し直す。破棄は送信済み処理の中止を意味しない。進行中の同期実行がある場合は先にその状態を特定する。 |
| GAS事前確認でCloud未送信 | 画面に「Cloudへ送信していません」と出た場合は、GAS内で送信前の停止を確定した結果である。正本変更・読取り失敗なら計画が解除されるため、現在のSheetで明示的に作り直す。受付日時の欠落・不正、固定URLの設定不備やID token取得失敗なら、回復後の続行で保持した同じ未送信要求を送る。送信後の認証エラー・通信不明やレシート照会自体の認証失敗には適用しない。 |
| `MAIL_PERIOD_REQUIRED` | 正本Sheetの全受付日時と対象期間を確認する。空欄・不正日付を推定で補わず、確定した正本を読み直す。初回の計画準備前なら新しい全同期を開始する。GASがCloud未送信を確定し元要求を保持している場合は、回復後の続行で同じ要求を送る。開始日未確定の残件数は不明のまま扱う。 |
| `MAIL_AUTH_REQUIRED` / scope不一致 | メール取得を止め、OAuth公開状態・期限・同意・scopeを確認する。窓口本人の再同意と新Secret versionが必要ならその操作だけを実施し、採用versionを配備設定へ反映する。権限を広げて回避しない。 |
| 本文・添付の取得不能 | 「全件確認の残件」から対象IDと添付を特定し、正本の存在・形式・認可を確認する。本文取得不能でも取得できる添付への経路を確認する。取得できない対象を確認済みへ変更しない。 |
| 紐付けの版競合 | メールの最新状態と履歴を読み直し、理由と対象を再判断する。古い版で上書きしない。 |

復旧記録には固定のエラーコード、実行ID、対象ID、発生・復旧時刻、採用版、実施操作と残件を残します。認可code/token、Secret、本文・添付bytesをログへ追加しません。

## 5. 大容量添付の実測

本実装は元サイズ・配信サイズとも64MiBまでを512KiB以下の応答に分割します。Gmail adapterは取得応答をプロセス内に1添付だけ保持し、アイドル120秒・取得開始から絶対5分で破棄します。同じinstanceのcache hitではGmailへの添付読取りは増えません。別instance、期限切れ、再起動、別添付への切替では全量再取得します。最悪時の読取り回数は概ね`max(1, ceil(N / 524288))`回、取得量は`N × 読取り回数`となり、再取得は追加です。cacheは本文・添付の永続保存を追加しません。

base64応答は64MiBの約4/3に膨らみ、デコード・安全化・digest計算・応答JSONには一時メモリも必要です。初回配備候補はCloud Runのメモリ1GiB・同時実行数1とし、実測で確定します。同じinstanceで別添付を取得中の`MAIL_ATTACHMENT_BUSY`は一時待機として扱い、完了後にボタンから明示再取得します。取得不能へ書き換えたり、自動再試行したりしません。

本番採用前に、利用が認められた小容量・代表容量・最大想定容量の画像/PDF/テキスト/その他形式で、全量到達、所要時間、timeout、Gmail API読取り回数、Cloud費用を実測します。合格に必要な待ち時間・最大想定容量と再取得手順を記録し、満たせなければ実装・配備設定を修正します。途中のchunkや末尾だけの取得で確認済みにできないことも確認します。0byte添付も明示取得の対象です。

## 6. 本番の受入

受入対象期間、同期基準日時、採用Git SHA・GAS version・Cloud Run revision/image digestを固定して、既存記録へ次を残します。

1. 正本Sheetの全受付IDと、対象期間の公式窓口の全送受信メールIDを照合する。合成受付は実顧客分と分ける。期間外・対象外メールの扱いは理由とともに確認する。
2. 全受付から受付本文・フォーム添付・関連メール本文・メール添付へ到達する。関連メールなしの受付は、アプリに保存された確認者・日時・対象期間を読み戻し、独立したGmail全ID照合でメールの欠落がないことを確認する。
3. 照合待ち、未完了ページ、同期失敗、取得不能、本文/添付の未検証、種類不明の削除履歴、関連メール有無が未確認の受付を対象別・件数別に確認する。対象範囲に残るものを達成扱いにしない。
4. 利用者Aが本文・全添付を確認してメールを確認済みにし、別の利用者Bが最初の確認者と日時を読み戻す。再操作で最初の記録が変わらないこと、メール操作でSheetの対応状態・内部メモが変わらないことを確認する。
5. Chromeの実配備画面で主要操作を確認する。Edge・Firefoxの実配備画面試験は本人指定により省略し、PASSと記録しない。

ID照合は[独立照合CLIとmanifest契約](../../../99_backend-docs/10_support-contact/mail-service/tools/ACCEPTANCE.md)に従い、同じrun・期間・keyで正本Sheet、同期の検索式を使わないGmail全ID列挙、Firestore snapshotのmanifestを採取して実行する。source不完全、重複、不一致、未確認内容を達成扱いにしない。Gmail全ID採取は同意文に受入照合目的を追加し、Google認可・共有条件を解決してから開始する。CLIのPASSは、上記の画面確認・フォーム添付・別利用者読戻しを代替しない。

`メール列挙完了`や`acceptanceReady`は技術的な進捗です。上記の正本照合と別利用者の読戻しが完了した場合だけ、「シートやメールボックスを探さず全件確認できる」と判定します。第1段階の受入・合成試験・手順作成だけでは、この業務受入を満たしません。

## 7. 巻戻し

1. 不具合の範囲、採用版と残件を記録し、必要な新規操作を止めます。対象不明の保存操作を繰り返しません。`closed_at`を更新しない旧版へ戻す場合は、先に期限削除を停止し、停止を確認します。
2. GASを保全した第1段階の受入済みversionへ戻し、通常URLから受付本文・フォーム添付・状態・メモが利用できることを確認します。メール欄を残す場合は`MAIL_SERVICE_URL`を外して利用不可を明示します。
3. Cloud Runに前の受入済みrevisionがあれば、そのrevisionへtrafficを戻してimage digest・IAM・環境変数を読戻します。初回配備で復旧先がなければ、GASのメール呼出しを止めた状態を復旧先とします。
4. Sheet/DriveとFirestoreの確認・照合・監査記録は消去しません。Secretの失効・version変更やCloud資源の削除は別途必要性を判断します。
5. 巻戻し中の状態更新は、対象ID・変更前後の状態・操作時刻を管理記録で全件追跡します。旧版は再開・再完了しても古い`closed_at`を残すため、現行版へ戻すだけでは信頼を回復できません。復旧後は影響した全案件の終了日時を根拠から再確認するか空へ戻し、空は終了日未確認として期限削除から除外します。追跡漏れがあれば全終了日時を未確認として扱い、照合完了まで期限削除を再開しません。メモ保存でも`handled_at`が変わるため、日時の大小だけで自動判定しません。
5. 第2段階の利用不可と確認範囲を記録し、必要なメールボックス確認へ戻します。原因修正後は影響を受けた同期・全件照合・確認記録読戻しをやり直して受入します。

### 終了日時カタログの切替

第2段階の終了日時列移行後、受付IDだけの旧snapshotを流用せず、状態・終了日時を含む正本カタログを新規登録する。終了日未確認と保存期限到来の件数・対象を確認し、空の終了日をhandled_atから埋めない。期限到来は削除完了ではないため、管理者の削除処理と再取込防止の受入が終わるまで達成と扱わない。カタログの期限計算はUTCの3暦年後（2月29日は2月28日へ調整）。除外メールの記録は除外確定から3年の別起算日で削除処理へ引き渡す。
