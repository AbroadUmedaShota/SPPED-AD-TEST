document.addEventListener('DOMContentLoaded', function () {
    const steps = document.querySelectorAll('.form-step');
    const stepperItems = document.querySelectorAll('.stepper-item');
    const form = document.getElementById('premium-form');
    let currentStep = 0;

    // window.dummyUserData が存在することを確認
    const userData = window.dummyUserData || {};

    const inputs = {
        last_name: { required: true, element: document.getElementById('last_name'), value: userData.lastName },
        first_name: { required: true, element: document.getElementById('first_name'), value: userData.firstName },
        phone_number: { required: true, element: document.getElementById('phone_number'), regex: /^0\d{1,4}[-(]?\d{1,4}[-)]?\d{4}$/, value: userData.phoneNumber },
        company_name: { required: true, element: document.getElementById('company_name'), value: userData.companyName },
        department: { required: false, element: document.getElementById('department'), value: userData.departmentName },
        position: { required: false, element: document.getElementById('position'), value: userData.positionName },
        postal_code: { required: true, element: document.getElementById('postal_code'), regex: /^\d{7}$/, value: userData.postalCode ? userData.postalCode.replace(/-/g, '') : '' },
        address: { required: true, element: document.getElementById('address'), value: userData.address },
        building: { required: false, element: document.getElementById('building'), value: userData.buildingFloor },
        billing_company_name: { required: true, element: document.getElementById('billing_company_name'), value: userData.billingCompanyName },
        billing_last_name: { required: true, element: document.getElementById('billing_last_name'), value: userData.billingLastName },
        billing_first_name: { required: true, element: document.getElementById('billing_first_name'), value: userData.billingFirstName },
        billing_phone_number: { required: true, element: document.getElementById('billing_phone_number'), regex: /^0\d{1,4}[-(]?\d{1,4}[-)]?\d{4}$/, value: userData.billingPhoneNumber },
        billing_postal_code: { required: true, element: document.getElementById('billing_postal_code'), regex: /^\d{7}$/, value: userData.billingPostalCode ? userData.billingPostalCode.replace(/-/g, '') : '' },
        billing_address: { required: true, element: document.getElementById('billing_address'), value: userData.billingAddress },
        billing_building: { required: false, element: document.getElementById('billing_building'), value: userData.billingBuildingFloor },
        terms_agree: { required: true, element: document.getElementById('terms_agree'), type: 'checkbox' }
    };

    // フォームへの初期値設定
    console.log('dummyUserData at initialization:', userData); // 追加
    Object.keys(inputs).forEach(name => {
        if (inputs[name].element && inputs[name].value !== undefined) {
            inputs[name].element.value = inputs[name].value;
            console.log(`Input ${name} set to: ${inputs[name].element.value}`); // 追加
        }
    });

    function showStep(stepIndex) {
        steps.forEach((step, index) => {
            step.classList.toggle('active', index === stepIndex);
        });
        stepperItems.forEach((item, index) => {
            item.classList.remove('active', 'completed');
            if (index < stepIndex) {
                item.classList.add('completed');
            } else if (index === stepIndex) {
                item.classList.add('active');
            }
        });
        currentStep = stepIndex;
    }

    function validateStep(stepIndex) {
        let isValid = true;
        const stepInputs = steps[stepIndex].querySelectorAll('[name]');
        stepInputs.forEach(inputEl => {
            const inputName = inputEl.name;
            if (inputs[inputName]) {
                if (!validateInput(inputName)) {
                    isValid = false;
                }
            }
        });
        return isValid;
    }

    function validateInput(name) {
        const input = inputs[name];
        if (!input) return true;

        const el = input.element;

        // 要素が非表示の場合はバリデーションをスキップ
        if (el && (el.offsetWidth === 0 && el.offsetHeight === 0)) {
            // エラーメッセージがあればクリアしておく
            const errorEl = el.closest('.form-group')?.querySelector('.error-message') || el.closest('label')?.querySelector('.error-message');
            if (errorEl) {
                errorEl.textContent = '';
                if (input.type === 'checkbox') {
                    el.closest('label').classList.remove('is-invalid');
                } else {
                    el.classList.remove('is-invalid');
                }
            }
            return true; // 非表示なのでバリデーションは成功とみなす
        }

        let errorEl;

        // terms_agree の場合は .form-group がないので別の方法で errorEl を取得
        if (name === 'terms_agree') {
            errorEl = el.closest('label').querySelector('.error-message');
        } else {
            errorEl = el.closest('.form-group').querySelector('.error-message');
        }
        
        // errorEl が null の場合もあるのでチェック
        if (!errorEl) {
             console.error(`Error message element not found for input: ${name}`);
             return true; // エラーメッセージ表示要素が見つからなくてもバリデーションは続行
        }
        let isValid = true;
        let errorMessage = '';

        const value = input.type === 'checkbox' ? el.checked : el.value.trim();

        if (input.required && (input.type === 'checkbox' ? !value : value === '')) {
            isValid = false;
            errorMessage = 'この項目は必須です。';
        } else if (input.regex && value !== '' && !input.regex.test(value)) {
            isValid = false;
            errorMessage = '入力形式が正しくありません。';
        }

        errorEl.textContent = errorMessage;
        // チェックボックスの場合、is-invalid クラスの適用を調整
        if (input.type === 'checkbox') {
            // チェックボックス自体に is-invalid をつけても視覚的に分かりにくいことが多いので、
            // 親の label に is-invalid をつける
            el.closest('label').classList.toggle('is-invalid', !isValid);
        } else {
            el.classList.toggle('is-invalid', !isValid);
        }
        return isValid;
    }

    form.addEventListener('click', function (e) {
        if (e.target.matches('.btn-next')) {
            console.log('次へボタンがクリックされました。現在のステップ:', currentStep);
            if (validateStep(currentStep)) {
                console.log('バリデーション成功');
                // ステップ2（お支払い）からステップ3（確認）に進む前にサマリーを更新
                if (currentStep === 1) {
                    console.log('サマリーを更新します');
                    try {
                        updateSummary();
                        console.log('サマリー更新完了');
                    } catch (error) {
                        console.error('サマリー更新エラー:', error);
                    }
                }
                showStep(currentStep + 1);
            } else {
                console.log('バリデーション失敗');
            }
        } else if (e.target.matches('#btn-edit-step1')) {
            console.log('ステップ3の「修正する」ボタンがクリックされました。ステップ1に戻ります。');
            showStep(0);
        } else if (e.target.matches('.btn-prev')) {
            console.log('戻るボタンがクリックされました');
            showStep(currentStep - 1);
        }
    });

    Object.keys(inputs).forEach(name => {
        const el = inputs[name].element;
        el.addEventListener('input', () => validateInput(name));
    });

    function updateSummary() {
        const container = document.getElementById('summary-container');

        const billingSameAddress = document.getElementById('billing_same_address');
        const billingOption = billingSameAddress && billingSameAddress.checked ? 'same' : 'different';

        let billingInfo = '';
        if (billingOption === 'same') {
            billingInfo = '<p class="summary-value">ユーザーの住所と同じ</p>';
        } else {
            const billingCompanyName = document.getElementById('billing_company_name')?.value || '';
            const billingLastName = document.getElementById('billing_last_name')?.value || '';
            const billingFirstName = document.getElementById('billing_first_name')?.value || '';
            const billingPhoneNumber = document.getElementById('billing_phone_number')?.value || '';
            const billingPostalCode = document.getElementById('billing_postal_code')?.value || '';
            const billingAddress = document.getElementById('billing_address')?.value || '';
            const billingBuilding = document.getElementById('billing_building')?.value || '';

            billingInfo = '<div class="space-y-1">' +
                          '<p class="summary-value">' + billingCompanyName + '</p>' +
                          '<p class="summary-value">' + billingLastName + ' ' + billingFirstName + '</p>' +
                          '<p class="summary-value">' + billingPhoneNumber + '</p>' +
                          '<p class="summary-value">〒' + billingPostalCode + ' ' + billingAddress + '</p>';
            if (billingBuilding) {
                billingInfo += '<p class="summary-value">' + billingBuilding + '</p>';
            }
            billingInfo += '</div>';
        }

        let summaryHTML = '<div class="summary-item"><p class="summary-label">氏名</p><p class="summary-value">' + inputs.last_name.element.value + ' ' + inputs.first_name.element.value + '</p></div>';

        summaryHTML += '<div class="summary-item"><p class="summary-label">電話番号</p><p class="summary-value">' + inputs.phone_number.element.value + '</p></div>';

        if (inputs.department.element.value) {
            summaryHTML += '<div class="summary-item"><p class="summary-label">部署名</p><p class="summary-value">' + inputs.department.element.value + '</p></div>';
        }

        if (inputs.position.element.value) {
            summaryHTML += '<div class="summary-item"><p class="summary-label">役職名</p><p class="summary-value">' + inputs.position.element.value + '</p></div>';
        }

        summaryHTML += '<div class="summary-item"><p class="summary-label">会社名</p><p class="summary-value">' + inputs.company_name.element.value + '</p></div>';

        summaryHTML += '<div class="summary-item"><p class="summary-label">住所</p><p class="summary-value">〒' + inputs.postal_code.element.value + ' ' + inputs.address.element.value + '</p></div>';

        if (inputs.building.element.value) {
            summaryHTML += '<div class="summary-item"><p class="summary-label">建物名・部屋番号</p><p class="summary-value">' + inputs.building.element.value + '</p></div>';
        }

        summaryHTML += '<div class="summary-item"><p class="summary-label">請求先</p>' + billingInfo + '</div>';

        container.innerHTML = summaryHTML;
    }

    // 郵便番号から住所を自動入力する機能
    const postalCodeInput = inputs.postal_code.element;
    const addressInput = inputs.address.element;
    const lookupAddressBtn = document.getElementById('lookup_address_btn');

    if (lookupAddressBtn) {
        lookupAddressBtn.addEventListener('click', async function () {
            const postalCode = postalCodeInput.value.replace(/[^0-9]/g, '');
            if (postalCode.length !== 7) {
                let errorEl = postalCodeInput.closest('.form-group').querySelector('.error-message');
                if (!errorEl) {
                    errorEl = document.createElement('p');
                    errorEl.classList.add('error-message');
                    postalCodeInput.closest('.form-group').appendChild(errorEl);
                }
                errorEl.textContent = '郵便番号は7桁の半角数字で入力してください。';
                postalCodeInput.classList.add('is-invalid');
                return;
            } else {
                let errorEl = postalCodeInput.closest('.form-group').querySelector('.error-message');
                if (errorEl) errorEl.textContent = '';
                postalCodeInput.classList.remove('is-invalid');
            }

            try {
                const response = await fetch('https://zipcloud.ibsnet.co.jp/api/search?zipcode=' + postalCode);
                const data = await response.json();

                if (data.results && data.results.length > 0) {
                    const result = data.results[0];
                    addressInput.value = result.address1 + result.address2 + (result.address3 || '');
                    let addressErrorEl = addressInput.closest('.form-group').querySelector('.error-message');
                    if (addressErrorEl) addressErrorEl.textContent = '';
                    addressInput.classList.remove('is-invalid');
                } else {
                    let errorEl = postalCodeInput.closest('.form-group').querySelector('.error-message');
                    if (!errorEl) {
                        errorEl = document.createElement('p');
                        errorEl.classList.add('error-message');
                        postalCodeInput.closest('.form-group').appendChild(errorEl);
                    }
                    errorEl.textContent = '該当する住所が見つかりませんでした。';
                    postalCodeInput.classList.add('is-invalid');
                }
            } catch (error) {
                console.error('住所検索エラー:', error);
                let errorEl = postalCodeInput.closest('.form-group').querySelector('.error-message');
                if (!errorEl) {
                    errorEl = document.createElement('p');
                    errorEl.classList.add('error-message');
                    postalCodeInput.closest('.form-group').appendChild(errorEl);
                }
                errorEl.textContent = '住所検索中にエラーが発生しました。手動で入力してください。';
                postalCodeInput.classList.add('is-invalid');
            }
        });
    }

    // 請求先情報の切り替え機能
    const billingSameAddress = document.getElementById('billing_same_address');
    const billingDifferentAddress = document.getElementById('billing_different_address');
    const billingAddressForm = document.getElementById('billing_address_form');
    const billingFormInputs = billingAddressForm ? billingAddressForm.querySelectorAll('input[required]') : []; // billingAddressForm内のrequiredなinputを取得

    if (billingSameAddress && billingDifferentAddress && billingAddressForm) {
        // required属性を切り替えるヘルパー関数
        function toggleRequired(enable) {
            billingFormInputs.forEach(input => {
                if (enable) {
                    input.setAttribute('required', 'true');
                } else {
                    input.removeAttribute('required');
                }
            });
        }

        // 初期状態を設定
        // DOMContentLoaded時に実行されるため、初回ロード時のradioボタンの状態に合わせてrequired属性を設定
        if (billingSameAddress.checked) {
            billingAddressForm.classList.add('hidden');
            toggleRequired(false); // 非表示のときはrequiredを解除
        } else if (billingDifferentAddress.checked) {
            billingAddressForm.classList.remove('hidden');
            toggleRequired(true); // 表示のときはrequiredを有効
        }


        billingSameAddress.addEventListener('change', function () {
            if (this.checked) {
                billingAddressForm.classList.add('hidden');
                toggleRequired(false); // 非表示のときはrequiredを解除
            }
        });

        billingDifferentAddress.addEventListener('change', function () {
            if (this.checked) {
                billingAddressForm.classList.remove('hidden');
                toggleRequired(true); // 表示のときはrequiredを有効
            }
        });
    }

    // 重複していたイベントリスナー削除済み

    Object.keys(inputs).forEach(name => {
        const el = inputs[name].element;
        el.addEventListener('input', () => validateInput(name));
    });

    // ... (updateSummary function and other code) ...

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        // 現在のステップ（確認画面: index 2）などを検証
        if (validateStep(currentStep)) {
            console.log('Form submitted!');
            // 完了画面 (Step 4: index 3) を表示
            showStep(3);
        }
    });

    // Initial load
    showStep(0);
});
