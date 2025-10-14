import { fetchInvoices } from './services/invoiceService.js';
import { renderInvoices, showLoading, hideLoading, showMessage } from './ui/invoiceRenderer.js';

let allInvoices = [];
let hasLoadedInvoices = false;

function filterInvoicesByStatus(status) {
  if (status === 'all') {
    return [...allInvoices];
  }
  return allInvoices.filter(invoice => invoice?.status === status);
}

function applyFilter(status) {
  if (!hasLoadedInvoices) return;

  const targetStatus = status ?? 'all';
  const filtered = filterInvoicesByStatus(targetStatus);

  if (filtered.length === 0) {
    const message = targetStatus === 'all'
      ? '対象の請求書がありません。'
      : '該当する請求書がありません。';
    showMessage(message);
  }

  renderInvoices(filtered);
}

export async function initInvoiceListPage() {
  const filterSelect = document.getElementById('invoice-status-filter');

  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      applyFilter(filterSelect.value);
    });
  }

  showLoading();

  try {
    const invoices = await fetchInvoices();
    allInvoices = Array.isArray(invoices) ? invoices : [];
    hasLoadedInvoices = true;

    if (allInvoices.length === 0) {
      showMessage('対象の請求書がありません。', {
        action: {
          label: '再読み込み',
          onClick: () => window.location.reload()
        }
      });
      renderInvoices([]);
    } else {
      const initialFilter = filterSelect ? filterSelect.value : 'all';
      applyFilter(initialFilter);
    }
  } catch (error) {
    console.error('Failed to load invoices:', error);
    showMessage('請求データの取得に失敗しました。ページを再読み込みしてください。', {
      tone: 'error',
      action: {
        label: '再読み込み',
        onClick: () => window.location.reload()
      }
    });
    renderInvoices([]);
  } finally {
    hideLoading();
  }
}
