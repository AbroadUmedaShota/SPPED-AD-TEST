# 社内向けお問い合わせ確認 GAS

社員のSession認証と、外部例外1件の専用Google OAuthログインを備えた独立viewerです。
仕様は [社内確認アプリ仕様](../../../docs/画面設計/仕様/24_support_contact_workspace_viewer_requirements.md) を参照してください。

第1段階では件数をクリックできるステータスタブ、50件ごとの一覧ページ送り、ページを越える問い合わせの前後移動を提供します。既存Sheet・Driveの受付本文、フォーム添付、対応状態、内部メモを連続確認できます。送受信メールとメール添付の全件確認は第2段階の別受入です。

## 配備・設定（本変更では実行しない）

1. 配備者は `s-umeda@abroad-o.com`。新viewerの `Code.gs`、`OAuth.gs`、`Index.html`、`Login.html`、`appsscript.json` を会社アカウントの独立プロジェクトへ配置する。旧viewer・旧 `.clasp.json` は流用しない。
2. `SPREADSHEET_ID` / `DRIVE_FOLDER_ID` は既存と同じ値をScript Propertiesから参照する。`CONTACT_SHEET_NAME` は省略時 `contact_submissions`。Sheet/Driveの新規共有・保存先作成は行わない。
3. 親担当がGoogle Cloud側で専用のWebアプリケーションOAuthクライアントを設定する。外部アカウントの同意が可能な構成とし、テスト公開時は対象アカウントをテストユーザーに設定する。認可済みリダイレクトURIは **現在の新viewerのグローバル `/exec` URLそのもの**（`https://script.google.com/macros/s/<deployment>/exec`）。クエリ・フラグメント・`/a/<domain>/`・`/dev` は含めない。
4. 次のPropertiesを設定する。実値をコードやログに記録しない。公開installer/Properties変更RPCは設けない。

| Property | 用途 |
| --- | --- |
| `OAUTH_CLIENT_ID` | 専用OAuthクライアントID |
| `OAUTH_CLIENT_SECRET` | 同クライアントのsecret、サーバーのコード交換にのみ使用 |
| `OAUTH_REDIRECT_URI` | 上記の固定グローバル `/exec` URL。Google側の登録値と完全一致 |
| `OAUTH_HMAC_SECRET` | 任意の専用秘密鍵。省略時はclient secretでHMAC-SHA256。設定時は十分な乱数の秘密値を使う |

5. Web Appは `USER_DEPLOYING` / `ANYONE`（Googleログイン必須）。`ANYONE_ANONYMOUS` は使用しない。既存スコープに `script.external_request` を追加する。外部通信は固定のGoogle認可URLとトークンエンドポイントだけ。OAuth要求スコープは `openid email` のみで、Sheet/Driveの委任を求めない。
6. 社員も専用ログイン利用者も同じ通常 `/exec` URLをブックマークする。初期 `?id=` はOAuth往復後も維持する。GoogleのID/access/refresh tokenはURL・ブラウザ保存・クライアントcontextへ渡さない。専用ログインでは後述のタブ固有proofだけをsessionStorageへ保存し、TLS保護されたRPCの引数で提示する。proofをURLへ含めない。OAuth標準の一回限りの認可コードとstateはGoogleからcallbackのクエリへ戻るため、callback GETにはデータを出さず、同じタブのproofを提示する完了RPCに成功した場合だけ通常URLへのリンクを表示する。コードは再利用しない。

## 専用ログインと安全境界

- 社員はサーバーの `Session.getActiveUser().getEmail()` が厳密に `abroad-o.com` なら従来どおり利用できる。外部メール一致だけで通す旧例外は廃止した。
- 専用OAuthはサーバーに固定した `customer@speed-ad.com` だけ。ログインページ・認可URLは許可メールを表示せず、`login_hint` も送らない。社員以外の既知のSessionメールがこの対象と異なる場合、OAuth開始・grant発行・cached grant利用を拒否する。社員は自分のSession経路を使う。
- 通常URLの外部利用者にはメール/問い合わせ情報のないIndex画面枠だけを返す。最初のgetViewerContext RPCがタブproofとgrantを確認してから業務RPCを開始する。失敗時はデータを消して専用ログインへのリンクを示す。`?login=google` のLogin画面ではWebCryptoでproofを準備し、開始RPC `beginCustomerOAuthLogin(proofHash, submissionId)` が生成したGoogle認可URLへ明示的なリンクで進む。callback GETは認可コードとstateだけを安全なJSONでLoginへ渡し、自動grant発行をしない。`completeCustomerOAuthLogin(params, authProof)` で同じタブのproofを検証する。両RPCは認証用であり問い合わせを返さない。
- state/nonce/PKCE verifierは秘密鍵付きHMACで生成する。stateは600秒、単回使用。ScriptLock下でproofのhashと一時利用者キーの一致を検証してから削除し、ロック解除後にGoogleの固定HTTPSトークンエンドポイントへPOSTする。リダイレクトは追わずTLS検証を有効にする。
- `Session.getTemporaryActiveUserKey()` は **Google利用者とスクリプト単位の一時キー**。ブラウザやタブに固有とは扱わない。キーが空ならOAuth開始・callback・セッション利用を拒否する。stateとgrantは、この一時キーに加え、タブproofのSHA-256 hash・client ID・redirect設定のHMACに紐づく。一時キー単独の認可をしない。
- ID tokenはGoogleとの直接HTTPSコード交換からのみ取得し、クライアントから受け取らない。issuer/RS256/aud/azp/sub/exp/iat/nonce、厳密な対象メール、`email_verified: true`、`hd: speed-ad.com` を必須検証する。
- RSA署名の追加検証を行わない根拠は [Google公式OIDC第5節](https://developers.google.com/identity/openid-connect/openid-connect#obtainuserinfo) の直接HTTPS交換の例外。クライアント由来tokenや別の取得経路には適用しない。Workspaceの権威あるメール確認については [GoogleのID token検証ガイド](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token) を参照。
- タブproofはWebCrypto `getRandomValues` の32byte（256bit）を64桁hexにした秘密値で、LoginのsessionStorageにのみ保存する。新しいログイン開始時には既存値にかかわらずproofを毎回新規生成して上書きし、期限切れの旧proofを再認証で復活させない。callbackは開始時の既存proofを読むだけで新規生成しない。全業務RPCには共通callServerが末尾の任意 `authProof` 引数として提示する。更新から詳細取得への内部呼出しにも引き継ぐ。secretの代わりにそのhashを提示しても認証は成立しない。
- grantはScriptCache内のみ。token本体を保存せず、確認済みメール・sub・期限だけを保持する。有効期間はtoken期限と1時間の短い方。各RPCで再確認し、タブproof欠落/相違・キー変更・cache早期削除・期限切れ時は再ログインが必要。旧GASキー単独のgrantは新しいnamespace/versionで読まず、引き継がない。secret、client ID、redirect設定変更でも旧grantは利用できない。

## ローカル検証とライブ受入の境界

```powershell
node --test tests/support-contact-workspace-viewer.test.mjs
```

実際のCode.gs/OAuth.gsとUIをVMで動かし、Google通信・Session・Cache・Lock・Sheet/Drive境界だけを代替する。合成ID tokenによるテスト合格はGoogleログイン成功の証拠ではない。

一覧・連続確認の試験は253件の合成受付を使い、同一日時の全IDについて前後ページ、各状態タブ、検索、案件の前後移動を確認します。未保存メモの移動取消、後続ページの保存後位置、保存後の検索・状態条件外/一覧外表示、取得・保存待ちの入力停止、未取得/読込中/0件/不正応答、古い一覧・詳細応答と認証失効も含みます。合成253件を使ったChrome / Firefox / Edgeの主要操作確認は完了済みの検証証拠として扱います。本件第1段階の配備後受入では、Chromeの実配備画面でタブ・一覧・案件前後移動・詳細ID一致を確認し、実配備画面（IAB）と正本Sheet/Driveで全受付への到達、本文・フォーム添付の表示、対応状態・内部メモの保存後読戻しを確認します。Edge・Firefoxの実配備画面確認は本人指示により省略し、試験合格としては記録しません。追加のGmail認可・Cloud請求設定は第1段階に不要です。

**ライブ確認前はcustomer利用可能と判定しない。** 特に、Sessionメールが空になる外部利用時の一時キーが、認可開始・callback・通常URL・RPCで安定し、別のGoogle利用者とは分離されることを確認する。一時キーが同一でも、別ブラウザ/タブの異なるproofからgrantを利用できないことも負の試験で確認する。既知メールなしの別アカウントから同じURLを開く負の試験が必須。分離されなければ専用ログインの受入を止め、本人確認の代替や共有変更で回避しない。

対象customerの実ID tokenで `hd=speed-ad.com` とverified emailを確認することも未実施。claim欠落時は拒否を維持する。社員操作、通常URL再読込、初期id、保存ボタンとクイック操作、期限/キー変化/キャッシュ失効後の再認証、全対応ブラウザでの表示は配備後に確認する。本件第1段階の実配備画面確認だけは上記の受入範囲を適用する。旧viewerは維持する。

**統合hold継続:** 親担当・独立レビューでタブproof拘束の構造を確認し、実環境でLogin/callback/Index間のHTML Service originとsessionStorage継続性、WebCrypto、同じタブの再読込、異なるブラウザのproof分離を確認するまでcustomer完了/配備可とは判定しない。sessionStorageはブラウザのタブ複製やopenerによってコピーされ得るため、物理ブラウザの証明とは扱わない。同じproofを複製/持ち出した場合は同一セッション能力となる。通常導線は `_top` の同じタブとし、旧共通メールtokenやGoogle tokenのブラウザ保存を復活させない。

複数Googleアカウントのルーティング: 通常GETの `e.parameter.authuser` が1〜10桁の数字文字列なら、ログイン開始リンク→Loginテンプレート→開始RPCの任意第3引数→pending state→完了後の通常URLへ引き継ぐ。その他の値は捨てる。`authuser` はGoogleのアカウント選択維持のためのヒントだけで、認証・認可・grantの拘束条件には使わない。callback側のヒントは保存済みreturn routingを上書きしない。登録済みredirect URIとコード交換のredirect_uriはクエリなしのグローバル `/exec` 固定値を維持する。社員の既存RPC呼出しは変更しない。実際にauthuserがGASへ渡ること、同じHTML Service originの維持、customerの利用可否はライブ確認待ち。ヒント欠落時に本人情報を推定しない。

失敗の安全な診断: 開始/完了RPCは既知の内部エラーメッセージとの完全一致だけで `AUTH_CONFIG` / `AUTH_STATE` / `AUTH_PROOF` / `AUTH_IDENTITY` / `AUTH_PERMISSION` / `AUTH_TOKEN` / `AUTH_TOKEN_HTTP400` / `AUTH_TOKEN_NETWORK` に分類し、その他は `AUTH_UNKNOWN` とする。HTTP 400/他の非200では応答本文を読まない。Login側の元proof欠落・sessionStorage利用不可は `AUTH_TAB_STORAGE`。画面には固定コードのallowlistのみ表示し、任意の例外文・Google応答本文/description・code・token・メール・secretを出さない。診断用RPC/権限/認証fallbackは追加しない。これらのコードは原因の手掛かりであり、アクセス条件を緩める根拠にはしない。
