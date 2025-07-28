// サンプルデータ（フォールバック用）
const sampleInvoiceDetails = {
    "2500001001": { // invoiceIdを修正
        invoiceId: "2500001001",
        issueDate: "2025-07-31", // invoiceDateをissueDateに修正
        dueDate: "2025-08-31",
        corporateName: "株式会社サンプル商事", // customerNameをcorporateNameに修正
        contactPerson: "経理部御担当者様",
        usageMonth: "2025年7月",
        subtotalTaxable: 50000,
        tax: 5000,
        subtotalNonTaxable: 0,
        totalAmount: 55000,
        bankInfo: { // bankInfoを追加
            bankName: "三井住友銀行(0009)",
            branchName: "小岩支店(643)",
            accountType: "普通",
            accountNumber: "7128447",
            accountHolder: "アブロードアウトソーシング株式会社"
        },
        items: [
            { no: 1, itemName1: "アンケート作成費用", itemName2: "", quantity: 1, unitPrice: 30000, amount: 30000 },
            { no: 2, itemName1: "名刺データ化費用", itemName2: "(500件)", quantity: 1, unitPrice: 20000, amount: 20000 },
            { no: 3, itemName1: "オプション費用", itemName2: "", quantity: 1, unitPrice: 5000, amount: 5000 }
        ]
    },
    "2500001002": { // invoiceIdを修正
        invoiceId: "2500001002",
        issueDate: "2025-06-30", // invoiceDateをissueDateに修正
        dueDate: "2025年07月31日",
        corporateName: "株式会社テストカンパニー", // customerNameをcorporateNameに修正
        contactPerson: "田中 花子",
        usageMonth: "2025年6月",
        subtotalTaxable: 40000,
        tax: 4000,
        subtotalNonTaxable: 0,
        totalAmount: 44000,
        bankInfo: { // bankInfoを追加
            bankName: "三井住友銀行(0009)",
            branchName: "小岩支店(643)",
            accountType: "普通",
            accountNumber: "7128447",
            accountHolder: "アブロードアウトソーシング株式会社"
        },
        items: [
            { no: 1, itemName1: "アンケート作成費用", itemName2: "", quantity: 1, unitPrice: 30000, amount: 30000 },
            { no: 2, itemName1: "名刺データ化費用", itemName2: "(400件)", quantity: 1, unitPrice: 10000, amount: 10000 }
        ]
    }
};

function initInvoiceDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('invoiceId');

    if (invoiceId) {
        // URLにIDがある場合はJSONから取得を試みる
        fetchInvoiceDetails(invoiceId);
    } else {
        // URLにIDがない場合はサンプルデータを表示（開発用）
        console.warn("URLに 'invoiceId' が指定されていません。サンプルデータを表示します。");
        const sampleId = "2500001001"; // デフォルトのサンプルID
        const invoice = sampleInvoiceDetails[sampleId];
        if (invoice) {
            renderInvoiceDetails(invoice);
        } else {
            console.error(`サンプル請求書ID ${sampleId} のデータが見つかりません。`);
            displayNotFound();
        }
    }
}

async function fetchInvoiceDetails(id) {
    try {
        // 'data/invoices.json' のパスは実際の環境に合わせてください
        const response = await fetch('data/invoices.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const invoices = await response.json();
        // invoices.json が配列であることを想定
        const invoice = invoices.find(inv => inv.invoiceId === id);

        if (invoice) {
            renderInvoiceDetails(invoice);
        } else {
            console.error(`請求書ID ${id} のデータが見つかりません。`);
            displayNotFound();
        }
    } catch (error) {
        console.error('請求書データの読み込みに失敗しました:', error);
        displayNotFound();
    }
}

function renderInvoiceDetails(invoice) {
    // 各要素にデータを設定
    document.getElementById('invoice-number').textContent = invoice.invoiceId; // 修正
    document.getElementById('issue-date').textContent = invoice.issueDate; // 修正
    document.getElementById('corporate-name').textContent = `${invoice.corporateName} 御中`; // 修正
    document.getElementById('contact-person').textContent = `${invoice.contactPerson} 様`; // 修正
    document.getElementById('usage-month').textContent = invoice.usageMonth; // 修正
    document.getElementById('subtotal-taxable').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.subtotalTaxable)} 円`; // 修正
    document.getElementById('tax-amount').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.tax)} 円`; // 修正
    document.getElementById('subtotal-non-taxable').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.subtotalNonTaxable)} 円`; // 修正
    document.getElementById('total-amount').textContent = `${new Intl.NumberFormat('ja-JP').format(invoice.totalAmount)} 円(税込)`; // 修正
    document.getElementById('due-date').textContent = invoice.dueDate; // 修正

    // 請求明細テーブルを描画
    const itemsBody = document.getElementById('invoice-items-table-body'); // 修正
    itemsBody.innerHTML = invoice.items.map(item => `
        <tr>
            <td>${item.no}</td>
            <td>${item.itemName1 || ''}</td>
            <td>${item.itemName2 || ''}</td>
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

    // 振込先情報エリア
    // 振込先情報エリア
        if (invoice.bankInfo) {
            document.getElementById('bank-name').textContent = invoice.bankInfo.bankName || '';
            document.getElementById('branch-name').textContent = invoice.bankInfo.branchName || '';
            document.getElementById('account-type').textContent = invoice.bankInfo.accountType || '';
            document.getElementById('account-number').textContent = invoice.bankInfo.accountNumber || '';
            document.getElementById('account-holder').textContent = invoice.bankInfo.accountHolder || '';
        }

    // イベントリスナーを設定
    setupButtons();
}

// 請求書が見つからない場合に表示を更新する関数
function displayNotFound() {
    document.getElementById('invoice-number').textContent = '請求書が見つかりません'; // 修正
    // 他のフィールドもクリアまたはメッセージを表示
    const fieldsToClear = [
        'issue-date', 'corporate-name', 'contact-person',
        'usage-month', 'subtotal-taxable', 'tax-amount',
        'subtotal-non-taxable', 'total-amount', 'due-date'
    ];
    fieldsToClear.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.textContent = '-';
    });
    document.getElementById('invoice-items-table-body').innerHTML = ''; // 修正
}

// ボタンのイベントリスナーをまとめる関数
function setupButtons() {
    const printButton = document.getElementById('printInvoiceBtn'); // 修正
    if (printButton) {
        printButton.addEventListener('click', () => {
            const urlParams = new URLSearchParams(window.location.search);
            const invoiceId = urlParams.get('invoiceId');
            if (invoiceId) {
                const printWindow = window.open(`invoice-print.html?invoiceId=${invoiceId}`, '_blank');
                printWindow.onload = function() {
                    printWindow.print();
                };
            }
        });
    }

    const downloadPdfButton = document.getElementById('downloadPdfBtn'); // 修正
    if (downloadPdfButton) {
        downloadPdfButton.addEventListener('click', () => {
            const element = document.getElementById('main-content'); // PDF化する要素
            const urlParams = new URLSearchParams(window.location.search);
            const invoiceId = urlParams.get('invoiceId');
            const opt = {
                margin:       [10, 10, 10, 10], // top, left, bottom, right
                filename:     `invoice_${invoiceId || 'detail'}.pdf`, // invoiceIdがない場合は'detail'
                image:        { type: 'jpeg', quality: 0.98 },
                html2canvas:  { scale: 2 },
                jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            html2pdf().set(opt).from(element).save();
        });
    }
}

// 日付フォーマット関数（必要であれば使用）
/*
function formatDate(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
}

function formatDateJP(dateString) {
    const date = new Date(dateString);
    return `${date.getFullYear()}年${(date.getMonth() + 1)}月${date.getDate()}日`;
}
*/

export default initInvoiceDetailPage;
