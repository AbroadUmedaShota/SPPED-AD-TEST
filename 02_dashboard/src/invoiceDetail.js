import { loadCommonHtml, showLoading, hideLoading, showMessage } from './utils.js';
import { initSidebarHandler } from './sidebarHandler.js';
import { initBreadcrumbs } from './breadcrumb.js';

document.addEventListener('DOMContentLoaded', async () => {
    await loadCommonHtml('header-placeholder', 'common/header.html');
    await loadCommonHtml('sidebar-placeholder', 'common/sidebar.html', initSidebarHandler);
    await loadCommonHtml('footer-placeholder', 'common/footer.html');

    initBreadcrumbs([
        { name: 'ダッシュボード', href: 'index.html' },
        { name: '請求書一覧', href: 'invoiceList.html' },
        { name: '請求書詳細', href: '#' }
    ]);

    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('id');

    if (invoiceId) {
        await loadInvoiceDetail(invoiceId);
    } else {
        showMessage('invoice-detail-message-overlay', '請求書IDが指定されていません。');
    }

    document.getElementById('downloadPdfBtn').addEventListener('click', () => {
        const invoiceContent = document.getElementById('invoice-content');
        const opt = {
            margin:       0.5,
            filename:     `請求書_${invoiceId}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().from(invoiceContent).set(opt).save();
    });
    
    document.getElementById('printInvoiceBtn').addEventListener('click', () => {
        const printWindow = window.open(`invoice-print.html?id=${invoiceId}`, '_blank');
    });
});

async function loadInvoiceDetail(invoiceId) {
    showLoading('invoice-detail-loading-overlay');
    try {
        const response = await fetch('data/invoices.json');
        if (!response.ok) {
            throw new Error('請求書データの読み込みに失敗しました。');
        }
        const invoices = await response.json();
        const invoice = invoices.find(inv => inv.invoiceId === invoiceId);

        if (invoice) {
            populateInvoiceData(invoice);
        } else {
            showMessage('invoice-detail-message-overlay', '該当する請求書が見つかりません。');
        }
    } catch (error) {
        console.error('Error loading invoice details:', error);
        showMessage('invoice-detail-message-overlay', error.message);
    } finally {
        hideLoading('invoice-detail-loading-overlay');
    }
}

function populateInvoiceData(invoice) {
    const yen = (value) => value.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' });

    document.getElementById('invoice-number').textContent = invoice.invoiceId;
    document.getElementById('issue-date').textContent = invoice.issueDate;
    document.getElementById('due-date').textContent = invoice.dueDate;
    document.getElementById('corporate-name').textContent = invoice.corporateName;
    document.getElementById('contact-person').textContent = invoice.contactPerson;
    document.getElementById('usage-month').textContent = invoice.usageMonth;

    document.getElementById('subtotal-taxable').textContent = yen(invoice.subtotalTaxable);
    document.getElementById('tax-amount').textContent = yen(invoice.tax);
    document.getElementById('subtotal-non-taxable').textContent = yen(invoice.subtotalNonTaxable);
    document.getElementById('total-amount').textContent = yen(invoice.totalAmount);

    document.getElementById('bank-name').textContent = invoice.bankInfo.bankName;
    document.getElementById('branch-name').textContent = invoice.bankInfo.branchName;
    document.getElementById('account-type').textContent = invoice.bankInfo.accountType;
    document.getElementById('account-number').textContent = invoice.bankInfo.accountNumber;
    document.getElementById('account-holder').textContent = invoice.bankInfo.accountHolder;

    const tableBody = document.getElementById('invoice-items-table-body');
    tableBody.innerHTML = ''; // Clear existing rows

    // Mock data generation for details
    const mockItems = [
        { no: 1, name1: 'アンケート名A', name2: '名刺データ化費用', quantity: 1, price: 15000, total: 15000 },
        { no: 2, name1: 'アンケート名A', name2: 'クーポンお値引き', quantity: 1, price: -1000, total: -1000 },
        { no: 3, name1: 'アンケート名A', name2: '御礼メール送信', quantity: 1, price: 500, total: 500 },
        { no: 4, name1: 'アンケート名A', name2: '小計', quantity: null, price: null, total: 14500 },
        { no: 5, name1: 'アンケート名B', name2: '名刺データ化費用', quantity: 560, price: 200, total: 112000 },
        { no: 6, name1: 'アンケート名B', name2: 'クーポンお値引き', quantity: 1, price: 0, total: 0 },
        { no: 7, name1: 'アンケート名B', name2: '御礼メール送信', quantity: 1600, price: 1, total: 1600 },
        { no: 8, name1: 'アンケート名B', name2: '小計', quantity: null, price: null, total: 113600 },
        { no: 9, name1: '月額費用', name2: 'グループアカウント利用料', quantity: 1, price: 30000, total: 30000 },
        { no: 10, name1: '月額費用', name2: '小計', quantity: null, price: null, total: 30000 },
    ];

    mockItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.no}</td>
            <td>${item.name1}</td>
            <td>${item.name2}</td>
            <td class="text-right">${item.quantity !== null ? item.quantity : ''}</td>
            <td class="text-right">${item.price !== null ? yen(item.price) : ''}</td>
            <td class="text-right font-bold">${yen(item.total)}</td>
        `;
        if (item.name2.includes('小計')) {
            row.style.fontWeight = 'bold';
        }
        tableBody.appendChild(row);
    });
}