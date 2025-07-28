function renderInvoicePrint(invoice) {
    // 発行情報
    document.getElementById('issue-date').textContent = invoice.issueDate;
    document.getElementById('invoice-number').textContent = invoice.invoiceId;

    // 宛先情報
    document.getElementById('corporate-name').textContent = invoice.corporateName + ' 御中';
    document.getElementById('contact-person').textContent = invoice.contactPerson + ' 様';

    // 件名
    document.getElementById('usage-month').textContent = `SPEED AD利用料 ${invoice.usageMonth}月分`;

    // 請求概要テーブル
    document.getElementById('subtotal-taxable').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.subtotalTaxable)} 円`;
    document.getElementById('tax-amount').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.tax)} 円`;
    document.getElementById('subtotal-non-taxable').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.subtotalNonTaxable)} 円`;
    document.getElementById('total-amount').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.totalAmount)} 円(税込)`;

    // 振込先情報テーブル
    document.getElementById('bank-name').textContent = invoice.bankInfo.bankName;
    document.getElementById('branch-name').textContent = invoice.bankInfo.branchName;
    document.getElementById('account-type').textContent = invoice.bankInfo.accountType;
    document.getElementById('account-number').textContent = invoice.bankInfo.accountNumber;
    document.getElementById('account-holder').textContent = invoice.bankInfo.accountHolder;
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

    // 画像パスの修正
    const logoAbroad = document.querySelector('.sender-details img[alt="Abroad Outsourcing Co.,Inc."]');
    if (logoAbroad) {
        logoAbroad.src = 'seikyu_logo.png';
    }
    const logoSpeedAd = document.querySelector('.sender-details img[alt="SPEED AD運営会社"]');
    if (logoSpeedAd) {
        logoSpeedAd.src = 'seikyu_syaban.png';
    }
}