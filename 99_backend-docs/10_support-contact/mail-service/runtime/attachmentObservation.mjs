import { assertMail } from './errors.mjs';
import { MAX_ATTACHMENT_BYTES, ATTACHMENT_CHUNK_SIZE } from '../attachmentLimits.mjs';

export { ATTACHMENT_CHUNK_SIZE };

// Store only bounded transfer metadata, never attachment bytes.
export function observeAttachment(item, availability, at, transfer) {
  if (availability === 'unavailable') return { ...item, availability, checkedAt: at, servedChunks: [], transferVersion: 1 };
  assertMail(availability === 'served' && transfer && Number.isSafeInteger(transfer.totalSize) && transfer.totalSize >= 0 &&
    transfer.totalSize <= MAX_ATTACHMENT_BYTES && Number.isSafeInteger(transfer.offset) && transfer.offset >= 0 &&
    (transfer.offset < transfer.totalSize || (transfer.offset === 0 && transfer.totalSize === 0)) && transfer.offset % ATTACHMENT_CHUNK_SIZE === 0 &&
    /^[a-f0-9]{64}$/.test(transfer.contentDigest), 'MAIL_INVALID_REQUEST');
  const same = item.transferVersion === 1 && item.transferSize === transfer.totalSize && item.transferDigest === transfer.contentDigest;
  const servedChunks = [...new Set([...(same ? item.servedChunks || [] : []), transfer.offset])].sort((a, b) => a - b);
  const expected = Math.max(1, Math.ceil(transfer.totalSize / ATTACHMENT_CHUNK_SIZE));
  const complete = Array.from({ length: expected }, (_, index) => index * ATTACHMENT_CHUNK_SIZE).every((offset) => servedChunks.includes(offset));
  return { ...item, availability: complete ? 'verified' : 'unverified', checkedAt: at, transferVersion: 1,
    transferSize: transfer.totalSize, transferDigest: transfer.contentDigest, servedChunks };
}

export function attachmentReviewReady(record) {
  return record.bodyAvailability === 'verified' && (record.attachments || []).every((item) => item.availability === 'verified' && item.transferVersion === 1);
}
