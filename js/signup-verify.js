// モックのため実トークン検証は行わない。?email= は使わず、仮登録時に sessionStorage へ
// 置いた保留情報（email + token）を読む（URLにメールアドレスを一切載せないため）。
// 解錠条件は「保留情報が存在し、かつURLのtokenと保存tokenが一致すること」。
// 保留情報の"存在"だけでは解錠しない（古いマーカーが残っているだけの直リンクを弾くため）。
// 注意: このガードはあくまでモックの導線再現。本番では認可の代替にはせず、
// メール確認・トークン検証はサーバ側の責務として別途実装すること。
(function () {
  'use strict';

  const SIGNUP_PENDING_KEY = 'speedad-signup-pending';
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

  function readPendingSignup() {
    let raw = null;
    try {
      raw = sessionStorage.getItem(SIGNUP_PENDING_KEY);
    } catch (storageError) {
      console.warn('仮登録情報を読み込めませんでした:', storageError);
      return null;
    }
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.email || !parsed.token) {
        return null;
      }
      return { email: String(parsed.email), token: String(parsed.token) };
    } catch (parseError) {
      console.warn('仮登録情報の形式が不正です:', parseError);
      return null;
    }
  }

  function clearPendingSignup() {
    try {
      sessionStorage.removeItem(SIGNUP_PENDING_KEY);
    } catch (storageError) {
      console.warn('仮登録情報を削除できませんでした:', storageError);
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

    function showInvalidStep() {
      // ここで保留情報を消さないこと。無効な直リンク到達（token無し／不一致）で消すと、
      // 正規の確認メールリンク（?token=一致）をまだ踏んでいない有効な仮登録まで
      // 巻き添えで破棄してしまう。保留情報は次の仮登録で上書き／本登録完了時に削除される。
      setActiveVerifyStep('invalid');
      backToTopButton?.focus();
    }

    if (backToTopButton) {
      backToTopButton.addEventListener('click', () => {
        // index.html と signup-verify.html は同一ディレクトリ配置前提の相対パス。
        window.location.href = 'index.html';
      });
    }

    const pendingSignup = readPendingSignup();
    const urlToken = new URLSearchParams(window.location.search).get('token') || '';

    // 解錠条件: 保留情報が存在し、かつURLのtokenと保存tokenが一致すること。
    // 「保留情報の存在」だけでは解錠しない（tokenなし／不一致は直リンク扱いでガード）。
    const isUnlocked = Boolean(pendingSignup) && Boolean(urlToken) && urlToken === pendingSignup.token;

    if (!isUnlocked) {
      showInvalidStep();
      return;
    }

    const pendingEmail = pendingSignup.email;

    if (emailDisplayEl) {
      emailDisplayEl.textContent = `確認済みメールアドレス: ${pendingEmail}`;
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
        clearPendingSignup();
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
