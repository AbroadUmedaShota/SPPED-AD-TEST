/**
 * @file thankYouEmailRenderer.js
 * お礼メール設定画面のUI描画と更新を扱うモジュール
 */

// DOM要素のキャッシュ
const dom = {};

/**
 * レンダラーに必要なDOM要素をキャッシュします。
 */
function cacheDOMElements() {
    // 基本情報
    dom.pageTitle = document.getElementById('pageTitle');
    dom.surveyNameDisplay = document.getElementById('surveyNameDisplay');
    dom.surveyIdDisplay = document.getElementById('surveyIdDisplay');
    dom.surveyPeriodDisplay = document.getElementById('surveyPeriodDisplay');
    
    // メール設定
    dom.emailTemplateSelect = document.getElementById('emailTemplate');
    dom.emailSubjectInput = document.getElementById('emailSubject');
    dom.emailBodyTextarea = document.getElementById('emailBody');
    dom.variableContainer = document.getElementById('variableContainer');
    dom.previewArea = document.getElementById('previewArea');
    dom.subjectCharCount = document.getElementById('subjectCharCount');
    
    // 送信リスト・ステータス
    dom.recipientTableWrapper = document.getElementById('recipientTableWrapper');
    dom.recipientTableBody = document.getElementById('recipientTableBody');
    dom.recipientConditionMessage = document.getElementById('recipientConditionMessage');
    dom.globalStatusAlert = document.getElementById('globalStatusAlert');
    dom.selectAllRecipients = document.getElementById('selectAllRecipients');
    
    // サイドバー・費用
    dom.recipientCount = document.getElementById('recipientCount');
    dom.totalRecipientCount = document.getElementById('totalRecipientCount');
    dom.freeTierApplied = document.getElementById('freeTierApplied');
    dom.billableCount = document.getElementById('billableCount');
    dom.estimatedAmount = document.getElementById('estimatedAmount');
    dom.sendResultCountDisplay = document.getElementById('sendResultCountDisplay');
    dom.estimateSidebar = document.getElementById('estimateSidebar');
    dom.estimateSidebarOverlay = document.getElementById('estimateSidebarOverlay');
    dom.costLabel = document.getElementById('costLabel');

    // ボタン
    dom.saveButton = document.getElementById('saveThankYouEmailSettingsBtn');
    dom.sendEmailButton = document.getElementById('sendThankYouEmailBtn');

    // ページネーション
    dom.paginationContainer = document.getElementById('paginationContainer');
    dom.totalRecipientCountInTable = document.getElementById('totalRecipientCountInTable');
    dom.currentPageRange = document.getElementById('currentPageRange');
    dom.prevPageBtn = document.getElementById('prevPageBtn');
    dom.nextPageBtn = document.getElementById('nextPageBtn');
    dom.pageNumbers = document.getElementById('pageNumbers');
}

/**
 * アンケート情報をページに描画します。
 */
export function renderSurveyInfo(surveyData, surveyId) {
    if (!dom.surveyNameDisplay) cacheDOMElements();
    
    const surveyName = (surveyData.name && surveyData.name.ja) ? surveyData.name.ja : (surveyData.surveyName || '---');
    dom.surveyNameDisplay.textContent = surveyName;
    if (dom.pageTitle) {
        dom.pageTitle.textContent = `アンケート『${surveyName}』のお礼メール設定`;
    }
    dom.surveyIdDisplay.textContent = surveyId || '---';
    dom.surveyPeriodDisplay.textContent = (surveyData.periodStart && surveyData.periodEnd) 
        ? `${surveyData.periodStart} - ${surveyData.periodEnd}` 
        : '---';
}

/**
 * 設定フォームの初期値を設定します。
 */
export function setInitialFormValues(settings) {
    if (!dom.emailSubjectInput) cacheDOMElements();
    
    // 送信方法のラジオボタン設定
    const sendMethod = settings.thankYouEmailEnabled ? (settings.sendMethod || 'manual') : 'none';
    const radio = document.querySelector(`input[name="sendMethod"][value="${sendMethod}"]`);
    if (radio) radio.checked = true;

    if (dom.emailTemplateSelect) dom.emailTemplateSelect.value = settings.emailTemplateId || '';
    dom.emailSubjectInput.value = settings.emailSubject || '';
    dom.emailBodyTextarea.value = settings.emailBody || '';
    
    // 文字数カウント更新
    if (dom.subjectCharCount) dom.subjectCharCount.textContent = (settings.emailSubject || '').length;
}

/**
 * テンプレートの選択肢を描画します。
 */
export function populateTemplates(templates) {
    if (!dom.emailTemplateSelect) cacheDOMElements();
    if (!dom.emailTemplateSelect) return;
    
    // 重複を避けるため、既存のオプションをクリアしてから templates の内容を描画
    dom.emailTemplateSelect.innerHTML = '';
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        dom.emailTemplateSelect.appendChild(option);
    });
}

/**
 * 変数バッジを描画します（リストからバッジ形式に変更）。
 */
export function populateVariables(variables, onVariableClick) {
    if (!dom.variableContainer) cacheDOMElements();
    
    dom.variableContainer.innerHTML = '';
    variables.forEach(variable => {
        const badge = document.createElement('button');
        badge.type = 'button';
        
        // カテゴリに応じて色分け（他社宛：secondary、自社/アンケート：amber）
        const colorClass = variable.category === 'survey' 
            ? 'bg-amber-100 text-amber-900 border border-amber-200' 
            : 'bg-secondary-container text-on-secondary-container';

        badge.className = `variable-badge px-3 py-1.5 ${colorClass} rounded-full text-xs font-bold hover:shadow-md transition-all flex items-center gap-1`;
        badge.innerHTML = `<span class="material-icons text-xs">add</span>{{${variable.name}}}`;
        badge.addEventListener('click', () => onVariableClick(variable.name));
        dom.variableContainer.appendChild(badge);
    });
}

/**
 * UIの表示・非活性状態を更新します。
 */
export function updateUI(isEnabled, status) {
    if (!dom.emailSubjectInput) cacheDOMElements();

    const isExpired = status === 'period_expired';
    const isProcessing = status === 'after_event_processing';
    const isSent = status === 'after_event_sent';

    // 入力項目の活性化制御
    const formFields = [
        dom.emailTemplateSelect,
        dom.emailSubjectInput,
        dom.emailBodyTextarea,
        dom.saveButton
    ];
    
    formFields.forEach(el => {
        if (el) el.disabled = !isEnabled || isExpired || isSent;
    });

    // 変数バッジの親要素も制御
    if (dom.variableContainer) {
        dom.variableContainer.style.opacity = (isEnabled && !isExpired && !isSent) ? '1' : '0.5';
        dom.variableContainer.style.pointerEvents = (isEnabled && !isExpired && !isSent) ? 'auto' : 'none';
    }

    // サイドバー内のボタン制御
    if (dom.sendEmailButton) {
        dom.sendEmailButton.disabled = !isEnabled || isExpired || isSent || status !== 'after_event_ready';
        if (isSent) dom.sendEmailButton.classList.add('hidden');
        else dom.sendEmailButton.classList.remove('hidden');
    }
}

/**
 * 宛先テーブルを行単位で描画します（ページネーション対応）。
 */
export function renderRecipientRows(recipients, status, onCheckboxChange, pagination = { currentPage: 1, itemsPerPage: 20 }) {
    if (!dom.recipientTableBody) cacheDOMElements();
    
    dom.recipientTableBody.innerHTML = '';
    const isSent = status === 'after_event_sent';
    const isProcessing = status === 'after_event_processing';
    const isExpired = status === 'period_expired';
    
    // ページネーション計算
    const totalCount = recipients.length;
    const { currentPage, itemsPerPage } = pagination;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
    const paginatedRecipients = recipients.slice(startIndex, endIndex);

    paginatedRecipients.forEach(rec => {
        const tr = document.createElement('tr');
        const isExcluded = rec.status === 'excluded';
        
        // デモ用：送信完了シナリオなら、pendingステータスもsentとして扱う
        let displayStatus = rec.status;
        if (isSent && displayStatus === 'pending') {
            displayStatus = 'sent';
        }

        // ステータスに応じた行の背景色設定
        let rowBgClass = 'hover:bg-primary/5';
        if (isExpired) {
            rowBgClass = ''; // 期限切れ時は背景なし（グレーアウトはwrapper側で制御）
        } else if (isSent || isExcluded) {
            switch(displayStatus) {
                case 'sent':
                    rowBgClass = 'bg-green-50 hover:bg-green-100';
                    break;
                case 'failed':
                    rowBgClass = 'bg-red-50 hover:bg-red-100';
                    break;
                case 'excluded':
                    rowBgClass = 'bg-gray-100 hover:bg-gray-200';
                    break;
            }
        }
        
        tr.className = `transition-colors ${rowBgClass} ${(!rec.sendEnabled && !isSent && !isExcluded) ? 'opacity-50' : ''}`;
        
        // データ化中の判定
        const isEntryProcessing = isProcessing && (!rec.company || !rec.name);
        
        // ステータスバッジの生成（期限切れ時は非表示）
        let statusBadge = '';
        if (!isExpired) {
            if (isEntryProcessing) {
                statusBadge = '<span class="processing-text text-xs">データ化中</span>';
            } else if (isSent || isExcluded) {
                switch(displayStatus) {
                    case 'sent':
                        statusBadge = '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-white/90 text-green-700 border border-green-200 shadow-sm">送信完了</span>';
                        break;
                    case 'failed':
                        statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-white/90 text-red-700 border border-red-200 shadow-sm" title="${rec.errorMsg || '送信失敗'}"><span class="material-icons text-[14px] mr-1">info</span>送信エラー</span>`;
                        break;
                    case 'excluded':
                    default:
                        statusBadge = '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-white/90 text-gray-600 border border-gray-200 shadow-sm">対象外</span>';
                }
            } else if (isProcessing) {
                statusBadge = '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200 shadow-sm">データ化完了</span>';
            }
        }

        const companyDisp = isEntryProcessing ? '<span class="processing-text text-xs">データ化中</span>' : rec.company;
        const nameDisp = isEntryProcessing ? '<span class="processing-text text-xs">データ化中</span>' : rec.name;
        const emailDisp = isEntryProcessing ? '---' : rec.email;

        tr.innerHTML = `
            <td class="p-4 text-center">
                <input type="checkbox" class="recipient-cb form-checkbox text-primary rounded-md focus:ring-primary h-5 w-5 cursor-pointer" 
                    data-id="${rec.id}" ${rec.sendEnabled ? 'checked' : ''} ${(isSent || isEntryProcessing) ? 'disabled' : ''}>
            </td>
            <td class="p-4 font-bold text-on-surface">${companyDisp}</td>
            <td class="p-4 font-medium">${nameDisp}</td>
            <td class="p-4 text-on-surface-variant font-mono text-xs">${emailDisp}</td>
            <td class="p-4">${statusBadge}</td>
        `;

        if (!isSent && !isEntryProcessing) {
            const cb = tr.querySelector('.recipient-cb');
            cb.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                tr.classList.toggle('opacity-50', !isChecked);
                onCheckboxChange(parseInt(e.target.dataset.id), isChecked);
            });
        }

        dom.recipientTableBody.appendChild(tr);
    });

    // ページネーションUIの更新
    updatePaginationUI(totalCount, pagination);
}

/**
 * ページネーションUIを更新します。
 */
function updatePaginationUI(totalCount, { currentPage, itemsPerPage }) {
    if (!dom.paginationContainer) return;

    if (totalCount <= itemsPerPage) {
        dom.paginationContainer.classList.add('hidden');
        return;
    }

    dom.paginationContainer.classList.remove('hidden');
    dom.totalRecipientCountInTable.textContent = totalCount.toLocaleString();
    
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, totalCount);
    dom.currentPageRange.textContent = `${startIndex} - ${endIndex}`;

    const totalPages = Math.ceil(totalCount / itemsPerPage);
    dom.prevPageBtn.disabled = currentPage === 1;
    dom.nextPageBtn.disabled = currentPage === totalPages;

    // ページ番号の描画（簡易版：現在のページとその前後のみ）
    dom.pageNumbers.innerHTML = '';
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.className = `w-8 h-8 rounded-full transition-colors ${i === currentPage ? 'bg-primary text-white' : 'hover:bg-surface-variant text-on-surface-variant'}`;
        btn.textContent = i;
        btn.dataset.page = i;
        dom.pageNumbers.appendChild(btn);
    }
}

/**
 * ページネーションのイベントリスナーを設定します。
 */
export function setupPaginationListeners(onPageChange, onItemsPerPageChange) {
    if (!dom.prevPageBtn) cacheDOMElements();
    dom.itemsPerPageSelect = document.getElementById('itemsPerPageSelect');

    if (dom.prevPageBtn) dom.prevPageBtn.onclick = () => onPageChange('prev');
    if (dom.nextPageBtn) dom.nextPageBtn.onclick = () => onPageChange('next');
    if (dom.pageNumbers) {
        dom.pageNumbers.onclick = (e) => {
            const page = e.target.dataset.page;
            if (page) onPageChange(parseInt(page));
        };
    }
    
    if (dom.itemsPerPageSelect && onItemsPerPageChange) {
        dom.itemsPerPageSelect.addEventListener('change', (e) => {
            onItemsPerPageChange(parseInt(e.target.value));
        });
    }
}

/**
 * 費用表示を更新します。
 */
export function renderEstimate(estimate, status) {
    if (!dom.estimatedAmount) cacheDOMElements();

    const amountEl = dom.estimatedAmount;
    const countDisplay = document.getElementById('recipientCountDisplay');
    const billableCountDisplay = document.getElementById('billableCountDisplay');
    const estimateBreakdown = document.getElementById('estimateBreakdown');

    // 主表示は税込合計
    if (amountEl) {
        amountEl.textContent = `¥${estimate.totalWithTax.toLocaleString()}`;
    }
    
    if (countDisplay) {
        countDisplay.textContent = `${estimate.activeCount.toLocaleString()} 名`;
    }

    if (billableCountDisplay) {
        // 課金対象件数（送信数 - 無料枠100）
        const billable = Math.max(0, estimate.activeCount - 100);
        billableCountDisplay.textContent = `${billable.toLocaleString()} 通`;
    }

    // 内訳の更新（より詳細に！）
    if (estimateBreakdown) {
        let html = `
            <div class="space-y-2 border-b border-outline-variant/30 pb-3 mb-3">
                <div class="flex justify-between items-center">
                    <span class="text-xs">お礼メール基本料金 (¥${estimate.unitPrice} × ${estimate.activeCount}名)</span>
                    <span class="font-medium">¥${estimate.baseAmount.toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center text-success font-bold text-xs">
                    <span class="flex items-center gap-1">
                        <span class="material-icons text-[14px]">info</span>
                        無料枠適用 (${estimate.freeAppliedCount.toLocaleString()}名分)
                    </span>
                    <span>- ¥${estimate.freeDiscount.toLocaleString()}</span>
                </div>
        `;

        // クーポンがある場合
        if (estimate.couponDiscount > 0) {
            html += `
                <div class="flex justify-between items-center text-secondary font-bold text-xs">
                    <span class="flex items-center gap-1">
                        <span class="material-icons text-[14px]">confirmation_number</span>
                        クーポン値引き
                    </span>
                    <span>- ¥${estimate.couponDiscount.toLocaleString()}</span>
                </div>
            `;
        }

        html += `
            </div>
            <div class="space-y-1">
                <div class="flex justify-between items-center text-xs">
                    <span class="text-on-surface-variant">税抜合計 (小計)</span>
                    <span class="font-bold">¥${estimate.subtotal.toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center text-xs">
                    <span class="text-on-surface-variant font-medium">消費税 (10%)</span>
                    <span class="font-medium">¥${estimate.tax.toLocaleString()}</span>
                </div>
                <div class="flex justify-between items-center pt-2 mt-1 border-t border-dashed border-outline-variant text-on-surface">
                    <span class="text-sm font-black">税込合計金額</span>
                    <span class="text-lg font-black tracking-tight">¥${estimate.totalWithTax.toLocaleString()}</span>
                </div>
            </div>
        `;

        estimateBreakdown.innerHTML = html;
        estimateBreakdown.className = "p-4 rounded-2xl bg-surface-container-low/50 border border-outline-variant/20 space-y-1";
    }
}

/**
 * クーポン検証結果をUIに反映します。
 */
export function displayCouponResult(result) {
    const feedbackEl = document.getElementById('couponFeedback');
    const messageEl = document.getElementById('couponMessage');
    const errorEl = document.getElementById('couponCodeErrorMessage');
    const couponCodeInput = document.getElementById('couponCode');

    if (!feedbackEl) return;

    feedbackEl.classList.remove('hidden', 'bg-success-container', 'text-on-success-container', 'bg-error-container', 'text-on-error-container');
    if (errorEl) errorEl.textContent = '';
    if (messageEl) messageEl.textContent = '';

    if (result.success) {
        feedbackEl.classList.add('hidden'); // 成功時はメッセージエリアで出す
        if (messageEl) {
            messageEl.textContent = result.message;
            messageEl.className = 'text-sm text-secondary font-bold animate-pulse';
        }
        if (couponCodeInput) {
            couponCodeInput.classList.remove('border-error');
            couponCodeInput.classList.add('border-secondary');
        }
    } else {
        if (errorEl) {
            errorEl.textContent = result.message;
        }
        if (couponCodeInput) {
            couponCodeInput.classList.add('border-error');
            couponCodeInput.classList.remove('border-secondary');
        }
    }
}

/**
 * ボタンのローディング状態。
 */
export function setButtonLoading(button, isLoading) {
    if (!button) return;
    const textSpan = button.querySelector('span:not(.material-icons)');
    const loadingIcon = button.querySelector('.material-icons.animate-spin');
    
    button.disabled = isLoading;
    if (textSpan) textSpan.classList.toggle('invisible', isLoading);
    if (loadingIcon) loadingIcon.classList.toggle('hidden', !isLoading);
}
