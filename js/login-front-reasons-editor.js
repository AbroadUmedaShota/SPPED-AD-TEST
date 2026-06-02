(() => {
  'use strict';

  const STORAGE_KEY = 'speedad.loginFrontReasonsEditor.v1';
  const SOURCE = 'login-front-reasons';
  const EXPECTED_ITEM_COUNT = 9;

  const state = {
    frameDocument: null,
    originalItems: [],
    currentItems: [],
    editMode: false,
    ready: false,
    unsaved: false,
    toastTimer: null,
  };

  const elements = {};

  document.addEventListener('DOMContentLoaded', () => {
    bindElements();
    bindToolbar();
    elements.preview.addEventListener('load', handlePreviewLoad);
    window.setTimeout(() => {
      if (!state.ready) {
        setStatus('プレビューの読み込みが完了していません。プレビュー再読込を押してください。', true);
      }
    }, 8000);
  });

  function bindElements() {
    elements.preview = document.getElementById('editor-preview');
    elements.previewFrame = document.getElementById('preview-frame');
    elements.status = document.getElementById('editor-status');
    elements.meta = document.getElementById('editor-meta');
    elements.output = document.getElementById('editor-output');
    elements.toast = document.getElementById('editor-toast');
    elements.toggle = document.getElementById('editor-toggle');
    elements.reload = document.getElementById('editor-reload');
    elements.save = document.getElementById('editor-save');
    elements.reset = document.getElementById('editor-reset');
    elements.copy = document.getElementById('editor-copy');
    elements.viewportButtons = [...document.querySelectorAll('[data-viewport]')];
  }

  function bindToolbar() {
    elements.toggle.addEventListener('click', () => {
      if (!state.ready) {
        showToast('プレビューの読み込み完了後に編集できます。');
        return;
      }
      setEditMode(!state.editMode);
    });

    elements.reload.addEventListener('click', reloadPreview);
    elements.save.addEventListener('click', saveDraft);
    elements.reset.addEventListener('click', resetDraft);
    elements.copy.addEventListener('click', copyOutput);

    elements.viewportButtons.forEach((button) => {
      button.addEventListener('click', () => setViewport(button.dataset.viewport));
    });
  }

  function handlePreviewLoad() {
    const frameDocument = elements.preview.contentDocument;
    if (!frameDocument) {
      setStatus('プレビューにアクセスできません。localhost 経由で開いてください。', true);
      return;
    }

    state.frameDocument = frameDocument;
    state.originalItems = readItemsFromFrame();
    if (state.originalItems.length !== EXPECTED_ITEM_COUNT) {
      setStatus(`選ばれる理由が ${EXPECTED_ITEM_COUNT} 項目見つかりません。現在: ${state.originalItems.length} 項目`, true);
      return;
    }

    prepareFrameForEditing();
    state.currentItems = mergeStoredDraft(state.originalItems);
    applyItemsToFrame(state.currentItems);
    setEditMode(false);
    scrollPreviewToReasons();
    renderOutput();
    setReadyState(true);
    updateSummary();
  }

  function reloadPreview() {
    setEditMode(false);
    setReadyState(false);
    state.frameDocument = null;
    state.originalItems = [];
    state.currentItems = [];
    state.unsaved = false;
    setStatus('プレビューを再読み込みしています。');
    const previewUrl = new URL(elements.preview.getAttribute('src'), window.location.href);
    previewUrl.searchParams.set('editorReload', String(Date.now()));
    elements.preview.src = previewUrl.pathname + previewUrl.search + previewUrl.hash;
  }

  function readItemsFromFrame() {
    return getFrameArticles().map((article, index) => {
      const titleElement = article.querySelector('h3');
      const descriptionElement = article.querySelector('p');
      const linkElement = article.querySelector('.capability-item__link');
      const numberElement = article.querySelector('.capability-item__number');
      return {
        number: cleanText(numberElement?.textContent) || String(index + 1).padStart(2, '0'),
        title: cleanText(titleElement?.textContent),
        description: cleanText(descriptionElement?.textContent),
        linkLabel: linkElement ? extractLinkLabel(linkElement) : null,
      };
    });
  }

  function getFrameArticles() {
    if (!state.frameDocument) {
      return [];
    }
    return [...state.frameDocument.querySelectorAll('.capability-list .capability-item')];
  }

  function prepareFrameForEditing() {
    const frameDocument = state.frameDocument;
    injectFrameStyles(frameDocument);
    frameDocument.body.classList.add('reasons-editor-preview');
    frameDocument.addEventListener('click', preventReasonLinkNavigation, true);

    getFrameArticles().forEach((article, index) => {
      const number = state.originalItems[index].number;
      const titleElement = article.querySelector('h3');
      const descriptionElement = article.querySelector('p');
      const linkElement = article.querySelector('.capability-item__link');

      article.dataset.reasonsEditorItem = number;
      markEditable(titleElement, number, 'title');
      markEditable(descriptionElement, number, 'description');

      if (linkElement) {
        const linkLabel = ensureEditableLinkLabel(linkElement);
        markEditable(linkLabel, number, 'linkLabel');
      }
    });
  }

  function injectFrameStyles(frameDocument) {
    if (frameDocument.getElementById('reasons-editor-style')) {
      return;
    }
    const style = frameDocument.createElement('style');
    style.id = 'reasons-editor-style';
    style.textContent = `
      body.reasons-editor-preview {
        min-height: auto;
        background: #fbfaf7;
      }

      body.reasons-editor-preview .site-top-header,
      body.reasons-editor-preview .site-footer,
      body.reasons-editor-preview .lp-page:not(.lp-page--solo) {
        display: none !important;
      }

      body.reasons-editor-preview main,
      body.reasons-editor-preview .lp-page--solo {
        min-height: auto !important;
      }

      body.reasons-editor-preview .section-block {
        padding-top: clamp(54px, 6vw, 84px);
        padding-bottom: clamp(54px, 6vw, 84px);
      }

      body.reasons-editor-preview .capabilities-section {
        scroll-margin-top: 18px;
      }

      body.reasons-editor-preview .capability-item[data-reasons-editor-item] {
        position: relative;
      }

      body.reasons-editor-editing [data-reasons-editor-field] {
        border-radius: 4px;
        background: rgba(21, 94, 168, 0.08);
        box-shadow: 0 0 0 2px rgba(21, 94, 168, 0.22);
        cursor: text;
      }

      body.reasons-editor-editing [data-reasons-editor-field]:focus {
        outline: 3px solid rgba(157, 125, 81, 0.32);
        background: rgba(255, 255, 255, 0.9);
      }

      body.reasons-editor-editing .capability-item__link {
        cursor: text;
      }

      body.reasons-editor-editing .capability-item__link::after {
        content: "リンクURLは固定";
        display: inline-flex;
        margin-left: 8px;
        color: #6f7c87;
        font-size: 0.68rem;
        font-weight: 700;
        text-decoration: none;
      }
    `;
    frameDocument.head.appendChild(style);
  }

  function markEditable(element, number, field) {
    if (!element) {
      return;
    }
    element.dataset.reasonsEditorNumber = number;
    element.dataset.reasonsEditorField = field;
    element.setAttribute('spellcheck', 'false');
    element.addEventListener('input', handleEditableInput);
    element.addEventListener('paste', handleEditablePaste);
    element.addEventListener('keydown', handleEditableKeydown);
  }

  function ensureEditableLinkLabel(linkElement) {
    const existing = linkElement.querySelector('[data-reasons-editor-field="linkLabel"]');
    if (existing) {
      return existing;
    }

    const frameDocument = state.frameDocument;
    const label = extractLinkLabel(linkElement);
    const arrow = linkElement.querySelector('[aria-hidden="true"]');
    const labelElement = frameDocument.createElement('span');
    labelElement.className = 'capability-item__link-label';
    labelElement.textContent = label;

    linkElement.textContent = '';
    linkElement.appendChild(labelElement);
    linkElement.appendChild(frameDocument.createTextNode(' '));
    if (arrow) {
      linkElement.appendChild(arrow);
    } else {
      const arrowElement = frameDocument.createElement('span');
      arrowElement.setAttribute('aria-hidden', 'true');
      arrowElement.textContent = '→';
      linkElement.appendChild(arrowElement);
    }
    return labelElement;
  }

  function extractLinkLabel(linkElement) {
    const clone = linkElement.cloneNode(true);
    clone.querySelectorAll('[aria-hidden="true"]').forEach((element) => element.remove());
    return cleanText(clone.textContent).replace(/[→↗]$/, '').trim();
  }

  function mergeStoredDraft(originalItems) {
    const storedItems = loadStoredItems();
    if (!storedItems.length) {
      return cloneItems(originalItems);
    }
    return originalItems.map((item) => {
      const stored = storedItems.find((candidate) => candidate.number === item.number);
      if (!stored) {
        return { ...item };
      }
      return {
        number: item.number,
        title: typeof stored.title === 'string' ? stored.title : item.title,
        description: typeof stored.description === 'string' ? stored.description : item.description,
        linkLabel: item.linkLabel === null
          ? null
          : typeof stored.linkLabel === 'string'
            ? stored.linkLabel
            : item.linkLabel,
      };
    });
  }

  function loadStoredItems() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const payload = JSON.parse(raw);
      if (payload?.version !== 1 || payload?.source !== SOURCE || !Array.isArray(payload.items)) {
        return [];
      }
      return payload.items;
    } catch (_error) {
      return [];
    }
  }

  function applyItemsToFrame(items) {
    getFrameArticles().forEach((article, index) => {
      const item = items[index];
      const titleElement = article.querySelector('[data-reasons-editor-field="title"]');
      const descriptionElement = article.querySelector('[data-reasons-editor-field="description"]');
      const linkLabelElement = article.querySelector('[data-reasons-editor-field="linkLabel"]');

      if (titleElement) {
        titleElement.textContent = item.title;
      }
      if (descriptionElement) {
        descriptionElement.textContent = item.description;
      }
      if (linkLabelElement && item.linkLabel !== null) {
        linkLabelElement.textContent = item.linkLabel;
      }
    });
  }

  function setEditMode(enabled) {
    state.editMode = enabled;
    state.frameDocument?.body.classList.toggle('reasons-editor-editing', enabled);
    getEditableElements().forEach((element) => {
      if (enabled) {
        element.setAttribute('contenteditable', 'true');
      } else {
        element.removeAttribute('contenteditable');
      }
    });
    elements.toggle.textContent = enabled ? '編集終了' : '編集開始';
    elements.toggle.classList.toggle('editor-button--primary', !enabled);
    if (enabled) {
      scrollPreviewToReasons();
      showToast('文言をクリックして直接編集できます。');
    }
    updateSummary();
  }

  function getEditableElements() {
    if (!state.frameDocument) {
      return [];
    }
    return [...state.frameDocument.querySelectorAll('[data-reasons-editor-field]')];
  }

  function handleEditableInput() {
    state.unsaved = true;
    syncCurrentItems();
    updateSummary();
  }

  function handleEditablePaste(event) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    insertPlainText(event.currentTarget.ownerDocument, text);
  }

  function handleEditableKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      insertPlainText(event.currentTarget.ownerDocument, ' ');
    }
  }

  function insertPlainText(frameDocument, text) {
    const selection = frameDocument.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(frameDocument.createTextNode(text));
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function preventReasonLinkNavigation(event) {
    if (!state.editMode) {
      return;
    }
    if (event.target.closest?.('.capability-item__link')) {
      event.preventDefault();
    }
  }

  function syncCurrentItems() {
    state.currentItems = getFrameArticles().map((article, index) => {
      const original = state.originalItems[index];
      const title = cleanText(article.querySelector('[data-reasons-editor-field="title"]')?.textContent);
      const description = cleanText(article.querySelector('[data-reasons-editor-field="description"]')?.textContent);
      const linkLabelElement = article.querySelector('[data-reasons-editor-field="linkLabel"]');
      return {
        number: original.number,
        title,
        description,
        linkLabel: original.linkLabel === null ? null : cleanText(linkLabelElement?.textContent),
      };
    });
  }

  function saveDraft() {
    if (!state.ready) {
      return;
    }
    syncCurrentItems();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPayload()));
      state.unsaved = false;
      updateSummary();
      showToast('下書きを保存しました。');
    } catch (_error) {
      setStatus('下書きを保存できませんでした。ブラウザの保存設定を確認してください。', true);
    }
  }

  function resetDraft() {
    if (!state.ready) {
      return;
    }
    window.localStorage.removeItem(STORAGE_KEY);
    state.currentItems = cloneItems(state.originalItems);
    applyItemsToFrame(state.currentItems);
    state.unsaved = false;
    updateSummary();
    showToast('現在の index.html の文言に戻しました。');
  }

  function buildPayload() {
    return {
      version: 1,
      source: SOURCE,
      items: state.currentItems.map((item, index) => ({
        number: item.number,
        title: item.title,
        description: item.description,
        linkLabel: item.linkLabel,
        changed: isChanged(item, state.originalItems[index]),
      })),
    };
  }

  function renderOutput() {
    return JSON.stringify(buildPayload(), null, 2);
  }

  async function copyOutput() {
    if (!state.ready) {
      return;
    }
    syncCurrentItems();
    const text = renderOutput();
    try {
      await navigator.clipboard.writeText(text);
      showToast('差分JSONをコピーしました。');
    } catch (_error) {
      copyTextWithFallback(text);
      const copied = document.execCommand && document.execCommand('copy');
      showToast(copied ? '差分JSONをコピーしました。' : '差分JSONをコピーできませんでした。');
    }
  }

  function buildChangeSummary() {
    const payload = buildPayload();
    const changed = payload.items.filter((item) => item.changed);
    return {
      changedCount: changed.length,
      changedNumbers: changed.map((item) => item.number),
    };
  }

  function updateSummary() {
    if (!state.ready) {
      return;
    }
    syncCurrentItems();
    const summary = buildChangeSummary();
    const editState = state.editMode ? '編集中' : '編集停止中';
    const saveState = state.unsaved ? '未保存' : '保存済みまたは未変更';
    const changedText = summary.changedCount > 0
      ? `変更 ${summary.changedCount} 件: ${summary.changedNumbers.join(', ')}`
      : '変更はありません';
    setStatus(`${editState} / ${saveState} / ${changedText}`);
  }

  function setViewport(viewport) {
    elements.previewFrame.dataset.viewport = viewport;
    elements.viewportButtons.forEach((button) => {
      const active = button.dataset.viewport === viewport;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    window.requestAnimationFrame(scrollPreviewToReasons);
  }

  function scrollPreviewToReasons() {
    const section = state.frameDocument?.querySelector('.capabilities-section');
    if (!section) {
      return;
    }
    section.scrollIntoView({ block: 'start' });
  }

  function setReadyState(ready) {
    state.ready = ready;
    elements.toggle.disabled = !ready;
    if (!ready) {
      elements.toggle.textContent = '読み込み中';
      elements.toggle.classList.remove('editor-button--primary');
    } else {
      elements.toggle.textContent = state.editMode ? '編集終了' : '編集開始';
      elements.toggle.classList.toggle('editor-button--primary', !state.editMode);
    }
    elements.save.disabled = !ready;
    elements.reset.disabled = !ready;
    elements.copy.disabled = !ready;
  }

  function setStatus(message, isError = false) {
    elements.status.textContent = message;
    elements.status.style.color = isError ? '#a3342f' : '';
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('is-visible');
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove('is-visible');
    }, 2600);
  }

  function cleanText(value) {
    return String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function cloneItems(items) {
    return items.map((item) => ({ ...item }));
  }

  function isChanged(current, original) {
    return current.title !== original.title
      || current.description !== original.description
      || current.linkLabel !== original.linkLabel;
  }

  function copyTextWithFallback(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-999px';
    textarea.style.left = '-999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    window.setTimeout(() => {
      textarea.remove();
    }, 0);
  }
})();
