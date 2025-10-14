const invoiceCardList = document.getElementById('invoice-card-list');
const statusMessage = document.getElementById('invoice-status-message');
const resultCount = document.getElementById('invoice-result-count');

const MESSAGE_TONES = {
  muted: ['bg-surface', 'border-outline-variant', 'text-on-surface-variant'],
  error: ['bg-rose-50', 'border-rose-200', 'text-rose-700']
};

const ALL_TONE_CLASSES = Object.values(MESSAGE_TONES).flat();

const PLAN_LABELS = {
  STANDARD: 'スタンダード',
  PREMIUM: 'プレミアム',
  PREMIUM_PLUS: 'プレミアム＋'
};

const MESSAGE_TONES = {
  muted: ['bg-surface', 'border-outline-variant', 'text-on-surface-variant'],
  error: ['bg-rose-50', 'border-rose-200', 'text-rose-700']
};

const ALL_TONE_CLASSES = Object.values(MESSAGE_TONES).flat();

function formatBillingMonth(issueDate) {
  const date = new Date(issueDate);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月請求`;
}

function formatBillingPeriod(period) {
  if (!period || !period.from || !period.to) return '';
  return `${period.from}〜${period.to}`;
}

function resolvePlanLabel(invoice) {
  const plan = invoice?.plan;
  if (!plan) return '-';

  if (plan.code && PLAN_LABELS[plan.code]) {
    return PLAN_LABELS[plan.code];
  }

  if (typeof plan.displayName === 'string' && plan.displayName.trim() !== '') {
    return plan.displayName;
  }

  return '-';
}

function resolveBillingRecipient(invoice) {
  if (invoice?.corporateName && invoice.corporateName.trim() !== '') {
    return invoice.corporateName;
  }

  if (invoice?.accountName && invoice.accountName.trim() !== '') {
    return invoice.accountName;
  }

  if (invoice?.accountId && invoice.accountId.trim() !== '') {
    return invoice.accountId;
  }

  return '-';
}

function resolvePlanCode(invoice) {
  const code = invoice?.plan?.code;
  if (typeof code === 'string' && code.trim() !== '') {
    return code.trim().toUpperCase();
  }
  return '';
}

function createPlanBadge(invoice) {
  const label = resolvePlanLabel(invoice);
  const badge = document.createElement('span');
  badge.className = 'invoice-plan-badge';

  const planCode = resolvePlanCode(invoice);
  const normalizedLabel = typeof label === 'string' ? label.trim() : '';
  const isPremiumPlan = planCode === 'PREMIUM' || planCode === 'PREMIUM_PLUS' || normalizedLabel.includes('プレミアム');
  if (isPremiumPlan) {
    badge.classList.add('invoice-plan-badge--premium');
  } else {
    badge.classList.add('invoice-plan-badge--standard');
  }

  badge.textContent = label && label !== '-' ? label : 'プラン未設定';
  return badge;
}

function createMetadataItem(title, value) {
  const item = document.createElement('div');
  item.className = 'flex flex-col gap-1';

  const itemTitle = document.createElement('span');
  itemTitle.className = 'text-xs font-semibold uppercase tracking-[0.08em] text-on-surface-variant';
  itemTitle.textContent = title;
  item.appendChild(itemTitle);

  const itemValue = document.createElement('span');
  itemValue.className = 'text-sm font-medium text-on-background';
  itemValue.textContent = value;
  item.appendChild(itemValue);

  return item;
}

function updateResultCount(count) {
  if (resultCount) {
    resultCount.textContent = `${count}件表示中`;
  }
}

function clearStatusMessage() {
  if (!statusMessage) return;
  statusMessage.replaceChildren();
  statusMessage.classList.add('hidden');
  statusMessage.dataset.state = 'idle';
  statusMessage.classList.remove(...ALL_TONE_CLASSES);
}

function setStatusMessage(message, { tone = 'muted', action, state } = {}) {
  if (!statusMessage) return;
  statusMessage.replaceChildren();
  statusMessage.classList.remove('hidden');
  statusMessage.dataset.state = state ?? 'message';

  statusMessage.classList.remove(...ALL_TONE_CLASSES);
  const toneClasses = MESSAGE_TONES[tone] ?? MESSAGE_TONES.muted;
  statusMessage.classList.add(...toneClasses);

  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  statusMessage.appendChild(messageSpan);

  if (action && typeof action.onClick === 'function' && action.label) {
    const actionButton = document.createElement('button');
    actionButton.type = 'button';
    actionButton.className = 'ml-auto inline-flex items-center justify-center rounded-md border border-outline-variant px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-surface-variant';
    actionButton.textContent = action.label;
    actionButton.addEventListener('click', action.onClick);
    statusMessage.appendChild(actionButton);
  }
}

function navigateToInvoiceDetail(invoiceId) {
  if (!invoiceId) return;
  window.location.href = `invoice-detail.html?id=${encodeURIComponent(invoiceId)}`;
}

function createInvoiceCard(invoice) {
  const card = document.createElement('li');
  card.className = 'invoice-card group cursor-pointer';
  
  if (invoice?.invoiceId) {
    card.dataset.invoiceId = invoice.invoiceId;
  }

  card.tabIndex = 0;

  const accent = document.createElement('span');
  accent.className = 'invoice-card-accent';
  accent.setAttribute('aria-hidden', 'true');
  card.appendChild(accent);

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-6';
  card.appendChild(wrapper);

  const headerRow = document.createElement('div');
  headerRow.className = 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between';
  wrapper.appendChild(headerRow);

  const headingBlock = document.createElement('div');
  headingBlock.className = 'flex flex-col gap-1';
  headerRow.appendChild(headingBlock);

  const billingMonth = document.createElement('p');
  billingMonth.className = 'text-xl font-semibold text-on-background tracking-tight';
  billingMonth.textContent = formatBillingMonth(invoice?.issueDate);
  headingBlock.appendChild(billingMonth);

  const periodText = formatBillingPeriod(invoice?.billingPeriod);
  if (periodText) {
    const period = document.createElement('p');
    period.className = 'text-xs font-medium text-on-surface-variant';
    period.textContent = `対象期間 ${periodText}`;
    headingBlock.appendChild(period);
  }

  const planBadge = createPlanBadge(invoice);
  headerRow.appendChild(planBadge);

  const metadataGrid = document.createElement('div');
  metadataGrid.className = 'grid gap-4 sm:grid-cols-2';
  wrapper.appendChild(metadataGrid);

  const invoiceLine = createMetadataItem('請求書番号', invoice?.invoiceId ?? '-');
  metadataGrid.appendChild(invoiceLine);

  const recipient = createMetadataItem('請求先', resolveBillingRecipient(invoice));
  metadataGrid.appendChild(recipient);

  const actionContainer = document.createElement('div');
  actionContainer.className = 'flex items-center';
  wrapper.appendChild(actionContainer);

  const detailButton = document.createElement('button');
  detailButton.type = 'button';
  detailButton.className = 'inline-flex items-center gap-1 rounded-full bg-transparent px-0 text-sm font-semibold text-primary transition hover:underline';
  detailButton.textContent = '詳細を見る';
  if (invoice?.invoiceId) {
    detailButton.dataset.invoiceId = invoice.invoiceId;
  }
  detailButton.addEventListener('click', (event) => {
    event.stopPropagation();
    navigateToInvoiceDetail(invoice?.invoiceId);
  });
  const chevron = document.createElement('span');
  chevron.className = 'material-icons text-base text-primary opacity-80 transition group-hover:translate-x-0.5 group-hover:opacity-100';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = 'chevron_right';
  detailButton.appendChild(chevron);
  actionContainer.appendChild(detailButton);

  card.addEventListener('click', () => {
    navigateToInvoiceDetail(invoice?.invoiceId);
  });

  card.addEventListener('keydown', (event) => {
    if (!invoice?.invoiceId) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateToInvoiceDetail(invoice.invoiceId);
    }
  });

  return card;
}

/**
 * 請求書の一覧をカードリストへ描画する。
 * @param {Array<object>} invoices - 表示対象の請求書配列。
 */
export function renderInvoices(invoices) {
  if (!invoiceCardList) return;

  invoiceCardList.replaceChildren();
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  updateResultCount(safeInvoices.length);

  if (safeInvoices.length === 0) {
    return;
  }

  safeInvoices.forEach(invoice => {
    const card = createInvoiceCard(invoice);
    invoiceCardList.appendChild(card);
  });

  clearStatusMessage();
}

export function showLoading() {
  if (invoiceCardList) {
    invoiceCardList.replaceChildren();
  }
  updateResultCount(0);
  setStatusMessage('読み込み中です…', { state: 'loading' });
}

export function hideLoading() {
  if (statusMessage && statusMessage.dataset.state === 'loading') {
    clearStatusMessage();
  }
}

export function showMessage(message, options = {}) {
  setStatusMessage(message, options);
}
