const currencyFormatter = new Intl.NumberFormat('ja-JP', {
  style: 'currency',
  currency: 'JPY'
});

export function renderInvoicePrint(invoice) {
  setText('issue-date', formatDate(invoice.issueDate));
  setText('invoice-number', invoice.invoiceId);

  setText('corporate-name', `${invoice.corporateName ?? '-'} 御中`);
  setText('contact-person', `${invoice.contactPerson ?? '-'} 様`);

  setText('usage-month', formatBillingPeriod(invoice.billingPeriod));

  setCurrency('subtotal-taxable', invoice.subtotalTaxable);
  setCurrency('tax-amount', invoice.tax);
  setCurrency('subtotal-non-taxable', invoice.subtotalNonTaxable);
  setCurrency('total-amount', invoice.totalAmount, true);

  const bank = invoice.bankInfo ?? {};
  setText('bank-name', bank.bankName ?? '-');
  setText('branch-name', bank.branchName ?? '-');
  setText('account-type', bank.accountType ?? '-');
  setText('account-number', bank.accountNumber ?? '-');
  setText('account-holder', bank.accountHolder ?? '-');
  setText('due-date-bank', formatDate(invoice.dueDate));

  renderItems(invoice.items ?? []);
}

function renderItems(items) {
  const body = document.getElementById('invoice-detail-table-body');
  if (!body) return;

  body.innerHTML = '';

  if (!Array.isArray(items) || items.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="6" class="text-center">明細が登録されていません。</td>
      </tr>
    `;
    return;
  }

  items.forEach((item, index) => {
    const quantityText = formatQuantity(item.quantity, item.unit);
    const unitPriceText = typeof item.unitPrice === 'number' ? currencyFormatter.format(item.unitPrice) : '';
    const amountText = typeof item.amount === 'number' ? currencyFormatter.format(item.amount) : currencyFormatter.format(0);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td>${escapeHtml(item.itemName ?? item.itemName1 ?? '-')}</td>
      <td>${escapeHtml(item.description ?? item.itemName2 ?? '')}</td>
      <td class="text-right">${escapeHtml(quantityText)}</td>
      <td class="text-right">${escapeHtml(unitPriceText)}</td>
      <td class="text-right">${escapeHtml(amountText)}</td>
    `;
    body.appendChild(row);
  });

  const maxRows = 20;
  for (let i = items.length; i < maxRows; i++) {
    const row = document.createElement('tr');
    row.innerHTML = '<td></td><td></td><td></td><td></td><td></td><td></td>';
    body.appendChild(row);
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value ?? '-';
  }
}

function setCurrency(id, value, emphasize = false) {
  const element = document.getElementById(id);
  if (!element) return;
  const formatted = typeof value === 'number' ? currencyFormatter.format(value) : '-';
  element.textContent = emphasize ? `${formatted}（税込）` : formatted;
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
}

function formatBillingPeriod(period) {
  if (!period || (!period.from && !period.to)) {
    return '請求対象期間: -';
  }
  const from = formatDate(period.from);
  const to = formatDate(period.to);
  if (from === '-' && to === '-') {
    return '請求対象期間: -';
  }
  return `請求対象期間: ${from} 〜 ${to}`;
}

function formatQuantity(quantity, unit) {
  if (typeof quantity !== 'number') return '';
  const base = quantity.toLocaleString('ja-JP');
  return unit ? `${base}${unit}` : base;
}

function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
