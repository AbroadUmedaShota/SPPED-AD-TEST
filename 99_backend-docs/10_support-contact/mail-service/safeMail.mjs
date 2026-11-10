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

function stripHtml(value) {
  const output = [];
  let index = 0;
  let textStart = 0;
  let activeTag = null;
  while (index < value.length) {
    if (value[index] !== '<') {
      index += 1;
      continue;
    }
    if (activeTag) {
      const nameEnd = index + 2 + activeTag.length;
      if (value[index + 1] === '/' && value.slice(index + 2, nameEnd).toLowerCase() === activeTag) {
        let end = nameEnd;
        while (end < value.length && /\s/.test(value[end])) end += 1;
        if (value[end] === '>') {
          activeTag = null;
          index = end + 1;
          textStart = index;
          continue;
        }
      }
      // Active content may contain comparison operators or incomplete inner tags.
      // Only its matching end tag can resume visible text.
      index += 1;
      continue;
    }
    if (textStart < index) output.push(value.slice(textStart, index));
    if (value.startsWith('<!--', index)) {
      const end = value.indexOf('-->', index + 4);
      if (end < 0) break;
      index = end + 3;
      textStart = index;
      continue;
    }
    let cursor = index + 1;
    const closing = value[cursor] === '/';
    if (closing) cursor += 1;
    const nameStart = cursor;
    while (cursor < value.length && /[a-z0-9:-]/i.test(value[cursor])) cursor += 1;
    const name = value.slice(nameStart, cursor).toLowerCase();
    let quote = null;
    while (cursor < value.length) {
      const char = value[cursor];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
      cursor += 1;
    }
    // Consume each tag once; unfinished markup and active blocks never become visible text.
    if (cursor === value.length) break;
    if (!closing && activeHtmlTags.has(name)) {
      let endContent = cursor - 1;
      while (endContent > index && /\s/.test(value[endContent])) endContent -= 1;
      if (name !== 'svg' || value[endContent] !== '/') activeTag = name;
    } else if ((!closing && name === 'br') || (closing && lineEndHtmlTags.has(name))) {
      output.push('\n');
    }
    index = cursor + 1;
    textStart = index;
  }
  if (index === value.length && !activeTag) output.push(value.slice(textStart));
  return output.join('');
}

export function htmlToPlainText(value) {
  const withoutActiveContent = stripHtml(String(value ?? ''));
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return safeMailText(withoutActiveContent.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name) => {
    if (name[0] !== '#') return entities[name.toLowerCase()];
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '';
  }));
}

export function safeFilename(value) {
  return safeMailText(value).replace(/[\\/\r\n]/g, '_').slice(0, 255) || 'attachment';
}
