document.addEventListener('DOMContentLoaded', () => {
    // --- Simulation User Data Loading ---
    let loadedUserData = null;
    const storedSimulationUserData = localStorage.getItem('simulationUserData');
    if (storedSimulationUserData) {
        loadedUserData = JSON.parse(storedSimulationUserData);
    }

    // Default dummy data if not loaded from localStorage
    // This should match simulationBaseUserData in premium_signup_new.js (from premium_signup_new.js)
    if (!loadedUserData) {
        loadedUserData = {
            email: 'user@example.com',
            companyName: '株式会社サンプル',
            lastName: '山田',
            firstName: '太郎',
            phone: '09012345678',
            zip: '1060032',
            address: '東京都港区六本木1-2-3',
            building: '六本木ヒルズ 33F',
            departmentName: '開発部',
            positionName: 'マネージャー',
            is_premium_member: false,
            is_rejoining_user: false
        };
    }
    window.dummyUserData = loadedUserData; // window.dummyUserDataとして設定
    console.log('DOMContentLoaded loaded window.dummyUserData:', window.dummyUserData);

    const stepInput = document.getElementById('step-input');
    const stepConfirm = document.getElementById('step-confirm');
    const stepComplete = document.getElementById('step-complete');

    // Modal Elements
    const accountCheckModal = document.getElementById('account-check-modal'); // accountCheckModalにリネーム
    const accountCheckModalContent = document.getElementById('account-check-content');
    const modalName = document.getElementById('modal-name'); // 氏名全体を表示
    const modalCompany = document.getElementById('modal-company');
    const modalEmail = document.getElementById('modal-email');
    const modalDepartment = document.getElementById('modal-department');
    const modalTitle = document.getElementById('modal-title');
    const modalPhone = document.getElementById('modal-phone');
    const modalZip = document.getElementById('modal-zip');
    const modalAddress = document.getElementById('modal-address');
    const modalBuilding = document.getElementById('modal-building');

    const btnUseInfo = document.getElementById('btn-use-account-info');
    const btnInputManual = document.getElementById('btn-input-manually');

    // Leave Prevention Modal Elements
    const preventLeaveModal = document.getElementById('prevent-leave-modal');
    const preventLeaveConfirmBtn = document.getElementById('prevent-leave-confirm-btn');
    const preventLeaveCancelBtn = document.getElementById('prevent-leave-cancel-btn');


    let currentScreen = 'input'; // 初期画面をinputに設定

    const steps = {
        1: { title: '入力', circle: 'step-circle-1', conn: 'connector-1', el: stepInput },
        2: { title: '確認', circle: 'step-circle-2', conn: 'connector-2', el: stepConfirm },
        3: { title: '完了', circle: 'step-circle-3', conn: null, el: stepComplete }
    };

    // Elements (IDに合わせて修正)
    const inputs = {
        lastName: document.getElementById('lastName'),
        firstName: document.getElementById('firstName'),
        phone: document.getElementById('phone'),
        zip: document.getElementById('zip'),
        address: document.getElementById('address'),
        building: document.getElementById('building'),
        company: document.getElementById('company'),
        department: document.getElementById('department'),
        title: document.getElementById('title')
    };

    // Confirm画面の表示要素 (IDに合わせて修正)
    const confirms = {
        name: document.getElementById('confirm-name'), // 氏名全体を表示
        company: document.getElementById('confirm-company'),
        department: document.getElementById('confirm-department'),
        title: document.getElementById('confirm-title'),
        phone: document.getElementById('confirm-phone'),
        zip: document.getElementById('confirm-zip'),
        address: document.getElementById('confirm-address'),
        building: document.getElementById('confirm-building')
    };

    const btnToConfirm = document.getElementById('btn-to-confirm');
    const btnBackToInput = document.getElementById('btn-back-to-input');
    const btnSubmit = document.getElementById('btn-submit');

    // --- Helper: Update Progress UI ---
    function setProcessStep(stepNum) {
        // Reset all
        document.querySelectorAll('.step-circle').forEach(el => {
            el.classList.remove('active', 'completed');
        });
        document.querySelectorAll('.step-connector').forEach(el => {
            el.classList.remove('active');
        });

        // Set logic
        for (let i = 1; i <= 3; i++) {
            const circle = document.getElementById(`step-circle-${i}`);
            if (i < stepNum) {
                circle.classList.add('completed');
                circle.innerHTML = '<span class="material-icons text-sm">check</span>';
                if (document.getElementById(`connector-${i}`)) {
                    document.getElementById(`connector-${i}`).classList.add('active');
                }
                // Make completed steps clickable
                circle.style.cursor = 'pointer';
                circle.onclick = () => {
                    // Allow going back to input from confirm
                    if (currentScreen === 'confirm' && i === 1) {
                        setProcessStep(1);
                    }
                };
            } else if (i === stepNum) {
                circle.classList.add('active');
                circle.innerText = i; // revert icon if going back
            } else {
                circle.innerText = i;
            }
        }

        // Show/Hide Sections with simple transition
        Object.values(steps).forEach(s => s.el.classList.add('hidden'));
        steps[stepNum].el.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Update currentScreen and hasUnsavedChanges when screen changes
        if (stepNum === 1) { // On input screen
            currentScreen = 'input';
            hasUnsavedChanges = true; // Assume changes are made if back to input
        } else if (stepNum === 2) { // On confirm screen
            currentScreen = 'confirm';
            hasUnsavedChanges = false; // Confirmation screen means data is 'saved' for the moment
        } else if (stepNum === 3) { // On complete screen
            currentScreen = 'complete';
            hasUnsavedChanges = false;
        }
    }


    // --- Helper: Validation ---
    const validationRules = {
        'lastName': {
            validate: (value) => value.trim() !== '',
            message: '氏名（姓）は必須です。',
            required: true,
            maxLength: { value: 25, message: '氏名（姓）は25文字以内で入力してください。' }
        },
        'firstName': {
            validate: (value) => value.trim() !== '',
            message: '氏名（名）は必須です。',
            required: true,
            maxLength: { value: 25, message: '氏名（名）は25文字以内で入力してください。' }
        },
        'company': {
            validate: (value) => value.trim() !== '',
            message: '会社名は必須です。',
            required: true,
            maxLength: { value: 100, message: '会社名は100文字以内で入力してください。' }
        },
        'phone': {
            validate: (value) => /^\d{10,11}$/.test(value),
            message: '電話番号は半角数字10桁または11桁で入力してください。',
            required: true
        },
        'zip': {
            validate: (value) => /^\d{7}$/.test(value),
            message: '郵便番号は半角数字7桁で入力してください。',
            required: true
        },
        'address': {
            validate: (value) => value.trim() !== '',
            message: '住所は必須です。',
            required: true,
            maxLength: { value: 200, message: '住所は200文字以内で入力してください。' }
        },
        'building': {
            maxLength: { value: 100, message: '建物名は100文字以内で入力してください。' }
        },
        'department': {
            maxLength: { value: 50, message: '部署名は50文字以内で入力してください。' }
        },
        'title': {
            maxLength: { value: 50, message: '役職名は50文字以内で入力してください。' }
        }
    };

    const displayError = (inputElement, message) => {
        clearError(inputElement);
        const errorElement = document.createElement('p');
        errorElement.className = 'error-message text-red-500 text-sm mt-1';
        errorElement.textContent = message;
        inputElement.parentNode.insertBefore(errorElement, inputElement.nextSibling);
        inputElement.classList.add('border-red-500');
    };

    const clearError = (inputElement) => {
        const errorElement = inputElement.parentNode.querySelector('.error-message');
        if (errorElement) {
            errorElement.remove();
        }
        inputElement.classList.remove('border-red-500');
    };

    const validateField = (inputElement) => {
        const rule = validationRules[inputElement.id];
        if (!rule) return true;

        const value = inputElement.value;
        let isValid = true;
        let errorMessage = '';

        if (rule.required && !value.trim()) { // .trim() を追加
            isValid = false;
            errorMessage = rule.message; // required時のメッセージもrule.messageを使用
        } else if (value.trim() && rule.validate && !rule.validate(value)) { // value.trim() を追加
            isValid = false;
            errorMessage = rule.message;
        } else if (value.trim() && rule.maxLength && value.length > rule.maxLength.value) { // value.trim() を追加
            isValid = false;
            errorMessage = rule.maxLength.message;
        }

        if (!isValid) {
            displayError(inputElement, errorMessage);
        } else {
            clearError(inputElement);
        }
        return isValid;
    };

    const validateForm = () => {
        let isFormValid = true;
        // inputs オブジェクトの各フィールドをループしてバリデーション
        Object.values(inputs).forEach(input => {
            if (input) { // input要素が存在するか確認
                const isFieldValid = validateField(input);
                if (!isFieldValid) {
                    isFormValid = false;
                }
            }
        });
        return isFormValid;
    };

    // --- Zip Code Search Logic ---
    const btnZipSearch = document.getElementById('btn-zip-search');
    const apiErrorZip = document.getElementById('api-error-zip');

    if (btnZipSearch) {
        btnZipSearch.addEventListener('click', () => {
            const zipCode = inputs.zip.value.replace(/[^\d]/g, ''); // Remove non-digits

            if (zipCode.length !== 7) {
                displayError(inputs.zip, '郵便番号を7桁で入力してください。');
                return;
            }

            // Clear previous errors
            clearError(inputs.zip);
            if (apiErrorZip) apiErrorZip.classList.add('hidden');

            // Loading state
            const originalBtnText = btnZipSearch.textContent;
            btnZipSearch.textContent = '検索中...';
            btnZipSearch.disabled = true;

            fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zipCode}`)
                .then(response => response.json())
                .then(data => {
                    if (data.status === 200 && data.results) {
                        const result = data.results[0];
                        const fullAddress = `${result.address1}${result.address2}${result.address3}`;

                        if (inputs.address) {
                            inputs.address.value = fullAddress;
                            // Trigger validation/clearing error for address
                            validateField(inputs.address);
                        }
                    } else {
                        if (apiErrorZip) {
                            apiErrorZip.textContent = '該当する住所が見つかりませんでした。';
                            apiErrorZip.classList.remove('hidden');
                        }
                    }
                })
                .catch(err => {
                    console.error('Zip code fetch error:', err);
                    if (apiErrorZip) {
                        apiErrorZip.textContent = '住所の取得に失敗しました。';
                        apiErrorZip.classList.remove('hidden');
                    }
                })
                .finally(() => {
                    btnZipSearch.textContent = originalBtnText;
                    btnZipSearch.disabled = false;
                });
        });
    }


    // --- Helper: Populate Confirm Screen ---
    function populateConfirm() {
        confirms.name.textContent = `${inputs.lastName.value} ${inputs.firstName.value}`; // 氏名を結合して表示
        confirms.company.textContent = inputs.company.value;
        confirms.department.textContent = inputs.department.value || '-';
        confirms.title.textContent = inputs.title.value || '-';
        confirms.phone.textContent = inputs.phone.value;
        confirms.zip.textContent = `〒${inputs.zip.value.slice(0, 3)}-${inputs.zip.value.slice(3)}`;
        confirms.address.textContent = inputs.address.value;
        confirms.building.textContent = inputs.building.value || '-';

        const billingStartDateInfo = document.getElementById('billing-start-date-info');
        const storedSimulationUserData = localStorage.getItem('simulationUserData');
        let simulationUserData = {};

        if (storedSimulationUserData) {
            simulationUserData = JSON.parse(storedSimulationUserData);
        }

        let billingMessage = '';
        if (simulationUserData.is_rejoining_user) {
            // 現在の日時と月末を計算
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const date = now.getDate();
            const endOfMonth = new Date(year, month, 0); // Last day of current month
            const endOfMonthFormatted = `${endOfMonth.getFullYear()}年${endOfMonth.getMonth() + 1}月${endOfMonth.getDate()}日`;
            const todayFormatted = `${year}年${month}月${date}日`;

            billingMessage = `
                <p class="font-bold text-red-600 mt-2">※本日から契約開始となり、当月分の料金（満額）が発生します。</p>
                <p class="text-xs mt-1 text-gray-600">契約期間: ${todayFormatted} 〜 ${endOfMonthFormatted}</p>
                <p class="mt-2">プレミアム機能はすぐにご利用いただけます。<br>お支払いは後日発行される請求書にてお願いいたします。</p>
            `;
        } else {
            // 新規ユーザー (初月無料)
            // 現在の月の翌月1日を計算
            const now = new Date();
            const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            const nextMonthFormatted = `${nextMonth.getFullYear()}年${nextMonth.getMonth() + 1}月1日`;

            billingMessage = `
                <p class="font-bold text-green-600 mt-2">※現在のお申し込みは初月無料です！</p>
                <p>実際の課金は<span class="font-bold">${nextMonthFormatted}</span>から開始されます。</p>
                <p>ご入金は課金開始月の月末までにお願いいたします。</p>
            `;
        }

        if (billingStartDateInfo) {
            billingStartDateInfo.innerHTML = billingMessage;
        }
    }

    // --- Modal Logic ---
    // Handle "Use Info" logic
    function handleUseInfo(userData, skipModal = false) {
        // Auto-fill inputs
        if (inputs.lastName) inputs.lastName.value = userData.lastName || '';
        if (inputs.firstName) inputs.firstName.value = userData.firstName || '';
        if (inputs.company) inputs.company.value = userData.companyName || '';
        if (inputs.phone) inputs.phone.value = userData.phone || '';
        if (inputs.zip) inputs.zip.value = userData.zip || '';
        if (inputs.address) inputs.address.value = userData.address || '';
        if (inputs.building) inputs.building.value = userData.building || '';
        if (inputs.department) inputs.department.value = userData.departmentName || '';
        if (inputs.title) inputs.title.value = userData.positionName || '';

        // Hide Modal if not skipped
        if (!skipModal) {
            accountCheckModal.classList.add('opacity-0');
            setTimeout(() => accountCheckModal.classList.add('hidden'), 300);
        }

        // Check if we have ALL required fields to skip to confirmation
        if (validateForm()) { // validate() ではなく validateForm() を使用
            hasUnsavedChanges = true; // 変更があったことを示す
            populateConfirm();
            setProcessStep(2);
        } else {
            // Missing some required fields, go to input (but filled)
            hasUnsavedChanges = true; // 変更があったことを示す
            setProcessStep(1);
        }
    }

    // Expose checkAccountInfo to window for manual testing validation
    window.debugCheckAccountInfo = checkAccountInfo;

    // Handle "Use Info" button click
    if (btnUseInfo) {
        btnUseInfo.addEventListener('click', () => {
            handleUseInfo(window.dummyUserData);
        });
    }

    function checkAccountInfo() {
        console.log('checkAccountInfo started');
        const userData = window.dummyUserData;

        // Modal Elements (ここにも定義が必要)
        const modalName = document.getElementById('modal-name'); // 氏名全体を表示
        const modalCompany = document.getElementById('modal-company');
        const modalEmail = document.getElementById('modal-email');
        const modalDepartment = document.getElementById('modal-department');
        const modalTitle = document.getElementById('modal-title');
        const modalPhone = document.getElementById('modal-phone');
        const modalZip = document.getElementById('modal-zip');
        const modalAddress = document.getElementById('modal-address');
        const modalBuilding = document.getElementById('modal-building');


        // すでにプレミアム会員の場合は完了画面へ
        if (userData.is_premium_member) {
            setProcessStep(3);
            return;
        }



        // 上記条件に合致しない場合は、通常通り確認モーダルを表示
        // Check if we have enough info to prompt (Account Check Modal)
        if (userData && userData.lastName && userData.firstName && userData.companyName) {
            console.log('Condition met, showing modal');
            // Populate modal
            if (modalName) modalName.textContent = `${userData.lastName} ${userData.firstName}`; // 姓名を結合
            if (modalCompany) modalCompany.textContent = userData.companyName;
            if (modalEmail) modalEmail.textContent = userData.email || '-';
            if (modalDepartment) modalDepartment.textContent = userData.departmentName || '-';
            if (modalTitle) modalTitle.textContent = userData.positionName || '-'; // 修正: .title.value -> .textContent
            if (modalPhone) modalPhone.textContent = userData.phone || '-'; // 修正: .phone.value -> .textContent
            if (modalZip) modalZip.textContent = `〒${userData.zip.slice(0, 3)}-${userData.zip.slice(3)}` || '-';
            if (modalAddress) modalAddress.textContent = userData.address || '-';
            if (modalBuilding) modalBuilding.textContent = userData.building || '-';

            // Show Modal
            if (accountCheckModal) {
                console.log('Removing hidden class from modal');
                accountCheckModal.classList.remove('hidden');
                void accountCheckModal.offsetWidth;
                setTimeout(() => {
                    accountCheckModal.classList.remove('opacity-0');
                    accountCheckModalContent.classList.remove('scale-95');
                }, 50);
            } else {
                console.error('Modal element not found!');
            }
        } else {
            console.log('Condition NOT met, skipping modal');
            // Not enough info, just go to input
            setProcessStep(1);
        }
    }
    // Handle "Input Manually"
    if (btnInputManual) {
        btnInputManual.addEventListener('click', () => {
            // Hide Modal
            accountCheckModal.classList.add('opacity-0'); // modal -> accountCheckModal
            setTimeout(() => accountCheckModal.classList.add('hidden'), 300); // modal -> accountCheckModal
            setProcessStep(1);
            hasUnsavedChanges = true; // ここを追加
        });
    }

    // --- Event Listeners ---

    // Go to Confirm
    if (btnToConfirm) {
        btnToConfirm.addEventListener('click', () => {
            if (validateForm()) {
                populateConfirm();
                setProcessStep(2);
            }
        });
    }

    // Back to Input
    if (btnBackToInput) {
        btnBackToInput.addEventListener('click', () => {
            setProcessStep(1);
        });
    }

    // Submit (Complete)
    if (btnSubmit) {
        btnSubmit.addEventListener('click', () => {
            // Simulate API call delay
            const originalText = btnSubmit.textContent;
            btnSubmit.disabled = true;
            btnSubmit.textContent = '登録処理中...';

            setTimeout(() => {
                // Success!
                setProcessStep(3);
            }, 1500);
        });
    }

    // --- Leave Prevention Logic ---
    let hasUnsavedChanges = false;
    let isNavigatingAway = false; // ユーザーが明示的にページを離れることを選択したかどうか
    let isPreventingBack = false; // history.forward() による popstate イベントの連鎖を防ぐためのフラグ

    // フォームの入力変更を監視
    document.getElementById('billing-form').addEventListener('input', () => {
        hasUnsavedChanges = true;
    });

    // ページ離脱を検知 (ブラウザの閉じるボタン、URL直接入力など)
    // beforeunloadイベントはブラウザ標準の警告しか出せないため、カスタムモーダルと共存させるのは難しい。
    // そのため、ここでは何もしないか、あるいは最小限の警告にとどめる。
    // カスタムモーダルは、リンククリックやフォームサブミットのインターセプトで表示する。
    window.addEventListener('beforeunload', (event) => {
        if (hasUnsavedChanges && (currentScreen === 'input' || currentScreen === 'confirm') && !isNavigatingAway) {
            // ブラウザ標準の警告を出す。カスタムモーダルはここでは表示しない。
            event.preventDefault();
            event.returnValue = '';
        }
    });

    // ページ内の全てのリンクをクリックした際に離脱警告を行う
    document.querySelectorAll('a').forEach(link => {
        // javascript: を含むリンクは除外 (例: スクロールto Topなど)
        if (link.href && !link.href.startsWith('javascript:')) {
            link.addEventListener('click', (event) => {
                if (hasUnsavedChanges && (currentScreen === 'input' || currentScreen === 'confirm') && !isNavigatingAway) {
                    event.preventDefault(); // リンク遷移を一時的に停止
                    showPreventLeaveModal();
                    preventLeaveConfirmBtn.dataset.targetUrl = link.href; // 遷移先のURLを保存
                }
            });
        }
    });

    // ブラウザの戻る/進むボタンに対する処理
    window.addEventListener('popstate', (event) => {
        // isPreventingBack が true の場合は、このイベントは history.forward() によるものなので処理しない
        if (isPreventingBack) {
            isPreventingBack = false;
            return;
        }

        if (hasUnsavedChanges && (currentScreen === 'input' || currentScreen === 'confirm') && !isNavigatingAway) {
            // ユーザーが「戻る」ボタンを押した
            showPreventLeaveModal();
            // history.forward() を呼ぶために、popstateイベントリスナーの実行後すぐにhistory.forward()を呼び出す
            // これは非同期で行う必要がある場合があるため、モーダル内のボタンで制御する。
        } else {
            // 変更がない、または離脱が許可されている場合は通常通り遷移
            isNavigatingAway = true;
        }
    });


    // カスタム離脱防止モーダルを表示
    function showPreventLeaveModal() {
        if (preventLeaveModal) {
            preventLeaveModal.classList.remove('hidden');
            void preventLeaveModal.offsetWidth; // Force reflow
            preventLeaveModal.classList.remove('opacity-0');
            preventLeaveModal.classList.add('opacity-100');
        }
    }

    // カスタム離脱防止モーダルを非表示
    function hidePreventLeaveModal() {
        if (preventLeaveModal) {
            preventLeaveModal.classList.add('opacity-0');
            preventLeaveModal.classList.remove('opacity-100');
            setTimeout(() => {
                preventLeaveModal.classList.add('hidden');
                delete preventLeaveConfirmBtn.dataset.targetUrl; // URLをクリア
            }, 300);
        }
    }

    // 「はい、ページを離れる」ボタン
    if (preventLeaveConfirmBtn) {
        preventLeaveConfirmBtn.addEventListener('click', () => {
            hasUnsavedChanges = false;
            isNavigatingAway = true; // 明示的に離脱を許可
            isPreventingBack = false; // popstate イベントで戻された場合、ここでフラグをリセット

            hidePreventLeaveModal();

            // 保存されたURLがあればそこに遷移
            if (preventLeaveConfirmBtn.dataset.targetUrl) {
                window.location.href = preventLeaveConfirmBtn.dataset.targetUrl;
            }
        });
    }

    // 「いいえ、このページに留まる」ボタン
    if (preventLeaveCancelBtn) {
        preventLeaveCancelBtn.addEventListener('click', () => {
            hidePreventLeaveModal();
            isNavigatingAway = false; // 離脱をキャンセル

            // ブラウザの「戻る」ボタンでモーダルが表示された場合、
            // ここで history.forward() を呼び出して元のページに戻す。
            // これにより、ユーザーは入力画面に留まることができる。
            if (hasUnsavedChanges && (currentScreen === 'input' || currentScreen === 'confirm')) {
                isPreventingBack = true; // history.forward() による popstate イベントを処理しないようにする
                history.forward();
            }
        });
    }


    // Run check on load
    console.log('Before checkAccountInfo window.dummyUserData:', window.dummyUserData);
    setTimeout(checkAccountInfo, 100);

});