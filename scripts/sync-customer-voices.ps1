param(
    [switch]$Check
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$sourcePath = Join-Path $repoRoot '05_support\assets\data\customer-voices.json'
$mirrorPath = Join-Path $repoRoot 'data\customer-voices.json'

if (-not (Test-Path $sourcePath)) {
    throw "Customer voice source not found: $sourcePath"
}

if ($Check -and -not (Test-Path $mirrorPath)) {
    throw "Customer voice mirror not found: $mirrorPath"
}

function Get-ContentHash($Path) {
    return (Get-FileHash -Algorithm SHA256 -LiteralPath $Path).Hash
}

if ($Check) {
    $sourceHash = Get-ContentHash $sourcePath
    $mirrorHash = Get-ContentHash $mirrorPath

    if ($sourceHash -eq $mirrorHash) {
        Write-Host 'Customer voice mirror is up to date.'
        exit 0
    }

    throw 'Customer voice mirror is out of date. Run scripts\sync-customer-voices.ps1 to update data\customer-voices.json from 05_support\assets\data\customer-voices.json.'
}

$mirrorDirectory = Split-Path -Parent $mirrorPath
if (-not (Test-Path $mirrorDirectory)) {
    New-Item -ItemType Directory -Path $mirrorDirectory | Out-Null
}

Copy-Item -LiteralPath $sourcePath -Destination $mirrorPath -Force
Write-Host "Synced customer voice mirror: $mirrorPath"
