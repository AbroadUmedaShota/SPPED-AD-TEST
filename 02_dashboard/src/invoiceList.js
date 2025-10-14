import { fetchInvoices } from './services/invoiceService.js';
import { renderInvoices, showLoading, hideLoading, showMessage } from './ui/invoiceRenderer.js';

export async function initInvoiceListPage() {
  showLoading();

  try {
    const invoices = await fetchInvoices();
    const safeInvoices = Array.isArray(invoices) ? invoices : [];

    if (safeInvoices.length === 0) {
      showMessage('対象の請求書がありません。', {
        action: {
          label: '再読み込み',
          onClick: () => window.location.reload()
        }
      });
      renderInvoices([]);
    } else {
      renderInvoices(safeInvoices);
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
