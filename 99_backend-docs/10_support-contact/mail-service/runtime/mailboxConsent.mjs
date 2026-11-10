import { MAILBOX_DISCLOSURE_VERSION, MAILBOX_MARKER_DISCLOSURE, MAILBOX_SYNC_DISCLOSURE, MAILBOX_ACCEPTANCE_DISCLOSURE } from './mailboxDisclosure.mjs';
import { createGmailAdapter } from './googleAdapters.mjs';

export function createRuntimeGmailAdapter(options) {
  return createGmailAdapter({ ...options,
    requiredDisclosureVersion: MAILBOX_DISCLOSURE_VERSION,
    requiredDisclosureClause: `${MAILBOX_SYNC_DISCLOSURE}\n${MAILBOX_MARKER_DISCLOSURE}\n${MAILBOX_ACCEPTANCE_DISCLOSURE}` });
}
