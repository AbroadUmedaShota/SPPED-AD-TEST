import { resolveDashboardDataPath } from './utils.js';
import { resolveLocalizedValue } from './services/i18n/messages.js';

// カテゴリごとの表示メタ (help-center.js と同期)
const CATEGORY_META = {
    'getting-started':  { icon: 'flag',           accent: '#5B7DFF' },
    'account':          { icon: 'account_circle', accent: '#8B6DB8' },
    'how-to-use':       { icon: 'build',          accent: '#3BAA8E' },
    'plans-billing':    { icon: 'receipt_long',   accent: '#D4A642' },
    'troubleshooting':  { icon: 'support_agent',  accent: '#C85646' },
    'tutorial':         { icon: 'school',         accent: '#2EACB9' },
    'misc':             { icon: 'more_horiz',     accent: '#7A7A7A' },
};

function getCategoryMeta(id) {
    return CATEGORY_META[id] || { icon: 'help_outline', accent: '#4285F4' };
}

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function loc(value) {
    const lang = (typeof window !== 'undefined' && window.getCurrentLanguage) ? window.getCurrentLanguage() : 'ja';
    return resolveLocalizedValue(value, lang, 'ja');
}

const FEEDBACK_STORAGE_KEY = 'helpArticleFeedback';

function getFeedbackStore() {
    try {
        const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (_e) {
        return {};
    }
}

function setFeedbackStore(store) {
    try {
        localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(store));
    } catch (_e) { /* no-op */ }
}

function renderArticleBody(rawText) {
    if (!rawText) return '';
    const lines = String(rawText).split(/\r?\n/);
    const out = [];
    let listType = null; // 'ul' | 'ol' | null
    let paragraphBuffer = [];

    const flushParagraph = () => {
        if (paragraphBuffer.length) {
            out.push(`<p>${inline(paragraphBuffer.join(' '))}</p>`);
            paragraphBuffer = [];
        }
    };
    const closeList = () => {
        if (listType) {
            out.push(`</${listType}>`);
            listType = null;
        }
    };
    const openList = (type) => {
        if (listType !== type) {
            closeList();
            out.push(`<${type}>`);
            listType = type;
        }
    };

    function inline(text) {
        let safe = escapeHtml(text);
        safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        safe = safe.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
        // [label](url) — url は内部ヘルプ記事・外部URLいずれも許容。内部は相対リンク化。
        safe = safe.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, label, url) => {
            const safeUrl = url.replace(/["'<>]/g, '');
            return `<a href="${safeUrl}" class="text-primary hover:underline">${label}</a>`;
        });
        return safe;
    }

    for (const raw of lines) {
        const line = raw.trimEnd();

        if (!line.trim()) {
            flushParagraph();
            closeList();
            continue;
        }

        let m;
        // 見出し  ## Heading
        m = /^##\s+(.+)$/.exec(line);
        if (m) {
            flushParagraph();
            closeList();
            out.push(`<h3>${inline(m[1])}</h3>`);
            continue;
        }

        // 引用  > note
        m = /^>\s+(.+)$/.exec(line);
        if (m) {
            flushParagraph();
            closeList();
            out.push(`<blockquote>${inline(m[1])}</blockquote>`);
            continue;
        }

        // 順序付きリスト  1. item
        m = /^(\d+)\.\s+(.+)$/.exec(line);
        if (m) {
            flushParagraph();
            openList('ol');
            out.push(`<li>${inline(m[2])}</li>`);
            continue;
        }

        // 箇条書き  - item
        m = /^-\s+(.+)$/.exec(line);
        if (m) {
            flushParagraph();
            openList('ul');
            out.push(`<li>${inline(m[1])}</li>`);
            continue;
        }

        // 通常段落
        closeList();
        paragraphBuffer.push(line);
    }
    flushParagraph();
    closeList();

    return out.join('\n');
}

document.addEventListener('DOMContentLoaded', () => {
    const helpContentApp = {
        elements: {
            titleArea: document.getElementById('content-title-area'),
            displayArea: document.getElementById('content-display-area'),
            breadcrumbContainer: document.getElementById('breadcrumb-container'),
        },
        state: {
            faqData: null,
            currentCategory: null,
            currentArticle: null,
            searchTerm: '',
            sortOrder: 'featured', // 'featured' | 'newest' | 'title'
            filterTerm: '',         // カテゴリ内検索
        },

        async init() {
            await this.fetchFaqData();
            this.parseURL();
            this.render();
            this.addEventListeners();
        },

        async fetchFaqData() {
            try {
                const response = await fetch(resolveDashboardDataPath('help_articles.json'));
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                this.state.faqData = await response.json();
            } catch (error) {
                console.error('FAQデータの読み込みに失敗しました:', error);
                this.elements.displayArea.innerHTML = '<p class="text-center text-error">コンテンツの読み込みに失敗しました。</p>';
            }
        },

        parseURL() {
            const params = new URLSearchParams(window.location.search);
            const categorySlug = params.get('category');
            const articleId = params.get('article');
            const searchTerm = params.get('search');

            if (!this.state.faqData) return;

            this.state.searchTerm = searchTerm || '';

            if (articleId) {
                for (const category of this.state.faqData.categories) {
                    const article = category.questions.find(q => q.id === articleId);
                    if (article) {
                        this.state.currentArticle = article;
                        this.state.currentCategory = category;
                        break;
                    }
                }
            } else if (categorySlug) {
                this.state.currentCategory = this.state.faqData.categories.find(c => c.id === categorySlug);
            }
        },

        addEventListeners() {
            this.elements.displayArea.addEventListener('click', (event) => {
                const feedbackBtn = event.target.closest('.feedback-btn');
                if (feedbackBtn) {
                    const feedbackSection = feedbackBtn.closest('[data-article-id]');
                    const articleId = feedbackSection?.dataset.articleId;
                    const vote = feedbackBtn.dataset.vote || 'yes';
                    if (articleId) {
                        const store = getFeedbackStore();
                        store[articleId] = { vote, at: new Date().toISOString() };
                        setFeedbackStore(store);
                    }
                    feedbackSection.innerHTML = `<p class="hc-feedback__done" role="status" tabindex="-1"><span class="material-icons" aria-hidden="true">check_circle</span>ご協力ありがとうございました。</p>`;
                    const done = feedbackSection.querySelector('.hc-feedback__done');
                    if (done) done.focus();
                }
            });

            document.addEventListener('languagechange', () => {
                this.render();
            });
        },

        render() {
            this.renderBreadcrumbs();
            if (this.state.searchTerm) {
                this.renderSearchResults();
            } else if (this.state.currentArticle) {
                this.renderArticleDetail();
            } else if (this.state.currentCategory) {
                this.renderArticleList();
            } else {
                this.renderNotFound();
            }
        },

        renderBreadcrumbs() {
            let items = [
                { name: 'ダッシュボード', link: 'index.html' },
                { name: 'ヘルプセンター', link: 'help.html' }
            ];

            if (this.state.searchTerm) {
                items.push({ name: `検索結果: "${this.state.searchTerm}"` });
            } else if (this.state.currentCategory) {
                items.push({ name: loc(this.state.currentCategory.name), link: `help-content.html?category=${this.state.currentCategory.id}` });
                if (this.state.currentArticle) {
                    items.push({ name: loc(this.state.currentArticle.question) });
                }
            }

            const html = `<nav aria-label="Breadcrumb"><ol>` +
                items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    const linkHtml = isLast
                        ? `<span class="text-on-surface-variant" aria-current="page">${escapeHtml(item.name)}</span>`
                        : `<a href="${escapeHtml(item.link)}">${escapeHtml(item.name)}</a>`;
                    const separator = isLast ? '' : `<span class="material-icons" aria-hidden="true" style="margin:0 0.25rem;">chevron_right</span>`;
                    return `<li style="display:flex;align-items:center;">${linkHtml}${separator}</li>`;
                }).join('') + `</ol></nav>`;

            this.elements.breadcrumbContainer.innerHTML = html;
        },

        renderArticleList() {
            const cat = this.state.currentCategory;
            const meta = getCategoryMeta(cat.id);
            const catName = loc(cat.name);
            const catDesc = loc(cat.longDescription) || loc(cat.description) || '';

            const allArticles = this.state.faqData.categories
                .find(c => c.id === cat.id)?.questions || [];

            // フィルタ（カテゴリ内検索）
            let articles = allArticles;
            if (this.state.filterTerm) {
                const q = this.state.filterTerm.toLowerCase();
                articles = allArticles.filter(a => {
                    const hay = `${loc(a.question)} ${loc(a.summary || a.answer || '')}`.toLowerCase();
                    return hay.includes(q);
                });
            }

            // ソート
            articles = this.sortArticles(articles);

            // タイトルエリア: カテゴリヘッダー
            this.elements.titleArea.innerHTML = `
                <header class="hc-content-header" style="--hc-accent: ${meta.accent};">
                    <p class="hc-content-header__eyebrow">
                        <span class="material-icons" aria-hidden="true">${meta.icon}</span>
                        カテゴリ
                    </p>
                    <h1 class="hc-content-header__title">${escapeHtml(catName)}</h1>
                    ${catDesc ? `<p class="hc-content-header__desc">${escapeHtml(catDesc)}</p>` : ''}
                    <div class="hc-content-header__meta">
                        <span class="hc-count-pill"><span class="material-icons" aria-hidden="true">article</span>${allArticles.length}件の記事</span>
                    </div>
                </header>
            `;

            // ツールバー + リスト
            const toolbarHtml = `
                <div class="hc-content-toolbar">
                    <label class="hc-content-toolbar__search">
                        <span class="material-icons" aria-hidden="true">search</span>
                        <input type="search" class="hc-content-toolbar__search-input"
                            id="hc-content-filter" aria-label="${escapeHtml(catName)}内を検索"
                            placeholder="このカテゴリ内を検索" value="${escapeHtml(this.state.filterTerm)}">
                    </label>
                    <div class="hc-content-toolbar__sort">
                        <label class="hc-content-toolbar__sort-label" for="hc-content-sort">並び順:</label>
                        <select id="hc-content-sort" class="hc-content-toolbar__sort-select" aria-label="並び順">
                            <option value="featured" ${this.state.sortOrder === 'featured' ? 'selected' : ''}>おすすめ順</option>
                            <option value="newest" ${this.state.sortOrder === 'newest' ? 'selected' : ''}>新着順</option>
                            <option value="title" ${this.state.sortOrder === 'title' ? 'selected' : ''}>タイトル順</option>
                        </select>
                    </div>
                </div>
            `;

            if (articles.length === 0) {
                const emptyHtml = this.renderEmptyState(cat);
                this.elements.displayArea.innerHTML = toolbarHtml + emptyHtml;
            } else {
                const listHtml = articles.map(a => this.renderListItem(a, meta)).join('');
                this.elements.displayArea.innerHTML = toolbarHtml + `<div class="hc-content-list">${listHtml}</div>`;
            }

            this.bindToolbarEvents();
        },

        sortArticles(articles) {
            const arr = [...articles];
            const lang = (typeof window !== 'undefined' && window.getCurrentLanguage) ? window.getCurrentLanguage() : 'ja';
            switch (this.state.sortOrder) {
                case 'newest':
                    return arr.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
                case 'title':
                    return arr.sort((a, b) => String(loc(a.question)).localeCompare(String(loc(b.question)), lang));
                case 'featured':
                default:
                    return arr.sort((a, b) => {
                        if (!!b.isFeatured !== !!a.isFeatured) return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
                        return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
                    });
            }
        },

        renderListItem(article, meta) {
            const title = loc(article.question);
            const summary = loc(article.summary) || (loc(article.answer) ? loc(article.answer).replace(/\s+/g, ' ').slice(0, 100) : '');
            const metaHtml = [];
            if (article.isFeatured) {
                metaHtml.push(`<span class="hc-content-item__badge hc-content-item__badge--featured"><span class="material-icons" aria-hidden="true">star</span>よく読まれている</span>`);
            }
            if (article.updatedAt) {
                metaHtml.push(`<span class="hc-content-item__badge hc-content-item__badge--updated">更新: ${escapeHtml(article.updatedAt)}</span>`);
            }

            return `
                <a class="hc-content-item" href="help-content.html?article=${encodeURIComponent(article.id)}" style="--hc-accent: ${meta.accent};" aria-label="${escapeHtml(title)}">
                    <div class="hc-content-item__body">
                        ${metaHtml.length ? `<div class="hc-content-item__meta">${metaHtml.join('')}</div>` : ''}
                        <h2 class="hc-content-item__title">${escapeHtml(title)}</h2>
                        ${summary ? `<p class="hc-content-item__summary">${escapeHtml(summary)}</p>` : ''}
                    </div>
                    <span class="material-icons hc-content-item__chevron" aria-hidden="true">chevron_right</span>
                </a>
            `;
        },

        renderEmptyState(cat) {
            const otherCats = (this.state.faqData.categories || [])
                .filter(c => c.id !== cat.id)
                .slice(0, 4);
            const links = otherCats.map(c => {
                const m = getCategoryMeta(c.id);
                return `<a class="hc-content-empty__link" href="help-content.html?category=${encodeURIComponent(c.id)}" style="color:${m.accent};border-color:${m.accent};"><span class="material-icons" aria-hidden="true">${m.icon}</span>${escapeHtml(loc(c.name))}</a>`;
            }).join('');
            const isFiltered = !!this.state.filterTerm;
            return `
                <div class="hc-content-empty" role="status">
                    <div class="hc-content-empty__icon"><span class="material-icons" aria-hidden="true">search_off</span></div>
                    <p class="hc-content-empty__title">${isFiltered ? '該当する記事が見つかりません' : 'このカテゴリにはまだ記事がありません'}</p>
                    <p class="hc-content-empty__desc">${isFiltered ? 'キーワードを変えて再検索するか、他のカテゴリをご覧ください。' : '他のカテゴリに関連する記事があるかもしれません。'}</p>
                    <div class="hc-content-empty__actions">${links}</div>
                </div>
            `;
        },

        bindToolbarEvents() {
            const filterInput = document.getElementById('hc-content-filter');
            const sortSelect = document.getElementById('hc-content-sort');
            if (filterInput) {
                filterInput.addEventListener('input', (e) => {
                    this.state.filterTerm = e.target.value;
                    this.renderArticleList();
                    requestAnimationFrame(() => {
                        const el = document.getElementById('hc-content-filter');
                        if (el) {
                            el.focus();
                            const v = el.value; el.value = ''; el.value = v;
                        }
                    });
                });
            }
            if (sortSelect) {
                sortSelect.addEventListener('change', (e) => {
                    this.state.sortOrder = e.target.value;
                    this.renderArticleList();
                });
            }
        },

        renderArticleDetail() {
            const article = this.state.currentArticle;
            const cat = this.state.currentCategory;
            const meta = cat ? getCategoryMeta(cat.id) : { icon: 'help_outline', accent: '#4285F4' };
            const title = loc(article.question);

            const videoUrl = article.videoUrl;
            const videoEmbed = videoUrl ? `<div class="video-embed mb-6"><iframe src="${escapeHtml(videoUrl)}" title="${escapeHtml(title)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>` : '';

            this.elements.titleArea.innerHTML = `
                <header class="hc-content-header" style="--hc-accent: ${meta.accent};">
                    ${cat ? `<p class="hc-content-header__eyebrow"><span class="material-icons" aria-hidden="true">${meta.icon}</span>${escapeHtml(loc(cat.name))}</p>` : ''}
                    <h1 class="hc-content-header__title">${escapeHtml(title)}</h1>
                    <div class="hc-article-meta">
                        ${article.updatedAt ? `<span>更新: ${escapeHtml(article.updatedAt)}</span>` : ''}
                        ${article.isFeatured ? `<span class="hc-content-item__badge hc-content-item__badge--featured"><span class="material-icons" aria-hidden="true">star</span>よく読まれている</span>` : ''}
                    </div>
                </header>
            `;

            this.elements.displayArea.innerHTML = `
                <article class="help-content-article">
                    ${videoEmbed}
                    <div class="prose max-w-none help-article-body">
                        ${renderArticleBody(loc(article.answer))}
                    </div>
                </article>
                <section class="hc-feedback" data-article-id="${escapeHtml(article.id)}" aria-label="記事のフィードバック">
                    ${this.renderFeedbackUI()}
                </section>
                <div style="margin-top:1.5rem;">
                    <a href="help-content.html?category=${escapeHtml(cat?.id || '')}" class="hc-article-back">
                        <span class="material-icons" aria-hidden="true">arrow_back</span>
                        ${escapeHtml(loc(cat?.name) || 'カテゴリ一覧')}に戻る
                    </a>
                </div>
                <section class="hc-related" aria-labelledby="hc-related-title">
                    <h2 class="hc-related__title" id="hc-related-title">他によく読まれている記事</h2>
                    <div class="hc-content-list">
                        ${this.getRelatedArticles()}
                    </div>
                </section>
            `;
        },

        renderFeedbackUI() {
            const store = getFeedbackStore();
            const existing = store[this.state.currentArticle.id];
            if (existing) {
                return `<p class="hc-feedback__done" role="status"><span class="material-icons" aria-hidden="true">check_circle</span>ご協力ありがとうございました。</p>`;
            }
            return `
                <h3 class="hc-feedback__title">この記事は参考になりましたか？</h3>
                <div class="hc-feedback__actions">
                    <button type="button" class="hc-feedback__btn feedback-btn" data-vote="yes"><span class="material-icons" aria-hidden="true">thumb_up</span>はい</button>
                    <button type="button" class="hc-feedback__btn feedback-btn" data-vote="no"><span class="material-icons" aria-hidden="true">thumb_down</span>いいえ</button>
                </div>
            `;
        },

        getRelatedArticles() {
            const allQuestions = this.state.faqData.categories.flatMap(cat =>
                cat.questions.map(q => ({ ...q, _categoryId: cat.id }))
            );
            const related = allQuestions
                .filter(q => q.id !== this.state.currentArticle.id && q.isFeatured)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);

            if (related.length === 0) return `<p class="hc-feedback__done">関連記事はまだありません。</p>`;

            return related.map(article => {
                const m = getCategoryMeta(article._categoryId);
                const title = loc(article.question);
                const summary = loc(article.summary) || (loc(article.answer) ? loc(article.answer).replace(/\s+/g, ' ').slice(0, 80) : '');
                return `
                    <a class="hc-content-item" href="help-content.html?article=${encodeURIComponent(article.id)}" style="--hc-accent: ${m.accent};" aria-label="${escapeHtml(title)}">
                        <div class="hc-content-item__body">
                            <h3 class="hc-content-item__title">${escapeHtml(title)}</h3>
                            ${summary ? `<p class="hc-content-item__summary">${escapeHtml(summary)}</p>` : ''}
                        </div>
                        <span class="material-icons hc-content-item__chevron" aria-hidden="true">chevron_right</span>
                    </a>
                `;
            }).join('');
        },

        renderSearchResults() {
            const lowerCaseSearchTerm = this.state.searchTerm.toLowerCase();
            const searchKeywords = lowerCaseSearchTerm.split(/\s+/).filter(Boolean);

            const results = this.state.faqData.categories.flatMap(category =>
                category.questions.map(q => ({...q, _categoryName: loc(category.name), _categoryId: category.id}))
            ).filter(q => {
                const content = `${loc(q.question)} ${loc(q.answer)}`.toLowerCase();
                return searchKeywords.every(kw => content.includes(kw));
            });

            this.elements.titleArea.innerHTML = `
                <header class="hc-content-header">
                    <p class="hc-content-header__eyebrow"><span class="material-icons" aria-hidden="true">search</span>検索結果</p>
                    <h1 class="hc-content-header__title">「${escapeHtml(this.state.searchTerm)}」の検索結果</h1>
                    <div class="hc-content-header__meta">
                        <span class="hc-count-pill" role="status" aria-live="polite"><span class="material-icons" aria-hidden="true">article</span>${results.length}件</span>
                    </div>
                </header>
            `;

            if (results.length === 0) {
                this.elements.displayArea.innerHTML = `
                    <div class="hc-content-empty" role="status">
                        <div class="hc-content-empty__icon"><span class="material-icons" aria-hidden="true">search_off</span></div>
                        <p class="hc-content-empty__title">該当する記事は見つかりませんでした</p>
                        <p class="hc-content-empty__desc">別のキーワードでお試しください。</p>
                    </div>
                `;
                return;
            }

            const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const resultsHtml = results.map(article => {
                const m = getCategoryMeta(article._categoryId);
                let highlightedQuestion = escapeHtml(loc(article.question));
                const summaryRaw = loc(article.summary) || (loc(article.answer) ? loc(article.answer).replace(/\s+/g, ' ').slice(0, 140) : '');
                let highlightedSummary = escapeHtml(summaryRaw);
                searchKeywords.forEach(kw => {
                    const re = new RegExp(escRe(kw), 'gi');
                    highlightedQuestion = highlightedQuestion.replace(re, '<mark>$&</mark>');
                    highlightedSummary = highlightedSummary.replace(re, '<mark>$&</mark>');
                });
                return `
                    <a class="hc-content-item" href="help-content.html?article=${encodeURIComponent(article.id)}" style="--hc-accent: ${m.accent};" aria-label="${escapeHtml(loc(article.question))}">
                        <div class="hc-content-item__body">
                            <div class="hc-content-item__meta">
                                <span class="hc-content-item__badge hc-content-item__badge--featured"><span class="material-icons" aria-hidden="true">${m.icon}</span>${escapeHtml(article._categoryName)}</span>
                            </div>
                            <h2 class="hc-content-item__title">${highlightedQuestion}</h2>
                            <p class="hc-content-item__summary">${highlightedSummary}</p>
                        </div>
                        <span class="material-icons hc-content-item__chevron" aria-hidden="true">chevron_right</span>
                    </a>
                `;
            }).join('');

            this.elements.displayArea.innerHTML = `<div class="hc-content-list">${resultsHtml}</div>`;
        },

        renderNotFound() {
            this.elements.titleArea.innerHTML = `
                <header class="hc-content-header">
                    <p class="hc-content-header__eyebrow"><span class="material-icons" aria-hidden="true">error_outline</span>ページが見つかりません</p>
                    <h1 class="hc-content-header__title">コンテンツが見つかりません</h1>
                </header>
            `;
            this.elements.displayArea.innerHTML = `
                <div class="hc-content-empty" role="status">
                    <div class="hc-content-empty__icon"><span class="material-icons" aria-hidden="true">help_outline</span></div>
                    <p class="hc-content-empty__title">お探しのページは見つかりませんでした</p>
                    <p class="hc-content-empty__desc">ヘルプセンターのトップから再度お探しください。</p>
                    <div class="hc-content-empty__actions">
                        <a href="help.html" class="hc-content-empty__link"><span class="material-icons" aria-hidden="true">home</span>ヘルプセンターへ</a>
                    </div>
                </div>
            `;
        }
    };

    helpContentApp.init();
});
