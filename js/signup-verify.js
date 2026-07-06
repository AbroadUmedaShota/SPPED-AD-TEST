// モックのため実トークン検証は行わない。?email= は使わず、仮登録時に sessionStorage へ
// 置いた保留メールを読む（URLにメールアドレスを一切載せないため）。
// 注意: このガードはあくまでモックの導線再現。本番では認可の代替にはせず、
// メール確認・トークン検証はサーバ側の責務として別途実装すること。
(function () {
  'use strict';

  const SIGNUP_PENDING_EMAIL_KEY = 'speedad-signup-pending-email';
  const LOGIN_PREFILL_EMAIL_KEY = 'speedad-login-prefill-email';

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

  function readPendingSignupEmail() {
    try {
      return sessionStorage.getItem(SIGNUP_PENDING_EMAIL_KEY) || '';
    } catch (storageError) {
      console.warn('仮登録メールを読み込めませんでした:', storageError);
      return '';
    }
  }

  function clearPendingSignupEmail() {
    try {
      sessionStorage.removeItem(SIGNUP_PENDING_EMAIL_KEY);
    } catch (storageError) {
      console.warn('仮登録メールを削除できませんでした:', storageError);
    }
  }

  function bootstrapSignupVerify() {
    const verifyForm = document.getElementById('verify-form');
    const passwordInput = document.getElementById('verify-password');
    const passwordConfirmInput = document.getElementById('verify-password-confirm');
    const passwordError = document.getElementById('verify-password-error');
    const passwordConfirmError = document.getElementById('verify-password-confirm-error');
    const submitButton = verifyForm?.querySelector('.button--filled');
    const emailDisplayEl = document.querySelector('[data-verify-email]');
    const goToLoginButton = document.getElementById('verify-go-to-login');
    const backToTopButton = document.getElementById('verify-back-to-top');
    const verifyCardEl = document.querySelector('.verify-card');

    const verifyStepEls = {
      password: document.querySelector('[data-verify-step="password"]'),
      done: document.querySelector('[data-verify-step="done"]'),
      invalid: document.querySelector('[data-verify-step="invalid"]')
    };
    const verifyStepTitleIds = {
      password: 'verify-title',
      done: 'verify-title-done',
      invalid: 'verify-title-invalid'
    };

    function setActiveVerifyStep(step) {
      Object.entries(verifyStepEls).forEach(([key, el]) => {
        if (el) {
          el.hidden = key !== step;
        }
      });
      if (verifyCardEl && verifyStepTitleIds[step]) {
        verifyCardEl.setAttribute('aria-labelledby', verifyStepTitleIds[step]);
      }
    }

    const pendingEmail = readPendingSignupEmail();

    if (emailDisplayEl) {
      emailDisplayEl.textContent = pendingEmail ? `確認済みメールアドレス: ${pendingEmail}` : '確認済みメールアドレス: 不明';
    }

    function showInvalidStep() {
      // 古い保留メールが次回の仮登録に紛れ込まないよう、ガード表示のタイミングでも後始末する。
      clearPendingSignupEmail();
      setActiveVerifyStep('invalid');
      backToTopButton?.focus();
    }

    if (backToTopButton) {
      backToTopButton.addEventListener('click', () => {
        // index.html と signup-verify.html は同一ディレクトリ配置前提の相対パス。
        window.location.href = 'index.html';
      });
    }

    // 仮登録(Step1)を経ずに直接アクセスされた場合は本登録フォームを出さず、ガード表示にする。
    if (!pendingEmail) {
      showInvalidStep();
      return;
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
      setActiveVerifyStep('done');
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
        try {
          sessionStorage.setItem(LOGIN_PREFILL_EMAIL_KEY, pendingEmail);
        } catch (storageError) {
          console.warn('ログイン用メールを保存できませんでした:', storageError);
        }
        clearPendingSignupEmail();
        // index.html と signup-verify.html は同一ディレクトリ配置前提の相対パス。
        window.location.href = 'index.html';
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
