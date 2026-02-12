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
        const pageHeader = document.querySelector('.hero-bg'); // ページ上部のヘッダー全体
        const mainContentArea = document.querySelector('.max-w-5xl.mx-auto.py-8.px-4.-mt-8'); // 主要コンテンツエリア

        // 「今すぐ申し込む」ボタンの表示制御
        if (signupButton) {
            if (currentScenarioConfig.is_premium_member) {
                // 既存プレミアム会員の場合
                signupButton.href = 'index.html'; // ダッシュボードへのリンクに変更
                signupButton.innerHTML = `
                    ダッシュボードへ戻る
                    <span class="block text-xs font-normal opacity-80 mt-1">契約内容を確認</span>
                `;
                // 「既にプレミアム会員です」というメッセージを表示し、料金セクションなどを非表示にする
                if (pageHeader) {
                    pageHeader.innerHTML = `
                        <div class="max-w-4xl mx-auto px-6 py-12 md:py-16 text-center">
                            <span class="inline-block py-1 px-3 rounded-full bg-blue-700 bg-opacity-50 border border-blue-400 text-xs font-semibold tracking-wider mb-4">
                                PREMIUM PLAN
                            </span>
                            <h1 class="text-3xl md:text-4xl font-bold mb-4">
                                プレミアムプランにご登録済みです
                            </h1>
                            <p class="text-gray-200 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                                いつもご利用ありがとうございます。<br>
                                現在プレミアムプランをご契約中です。
                            </p>
                        </div>
                    `;
                }
                if (mainContentArea) {
                    mainContentArea.innerHTML = `
                        <div class="bg-white shadow-xl rounded-lg overflow-hidden border border-gray-100 p-10 text-center">
                            <p class="text-lg text-gray-800 mb-6">
                                お客様は既にプレミアムプランにご登録済みです。<br>
                                ダッシュボードより引き続きサービスをご利用ください。
                            </p>
                            <a href="index.html" class="inline-block bg-blue-900 hover:bg-blue-800 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition duration-200">
                                ダッシュボードへ
                            </a>
                            <p class="text-sm text-gray-600 mt-6">
                                解約をお考えの方はこちら 
                                <a href="premium_cancel.html" class="text-blue-600 hover:text-blue-800 underline">解約手続きへ</a>
                            </p>
                        </div>
                    `;
                }


            } else {
                // その他のシナリオ (新規、再加入)
                signupButton.href = 'premium_registration_spa.html'; // 通常の登録SPAページへのリンク
                signupButton.innerHTML = `
                    今すぐ申し込む
                    <span class="block text-xs font-normal opacity-80 mt-1">最短1分で登録完了</span>
                `;
                const firstMonthFreeMessage = document.getElementById('first-month-free-message');
                if (firstMonthFreeMessage) {
                    if (currentScenarioConfig.is_rejoining_user) {
                        firstMonthFreeMessage.classList.add('hidden');
                    } else {
                        firstMonthFreeMessage.classList.remove('hidden');
                    }
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
            ...window.dummyUserData, // 既存のheader用dummyUserDataを維持しつつ
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
    // Note: The "サポート" link now directly navigates to bug-report.html.
    // The following JavaScript code for opening the contact modal is no longer needed
    // for the "サポート" link, but the modal itself and its closing logic might still be used
    // if other parts of the application open it.
    // For now, we will comment out the code that opens the modal via the "サポート" link.
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

    // if (openSupportModalLink) { // このブロックをコメントアウト
    //     console.log('Adding click listener to openSupportModalLink');
    //     openSupportModalLink.addEventListener('click', (event) => {
    //         event.preventDefault(); // デフォルトのリンク動作を防ぐ
    //         openContactModal();
    //     });
    // } else {
    //     console.log('openSupportModalLink not found');
    // }

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
    const heroCampaignMsg = document.getElementById('hero-campaign-msg');
    const campaignInfoSection = document.getElementById('campaign-info-section');

    // Simulate User Status (Change this to true/false to test)
    const isEligibleForFreeCampaign = true; // 仮：対象ユーザー

    if (heroCampaignMsg && campaignInfoSection) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const lastDayOfMonth = new Date(currentYear, currentMonth, 0).getDate();

        if (isEligibleForFreeCampaign) {
            // Eligible Message
            const messageHero = `<span class="material-icons text-sm align-text-bottom mr-1">event_available</span> 今なら <span class="font-bold text-amber-300 text-lg mx-1">${currentMonth}月${lastDayOfMonth}日</span> まで無料！`;

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
                                    <div class="text-gray-700 font-bold text-xl mb-1">¥50,000</div>
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

            heroCampaignMsg.innerHTML = messageHero;
            heroCampaignMsg.classList.remove('hidden');

            campaignInfoSection.innerHTML = messageCampaign;
            campaignInfoSection.classList.remove('hidden');

        } else {
            // Not Eligible Message - Simple Info
            const messageCampaign = `
                <div class="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center shadow-sm">
                   <h2 class="text-lg font-bold text-gray-700 mb-2">通常プランのご案内</h2>
                   <p class="text-sm text-gray-600">
                        お客様は過去に無料体験を利用されているため、<br>
                        登録完了日より月額料金が発生いたします。
                   </p>
                </div>
            `;
            campaignInfoSection.innerHTML = messageCampaign;
            campaignInfoSection.classList.remove('hidden');
        }
    }
});