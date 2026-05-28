const DEFAULT_MANIFEST_URL = './manifest.json';
const SOURCE_STATUS_DIFF_KEYWORDS = ['差分', 'のみ', '未確認', '要確認'];

const DEFAULT_IDS = {
  search: 'docViewerSearch',
  category: 'docViewerCategory',
  sourceStatus: 'docViewerSourceStatus',
  diffOnly: 'docViewerDiffOnly',
  reset: 'docViewerReset',
  count: 'docViewerCount',
  list: 'docViewerList',
  title: 'docViewerTitle',
  meta: 'docViewerMeta',
  badges: 'docViewerBadges',
  content: 'docViewerContent',
  copy: 'docViewerCopy',
  flow: 'docViewerFlow',
  flowSection: 'docViewerFlowSection',
  breadcrumb: 'docViewerBreadcrumb',
  pageTitle: 'docViewerPageTitle',
  pageSummary: 'docViewerPageSummary',
  sourceBadge: 'docViewerSourceBadge',
  unconfirmedBadge: 'docViewerUnconfirmedBadge'
};

function getElement(id) {
  return document.getElementById(id);
}

function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}

function createBadge(text, tone = 'default') {
  const badge = document.createElement('span');
  const toneClass = {
    default: 'bg-surface-variant text-on-surface',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800'
  }[tone] || 'bg-surface-variant text-on-surface';

  badge.className = `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass}`;
  badge.textContent = text;
  return badge;
}

function normalizeText(value) {
  return String(value || '').toLowerCase();
}

function normalizeManifest(rawManifest) {
  if (Array.isArray(rawManifest)) {
    return {
      meta: {
        id: '01_system-mail',
        title: 'システムメール',
        summary: 'システムメールの文面、送信タイミング、Excel版とGmail実配信版の差分整理',
        sourceStatus: 'Excel / Gmail',
        hasUnconfirmed: true
      },
      documents: rawManifest,
      flow: []
    };
  }

  return {
    meta: rawManifest.meta || {},
    documents: rawManifest.documents || [],
    flow: rawManifest.flow || []
  };
}

function isDiffDocument(documentItem) {
  if (documentItem.hasUnconfirmed) {
    return true;
  }

  return SOURCE_STATUS_DIFF_KEYWORDS.some(keyword => {
    return String(documentItem.sourceStatus || '').includes(keyword);
  });
}

function getSourceTone(documentItem) {
  if (documentItem.hasGmailObserved === false) {
    return 'warning';
  }
  if (documentItem.hasUnconfirmed) {
    return 'warning';
  }
  if (String(documentItem.sourceStatus || '').includes('差分')) {
    return 'danger';
  }
  if (String(documentItem.sourceStatus || '').includes('確認')) {
    return 'success';
  }
  return 'info';
}

function createOption(value) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  return option;
}

function renderFilterOptions(state, elements) {
  if (!elements.category || !elements.sourceStatus) return;

  const categories = [...new Set(state.documents.map(documentItem => documentItem.category).filter(Boolean))].sort();
  const sourceStatuses = [...new Set(state.documents.map(documentItem => documentItem.sourceStatus).filter(Boolean))].sort();

  elements.category.replaceChildren(createOption(''));
  elements.category.options[0].textContent = 'すべて';
  categories.forEach(category => elements.category.appendChild(createOption(category)));

  elements.sourceStatus.replaceChildren(createOption(''));
  elements.sourceStatus.options[0].textContent = 'すべて';
  sourceStatuses.forEach(sourceStatus => elements.sourceStatus.appendChild(createOption(sourceStatus)));
}

function filterDocuments(state) {
  const query = normalizeText(state.search);

  state.filteredDocuments = state.documents.filter(documentItem => {
    if (state.category && documentItem.category !== state.category) {
      return false;
    }
    if (state.sourceStatus && documentItem.sourceStatus !== state.sourceStatus) {
      return false;
    }
    if (state.diffOnly && !isDiffDocument(documentItem)) {
      return false;
    }
    if (!query) {
      return true;
    }

    const searchableText = normalizeText([
      documentItem.id,
      documentItem.title,
      documentItem.category,
      documentItem.sourceStatus,
      documentItem.summary,
      (documentItem.tags || []).join(' '),
      (documentItem.relatedSources || []).join(' '),
      documentItem.markdown
    ].join('\n'));

    return searchableText.includes(query);
  });
}

function renderDocumentList(state, elements) {
  if (!elements.list) return;

  elements.list.innerHTML = '';
  setText(elements.count, `${state.filteredDocuments.length}件`);

  if (state.filteredDocuments.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'rounded-lg border border-dashed border-outline-variant p-4 text-sm text-on-surface-variant';
    empty.textContent = '条件に一致する資料がありません。';
    elements.list.appendChild(empty);
    return;
  }

  state.filteredDocuments.forEach(documentItem => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = [
      'w-full rounded-lg border p-3 text-left transition-colors',
      documentItem.id === state.selectedId
        ? 'border-primary bg-primary/10 text-on-surface'
        : 'border-outline-variant bg-surface text-on-surface hover:bg-surface-variant'
    ].join(' ');
    button.addEventListener('click', () => {
      state.selectedId = documentItem.id;
      renderDocumentList(state, elements);
      renderSelectedDocument(state, elements);
    });

    const title = document.createElement('span');
    title.className = 'block text-sm font-semibold leading-5';
    title.textContent = `${documentItem.id} ${documentItem.title}`;

    const meta = document.createElement('span');
    meta.className = 'mt-1 block text-xs text-on-surface-variant';
    meta.textContent = `${documentItem.category || '-'} / ${documentItem.sourceStatus || '-'}`;

    const summary = document.createElement('span');
    summary.className = 'mt-2 block text-xs leading-5 text-on-surface-variant';
    summary.textContent = documentItem.summary || '';

    button.append(title, meta, summary);
    elements.list.appendChild(button);
  });
}

function renderSelectedDocument(state, elements) {
  const selectedDocument = state.documents.find(documentItem => documentItem.id === state.selectedId);

  if (!selectedDocument) {
    setText(elements.title, '資料が選択されていません');
    setText(elements.meta, '左の一覧から資料を選択してください。');
    setText(elements.content, '');
    if (elements.copy) elements.copy.disabled = true;
    if (elements.badges) elements.badges.innerHTML = '';
    return;
  }

  setText(elements.title, selectedDocument.title);
  setText(elements.meta, `${selectedDocument.id} / ${selectedDocument.path}`);
  setText(elements.content, selectedDocument.markdown);
  if (elements.copy) elements.copy.disabled = false;
  if (!elements.badges) return;

  elements.badges.innerHTML = '';
  elements.badges.append(
    createBadge(selectedDocument.category || '未分類', 'info'),
    createBadge(selectedDocument.sourceStatus || 'ソース状態未設定', getSourceTone(selectedDocument))
  );

  if (selectedDocument.hasExcelTemplate !== undefined) {
    elements.badges.append(createBadge(
      selectedDocument.hasExcelTemplate ? 'Excel版あり' : 'Excel版なし',
      selectedDocument.hasExcelTemplate ? 'success' : 'warning'
    ));
  }

  if (selectedDocument.hasGmailObserved !== undefined) {
    elements.badges.append(createBadge(
      selectedDocument.hasGmailObserved ? 'Gmail実配信確認' : 'Gmail未確認',
      selectedDocument.hasGmailObserved ? 'success' : 'warning'
    ));
  }

  if (selectedDocument.hasUnconfirmed) {
    elements.badges.append(createBadge('未確認事項あり', 'warning'));
  }
}

function renderPageMeta(manifest, elements) {
  const meta = manifest.meta || {};
  setText(elements.breadcrumb, `HOME / ${meta.id || ''}`);
  setText(elements.pageTitle, meta.title || 'バックエンド資料');
  setText(elements.pageSummary, meta.summary || '');
  setText(elements.sourceBadge, meta.sourceStatus || '');
  setText(elements.unconfirmedBadge, meta.hasUnconfirmed ? '未確認事項あり' : '未確認事項なし');
}

function renderFlow(manifest, state, elements) {
  if (!elements.flow || !elements.flowSection) return;

  const flowGroups = Array.isArray(manifest.flow) ? manifest.flow : [];
  if (flowGroups.length === 0) {
    elements.flowSection.classList.add('hidden');
    return;
  }

  elements.flow.innerHTML = '';
  flowGroups.forEach(group => {
    const section = document.createElement('section');
    section.className = 'space-y-3';

    const title = document.createElement('h3');
    title.className = 'text-sm font-bold text-on-surface';
    title.textContent = group.group || 'フロー';

    const grid = document.createElement('div');
    grid.className = 'grid gap-3 md:grid-cols-2 xl:grid-cols-4';

    (group.items || []).forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rounded-lg border border-outline-variant bg-background p-4 text-left hover:border-primary hover:bg-surface-variant';
      button.addEventListener('click', () => {
        clearFilters(state, elements);
        state.selectedId = item.documentId || item.id || '';
        render(state, elements);
        elements.content?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      const timing = document.createElement('span');
      timing.className = 'text-xs font-semibold text-primary';
      timing.textContent = item.timing || '';

      const label = document.createElement('span');
      label.className = 'mt-1 block text-sm font-bold text-on-surface';
      label.textContent = item.label || item.title || item.id;

      const summary = document.createElement('span');
      summary.className = 'mt-1 block text-xs leading-5 text-on-surface-variant';
      summary.textContent = item.summary || '';

      button.append(timing, label, summary);
      grid.appendChild(button);
    });

    section.append(title, grid);
    elements.flow.appendChild(section);
  });

  elements.flowSection.classList.remove('hidden');
}

function render(state, elements) {
  filterDocuments(state);

  if (!state.filteredDocuments.some(documentItem => documentItem.id === state.selectedId)) {
    state.selectedId = state.filteredDocuments[0]?.id || '';
  }

  renderDocumentList(state, elements);
  renderSelectedDocument(state, elements);
}

function clearFilters(state, elements) {
  state.search = '';
  state.category = '';
  state.sourceStatus = '';
  state.diffOnly = false;
  if (elements.search) elements.search.value = '';
  if (elements.category) elements.category.value = '';
  if (elements.sourceStatus) elements.sourceStatus.value = '';
  if (elements.diffOnly) elements.diffOnly.checked = false;
}

async function copySelectedMarkdown(state, elements) {
  const selectedDocument = state.documents.find(documentItem => documentItem.id === state.selectedId);
  if (!selectedDocument || !elements.copy) return;

  try {
    await navigator.clipboard.writeText(selectedDocument.markdown);
    elements.copy.innerHTML = '<span class="material-icons text-base">done</span>コピーしました';
    setTimeout(() => {
      elements.copy.innerHTML = '<span class="material-icons text-base">content_copy</span>Markdownをコピー';
    }, 1600);
  } catch (error) {
    console.error('Markdown copy failed:', error);
    setText(elements.meta, 'Markdownのコピーに失敗しました。ブラウザの権限設定を確認してください。');
  }
}

function bindEvents(state, elements) {
  elements.search?.addEventListener('input', event => {
    state.search = event.target.value;
    render(state, elements);
  });

  elements.category?.addEventListener('change', event => {
    state.category = event.target.value;
    render(state, elements);
  });

  elements.sourceStatus?.addEventListener('change', event => {
    state.sourceStatus = event.target.value;
    render(state, elements);
  });

  elements.diffOnly?.addEventListener('change', event => {
    state.diffOnly = event.target.checked;
    render(state, elements);
  });

  elements.reset?.addEventListener('click', () => {
    clearFilters(state, elements);
    render(state, elements);
  });

  elements.copy?.addEventListener('click', () => copySelectedMarkdown(state, elements));

  document.querySelectorAll('[data-doc-id], [data-mail-doc-id]').forEach(button => {
    button.addEventListener('click', () => {
      clearFilters(state, elements);
      state.selectedId = button.dataset.docId || button.dataset.mailDocId || '';
      render(state, elements);
      elements.content?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

async function fetchMarkdownDocuments(manifest, manifestUrl) {
  const manifestBaseUrl = new URL(manifestUrl, window.location.href);

  return Promise.all(manifest.documents.map(async documentItem => {
    const markdownUrl = new URL(documentItem.path, manifestBaseUrl);
    const response = await fetch(markdownUrl);

    if (!response.ok) {
      throw new Error(`Failed to load ${documentItem.path}: ${response.status}`);
    }

    return {
      ...documentItem,
      markdown: await response.text()
    };
  }));
}

function collectElements(ids) {
  return Object.fromEntries(
    Object.entries(ids).map(([key, id]) => [key, getElement(id)])
  );
}

export async function initDocViewer(options = {}) {
  const manifestUrl = options.manifestUrl || DEFAULT_MANIFEST_URL;
  const ids = { ...DEFAULT_IDS, ...(options.ids || {}) };
  const elements = collectElements(ids);
  const state = {
    documents: [],
    filteredDocuments: [],
    selectedId: '',
    search: '',
    category: '',
    sourceStatus: '',
    diffOnly: false
  };

  try {
    const response = await fetch(manifestUrl);

    if (!response.ok) {
      throw new Error(`Failed to load manifest: ${response.status}`);
    }

    const manifest = normalizeManifest(await response.json());
    state.documents = await fetchMarkdownDocuments(manifest, manifestUrl);
    state.selectedId = state.documents[0]?.id || '';
    renderPageMeta(manifest, elements);
    renderFilterOptions(state, elements);
    renderFlow(manifest, state, elements);
    bindEvents(state, elements);
    render(state, elements);
  } catch (error) {
    console.error('Docs initialization failed:', error);
    setText(elements.title, '資料の読み込みに失敗しました');
    setText(elements.meta, 'manifestまたはMarkdownの取得に失敗しました。ローカルサーバー経由で開いているか確認してください。');
    setText(elements.content, String(error));
    if (elements.copy) elements.copy.disabled = true;
  }
}
