import { showToast } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';

// Mock function to simulate API call
async function validateCurrentPassword(password) {
    // In a real app, this would be a fetch call to the backend.
    // For this mock, we use the logic from the requirements doc.
    return new Promise(resolve => {
        setTimeout(() => {
            if (password === 'password123') {
                resolve({ success: true });
            } else {
                resolve({ success: false, message: '現在のパスワードが正しくありません。' });
            }
        }, 500);
    });
}

async function changePassword(newPassword) {
    // Mock API call
    return new Promise(resolve => {
        setTimeout(() => {
            console.log(`Password changed to: ${newPassword}`);
            resolve({ success: true, message: 'パスワードが正常に変更されました。' });
        }, 500);
    });
}

function setupPasswordVisibilityToggle() {
    document.querySelectorAll('[data-toggle-password]').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.togglePassword;
            const targetInput = document.getElementById(targetId);
            const icon = button.querySelector('.material-icons');

            if (targetInput && icon) {
                if (targetInput.type === 'password') {
                    targetInput.type = 'text';
                    icon.textContent = 'visibility_off';
                } else {
                    targetInput.type = 'password';
                    icon.textContent = 'visibility';
                }
            }
        });
    });
}

export function initPasswordChange() {
    // --- DOM Element Cache ---
    const wizard = document.getElementById('passwordChangeWizard');
    if (!wizard) return; // Don't run if not on the password change page

    const steps = {
        step1: document.getElementById('step1'),
        step2: document.getElementById('step2'),
        step3: document.getElementById('step3'),
    };

    // Step 1 Elements
    const currentPasswordInput = document.getElementById('currentPassword');
    const currentPasswordError = document.getElementById('currentPasswordError');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const cancelStep1Btn = document.getElementById('cancelStep1');
    const nextStep1Btn = document.getElementById('nextStep1');

    // Step 2 Elements
    const newPasswordInput = document.getElementById('newPassword');
    const newPasswordError = document.getElementById('newPasswordError');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const confirmPasswordError = document.getElementById('confirmPasswordError');
    const strengthText = document.getElementById('strength-text');
    const strengthBar = document.getElementById('strength-bar');
    const strengthCriteria = document.getElementById('strength-criteria');
    const backStep2Btn = document.getElementById('backStep2');
    const clearStep2Btn = document.getElementById('clearStep2');
    const nextStep2Btn = document.getElementById('nextStep2');

    // Step 3 Elements
    const backToDashboardBtn = document.getElementById('backToDashboard');

    function navigateToStep(stepNumber) {
        Object.values(steps).forEach(step => step.classList.add('hidden'));
        if (steps[`step${stepNumber}`]) {
            steps[`step${stepNumber}`].classList.remove('hidden');
        }
    }

    // --- Event Handlers ---

    function handleCancel() {
        window.location.href = 'index.html';
    }



    async function handleNextStep1() {
        const password = currentPasswordInput.value;
        currentPasswordError.textContent = '';

        if (!password) {
            currentPasswordError.textContent = '現在のパスワードを入力してください。';
            return;
        }

        nextStep1Btn.disabled = true;
        nextStep1Btn.textContent = '確認中...';

        const result = await validateCurrentPassword(password);

        if (result.success) {
            navigateToStep(2);
        } else {
            currentPasswordError.textContent = result.message;
        }

        nextStep1Btn.disabled = false;
        nextStep1Btn.textContent = '次へ';
    }

    function handleBackStep2() {
        navigateToStep(1);
    }

    function handleClearStep2() {
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
        handlePasswordInput();
        checkPasswordMatch();
    }

    async function handleNextStep2() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // Clear previous errors
        newPasswordError.textContent = '';
        newPasswordError.classList.add('hidden');

        if (!newPassword) {
            newPasswordError.textContent = '新しいパスワードを入力してください。';
            newPasswordError.classList.remove('hidden');
            return;
        }

        if (newPassword.length < 8) {
            newPasswordError.textContent = 'パスワードは8文字以上で入力してください。';
            newPasswordError.classList.remove('hidden');
            return;
        }

        if (!/[0-9]/.test(newPassword)) {
            newPasswordError.textContent = 'パスワードには少なくとも1つの数字を含めてください。';
            newPasswordError.classList.remove('hidden');
            return;
        }

        const passwordsMatch = checkPasswordMatch();

        if (!passwordsMatch) {
            // Error is already shown by checkPasswordMatch
            return;
        }

        nextStep2Btn.disabled = true;
        nextStep2Btn.textContent = '変更中...';

        const result = await changePassword(newPassword);

        if (result.success) {
            window.location.href = 'password-change-complete.html';
        } else {
            showToast(result.message, 'error');
        }

        nextStep2Btn.disabled = false;
        nextStep2Btn.textContent = '変更する';
    }

    function handlePasswordInput() {
        const password = newPasswordInput.value;
        // Clear error message on new input
        newPasswordError.textContent = ''; 
        const strength = checkPasswordStrength(password);
        updatePasswordStrengthUI(strength);
        checkPasswordMatch();
    }

    function checkPasswordStrength(password) {
        if (!password) {
            return { level: -1, text: '', color: 'bg-transparent', width: '0%' };
        }
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 10) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score < 2) return { level: 0, text: '弱い', color: 'bg-error', width: '33%' };
        if (score < 4) return { level: 1, text: '普通', color: 'bg-warning', width: '66%' };
        return { level: 2, text: '安全', color: 'bg-success', width: '100%' };
    }

    function updatePasswordStrengthUI(strength) {
        if (strength.level === -1) {
            strengthText.textContent = '';
        } else {
            strengthText.textContent = `パスワード強度: ${strength.text}`;
        }
        strengthBar.className = `h-2 rounded-full transition-all ${strength.color}`;
        strengthBar.style.width = strength.width;
    }

    function checkPasswordMatch() {
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        if (confirmPassword && newPassword !== confirmPassword) {
            confirmPasswordError.textContent = 'パスワードが一致しません。';
            confirmPasswordError.classList.remove('hidden');
            return false;
        } else {
            confirmPasswordError.textContent = '';
            confirmPasswordError.classList.add('hidden');
            return true;
        }
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        setupPasswordVisibilityToggle();

        cancelStep1Btn.addEventListener('click', handleCancel);
        nextStep1Btn.addEventListener('click', handleNextStep1);

        backStep2Btn.addEventListener('click', handleBackStep2);
        clearStep2Btn.addEventListener('click', handleClearStep2);
        nextStep2Btn.addEventListener('click', handleNextStep2);
        newPasswordInput.addEventListener('input', handlePasswordInput);

        backToDashboardBtn.addEventListener('click', handleCancel); // Same as cancel
    }

    // --- Initialization ---
    navigateToStep(1);
    setupEventListeners();
    // Expose the navigation guard setup function to the global scope
    window.attachPasswordChangeNavGuard = setupSidebarNavigationGuard;

    // Clean up the global function when the page is unloaded
    window.addEventListener('beforeunload', () => {
        delete window.attachPasswordChangeNavGuard;
    });

    /**
     * Checks if there are any unsaved changes in the password fields.
     * @returns {boolean} True if there are unsaved changes.
     */
    function hasUnsavedChanges() {
        return currentPasswordInput.value !== '' || 
               newPasswordInput.value !== '' || 
               confirmPasswordInput.value !== '';
    }

    /**
     * Adds a navigation guard to the sidebar links.
     * This function is called from sidebarHandler.js after the sidebar is loaded.
     */
    function setupSidebarNavigationGuard() {
        const sidebar = document.getElementById('sidebar-placeholder');
        if (!sidebar) return;

        const sidebarLinks = sidebar.querySelectorAll('a');
        sidebarLinks.forEach(link => {
            // Use a named function for the listener to be able to remove it if needed
            const navigationListener = (event) => {
                if (hasUnsavedChanges()) {
                    event.preventDefault();
                    showConfirmationModal(
                        '変更が保存されていません。ページを移動しますか？',
                        () => { window.location.href = link.href; },
                        '移動する'
                    );
                }
            };
            link.addEventListener('click', navigationListener);
        });
    }
}
