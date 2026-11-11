import { createHash } from 'node:crypto';
import { hashAcceptanceId } from './acceptanceReconciliation.mjs';

const date = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const validProfile = (v) => v?.emailAddress?.toLowerCase() === 'customer@speed-ad.com' &&
  typeof v.historyId === 'string' && /^[0-9]{1,30}$/.test(v.historyId) && Number.isSafeInteger(v.messagesTotal) && v.messagesTotal >= 0;

// Injectable read-only capture; the separate CLI validates the current receipt
// through createRuntimeGmailAdapter before passing an authenticated adapter here.
export async function captureGmailAcceptance({ gmail, runId, key, hashKeyId, startAt, cutoffAt,
  now = () => new Date(), maxRows = 100000, maxPages = 10000 }) {
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(runId || '') || !Buffer.isBuffer(key) || key.length < 32 ||
      hashKeyId !== createHash('sha256').update(key).digest('hex') || !date(startAt) || !date(cutoffAt) || startAt > cutoffAt ||
      !Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 100000 || !Number.isSafeInteger(maxPages) || maxPages < 1 || maxPages > 10000) {
    throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID');
  }
  if (!date(now().toISOString()) || now().toISOString() < cutoffAt) throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID');
  const rows = []; const pages = []; const errors = [];
  const manifest = () => ({ schemaVersion: 1, source: 'gmail', runId, hashKeyId, startAt, cutoffAt,
    capturedAt: now().toISOString(), sourceComplete: errors.length === 0, errors, pages, rows });
  let before; let pageToken = null; const ids = new Set(); const tokens = new Set();
  try {
    before = await gmail.getProfile();
    if (!validProfile(before)) throw new Error('invalid profile');
    if (before.messagesTotal > maxRows) { errors.push('ROW_LIMIT'); return manifest(); }
    for (let index = 0; ; index++) {
      if (index >= maxPages) { errors.push('PAGE_LIMIT'); break; }
      const page = await gmail.listAllMessageIds({ pageToken: pageToken || undefined });
      if (!page || !Array.isArray(page.messageIds) || page.messageIds.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) ||
          !(page.nextPageToken === null || typeof page.nextPageToken === 'string' && page.nextPageToken.length > 0 && page.nextPageToken.length <= 8192)) {
        errors.push('PAGE_INVALID'); break;
      }
      const next = page.nextPageToken;
      if (next !== null && tokens.has(next)) { errors.push('PAGE_CYCLE'); break; }
      if (next !== null) tokens.add(next);
      const beforeCount = rows.length;
      for (const id of page.messageIds) {
        if (ids.has(id)) { errors.push('DUPLICATE_ID'); break; }
        if (ids.size >= maxRows) { errors.push('ROW_LIMIT'); break; }
        ids.add(id);
        const metadata = await gmail.getMessageMetadata(id);
        if (!metadata || metadata.id !== id || Object.keys(metadata).some((field) => !['id', 'labelIds', 'internalDate'].includes(field)) ||
            typeof metadata.internalDate !== 'string' || !/^\d+$/.test(metadata.internalDate) || !Number.isSafeInteger(Number(metadata.internalDate)) ||
            !Number.isFinite(new Date(Number(metadata.internalDate)).getTime()) ||
            !(metadata.labelIds === undefined || Array.isArray(metadata.labelIds) && metadata.labelIds.every((label) => typeof label === 'string'))) {
          errors.push('METADATA_INVALID'); break;
        }
        rows.push({ messageHash: hashAcceptanceId('message', id, key), internalDate: new Date(Number(metadata.internalDate)).toISOString(),
          draft: Boolean(metadata.labelIds?.includes('DRAFT')) });
      }
      pages.push({ index, requestTokenHash: pageToken === null ? null : hashAcceptanceId('page', pageToken, key),
        nextTokenHash: next === null ? null : hashAcceptanceId('page', next, key), rowCount: rows.length - beforeCount });
      if (errors.length || next === null) break;
      pageToken = next;
    }
    const after = await gmail.getProfile();
    if (!validProfile(after) || before.historyId !== after.historyId || before.messagesTotal !== after.messagesTotal) errors.push('MAILBOX_CHANGED');
    if (rows.length !== before.messagesTotal) errors.push('MAILBOX_COUNT_MISMATCH');
  } catch {
    errors.push('CAPTURE_FAILED');
  }
  const result = manifest();
  if (!date(result.capturedAt) || result.capturedAt < cutoffAt) throw new Error('MAIL_ACCEPTANCE_INPUT_INVALID');
  return result;
}
