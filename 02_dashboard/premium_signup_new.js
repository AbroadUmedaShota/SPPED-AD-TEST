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

    console.log('openSupportModalLink:', openSupportModalLink);
    console.log('contactModal:', contactModal);
    console.log('closeContactModalBtn:', closeContactModalBtn);

    function openContactModal() {
        console.log('openContactModal called');
        if (contactModal) {
            console.log('contactModal is not null. Current classList before removing hidden/opacity-0:', contactModal.classList);
            contactModal.classList.remove('hidden');
            void contactModal.offsetWidth; // Force reflow
            contactModal.classList.remove('opacity-0');
            console.log('contactModal after class changes:', contactModal.className);
            // 必要に応じて、モーダルコンテンツのトランジションクラスも操作
            const modalContent = contactModal.querySelector('.modal-content-transition');
            if (modalContent) {
                modalContent.classList.remove('scale-95');
            }
        } else {
            console.error('contactModal is null in openContactModal!');
        }
    }

    function closeContactModal() {
        console.log('closeContactModal called');
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
        console.log('Adding click listener to closeContactModalBtn');
        closeContactModalBtn.addEventListener('click', closeContactModal);
    } else {
        console.log('closeContactModalBtn not found');
    }
    
    // グローバル関数として closeModal を定義（contactModal.htmlのonclick属性用）
    window.closeModal = (modalId) => {
        console.log('closeModal global function called for:', modalId);
        if (modalId === 'contactModal') {
            closeContactModal();
        }
    };

    // モーダル外クリックで閉じる処理
    if (contactModal) {
        console.log('Adding click listener to contactModal for outside close');
        contactModal.addEventListener('click', (event) => {
            if (event.target === contactModal) { // オーバーレイ部分をクリックした場合のみ
                closeContactModal();
            }
        });
    } else {
        console.log('contactModal element not found for outside close listener');
    }
});