import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const wrapperPath = fileURLToPath(new URL('../authorizeMailbox.ps1', import.meta.url));
const pwshAvailable = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8', windowsHide: true }).status === 0;

for (const scenario of ['success', 'child-failure']) {
  test(`PowerShell wrapper keeps credentials in child environment and cleans ${scenario}`, { skip: !pwshAvailable }, () => {
    const temporaryDirectory = mkdtempSync(join(tmpdir(), 'contact-mail-wrapper-test-'));
    const harnessPath = join(temporaryDirectory, 'harness.ps1');
    const escapedPath = wrapperPath.replaceAll("'", "''");
    writeFileSync(harnessPath, `
$ErrorActionPreference = 'Stop'
. '${escapedPath}' -SecretName 'projects/123/secrets/synthetic' -RetentionNotice 'synthetic retention' -DeletionContact 'delete@example.test'
$env:MAIL_OAUTH_CLIENT_ID = 'original-process-id'
$env:MAIL_OAUTH_CLIENT_SECRET = 'original-process-secret'
$script:captured = $null
$script:readCount = 0
$script:verified = $false
$reader = {
  param($Prompt)
  $script:readCount += 1
  if ($script:readCount -eq 1) { return ConvertTo-SecureString 'synthetic.apps.googleusercontent.com' -AsPlainText -Force }
  return ConvertTo-SecureString 'synthetic-client-secret' -AsPlainText -Force
}
$runner = {
  param($StartInfo)
  $script:captured = $StartInfo
  $arguments = @($StartInfo.ArgumentList)
  $script:verified = $StartInfo.Environment['MAIL_OAUTH_CLIENT_ID'] -eq 'synthetic.apps.googleusercontent.com' -and
    $StartInfo.Environment['MAIL_OAUTH_CLIENT_SECRET'] -eq 'synthetic-client-secret' -and
    $StartInfo.Environment['MAIL_DATA_RETENTION_NOTICE'] -eq 'synthetic retention' -and
    $StartInfo.Environment['MAIL_DATA_DELETION_CONTACT'] -eq 'delete@example.test' -and
    $env:MAIL_OAUTH_CLIENT_ID -eq 'original-process-id' -and $env:MAIL_OAUTH_CLIENT_SECRET -eq 'original-process-secret' -and
    -not $StartInfo.UseShellExecute -and -not $StartInfo.RedirectStandardInput -and -not $StartInfo.RedirectStandardOutput -and
    $arguments.Count -eq 7 -and $arguments[1] -eq '--execute' -and $arguments[2] -eq '--desktop-client' -and
    $arguments[3] -eq '--confirm-mailbox' -and $arguments[4] -eq 'customer@speed-ad.com' -and
    $arguments[5] -eq '--secret' -and $arguments[6] -eq 'projects/123/secrets/synthetic' -and
    ($arguments -join ' ') -notmatch 'synthetic-client-secret|synthetic.apps.googleusercontent.com'
  ${scenario === 'child-failure' ? "throw 'synthetic child failure'" : 'return 17'}
}
$caught = $false
$result = $null
try { $result = Invoke-MailboxAuthorization -SecretName 'projects/123/secrets/synthetic' -RetentionNotice 'synthetic retention' -DeletionContact 'delete@example.test' -ReadCredential $reader -RunProcess $runner }
catch { $caught = $true }
@{ verified = $script:verified; cleaned = $script:captured.Environment.Count -eq 0; parentPreserved = $env:MAIL_OAUTH_CLIENT_ID -eq 'original-process-id' -and $env:MAIL_OAUTH_CLIENT_SECRET -eq 'original-process-secret'; readCount = $script:readCount; caught = $caught; result = $result } | ConvertTo-Json -Compress
`, 'utf8');
    try {
      const result = spawnSync('pwsh', ['-NoProfile', '-NonInteractive', '-File', harnessPath], { encoding: 'utf8', windowsHide: true, cwd: resolve(temporaryDirectory) });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.includes('synthetic-client-secret'), false);
      assert.equal(result.stderr.includes('synthetic-client-secret'), false);
      const receipt = JSON.parse(result.stdout.trim());
      assert.equal(receipt.verified, true);
      assert.equal(receipt.cleaned, true);
      assert.equal(receipt.parentPreserved, true);
      assert.equal(receipt.readCount, 2);
      assert.equal(receipt.caught, scenario === 'child-failure');
      assert.equal(receipt.result, scenario === 'success' ? 17 : null);
    } finally { rmSync(temporaryDirectory, { recursive: true, force: true }); }
  });
}
