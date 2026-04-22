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
        },
        state: {
            articles: [],
        },

        async init() {
            if (this.elements.searchForm) {
                this.elements.searchForm.addEventListener('submit', this.handleSearchSubmit.bind(this));
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
