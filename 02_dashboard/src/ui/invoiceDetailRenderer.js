/**
 * @file invoiceDetailRenderer.js
 * 請求書詳細画面のUI描画と更新を扱うモジュール
 */

// DOM要素をキャッシュするオブジェクト
const dom = {};

/**
 * 必要なDOM要素を一度だけキャッシュします。
 */
function cacheDOMElements() {
    if (Object.keys(dom).length > 0) return;
    dom.invoiceNumber = document.getElementById('invoice-number');
    dom.issueDate = document.getElementById('issue-date');
    dom.dueDate = document.getElementById('due-date');
    dom.corporateName = document.getElementById('corporate-name');
    dom.contactPerson = document.getElementById('contact-person');
    dom.itemsBody = document.getElementById('invoice-items-table-body');
    dom.subtotalTaxable = document.getElementById('subtotal-taxable');
    dom.taxAmount = document.getElementById('tax-amount');
    dom.subtotalNonTaxable = document.getElementById('subtotal-non-taxable');
    dom.totalAmount = document.getElementById('total-amount');
    dom.bankName = document.getElementById('bank-name');
    dom.branchName = document.getElementById('branch-name');
    dom.accountType = document.getElementById('account-type');
    dom.accountNumber = document.getElementById('account-number');
    dom.accountHolder = document.getElementById('account-holder');
}

/**
 * 請求書の詳細情報をページに描画します。
 * @param {object} invoice - 描画する請求書データ。
 */
export function renderInvoiceDetails(invoice) {
    cacheDOMElements();

    dom.invoiceNumber.textContent = invoice.invoiceId;
    dom.issueDate.textContent = invoice.issueDate;
    dom.dueDate.textContent = invoice.dueDate;
    dom.corporateName.textContent = `${invoice.corporateName} 御中`;
    dom.contactPerson.textContent = `${invoice.contactPerson} 様`;
    dom.subtotalTaxable.textContent = `¥${(invoice.subtotalTaxable ?? 0).toLocaleString()}`;
    dom.taxAmount.textContent = `¥${(invoice.tax ?? 0).toLocaleString()}`;
    dom.subtotalNonTaxable.textContent = `¥${(invoice.subtotalNonTaxable ?? 0).toLocaleString()}`;
    dom.totalAmount.textContent = `¥${(invoice.totalAmount ?? 0).toLocaleString()}`;

    if (invoice.bankInfo) {
        dom.bankName.textContent = invoice.bankInfo.bankName || '';
        dom.branchName.textContent = invoice.bankInfo.branchName || '';
        dom.accountType.textContent = invoice.bankInfo.accountType || '';
        dom.accountNumber.textContent = invoice.bankInfo.accountNumber || '';
        dom.accountHolder.textContent = invoice.bankInfo.accountHolder || '';
    }

    // 明細テーブルの描画
    dom.itemsBody.innerHTML = invoice.items.map(item => `
        <tr>
            <td class="px-4 py-2">${item.no}</td>
            <td class="px-4 py-2">${item.itemName1 || ''}</td>
            <td class="px-4 py-2">${item.itemName2 || ''}</td>
            <td class="px-4 py-2 text-right">${item.quantity}</td>
            <td class="px-4 py-2 text-right">${item.unitPrice.toLocaleString()}</td>
            <td class="px-4 py-2 text-right">${item.amount.toLocaleString()}</td>
        </tr>
    `).join('');
}

/**
 * データが見つからなかった場合にエラーメッセージを表示します。
 */
export function displayNotFound() {
    cacheDOMElements();
    document.querySelector('h1').textContent = '請求書が見つかりません';
    const fieldsToClear = [
        dom.invoiceNumber, dom.issueDate, dom.dueDate, dom.corporateName,
        dom.contactPerson, dom.subtotalTaxable, dom.taxAmount, dom.subtotalNonTaxable,
        dom.totalAmount, dom.bankName, dom.branchName, dom.accountType, dom.accountNumber, dom.accountHolder
    ];
    fieldsToClear.forEach(el => {
        if(el) el.textContent = '-';
    });
    if(dom.itemsBody) dom.itemsBody.innerHTML = '<tr<td colspan="6" class="text-center py-8">データが見つかりませんでした。</td></tr>';
}
