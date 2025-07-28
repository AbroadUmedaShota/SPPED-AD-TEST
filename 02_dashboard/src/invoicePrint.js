document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('invoiceId');

    if (!invoiceId) {
        console.error('請求書IDが指定されていません。');
        displayErrorPage('請求書IDが指定されていません。');
        return;
    }

    try {
        const response = await fetch('data/invoices.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const invoices = await response.json();
        const invoice = invoices.find(inv => inv.invoiceId === invoiceId);

        if (invoice) {
            renderInvoicePrint(invoice);
            // 印刷ダイアログを自動的に表示
            window.print();
        } else {
            console.error('指定された請求書が見つかりませんでした。');
            displayErrorPage('指定された請求書が見つかりませんでした。');
        }
    } catch (error) {
        console.error('請求書データの読み込みに失敗しました:', error);
        displayErrorPage('請求書データの読み込みに失敗しました。再試行してください。');
    }
});

function renderInvoicePrint(invoice) {
    // 発行情報
    document.getElementById('issue-date').textContent = invoice.issueDate;
    document.getElementById('invoice-number').textContent = invoice.invoiceId;

    // 件名
    document.getElementById('usage-month').textContent = `SPEED AD利用料 ${invoice.usageMonth}月分`;

    // 宛先情報
    document.getElementById('corporate-name').textContent = invoice.corporateName + ' 御中';
    document.getElementById('contact-person').textContent = invoice.contactPerson + ' 様';

    // 請求概要テーブル
    document.getElementById('subtotal-taxable').textContent = `¥${invoice.subtotalTaxable.toLocaleString()}`;
    document.getElementById('tax-amount').textContent = `¥${invoice.tax.toLocaleString()}`;
    document.getElementById('subtotal-non-taxable').textContent = `¥${invoice.subtotalNonTaxable.toLocaleString()}`;
    document.getElementById('total-amount').textContent = `¥${invoice.totalAmount.toLocaleString()}`;

    // 振込先情報テーブル (仮データ)
    document.getElementById('bank-name').textContent = '三井住友銀行(0009)';
    document.getElementById('branch-name').textContent = '小岩支店(643)';
    document.getElementById('account-type').textContent = '普通';
    document.getElementById('account-number').textContent = '7128447';
    document.getElementById('account-holder').textContent = 'アブロードアウトソーシング株式会社';
    document.getElementById('due-date-bank').textContent = invoice.dueDate; // 支払期日

    // 請求明細テーブル
    const itemsBody = document.getElementById('invoice-detail-table-body');
    itemsBody.innerHTML = ''; // 既存の行をクリア
    invoice.items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${item.itemName1 || ''}</td>
            <td>${item.itemName2 || ''}</td>
            <td class="text-right">${item.quantity !== undefined ? item.quantity.toLocaleString() : ''}</td>
            <td class="text-right">${item.unitPrice !== undefined ? item.unitPrice.toLocaleString() : ''}</td>
            <td class="text-right">¥${item.amount.toLocaleString()}</td>
        `;
        itemsBody.appendChild(row);
    });

    // 請求明細の空行を最大20行まで追加
    const maxRows = 20;
    for (let i = invoice.items.length; i < maxRows; i++) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
            <td></td>
        `;
        itemsBody.appendChild(row);
    }

    // ページ番号 (現状は固定値)
    document.getElementById('page-current').textContent = '1';
    document.getElementById('page-total').textContent = '1'; // 複数ページ対応時に動的に変更
}

function displayErrorPage(message) {
    document.body.innerHTML = `
        <div style="text-align: center; padding: 50px; font-size: 24px; color: red;">
            <p>エラーが発生しました。</p>
            <p>${message}</p>
            <p>このページを閉じてください。</p>
        </div>
    `;
}