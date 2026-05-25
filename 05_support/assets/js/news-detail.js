/* ============================================================
   News Detail Page Enhancements — Timeline Cool (案C)
   - 適用範囲: 05_support/news/<slug>/index.html
   - buildTOC()       : .article-body > h2 を自動列挙、#article-toc に出力
   - setReadMin()     : .article-lede + .article-body の文字数から READ N MIN 算出
   - bindShareButtons(): Share / X / LinkedIn / URL コピー
   - loadRelated()    : news.json から自身を除いた最新最大4件を #article-related に描画
   - initScrollSpy()  : 表示中の h2 に対応する TOC リンクへ .on を付与
   - JSON 由来文字列は HTML エスケープ。url は形式検証して描画スキップ。
   ============================================================ */

import {
  resolveSupportDataPath,
  resolveSupportBasePath,
  isNewArticle,
  isPinned,
} from './utils.js';

const NEWS_URL_PATTERN = /^05_support\/news\/[a-z0-9_-]+\/?$/i;
const RELATED_MAX = 4;
const READ_CHARS_PER_MIN = 450;

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function isValidNewsUrl(url) {
  return typeof url === 'string' && NEWS_URL_PATTERN.test(url);
}

function getCurrentSlug() {
  if (typeof window === 'undefined' || !window.location) return '';
  return window.location.pathname.replace(/\/$/, '').split('/').pop() || '';
}

function getSlugFromUrl(url) {
  return url.replace(/^05_support\/news\//, '').replace(/\/$/, '');
}

function sortItemsByDateDesc(items) {
  return [...items].sort((a, b) => {
    const da = String(a?.date || '');
    const db = String(b?.date || '');
    if (da < db) return 1;
    if (da > db) return -1;
    return 0;
  });
}

/**
 * TOC 構築: .article-body 内の <h2> を順に走査し、id が無いものには
 * `section-N` を付与してリンク先を確保する。
 * モック準拠でシンプル構造 (<li><a href="#id">テキスト</a></li>)。
 */
function buildTOC() {
  const toc = document.getElementById('article-toc');
  if (!toc) return;

  const headings = document.querySelectorAll('.article-body h2');
  if (!headings.length) {
    toc.closest('.aside-card')?.setAttribute('hidden', '');
    return;
  }

  toc.innerHTML = Array.from(headings).map((h, i) => {
    const id = h.id || `section-${i + 1}`;
    h.id = id;
    return `<li><a href="#${escapeHtml(id)}">${escapeHtml(h.textContent)}</a></li>`;
  }).join('');
}

/**
 * 本文文字数から READ N MIN を算出。下限 1 分。
 */
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
  const buttons = document.querySelectorAll('.share-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.share;
      if (type === 'copy') {
        navigator.clipboard?.writeText(window.location.href);
        showToast('URLをコピーしました');
      } else if (type === 'twitter') {
        const url = `https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(document.title)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (type === 'linkedin') {
        const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
      } else if (type === 'native') {
        if (navigator.share) {
          navigator.share({ title: document.title, url: window.location.href }).catch(() => {});
        } else {
          navigator.clipboard?.writeText(window.location.href);
          showToast('URLをコピーしました');
        }
      }
    });
  });
}

/**
 * 関連お知らせ描画: news.json をロードし、自分以外を date 降順で並べて
 * 先頭 RELATED_MAX 件を描画。
 */
async function loadRelated() {
  const container = document.getElementById('article-related');
  if (!container) return;

  const currentSlug = getCurrentSlug();
  const base = resolveSupportBasePath();

  try {
    const response = await fetch(resolveSupportDataPath('news.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    const items = Array.isArray(data?.items) ? data.items : [];
    const valid = items.filter((item) => isValidNewsUrl(item?.url));
    const others = valid.filter((item) => getSlugFromUrl(item.url) !== currentSlug);
    const sorted = sortItemsByDateDesc(others).slice(0, RELATED_MAX);

    if (!sorted.length) {
      document.getElementById('related-card')?.setAttribute('hidden', '');
      return;
    }

    container.innerHTML = sorted.map((item) => {
      const slug = getSlugFromUrl(item.url);
      const href = escapeHtml(`${base}/05_support/news/${slug}/`);
      const date = escapeHtml(item.displayDate || String(item.date || '').replace(/-/g, '.'));
      const category = escapeHtml(item.category || '');
      const title = escapeHtml(item.title || '');
      const tag = category
        ? `<span class="news-tag news-tag--info">${category}</span>`
        : '';
      return `<li class="related-item"><a href="${href}"><div class="r-meta"><span>${date}</span>${tag}</div><p class="r-title">${title}</p></a></li>`;
    }).join('');
  } catch (error) {
    console.error('[news-detail] Failed to load related:', error);
    document.getElementById('related-card')?.setAttribute('hidden', '');
  }
}

/**
 * Scroll-spy: 表示中の h2 に対応する TOC リンクへ .on を付与。
 */
function initScrollSpy() {
  const headings = document.querySelectorAll('.article-body h2[id]');
  const tocLinks = document.querySelectorAll('#article-toc a');
  if (!headings.length || !tocLinks.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        tocLinks.forEach((link) => {
          const isActive = link.getAttribute('href') === `#${id}`;
          link.classList.toggle('on', isActive);
        });
      }
    });
  }, { rootMargin: '-30% 0px -50% 0px' });

  headings.forEach((h) => observer.observe(h));
}

/**
 * 前/次の記事ナビゲーション描画。
 * - date 降順の全件配列で現在の slug を探し、前後を取得。
 * - 「前の記事」= 公開が古い（idx+1）、「次の記事」= 公開が新しい（idx-1）。
 * - 両端では片側のみ表示し、グリッド側の配置クラスで左右を維持する。
 */
function renderArticleBadges(item) {
  const parts = [];
  if (isPinned(item)) parts.push('<span class="news-badge news-badge--pinned">重要</span>');
  if (isNewArticle(item)) parts.push('<span class="news-badge news-badge--new">NEW</span>');
  return parts.join('');
}

/**
 * 記事ヘッダーのメタ行に 重要 / NEW バッジを差し込む。
 */
function decorateCurrentArticle(item) {
  const meta = document.querySelector('.article-hero .ah-meta');
  if (!meta) return;
  meta.querySelectorAll('.news-badge').forEach((b) => b.remove());
  const badgeHtml = renderArticleBadges(item);
  if (badgeHtml) meta.insertAdjacentHTML('beforeend', badgeHtml);
}

async function loadArticleNav() {
  const main = document.querySelector('.article-main');
  if (!main) return;
  const foot = main.querySelector('.article-foot');

  try {
    const response = await fetch(resolveSupportDataPath('news.json'), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    const valid = sortItemsByDateDesc(items.filter((item) => isValidNewsUrl(item?.url)));

    const currentSlug = getCurrentSlug();
    const idx = valid.findIndex((item) => getSlugFromUrl(item.url) === currentSlug);
    if (idx === -1) return;

    decorateCurrentArticle(valid[idx]);

    const newer = idx > 0 ? valid[idx - 1] : null;
    const older = idx < valid.length - 1 ? valid[idx + 1] : null;
    if (!newer && !older) return;

    const base = resolveSupportBasePath();
    const nav = document.createElement('nav');
    nav.className = 'article-prev-next';
    nav.setAttribute('aria-label', '記事ナビゲーション');
    if (!older) nav.classList.add('only-newer');
    if (!newer) nav.classList.add('only-older');

    const prevHtml = older ? renderPrevNextLink(older, 'prev', base) : '';
    const nextHtml = newer ? renderPrevNextLink(newer, 'next', base) : '';
    nav.innerHTML = prevHtml + nextHtml;

    if (foot) main.insertBefore(nav, foot);
    else main.appendChild(nav);
  } catch (error) {
    console.error('[news-detail] Failed to load article nav:', error);
  }
}

/**
 * 記事フッターに「お問い合わせ」リンクを差し込む。
 * back-link の直後・share の直前に配置。
 */
function insertContactLink() {
  const foot = document.querySelector('.article-foot');
  if (!foot) return;
  if (foot.querySelector('.contact-link')) return;
  const base = resolveSupportBasePath();
  const href = `${base}/bug-report/`;
  const link = document.createElement('a');
  link.className = 'contact-link';
  link.setAttribute('href', href);
  link.textContent = 'お問い合わせはこちら →';
  const share = foot.querySelector('.share');
  if (share) foot.insertBefore(link, share);
  else foot.appendChild(link);
}

function renderPrevNextLink(item, dir, base) {
  const slug = getSlugFromUrl(item.url);
  const href = escapeHtml(`${base}/05_support/news/${slug}/`);
  const title = escapeHtml(item.title || '');
  const dirLabel = dir === 'prev' ? '前の記事' : '次の記事';
  const arrow = dir === 'prev' ? '←' : '→';
  return `
    <a class="pn-link pn-${dir}" href="${href}">
      <span class="pn-dir">${dir === 'prev' ? `${arrow} ${dirLabel}` : `${dirLabel} ${arrow}`}</span>
      <span class="pn-title">${title}</span>
    </a>
  `;
}

buildTOC();
setReadMin();
bindShareButtons();
insertContactLink();
loadRelated();
loadArticleNav();
initScrollSpy();
