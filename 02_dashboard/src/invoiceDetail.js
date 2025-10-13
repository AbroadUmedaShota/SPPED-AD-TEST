import { showLoading, hideLoading, showMessage, downloadFile } from './utils.js';
import { fetchInvoiceById } from './services/invoiceService.js';

const STATUS_CONFIG = {
  unpaid: { label: '未入金', classes: 'bg-amber-100 text-amber-800' },
  paid: { label: '入金済', classes: 'bg-emerald-100 text-emerald-800' },
  overdue: { label: '延滞', classes: 'bg-rose-100 text-rose-800' },
  canceled: { label: '取消', classes: 'bg-neutral-200 text-neutral-700' }
};

const CATEGORY_ORDER = ['BASE', 'ADD_ON', 'ONE_TIME', 'CREDIT'];

export async function initInvoiceDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('id');

  if (!invoiceId) {
    showMessage('invoice-detail-message-overlay', '請求書IDが指定されていません。');
    return;
  }

  const downloadButton = document.getElementById('downloadPdfBtn');
  if (downloadButton) {
    downloadButton.addEventListener('click', () => {
      downloadFile('seikyusyo_sample.xlsx', `invoice-${invoiceId}.xlsx`);
    });
  }

  const printButton = document.getElementById('printInvoiceBtn');
  if (printButton) {
    printButton.addEventListener('click', () => {
      window.open(`invoice-print.html?id=${encodeURIComponent(invoiceId)}`, '_blank');
    });
  }

  await loadInvoiceDetail(invoiceId);
}

async function loadInvoiceDetail(invoiceId) {
  showLoading('invoice-detail-loading-overlay');
  try {
    const invoice = await fetchInvoiceById(invoiceId);
    if (!invoice) {
      showMessage('invoice-detail-message-overlay', '対象の請求書が見つかりませんでした。');
      return;
    }

    renderInvoiceDetail(invoice);
    showMessage('invoice-detail-message-overlay', '', false);
  } catch (error) {
    console.error('Error loading invoice details:', error);
    showMessage('invoice-detail-message-overlay', error.message || '請求データの取得に失敗しました。');
  } finally {
    hideLoading('invoice-detail-loading-overlay');
  }
}

function renderInvoiceDetail(invoice) {
  setText('invoice-number', invoice.invoiceId);
  setText('issue-date', formatDate(invoice.issueDate));
  setText('due-date', formatDate(invoice.dueDate));
  setText('billing-period', formatBillingPeriod(invoice.billingPeriod));
  setText('plan-summary', describePlan(invoice));
  setText('addon-summary', describeAddOns(invoice.addOns));
  setText('corporate-name', `${invoice.corporateName ?? '-'} 御中`);
  setText('contact-person', `${invoice.contactPerson ?? '-'} 様`);

  setCurrency('subtotal-taxable', invoice.subtotalTaxable);
  setCurrency('subtotal-non-taxable', invoice.subtotalNonTaxable);
  setCurrency('tax-amount', invoice.tax);
  setCurrency('total-amount', invoice.totalAmount);

  const bank = invoice.bankInfo ?? {};
  setText('bank-name', bank.bankName ?? '-');
  setText('branch-name', bank.branchName ?? '-');
  setText('account-type', bank.accountType ?? '-');
  setText('account-number', bank.accountNumber ?? '-');
  setText('account-holder', bank.accountHolder ?? '-');

  updateStatusBadge(invoice.status);
  toggleNotes(invoice.notes);
  renderItemTable(invoice.items ?? []);
  togglePrintAvailability(invoice.status);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value ?? '-';
  }
}

function setCurrency(id, amount) {
  const element = document.getElementById(id);
  if (!element) return;
  if (typeof amount !== 'number') {
    element.textContent = '-';
    return;
  }
  const formatter = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
  element.textContent = formatter.format(amount);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
}

function formatBillingPeriod(period) {
  if (!period || (!period.from && !period.to)) return '-';
  const from = formatDate(period.from);
  const to = formatDate(period.to);
  if (from === '-' && to === '-') return '-';
  return `${from} 〜 ${to}`;
}

function describePlan(invoice) {
  const plan = invoice?.plan;
  if (!plan) return '-';
  const label = plan.billingType === 'annual' ? '年額' : '月額';
  return `${plan.displayName ?? '-'}（${label}）`;
}

function describeAddOns(addOns) {
  if (!Array.isArray(addOns) || addOns.length === 0) {
    return 'なし';
  }
  return addOns.map(addOn => {
    const quantity = addOn.quantity != null ? `${addOn.quantity}${addOn.unit ?? ''}` : '';
    return quantity ? `${addOn.displayName} ${quantity}` : addOn.displayName;
  }).join(' / ');
}

function updateStatusBadge(status) {
  const badgeContainer = document.getElementById('invoice-status-badge');
  if (!badgeContainer) return;
  const config = STATUS_CONFIG[status] ?? { label: '不明', classes: 'bg-neutral-200 text-neutral-700' };
  badgeContainer.innerHTML = `<span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${config.classes}">${config.label}</span>`;
}

function toggleNotes(notes) {
  const section = document.getElementById('invoice-notes-section');
  const paragraph = document.getElementById('invoice-notes');
  if (!section || !paragraph) return;

  if (notes) {
    paragraph.textContent = notes;
    section.hidden = false;
  } else {
    paragraph.textContent = '';
    section.hidden = true;
  }
}

function renderItemTable(items) {
  const tbody = document.getElementById('invoice-items-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-6 text-on-surface-variant">明細が登録されていません。</td>
      </tr>
    `;
    return;
  }

  const formatter = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
  const grouped = CATEGORY_ORDER.reduce((acc, key) => ({ ...acc, [key]: [] }), {});

  items.forEach(item => {
    const key = CATEGORY_ORDER.includes(item.category) ? item.category : 'ONE_TIME';
    grouped[key].push(item);
  });

  let lineNumber = 1;
  CATEGORY_ORDER.forEach(category => {
    const categoryItems = grouped[category];
    if (!categoryItems || categoryItems.length === 0) return;

    let categoryTotal = 0;
    categoryItems.forEach(item => {
      const amount = typeof item.amount === 'number' ? item.amount : 0;
      categoryTotal += amount;
      const quantity = item.quantity != null ? item.quantity.toLocaleString('ja-JP') : '-';
      const unitPrice = item.unitPrice != null ? formatter.format(item.unitPrice) : '-';
      const amountText = formatter.format(amount);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${lineNumber++}</td>
        <td>${item.itemName ?? '-'}</td>
        <td>${item.description ?? ''}</td>
        <td class="text-right">${quantity}</td>
        <td class="text-right">${unitPrice}</td>
        <td class="text-right font-medium">${amountText}</td>
      `;
      tbody.appendChild(row);
    });

    const subtotalRow = document.createElement('tr');
    subtotalRow.innerHTML = `
      <td colspan="5" class="text-right font-semibold bg-surface-variant">
        ${getCategoryLabel(category)}
      </td>
      <td class="text-right font-semibold bg-surface-variant">
        ${formatter.format(categoryTotal)}
      </td>
    `;
    tbody.appendChild(subtotalRow);
  });
}

function getCategoryLabel(category) {
  switch (category) {
    case 'BASE':
      return '小計（基本料金）';
    case 'ADD_ON':
      return '小計（追加オプション）';
    case 'ONE_TIME':
      return '小計（一時費用）';
    case 'CREDIT':
      return '小計（調整額）';
    default:
      return '小計';
  }
}

function togglePrintAvailability(status) {
  const printButton = document.getElementById('printInvoiceBtn');
  if (!printButton) return;
  if (status === 'canceled') {
    printButton.setAttribute('disabled', 'true');
    printButton.classList.add('opacity-60', 'cursor-not-allowed');
  } else {
    printButton.removeAttribute('disabled');
    printButton.classList.remove('opacity-60', 'cursor-not-allowed');
  }
}
