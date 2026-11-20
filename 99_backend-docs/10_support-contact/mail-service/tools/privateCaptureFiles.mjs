import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, realpath, open, readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, join } from 'node:path';

const executeFile = promisify(execFile);
const invalid = () => { throw new Error('MAIL_ACCEPTANCE_PRIVATE_PATH_REQUIRED'); };
const samePath = (a, b, platform) => platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

export function validateWindowsPrivateAcl(value) {
  if (!value || !/^S-\d+(?:-\d+)+$/.test(value.currentSid || '') || !Array.isArray(value.rules)) return false;
  const allowed = new Set([value.currentSid, 'S-1-5-18', 'S-1-5-32-544']);
  return allowed.has(value.ownerSid) && value.rules.some((rule) => rule?.sid === value.currentSid && rule.type === 'Allow') &&
    value.rules.every((rule) => rule && typeof rule.sid === 'string' && ['Allow', 'Deny'].includes(rule.type) && (rule.type === 'Deny' || allowed.has(rule.sid)));
}

async function inspectWindowsDirectory(path) {
  // Fixed script; the directory travels only through a child environment variable.
  const script = "$ErrorActionPreference='Stop'; $captureIdentity=[Security.Principal.WindowsIdentity]::GetCurrent(); $captureAcl=Get-Acl -LiteralPath $env:MAIL_CAPTURE_PRIVATE_DIR; $captureRules=@($captureAcl.Access | ForEach-Object { @{sid=$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value;type=$_.AccessControlType.ToString()} }); @{currentSid=$captureIdentity.User.Value;ownerSid=$captureAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value;rules=$captureRules} | ConvertTo-Json -Depth 5 -Compress";
  const powershell = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const { stdout } = await executeFile(powershell, ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024,
    env: Object.fromEntries([...Object.entries(process.env).filter(([name]) =>
      /^(SystemRoot|WINDIR|ComSpec|PATHEXT|PATH|TEMP|TMP|USERPROFILE|HOMEDRIVE|HOMEPATH)$/i.test(name)), ['MAIL_CAPTURE_PRIVATE_DIR', path]])
  });
  if (!validateWindowsPrivateAcl(JSON.parse(stdout.replace(/^\uFEFF/, '')))) invalid();
}

export async function prepareCaptureFiles({ privateDir, keyFile, outputFile, execute, platform = process.platform,
  inspectWindows = inspectWindowsDirectory }) {
  if (![privateDir, keyFile, outputFile].every((path) => typeof path === 'string' && isAbsolute(path)) || !/\.json$/i.test(outputFile)) invalid();
  const root = resolve(privateDir);
  if (!samePath(dirname(resolve(keyFile)), root, platform) || !samePath(dirname(resolve(outputFile)), root, platform) ||
      samePath(resolve(keyFile), resolve(outputFile), platform)) invalid();
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || !samePath(await realpath(root), root, platform)) invalid();
  if (platform === 'win32') await inspectWindows(root);
  else if ((rootInfo.mode & 0o077) !== 0 || rootInfo.uid !== process.getuid()) invalid();
  const keyInfo = await lstat(keyFile);
  if (!keyInfo.isFile() || keyInfo.isSymbolicLink() || keyInfo.nlink !== 1 || keyInfo.size !== 32 ||
      !samePath(await realpath(keyFile), resolve(keyFile), platform)) invalid();
  if (platform !== 'win32' && ((keyInfo.mode & 0o077) !== 0 || keyInfo.uid !== process.getuid())) invalid();
  // The containing ACL does not guarantee an existing key's ACL on Windows.
  if (platform === 'win32') await inspectWindows(keyFile);
  try { await lstat(outputFile); invalid(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!execute) return { close: async () => {} };
  const handle = await open(outputFile, 'wx', 0o600);
  let closed = false;
  try {
    const outputInfo = await handle.stat();
    if (!outputInfo.isFile() || outputInfo.nlink !== 1) invalid();
    if (platform === 'win32') await inspectWindows(outputFile);
    const key = await readFile(keyFile);
    if (key.length !== 32) { key.fill(0); invalid(); }
    return { key, write: async (manifest) => {
      await handle.writeFile(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      await handle.sync();
    }, close: async () => { if (!closed) { closed = true; key.fill(0); await handle.close(); } } };
  } catch (error) {
    await handle.close();
    throw error;
  }
}
