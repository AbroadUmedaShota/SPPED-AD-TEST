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
  return invoices.find(invoice => invoice.invoiceId === id) ?? null;
}
