import { resolveDashboardDataPath } from './utils.js';
import { resolveLocalizedValue } from './services/i18n/messages.js';
import { escapeHtml, escapeRegex } from './shared/escape.js';

function loc(value) {
    const lang = (typeof window !== 'undefined' && window.getCurrentLanguage) ? window.getCurrentLanguage() : 'ja';
    return resolveLocalizedValue(value, lang, 'ja');
}

// カテゴリごとの表示メタ (アイコン / アクセントカラー)
const CATEGORY_META = {
    'getting-started':  { icon: 'flag',           accent: '#5B7DFF' },
    'account':          { icon: 'account_circle', accent: '#8B6DB8' },
    'how-to-use':       { icon: 'build',          accent: '#3BAA8E' },
    'plans-billing':    { icon: 'receipt_long',   accent: '#D4A642' },
    'troubleshooting':  { icon: 'support_agent',  accent: '#C85646' },
    'tutorial':         { icon: 'school',         accent: '#2EACB9' },
    'misc':             { icon: 'more_horiz',     accent: '#7A7A7A' },
};

// カテゴリの表示順 (固定)
const CATEGORY_ORDER = [
    'getting-started',
    'how-to-use',
    'account',
    'plans-billing',
    'troubleshooting',
    'tutorial',
    'misc',
];

// FAQ カードは help_articles.json に無いため別で挿入
const FAQ_CARD = {
    id: 'faq',
    name: 'よくある質問',
    description: 'サービス全般に関するご質問',
    href: 'faq.html',
    icon: 'help_outline',
    accent: '#D68A3A',
    previewArticles: [],
    articleCount: null,
};

document.addEventListener('DOMContentLoaded', () => {
    const app = {
        elements: {
            heroSearchInput: document.getElementById('hc-search-input'),
            heroSearchForm: null,
            suggestions: document.getElementById('hc-suggestions'),
            keywordsWrapper: document.getElementById('hc-popular-keywords'),
            categoryGrid: document.getElementById('hc-category-grid'),
            popularList: document.getElementById('hc-popular-articles'),
            popularEmpty: document.getElementById('hc-popular-empty'),
            stickySearch: document.getElementById('hc-sticky-search'),
            heroSection: document.querySelector('.hc-hero'),
        },
        state: {
            articles: [],
            popularKeywords: [],
            suggestions: [],
            activeIndex: -1,
        },

        async init() {
            if (this.elements.heroSearchInput) {
                this.elements.heroSearchForm = this.elements.heroSearchInput.closest('form');
            }
            this.bindSearch();
            this.bindStickySearch();
            await this.loadData();
            this.renderKeywords();
            this.renderCategories();
            this.renderPopularArticles();
            document.addEventListener('languagechange', () => {
                this.renderCategories();
                this.renderPopularArticles();
            });
        },

        async loadData() {
            try {
                const res = await fetch(resolveDashboardDataPath('help_articles.json'));
                if (!res.ok) throw new Error('記事データの読み込みに失敗しました。');
                const data = await res.json();
                this.state.articles = Array.isArray(data.categories) ? data.categories : [];
                this.state.popularKeywords = Array.isArray(data.popularKeywords) ? data.popularKeywords : [];
            } catch (err) {
                console.error('データの読み込み中にエラー:', err);
                if (this.elements.categoryGrid) {
                    this.elements.categoryGrid.innerHTML = `<p class="hc-popular-empty" role="alert">データの読み込みに失敗しました。</p>`;
                }
            }
        },

        /* ========== Search ========== */
        bindSearch() {
            const input = this.elements.heroSearchInput;
            const form = this.elements.heroSearchForm;
            if (!input || !form) return;

            form.addEventListener('submit', (e) => this.handleSearchSubmit(e));
            input.addEventListener('input', () => this.handleSearchInput());
            input.addEventListener('keydown', (e) => this.handleSearchKeydown(e));
            input.addEventListener('focus', () => {
                if (input.value.trim().length >= 2) this.handleSearchInput();
            });
            input.addEventListener('blur', (e) => {
                const next = e.relatedTarget;
                // クリックがサジェスト内ならcloseしない
                if (next && this.elements.suggestions && this.elements.suggestions.contains(next)) return;
                // document クリックで外側判定を行う
                setTimeout(() => {
                    if (document.activeElement !== this.elements.heroSearchInput) {
                        this.closeSuggestions();
                    }
                }, 120);
            });
        },

        handleSearchSubmit(event) {
            event.preventDefault();
            const keyword = this.elements.heroSearchInput.value.trim();
            if (!keyword) return;
            window.location.href = `help-content.html?search=${encodeURIComponent(keyword)}`;
        },

        handleSearchInput() {
            const raw = this.elements.heroSearchInput.value.trim().toLowerCase();
            if (raw.length < 2) {
                this.closeSuggestions();
                return;
            }

            const tokens = raw.split(/\s+/).filter(Boolean);
            const allQuestions = this.state.articles.flatMap(cat =>
                cat.questions.map(q => ({ ...q, categoryName: cat.name, categoryId: cat.id }))
            );
            const matches = allQuestions.filter(q => {
                const haystack = `${loc(q.question)} ${loc(q.answer)}`.toLowerCase();
                return tokens.every(t => haystack.includes(t));
            }).slice(0, 6);

            this.state.suggestions = matches;
            this.state.activeIndex = -1;
            if (matches.length === 0) this.renderSuggestionsEmpty();
            else this.renderSuggestions(tokens);
            this.openSuggestions();
        },

        renderSuggestions(tokens) {
            if (!this.elements.suggestions) return;
            const regexes = tokens.map(t => new RegExp(escapeRegex(t), 'gi'));
            const highlight = (text) => {
                let safe = escapeHtml(text);
                regexes.forEach(re => { safe = safe.replace(re, '<mark>$&</mark>'); });
                return safe;
            };
            this.elements.suggestions.innerHTML = this.state.suggestions.map((q, idx) => `
                <div class="hc-suggestion" role="option" data-index="${idx}" id="hc-suggestion-${idx}" aria-selected="false">
                    <span class="hc-suggestion__category">${escapeHtml(loc(q.categoryName))}</span>
                    <span class="hc-suggestion__question">${highlight(loc(q.question))}</span>
                </div>
            `).join('');
            this.elements.suggestions.setAttribute('aria-label', `検索候補 ${this.state.suggestions.length}件`);
            // クリックで遷移
            this.elements.suggestions.querySelectorAll('.hc-suggestion').forEach(el => {
                el.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    const idx = Number(el.dataset.index);
                    const chosen = this.state.suggestions[idx];
                    if (chosen) {
                        window.location.href = `help-content.html?article=${encodeURIComponent(chosen.id)}`;
                    }
                });
            });
        },

        renderSuggestionsEmpty() {
            if (!this.elements.suggestions) return;
            const keyword = this.elements.heroSearchInput.value.trim();
            this.elements.suggestions.innerHTML = `
                <div class="hc-suggestion-empty">
                    <p>「${escapeHtml(keyword)}」の記事が見つかりません。</p>
                    <p style="margin-top:.25rem;font-size:.75rem;">Enter キーで全文検索できます。</p>
                </div>
            `;
            this.elements.suggestions.setAttribute('aria-label', '一致する候補はありません');
        },

        openSuggestions() {
            const box = this.elements.suggestions;
            const input = this.elements.heroSearchInput;
            if (!box) return;
            box.hidden = false;
            if (this.state.suggestions.length > 0) this.setActive(0);
            if (input) input.setAttribute('aria-expanded', 'true');
            if (this.elements.keywordsWrapper) this.elements.keywordsWrapper.style.visibility = 'hidden';
        },

        closeSuggestions() {
            const box = this.elements.suggestions;
            const input = this.elements.heroSearchInput;
            if (!box) return;
            box.hidden = true;
            box.innerHTML = '';
            box.setAttribute('aria-label', '検索候補');
            this.state.suggestions = [];
            this.state.activeIndex = -1;
            if (input) {
                input.setAttribute('aria-expanded', 'false');
                input.removeAttribute('aria-activedescendant');
            }
            if (this.elements.keywordsWrapper) this.elements.keywordsWrapper.style.visibility = '';
        },

        setActive(index) {
            const items = this.elements.suggestions.querySelectorAll('.hc-suggestion');
            if (items.length === 0) return;
            const len = items.length;
            const newIdx = ((index % len) + len) % len;
            items.forEach(el => { el.classList.remove('is-active'); el.setAttribute('aria-selected', 'false'); });
            items[newIdx].classList.add('is-active');
            items[newIdx].setAttribute('aria-selected', 'true');
            items[newIdx].scrollIntoView({ block: 'nearest' });
            this.state.activeIndex = newIdx;
            this.elements.heroSearchInput.setAttribute('aria-activedescendant', `hc-suggestion-${newIdx}`);
        },

        handleSearchKeydown(event) {
            const open = this.elements.suggestions && !this.elements.suggestions.hidden;
            if (!open) return;
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.setActive(this.state.activeIndex + 1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.setActive(this.state.activeIndex - 1);
            } else if (event.key === 'Enter') {
                if (this.state.activeIndex >= 0 && this.state.suggestions[this.state.activeIndex]) {
                    event.preventDefault();
                    const chosen = this.state.suggestions[this.state.activeIndex];
                    window.location.href = `help-content.html?article=${encodeURIComponent(chosen.id)}`;
                }
            } else if (event.key === 'Home') {
                event.preventDefault();
                this.setActive(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                if (this.state.suggestions.length > 0) this.setActive(this.state.suggestions.length - 1);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this.closeSuggestions();
            }
        },

        /* ========== Sticky search ========== */
        bindStickySearch() {
            const sticky = this.elements.stickySearch;
            const hero = this.elements.heroSection;
            if (!sticky || !hero) return;

            const onScroll = () => {
                const threshold = hero.offsetTop + hero.offsetHeight + 120;
                if (window.scrollY > threshold) {
                    if (!sticky.hidden) return;
                    sticky.hidden = false;
                    requestAnimationFrame(() => sticky.classList.add('is-visible'));
                } else {
                    sticky.classList.remove('is-visible');
                    // 完全に隠れてから hidden 化 (transition の終了を待つ)
                    setTimeout(() => {
                        if (!sticky.classList.contains('is-visible')) sticky.hidden = true;
                    }, 250);
                }
            };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();
        },

        /* ========== Keywords ========== */
        renderKeywords() {
            const wrap = this.elements.keywordsWrapper;
            if (!wrap) return;
            const kws = (this.state.popularKeywords || []).slice(0, 5);
            if (kws.length === 0) { wrap.innerHTML = ''; return; }
            wrap.innerHTML = `
                ${kws.map(k => `<a href="help-content.html?search=${encodeURIComponent(k)}" class="hc-keywords__chip">${escapeHtml(k)}</a>`).join('')}
            `;
        },

        /* ========== Categories (bento grid) ========== */
        renderCategories() {
            const grid = this.elements.categoryGrid;
            if (!grid) return;

            const cards = CATEGORY_ORDER
                .map(id => {
                    const cat = this.state.articles.find(c => c.id === id);
                    if (!cat) return null;
                    const meta = CATEGORY_META[id] || { icon: 'help_outline', accent: '#4285F4' };
                    return {
                        id: cat.id,
                        name: loc(cat.name),
                        description: loc(cat.description) || '',
                        href: `help-content.html?category=${encodeURIComponent(cat.id)}`,
                        icon: meta.icon,
                        accent: meta.accent,
                        previewArticles: (cat.questions || []).slice(0, 2),
                        articleCount: (cat.questions || []).length,
                    };
                })
                .filter(Boolean);

            // 末尾に FAQ カード
            cards.push({ ...FAQ_CARD, name: FAQ_CARD.name, description: FAQ_CARD.description });

            grid.innerHTML = cards.map(card => this.renderCategoryCard(card)).join('');
        },

        renderCategoryCard(card) {
            const previewHtml = (card.previewArticles || []).map(q => `
                <li class="hc-cat-card__article">
                    <span class="material-icons" aria-hidden="true">chevron_right</span>
                    <span>${escapeHtml(loc(q.question))}</span>
                </li>
            `).join('');

            const countLabel = card.articleCount != null ? `${card.articleCount}件の記事` : '';
            const moreLabel = card.id === 'faq' ? 'FAQ を見る' : (countLabel || 'すべて見る');

            return `
                <a href="${escapeHtml(card.href)}" class="hc-cat-card" style="--hc-accent: ${escapeHtml(card.accent)};" aria-label="${escapeHtml(card.name)}">
                    <div class="hc-cat-card__header">
                        <span class="hc-cat-card__icon" aria-hidden="true"><span class="material-icons">${escapeHtml(card.icon)}</span></span>
                        <div>
                            <h3 class="hc-cat-card__title">${escapeHtml(card.name)}</h3>
                            ${card.description ? `<p class="hc-cat-card__desc">${escapeHtml(card.description)}</p>` : ''}
                        </div>
                    </div>
                    ${previewHtml ? `<ul class="hc-cat-card__articles">${previewHtml}</ul>` : ''}
                    <span class="hc-cat-card__more">
                        ${escapeHtml(moreLabel)}
                        <span class="material-icons" aria-hidden="true">arrow_forward</span>
                    </span>
                </a>
            `;
        },

        /* ========== Popular articles ========== */
        renderPopularArticles() {
            const list = this.elements.popularList;
            if (!list) return;
            const empty = this.elements.popularEmpty;

            const all = this.state.articles.flatMap(cat =>
                cat.questions.map(q => ({ ...q, categoryName: cat.name, categoryId: cat.id }))
            );
            const featured = all.filter(q => q.isFeatured).slice(0, 6);

            if (featured.length === 0) {
                list.innerHTML = '';
                if (empty) {
                    empty.textContent = '公開中の記事はまだありません。';
                    empty.hidden = false;
                }
                return;
            }
            if (empty) empty.hidden = true;

            list.innerHTML = featured.map(article => `
                <a href="help-content.html?article=${encodeURIComponent(article.id)}" class="hc-pop-card">
                    <div class="hc-pop-card__body">
                        <p class="hc-pop-card__category">${escapeHtml(loc(article.categoryName))}</p>
                        <h3 class="hc-pop-card__title">${escapeHtml(loc(article.question))}</h3>
                    </div>
                    <span class="material-icons hc-pop-card__chevron" aria-hidden="true">chevron_right</span>
                </a>
            `).join('');
        },
    };

    app.init();
});
