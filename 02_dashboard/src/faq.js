import { resolveDashboardDataPath } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    const faqApp = {
        elements: {
            loadingIndicator: document.getElementById('loading-indicator'),
            errorMessage: document.getElementById('error-message'),
            faqContainer: document.getElementById('faq-container'),
            featuredList: document.getElementById('featured-questions-list'),
            faqList: document.getElementById('faq-list'),
            noResultsMessage: document.getElementById('no-results-message'),
            searchBox: document.getElementById('search-box'),
            clearSearchBtn: document.getElementById('clear-search-btn'),
        },

        state: {
            allData: null,
            isLoading: false,
            error: null,
            searchTerm: '',
            activeQuestionId: null,
            feedbackStatus: {},
        },

        async fetchFaqData() {
            this.state.isLoading = true;
            this.renderUI();
            try {
                const response = await fetch(resolveDashboardDataPath('faq.json'));
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
            if (error) errorMessage.textContent = '情報の読み込みに失敗しました。時間をおいて再度お試しください。';

            const shouldShowFaq = !isLoading && !error && allData;
            faqContainer.classList.toggle('hidden', !shouldShowFaq);

            if (shouldShowFaq) {
                const filteredData = this.getFilteredData();
                this.renderFeaturedQuestions();
                this.renderFaqList(filteredData);
            }
        },

        renderFeaturedQuestions() {
            const allQuestions = this.state.allData.categories.flatMap(cat => cat.questions);
            const featuredHtml = allQuestions
                .filter(q => q.isFeatured)
                .map(q => this.getQuestionHtml(q))
                .join('');
            this.elements.featuredList.innerHTML = featuredHtml;
        },

        renderFaqList(data) {
            const { faqList, noResultsMessage } = this.elements;
            const hasResults = data.categories.some(cat => cat.questions.length > 0);

            if (hasResults) {
                const categoriesHtml = data.categories.map(category => {
                    if (category.questions.length === 0) return '';
                    return `
                        <section id="${category.id}" class="mb-10">
                            <h3 class="text-lg font-bold border-b-2 border-primary pb-2 mb-4">${category.name}</h3>
                            <div class="space-y-4">
                                ${category.questions.map(q => this.getQuestionHtml(q)).join('')}
                            </div>
                        </section>
                    `;
                }).join('');
                faqList.innerHTML = categoriesHtml;
            } 
            faqList.classList.toggle('hidden', !hasResults);
            noResultsMessage.classList.toggle('hidden', hasResults);
        },

        getQuestionHtml(question) {
            const isOpen = this.state.activeQuestionId === question.id;
            return `
                <div class="faq-item ${isOpen ? 'is-open' : ''}" data-id="${question.id}">
                    <button class="faq-question">
                        <span>${question.question}</span>
                        <span class="material-icons faq-icon">expand_more</span>
                    </button>
                    <div class="faq-answer">
                        <p>${question.answer.replace(/\n/g, '<br>')}</p>
                        ${this.getFeedbackHtml(question.id)}
                    </div>
                </div>
            `;
        },

        getFeedbackHtml(questionId) {
            if (this.state.feedbackStatus[questionId]) {
                return `<div class="feedback-section feedback-thanks">ご協力ありがとうございました。</div>`;
            }
            return `
                <div class="feedback-section">
                    <span>この回答は役に立ちましたか？</span>
                    <div class="feedback-buttons mt-2">
                        <button class="feedback-btn" data-vote="useful" data-id="${questionId}">はい</button>
                        <button class="feedback-btn" data-vote="not-useful" data-id="${questionId}">いいえ</button>
                    </div>
                </div>
            `;
        },

        getFilteredData() {
            const { allData, searchTerm } = this.state;
            if (!searchTerm.trim()) {
                return allData;
            }
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            const searchKeywords = lowerCaseSearchTerm.split(/\s+/).filter(Boolean);

            const filteredCategories = allData.categories.map(category => {
                const filteredQuestions = category.questions.filter(question => {
                    const content = `${question.question} ${question.answer}`.toLowerCase();
                    return searchKeywords.every(keyword => content.includes(keyword));
                });
                return { ...category, questions: filteredQuestions };
            });
            return { categories: filteredCategories };
        },

        handleFaqClick(event) {
            const questionElement = event.target.closest('.faq-question');
            if (!questionElement) return;

            const clickedFaqItem = questionElement.closest('.faq-item');
            const wasOpen = clickedFaqItem.classList.contains('is-open');

            // まず、すべてのアイテムを閉じる
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('is-open');
            });

            // もしクリックされたアイテムが元々閉じていたなら、それを開く
            if (!wasOpen) {
                clickedFaqItem.classList.add('is-open');
            }
        },

        handleFeedbackClick(event) {
            const feedbackBtn = event.target.closest('.feedback-btn');
            if (!feedbackBtn || feedbackBtn.disabled) return;

            const { id, vote } = feedbackBtn.dataset;
            
            console.log(`GA Event: { category: 'FAQ', action: 'Feedback', label: '${id} - ${vote}' }`);

            this.state.feedbackStatus[id] = true;
            this.saveFeedbackStatus();

            const feedbackSection = feedbackBtn.closest('.feedback-section');
            if (feedbackSection) {
                feedbackSection.innerHTML = '<div class="feedback-thanks">ご協力ありがとうございました。</div>';
            }
        },

        handleSearch() {
            this.state.searchTerm = this.elements.searchBox.value;
            this.elements.clearSearchBtn.classList.toggle('hidden', !this.state.searchTerm);
            this.renderUI();
        },

        loadFeedbackStatus() {
            try {
                const storedStatus = localStorage.getItem('faqFeedbackStatus');
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
                localStorage.setItem('faqFeedbackStatus', JSON.stringify(this.state.feedbackStatus));
            } catch (e) {
                console.error('フィードバック状態の保存に失敗しました:', e);
            }
        },

        addEventListeners() {
            this.elements.faqContainer.addEventListener('click', (event) => {
                this.handleFaqClick(event);
                this.handleFeedbackClick(event);
            });

            let searchTimeout;
            this.elements.searchBox.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => this.handleSearch(), 300);
            });

            this.elements.clearSearchBtn.addEventListener('click', () => {
                this.elements.searchBox.value = '';
                this.handleSearch();
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
