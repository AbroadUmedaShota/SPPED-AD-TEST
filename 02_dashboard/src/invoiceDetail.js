export function initInvoiceDetailPage() {
    const urlParams = new URLSearchParams(window.location.search);
    const invoiceId = urlParams.get('invoiceId');

    if (invoiceId) {
        fetchInvoiceDetails(invoiceId);
    } else {
        console.error('invoiceId がURLパラメータから見つかりません。');
        // エラーメッセージを表示するか、一覧画面に戻るなどの処理
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
                // データが見つからない場合のエラー処理
            }
        } catch (error) {
            console.error('請求書データの読み込みに失敗しました:', error);
            // エラーメッセージを表示
        }
    }

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
}