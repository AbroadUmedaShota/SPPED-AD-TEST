import { assertMail, MailError } from './errors.mjs';
import { createAttachmentCache } from './attachmentCache.mjs';

const MAILBOX = 'customer@speed-ad.com';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/';
const READONLY_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

export async function createGmailAdapter({ secretManager, secretVersion, createOAuthClient, fetchImpl = fetch,
  attachmentCache = createAttachmentCache() }) {
  assertMail(/^projects\/[^/]+\/secrets\/[^/]+\/versions\/[^/]+$/.test(secretVersion || ''), 'MAIL_NOT_CONFIGURED', 503);
  const [secret] = await secretManager.accessSecretVersion({ name: secretVersion });
  let credentials;
  try { credentials = JSON.parse(secret.payload.data.toString('utf8')); } catch { throw new MailError('MAIL_NOT_CONFIGURED', 503); }
  assertMail(credentials.clientId && credentials.clientSecret && credentials.refreshToken, 'MAIL_NOT_CONFIGURED', 503);
  const oauth = createOAuthClient(credentials.clientId, credentials.clientSecret);
  oauth.setCredentials({ refresh_token: credentials.refreshToken });
  let verified = false;
  let scopeVerifiedToken = null;

  async function accessToken() {
    let token;
    try { token = await oauth.getAccessToken(); } catch { throw new MailError('MAIL_AUTH_REQUIRED', 401); }
    assertMail(token?.token, 'MAIL_AUTH_REQUIRED', 401);
    if (token.token !== scopeVerifiedToken) {
      let info;
      try { info = await oauth.getTokenInfo(token.token); } catch { throw new MailError('MAIL_AUTH_REQUIRED', 401); }
      assertMail(Array.isArray(info?.scopes) && info.scopes.length === 1 && info.scopes[0] === READONLY_SCOPE,
        'MAIL_SCOPE_MISMATCH', 403);
      scopeVerifiedToken = token.token;
    }
    return token.token;
  }

  async function request(path, query = {}, kind = 'message') {
    const token = await accessToken();
    const url = new URL(path, GMAIL);
    assertMail(url.origin === 'https://gmail.googleapis.com' && url.pathname.startsWith('/gmail/v1/users/me/'));
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    let response;
    try {
      response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000), redirect: 'error' });
    } catch { throw new MailError('MAIL_UPSTREAM_TIMEOUT', 504); }
    if (!response.ok) {
      if (response.status === 404) throw new MailError(kind === 'history' ? 'MAIL_HISTORY_EXPIRED' : 'MAIL_CONTENT_UNAVAILABLE', kind === 'history' ? 409 : 410);
      if ([401, 403].includes(response.status)) throw new MailError('MAIL_AUTH_REQUIRED', 401);
      throw new MailError('MAIL_UPSTREAM_FAILED', 503);
    }
    try { return await response.json(); } catch { throw new MailError('MAIL_INVALID_UPSTREAM', 502); }
  }

  async function profile() {
    const result = await request('profile');
    assertMail(result.emailAddress?.toLowerCase() === MAILBOX, 'MAIL_MAILBOX_MISMATCH', 403);
    verified = true;
    return result;
  }

  async function read(path, query, kind) {
    if (!verified) await profile();
    return request(path, query, kind);
  }

  return {
    getProfile: profile,
    async listAllMessageIds({ pageToken } = {}) {
      const result = await read('messages', { maxResults: 50, includeSpamTrash: true, pageToken });
      assertMail(result && typeof result === 'object' && !Array.isArray(result) &&
        (Array.isArray(result.messages) || result.messages === undefined && result.resultSizeEstimate === 0 && result.nextPageToken === undefined) &&
        (result.resultSizeEstimate === undefined || Number.isSafeInteger(result.resultSizeEstimate) && result.resultSizeEstimate >= 0) &&
        (result.messages || []).every((item) => item && typeof item.id === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(item.id)) &&
        (result.nextPageToken === undefined || typeof result.nextPageToken === 'string' && result.nextPageToken.length > 0 && result.nextPageToken.length <= 8192),
      'MAIL_INVALID_UPSTREAM', 502);
      return { messageIds: (result.messages || []).map((item) => item.id), nextPageToken: result.nextPageToken ?? null };
    },
    async getMessage(id) { return read(`messages/${encodeURIComponent(id)}`, { format: 'full' }); },
    async getAttachment(id, attachmentId, { cache = true } = {}) {
      if (!cache) return read(`messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`);
      if (!verified) await profile();
      await accessToken();
      return attachmentCache.get(JSON.stringify([MAILBOX, id, attachmentId]),
        () => request(`messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`));
    },
    async listMessages({ pageToken, startAt, cutoffAt }) {
      assertMail(typeof startAt === 'string' && Number.isFinite(Date.parse(startAt)), 'MAIL_PERIOD_REQUIRED', 409);
      const query = ['-in:drafts'];
      query.push(`after:${Math.floor(Date.parse(startAt) / 1000) - 1}`);
      if (cutoffAt) query.push(`before:${Math.floor(Date.parse(cutoffAt) / 1000) + 1}`);
      const result = await read('messages', { maxResults: 50, includeSpamTrash: true, pageToken, q: query.join(' ') });
      assertMail(result.messages === undefined || Array.isArray(result.messages), 'MAIL_INVALID_UPSTREAM', 502);
      return { messageIds: (result.messages || []).map((item) => item.id), nextPageToken: result.nextPageToken || null };
    },
    async listHistory({ pageToken, startHistoryId }) {
      const result = await read('history', { maxResults: 10, startHistoryId, pageToken }, 'history');
      assertMail(result.history === undefined || Array.isArray(result.history), 'MAIL_INVALID_UPSTREAM', 502);
      const ids = new Set();
      const deleted = new Set();
      const drafts = new Set();
      const sent = new Set();
      const observe = (message, target) => {
        if (!message?.id) return;
        target.add(message.id);
        if (message.labelIds?.includes('DRAFT')) drafts.add(message.id);
        if (message.labelIds?.includes('SENT')) sent.add(message.id);
      };
      for (const history of result.history || []) {
        for (const item of history.messages || []) observe(item, ids);
        for (const item of history.messagesAdded || []) observe(item.message, ids);
        for (const item of history.messagesDeleted || []) observe(item.message, deleted);
        for (const key of ['labelsAdded', 'labelsRemoved']) {
          for (const item of history[key] || []) {
            observe(item.message, ids);
            if (item.labelIds?.includes('DRAFT')) drafts.add(item.message?.id);
            if (item.labelIds?.includes('SENT')) sent.add(item.message?.id);
          }
        }
      }
      drafts.delete(undefined);
      for (const id of sent) drafts.delete(id);
      return { messageIds: [...ids].filter((id) => !deleted.has(id)),
        deletedIds: [...deleted].filter((id) => !drafts.has(id)), draftIds: [...drafts],
        nextPageToken: result.nextPageToken || null, historyId: result.historyId };
    }
  };
}
