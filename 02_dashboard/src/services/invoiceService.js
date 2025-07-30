/**
 * 請求書データを取得します。
 * @returns {Promise<Array>} 請求書データの配列を返すPromise。
 * @throws {Error} データの取得に失敗した場合。
 */
export async function fetchInvoices() {
    try {
        const response = await fetch('data/invoices.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('請求書データの読み込みに失敗しました:', error);
        throw error; // エラーを呼び出し元に再スローする
    }
}

/**
 * 指定されたIDの請求書データを取得します。
 * @param {string} id - 請求書ID。
 * @returns {Promise<object|null>} 請求書データ、見つからない場合はnull。
 */
export async function fetchInvoiceById(id) {
    try {
        const invoices = await fetchInvoices();
        const invoice = invoices.find(inv => inv.invoiceId === id);
        return invoice || null;
    } catch (error) {
        console.error(`請求書ID ${id} のデータ取得に失敗しました:`, error);
        throw error;
    }
}