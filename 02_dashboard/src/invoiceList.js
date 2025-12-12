import { fetchInvoices } from './services/invoiceService.js';
import { renderInvoices, showLoading, hideLoading, showMessage } from './ui/invoiceRenderer.js';

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
    const aggregatedInvoices = aggregateInvoices(safeInvoices);

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

function aggregateInvoices(invoices) {
  const groups = {};

  invoices.forEach(inv => {
    if (!inv.issueDate) return;
    const date = new Date(inv.issueDate);
    if (isNaN(date.getTime())) return;

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const monthKey = `${yyyy}${mm}`;

    // Determine if Group or Personal based on Plan
    // Standard = Personal, Premium/Others = Group
    const isGroup = inv.plan?.code !== 'STANDARD';
    const typeKey = isGroup ? 'GROUP' : 'PERSONAL';

    const key = `AGG-${monthKey}-${typeKey}`;

    if (!groups[key]) {
      groups[key] = {
        invoiceId: key,
        issueDate: inv.issueDate, // Use the date of the first encountered invoice
        billingPeriod: inv.billingPeriod,
        totalAmount: 0,
        status: 'paid', // Default to paid, downgrade if any unpaid found
        plan: {
          code: isGroup ? 'GROUP' : 'PERSONAL',
          displayName: isGroup ? 'Group' : 'Personal'
        },
        originalInvoices: []
      };
    }

    const group = groups[key];
    group.totalAmount += (inv.totalAmount || 0);
    group.originalInvoices.push(inv);

    if (group.originalInvoices.length > 0) {
      group.displayId = group.originalInvoices[0].invoiceId;
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
