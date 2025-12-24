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
        row.className = 'transition-colors cursor-pointer'; // Add cursor-pointer for UX
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

    // --- Business Card Details (always in view mode) ---
    let cardHtml = '';

    // --- Business Card Images Section ---
    const frontImageUrl = item.businessCard?.imageUrl?.front || '../media/表面.png';
    const backImageUrl = item.businessCard?.imageUrl?.back || '../media/裏面.png';

    cardHtml += `
        <div class="flex gap-4 mb-6 select-none">
            <div class="w-1/2 cursor-zoom-in" data-zoom-src="${frontImageUrl}">
                <p class="text-xs text-on-surface-variant mb-1">名刺（表面）</p>
                <div class="aspect-[1.6/1] w-full border border-outline-variant rounded-md overflow-hidden bg-surface-variant flex items-center justify-center relative group">
                    <img src="${frontImageUrl}" class="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105" alt="名刺（表面）" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="hidden absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm">画像なし</div>
                </div>
            </div>
            <div class="w-1/2 cursor-zoom-in" data-zoom-src="${backImageUrl}">
                <p class="text-xs text-on-surface-variant mb-1">名刺（裏面）</p>
                <div class="aspect-[1.6/1] w-full border border-outline-variant rounded-md overflow-hidden bg-surface-variant flex items-center justify-center relative group">
                    <img src="${backImageUrl}" class="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105" alt="名刺（裏面）" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="hidden absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm">画像なし</div>
                </div>
            </div>
        </div>
    `;

    if (item.businessCard) {
        const card = item.businessCard;
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
    cardDetailsContainer.innerHTML = cardHtml;

    // --- Survey Answer Details (editable in edit mode) ---
    let answerHtml = '';
    if (isEditMode) {
        // EDIT MODE: Render appropriate inputs based on question type
        item.details.forEach(detail => {
            const questionDef = item.survey?.details?.find(d => d.question === detail.question);
            const questionType = questionDef ? questionDef.type : 'free_text'; // Default to free_text if not found

            answerHtml += `<div class="py-2 space-y-1">
                             <p class="font-semibold text-on-surface">${detail.question}</p>`;

            switch (questionType) {
                case 'single_choice':
                    answerHtml += `<select class="w-auto max-w-full mt-1 border border-outline-variant rounded-md shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" data-question="${detail.question}">`;
                    answerHtml += `<option value="">選択してください</option>`;
                    (questionDef.options || []).forEach(option => {
                        const isSelected = detail.answer === option;
                        answerHtml += `<option value="${option}" ${isSelected ? 'selected' : ''}>${option}</option>`;
                    });
                    answerHtml += `</select>`;
                    break;

                case 'multi_choice':
                    answerHtml += `<div class="mt-1 space-y-2">`;
                    const currentAnswers = Array.isArray(detail.answer) ? detail.answer : [detail.answer];
                    (questionDef.options || []).forEach(option => {
                        const isChecked = currentAnswers.includes(option);
                        answerHtml += `<label class="flex items-center">
                                         <input type="checkbox" class="rounded border-gray-300 text-primary shadow-sm focus:border-primary focus:ring focus:ring-primary focus:ring-opacity-50" value="${option}" data-question="${detail.question}" ${isChecked ? 'checked' : ''}>
                                         <span class="ml-2 text-on-surface">${option}</span>
                                       </label>`;
                    });
                    answerHtml += `</div>`;
                    break;

                default: // free_text, number, etc.
                    const answer = Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer;
                    answerHtml += `<input type="text" class="input-field w-full mt-1" value="${answer || ''}" data-question="${detail.question}">`;
                    break;
            }
            answerHtml += `</div>`;
        });
    } else {
        // VIEW MODE: Render text content for answers
        item.details.forEach(detail => {
            const answer = Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer;
            answerHtml += `
                <div>
                    <p class="font-semibold text-on-surface">${detail.question}</p>
                    <p class="mt-1 p-3 bg-surface-bright rounded-md text-on-surface">${answer || '（無回答）'}</p>
                </div>`;
        });
    }
    answerDetailsContainer.innerHTML = answerHtml;
}

// Zoom function implementation
export function openCardZoom(imageUrl) {
    try {
        // Prevent multiple overlays
        if (document.getElementById('image-zoom-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'image-zoom-overlay';
        // Use extremely high z-index and explicit flex styles
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.zIndex = '99999';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.opacity = '0'; // Start invisible for fade-in
        overlay.style.transition = 'opacity 0.3s ease';

        // Modal content container
        overlay.innerHTML = `
            <div style="position: absolute; top: 1rem; right: 1rem; z-index: 100000;">
                <button id="zoom-close-btn" class="text-white hover:text-gray-300 bg-black/50 rounded-full p-2 transition-colors">
                    <span class="material-icons text-3xl">close</span>
                </button>
            </div>
            <img src="${imageUrl}" style="max-width: 95vw; max-height: 90vh; object-fit: contain; transform: scale(0.95); transition: transform 0.3s ease;" class="shadow-2xl">
        `;

        const close = () => {
            overlay.style.opacity = '0';
            const img = overlay.querySelector('img');
            if (img) img.style.transform = 'scale(0.95)';
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 300);
        };

        const closeBtn = overlay.querySelector('#zoom-close-btn');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                close();
            };
        }

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                close();
            }
        };

        document.body.appendChild(overlay);

        // Trigger fade-in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                const img = overlay.querySelector('img');
                if (img) img.style.transform = 'scale(1)';
            });
        });
    } catch (e) {
        console.error('Zoom error:', e);
    }
}

/**
 * Handles click events within the modal to detect business card image clicks (Event Delegation).
 * Pass this function to the modal container's click event listener.
 * @param {Event} e - The click event object.
 */
export function handleModalImageClick(e) {
    // Traverse up from the clicked element to find a zoomable container or image
    const zoomTarget = e.target.closest('[data-zoom-src]');
    
    if (zoomTarget) {
        e.preventDefault(); // Prevent default behavior
        e.stopPropagation(); // Stop propagation to prevent bubbling issues
        
        const src = zoomTarget.getAttribute('data-zoom-src');
        if (src) {
            console.log('[speedReviewRenderer] Zooming image:', src);
            openCardZoom(src);
        }
    }
}
