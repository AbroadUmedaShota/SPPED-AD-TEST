import { randomUUID } from 'node:crypto';
import { assertMail } from './errors.mjs';

export const REQUEST_RETRY_MS = 7 * 24 * 60 * 60 * 1000;
const UUID_V7 = /^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

export function createRequestId(at = new Date()) {
  const millis = at.getTime();
  assertMail(Number.isSafeInteger(millis) && millis >= 0 && millis <= 0xffffffffffff);
  const stamp = millis.toString(16).padStart(12, '0');
  return `${stamp.slice(0, 8)}-${stamp.slice(8)}-7${randomUUID().slice(15)}`;
}

export function requestExpiresAt(id) {
  if (typeof id !== 'string' || !UUID_V7.test(id)) return null;
  const millis = Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16);
  return new Date(millis + REQUEST_RETRY_MS).toISOString();
}

export function assertCurrentRequestId(id, at) {
  const expiresAt = requestExpiresAt(id);
  assertMail(expiresAt && Date.parse(expiresAt) - REQUEST_RETRY_MS <= at.getTime() + 120000);
  assertMail(Date.parse(expiresAt) > at.getTime(), 'MAIL_REQUEST_EXPIRED', 409);
}
