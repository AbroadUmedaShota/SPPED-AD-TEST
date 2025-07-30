const invoiceListBody = document.getElementById('invoice-table-body');
const loadingOverlay = document.getElementById('invoice-loading-overlay');
const messageOverlay = document.getElementById('invoice-message-overlay');

/**
 * 請求書リストをテーブルに描画します。
 * @param {Array} invoices - 描画する請求書の配列。
 */
export function renderInvoices(invoices) {
    if (!invoiceListBody) return;
    invoiceListBody.innerHTML = ''; // 既存の行をクリア

    invoices.forEach(invoice => {
        const row = document.createElement('tr');
        row.classList.add('hover:bg-surface-variant', 'cursor-pointer');

        const issueDate = new Date(invoice.issueDate);
        const year = issueDate.getFullYear();
        const month = issueDate.getMonth() + 1;
        const formattedMonth = `${year}年${month}月`;
        const formattedAmount = invoice.totalAmount.toLocaleString();

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">${formattedMonth}</td>
            <td class="px-4 py-3 whitespace-nowrap">${invoice.invoiceId}</td>
            <td class="px-4 py-3 whitespace-nowrap">¥${formattedAmount}</td>
            <td class="px-4 py-3 whitespace-nowrap">
                <button class="button-secondary btn-sm view-detail-btn" data-invoice-id="${invoice.invoiceId}">
                    詳細
                </button>
            </td>
        `;
        invoiceListBody.appendChild(row);
    });

    // ボタンにイベントリスナーを再設定
    document.querySelectorAll('.view-detail-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const invoiceId = event.target.dataset.invoiceId;
            window.location.href = `invoice-detail.html?id=${invoiceId}`;
        });
    });
}

/**
 * ローディングオーバーレイを表示します。
 */
export function showLoading() {
    if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    if (messageOverlay) messageOverlay.classList.add('hidden');
}

/**
 * ローディングオーバーレイを非表示にします。
 */
export function hideLoading() {
    if (loadingOverlay) loadingOverlay.classList.add('hidden');
}

/**
 * メッセージをオーバーレイに表示します。
 * @param {string} msg - 表示するメッセージ。
 */
export function showMessage(msg) {
    if (messageOverlay) {
        messageOverlay.classList.remove('hidden');
        const p = messageOverlay.querySelector('p');
        if (p) p.textContent = msg;
    }
}