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

function setHtml(element, value) {
  if (element) {
    element.innerHTML = value;
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripFrontmatter(markdown) {
  const normalized = String(markdown || '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return normalized;
  }

  const endIndex = normalized.indexOf('\n---', 4);
  if (endIndex === -1) {
    return normalized;
  }

  const afterEnd = normalized.slice(endIndex + 4);
  return afterEnd.startsWith('\n') ? afterEnd.slice(1) : afterEnd;
}

function isAllowedHref(href) {
  return /^(https?:|mailto:|\.{0,2}\/|#)/i.test(href);
}

function renderInlinePlain(value) {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-on-surface">$1</strong>');
}

function renderInlineText(value) {
  const segments = String(value || '').split(/(`[^`]+`)/g);

  return segments.map(segment => {
    if (segment.startsWith('`') && segment.endsWith('`')) {
      return `<code class="rounded bg-surface-variant px-1.5 py-0.5 font-mono text-[0.92em] text-on-surface">${escapeHtml(segment.slice(1, -1))}</code>`;
    }

    let result = '';
    let cursor = 0;
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match = linkPattern.exec(segment);

    while (match) {
      result += renderInlinePlain(segment.slice(cursor, match.index));
      const href = match[2].trim();
      const safeHref = isAllowedHref(href) ? escapeHtml(href) : '#';
      const targetAttrs = /^https?:/i.test(href) ? ' target="_blank" rel="noopener"' : '';
      result += `<a class="font-medium text-primary underline underline-offset-2 hover:no-underline" href="${safeHref}"${targetAttrs}>${renderInlinePlain(match[1])}</a>`;
      cursor = match.index + match[0].length;
      match = linkPattern.exec(segment);
    }

    result += renderInlinePlain(segment.slice(cursor));
    return result;
  }).join('');
}

function isTableRow(line) {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isTableSeparator(line) {
  if (!isTableRow(line)) {
    return false;
  }

  return splitTableRow(line).every(cell => /^:?-{3,}:?$/.test(cell.trim()));
}

function splitTableRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map(cell => cell.trim());
}

function getTableAlignClass(separator) {
  if (/^:-+:$/.test(separator)) {
    return 'text-center';
  }
  if (/^-+:$/.test(separator)) {
    return 'text-right';
  }
  return 'text-left';
}

function renderTable(lines, startIndex) {
  const headers = splitTableRow(lines[startIndex]);
  const separators = splitTableRow(lines[startIndex + 1]);
  const rows = [];
  let index = startIndex + 2;

  while (index < lines.length && isTableRow(lines[index])) {
    rows.push(splitTableRow(lines[index]));
    index += 1;
  }

  const headerHtml = headers.map((header, columnIndex) => {
    const alignClass = getTableAlignClass(separators[columnIndex] || '');
    return `<th class="whitespace-nowrap border-b border-outline-variant bg-surface-variant px-3 py-2 align-top font-bold text-on-surface ${alignClass}">${renderInlineText(header)}</th>`;
  }).join('');

  const rowHtml = rows.map(row => {
    const cells = headers.map((_, columnIndex) => {
      const alignClass = getTableAlignClass(separators[columnIndex] || '');
      return `<td class="border-b border-outline-variant px-3 py-2 align-top text-on-surface-variant ${alignClass}">${renderInlineText(row[columnIndex] || '')}</td>`;
    }).join('');

    return `<tr>${cells}</tr>`;
  }).join('');

  return {
    html: [
      '<div class="my-4 overflow-x-auto rounded-lg border border-outline-variant">',
      '<table class="min-w-full border-collapse text-sm leading-6">',
      `<thead><tr>${headerHtml}</tr></thead>`,
      `<tbody>${rowHtml}</tbody>`,
      '</table>',
      '</div>'
    ].join(''),
    nextIndex: index
  };
}

function isBlockStart(lines, index) {
  const line = lines[index] || '';
  const nextLine = lines[index + 1] || '';

  return [
    /^#{1,6}\s+/.test(line),
    /^```/.test(line),
    /^>\s?/.test(line),
    /^[-*+]\s+/.test(line),
    /^\d+\.\s+/.test(line),
    /^-{3,}\s*$/.test(line),
    isTableRow(line) && isTableSeparator(nextLine)
  ].some(Boolean);
}

// mermaid モジュールのキャッシュ（動的 import の二重ロードを防ぐ）
let mermaidModule = null;
let mermaidInitialized = false;

/**
 * コンテナ要素内の .mermaid ノードを mermaid で描画する。
 * .mermaid ノードが 0 個の場合は何もしない（不要な import を避ける）。
 * fire-and-forget で呼び出すことを前提とし、内部で例外を catch する。
 */
async function renderMermaidInContainer(container) {
  const nodes = Array.from(container.querySelectorAll('.mermaid'));
  if (nodes.length === 0) return;

  try {
    if (!mermaidModule) {
      mermaidModule = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs');
    }

    const mermaid = mermaidModule.default;

    if (!mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
      mermaidInitialized = true;
    }

    await mermaid.run({ nodes });
  } catch (error) {
    console.error('[docViewer] mermaid 描画に失敗しました:', error);
  }
}

function renderMarkdown(markdown) {
  const lines = stripFrontmatter(markdown).split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(/^```([^`]*)$/);
    if (fenceMatch) {
      const language = fenceMatch[1].trim();
      const codeLines = [];
      index += 1;

      while (index < lines.length && !/^```/.test(lines[index].trim())) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      // mermaid フェンスは専用コンテナとして出力し、後から描画する
      if (language === 'mermaid') {
        blocks.push(`<div class="mermaid my-4">${escapeHtml(codeLines.join('\n'))}</div>`);
        continue;
      }

      const languageLabel = language
        ? `<span class="mb-2 block text-xs font-semibold text-on-surface-variant">${escapeHtml(language)}</span>`
        : '';
      blocks.push(`<pre class="my-4 overflow-x-auto rounded-lg bg-surface-variant p-4 text-xs leading-6 text-on-surface"><code>${languageLabel}${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }

    if (isTableRow(line) && isTableSeparator(lines[index + 1] || '')) {
      const table = renderTable(lines, index);
      blocks.push(table.html);
      index = table.nextIndex;
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 6);
      const headingClass = {
        1: 'mt-1 text-2xl font-bold leading-tight text-on-surface',
        2: 'mt-8 border-b border-outline-variant pb-2 text-xl font-bold leading-tight text-on-surface',
        3: 'mt-6 text-lg font-bold leading-tight text-on-surface',
        4: 'mt-5 text-base font-bold leading-tight text-on-surface',
        5: 'mt-4 text-sm font-bold leading-tight text-on-surface',
        6: 'mt-4 text-xs font-bold uppercase leading-tight text-on-surface-variant'
      }[level];
      blocks.push(`<h${level} class="${headingClass}">${renderInlineText(headingMatch[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^-{3,}\s*$/.test(trimmed)) {
      blocks.push('<hr class="my-6 border-outline-variant">');
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ''));
        index += 1;
      }
      blocks.push(`<blockquote class="my-4 border-l-4 border-primary/50 bg-primary/5 px-4 py-3 text-sm leading-7 text-on-surface-variant">${renderInlineText(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    if (/^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const ordered = /^\d+\.\s+/.test(line);
      const items = [];
      const itemPattern = ordered ? /^\d+\.\s+/ : /^[-*+]\s+/;

      while (index < lines.length && itemPattern.test(lines[index])) {
        items.push(lines[index].replace(itemPattern, ''));
        index += 1;
      }

      const tag = ordered ? 'ol' : 'ul';
      const listClass = ordered ? 'list-decimal' : 'list-disc';
      const itemHtml = items.map(item => `<li class="pl-1">${renderInlineText(item)}</li>`).join('');
      blocks.push(`<${tag} class="my-4 ${listClass} space-y-1 pl-6 text-sm leading-7 text-on-surface-variant">${itemHtml}</${tag}>`);
      continue;
    }

    const paragraphLines = [];
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines, index)) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push(`<p class="my-4 text-sm leading-7 text-on-surface-variant">${renderInlineText(paragraphLines.join(' '))}</p>`);
  }

  return `<div class="markdown-view space-y-1">${blocks.join('')}</div>`;
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
    const empty = document.createElement('div');
    empty.className = 'rounded-lg border border-dashed border-outline-variant bg-background p-4 text-sm text-on-surface-variant';
    empty.innerHTML = [
      '<span class="material-icons mb-2 block text-xl text-on-surface-variant">manage_search</span>',
      '<p class="font-semibold text-on-surface">条件に一致する資料がありません。</p>',
      '<p class="mt-1 text-xs leading-5">検索語やフィルタ条件を変えて確認してください。</p>'
    ].join('');
    elements.list.appendChild(empty);
    return;
  }

  state.filteredDocuments.forEach(documentItem => {
    const isSelected = documentItem.id === state.selectedId;
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-current', isSelected ? 'true' : 'false');
    button.className = [
      'group w-full rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary/40',
      isSelected
        ? 'border-primary bg-primary/10 text-on-surface shadow-sm'
        : 'border-outline-variant bg-background text-on-surface hover:border-primary/60 hover:bg-surface-variant'
    ].join(' ');
    button.addEventListener('click', () => {
      state.selectedId = documentItem.id;
      renderDocumentList(state, elements);
      renderSelectedDocument(state, elements);
    });

    const header = document.createElement('span');
    header.className = 'flex flex-wrap items-center gap-2';

    const idBadge = document.createElement('span');
    idBadge.className = [
      'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold',
      isSelected ? 'bg-primary text-primary-on' : 'bg-surface-variant text-on-surface-variant'
    ].join(' ');
    idBadge.textContent = documentItem.id;
    header.appendChild(idBadge);

    if (isSelected) {
      const selectedBadge = document.createElement('span');
      selectedBadge.className = 'inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary';
      selectedBadge.textContent = '表示中';
      header.appendChild(selectedBadge);
    }

    const title = document.createElement('span');
    title.className = 'mt-2 block text-sm font-bold leading-5 text-on-surface';
    title.textContent = documentItem.title;

    const meta = document.createElement('span');
    meta.className = 'mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-on-surface-variant';
    const category = document.createElement('span');
    category.className = 'rounded-full bg-surface px-2 py-0.5';
    category.textContent = documentItem.category || '未分類';
    const sourceStatus = document.createElement('span');
    sourceStatus.className = 'rounded-full bg-surface px-2 py-0.5';
    sourceStatus.textContent = documentItem.sourceStatus || 'ソース未設定';
    meta.append(category, sourceStatus);

    const summary = document.createElement('span');
    summary.className = 'mt-2 block text-xs leading-5 text-on-surface-variant';
    summary.textContent = documentItem.summary || '';

    button.append(header, title, meta, summary);
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
  setHtml(elements.content, renderMarkdown(selectedDocument.markdown));
  // mermaid 図が含まれる場合は非同期で描画（fire-and-forget、例外は関数内で catch）
  renderMermaidInContainer(elements.content);
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
