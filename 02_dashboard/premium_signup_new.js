document.addEventListener('DOMContentLoaded', () => {
    const screens = {
        description: document.getElementById('screen-description'),
        input: document.getElementById('screen-input'),
        confirm: document.getElementById('screen-confirm'),
        complete: document.getElementById('screen-complete'),
    };

    const modals = {
        confirmAccountInfo: document.getElementById('modal-confirm-account-info'),
        premiumFeature: document.getElementById('modal-premium-feature'),
        preventLeave: document.getElementById('modal-prevent-leave'),
    };

    const stepIndicator = document.querySelector('.step-indicator');
    const stepItems = stepIndicator ? Array.from(stepIndicator.querySelectorAll('.step-item')) : [];

    const buttons = {
        gotoInputPremium: document.getElementById('btn-goto-input-premium'),
        gotoConfirm: document.getElementById('btn-goto-confirm'),
        autoAddress: document.getElementById('btn-auto-address'),
        editInput: document.getElementById('btn-edit-input'),
        completeRegistration: document.getElementById('btn-complete-registration'),
        gotoDashboard: document.getElementById('btn-goto-dashboard'),
        // 追加: よくある質問の上のボタン
        gotoInputPremiumFaq: document.getElementById('btn-goto-input-premium-faq'),
        // (Modal buttons remain the same)
    };

    const inputs = {
        fullName: document.getElementById('full-name'),
        telNumber: document.getElementById('tel-number'),
        postalCode: document.getElementById('postal-code'),
        address: document.getElementById('address'),
        buildingName: document.getElementById('building-name'),
        companyName: document.getElementById('company-name'),
        departmentName: document.getElementById('department-name'),
        positionName: document.getElementById('position-name'),
    };

    let currentScreen = 'description';
    let hasUnsavedChanges = false;

    // --- Screen and Modal Functions (remain mostly the same) ---
    const updateStepIndicator = (activeScreenName) => {
        stepItems.forEach(item => {
            item.classList.toggle('active', item.dataset.step === activeScreenName);
        });
    };

    const showScreen = (screenName) => {
        if (screens[currentScreen]) {
            screens[currentScreen].classList.add('hidden');
        }
        screens[screenName].classList.remove('hidden');
        currentScreen = screenName;
        updateStepIndicator(currentScreen);
    };

    // --- NEW: Real-time Validation Logic ---

    const validationRules = {
        'full-name': {
            validate: (value) => value.trim() !== '',
            message: '氏名(姓名)は必須です。',
            maxLength: { value: 50, message: '氏名(姓名)は50文字以内で入力してください。' }
        },
        'tel-number': {
            validate: (value) => /^\d{10,11}$/.test(value),
            message: '電話番号は半角数字10桁または11桁で入力してください。',
            required: { message: '電話番号は必須です。' }
        },
        'postal-code': {
            validate: (value) => /^\d{7}$/.test(value),
            message: '郵便番号は半角数字7桁で入力してください。',
            required: { message: '郵便番号は必須です。' }
        },
        'address': {
            validate: (value) => value.trim() !== '',
            message: '住所は必須です。',
            maxLength: { value: 200, message: '住所は200文字以内で入力してください。' }
        },
        'company-name': {
            validate: (value) => value.trim() !== '',
            message: '会社名は必須です。',
            maxLength: { value: 100, message: '会社名は100文字以内で入力してください。' }
        },
        'building-name': {
            maxLength: { value: 100, message: '建物名は100文字以内で入力してください。' }
        },
        'department-name': {
            maxLength: { value: 50, message: '部署名は50文字以内で入力してください。' }
        },
        'position-name': {
            maxLength: { value: 50, message: '役職名は50文字以内で入力してください。' }
        }
    };

    const displayError = (inputElement, message) => {
        clearError(inputElement); // Clear previous error first
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
        const rule = validationRules[inputElement.name];
        if (!rule) return true;

        const value = inputElement.value;
        let isValid = true;
        let errorMessage = '';

        if (rule.required && !value) {
            isValid = false;
            errorMessage = rule.required.message;
        } else if (value && rule.validate && !rule.validate(value)) {
            isValid = false;
            errorMessage = rule.message;
        } else if (value && rule.maxLength && value.length > rule.maxLength.value) {
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
        Object.values(inputs).forEach(input => {
            if (input) { // Check if input exists
                const isFieldValid = validateField(input);
                if (!isFieldValid) {
                    isFormValid = false;
                }
            }
        });
        return isFormValid;
    };

    // --- Event Listeners Setup ---
    Object.values(inputs).forEach(input => {
        if (input) {
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('input', () => validateField(input));
        }
    });

    // Special handling for postal code to highlight button
    if (inputs.postalCode) {
        inputs.postalCode.addEventListener('input', () => {
            const postalCode = inputs.postalCode.value;
            buttons.autoAddress.classList.toggle('highlight', /^\d{7}$/.test(postalCode));
        });
    }

    // --- (The rest of the original functions like populateConfirmScreen, handleAutoAddress, etc., remain) ---
    
    const confirmDetails = document.getElementById('confirm-details');

    const populateConfirmScreen = () => {
        const formData = new FormData(document.getElementById('billing-form'));
        let html = '';
        const displayNames = {
            'full-name': '氏名(姓名)', 'tel-number': '電話番号', 'postal-code': '郵便番号',
            'address': '住所', 'building-name': '建物名', 'company-name': '会社名',
            'department-name': '部署名', 'position-name': '役職名',
        };

        for (const [name, value] of formData.entries()) {
            const displayName = displayNames[name] || name;
            html += `
                <div class="confirm-item py-2 border-b last:border-b-0">
                    <span class="font-semibold text-gray-700">${displayName}:</span>
                    <span class="text-gray-900 ml-2">${value || '未入力'}</span>
                </div>`;
        }
        confirmDetails.innerHTML = html;
    };

    const handleAutoAddress = async () => {
        const postalCode = inputs.postalCode.value;
        if (!validateField(inputs.postalCode)) {
            // バリデーションに失敗した場合は何もしない（エラーメッセージはvalidateFieldが表示する）
            return;
        }
        clearError(inputs.postalCode);

        // ボタンにローディング表示を追加（任意）
        const originalButtonText = buttons.autoAddress.textContent;
        buttons.autoAddress.textContent = '検索中...';
        buttons.autoAddress.disabled = true;

        try {
            const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
            
            if (!response.ok) {
                // ネットワークエラーなど
                throw new Error('APIサーバーからの応答がありません。');
            }

            const data = await response.json();

            if (data.status === 400 || data.results === null) {
                // 郵便番号が見つからない場合
                displayError(inputs.postalCode, data.message || '該当する住所が見つかりませんでした。');
            } else if (data.status === 200) {
                const result = data.results[0];
                const fullAddress = `${result.address1}${result.address2}${result.address3}`;
                inputs.address.value = fullAddress;
                // 住所が自動入力された後、住所フィールドのバリデーションも実行
                validateField(inputs.address);
            } else {
                // その他の予期せぬステータス
                throw new Error(data.message || '不明なエラーが発生しました。');
            }

        } catch (error) {
            console.error('住所自動入力エラー:', error);
            displayError(inputs.postalCode, '住所の自動入力に失敗しました。');
        } finally {
            // ボタンの表示を元に戻す
            buttons.autoAddress.textContent = originalButtonText;
            buttons.autoAddress.disabled = false;
        }
    };

    // --- Button Click Handlers ---
    buttons.gotoInputPremium.addEventListener('click', () => showScreen('input'));
    // 追加: よくある質問の上のボタンのイベントリスナー
    if (buttons.gotoInputPremiumFaq) {
        buttons.gotoInputPremiumFaq.addEventListener('click', () => showScreen('input'));
    }
    buttons.autoAddress.addEventListener('click', handleAutoAddress);

    buttons.gotoConfirm.addEventListener('click', (event) => {
        event.preventDefault();
        if (validateForm()) {
            populateConfirmScreen();
            showScreen('confirm');
            hasUnsavedChanges = false;
        }
    });

    buttons.editInput.addEventListener('click', () => {
        showScreen('input');
        hasUnsavedChanges = true;
    });

    buttons.completeRegistration.addEventListener('click', () => {
        showScreen('complete');
        hasUnsavedChanges = false;
    });

    buttons.gotoDashboard.addEventListener('click', () => {
        alert('ダッシュボードへ戻ります。（実際にはページ遷移）');
        // window.location.href = '/dashboard.html';
    });

    // --- Leave Prevention (remains the same) ---
    document.getElementById('billing-form').addEventListener('input', () => {
        hasUnsavedChanges = true;
    });
    
    window.addEventListener('beforeunload', (event) => {
        if (hasUnsavedChanges && currentScreen === 'input') {
            event.preventDefault();
            event.returnValue = '';
        }
    });

    // Initial setup
    showScreen('description');
});