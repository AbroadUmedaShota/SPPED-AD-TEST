const SUPPORT_COMMON_ROOT = '/common';
const SUPPORT_COMMON_VERSION = '20260519-plans-news';

async function loadSupportFragment(targetId, path) {
  const target = document.getElementById(targetId);
  if (!target) return;

  try {
    const separator = path.includes('?') ? '&' : '?';
    const response = await fetch(`${path}${separator}v=${SUPPORT_COMMON_VERSION}`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    target.innerHTML = await response.text();
  } catch (error) {
    console.error(`[support-shell] Failed to load ${path}:`, error);
  }
}

function getCurrentSupportSection() {
  if (document.body.dataset.supportSection) {
    return document.body.dataset.supportSection;
  }

  const path = window.location.pathname;
  if (path.includes('/faq/')) return 'faq';
  if (path.includes('/bug-report/')) return 'bug-report';
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
  await Promise.all([
    loadSupportFragment('support-header-placeholder', `${SUPPORT_COMMON_ROOT}/header.html`),
    loadSupportFragment('support-footer-placeholder', `${SUPPORT_COMMON_ROOT}/footer.html`),
  ]);
  markCurrentNav();
}

initSupportShell();
