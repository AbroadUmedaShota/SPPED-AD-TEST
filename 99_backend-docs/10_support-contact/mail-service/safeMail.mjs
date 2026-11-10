const secretParameter = /(?:^|[?#&])(?:token|access_token|id_token|refresh_token|code|state)=/i;

export function scrubSecretUrls(value) {
  return String(value ?? '').replace(/https?:\/\/[^\s<>"']+/gi, (raw) => {
    let decoded = raw;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const next = decodeURIComponent(decoded.replace(/&amp;/gi, '&'));
        if (next === decoded) break;
        decoded = next;
      } catch {
        return '[リンクを非表示]';
      }
    }
    return secretParameter.test(decoded) ? '[リンクを非表示]' : raw;
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
