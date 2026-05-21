import { fetchInvoices } from './services/invoiceService.js';
import { fetchAllUsers } from './services/userService.js';
import { fetchAllGroups } from './services/groupService.js';
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
    const preparedInvoices = await prepareInvoicesForList(safeInvoices);

    // Store globally for filtering
    allInvoices = preparedInvoices;
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

async function prepareInvoicesForList(invoices) {
  const [users, groups] = await Promise.all([fetchAllUsers(), fetchAllGroups()]);
  const userByAccountId = new Map(
    (Array.isArray(users) ? users : [])
      .map(user => [user?.accountId, user])
      .filter(([accountId]) => Boolean(accountId))
  );
  const groupByAccountId = new Map(
    (Array.isArray(groups) ? groups : [])
      .map(group => [group?.accountId, group])
      .filter(([accountId]) => Boolean(accountId))
  );

  return (Array.isArray(invoices) ? invoices : [])
    .filter(invoice => {
      const issueDate = new Date(invoice?.issueDate);
      return !Number.isNaN(issueDate.getTime());
    })
    .map(invoice => enrichInvoiceForList(invoice, userByAccountId, groupByAccountId))
    .sort((left, right) => {
      const leftDate = new Date(left.issueDate).getTime();
      const rightDate = new Date(right.issueDate).getTime();
      if (leftDate !== rightDate) {
        return rightDate - leftDate;
      }
      return String(right.invoiceId).localeCompare(String(left.invoiceId));
    });
}

function enrichInvoiceForList(invoice, userByAccountId, groupByAccountId) {
  const groupAccount = groupByAccountId.get(invoice?.accountId) ?? null;
  const userAccount = userByAccountId.get(invoice?.accountId) ?? null;
  const isGroupAccount = groupAccount?.billing?.type === 'group';

  return {
    ...invoice,
    contractType: isGroupAccount ? 'GROUP' : 'PERSONAL',
    displayId: formatInvoiceDisplayId(invoice),
    accountName: groupAccount?.name ?? '個人アカウント',
    corporateName: resolveBillingRecipient(groupAccount, userAccount, invoice)
  };
}

function formatInvoiceDisplayId(invoice) {
  const issueDate = new Date(invoice?.issueDate);
  const yy = Number.isNaN(issueDate.getTime()) ? '--' : issueDate.getFullYear().toString().slice(-2);
  const accountId = typeof invoice?.accountId === 'string' ? invoice.accountId : '';
  const uid = accountId.replace(/\D/g, '').padStart(5, '0') || '00000';
  const invoiceId = typeof invoice?.invoiceId === 'string' ? invoice.invoiceId : '';
  const idParts = invoiceId.split('-');
  const lastPart = idParts[idParts.length - 1];
  const seq = !Number.isNaN(Number(lastPart)) ? lastPart : '001';
  return `${yy}-${uid}-${seq}`;
}

function resolveBillingRecipient(groupAccount, userAccount, invoice) {
  if (groupAccount?.billing?.type === 'group' && groupAccount.billing.corporateName) {
    return groupAccount.billing.corporateName;
  }

  if (userAccount) {
    if (userAccount.billingAddressType === 'different' && userAccount.billingCompanyName) {
      return userAccount.billingCompanyName;
    }
    if (userAccount.companyName) {
      return userAccount.companyName;
    }
  }

  if (groupAccount?.name) {
    return groupAccount.name;
  }

  return invoice?.accountId ?? '-';
}
