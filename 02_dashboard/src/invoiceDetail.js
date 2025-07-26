const sampleInvoiceDetails = {
    "2500123001": {
        invoiceId: "2500123001",
        issueMonth: "2025年7月",
        invoiceDate: "2025/07/31",
        dueDate: "2025年08月31日",
        corporateName: "株式会社サンプル商事",
        contactPerson: "経理部御担当者様",
        usageMonth: "2025年7月",
        subtotalTaxable: 50000,
        tax: 5000,
        subtotalNonTaxable: 0,
        totalAmount: 55000,
        items: [
            { no: 1, itemName1: "アンケート作成費用", itemName2: "", quantity: 1, unitPrice: 30000, amount: 30000 },
            { no: 2, itemName1: "名刺データ化費用", itemName2: "(500件)", quantity: 1, unitPrice: 20000, amount: 20000 },
            { no: 3, itemName1: "オプション費用", itemName2: "", quantity: 1, unitPrice: 5000, amount: 5000 }
        ]
    },
    "2500123000": {
        invoiceId: "2500123000",
        issueMonth: "2025年6月",
        invoiceDate: "2025/06/30",
        dueDate: "2025年07月31日",
        corporateName: "株式会社テストカンパニー",
        contactPerson: "田中 花子",
        usageMonth: "2025年6月",
        subtotalTaxable: 40000,
        tax: 4000,
        subtotalNonTaxable: 0,
        totalAmount: 44000,
        items: [
            { no: 1, itemName1: "アンケート作成費用", itemName2: "", quantity: 1, unitPrice: 30000, amount: 30000 },
            { no: 2, itemName1: "名刺データ化費用", itemName2: "(400件)", quantity: 1, unitPrice: 10000, amount: 10000 }
        ]
    }
};

function getInvoiceIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
}

function renderInvoiceDetail(invoice) {
    if (!invoice) {
        document.getElementById('invoiceIdDisplay').textContent = '請求書が見つかりません';
        return;
    }

    document.getElementById('invoiceIdDisplay').textContent = invoice.invoiceId;
    document.getElementById('issueDateDisplay').textContent = invoice.invoiceDate;
    document.getElementById('corporateNameDisplay').textContent = `${invoice.corporateName} 御中`;
    document.getElementById('contactPersonDisplay').textContent = `${invoice.contactPerson} 様`;
    document.getElementById('usageMonthDisplay').textContent = invoice.usageMonth;
    document.getElementById('subtotalTaxableDisplay').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.subtotalTaxable)} 円`;
    document.getElementById('taxDisplay').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.tax)} 円`;
    document.getElementById('subtotalNonTaxableDisplay').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.subtotalNonTaxable)} 円`;
    document.getElementById('totalAmountDisplay').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.totalAmount)} 円(税込)`;
    document.getElementById('dueDateDisplay').textContent = invoice.dueDate;

    const itemsBody = document.getElementById('invoice-items-body');
    itemsBody.innerHTML = invoice.items.map(item => `
        <tr>
            <td>${item.no}</td>
            <td>${item.itemName1}</td>
            <td>${item.itemName2}</td>
            <td>${item.quantity}</td>
            <td>${new Intl.NumberFormat('ja-JP').format(item.unitPrice)}</td>
            <td>${new Intl.NumberFormat('ja-JP').format(item.amount)}</td>
        </tr>
    `).join('');

    // 請求明細の空行を20行になるまで追加
    const existingRows = invoice.items.length;
    const rowsToAdd = 20 - existingRows;
    if (rowsToAdd > 0) {
        let emptyRowsHtml = '';
        for (let i = 0; i < rowsToAdd; i++) {
            emptyRowsHtml += `<tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
        }
        itemsBody.innerHTML += emptyRowsHtml;
    }
}

export function initInvoiceDetailPage() {
    const invoiceId = getInvoiceIdFromUrl();
    const invoice = sampleInvoiceDetails[invoiceId];
    renderInvoiceDetail(invoice);

    // PDFダウンロードボタンのイベントリスナー
    const printButton = document.getElementById('printButton');
    if (printButton) {
        printButton.addEventListener('click', () => {
            window.print();
        });
    }

    const downloadPdfButton = document.getElementById('downloadPdfButton');
    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            window.print();
        });
    }
}