import { resolveSupportDataPath, resolveSupportBasePath } from './utils.js';

const NEWS_JSON_PATH = resolveSupportDataPath('news.json');
const NEWS_URL_PATTERN = /^05_support\/news\/[a-z0-9_-]+\/?$/i;
const DOW_EN = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const FILTER_LABEL_ALL = 'すべて';
const CATEGORY_DISPLAY_ORDER = [
  'アップデート','お知らせ','メンテナンス','障害情報','プレスリリース',
];

let ALL = [];
let activeCat = null;

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function pad(n) { return String(n).padStart(2,'0'); }
function isValidRel(u) { return typeof u === 'string' && NEWS_URL_PATTERN.test(u); }
function toRelUrl(u) { return u.replace(/^05_support\/news\//,''); }
function parseDate(s) { const [y,m,d] = String(s).split('-').map(Number); return new Date(y, (m||1)-1, d||1); }
function fmtYMD(d) { return `${d.getFullYear()}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`; }
function resolveTag(item) {
  if (Array.isArray(item.tags) && item.tags[0]) return String(item.tags[0]);
  return item.category ? String(item.category) : '';
}
function sortDesc(items) {
  return [...items].sort((a,b) => String(b.date||'').localeCompare(String(a.date||'')));
}

// Rows
function renderRows(items) {
  if (!items.length) {
    return `<div class="news-state">該当するお知らせはありません。</div>`;
  }
  let html = '';
  let lastYear = null;
  for (const it of items) {
    if (!isValidRel(it.url)) continue;
    const d = parseDate(it.date);
    if (d.getFullYear() !== lastYear) {
      html += `<div class="b-year-rule">${d.getFullYear()}</div>`;
      lastYear = d.getFullYear();
    }
    const tag = resolveTag(it);
    html += `
      <a class="b-row" href="${esc(toRelUrl(it.url))}">
        <div class="b-row__date">${esc(fmtYMD(d))}<span class="dow">${DOW_EN[d.getDay()]}</span></div>
        <div class="b-row__tags">${tag ? `<span class="tag">${esc(tag)}</span>` : ''}</div>
        <div class="b-row__body">
          <h3 class="b-row__title">${esc(it.title || '')}</h3>
          <p class="b-row__summary">${esc(it.summary || '')}</p>
        </div>
        <div class="b-row__arrow" aria-hidden="true">→</div>
      </a>`;
  }
  return html;
}

// Filters
function renderFilters() {
  const container = document.getElementById('b-filters');
  if (!container) return;
  const seen = new Set(ALL.map(resolveTag).filter(Boolean));
  const cats = CATEGORY_DISPLAY_ORDER.filter(c => seen.has(c));
  for (const c of seen) {
    if (!cats.includes(c)) cats.push(c);
  }
  const chips = [
    `<button type="button" class="b-chip ${activeCat===null?'is-active':''}" data-cat="">${FILTER_LABEL_ALL}</button>`,
    ...cats.map(c => `<button type="button" class="b-chip ${activeCat===c?'is-active':''}" data-cat="${esc(c)}">${esc(c)}</button>`),
  ];
  container.innerHTML = chips.join('');
}

function applyFilter() {
  const filtered = activeCat === null ? ALL : ALL.filter(it => resolveTag(it) === activeCat);
  const body = document.getElementById('b-body');
  if (body) body.innerHTML = renderRows(filtered);
}

function attachFilterEvents() {
  const container = document.getElementById('b-filters');
  if (!container) return;
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    const cat = btn.dataset.cat || null;
    if (activeCat === cat) return;
    activeCat = cat;
    renderFilters();
    applyFilter();
  });
}

// Load
async function loadNewsList() {
  void resolveSupportBasePath();
  const body = document.getElementById('b-body');
  try {
    const res = await fetch(NEWS_JSON_PATH, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    ALL = sortDesc(items.filter(it => isValidRel(it?.url)));
    document.getElementById('b-count').textContent = String(ALL.length);
    document.getElementById('b-updated').textContent = String(data?.updatedAt || '').replace(/-/g,'.');
    renderFilters();
    applyFilter();
    attachFilterEvents();
  } catch (err) {
    console.error('[news-list] Failed to load news.json:', err);
    document.getElementById('b-count').textContent = '0';
    if (body) body.innerHTML = `<div class="news-state">読み込みに失敗しました。</div>`;
  }
}

loadNewsList();
