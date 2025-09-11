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
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-on-surface-variant">該当する回答データがありません。</td></tr>`;
        return;
    }

    data.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-surface-bright transition-colors cursor-pointer'; // Add cursor-pointer for UX
        row.dataset.answerId = item.answerId; // Add data-answer-id to the row

        const formatCell = (value) => (value === null || value === undefined || value === '') ? '-' : value;

        const lastName = item.businessCard?.group2?.lastName || '';
        const firstName = item.businessCard?.group2?.firstName || '';
        const fullName = `${lastName} ${firstName}`.trim();
        const companyName = item.businessCard?.group3?.companyName || '';

        const getAnswer = (questionText) => {
            const detail = item.details.find(d => d.question === questionText);
            if (!detail) return '-'; // 回答が見つからない場合は「-」を返す
            const answer = Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer;
            return answer === '' ? '-' : answer; // 回答が空文字列の場合も「-」を返す
        };

                row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${formatCell(item.answerId)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${formatCell(item.answeredAt)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${formatCell(fullName)}</td>
            <td class="px-4 py-3 text-sm text-on-surface truncate max-w-[200px]" title="${formatCell(companyName)}">${formatCell(companyName)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${(() => {
                const answer = getAnswer(selectedIndustryQuestion);
                return answer.length > 22 ? answer.substring(0, 22) + '...' : answer;
            })()}</td>
        `;
        tableBody.appendChild(row);
    });

    // 各行にイベントリスナーを設定
    tableBody.querySelectorAll('tr').forEach(row => {
        row.addEventListener('click', () => onDetailClick(row.dataset.answerId));
    });
}

/**
 * モーダル内に詳細情報を描画します。
 * @param {object} item - 詳細表示するデータ項目。
 */
export function populateModal(item) {
    renderModalContent(item, false);
}

/**
 * モーダルのコンテンツを描画します（表示モード/編集モード切り替え対応）。
 * @param {object} item - 表示するデータ項目。
 * @param {boolean} isEditMode - 編集モードの場合はtrue。
 */
export function renderModalContent(item, isEditMode = false) {
    const cardDetailsContainer = document.getElementById('modal-business-card-details');
    const answerDetailsContainer = document.getElementById('modal-survey-answer-details');

    if (!cardDetailsContainer || !answerDetailsContainer) return;

    // --- Business Card Details ---
    let cardHtml = '';
    if (item.businessCard) {
        const card = item.businessCard;
        if (isEditMode) {
            // EDIT MODE: Render input fields
            cardHtml = `
                <div class="py-2 space-y-1">
                    <p class="text-sm text-on-surface-variant">会社名</p>
                    <input type="text" id="edit-companyName" class="input-field w-full" value="${card.group3?.companyName || ''}">
                </div>
                <div class="py-2 space-y-1">
                    <p class="text-sm text-on-surface-variant">氏名</p>
                    <div class="flex gap-2">
                        <input type="text" id="edit-lastName" class="input-field w-full" value="${card.group2?.lastName || ''}" placeholder="姓">
                        <input type="text" id="edit-firstName" class="input-field w-full" value="${card.group2?.firstName || ''}" placeholder="名">
                    </div>
                </div>
                <div class="py-2 space-y-1"><p class="text-sm text-on-surface-variant">部署</p><input type="text" id="edit-department" class="input-field w-full" value="${card.group3?.department || ''}"></div>
                <div class="py-2 space-y-1"><p class="text-sm text-on-surface-variant">役職</p><input type="text" id="edit-position" class="input-field w-full" value="${card.group3?.position || ''}"></div>
                <div class="py-2 space-y-1"><p class="text-sm text-on-surface-variant">メールアドレス</p><input type="email" id="edit-email" class="input-field w-full" value="${card.group1?.email || ''}"></div>
                <div class="py-2 space-y-1">
                    <p class="text-sm text-on-surface-variant">住所</p>
                    <input type="text" id="edit-address1" class="input-field w-full" value="${card.group4?.address1 || ''}" placeholder="住所1">
                    <input type="text" id="edit-address2" class="input-field w-full mt-1" value="${card.group4?.address2 || ''}" placeholder="住所2（建物名）">
                </div>
                <div class="py-2 space-y-1">
                    <p class="text-sm text-on-surface-variant">電話番号</p>
                    <div class="grid grid-cols-2 gap-2">
                        <div><label for="edit-mobile" class="text-xs">携帯</label><input type="tel" id="edit-mobile" class="input-field w-full" value="${card.group5?.mobile || ''}"></div>
                        <div><label for="edit-tel1" class="text-xs">TEL1</label><input type="tel" id="edit-tel1" class="input-field w-full" value="${card.group5?.tel1 || ''}"></div>
                        <div><label for="edit-tel2" class="text-xs">TEL2</label><input type="tel" id="edit-tel2" class="input-field w-full" value="${card.group5?.tel2 || ''}"></div>
                        <div><label for="edit-fax" class="text-xs">FAX</label><input type="tel" id="edit-fax" class="input-field w-full" value="${card.group5?.fax || ''}"></div>
                    </div>
                </div>
                <div class="py-2 space-y-1"><p class="text-sm text-on-surface-variant">URL</p><input type="url" id="edit-url" class="input-field w-full" value="${card.group6?.url || ''}"></div>
            `;
        } else {
            // VIEW MODE: Render text content
            const fields = {
                '会社名': { value: card.group3?.companyName, key: 'companyName' },
                '氏名': { value: `${card.group2?.lastName || ''} ${card.group2?.firstName || ''}`.trim(), key: 'fullName' },
                '部署': { value: card.group3?.department, key: 'department' },
                '役職': { value: card.group3?.position, key: 'position' },
                'メールアドレス': { value: card.group1?.email, key: 'email' },
                '住所': { value: `${card.group4?.address1 || ''} ${card.group4?.address2 || ''}`.trim(), key: 'address' },
            };

            for (const [label, field] of Object.entries(fields)) {
                if (field.value && field.value.trim() !== '') {
                    cardHtml += `
                        <div class="py-2">
                            <p class="text-sm text-on-surface-variant">${label}</p>
                            <div data-field="${field.key}" class="text-lg font-semibold text-on-surface">${field.value}</div>
                        </div>`;
                }
            }

            const phoneNumbers = [
                { label: '携帯', number: card.group5?.mobile, key: 'mobile' },
                { label: 'TEL1', number: card.group5?.tel1, key: 'tel1' },
                { label: 'TEL2', number: card.group5?.tel2, key: 'tel2' },
                { label: 'FAX', number: card.group5?.fax, key: 'fax' },
            ].filter(p => p.number);

            if (phoneNumbers.length > 0) {
                let phoneHtml = '<div class="py-2"><p class="text-sm text-on-surface-variant">電話番号</p><div class="text-lg font-semibold text-on-surface">';
                phoneNumbers.forEach(p => {
                    phoneHtml += `<div data-field="${p.key}"><span class="text-sm">${p.label}:</span> ${p.number}</div>`;
                });
                phoneHtml += '</div></div>';
                cardHtml += phoneHtml;
            }
            
            const url = card.group6?.url;
            if (url && url.trim() !== '') {
                cardHtml += `
                    <div class="py-2">
                        <p class="text-sm text-on-surface-variant">URL</p>
                        <div data-field="url"><a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${url}</a></div>
                    </div>`;
            }
        }
    }
    cardDetailsContainer.innerHTML = cardHtml;

    // --- Survey Answer Details (always in view mode) ---
    let answerHtml = '';
    item.details.forEach(detail => {
        const answer = Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer;
        answerHtml += `
            <div>
                <p class="font-semibold text-on-surface">${detail.question}</p>
                <p class="mt-1 p-3 bg-surface-bright rounded-md text-on-surface">${answer || '（無回答）'}</p>
            </div>`;
    });
    answerDetailsContainer.innerHTML = answerHtml;
}
