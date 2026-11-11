import { defaultTreeAdapter, parseFragment } from 'parse5';

const secretParameter = /(?:^|[?#&])(?:token|access_token|id_token|refresh_token|secret|code|state)=/i;
const urlColon = '(?::|%(?:25)*3a|&(?:amp;)*(?:colon|#0*58|#x0*3a);)';
const urlSlash = '(?:/|%(?:25)*2f|&(?:amp;)*(?:sol|#0*47|#x0*2f);)';
const urlCandidate = new RegExp(`https?${urlColon}${urlSlash}${urlSlash}[^\\s<>"']*`, 'gi');
const urlEntities = { amp: '&', colon: ':', sol: '/', quest: '?', num: '#', equals: '=' };

function decodeUrlEntities(value) {
  return value.replace(/&(amp|colon|sol|quest|num|equals|#x[0-9a-f]+|#\d+);/gi, (_entity, name) => {
    if (name[0] !== '#') return urlEntities[name.toLowerCase()];
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  });
}

export function scrubSecretUrls(value) {
  return String(value ?? '').replace(urlCandidate, (raw) => {
    let decoded = raw;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const entitiesDecoded = decodeUrlEntities(decoded);
        const next = /%[0-9a-f]{2}/i.test(entitiesDecoded) ? decodeURIComponent(entitiesDecoded) : entitiesDecoded;
        if (next === decoded) break;
        decoded = next;
      } catch {
        return '[リンクを非表示]';
      }
    }
    // Deep or malformed URL encoding is hidden rather than passed to an API with an undecided secret value.
    const undecoded = !/^https?:\/\//i.test(decoded) || /%[0-9a-f]{2}|&(?:amp|colon|sol|quest|num|equals|#x[0-9a-f]+|#\d+);/i.test(decoded);
    return undecoded || secretParameter.test(decoded) ? '[リンクを非表示]' : raw;
  });
}

export function safeMailText(value) {
  return scrubSecretUrls(String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ''));
}

const activeHtmlTags = new Set(['script', 'style', 'iframe', 'object', 'svg']);
const lineEndHtmlTags = new Set(['p', 'div', 'li', 'tr', 'blockquote']);
const maxHtmlMarkupCandidates = 20000;
const maxHtmlTreeNodes = 20000;

function assertHtmlComplexity(value) {
  let candidates = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 60) continue;
    const next = value.charCodeAt(index + 1);
    if ((next >= 65 && next <= 90) || (next >= 97 && next <= 122) || next === 47 || next === 33 || next === 63) {
      candidates += 1;
      if (candidates > maxHtmlMarkupCandidates) throw new Error('MAIL_HTML_STRUCTURE_LIMIT');
    }
  }
}

function boundedHtmlTreeAdapter() {
  let createdNodes = 0;
  const reserveNode = () => {
    if (createdNodes >= maxHtmlTreeNodes) throw new Error('MAIL_HTML_STRUCTURE_LIMIT');
    createdNodes += 1;
  };
  const adapter = { ...defaultTreeAdapter };
  for (const method of ['createDocument', 'createDocumentFragment', 'createElement', 'createCommentNode', 'createTextNode']) {
    adapter[method] = (...args) => {
      reserveNode();
      return defaultTreeAdapter[method](...args);
    };
  }
  // These default methods construct nodes internally through the original adapter.
  adapter.insertText = (parent, text) => {
    if (parent.childNodes.at(-1)?.nodeName !== '#text') reserveNode();
    defaultTreeAdapter.insertText(parent, text);
  };
  adapter.insertTextBefore = (parent, text, reference) => {
    const children = parent.childNodes;
    const index = children.at(-1) === reference ? children.length - 1 : children.indexOf(reference);
    if (children[index - 1]?.nodeName !== '#text') reserveNode();
    defaultTreeAdapter.insertTextBefore(parent, text, reference);
  };
  adapter.setDocumentType = (document, ...args) => {
    if (!document.childNodes.some((node) => node.nodeName === '#documentType')) reserveNode();
    defaultTreeAdapter.setDocumentType(document, ...args);
  };
  return adapter;
}

export function htmlToPlainText(value) {
  const html = String(value ?? '');
  // Bound potential tree allocation before invoking the standards parser. This does not interpret markup.
  assertHtmlComplexity(html);
  const fragment = parseFragment(html, { treeAdapter: boundedHtmlTreeAdapter() });
  const output = [];
  const pending = [fragment];
  while (pending.length) {
    const node = pending.pop();
    if (node === '\n') output.push('\n');
    else if (node.nodeName === '#text') output.push(node.value);
    else if (!activeHtmlTags.has(node.tagName)) {
      if (node.tagName === 'br') output.push('\n');
      if (lineEndHtmlTags.has(node.tagName)) pending.push('\n');
      const children = node.childNodes || [];
      for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index]);
    }
  }
  return safeMailText(output.join('').replace(/\u00a0/g, ' '));
}

export function safeFilename(value) {
  return safeMailText(value).replace(/[\\/\r\n]/g, '_').slice(0, 255) || 'attachment';
}
