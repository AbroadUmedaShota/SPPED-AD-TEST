import { fetchInvoiceById } from './services/invoiceService.js';
import { renderInvoiceDetails, displayNotFound } from './ui/invoiceDetailRenderer.js';

/**
 * 請求書詳細ページを初期化します。
 */
async function initInvoiceDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('invoiceId');

    if (!invoiceId) {
        console.error("URLに 'invoiceId' が指定されていません。");
        displayNotFound();
        return;
    }

    try {
        const invoice = await fetchInvoiceById(invoiceId);
        if (invoice) {
            renderInvoiceDetails(invoice);
            setupActionButtons(invoiceId);
        } else {
            console.error(`請求書ID ${invoiceId} のデータが見つかりません。`);
            displayNotFound();
        }
    } catch (error) {
        console.error('請求書データの処理中にエラーが発生しました:', error);
        displayNotFound();
    }
}

/**
 * 印刷およびPDFダウンロードボタンのイベントリスナーを設定します。
 * @param {string} invoiceId - 現在の請求書ID。
 */
function setupActionButtons(invoiceId) {
    const printButton = document.getElementById('printInvoiceBtn');
    if (printButton) {
        printButton.addEventListener('click', () => {
            const printWindow = window.open(`invoice-print.html?invoiceId=${invoiceId}`, '_blank');
            printWindow.onload = () => printWindow.print();
        });
    }

    const downloadPdfButton = document.getElementById('downloadPdfBtn');
    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            const element = document.getElementById('main-content');
            const opt = {
                margin: [10, 10, 10, 10],
                filename: `invoice_${invoiceId}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        });
    }
}

export default initInvoiceDetailPage;
