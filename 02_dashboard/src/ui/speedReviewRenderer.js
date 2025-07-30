/**
 * @file speedReviewRenderer.js
 * SPEEDレビュー画面のUI描画と更新を扱うモジュール
 */

/**
 * 回答データをテーブルに描画します。
 * @param {Array} data - 描画する回答データの配列。
 * @param {function} onDetailClick - 詳細ボタンクリック時のコールバック関数。
 */
export function populateTable(data, onDetailClick) {
    const tableBody = document.getElementById('reviewTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // テーブルをクリア

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-8 text-on-surface-variant">該当する回答データがありません。</td></tr>`;
        return;
    }

    data.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-surface-bright transition-colors';

        const lastName = item.businessCard?.group2?.lastName || '';
        const firstName = item.businessCard?.group2?.firstName || '';
        const companyName = item.businessCard?.group3?.companyName || '';

        const getAnswer = (questionText) => {
            const detail = item.details.find(d => d.question === questionText);
            if (!detail) return '';
            return Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer;
        };

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">
                <button data-answer-id="${item.answerId}" class="detail-btn text-primary hover:text-primary-dark text-sm font-semibold">詳細</button>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${item.answerId}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${item.answeredAt}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${lastName} ${firstName}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${companyName}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${getAnswer('Q.02_お客様の主な業界')}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${getAnswer('Q.06_【打合せ内容】緊急度（複数選択可）')}</td>
        `;
        tableBody.appendChild(row);
    });

    // 詳細ボタンにイベントリスナーを再設定
    tableBody.querySelectorAll('.detail-btn').forEach(button => {
        button.addEventListener('click', () => onDetailClick(button.dataset.answerId));
    });
}

/**
 * モーダル内に詳細情報を描画します。
 * @param {object} item - 詳細表示するデータ項目。
 */
export function populateModal(item) {
    const cardDetailsContainer = document.getElementById('modal-business-card-details');
    const answerDetailsContainer = document.getElementById('modal-survey-answer-details');

    if (!cardDetailsContainer || !answerDetailsContainer) return;

    // 名刺情報
    cardDetailsContainer.innerHTML = '';
    if (item.businessCard) {
        const card = item.businessCard;
        const fields = {
            '会社名': card.group3?.companyName,
            '氏名': `${card.group2?.lastName || ''} ${card.group2?.firstName || ''}`,
            '部署・役職': `${card.group3?.department || ''} ${card.group3?.position || ''}`,
            'メールアドレス': card.group1?.email,
            '電話番号': card.group5?.mobile || card.group5?.tel1,
            '住所': `${card.group4?.address1 || ''} ${card.group4?.address2 || ''}`
        };

        for (const [label, value] of Object.entries(fields)) {
            cardDetailsContainer.innerHTML += `
                <div>
                    <p class="text-sm text-on-surface-variant">${label}</p>
                    <p class="text-lg font-semibold text-on-surface">${value || '-'}</p>
                </div>`;
        }
    }

    // アンケート回答
    answerDetailsContainer.innerHTML = '';
    item.details.forEach(detail => {
        const answer = Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer;
        answerDetailsContainer.innerHTML += `
            <div>
                <p class="font-semibold text-on-surface">${detail.question}</p>
                <p class="mt-1 p-3 bg-surface-bright rounded-md text-on-surface">${answer || '（無回答）'}</p>
            </div>`;
    });
}
