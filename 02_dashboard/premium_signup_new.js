document.addEventListener('DOMContentLoaded', () => {
    // --- Simulation Scenario Switcher UI Toggle Logic ---
    const scenarioSwitcherButton = document.getElementById('scenario-switcher-button');
    const scenarioSwitcherMenu = document.getElementById('scenario-switcher-menu');

    if (scenarioSwitcherButton && scenarioSwitcherMenu) {
        scenarioSwitcherButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent document click from immediately closing it
            scenarioSwitcherMenu.classList.toggle('hidden');
        });

        // Click outside to close the menu
        document.addEventListener('click', (event) => {
            if (!scenarioSwitcherMenu.contains(event.target) && !scenarioSwitcherButton.contains(event.target)) {
                scenarioSwitcherMenu.classList.add('hidden');
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
        const signupButtonContainer = document.querySelector('.bg-blue-50 .flex-shrink-0');
        const signupButton = signupButtonContainer ? signupButtonContainer.querySelector('a') : null;

        // --- 1. Hero Section & Main Content Replacement (For Premium & Free Trial) ---
        if (currentScenarioConfig.is_premium_member) {
            // Existing Premium Member (Active or Cancelled)
            const fileHeroSection = document.getElementById('premium-hero-section');
            if (fileHeroSection) {
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
                            Status: Auto-Renewal Off (自動更新停止中)
                        </div>
                    `;
                    renewalLabel = '利用期限 (自動更新停止中)';
                    heroBgClass = 'border-gray-500/50';
                    alertHtml = `
                        <div class="mt-8 bg-gray-800/50 rounded-lg p-4 border border-gray-600 text-left">
                            <p class="text-gray-200 text-sm flex items-start gap-2">
                                <span class="material-icons text-amber-400 text-lg mt-0.5">warning</span>
                                <span>
                                    現在、解約手続きが完了しています。<br>
                                    <span class="font-bold text-white">${dateStr}</span> までは全機能をご利用いただけますが、翌日以降フリープランへ自動移行されます。
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
                                    データ保存期間： <span class="font-bold text-white">無期限</span>
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
                                    SPEEDレビュー： <span class="font-bold text-white">利用可能</span>
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
                if (signupButton) {
                    signupButton.href = 'premium_registration_spa.html';
                    signupButton.innerHTML = `
                        再加入する
                        <span class="block text-xs font-normal opacity-80 mt-1">
                            以前のアカウント情報を引き継げます
                            <span class="mx-1">|</span>
                            最短1分で完了
                        </span>
                    `;
                }

                // 料金セクションに再加入者向けメッセージを追加
                const pricingSection = document.querySelector('.bg-blue-50.border.border-blue-100');
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
                if (signupButton) {
                    signupButton.href = 'premium_registration_spa.html';
                    signupButton.innerHTML = `
                        今すぐ申し込む
                        <span class="block text-xs font-normal opacity-80 mt-1">
                            クレカ登録不要・請求書払い
                            <span class="mx-1">|</span>
                            最短1分で完了
                        </span>
                    `;
                }
            }

            // ページ下部のCTAセクションも変更
            const bottomCtaSection = document.querySelector('.bg-gradient-to-br.from-blue-600.via-blue-500.to-indigo-600');
            if (bottomCtaSection) {
                const bottomCtaTitle = bottomCtaSection.querySelector('h2');
                const bottomCtaButton = bottomCtaSection.querySelector('a[href="premium_registration_spa.html"]');
                const bottomCtaDescription = bottomCtaSection.querySelector('p.text-blue-50');

                if (currentScenarioConfig.is_rejoining_user) {
                    // 再加入者向けに変更
                    if (bottomCtaTitle) {
                        bottomCtaTitle.innerHTML = 'もう一度、一緒に<br class="hidden sm:inline">業務を効率化しませんか？';
                    }
                    if (bottomCtaDescription) {
                        bottomCtaDescription.textContent = 'プレミアム機能で、再び生産性を最大化しましょう。';
                    }
                    if (bottomCtaButton) {
                        bottomCtaButton.innerHTML = `
                            <span class="flex items-center justify-center gap-2">
                                <span class="text-lg">再加入する</span>
                                <span class="material-icons">arrow_forward</span>
                            </span>
                            <span class="block text-xs font-normal text-blue-500 mt-1">
                                以前のアカウント情報を引き継げます
                                <span class="mx-1">|</span>
                                最短1分で完了
                            </span>
                        `;
                    }
                } else {
                    // 新規ユーザー向け(デフォルト)
                    if (bottomCtaTitle) {
                        bottomCtaTitle.innerHTML = '今すぐプレミアムプランを<br class="hidden sm:inline">始めませんか？';
                    }
                    if (bottomCtaDescription) {
                        bottomCtaDescription.textContent = '業務効率が劇的に向上します。最短1分で登録完了。';
                    }
                    if (bottomCtaButton) {
                        bottomCtaButton.innerHTML = `
                            <span class="flex items-center justify-center gap-2">
                                <span class="text-lg">今すぐ申し込む</span>
                                <span class="material-icons">arrow_forward</span>
                            </span>
                            <span class="block text-xs font-normal text-blue-500 mt-1">
                                クレカ登録不要・請求書払い
                                <span class="mx-1">|</span>
                                最短1分で完了
                            </span>
                        `;
                    }
                }
            }

            // 「初月無料」メッセージの表示制御 (既存ロジック維持)
            const firstMonthFreeMessage = document.getElementById('first-month-free-message');
            if (firstMonthFreeMessage) {
                if (currentScenarioConfig.is_rejoining_user) {
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

    // --- Contact Modal Logic ---
    const openSupportModalLink = document.getElementById('open-support-modal'); // Still get the element in case it's used elsewhere
    const contactModal = document.getElementById('contactModal');
    const closeContactModalBtn = document.getElementById('closeContactModalBtn');



    function openContactModal() {

        if (contactModal) {

            contactModal.classList.remove('hidden');
            void contactModal.offsetWidth; // Force reflow
            contactModal.classList.remove('opacity-0');

            // 必要に応じて、モーダルコンテンツのトランジションクラスも操作
            const modalContent = contactModal.querySelector('.modal-content-transition');
            if (modalContent) {
                modalContent.classList.remove('scale-95');
            }
        } else {

        }
    }

    function closeContactModal() {

        if (contactModal) {
            contactModal.classList.add('opacity-0');
            const modalContent = contactModal.querySelector('.modal-content-transition');
            if (modalContent) {
                modalContent.classList.add('scale-95');
            }
            setTimeout(() => {
                contactModal.classList.add('hidden');
            }, 300); // Transition duration
        }
    }

    if (closeContactModalBtn) {

        closeContactModalBtn.addEventListener('click', closeContactModal);
    } else {

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

    // Sticky CTA Scroll Logic
    const stickyCta = document.getElementById('sticky-cta');
    const heroSection = document.querySelector('.hero-section');

    if (stickyCta && heroSection) {
        window.addEventListener('scroll', () => {
            const heroBottom = heroSection.getBoundingClientRect().bottom;
            // Show sticky CTA when Hero section is scrolled out of view
            if (heroBottom < 0) {
                stickyCta.classList.remove('translate-y-full');
            } else {
                stickyCta.classList.add('translate-y-full');
            }
        });
    }

    // --- Functional: First Month Free Campaign Logic ---
    const campaignInfoSection = document.getElementById('campaign-info-section');

    // Check user status from localStorage (test scenario)
    const storedUserData = localStorage.getItem('simulationUserData');
    let isEligibleForFreeCampaign = true; // デフォルトは新規ユーザー

    if (storedUserData) {
        try {
            const userData = JSON.parse(storedUserData);
            // 再加入ユーザーまたは既存プレミアム会員の場合はキャンペーン対象外
            isEligibleForFreeCampaign = !userData.is_rejoining_user && !userData.is_premium_member;
        } catch (e) {
            console.error('Failed to parse user data:', e);
        }
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
        <div class="bg-white border-2 border-amber-400 rounded-xl p-6 md:p-8 shadow-sm">
                    <div class="text-center mb-8">
                        <span class="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full mb-2">キャンペーン</span>
                        <h2 class="text-xl md:text-2xl font-bold text-gray-800">
                            登録した月の利用料が<span class="text-amber-500 mx-1">無料</span>になります
                        </h2>
                        <p class="text-gray-500 text-sm mt-2">
                            月初めでも、月末でも、その月の末日まで料金はかかりません。
                        </p>
                    </div>

                    <!-- Visual Timeline -->
                    <div class="flex flex-col md:flex-row items-stretch justify-center max-w-2xl mx-auto space-y-2 md:space-y-0 md:space-x-1">
                        <!-- Month 1 (Free) -->
                        <div class="flex-1 flex flex-col">
                            <div class="bg-amber-400 text-white text-center py-2 font-bold rounded-t-lg md:rounded-tr-none md:rounded-l-lg relative overflow-hidden">
                                <span class="relative z-10">${currentMonth}月 (登録月)</span>
                                <div class="absolute inset-0 bg-white/20 transform -skew-x-12 translate-x-1/2"></div>
                            </div>
                            <div class="bg-amber-50 border-x border-b border-amber-200 p-6 flex-1 flex items-center justify-center text-center rounded-b-lg md:rounded-bl-none md:rounded-br-none md:rounded-bl-lg">
                                <div>
                                    <div class="text-amber-600 font-bold text-xl mb-1">¥0</div>
                                    <div class="text-xs text-amber-700 font-bold bg-amber-200/50 px-2 py-1 rounded">無料期間</div>
                                    <div class="text-[10px] text-amber-600 mt-1">
                                        (登録日 〜 ${currentMonth}/${lastDayOfMonth})
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Arrow (Desktop only) -->
                        <div class="hidden md:flex items-center justify-center text-gray-300 z-10 -mx-3">
                            <span class="material-icons text-4xl">arrow_forward</span>
                        </div>

                        <!-- Month 2 (Paid) -->
                        <div class="flex-1 flex flex-col">
                            <div class="bg-gray-600 text-white text-center py-2 font-bold rounded-t-lg md:rounded-tl-none md:rounded-r-lg">
                                ${nextMonth}月 (翌月)
                            </div>
                            <div class="bg-gray-50 border-x border-b border-gray-200 p-6 flex-1 flex items-center justify-center text-center rounded-b-lg md:rounded-br-lg">
                                <div>
                                    <div class="text-gray-700 font-bold text-xl mb-1">¥10,000</div>
                                    <div class="text-xs text-gray-500">通常料金</div>
                                    <div class="text-[10px] text-gray-400 mt-1">
                                        (1日 〜 末日)
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="mt-8 text-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <p class="text-sm font-medium text-gray-700">
                            現在のご登録なら、<span class="font-bold text-amber-600 text-lg">${currentMonth}月${lastDayOfMonth}日</span>まで無料で全機能をお試しいただけます。<br>
                            <span class="text-xs text-gray-500 font-normal">※ 無料期間中に解約すれば、料金は一切かかりません。</span>
                        </p>
                    </div>
                </div>
        `;

        campaignInfoSection.innerHTML = messageCampaign;
        campaignInfoSection.classList.remove('hidden');
    }
    // 再加入ユーザー（isEligibleForFreeCampaign = false）の場合は何も表示しない

    // --- FAQ Accordion Logic (2-column grid with animation) ---
    const faqCards = document.querySelectorAll('.faq-card');

    faqCards.forEach(card => {
        const question = card.querySelector('.faq-question');
        const answer = card.querySelector('.faq-answer');

        question.addEventListener('click', () => {
            const isOpen = question.getAttribute('aria-expanded') === 'true';

            if (isOpen) {
                // Close
                answer.classList.remove('open');
                question.setAttribute('aria-expanded', 'false');
            } else {
                // Open
                answer.classList.add('open');
                question.setAttribute('aria-expanded', 'true');
            }
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
            }, 10);
        }
    }

    function closeResumeModal() {
        if (resumeModal) {
            resumeModal.style.opacity = '0';
            resumeModalContent.style.transform = 'scale(0.95)';
            setTimeout(() => {
                resumeModal.style.display = 'none';
            }, 300);
        }
    }

    function openResumeSuccessModal() {
        console.log('openResumeSuccessModal called!'); // Debug log
        console.log('resumeSuccessModal:', resumeSuccessModal); // Debug log
        console.log('resumeSuccessModalContent:', resumeSuccessModalContent); // Debug log
        console.log('nextRenewalDateSpan:', nextRenewalDateSpan); // Debug log

        // Calculate next renewal date (end of current month)
        const today = new Date();
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const dateStr = `${endOfMonth.getFullYear()}年${endOfMonth.getMonth() + 1}月${endOfMonth.getDate()}日`;

        if (nextRenewalDateSpan) {
            nextRenewalDateSpan.textContent = dateStr;
            console.log('Set next renewal date to:', dateStr); // Debug log
        } else {
            console.error('nextRenewalDateSpan not found!'); // Debug log
        }

        if (resumeSuccessModal) {
            console.log('Setting display to flex...'); // Debug log
            resumeSuccessModal.style.display = 'flex';
            setTimeout(() => {
                console.log('Setting opacity to 1...'); // Debug log
                resumeSuccessModal.style.opacity = '1';
                resumeSuccessModalContent.style.transform = 'scale(1)';
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
            console.log('Confirm button clicked!'); // Debug log
            // Here you would normally make an API call to resume the subscription
            // For now, we'll just simulate success

            // Close confirmation modal
            closeResumeModal();

            // Wait a bit, then show success modal
            setTimeout(() => {
                console.log('Opening success modal...'); // Debug log
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