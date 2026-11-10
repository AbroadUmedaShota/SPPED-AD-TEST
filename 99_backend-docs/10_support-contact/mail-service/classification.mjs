import { headerValue } from './mime.mjs';

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function normalizeCaseId(value) {
  const id = String(value || '').toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id) ? id : null;
}

function caseIdsIn(value) {
  return [...new Set((String(value || '').match(uuidPattern) || []).map((id) => id.toLowerCase()))].sort();
}

export function currentMessageText(bodyText) {
  const lines = String(bodyText || '').replace(/\r\n/g, '\n').split('\n');
  const current = [];
  for (const line of lines) {
    if (/^\s*>/.test(line) || /^\s*(?:On .+wrote:|.+さんは書きました[：:]|[-_]{2,}\s*(?:Original Message|元のメッセージ|転送メッセージ)|Begin forwarded message:)/i.test(line)) break;
    current.push(line);
  }
  return current.join('\n');
}

export function replyMessageIds(headers) {
  const values = `${headerValue(headers, 'in-reply-to')} ${headerValue(headers, 'references')}`;
  return [...new Set(values.match(/<[^<>\s]+@[^<>\s]+>/g) || [])].sort();
}

/** trustedAnchor must be established by the intake-template/transport adapter, never by UI input. */
export function classifyMessage({ bodyText = '', headers = [], trustedAnchor = false }, knownCaseIds, referenceMatches = []) {
  const known = new Set([...knownCaseIds].map(normalizeCaseId).filter(Boolean));
  const allBodyIds = caseIdsIn(bodyText);
  const currentIds = caseIdsIn(currentMessageText(bodyText));
  const references = new Set(replyMessageIds(headers));
  const parents = referenceMatches.filter((item) => references.has(item.rfcMessageId));
  const directParents = headerValue(headers, 'in-reply-to').match(/<[^<>\s]+@[^<>\s]+>/g) || [];
  const ancestry = headerValue(headers, 'references').match(/<[^<>\s]+@[^<>\s]+>/g) || [];
  const nearestParents = directParents.length ? directParents : ancestry.slice(-1);
  const parentIds = [...new Set(parents.filter((item) => item.matchState === 'matched').map((item) => normalizeCaseId(item.caseId)).filter(Boolean))].sort();
  const evidence = { bodyCaseIds: allBodyIds, currentCaseIds: currentIds, parentMessageIds: parents.map((item) => String(item.messageId)).sort() };
  const pending = (reason) => ({ matchState: 'pending', caseId: null, reason, evidence });
  if (allBodyIds.some((id) => !known.has(id)) || parentIds.some((id) => !known.has(id))) return pending('unknown_case_id');
  if (parents.some((item) => item.matchState !== 'matched')) return pending('unresolved_reply_parent');
  if (nearestParents.some((id) => !parents.some((parent) => parent.rfcMessageId === id))) return pending('unresolved_reply_parent');
  if (allBodyIds.length > 1 || parentIds.length > 1) return pending('multiple_cases');
  const candidateIds = [...new Set([...allBodyIds, ...parentIds])];
  if (candidateIds.length > 1) return pending('conflicting_reply_case');
  if (trustedAnchor && currentIds.length === 1) {
    return { matchState: 'matched', caseId: currentIds[0], reason: 'trusted_current_case_id', evidence };
  }
  if (parentIds.length === 1) {
    return { matchState: 'matched', caseId: parentIds[0], reason: 'verified_reply_ancestry', evidence };
  }
  if (allBodyIds.length && !currentIds.length) return pending('quoted_case_id_only');
  if (currentIds.length) return pending('untrusted_case_anchor');
  return pending('no_proven_case');
}
