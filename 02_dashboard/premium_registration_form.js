// プレミアム登録フォームのロジック

document.addEventListener('DOMContentLoaded', () => {
    // エラーメッセージを表示するヘルパー関数
    function displayError(inputElement, message) {
        // 既存のエラーメッセージがあれば削除
        const existingError = inputElement.nextElementSibling;
        if (existingError && existingError.classList.contains('form-field-error')) {
            existingError.remove();
        }
        // エラーメッセージを作成して追加
        const errorElement = document.createElement('p');
        errorElement.classList.add('form-field-error');
        errorElement.textContent = message;
        inputElement.parentNode.insertBefore(errorElement, inputElement.nextElementSibling);
        inputElement.classList.add('is-invalid');
    }

    // エラーメッセージをクリアするヘルパー関数
    function clearError(inputElement) {
        const existingError = inputElement.nextElementSibling;
        if (existingError && existingError.classList.contains('form-field-error')) {
            existingError.remove();
        }
        inputElement.classList.remove('is-invalid');
    }

    // ローディング表示/非表示を切り替えるヘルパー関数
    function toggleLoading(button, isLoading) {
        const buttonText = button.querySelector('.button-text');
        const spinner = button.querySelector('.spinner-border');

        if (isLoading) {
            button.disabled = true;
            button.classList.add('opacity-50', 'cursor-not-allowed');
            if (buttonText) buttonText.style.display = 'none';
            if (spinner) spinner.style.display = 'inline-block';
        } else {
            button.disabled = false;
            button.classList.remove('opacity-50', 'cursor-not-allowed');
            if (buttonText) buttonText.style.display = 'inline-block';
            if (spinner) spinner.style.display = 'none';
        }
    }

    const form = document.getElementById('premiumRegistrationForm');
    const steps = [
        document.getElementById('step1-account-info'),
        document.getElementById('step2-user-address'),
        document.getElementById('step3-confirmation')
    ];
    const stepNavItems = document.querySelectorAll('nav[aria-label="Progress"] ol li a');

    let currentStep = 0; // 0-indexed

    function showStep(stepIndex) {
        steps.forEach((step, index) => {
            if (index === stepIndex) {
                step.classList.remove('hidden');
            } else {
                step.classList.add('hidden');
            }
        });
        updateStepNav(stepIndex);
        currentStep = stepIndex;
    }

    function updateStepNav(stepIndex) {
        stepNavItems.forEach((item, index) => {
            const spanTexts = item.querySelectorAll('span');
            if (index === stepIndex) {
                item.classList.add('border-primary');
                item.classList.remove('border-outline-variant', 'hover:border-outline');
                spanTexts.forEach(span => span.classList.add('text-primary'));
                spanTexts.forEach(span => span.classList.remove('text-on-surface-variant'));
                item.setAttribute('aria-current', 'step');
            } else if (index < stepIndex) {
                // Completed steps
                item.classList.add('border-primary', 'completed'); // completedクラスを追加
                item.classList.remove('border-outline-variant', 'hover:border-outline');
                spanTexts.forEach(span => span.classList.add('text-primary'));
                spanTexts.forEach(span => span.classList.remove('text-on-surface-variant'));
                item.removeAttribute('aria-current');
            } else {
                // Future steps
                item.classList.add('border-outline-variant');
                item.classList.remove('border-primary', 'completed'); // completedクラスを削除
                spanTexts.forEach(span => span.classList.add('text-on-surface-variant'));
                spanTexts.forEach(span => span.classList.remove('text-primary'));
                item.removeAttribute('aria-current');
            }
        });
    }

    // --- ステップ1: アカウント情報 ---
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordConfirmInput = document.getElementById('passwordConfirm');
    const nextToStep2Button = document.getElementById('nextToStep2');
    const togglePasswordVisibilityButton = document.getElementById('togglePasswordVisibility'); // 新しく追加

    // パスワード表示/非表示切り替え機能
    if (togglePasswordVisibilityButton) {
        togglePasswordVisibilityButton.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const icon = togglePasswordVisibilityButton.querySelector('.material-icons');
            if (icon) {
                icon.textContent = type === 'password' ? 'visibility_off' : 'visibility';
            }
        });
    }

    function validateStep1() {
        let isValid = true;
        
        // エラーをクリア
        clearError(passwordInput);
        clearError(passwordConfirmInput);

        // パスワードのバリデーション (モック画面に限り、強度チェックはスキップ)
        const password = passwordInput.value;
        const passwordConfirm = passwordConfirmInput.value;

        // パスワードが空でないことを確認
        if (!password) {
            displayError(passwordInput, 'パスワードを入力してください。');
            isValid = false;
        }

        // 確認用パスワードのバリデーション
        if (!passwordConfirm) {
            displayError(passwordConfirmInput, '確認用パスワードを入力してください。');
            isValid = false;
        } else if (password !== passwordConfirm) {
            displayError(passwordConfirmInput, 'パスワードと確認用パスワードが一致しません。');
            isValid = false;
        }
        
        return isValid;
    }

    nextToStep2Button.addEventListener('click', () => {
        if (validateStep1()) {
            showStep(1);
        }
    });

    // --- ステップ2: ユーザー・住所情報 ---
    const prevToStep1Button = document.getElementById('prevToStep1');
    const nextToStep3Button = document.getElementById('nextToStep3');

    const lastNameInput = document.getElementById('lastName');
    const firstNameInput = document.getElementById('firstName');
    const companyNameInput = document.getElementById('companyName');
    const phoneNumberInput = document.getElementById('phoneNumber');
    const postalCodeInput = document.getElementById('postalCode');
    const lookupAddressButton = document.getElementById('lookupAddress');
    const addressInput = document.getElementById('address');
    const buildingFloorInput = document.getElementById('buildingFloor'); // 建物名・部屋番号もクリア対象に
    
    const billingAddressSameRadio = document.getElementById('billingAddressSame');
    const billingAddressDifferentRadio = document.getElementById('billingAddressDifferent');
    const billingAddressFields = document.getElementById('billingAddressFields');
    const billingPostalCodeInput = document.getElementById('billingPostalCode');
    const lookupBillingAddressButton = document.getElementById('lookupBillingAddress');
    const billingAddressInput = document.getElementById('billingAddress');
    const billingBuildingFloorInput = document.getElementById('billingBuildingFloor'); // 建物名・部屋番号もクリア対象に


    // 郵便番号自動入力機能
    async function lookupAddress(postalCodeElement, addressElement) {
        // エラーをクリア
        clearError(postalCodeElement);
        clearError(addressElement);

        const postalCode = postalCodeElement.value.replace(/[^0-9]/g, ''); // ハイフン除去
        if (postalCode.length !== 7) {
            displayError(postalCodeElement, '郵便番号は7桁で入力してください。');
            return;
        }

        // ローディング開始
        const lookupButton = (postalCodeElement === postalCodeInput) ? lookupAddressButton : lookupBillingAddressButton;
        toggleLoading(lookupButton, true);

        try {
            const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
            const data = await response.json();

            if (data.results && data.results.length > 0) {
                const result = data.results[0];
                addressElement.value = `${result.address1}${result.address2}${result.address3 || ''}`;
                clearError(postalCodeElement); // 成功したらエラーをクリア
                clearError(addressElement); // 成功したらエラーをクリア
            } else {
                displayError(postalCodeElement, '該当する住所が見つかりませんでした。');
            }
        } catch (error) {
            console.error('住所検索エラー:', error);
            displayError(postalCodeElement, '住所検索中にエラーが発生しました。手動で入力してください。');
        } finally {
            // ローディング終了
            toggleLoading(lookupButton, false);
        }
    }

    lookupAddressButton.addEventListener('click', () => lookupAddress(postalCodeInput, addressInput));
    lookupBillingAddressButton.addEventListener('click', () => lookupAddress(billingPostalCodeInput, billingAddressInput));

    // 請求先情報の表示/非表示制御
    billingAddressSameRadio.addEventListener('change', () => {
        if (billingAddressSameRadio.checked) {
            billingAddressFields.classList.add('hidden');
            // 請求先住所フィールドのrequired属性を削除
            billingPostalCodeInput.removeAttribute('required');
            billingAddressInput.removeAttribute('required');
            // エラーもクリア
            clearError(billingPostalCodeInput);
            clearError(billingAddressInput);
        }
    });
    billingAddressDifferentRadio.addEventListener('change', () => {
        if (billingAddressDifferentRadio.checked) {
            billingAddressFields.classList.remove('hidden');
            // 請求先住所フィールドにrequired属性を追加
            billingPostalCodeInput.setAttribute('required', 'required');
            billingAddressInput.setAttribute('required', 'required');
        }
    });

    function validateStep2() {
        let isValid = true;
        
        // 全てのエラーをクリア
        steps[1].querySelectorAll('input').forEach(input => clearError(input));
        billingAddressFields.querySelectorAll('input').forEach(input => clearError(input));

        // ユーザー基本情報 + 住所情報の必須項目のチェック
        const userInfoRequiredInputs = [
            lastNameInput, firstNameInput, companyNameInput, phoneNumberInput,
            postalCodeInput, addressInput
        ];
        userInfoRequiredInputs.forEach(input => {
            if (input.value.trim() === '') {
                displayError(input, `${input.previousElementSibling.textContent.replace(' *', '').replace(' （任意）', '')}は必須項目です。`);
                isValid = false;
            }
        });
        if (!isValid) return false;

        // 電話番号の形式チェック
        const phoneNumberRegex = /^0\d{1,4}[-(]?\d{1,4}[-)]?\d{4}$/; // 例: 03-1234-5678, 090-1234-5678
        if (phoneNumberInput.value.trim() !== '' && !phoneNumberRegex.test(phoneNumberInput.value)) {
            displayError(phoneNumberInput, '有効な電話番号の形式で入力してください (例: 03-XXXX-XXXX)。');
            isValid = false;
        }
        if (!isValid) return false;

        // 別の請求先が選択されている場合のバリデーション
        if (billingAddressDifferentRadio.checked) {
            const billingRequiredInputs = [billingPostalCodeInput, billingAddressInput];
            billingRequiredInputs.forEach(input => {
                if (input.value.trim() === '') {
                    displayError(input, `請求先の${input.previousElementSibling.textContent.replace(' *', '')}は必須項目です。`);
                    isValid = false;
                }
            });
        }
        
        return isValid;
    }


    prevToStep1Button.addEventListener('click', () => showStep(0));
    nextToStep3Button.addEventListener('click', () => {
        if (validateStep2()) {
            showStep(2);
        }
    });

    // --- ステップ3: 同意・確認 ---
    const prevToStep2Button = document.getElementById('prevToStep2');
    const submitRegistrationButton = document.getElementById('submitRegistration');
    const agreeTermsCheckbox = document.getElementById('agreeTerms');
    const agreePrivacyCheckbox = document.getElementById('agreePrivacy');
    const agreePersonalDataCheckbox = document.getElementById('agreePersonalData');

    function checkAgreements() {
        submitRegistrationButton.disabled = !(agreeTermsCheckbox.checked && agreePrivacyCheckbox.checked && agreePersonalDataCheckbox.checked);
    }

    agreeTermsCheckbox.addEventListener('change', checkAgreements);
    agreePrivacyCheckbox.addEventListener('change', checkAgreements);
    agreePersonalDataCheckbox.addEventListener('change', checkAgreements);

    // 初期状態でボタンを無効化
    checkAgreements();

    prevToStep2Button.addEventListener('click', () => showStep(1));
    
    // フォーム送信処理
    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // デフォルトのフォーム送信を防止

        // エラーメッセージをクリア
        const agreementErrorElement = document.getElementById('agreementErrorMessage');
        if (agreementErrorElement) agreementErrorElement.remove();

        if (!agreeTermsCheckbox.checked || !agreePrivacyCheckbox.checked || !agreePersonalDataCheckbox.checked) {
            // 同意事項のエラーは特定の場所に表示
            const submitButtonParent = submitRegistrationButton.parentNode;
            const errorElement = document.createElement('p');
            errorElement.id = 'agreementErrorMessage';
            errorElement.classList.add('form-field-error', 'text-center', 'mb-4');
            errorElement.textContent = '全ての同意事項にチェックを入れてください。';
            submitButtonParent.insertBefore(errorElement, submitRegistrationButton);
            return;
        }

        // ローディング開始
        toggleLoading(submitRegistrationButton, true);

        // 全フォームデータを収集 (簡単化のためFormDataを使用)
        const formData = new FormData(form);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        // パスワード確認用フィールドは送信しない
        delete data['passwordConfirm'];
        // 請求先住所タイプも直接送信せず、適切な形式に変換してから送信

        console.log('送信データ:', data);

        // TODO: バックエンドAPIの実装後、この部分を有効化する
        // try {
        //     const response = await fetch('/api/premium-registration', { // 仮のパス
        //         method: 'POST',
        //         headers: {
        //             'Content-Type': 'application/json',
        //             // 'X-CSRF-Token': 'YOUR_CSRF_TOKEN_HERE' // CSRFトークンをヘッダーに含める
        //         },
        //         body: JSON.stringify(data)
        //     });

        //     if (response.ok) {
        //         window.location.href = '/02_dashboard/premium_registration_complete.html';
        //     } else {
        //         const errorData = await response.json();
        //         const errorMessage = `登録に失敗しました: ${errorData.message || response.statusText}`;
        //         alert(errorMessage);
        //     }
        // } catch (error) {
        //     console.error('登録エラー:', error);
        //     alert('ネットワークエラーが発生しました。後でもう一度お試しください。');
        // } finally {
        //     toggleLoading(submitRegistrationButton, false);
        // }

        // モック画面のため、API呼び出しをスキップし、成功としてリダイレクト
        console.log("API呼び出しをスキップし、成功として処理します。");
        window.location.href = '/02_dashboard/premium_registration_complete.html';
        toggleLoading(submitRegistrationButton, false); // ローディングを解除
    });

    // 初期表示
    showStep(0);
});