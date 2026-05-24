const SUPPORT_DATA_ROOT = '/assets/data';

function sanitizeRelativePath(relativePath) {
  if (!relativePath) return '';
  return String(relativePath).replace(/^\/+/, '');
}

/**
 * 現在の location.pathname に '/05_support/' が含まれていれば、その直前までを base path として返す。
 * 含まなければ空文字（本番ホスティングで document root = 05_support 配下の前提）。
 *
 * 本番（`https://support.speed-ad.com/news/`）→ ''
 * ローカル（`http://127.0.0.1:5500/05_support/news/`）→ '/05_support'
 * ローカル サブディレクトリ（`http://127.0.0.1:5500/sub/dir/05_support/faq/`）→ '/sub/dir/05_support'
 */
export function resolveSupportBasePath() {
  if (typeof window === 'undefined' || !window.location) return '';
  const path = window.location.pathname;
  const match = path.match(/^(.*\/05_support)\//);
  return match ? match[1] : '';
}

export function resolveSupportDataPath(relativePath) {
  const sanitized = sanitizeRelativePath(relativePath);
  const base = resolveSupportBasePath();
  return sanitized ? `${base}${SUPPORT_DATA_ROOT}/${sanitized}` : `${base}${SUPPORT_DATA_ROOT}`;
}

export function debounce(fn, delay = 250) {
  let timerId;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => fn(...args), delay);
  };
}
