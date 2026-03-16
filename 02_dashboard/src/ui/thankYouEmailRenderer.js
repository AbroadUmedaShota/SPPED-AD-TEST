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
    dom.cancelButton = document.getElementById('cancelThankYouEmailSettings');
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
 * 宛先テーブルを行単位で描画します。
 */
export function renderRecipientRows(recipients, status, onCheckboxChange) {
    if (!dom.recipientTableBody) cacheDOMElements();
    
    dom.recipientTableBody.innerHTML = '';
    const isSent = status === 'after_event_sent';
    const isReady = status === 'after_event_ready';

    recipients.forEach(rec => {
        const tr = document.createElement('tr');
        tr.className = `hover:bg-surface-container-low transition-colors ${(!rec.sendEnabled && !isSent) ? 'opacity-50' : ''}`;
        
        // ステータスバッジの生成
        let statusBadge = '';
        if (isSent || rec.status === 'excluded') {
            switch(rec.status) {
                case 'sent':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-container text-success">送信済み</span>';
                    break;
                case 'sent_with_warning':
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-container text-success border border-warning/30" title="空変数あり"><span class="material-icons text-[14px] mr-1">warning</span>送信済み</span>';
                    break;
                case 'failed':
                    statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-error-container text-error" title="${rec.errorMsg || '送信失敗'}"><span class="material-icons text-[14px] mr-1">info</span>送信失敗</span>`;
                    break;
                case 'excluded':
                default:
                    statusBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-surface-container-highest text-on-surface-variant">対象外</span>';
            }
        }

        tr.innerHTML = `
            <td class="p-4 text-center">
                <input type="checkbox" class="recipient-cb form-checkbox text-primary rounded-md focus:ring-primary h-5 w-5 cursor-pointer" 
                    data-id="${rec.id}" ${rec.sendEnabled ? 'checked' : ''} ${isSent ? 'disabled' : ''}>
            </td>
            <td class="p-4 font-medium text-on-surface">${rec.company}</td>
            <td class="p-4">${rec.name}</td>
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
