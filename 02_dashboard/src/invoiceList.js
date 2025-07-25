export function initInvoiceListPage() {
    const invoiceListBody = document.getElementById('invoice-table-body');

    // 仮のデータ読み込み関数
    async function fetchInvoices() {
        try {
            const response = await fetch('data/invoices.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const invoices = await response.json();
            renderInvoices(invoices);
        } catch (error) {
            console.error('請求書データの読み込みに失敗しました:', error);
            invoiceListBody.innerHTML = '<tr><td colspan="4">請求書データの読み込みに失敗しました。</td></tr>';
        }
    }

    function renderInvoices(invoices) {
        invoiceListBody.innerHTML = ''; // 既存の行をクリア
        invoices.forEach(invoice => {
            const row = document.createElement('tr');
            row.classList.add('hover:bg-surface-variant', 'cursor-pointer');

            // 発行月 (issueDateからYYYY年MM月形式に変換)
            const issueDate = new Date(invoice.issueDate);
            const year = issueDate.getFullYear();
            const month = issueDate.getMonth() + 1; // 月は0から始まるため+1
            const formattedMonth = `${year}年${month}月`;

            // 請求金額 (カンマ区切りにフォーマット)
            const formattedAmount = invoice.totalAmount.toLocaleString();

            // 支払状況に応じたバッジ
            let statusBadge = '';
            switch (invoice.status) {
                case 'unpaid':
                    statusBadge = `<span class="badge bg-warning text-dark">未払</span>`;
                    break;
                case 'paid':
                    statusBadge = `<span class="badge bg-success text-white">支払済</span>`;
                    break;
                case 'processing':
                    statusBadge = `<span class="badge bg-info text-white">処理中</span>`;
                    break;
                default:
                    statusBadge = `<span class="badge bg-secondary">不明</span>`;
            }

            row.innerHTML = `
                <td>${formattedMonth}</td>
                <td>¥${formattedAmount}</td>
                <td>${statusBadge}</td>
                <td>
                    <button class="button-secondary btn-sm view-detail-btn" data-invoice-id="${invoice.invoiceId}">
                        詳細
                    </button>
                </td>
            `;
            invoiceListBody.appendChild(row);
        });

        // 詳細ボタンにイベントリスナーを追加
        document.querySelectorAll('.view-detail-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const invoiceId = event.target.dataset.invoiceId;
                // 請求書詳細画面へ遷移
                window.location.href = `invoiceDetail.html?invoiceId=${invoiceId}`;
            });
        });
    }

    // 請求書データを読み込む
    fetchInvoices();
}