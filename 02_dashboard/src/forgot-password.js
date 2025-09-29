document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-password-form');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('email-error');
    const submitButton = form.querySelector('.button');
    const successMessage = document.getElementById('success-message');

    // --- ボタンのローディング状態管理 ---
    function showLoading(buttonElement, loadingText = '処理中...') {
        buttonElement.classList.add('is-loading');
        buttonElement.setAttribute('disabled', 'true');
        const spinner = buttonElement.querySelector('.button__spinner');
        if (spinner) {
            spinner.style.display = 'inline-block';
        }
        buttonElement.dataset.originalText = buttonElement.textContent.trim();
        const textNode = Array.from(buttonElement.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '');
        if (textNode) {
            textNode.nodeValue = loadingText;
        }
    }

    function hideLoading(buttonElement) {
        buttonElement.classList.remove('is-loading');
        buttonElement.removeAttribute('disabled');
        const spinner = buttonElement.querySelector('.button__spinner');
        if (spinner) {
            spinner.style.display = 'none';
        }
        if (buttonElement.dataset.originalText) {
            const textNode = Array.from(buttonElement.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '');
            if (textNode) {
                textNode.nodeValue = buttonElement.dataset.originalText;
            }
        }
    }

    // --- バリデーション --- 
    function validateEmail() {
        emailError.textContent = '';
        emailInput.setAttribute('aria-invalid', 'false');
        const emailValue = emailInput.value.trim();

        if (!emailValue) {
            emailError.textContent = 'メールアドレスを入力してください。';
            emailInput.setAttribute('aria-invalid', 'true');
            return false;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
            emailError.textContent = '有効なメールアドレスを入力してください。';
            emailInput.setAttribute('aria-invalid', 'true');
            return false;
        }
        return true;
    }

    emailInput.addEventListener('input', validateEmail);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!validateEmail()) {
            return;
        }

        showLoading(submitButton, '送信中...');

        // ダミーのネットワーク遅延
        await new Promise(resolve => setTimeout(resolve, 1000));

        hideLoading(submitButton);

        // フォームを非表示にし、成功メッセージを表示
        form.style.display = 'none';
        successMessage.textContent = 'ご入力のメールアドレスに、パスワード再設定の手順をお送りしました。メールをご確認ください。';
        successMessage.style.display = 'block';
    });
});
