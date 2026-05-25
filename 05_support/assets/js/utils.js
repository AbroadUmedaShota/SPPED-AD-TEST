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

/**
 * 公開日から N 日以内かどうか（NEW バッジ判定）。
 */
export function isNewArticle(item, days = 7) {
  if (!item?.date) return false;
  const published = new Date(item.date);
  if (Number.isNaN(published.valueOf())) return false;
  const diffDays = (Date.now() - published.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

/**
 * 重要記事フラグ（pinned: true）。
 */
export function isPinned(item) {
  return Boolean(item?.pinned);
}

const NEWS_DEFAULT_IMAGE_PATH = 'assets/img/news-default.svg';

const NEWS_CATEGORY_IMAGE_MAP = {
  'アップデート': 'assets/img/news-update.svg',
  'お知らせ':     'assets/img/news-info.svg',
  'メンテナンス': 'assets/img/news-maint.svg',
  '障害情報':     'assets/img/news-incident.svg',
  'プレスリリース': 'assets/img/news-press.svg',
};

/**
 * お知らせ記事の画像パスを解決する。
 * - 明示指定あり → http(s) はそのまま、'05_support/' はサポート配下相対、
 *   'img/' はプロジェクトルート相対、それ以外はサポート配下相対。
 * - 明示指定なし → category に応じたカテゴリ別デフォルト SVG を返す。
 *   未知の category または category 未指定なら NEWS_DEFAULT_IMAGE_PATH。
 */
export function resolveNewsImagePath(imagePath, category) {
  let path = imagePath;
  if (!path) {
    path = (category && NEWS_CATEGORY_IMAGE_MAP[category]) || NEWS_DEFAULT_IMAGE_PATH;
  }
  if (/^https?:\/\//.test(path)) return path;
  const base = resolveSupportBasePath();
  const clean = String(path).replace(/^\/+/, '');
  if (clean.startsWith('05_support/')) {
    return `${base}/${clean.replace(/^05_support\//, '')}`;
  }
  if (clean.startsWith('img/')) {
    const projectRoot = base.replace(/\/05_support$/, '');
    return `${projectRoot}/${clean}`;
  }
  return `${base}/${clean}`;
}
