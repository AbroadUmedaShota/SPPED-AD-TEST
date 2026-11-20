import { validMailboxConsentReceipt } from './mailboxDisclosure.mjs';
import { createGmailAdapter } from './googleAdapters.mjs';

export function createRuntimeGmailAdapter(options) {
  return createGmailAdapter({ ...options, validateConsentReceipt: (receipt) => {
    try { return validMailboxConsentReceipt(receipt, options?.now ? options.now() : Date.now()); }
    catch { return false; }
  } });
}
