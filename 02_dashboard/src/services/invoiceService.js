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