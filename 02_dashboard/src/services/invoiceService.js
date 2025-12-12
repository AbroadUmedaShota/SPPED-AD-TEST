import { resolveDashboardDataPath } from '../utils.js';

/**
 * 請求書一覧を取得する。
 * @returns {Promise<Array<object>>} 取得した請求書配列。
 */
export async function fetchInvoices() {
  const response = await fetch(resolveDashboardDataPath('core/invoices.json'));
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * 指定した ID の請求書を取得する。
 * @param {string} id - 請求書ID。
 * @returns {Promise<object | null>} 見つかった場合は請求書オブジェクト。存在しなければ null。
 */
export async function fetchInvoiceById(id) {
  const invoices = await fetchInvoices();

  // Check for Aggregated ID
  if (id.startsWith('AGG-')) {
    const parts = id.split('-');
    // AGG-YYYYMM-TYPE (TYPE might be GROUP or PERSONAL)
    // Actually parts length might be 3: ['AGG', '202509', 'GROUP']
    if (parts.length === 3) {
      const targetMonth = parts[1]; // YYYYMM
      const targetType = parts[2]; // GROUP or PERSONAL

      const filtered = invoices.filter(inv => {
        if (!inv.issueDate) return false;
        const d = new Date(inv.issueDate);
        if (isNaN(d.getTime())) return false;
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const mKey = `${yyyy}${mm}`;

        const isGroup = inv.plan?.code !== 'STANDARD';
        const tKey = isGroup ? 'GROUP' : 'PERSONAL';

        return mKey === targetMonth && tKey === targetType;
      });

      if (filtered.length === 0) return null;

      // Merge logic
      const base = filtered[0];
      const merged = {
        ...base,
        invoiceId: filtered[0].invoiceId,
        items: [],
        totalAmount: 0,
        subtotalTaxable: 0,
        subtotalNonTaxable: 0,
        tax: 0,
        plan: {
          code: targetType === 'GROUP' ? 'GROUP' : 'PERSONAL',
          displayName: targetType === 'GROUP' ? 'Group' : 'Personal'
        }
      };

      filtered.forEach((inv, index) => {
        // Recalculate totals for this individual invoice first
        const totals = calculateInvoiceTotals(inv.items);
        Object.assign(inv, totals);

        merged.items = merged.items.concat(inv.items || []);

        // Add Subtotal row
        merged.items.push({
          isSubtotal: true,
          itemName: '',
          description: '小計',
          quantity: null,
          unitPrice: null,
          amount: inv.totalAmount
        });

        merged.totalAmount += (inv.totalAmount || 0);
        merged.subtotalTaxable += (inv.subtotalTaxable || 0);
        merged.subtotalNonTaxable += (inv.subtotalNonTaxable || 0);
        merged.tax += (inv.tax || 0);
      });

      // Re-calculate status if mixed? keeping simple: use base status or override if needed.
      // invoiceList logic prioritized overdue. Let's replicate simple check.
      const statuses = filtered.map(i => i.status);
      if (statuses.includes('overdue')) merged.status = 'overdue';
      else if (statuses.includes('unpaid')) merged.status = 'unpaid';
      else if (statuses.every(s => s === 'canceled')) merged.status = 'canceled';
      else merged.status = 'paid';

      return merged;
    }
  }

  const invoice = invoices.find(invoice => invoice.invoiceId === id);
  if (invoice) {
    const totals = calculateInvoiceTotals(invoice.items);
    Object.assign(invoice, totals);
    return invoice;
  }
  return null;
}

function calculateInvoiceTotals(items) {
  let subtotalTaxable = 0;
  let subtotalNonTaxable = 0;

  (items || []).forEach(item => {
    if (item.isSpacer || item.isSubtotal) return;

    // Use item.amount if available, otherwise calculate
    const amount = item.amount ?? ((item.unitPrice || 0) * (item.quantity || 0));

    if (item.taxable) {
      subtotalTaxable += amount;
    } else {
      subtotalNonTaxable += amount;
    }
  });

  const tax = Math.floor(subtotalTaxable * 0.1);
  const totalAmount = subtotalTaxable + subtotalNonTaxable + tax;

  return { subtotalTaxable, subtotalNonTaxable, tax, totalAmount };
}
