document.addEventListener('DOMContentLoaded', () => {
    // --- Simulation User Data Loading ---
    let loadedUserData = null;
    const storedSimulationUserData = localStorage.getItem('simulationUserData');
    if (storedSimulationUserData) {
        loadedUserData = JSON.parse(storedSimulationUserData);
    }

    // Default dummy data if not loaded from localStorage
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
    window.dummyUserData = loadedUserData;

    const stepInput = document.getElementById('step-input');
    const stepConfirm = document.getElementById('step-confirm');
    const stepComplete = document.getElementById('step-complete');

    // Modal Elements
    const accountCheckModal = document.getElementById('account-check-modal');
    const accountCheckModalContent = document.getElementById('account-check-content');
    const modalName = document.getElementById('modal-name');
    const modalCompany = document.getElementById('modal-company');
    const modalEmail = document.getElementById('modal-email');
    const modalDepartment = document.getElementById('modal-department');
    const modalTitle = document.getElementById('modal-title');
    const modalPhone = document.getElementById('modal-phone');
    const modalZip = document.getElementById('modal-zip');
    const modalAddress = document.getElementById('modal-address');
    const modalBuilding = document.getElementById('modal-building');

    const btnUseInfo = document.getElementById('btn-use-account-info');
    const btnUseInfoSticky = document.getElementById('btn-use-account-info-sticky'); // Sticky button
    const btnInputManual = document.getElementById('btn-input-manually');

    // Leave Prevention Modal Elements
    const preventLeaveModal = document.getElementById('prevent-leave-modal');
    const preventLeaveConfirmBtn = document.getElementById('prevent-leave-confirm-btn');
    const preventLeaveCancelBtn = document.getElementById('prevent-leave-cancel-btn');


    let currentScreen = 'input'; // Initial screen

    const steps = {
        1: { title: '入力', circle: 'step-circle-1', conn: 'connector-1', el: stepInput },
        2: { title: '確認', circle: 'step-circle-2', conn: 'connector-2', el: stepConfirm },
        3: { title: '完了', circle: 'step-circle-3', conn: null, el: stepComplete }
    };

    // Form Inputs
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

    // Confirm Screen Elements
    const confirms = {
        name: document.getElementById('confirm-name'),
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

    // --- Helper: Check Valid User Data ---
    function hasValidUserData(data) {
        return data && data.lastName && data.firstName && data.companyName;
    }

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

            // Show Sticky Button (delayed to allow fade in)
            // Only show if we have valid user data to quote
            const stickyBtn = document.getElementById('sticky-btn-container');
            if (stickyBtn && hasValidUserData(window.dummyUserData)) {
                stickyBtn.classList.remove('hidden');
                setTimeout(() => {
                    stickyBtn.classList.remove('opacity-0', 'pointer-events-none');
                }, 100);
            }

        } else if (stepNum === 2) { // On confirm screen
            currentScreen = 'confirm';
            hasUnsavedChanges = false; // Confirmation screen means data is 'saved' for the moment

            // Reset Consent Checkbox
            const consentCheckbox = document.getElementById('consent-checkbox');
            if (consentCheckbox) consentCheckbox.checked = false;
            // Disable submit button again
            if (btnSubmit) btnSubmit.disabled = true;

            // Hide Sticky Button
            const stickyBtn = document.getElementById('sticky-btn-container');
            if (stickyBtn) {
                stickyBtn.classList.add('opacity-0', 'pointer-events-none');
                setTimeout(() => {
                    stickyBtn.classList.add('hidden');
                }, 300);
            }

        } else if (stepNum === 3) { // On complete screen
            currentScreen = 'complete';
            hasUnsavedChanges = false;

            // Hide Sticky Button
            const stickyBtn = document.getElementById('sticky-btn-container');
            if (stickyBtn) {
                stickyBtn.classList.add('hidden');
            }
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

        if (rule.required && !value.trim()) {
            isValid = false;
            errorMessage = rule.message;
        } else if (value.trim() && rule.validate && !rule.validate(value)) {
            isValid = false;
            errorMessage = rule.message;
        } else if (value.trim() && rule.maxLength && value.length > rule.maxLength.value) {
            isValid = false;
            errorMessage = rule.maxLength.message;
        }

        // Visual Feedback (Green Check)
        const parent = inputElement.parentElement; // relative container
        let iconCheck = parent.querySelector('.valid-icon');

        if (!isValid) {
            displayError(inputElement, errorMessage);
            if (iconCheck) iconCheck.style.display = 'none';
        } else {
            clearError(inputElement);
            // Show Green Check if valid and not empty
            if (value.trim() !== '') {
                if (!iconCheck) {
                    iconCheck = document.createElement('span');
                    iconCheck.className = 'valid-icon material-icons text-green-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none';
                    iconCheck.textContent = 'check_circle';
                    // Ensure parent is relative for absolute positioning
                    if (getComputedStyle(parent).position === 'static') {
                        parent.style.position = 'relative';
                    }
                    parent.appendChild(iconCheck);
                }
                iconCheck.style.display = 'block';
                inputElement.classList.add('border-green-500', 'bg-green-50');
            } else {
                if (iconCheck) iconCheck.style.display = 'none';
                inputElement.classList.remove('border-green-500', 'bg-green-50');
            }
        }
        return isValid;
    };

    const validateForm = () => {
        let isFormValid = true;
        Object.values(inputs).forEach(input => {
            if (input) {
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
            const zipCode = inputs.zip.value.replace(/[^\d]/g, '');

            if (zipCode.length !== 7) {
                displayError(inputs.zip, '郵便番号を7桁で入力してください。');
                return;
            }

            clearError(inputs.zip);
            if (apiErrorZip) apiErrorZip.classList.add('hidden');

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
                            validateField(inputs.address);
                            if (inputs.building) inputs.building.focus();
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
        confirms.name.textContent = `${inputs.lastName.value} ${inputs.firstName.value}`;
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
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth() + 1;
            const date = now.getDate();
            const endOfMonth = new Date(year, month, 0);
            const endOfMonthFormatted = `${endOfMonth.getFullYear()}年${endOfMonth.getMonth() + 1}月${endOfMonth.getDate()}日`;
            const todayFormatted = `${year}年${month}月${date}日`;

            billingMessage = `
                <p class="font-bold text-red-600 mt-2">※本日から契約開始となり、当月分の料金（満額）が発生します。</p>
                <p class="text-xs mt-1 text-gray-600">契約期間: ${todayFormatted} 〜 ${endOfMonthFormatted}</p>
                <p class="mt-2">プレミアム機能はすぐにご利用いただけます。<br>お支払いは後日発行される請求書にてお願いいたします。</p>
            `;
        } else {
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
    function handleUseInfo(userData, skipModal = false, autoAdvance = false) {
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

        // Validate and Decide Logic
        const isValid = validateForm();

        if (isValid && autoAdvance) {
            // Case 1: Valid & Auto-advance requested (from Modal) -> Go to Confirm
            hasUnsavedChanges = true;
            populateConfirm();
            setProcessStep(2);
        } else {
            // Case 2: Not valid OR No Auto-advance requested (from Sticky) -> Stay on Input
            hasUnsavedChanges = true;
            setProcessStep(1);
        }
    }

    // Handle "Use Info" button click (From Modal -> Auto Advance)
    if (btnUseInfo) {
        btnUseInfo.addEventListener('click', () => {
            handleUseInfo(window.dummyUserData, false, true); // skipModal=false, autoAdvance=true
        });
    }

    // Handle Sticky "Use Info" button click (From Input Screen -> Stay on Input)
    if (btnUseInfoSticky) {
        btnUseInfoSticky.addEventListener('click', () => {
            // Only if we have data to use.
            handleUseInfo(window.dummyUserData, true, false); // skipModal=true, autoAdvance=false
        });
    }

    function checkAccountInfo() {
        const userData = window.dummyUserData;

        // すでにプレミアム会員の場合は完了画面へ
        if (userData.is_premium_member) {
            setProcessStep(3);
            return;
        }

        // 上記条件に合致しない場合は、通常通り確認モーダルを表示
        // Check if we have enough info to prompt (Account Check Modal)
        if (hasValidUserData(userData)) {
            // Populate modal
            if (modalName) modalName.textContent = `${userData.lastName} ${userData.firstName}`; // 姓名を結合
            if (modalCompany) modalCompany.textContent = userData.companyName;
            if (modalEmail) modalEmail.textContent = userData.email || '-';
            if (modalDepartment) modalDepartment.textContent = userData.departmentName || '-';
            if (modalTitle) modalTitle.textContent = userData.positionName || '-';
            if (modalPhone) modalPhone.textContent = userData.phone || '-';
            if (modalZip) modalZip.textContent = `〒${userData.zip.slice(0, 3)}-${userData.zip.slice(3)}` || '-';
            if (modalAddress) modalAddress.textContent = userData.address || '-';
            if (modalBuilding) modalBuilding.textContent = userData.building || '-';

            // Show Modal
            if (accountCheckModal) {
                accountCheckModal.classList.remove('hidden');
                void accountCheckModal.offsetWidth;
                setTimeout(() => {
                    accountCheckModal.classList.remove('opacity-0');
                    accountCheckModalContent.classList.remove('scale-95');
                }, 50);
            }
        } else {
            // Condition NOT met, skipping modal
            setProcessStep(1);
        }
    }

    // Handle "Input Manually"
    if (btnInputManual) {
        btnInputManual.addEventListener('click', () => {
            // Hide Modal
            accountCheckModal.classList.add('opacity-0');
            setTimeout(() => accountCheckModal.classList.add('hidden'), 300);
            setProcessStep(1);
            hasUnsavedChanges = true;
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
        // --- Consent Checkbox Logic ---
        const consentCheckbox = document.getElementById('consent-checkbox');

        // Initial state: Disable submit button
        btnSubmit.disabled = true;

        if (consentCheckbox) {
            consentCheckbox.addEventListener('change', () => {
                btnSubmit.disabled = !consentCheckbox.checked;
            });
        }

        btnSubmit.addEventListener('click', () => {
            if (consentCheckbox && !consentCheckbox.checked) return; // Guard clause

            // Simulate API call delay
            // [DEV NOTE] Replace this with actual API call
            // e.g. fetch('/api/premium/register', { method: 'POST', body: JSON.stringify(data) })
            setSubmitButtonLoading(true);

            setTimeout(() => {
                // Success!
                setSubmitButtonLoading(false);
                setProcessStep(3);
                // [DEV NOTE] Handle error cases here:
                // showErrorModal('エラーメッセージ');
            }, 1500);
        });
    }

    // --- Leave Prevention Logic ---
    let hasUnsavedChanges = false;
    let isNavigatingAway = false;
    let isPreventingBack = false;

    // フォームの入力変更を監視
    document.getElementById('billing-form').addEventListener('input', () => {
        hasUnsavedChanges = true;
    });

    window.addEventListener('beforeunload', (event) => {
        if (hasUnsavedChanges && (currentScreen === 'input' || currentScreen === 'confirm') && !isNavigatingAway) {
            event.preventDefault();
            event.returnValue = '';
        }
    });

    // ページ内の全てのリンクをクリックした際に離脱警告を行う
    document.querySelectorAll('a').forEach(link => {
        if (link.href && !link.href.startsWith('javascript:')) {
            link.addEventListener('click', (event) => {
                if (hasUnsavedChanges && (currentScreen === 'input' || currentScreen === 'confirm') && !isNavigatingAway) {
                    event.preventDefault();
                    showPreventLeaveModal();
                    preventLeaveConfirmBtn.dataset.targetUrl = link.href;
                }
            });
        }
    });

    // ブラウザの戻る/進むボタンに対する処理
    window.addEventListener('popstate', (event) => {
        if (isPreventingBack) {
            isPreventingBack = false;
            return;
        }

        if (hasUnsavedChanges && (currentScreen === 'input' || currentScreen === 'confirm') && !isNavigatingAway) {
            showPreventLeaveModal();
        } else {
            isNavigatingAway = true;
        }
    });


    // カスタム離脱防止モーダルを表示
    function showPreventLeaveModal() {
        if (preventLeaveModal) {
            preventLeaveModal.classList.remove('hidden');
            void preventLeaveModal.offsetWidth;
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
                delete preventLeaveConfirmBtn.dataset.targetUrl;
            }, 300);
        }
    }

    // 「はい、ページを離れる」ボタン
    if (preventLeaveConfirmBtn) {
        preventLeaveConfirmBtn.addEventListener('click', () => {
            hasUnsavedChanges = false;
            isNavigatingAway = true;
            isPreventingBack = false;

            hidePreventLeaveModal();

            if (preventLeaveConfirmBtn.dataset.targetUrl) {
                window.location.href = preventLeaveConfirmBtn.dataset.targetUrl;
            }
        });
    }

    // 「いいえ、このページに留まる」ボタン
    if (preventLeaveCancelBtn) {
        preventLeaveCancelBtn.addEventListener('click', () => {
            hidePreventLeaveModal();
            isNavigatingAway = false;

            if (hasUnsavedChanges && (currentScreen === 'input' || currentScreen === 'confirm')) {
                isPreventingBack = true;
                history.forward();
            }
        });
    }


    // Run check on load
    setTimeout(checkAccountInfo, 100);

    // --- Loading State Management ---
    function setSubmitButtonLoading(isLoading) {
        const spinner = document.getElementById('btn-submit-spinner');
        const text = document.getElementById('btn-submit-text');

        if (isLoading) {
            // Show spinner, hide text, disable button
            if (spinner) spinner.classList.remove('hidden');
            if (text) text.textContent = '処理中...';
            if (btnSubmit) btnSubmit.disabled = true;
        } else {
            // Hide spinner, show text, enable button
            if (spinner) spinner.classList.add('hidden');
            if (text) text.textContent = 'この内容で登録する';
            if (btnSubmit) btnSubmit.disabled = false;
        }
    }

    // --- Error Modal Management ---
    const errorModal = document.getElementById('error-modal');
    const errorModalContent = document.getElementById('error-modal-content');
    const errorModalMessage = document.getElementById('error-modal-message');
    const errorModalCloseBtn = document.getElementById('error-modal-close-btn');

    function showErrorModal(message = '登録処理中にエラーが発生しました。<br>もう一度お試しください。') {
        if (errorModal && errorModalContent) {
            if (errorModalMessage) {
                errorModalMessage.innerHTML = message;
            }

            errorModal.classList.remove('hidden');
            setTimeout(() => {
                errorModal.classList.remove('opacity-0');
                errorModalContent.classList.remove('scale-95');
                errorModalContent.classList.add('scale-100');
            }, 10);
        }
    }

    function hideErrorModal() {
        if (errorModal && errorModalContent) {
            errorModal.classList.add('opacity-0');
            errorModalContent.classList.remove('scale-100');
            errorModalContent.classList.add('scale-95');
            setTimeout(() => {
                errorModal.classList.add('hidden');
            }, 300);
        }
    }

    if (errorModalCloseBtn) {
        errorModalCloseBtn.addEventListener('click', () => {
            hideErrorModal();
        });
    }

    if (errorModal) {
        errorModal.addEventListener('click', (e) => {
            if (e.target === errorModal) {
                hideErrorModal();
            }
        });
    }

    // --- Real-time Validation ---
    // Add blur event listeners to all input fields for real-time validation
    Object.keys(inputs).forEach(fieldName => {
        const inputElement = inputs[fieldName];
        if (inputElement) {
            inputElement.addEventListener('blur', () => {
                validateField(inputElement);
            });
        }
    });

});