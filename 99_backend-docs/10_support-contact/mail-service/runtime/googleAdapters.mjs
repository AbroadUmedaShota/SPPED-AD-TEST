import { assertMail, MailError } from './errors.mjs';

const MAILBOX = 'customer@speed-ad.com';
const GMAIL = 'https://gmail.googleapis.com/gmail/v1/users/me/';

export async function createGmailAdapter({ secretManager, secretVersion, createOAuthClient, fetchImpl = fetch }) {
  assertMail(/^projects\/[^/]+\/secrets\/[^/]+\/versions\/[^/]+$/.test(secretVersion || ''), 'MAIL_NOT_CONFIGURED', 503);
  const [secret] = await secretManager.accessSecretVersion({ name: secretVersion });
  let credentials;
  try { credentials = JSON.parse(secret.payload.data.toString('utf8')); } catch { throw new MailError('MAIL_NOT_CONFIGURED', 503); }
  assertMail(credentials.clientId && credentials.clientSecret && credentials.refreshToken, 'MAIL_NOT_CONFIGURED', 503);
  const oauth = createOAuthClient(credentials.clientId, credentials.clientSecret);
  oauth.setCredentials({ refresh_token: credentials.refreshToken });
  let verified = false;

  async function request(path, query = {}, kind = 'message') {
    const token = await oauth.getAccessToken();
    assertMail(token?.token, 'MAIL_AUTH_REQUIRED', 401);
    const url = new URL(path, GMAIL);
    assertMail(url.origin === 'https://gmail.googleapis.com' && url.pathname.startsWith('/gmail/v1/users/me/'));
    for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    let response;
    try {
      response = await fetchImpl(url, { headers: { Authorization: `Bearer ${token.token}` }, signal: AbortSignal.timeout(30000), redirect: 'error' });
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
    async getMessage(id) { return read(`messages/${encodeURIComponent(id)}`, { format: 'full' }); },
    async getAttachment(id, attachmentId) { return read(`messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`); },
    async listMessages({ pageToken, startAt, cutoffAt }) {
      const query = [];
      if (startAt) query.push(`after:${Math.floor(Date.parse(startAt) / 1000) - 1}`);
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
      for (const history of result.history || []) {
        for (const item of history.messages || []) ids.add(item.id);
        for (const item of history.messagesAdded || []) ids.add(item.message?.id);
        for (const item of history.messagesDeleted || []) deleted.add(item.message?.id);
      }
      ids.delete(undefined);
      deleted.delete(undefined);
      return { messageIds: [...ids].filter((id) => !deleted.has(id)), deletedIds: [...deleted], nextPageToken: result.nextPageToken || null, historyId: result.historyId };
    }
  };
}
