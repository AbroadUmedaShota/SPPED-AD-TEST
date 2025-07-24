
const sampleInvoiceDetails = [
    {
        invoiceId: "2500123001",
        issueDate: "2025/07/31",
        dueDate: "2025年08月31日",
        corporateName: "株式会社サンプル商事",
        seikyuName: "経理部御担当者様",
        totalAmount: 55000,
        tax: 5000,
        subtotalTaxable: 50000,
        subtotalNonTaxable: 0,
        usageMonth: "2025年7月",
        items: [
            { no: 1, itemName1: "アンケート名A", itemName2: "名刺データ化費用", quantity: 100, unitPrice: 200, amount: 20000 },
            { no: 2, itemName1: "アンケート名A", itemName2: "クーポンお値引き", quantity: 1, unitPrice: -5000, amount: -5000 },
            { no: 3, itemName1: "アンケート名A", itemName2: "御礼メール送信", quantity: 1, unitPrice: 1000, amount: 1000 },
            { no: 4, itemName1: "アンケート名A", itemName2: "小計", quantity: "", unitPrice: "", amount: 16000 },
            { no: 5, itemName1: "月額費用", itemName2: "グループアカウント利用料", quantity: 1, unitPrice: 30000, amount: 30000 },
            { no: 6, itemName1: "月額費用", itemName2: "小計", quantity: "", unitPrice: "", amount: 30000 },
        ]
    },
    {
        invoiceId: "2500123000",
        issueDate: "2025/06/30",
        dueDate: "2025年07月31日",
        corporateName: "株式会社テストカンパニー",
        seikyuName: "代表取締役様",
        totalAmount: 48000,
        tax: 4000,
        subtotalTaxable: 44000,
        subtotalNonTaxable: 0,
        usageMonth: "2025年6月",
        items: [
            { no: 1, itemName1: "アンケート名B", itemName2: "名刺データ化費用", quantity: 80, unitPrice: 200, amount: 16000 },
            { no: 2, itemName1: "アンケート名B", itemName2: "御礼メール送信", quantity: 1, unitPrice: 1000, amount: 1000 },
            { no: 3, itemName1: "アンケート名B", itemName2: "小計", quantity: "", unitPrice: "", amount: 17000 },
            { no: 4, itemName1: "月額費用", itemName2: "グループアカウント利用料", quantity: 1, unitPrice: 30000, amount: 30000 },
            { no: 5, itemName1: "月額費用", itemName2: "小計", quantity: "", unitPrice: "", amount: 30000 },
        ]
    }
];

function getInvoiceDetails(invoiceId) {
    return sampleInvoiceDetails.find(invoice => invoice.invoiceId === invoiceId);
}

function renderInvoiceDetails(invoice) {
    if (!invoice) {
        document.body.innerHTML = '<p>請求書が見つかりませんでした。</p>';
        return;
    }

    // ヘッダー情報
    document.querySelector('.issue-info div:nth-child(1)').textContent = `発行日: ${invoice.issueDate}`;
    document.querySelector('.issue-info div:nth-child(2)').textContent = `請求書番号: ${invoice.invoiceId}`;

    // 宛先情報
    document.querySelector('.recipient-details div:nth-child(1)').textContent = `${invoice.corporateName} 御中`;
    document.querySelector('.recipient-details div:nth-child(2)').textContent = `${invoice.seikyuName} 様`;

    // 請求概要
    document.querySelector('.billing-summary-table tr:nth-child(1) td').textContent = `SPEED AD利用料 ${invoice.usageMonth}月分`;
    document.querySelector('.billing-summary-table tr:nth-child(2) td').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.subtotalTaxable)} 円`;
    document.querySelector('.billing-summary-table tr:nth-child(3) td').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.tax)} 円`;
    document.querySelector('.billing-summary-table tr:nth-child(4) td').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.subtotalNonTaxable)} 円`;
    document.querySelector('.billing-summary-table tr:nth-child(5) td').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.totalAmount)} 円(税込)`;

    // 銀行情報 - 支払期日
    document.querySelector('.bank-details-table tr:nth-child(6) td').textContent = invoice.dueDate;

    // 請求明細
    const detailTableBody = document.querySelector('.detail-table tbody');
    if (detailTableBody) {
        detailTableBody.innerHTML = ''; // 既存の行をクリア
        invoice.items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.no}</td>
                <td>${item.itemName1}</td>
                <td>${item.itemName2}</td>
                <td class="text-right">${item.quantity}</td>
                <td class="text-right">${item.unitPrice !== "" ? new Intl.NumberFormat('ja-JP').format(item.unitPrice) : ""}</td>
                <td class="text-right">${item.amount !== "" ? new Intl.NumberFormat('ja-JP').format(item.amount) : ""}</td>
            `;
            detailTableBody.appendChild(row);
        });

        // 残りの空行を追加 (最大20行まで)
        const existingRows = invoice.items.length;
        for (let i = existingRows; i < 20; i++) {
            const emptyRow = document.createElement('tr');
            emptyRow.innerHTML = `<td>${i + 1}</td><td></td><td></td><td></td><td></td><td></td>`;
            detailTableBody.appendChild(emptyRow);
        }
    }

    // 印刷ボタンとPDFダウンロードボタンのイベントリスナー
    const printButton = document.getElementById('printButton');
    if (printButton) {
        printButton.addEventListener('click', () => {
            window.print();
        });
    }

    const downloadPdfButton = document.getElementById('downloadPdfButton');
    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            alert('PDFダウンロード機能は現在開発中です。'); // 仮のアラート
        });
    }
}

export function initInvoiceDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('id');

    if (invoiceId) {
        const invoice = getInvoiceDetails(invoiceId);
        renderInvoiceDetails(invoice);
    } else {
        document.body.innerHTML = '<p>請求書IDが指定されていません。</p>';
    }
}
