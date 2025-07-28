export function initInvoiceListPage() {
    const invoiceListBody = document.getElementById('invoice-table-body');
    const loadingOverlay = document.getElementById('invoice-loading-overlay');
    const messageOverlay = document.getElementById('invoice-message-overlay');
    const applyFilterBtn = document.getElementById('applyFilterBtn');

    // 仮のデータ読み込み関数
    async function fetchInvoices() {
        loadingOverlay.classList.remove('hidden');
        messageOverlay.classList.add('hidden');
        invoiceListBody.innerHTML = ''; // 既存の行をクリア

        try {
            const response = await fetch('data/invoices.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const invoices = await response.json();
            if (invoices.length === 0) {
                showMessage('表示する請求書がありません。');
            } else {
                renderInvoices(invoices);
            }
        } catch (error) {
            console.error('請求書データの読み込みに失敗しました:', error);
            showMessage('請求書データの読み込みに失敗しました。再試行してください。');
        } finally {
            loadingOverlay.classList.add('hidden');
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

            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap">${formattedMonth}</td>
                <td class="px-4 py-3 whitespace-nowrap">¥${formattedAmount}</td>
                <td class="px-4 py-3 whitespace-nowrap">
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
                window.location.href = `invoice-detail.html?invoiceId=${invoiceId}`;
            });
        });
    }

    function showMessage(msg) {
        messageOverlay.classList.remove('hidden');
        messageOverlay.querySelector('p').textContent = msg;
    }

    // フィルタ適用ボタンのイベントリスナー
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => {
            // ここにフィルタリングロジックを実装
            // 例: 期間や検索ボックスの値を取得し、fetchInvoicesに渡す
            console.log('フィルタ適用ボタンがクリックされました。');
            fetchInvoices(); // 仮で再フェッチ
        });
    }

    // 請求書データを読み込む
    fetchInvoices();
}