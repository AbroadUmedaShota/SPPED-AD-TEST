
const sampleInvoices = [
    {
        issueMonth: "2025年7月",
        invoiceId: "2500123001",
        dueDate: "2025-08-31",
        amount: 55000,
    },
    {
        issueMonth: "2025年6月",
        invoiceId: "2500123000",
        dueDate: "2025-07-31",
        amount: 48000,
    },
    {
        issueMonth: "2025年5月",
        invoiceId: "2500122999",
        dueDate: "2025-06-30",
        amount: 52000,
    }
];

function renderInvoiceTable(invoices) {
    const tableBody = document.getElementById('invoice-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = invoices.map(invoice => `
        <tr class="hover:bg-surface-variant cursor-pointer" onclick="window.location.href='invoiceDetail.html?id=${invoice.invoiceId}'">
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface">${invoice.issueMonth}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface font-mono">${invoice.invoiceId}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface">${invoice.dueDate}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface text-right">${new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(invoice.amount)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="invoiceDetail.html?id=${invoice.invoiceId}" class="text-primary hover:text-primary-dark">詳細</a>
            </td>
        </tr>
    `).join('');
}

export function initInvoiceListPage() {
    renderInvoiceTable(sampleInvoices);
}
