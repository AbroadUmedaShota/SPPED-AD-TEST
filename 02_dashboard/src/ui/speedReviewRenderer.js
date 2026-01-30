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
    const tableHead = document.querySelector('#reviewTable thead tr');

    if (!tableBody) return;

    // ヘッダーに展開用の列を追加（一度だけ）
    if (tableHead && !tableHead.querySelector('.expand-col-header')) {
        const th = document.createElement('th');
        th.className = 'px-4 py-3 text-left text-on-surface-variant text-xs font-semibold uppercase tracking-wider w-[40px] expand-col-header';
        tableHead.insertBefore(th, tableHead.firstChild);
    }

    tableBody.innerHTML = ''; // テーブルをクリア

    if (data.length === 0) {
        // colspanを調整（展開列分+1）
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center py-8 text-on-surface-variant">該当する回答データがありません。</td></tr>`;
        return;
    }

    data.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'transition-colors cursor-pointer border-b border-outline-variant hover:bg-surface-variant/10'; // Add cursor-pointer for UX
        row.dataset.answerId = item.answerId; // Add data-answer-id to the row

        const formatCell = (value) => (value === null || value === undefined || value === '') ? '-' : value;

        // ステータスを判定（processingまたはcompleted）
        const cardStatus = item.cardStatus === 'processing' || !item.businessCard ? 'processing' : 'completed';

        let fullName = '';
        let companyName = '';

        if (cardStatus === 'processing') {
            // データ化進行中: グレー文字でアニメーション付き
            fullName = '<span class="processing-text">データ化進行中</span>';
            companyName = '<span class="processing-text">データ化進行中</span>';
        } else {
            // 完了: 通常通りデータを表示
            const lastName = item.businessCard?.group2?.lastName || '';
            const firstName = item.businessCard?.group2?.firstName || '';
            fullName = `${lastName} ${firstName}`.trim() || '-';
            companyName = item.businessCard?.group3?.companyName || '-';
        }

        const getAnswer = (questionText) => {
            const detail = item.details.find(d => d.question === questionText);
            if (!detail) return '-'; // 回答が見つからない場合は「-」を返す
            const answer = Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer;
            return answer === '' ? '-' : answer; // 回答が空文字列の場合も「-」を返す
        };

        row.innerHTML = `
            <td class="px-2 py-3 whitespace-nowrap text-sm text-on-surface w-[40px]">
                <button class="toggle-inline-btn p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors" title="詳細を展開">
                    <span class="material-icons toggle-icon text-xl">keyboard_arrow_right</span>
                </button>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${formatCell(item.answerId)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${formatCell(item.answeredAt)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm overflow-hidden text-ellipsis">${fullName}</td>
            <td class="px-4 py-3 text-sm truncate max-w-[200px]" title="${cardStatus === 'completed' ? companyName : ''}">${companyName}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface overflow-hidden text-ellipsis">${(() => {
                const answer = getAnswer(selectedIndustryQuestion);
                return answer.length > 22 ? answer.substring(0, 22) + '...' : answer;
            })()}</td>
        `;
        tableBody.appendChild(row);
    });

    // 各行にイベントリスナーを設定
    tableBody.querySelectorAll('tr').forEach(row => {
        // 行全体クリックで詳細モーダル（ただしボタンクリックは除外されるように呼び出し元で制御）
        row.addEventListener('click', (e) => {
            if (!e.target.closest('button')) {
                onDetailClick(row.dataset.answerId);
            }
        });
    });
}

/**
 * インライン展開用の行（詳細情報）を生成して返します。
 * @param {object} item - 表示するデータ項目。
 * @param {number} colSpan - テーブルの列数。
 * @returns {HTMLElement} 生成されたtr要素。
 */
export function renderInlineRow(item, colSpan) {
    const row = document.createElement('tr');
    row.className = 'inline-detail-row bg-surface-variant/30 border-b border-outline-variant';

    // ステータスを判定（processingまたはcompleted）
    const cardStatus = item.cardStatus === 'processing' || !item.businessCard ? 'processing' : 'completed';

    // 名刺画像のURL（全てのステータスで共通）
    const frontImageUrl = item.businessCard?.imageUrl?.front || '../media/縦表 .png';
    const backImageUrl = item.businessCard?.imageUrl?.back || '../media/縦裏.png';

    // データ化進行中の場合
    if (cardStatus === 'processing') {
        const statusMessage = '<span class="processing-text text-2xl font-bold">データ化進行中</span>';
        const statusDescription = '名刺画像をデータ化しています。しばらくお待ちください。';

        row.innerHTML = `
            <td colspan="${colSpan}" class="p-0">
                <div class="flex flex-col md:flex-row gap-6 p-6 animate-fade-in-down">
                    <!-- 名刺画像エリア（タブ切り替え式） -->
                    <div class="flex flex-col gap-3 min-w-[320px]">
                        <!-- タブヘッダー（中央配置） -->
                        <div class="flex p-1 bg-surface-variant rounded-lg self-center mb-1">
                            <button class="card-tab-btn px-6 py-1.5 text-xs font-bold rounded-md transition-all active bg-surface text-primary shadow-sm" data-tab="front">表面</button>
                            <button class="card-tab-btn px-6 py-1.5 text-xs font-bold rounded-md transition-all text-on-surface-variant hover:text-on-surface" data-tab="back">裏面</button>
                        </div>

                        <!-- 画像表示本体 -->
                        <div class="inline-card-display-area relative">
                            <!-- 表面コンテナ -->
                            <div class="inline-card-wrapper w-full max-w-sm flex flex-col gap-2" id="inline-front-view">

                                <div class="aspect-[1.6/1] bg-surface rounded-lg border border-outline-variant overflow-hidden relative shadow-sm">
                                    <img src="${frontImageUrl}" class="w-full h-full object-contain" alt="名刺（表面）" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                                    <div class="hidden absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm bg-surface-variant/50">画像なし</div>
                                </div>
                            </div>
                            <!-- 裏面コンテナ -->
                            <div class="inline-card-wrapper w-full max-w-sm flex-col gap-2 hidden" id="inline-back-view">

                                <div class="aspect-[1.6/1] bg-surface rounded-lg border border-outline-variant overflow-hidden relative shadow-sm">
                                    <img src="${backImageUrl}" class="w-full h-full object-contain" alt="名刺（裏面）" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                                    <div class="hidden absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm bg-surface-variant/50">画像なし</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 右側：ステータスメッセージ -->
                    <div class="flex-1 flex items-center justify-center">
                        <div class="text-center space-y-4 p-8 max-w-md">
                            <div class="flex items-center justify-center mb-4">
                                <span class="material-icons text-6xl text-on-surface-variant animate-spin">
                                    sync
                                </span>
                            </div>
                            <div>${statusMessage}</div>
                            <p class="text-sm text-on-surface-variant">${statusDescription}</p>
                        </div>
                    </div>
                </div>
            </td>
        `;
        return row;
    }

    // 完了の場合: 通常通り名刺データを表示

    const card = item.businessCard || {};
    const fullName = `${card.group2?.lastName || ''} ${card.group2?.firstName || ''}`.trim();
    const company = card.group3?.companyName || '';
    const dept = card.group3?.department || '';
    const pos = card.group3?.position || '';
    const email = card.group1?.email || '';
    const tel = card.group5?.mobile || card.group5?.tel1 || '';

    row.innerHTML = `
        <td colspan="${colSpan}" class="p-0">
            <div class="flex flex-col md:flex-row gap-6 p-6 animate-fade-in-down">
                <!-- 名刺画像エリア（タブ切り替え式） -->
                <div class="flex flex-col gap-3 min-w-[320px]">
                    <!-- タブヘッダー（中央配置） -->
                    <div class="flex p-1 bg-surface-variant rounded-lg self-center mb-1">
                        <button class="card-tab-btn px-6 py-1.5 text-xs font-bold rounded-md transition-all active bg-surface text-primary shadow-sm" data-tab="front">表面</button>
                        <button class="card-tab-btn px-6 py-1.5 text-xs font-bold rounded-md transition-all text-on-surface-variant hover:text-on-surface" data-tab="back">裏面</button>
                    </div>

                    <!-- 画像表示本体 -->
                    <div class="inline-card-display-area relative">
                        <!-- 表面コンテナ -->
                        <div class="inline-card-wrapper w-full max-w-sm flex flex-col gap-2" id="inline-front-view">
                            <div class="flex justify-end items-center mb-1">
                                <div class="flex gap-1">
                                    <button class="rotate-btn p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors" data-target="inline" data-dir="-90" title="左回転">
                                        <span class="material-icons text-base">rotate_left</span>
                                    </button>
                                    <button class="rotate-btn p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors" data-target="inline" data-dir="90" title="右回転">
                                        <span class="material-icons text-base">rotate_right</span>
                                    </button>
                                </div>
                            </div>
                            <div class="aspect-[1.6/1] bg-surface rounded-lg border border-outline-variant overflow-hidden cursor-zoom-in relative group shadow-sm" data-zoom-src="${frontImageUrl}">
                                 <img src="${frontImageUrl}" class="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105 mx-auto" alt="表面" data-scale="1" data-rotation="0">
                            </div>
                        </div>

                        <!-- 裏面コンテナ (初期非表示) -->
                        <div class="inline-card-wrapper w-full max-w-sm flex flex-col gap-2 hidden" id="inline-back-view">
                            <div class="flex justify-end items-center mb-1">
                                <div class="flex gap-1">
                                    <button class="rotate-btn p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors" data-target="inline" data-dir="-90" title="左回転">
                                        <span class="material-icons text-base">rotate_left</span>
                                    </button>
                                    <button class="rotate-btn p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors" data-target="inline" data-dir="90" title="右回転">
                                        <span class="material-icons text-base">rotate_right</span>
                                    </button>
                                </div>
                            </div>
                            <div class="aspect-[1.6/1] bg-surface rounded-lg border border-outline-variant overflow-hidden cursor-zoom-in relative group shadow-sm" data-zoom-src="${backImageUrl}">
                                 <img src="${backImageUrl}" class="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105 mx-auto" alt="裏面" data-scale="1" data-rotation="0">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 簡易情報エリア（1行1項目） -->
                <div class="flex-1 text-sm text-on-surface space-y-4 border-l border-outline-variant pl-8 py-2">
                    <div>
                        <p class="text-xs text-on-surface-variant mb-1">会社名</p>
                        <p class="font-bold text-lg text-on-surface leading-tight">${company || '-'}</p>
                    </div>
                    <div class="border-t border-outline-variant pt-2">
                        <p class="text-xs text-on-surface-variant mb-1">氏名</p>
                        <p class="font-bold text-lg leading-tight">${fullName || '-'}</p>
                    </div>
                    <div class="border-t border-outline-variant pt-2">
                        <p class="text-xs text-on-surface-variant mb-1">部署・役職</p>
                        <p class="font-medium text-on-surface leading-tight">${dept || '-'} ${pos || ''}</p>
                    </div>
                    <div class="border-t border-outline-variant pt-2">
                        <p class="text-xs text-on-surface-variant mb-1">Email</p>
                        <p class="font-medium text-on-surface break-all">${email || '-'}</p>
                    </div>
                    <div class="border-t border-outline-variant pt-2">
                        <p class="text-xs text-on-surface-variant mb-1">電話番号</p>
                        <p class="font-medium text-on-surface">${tel || '-'}</p>
                    </div>
                </div>
            </div>
        </td>
    `;
    return row;
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

    // ステータスを判定（processingまたはcompleted）
    const cardStatus = item.cardStatus === 'processing' || !item.businessCard ? 'processing' : 'completed';

    // --- Business Card Details (always in view mode) ---
    let cardHtml = '';

    // 1. まず名刺画像を表示（全てのステータスで共通）
    const frontImageUrl = item.businessCard?.imageUrl?.front || '../media/表面.png';
    const backImageUrl = item.businessCard?.imageUrl?.back || '../media/裏面.png';

    cardHtml += `
        <div class="flex gap-4 mb-6 select-none">
            <div class="w-1/2">
                <div class="flex justify-between items-center mb-1">
                    <p class="text-xs text-on-surface-variant">名刺（表面）</p>
                    <div class="flex gap-1">
                         <button class="rotate-btn p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors" data-target="detail-front" data-dir="-90" title="左回転">
                            <span class="material-icons text-base">rotate_left</span>
                         </button>
                         <button class="rotate-btn p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors" data-target="detail-front" data-dir="90" title="右回転">
                            <span class="material-icons text-base">rotate_right</span>
                         </button>
                    </div>
                </div>
                <div class="aspect-[1.6/1] w-full border border-outline-variant rounded-md overflow-hidden bg-surface-variant flex items-center justify-center relative group cursor-zoom-in" data-zoom-src="${frontImageUrl}">
                    <img id="detail-front-image" src="${frontImageUrl}" class="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105" alt="名刺（表面）" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="hidden absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm">画像なし</div>
                </div>
            </div>
            <div class="w-1/2">
                <div class="flex justify-between items-center mb-1">
                    <p class="text-xs text-on-surface-variant">名刺（裏面）</p>
                    <div class="flex gap-1">
                         <button class="rotate-btn p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors" data-target="detail-back" data-dir="-90" title="左回転">
                            <span class="material-icons text-base">rotate_left</span>
                         </button>
                         <button class="rotate-btn p-1 rounded hover:bg-surface-variant text-on-surface-variant transition-colors" data-target="detail-back" data-dir="90" title="右回転">
                            <span class="material-icons text-base">rotate_right</span>
                         </button>
                    </div>
                </div>
                <div class="aspect-[1.6/1] w-full border border-outline-variant rounded-md overflow-hidden bg-surface-variant flex items-center justify-center relative group cursor-zoom-in" data-zoom-src="${backImageUrl}">
                    <img id="detail-back-image" src="${backImageUrl}" class="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105" alt="名刺（裏面）" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                    <div class="hidden absolute inset-0 flex items-center justify-center text-on-surface-variant text-sm">画像なし</div>
                </div>
            </div>
        </div>
    `;

    // 2. ステータスメッセージ（データ化進行中の場合のみ）
    if (cardStatus === 'processing') {
        const statusMessage = '<span class="processing-text text-2xl font-bold">データ化進行中</span>';
        const statusDescription = '名刺画像をデータ化しています。しばらくお待ちください。';

        cardHtml += `
            <div class="flex items-center justify-center p-6 mb-6 border border-outline-variant rounded-lg bg-surface-variant/30">
                <div class="text-center space-y-2">
                    <div class="flex items-center justify-center mb-2">
                        <span class="material-icons text-4xl text-on-surface-variant animate-spin">
                            sync
                        </span>
                    </div>
                    <div>${statusMessage}</div>
                    <p class="text-sm text-on-surface-variant">${statusDescription}</p>
                </div>
            </div>
        `;
    }

    // 3. 名刺の詳細情報（データ化完了の場合のみ）
    if (cardStatus === 'completed' && item.businessCard) {
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
export function openCardZoom(imageUrl, rotation = 0) {
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
            <img src="${imageUrl}" style="max-width: 95vw; max-height: 90vh; object-fit: contain; transform: scale(0.95) rotate(${rotation}deg); transition: transform 0.3s ease; cursor: pointer;" class="shadow-2xl" id="zoom-image-content">
            <div style="position: absolute; bottom: 1.5rem; color: white; font-size: 0.875rem; background: rgba(0,0,0,0.5); padding: 0.5rem 1rem; border-radius: 9999px; pointer-events: none;">
                クリックまたは枠外をタップで閉じる
            </div>
        `;

        const close = () => {
            overlay.style.opacity = '0';
            const img = overlay.querySelector('#zoom-image-content');
            if (img) img.style.transform = `scale(0.95) rotate(${rotation}deg)`;
            setTimeout(() => {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 300);
        };

        // Close when clicking the image as well, for convenience
        const imgContent = overlay.querySelector('#zoom-image-content');
        if (imgContent) {
            imgContent.onclick = (e) => {
                e.stopPropagation();
                close();
            };
        }

        overlay.onclick = (e) => {
            close();
        };

        document.body.appendChild(overlay);

        // Trigger fade-in
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.style.opacity = '1';
                const img = overlay.querySelector('img');
                if (img) img.style.transform = `scale(1) rotate(${rotation}deg)`;
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
            // Get rotation from the image element inside the target
            const img = zoomTarget.querySelector('img');
            const rotation = img ? (parseInt(img.dataset.rotation) || 0) : 0;

            console.log('[speedReviewRenderer] Zooming image:', src, 'rotation:', rotation);
            openCardZoom(src, rotation);
        }
    }
}
