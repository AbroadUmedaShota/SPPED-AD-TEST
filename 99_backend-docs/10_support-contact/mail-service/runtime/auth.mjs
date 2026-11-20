import { assertMail, MailError } from './errors.mjs';

export function validateActor(value) {
  const email = String(value?.email || '').trim().toLowerCase();
  const authMode = value?.authMode;
  assertMail((authMode === 'domain' && /^[^\s@]+@abroad-o\.com$/.test(email)) ||
    (authMode === 'customer-oauth' && email === 'customer@speed-ad.com'), 'MAIL_FORBIDDEN', 403);
  return { email, authMode };
}

export function createGoogleVerifier({ client, audience, deployerEmail, deployerSubject }) {
  assertMail(client && audience && deployerEmail && deployerSubject, 'MAIL_NOT_CONFIGURED', 503);
  return async (authorization) => {
    assertMail(typeof authorization === 'string' && /^Bearer [^\s]+$/.test(authorization), 'MAIL_AUTH_REQUIRED', 401);
    try {
      const ticket = await client.verifyIdToken({ idToken: authorization.slice(7), audience });
      const claims = ticket.getPayload();
      assertMail(claims && ['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) &&
        claims.aud === audience && (!claims.azp || claims.azp === audience) && claims.sub === deployerSubject && claims.email_verified === true &&
        claims.email === deployerEmail, 'MAIL_FORBIDDEN', 403);
      return { subject: claims.sub };
    } catch (error) {
      if (error instanceof MailError) throw error;
      throw new MailError('MAIL_AUTH_REQUIRED', 401);
    }
  };
}
