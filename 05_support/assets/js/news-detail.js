import { resolveSupportDataPath, resolveSupportBasePath } from './utils.js';

const NEWS_URL_PATTERN = /^05_support\/news\/[a-z0-9_-]+\/?$/i;
const RELATED_MAX = 4;
const READ_CHARS_PER_MIN = 450;

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function isValidRel(u) { return typeof u === 'string' && NEWS_URL_PATTERN.test(u); }
function getSlug(url) { return url.replace(/^05_support\/news\//,'').replace(/\/$/,''); }
function sortDesc(items) { return [...items].sort((a,b) => String(b?.date||'').localeCompare(String(a?.date||''))); }

function getCurrentSlug() {
  if (typeof window === 'undefined' || !window.location) return '';
  const segs = window.location.pathname.replace(/\/$/, '').split('/');
  const last = segs[segs.length-1];
  return last === 'index.html' ? segs[segs.length-2] : last;
}

function calculateReadMin() {
  const main = document.querySelector('.article-main');
  if (!main) return 1;
  const lede = main.querySelector('.article-lede')?.textContent ?? '';
  const body = main.querySelector('.article-body')?.textContent ?? '';
  const len = (lede + body).replace(/\s+/g, '').length;
  return Math.max(1, Math.ceil(len / READ_CHARS_PER_MIN));
}

function setReadMin() {
  const el = document.querySelector('.ah-meta .read');
  if (el) el.textContent = `READ ${calculateReadMin()} MIN`;
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.removeAttribute('hidden');
  toast.classList.add('on');
  setTimeout(() => {
    toast.classList.remove('on');
    setTimeout(() => toast.setAttribute('hidden', ''), 200);
  }, 1600);
}

function bindShareButtons() {
  document.querySelectorAll('.share-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.share;
      const url = window.location.href;
      const title = document.title;
      if (type === 'copy') {
        try { await navigator.clipboard?.writeText(url); showToast('URLをコピーしました'); } catch(e){}
      } else if (type === 'twitter') {
        window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank', 'noopener,noreferrer');
      } else if (type === 'linkedin') {
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
      } else if (type === 'native') {
        if (navigator.share) {
          try { await navigator.share({ title, url }); } catch(e){}
        } else {
          try { await navigator.clipboard?.writeText(url); showToast('URLをコピーしました'); } catch(e){}
        }
      }
    });
  });
}

async function loadRelated() {
  const container = document.getElementById('article-related');
  const card = document.getElementById('related-card');
  if (!container) return;
  const selfSlug = getCurrentSlug();
  const base = resolveSupportBasePath();
  try {
    const res = await fetch(resolveSupportDataPath('news.json'), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const others = items.filter(it => isValidRel(it?.url) && getSlug(it.url) !== selfSlug);
    const sorted = sortDesc(others).slice(0, RELATED_MAX);
    if (!sorted.length) { card?.setAttribute('hidden',''); return; }
    container.innerHTML = sorted.map(it => {
      const href = esc(`${base}/news/${getSlug(it.url)}/`);
      const date = esc(it.displayDate || String(it.date||'').replace(/-/g,'.'));
      const title = esc(it.title || '');
      return `<li><a href="${href}"><div class="r-date">${date}</div><div class="r-title">${title}</div></a></li>`;
    }).join('');
  } catch (err) {
    console.error('[news-detail] Failed to load related:', err);
    card?.setAttribute('hidden','');
  }
}

setReadMin();
bindShareButtons();
loadRelated();
