import { fetchInvoices } from './services/invoiceService.js';
import { renderInvoices, showLoading, hideLoading, showMessage } from './ui/invoiceRenderer.js';

export async function initInvoiceListPage() {
  showLoading();

  try {
    const invoices = await fetchInvoices();
    if (!Array.isArray(invoices) || invoices.length === 0) {
      showMessage('対象の請求書がありません。');
    } else {
      renderInvoices(invoices);
    }
  } catch (error) {
    console.error('Failed to load invoices:', error);
    showMessage('請求データの取得に失敗しました。ページを再読み込みしてください。');
  } finally {
    hideLoading();
  }
}
