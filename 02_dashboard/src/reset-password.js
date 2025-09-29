document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    const passwordInput = document.getElementById('password');
    const passwordConfirmInput = document.getElementById('password-confirm');
    const passwordError = document.getElementById('password-error');
    const passwordConfirmError = document.getElementById('password-confirm-error');
    const strengthBarFill = document.getElementById('strength-bar-fill');
    const strengthText = document.getElementById('strength-text');
    const toggleButtons = document.querySelectorAll('.password-toggle');

    // --- パスワード強度チェック ---
    const strengthLevels = {
        0: { text: '弱い', color: 'var(--color-error)', width: '20%' },
        1: { text: '弱い', color: 'var(--color-error)', width: '40%' },
        2: { text: '普通', color: 'var(--color-warning)', width: '60%' },
        3: { text: '普通', color: 'var(--color-warning)', width: '80%' },
        4: { text: '安全', color: 'var(--color-success)', width: '100%' }
    };

    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        if (password === '') {
            strengthBarFill.style.width = '0%';
            strengthText.textContent = '';
            return;
        }

        const result = zxcvbn(password);
        const score = result.score;
        const level = strengthLevels[score];

        strengthBarFill.style.width = level.width;
        strengthBarFill.style.backgroundColor = level.color;
        strengthText.textContent = level.text;
        strengthText.style.color = level.color;
    });

    // --- パスワード表示/非表示 ---
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const input = button.previousElementSibling;
            const icon = button.querySelector('.material-icons');
            if (input.type === 'password') {
                input.type = 'text';
                icon.textContent = 'visibility';
                button.setAttribute('aria-label', 'パスワードを非表示にする');
            } else {
                input.type = 'password';
                icon.textContent = 'visibility_off';
                button.setAttribute('aria-label', 'パスワードを表示する');
            }
        });
    });

    // --- フォーム送信処理 ---
    function validateForm() {
        let isValid = true;
        passwordError.textContent = '';
        passwordConfirmError.textContent = '';
        passwordInput.setAttribute('aria-invalid', 'false');
        passwordConfirmInput.setAttribute('aria-invalid', 'false');

        if (!passwordInput.value) {
            passwordError.textContent = 'パスワードを入力してください。';
            passwordInput.setAttribute('aria-invalid', 'true');
            isValid = false;
        }

        if (passwordInput.value && passwordInput.value !== passwordConfirmInput.value) {
            passwordConfirmError.textContent = 'パスワードが一致しません。';
            passwordConfirmInput.setAttribute('aria-invalid', 'true');
            isValid = false;
        }
        return isValid;
    }

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (validateForm()) {
            // 実際のアプリケーションではここでAPIを呼び出す
            console.log('パスワードリセット成功');
            window.location.href = 'reset-password-complete.html';
        }
    });
});
