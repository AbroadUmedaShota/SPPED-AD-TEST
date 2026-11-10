---
owner: shared-docs
status: prepared-not-executed
last_reviewed: 2026-11-10
---

# お問い合わせメール連携・配備コマンド

[本番運用手順](10_SUPPORT_CONTACT_MAIL_OPERATIONS.md)の配備順序をPowerShell 7で実行するための補足です。以下は未実行の手順です。請求・費用、OAuthの本番条件、窓口本人の同意、配備対象と権限変更の条件は先に確定します。コマンドを用意したことは、その承認や本番受入の証拠にはなりません。

一括実行せず、各段階の読戻しに成功してから次へ進みます。作成対象が既存ならcreateを再実行せず、設定と所有者を照合します。応答不明の変更は実状態を読んでから判断します。認可code/token、OAuth client secret、Secretの内容を引数・ファイル・出力へ置きません。

## 1. 対象値と実行ガード

値は承認記録から入力し、この文書やrepoへ実値を保存しません。`GasDeployerSubject`と`GasAudience`は手順5で開発版へ`openid`を反映・再認可した後に実GAS ID tokenのclaimsから取得します。最初の入力条件にはせず、Cloud Run配備前に必須とします。token自体を表示しません。Firestoreの配置場所とCloud Runの配置場所はそれぞれ確定します。最初のCPU・メモリ・timeout・同時実行数・最大instance数も費用と添付実測を踏まえて採用する値です。

```powershell
$ErrorActionPreference = 'Stop'
$ProjectId = '<approved-project-id>'
$ApprovedProjectId = '<same-approved-project-id>'
$Region = '<approved-run-and-registry-region>'
$FirestoreLocation = '<approved-firestore-location>'
$DatabaseId = '<approved-database-id-or-(default)>'
$Repository = '<approved-docker-repository>'
$Service = '<approved-cloud-run-service>'
$RuntimeAccountId = '<approved-runtime-account-id>'
$BuildAccountId = '<approved-build-account-id>'
$SourceBucket = '<approved-globally-unique-build-source-bucket>'
$SecretId = '<approved-mailbox-secret-id>'
$GasDeployerEmail = '<verified-gas-deployer-email>'
$GitSha = '<adopted-40-character-git-sha>'
$Cpu = '<approved-cpu>'
$Memory = '<approved-memory-e.g.-1Gi>'
$Timeout = '<approved-timeout-e.g.-120s>'
$Concurrency = '<approved-concurrency>'
$MaxInstances = '<approved-max-instances>'
$ApplyChanges = $false

$required = @($ProjectId, $ApprovedProjectId, $Region, $FirestoreLocation,
  $DatabaseId, $Repository, $Service, $RuntimeAccountId, $BuildAccountId,
  $SourceBucket, $SecretId, $GasDeployerEmail,
  $GitSha, $Cpu, $Memory, $Timeout, $Concurrency, $MaxInstances)
if ($required.Where({ [string]::IsNullOrWhiteSpace($_) -or $_ -match '[<>\r\n,]' }).Count) {
  throw 'Replace every placeholder with the approved value.'
}
if ($ProjectId -cne $ApprovedProjectId -or $GitSha -notmatch '^[a-f0-9]{40}$') {
  throw 'Project or adopted SHA does not match.'
}
$RuntimeEmail = "$RuntimeAccountId@$ProjectId.iam.gserviceaccount.com"
$BuildEmail = "$BuildAccountId@$ProjectId.iam.gserviceaccount.com"
$ImageTag = "$Region-docker.pkg.dev/$ProjectId/$Repository/contact-mail:$GitSha"
$RepositoryRoot = (git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Git worktree root could not be read.' }
$MailServiceDirectory = (Resolve-Path -LiteralPath (
  Join-Path $RepositoryRoot '99_backend-docs/10_support-contact/mail-service')).Path
Set-Location -LiteralPath $MailServiceDirectory

function Assert-MailServiceSource {
  if ([IO.Path]::GetFullPath((Get-Location).Path) -ine
      [IO.Path]::GetFullPath($MailServiceDirectory)) {
    throw 'Run this step from the adopted mail-service directory.'
  }
  $currentSha = (git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $currentSha -cne $GitSha) {
    throw 'Mail-service source SHA differs from the adopted SHA.'
  }
  $changes = @(git status --porcelain)
  if ($LASTEXITCODE -ne 0 -or $changes.Count -ne 0) {
    throw 'Build source worktree is not clean.'
  }
}

function Invoke-ApprovedChange {
  param([ValidateSet('gcloud', 'clasp')][string]$Tool, [string[]]$Arguments)
  if (-not $ApplyChanges) {
    Write-Output ([pscustomobject]@{ PlanOnly = $true; Tool = $Tool; Arguments = $Arguments } | ConvertTo-Json -Depth 3)
    return
  }
  if ($ProjectId -cne $ApprovedProjectId) { throw 'Project changed after approval.' }
  & $Tool @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Tool failed; read back before continuing." }
}
```

既定では変更コマンドの引数を表示するだけです。対象・操作・費用条件の照合後、その段階を実行するときだけ`$ApplyChanges = $true`にし、直後に`$false`へ戻します。`gcloud config set project`には依存せず、全Cloudコマンドに`--project`を付けます。

採用SHAのcleanなworktreeで以下を読み、請求先無効、対象の不一致、未承認のAPI・権限・費用があれば停止します。

```powershell
git status --short
git rev-parse HEAD
gcloud auth list --filter=status:ACTIVE --format='value(account)'
gcloud projects describe $ProjectId --project=$ProjectId
gcloud billing projects describe $ProjectId --project=$ProjectId
gcloud services list --enabled --project=$ProjectId --format='value(config.name)'
```

`HEAD == $GitSha`と未関連変更なしを目視照合します。請求接続やOAuth公開状態の変更はこの手順で自動実行しません。

## 2. API・専用アカウント・保存先

下記はCloud Buildを採用する場合です。Cloud Buildの実行者には承認済みのbuild実行権限、buildアカウントの`iam.serviceAccounts.actAs`、source bucketへのアップロード権限が必要です。権限不足をOwner付与で回避しません。

```powershell
Invoke-ApprovedChange gcloud @('services', 'enable', 'run.googleapis.com',
  'firestore.googleapis.com', 'secretmanager.googleapis.com', 'gmail.googleapis.com',
  'artifactregistry.googleapis.com', 'cloudbuild.googleapis.com', '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('iam', 'service-accounts', 'create', $RuntimeAccountId, '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('iam', 'service-accounts', 'create', $BuildAccountId, '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('firestore', 'databases', 'create', '--database', $DatabaseId,
  '--location', $FirestoreLocation, '--type', 'firestore-native', '--edition', 'standard',
  '--delete-protection', '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('artifacts', 'repositories', 'create', $Repository,
  '--repository-format', 'docker', '--location', $Region, '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('storage', 'buckets', 'create', "gs://$SourceBucket",
  '--location', $Region, '--uniform-bucket-level-access', '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('secrets', 'create', $SecretId,
  '--replication-policy', 'user-managed', '--locations', $Region, '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('projects', 'add-iam-policy-binding', $ProjectId,
  '--member', "serviceAccount:$RuntimeEmail", '--role', 'roles/datastore.user', '--condition=None', '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('secrets', 'add-iam-policy-binding', $SecretId,
  '--member', "serviceAccount:$RuntimeEmail", '--role', 'roles/secretmanager.secretAccessor', '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('artifacts', 'repositories', 'add-iam-policy-binding', $Repository,
  '--location', $Region, '--member', "serviceAccount:$BuildEmail",
  '--role', 'roles/artifactregistry.writer', '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('projects', 'add-iam-policy-binding', $ProjectId,
  '--member', "serviceAccount:$BuildEmail", '--role', 'roles/logging.logWriter', '--condition=None', '--project', $ProjectId)
Invoke-ApprovedChange gcloud @('storage', 'buckets', 'add-iam-policy-binding', "gs://$SourceBucket",
  '--member', "serviceAccount:$BuildEmail", '--role', 'roles/storage.objectViewer', '--project', $ProjectId)
```

API一覧、`gcloud iam service-accounts describe EMAIL`、`gcloud firestore databases describe --database=$DatabaseId`、`gcloud artifacts repositories describe $Repository --location=$Region`、`gcloud secrets describe $SecretId`と各`get-iam-policy`を、同じ`--project=$ProjectId`で読み戻します。runtimeは専用projectのFirestore操作と対象Secretの読取り、builderは対象repositoryへのpush・source読取り・build log書込みを照合します。既存の想定外grantがあれば停止し、必要性を判断します。

Compute Engine既定SA（`PROJECT_NUMBER-compute@developer.gserviceaccount.com`）に`roles/editor`があっても、その存在だけで削除しません。まずproject IAMと、実際に有効なCompute/Run/Functions/Build等の実行・buildアカウントを読み戻し、依存資源・代替権限・影響確認の記録を残します。API未有効・取得失敗・一部regionだけの空一覧を「依存なし」と扱いません。Cloud Buildの既定SAと、`service-PROJECT_NUMBER@compute-system.iam.gserviceaccount.com`等のGoogle管理service agentも区別します。対象の依存確認と役割削除の承認が揃った場合だけ、そのprincipalのEditor bindingを別操作として変更し、前後のIAM・依存機能を再確認します。この手順はEditorを一括削除しません。[既定SAと役割](https://docs.cloud.google.com/compute/docs/access/service-accounts)

## 3. Firestore indexと窓口認可

採用SHAの`mail-service`ディレクトリから、**その版のindex定義全体**を使います。既存indexをlistし、fieldsの順序・queryScope・databaseまで一致するものは作成しません。次のloopは新規databaseの初回用です。既存databaseでは不足分だけを選び、不要indexを削除しません。

```powershell
Assert-MailServiceSource
$indexes = (Get-Content -Raw -LiteralPath 'runtime/firestore.indexes.json' | ConvertFrom-Json).indexes
foreach ($index in $indexes) {
  $indexArguments = @('firestore', 'indexes', 'composite', 'create', '--project', $ProjectId,
    '--database', $DatabaseId, '--collection-group', $index.collectionGroup,
    '--query-scope', $index.queryScope.ToLowerInvariant())
  foreach ($field in $index.fields) {
    if (-not $field.order) { throw 'Unsupported index field; review the definition.' }
    $indexArguments += "--field-config=field-path=$($field.fieldPath),order=$($field.order.ToLowerInvariant())"
  }
  Invoke-ApprovedChange gcloud $indexArguments
}
gcloud firestore indexes composite list --database=$DatabaseId --project=$ProjectId --format=json
```

全定義が`READY`になるまで次へ進みません。作成応答だけで集計成功と判定せず、配備後の一覧・残件集計で実クエリを確認します。[index作成CLI](https://docs.cloud.google.com/sdk/gcloud/reference/firestore/indexes/composite/create)

窓口認可の前に、Project IDから観測したproject numberとSecretの正規名を照合します。Secret Managerの応答はProject IDをproject numberへ正規化するため、文字列をProject IDのまま組み立てて比較しません。

```powershell
$projectMetadata = gcloud projects describe $ProjectId --project=$ProjectId --format=json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $projectMetadata.projectId -cne $ProjectId -or
    $projectMetadata.projectNumber -notmatch '^[0-9]+$') { throw 'Project metadata mismatch.' }
$secretMetadata = gcloud secrets describe $SecretId --project=$ProjectId --format=json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Secret metadata readback failed.' }
$CanonicalSecretName = $secretMetadata.name
$ExpectedSecretName = "projects/$($projectMetadata.projectNumber)/secrets/$SecretId"
if ($CanonicalSecretName -cne $ExpectedSecretName) { throw 'Canonical Secret target mismatch.' }
```

[既存の認可補助ツール](../../../99_backend-docs/10_support-contact/mail-service/README.md#公開前に必要な設定と判断)の`--secret`には、上で観測した`$CanonicalSecretName`を渡します。承認済みDesktop client・本人同意・正確な`gmail.readonly` scopeを確認して実行し、このガイドへclient secretやrefresh tokenを貼りません。ツールが返した正規名付きの特定versionを`$SecretVersion`へ入力して次を確認します。

```powershell
$SecretVersion = '<observed-canonical-secret-version>'
$versionPattern = '^' + [regex]::Escape($CanonicalSecretName) + '/versions/([1-9][0-9]*)$'
if ($SecretVersion -notmatch $versionPattern) { throw 'Canonical numeric Secret version required.' }
$VersionNumber = $Matches[1]
$versionMetadata = gcloud secrets versions describe $VersionNumber --secret=$SecretId --project=$ProjectId --format=json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $versionMetadata.name -cne $SecretVersion -or
    $versionMetadata.state -cne 'ENABLED') { throw 'Secret version readback mismatch.' }
```

version読戻しのCLIには短い`SecretId`と明示`ProjectId`を渡します。正規名全体を`--secret`へ入れてパスを二重化しません。応答の`name`は上で観測した正規version名と完全一致させ、この同じ`$SecretVersion`をCloud Runまで保持します。`versions access`は使いません。

## 4. imageビルドとdigest固定

採用SHAの`mail-service`で既存の`npm ci --ignore-scripts`と`npm test`を通します。`Assert-MailServiceSource`は作業場所・SHA・cleanなworktreeを照合し、`gcloud meta list-files-for-upload`の結果が下記25ファイルと完全一致した場合だけビルドへ進みます。[`.gcloudignore`](../../../99_backend-docs/10_support-contact/mail-service/.gcloudignore)はruntimeコードとlockfile等だけを許可し、認可補助ツール・合成データ・node_modules・ローカル資格情報を送信しません。採用版でファイル構成を変えた場合は、その変更をレビューして期待リストも更新します。

```powershell
Assert-MailServiceSource
$expectedUploadFiles = @(
  'attachmentLimits.mjs', 'classification.mjs', 'mime.mjs',
  'package-lock.json', 'package.json', 'review.mjs', 'safeMail.mjs', 'sync.mjs',
  'runtime/attachmentCache.mjs', 'runtime/attachmentObservation.mjs',
  'runtime/auth.mjs', 'runtime/caseRetention.mjs', 'runtime/cloudbuild.yaml',
  'runtime/Dockerfile', 'runtime/errors.mjs', 'runtime/firestoreStore.mjs',
  'runtime/googleAdapters.mjs', 'runtime/http.mjs', 'runtime/mailboxConsent.mjs',
  'runtime/mailboxDisclosure.mjs', 'runtime/main.mjs', 'runtime/mixedThread.mjs',
  'runtime/noMailConfirmation.mjs',
  'runtime/purgeGate.mjs', 'runtime/service.mjs'
)
$uploadFiles = @(gcloud meta list-files-for-upload | ForEach-Object {
  $_.Trim().Replace('\', '/')
} | Where-Object { $_ })
if ($LASTEXITCODE -ne 0 -or $uploadFiles.Count -ne $expectedUploadFiles.Count -or
    @(Compare-Object $expectedUploadFiles $uploadFiles -CaseSensitive).Count -ne 0) {
  throw 'Cloud Build upload files differ from the reviewed manifest.'
}
Invoke-ApprovedChange gcloud @('builds', 'submit', '.', '--project', $ProjectId,
  '--region', $Region, '--config', 'runtime/cloudbuild.yaml',
  '--service-account', "projects/$ProjectId/serviceAccounts/$BuildEmail",
  '--gcs-source-staging-dir', "gs://$SourceBucket/source",
  '--substitutions', "_IMAGE_REFERENCE=$ImageTag")
gcloud artifacts docker images describe $ImageTag --project=$ProjectId --format=json
```

[build定義](../../../99_backend-docs/10_support-contact/mail-service/runtime/cloudbuild.yaml)は`runtime/Dockerfile`を使い、同じbuildでArtifact Registryへpushします。返されたbuild IDを入力し、**そのbuildの`results.images[]`で採用タグに一致するdigest**をArtifact Registryと比較します。

```powershell
$BuildId = '<observed-build-id>'
if ($BuildId -match '[<>\r\n]' -or [string]::IsNullOrWhiteSpace($BuildId)) { throw 'Observed build ID required.' }
$buildMetadata = gcloud builds describe $BuildId --region=$Region --project=$ProjectId --format=json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $buildMetadata.status -cne 'SUCCESS') { throw 'Build not successful.' }
$builtImages = @($buildMetadata.results.images | Where-Object { $_.name -ceq $ImageTag })
if ($builtImages.Count -ne 1 -or $builtImages[0].digest -notmatch '^sha256:[a-f0-9]{64}$') {
  throw 'Adopted tag missing or ambiguous in this build result.'
}
$registryMetadata = gcloud artifacts docker images describe $ImageTag --project=$ProjectId --format=json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $registryMetadata.image_summary.digest -cne $builtImages[0].digest) {
  throw 'Build and registry image digests differ.'
}
$ImageDigest = $builtImages[0].digest
```

タグが別buildで付け替わっていれば停止します。source bucketの保持期間・image保持と費用は運用記録に定めます。[Cloud Build CLI](https://docs.cloud.google.com/sdk/gcloud/reference/builds/submit)・[独自buildアカウント](https://docs.cloud.google.com/build/docs/securing-builds/configure-user-specified-service-accounts)

## 5. GAS開発版の準備とclaims確認

`ScriptApp.getIdentityToken()`にはmanifestの`openid`と配備者の再認可が必要です。Cloud Runのaudience/subjectを先に推定しません。現行配備ID・version、コード・manifest・設定名・Sheet/Drive参照先を保全し、以下では**開発版だけ**をpushします。公開済みversionは更新しません。

採用SHAのviewerを`rootDir`にした既存のprivate `.clasp.json`を使います。設定・認証ファイルはrepoへ追加しません。clasp 3.3系のコマンド名は実行環境の`clasp --version`と各`--help`でも照合します。

```powershell
$ClaspUser = '<existing-approved-clasp-user>'
$ClaspProjectFile = '<absolute-private-clasp-json>'
$GasScriptId = '<existing-approved-script-id>'
$GasDeploymentId = '<existing-approved-deployment-id>'
if (@($ClaspUser, $ClaspProjectFile, $GasScriptId, $GasDeploymentId).Where({
    [string]::IsNullOrWhiteSpace($_) -or $_ -match '[<>\r\n]'
  }).Count -or -not [IO.Path]::IsPathFullyQualified($ClaspProjectFile)) {
  throw 'Exact existing GAS target and absolute private config path required.'
}
$claspTarget = Get-Content -Raw -LiteralPath $ClaspProjectFile | ConvertFrom-Json
if ($claspTarget.scriptId -cne $GasScriptId) { throw 'GAS script target mismatch.' }
$GasSourceRoot = Join-Path (git rev-parse --show-toplevel) '99_backend-docs/10_support-contact/viewer-workspace-gas'
$ExpectedGasFiles = @(
  'Code.gs', 'OAuth.gs', 'MailBridge.gs', 'SheetAcceptance.gs',
  'Index.html', 'Login.html', 'SheetAcceptance.html', 'appsscript.json'
)
$ActualGasFiles = @(Get-ChildItem -LiteralPath $GasSourceRoot -File | Where-Object {
  $_.Extension -in @('.gs', '.html') -or $_.Name -eq 'appsscript.json'
} | Select-Object -ExpandProperty Name)
if ($ActualGasFiles.Count -ne $ExpectedGasFiles.Count -or
    @(Compare-Object ($ExpectedGasFiles | Sort-Object) ($ActualGasFiles | Sort-Object)).Count) {
  throw 'GAS source file set mismatch.'
}
clasp -u $ClaspUser -P $ClaspProjectFile list-deployments
clasp -u $ClaspUser -P $ClaspProjectFile show-file-status
```

private clasp設定の`rootDir`が上の`$GasSourceRoot`を指し、`show-file-status`の送信対象に8ファイルすべてが含まれることを確認します。`SheetAcceptance.gs`または`SheetAcceptance.html`が無い、無視対象になっている、別のsource rootならpushへ進みません。

```powershell
Invoke-ApprovedChange clasp @('-u', $ClaspUser, '-P', $ClaspProjectFile, 'push')
clasp -u $ClaspUser -P $ClaspProjectFile list-deployments
```

対象は上記8ファイルです。manifestの`openid`と既存scopeを照合します。push後はGAS editorでも両SheetAcceptanceファイルの存在と採用sourceを確認し、公開配備ID/versionが保全値のままであることを確認します。受入用の専用画面は、採用versionへ配備後に通常の`/exec` URLへ`?operator=sheet-acceptance`を付けて開きます。[取得手順](12_SUPPORT_CONTACT_MAIL_SHEET_ACCEPTANCE.md)のdomain認証・JSON取得を確認します。

配備者本人がGAS editorで新scopeを再認可し、次の一時関数を開発版で実行します。`expectedEmail`を承認済み配備者へ置き換えます。出力は必要なclaimsだけです。token全体・payload全体・例外詳細を表示しません。

```javascript
function inspectMailBridgeIdentityForDeployment_() {
  try {
    const expectedEmail = '<approved-gas-deployer-email>';
    const token = ScriptApp.getIdentityToken();
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (parts.length !== 3) throw new Error();
    const claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString());
    if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
        typeof claims.aud !== 'string' || !claims.aud.endsWith('.apps.googleusercontent.com') ||
        typeof claims.sub !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(claims.sub) ||
        claims.email !== expectedEmail || claims.email_verified !== true ||
        (claims.azp !== undefined && claims.azp !== claims.aud)) throw new Error();
    console.log(JSON.stringify({ iss: claims.iss, aud: claims.aud, sub: claims.sub,
      email: claims.email, email_verified: claims.email_verified }));
  } catch (_) {
    throw new Error('MAIL_IDENTITY_READBACK_FAILED');
  }
}
```

観測した`aud`を`$GasAudience`、`sub`を`$GasDeployerSubject`へ入力し、emailが`$GasDeployerEmail`と一致することを確認します。一時関数は確認後に削除し、最終versionへ含めません。これは窓口ログイン用clientのaudienceではありません。[ID tokenと必要scope](https://developers.google.com/apps-script/reference/script/script-app#getIdentityToken())

## 6. Cloud Runの配備・読戻し

`$SecretVersion`と`$ImageDigest`が前段の読戻しと一致しなければ停止します。以下は本サービス専用の環境変数一式です。既存serviceへ適用する場合は先に現設定とrevisionを保全します。

```powershell
if ($ImageDigest -notmatch '^sha256:[a-f0-9]{64}$' -or
    $SecretVersion -cne $versionMetadata.name -or $versionMetadata.state -cne 'ENABLED' -or
    $SecretVersion -notmatch ('^' + [regex]::Escape($CanonicalSecretName) + '/versions/[1-9][0-9]*$') -or
    $GasAudience -notmatch '^[a-zA-Z0-9.-]+\.apps\.googleusercontent\.com$' -or
    $GasDeployerSubject -notmatch '^[\x21-\x7e]{1,255}$' -or $GasDeployerSubject -match '[<>,]') {
  throw 'Observed image digest, canonical Secret version and GAS identity are required.'
}
$ImageByDigest = "$Region-docker.pkg.dev/$ProjectId/$Repository/contact-mail@$ImageDigest"
$RuntimeEnvironment = "MAIL_SCRIPT_AUDIENCE=$GasAudience,MAIL_DEPLOYER_EMAIL=$GasDeployerEmail,MAIL_DEPLOYER_SUBJECT=$GasDeployerSubject,MAILBOX_OAUTH_SECRET_VERSION=$SecretVersion,FIRESTORE_DATABASE_ID=$DatabaseId"
Invoke-ApprovedChange gcloud @('run', 'deploy', $Service, '--project', $ProjectId,
  '--region', $Region, '--image', $ImageByDigest, '--service-account', $RuntimeEmail,
  '--no-allow-unauthenticated', '--invoker-iam-check', '--ingress', 'all',
  '--set-custom-audiences', $GasAudience, '--set-env-vars', $RuntimeEnvironment,
  '--min', '0', '--max', $MaxInstances, '--min-instances', '0',
  '--max-instances', $MaxInstances, '--cpu', $Cpu,
  '--memory', $Memory, '--timeout', $Timeout, '--concurrency', $Concurrency)
Invoke-ApprovedChange gcloud @('run', 'services', 'add-iam-policy-binding', $Service,
  '--project', $ProjectId, '--region', $Region,
  '--member', "user:$GasDeployerEmail", '--role', 'roles/run.invoker')
gcloud run services describe $Service --region=$Region --project=$ProjectId --format=json
gcloud run services get-iam-policy $Service --region=$Region --project=$ProjectId --format=json
gcloud run revisions list --service=$Service --region=$Region --project=$ProjectId --format=json
```

service URL、ready revision、image digest、実行SA、custom audience、5環境変数、resource上限とtraffic先を照合します。`allUsers`・`allAuthenticatedUsers`のinvokerがないこと、IAM検査が無効化されていないことを確認します。GASの外部HTTPS呼出しを受けるためingressは`all`ですが、IAMとサービス内の配備者ID検証を両方維持します。Secretの**名前/version参照**を環境変数で渡す実装なので、`--set-secrets`で資格情報を展開しません。[配備CLI](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy)・[custom audience](https://docs.cloud.google.com/run/docs/configuring/custom-audiences)

## 7. GASの最終version・公開配備

Cloud Runの読戻し後、GAS editorの対象project設定でScript Property **`MAIL_SERVICE_URL`だけ**を読戻し済みの`https://...run.app`へ設定し、保存後の同じ欄で再確認します。全propertiesの出力や置換をしません。claspにはScript Propertiesを直接設定する標準コマンドがないため、この手順を架空のCLIで置き換えません。[Propertiesの設定](https://developers.google.com/apps-script/guides/properties#manage_script_properties_manually)

採用SHAのコードを再pushし、一時claims関数がないこととmanifest・Sheet/Drive参照先を読み戻します。ここで初めて最終versionを作成します。

```powershell
Invoke-ApprovedChange clasp @('-u', $ClaspUser, '-P', $ClaspProjectFile, 'push')
Invoke-ApprovedChange clasp @('-u', $ClaspUser, '-P', $ClaspProjectFile,
  'create-version', "contact-mail $GitSha")
```

作成結果の整数を`$GasVersion`へ入力し、別の空のprivate作業フォルダで`clasp -u $ClaspUser clone-script $GasScriptId $GasVersion`を実行して採用コード・manifestを比較してから、既存公開配備を更新します。

```powershell
if ($GasVersion -notmatch '^[1-9][0-9]*$' -or $GasDeploymentId -match '[<>\r\n]') { throw 'Verified GAS version and deployment ID required.' }
Invoke-ApprovedChange clasp @('-u', $ClaspUser, '-P', $ClaspProjectFile,
  'create-deployment', '--deploymentId', $GasDeploymentId,
  '--versionNumber', $GasVersion, '--description', "contact-mail $GitSha")
clasp -u $ClaspUser -P $ClaspProjectFile list-deployments
```

通常URLで社員と窓口本人の認証、IAM拒否、実利用者の初回確認者・日時、実Firestoreのindex・集計、実メール・添付を確認し、[本番受入](10_SUPPORT_CONTACT_MAIL_OPERATIONS.md#6-本番の受入)へ進みます。実配備のChrome確認を行い、Edge・Firefoxは省略として記録します。[clasp公式コマンド](https://github.com/google/clasp#deploy)

## 8. 巻戻しコマンド

保全済みの受入済みGAS versionを`$PreviousGasVersion`に指定し、同じ配備IDへ`create-deployment --versionNumber $PreviousGasVersion`を適用して読戻します。Cloud Runに受入済みrevisionがある場合だけ、次を実行します。

```powershell
$PreviousRevision = '<verified-previous-accepted-revision>'
if ($PreviousRevision -match '[<>\r\n,=]' -or -not $PreviousRevision.StartsWith("$Service-")) { throw 'Verified previous revision required.' }
Invoke-ApprovedChange gcloud @('run', 'services', 'update-traffic', $Service,
  '--to-revisions', "$PreviousRevision=100", '--region', $Region, '--project', $ProjectId)
gcloud run services describe $Service --region=$Region --project=$ProjectId --format=json
```

初回配備で復旧先revisionがない場合は、GASを第1段階へ戻してメール呼出しを止めます。Sheet/Drive、Firestoreの監査・確認記録、Secretを削除しません。trafficだけではservice単位のIAM/custom audienceは戻らないため、保全値と読み合わせます。[traffic切替CLI](https://docs.cloud.google.com/sdk/gcloud/reference/run/services/update-traffic)
