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

    dom.emailTemplateSelect.value = settings.emailTemplateId || '';
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
    
    // 初期状態を保持しつつ追加
    dom.emailTemplateSelect.innerHTML = '<option value="">標準文面（初期設定）</option>';
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
        badge.className = 'variable-badge px-3 py-1.5 bg-secondary-container text-on-secondary-container rounded-full text-xs font-bold hover:shadow-md transition-all flex items-center gap-1';
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
    
    // ページネーション計算
    const totalCount = recipients.length;
    const { currentPage, itemsPerPage } = pagination;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
    const paginatedRecipients = recipients.slice(startIndex, endIndex);

    paginatedRecipients.forEach(rec => {
        const tr = document.createElement('tr');
        tr.className = `hover:bg-primary/5 transition-colors ${(!rec.sendEnabled && !isSent) ? 'opacity-50' : ''}`;
        
        // ステータスバッジの生成
        let statusBadge = '';
        if (isSent || rec.status === 'excluded') {
            switch(rec.status) {
                case 'sent':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#e6f4ea] text-[#1e7e34]">送信済み</span>';
                    break;
                case 'sent_with_warning':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#e6f4ea] text-[#1e7e34] ring-1 ring-inset ring-amber-400" title="空変数あり"><span class="material-icons text-[14px] mr-1 text-amber-500">warning</span>送信済み</span>';
                    break;
                case 'failed':
                    statusBadge = `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#fce8e6] text-[#d93025]" title="${rec.errorMsg || '送信失敗'}"><span class="material-icons text-[14px] mr-1">info</span>送信失敗</span>`;
                    break;
                case 'excluded':
                default:
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#f1f3f4] text-[#5f6368]">対象外</span>';
            }
        }

        tr.innerHTML = `
            <td class="p-4 text-center">
                <input type="checkbox" class="recipient-cb form-checkbox text-primary rounded-md focus:ring-primary h-5 w-5 cursor-pointer" 
                    data-id="${rec.id}" ${rec.sendEnabled ? 'checked' : ''} ${isSent ? 'disabled' : ''}>
            </td>
            <td class="p-4 font-bold text-on-surface">${rec.company}</td>
            <td class="p-4 font-medium">${rec.name}</td>
            <td class="p-4 text-on-surface-variant font-mono text-xs">${rec.email}</td>
            <td class="p-4">${statusBadge}</td>
        `;

        if (!isSent) {
            const cb = tr.querySelector('.recipient-cb');
            cb.addEventListener('change', (e) => {
                tr.classList.toggle('opacity-50', !e.target.checked);
                onCheckboxChange(parseInt(e.target.dataset.id), e.target.checked);
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
export function setupPaginationListeners(onPageChange) {
    if (!dom.prevPageBtn) cacheDOMElements();

    dom.prevPageBtn.onclick = () => onPageChange('prev');
    dom.nextPageBtn.onclick = () => onPageChange('next');
    dom.pageNumbers.onclick = (e) => {
        const page = e.target.dataset.page;
        if (page) onPageChange(parseInt(page));
    };
}

/**
 * 費用表示を更新します。
 */
export function updateCostUI(activeCount, totalCount, status) {
    if (!dom.recipientCount) cacheDOMElements();

    const FREE_LIMIT = 100;
    const UNIT_PRICE = 1;

    // 無料枠の適用数（送信対象が100通以下ならその数、100通以上なら100通）
    const freeApplied = Math.min(activeCount, FREE_LIMIT);
    // 課金対象（送信対象 - 無料枠、マイナスにならないように）
    const billable = Math.max(0, activeCount - FREE_LIMIT);
    const cost = billable * UNIT_PRICE;

    dom.recipientCount.textContent = activeCount.toLocaleString();
    if (dom.totalRecipientCount) dom.totalRecipientCount.textContent = totalCount.toLocaleString();
    if (dom.freeTierApplied) dom.freeTierApplied.textContent = freeApplied.toLocaleString();
    if (dom.billableCount) dom.billableCount.textContent = billable.toLocaleString();

    dom.estimatedAmount.textContent = `¥${cost.toLocaleString()}`;
    
    if (status === 'after_event_sent') {
        dom.costLabel.textContent = '確定合計金額';
        dom.costLabel.classList.add('text-success');
    } else {
        dom.costLabel.textContent = '合計金額（予想）';
        dom.costLabel.classList.remove('text-success');
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
