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
    downloadButton.addEventListener('click', async () => {
      // ローディング表示
      showLoading('invoice-detail-loading-overlay');

      try {
        const element = document.getElementById('invoice-sheet-container');
        if (!element) {
          throw new Error('請求書要素が見つかりません');
        }

        // 一時的にスタイルを保存して変更
        const sheets = element.querySelectorAll('.invoice-sheet');
        const originalStyles = [];

        sheets.forEach((sheet, index) => {
          // 元のスタイルを保存
          // @ts-ignore
          const original = {
            marginBottom: sheet.style.marginBottom,
            boxShadow: sheet.style.boxShadow,
            minHeight: sheet.style.minHeight,
            height: sheet.style.height,
            maxHeight: sheet.style.maxHeight,
            overflow: sheet.style.overflow,
            position: sheet.style.position,
            padding: sheet.style.padding,
            boxSizing: sheet.style.boxSizing,
            pageBreakAfter: sheet.style.pageBreakAfter
          };

          const pageNumEl = sheet.querySelector('.page-number');
          if (pageNumEl) {
            // @ts-ignore
            original.pageNumber = {
              // @ts-ignore
              position: pageNumEl.style.position,
              // @ts-ignore
              bottom: pageNumEl.style.bottom,
              // @ts-ignore
              right: pageNumEl.style.right,
              // @ts-ignore
              width: pageNumEl.style.width,
              // @ts-ignore
              marginTop: pageNumEl.style.marginTop,
              // @ts-ignore
              paddingTop: pageNumEl.style.paddingTop
            };
          }

          originalStyles.push(original);

          // PDF用スタイルを適用
          // @ts-ignore
          sheet.style.marginBottom = '0';
          // @ts-ignore
          sheet.style.boxShadow = 'none';
          // @ts-ignore
          sheet.style.minHeight = '280mm'; // 余白を考慮して少し小さめに
          // @ts-ignore
          sheet.style.height = 'auto'; // 印刷時は自動に任せる
          // @ts-ignore
          sheet.style.maxHeight = 'none';
          // @ts-ignore
          sheet.style.overflow = 'hidden';
          // @ts-ignore
          sheet.style.position = 'relative';
          // @ts-ignore
          sheet.style.padding = '10mm 15mm 15mm 15mm'; // 下部パディングを15mmに縮小
          // @ts-ignore
          sheet.style.boxSizing = 'border-box';

          // ページ番号の位置調整
          if (pageNumEl) {
            // @ts-ignore
            pageNumEl.style.position = 'absolute';
            // @ts-ignore
            pageNumEl.style.bottom = '5mm';
            // @ts-ignore
            pageNumEl.style.right = '15mm';
            // @ts-ignore
            pageNumEl.style.width = 'auto';
            // @ts-ignore
            pageNumEl.style.marginTop = '0';
            // @ts-ignore
            pageNumEl.style.paddingTop = '0';
          }

          // ページブレイク設定
          if (index < sheets.length - 1) {
            // @ts-ignore
            sheet.style.pageBreakAfter = 'always';
          } else {
            // @ts-ignore
            sheet.style.pageBreakAfter = 'auto';
          }

          // 行の高さ調整
          const rows = sheet.querySelectorAll('td');
          rows.forEach(td => {
            // @ts-ignore
            if (!td.dataset.originalHeight) {
              // @ts-ignore
              td.dataset.originalHeight = td.style.height || '';
            }
            // @ts-ignore
            td.style.height = '20px';
          });
        });

        // PDF生成オプション
        const opt = {
          margin: 0,
          filename: `invoice-${invoiceId}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        };

        // PDF生成
        // @ts-ignore
        await html2pdf().set(opt).from(element).save();

        // 元のスタイルに戻す
        sheets.forEach((sheet, index) => {
          const original = originalStyles[index];
          // @ts-ignore
          sheet.style.marginBottom = original.marginBottom;
          // @ts-ignore
          sheet.style.boxShadow = original.boxShadow;
          // @ts-ignore
          sheet.style.minHeight = original.minHeight;
          // @ts-ignore
          sheet.style.height = original.height;
          // @ts-ignore
          sheet.style.maxHeight = original.maxHeight;
          // @ts-ignore
          sheet.style.overflow = original.overflow;
          // @ts-ignore
          sheet.style.position = original.position;
          // @ts-ignore
          sheet.style.padding = original.padding;
          // @ts-ignore
          sheet.style.boxSizing = original.boxSizing;
          // @ts-ignore
          sheet.style.pageBreakAfter = original.pageBreakAfter;

          const pageNumEl = sheet.querySelector('.page-number');
          if (pageNumEl && original.pageNumber) {
            // @ts-ignore
            pageNumEl.style.position = original.pageNumber.position;
            // @ts-ignore
            pageNumEl.style.bottom = original.pageNumber.bottom;
            // @ts-ignore
            pageNumEl.style.right = original.pageNumber.right;
            // @ts-ignore
            pageNumEl.style.width = original.pageNumber.width;
            // @ts-ignore
            pageNumEl.style.marginTop = original.pageNumber.marginTop;
            // @ts-ignore
            pageNumEl.style.paddingTop = original.pageNumber.paddingTop;
          }

          // 行の高さを戻す
          const rows = sheet.querySelectorAll('td');
          rows.forEach(td => {
            // @ts-ignore
            if (td.dataset.originalHeight !== undefined) {
              // @ts-ignore
              td.style.height = td.dataset.originalHeight;
              // @ts-ignore
              delete td.dataset.originalHeight;
            }
          });
        });

      } catch (error) {
        console.error('PDF生成エラー:', error);
        alert('PDFの生成に失敗しました。');
      } finally {
        hideLoading('invoice-detail-loading-overlay');
      }
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
    const groupBillingAccount = groups.find(group => group.accountId === invoice.accountId && group?.billing?.type === 'group');

    if (groupBillingAccount) {
      accountFound = true;
      billingInfo.corporateName = groupBillingAccount.billing.corporateName;
      billingInfo.contactPerson = groupBillingAccount.billing.contactPerson;
    }

    if (!accountFound) {
      const userAccount = users.find(user => user.accountId === invoice.accountId);
      if (userAccount) {
        accountFound = true;
        if (userAccount.billingAddressType === 'different' && userAccount.billingCompanyName) {
          billingInfo.corporateName = userAccount.billingCompanyName;
          billingInfo.contactPerson = `${userAccount.billingLastName} ${userAccount.billingFirstName}`;
        } else {
          billingInfo.corporateName = userAccount.companyName;
          billingInfo.contactPerson = `${userAccount.lastName} ${userAccount.firstName}`;
        }
      }
    }

    if (!accountFound) {
      const creatorBillingAccount = groups.find(group => group.accountId === invoice.accountId && group?.billing?.type === 'creator');
      if (creatorBillingAccount?.billing?.creatorId) {
        const creator = await fetchUserByEmail(creatorBillingAccount.billing.creatorId);
        if (creator) {
          accountFound = true;
          if (creator.billingAddressType === 'different' && creator.billingCompanyName) {
            billingInfo.corporateName = creator.billingCompanyName;
            billingInfo.contactPerson = `${creator.billingLastName} ${creator.billingFirstName}`;
          } else {
            billingInfo.corporateName = creator.companyName;
            billingInfo.contactPerson = `${creator.lastName} ${creator.firstName}`;
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
  setText('addon-summary', describeAddOns(invoice));
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
  setText('sheet-billing-period', buildInvoiceSubject(invoice));
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

  // 4. Fill Details Table with dynamic pagination
  const items = buildDetailDisplayItems(Array.isArray(invoice.items) ? invoice.items : []);
  const container = document.getElementById('invoice-sheet-container');
  const page1 = document.getElementById('invoice-page-1');
  if (!container || !page1) return;

  container.innerHTML = '';
  container.appendChild(page1);
  const pagesItems = paginateInvoiceItems(items, page1);
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
        <div class="details-section-title">ご請求明細</div>
        <table class="details-table">
           <thead>
              <tr class="bg-header">
                 <th class="col-no">No.</th>
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

    renderPageRows(tbody, pageItems, pageNum);
  });
}

function paginateInvoiceItems(items, page1) {
  if (!Array.isArray(items) || items.length === 0) {
    return [[]];
  }

  const firstPageCapacity = getDetailPageCapacity(page1, 'page-1');
  const followingPageCapacity = getDetailPageCapacity(null, 'page-2');
  const blankSubtotalSpacerHeight = measureDetailRowHeight({ isSpacer: true }, 'page-2');

  const pages = [];
  let currentPage = [];
  let currentHeight = 0;
  let currentCapacity = firstPageCapacity;

  items.forEach(item => {
    const pageType = pages.length === 0 ? 'page-1' : 'page-2';
    const spacerHeight = item?.isSubtotal ? blankSubtotalSpacerHeight : 0;
    const rowHeight = measureDetailRowHeight(item, pageType) + spacerHeight;

    if (currentPage.length > 0 && currentHeight + rowHeight > currentCapacity) {
      if (item?.isSubtotal) {
        const previousRow = currentPage[currentPage.length - 1];
        if (previousRow?.groupKey === item.groupKey && currentPage.length > 1) {
          currentPage.pop();
          currentHeight -= measureDetailRowHeight(previousRow, pageType);
          pages.push(currentPage);
          currentPage = [previousRow];
          currentCapacity = followingPageCapacity;
          currentHeight = measureDetailRowHeight(previousRow, 'page-2');
        } else {
          pages.push(currentPage);
          currentPage = [];
          currentHeight = 0;
          currentCapacity = followingPageCapacity;
        }
      } else {
        pages.push(currentPage);
        currentPage = [];
        currentHeight = 0;
        currentCapacity = followingPageCapacity;
      }
    }

    currentPage.push(item);
    currentHeight += rowHeight;
  });

  if (currentPage.length > 0 || pages.length === 0) {
    pages.push(currentPage);
  }

  return pages;
}

function getDetailPageCapacity(pageElement, pageType) {
  const targetPage = pageElement ?? createDetailMeasurePage(pageType);
  const table = targetPage.querySelector('.details-table');
  const tbody = targetPage.querySelector('tbody');
  const pageNumber = targetPage.querySelector('.page-number');

  if (!table || !tbody || !pageNumber) {
    if (!pageElement && targetPage.parentNode) {
      targetPage.parentNode.removeChild(targetPage);
    }
    return pageType === 'page-1' ? 300 : 650;
  }

  const tbodyRect = tbody.getBoundingClientRect();
  const pageNumberRect = pageNumber.getBoundingClientRect();
  const tableStyle = window.getComputedStyle(table);
  // 安全のため、計算されたキャパシティからさらに 20px 程度のマージンを差し引く（既存の8pxから28pxに変更）
  const capacity = Math.max(0, pageNumberRect.top - tbodyRect.top - parseFloat(tableStyle.marginTop || '0') - 28);

  if (!pageElement && targetPage.parentNode) {
    targetPage.parentNode.removeChild(targetPage);
  }

  return capacity || (pageType === 'page-1' ? 300 : 650);
}

function measureDetailRowHeight(item, pageType) {
  const measurePage = createDetailMeasurePage(pageType);
  const tbody = measurePage.querySelector('tbody');
  if (!tbody) {
    if (measurePage.parentNode) {
      measurePage.parentNode.removeChild(measurePage);
    }
    return pageType === 'page-1' ? 24 : 21;
  }

  const quantity = item?.quantity != null ? item.quantity.toLocaleString('ja-JP') : '';
  const unitPrice = item?.unitPrice != null
    ? (item.unitPrice < 0 ? `-${Math.abs(item.unitPrice).toLocaleString()}` : item.unitPrice.toLocaleString())
    : '';
  const amount = item?.amount != null
    ? (item.amount < 0 ? `-${Math.abs(item.amount).toLocaleString()}` : item.amount.toLocaleString())
    : '';

  tbody.innerHTML = `
    <tr class="${item?.isSubtotal ? 'subtotal-row' : ''}">
      <td class="col-no">${item?.isSubtotal ? '' : '1'}</td>
      <td>${item?.itemName ?? '-'}</td>
      <td>${item?.description ?? ''}</td>
      <td class="col-qty">${quantity}</td>
      <td class="col-price">${unitPrice}</td>
      <td class="col-amount">${amount}</td>
    </tr>
  `;

  const row = tbody.querySelector('tr');
  const rowHeight = row?.getBoundingClientRect().height ?? (pageType === 'page-1' ? 24 : 21);

  if (measurePage.parentNode) {
    measurePage.parentNode.removeChild(measurePage);
  }

  return rowHeight;
}

function createDetailMeasurePage(pageType) {
  const page = document.createElement('div');
  page.className = `invoice-sheet ${pageType}`;
  page.style.position = 'absolute';
  page.style.visibility = 'hidden';
  page.style.left = '-9999px';
  page.style.top = '0';
  page.style.zIndex = '-1';
  page.innerHTML = `
    <div style="font-size: 10pt; font-weight: bold; margin-bottom: 2px;">ご請求明細</div>
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
    <div class="page-number">1/1</div>
  `;
  document.body.appendChild(page);
  return page;
}

function renderPageRows(tbody, items, pageNum) {
  const pageType = pageNum === 1 ? 'page-1' : 'page-2';
  const startNo = countPreviousVisibleRows(pageNum);
  const pageElement = tbody?.closest('.invoice-sheet') ?? null;
  const pageCapacity = getDetailPageCapacity(pageElement, pageType);
  const subtotalSpacerCount = items.filter(item => item?.isSubtotal).length;
  const blankRowHeight = measureDetailRowHeight({ isSpacer: true }, pageType);
  const usedHeight = items.reduce((total, item) => total + measureDetailRowHeight(item, pageType), 0)
    + (subtotalSpacerCount * blankRowHeight);
  const remainingPageHeight = Math.max(0, pageCapacity - usedHeight);
  const spacerRows = blankRowHeight > 0 ? Math.floor(remainingPageHeight / blankRowHeight) : 0;

  let html = '';
  let visibleIndex = 0;

  items.forEach(item => {
    const isSubtotal = item.isSubtotal;
    const isSpacer = item.isSpacer;
    const no = (isSubtotal || isSpacer) ? '' : (startNo + visibleIndex);
    const quantity = item.quantity != null ? item.quantity.toLocaleString('ja-JP') : '';
    const unitPrice = item.unitPrice != null ? (item.unitPrice < 0 ? `-${Math.abs(item.unitPrice).toLocaleString()}` : item.unitPrice.toLocaleString()) : '';
    const amount = item.amount != null ? (item.amount < 0 ? `-${Math.abs(item.amount).toLocaleString()}` : item.amount.toLocaleString()) : '';

    html += `
      <tr class="${isSubtotal ? 'subtotal-row' : (isSpacer ? 'spacer-row' : '')}">
        <td class="col-no">${no}</td>
        <td class="col-item1">${item.itemName ?? '-'}</td>
        <td class="col-item2">${item.description ?? ''}</td>
        <td class="col-qty">${quantity}</td>
        <td class="col-price">${unitPrice}</td>
        <td class="col-amount${isSubtotal ? ' subtotal-amount' : ''}">${amount}</td>
      </tr>
    `;

    if (!isSubtotal && !isSpacer) {
      visibleIndex += 1;
    }

    if (isSubtotal) {
      html += buildDetailSpacerRowHtml();
    }
  });

  for (let index = 0; index < spacerRows; index += 1) {
    html += buildDetailSpacerRowHtml();
  }

  tbody.innerHTML = html;
}

function buildDetailSpacerRowHtml() {
  return `
    <tr class="spacer-row" aria-hidden="true">
      <td class="col-no"></td>
      <td></td>
      <td></td>
      <td class="col-qty"></td>
      <td class="col-price"></td>
      <td class="col-amount"></td>
    </tr>
  `;
}

function countPreviousVisibleRows(pageNum) {
  if (pageNum === 1) return 1;

  const container = document.getElementById('invoice-sheet-container');
  const existingBodies = container ? Array.from(container.querySelectorAll('tbody')) : [];
  let count = 1;

  existingBodies.forEach(body => {
    body.querySelectorAll('tr').forEach(row => {
      if (row.classList.contains('subtotal-row') || row.classList.contains('spacer-row')) return;
      count += 1;
    });
  });

  return count;
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
  const items = invoice?.items ?? [];
  const hasPremium = items.some(item => detectChargeLabel(item) === 'プレミアム利用料');
  return hasPremium ? 'プレミアム契約あり' : 'プレミアム契約なし';
}

function describeAddOns(invoice) {
  const labels = summarizeChargeItems(invoice);
  return labels.length > 0 ? labels.join(' / ') : '明細参照';
}

function summarizeChargeItems(invoice) {
  const items = sortInvoiceItemsForDisplay(Array.isArray(invoice?.items) ? invoice.items : []);
  const labels = [];
  const pushIfMissing = label => {
    if (!labels.includes(label)) labels.push(label);
  };

  items.forEach(item => {
    const label = detectChargeLabel(item);
    if (label) pushIfMissing(label);
  });

  return labels;
}

function detectChargeLabel(item) {
  const knownLabels = [
    'プレミアム利用料',
    '追加アカウント料金',
    '名刺データ化費用',
    'お礼メール送信費用',
    'クーポン値引き'
  ];

  if (knownLabels.includes(item?.itemName)) {
    return item.itemName;
  }

  const description = typeof item?.description === 'string' ? item.description : '';
  return knownLabels.find(label => description.includes(label)) ?? '';
}

function buildDetailDisplayItems(items) {
  const chunks = splitInvoiceItemChunks(items);
  const rows = [];
  const aggregateContractItems = chunks.some(chunk => chunk.subtotal);

  if (aggregateContractItems) {
    const contractItems = chunks.flatMap(chunk => partitionDetailItems(chunk.items).contractItems);
    rows.push(...buildContractRows(contractItems, 'contract-group'));
  }

  chunks.forEach(chunk => {
    rows.push(...buildDetailRowsForChunk(chunk.items, { includeContractItems: !aggregateContractItems }));
    if (chunk.subtotal) {
      rows.push(chunk.subtotal);
    }
  });

  return rows;
}

function splitInvoiceItemChunks(items) {
  const chunks = [];
  let currentItems = [];

  (Array.isArray(items) ? items : []).forEach(item => {
    if (item?.isSubtotal) {
      chunks.push({ items: currentItems, subtotal: item });
      currentItems = [];
      return;
    }

    currentItems.push(item);
  });

  if (currentItems.length > 0 || chunks.length === 0) {
    chunks.push({ items: currentItems, subtotal: null });
  }

  return chunks;
}

function buildDetailRowsForChunk(items, options = {}) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const rows = [];
  const { includeContractItems = true } = options;
  const { contractItems, surveyGroupMap, otherItems } = partitionDetailItems(items);

  if (includeContractItems) {
    rows.push(...buildContractRows(contractItems, 'contract-group'));
  }

  surveyGroupMap.forEach((surveyItems, surveyName) => {
    const sortedSurveyItems = sortInvoiceItemsForDisplay(surveyItems);
    const groupKey = `survey:${surveyName}`;
    rows.push(...sortedSurveyItems.map(item => ({ ...item, groupKey })));
    rows.push(buildSubtotalItem(surveyName, sumItemAmounts(sortedSurveyItems), groupKey));
  });

  if (otherItems.length > 0) {
    rows.push(...otherItems);
  }

  return rows;
}

function partitionDetailItems(items) {
  const contractItems = [];
  const surveyGroupMap = new Map();
  const otherItems = [];

  (Array.isArray(items) ? items : []).forEach(item => {
    const chargeLabel = detectChargeLabel(item);
    if (chargeLabel === 'プレミアム利用料' || chargeLabel === '追加アカウント料金') {
      contractItems.push(item);
      return;
    }

    if (
      chargeLabel === '名刺データ化費用' ||
      chargeLabel === 'お礼メール送信費用' ||
      chargeLabel === 'クーポン値引き'
    ) {
      const surveyName = item?.itemName ?? 'アンケート';
      if (!surveyGroupMap.has(surveyName)) {
        surveyGroupMap.set(surveyName, []);
      }
      surveyGroupMap.get(surveyName).push(item);
      return;
    }

    otherItems.push(item);
  });

  return { contractItems, surveyGroupMap, otherItems };
}

function buildContractRows(items, groupKey) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const sortedContractItems = sortInvoiceItemsForDisplay(items);
  return [
    ...sortedContractItems.map(item => ({ ...item, groupKey })),
    buildSubtotalItem(buildContractSubtotalLabel(sortedContractItems), sumItemAmounts(sortedContractItems), groupKey)
  ];
}

function buildSubtotalItem(itemName, amount, groupKey = '') {
  return {
    isSubtotal: true,
    groupKey,
    itemName,
    description: '小計',
    quantity: null,
    unitPrice: null,
    amount
  };
}

function buildContractSubtotalLabel(items) {
  const labels = [];
  if (items.some(item => detectChargeLabel(item) === 'プレミアム利用料')) {
    labels.push('プレミアムプラン');
  }
  if (items.some(item => detectChargeLabel(item) === '追加アカウント料金')) {
    labels.push('グループアカウント料金');
  }
  return labels.length > 0 ? labels.join('・') : '契約関連';
}

function sumItemAmounts(items) {
  return (Array.isArray(items) ? items : []).reduce((total, item) => total + (typeof item?.amount === 'number' ? item.amount : 0), 0);
}

function sortInvoiceItemsForDisplay(items) {
  if (!Array.isArray(items)) return [];

  const chargeOrder = {
    'プレミアム利用料': 0,
    '追加アカウント料金': 1,
    '名刺データ化費用': 2,
    'お礼メール送信費用': 3,
    'クーポン値引き': 4
  };

  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftLabel = detectChargeLabel(left.item);
      const rightLabel = detectChargeLabel(right.item);
      const leftRank = chargeOrder[leftLabel] ?? 99;
      const rightRank = chargeOrder[rightLabel] ?? 99;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.index - right.index;
    })
    .map(entry => entry.item);
}

function buildInvoiceSubject(invoice) {
  const monthText = formatDateMonth(invoice.billingPeriod?.from);
  return `SPEED AD利用料 ${monthText}分`;
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
