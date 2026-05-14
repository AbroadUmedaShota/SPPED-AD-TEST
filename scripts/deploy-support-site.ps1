param(
    [ValidateSet('stg', 'prod')]
    [string]$Environment = 'stg',

    [string]$DistributionId,

    [switch]$ConfirmProduction,

    [switch]$Delete,

    [string]$Profile,

    [string]$AwsCommand = 'aws'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$sourcePath = Join-Path $repoRoot '05_support'

if (-not (Test-Path $sourcePath)) {
    throw "Support site source not found: $sourcePath"
}

$bucketByEnvironment = @{
    stg = 'stg.support.speed-ad.com'
    prod = 'support.speed-ad.com'
}

if ($Environment -eq 'prod' -and -not $ConfirmProduction) {
    throw 'Production deploy requires -ConfirmProduction.'
}

$bucket = $bucketByEnvironment[$Environment]

Write-Host "Deploying support site to s3://$bucket/ from $sourcePath"
$syncArgs = @('s3', 'sync', $sourcePath, "s3://$bucket/")
if ($Delete) {
    $syncArgs += '--delete'
} else {
    Write-Warning 'Delete was not specified. Existing objects in the bucket will be preserved.'
}
if ($Profile) {
    $syncArgs += @('--profile', $Profile)
}
& $AwsCommand @syncArgs

if ($DistributionId) {
    Write-Host "Creating CloudFront invalidation for distribution $DistributionId"
    $invalidationArgs = @('cloudfront', 'create-invalidation', '--distribution-id', $DistributionId, '--paths', '/*')
    if ($Profile) {
        $invalidationArgs += @('--profile', $Profile)
    }
    & $AwsCommand @invalidationArgs
} else {
    Write-Warning 'DistributionId was not provided. Skipping CloudFront invalidation.'
}
