import { resolveSupportBasePath } from './utils.js';

const SUPPORT_COMMON_ROOT = '/common';
const SUPPORT_COMMON_VERSION = '20260519-plans-news';

const REWRITE_PREFIX_PATTERN = /(src|href)="\/(assets|common|news|help-content|help|faq|contact|bug-report|plans|tutorial|customer-voices|terms|privacy|tokushoho)\//g;

/**
 * 注入する fragment HTML 内の `/assets/...` `/common/...` などの絶対パス参照を、
 * ローカル開発 (pathname に `/05_support/` を含む) では base path 前置に書き換える。
 * 本番ホスティング (base = '') では文字列はそのまま。
 */
function rewriteFragmentPaths(html) {
  const base = resolveSupportBasePath();
  if (!base) return html;
  return html.replace(REWRITE_PREFIX_PATTERN, `$1="${base}/$2/`);
}

async function loadSupportFragment(targetId, path) {
  const target = document.getElementById(targetId);
  if (!target) return;

  try {
    const separator = path.includes('?') ? '&' : '?';
    const response = await fetch(`${path}${separator}v=${SUPPORT_COMMON_VERSION}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    target.innerHTML = rewriteFragmentPaths(await response.text());
  } catch (error) {
    console.error(`[support-shell] Failed to load ${path}:`, error);
  }
}

function getCurrentSupportSection() {
  if (document.body.dataset.supportSection) {
    return document.body.dataset.supportSection;
  }

  const path = window.location.pathname;
  if (path.includes('/news/')) return 'news';
  if (path.includes('/faq/')) return 'faq';
  if (path.includes('/contact/')) return 'contact';
  if (path.includes('/bug-report/')) return 'contact';
  return 'help';
}

function markCurrentNav() {
  const current = getCurrentSupportSection();
  document.querySelectorAll('[data-support-nav]').forEach((link) => {
    const isCurrent = link.dataset.supportNav === current;
    link.classList.toggle('is-active', isCurrent);
    if (isCurrent) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

async function initSupportShell() {
  const base = resolveSupportBasePath();
  await Promise.all([
    loadSupportFragment('support-header-placeholder', `${base}${SUPPORT_COMMON_ROOT}/header.html`),
    loadSupportFragment('support-footer-placeholder', `${base}${SUPPORT_COMMON_ROOT}/footer.html`),
  ]);
  markCurrentNav();
}

initSupportShell();
