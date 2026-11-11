import { htmlToPlainText, safeFilename, safeMailText } from './safeMail.mjs';
import { MAX_ATTACHMENT_BYTES } from './attachmentLimits.mjs';

const defaultLimits = { maxParts: 500, maxDepth: 20, maxBytes: MAX_ATTACHMENT_BYTES, maxTextBytes: 2 * 1024 * 1024 };

export function headerValue(headers, name) {
  return (headers || []).filter((header) => String(header.name).toLowerCase() === name.toLowerCase())
    .map((header) => String(header.value || '')).join(' ');
}

function decodeData(data, maxBytes) {
  if (typeof data !== 'string' || !/^[a-zA-Z0-9_-]*={0,2}$/.test(data) || data.length % 4 === 1) {
    throw new Error('INVALID_MIME_DATA');
  }
  if (data.length > Math.ceil(maxBytes / 3) * 4 + 4) throw new Error('MAIL_SIZE_LIMIT');
  const bytes = Buffer.from(data, 'base64url');
  if (bytes.length > maxBytes) throw new Error('MAIL_SIZE_LIMIT');
  return bytes;
}

function decodeText(bytes, headers) {
  const charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(headerValue(headers, 'content-type'))?.[1] || 'utf-8';
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    throw new Error('UNSUPPORTED_MAIL_CHARSET');
  }
}

export function inspectMime(message, options = {}) {
  const limits = { ...defaultLimits, ...options };
  const attachments = [];
  const bodyParts = [];
  let count = 0;
  function visit(part, path, depth, insideAttachment = false) {
    count += 1;
    if (count > limits.maxParts || depth > limits.maxDepth) throw new Error('MIME_STRUCTURE_LIMIT');
    if (!part || typeof part !== 'object') throw new Error('INVALID_MIME_PART');
    const mimeType = String(part.mimeType || 'application/octet-stream').toLowerCase().split(';')[0].trim();
    const disposition = headerValue(part.headers, 'content-disposition');
    const contentId = safeMailText(headerValue(part.headers, 'content-id'));
    const isAttachment = Boolean(part.filename || /\battachment\b/i.test(disposition) || contentId || (!mimeType.startsWith('multipart/') && !['text/plain', 'text/html'].includes(mimeType)));
    const body = part.body || {};
    const size = Number(body.size || 0);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('INVALID_MIME_SIZE');
    const descriptor = { partId: path, gmailPartId: String(part.partId || ''), name: safeFilename(part.filename), mimeType, size, attachmentId: body.attachmentId ? String(body.attachmentId) : null, inline: /\binline\b/i.test(disposition) || Boolean(contentId), contentId };
    if (isAttachment) attachments.push(descriptor);
    else if (!insideAttachment && ['text/plain', 'text/html'].includes(mimeType)) bodyParts.push(descriptor);
    if (part.parts != null && !Array.isArray(part.parts)) throw new Error('INVALID_MIME_PARTS');
    (part.parts || []).forEach((child, index) => visit(child, `${path}.${index}`, depth + 1, insideAttachment || isAttachment));
  }
  if (!message?.id || !message.payload) throw new Error('INVALID_GMAIL_MESSAGE');
  visit(message.payload, '0', 0);
  return { messageId: String(message.id), attachments, bodyParts };
}

function findPart(message, path) {
  const indexes = path.split('.');
  if (indexes.shift() !== '0' || indexes.some((index) => !/^\d+$/.test(index))) throw new Error('INVALID_MIME_PART_ID');
  let part = message.payload;
  for (const index of indexes) part = part?.parts?.[Number(index)];
  if (!part) throw new Error('MIME_PART_NOT_FOUND');
  return part;
}

async function readPart(message, descriptor, fetchAttachment, maxBytes, cacheAttachment = false) {
  if (descriptor.size > maxBytes) throw new Error('MAIL_SIZE_LIMIT');
  const part = findPart(message, descriptor.partId);
  let data = part.body?.data;
  if (descriptor.attachmentId) {
    if (typeof fetchAttachment !== 'function') throw new Error('MAIL_CONTENT_UNAVAILABLE');
    const result = await fetchAttachment(String(message.id), descriptor.attachmentId, { cache: cacheAttachment });
    data = result?.data;
  }
  if (data == null) {
    if (descriptor.size !== 0 || part.parts?.length) throw new Error('MAIL_CONTENT_UNAVAILABLE');
    data = '';
  }
  const bytes = decodeData(data, maxBytes);
  if (bytes.length === 0 && part.parts?.length) throw new Error('MAIL_CONTENT_UNAVAILABLE');
  if (descriptor.size !== bytes.length) throw new Error('MIME_SIZE_MISMATCH');
  return { bytes, part };
}

async function selectBodyParts(message, bodyParts, readText) {
  const byPath = new Map(bodyParts.map((part) => [part.partId, part]));
  const containsPlain = (path) => bodyParts.some((part) => part.mimeType === 'text/plain' && (part.partId === path || part.partId.startsWith(`${path}.`)));
  async function select(part, path) {
    const children = (part.parts || []).map((child, index) => ({ part: child, path: `${path}.${index}` }));
    const mimeType = String(part.mimeType || '').toLowerCase().split(';')[0].trim();
    if (mimeType === 'multipart/alternative') {
      const evaluated = new Map();
      for (const child of children.filter((item) => containsPlain(item.path))) {
        const values = await select(child.part, child.path);
        evaluated.set(child.path, values);
        if (values.some((item) => item.mimeType === 'text/plain' && /\S/u.test(item.text))) return values;
      }
      for (const child of children) {
        const values = evaluated.has(child.path) ? evaluated.get(child.path) : await select(child.part, child.path);
        if (values.some((item) => /\S/u.test(item.text))) return values;
      }
      return [];
    }
    const values = byPath.has(path) ? [await readText(byPath.get(path))] : [];
    for (const child of children) values.push(...await select(child.part, child.path));
    return values;
  }
  return select(message.payload, '0');
}

export async function readMessageText(message, fetchAttachment, options = {}) {
  const limits = { ...defaultLimits, ...options };
  const { bodyParts } = inspectMime(message, limits);
  let total = 0;
  const selected = await selectBodyParts(message, bodyParts, async (descriptor) => {
    const { bytes, part } = await readPart(message, descriptor, fetchAttachment, limits.maxTextBytes - total);
    total += bytes.length;
    const text = decodeText(bytes, part.headers);
    return { mimeType: descriptor.mimeType, text: descriptor.mimeType === 'text/html' ? htmlToPlainText(text) : safeMailText(text) };
  });
  return selected.map((part) => part.text).join('\n');
}

function previewType(bytes, declaredMime) {
  if (declaredMime === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return ['image', declaredMime];
  if (declaredMime === 'image/jpeg' && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return ['image', declaredMime];
  if (declaredMime === 'image/gif' && /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii'))) return ['image', declaredMime];
  if (declaredMime === 'image/webp' && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return ['image', declaredMime];
  if (declaredMime === 'application/pdf' && bytes.subarray(0, 5).toString('ascii') === '%PDF-') return ['pdf', declaredMime];
  if (declaredMime === 'text/plain') {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (!bytes.includes(0)) return ['text', 'text/plain'];
    } catch { /* A binary file labelled text remains a download. */ }
  }
  return ['download', 'application/octet-stream'];
}

export async function readMailAttachment(message, partId, fetchAttachment, options = {}) {
  const limits = { ...defaultLimits, ...options };
  const descriptor = inspectMime(message, limits).attachments.find((item) => item.partId === partId);
  if (!descriptor) throw new Error('MAIL_ATTACHMENT_NOT_FOUND');
  const { bytes } = await readPart(message, descriptor, fetchAttachment, limits.maxBytes, true);
  const [previewKind, mimeType] = previewType(bytes, descriptor.mimeType);
  return { ...descriptor, mimeType, previewKind, bytes, ...(previewKind === 'text' ? { text: safeMailText(bytes.toString('utf8')) } : {}) };
}
