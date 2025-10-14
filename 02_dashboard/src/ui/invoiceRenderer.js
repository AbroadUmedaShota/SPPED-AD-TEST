const invoiceCardList = document.getElementById('invoice-card-list');
const statusMessage = document.getElementById('invoice-status-message');
const resultCount = document.getElementById('invoice-result-count');

const STATUS_MAP = {
  unpaid: { label: '未入金', classes: 'bg-amber-100 text-amber-800' },
  paid: { label: '入金済', classes: 'bg-emerald-100 text-emerald-800' },
  overdue: { label: '延滞', classes: 'bg-rose-100 text-rose-800' },
  canceled: { label: '取消', classes: 'bg-neutral-200 text-neutral-700' }
};

const MESSAGE_TONES = {
  muted: ['bg-surface', 'border-outline-variant', 'text-on-surface-variant'],
  error: ['bg-rose-50', 'border-rose-200', 'text-rose-700']
};

const ALL_TONE_CLASSES = Object.values(MESSAGE_TONES).flat();

function formatBillingMonth(issueDate) {
  const date = new Date(issueDate);
  if (Number.isNaN(date.getTime())) return '-';
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
}

function formatCurrency(amount) {
  if (typeof amount !== 'number') return '-';
  return `¥${amount.toLocaleString('ja-JP')}`;
}

function describePlan(invoice) {
  const plan = invoice?.plan;
  if (!plan) return '-';

  const billingLabel = plan.billingType === 'annual' ? '年額' : '月額';
  let text = `${plan.displayName ?? '-'}（${billingLabel}）`;

  const addOns = Array.isArray(invoice?.addOns) ? invoice.addOns : [];
  if (addOns.length > 0) {
    const addOnSummary = addOns
      .map(addOn => {
        const qty = addOn.quantity != null ? `${addOn.quantity}${addOn.unit ?? ''}` : '';
        return qty ? `${addOn.displayName} ${qty}` : addOn.displayName;
      })
      .join(' / ');
    text += ` / ${addOnSummary}`;
  }
  return text;
}

function renderStatusBadge(status) {
  const config = STATUS_MAP[status] ?? { label: '不明', classes: 'bg-neutral-200 text-neutral-700' };
  const badge = document.createElement('span');
  badge.className = `inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${config.classes}`;
  badge.textContent = config.label;
  return badge;
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
  card.className = 'rounded-xl border border-outline-variant bg-surface p-5 shadow-sm transition hover:border-primary hover:shadow-md focus-within:border-primary focus-within:shadow-md cursor-pointer';

  if (invoice?.invoiceId) {
    card.dataset.invoiceId = invoice.invoiceId;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between';
  card.appendChild(wrapper);

  const left = document.createElement('div');
  left.className = 'flex flex-col gap-2';
  wrapper.appendChild(left);

  const billingMonth = document.createElement('p');
  billingMonth.className = 'text-lg font-semibold text-on-background';
  billingMonth.textContent = formatBillingMonth(invoice?.issueDate);
  left.appendChild(billingMonth);

  const invoiceId = document.createElement('p');
  invoiceId.className = 'text-sm font-medium text-primary-600';
  invoiceId.textContent = invoice?.invoiceId ?? '-';
  left.appendChild(invoiceId);

  const planDescription = document.createElement('p');
  planDescription.className = 'text-sm text-on-surface-variant';
  planDescription.textContent = describePlan(invoice);
  left.appendChild(planDescription);

  const right = document.createElement('div');
  right.className = 'flex flex-col items-start gap-3 text-sm sm:items-end';
  wrapper.appendChild(right);

  const amount = document.createElement('p');
  amount.className = 'text-xl font-bold text-on-background';
  amount.textContent = formatCurrency(invoice?.totalAmount);
  right.appendChild(amount);

  right.appendChild(renderStatusBadge(invoice?.status));

  const detailButton = document.createElement('button');
  detailButton.type = 'button';
  detailButton.className = 'inline-flex items-center text-sm font-semibold text-primary-600 transition hover:text-primary';
  detailButton.textContent = '詳細を見る';
  if (invoice?.invoiceId) {
    detailButton.dataset.invoiceId = invoice.invoiceId;
  }
  detailButton.addEventListener('click', (event) => {
    event.stopPropagation();
    navigateToInvoiceDetail(invoice?.invoiceId);
  });
  right.appendChild(detailButton);

  card.addEventListener('click', () => {
    navigateToInvoiceDetail(invoice?.invoiceId);
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
