import { fetchInvoices } from './services/invoiceService.js';
import { renderInvoices, showLoading, hideLoading, showMessage } from './ui/invoiceRenderer.js';

export async function initInvoiceListPage() {
    showLoading();

    try {
        const invoices = await fetchInvoices();
        if (invoices.length === 0) {
            showMessage('表示する請求書がありません。');
        } else {
            renderInvoices(invoices);
        }
    } catch (error) {
        showMessage('請求書データの読み込みに失敗しました。再試行してください。');
    } finally {
        hideLoading();
    }
}