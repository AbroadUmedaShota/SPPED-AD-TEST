import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { MailError, safeError } from './errors.mjs';

export function createMailHttpServer({ verify, execute, log = () => {} }) {
  return createServer(async (request, response) => {
    const diagnosticId = randomUUID();
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (request.method !== 'POST' || request.url !== '/rpc') throw new MailError('MAIL_NOT_FOUND', 404);
      await verify(request.headers.authorization);
      if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] || ''))) throw new MailError('MAIL_INVALID_REQUEST', 415);
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 256 * 1024) throw new MailError('MAIL_REQUEST_TOO_LARGE', 413);
        chunks.push(chunk);
      }
      let envelope;
      try { envelope = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new MailError('MAIL_INVALID_REQUEST'); }
      const result = await execute(envelope);
      response.statusCode = 200;
      response.end(JSON.stringify(result));
      log({ diagnosticId, operation: typeof envelope.operation === 'string' ? envelope.operation : 'unknown', status: 200 });
    } catch (error) {
      const safe = safeError(error);
      response.statusCode = safe.status;
      response.end(JSON.stringify({ ok: false, error: { code: safe.code }, diagnosticId }));
      log({ diagnosticId, code: safe.code, status: safe.status });
    }
  });
}
