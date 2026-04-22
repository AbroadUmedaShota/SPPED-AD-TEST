import { resolveDashboardDataPath } from './utils.js';
import { resolveLocalizedValue } from './services/i18n/messages.js';

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
                    const feedbackSection = feedbackBtn.closest('.feedback-section');
                    const articleId = feedbackSection?.dataset.articleId;
                    const vote = feedbackBtn.dataset.vote || 'yes';
                    if (articleId) {
                        const store = getFeedbackStore();
                        store[articleId] = { vote, at: new Date().toISOString() };
                        setFeedbackStore(store);
                    }
                    feedbackSection.innerHTML = '<p class="text-on-surface-variant">ご協力ありがとうございました。</p>';
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
                this.renderTitle();
                this.renderArticleDetail();
            } else if (this.state.currentCategory) {
                this.renderTitle();
                this.renderArticleList();
            } else {
                this.renderNotFound();
            }
        },

        renderBreadcrumbs() {
            let items = [
                { name: 'アンケート一覧', link: 'index.html' },
                { name: 'ヘルプセンター', link: 'help-center.html' }
            ];

            if (this.state.searchTerm) {
                items.push({ name: `検索結果: "${escapeHtml(this.state.searchTerm)}"` });
            } else if (this.state.currentCategory) {
                items.push({ name: loc(this.state.currentCategory.name), link: `help-content.html?category=${this.state.currentCategory.id}` });
                if (this.state.currentArticle) {
                    items.push({ name: loc(this.state.currentArticle.question) });
                }
            }

            const breadcrumbHtml = `<nav aria-label="Breadcrumb"><ol class="flex items-center flex-wrap space-x-1 text-sm">` +
                items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    const linkElement = isLast
                        ? `<span class="text-on-surface-variant font-medium">${item.name}</span>`
                        : `<a href="${item.link}" class="text-secondary hover:underline">${item.name}</a>`;
                    const separator = isLast ? '' : `<span class="material-icons text-on-surface-variant mx-1" style="font-size: 1rem;">chevron_right</span>`;
                    return `<li class="flex items-center">${linkElement}${separator}</li>`;
                }).join('') + `</ol></nav>`;

            this.elements.breadcrumbContainer.innerHTML = breadcrumbHtml;
        },

        renderTitle() {
            const title = this.state.currentArticle ? loc(this.state.currentArticle.question) : loc(this.state.currentCategory.name);
            this.elements.titleArea.innerHTML = `
                <h1 class="text-on-background text-headline-large font-bold leading-tight tracking-tight">${title}</h1>
            `;
        },

        renderArticleList() {
            const articles = this.state.faqData.categories
                .find(c => c.id === this.state.currentCategory.id)?.questions || [];

            if (articles.length === 0) {
                this.elements.displayArea.innerHTML = '<p class="text-center text-on-surface-variant">このカテゴリにはまだ記事がありません。</p>';
                return;
            }

            const countLabel = `<p class="text-sm text-on-surface-variant mb-4">全${articles.length}件</p>`;

            const articlesHtml = articles.map(article => `
                <a href="help-content.html?article=${article.id}" class="article-list-item block border-b border-outline-variant py-4 hover:bg-surface-variant -mx-4 px-4">
                    <h2 class="text-lg font-semibold text-on-surface mb-1">${loc(article.question)}</h2>
                    <p class="text-sm text-on-surface-variant">${loc(article.answer).substring(0, 80)}...</p>
                </a>
            `).join('');

            this.elements.displayArea.innerHTML = countLabel + `<div class="space-y-2">${articlesHtml}</div>`;
        },

        renderArticleDetail() {
            const videoUrl = this.state.currentArticle.videoUrl;
            const videoEmbed = videoUrl ? `<div class="video-embed mb-6"><iframe src="${escapeHtml(videoUrl)}" title="${escapeHtml(loc(this.state.currentArticle.question))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>` : '';
            const articleHtml = `
                <article class="help-content-article">
                    <p class="text-sm text-on-surface-variant mb-4">最終更新日: ${escapeHtml(this.state.currentArticle.updatedAt || '—')}</p>
                    ${videoEmbed}
                    <div class="prose max-w-none text-on-surface help-article-body">
                        ${renderArticleBody(loc(this.state.currentArticle.answer))}
                    </div>
                </article>
                <section class="feedback-section mt-12 py-8 border-t border-b border-outline-variant text-center" data-article-id="${escapeHtml(this.state.currentArticle.id)}">
                    ${this.renderFeedbackUI()}
                </section>
                <div class="mt-8 text-center">
                    <a href="help-content.html?category=${escapeHtml(this.state.currentCategory?.id || '')}" class="inline-flex items-center gap-1 text-primary hover:underline">
                        <span class="material-icons text-base">arrow_back</span>
                        ${escapeHtml(loc(this.state.currentCategory?.name) || 'カテゴリ一覧')}に戻る
                    </a>
                </div>
                <section class="related-articles-section mt-12">
                    <h3 class="text-xl font-bold text-on-background mb-4">他によく読まれている記事</h3>
                    <div class="grid grid-cols-1 gap-4">
                        ${this.getRelatedArticles()}
                    </div>
                </section>
            `;
            this.elements.displayArea.innerHTML = articleHtml;
        },

        renderFeedbackUI() {
            const store = getFeedbackStore();
            const existing = store[this.state.currentArticle.id];
            if (existing) {
                return `<p class="text-on-surface-variant">ご協力ありがとうございました。</p>`;
            }
            return `
                <h3 class="font-semibold text-on-surface mb-3">この記事は参考になりましたか？</h3>
                <div class="flex justify-center gap-4">
                    <button class="feedback-btn" data-vote="yes"><span class="material-icons mr-2">thumb_up</span>はい</button>
                    <button class="feedback-btn" data-vote="no"><span class="material-icons mr-2">thumb_down</span>いいえ</button>
                </div>
            `;
        },

        getRelatedArticles() {
            const allQuestions = this.state.faqData.categories.flatMap(cat => cat.questions);
            const related = allQuestions
                .filter(q => q.id !== this.state.currentArticle.id && q.isFeatured)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);

            return related.map(article => `
                <a href="help-content.html?article=${article.id}" class="related-article-link">
                    <span class="font-semibold">${loc(article.question)}</span>
                    <span class="material-icons">chevron_right</span>
                </a>
            `).join('');
        },

        renderSearchResults() {
            const lowerCaseSearchTerm = this.state.searchTerm.toLowerCase();
            const searchKeywords = lowerCaseSearchTerm.split(/\s+/).filter(Boolean);

            const results = this.state.faqData.categories.flatMap(category =>
                category.questions.map(question => ({...question, categoryName: loc(category.name)}))
            ).filter(question => {
                const content = `${loc(question.question)} ${loc(question.answer)}`.toLowerCase();
                return searchKeywords.every(keyword => content.includes(keyword));
            });

            this.elements.titleArea.innerHTML = `<h1 class="text-on-background text-headline-large font-bold">「${escapeHtml(this.state.searchTerm)}」の検索結果 (${results.length}件)</h1>`;

            if (results.length === 0) {
                this.elements.displayArea.innerHTML = '<p class="text-center text-on-surface-variant">該当する記事は見つかりませんでした。</p>';
                return;
            }

            const resultsHtml = results.map(article => {
                let highlightedQuestion = escapeHtml(loc(article.question));
                let highlightedAnswer = escapeHtml(loc(article.answer).substring(0, 120)) + '...';

                searchKeywords.forEach(keyword => {
                    const regex = new RegExp(escapeHtml(keyword), 'gi');
                    highlightedQuestion = highlightedQuestion.replace(regex, '<mark>$&</mark>');
                    highlightedAnswer = highlightedAnswer.replace(regex, '<mark>$&</mark>');
                });

                return `
                    <a href="help-content.html?article=${article.id}" class="article-list-item block border-b border-outline-variant py-4 hover:bg-surface-variant -mx-4 px-4">
                        <p class="text-xs text-on-surface-variant mb-1">${escapeHtml(article.categoryName)}</p>
                        <h2 class="text-lg font-semibold text-on-surface mb-2">${highlightedQuestion}</h2>
                        <p class="text-sm text-on-surface-variant">${highlightedAnswer}</p>
                    </a>
                `;
            }).join('');

            this.elements.displayArea.innerHTML = `<div class="space-y-2">${resultsHtml}</div>`;
        },

        renderNotFound() {
            this.elements.titleArea.innerHTML = `<h1 class="text-on-background text-headline-large font-bold">コンテンツが見つかりません</h1>`;
            this.elements.displayArea.innerHTML = '<p class="text-center text-on-surface-variant">お探しのページは見つかりませんでした。ヘルプセンターのトップから再度お探しください。</p>';
        }
    };

    helpContentApp.init();
});
