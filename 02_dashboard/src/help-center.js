document.addEventListener('DOMContentLoaded', () => {
    const helpCenterApp = {
        elements: {
            searchInput: document.querySelector('input[name="query"]'),
            searchForm: document.querySelector('.help-center-hero form'),
            notificationsList: document.getElementById('notifications-list'),
            paginationContainer: document.getElementById('notifications-pagination'),
            featuredCarouselWrapper: document.getElementById('featured-carousel-wrapper'),
        },
        state: {
            notifications: [],
            articles: [],
            currentPage: 1,
            itemsPerPage: 6,
        },

        async init() {
            if (this.elements.searchForm) {
                this.elements.searchForm.addEventListener('submit', this.handleSearchSubmit.bind(this));
            }
            this.addAccordionEventListener();
            await this.loadData();
            this.renderNotifications();
            this.renderPagination();
            this.renderFeaturedCarousel();
            this.initSwiper();
        },

        addAccordionEventListener() {
            if (!this.elements.notificationsList) return;
            this.elements.notificationsList.addEventListener('click', (event) => {
                const button = event.target.closest('.notification-item button');
                if (button) {
                    const item = button.closest('.notification-item');
                    const icon = button.querySelector('.material-icons');
                    
                    item.classList.toggle('is-open');
                    const isOpen = item.classList.contains('is-open');
                    icon.classList.toggle('rotate-180', isOpen);
                }
            });
        },

        async loadData() {
            try {
                const [notificationsRes, articlesRes] = await Promise.all([
                    fetch('../data/notifications.json'),
                    fetch('../data/help_articles.json')
                ]);
                if (!notificationsRes.ok) throw new Error('お知らせデータの読み込みに失敗しました。');
                if (!articlesRes.ok) throw new Error('記事データの読み込みに失敗しました。');
                
                this.state.notifications = await notificationsRes.json();
                const articlesData = await articlesRes.json();
                this.state.articles = articlesData.categories;

            } catch (error) {
                console.error("データの読み込み中にエラーが発生しました:", error);
                if(this.elements.notificationsList) this.elements.notificationsList.innerHTML = `<p class="text-error">${error.message}</p>`;
            }
        },

        handleSearchSubmit(event) {
            event.preventDefault();
            const keyword = this.elements.searchInput.value.trim();
            if (keyword) {
                window.location.href = `help-content.html?search=${encodeURIComponent(keyword)}`;
            }
        },

        renderNotifications() {
            if (!this.elements.notificationsList) return;
            
            const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
            const endIndex = startIndex + this.state.itemsPerPage;
            const paginatedItems = this.state.notifications.slice(startIndex, endIndex);

            this.elements.notificationsList.innerHTML = paginatedItems.map(item => `
                <div class="notification-item border-b border-outline-variant">
                    <button class="w-full text-left p-4 focus:outline-none">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center">
                                <span class="text-sm text-on-surface-variant mr-4">${item.date}</span>
                                <h4 class="font-semibold text-on-surface">${item.title}</h4>
                            </div>
                            <span class="material-icons text-on-surface-variant transition-transform">expand_more</span>
                        </div>
                    </button>
                    <div class="notification-content text-on-surface-variant px-4 pb-4">
                        <p>${item.content}</p>
                    </div>
                </div>
            `).join('');
        },

        renderPagination() {
            if (!this.elements.paginationContainer) return;

            const totalPages = Math.ceil(this.state.notifications.length / this.state.itemsPerPage);
            if (totalPages <= 1) {
                this.elements.paginationContainer.innerHTML = '';
                return;
            }

            let paginationHtml = `
                <button id="prev-page" class="pagination-arrow" ${this.state.currentPage === 1 ? 'disabled' : ''}>
                    <span class="material-icons">chevron_left</span>
                </button>
            `;

            for (let i = 1; i <= totalPages; i++) {
                paginationHtml += `
                    <button class="pagination-number ${i === this.state.currentPage ? 'active' : ''}" data-page="${i}">
                        ${i}
                    </button>
                `;
            }

            paginationHtml += `
                <button id="next-page" class="pagination-arrow" ${this.state.currentPage === totalPages ? 'disabled' : ''}>
                    <span class="material-icons">chevron_right</span>
                </button>
            `;

            this.elements.paginationContainer.innerHTML = paginationHtml;
            this.addPaginationEventListeners();
        },

        addPaginationEventListeners() {
            this.elements.paginationContainer.querySelectorAll('.pagination-number').forEach(button => {
                button.addEventListener('click', (e) => {
                    this.state.currentPage = parseInt(e.currentTarget.dataset.page);
                    this.renderNotifications();
                    this.renderPagination();
                });
            });

            const prevButton = document.getElementById('prev-page');
            if (prevButton) {
                prevButton.addEventListener('click', () => {
                    if (this.state.currentPage > 1) {
                        this.state.currentPage--;
                        this.renderNotifications();
                        this.renderPagination();
                    }
                });
            }

            const nextButton = document.getElementById('next-page');
            if (nextButton) {
                nextButton.addEventListener('click', () => {
                    const totalPages = Math.ceil(this.state.notifications.length / this.state.itemsPerPage);
                    if (this.state.currentPage < totalPages) {
                        this.state.currentPage++;
                        this.renderNotifications();
                        this.renderPagination();
                    }
                });
            }
        },

        renderFeaturedCarousel() {
            if (!this.elements.featuredCarouselWrapper) return;

            const featuredCategoryIds = ['survey', 'account', 'analytics', 'getting-started', 'troubleshooting'];
            const duplicatedCategoryIds = [...featuredCategoryIds, ...featuredCategoryIds]; // ループ再生のためにスライドを複製

            const categoryIcons = {
                survey: 'poll',
                account: 'account_circle',
                analytics: 'analytics',
                'getting-started': 'flag',
                troubleshooting: 'support_agent'
            };

            const slidesHtml = duplicatedCategoryIds.map(id => {
                const category = this.state.articles.find(c => c.id === id);
                if (!category) return '';

                const questionsHtml = category.questions.slice(0, 3).map(q => 
                    `<li><a href="help-content.html?article=${q.id}" class="flex items-center gap-2 text-on-surface-variant hover:text-primary text-sm transition-colors"><span class="material-icons text-base">chevron_right</span>${q.question}</a></li>`
                ).join('');

                return `
                    <div class="swiper-slide h-auto">
                        <div class="highlight-card bg-surface rounded-xl p-8 shadow-lg h-full flex flex-col">
                            <a href="help-content.html?category=${category.id}" class="flex items-center gap-4 mb-4">
                                <span class="material-icons text-3xl text-primary">${categoryIcons[id] || 'help_outline'}</span>
                                <h3 class="text-xl font-semibold text-on-surface">${category.name}</h3>
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

        initSwiper() {
            if (!document.getElementById('featured-carousel')) return;

            new Swiper('#featured-carousel', {
                loop: true,
                slidesPerView: 1,
                spaceBetween: 16,
                autoplay: {
                    delay: 5000,
                    disableOnInteraction: false, // ユーザー操作後も自動再生を継続
                },
                pagination: {
                    el: '.swiper-pagination',
                    clickable: true,
                },
                navigation: {
                    nextEl: '.swiper-button-next',
                    prevEl: '.swiper-button-prev',
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
