// premium_signup.js

document.addEventListener('DOMContentLoaded', () => {
    console.log('premium_signup.js loaded, handling page-specific logic.');

    // --- 料金シミュレーター ---
    const cardAmountInput = document.getElementById('card-amount-input');
    const priceDisplay = document.getElementById('estimated-price-display');

    if (cardAmountInput && priceDisplay) {
        cardAmountInput.addEventListener('input', () => {
            const monthlyCards = parseInt(cardAmountInput.value, 10);

            if (!isNaN(monthlyCards) && monthlyCards >= 0) {
                // 仮の料金計算ロジック
                const basePrice = 9800; // 基本料金
                const freeTier = 500;   // 無料枠
                const pricePerCard = 20;  // 超過単価

                let estimatedPrice = basePrice;
                if (monthlyCards > freeTier) {
                    estimatedPrice += (monthlyCards - freeTier) * pricePerCard;
                }

                priceDisplay.innerHTML = `<p>概算料金: <strong>月額 ${estimatedPrice.toLocaleString()}円</strong> (税抜)</p>`;
            } else if (cardAmountInput.value === '') {
                priceDisplay.innerHTML = `<p>概算料金: <strong>-</strong></p>`;
            } else {
                priceDisplay.innerHTML = `<p style="color: red;">有効な数値を入力してください</p>`;
            }
        });
    }

    // --- モーダル制御 ---
    // main.jsがモーダルハンドラを初期化するが、このページ固有のトリガーを設定
    const modal = document.getElementById('auth-modal');
    if (modal) {
        const openModalButtons = document.querySelectorAll('.cta-button');

        const openModal = () => modal.classList.add('is-visible');
        const closeModal = () => modal.classList.remove('is-visible');

        openModalButtons.forEach(button => {
            // ページ内リンク(#cta)を持つボタンとモーダル内のボタンはモーダルを開かない
            if (button.getAttribute('href') === '#' && !button.closest('.modal-content')) {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    openModal();
                });
            }
        });

        const closeModalButton = modal.querySelector('.modal-close-button');
        if (closeModalButton) {
            closeModalButton.addEventListener('click', closeModal);
        }

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }


    // --- タブ切り替え制御 ---
    const tabContainer = document.querySelector('.tab-navigation');
    if (tabContainer) {
        const tabButtons = tabContainer.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabContainer.addEventListener('click', (e) => {
            if (e.target && e.target.matches('.tab-button')) {
                const targetTab = e.target.dataset.tab;

                tabButtons.forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.tab === targetTab);
                });

                tabContents.forEach(content => {
                    content.classList.toggle('active', content.id === `${targetTab}-form-tab`);
                });
            }
        });
    }

    // --- スムーズスクロール (ページ内リンク用) は main.js に移譲 ---
    // main.jsがグローバルなイベントリスナーを設定しているため、ここでは不要

    // --- 導入事例カルーセル自動スクロール ---
    const testimonialContainer = document.querySelector('.testimonial-scroll-container');
    if (testimonialContainer) {
        const cards = testimonialContainer.querySelectorAll('.testimonial-card');
        let currentIndex = 0;
        let autoScrollInterval = null;
        let userInteracted = false;

        // 次のカードにスクロールする関数
        const scrollToNextCard = () => {
            if (cards.length === 0) return;

            currentIndex = (currentIndex + 1) % cards.length; // 最後まで行ったら0に戻る
            const targetCard = cards[currentIndex];

            testimonialContainer.scrollTo({
                left: targetCard.offsetLeft - testimonialContainer.offsetLeft,
                behavior: 'smooth'
            });
        };

        // 自動スクロール開始
        const startAutoScroll = () => {
            if (autoScrollInterval) return; // 既に開始している場合は何もしない
            autoScrollInterval = setInterval(scrollToNextCard, 5000); // 5秒ごとに切り替え
        };

        // 自動スクロール停止
        const stopAutoScroll = () => {
            if (autoScrollInterval) {
                clearInterval(autoScrollInterval);
                autoScrollInterval = null;
            }
        };

        // ユーザーが手動でスクロールしたら自動スクロールを一時停止
        testimonialContainer.addEventListener('scroll', () => {
            if (!userInteracted) {
                userInteracted = true;
                stopAutoScroll();

                // 10秒後に自動スクロール再開
                setTimeout(() => {
                    userInteracted = false;
                    startAutoScroll();
                }, 10000);
            }
        });

        // 初回開始
        startAutoScroll();
    }

    // --- 料金プランへのスクロール制御 (画面中央に配置) ---
    const pricingScrollButtons = document.querySelectorAll('.js-scroll-to-pricing');
    const pricingSection = document.getElementById('pricing');

    if (pricingScrollButtons.length > 0 && pricingSection) {
        pricingScrollButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                pricingSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            });
        });
    }
});