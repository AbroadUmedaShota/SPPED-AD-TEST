import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { assertMail } from './errors.mjs';

export function suppressionKey(kind, id) {
  return createHash('sha256').update(`customer-speed-ad\0${kind}\0${id}`).digest('hex');
}

export function createPurgeGate(readControl) {
  const context = new AsyncLocalStorage();
  const generation = (control) => {
    const value = control?.generation ?? 0;
    assertMail(Number.isSafeInteger(value) && value >= 0, 'MAIL_MAINTENANCE', 503);
    return value;
  };
  function check(control, expected = context.getStore()) {
    assertMail(!control?.active, 'MAIL_MAINTENANCE', 503);
    if (expected !== undefined) assertMail(generation(control) === expected, 'MAIL_MAINTENANCE', 503);
  }
  return {
    check,
    async withAccess(operation) {
      const before = await readControl();
      check(before, undefined);
      return context.run(generation(before), async () => {
        const result = await operation();
        check(await readControl());
        return result;
      });
    }
  };
}
