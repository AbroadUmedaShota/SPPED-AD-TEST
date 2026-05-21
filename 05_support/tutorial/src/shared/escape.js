export function escapeHtml(value) {
    if (value == null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const ESCAPE_REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

export function escapeRegex(value) {
    if (value == null) return '';
    return String(value).replace(ESCAPE_REGEX_SPECIAL, '\\$&');
}

export function highlightText(text, keyword) {
    const safeText = escapeHtml(text);
    if (!keyword) return safeText;
    const trimmed = String(keyword).trim();
    if (!trimmed) return safeText;
    // スペース区切りの複数キーワードを OR パターン化（AND 検索のハイライトと整合）
    const tokens = trimmed.split(/\s+/).filter(Boolean).map(escapeRegex);
    if (tokens.length === 0) return safeText;
    try {
        const pattern = new RegExp(tokens.join('|'), 'gi');
        return safeText.replace(pattern, (match) => `<mark>${match}</mark>`);
    } catch {
        return safeText;
    }
}
