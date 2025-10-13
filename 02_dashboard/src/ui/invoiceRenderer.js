const invoiceListBody = document.getElementById('invoice-table-body');
const loadingOverlay = document.getElementById('invoice-loading-overlay');
const messageOverlay = document.getElementById('invoice-message-overlay');

const STATUS_MAP = {
  unpaid: { label: '未入金', classes: 'bg-amber-100 text-amber-800' },
  paid: { label: '入金済', classes: 'bg-emerald-100 text-emerald-800' },
  overdue: { label: '延滞', classes: 'bg-rose-100 text-rose-800' },
  canceled: { label: '取消', classes: 'bg-neutral-200 text-neutral-700' }
};

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
  return `<span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${config.classes}">${config.label}</span>`;
}

/**
 * 請求書の一覧をテーブルへ描画する。
 * @param {Array<object>} invoices - 表示対象の請求書配列。
 */
export function renderInvoices(invoices) {
  if (!invoiceListBody) return;
  invoiceListBody.innerHTML = '';

  invoices.forEach(invoice => {
    const row = document.createElement('tr');
    row.classList.add('hover:bg-surface-variant');
    row.dataset.invoiceId = invoice.invoiceId;

    row.innerHTML = `
      <td class="px-4 py-3 whitespace-nowrap">${formatBillingMonth(invoice.issueDate)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-primary-600 font-medium">${invoice.invoiceId}</td>
      <td class="px-4 py-3 whitespace-nowrap">${describePlan(invoice)}</td>
      <td class="px-4 py-3 whitespace-nowrap text-right font-semibold">${formatCurrency(invoice.totalAmount)}</td>
      <td class="px-4 py-3 whitespace-nowrap">${renderStatusBadge(invoice.status)}</td>
      <td class="px-4 py-3 whitespace-nowrap">
        <button
          class="button-secondary inline-flex items-center px-3 py-1 text-sm font-semibold rounded-md view-detail-btn"
          data-invoice-id="${invoice.invoiceId}"
        >
          詳細
        </button>
      </td>
    `;

    invoiceListBody.appendChild(row);
  });

  invoiceListBody.querySelectorAll('.view-detail-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const invoiceId = event.currentTarget.dataset.invoiceId;
      window.location.href = `invoice-detail.html?id=${encodeURIComponent(invoiceId)}`;
    });
  });

  invoiceListBody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => {
      const invoiceId = tr.dataset.invoiceId;
      if (invoiceId) {
        window.location.href = `invoice-detail.html?id=${encodeURIComponent(invoiceId)}`;
      }
    });
  });
}

export function showLoading() {
  if (loadingOverlay) loadingOverlay.classList.remove('hidden');
  if (messageOverlay) messageOverlay.classList.add('hidden');
}

export function hideLoading() {
  if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

export function showMessage(msg) {
  if (messageOverlay) {
    messageOverlay.classList.remove('hidden');
    const p = messageOverlay.querySelector('p');
    if (p) p.textContent = msg;
  }
}
