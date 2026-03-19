import { fetchInvoices } from './services/invoiceService.js';
import { renderInvoices, showLoading, hideLoading, showMessage } from './ui/invoiceRenderer.js';
import { resolveDashboardDataPath } from './utils.js';

async function fetchGroupAccountIds() {
  const response = await fetch(resolveDashboardDataPath('core/groups.json'));
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const groups = await response.json();
  return new Set(
    (Array.isArray(groups) ? groups : [])
      .map(group => group?.accountId)
      .filter(Boolean)
  );
}

let allInvoices = [];
let hasLoadedInvoices = false;

function filterInvoicesByStatus(status) {
  if (status === 'all') {
    return [...allInvoices];
  }
  return allInvoices.filter(invoice => invoice?.status === status);
}

function applyFilter(status) {
  if (!hasLoadedInvoices) return;

  const targetStatus = status ?? 'all';
  const filtered = filterInvoicesByStatus(targetStatus);

  if (filtered.length === 0) {
    const message = targetStatus === 'all'
      ? '対象の請求書がありません。'
      : '該当する請求書がありません。';
    showMessage(message);
  }

  renderInvoices(filtered);
}

export async function initInvoiceListPage() {
  const filterSelect = document.getElementById('invoice-status-filter');

  if (filterSelect) {
    filterSelect.addEventListener('change', () => {
      applyFilter(filterSelect.value);
    });
  }

  showLoading();

  try {
    const invoices = await fetchInvoices();
    const safeInvoices = Array.isArray(invoices) ? invoices : [];

    // Aggregate invoices for display
    const aggregatedInvoices = await aggregateInvoices(safeInvoices);

    // Store globally for filtering
    allInvoices = aggregatedInvoices;
    hasLoadedInvoices = true;

    if (allInvoices.length === 0) {
      showMessage('対象の請求書がありません。', {
        action: {
          label: '再読み込み',
          onClick: () => window.location.reload()
        }
      });
      renderInvoices([]);
    } else {
      renderInvoices(allInvoices);
    }
  } catch (error) {
    console.error('Failed to load invoices:', error);
    showMessage('請求データの取得に失敗しました。ページを再読み込みしてください。', {
      tone: 'error',
      action: {
        label: '再読み込み',
        onClick: () => window.location.reload()
      }
    });
    renderInvoices([]);
  } finally {
    hideLoading();
  }
}

async function aggregateInvoices(invoices) {
  const groupAccountIds = await fetchGroupAccountIds();
  const groups = {};

  invoices.forEach(inv => {
    if (!inv.issueDate) return;
    const date = new Date(inv.issueDate);
    if (isNaN(date.getTime())) return;

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const monthKey = `${yyyy}${mm}`;

    const typeKey = groupAccountIds.has(inv.accountId) ? 'GROUP' : 'PERSONAL';

    const key = `AGG-${monthKey}-${typeKey}`;

    if (!groups[key]) {
      groups[key] = {
        invoiceId: key,
        issueDate: inv.issueDate, // Use the date of the first encountered invoice
        billingPeriod: inv.billingPeriod,
        totalAmount: 0,
        status: 'paid', // Default to paid, downgrade if any unpaid found
        contractType: typeKey,
        plan: {
          code: typeKey,
          displayName: typeKey === 'GROUP' ? 'Group' : 'Personal'
        },
        originalInvoices: []
      };
    }

    const group = groups[key];
    group.totalAmount += (inv.totalAmount || 0);
    group.originalInvoices.push(inv);

    if (group.originalInvoices.length > 0) {
      const base = group.originalInvoices[0];
      const d = new Date(base.issueDate);
      const yy = d.getFullYear().toString().slice(-2);
      const accNum = base.accountId ? base.accountId.replace(/\D/g, '') : '0';
      const uid = accNum.padStart(5, '0');

      const idParts = base.invoiceId.split('-');
      const seq = idParts.length > 0 && !isNaN(idParts[idParts.length - 1])
        ? idParts[idParts.length - 1]
        : '001';

      group.displayId = `${yy}-${uid}-${seq}`;
    }

    // Status logic: If any invoice in the group is 'overdue', group is overdue.
    // If any is 'unpaid', group is 'unpaid' (unless overdue takes precedence).
    // If all 'paid', group is 'paid'.
    // Priority: Overdue > Unpaid > Paid > Canceled
    if (inv.status === 'overdue') {
      group.status = 'overdue';
    } else if (inv.status === 'unpaid' && group.status !== 'overdue') {
      group.status = 'unpaid';
    } else if (inv.status === 'canceled' && group.status === 'paid') {
      // If only canceled invoices, status is canceled? 
      // If mixed with paid, maybe kept paid? Simplified:
      group.status = 'canceled';
    }
    // If current group status is paid, and we encounter unpaid/overdue, it will update.
    // If current is overdue, it stays overdue.
  });

  // Post-process status to ensure logic consistency (optional, but above loop logic is rough)
  // Refined Status Logic:
  Object.values(groups).forEach(group => {
    const statuses = group.originalInvoices.map(i => i.status);
    if (statuses.includes('overdue')) {
      group.status = 'overdue';
    } else if (statuses.includes('unpaid')) {
      group.status = 'unpaid';
    } else if (statuses.every(s => s === 'canceled')) {
      group.status = 'canceled';
    } else {
      group.status = 'paid';
    }
  });

  // Convert to array and Sort by date descending (Newest first)
  return Object.values(groups).sort((a, b) => new Date(b.issueDate) - new Date(a.issueDate));
}
