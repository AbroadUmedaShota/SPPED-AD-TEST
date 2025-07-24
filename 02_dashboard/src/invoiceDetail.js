const sampleInvoiceDetails = {
    "2500123001": {
        invoiceId: "2500123001",
        issueMonth: "2025年7月",
        invoiceDate: "2025-07-20",
        dueDate: "2025-08-31",
        totalAmount: 55000,
        paymentStatus: "未払",
        companyName: "株式会社サンプル商事",
        contactPerson: "山田 太郎",
        address: "東京都渋谷区サンプル1-2-3",
        phoneNumber: "03-1234-5678",
        items: [
            { name: "アンケート作成費用", quantity: 1, unitPrice: 30000, amount: 30000 },
            { name: "名刺データ化費用 (500件)", quantity: 1, unitPrice: 20000, amount: 20000 },
            { name: "オプション費用", quantity: 1, unitPrice: 5000, amount: 5000 }
        ]
    },
    "2500123000": {
        invoiceId: "2500123000",
        issueMonth: "2025年6月",
        invoiceDate: "2025-06-15",
        dueDate: "2025-07-31",
        totalAmount: 50000,
        paymentStatus: "支払済",
        companyName: "株式会社テストカンパニー",
        contactPerson: "田中 花子",
        address: "大阪府大阪市テスト4-5-6",
        phoneNumber: "06-9876-5432",
        items: [
            { name: "アンケート作成費用", quantity: 1, unitPrice: 30000, amount: 30000 },
            { name: "名刺データ化費用 (400件)", quantity: 1, unitPrice: 20000, amount: 20000 }
        ]
    }
};

function getInvoiceIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function renderInvoiceDetail(invoice) {
    if (!invoice) {
        document.getElementById('invoiceId').textContent = '請求書が見つかりません';
        return;
    }

    document.getElementById('invoiceId').textContent = invoice.invoiceId;
    document.getElementById('issueMonth').textContent = invoice.issueMonth;
    document.getElementById('invoiceDate').textContent = invoice.invoiceDate;
    document.getElementById('dueDate').textContent = invoice.dueDate;
    document.getElementById('totalAmount').textContent = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(invoice.totalAmount);
    document.getElementById('paymentStatus').textContent = invoice.paymentStatus;
    document.getElementById('companyName').textContent = invoice.companyName;
    document.getElementById('contactPerson').textContent = invoice.contactPerson;
    document.getElementById('address').textContent = invoice.address;
    document.getElementById('phoneNumber').textContent = invoice.phoneNumber;

    const itemsBody = document.getElementById('invoice-items-body');
    itemsBody.innerHTML = invoice.items.map(item => `
        <tr>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface">${item.name}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface">${item.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface">${new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(item.unitPrice)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface">${new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(item.amount)}</td>
        </tr>
    `).join('');
}

export function initInvoiceDetailPage() {
    const invoiceId = getInvoiceIdFromUrl();
    const invoice = sampleInvoiceDetails[invoiceId];
    renderInvoiceDetail(invoice);

    // PDFダウンロードボタンのイベントリスナー
    const downloadPdfButton = document.getElementById('downloadPdfButton');
    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            alert('PDFダウンロード機能は現在開発中です。'); // 仮の処理
        });
    }
}