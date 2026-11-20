#requires -Version 7.0
[CmdletBinding()]
param(
  [Parameter(Mandatory)][string]$SecretName,
  [Parameter(Mandatory)][string]$RetentionNotice,
  [Parameter(Mandatory)][string]$DeletionContact
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function ConvertTo-PlainCredential([Security.SecureString]$Value) {
  $credentialPointer = [IntPtr]::Zero
  try {
    $credentialPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($credentialPointer)
  } finally {
    if ($credentialPointer -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($credentialPointer)
    }
  }
}

function Invoke-MailboxAuthorization {
  param(
    [string]$SecretName,
    [string]$RetentionNotice,
    [string]$DeletionContact,
    [scriptblock]$ReadCredential = { param($Prompt) Read-Host -Prompt $Prompt -AsSecureString },
    [scriptblock]$RunProcess = {
      param($StartInfo)
      $authorizationProcess = [Diagnostics.Process]::Start($StartInfo)
      try {
        $authorizationProcess.WaitForExit()
        return $authorizationProcess.ExitCode
      } finally { $authorizationProcess.Dispose() }
    }
  )

  if ($SecretName -notmatch '^projects/[A-Za-z0-9._:-]+/secrets/[A-Za-z0-9_-]+$' -or
      [string]::IsNullOrWhiteSpace($RetentionNotice) -or $RetentionNotice.Length -gt 500 -or
      $RetentionNotice -match '[\x00-\x1f\x7f-\x9f]' -or
      $DeletionContact.Length -gt 254 -or $DeletionContact -notmatch '^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$') {
    throw 'INVALID_ONBOARDING_CONFIGURATION'
  }

  $authorizationStartInfo = $null
  $secureClientId = $null
  $secureClientSecret = $null
  $plainClientId = $null
  $plainClientSecret = $null
  try {
    $nodePath = (Get-Command node -CommandType Application -ErrorAction Stop).Source
    $secureClientId = & $ReadCredential 'Desktop OAuth client ID（入力は非表示）'
    $secureClientSecret = & $ReadCredential 'Desktop OAuth client secret（入力は非表示）'
    if ($secureClientId -isnot [Security.SecureString] -or $secureClientSecret -isnot [Security.SecureString]) {
      throw 'OAUTH_CLIENT_REQUIRED'
    }
    $plainClientId = ConvertTo-PlainCredential $secureClientId
    $plainClientSecret = ConvertTo-PlainCredential $secureClientSecret
    if ($plainClientId.Length -gt 512 -or $plainClientId -notmatch '^[^\s]+\.apps\.googleusercontent\.com$' -or
        [string]::IsNullOrWhiteSpace($plainClientSecret) -or $plainClientSecret.Length -gt 4096 -or
        $plainClientSecret -match '[\r\n]') {
      throw 'OAUTH_CLIENT_REQUIRED'
    }

    $authorizationStartInfo = [Diagnostics.ProcessStartInfo]::new()
    $authorizationStartInfo.FileName = $nodePath
    $authorizationStartInfo.WorkingDirectory = Split-Path -Parent $PSScriptRoot
    $authorizationStartInfo.UseShellExecute = $false
    # Inherit the current console so the existing disclosure and Google consent remain interactive.
    foreach ($argument in @((Join-Path $PSScriptRoot 'authorizeMailbox.mjs'), '--execute', '--desktop-client',
        '--confirm-mailbox', 'customer@speed-ad.com', '--secret', $SecretName)) {
      $authorizationStartInfo.ArgumentList.Add($argument)
    }
    $authorizationStartInfo.Environment['MAIL_OAUTH_CLIENT_ID'] = $plainClientId
    $authorizationStartInfo.Environment['MAIL_OAUTH_CLIENT_SECRET'] = $plainClientSecret
    $authorizationStartInfo.Environment['MAIL_DATA_RETENTION_NOTICE'] = $RetentionNotice
    $authorizationStartInfo.Environment['MAIL_DATA_DELETION_CONTACT'] = $DeletionContact
    return & $RunProcess $authorizationStartInfo
  } finally {
    if ($null -ne $authorizationStartInfo) { $authorizationStartInfo.Environment.Clear() }
    $plainClientId = $null
    $plainClientSecret = $null
    if ($secureClientId -is [Security.SecureString]) { $secureClientId.Dispose() }
    if ($secureClientSecret -is [Security.SecureString]) { $secureClientSecret.Dispose() }
  }
}

if ($MyInvocation.InvocationName -ne '.') {
  try {
    $authorizationExitCode = Invoke-MailboxAuthorization -SecretName $SecretName -RetentionNotice $RetentionNotice -DeletionContact $DeletionContact
    exit $authorizationExitCode
  } catch {
    # Do not print exception details, invocation arguments, or credential values.
    [Console]::Error.WriteLine('MAILBOX_AUTHORIZATION_WRAPPER_FAILED')
    exit 1
  }
}
