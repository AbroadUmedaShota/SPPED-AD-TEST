import { resolveDashboardDataPath } from './utils.js';
import { escapeHtml, highlightText } from './shared/escape.js';

document.addEventListener('DOMContentLoaded', () => {
    const faqApp = {
        elements: {
            loadingIndicator: document.getElementById('loading-indicator'),
            errorMessage: document.getElementById('error-message'),
            faqContainer: document.getElementById('faq-container'),
            featuredList: document.getElementById('featured-questions-list'),
            featuredSection: document.getElementById('featured-questions'),
            faqList: document.getElementById('faq-list'),
            faqListSection: document.getElementById('faq-list-section'),
            noResultsMessage: document.getElementById('no-results-message'),
            resetSearchBtn: document.getElementById('reset-search-btn'),
            searchBox: document.getElementById('search-box'),
            clearSearchBtn: document.getElementById('clear-search-btn'),
            categoryCards: document.getElementById('category-cards'),
            categoryCardsSection: document.getElementById('category-cards-section'),
            popularKeywordsWrapper: document.getElementById('popular-keywords-wrapper'),
            searchStatus: document.getElementById('search-status'),
        },

        state: {
            allData: null,
            isLoading: false,
            error: null,
            searchTerm: '',
            activeQuestionId: null,
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
                this.renderFeaturedQuestions(filteredData);
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
                <span class="text-sm text-gray-200 text-shadow-sm mr-2">よく検索されるキーワード:</span>
                ${chipsHtml}
            `;
        },

        renderCategoryCards() {
            const { categoryCards, categoryCardsSection } = this.elements;
            if (!categoryCards) return;
            const categories = this.state.allData.categories || [];
            if (categories.length === 0) {
                categoryCardsSection?.classList.add('hidden');
                return;
            }
            categoryCardsSection?.classList.remove('hidden');
            categoryCards.innerHTML = categories
                .map(category => {
                    const safeId = escapeHtml(category.id);
                    const safeName = escapeHtml(category.name);
                    const safeDesc = escapeHtml(category.description || '');
                    const safeIcon = escapeHtml(category.icon || 'help_outline');
                    const count = Array.isArray(category.questions) ? category.questions.length : 0;
                    return `
                        <a href="#cat-${safeId}" class="faq-category-card" data-category-id="${safeId}">
                            <span class="category-icon"><span class="material-icons" aria-hidden="true">${safeIcon}</span></span>
                            <span class="flex-1 min-w-0">
                                <span class="category-name">${safeName}</span>
                                <span class="category-desc">${safeDesc}</span>
                            </span>
                            <span class="category-count" aria-label="${count}件">${count}</span>
                        </a>
                    `;
                })
                .join('');
        },

        renderFeaturedQuestions(data) {
            const { featuredList, featuredSection } = this.elements;
            if (!featuredList) return;
            const searchTerm = this.state.searchTerm.trim();
            // 検索中は注目質問セクションを隠す（結果と重複を避ける）
            if (searchTerm) {
                featuredSection?.classList.add('hidden');
                featuredList.innerHTML = '';
                return;
            }
            const allQuestions = (data.categories || []).flatMap(cat =>
                (cat.questions || []).map(q => ({ ...q, _categoryId: cat.id, _categoryName: cat.name }))
            );
            const featured = allQuestions.filter(q => q.isFeatured);
            if (featured.length === 0) {
                featuredSection?.classList.add('hidden');
                featuredList.innerHTML = '';
                return;
            }
            featuredSection?.classList.remove('hidden');
            featuredList.innerHTML = featured.map(q => this.getQuestionHtml(q, { featured: true })).join('');
        },

        renderFaqList(data) {
            const { faqList, noResultsMessage, faqListSection } = this.elements;
            const hasResults = (data.categories || []).some(cat => (cat.questions || []).length > 0);

            if (hasResults) {
                const categoriesHtml = data.categories.map(category => {
                    if ((category.questions || []).length === 0) return '';
                    const safeId = escapeHtml(category.id);
                    const safeName = escapeHtml(category.name);
                    const safeDesc = escapeHtml(category.description || '');
                    const safeIcon = escapeHtml(category.icon || 'help_outline');
                    return `
                        <section id="cat-${safeId}" class="faq-category-block">
                            <h3 class="faq-category-heading">
                                <span class="material-icons" aria-hidden="true">${safeIcon}</span>
                                <span>${safeName}</span>
                                ${safeDesc ? `<span class="faq-category-desc">${safeDesc}</span>` : ''}
                            </h3>
                            <div class="space-y-3">
                                ${category.questions.map(q => this.getQuestionHtml(q)).join('')}
                            </div>
                        </section>
                    `;
                }).join('');
                faqList.innerHTML = categoriesHtml;
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
                searchStatus.innerHTML = '';
                return;
            }
            const count = (data.categories || []).reduce(
                (acc, cat) => acc + (cat.questions || []).length,
                0
            );
            const safeTerm = escapeHtml(searchTerm);
            searchStatus.className = 'faq-search-status';
            searchStatus.classList.toggle('hidden', false);
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
            const searchTerm = this.state.searchTerm.trim();
            const questionHtml = highlightText(question.question || '', searchTerm);
            const answerHtml = highlightText(question.answer || '', searchTerm).replace(/\n/g, '<br>');
            return `
                <div class="faq-item ${isOpen ? 'is-open' : ''} ${isFeatured ? 'is-featured' : ''}" data-id="${safeId}">
                    <button class="faq-question" type="button" aria-expanded="${isOpen ? 'true' : 'false'}" aria-controls="${answerId}">
                        <span class="faq-question-label">
                            <span class="faq-q-mark" aria-hidden="true">Q</span>
                            <span>${questionHtml}</span>
                        </span>
                        <span class="material-icons faq-icon" aria-hidden="true">expand_more</span>
                    </button>
                    <div class="faq-answer" id="${answerId}" role="region">
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
                if (answer) answer.style.removeProperty('--faq-answer-height');
            });

            if (!wasOpen) {
                clickedFaqItem.classList.add('is-open');
                questionElement.setAttribute('aria-expanded', 'true');
                this.state.activeQuestionId = clickedFaqItem.dataset.id || null;
                const answer = clickedFaqItem.querySelector('.faq-answer');
                if (answer) {
                    // 動的高さ計算（max-height 固定値の代わり）
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

            // 検索結果ステータスのクリアボタン
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

        handleSearch() {
            this.state.searchTerm = this.elements.searchBox.value;
            this.elements.clearSearchBtn.classList.toggle('hidden', !this.state.searchTerm);
            this.state.activeQuestionId = null;
            this.renderUI();
        },

        clearSearch() {
            this.elements.searchBox.value = '';
            this.state.searchTerm = '';
            this.elements.clearSearchBtn.classList.add('hidden');
            this.state.activeQuestionId = null;
            this.renderUI();
            this.elements.searchBox.focus();
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
            const { faqContainer, searchBox, clearSearchBtn, resetSearchBtn, popularKeywordsWrapper, searchStatus } = this.elements;

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

            let searchTimeout;
            searchBox.addEventListener('input', () => {
                if (this.state.isComposing) return; // IME 確定前はスキップ
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
        },

        async init() {
            this.loadFeedbackStatus();
            this.addEventListeners();
            await this.fetchFaqData();
        }
    };

    faqApp.init();
});
