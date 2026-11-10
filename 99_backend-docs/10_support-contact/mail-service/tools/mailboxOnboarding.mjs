import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { MAILBOX_DISCLOSURE_VERSION, MAILBOX_MARKER_DISCLOSURE, MAILBOX_SYNC_DISCLOSURE, MAILBOX_ACCEPTANCE_DISCLOSURE } from '../runtime/mailboxDisclosure.mjs';

export { MAILBOX_DISCLOSURE_VERSION, MAILBOX_MARKER_DISCLOSURE, MAILBOX_SYNC_DISCLOSURE, MAILBOX_ACCEPTANCE_DISCLOSURE };

export const MAILBOX = 'customer@speed-ad.com';
export const GMAIL_READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';
const PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';
const CALLBACK_PATH = '/oauth/callback';
const CLEAN_CALLBACK_SCRIPT = "history.replaceState(null, '', '/complete');";
const CLEAN_CALLBACK_HASH = createHash('sha256').update(CLEAN_CALLBACK_SCRIPT).digest('base64');

export class OnboardingError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function requireValue(condition, code) {
  if (!condition) throw new OnboardingError(code);
}

export function validateOnboardingOptions(options) {
  requireValue(options?.execute === true && options?.desktopClient === true && options?.confirmMailbox === MAILBOX, 'EXPLICIT_EXECUTION_REQUIRED');
  requireValue(/^projects\/[A-Za-z0-9._:-]+\/secrets\/[A-Za-z0-9_-]+$/.test(options.secretName || ''), 'INVALID_SECRET_NAME');
  requireValue(typeof options.clientId === 'string' && options.clientId.length <= 512 && /^[^\s]+\.apps\.googleusercontent\.com$/.test(options.clientId), 'OAUTH_CLIENT_REQUIRED');
  requireValue(typeof options.clientSecret === 'string' && options.clientSecret.trim() && options.clientSecret.length <= 4096 && !/[\r\n]/.test(options.clientSecret), 'OAUTH_CLIENT_REQUIRED');
  requireValue(typeof options.retentionNotice === 'string' && options.retentionNotice.trim() && options.retentionNotice.length <= 500 &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(options.retentionNotice), 'DATA_HANDLING_NOTICE_REQUIRED');
  requireValue(typeof options.deletionContact === 'string' && options.deletionContact.length <= 254 &&
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(options.deletionContact), 'DATA_DELETION_CONTACT_REQUIRED');
  return options;
}

export function mailboxDisclosure(options) {
  return `SPEED AD お問い合わせ確認アプリ：Gmailデータの利用について
説明version: ${MAILBOX_DISCLOSURE_VERSION}
運営主体: アブロードアウトソーシング株式会社
対象アカウント: ${MAILBOX}
要求権限: ${GMAIL_READONLY_SCOPE}（メールと添付の読取り。送信・変更・削除の権限は要求しません。）
${MAILBOX_SYNC_DISCLOSURE}
${MAILBOX_MARKER_DISCLOSURE}
${MAILBOX_ACCEPTANCE_DISCLOSURE}
共有: アプリの認証を通った abroad-o.com の社員全員と公式窓口の利用者が、対象メールの本文・添付、照合待ち、確認記録を閲覧できます。問い合わせ対応のため、この範囲の人による閲覧に同意する場合だけ続行してください。Google Cloud上で処理・保存します。
保存: 件名、差出人・宛先、日時、メール/スレッドID、添付名などの添付情報、案件との照合、確認者・日時、同期位置と監査記録をFirestoreへ保存します。本文は同期時の照合と閲覧時に取得します。添付本体は主に閲覧時に取得しますが、Gmailのメール応答に本文と一緒に含まれる添付データは同期時にも一時的に受信します。本文・添付本体はサーバーの一時メモリと利用者画面で処理し、Firestoreへ保存しません。継続読取りの資格情報と、この説明全文・説明version・hash・同意日時・確認済み窓口の同意記録を同じSecret Manager versionへ保存します。
保存方針: Gmail由来の照合・確認記録は案件終了後3年間、除外したメールの記録は除外確定後3年間保存します。照合待ちの記録は案件への照合または除外を確定するまで3年間の起算日が決まらないため保持します。期限削除は管理者が手動で実行します。実施方法: ${options.retentionNotice.trim()}
下書きとの矛盾: 既存の通常メールが現在の下書きと判定された場合は、既存の監査・確認記録を保持し、案件との紐付けを外した取得不能の照合待ちとして人の判断を待ちます。新しい下書き本文を取得・保存しません。
停止・削除: Googleアカウントの接続管理から本アプリのアクセスを取り消せます。取消し後も保存済みデータは残るため、削除申請は ${options.deletionContact} へ対象の案件ID/メールIDを連絡してください。取消しやアプリ側データ削除でGmailの元メールは削除しません。
詳細: mail-service READMEの「データの管理・削除」を確認してください。
Google Workspaceから得た情報はGoogle User Data PolicyのLimited Use要件に従って扱います。`;
}

export function createProof(random = randomBytes) {
  const verifier = random(32).toString('base64url');
  const state = random(32).toString('base64url');
  return { verifier, state, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

async function resolveSecretName(secretManager, requestedName) {
  let secret;
  try { [secret] = await secretManager.getSecret({ name: requestedName }, { timeout: 30000, retry: null }); }
  catch { throw new OnboardingError('SECRET_TARGET_UNCONFIRMED'); }
  const requested = /^projects\/([^/]+)\/secrets\/([^/]+)$/.exec(requestedName);
  const resolved = /^projects\/([^/]+)\/secrets\/([^/]+)$/.exec(secret?.name || '');
  // The authenticated metadata lookup resolves a project ID to its canonical number.
  // Numeric inputs and the secret ID must remain exact; a later write cannot select another parent.
  requireValue(resolved && resolved[2] === requested[2] &&
    (resolved[1] === requested[1] || (!/^\d+$/.test(requested[1]) && /^[1-9]\d*$/.test(resolved[1]))), 'SECRET_TARGET_UNCONFIRMED');
  return secret.name;
}

function sameState(actual, expected) {
  if (typeof actual !== 'string' || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

/** Only a loopback listener is opened; no code or token is written to the response. */
export async function listenForOAuthCallback(state, { timeoutMs = 300000 } = {}) {
  requireValue(/^[A-Za-z0-9_-]{43}$/.test(state), 'INVALID_OAUTH_STATE');
  requireValue(Number.isInteger(timeoutMs) && timeoutMs >= 1 && timeoutMs <= 300000, 'INVALID_CALLBACK_TIMEOUT');
  let settle;
  let fail;
  let consumed = false;
  let timer;
  const result = new Promise((resolve, reject) => { settle = resolve; fail = reject; });
  // The caller may still be opening the browser when the listener expires.
  result.catch(() => {});
  const server = createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    const address = server.address();
    const host = `127.0.0.1:${address.port}`;
    let url;
    try { url = new URL(request.url, `http://${host}`); } catch { response.writeHead(400).end('Invalid callback.'); return; }
    if (request.method !== 'GET' || request.headers.host !== host || request.socket.remoteAddress !== '127.0.0.1' || url.origin !== `http://${host}` || url.pathname !== CALLBACK_PATH || consumed) {
      response.writeHead(400).end('Invalid callback.'); return;
    }
    if (['state', 'code', 'error'].some((key) => url.searchParams.getAll(key).length > 1) || !sameState(url.searchParams.get('state'), state)) {
      response.writeHead(400).end('Invalid callback.'); return;
    }
    const code = url.searchParams.get('code');
    const error = url.searchParams.get('error');
    if ((!code && !error) || (code && error) || (code && code.length > 8192)) {
      response.writeHead(400).end('Invalid callback.'); return;
    }
    consumed = true;
    clearTimeout(timer);
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Content-Security-Policy', `default-src 'none'; script-src 'sha256-${CLEAN_CALLBACK_HASH}'; frame-ancestors 'none'`);
    response.end(`<!doctype html><meta charset="utf-8"><title>認可結果</title><script>${CLEAN_CALLBACK_SCRIPT}</script><p>認可結果を受け取りました。この画面を閉じてローカルツールへ戻ってください。</p>`);
    server.close();
    if (error) fail(new OnboardingError('OAUTH_CONSENT_DECLINED'));
    else settle(code);
  });
  await new Promise((resolve, reject) => {
    server.once('error', () => reject(new OnboardingError('CALLBACK_LISTENER_FAILED')));
    server.listen(0, '127.0.0.1', resolve);
  });
  timer = setTimeout(() => {
    consumed = true;
    server.close();
    fail(new OnboardingError('OAUTH_CALLBACK_TIMEOUT'));
  }, timeoutMs);
  return {
    redirectUri: `http://127.0.0.1:${server.address().port}${CALLBACK_PATH}`,
    result,
    close() {
      if (consumed) return;
      consumed = true;
      clearTimeout(timer);
      server.close();
      fail(new OnboardingError('OAUTH_FLOW_CLOSED'));
    }
  };
}

/** Adapters are injected so tests never consent to Google or write a cloud secret. */
export async function authorizeMailbox(options, { createOAuthClient, secretManager, openAuthorization, confirmDisclosure, listen = listenForOAuthCallback, fetchImpl = fetch, random = randomBytes, now = () => new Date() }) {
  validateOnboardingOptions(options);
  requireValue(typeof confirmDisclosure === 'function', 'DISCLOSURE_CONFIRMATION_REQUIRED');
  const disclosure = mailboxDisclosure(options);
  requireValue(await confirmDisclosure(disclosure) === true, 'DISCLOSURE_DECLINED');
  let acceptedAt;
  try { acceptedAt = new Date(now()).toISOString(); } catch { throw new OnboardingError('CONSENT_TIME_UNAVAILABLE'); }
  const receipt = { disclosureVersion: MAILBOX_DISCLOSURE_VERSION,
    disclosureSha256: createHash('sha256').update(disclosure, 'utf8').digest('hex'), acceptedAt, verifiedMailbox: MAILBOX };
  const secretName = await resolveSecretName(secretManager, options.secretName);
  const proof = createProof(random);
  const listener = await listen(proof.state);
  try {
    const client = createOAuthClient(options.clientId, options.clientSecret, listener.redirectUri);
    const authorizationUrl = client.generateAuthUrl({
      access_type: 'offline', prompt: 'consent', scope: [GMAIL_READONLY_SCOPE],
      include_granted_scopes: false, login_hint: MAILBOX, state: proof.state,
      code_challenge: proof.challenge, code_challenge_method: 'S256'
    });
    const url = new URL(authorizationUrl);
    requireValue(url.origin === 'https://accounts.google.com' && url.pathname === '/o/oauth2/v2/auth', 'INVALID_AUTHORIZATION_URL');
    await openAuthorization(url.href);
    const code = await listener.result;
    let tokens;
    try { ({ tokens } = await client.getToken({ code, codeVerifier: proof.verifier, redirect_uri: listener.redirectUri })); }
    catch { throw new OnboardingError('OAUTH_EXCHANGE_FAILED'); }
    requireValue(tokens && typeof tokens.refresh_token === 'string' && tokens.refresh_token && typeof tokens.access_token === 'string' && tokens.access_token, 'OFFLINE_GRANT_REQUIRED');
    let info;
    try { info = await client.getTokenInfo(tokens.access_token); } catch { throw new OnboardingError('OAUTH_SCOPE_UNCONFIRMED'); }
    requireValue(Array.isArray(info?.scopes) && info.scopes.length === 1 && info.scopes[0] === GMAIL_READONLY_SCOPE, 'OAUTH_SCOPE_MISMATCH');
    let response;
    try { response = await fetchImpl(PROFILE_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` }, redirect: 'error', signal: AbortSignal.timeout(30000) }); }
    catch { throw new OnboardingError('MAILBOX_VERIFICATION_FAILED'); }
    requireValue(response.ok, 'MAILBOX_VERIFICATION_FAILED');
    let profile;
    try { profile = await response.json(); } catch { throw new OnboardingError('MAILBOX_VERIFICATION_FAILED'); }
    requireValue(String(profile?.emailAddress || '').trim().toLowerCase() === MAILBOX, 'MAILBOX_MISMATCH');
    const payload = Buffer.from(JSON.stringify({ clientId: options.clientId, clientSecret: options.clientSecret, refreshToken: tokens.refresh_token,
      consentReceipt: { ...receipt, disclosure } }), 'utf8');
    let version;
    try {
      // addVersion is not idempotent. A failed/unknown result must be investigated, never retried automatically.
      [version] = await secretManager.addSecretVersion({ parent: secretName, payload: { data: payload } }, { retry: null });
    } catch { throw new OnboardingError('SECRET_WRITE_UNCONFIRMED'); }
    const versionPrefix = `${secretName}/versions/`;
    requireValue(typeof version?.name === 'string' && version.name.startsWith(versionPrefix) && /^[1-9]\d*$/.test(version.name.slice(versionPrefix.length)), 'SECRET_WRITE_UNCONFIRMED');
    return { secretVersion: version.name, mailbox: MAILBOX, consentReceipt: receipt };
  } finally {
    listener.close();
  }
}
