import { resolveDashboardDataPath } from './utils.js';
import { resolveLocalizedValue } from './services/i18n/messages.js';

function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function loc(value) {
    const lang = (typeof window !== 'undefined' && window.getCurrentLanguage) ? window.getCurrentLanguage() : 'ja';
    return resolveLocalizedValue(value, lang, 'ja');
}

document.addEventListener('DOMContentLoaded', () => {
    const helpCenterApp = {
        elements: {
            searchInput: document.querySelector('input[name="query"]'),
            searchForm: document.querySelector('.help-center-hero form'),
            featuredCarouselWrapper: document.getElementById('featured-carousel-wrapper'),
            popularArticlesList: document.getElementById('popular-articles-list'),
            popularArticlesEmpty: document.getElementById('popular-articles-empty'),
            suggestionsContainer: document.getElementById('search-suggestions'),
            keywordsWrapper: document.getElementById('popular-keywords-wrapper'),
        },
        state: {
            articles: [],
            suggestions: [],
            activeSuggestionIndex: -1,
        },

        async init() {
            if (this.elements.searchForm) {
                this.elements.searchForm.addEventListener('submit', this.handleSearchSubmit.bind(this));
            }
            if (this.elements.searchInput) {
                this.elements.searchInput.addEventListener('input', this.handleSearchInput.bind(this));
                this.elements.searchInput.addEventListener('keydown', this.handleSearchKeydown.bind(this));
                this.elements.searchInput.addEventListener('blur', () => {
                    // クリックを奪わないよう遅延
                    setTimeout(() => this.closeSuggestions(), 150);
                });
                this.elements.searchInput.addEventListener('focus', () => {
                    if (this.elements.searchInput.value.trim().length >= 2) {
                        this.handleSearchInput();
                    }
                });
            }
            await this.loadData();
            this.renderFeaturedCarousel();
            this.renderPopularArticles();
            this.initSwiper();
            document.addEventListener('languagechange', () => {
                this.renderFeaturedCarousel();
                this.renderPopularArticles();
            });
        },

        async loadData() {
            try {
                const articlesRes = await fetch(resolveDashboardDataPath('help_articles.json'));
                if (!articlesRes.ok) throw new Error('記事データの読み込みに失敗しました。');

                const articlesData = await articlesRes.json();
                this.state.articles = articlesData.categories;

            } catch (error) {
                console.error("データの読み込み中にエラーが発生しました:", error);
                if (this.elements.featuredCarouselWrapper) {
                    this.elements.featuredCarouselWrapper.innerHTML = `<p class="text-error p-4 text-center">データの読み込みに失敗しました。</p>`;
                }
            }
        },

        handleSearchSubmit(event) {
            event.preventDefault();
            const keyword = this.elements.searchInput.value.trim();
            if (keyword) {
                window.location.href = `help-content.html?search=${encodeURIComponent(keyword)}`;
            }
        },

        handleSearchInput() {
            const keyword = this.elements.searchInput.value.trim().toLowerCase();
            if (keyword.length < 2) {
                this.closeSuggestions();
                return;
            }

            const keywords = keyword.split(/\s+/).filter(Boolean);
            const allQuestions = this.state.articles.flatMap(cat =>
                cat.questions.map(q => ({ ...q, categoryName: cat.name, categoryId: cat.id }))
            );

            const matches = allQuestions.filter(q => {
                const haystack = `${loc(q.question)} ${loc(q.answer)}`.toLowerCase();
                return keywords.every(k => haystack.includes(k));
            }).slice(0, 6);

            this.state.suggestions = matches;
            this.state.activeSuggestionIndex = -1;

            if (matches.length === 0) {
                this.renderSuggestionsEmpty();
            } else {
                this.renderSuggestions();
            }
            this.openSuggestions();
        },

        renderSuggestions() {
            if (!this.elements.suggestionsContainer) return;
            const keyword = this.elements.searchInput.value.trim();
            const highlightRegexes = keyword.split(/\s+/).filter(Boolean).map(k =>
                new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
            );

            const highlight = (text) => {
                let safe = escapeHtml(text);
                highlightRegexes.forEach(re => {
                    safe = safe.replace(re, '<mark>$&</mark>');
                });
                return safe;
            };

            this.elements.suggestionsContainer.innerHTML = this.state.suggestions.map((q, idx) => `
                <a href="help-content.html?article=${escapeHtml(q.id)}" class="search-suggestion-item" role="option" data-index="${idx}" id="suggestion-${idx}">
                    <span class="suggestion-category">${escapeHtml(loc(q.categoryName))}</span>
                    <span class="suggestion-question">${highlight(loc(q.question))}</span>
                </a>
            `).join('');
        },

        renderSuggestionsEmpty() {
            if (!this.elements.suggestionsContainer) return;
            const keyword = this.elements.searchInput.value.trim();
            this.elements.suggestionsContainer.innerHTML = `
                <div class="search-suggestion-empty">
                    <p class="text-on-surface-variant text-sm mb-2">「${escapeHtml(keyword)}」に一致する記事は見つかりませんでした。</p>
                    <p class="text-on-surface-variant text-xs">Enter で全文検索を実行できます。</p>
                </div>
            `;
        },

        openSuggestions() {
            if (!this.elements.suggestionsContainer) return;
            this.elements.suggestionsContainer.classList.remove('hidden');
            if (this.elements.searchForm) {
                this.elements.searchForm.setAttribute('aria-expanded', 'true');
            }
            if (this.elements.keywordsWrapper) {
                this.elements.keywordsWrapper.classList.add('hidden');
            }
        },

        closeSuggestions() {
            if (!this.elements.suggestionsContainer) return;
            this.elements.suggestionsContainer.classList.add('hidden');
            this.elements.suggestionsContainer.innerHTML = '';
            this.state.suggestions = [];
            this.state.activeSuggestionIndex = -1;
            if (this.elements.searchForm) {
                this.elements.searchForm.setAttribute('aria-expanded', 'false');
            }
            if (this.elements.keywordsWrapper) {
                this.elements.keywordsWrapper.classList.remove('hidden');
            }
            if (this.elements.searchInput) {
                this.elements.searchInput.removeAttribute('aria-activedescendant');
            }
        },

        setActiveSuggestion(index) {
            const items = this.elements.suggestionsContainer.querySelectorAll('.search-suggestion-item');
            if (items.length === 0) return;

            const len = items.length;
            const newIndex = ((index % len) + len) % len;

            items.forEach(el => el.classList.remove('is-active'));
            items[newIndex].classList.add('is-active');
            items[newIndex].scrollIntoView({ block: 'nearest' });

            this.state.activeSuggestionIndex = newIndex;
            if (this.elements.searchInput) {
                this.elements.searchInput.setAttribute('aria-activedescendant', `suggestion-${newIndex}`);
            }
        },

        handleSearchKeydown(event) {
            const isOpen = this.elements.suggestionsContainer
                && !this.elements.suggestionsContainer.classList.contains('hidden');
            if (!isOpen) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.setActiveSuggestion(this.state.activeSuggestionIndex + 1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.setActiveSuggestion(this.state.activeSuggestionIndex - 1);
            } else if (event.key === 'Enter') {
                if (this.state.activeSuggestionIndex >= 0 && this.state.suggestions[this.state.activeSuggestionIndex]) {
                    event.preventDefault();
                    const chosen = this.state.suggestions[this.state.activeSuggestionIndex];
                    window.location.href = `help-content.html?article=${encodeURIComponent(chosen.id)}`;
                }
                // それ以外は既存の submit ハンドラに任せる
            } else if (event.key === 'Escape') {
                event.preventDefault();
                this.closeSuggestions();
            }
        },

        renderFeaturedCarousel() {
            if (!this.elements.featuredCarouselWrapper) return;

            const featuredCategoryIds = ['getting-started', 'how-to-use', 'account', 'troubleshooting', 'plans-billing'];
            const duplicatedCategoryIds = [...featuredCategoryIds, ...featuredCategoryIds]; // ループ再生のためにスライドを複製

            const categoryIcons = {
                'getting-started': 'flag',
                'how-to-use': 'build',
                account: 'account_circle',
                troubleshooting: 'support_agent',
                'plans-billing': 'receipt_long'
            };

            const slidesHtml = duplicatedCategoryIds.map(id => {
                const category = this.state.articles.find(c => c.id === id);
                if (!category) return '';

                const questionsHtml = category.questions.slice(0, 3).map(q =>
                    `<li><a href="help-content.html?article=${escapeHtml(q.id)}" class="flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm transition-colors"><span class="material-icons text-base">chevron_right</span>${escapeHtml(loc(q.question))}</a></li>`
                ).join('');

                return `
                    <div class="swiper-slide h-auto">
                        <div class="highlight-card bg-surface rounded-xl p-8 shadow-lg h-full flex flex-col">
                            <a href="help-content.html?category=${escapeHtml(category.id)}" class="flex items-center gap-4 mb-4">
                                <span class="material-icons text-3xl text-primary">${categoryIcons[id] || 'help_outline'}</span>
                                <h3 class="text-xl font-semibold text-on-surface">${escapeHtml(loc(category.name))}</h3>
                            </a>
                            <ul class="space-y-3 text-sm flex-grow">
                                ${questionsHtml}
                            </ul>
                        </div>
                    </div>
                `;
            }).join('');

            this.elements.featuredCarouselWrapper.innerHTML = slidesHtml;
        },

        renderPopularArticles() {
            if (!this.elements.popularArticlesList) return;

            const allQuestions = this.state.articles.flatMap(cat =>
                cat.questions.map(q => ({ ...q, categoryName: cat.name, categoryId: cat.id }))
            );
            const featured = allQuestions.filter(q => q.isFeatured).slice(0, 6);

            if (featured.length === 0) {
                this.elements.popularArticlesList.innerHTML = '';
                if (this.elements.popularArticlesEmpty) {
                    this.elements.popularArticlesEmpty.textContent = '公開中の記事はまだありません。';
                    this.elements.popularArticlesEmpty.classList.remove('hidden');
                }
                return;
            }

            if (this.elements.popularArticlesEmpty) {
                this.elements.popularArticlesEmpty.classList.add('hidden');
            }

            this.elements.popularArticlesList.innerHTML = featured.map(article => `
                <a href="help-content.html?article=${escapeHtml(article.id)}" class="popular-article-card block bg-surface rounded-lg p-4 border border-outline-variant hover:border-primary hover:shadow-md transition">
                    <p class="text-xs text-primary font-semibold mb-1">${escapeHtml(loc(article.categoryName))}</p>
                    <h3 class="text-base font-semibold text-on-surface flex items-start gap-2">
                        <span>${escapeHtml(loc(article.question))}</span>
                        <span class="material-icons text-on-surface-variant text-base ml-auto flex-shrink-0">chevron_right</span>
                    </h3>
                </a>
            `).join('');
        },

        initSwiper() {
            if (!document.getElementById('featured-carousel')) return;

            new Swiper('#featured-carousel', {
                loop: true,
                slidesPerView: 1,
                spaceBetween: 16,
                autoplay: {
                    delay: 6000,
                    disableOnInteraction: true,
                    pauseOnMouseEnter: true,
                },
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
                },
                a11y: {
                    prevSlideMessage: '前のスライド',
                    nextSlideMessage: '次のスライド',
                    paginationBulletMessage: 'スライド {{index}} へ移動',
                },
                breakpoints: {
                    768: {
                        slidesPerView: 2,
                    },
                    1024: {
                        slidesPerView: 3,
                    },
                }
            });
        }
    };

    helpCenterApp.init();
});
