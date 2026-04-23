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
    try {
        const pattern = new RegExp(escapeRegex(trimmed), 'gi');
        return safeText.replace(pattern, (match) => `<mark>${match}</mark>`);
    } catch {
        return safeText;
    }
}
