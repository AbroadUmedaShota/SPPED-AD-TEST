/** Customer-only OIDC. All helpers are private to Apps Script. */
var OAUTH_CUSTOMER_EMAIL = 'customer@speed-ad.com';
var OAUTH_STATE_SECONDS = 600;

function oauthConfig_() {
  var config = {
    clientId: getProperty_('OAUTH_CLIENT_ID', ''),
    clientSecret: getProperty_('OAUTH_CLIENT_SECRET', ''),
    redirectUri: getProperty_('OAUTH_REDIRECT_URI', '')
  };
  if (!config.clientId || !config.clientSecret ||
      !/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.redirectUri)) {
    throw new Error('OAuth configuration unavailable');
  }
  config.hmacSecret = getProperty_('OAUTH_HMAC_SECRET', config.clientSecret);
  return config;
}

function oauthTemporaryUserKey_() {
  try {
    return String(Session.getTemporaryActiveUserKey() || '').trim();
  } catch (_err) {
    return '';
  }
}

function oauthHmac_(config, purpose, value) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(
    JSON.stringify([purpose, value]), config.hmacSecret, Utilities.Charset.UTF_8
  )).replace(/=+$/, '');
}

function oauthRandom_(config, purpose) {
  return oauthHmac_(config, purpose, Utilities.getUuid() + ':' + Date.now());
}

function oauthBinding_(config, temporaryUserKey, proofHash) {
  if (!temporaryUserKey) throw new Error('Temporary user identity unavailable');
  if (typeof proofHash !== 'string' || !/^[a-f0-9]{64}$/.test(proofHash)) throw new Error('Tab proof unavailable');
  return oauthHmac_(config, 'tab-v2', JSON.stringify([temporaryUserKey, proofHash, config.clientId, config.redirectUri]));
}

function assertCustomerOAuthPrincipal_() {
  var email = getActiveUserEmail_();
  if (email && email !== OAUTH_CUSTOMER_EMAIL) throw new Error('Known principal mismatch');
}

function beginCustomerOAuth_(submissionId, proofHash, authuser) {
  assertCustomerOAuthPrincipal_();
  var config = oauthConfig_();
  var binding = oauthBinding_(config, oauthTemporaryUserKey_(), proofHash);
  var state = oauthRandom_(config, 'state');
  var nonce = oauthRandom_(config, 'nonce');
  var verifier = oauthRandom_(config, 'pkce');
  CacheService.getScriptCache().put('oauth-state-v2:' + state, JSON.stringify({
    version: 2, proofHash: proofHash, binding: binding, nonce: nonce, verifier: verifier,
    createdAt: Date.now(), submissionId: String(submissionId || '').slice(0, 256),
    authuser: normalizeOAuthAuthuser_(authuser)
  }), OAUTH_STATE_SECONDS);
  var params = {
    client_id: config.clientId, redirect_uri: config.redirectUri,
    response_type: 'code', scope: 'openid email', state: state, nonce: nonce,
    code_challenge: Utilities.base64EncodeWebSafe(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256, verifier, Utilities.Charset.UTF_8
    )).replace(/=+$/, ''),
    code_challenge_method: 'S256', prompt: 'select_account'
  };
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + Object.keys(params).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');
}

function consumeCustomerOAuthState_(state, config, proofHash) {
  if (typeof state !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(state)) throw new Error('Invalid state');
  var binding = oauthBinding_(config, oauthTemporaryUserKey_(), proofHash);
  var cache = CacheService.getScriptCache();
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var raw = cache.get('oauth-state-v2:' + state);
    var pending = raw ? JSON.parse(raw) : null;
    if (!pending || pending.version !== 2 || pending.proofHash !== proofHash || pending.binding !== binding) {
      throw new Error('Invalid tab proof');
    }
    cache.remove('oauth-state-v2:' + state);
    if (!Number.isFinite(pending.createdAt) ||
        Date.now() < pending.createdAt || Date.now() - pending.createdAt >= OAUTH_STATE_SECONDS * 1000) {
      throw new Error('Expired or unbound state');
    }
    return pending;
  } finally {
    lock.releaseLock();
  }
}

function decodeOAuthJson_(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('Invalid ID token encoding');
  var decoded;
  try {
    decoded = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(part)).getDataAsString('UTF-8'));
  } catch (_err) {
    throw new Error('Invalid ID token JSON');
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error('Invalid ID token JSON');
  return decoded;
}

function validateCustomerClaims_(idToken, pending, config) {
  // Only called on the direct HTTPS token-endpoint response, never client input.
  // Google OIDC section 5 permits this trust boundary without another RSA check.
  if (typeof idToken !== 'string' || idToken.length > 16384) throw new Error('Missing ID token');
  var parts = idToken.split('.');
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[2])) throw new Error('Invalid ID token');
  var header = decodeOAuthJson_(parts[0]);
  var claims = decodeOAuthJson_(parts[1]);
  var now = Math.floor(Date.now() / 1000);
  if (header.alg !== 'RS256' ||
      ['https://accounts.google.com', 'accounts.google.com'].indexOf(claims.iss) === -1 ||
      claims.aud !== config.clientId || (claims.azp !== undefined && claims.azp !== config.clientId) ||
      typeof claims.sub !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(claims.sub) ||
      !Number.isInteger(claims.exp) || !Number.isInteger(claims.iat) ||
      claims.exp <= now || claims.iat > now + 60 || claims.iat < Math.floor(pending.createdAt / 1000) - 60 ||
      claims.exp <= claims.iat || claims.nonce !== pending.nonce ||
      claims.hd !== 'speed-ad.com' || claims.email_verified !== true || typeof claims.email !== 'string' ||
      claims.email.trim().toLowerCase() !== OAUTH_CUSTOMER_EMAIL) {
    throw new Error('Invalid customer identity');
  }
  return { email: OAUTH_CUSTOMER_EMAIL, sub: claims.sub, expiresAt: Math.min(claims.exp, now + 3600) };
}

function completeCustomerOAuth_(params, authProof) {
  var config = oauthConfig_();
  var proofHash = customerProofHash_(authProof);
  if (!params || typeof params !== 'object' || 'id_token' in params || 'access_token' in params || params.invalid) throw new Error('Invalid callback');
  var pending = consumeCustomerOAuthState_(params.state, config, proofHash);
  assertCustomerOAuthPrincipal_();
  if ('error' in params || typeof params.code !== 'string' || !params.code || params.code.length > 4096) {
    throw new Error('OAuth authorization failed');
  }
  var response;
  try {
    response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
      method: 'post', contentType: 'application/x-www-form-urlencoded',
      payload: {
        grant_type: 'authorization_code', code: params.code,
        client_id: config.clientId, client_secret: config.clientSecret,
        redirect_uri: config.redirectUri, code_verifier: pending.verifier
      },
      followRedirects: false, validateHttpsCertificates: true, muteHttpExceptions: true
    });
  } catch (_err) {
    throw new Error('OAuth token request failed');
  }
  var responseCode = response.getResponseCode();
  if (responseCode === 400) throw new Error('OAuth exchange HTTP 400');
  if (responseCode !== 200) throw new Error('OAuth exchange failed');
  var body;
  try {
    body = JSON.parse(response.getContentText());
  } catch (_err) {
    throw new Error('Invalid token response');
  }
  if (!body || body.error) throw new Error('OAuth exchange rejected');
  var session = validateCustomerClaims_(body.id_token, pending, config);
  assertCustomerOAuthPrincipal_();
  if (oauthBinding_(config, oauthTemporaryUserKey_(), proofHash) !== pending.binding) throw new Error('Temporary user changed');
  // Do not store or return access/ID/refresh tokens, client secrets, or PKCE material.
  var ttl = session.expiresAt - Math.floor(Date.now() / 1000);
  if (ttl < 1) throw new Error('OAuth identity expired');
  session.version = 2;
  CacheService.getScriptCache().put('oauth-tab-session-v2:' + pending.binding, JSON.stringify(session), ttl);
  return { redirectUri: config.redirectUri, submissionId: pending.submissionId, authuser: normalizeOAuthAuthuser_(pending.authuser) };
}

function getCustomerOAuthSession_(authProof) {
  try {
    assertCustomerOAuthPrincipal_();
    var temporaryUserKey = oauthTemporaryUserKey_();
    if (!temporaryUserKey) return null;
    var config = oauthConfig_();
    var proofHash = customerProofHash_(authProof);
    var binding = oauthBinding_(config, temporaryUserKey, proofHash);
    var raw = CacheService.getScriptCache().get('oauth-tab-session-v2:' + binding);
    var session = raw ? JSON.parse(raw) : null;
    var now = Math.floor(Date.now() / 1000);
    if (!session || session.version !== 2 || session.email !== OAUTH_CUSTOMER_EMAIL || typeof session.sub !== 'string' || !session.sub ||
        !Number.isInteger(session.expiresAt) || session.expiresAt <= now || session.expiresAt > now + 3600) return null;
    return { email: session.email, allowed: true, authMode: 'google-oauth' };
  } catch (_err) {
    return null;
  }
}

function customerProofHash_(authProof) {
  if (typeof authProof !== 'string' || !/^[a-f0-9]{64}$/.test(authProof)) throw new Error('Tab proof unavailable');
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, authProof, Utilities.Charset.UTF_8).map(function (byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function beginCustomerOAuthLogin(proofHash, submissionId, authuser) {
  try {
    return { ok: true, authorizationUrl: beginCustomerOAuth_(submissionId, proofHash, authuser) };
  } catch (_err) {
    throw new Error('ログインを開始できません。 [' + oauthFailureCode_(_err) + ']');
  }
}

function completeCustomerOAuthLogin(params, authProof) {
  try {
    var result = completeCustomerOAuth_(params, authProof);
    var query = result.submissionId ? 'id=' + encodeURIComponent(result.submissionId) : '';
    if (result.authuser) query += (query ? '&' : '') + 'authuser=' + result.authuser;
    return { ok: true, returnUrl: result.redirectUri + (query ? '?' + query : '') };
  } catch (_err) {
    throw new Error('ログインを確認できませんでした。 [' + oauthFailureCode_(_err) + ']');
  }
}

function customerLoginStartUrl_(id, authuser) {
  try {
    var hint = normalizeOAuthAuthuser_(authuser);
    return oauthConfig_().redirectUri + '?login=google' + (id ? '&id=' + encodeURIComponent(String(id).slice(0, 256)) : '') +
      (hint ? '&authuser=' + hint : '');
  } catch (_err) {
    return '';
  }
}

function renderLogin_(submissionId, callback, authuser) {
  var template = HtmlService.createTemplateFromFile('Login');
  template.submissionId = submissionId;
  template.callback = callback;
  template.authuser = normalizeOAuthAuthuser_(authuser);
  return template.evaluate().setTitle('SPEED AD ログイン');
}

// Google account routing only; never identity, proof, or authorization input.
function normalizeOAuthAuthuser_(value) {
  return typeof value === 'string' && /^[0-9]{1,10}$/.test(value) ? value : '';
}

// Exact internal messages only. Never expose exception text, provider bodies, or identifiers.
function oauthFailureCode_(error) {
  var groups = {
    AUTH_CONFIG: ['OAuth configuration unavailable'],
    AUTH_STATE: ['Invalid state', 'Invalid tab proof', 'Expired or unbound state'],
    AUTH_PROOF: ['Tab proof unavailable'],
    AUTH_IDENTITY: ['Temporary user identity unavailable', 'Temporary user changed', 'Invalid customer identity', 'OAuth identity expired'],
    AUTH_PERMISSION: ['Known principal mismatch'],
    AUTH_TOKEN_HTTP400: ['OAuth exchange HTTP 400'],
    AUTH_TOKEN_NETWORK: ['OAuth token request failed'],
    AUTH_TOKEN: ['Invalid callback', 'OAuth authorization failed', 'OAuth exchange failed', 'OAuth exchange rejected', 'Invalid token response', 'Missing ID token', 'Invalid ID token', 'Invalid ID token encoding', 'Invalid ID token JSON']
  };
  var message = error && typeof error.message === 'string' ? error.message : '';
  var codes = Object.keys(groups);
  for (var index = 0; index < codes.length; index++) {
    if (groups[codes[index]].indexOf(message) !== -1) return codes[index];
  }
  return 'AUTH_UNKNOWN';
}
