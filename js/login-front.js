(function () {
  'use strict';

  const modalFocusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');

  function resolveAppPath(relativePath) {
    if (!relativePath) {
      return relativePath;
    }
    if (/^(https?:)?\/\//.test(relativePath)) {
      return relativePath;
    }
    const { pathname } = window.location;
    let basePath = pathname;
    if (!basePath.endsWith('/')) {
      if (basePath.includes('.')) {
        basePath = basePath.slice(0, basePath.lastIndexOf('/') + 1);
      } else {
        basePath = `${basePath}/`;
      }
    }
    return `${basePath}${relativePath}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isHttpUrl(value) {
    return /^https?:\/\//i.test(String(value ?? ''));
  }

  function pickPublicNewsUrl(candidateUrl, fallbackUrl) {
    if (isHttpUrl(candidateUrl)) {
      return candidateUrl;
    }
    if (isHttpUrl(fallbackUrl)) {
      return fallbackUrl;
    }
    return 'https://support.speed-ad.com/news/';
  }

  function getButtonTextNode(buttonElement) {
    return Array.from(buttonElement.childNodes)
      .find((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim() !== '');
  }

  function bootstrapLoginFront() {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.querySelector('.password-toggle');
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');
    const loginTermsAgreeCheckbox = document.getElementById('login-terms-agree');
    const loginTermsAgreeError = document.getElementById('login-terms-agree-error');
    const rememberAccountCheckbox = document.getElementById('remember-account');
    const loginButton = loginForm?.querySelector('.button--filled');
    const googleButtonMain = document.querySelector('.form-container > .button--google');
    const scenarioAccountLinks = Array.from(document.querySelectorAll('.scenario-accounts__link'));
    const signupTriggerButtons = Array.from(document.querySelectorAll('[data-signup-trigger]'));
    const fallbackSignupButton = document.querySelector('.button--tonal');
    if (!signupTriggerButtons.length && fallbackSignupButton) {
      signupTriggerButtons.push(fallbackSignupButton);
    }
    const signupButtonMain = signupTriggerButtons[0] || null;
    const modalOverlay = document.querySelector('.modal');
    const modalContent = document.querySelector('.modal__content');
    const modalCloseButton = document.querySelector('.modal__close-button');
    const signupForm = document.getElementById('signup-form');
    const showLoginLinkFromModal = document.getElementById('show-login-from-modal');
    const signupNameInput = document.getElementById('signup-name');
    const signupEmailInput = document.getElementById('signup-email');
    const signupPasswordInput = document.getElementById('signup-password');
    const signupPasswordConfirmInput = document.getElementById('signup-password-confirm');
    const termsAgreeCheckbox = document.getElementById('terms-agree');
    const signupNameError = document.getElementById('signup-name-error');
    const signupEmailError = document.getElementById('signup-email-error');
    const signupPasswordError = document.getElementById('signup-password-error');
    const signupPasswordConfirmError = document.getElementById('signup-password-confirm-error');
    const termsAgreeError = document.getElementById('terms-agree-error');
    const signupAccountButton = signupForm?.querySelector('.button--filled');
    const googleButtonModal = modalContent?.querySelector('.button--google');
    const customerVoiceTeaserGrid = document.getElementById('customer-voice-teaser-grid');
    const customerVoiceTeaserStatus = document.getElementById('customer-voice-teaser-status');
    const publicNewsSection = document.getElementById('public-news-section');
    const publicNewsList = document.getElementById('public-news-list');
    const pageMain = document.querySelector('main');

    let modalReturnFocusElement = null;
    let modalFocusTimeoutId = null;
    const rememberedAccountStorageKey = 'speedad-remembered-login-id';

    function getModalFocusableElements() {
      if (!modalContent) {
        return [];
      }
      return Array.from(modalContent.querySelectorAll(modalFocusableSelector))
        .filter((element) => element.offsetParent !== null);
    }

    function setBackgroundInert(isInert) {
      if (!pageMain) {
        return;
      }
      if (isInert) {
        pageMain.setAttribute('aria-hidden', 'true');
        pageMain.setAttribute('inert', '');
        return;
      }
      pageMain.removeAttribute('aria-hidden');
      pageMain.removeAttribute('inert');
    }

    async function loadPublicNews() {
      if (!publicNewsSection || !publicNewsList) {
        return;
      }
      const newsEndpoint = publicNewsSection.dataset.newsEndpoint || 'data/news.json';
      const fallbackNewsUrl = publicNewsSection.dataset.newsDetailUrl || 'https://support.speed-ad.com/news/';
      try {
        const response = await fetch(resolveAppPath(newsEndpoint));
        if (!response.ok) {
          throw new Error(`Failed to load public news: ${response.status}`);
        }
        const payload = await response.json();
        const items = Array.isArray(payload?.items)
          ? payload.items.filter((item) => item?.title).slice(0, 3)
          : [];
        if (!items.length) {
          publicNewsSection.hidden = true;
          return;
        }
        publicNewsList.innerHTML = items.map((item) => {
          const displayDate = item.displayDate || item.date || item.publishedAt || '';
          const dateTime = item.date || item.publishedAt || '';
          const summary = item.summary ? `<p>${escapeHtml(item.summary)}</p>` : '';
          const url = pickPublicNewsUrl(item.url, fallbackNewsUrl);
          const timeMarkup = displayDate
            ? `<time datetime="${escapeHtml(dateTime || displayDate)}">${escapeHtml(displayDate)}</time>`
            : '';
          return `
            <a class="public-news-item" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
              ${timeMarkup}
              <span class="public-news-item__body">
                <strong>${escapeHtml(item.title)}</strong>
                ${summary}
              </span>
            </a>
          `;
        }).join('');
        publicNewsSection.hidden = false;
      } catch (error) {
        console.warn('お知らせの読み込みに失敗しました:', error);
        publicNewsSection.hidden = true;
      }
    }

    async function loadCustomerVoiceTeasers() {
      if (!customerVoiceTeaserGrid || !customerVoiceTeaserStatus) {
        return;
      }
      try {
        const response = await fetch(resolveAppPath('data/customer-voices.json'));
        if (!response.ok) {
          throw new Error(`Failed to load customer voices: ${response.status}`);
        }
        const payload = await response.json();
        const voices = Array.isArray(payload?.voices)
          ? payload.voices.filter((voice) => voice?.publishStatus === 'published').slice(0, 2)
          : [];
        customerVoiceTeaserStatus.textContent = voices.length ? `${voices.length}件の公開事例` : '公開準備中';
        if (!voices.length) {
          customerVoiceTeaserGrid.innerHTML = '<p class="voice-teaser__empty">公開準備中です。詳細ページは後日追加されます。</p>';
          return;
        }
        customerVoiceTeaserGrid.innerHTML = voices.map((voice) => {
          const quoteText = voice.quote?.text || voice.listingSummary || '';
          const author = voice.publicQuoteAuthor || voice.quote?.author || voice.label || '';
          const authorParts = author.split(/\s+/);
          const authorName = authorParts[0] || author;
          const authorRole = authorParts.slice(1).join(' ');
          return `
            <article class="voice-teaser-card">
              <blockquote class="voice-teaser-card__quote">${escapeHtml(quoteText)}</blockquote>
              <p class="voice-teaser-card__author">${escapeHtml(authorName)}</p>
              ${authorRole ? `<p class="voice-teaser-card__role">${escapeHtml(authorRole)}</p>` : ''}
            </article>
          `;
        }).join('');
      } catch (error) {
        console.warn('お客様のお声の読み込みに失敗しました:', error);
        customerVoiceTeaserStatus.textContent = '読み込み失敗';
        customerVoiceTeaserGrid.innerHTML = '<p class="voice-teaser__empty">公開事例を読み込めませんでした。時間をおいて再度お試しください。</p>';
      }
    }

    function showModal() {
      if (!modalOverlay) {
        return;
      }
      modalReturnFocusElement = document.activeElement instanceof HTMLElement ? document.activeElement : signupButtonMain;
      modalOverlay.classList.remove('modal--is-hidden');
      document.body.classList.add('is-modal-open');
      setBackgroundInert(true);
      modalCloseButton?.focus({ preventScroll: true });
      if (modalFocusTimeoutId) {
        clearTimeout(modalFocusTimeoutId);
      }
      modalFocusTimeoutId = setTimeout(() => {
        modalFocusTimeoutId = null;
        if (modalOverlay.classList.contains('modal--is-hidden')) {
          return;
        }
        const focusableElements = getModalFocusableElements();
        const firstFocusableElement = focusableElements[0] || signupNameInput || modalCloseButton;
        firstFocusableElement?.focus();
      }, 100);
    }

    function clearSignupFormErrors() {
      clearError(signupNameInput, signupNameError);
      clearError(signupEmailInput, signupEmailError);
      clearError(signupPasswordInput, signupPasswordError);
      clearError(signupPasswordConfirmInput, signupPasswordConfirmError);
      clearError(termsAgreeCheckbox, termsAgreeError);
    }

    function hideModal() {
      if (!modalOverlay) {
        return;
      }
      modalOverlay.classList.add('modal--is-hidden');
      document.body.classList.remove('is-modal-open');
      setBackgroundInert(false);
      if (modalFocusTimeoutId) {
        clearTimeout(modalFocusTimeoutId);
        modalFocusTimeoutId = null;
      }
      if (modalReturnFocusElement && document.contains(modalReturnFocusElement)) {
        modalReturnFocusElement.focus();
      } else if (signupButtonMain) {
        signupButtonMain.focus();
      }
      modalReturnFocusElement = null;
      clearSignupFormErrors();
      signupForm?.reset();
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

    function clearLoginFormErrors() {
      clearError(emailInput, emailError);
      clearError(passwordInput, passwordError);
      if (loginTermsAgreeCheckbox) {
        clearError(loginTermsAgreeCheckbox, loginTermsAgreeError);
      }
    }

    function restoreRememberedAccount() {
      if (!emailInput || !rememberAccountCheckbox) {
        return;
      }
      try {
        const rememberedAccount = localStorage.getItem(rememberedAccountStorageKey);
        if (!rememberedAccount) {
          return;
        }
        emailInput.value = rememberedAccount;
        rememberAccountCheckbox.checked = true;
      } catch (storageError) {
        console.warn('記憶したアカウントを読み込めませんでした:', storageError);
      }
    }

    function persistRememberedAccount(emailValue) {
      if (!rememberAccountCheckbox) {
        return;
      }
      try {
        if (rememberAccountCheckbox.checked && emailValue) {
          localStorage.setItem(rememberedAccountStorageKey, emailValue);
          return;
        }
        localStorage.removeItem(rememberedAccountStorageKey);
      } catch (storageError) {
        console.warn('アカウント記憶設定を保存できませんでした:', storageError);
      }
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

    function maybeOpenSignupFromIntent() {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('intent') !== 'signup') {
        return;
      }
      showModal();
      searchParams.delete('intent');
      const queryString = searchParams.toString();
      const nextUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ''}${window.location.hash || '#top'}`;
      window.history.replaceState({}, document.title, nextUrl);
    }

    function validateLoginForm() {
      let isValid = true;
      clearLoginFormErrors();
      const emailValue = emailInput?.value.trim() || '';
      const allowedTestUsers = ['user', 'new', 'admin'];
      if (!emailValue) {
        displayError(emailInput, emailError, 'メールアドレスを入力してください。');
        isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue) && !allowedTestUsers.includes(emailValue)) {
        displayError(emailInput, emailError, '有効なメールアドレスを入力してください。');
        isValid = false;
      }
      if (!allowedTestUsers.includes(emailValue)) {
        if (!passwordInput?.value) {
          displayError(passwordInput, passwordError, 'パスワードを入力してください。');
          isValid = false;
        } else if (passwordInput.value.length < 8) {
          displayError(passwordInput, passwordError, 'パスワードは8文字以上である必要があります。');
          isValid = false;
        }
      }
      if (loginTermsAgreeCheckbox && !loginTermsAgreeCheckbox.checked) {
        displayError(loginTermsAgreeCheckbox, loginTermsAgreeError, '利用規約とプライバシーポリシーへの同意が必要です。');
        isValid = false;
      }
      return isValid;
    }

    function validateSignupForm() {
      let isValid = true;
      clearSignupFormErrors();
      if (!signupEmailInput?.value.trim()) {
        displayError(signupEmailInput, signupEmailError, 'メールアドレスを入力してください。');
        isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupEmailInput.value)) {
        displayError(signupEmailInput, signupEmailError, '有効なメールアドレスを入力してください。');
        isValid = false;
      }
      if (!signupPasswordInput?.value) {
        displayError(signupPasswordInput, signupPasswordError, 'パスワードを入力してください。');
        isValid = false;
      } else if (signupPasswordInput.value.length < 8) {
        displayError(signupPasswordInput, signupPasswordError, 'パスワードは8文字以上である必要があります。');
        isValid = false;
      } else if (!/[A-Za-z]/.test(signupPasswordInput.value) || !/[0-9]/.test(signupPasswordInput.value)) {
        displayError(signupPasswordInput, signupPasswordError, 'パスワードは半角英数字を組み合わせてください。');
        isValid = false;
      }
      if (!signupPasswordConfirmInput?.value) {
        displayError(signupPasswordConfirmInput, signupPasswordConfirmError, '確認用パスワードを入力してください。');
        isValid = false;
      } else if (signupPasswordConfirmInput.value !== signupPasswordInput.value) {
        displayError(signupPasswordConfirmInput, signupPasswordConfirmError, 'パスワードが一致しません。');
        if (signupPasswordInput.value && signupPasswordInput.getAttribute('aria-invalid') === 'false') {
          displayError(signupPasswordInput, signupPasswordError, 'パスワードが一致しません。');
        }
        isValid = false;
      }
      if (termsAgreeCheckbox && !termsAgreeCheckbox.checked) {
        displayError(termsAgreeCheckbox, termsAgreeError, '利用規約とプライバシーポリシーへの同意が必要です。');
        isValid = false;
      }
      return isValid;
    }

    signupTriggerButtons.forEach((signupTriggerButton) => {
      signupTriggerButton.addEventListener('click', (event) => {
        event.preventDefault();
        showModal();
        event.currentTarget.blur();
      });
    });

    if (modalOverlay) {
      modalOverlay.addEventListener('click', (event) => {
        if (event.target === modalOverlay) {
          hideModal();
        }
      });
    }

    if (modalCloseButton) {
      modalCloseButton.addEventListener('click', hideModal);
    }

    document.addEventListener('keydown', (event) => {
      if (!modalOverlay || modalOverlay.classList.contains('modal--is-hidden')) {
        return;
      }
      if (event.key === 'Escape') {
        hideModal();
        return;
      }
      if (event.key === 'Tab') {
        const focusableElements = getModalFocusableElements();
        if (!focusableElements.length) {
          event.preventDefault();
          return;
        }
        const firstFocusableElement = focusableElements[0];
        const lastFocusableElement = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === firstFocusableElement) {
          event.preventDefault();
          lastFocusableElement.focus();
        } else if (!event.shiftKey && document.activeElement === lastFocusableElement) {
          event.preventDefault();
          firstFocusableElement.focus();
        }
      }
    });

    if (showLoginLinkFromModal) {
      showLoginLinkFromModal.addEventListener('click', (event) => {
        event.preventDefault();
        hideModal();
        emailInput?.focus();
      });
    }

    [googleButtonMain, googleButtonModal].forEach((button) => {
      if (!button) {
        return;
      }
      button.addEventListener('click', async (event) => {
        event.preventDefault();
        showLoading(button, '連携中...');
        try {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          alert('Google認証シミュレーション: 成功しました！');
        } catch (error) {
          console.error('Google認証エラー:', error);
          alert('Google認証に失敗しました。');
        } finally {
          hideLoading(button);
        }
      });
    });

    scenarioAccountLinks.forEach((scenarioAccountLink) => {
      scenarioAccountLink.addEventListener('click', (event) => {
        event.preventDefault();
        const email = scenarioAccountLink.dataset.email;
        if (!emailInput || !email) {
          return;
        }
        emailInput.value = email;
        clearLoginFormErrors();
        scenarioAccountLink.closest('details')?.removeAttribute('open');
        loginButton?.focus();
      });
    });

    if (loginForm) {
      loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!validateLoginForm()) {
          return;
        }
        if (!loginButton) {
          return;
        }
        showLoading(loginButton, 'ログイン中...');
        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const textNode = getButtonTextNode(loginButton);
          if (textNode) {
            textNode.nodeValue = 'モックです。2秒後に遷移します...';
          }
          await new Promise((resolve) => setTimeout(resolve, 2000));
          const userEmail = emailInput?.value.trim() || '';
          persistRememberedAccount(userEmail);
          let targetUrl = resolveAppPath('02_dashboard/index.html');
          let tutorialStatus = 'completed';
          if (userEmail === 'admin') {
            targetUrl = resolveAppPath('03_admin/index.html');
          } else if (userEmail === 'new') {
            targetUrl = resolveAppPath('04_first-login/index.html');
            tutorialStatus = 'pending';
          }
          try {
            localStorage.setItem('speedad-tutorial-status', tutorialStatus);
            localStorage.removeItem('speedad-tutorial-last-survey-params');
          } catch (storageError) {
            console.warn('ローカルストレージにチュートリアル状態を保存できませんでした:', storageError);
          }
          window.location.href = targetUrl;
        } catch (error) {
          console.error('ログインエラー:', error);
          displayError(passwordInput, passwordError, 'メールアドレスまたはパスワードが正しくありません。');
        } finally {
          hideLoading(loginButton);
        }
      });
    }

    if (passwordInput && passwordToggle) {
      passwordToggle.addEventListener('click', () => {
        const shouldShow = passwordInput.type === 'password';
        passwordInput.type = shouldShow ? 'text' : 'password';
        passwordToggle.setAttribute('aria-pressed', String(shouldShow));
        passwordToggle.setAttribute('aria-label', shouldShow ? 'パスワードを非表示にする' : 'パスワードを表示する');
      });
    }

    if (signupForm) {
      signupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!validateSignupForm()) {
          return;
        }
        if (!signupAccountButton) {
          return;
        }
        showLoading(signupAccountButton, '作成中...');
        try {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          alert('アカウントが作成されました！ログインしてください。');
          hideModal();
          if (emailInput && signupEmailInput) {
            emailInput.value = signupEmailInput.value;
          }
          passwordInput?.focus();
        } catch (error) {
          console.error('サインアップエラー:', error);
          displayError(signupEmailInput, signupEmailError, 'このメールアドレスは既に使用されています。');
        } finally {
          hideLoading(signupAccountButton);
        }
      });
    }

    const inputsToClear = [
      emailInput,
      passwordInput,
      loginTermsAgreeCheckbox,
      signupNameInput,
      signupEmailInput,
      signupPasswordInput,
      signupPasswordConfirmInput,
      termsAgreeCheckbox
    ];

    inputsToClear.forEach((input) => {
      if (!input) {
        return;
      }
      input.addEventListener('input', () => {
        let errorElement;
        if (input === emailInput) {
          errorElement = emailError;
        } else if (input === passwordInput) {
          errorElement = passwordError;
        } else if (input === loginTermsAgreeCheckbox) {
          errorElement = loginTermsAgreeError;
        } else if (input === signupNameInput) {
          errorElement = signupNameError;
        } else if (input === signupEmailInput) {
          errorElement = signupEmailError;
        } else if (input === signupPasswordInput) {
          errorElement = signupPasswordError;
        } else if (input === signupPasswordConfirmInput) {
          errorElement = signupPasswordConfirmError;
        } else if (input === termsAgreeCheckbox) {
          errorElement = termsAgreeError;
        }
        if (errorElement && input.getAttribute('aria-invalid') === 'true') {
          clearError(input, errorElement);
        }
        if (input.id === 'signup-password-confirm' && signupPasswordInput?.value === signupPasswordConfirmInput?.value) {
          if (signupPasswordInput?.getAttribute('aria-invalid') === 'true' && signupPasswordError.textContent === 'パスワードが一致しません。') {
            clearError(signupPasswordInput, signupPasswordError);
          }
        }
        if (input.id === 'signup-password' && signupPasswordInput?.value === signupPasswordConfirmInput?.value) {
          if (signupPasswordConfirmInput?.getAttribute('aria-invalid') === 'true' && signupPasswordConfirmError.textContent === 'パスワードが一致しません。') {
            clearError(signupPasswordConfirmInput, signupPasswordConfirmError);
          }
        }
      });
      if (input.type === 'checkbox') {
        input.addEventListener('change', () => {
          if (input.checked && input.getAttribute('aria-invalid') === 'true') {
            const errorElement = input === loginTermsAgreeCheckbox ? loginTermsAgreeError : termsAgreeError;
            clearError(input, errorElement);
          }
        });
      }
    });

    restoreRememberedAccount();

    if (loginForm && emailInput) {
      emailInput.focus();
    }

    loadPublicNews();
    loadCustomerVoiceTeasers();
    maybeOpenSignupFromIntent();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapLoginFront);
  } else {
    bootstrapLoginFront();
  }
})();
