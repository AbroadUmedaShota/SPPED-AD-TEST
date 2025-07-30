/**
 * @file speedReviewService.js
 * SPEEDレビュー画面に関するデータ操作を扱うモジュール
 */

/**
 * 回答データと名刺データを取得し、結合したレビューデータを返します。
 * @returns {Promise<Array>} 結合済みの回答データ配列。
 */
export async function getCombinedReviewData() {
    try {
        const [answersRes, cardsRes] = await Promise.all([
            fetch('data/survey-answers.json'),
            fetch('data/business-cards.json')
        ]);

        if (!answersRes.ok || !cardsRes.ok) {
            throw new Error('Data fetching failed');
        }

        const answers = await answersRes.json();
        const businessCards = await cardsRes.json();
        const businessCardsMap = new Map(businessCards.map(card => [card.answerId, card]));

        return answers.map(answer => ({
            ...answer,
            businessCard: businessCardsMap.get(answer.answerId) || null
        }));

    } catch (error) {
        console.error('レビューデータの処理中にエラーが発生しました:', error);
        throw error; // 呼び出し元でエラーを処理できるように再スロー
    }
}
