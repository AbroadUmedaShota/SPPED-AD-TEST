export class MailError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function assertMail(condition, code = 'MAIL_INVALID_REQUEST', status = 400) {
  if (!condition) throw new MailError(code, status);
}

export function safeError(error) {
  return error instanceof MailError ? error : new MailError('MAIL_UNAVAILABLE', 503);
}
