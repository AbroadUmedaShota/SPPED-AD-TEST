import { MAX_ATTACHMENT_BYTES } from '../attachmentLimits.mjs';
import { assertMail, MailError } from './errors.mjs';

// One attachment response in process memory only. The upstream read has its own
// 30-second deadline; another attachment cannot start while that read is pending.
export function createAttachmentCache({ now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout,
  idleMs = 120000, maxAgeMs = 300000, maxBytes = MAX_ATTACHMENT_BYTES } = {}) {
  let entry = null;
  const expired = (item) => now() >= Math.min(item.createdAt + maxAgeMs, item.lastAccess + idleMs);
  function discard(item) {
    if (entry !== item) return;
    if (item.timer) clearTimer(item.timer);
    entry = null;
  }
  function arm(item) {
    if (item.timer) clearTimer(item.timer);
    const delay = Math.max(0, Math.min(item.createdAt + maxAgeMs, item.lastAccess + idleMs) - now());
    item.timer = setTimer(() => discard(item), delay);
    item.timer?.unref?.();
  }
  function validate(value) {
    const data = value?.size === 0 && value.data == null ? '' : value?.data;
    assertMail(typeof data !== 'string' || data.length <= Math.ceil(maxBytes / 3) * 4 + 4, 'MAIL_SIZE_LIMIT', 413);
    assertMail(typeof data === 'string' && /^[a-zA-Z0-9_-]*={0,2}$/.test(data) && data.length % 4 !== 1,
      'MAIL_INVALID_UPSTREAM', 502);
    const padding = data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0;
    assertMail(!padding || data.length % 4 === 0, 'MAIL_INVALID_UPSTREAM', 502);
    const size = Math.floor((data.length - padding) * 6 / 8);
    assertMail(size <= maxBytes, 'MAIL_SIZE_LIMIT', 413);
    assertMail(Number.isSafeInteger(value.size) && value.size === size, 'MAIL_INVALID_UPSTREAM', 502);
    return Object.freeze({ data, size });
  }
  return {
    async get(key, load) {
      if (entry && !entry.loading && expired(entry)) discard(entry);
      if (entry?.key === key) {
        entry.lastAccess = now();
        if (!entry.loading) arm(entry);
        return entry.promise;
      }
      if (entry?.loading) throw new MailError('MAIL_ATTACHMENT_BUSY', 503);
      if (entry) discard(entry);
      const item = { key, createdAt: now(), lastAccess: now(), loading: true };
      entry = item;
      item.promise = Promise.resolve().then(load).then(validate).then((value) => {
        item.loading = false;
        if (entry === item) {
          if (expired(item)) discard(item);
          else arm(item);
        }
        return value;
      }, (error) => { discard(item); throw error; });
      return item.promise;
    }
  };
}
