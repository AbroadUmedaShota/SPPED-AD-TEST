/* ============================================================
   News List Page — Timeline Cool（案C）
   - 適用範囲: 05_support/news/index.html
   - 05_support/assets/data/news.json から fetch し、items を date 降順で全件描画。
   - Featured(PICK) = 最新1件、Timeline = 全件月別グルーピング（PICK も含む）。
   - パス解決は support 配下の既存規約 resolveSupportDataPath() を踏襲。
   - カードは <a> 全体で 1 クリック領域（仕様 §7.2）。
   - 0 件 / 取得失敗時は #timeline-body 内に状態ブロックを描画。
   - JSON 由来文字列は HTML エスケープ。url は形式検証（仕様 §6）。
   ============================================================ */

import { resolveSupportDataPath, resolveSupportBasePath } from './utils.js';

const NEWS_JSON_PATH = resolveSupportDataPath('news.json');

const NEWS_CATEGORY_VARIANT = {
  'アップデート': 'news-tag--update',
  'お知らせ': 'news-tag--info',
  'メンテナンス': 'news-tag--maint',
  '障害情報': 'news-tag--incident',
  'プレスリリース': 'news-tag--press',
};

const NEWS_URL_PATTERN = /^05_support\/news\/[a-z0-9_-]+\/?$/i;

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

/**
 * `05_support/news/<slug>/` 形式から `<slug>/` 形式へ変換。
 * 一覧ページ自身が同階層にあるため、相対パスで遷移可能。
 */
function toRelativeUrl(url) {
  return url.replace(/^05_support\/news\//, '');
}

/**
 * 'YYYY-MM-DD' → 'YYYY.MM.DD'
 */
function formatYMD(value) {
  if (!value) return '—';
  return String(value).replace(/-/g, '.');
}

/**
 * タグ表示テキスト。tags[0] > category。両方無ければ空。
 */
function resolveTagLabel(item) {
  if (Array.isArray(item.tags) && item.tags.length > 0 && item.tags[0]) {
    return String(item.tags[0]);
  }
  if (item.category) return String(item.category);
  return '';
}

/**
 * タグ variant クラス。マッピング外は既定（modifier なし）。
 */
function resolveTagVariant(label) {
  return NEWS_CATEGORY_VARIANT[label] || '';
}

/**
 * date 降順ソート（stable）。同 date は出現順を維持（仕様 §4.4）。
 */
function sortItemsByDateDesc(items) {
  return [...items].sort((a, b) => {
    const da = String(a.date || '');
    const db = String(b.date || '');
    if (da < db) return 1;
    if (da > db) return -1;
    return 0;
  });
}

/**
 * 'YYYY-MM' 単位で月別グルーピング。配列順は入力順（既に date 降順）を維持。
 */
function groupByMonth(items) {
  const map = new Map();
  for (const item of items) {
    const ym = (item.date || '').slice(0, 7); // 'YYYY-MM'
    if (!ym) continue;
    if (!map.has(ym)) map.set(ym, []);
    map.get(ym).push(item);
  }
  return Array.from(map.entries()).map(([ym, groupItems]) => ({ ym, items: groupItems }));
}

/**
 * 件数 / Last Updated / 月数 を hero 右側に描画。
 */
function setMeta({ count, updatedAt, monthCount }) {
  const el = document.getElementById('ph-meta');
  if (!el) return;
  el.innerHTML = `
    <div class="row"><b>${count}</b><span>Articles</span></div>
    <div class="row"><b>${escapeHtml(formatYMD(updatedAt))}</b><span>Last Updated</span></div>
    <div class="row"><b>${monthCount}</b><span>Months</span></div>
  `;

  const status = document.getElementById('tl-status');
  const tlCount = document.getElementById('tl-count');
  if (tlCount) tlCount.textContent = String(count);
  if (status) {
    if (count > 0) status.removeAttribute('hidden');
    else status.setAttribute('hidden', '');
  }
}

/**
 * Featured (PICK) カードを最新1件で描画。
 */
function renderFeatured(item) {
  const featured = document.getElementById('featured');
  if (!featured) return;
  if (!item || !isValidNewsUrl(item.url)) {
    featured.setAttribute('hidden', '');
    return;
  }

  const slug = toRelativeUrl(item.url);
  featured.setAttribute('href', slug); // 同階層相対
  featured.removeAttribute('hidden');

  const date = new Date(item.date);
  const dayEl = featured.querySelector('.day');
  const moEl = featured.querySelector('.mo');
  const yrEl = featured.querySelector('.yr');
  if (dayEl) dayEl.textContent = String(date.getDate()).padStart(2, '0');
  if (moEl) moEl.textContent = MONTH_ABBR[date.getMonth()] || '';
  if (yrEl) yrEl.textContent = `${date.getFullYear()} · ${WEEKDAY_ABBR[date.getDay()].toUpperCase()}`;

  const tagEl = featured.querySelector('[data-feat-tag]');
  if (tagEl) {
    const tagLabel = resolveTagLabel(item);
    const tagVariant = resolveTagVariant(tagLabel);
    tagEl.textContent = tagLabel;
    tagEl.className = tagVariant ? `news-tag ${tagVariant}` : 'news-tag';
  }

  const titleEl = featured.querySelector('[data-feat-title]');
  if (titleEl) titleEl.textContent = item.title || '';

  const summaryEl = featured.querySelector('[data-feat-summary]');
  if (summaryEl) summaryEl.textContent = item.summary || '';
}

/**
 * Timeline 全件を月別にグルーピングして描画。
 */
function renderTimeline(items) {
  const body = document.getElementById('timeline-body');
  if (!body) return;

  const groups = groupByMonth(items);

  body.innerHTML = groups.map((group) => {
    const [yyyy, mm] = group.ym.split('-');
    const monthIdx = parseInt(mm, 10) - 1;
    const monthName = MONTH_ABBR[monthIdx] || '';
    const count = group.items.length;
    const articleLabel = `${count} Article${count > 1 ? 's' : ''}`;

    const itemsHtml = group.items.map((item) => {
      const date = new Date(item.date);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const weekday = WEEKDAY_ABBR[date.getDay()].toUpperCase();
      const slug = toRelativeUrl(item.url);
      const tagLabel = resolveTagLabel(item);
      const tagVariant = resolveTagVariant(tagLabel);
      const tagClass = tagVariant ? `news-tag ${tagVariant}` : 'news-tag';
      const dateAttr = escapeHtml(item.date || '');

      return `
        <a class="tl-item" href="${escapeHtml(slug)}">
          <div class="ti-date">
            <time datetime="${dateAttr}">${month}.${day}</time>
            <small>${weekday}</small>
          </div>
          <div class="ti-tag">
            <span class="${tagClass}">${escapeHtml(tagLabel)}</span>
          </div>
          <div class="ti-body">
            <h3 class="ti-title">${escapeHtml(item.title || '')}</h3>
            <p class="ti-sum">${escapeHtml(item.summary || '')}</p>
          </div>
          <span class="ti-arr" aria-hidden="true">→</span>
        </a>
      `;
    }).join('');

    return `
      <section class="tl-month">
        <div class="tl-month-label">
          <div class="num">${escapeHtml(mm)}</div>
          <div class="name">${monthName} ${escapeHtml(yyyy)}</div>
          <div class="ct">${articleLabel}</div>
        </div>
        <div class="tl-items">${itemsHtml}</div>
      </section>
    `;
  }).join('');
}

function renderEmptyState() {
  const body = document.getElementById('timeline-body');
  if (!body) return;
  body.innerHTML = `
    <div class="news-state">
      <div class="news-state__eyebrow">No Items</div>
      <h3 class="news-state__title">現在お知らせはありません</h3>
      <p class="news-state__text">新しいお知らせが公開され次第、こちらに表示されます。</p>
    </div>
  `;
}

function renderErrorState() {
  const body = document.getElementById('timeline-body');
  if (!body) return;
  body.innerHTML = `
    <div class="news-state news-state--error">
      <div class="news-state__eyebrow">Error</div>
      <h3 class="news-state__title">お知らせの取得に失敗しました</h3>
      <p class="news-state__text">時間をおいてもう一度お試しください。</p>
    </div>
  `;
}

function hideFeatured() {
  const featured = document.getElementById('featured');
  if (featured) featured.setAttribute('hidden', '');
}

/* ============================================================
   Category Filter
   - 「すべて」＋ news.json 出現カテゴリで動的にチップを構築
   - currentCategory=null は「すべて」を意味する
   - 選択変更時は Featured / Timeline / tl-status を全て再描画
   ============================================================ */

const FILTER_LABEL_ALL = 'すべて';
const CATEGORY_DISPLAY_ORDER = [
  'アップデート',
  'お知らせ',
  'メンテナンス',
  '障害情報',
  'プレスリリース',
];

let allItems = [];
let currentCategory = null;

function getFilteredItems() {
  if (!currentCategory) return allItems;
  return allItems.filter((item) => resolveTagLabel(item) === currentCategory);
}

function countByCategory(items) {
  const counts = new Map();
  for (const item of items) {
    const label = resolveTagLabel(item);
    if (!label) continue;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return counts;
}

function renderChip(label, count, category, isActive) {
  const variant = resolveTagVariant(label);
  const dataAttr = category ? ` data-category="${escapeHtml(category)}"` : '';
  const activeClass = isActive ? ' is-active' : '';
  const variantClass = variant ? ` ${variant.replace('news-tag--', 'news-filter__chip--')}` : '';
  return `
    <button type="button" class="news-filter__chip${variantClass}${activeClass}"${dataAttr} aria-pressed="${isActive}">
      <span class="news-filter__chip-label">${escapeHtml(label)}</span>
      <span class="news-filter__chip-count">${count}</span>
    </button>
  `;
}

function renderFilterChips() {
  const container = document.getElementById('news-filter');
  if (!container) return;

  const counts = countByCategory(allItems);
  const chips = [];
  chips.push(renderChip(FILTER_LABEL_ALL, allItems.length, null, currentCategory === null));
  for (const label of CATEGORY_DISPLAY_ORDER) {
    const c = counts.get(label);
    if (c && c > 0) {
      chips.push(renderChip(label, c, label, currentCategory === label));
    }
  }
  container.innerHTML = chips.join('');
  container.removeAttribute('hidden');

  container.querySelectorAll('.news-filter__chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cat = btn.dataset.category || null;
      if (currentCategory === cat) return;
      currentCategory = cat;
      renderFilterChips();
      renderFiltered();
    });
  });
}

function renderFiltered() {
  const filtered = getFilteredItems();

  const tlCount = document.getElementById('tl-count');
  if (tlCount) tlCount.textContent = String(filtered.length);
  const status = document.getElementById('tl-status');
  if (status) {
    if (filtered.length > 0) status.removeAttribute('hidden');
    else status.setAttribute('hidden', '');
  }

  if (filtered.length === 0) {
    hideFeatured();
    renderEmptyState();
    return;
  }

  renderFeatured(filtered[0]);
  renderTimeline(filtered);
}

async function loadNewsList() {
  // resolveSupportBasePath は将来の絶対パス遷移に備えて参照（現状は相対遷移）。
  void resolveSupportBasePath();

  try {
    const response = await fetch(NEWS_JSON_PATH, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    const sorted = sortItemsByDateDesc(items);
    allItems = sorted.filter((item) => isValidNewsUrl(item?.url));

    const groups = groupByMonth(allItems);
    setMeta({
      count: allItems.length,
      updatedAt: data?.updatedAt,
      monthCount: groups.length,
    });

    if (allItems.length === 0) {
      hideFeatured();
      renderEmptyState();
      return;
    }

    renderFilterChips();
    renderFiltered();
  } catch (error) {
    console.error('[news-list] Failed to load news.json:', error);
    setMeta({ count: 0, updatedAt: null, monthCount: 0 });
    hideFeatured();
    renderErrorState();
  }
}

loadNewsList();
