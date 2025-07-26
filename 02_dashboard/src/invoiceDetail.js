<<<<<<< HEAD
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

export function initInvoiceDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('invoiceId');

    if (invoiceId) {
        fetchInvoiceDetails(invoiceId);
    } else {
        // invoiceId がURLパラメータから見つからない場合、サンプルデータを使用
        const sampleId = "2500123001"; // デフォルトのサンプルID
        const invoice = sampleInvoiceDetails[sampleId];
        if (invoice) {
            renderInvoiceDetails(invoice);
        } else {
            console.error(`サンプル請求書ID ${sampleId} のデータが見つかりません。`);
        }
    }

    async function fetchInvoiceDetails(id) {
        try {
            const response = await fetch('data/invoices.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const invoices = await response.json();
            const invoice = invoices.find(inv => inv.invoiceId === id);

            if (invoice) {
                renderInvoiceDetails(invoice);
            } else {
                console.error(`請求書ID ${id} のデータが見つかりません。`);
            }
        } catch (error) {
            console.error('請求書データの読み込みに失敗しました:', error);
        }
    }

    function renderInvoiceDetails(invoice) {
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

        // 印刷ボタン
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

    function formatDate(dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    }

    function formatDateJP(dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}年${(date.getMonth() + 1)}月${date.getDate()}日`;
    }
}
>>>>>>> 13-invoice-list-detail-screen-creation
        }
        itemsBody.innerHTML += emptyRowsHtml;
    }
}

<<<<<<< HEAD
    function renderInvoiceDetails(invoice) {
        // ヘッダー情報
        document.getElementById('issue-date').textContent = formatDate(invoice.issueDate);
        document.getElementById('invoice-id').textContent = invoice.invoiceId;

        // 宛先情報 (仮データ)
        const corporateName = "株式会社サンプル商事"; // 仮データ
        const seikyuName = "経理部御担当者様"; // 仮データ
        document.getElementById('corporate-name').textContent = `${corporateName} 御中`;
        document.getElementById('seikyu-name').textContent = `${seikyuName} 様`;

        // 請求概要テーブル
        const issueDate = new Date(invoice.issueDate);
        const usageMonth = `${issueDate.getFullYear()}年${issueDate.getMonth() + 1}月`;
        document.getElementById('usage-month').textContent = `SPEED AD利用料 ${usageMonth}月分`;
        document.getElementById('subtotal-taxable').textContent = `${invoice.totalAmount - invoice.tax} 円`;
        document.getElementById('tax').textContent = `${invoice.tax} 円`;
        document.getElementById('subtotal-non-taxable').textContent = `- 円`; // 仮で固定値
        document.getElementById('total-amount').textContent = `${invoice.totalAmount} 円(税込)`;

        // 振込先情報
        document.getElementById('due-date').textContent = formatDateJP(invoice.dueDate);

        // 請求明細テーブル
        const invoiceItemsBody = document.getElementById('invoice-items-body');
        invoiceItemsBody.innerHTML = '';

        invoice.items.forEach((item, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${item.itemName}</td>
                <td></td> <!-- 品名2は現在データにないので空 -->
                <td></td> <!-- 数量は現在データにないので空 -->
                <td></td> <!-- 単価は現在データにないので空 -->
                <td class="text-end">${item.amount.toLocaleString()}</td>
            `;
            invoiceItemsBody.appendChild(row);
=======
export function initInvoiceDetailPage() {
    const invoiceId = getInvoiceIdFromUrl();
    const invoice = sampleInvoiceDetails[invoiceId];
    renderInvoiceDetail(invoice);

    // PDFダウンロードボタンのイベントリスナー
    const printButton = document.getElementById('printButton');
    if (printButton) {
        printButton.addEventListener('click', () => {
            window.print();
>>>>>>> 13-invoice-list-detail-screen-creation
        });

        // 空行を最大20行まで追加
        const existingRows = invoice.items.length;
        for (let i = existingRows; i < 20; i++) {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${i + 1}</td><td></td><td></td><td></td><td></td><td></td>`;
            invoiceItemsBody.appendChild(row);
        }

        // ページ番号 (現状は固定)
        document.getElementById('page-number').textContent = '1/1';
    }

<<<<<<< HEAD
    function formatDate(dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    }

    function formatDateJP(dateString) {
        const date = new Date(dateString);
        return `${date.getFullYear()}年${(date.getMonth() + 1)}月${date.getDate()}日`;
    }

    // 印刷ボタン
    document.getElementById('print-button').addEventListener('click', () => {
        window.print();
    });

    // PDFダウンロードボタン
    document.getElementById('download-pdf-button').addEventListener('click', () => {
        const element = document.querySelector('.container'); // 請求書全体を対象
        html2pdf().from(element).save('invoice.pdf');
    });
=======
    const downloadPdfButton = document.getElementById('downloadPdfButton');
    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            window.print();
        });
    }
>>>>>>> 13-invoice-list-detail-screen-creation
}