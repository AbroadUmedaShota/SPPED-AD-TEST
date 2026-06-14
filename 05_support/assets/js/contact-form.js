const CONTACT_TYPE_LABELS = {
  general: '一般的なお問い合わせ',
  bug: '不具合・障害',
  billing: '請求・支払い',
  plan: '料金プラン',
  feature: '機能要望',
  other: 'その他',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getMetaContent(name) {
  const meta = document.querySelector(`meta[name="${name}"]`);
  return meta ? meta.content.trim() : '';
}

function getEndpoint(form) {
  return (
    form.dataset.endpoint ||
    window.SUPPORT_CONTACT_ENDPOINT ||
    getMetaContent('support-contact-endpoint') ||
    ''
  ).trim();
}

function getMaxAttachmentMb(form) {
  const configured = Number(
    form.dataset.maxAttachmentMb ||
    window.SUPPORT_CONTACT_MAX_ATTACHMENT_MB ||
    getMetaContent('support-contact-max-attachment-mb') ||
    10
  );
  return Number.isFinite(configured) && configured > 0 ? configured : 10;
}

function setInvalid(control, error, isInvalid, message) {
  control.classList.toggle('is-invalid', isInvalid);
  if (error) {
    if (message) error.textContent = message;
    error.hidden = !isInvalid;
  }
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    });
    reader.addEventListener('error', () => reject(reader.error || new Error('file_read_failed')));
    reader.readAsDataURL(file);
  });
}

function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const input = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const thumbs = document.getElementById('thumbs');
  const count = document.getElementById('count');
  const done = document.getElementById('contactDone');
  const status = document.getElementById('contactStatus');
  const submit = form.querySelector('.contact-submit');

  const typeEl = document.getElementById('f-contact-type');
  const typeError = document.getElementById('f-contact-type-error');
  const emailEl = document.getElementById('f-email');
  const emailError = document.getElementById('f-email-error');
  const messageEl = document.getElementById('f-message');
  const messageError = document.getElementById('f-message-error');
  const privacyEl = document.getElementById('f-privacy');
  const privacyError = document.getElementById('f-privacy-error');
  const fileError = document.getElementById('file-error');

  const maxAttachmentMb = getMaxAttachmentMb(form);
  const maxAttachmentBytes = maxAttachmentMb * 1024 * 1024;
  let files = [];
  let seq = 0;

  function showStatus(message) {
    status.textContent = message;
    status.hidden = !message;
  }

  function clearFileError() {
    fileError.textContent = '';
    fileError.hidden = true;
  }

  function render() {
    thumbs.innerHTML = '';
    files.forEach((item) => {
      const cell = document.createElement('div');
      cell.className = 'contact-thumb';

      const img = document.createElement('img');
      img.src = item.url;
      img.alt = item.name;

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'contact-thumb__remove';
      remove.title = '削除';
      remove.setAttribute('aria-label', `${item.name} を削除`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        URL.revokeObjectURL(item.url);
        files = files.filter((current) => current.id !== item.id);
        render();
      });

      const name = document.createElement('div');
      name.className = 'contact-thumb__name';
      name.textContent = item.name;

      cell.append(img, remove, name);
      thumbs.appendChild(cell);
    });

    count.hidden = files.length === 0;
    count.textContent = files.length ? `${files.length} 件の画像を添付中` : '';
  }

  function addFiles(list) {
    clearFileError();
    const rejected = [];

    Array.from(list || []).forEach((file) => {
      if (!file.type || !file.type.startsWith('image/')) {
        rejected.push(`${file.name} は画像ファイルではありません。`);
        return;
      }
      if (file.size > maxAttachmentBytes) {
        rejected.push(`${file.name} は ${maxAttachmentMb}MB を超えています。`);
        return;
      }
      files.push({
        id: `f${seq++}`,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        url: URL.createObjectURL(file),
        file,
      });
    });

    if (rejected.length) {
      fileError.textContent = rejected.join(' ');
      fileError.hidden = false;
    }
    render();
  }

  function validate() {
    let ok = true;
    const contactType = typeEl.value.trim();
    const email = emailEl.value.trim();
    const message = messageEl.value.trim();

    setInvalid(typeEl, typeError, !contactType);
    if (!contactType) ok = false;

    if (!email) {
      setInvalid(emailEl, emailError, true, 'メールアドレスを入力してください。');
      ok = false;
    } else if (!EMAIL_PATTERN.test(email)) {
      setInvalid(emailEl, emailError, true, 'メールアドレスの形式をご確認ください。');
      ok = false;
    } else {
      setInvalid(emailEl, emailError, false);
    }

    setInvalid(messageEl, messageError, !message);
    if (!message) ok = false;

    setInvalid(privacyEl, privacyError, !privacyEl.checked);
    if (!privacyEl.checked) ok = false;

    return ok;
  }

  async function buildAttachments() {
    return Promise.all(files.map(async (item) => ({
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      data: await readFileAsBase64(item.file),
    })));
  }

  function buildPayload(attachments) {
    const formData = new FormData(form);
    const contactType = String(formData.get('contactType') || '').trim();
    return {
      contactType,
      contactTypeLabel: CONTACT_TYPE_LABELS[contactType] || contactType,
      name: String(formData.get('name') || '').trim(),
      email: String(formData.get('email') || '').trim(),
      subject: String(formData.get('subject') || '').trim(),
      message: String(formData.get('message') || '').trim(),
      attachments,
      sourceUrl: window.location.href,
      userAgent: window.navigator.userAgent,
      privacyConsent: formData.get('privacyConsent') === 'on',
    };
  }

  async function submitContact(payload) {
    const endpoint = getEndpoint(form);
    if (!endpoint) {
      return {
        ok: false,
        error: '送信先の設定が未完了です。しばらく時間をおいてから再度お試しください。',
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'submitContact', payload }),
      redirect: 'follow',
    });
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (_error) {
      return { ok: false, error: text.slice(0, 300) || '送信結果を確認できませんでした。' };
    }
  }

  input.addEventListener('change', (event) => {
    addFiles(event.target.files);
    event.target.value = '';
  });

  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-drag');
  });

  dropzone.addEventListener('dragleave', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-drag');
  });

  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-drag');
    addFiles(event.dataTransfer.files);
  });

  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    showStatus('');

    if (!validate()) {
      const firstInvalid = form.querySelector('.is-invalid');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    submit.disabled = true;
    submit.textContent = '送信中...';

    try {
      const attachments = await buildAttachments();
      const result = await submitContact(buildPayload(attachments));
      if (!result.ok) {
        showStatus(result.error || '送信できませんでした。時間をおいて再度お試しください。');
        return;
      }

      form.hidden = true;
      done.hidden = false;
      done.focus && done.focus();
    } catch (error) {
      showStatus(`送信できませんでした。${String(error).slice(0, 120)}`);
    } finally {
      submit.disabled = false;
      submit.textContent = '送信する';
    }
  });
}

initContactForm();
