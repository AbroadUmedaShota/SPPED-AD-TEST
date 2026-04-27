document.addEventListener('DOMContentLoaded', () => {
    // --- Simulation Scenario Switcher UI Toggle Logic ---
    const scenarioSwitcherButton = document.getElementById('scenario-switcher-button');
    const scenarioSwitcherMenu = document.getElementById('scenario-switcher-menu');

    if (scenarioSwitcherButton && scenarioSwitcherMenu) {
        scenarioSwitcherButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent document click from immediately closing it
            scenarioSwitcherMenu.classList.toggle('hidden');
            scenarioSwitcherButton.setAttribute('aria-expanded', String(!scenarioSwitcherMenu.classList.contains('hidden')));
        });

        // Click outside to close the menu
        document.addEventListener('click', (event) => {
            if (!scenarioSwitcherMenu.contains(event.target) && !scenarioSwitcherButton.contains(event.target)) {
                scenarioSwitcherMenu.classList.add('hidden');
                scenarioSwitcherButton.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // --- Simulation Scenario Switcher Logic ---
    const scenarioButtons = document.querySelectorAll('.scenario-button');
    const applyButton = document.getElementById('apply-scenario-button'); // Applyボタンを追加するなら

    // Define base dummy user data
    // premium_signup_new.htmlのwindow.dummyUserDataはheader用なので、シミュレーション用は別で管理
    const simulationBaseUserData = {
        email: 'user@example.com',
        companyName: '株式会社サンプル',
        lastName: '山田', // lastNameを姓のみに
        firstName: '太郎', // firstNameを追加
        phone: '09012345678',
        zip: '1060032',
        address: '東京都港区六本木1-2-3',
        building: '六本木ヒルズ 33F',
        departmentName: '開発部',
        positionName: 'マネージャー',
        is_premium_member: false,
        is_rejoining_user: false
    };

    // Scenario data configurations
    const scenarioConfigs = {
        'new-full-info': {
            ...simulationBaseUserData,
        },
        'new-partial-info': {
            ...simulationBaseUserData,
            phone: '', // 必須だが欠けている
            zip: '',   // 必須だが欠けている
            address: '', // 必須だが欠けている
        },
        'new-no-info': {
            email: 'user@example.com',
            companyName: '',
            lastName: '',
            firstName: '',
            phone: '',
            zip: '',
            address: '',
            building: '',
            departmentName: '',
            positionName: '',
            is_premium_member: false,
            is_rejoining_user: false
        },
        'rejoin-user': {
            ...simulationBaseUserData,
            is_rejoining_user: true,
            // 再加入特有のデータがあればここに追加
        },
        'premium-member': {
            ...simulationBaseUserData,
            is_premium_member: true,
            // 既にプレミアム会員なので、登録済みであることを示す
        },
        'premium-free-trial': {
            ...simulationBaseUserData,
            is_premium_member: false, // システム的にはまだ課金会員ではない扱い（あるいはフラグ管理による）
            is_free_trial: true,      // 表示制御用フラグ
        },
        'premium-cancelled': {
            ...simulationBaseUserData,
            is_premium_member: true,
            is_cancelled: true,       // 解約予約中フラグ
        }
    };

    // Function to apply a scenario and store it in localStorage
    const applyScenario = (scenarioKey) => {
        const config = scenarioConfigs[scenarioKey];
        if (config) {
            localStorage.setItem('currentScenario', scenarioKey);
            localStorage.setItem('simulationUserData', JSON.stringify(config)); // userDataオブジェクト全体を保存
        }
    };

    // Function to update the UI based on the current scenario
    const updateUiForScenario = (currentScenarioConfig) => {
        const signupButtons = Array.from(document.querySelectorAll('[data-role="primary-signup-cta"]'));
        const updateSignupButtons = (label) => {
            signupButtons.forEach(button => {
                button.href = 'premium_registration_spa.html';
                button.innerHTML = `
                    <span>${label}</span>
                    <span class="material-icons text-base" aria-hidden="true">arrow_forward</span>
                `;
            });
        };

        // --- 1. Hero Section & Main Content Replacement (For Premium & Free Trial) ---
        if (currentScenarioConfig.is_premium_member) {
            // Existing Premium Member (Active or Cancelled)
            const fileHeroSection = document.getElementById('premium-hero-section');
            if (fileHeroSection) {
                fileHeroSection.className = 'relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-sm';
                // Calculate Dynamic Date (End of Current Month)
                const today = new Date();
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                const dateStr = `${endOfMonth.getFullYear()}年${endOfMonth.getMonth() + 1}月${endOfMonth.getDate()}日`;

                // Status configuration based on cancellation state
                let statusBadgeHtml = '';
                let renewalLabel = '次回更新予定日';
                let alertHtml = ''; // For cancelled state
                let heroBgClass = 'border-white/20'; // Default border

                if (currentScenarioConfig.is_cancelled) {
                    // Cancelled State
                    statusBadgeHtml = `
                        <div class="inline-flex items-center gap-2 py-2 px-5 rounded-full bg-gray-600/50 backdrop-blur-sm border border-gray-400 text-gray-200 text-sm font-bold tracking-wider mb-6">
                            <span class="material-icons text-gray-300 text-lg">event_busy</span>
                            解約予約中
                        </div>
                    `;
                    renewalLabel = '利用可能期限';
                    heroBgClass = 'border-gray-500/50';
                    alertHtml = `
                        <div class="mt-8 bg-gray-800/50 rounded-lg p-4 border border-gray-600 text-left">
                            <p class="text-gray-200 text-sm flex items-start gap-2">
                                <span class="material-icons text-amber-400 text-lg mt-0.5">warning</span>
                                <span>
                                    現在、次回更新の停止を予約しています。<br>
                                    <span class="font-bold text-white">${dateStr}</span> まではPremium機能をご利用いただけます。継続する場合は自動更新を再開してください。
                                </span>
                            </p>
                        </div>
                    `;
                } else {
                    // Active State
                    statusBadgeHtml = `
                        <div class="inline-flex items-center gap-2 py-2 px-5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm font-bold tracking-wider mb-6">
                            <span class="material-icons text-emerald-400 text-lg">check_circle</span>
                            Status: Active (利用中)
                        </div>
                    `;
                }

                fileHeroSection.classList.remove('overflow-hidden');
                fileHeroSection.innerHTML = `
                    <div class="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-16 text-center">
                         <!-- Status Badge -->
                        ${statusBadgeHtml}

                        <h1 class="text-3xl md:text-5xl font-bold mb-6 leading-tight text-white drop-shadow-md">
                            こんにちは、${currentScenarioConfig.lastName} ${currentScenarioConfig.firstName} 様
                        </h1>
                        
                        <div class="bg-white/10 backdrop-blur-md rounded-2xl p-8 border ${heroBgClass} max-w-3xl mx-auto shadow-2xl">
                            <div class="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-16">
                                <div class="text-left">
                                    <p class="text-blue-200 text-sm font-bold uppercase tracking-wider mb-1">CURRENT PLAN</p>
                                    <div class="flex items-center gap-3">
                                        <span class="material-icons text-amber-400 text-4xl">workspace_premium</span>
                                        <div>
                                            <div class="text-2xl font-bold text-white">Premium Plan</div>
                                            <div class="text-sm text-blue-100">すべての機能が有効です</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="w-px h-16 bg-white/20 hidden md:block"></div>
                                
                                <div class="text-left">
                                    <p class="text-blue-200 text-sm font-bold uppercase tracking-wider mb-1">VALID UNTIL</p>
                                    <div class="flex items-center gap-3">
                                        <span class="material-icons text-blue-300 text-3xl">event_repeat</span>
                                        <div>
                                            <div class="text-2xl font-bold text-white">${dateStr}</div>
                                            <div class="text-sm text-blue-100">${renewalLabel}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mt-8 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                <div class="flex items-center gap-2 text-white/90 text-sm">
                                    <span class="material-icons text-emerald-400 text-sm">check</span>
                                    データ保存期間： <span class="font-bold text-white">最長1年</span>
                                </div>
                                <div class="flex items-center gap-2 text-white/90 text-sm">
                                    <span class="material-icons text-emerald-400 text-sm">check</span>
                                    画像・名刺データDL： <span class="font-bold text-white">可能</span>
                                </div>
                                    <div class="flex items-center gap-2 text-white/90 text-sm">
                                    <span class="material-icons text-emerald-400 text-sm">check</span>
                                    Excelレポート出力： <span class="font-bold text-white">可能</span>
                                </div>
                                    <div class="flex items-center gap-2 text-white/90 text-sm">
                                    <span class="material-icons text-emerald-400 text-sm">check</span>
                                    グラフ表示・CSV活用： <span class="font-bold text-white">利用可能</span>
                                </div>
                            </div>

                            ${alertHtml}
                        </div>
                    </div>
                `;
            }

            // Main Content Replacement for Premium Member
            const fileMainContent = document.getElementById('premium-main-content');
            if (fileMainContent) {
                // Determine Main Actions based on cancellation state
                let mainActionsHtml = '';

                if (currentScenarioConfig.is_cancelled) {
                    mainActionsHtml = `
                        <!-- Invoice Action -->
                        <a href="invoiceList.html" class="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex items-center gap-4">
                            <div class="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                <span class="material-icons text-blue-600 text-2xl">receipt_long</span>
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">請求書を確認する</h3>
                                <p class="text-xs text-gray-500 mt-1">過去の請求書をダウンロード</p>
                            </div>
                            <span class="material-icons text-gray-300 ml-auto group-hover:translate-x-1 transition-transform">chevron_right</span>
                        </a>

                        <!-- Resume Subscription Action (Highlight) -->
                         <a href="#" id="resume-subscription-button" class="group bg-blue-50 p-6 rounded-xl shadow-sm border border-blue-200 hover:bg-blue-100 transition-all duration-300 flex items-center gap-4 relative overflow-hidden">
                            <div class="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                                <span class="material-icons text-white text-2xl">autorenew</span>
                            </div>
                            <div>
                                <h3 class="font-bold text-blue-900 group-hover:text-blue-800 transition-colors">自動更新を再開する</h3>
                                <p class="text-xs text-blue-700 mt-1">解約をキャンセルし、プランを継続</p>
                            </div>
                            <span class="material-icons text-blue-400 ml-auto group-hover:translate-x-1 transition-transform">chevron_right</span>
                        </a>
                    `;
                } else {
                    mainActionsHtml = `
                        <!-- Invoice Action -->
                        <a href="invoiceList.html" class="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex items-center gap-4">
                            <div class="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                <span class="material-icons text-blue-600 text-2xl">receipt_long</span>
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">請求書を確認する</h3>
                                <p class="text-xs text-gray-500 mt-1">過去の請求書をダウンロード</p>
                            </div>
                            <span class="material-icons text-gray-300 ml-auto group-hover:translate-x-1 transition-transform">chevron_right</span>
                        </a>

                        <!-- Cancel Action -->
                        <a href="premium_cancel.html" class="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex items-center gap-4">
                            <div class="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-red-50 transition-colors">
                                <span class="material-icons text-gray-600 text-2xl group-hover:text-red-500 transition-colors">cancel</span>
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-800 group-hover:text-red-600 transition-colors">プランを解約する</h3>
                                <p class="text-xs text-gray-500 mt-1">解約のお手続きはこちら</p>
                            </div>
                            <span class="material-icons text-gray-300 ml-auto group-hover:translate-x-1 transition-transform">chevron_right</span>
                        </a>
                    `;
                }

                fileMainContent.classList.remove('-mt-8');
                fileMainContent.classList.add('mt-8');
                fileMainContent.innerHTML = `
                    <!-- Quick Actions -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                        ${mainActionsHtml}
                    </div>
                    
                    <!-- Support Section -->
                    <div class="bg-gray-50 rounded-xl p-8 border border-gray-100 text-center">
                        <h3 class="font-bold text-gray-700 mb-2">お困りですか？</h3>
                        <p class="text-sm text-gray-500 mb-6">ご不明な点や不具合がございましたら、サポートチームまでお問い合わせください。</p>
                        <a href="bug-report.html" class="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-lg shadow-sm transition duration-200">
                            <span class="material-icons text-gray-500 text-sm">support_agent</span>
                            サポートへ問い合わせ
                        </a>
                    </div>
                `;

            }

        } else if (currentScenarioConfig.is_free_trial) {
            // Free Trial User
            const fileHeroSection = document.getElementById('premium-hero-section');
            if (fileHeroSection) {
                fileHeroSection.className = 'relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-white shadow-sm';
                // Calculate Free Trial End Date (End of current month)
                const today = new Date();
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                const trialEndDateStr = `${endOfMonth.getFullYear()}年${endOfMonth.getMonth() + 1}月${endOfMonth.getDate()} 日`;

                // Calculate First Billing Date (1st of next month)
                const nextMonthFirst = new Date(today.getFullYear(), today.getMonth() + 1, 1);
                const billingStartDateStr = `${nextMonthFirst.getFullYear()}年${nextMonthFirst.getMonth() + 1}月${nextMonthFirst.getDate()} 日`;

                fileHeroSection.classList.remove('overflow-hidden');
                fileHeroSection.innerHTML = `
                    <div class="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-16 text-center">
                            <!-- Status Badge (Free Trial) -->
                        <div class="inline-flex items-center gap-2 py-2 px-5 rounded-full bg-amber-500/20 backdrop-blur-sm border border-amber-400/50 text-amber-300 text-sm font-bold tracking-wider mb-6 animate-pulse-subtle">
                            <span class="material-icons text-amber-300 text-lg">hourglass_top</span>
                            Status: Free Trial (無料期間中)
                        </div>

                        <h1 class="text-3xl md:text-5xl font-bold mb-6 leading-tight text-white drop-shadow-md">
                            こんにちは、${currentScenarioConfig.lastName} ${currentScenarioConfig.firstName} 様
                        </h1>
                        
                        <div class="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-amber-400/30 max-w-3xl mx-auto shadow-2xl relative overflow-hidden">
                            <!-- Ribbon -->
                            <div class="absolute top-0 right-0 -mt-2 -mr-2 w-24 h-24 overflow-hidden">
                                <div class="absolute top-0 right-0 bg-amber-500 text-white text-xs font-bold px-8 py-1 transform rotate-45 translate-x-4 translate-y-6 shadow-md">
                                    FREE
                                </div>
                            </div>

                            <div class="flex flex-col md:flex-row items-center justify-center gap-12 md:gap-16">
                                <div class="text-left">
                                    <p class="text-amber-200 text-sm font-bold uppercase tracking-wider mb-1">CURRENT PLAN</p>
                                    <div class="flex items-center gap-3">
                                        <span class="material-icons text-white text-4xl">workspace_premium</span>
                                        <div>
                                            <div class="text-2xl font-bold text-white">Premium Plan</div>
                                            <div class="text-sm text-amber-100">お試し期間中</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="w-px h-16 bg-white/20 hidden md:block"></div>
                                
                                <div class="text-left">
                                    <p class="text-amber-200 text-sm font-bold uppercase tracking-wider mb-1">BILLING STARTS</p>
                                    <div class="flex items-center gap-3">
                                        <span class="material-icons text-amber-300 text-3xl">event_upcoming</span>
                                        <div>
                                            <div class="text-2xl font-bold text-white">${billingStartDateStr}</div>
                                            <div class="text-sm text-amber-100">初回ご請求予定日</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mt-8 bg-amber-500/20 rounded-lg p-4 border border-amber-400/30">
                                <p class="text-white text-sm">
                                    <span class="font-bold text-amber-300">${trialEndDateStr}</span> まで無料でご利用いただけます。<br>
                                    期間中に解約すれば料金は一切かかりません。
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }

            // Main Content Replacement for Free Trial
            const fileMainContent = document.getElementById('premium-main-content');
            if (fileMainContent) {
                fileMainContent.classList.remove('-mt-8');
                fileMainContent.classList.add('mt-8');
                fileMainContent.innerHTML = `
                    <!-- Quick Actions -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                        <!-- Invoice Action (Likely empty for trial but keeps layout consistent) -->
                        <a href="invoiceList.html" class="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex items-center gap-4">
                            <div class="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                <span class="material-icons text-blue-600 text-2xl">receipt_long</span>
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-800 group-hover:text-blue-700 transition-colors">請求書を確認する</h3>
                                <p class="text-xs text-gray-500 mt-1">現在は請求書はありません</p>
                            </div>
                            <span class="material-icons text-gray-300 ml-auto group-hover:translate-x-1 transition-transform">chevron_right</span>
                        </a>

                        <!-- Cancel Action -->
                        <a href="premium_cancel.html" class="group bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 flex items-center gap-4">
                            <div class="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-red-50 transition-colors">
                                <span class="material-icons text-gray-600 text-2xl group-hover:text-red-500 transition-colors">cancel</span>
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-800 group-hover:text-red-600 transition-colors">無料トライアルを終了する</h3>
                                <p class="text-xs text-gray-500 mt-1">解約のお手続きはこちら</p>
                            </div>
                            <span class="material-icons text-gray-300 ml-auto group-hover:translate-x-1 transition-transform">chevron_right</span>
                        </a>
                    </div>
                    
                    <!-- Support Section -->
                    <div class="bg-gray-50 rounded-xl p-8 border border-gray-100 text-center">
                        <h3 class="font-bold text-gray-700 mb-2">お困りですか？</h3>
                        <p class="text-sm text-gray-500 mb-6">ご不明な点や不具合がございましたら、サポートチームまでお問い合わせください。</p>
                        <a href="bug-report.html" class="inline-flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-6 rounded-lg shadow-sm transition duration-200">
                            <span class="material-icons text-gray-500 text-sm">support_agent</span>
                            サポートへ問い合わせ
                        </a>
                    </div>
                `;
            }

        } else {
            // --- 2. Button & Campaign Logic (For New / Rejoin Users) ---
            // Only run this if we are NOT in a premium/trial scenario (i.e. we are in default mode)

            // 再加入者向けUI変更
            if (currentScenarioConfig.is_rejoining_user) {
                // ヒーローセクションの変更
                const heroTitle = document.querySelector('#premium-hero-section h1');
                if (heroTitle) {
                    heroTitle.innerHTML = 'おかえりなさい!<br class="hidden sm:inline">再びご利用ありがとうございます!';
                }

                const heroBadge = document.querySelector('#premium-hero-section .inline-flex');
                if (heroBadge) {
                    heroBadge.innerHTML = `
                        <span class="material-icons text-white text-xl animate-pulse">favorite</span>
                        WELCOME BACK
                    `;
                }

                // サブメッセージの追加
                const heroContent = document.querySelector('#premium-hero-section .relative.z-10');
                if (heroContent && !document.getElementById('rejoin-message')) {
                    const rejoinMessage = document.createElement('p');
                    rejoinMessage.id = 'rejoin-message';
                    rejoinMessage.className = 'text-blue-50 text-lg mb-8 max-w-2xl mx-auto text-center';
                    rejoinMessage.textContent = '引き続き、すべてのプレミアム機能をご利用いただけます。';
                    heroTitle.after(rejoinMessage);
                }

                // CTAボタンの変更
                updateSignupButtons('再加入する');

                // 料金セクションに再加入者向けメッセージを追加
                const pricingSection = document.querySelector('[data-role="pricing-card"]')
                    || document.querySelector('.bg-blue-50.border.border-blue-100');
                if (pricingSection && !document.getElementById('rejoin-billing-notice')) {
                    const billingNotice = document.createElement('div');
                    billingNotice.id = 'rejoin-billing-notice';
                    billingNotice.className = 'mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg';

                    const today = new Date();
                    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    const todayStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
                    const endOfMonthStr = `${endOfMonth.getFullYear()}年${endOfMonth.getMonth() + 1}月${endOfMonth.getDate()}日`;

                    billingNotice.innerHTML = `
                        <p class="text-sm text-amber-800 font-bold mb-2 flex items-center gap-2">
                            <span class="material-icons text-amber-600 text-base">info</span>
                            再加入の課金について
                        </p>
                        <p class="text-xs text-amber-700 leading-relaxed">
                            本日から契約開始となり、<span class="font-bold">当月分の料金(¥10,000)が発生</span>します。<br>
                            契約期間: ${todayStr} 〜 ${endOfMonthStr}
                        </p>
                    `;
                    pricingSection.appendChild(billingNotice);
                }

            } else {
                // 新規ユーザー向けUI (デフォルト)
                updateSignupButtons('今すぐ申し込む');
            }

            // ページ下部のCTAセクションも変更
            const bottomCtaSection = document.querySelector('[data-role="final-cta-section"]');
            if (bottomCtaSection) {
                const bottomCtaTitle = bottomCtaSection.querySelector('h2');
                const bottomCtaButton = bottomCtaSection.querySelector('[data-role="final-signup-cta"]');
                const bottomCtaDescription = bottomCtaSection.querySelector('[data-role="final-cta-description"]');

                if (currentScenarioConfig.is_rejoining_user) {
                    // 再加入者向けに変更
                    if (bottomCtaTitle) {
                        bottomCtaTitle.innerHTML = '展示会後の動きを、<em>もう一度整える。</em>';
                    }
                    if (bottomCtaDescription) {
                        bottomCtaDescription.textContent = 'プレミアム機能で、展示会後の情報整理をもう一度進められます。';
                    }
                    if (bottomCtaButton) {
                        bottomCtaButton.innerHTML = `
                            <span>再加入する</span>
                            <span class="material-icons icon" aria-hidden="true">arrow_forward</span>
                        `;
                    }
                } else {
                    // 新規ユーザー向け(デフォルト)
                    if (bottomCtaTitle) {
                        bottomCtaTitle.innerHTML = '展示会後の動きを、<em>もう止めない。</em>';
                    }
                    if (bottomCtaDescription) {
                        bottomCtaDescription.textContent = '不安な点を確認したうえで、現在のアカウントから申込画面へ進めます。';
                    }
                    if (bottomCtaButton) {
                        bottomCtaButton.innerHTML = `
                            <span>今すぐ申し込む</span>
                            <span class="material-icons icon" aria-hidden="true">arrow_forward</span>
                        `;
                    }
                }
            }

            // 「初月無料」メッセージの表示制御 (既存ロジック維持)
            const firstMonthFreeMessage = document.getElementById('first-month-free-message');
            if (firstMonthFreeMessage) {
                if (currentScenarioConfig.is_rejoining_user || currentScenarioConfig.is_premium_member || currentScenarioConfig.is_free_trial) {
                    firstMonthFreeMessage.classList.add('hidden');
                } else {
                    firstMonthFreeMessage.classList.remove('hidden');
                }
            }
        }
    };

    // --- Initial Scenario Handling on Page Load ---
    const handleInitialScenario = () => {
        const storedScenario = localStorage.getItem('currentScenario');
        let currentScenarioConfig;

        if (storedScenario && scenarioConfigs[storedScenario]) {
            currentScenarioConfig = scenarioConfigs[storedScenario];
        } else {
            // Default to 'new-full-info' if no scenario is stored
            currentScenarioConfig = scenarioConfigs['new-full-info'];
            localStorage.setItem('currentScenario', 'new-full-info'); // Store default
        }

        // updateUiForScenarioに window.dummyUserData の情報を渡す (premium_registration_spa.html用)
        // premium_signup_new.html の window.dummyUserData (ヘッダー用) を更新
        // window.dummyUserData は premium_signup_new.html の header.html で利用されるため、ここで更新
        window.dummyUserData = {
            ...(window.dummyUserData || {}), // Check before access
            ...currentScenarioConfig // シミュレーション情報を追加
        };

        // Update UI based on the current scenario
        updateUiForScenario(currentScenarioConfig);
    };




    // Handle scenario button clicks
    scenarioButtons.forEach(button => {
        button.addEventListener('click', () => {
            const scenarioKey = button.dataset.scenario;
            applyScenario(scenarioKey);
            // シナリオ適用後、premium_signup_new.htmlのUIを更新するためリロード
            location.reload();
        });
    });

    // Run initial scenario handling
    handleInitialScenario();

    const scrollToCurrentHash = () => {
        if (!window.location.hash) return;
        const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
        if (!target) return;
        target.scrollIntoView({ block: 'start' });
    };

    setTimeout(scrollToCurrentHash, 100);
    setTimeout(scrollToCurrentHash, 600);
    window.addEventListener('hashchange', () => {
        setTimeout(scrollToCurrentHash, 100);
    });

    const featureRoot = document.querySelector('[data-role="premium-features"]');
    if (featureRoot) {
        const featurePanel = featureRoot.querySelector('#premium-feature-panel');
        const featureTabs = Array.from(featureRoot.querySelectorAll('.featC-tab'));
        const features = [
            {
                icon: 'inventory_2',
                title: '最長1年データ保存',
                short: '最長1年保存',
                spec: '365 DAYS',
                description: '契約期間中、回答データを最長1年間保管します。展示会直後の確認だけでなく、後続施策や振り返りにも使いやすくなります。',
                scenario: '会期後しばらく経ってから、営業側で回答や名刺情報を再確認したいときに役立ちます。',
                mock: 'storage',
                specs: [
                    ['保存期間', '最長1年'],
                    ['対象', '回答データ'],
                    ['用途', '確認・振り返り'],
                    ['条件', '契約期間中'],
                ],
            },
            {
                icon: 'gesture',
                title: '設問分岐・画像・手書き',
                short: '高度な入力',
                spec: 'ADVANCED',
                description: '設問分岐、画像アップロード、手書き入力に対応します。展示会ブースで集めたい情報に合わせて、回答フォームを組み立てやすくします。',
                scenario: '来場者の回答内容に応じて追加質問を出したい場合や、写真・手書き情報も残したい場合に使えます。',
                mock: 'form',
                specs: [
                    ['設問分岐', '対応'],
                    ['画像', 'アップロード対応'],
                    ['手書き', '入力対応'],
                    ['設定', '設問単位で調整'],
                ],
            },
            {
                icon: 'download',
                title: 'Excel/CSV出力',
                short: 'Excel/CSV出力',
                spec: 'XLSX / CSV',
                description: '整理済みデータをExcel/CSV形式で出力できます。社内共有や集計、レポート作成に使いやすい形で扱えます。',
                scenario: '展示会後に回答データを営業や関係部署へ共有し、次の対応や月次資料へつなげたいときに使えます。',
                mock: 'excel',
                specs: [
                    ['出力形式', 'Excel / CSV'],
                    ['用途', '集計・共有'],
                    ['レポート', '作成に活用'],
                    ['対象', '回答データ'],
                ],
            },
            {
                icon: 'insert_chart',
                title: 'グラフ化・CSV活用',
                short: 'グラフ化・CSV活用',
                spec: 'GRAPH / CSV',
                description: '回答データを一覧化・グラフ化し、展示会後の傾向を視覚的に確認できます。Premiumではグラフ化ページのCSV出力を使い、社内共有や資料作成にも活用できます。',
                scenario: '回答結果をグラフで把握し、CSVにして報告資料や営業共有へつなげたいときに使えます。',
                mock: 'review',
                specs: [
                    ['表示', '一覧・グラフ'],
                    ['出力', 'CSV対応'],
                    ['用途', '資料作成'],
                    ['対象', '回答データ'],
                ],
            },
            {
                icon: 'domain',
                title: '独自ドメイン送信',
                short: '独自ドメイン送信',
                spec: 'DOMAIN',
                description: 'お礼メールなどの送信元を、自社ドメインで整えられます。回答後の連絡を自社ブランドに合わせて見せやすくします。',
                scenario: '展示会後のお礼メールや通知メールを、自社の送信元として整えたい場合に使えます。',
                mock: 'mail',
                specs: [
                    ['送信元', '自社ドメイン'],
                    ['用途', 'お礼メールなど'],
                    ['設定', '申込後に確認'],
                    ['目的', '対外表示の整理'],
                ],
            },
            {
                icon: 'language',
                title: '多言語対応',
                short: '多言語対応',
                spec: 'MULTI LANG',
                description: '作成画面・回答画面の多言語表示に対応します。海外来場者や多言語での案内が必要な展示会でも、回答導線を整えやすくします。',
                scenario: '海外来場者向けに、回答画面や作成画面を多言語で扱いたい場合に使えます。',
                mock: 'lang',
                specs: [
                    ['対象', '作成画面・回答画面'],
                    ['用途', '海外来場者対応'],
                    ['表示', '多言語表示'],
                    ['設定', '画面に応じて確認'],
                ],
            },
        ];

        const mockTemplates = {
            storage: `
                <div class="featC-mock">
                    <div class="featC-mock-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="ttl">storage / events</span></div>
                    <div class="featC-mock-body mock-storage">
                        <div class="row"><span class="name">展示会 2026 Spring</span><span class="badge">ACTIVE</span><span class="date">D-285</span></div>
                        <div class="row"><span class="name">名古屋展示会 Q4</span><span class="badge warn">180日</span><span class="date">D-185</span></div>
                        <div class="row"><span class="name">Osaka EXPO Autumn</span><span class="badge warn">240日</span><span class="date">D-125</span></div>
                        <div class="meter"><i style="width: 34%;"></i></div>
                        <div class="meter-lbl"><span>event data</span><span>365 DAYS MAX</span></div>
                    </div>
                </div>
            `,
            form: `
                <div class="featC-mock">
                    <div class="featC-mock-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="ttl">survey / preview</span></div>
                    <div class="featC-mock-body mock-form">
                        <div class="q"><div class="qlbl">Q1</div><div class="opt"><span class="radio on"></span>業種を選択</div></div>
                        <div class="arrow">branch</div>
                        <div class="q branch"><div class="qlbl">Q2</div><div class="opt"><span class="radio"></span>追加質問を表示</div></div>
                        <div class="q"><div class="qlbl">IMAGE</div><div class="opt"><span class="material-icons text-base" aria-hidden="true">image</span>画像を添付</div></div>
                        <div class="q"><div class="qlbl">HANDWRITE</div><div class="opt"><span class="material-icons text-base" aria-hidden="true">draw</span>手書き入力</div></div>
                    </div>
                </div>
            `,
            excel: `
                <div class="featC-mock">
                    <div class="featC-mock-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="ttl">export / table</span></div>
                    <div class="featC-mock-body mock-excel">
                        <div class="toolbar"><span class="tb-btn primary">XLSX</span><span class="tb-btn">CSV</span></div>
                        <div class="head"><span>#</span><span>Company</span><span>Name</span><span>Status</span></div>
                        <div class="row"><span class="num">01</span><span>Sample Co.</span><span>Tanaka</span><span>新規</span></div>
                        <div class="row alt"><span class="num">02</span><span>Demo Inc.</span><span>Sato</span><span>確認中</span></div>
                        <div class="row"><span class="num">03</span><span>Lead Ltd.</span><span>Suzuki</span><span>共有済</span></div>
                    </div>
                </div>
            `,
            review: `
                <div class="featC-mock">
                    <div class="featC-mock-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="ttl">graph / export</span></div>
                    <div class="featC-mock-body mock-review">
                        <div class="pane chart"><div class="ph">GRAPH</div><div class="body">
                            <div class="bar-row"><span>興味あり</span><i style="width: 82%;"></i><b>82</b></div>
                            <div class="bar-row"><span>資料希望</span><i style="width: 58%;"></i><b>58</b></div>
                            <div class="bar-row"><span>後日連絡</span><i style="width: 36%;"></i><b>36</b></div>
                        </div></div>
                        <div class="pane data"><div class="ph">CSV</div><div class="body">
                            <div class="row"><span class="k">回答項目</span><span class="v">集計</span></div>
                            <div class="row edited"><span class="k">出力形式</span><span class="v">CSV</span></div>
                            <div class="row"><span class="k">用途</span><span class="v">資料化</span></div>
                        </div></div>
                        <div class="ftnote">graph page CSV export</div>
                    </div>
                </div>
            `,
            mail: `
                <div class="featC-mock">
                    <div class="featC-mock-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="ttl">mail / preview</span></div>
                    <div class="featC-mock-body mock-mail">
                        <div class="head">
                            <div class="row"><span class="k">From</span><span class="v">marketing@<span class="domain">your-company.co.jp</span></span></div>
                            <div class="row"><span class="k">To</span><span class="v">visitor@example.com</span></div>
                            <div class="row"><span class="k">Subject</span><span class="v">ご来場ありがとうございました</span></div>
                        </div>
                        <div class="body">
                            <div class="greet">展示会へご来場いただきありがとうございました。</div>
                            <div>回答内容に応じて、担当よりご連絡いたします。</div>
                            <div class="sig">SPEED-AD Premium</div>
                        </div>
                    </div>
                </div>
            `,
            lang: `
                <div class="featC-mock">
                    <div class="featC-mock-bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span><span class="ttl">language / form</span></div>
                    <div class="featC-mock-body mock-lang">
                        <div class="switcher"><span class="l on">JA</span><span class="l">EN</span><span class="l">ZH</span><span class="l">KO</span></div>
                        <div class="form-row"><div class="lbl">QUESTION</div><div class="val">会社名を入力してください</div></div>
                        <div class="form-row"><div class="lbl">QUESTION</div><div class="val">興味のある製品を選択してください</div></div>
                        <div class="form-row"><div class="lbl">GUIDE</div><div class="val">表示言語を切り替えて回答できます</div></div>
                    </div>
                </div>
            `,
        };

        let activeFeatureIndex = 0;
        let featureRotationTimer = null;
        let featureSwitchTimer = null;
        let isFeatureRotationPaused = false;
        let hasManualFeatureSelection = false;
        const featureRotationInterval = 5000;
        const featureTransitionDuration = 180;

        const updateFeatureContent = (index) => {
            const feature = features[index];
            if (!feature || !featurePanel) return;
            activeFeatureIndex = index;
            featureTabs.forEach((tab, tabIndex) => {
                const isActive = tabIndex === index;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', String(isActive));
            });
            featurePanel.innerHTML = `
                <div class="left">
                    <div class="ptag"><span class="num">${String(index + 1).padStart(2, '0')}</span><span>${feature.spec}</span></div>
                    <h3>${feature.title}</h3>
                    <p class="pdesc">${feature.description}</p>
                    <div class="scenario">
                        <span class="ic"><span class="material-icons icon" aria-hidden="true">lightbulb</span></span>
                        <div class="body">
                            <div class="lbl">こんな場面で</div>
                            <div class="txt">${feature.scenario}</div>
                        </div>
                    </div>
                    <div class="specs">
                        ${feature.specs.map(([key, value]) => `<div><div class="k">${key}</div><div class="v">${value}</div></div>`).join('')}
                    </div>
                </div>
                <div class="right">
                    ${mockTemplates[feature.mock]}
                </div>
            `;
        };

        const renderFeature = (index, shouldAnimate = true) => {
            if (!features[index] || !featurePanel) return;
            if (index === activeFeatureIndex && featurePanel.innerHTML.trim()) return;
            if (featureSwitchTimer) {
                clearTimeout(featureSwitchTimer);
                featureSwitchTimer = null;
            }
            if (!shouldAnimate || !featurePanel.innerHTML.trim()) {
                featurePanel.classList.remove('is-switching');
                updateFeatureContent(index);
                return;
            }
            featurePanel.classList.add('is-switching');
            featureSwitchTimer = setTimeout(() => {
                updateFeatureContent(index);
                requestAnimationFrame(() => {
                    featurePanel.classList.remove('is-switching');
                });
            }, featureTransitionDuration);
        };

        const stopFeatureRotation = () => {
            if (featureRotationTimer) {
                clearInterval(featureRotationTimer);
                featureRotationTimer = null;
            }
        };

        const startFeatureRotation = () => {
            stopFeatureRotation();
            if (isFeatureRotationPaused || hasManualFeatureSelection || features.length < 2) return;
            featureRotationTimer = setInterval(() => {
                renderFeature((activeFeatureIndex + 1) % features.length);
            }, featureRotationInterval);
        };

        featureTabs.forEach((tab, index) => {
            tab.addEventListener('click', () => {
                hasManualFeatureSelection = true;
                stopFeatureRotation();
                renderFeature(index);
            });
        });
        featureRoot.addEventListener('mouseenter', () => {
            isFeatureRotationPaused = true;
            stopFeatureRotation();
        });
        featureRoot.addEventListener('mouseleave', () => {
            isFeatureRotationPaused = false;
            startFeatureRotation();
        });
        featureRoot.addEventListener('focusin', () => {
            isFeatureRotationPaused = true;
            stopFeatureRotation();
        });
        featureRoot.addEventListener('focusout', () => {
            if (featureRoot.contains(document.activeElement)) return;
            isFeatureRotationPaused = false;
            startFeatureRotation();
        });
        renderFeature(0, false);
        startFeatureRotation();
    }

    // --- Contact Modal Logic ---
    const openSupportModalLink = document.getElementById('open-support-modal'); // Still get the element in case it's used elsewhere
    const contactModal = document.getElementById('contactModal');
    const closeContactModalBtn = document.getElementById('closeContactModalBtn');
    let activeModal = null;
    let lastFocusedElement = null;

    const getFocusableElements = (modal) => Array.from(modal.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => element.offsetParent !== null || element === document.activeElement);

    const activateModalFocus = (modal, opener = document.activeElement) => {
        activeModal = modal;
        lastFocusedElement = opener instanceof HTMLElement ? opener : null;
        const focusableElements = getFocusableElements(modal);
        const firstFocusableElement = focusableElements[0];
        if (firstFocusableElement) {
            firstFocusableElement.focus();
        } else {
            modal.setAttribute('tabindex', '-1');
            modal.focus();
        }
    };

    const deactivateModalFocus = (modal) => {
        if (activeModal === modal) {
            activeModal = null;
        }
        if (lastFocusedElement && document.contains(lastFocusedElement)) {
            lastFocusedElement.focus();
        }
        lastFocusedElement = null;
    };

    document.addEventListener('keydown', (event) => {
        if (!activeModal) return;

        if (event.key === 'Escape') {
            if (activeModal === contactModal) closeContactModal();
            if (activeModal === resumeModal) closeResumeModal();
            if (activeModal === resumeSuccessModal) closeResumeSuccessModal();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusableElements = getFocusableElements(activeModal);
        if (!focusableElements.length) {
            event.preventDefault();
            return;
        }

        const firstFocusableElement = focusableElements[0];
        const lastFocusableElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === firstFocusableElement) {
            event.preventDefault();
            lastFocusableElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
            event.preventDefault();
            firstFocusableElement.focus();
        }
    });



    function openContactModal() {

        if (contactModal) {

            contactModal.classList.remove('hidden');
            void contactModal.offsetWidth; // Force reflow
            contactModal.classList.add('show');
            contactModal.classList.remove('opacity-0');

            // 必要に応じて、モーダルコンテンツのトランジションクラスも操作
            const modalContent = contactModal.querySelector('.modal-content-transition');
            if (modalContent) {
                modalContent.classList.remove('scale-95');
            }
            activateModalFocus(contactModal);
        } else {

        }
    }

    function closeContactModal() {

        if (contactModal) {
            contactModal.classList.remove('show');
            contactModal.classList.add('opacity-0');
            const modalContent = contactModal.querySelector('.modal-content-transition');
            if (modalContent) {
                modalContent.classList.add('scale-95');
            }
            setTimeout(() => {
                contactModal.classList.add('hidden');
                deactivateModalFocus(contactModal);
            }, 300); // Transition duration
        }
    }

    if (closeContactModalBtn) {

        closeContactModalBtn.addEventListener('click', closeContactModal);
    } else {

    }

    if (openSupportModalLink) {
        openSupportModalLink.addEventListener('click', (event) => {
            event.preventDefault();
            openContactModal();
        });
    }

    // グローバル関数として closeModal を定義（contactModal.htmlのonclick属性用）
    window.closeModal = (modalId) => {

        if (modalId === 'contactModal') {
            closeContactModal();
        }
    };

    // モーダル外クリックで閉じる処理
    if (contactModal) {

        contactModal.addEventListener('click', (event) => {
            if (event.target === contactModal) { // オーバーレイ部分をクリックした場合のみ
                closeContactModal();
            }
        });
    }

    // --- Functional: First Month Free Campaign Logic ---
    const campaignInfoSection = document.getElementById('integrated-campaign-container');

    // Check user status from localStorage (test scenario)
    const storedUserData = localStorage.getItem('simulationUserData');
    const storedScenario = localStorage.getItem('currentScenario');
    let isEligibleForFreeCampaign = true; // デフォルトは新規ユーザー

    if (storedUserData) {
        try {
            const userData = JSON.parse(storedUserData);
            // 再加入ユーザー、既存プレミアム会員、無料トライアル中はキャンペーン対象外
            isEligibleForFreeCampaign = !userData.is_rejoining_user && !userData.is_premium_member && !userData.is_free_trial;
        } catch (e) {
            console.error('Failed to parse user data:', e);
        }
    } else if (storedScenario && scenarioConfigs[storedScenario]) {
        const scenarioData = scenarioConfigs[storedScenario];
        isEligibleForFreeCampaign = !scenarioData.is_rejoining_user && !scenarioData.is_premium_member && !scenarioData.is_free_trial;
    }

    if (campaignInfoSection && isEligibleForFreeCampaign) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();

        // Next Month Calculation
        let nextMonth = currentMonth + 1;
        let nextYear = currentYear;
        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear = nextYear + 1;
        }

        const messageCampaign = `
                    <div class="flex items-start gap-3">
                        <span class="material-icons text-amber-600 text-xl" aria-hidden="true">campaign</span>
                        <div>
                            <p class="text-sm font-bold text-slate-950">初月無料キャンペーン</p>
                            <p class="mt-1 text-sm leading-6 text-slate-700">
                                新規登録の場合、登録月の月額利用料は0円です（${currentMonth}月${lastDayOfMonth}日まで）。翌月以降は月額10,000円（税別）が発生します。
                            </p>
                        </div>
                    </div>
        `;

        campaignInfoSection.innerHTML = messageCampaign;
        campaignInfoSection.classList.remove('hidden');
    }
    // 再加入ユーザー（isEligibleForFreeCampaign = false）の場合は何も表示しない

    // --- FAQ Accordion Logic (2-column grid with animation) ---
    const premiumFaqSection = document.getElementById('premium-faq');

    if (premiumFaqSection) {
        document.addEventListener('click', (event) => {
            const faqLink = event.target instanceof Element ? event.target.closest('a[href="#premium-faq"]') : null;

            if (!faqLink) {
                return;
            }

            event.preventDefault();

            if (!premiumFaqSection.hasAttribute('tabindex')) {
                premiumFaqSection.setAttribute('tabindex', '-1');
            }

            premiumFaqSection.focus({ preventScroll: true });
            premiumFaqSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

            if (window.location.hash !== '#premium-faq') {
                window.history.pushState(null, '', '#premium-faq');
            }
        });
    }

    const faqCards = document.querySelectorAll('.faq-card');

    faqCards.forEach(card => {
        const question = card.querySelector('.faq-question');
        const answer = card.querySelector('.faq-answer');

        if (!question || !answer) {
            return;
        }

        const setFaqState = (isOpen) => {
            question.setAttribute('aria-expanded', String(isOpen));
            answer.classList.toggle('open', isOpen);
            answer.setAttribute('aria-hidden', String(!isOpen));

            if (isOpen) {
                answer.hidden = false;
                answer.style.maxHeight = '0px';
                requestAnimationFrame(() => {
                    answer.style.maxHeight = `${answer.scrollHeight}px`;
                });
                return;
            }

            answer.style.maxHeight = '0px';
        };

        answer.addEventListener('transitionend', (event) => {
            if (event.propertyName === 'max-height' && question.getAttribute('aria-expanded') !== 'true') {
                answer.hidden = true;
            }
        });

        const initialIsOpen = question.getAttribute('aria-expanded') === 'true';
        setFaqState(initialIsOpen);

        if (!initialIsOpen) {
            answer.hidden = true;
        }

        question.addEventListener('click', () => {
            const isOpen = question.getAttribute('aria-expanded') === 'true';
            setFaqState(!isOpen);
        });
    });

    // --- Resume Subscription Modal Logic ---
    const resumeSubscriptionButton = document.getElementById('resume-subscription-button');
    const resumeModal = document.getElementById('resumeModal');
    const resumeModalContent = document.getElementById('resumeModalContent');
    const cancelResumeBtn = document.getElementById('cancelResumeBtn');
    const confirmResumeBtn = document.getElementById('confirmResumeBtn');

    const resumeSuccessModal = document.getElementById('resumeSuccessModal');
    const resumeSuccessModalContent = document.getElementById('resumeSuccessModalContent');
    const closeSuccessModalBtn = document.getElementById('closeSuccessModalBtn');
    const nextRenewalDateSpan = document.getElementById('nextRenewalDate');

    // Open confirmation modal using event delegation (since button is dynamically generated)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#resume-subscription-button')) {
            e.preventDefault();
            openResumeModal();
        }
    });

    function openResumeModal() {
        if (resumeModal) {
            resumeModal.style.display = 'flex';
            setTimeout(() => {
                resumeModal.style.opacity = '1';
                resumeModalContent.style.transform = 'scale(1)';
                activateModalFocus(resumeModal);
            }, 10);
        }
    }

    function closeResumeModal() {
        if (resumeModal) {
            resumeModal.style.opacity = '0';
            resumeModalContent.style.transform = 'scale(0.95)';
            setTimeout(() => {
                resumeModal.style.display = 'none';
                deactivateModalFocus(resumeModal);
            }, 300);
        }
    }

    function openResumeSuccessModal() {
        // Calculate next renewal date (end of current month)
        const today = new Date();
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const dateStr = `${endOfMonth.getFullYear()}年${endOfMonth.getMonth() + 1}月${endOfMonth.getDate()}日`;

        if (nextRenewalDateSpan) {
            nextRenewalDateSpan.textContent = dateStr;
        } else {
            console.error('nextRenewalDateSpan not found!'); // Debug log
        }

        if (resumeSuccessModal) {
            resumeSuccessModal.style.display = 'flex';
            setTimeout(() => {
                resumeSuccessModal.style.opacity = '1';
                resumeSuccessModalContent.style.transform = 'scale(1)';
                activateModalFocus(resumeSuccessModal);
            }, 10);
        } else {
            console.error('resumeSuccessModal not found!'); // Debug log
        }
    }

    function closeResumeSuccessModal() {
        if (resumeSuccessModal) {
            resumeSuccessModal.style.opacity = '0';
            resumeSuccessModalContent.style.transform = 'scale(0.95)';
            setTimeout(() => {
                resumeSuccessModal.style.display = 'none';
                deactivateModalFocus(resumeSuccessModal);

                // Update localStorage to remove cancellation status
                const currentScenario = localStorage.getItem('currentScenario');
                const currentUserData = JSON.parse(localStorage.getItem('simulationUserData') || '{}');

                // Update to active premium member (remove cancellation)
                localStorage.setItem('currentScenario', 'premium-member');
                const newUserData = {
                    ...currentUserData,
                    is_premium_member: true,
                    is_cancelled: false
                };
                localStorage.setItem('simulationUserData', JSON.stringify(newUserData));

                // Reload page to update UI
                location.reload();
            }, 300);
        }
    }

    // Cancel button - close confirmation modal (using event delegation)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#cancelResumeBtn')) {
            closeResumeModal();
        }
    });

    // Confirm button - close confirmation modal and show success modal (using event delegation)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#confirmResumeBtn')) {
            // Here you would normally make an API call to resume the subscription
            // For now, we'll just simulate success

            // Close confirmation modal
            closeResumeModal();

            // Wait a bit, then show success modal
            setTimeout(() => {
                openResumeSuccessModal();
            }, 400);
        }
    });

    // Close success modal button (using event delegation)
    document.addEventListener('click', (e) => {
        if (e.target.closest('#closeSuccessModalBtn')) {
            closeResumeSuccessModal();
        }
    });

    // Close modals when clicking outside
    if (resumeModal) {
        resumeModal.addEventListener('click', (e) => {
            if (e.target === resumeModal) {
                closeResumeModal();
            }
        });
    }

    if (resumeSuccessModal) {
        resumeSuccessModal.addEventListener('click', (e) => {
            if (e.target === resumeSuccessModal) {
                closeResumeSuccessModal();
            }
        });
    }
});
