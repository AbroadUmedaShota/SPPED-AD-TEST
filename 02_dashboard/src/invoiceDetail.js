import { showLoading, hideLoading, showMessage, downloadFile } from './utils.js';
import { fetchInvoiceById } from './services/invoiceService.js';
import { fetchAllUsers, fetchUserByEmail } from './services/userService.js';
import { fetchAllGroups } from './services/groupService.js';

const STATUS_CONFIG = {
  unpaid: { label: '未入金', classes: 'bg-amber-100 text-amber-800' },
  paid: { label: '入金済', classes: 'bg-emerald-100 text-emerald-800' },
  overdue: { label: '延滞', classes: 'bg-rose-100 text-rose-800' },
  canceled: { label: '取消', classes: 'bg-neutral-200 text-neutral-700' }
};

const CATEGORY_ORDER = ['BASE', 'ADD_ON', 'ONE_TIME', 'CREDIT'];

export async function initInvoiceDetailPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const invoiceId = urlParams.get('id');

  if (!invoiceId) {
    showMessage('invoice-detail-message-overlay', '請求書IDが指定されていません。');
    return;
  }

  const downloadButton = document.getElementById('downloadPdfBtn');
  if (downloadButton) {
    downloadButton.addEventListener('click', () => {
      const element = document.getElementById('invoice-sheet-container');

      // Temporarily remove styles that interfere with PDF generation
      const sheets = element.querySelectorAll('.invoice-sheet');
      const originalInfo = [];

      // Save and modify Container width
      const originalContainerWidth = element.style.width;
      element.style.width = '210mm'; // Force exactly A4 width

      sheets.forEach((sheet, index) => {
        // @ts-ignore
        originalInfo.push({
          marginBottom: sheet.style.marginBottom,
          boxShadow: sheet.style.boxShadow,
          minHeight: sheet.style.minHeight,
          height: sheet.style.height,
          padding: sheet.style.padding,
          pageBreakAfter: sheet.style.pageBreakAfter
        });
        // @ts-ignore
        sheet.style.marginBottom = '0';
        // @ts-ignore
        sheet.style.boxShadow = 'none';

        // Remove min-height / height constraints
        // @ts-ignore
        sheet.style.minHeight = 'auto';
        // @ts-ignore
        sheet.style.height = 'auto';
        // @ts-ignore
        sheet.style.padding = '10mm 15mm';

        // STRICT PAGE BREAK MANAGEMENT
        if (index < sheets.length - 1) {
          // @ts-ignore
          sheet.style.pageBreakAfter = 'always';
        } else {
          // @ts-ignore
          sheet.style.pageBreakAfter = 'auto';
        }

        // GLOBAL ROW COMPRESSION (All pages)
        // Compressing to 18px ensures valid fit even with font updates or rendering shifts.
        const rows = sheet.querySelectorAll('td');
        rows.forEach(td => {
          // @ts-ignore
          if (!td.dataset.originalHeight) {
            // @ts-ignore
            td.dataset.originalHeight = td.style.height || '';
          }
          // @ts-ignore
          td.style.height = '18px';
        });
      });

      const opt = {
        margin: 0,
        filename: `invoice-${invoiceId}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] }
      };

      // @ts-ignore
      html2pdf().set(opt).from(element).save().then(() => {
        // Restore original styles
        element.style.width = originalContainerWidth;
        sheets.forEach((sheet, i) => {
          // @ts-ignore
          sheet.style.marginBottom = originalInfo[i].marginBottom;
          // @ts-ignore
          sheet.style.boxShadow = originalInfo[i].boxShadow;
          // @ts-ignore
          sheet.style.minHeight = originalInfo[i].minHeight;
          // @ts-ignore
          sheet.style.height = originalInfo[i].height;
          // @ts-ignore
          sheet.style.padding = originalInfo[i].padding;
          // @ts-ignore
          sheet.style.pageBreakAfter = originalInfo[i].pageBreakAfter;

          // Restore row heights
          const rows = sheet.querySelectorAll('td');
          rows.forEach(td => {
            // @ts-ignore
            if (td.dataset.originalHeight !== undefined) {
              // @ts-ignore
              td.style.height = td.dataset.originalHeight;
            } else {
              // @ts-ignore
              td.style.height = '';
            }
          });
        });
      }).catch(err => {
        console.error('PDF generation failed:', err);
        // Restore styles even if it fails
        element.style.width = originalContainerWidth;
        sheets.forEach((sheet, i) => {
          // @ts-ignore
          sheet.style.marginBottom = originalInfo[i].marginBottom;
          // @ts-ignore
          sheet.style.boxShadow = originalInfo[i].boxShadow;
          // @ts-ignore
          sheet.style.minHeight = originalInfo[i].minHeight;
          // @ts-ignore
          sheet.style.height = originalInfo[i].height;
          // @ts-ignore
          sheet.style.padding = originalInfo[i].padding;
          // @ts-ignore
          sheet.style.pageBreakAfter = originalInfo[i].pageBreakAfter;

          // Restore row heights
          const rows = sheet.querySelectorAll('td');
          rows.forEach(td => {
            // @ts-ignore
            if (td.dataset.originalHeight !== undefined) {
              // @ts-ignore
              td.style.height = td.dataset.originalHeight;
            } else {
              // @ts-ignore
              td.style.height = '';
            }
          });
        });
      });
    });
  }



  await loadInvoiceDetail(invoiceId);
}

async function loadInvoiceDetail(invoiceId) {
  showLoading('invoice-detail-loading-overlay');
  try {
    const invoice = await fetchInvoiceById(invoiceId);
    if (!invoice) {
      showMessage('invoice-detail-message-overlay', '対象の請求書が見つかりませんでした。');
      return;
    }

    // NEW LOGIC: Resolve billing information
    const [users, groups] = await Promise.all([fetchAllUsers(), fetchAllGroups()]);

    let billingInfo = { corporateName: '-', contactPerson: '-' };
    let accountFound = false;

    // Search for account in users
    const userAccount = users.find(u => u.accountId === invoice.accountId);
    if (userAccount) {
      accountFound = true;
      if (userAccount.billingAddressType === 'different' && userAccount.billingCompanyName) {
        billingInfo.corporateName = userAccount.billingCompanyName;
        billingInfo.contactPerson = `${userAccount.billingLastName} ${userAccount.billingFirstName} 様`;
      } else {
        billingInfo.corporateName = userAccount.companyName;
        billingInfo.contactPerson = `${userAccount.lastName} ${userAccount.firstName} 様`;
      }
    }

    // If not found in users, search in groups
    if (!accountFound) {
      const groupAccount = groups.find(g => g.accountId === invoice.accountId);
      if (groupAccount) {
        accountFound = true;
        if (groupAccount.billing && groupAccount.billing.type === 'group') {
          billingInfo.corporateName = groupAccount.billing.corporateName;
          billingInfo.contactPerson = groupAccount.billing.contactPerson;
        } else if (groupAccount.billing && groupAccount.billing.type === 'creator') {
          const creator = await fetchUserByEmail(groupAccount.billing.creatorId);
          if (creator) {
            if (creator.billingAddressType === 'different' && creator.billingCompanyName) {
              billingInfo.corporateName = creator.billingCompanyName;
              billingInfo.contactPerson = `${creator.billingLastName} ${creator.billingFirstName} 様`;
            } else {
              billingInfo.corporateName = creator.companyName;
              billingInfo.contactPerson = `${creator.lastName} ${creator.firstName} 様`;
            }
          }
        }
      }
    }

    if (!accountFound) {
      throw new Error(`アカウント情報が見つかりません: ${invoice.accountId}`);
    }

    // Attach resolved info to the invoice object
    invoice.corporateName = billingInfo.corporateName;
    invoice.contactPerson = billingInfo.contactPerson;
    // END NEW LOGIC

    renderInvoiceDetail(invoice);
    renderInvoiceSheet(invoice);
    showMessage('invoice-detail-message-overlay', '', false);
  } catch (error) {
    console.error('Error loading invoice details:', error);
    showMessage('invoice-detail-message-overlay', error.message || '請求データの取得に失敗しました。');
  } finally {
    hideLoading('invoice-detail-loading-overlay');
  }
}

function renderInvoiceDetail(invoice) {
  // Legacy fields (Top sections)
  setText('invoice-number', invoice.invoiceId);
  setText('issue-date', formatDate(invoice.issueDate));
  setText('due-date', formatDate(invoice.dueDate));
  setText('billing-period', formatBillingPeriod(invoice.billingPeriod));
  setText('plan-summary', describePlan(invoice));
  setText('addon-summary', describeAddOns(invoice.addOns));
  setText('corporate-name', `${invoice.corporateName ?? '-'} 御中`);
  setText('contact-person', `${invoice.contactPerson ?? '-'} 様`);

  toggleNotes(invoice.notes);
}

function renderInvoiceSheet(invoice) {
  // 1. Fill Header Info
  setText('sheet-issue-date', formatDate(invoice.issueDate));
  setText('sheet-invoice-number', invoice.invoiceId); // Assuming format is handled in backend or raw string

  // 2. Fill Recipient & Sender
  setText('sheet-corporate-name', invoice.corporateName ?? '-');
  setText('sheet-contact-person', invoice.contactPerson ?? '-');

  // 3. Fill Summary & Bank Info
  setText('sheet-billing-period', `SPEED AD利用料 ${formatDateMonth(invoice.billingPeriod?.from)}分`); // Rough month extraction
  setCurrency('sheet-subtotal-taxable', invoice.subtotalTaxable);
  setCurrency('sheet-subtotal-non-taxable', invoice.subtotalNonTaxable);
  setCurrency('sheet-tax-amount', invoice.tax);

  const totalAmountEl = document.getElementById('sheet-total-amount');
  if (totalAmountEl) {
    totalAmountEl.textContent = `¥ ${invoice.totalAmount ? invoice.totalAmount.toLocaleString() : '0'}`;
  }

  const bank = invoice.bankInfo ?? {};
  setText('sheet-bank-name', `${bank.bankName ?? '-'} (${bank.bankCode ?? ''})`);
  setText('sheet-branch-name', `${bank.branchName ?? '-'} (${bank.branchCode ?? ''})`);
  setText('sheet-account-type', bank.accountType ?? '-');
  setText('sheet-account-number', bank.accountNumber ?? '-');
  setText('sheet-account-holder', bank.accountHolder ?? '-');
  setText('sheet-due-date', formatDate(invoice.dueDate));

  // 4. Fill Details Table with Pagination
  const items = invoice.items ?? [];
  const ROWS_PER_PAGE_1 = 20; // 1-20
  const ROWS_PER_PAGE_2 = 42; // 21-62

  const container = document.getElementById('invoice-sheet-container');
  // Clear any extra pages (keep page 1)
  const page1 = document.getElementById('invoice-page-1');
  container.innerHTML = '';
  container.appendChild(page1);

  // Split items into pages
  const pagesItems = [];

  // Page 1 items
  pagesItems.push(items.slice(0, ROWS_PER_PAGE_1));

  // Subsequent pages
  let remainingItems = items.slice(ROWS_PER_PAGE_1);
  while (remainingItems.length > 0) {
    pagesItems.push(remainingItems.slice(0, ROWS_PER_PAGE_2));
    remainingItems = remainingItems.slice(ROWS_PER_PAGE_2);
  }

  // If no items, at least have one page (already pushed)

  const totalPages = pagesItems.length;

  pagesItems.forEach((pageItems, pageIndex) => {
    const pageNum = pageIndex + 1;
    let pageElement;
    let tbody;

    if (pageNum === 1) {
      pageElement = page1;
      tbody = document.getElementById('sheet-details-tbody-1');
      document.getElementById('page-number-1').textContent = `1/${totalPages}`;
    } else {
      // Create new page
      const newPage = document.createElement('div');
      newPage.className = `invoice-sheet page-2`;
      newPage.innerHTML = `
        <div style="font-size: 10pt; margin-bottom: 2px;">ご請求明細</div>
        <table class="details-table">
           <thead>
              <tr class="bg-header">
                 <th class="col-no"></th>
                 <th class="col-item1">品 名 １</th>
                 <th class="col-item2">品 名 ２</th>
                 <th class="col-qty">数 量</th>
                 <th class="col-price">単 価</th>
                 <th class="col-amount">金 額</th>
              </tr>
           </thead>
           <tbody></tbody>
        </table>
        <div class="page-number">${pageNum}/${totalPages}</div>
      `;
      container.appendChild(newPage);
      tbody = newPage.querySelector('tbody');
    }

    renderPageRows(tbody, pageItems, pageNum, ROWS_PER_PAGE_1, ROWS_PER_PAGE_2);
  });
}

function renderPageRows(tbody, items, pageNum, rowsPage1, rowsPage2) {
  const formatter = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
  const startNo = pageNum === 1 ? 1 : rowsPage1 + (pageNum - 2) * rowsPage2 + 1;
  const maxRows = pageNum === 1 ? rowsPage1 : rowsPage2;

  let html = '';

  // Fill actual items
  items.forEach((item, index) => {
    const isSubtotal = item.isSubtotal;
    const isSpacer = item.isSpacer;
    const no = (isSubtotal || isSpacer) ? '' : (startNo + index);
    const quantity = item.quantity != null ? item.quantity.toLocaleString('ja-JP') : '';
    const unitPrice = item.unitPrice != null ? (item.unitPrice < 0 ? `-${Math.abs(item.unitPrice).toLocaleString()}` : item.unitPrice.toLocaleString()) : '';
    const amount = item.amount != null ? (item.amount < 0 ? `-${Math.abs(item.amount).toLocaleString()}` : item.amount.toLocaleString()) : '';

    html += `
      <tr class="${isSubtotal ? 'subtotal-row' : (isSpacer ? 'spacer-row' : '')}">
        <td class="col-no">${no}</td>
        <td>${item.itemName ?? '-'}</td>
        <td>${item.description ?? ''}</td>
        <td class="col-qty">${quantity}</td>
        <td class="col-price">${unitPrice}</td>
        <td class="col-amount">${amount}</td>
      </tr>
    `;
  });

  // Fill empty rows
  const remainingRows = maxRows - items.length;
  for (let i = 0; i < remainingRows; i++) {
    const no = startNo + items.length + i;
    html += `
      <tr>
        <td class="col-no">${no}</td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td></td>
      </tr>
    `;
  }

  tbody.innerHTML = html;
}

function formatDateMonth(value) {
  if (!value) return '__';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '__';
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value ?? '-';
  }
}

function setCurrency(id, amount) {
  const element = document.getElementById(id);
  if (!element) return;
  if (typeof amount !== 'number') {
    element.textContent = '-';
    return;
  }
  const formatter = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
  element.textContent = formatter.format(amount);
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
}

function formatBillingPeriod(period) {
  if (!period || (!period.from && !period.to)) return '-';
  const from = formatDate(period.from);
  const to = formatDate(period.to);
  if (from === '-' && to === '-') return '-';
  return `${from} 〜 ${to}`;
}

function describePlan(invoice) {
  const plan = invoice?.plan;
  if (!plan) return '-';
  const label = plan.billingType === 'annual' ? '年額' : '月額';
  return `${plan.displayName ?? '-'}（${label}）`;
}

function describeAddOns(addOns) {
  if (!Array.isArray(addOns) || addOns.length === 0) {
    return 'なし';
  }
  return addOns.map(addOn => {
    const quantity = addOn.quantity != null ? `${addOn.quantity}${addOn.unit ?? ''}` : '';
    return quantity ? `${addOn.displayName} ${quantity}` : addOn.displayName;
  }).join(' / ');
}

function toggleNotes(notes) {
  const section = document.getElementById('invoice-notes-section');
  const paragraph = document.getElementById('invoice-notes');
  if (!section || !paragraph) return;

  if (notes) {
    paragraph.textContent = notes;
    section.hidden = false;
  } else {
    paragraph.textContent = '';
    section.hidden = true;
  }
}



