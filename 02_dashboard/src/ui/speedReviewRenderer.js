/**
 * @file speedReviewRenderer.js
 * SPEEDレビュー画面のUI描画と更新を扱うモジュール
 */

/**
 * 回答データをテーブルに描画します。
 * @param {Array} data - 描画する回答データの配列。
 * @param {function} onDetailClick - 詳細ボタンクリック時のコールバック関数。
 */
export function populateTable(data, onDetailClick, selectedIndustryQuestion) {
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
        const fullName = lastName; // 姓のみを表示
        const companyName = item.businessCard?.group3?.companyName || '';

        const getAnswer = (questionText) => {
            const detail = item.details.find(d => d.question === questionText);
            if (!detail) return '不明'; // 回答が見つからない場合は「不明」を返す
            const answer = Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer;
            return answer === '' ? '不明' : answer; // 回答が空文字列の場合も「不明」を返す
        };

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">
                <button data-answer-id="${item.answerId}" class="detail-btn text-primary hover:text-primary-dark text-sm font-semibold">詳細</button>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${item.answerId}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${item.answeredAt}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${lastName} ${firstName}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${companyName}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${(() => {
                const answer = getAnswer(selectedIndustryQuestion);
                return answer.length > 25 ? answer.substring(0, 25) + '...' : answer;
            })()}</td>
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
