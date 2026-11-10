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

export function htmlToPlainText(value) {
  const withoutActiveContent = String(value ?? '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<(script|style|iframe|object|svg)\b[^>]*>[^]*?<\/\1\s*>/gi, '')
    .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '');
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
