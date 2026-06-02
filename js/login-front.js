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

  function isValidRelativeNewsPath(value) {
    return typeof value === 'string' && /^05_support\/news\/([a-z0-9_-]+\/?)?$/i.test(value);
  }

  function pickPublicNewsUrl(candidateUrl, fallbackUrl) {
    if (isHttpUrl(candidateUrl)) {
      return candidateUrl;
    }
    if (isValidRelativeNewsPath(candidateUrl)) {
      return resolveAppPath(candidateUrl);
    }
    if (isHttpUrl(fallbackUrl)) {
      return fallbackUrl;
    }
    if (isValidRelativeNewsPath(fallbackUrl)) {
      return resolveAppPath(fallbackUrl);
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
    const rememberAccountCheckbox = document.getElementById('remember-account');
    const loginButton = loginForm?.querySelector('.button--filled');
    const googleButtonMain = document.querySelector('.login-panel .button--google');
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
      const newsEndpoint = publicNewsSection.dataset.newsEndpoint || '05_support/assets/data/news.json';
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
          customerVoiceTeaserGrid.setAttribute('aria-busy', 'false');
          customerVoiceTeaserGrid.innerHTML = '<p class="voice-teaser__empty">事例は順次公開予定です。一覧ページからもご確認いただけます。</p>';
          return;
        }
        customerVoiceTeaserGrid.setAttribute('aria-busy', 'false');
        customerVoiceTeaserGrid.innerHTML = voices.map((voice) => {
          const heroImage = resolveAppPath(voice.heroImage || 'img/top-kv.jpg');
          const orgType = voice.organizationType || voice.label || '';
          const title = voice.voicePageHeadline || voice.voicePageLabel || voice.label || '';
          const quoteText = voice.teaserQuote || (voice.quote?.text ? voice.quote.text.slice(0, 100) + (voice.quote.text.length > 100 ? '…' : '') : '') || voice.listingSummary || '';
          const author = voice.publicQuoteAuthor || voice.quote?.author || '';
          const descriptor = voice.organizationDescriptor || '';
          const detailUrl = `https://support.speed-ad.com/customer-voices/${voice.slug || ''}/`;
          const accent = voice.accent || '#f3e2c1';
          const accentStrong = voice.accentStrong || accent;
          const features = Array.isArray(voice.teaserTags) ? voice.teaserTags.slice(0, 4) : (Array.isArray(voice.usedFeatures) ? voice.usedFeatures.slice(0, 4) : []);
          const altText = title ? title + 'のイメージ' : '公開事例の写真';
          const featureChips = features.length
            ? `<ul class="voice-teaser-card__chips" aria-label="活用した機能">${features.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ul>`
            : '';
          const styleAttr = `style="--voice-accent: ${escapeHtml(accent)}; --voice-accent-strong: ${escapeHtml(accentStrong)};"`;
          return `
            <a class="voice-teaser-card" href="${escapeHtml(detailUrl)}" ${styleAttr} aria-label="${escapeHtml(title + ' の事例を読む')}">
              <span class="voice-teaser-card__stripe" aria-hidden="true"></span>
              <div class="voice-teaser-card__media">
                <img src="${escapeHtml(heroImage)}" alt="${escapeHtml(altText)}" loading="lazy">
              </div>
              <div class="voice-teaser-card__body">
                ${orgType ? `<span class="voice-teaser-card__pill">${escapeHtml(orgType)}</span>` : ''}
                ${title ? `<h3 class="voice-teaser-card__title">${escapeHtml(title)}</h3>` : ''}
                <blockquote class="voice-teaser-card__quote">${escapeHtml(quoteText)}</blockquote>
                ${featureChips}
                ${descriptor ? `<p class="voice-teaser-card__descriptor">${escapeHtml(descriptor)}</p>` : ''}
                ${author ? `<p class="voice-teaser-card__author">${escapeHtml(author)}</p>` : ''}
                <span class="voice-teaser-card__more" aria-hidden="true">詳細を見る <span aria-hidden="true">→</span></span>
              </div>
            </a>
          `;
        }).join('');
      } catch (error) {
        console.warn('お客様のお声の読み込みに失敗しました:', error);
        customerVoiceTeaserStatus.textContent = '読み込み失敗';
        customerVoiceTeaserGrid.setAttribute('aria-busy', 'false');
        customerVoiceTeaserGrid.innerHTML = '<p class="voice-teaser__empty">公開事例を表示できません。<a class="voice-teaser__inline-link" href="https://support.speed-ad.com/customer-voices/">一覧ページから事例を見る</a></p>';
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
          let isNewUser = false;
          if (userEmail === 'admin') {
            targetUrl = resolveAppPath('03_admin/index.html');
          } else if (userEmail === 'new') {
            targetUrl = resolveAppPath('05_support/tutorial/survey-creation.html?tutorial=1&step=1');
            isNewUser = true;
          }
          try {
            if (isNewUser) {
              localStorage.removeItem('speedad-tutorial-completed');
              localStorage.removeItem('speedad-tutorial-progress');
            } else {
              localStorage.setItem('speedad-tutorial-completed', '1');
            }
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
            clearError(input, termsAgreeError);
          }
        });
      }
    });

    restoreRememberedAccount();
    setupSiteTopHamburger();
    if (loginForm && emailInput) {
      emailInput.focus();
    }

    loadPublicNews();
    loadCustomerVoiceTeasers();
    maybeOpenSignupFromIntent();
  }

  const HERO_COPY_GROUPS = [
    {
      label: 'A. 重厚・和風',
      variants: [
        { id: 'A1', label: 'A1. 展示会の一会を、確かな商談へ。', statement: '展示会の一会を、<br>確かな商談へ。', lead: 'QR受付・名刺整理・御礼配信を一貫して。<br>展示会後の一手を、淀みなく。', reason: '【A.重厚・和風／矜持】既存「〜へ。」語尾を継承、抽象「成果」を「商談」に具体化。漢字比65%でセリフ書体と整合。' },
        { id: 'A2', label: 'A2. 展示会の邂逅を、成果に変える。', statement: '展示会の邂逅を、<br>成果に変える。', lead: '来場者情報の集約から御礼配信まで、<br>追客の所作を一本に整える。', reason: '【A.重厚・和風／古風】「邂逅」で和の重みを強める。動詞着地で具体性も両立。' },
        { id: 'A3', label: 'A3. 出会いの記憶を、組織の資産へ。', statement: '出会いの記憶を、<br>組織の資産へ。', lead: 'QRで集めた回答も、名刺の情報も、御礼メールの記録も。<br>すべてを組織の知見へ。', reason: '【A.重厚・和風／誠実】個人の名刺を組織の資産に転換するエンタープライズ訴求。' }
      ]
    },
    {
      label: 'B. 動詞着地・BeforeAfter',
      variants: [
        { id: 'B1', label: 'B1. 展示会の名刺を、商談に変える。', statement: '展示会の名刺を、<br>商談に変える。', lead: 'QR回答・名刺データ化・御礼メールを一気通貫。<br>展示会"後"の追客に特化したSaaS。', reason: '【B.動詞着地／直截】3秒理解。動詞「変える」で価値を即着地。CTA直結型。' },
        { id: 'B2', label: 'B2. 出会いを、商談に育てる。', statement: '出会いを、商談に育てる。', lead: 'QRアンケート・名刺データ化・御礼メールで、<br>展示会の一期一会を継続的な関係へ。', reason: '【B.動詞着地／育成】「育てる」でナーチャリングのニュアンス。中長期的な関係訴求。' },
        { id: 'B3', label: 'B3. 名刺を、売上の起点に。', statement: '名刺を、売上の起点に。', lead: 'QRアンケート・名刺データ化・御礼メールで、<br>来場者を確度の高い商談に転換します。', reason: '【B.動詞着地／ビジネス直結】売上に直接紐づける、決裁者向けのストレート訴求。' }
      ]
    },
    {
      label: 'C. 時間軸・スピード',
      variants: [
        { id: 'C1', label: 'C1. 会期後72時間が、商談率を決める。', statement: '会期後72時間が、<br>商談率を決める。', lead: 'QR回答・名刺データ化・御礼メールを当日中に。<br>展示会の熱量を逃さない仕組み。', reason: '【C.時間軸／緊急性】「72時間」で具体的な勝負の窓を提示。数値根拠の用意が必須。' },
        { id: 'C2', label: 'C2. 展示会の熱を、冷ます前に。', statement: '展示会の熱を、冷ます前に。', lead: 'QRアンケートも名刺データも、御礼メールも。<br>会期翌日には届けられる速度で。', reason: '【C.時間軸／余韻】熱量が冷める前に動く必要性を訴求。比喩で重さも残す。' },
        { id: 'C3', label: 'C3. 翌日には、追客が動き出す。', statement: '翌日には、追客が動き出す。', lead: 'QR受付・名刺データ化・御礼メールが連動。<br>展示会終了とともに追客が始まります。', reason: '【C.時間軸／スピード】「翌日」で展示会後の即応性を可視化。プロダクト体験訴求。' }
      ]
    },
    {
      label: 'D. 価格・無料訴求',
      variants: [
        { id: 'D1', label: 'D1. 100名まで無料。展示会の追客SaaS。', statement: '100名まで無料。<br>展示会の追客SaaS。', lead: 'QRアンケート・名刺データ化・御礼メールが揃って、<br>100名まで完全無料で使えます。', reason: '【D.価格／CVR最優先】無料訴求と特化型SaaSの差別化を冒頭固定。CVR向上に直結。' },
        { id: 'D2', label: 'D2. 1通から、追客を整える。', statement: '1通から、追客を整える。', lead: 'QRアンケート・名刺データ化・御礼メールを必要な分だけ。<br>展示会のフォローを始めやすく。', reason: '【D.価格／スモールスタート】小さく始められる柔軟性訴求。「整える」で品格保持。' }
      ]
    },
    {
      label: 'E. 痛点・機会損失',
      variants: [
        { id: 'E1', label: 'E1. その名刺、眠らせていませんか。', statement: 'その名刺、<br>眠らせていませんか。', lead: 'QRアンケート・名刺データ化・御礼メールで、<br>集めた情報を確実な接点に変える。', reason: '【E.痛点／罪悪感】問いかけで内省を誘発。SNS引用性高、ブランド想起残存。' },
        { id: 'E2', label: 'E2. 失注の半分は、追客の遅れから。', statement: '失注の半分は、<br>追客の遅れから。', lead: 'QR回答・名刺データ化・御礼メールで、<br>展示会後の追客を最速で届ける仕組み。', reason: '【E.痛点／データ】営業組織の課題に直接刺す。数値根拠の用意が前提。' },
        { id: 'E3', label: 'E3. 集めた名刺を、眠らせない。', statement: '集めた名刺を、眠らせない。', lead: 'QRアンケート・名刺データ化・御礼メールを連動させ、<br>すべての出会いに次の一手を。', reason: '【E.痛点／守りの強さ】コミット型の言い切りで強い決意を表現。' }
      ]
    },
    {
      label: 'F. 問いかけ',
      variants: [
        { id: 'F1', label: 'F1. 展示会後、本当に届いていますか。', statement: '展示会後、<br>本当に届いていますか。', lead: 'QRアンケート・名刺データ化・御礼メールを一括で。<br>展示会の出会いを、確実に商談へ。', reason: '【F.問いかけ／内省】読み手にメールが届いているか自問させる、誠実トーン。' },
        { id: 'F2', label: 'F2. その出会い、商談まで運べていますか。', statement: 'その出会い、<br>商談まで運べていますか。', lead: 'QR回答・名刺データ化・御礼メールが連携。<br>来場者を商談まで丁寧に運びます。', reason: '【F.問いかけ／共感喚起】商談化までの距離を意識させる、現場目線。' }
      ]
    },
    {
      label: 'G. ジョブ理論・解決系',
      variants: [
        { id: 'G1', label: 'G1. 展示会の追客を、属人化から解放する。', statement: '展示会の追客を、<br>属人化から解放する。', lead: 'QR受付・名刺データ化・御礼メールをチームで運用。<br>誰が担当しても同じ品質で動きます。', reason: '【G.ジョブ理論／組織課題】属人化＝展示会担当者の最大の悩み。組織導入訴求。' },
        { id: 'G2', label: 'G2. 来場者の熱量を、商談に変える仕組み。', statement: '来場者の熱量を、<br>商談に変える仕組み。', lead: 'QRアンケート・名刺データ化・御礼メールを連携し、<br>来場者を商談に変える追客プロセスを自動化。', reason: '【G.ジョブ理論／プロダクト原理】仕組み化で属人性を排除する価値訴求。' }
      ]
    },
    {
      label: 'H. 短文・キャッチ',
      variants: [
        { id: 'H1', label: 'H1. 出会いから、商談へ。', statement: '出会いから、商談へ。', lead: 'QR回答・名刺データ化・御礼メールが、<br>展示会の追客を最短ルートで支援します。', reason: '【H.短文／ミニマル】9字。最短で価値を伝える宣言型。背景画像と組合せで余白を活かす。' },
        { id: 'H2', label: 'H2. 展示会後を、変える。', statement: '展示会後を、変える。', lead: 'QRアンケート・名刺データ化・御礼メールで、<br>展示会後の追客業務を根本から変えます。', reason: '【H.短文／宣言】9字。動詞着地と短さで強い印象。意味は抽象的。' }
      ]
    },
    {
      label: 'I. ブランド名活用',
      variants: [
        { id: 'I1', label: 'I1. その出会いに、SPEEDを。', statement: 'その出会いに、SPEEDを。', lead: 'QRアンケート・名刺データ化・御礼メールが揃ったSPEED ADで、<br>展示会の追客を最速に。', reason: '【I.ブランド／プロダクト訴求】サービス名を直接織り込み、想起と速度感を結びつける。' },
        { id: 'I2', label: 'I2. 展示会の出会いを、最短で商談へ。', statement: '展示会の出会いを、<br>最短で商談へ。', lead: 'QR回答・名刺データ化・御礼メールを一気通貫。<br>展示会後の追客を、最短ルートで支援します。', reason: '【I.ブランド／継承】既存「出会いを〜へ。」を継承し、「最短」でSPEED ADの名前を暗示。' }
      ]
    }
  ];

  function setupHeroCopyPicker() {
    const toggle = document.getElementById('hero-copy-picker-toggle');
    const panel = document.getElementById('hero-copy-picker-panel');
    const picker = toggle?.closest('[data-mock-tool]');
    const select = document.getElementById('hero-copy-picker-select');
    const statementEl = document.getElementById('hero-statement');
    const leadEl = document.getElementById('hero-lead');
    const reasonEl = document.getElementById('hero-copy-picker-reason');
    if (!toggle || !panel || !picker || !select || !statementEl || !leadEl || !reasonEl) {
      return;
    }
    const customBlock = document.getElementById('hero-copy-picker-custom');
    const customStatementInput = document.getElementById('hero-copy-picker-custom-statement');
    const customLeadInput = document.getElementById('hero-copy-picker-custom-lead');
    const fontEditModeInput = document.getElementById('hero-font-edit-mode');
    const fontSelectionLabel = document.getElementById('hero-font-selection-label');
    const fontValueMemo = document.getElementById('hero-font-value-memo');
    const fontResetButton = document.getElementById('hero-font-reset-button');

    const STORAGE_KEY = 'speedad-hero-copy-variant';
    const POSITION_STORAGE_KEY = 'speedad-mock-tool-position';
    const CUSTOM_ID = 'custom';
    const CUSTOM_STATEMENT_KEY = 'speedad-hero-copy-custom-statement';
    const CUSTOM_LEAD_KEY = 'speedad-hero-copy-custom-lead';
    const BRAND_TEXT_KEY = 'speedad-hero-brand-text';
    const FONT_OBJECT_STORAGE_KEY = 'speedad-hero-font-objects';
    const FONT_EDIT_MODE_STORAGE_KEY = 'speedad-hero-font-edit-mode';
    const DEFAULT_BRAND_TEXT = 'SPEED\nAD';
    const DEFAULT_CUSTOM_STATEMENT = 'スピードをアドバンテージに。';
    const DEFAULT_CUSTOM_LEAD = '展示会やイベントのリード獲得フォローを最適化する、\n次世代WEBアンケート作成ツール。';
    const DEFAULT_VARIANT = {
      id: 'default',
      statement: 'スピードをアドバンテージに。',
      lead: '展示会やイベントのリード獲得フォローを最適化する、<br>次世代WEBアンケート作成ツール。',
      reason: 'デフォルト（現行コピー）。営業プロセスの無駄を減らすリード獲得ツールとして訴求。'
    };
    const fontObjects = {
      brand: {
        el: document.getElementById('hero-title'),
        label: 'SPEED AD',
        sizeVar: '--hero-brand-size',
        xVar: '--hero-brand-x',
        yVar: '--hero-brand-y',
        minSize: 48,
        maxSize: 200
      },
      statement: {
        el: statementEl,
        label: '見出し',
        sizeVar: '--hero-statement-size',
        xVar: '--hero-statement-x',
        yVar: '--hero-statement-y',
        minSize: 18,
        maxSize: 96
      },
      lead: {
        el: leadEl,
        label: 'リード文',
        sizeVar: '--hero-lead-size',
        xVar: '--hero-lead-x',
        yVar: '--hero-lead-y',
        minSize: 12,
        maxSize: 48
      }
    };
    const fontObjectDefaults = new Map();
    Object.entries(fontObjects).forEach(([id, config]) => {
      const size = parseFloat(window.getComputedStyle(config.el).fontSize);
      fontObjectDefaults.set(id, {
        size: Number.isFinite(size) ? Math.round(size) : 16,
        x: 0,
        y: 0
      });
    });
    const fontObjectSettings = loadFontObjectSettings();
    const fontOverlay = createFontObjectOverlay();
    let selectedFontObjectId = '';
    let fontEditGesture = null;

    const allVariants = new Map();
    allVariants.set(DEFAULT_VARIANT.id, DEFAULT_VARIANT);

    const defaultGroupEl = document.createElement('optgroup');
    defaultGroupEl.label = 'デフォルト';
    const defaultOption = document.createElement('option');
    defaultOption.value = DEFAULT_VARIANT.id;
    defaultOption.textContent = 'デフォルト（現行）';
    defaultGroupEl.appendChild(defaultOption);
    select.appendChild(defaultGroupEl);
    if (customBlock && customStatementInput && customLeadInput) {
      const customGroupEl = document.createElement('optgroup');
      customGroupEl.label = 'カスタム';
      const customOption = document.createElement('option');
      customOption.value = CUSTOM_ID;
      customOption.textContent = 'カスタム入力（自由記述）';
      customGroupEl.appendChild(customOption);
      select.appendChild(customGroupEl);
    }

    HERO_COPY_GROUPS.forEach((group) => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      group.variants.forEach((variant) => {
        allVariants.set(variant.id, variant);
        const option = document.createElement('option');
        option.value = variant.id;
        option.textContent = variant.label;
        optgroup.appendChild(option);
      });
      select.appendChild(optgroup);
    });

    function multilineToHtml(text) {
      return escapeHtml(text).replace(/\r?\n/g, '<br>');
    }

    function htmlToMultiline(html) {
      return String(html ?? '').replace(/<br\s*\/?>/gi, '\n');
    }

    function elementToMultiline(element) {
      const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          return node.nodeValue || '';
        }
        if (node.nodeName === 'BR') {
          return '\n';
        }
        return Array.from(node.childNodes).map(walk).join('');
      };
      return walk(element).replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    }

    function focusEditableText(element) {
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      element.focus();
    }

    function clampNumber(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function normalizeFontValue(value, fallback) {
      const number = Number(value);
      return Number.isFinite(number) ? number : fallback;
    }

    function loadFontObjectSettings() {
      try {
        const rawSettings = window.localStorage.getItem(FONT_OBJECT_STORAGE_KEY);
        if (!rawSettings) {
          return {};
        }
        const parsed = JSON.parse(rawSettings);
        if (!parsed || typeof parsed !== 'object') {
          return {};
        }
        return parsed;
      } catch (_error) {
        return {};
      }
    }

    function saveFontObjectSettings() {
      try {
        window.localStorage.setItem(FONT_OBJECT_STORAGE_KEY, JSON.stringify(fontObjectSettings));
      } catch (_error) {
        /* localStorage unavailable */
      }
    }

    function createFontObjectOverlay() {
      const root = document.createElement('div');
      root.className = 'hero-font-object-overlay';
      root.hidden = true;
      root.innerHTML = '<span class="hero-font-object-overlay__label"></span><span class="hero-font-object-overlay__handle" aria-hidden="true"></span>';
      document.body.appendChild(root);
      return {
        root,
        label: root.querySelector('.hero-font-object-overlay__label'),
        handle: root.querySelector('.hero-font-object-overlay__handle')
      };
    }

    function getFontObjectSetting(id) {
      const defaults = fontObjectDefaults.get(id) || { size: 16, x: 0, y: 0 };
      const saved = fontObjectSettings[id] || {};
      return {
        size: Math.round(normalizeFontValue(saved.size, defaults.size)),
        x: Math.round(normalizeFontValue(saved.x, defaults.x)),
        y: Math.round(normalizeFontValue(saved.y, defaults.y))
      };
    }

    function setFontObjectSetting(id, nextSetting) {
      const config = fontObjects[id];
      if (!config?.el) {
        return;
      }
      const current = getFontObjectSetting(id);
      fontObjectSettings[id] = {
        size: clampNumber(Math.round(normalizeFontValue(nextSetting.size, current.size)), config.minSize, config.maxSize),
        x: Math.round(normalizeFontValue(nextSetting.x, current.x)),
        y: Math.round(normalizeFontValue(nextSetting.y, current.y))
      };
      applyFontObjectSetting(id);
      saveFontObjectSettings();
      updateFontOverlayPosition();
      updateFontSelectionUi();
    }

    function applyFontObjectSetting(id) {
      const config = fontObjects[id];
      if (!config?.el) {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(fontObjectSettings, id)) {
        config.el.style.removeProperty(config.sizeVar);
        config.el.style.removeProperty(config.xVar);
        config.el.style.removeProperty(config.yVar);
        return;
      }
      const setting = getFontObjectSetting(id);
      config.el.style.setProperty(config.sizeVar, `${setting.size}px`);
      config.el.style.setProperty(config.xVar, `${setting.x}px`);
      config.el.style.setProperty(config.yVar, `${setting.y}px`);
    }

    function applyAllFontObjectSettings() {
      Object.keys(fontObjects).forEach((id) => applyFontObjectSetting(id));
    }

    function exportFontObjectSettings() {
      return Object.entries(fontObjects).reduce((result, [id, config]) => {
        const setting = getFontObjectSetting(id);
        result[id] = {
          label: config.label,
          size: `${setting.size}px`,
          x: `${setting.x}px`,
          y: `${setting.y}px`,
          css: {
            [config.sizeVar]: `${setting.size}px`,
            [config.xVar]: `${setting.x}px`,
            [config.yVar]: `${setting.y}px`
          }
        };
        return result;
      }, {});
    }

    function formatFontObjectMemo() {
      return Object.entries(fontObjects).map(([id, config]) => {
        const setting = getFontObjectSetting(id);
        const selectedMark = id === selectedFontObjectId ? '* ' : '';
        return `${selectedMark}${config.label}: ${setting.size}px / x ${setting.x}px / y ${setting.y}px`;
      }).join('\n');
    }

    function updateFontSelectionUi() {
      const config = fontObjects[selectedFontObjectId];
      if (fontSelectionLabel) {
        fontSelectionLabel.textContent = config
          ? `選択中: ${config.label}。ドラッグで移動、右下ハンドルでサイズ調整、ダブルクリックで文言を編集できます。`
          : '編集モードをONにして、文字を直接つかんで調整できます。文字のダブルクリックで文言編集に入れます。';
      }
      if (fontValueMemo) {
        fontValueMemo.textContent = formatFontObjectMemo();
      }
      if (fontResetButton) {
        fontResetButton.disabled = !config;
      }
      Object.entries(fontObjects).forEach(([id, item]) => {
        item.el.classList.toggle('is-hero-font-selected', id === selectedFontObjectId);
      });
    }

    function updateFontOverlayPosition() {
      const config = fontObjects[selectedFontObjectId];
      if (!config?.el || !document.body.classList.contains('is-hero-font-editing')) {
        fontOverlay.root.hidden = true;
        return;
      }
      const rect = config.el.getBoundingClientRect();
      const margin = 8;
      fontOverlay.root.hidden = false;
      fontOverlay.root.style.left = `${rect.left - margin}px`;
      fontOverlay.root.style.top = `${rect.top - margin}px`;
      fontOverlay.root.style.width = `${rect.width + margin * 2}px`;
      fontOverlay.root.style.height = `${rect.height + margin * 2}px`;
      if (fontOverlay.label) {
        const setting = getFontObjectSetting(selectedFontObjectId);
        fontOverlay.label.textContent = `${config.label} ${setting.size}px`;
      }
    }

    function selectFontObject(id) {
      if (!fontObjects[id]) {
        return;
      }
      selectedFontObjectId = id;
      updateFontSelectionUi();
      updateFontOverlayPosition();
    }

    function resetFontObject(id) {
      const config = fontObjects[id];
      if (!config?.el) {
        return;
      }
      delete fontObjectSettings[id];
      config.el.style.removeProperty(config.sizeVar);
      config.el.style.removeProperty(config.xVar);
      config.el.style.removeProperty(config.yVar);
      saveFontObjectSettings();
      updateFontSelectionUi();
      updateFontOverlayPosition();
    }

    function resetSelectedFontObject() {
      if (selectedFontObjectId) {
        resetFontObject(selectedFontObjectId);
      }
    }

    function syncCustomCopyFromHero() {
      if (!customStatementInput || !customLeadInput) {
        return;
      }
      customStatementInput.value = elementToMultiline(statementEl);
      customLeadInput.value = elementToMultiline(leadEl);
      select.value = CUSTOM_ID;
      if (customBlock) {
        customBlock.hidden = false;
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, CUSTOM_ID);
      } catch (_error) {
        /* localStorage unavailable */
      }
      saveCustom();
      reasonEl.textContent = 'カスタム入力モード。見出しとリード文を自由に編集できます（入力内容はブラウザに保存されます）。';
    }

    function saveInlineTextEdit(id, text) {
      const config = fontObjects[id];
      if (!config?.el) {
        return;
      }
      const nextText = text.trim() || (id === 'brand' ? DEFAULT_BRAND_TEXT : elementToMultiline(config.el));
      config.el.innerHTML = multilineToHtml(nextText);
      if (id === 'brand') {
        try {
          window.localStorage.setItem(BRAND_TEXT_KEY, nextText);
        } catch (_error) {
          /* localStorage unavailable */
        }
      } else {
        syncCustomCopyFromHero();
      }
      updateFontOverlayPosition();
      updateFontSelectionUi();
    }

    function finishInlineTextEdit(id, shouldCommit = true) {
      const config = fontObjects[id];
      if (!config?.el || !config.el.classList.contains('is-hero-text-editing')) {
        return;
      }
      const originalText = config.el.dataset.inlineEditOriginal || '';
      const nextText = shouldCommit ? elementToMultiline(config.el) : originalText;
      config.el.removeAttribute('contenteditable');
      config.el.classList.remove('is-hero-text-editing');
      delete config.el.dataset.inlineEditOriginal;
      document.body.classList.remove('is-hero-text-editing');
      saveInlineTextEdit(id, nextText);
    }

    function startInlineTextEdit(id) {
      const config = fontObjects[id];
      if (!config?.el) {
        return;
      }
      if (fontEditGesture) {
        finishFontEditGesture();
      }
      setFontEditMode(true);
      try {
        window.localStorage.setItem(FONT_EDIT_MODE_STORAGE_KEY, 'true');
      } catch (_error) {
        /* localStorage unavailable */
      }
      selectFontObject(id);
      config.el.dataset.inlineEditOriginal = elementToMultiline(config.el);
      config.el.setAttribute('contenteditable', 'plaintext-only');
      config.el.classList.add('is-hero-text-editing');
      document.body.classList.add('is-hero-text-editing');
      fontOverlay.root.hidden = true;
      if (fontSelectionLabel) {
        fontSelectionLabel.textContent = `入力中: ${config.label}。Enterで確定、Shift+Enterで改行、Escでキャンセルできます。`;
      }
      focusEditableText(config.el);
    }

    function beginFontEditGesture(event, id, type) {
      if (document.body.classList.contains('is-hero-text-editing')) {
        return;
      }
      if (event.button !== 0 && event.pointerType === 'mouse') {
        return;
      }
      selectFontObject(id);
      const setting = getFontObjectSetting(id);
      fontEditGesture = {
        id,
        type,
        startX: event.clientX,
        startY: event.clientY,
        base: setting
      };
      document.body.classList.add('is-hero-font-dragging');
      event.preventDefault();
      event.stopPropagation();
    }

    function updateFontEditGesture(event) {
      if (!fontEditGesture) {
        return;
      }
      const dx = event.clientX - fontEditGesture.startX;
      const dy = event.clientY - fontEditGesture.startY;
      const config = fontObjects[fontEditGesture.id];
      if (!config) {
        return;
      }
      if (fontEditGesture.type === 'resize') {
        const delta = (dx + dy) * 0.42;
        setFontObjectSetting(fontEditGesture.id, {
          ...fontEditGesture.base,
          size: clampNumber(fontEditGesture.base.size + delta, config.minSize, config.maxSize)
        });
        return;
      }
      setFontObjectSetting(fontEditGesture.id, {
        ...fontEditGesture.base,
        x: fontEditGesture.base.x + dx,
        y: fontEditGesture.base.y + dy
      });
    }

    function finishFontEditGesture() {
      if (!fontEditGesture) {
        return;
      }
      fontEditGesture = null;
      document.body.classList.remove('is-hero-font-dragging');
    }

    function setFontEditMode(isEnabled) {
      document.body.classList.toggle('is-hero-font-editing', isEnabled);
      if (fontEditModeInput) {
        fontEditModeInput.checked = isEnabled;
      }
      Object.values(fontObjects).forEach((config) => {
        config.el.tabIndex = isEnabled ? 0 : -1;
      });
      if (!isEnabled) {
        fontOverlay.root.hidden = true;
      } else {
        updateFontOverlayPosition();
      }
      updateFontSelectionUi();
    }

    function applyCustom() {
      if (!customStatementInput || !customLeadInput) {
        return;
      }
      statementEl.innerHTML = multilineToHtml(customStatementInput.value);
      leadEl.innerHTML = multilineToHtml(customLeadInput.value);
      updateFontOverlayPosition();
    }

    function saveCustom() {
      if (!customStatementInput || !customLeadInput) {
        return;
      }
      try {
        window.localStorage.setItem(CUSTOM_STATEMENT_KEY, customStatementInput.value);
        window.localStorage.setItem(CUSTOM_LEAD_KEY, customLeadInput.value);
      } catch (_error) {
        /* localStorage unavailable */
      }
    }

    function applyVariant(id) {
      if (id === CUSTOM_ID && customBlock && customStatementInput && customLeadInput) {
        customBlock.hidden = false;
        if (!customStatementInput.value && !customLeadInput.value) {
          customStatementInput.value = DEFAULT_CUSTOM_STATEMENT;
          customLeadInput.value = DEFAULT_CUSTOM_LEAD;
          saveCustom();
        }
        applyCustom();
        reasonEl.textContent = 'カスタム入力モード。見出しとリード文を自由に編集できます（入力内容はブラウザに保存されます）。';
        return;
      }
      if (customBlock) {
        customBlock.hidden = true;
      }
      const variant = allVariants.get(id) || DEFAULT_VARIANT;
      statementEl.innerHTML = variant.statement;
      if (variant.lead) {
        leadEl.innerHTML = variant.lead;
      }
      reasonEl.textContent = variant.reason;
      updateFontOverlayPosition();
    }

    function setExpanded(isOpen) {
      toggle.setAttribute('aria-expanded', String(isOpen));
      panel.hidden = !isOpen;
      updatePanelPlacement();
    }

    function clampPosition(left, top) {
      const rect = toggle.getBoundingClientRect();
      const width = rect.width || 44;
      const height = rect.height || 44;
      const margin = 12;
      return {
        left: Math.min(Math.max(margin, left), window.innerWidth - width - margin),
        top: Math.min(Math.max(margin, top), window.innerHeight - height - margin)
      };
    }

    function updatePanelPlacement() {
      const rect = picker.getBoundingClientRect();
      const shouldAlignLeft = rect.left < 380;
      const shouldOpenBelow = rect.top < Math.min(220, window.innerHeight * 0.34);
      picker.classList.toggle('hero-copy-picker--align-left', shouldAlignLeft);
      picker.classList.toggle('hero-copy-picker--panel-below', shouldOpenBelow);
    }

    function applyPickerPosition(position) {
      const next = clampPosition(position.left, position.top);
      picker.style.left = `${next.left}px`;
      picker.style.top = `${next.top}px`;
      picker.style.right = 'auto';
      picker.style.bottom = 'auto';
      updatePanelPlacement();
    }

    function savePickerPosition() {
      const rect = picker.getBoundingClientRect();
      try {
        window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify({ left: rect.left, top: rect.top }));
      } catch (_error) {
        /* localStorage unavailable */
      }
    }

    function restorePickerPosition() {
      try {
        const rawPosition = window.localStorage.getItem(POSITION_STORAGE_KEY);
        if (!rawPosition) {
          updatePanelPlacement();
          return;
        }
        const position = JSON.parse(rawPosition);
        if (Number.isFinite(position?.left) && Number.isFinite(position?.top)) {
          applyPickerPosition(position);
          return;
        }
      } catch (_error) {
        /* localStorage unavailable or invalid */
      }
      updatePanelPlacement();
    }

    let dragState = null;
    let didDrag = false;

    toggle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') {
        return;
      }
      const rect = picker.getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      didDrag = false;
      toggle.setPointerCapture?.(event.pointerId);
    });

    toggle.addEventListener('pointermove', (event) => {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      if (!didDrag && Math.hypot(dx, dy) < 6) {
        return;
      }
      didDrag = true;
      picker.classList.add('is-dragging');
      applyPickerPosition({
        left: dragState.left + dx,
        top: dragState.top + dy
      });
    });

    function finishDrag(event) {
      if (!dragState || dragState.pointerId !== event.pointerId) {
        return;
      }
      if (didDrag) {
        savePickerPosition();
      }
      picker.classList.remove('is-dragging');
      toggle.releasePointerCapture?.(event.pointerId);
      dragState = null;
    }

    toggle.addEventListener('pointerup', finishDrag);
    toggle.addEventListener('pointercancel', finishDrag);

    toggle.addEventListener('click', (event) => {
      event.stopPropagation();
      if (didDrag) {
        event.preventDefault();
        didDrag = false;
        return;
      }
      const isOpen = toggle.getAttribute('aria-expanded') === 'true';
      setExpanded(!isOpen);
    });

    select.addEventListener('change', (event) => {
      const value = event.target.value;
      applyVariant(value);
      try {
        window.localStorage.setItem(STORAGE_KEY, value);
      } catch (_error) {
        /* localStorage unavailable */
      }
    });
    if (customStatementInput && customLeadInput) {
      [customStatementInput, customLeadInput].forEach((field) => {
        field.addEventListener('input', () => {
          if (select.value !== CUSTOM_ID) {
            return;
          }
          applyCustom();
          saveCustom();
        });
      });
    }
    Object.entries(fontObjects).forEach(([id, config]) => {
      if (!config.el) {
        return;
      }
      config.el.classList.add('hero-font-object');
      config.el.tabIndex = -1;
      config.el.addEventListener('pointerdown', (event) => {
        if (!document.body.classList.contains('is-hero-font-editing')) {
          return;
        }
        beginFontEditGesture(event, id, 'move');
      });
      config.el.addEventListener('dblclick', (event) => {
        event.preventDefault();
        event.stopPropagation();
        startInlineTextEdit(id);
      });
      config.el.addEventListener('keydown', (event) => {
        if (config.el.classList.contains('is-hero-text-editing')) {
          if (event.key === 'Escape') {
            event.preventDefault();
            finishInlineTextEdit(id, false);
            return;
          }
          if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            document.execCommand?.('insertLineBreak');
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            finishInlineTextEdit(id, true);
            return;
          }
          return;
        }
        if (!document.body.classList.contains('is-hero-font-editing')) {
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectFontObject(id);
        }
        if ((event.key === 'Backspace' || event.key === 'Delete') && selectedFontObjectId === id) {
          event.preventDefault();
          resetFontObject(id);
        }
      });
      config.el.addEventListener('blur', () => {
        if (config.el.classList.contains('is-hero-text-editing')) {
          finishInlineTextEdit(id, true);
        }
      });
    });
    if (fontEditModeInput) {
      fontEditModeInput.addEventListener('change', (event) => {
        const isEnabled = event.target.checked;
        setFontEditMode(isEnabled);
        try {
          window.localStorage.setItem(FONT_EDIT_MODE_STORAGE_KEY, String(isEnabled));
        } catch (_error) {
          /* localStorage unavailable */
        }
      });
    }
    fontOverlay.root.addEventListener('pointerdown', (event) => {
      if (!selectedFontObjectId || !document.body.classList.contains('is-hero-font-editing')) {
        return;
      }
      const isHandle = event.target === fontOverlay.handle;
      beginFontEditGesture(event, selectedFontObjectId, isHandle ? 'resize' : 'move');
    });
    fontOverlay.root.addEventListener('dblclick', (event) => {
      if (!selectedFontObjectId || !document.body.classList.contains('is-hero-font-editing')) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      startInlineTextEdit(selectedFontObjectId);
    });
    document.addEventListener('pointermove', updateFontEditGesture);
    document.addEventListener('pointerup', finishFontEditGesture);
    document.addEventListener('pointercancel', finishFontEditGesture);
    if (fontResetButton) {
      fontResetButton.addEventListener('click', resetSelectedFontObject);
    }

    document.addEventListener('click', (event) => {
      if (toggle.getAttribute('aria-expanded') !== 'true') {
        return;
      }
      if (
        toggle.contains(event.target) ||
        panel.contains(event.target) ||
        fontOverlay.root.contains(event.target) ||
        event.target.closest?.('[data-hero-font-object]')
      ) {
        return;
      }
      setExpanded(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setExpanded(false);
        toggle.focus();
      }
    });

    window.addEventListener('resize', () => {
      const rect = picker.getBoundingClientRect();
      if (picker.style.left && picker.style.top) {
        applyPickerPosition({ left: rect.left, top: rect.top });
        savePickerPosition();
        updateFontOverlayPosition();
        return;
      }
      updatePanelPlacement();
      updateFontOverlayPosition();
    });
    window.addEventListener('scroll', updateFontOverlayPosition, { passive: true });

    try {
      const savedBrandText = window.localStorage.getItem(BRAND_TEXT_KEY);
      if (savedBrandText) {
        fontObjects.brand.el.innerHTML = multilineToHtml(savedBrandText);
      }
    } catch (_error) {
      /* localStorage unavailable */
    }

    let savedId = CUSTOM_ID;
    try {
      savedId = window.localStorage.getItem(STORAGE_KEY) || CUSTOM_ID;
    } catch (_error) {
      /* localStorage unavailable */
    }
    if (customStatementInput && customLeadInput) {
      try {
        customStatementInput.value = window.localStorage.getItem(CUSTOM_STATEMENT_KEY) || DEFAULT_CUSTOM_STATEMENT;
        customLeadInput.value = window.localStorage.getItem(CUSTOM_LEAD_KEY) || DEFAULT_CUSTOM_LEAD;
      } catch (_error) {
        /* localStorage unavailable */
      }
    }
    const canUseCustom = Boolean(customBlock && customStatementInput && customLeadInput);
    if (allVariants.has(savedId) || (savedId === CUSTOM_ID && canUseCustom)) {
      select.value = savedId;
      applyVariant(savedId);
    }
    applyAllFontObjectSettings();
    window.__speedadHeroFontObjectSettings = exportFontObjectSettings;
    updateFontSelectionUi();
    try {
      setFontEditMode(window.localStorage.getItem(FONT_EDIT_MODE_STORAGE_KEY) === 'true');
    } catch (_error) {
      setFontEditMode(false);
    }
    restorePickerPosition();
  }

  function setupLoginPanelThemePicker() {
    const select = document.getElementById('login-panel-theme-select');
    const loginPanel = document.getElementById('input-box');
    if (!select || !loginPanel) {
      return;
    }
    const STORAGE_KEY = 'speedad-login-panel-theme';
    const allowedThemes = new Set(['', 'a1', 'e1', 'd1', 'e2', 'g6']);

    function applyTheme(themeId) {
      const nextThemeId = allowedThemes.has(themeId) ? themeId : '';
      if (nextThemeId) {
        document.body.dataset.loginPanelTheme = nextThemeId;
      } else {
        delete document.body.dataset.loginPanelTheme;
      }
      select.value = nextThemeId;
    }

    select.addEventListener('change', (event) => {
      const themeId = event.target.value;
      applyTheme(themeId);
      try {
        window.localStorage.setItem(STORAGE_KEY, themeId);
      } catch (_error) {
        /* localStorage unavailable */
      }
    });

    try {
      applyTheme(window.localStorage.getItem(STORAGE_KEY) || 'e2');
    } catch (_error) {
      applyTheme('e2');
    }
  }

  function setupSiteTopHamburger() {
    const hamburger = document.getElementById('site-top-hamburger');
    const nav = document.getElementById('site-top-nav');
    if (!hamburger || !nav) {
      return;
    }
    function setExpanded(isOpen) {
      hamburger.setAttribute('aria-expanded', String(isOpen));
      hamburger.setAttribute('aria-label', isOpen ? 'メニューを閉じる' : 'メニューを開く');
    }
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.getAttribute('aria-expanded') === 'true';
      setExpanded(!isOpen);
    });
    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setExpanded(false));
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && hamburger.getAttribute('aria-expanded') === 'true') {
        setExpanded(false);
        hamburger.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapLoginFront);
  } else {
    bootstrapLoginFront();
  }
})();
