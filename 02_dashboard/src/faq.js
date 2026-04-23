import { resolveDashboardDataPath, debounce } from './utils.js';
import { escapeHtml, highlightText } from './shared/escape.js';

// カテゴリID → アクセントカラー / アイコン
const CATEGORY_META = {
    'general':  { icon: 'help_outline',      accent: '#4285F4' },
    'account':  { icon: 'account_circle',    accent: '#7e57c2' },
    'plans':    { icon: 'workspace_premium', accent: '#f4b400' },
    'billing':  { icon: 'receipt_long',      accent: '#0f9d58' },
    'features': { icon: 'tune',              accent: '#00acc1' },
};

function getAccent(categoryId) {
    return CATEGORY_META[categoryId]?.accent || '#4285F4';
}

function getIcon(categoryId, fallback) {
    return CATEGORY_META[categoryId]?.icon || fallback || 'help_outline';
}

document.addEventListener('DOMContentLoaded', () => {
    const faqApp = {
        elements: {
            loadingIndicator: document.getElementById('loading-indicator'),
            errorMessage: document.getElementById('error-message'),
            faqContainer: document.getElementById('faq-container'),
            faqList: document.getElementById('faq-list'),
            faqListSection: document.getElementById('faq-list-section'),
            noResultsMessage: document.getElementById('no-results-message'),
            resetSearchBtn: document.getElementById('reset-search-btn'),
            searchBox: document.getElementById('search-box'),
            clearSearchBtn: document.getElementById('clear-search-btn'),
            searchForm: document.getElementById('faq-search-form'),
            categoryCards: document.getElementById('category-cards'),
            categoryCardsSection: document.getElementById('category-cards-section'),
            popularKeywordsWrapper: document.getElementById('popular-keywords-wrapper'),
            searchStatus: document.getElementById('search-status'),
            stickySearch: document.getElementById('faq-sticky-search'),
            stickySearchInput: document.getElementById('faq-sticky-search-input'),
            stickySearchForm: document.getElementById('faq-sticky-form'),
            heroSection: document.querySelector('.faq-hero'),
        },

        state: {
            allData: null,
            isLoading: false,
            error: null,
            searchTerm: '',
            activeQuestionId: null,
            preSearchActiveQuestionId: null,
            feedbackStatus: {},
            isComposing: false,
        },

        async fetchFaqData() {
            this.state.isLoading = true;
            this.renderUI();
            try {
                const response = await fetch(resolveDashboardDataPath('faq.json'));
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                this.state.allData = await response.json();
            } catch (e) {
                this.state.error = e;
                console.error('FAQデータの読み込みに失敗しました:', e);
            } finally {
                this.state.isLoading = false;
                this.renderUI();
            }
        },

        renderUI() {
            const { isLoading, error, allData } = this.state;
            const { loadingIndicator, errorMessage, faqContainer } = this.elements;

            loadingIndicator.classList.toggle('hidden', !isLoading);
            errorMessage.classList.toggle('hidden', !error);
            if (error) {
                errorMessage.textContent = '情報の読み込みに失敗しました。時間をおいて再度お試しください。';
            }

            const shouldShowFaq = !isLoading && !error && allData;
            faqContainer.classList.toggle('hidden', !shouldShowFaq);

            if (shouldShowFaq) {
                this.renderPopularKeywords();
                this.renderCategoryCards();
                const filteredData = this.getFilteredData();
                this.renderFaqList(filteredData);
                this.renderSearchStatus(filteredData);
            }
        },

        renderPopularKeywords() {
            const { popularKeywordsWrapper } = this.elements;
            if (!popularKeywordsWrapper) return;
            const keywords = Array.isArray(this.state.allData.popularKeywords)
                ? this.state.allData.popularKeywords
                : [];
            if (keywords.length === 0) {
                popularKeywordsWrapper.innerHTML = '';
                return;
            }
            const chipsHtml = keywords
                .map(keyword => {
                    const safe = escapeHtml(keyword);
                    return `<button type="button" class="keyword-chip" data-keyword="${safe}">${safe}</button>`;
                })
                .join('');
            popularKeywordsWrapper.innerHTML = `
                <span class="faq-keywords__label">よく検索されるキーワード:</span>
                ${chipsHtml}
            `;
        },

        renderCategoryCards() {
            const { categoryCards, categoryCardsSection } = this.elements;
            if (!categoryCards) return;
            // 検索中はカテゴリカード非表示（ジャンプ先が検索結果に無いため）
            if (this.state.searchTerm.trim()) {
                categoryCardsSection?.classList.add('hidden');
                return;
            }
            const categories = this.state.allData.categories || [];
            const visibleCategories = categories.filter(cat => Array.isArray(cat.questions) && cat.questions.length > 0);
            if (visibleCategories.length === 0) {
                categoryCardsSection?.classList.add('hidden');
                return;
            }
            categoryCardsSection?.classList.remove('hidden');
            categoryCards.innerHTML = visibleCategories.map(category => {
                const safeId = escapeHtml(category.id);
                const safeName = escapeHtml(category.name);
                const safeDesc = escapeHtml(category.description || '');
                const icon = getIcon(category.id, category.icon);
                const accent = getAccent(category.id);
                const count = category.questions.length;
                // 注目質問があれば優先、無ければ先頭から3件プレビュー
                const preview = category.questions.filter(q => q.isFeatured).slice(0, 3);
                const filled = preview.length >= 3
                    ? preview
                    : [...preview, ...category.questions.filter(q => !q.isFeatured).slice(0, 3 - preview.length)];

                const previewHtml = filled.map(q => `
                    <li class="faq-category-card__question">
                        <span class="material-icons" aria-hidden="true">chevron_right</span>
                        <span>${escapeHtml(q.question || '')}</span>
                    </li>
                `).join('');

                return `
                    <a href="#cat-${safeId}" class="faq-category-card" data-category-id="${safeId}" style="--hc-accent: ${accent};" aria-label="${safeName} (${count}件)">
                        <span class="faq-category-card__count-badge" aria-hidden="true">${count}件</span>
                        <div class="faq-category-card__header">
                            <span class="faq-category-card__icon" aria-hidden="true"><span class="material-icons">${escapeHtml(icon)}</span></span>
                            <div class="faq-category-card__title-wrap">
                                <h3 class="faq-category-card__title">${safeName}</h3>
                                ${safeDesc ? `<p class="faq-category-card__desc">${safeDesc}</p>` : ''}
                            </div>
                        </div>
                        ${previewHtml ? `<ul class="faq-category-card__questions">${previewHtml}</ul>` : ''}
                        <span class="faq-category-card__more">
                            すべて見る
                            <span class="material-icons" aria-hidden="true">arrow_forward</span>
                        </span>
                    </a>
                `;
            }).join('');
        },

        renderFaqList(data) {
            const { faqList, noResultsMessage, faqListSection } = this.elements;
            const searchTerm = this.state.searchTerm.trim();
            const hasResults = (data.categories || []).some(cat => (cat.questions || []).length > 0);

            if (hasResults) {
                const categoriesHtml = data.categories.map(category => {
                    const questions = category.questions || [];
                    if (questions.length === 0) return '';
                    const safeId = escapeHtml(category.id);
                    const safeName = escapeHtml(category.name);
                    const safeDesc = escapeHtml(category.description || '');
                    const icon = getIcon(category.id, category.icon);
                    const accent = getAccent(category.id);
                    return `
                        <section id="cat-${safeId}" class="faq-category-block" tabindex="-1" style="--hc-accent: ${accent};">
                            <h3 class="faq-category-heading">
                                <span class="material-icons" aria-hidden="true">${escapeHtml(icon)}</span>
                                <span>${safeName}</span>
                                ${safeDesc ? `<span class="faq-category-desc">${safeDesc}</span>` : ''}
                            </h3>
                            <div class="space-y-3">
                                ${questions.map(q => this.getQuestionHtml(q)).join('')}
                            </div>
                        </section>
                    `;
                }).join('');
                faqList.innerHTML = categoriesHtml;
                // 展開中の質問がある場合、その answer の hidden を外す
                this.syncAccordionVisibility();
            } else {
                faqList.innerHTML = '';
            }
            faqList.classList.toggle('hidden', !hasResults);
            noResultsMessage.classList.toggle('hidden', hasResults);
            faqListSection?.classList.remove('hidden');
        },

        renderSearchStatus(data) {
            const { searchStatus } = this.elements;
            if (!searchStatus) return;
            const searchTerm = this.state.searchTerm.trim();
            if (!searchTerm) {
                searchStatus.classList.add('hidden');
                searchStatus.classList.remove('faq-search-status');
                searchStatus.innerHTML = '';
                return;
            }
            const count = (data.categories || []).reduce(
                (acc, cat) => acc + (cat.questions || []).length,
                0
            );
            const safeTerm = escapeHtml(searchTerm);
            searchStatus.classList.add('faq-search-status');
            searchStatus.classList.remove('hidden');
            searchStatus.innerHTML = `
                <span class="material-icons" aria-hidden="true">filter_alt</span>
                <span>「<strong>${safeTerm}</strong>」の検索結果：<span class="count">${count}</span>件</span>
                <button type="button" class="feedback-btn" data-action="clear-search">
                    <span class="material-icons" aria-hidden="true">close</span>クリア
                </button>
            `;
        },

        getQuestionHtml(question, options = {}) {
            const isOpen = this.state.activeQuestionId === question.id;
            const isFeatured = options.featured || question.isFeatured;
            const safeId = escapeHtml(question.id);
            const answerId = `faq-answer-${safeId}`;
            const questionId = `faq-question-${safeId}`;
            const searchTerm = this.state.searchTerm.trim();
            const questionHtml = highlightText(question.question || '', searchTerm);
            const answerHtml = highlightText(question.answer || '', searchTerm).replace(/\n/g, '<br>');
            const hiddenAttr = isOpen ? '' : 'hidden';
            return `
                <div class="faq-item ${isOpen ? 'is-open' : ''} ${isFeatured ? 'is-featured' : ''}" data-id="${safeId}">
                    <button id="${questionId}" class="faq-question" type="button" aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="${answerId}">
                        <span class="faq-question-label">
                            <span class="faq-q-mark" aria-hidden="true">Q</span>
                            <span>${questionHtml}</span>
                        </span>
                        <span class="material-icons faq-icon" aria-hidden="true">expand_more</span>
                    </button>
                    <div class="faq-answer" id="${answerId}" role="region" aria-labelledby="${questionId}" ${hiddenAttr}>
                        <p>${answerHtml}</p>
                        ${this.getFeedbackHtml(question.id)}
                    </div>
                </div>
            `;
        },

        getFeedbackHtml(questionId) {
            const safeId = escapeHtml(questionId);
            if (this.state.feedbackStatus[questionId]) {
                return `
                    <div class="feedback-section">
                        <span class="feedback-thanks">
                            <span class="material-icons" aria-hidden="true">check_circle</span>
                            ご協力ありがとうございました
                        </span>
                    </div>
                `;
            }
            return `
                <div class="feedback-section">
                    <span class="feedback-label">この回答は役に立ちましたか？</span>
                    <div class="feedback-buttons">
                        <button type="button" class="feedback-btn" data-vote="useful" data-id="${safeId}" aria-label="この回答は役に立ちました">
                            <span class="material-icons" aria-hidden="true">thumb_up</span>はい
                        </button>
                        <button type="button" class="feedback-btn" data-vote="not-useful" data-id="${safeId}" aria-label="この回答は役に立ちませんでした">
                            <span class="material-icons" aria-hidden="true">thumb_down</span>いいえ
                        </button>
                    </div>
                </div>
            `;
        },

        getFilteredData() {
            const { allData, searchTerm } = this.state;
            const trimmed = searchTerm.trim();
            if (!trimmed) {
                return allData;
            }
            const lower = trimmed.toLowerCase();
            const searchKeywords = lower.split(/\s+/).filter(Boolean);

            const filteredCategories = allData.categories.map(category => {
                const filteredQuestions = (category.questions || []).filter(question => {
                    const content = `${question.question} ${question.answer}`.toLowerCase();
                    return searchKeywords.every(keyword => content.includes(keyword));
                });
                return { ...category, questions: filteredQuestions };
            });
            return { ...allData, categories: filteredCategories };
        },

        /* ========== アコーディオンの hidden 同期 ========== */
        syncAccordionVisibility() {
            document.querySelectorAll('.faq-answer').forEach(el => {
                const item = el.closest('.faq-item');
                const isOpen = item?.classList.contains('is-open');
                if (isOpen) el.removeAttribute('hidden');
                else el.setAttribute('hidden', '');
            });
        },

        handleFaqClick(event) {
            const questionElement = event.target.closest('.faq-question');
            if (!questionElement) return;

            const clickedFaqItem = questionElement.closest('.faq-item');
            if (!clickedFaqItem) return;
            const wasOpen = clickedFaqItem.classList.contains('is-open');

            document.querySelectorAll('.faq-item.is-open').forEach(item => {
                item.classList.remove('is-open');
                const btn = item.querySelector('.faq-question');
                btn?.setAttribute('aria-expanded', 'false');
                const answer = item.querySelector('.faq-answer');
                if (answer) {
                    answer.style.removeProperty('--faq-answer-height');
                    answer.setAttribute('hidden', '');
                }
            });

            if (!wasOpen) {
                clickedFaqItem.classList.add('is-open');
                questionElement.setAttribute('aria-expanded', 'true');
                this.state.activeQuestionId = clickedFaqItem.dataset.id || null;
                const answer = clickedFaqItem.querySelector('.faq-answer');
                if (answer) {
                    answer.removeAttribute('hidden');
                    // 動的高さ計算
                    const height = answer.scrollHeight;
                    answer.style.setProperty('--faq-answer-height', `${height + 16}px`);
                }
            } else {
                this.state.activeQuestionId = null;
            }
        },

        handleFeedbackClick(event) {
            const feedbackBtn = event.target.closest('.feedback-btn');
            if (!feedbackBtn) return;

            if (feedbackBtn.dataset.action === 'clear-search') {
                this.clearSearch();
                return;
            }

            const { id, vote } = feedbackBtn.dataset;
            if (!id || !vote) return;

            console.log(`GA Event: { category: 'FAQ', action: 'Feedback', label: '${id} - ${vote}' }`);

            this.state.feedbackStatus[id] = true;
            this.saveFeedbackStatus();

            const feedbackSection = feedbackBtn.closest('.feedback-section');
            if (feedbackSection) {
                feedbackSection.setAttribute('role', 'status');
                feedbackSection.setAttribute('aria-live', 'polite');
                feedbackSection.innerHTML = `
                    <span class="feedback-thanks">
                        <span class="material-icons" aria-hidden="true">check_circle</span>
                        ご協力ありがとうございました
                    </span>
                `;
            }
        },

        handleKeywordChipClick(event) {
            const chip = event.target.closest('.keyword-chip');
            if (!chip) return;
            const keyword = chip.dataset.keyword || chip.textContent.trim();
            if (!keyword) return;
            this.elements.searchBox.value = keyword;
            this.handleSearch();
            this.elements.searchBox.focus();
        },

        /* ========== カテゴリカード: アンカー遷移後にフォーカス移譲 ========== */
        handleCategoryCardClick(event) {
            const card = event.target.closest('.faq-category-card');
            if (!card) return;
            const id = card.dataset.categoryId;
            if (!id) return;
            // ブラウザの既定のハッシュ遷移に加えて、到着先セクションへフォーカスを飛ばす
            setTimeout(() => {
                const target = document.getElementById(`cat-${id}`);
                if (target) target.focus({ preventScroll: true });
            }, 0);
        },

        handleSearch() {
            const enteringSearch = !this.state.searchTerm && !!this.elements.searchBox.value.trim();
            if (enteringSearch) {
                this.state.preSearchActiveQuestionId = this.state.activeQuestionId;
            }
            this.state.searchTerm = this.elements.searchBox.value;
            this.elements.clearSearchBtn.classList.toggle('hidden', !this.state.searchTerm);
            this.state.activeQuestionId = null;
            this.renderUI();
        },

        clearSearch() {
            this.elements.searchBox.value = '';
            if (this.elements.stickySearchInput) {
                this.elements.stickySearchInput.value = '';
            }
            this.state.searchTerm = '';
            this.elements.clearSearchBtn.classList.add('hidden');
            this.state.activeQuestionId = this.state.preSearchActiveQuestionId || null;
            this.state.preSearchActiveQuestionId = null;
            this.renderUI();
            this.elements.searchBox.focus();
            if (this.state.activeQuestionId) {
                queueMicrotask(() => {
                    const item = document.querySelector(`.faq-item[data-id="${CSS.escape(this.state.activeQuestionId)}"]`);
                    const answer = item?.querySelector('.faq-answer');
                    if (answer) {
                        answer.removeAttribute('hidden');
                        const height = answer.scrollHeight;
                        answer.style.setProperty('--faq-answer-height', `${height + 16}px`);
                    }
                });
            }
        },

        /* ========== Sticky search ========== */
        bindStickySearch() {
            const sticky = this.elements.stickySearch;
            const hero = this.elements.heroSection;
            const input = this.elements.stickySearchInput;
            if (!sticky || !hero) return;

            const onScroll = () => {
                const threshold = hero.offsetTop + hero.offsetHeight - 80;
                if (window.scrollY > threshold) {
                    if (!sticky.hidden) return;
                    sticky.hidden = false;
                    requestAnimationFrame(() => sticky.classList.add('is-visible'));
                } else {
                    sticky.classList.remove('is-visible');
                    setTimeout(() => {
                        if (!sticky.classList.contains('is-visible')) sticky.hidden = true;
                    }, 250);
                }
            };
            window.addEventListener('scroll', onScroll, { passive: true });
            onScroll();

            if (input) {
                input.addEventListener('input', debounce(() => {
                    this.elements.searchBox.value = input.value;
                    this.handleSearch();
                }, 250));
                this.elements.stickySearchForm?.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.elements.searchBox.value = input.value;
                    this.handleSearch();
                });
            }
        },

        loadFeedbackStatus() {
            try {
                const storedStatus = sessionStorage.getItem('faqFeedbackStatus');
                if (storedStatus) {
                    this.state.feedbackStatus = JSON.parse(storedStatus);
                }
            } catch (e) {
                console.error('フィードバック状態の読み込みに失敗しました:', e);
                this.state.feedbackStatus = {};
            }
        },

        saveFeedbackStatus() {
            try {
                sessionStorage.setItem('faqFeedbackStatus', JSON.stringify(this.state.feedbackStatus));
            } catch (e) {
                console.error('フィードバック状態の保存に失敗しました:', e);
            }
        },

        addEventListeners() {
            const { faqContainer, searchBox, searchForm, clearSearchBtn, resetSearchBtn, popularKeywordsWrapper, searchStatus, categoryCards } = this.elements;

            faqContainer.addEventListener('click', (event) => {
                this.handleFaqClick(event);
                this.handleFeedbackClick(event);
            });

            popularKeywordsWrapper?.addEventListener('click', (event) => {
                this.handleKeywordChipClick(event);
            });

            searchStatus?.addEventListener('click', (event) => {
                this.handleFeedbackClick(event);
            });

            categoryCards?.addEventListener('click', (event) => {
                this.handleCategoryCardClick(event);
            });

            // Search form submit (インライン onsubmit の代替)
            searchForm?.addEventListener('submit', (event) => {
                event.preventDefault();
                this.handleSearch();
            });

            let searchTimeout;
            searchBox.addEventListener('input', () => {
                if (this.state.isComposing) return;
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.handleSearch(), 250);
            });
            searchBox.addEventListener('compositionstart', () => {
                this.state.isComposing = true;
            });
            searchBox.addEventListener('compositionend', () => {
                this.state.isComposing = false;
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.handleSearch(), 250);
            });
            searchBox.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && this.elements.searchBox.value) {
                    event.preventDefault();
                    this.clearSearch();
                }
            });

            clearSearchBtn.addEventListener('click', () => {
                this.clearSearch();
            });
            resetSearchBtn?.addEventListener('click', () => {
                this.clearSearch();
            });

            window.addEventListener('resize', debounce(() => {
                const openItem = document.querySelector('.faq-item.is-open');
                if (!openItem) return;
                const answer = openItem.querySelector('.faq-answer');
                if (!answer) return;
                answer.style.removeProperty('--faq-answer-height');
                const height = answer.scrollHeight;
                answer.style.setProperty('--faq-answer-height', `${height + 16}px`);
            }, 150));
        },

        async init() {
            this.loadFeedbackStatus();
            this.addEventListeners();
            this.bindStickySearch();
            await this.fetchFaqData();
        }
    };

    faqApp.init();
});
