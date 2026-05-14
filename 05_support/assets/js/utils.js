const SUPPORT_DATA_ROOT = '/assets/data';

function sanitizeRelativePath(relativePath) {
  if (!relativePath) return '';
  return String(relativePath).replace(/^\/+/, '');
}

export function resolveSupportDataPath(relativePath) {
  const sanitized = sanitizeRelativePath(relativePath);
  return sanitized ? `${SUPPORT_DATA_ROOT}/${sanitized}` : SUPPORT_DATA_ROOT;
}

export function debounce(fn, delay = 250) {
  let timerId;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => fn(...args), delay);
  };
}
