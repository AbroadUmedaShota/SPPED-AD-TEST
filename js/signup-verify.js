// モックのため実トークン検証は行わない。URLの ?email= をそのまま確認済みメールとして扱う。
(function () {
  'use strict';

  function getButtonTextNode(buttonElement) {
    return Array.from(buttonElement.childNodes)
      .find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '');
  }

  function showLoading(buttonElement, loadingText = '処理中...') {
    if (!buttonElement) {
      return;
    }
    buttonElement.classList.add('is-loading');
    buttonElement.setAttribute('disabled', 'true');
    const spinner = buttonElement.querySelector('.button__spinner');
    if (spinner) {
      spinner.style.display = 'inline-block';
    }
    const textNode = getButtonTextNode(buttonElement);
    buttonElement.dataset.originalText = textNode ? textNode.nodeValue : buttonElement.textContent;
    if (textNode) {
      textNode.nodeValue = loadingText;
    } else {
      buttonElement.textContent = loadingText;
    }
  }

  function hideLoading(buttonElement) {
    if (!buttonElement) {
      return;
    }
    buttonElement.classList.remove('is-loading');
    buttonElement.removeAttribute('disabled');
    const spinner = buttonElement.querySelector('.button__spinner');
    if (spinner) {
      spinner.style.display = 'none';
    }
    if (buttonElement.dataset.originalText) {
      const textNode = getButtonTextNode(buttonElement);
      if (textNode) {
        textNode.nodeValue = buttonElement.dataset.originalText;
      } else {
        buttonElement.textContent = buttonElement.dataset.originalText;
      }
      delete buttonElement.dataset.originalText;
    }
  }

  function displayError(inputElement, errorElement, message) {
    if (!inputElement || !errorElement) {
      return;
    }
    errorElement.textContent = message;
    inputElement.setAttribute('aria-invalid', message !== '');
  }

  function clearError(inputElement, errorElement) {
    if (!inputElement || !errorElement) {
      return;
    }
    errorElement.textContent = '';
    inputElement.setAttribute('aria-invalid', 'false');
  }

  function bootstrapSignupVerify() {
    const verifyForm = document.getElementById('verify-form');
    const passwordInput = document.getElementById('verify-password');
    const passwordConfirmInput = document.getElementById('verify-password-confirm');
    const passwordError = document.getElementById('verify-password-error');
    const passwordConfirmError = document.getElementById('verify-password-confirm-error');
    const submitButton = verifyForm?.querySelector('.button--filled');
    const emailDisplayEl = document.querySelector('[data-verify-email]');
    const stepPasswordEl = document.querySelector('[data-verify-step="password"]');
    const stepDoneEl = document.querySelector('[data-verify-step="done"]');
    const goToLoginButton = document.getElementById('verify-go-to-login');
    const verifyCardEl = document.querySelector('.verify-card');

    const searchParams = new URLSearchParams(window.location.search);
    const email = searchParams.get('email') || '';

    if (emailDisplayEl) {
      emailDisplayEl.textContent = email ? `確認済みメールアドレス: ${email}` : '確認済みメールアドレス: 不明';
    }

    function clearFormErrors() {
      clearError(passwordInput, passwordError);
      clearError(passwordConfirmInput, passwordConfirmError);
    }

    function validateForm() {
      let isValid = true;
      clearFormErrors();
      if (!passwordInput?.value) {
        displayError(passwordInput, passwordError, 'パスワードを入力してください。');
        isValid = false;
      } else if (passwordInput.value.length < 8) {
        displayError(passwordInput, passwordError, 'パスワードは8文字以上である必要があります。');
        isValid = false;
      } else if (!/[A-Za-z]/.test(passwordInput.value) || !/[0-9]/.test(passwordInput.value)) {
        displayError(passwordInput, passwordError, 'パスワードは半角英数字を組み合わせてください。');
        isValid = false;
      }
      if (!passwordConfirmInput?.value) {
        displayError(passwordConfirmInput, passwordConfirmError, '確認用パスワードを入力してください。');
        isValid = false;
      } else if (passwordConfirmInput.value !== passwordInput.value) {
        displayError(passwordConfirmInput, passwordConfirmError, 'パスワードが一致しません。');
        isValid = false;
      }
      return isValid;
    }

    function showDoneStep() {
      if (!stepPasswordEl || !stepDoneEl) {
        return;
      }
      stepPasswordEl.hidden = true;
      stepDoneEl.hidden = false;
      // リージョン名(aria-labelledby)を完了ステップの見出しに付け替える。
      // 差し替えないと完了後も「パスワードの設定」のままとリージョン名が読まれてしまう。
      verifyCardEl?.setAttribute('aria-labelledby', 'verify-title-done');
      goToLoginButton?.focus();
    }

    [passwordInput, passwordConfirmInput].forEach((input) => {
      if (!input) {
        return;
      }
      input.addEventListener('input', () => {
        const errorElement = input === passwordInput ? passwordError : passwordConfirmError;
        if (input.getAttribute('aria-invalid') === 'true') {
          clearError(input, errorElement);
        }
      });
    });

    if (verifyForm) {
      verifyForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!validateForm()) {
          return;
        }
        if (!submitButton) {
          return;
        }
        showLoading(submitButton, '登録中...');
        try {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          showDoneStep();
        } finally {
          hideLoading(submitButton);
        }
      });
    }

    if (goToLoginButton) {
      goToLoginButton.addEventListener('click', () => {
        // index.html と signup-verify.html は同一ディレクトリ配置前提の相対パス。
        window.location.href = `index.html?login_email=${encodeURIComponent(email)}`;
      });
    }

    passwordInput?.focus();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapSignupVerify);
  } else {
    bootstrapSignupVerify();
  }
})();
