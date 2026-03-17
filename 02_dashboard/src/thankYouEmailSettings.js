import {
    getInitialData,
    saveThankYouEmailSettings,
    sendThankYouEmails,
    getRecipientsData
} from './services/thankYouEmailService.js';
import { validateCoupon } from './services/bizcardSettingsService.js';
import { calculateThankYouEmailEstimate } from './services/thankYouEmailCalculator.js';
import {
    renderSurveyInfo,
    setInitialFormValues,
    populateTemplates,
    populateVariables,
    updateUI,
    renderRecipientRows,
    setupPaginationListeners,
    renderEstimate,
    displayCouponResult,
    setButtonLoading
} from './ui/thankYouEmailRenderer.js';
import { showConfirmationModal } from './confirmationModal.js';
import { showToast } from './utils.js';
import { insertTextAtCursor } from './utils.js';

export function initThankYouEmailSettings() {
    // --- DOM Elements ---
    const sendMethodRadios = document.querySelectorAll('input[name="sendMethod"]');
    const emailTemplateSelect = document.getElementById('emailTemplate');
    const emailBodyTextarea = document.getElementById('emailBody');
    const emailSubjectInput = document.getElementById('emailSubject');
    const scenarioSelector = document.getElementById('scenarioSelector');
    const selectAllCb = document.getElementById('selectAllRecipients');
    
    const saveButton = document.getElementById('saveThankYouEmailSettingsBtn');
    const sendEmailButton = document.getElementById('sendThankYouEmailBtn');

    // Sidebar elements (New IDs)
    const couponCodeInput = document.getElementById('couponCode');
    const applyCouponBtn = document.getElementById('applyCouponBtn');

    // --- State ---
    let state = {
        surveyId: null,
        surveyData: {},
        emailSettings: {},
        initialEmailSettings: {},
        emailTemplates: [],
        variables: [],
        recipients: [],
        currentStatus: 'before_or_during_event',
        pagination: {
            currentPage: 1,
            itemsPerPage: 20
        },
        appliedCoupon: null,
        isCouponApplied: false,
        couponButtonMode: 'apply',
        isCouponProcessing: false
    };

    /**
     * Initializes the page
     */
    async function initializePage() {
        const urlParams = new URLSearchParams(window.location.search);
        state.surveyId = urlParams.get('surveyId');

        try {
            if (state.surveyId) {
                const initialData = await getInitialData(state.surveyId);
                state = { ...state, ...initialData };
            } else {
                const tempDataString = localStorage.getItem('tempSurveyData');
                if (!tempDataString) {
                    showToast('データが見つかりません。', 'error');
                    return;
                }
                const tempData = JSON.parse(tempDataString);
                state.surveyData = { id: null, name: tempData.name, periodStart: '2025/01/01', periodEnd: '2025/01/03' };
                state.emailSettings = tempData.settings?.thankYouEmail || {};
                state.variables = [
                    { name: '会社名', value: 'company_name', category: 'recipient' },
                    { name: '氏名', value: 'full_name', category: 'recipient' },
                    { name: '部署名', value: 'department', category: 'recipient' },
                    { name: '役職', value: 'title', category: 'recipient' },
                    { name: 'アンケート名', value: 'survey_name', category: 'survey' }
                ];
            }

            state.initialEmailSettings = JSON.parse(JSON.stringify(state.emailSettings));

            renderSurveyInfo(state.surveyData, state.surveyId);
            populateTemplates(state.emailTemplates);
            populateVariables(state.variables, handleVariableClick);
            setInitialFormValues(state.emailSettings);

            setupEventListeners();
            initEstimateSidebarToggle();
            
            // Apply initial scenario
            scenarioSelector.value = state.currentStatus;
            await applyScenario(state.currentStatus);

        } catch (error) {
            console.error('初期化エラー:', error);
            showToast('読み込みに失敗しました。', 'error');
        }
    }

    function setupEventListeners() {
        sendMethodRadios.forEach(radio => radio.addEventListener('change', handleFormChange));
        emailTemplateSelect.addEventListener('change', handleTemplateChange);
        emailBodyTextarea.addEventListener('input', () => handleRealtimePreview());
        emailSubjectInput.addEventListener('input', (e) => {
            document.getElementById('subjectCharCount').textContent = e.target.value.length;
        });

        saveButton.addEventListener('click', handleSaveSettings);
        sendEmailButton.addEventListener('click', handleSendEmails);

        if (couponCodeInput) {
            couponCodeInput.addEventListener('input', updateCouponSectionUI);
        }
        if (applyCouponBtn) {
            applyCouponBtn.addEventListener('click', handleApplyCoupon);
        }

        const sendConfirmCancelBtn = document.getElementById('sendConfirmCancelBtn');
        if (sendConfirmCancelBtn) {
            sendConfirmCancelBtn.addEventListener('click', () => {
                document.getElementById('sendConfirmModal').classList.add('hidden');
            });
        }
        
        const sendConfirmExecuteBtn = document.getElementById('sendConfirmExecuteBtn');
        if (sendConfirmExecuteBtn) {
            sendConfirmExecuteBtn.addEventListener('click', executeSendEmails);
        }
        scenarioSelector.addEventListener('change', handleScenarioSwitch);

        // Variables toggle
        const toggleVariablesBtn = document.getElementById('toggleVariablesBtn');
        const variableContainerWrapper = document.getElementById('variableContainerWrapper');
        const variablesToggleIcon = document.getElementById('variablesToggleIcon');
        if (toggleVariablesBtn && variableContainerWrapper) {
            toggleVariablesBtn.addEventListener('click', () => {
                const isHidden = variableContainerWrapper.classList.contains('hidden');
                variableContainerWrapper.classList.toggle('hidden');
                if (variablesToggleIcon) {
                    variablesToggleIcon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
                }
            });
        }

        // Select All Checkbox
        if (selectAllCb) {
            selectAllCb.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                state.recipients.forEach(r => {
                    r.sendEnabled = isChecked;
                    r.status = isChecked ? 'pending' : 'excluded';
                });
                renderRecipientRows(state.recipients, state.currentStatus, handleRowCheckboxChange, state.pagination);
                updateCostFromState();
            });
        }

        // ページネーション設定
        setupPaginationListeners(handlePageChange, handleItemsPerPageChange);
    }

    function initEstimateSidebarToggle() {
        const sidebar = document.getElementById('estimateSidebar');
        const toggleBtn = document.getElementById('toggleEstimateSidebarBtn');
        const overlay = document.getElementById('estimateSidebarOverlay');

        if (!sidebar || !toggleBtn) {
            return;
        }

        const toggleIcon = toggleBtn.querySelector('.material-icons');
        let hasUserInteracted = false;

        const applySidebarState = (isCollapsed) => {
            if (!toggleIcon) return;
            if (isCollapsed) {
                sidebar.classList.add('translate-x-full');
                toggleIcon.textContent = 'chevron_left';
                toggleBtn.setAttribute('aria-expanded', 'false');
                if (overlay) overlay.classList.remove('is-visible');
            } else {
                sidebar.classList.remove('translate-x-full');
                toggleIcon.textContent = 'chevron_right';
                toggleBtn.setAttribute('aria-expanded', 'true');
                if (overlay) overlay.classList.add('is-visible');
            }
        };

        toggleBtn.addEventListener('click', () => {
            hasUserInteracted = true;
            const isCollapsed = sidebar.classList.contains('translate-x-full');
            applySidebarState(!isCollapsed);
        });

        if (overlay) {
            overlay.addEventListener('click', () => {
                hasUserInteracted = true;
                applySidebarState(true);
            });
        }

        // 初期表示：bizcardSettingsと同じく少し遅らせて閉じる演出
        applySidebarState(false);
        setTimeout(() => {
            if (hasUserInteracted) return;
            applySidebarState(true);
        }, 800);
    }

    async function handleScenarioSwitch(e) {
        state.currentStatus = e.target.value;
        
        // デモ用：送信完了シナリオに切り替えた際、ステータスをランダムに割り振る
        if (state.currentStatus === 'after_event_sent') {
            state.recipients.forEach((r, index) => {
                if (!r.sendEnabled) {
                    r.status = 'excluded';
                } else {
                    // 95%成功、5%失敗の割合でシミュレート（簡略化：sent_with_warningは不要）
                    const rand = Math.random();
                    if (rand < 0.95) r.status = 'sent';
                    else {
                        r.status = 'failed';
                        r.errorMsg = '宛先不明またはドメインエラー';
                    }
                }
            });
        } else {
            // 待機状態などに戻す場合はpendingに戻す
            state.recipients.forEach(r => {
                if (r.status !== 'excluded') r.status = 'pending';
            });
        }

        await applyScenario(state.currentStatus);
    }
    
    /**
     * 表示件数の変更を処理します。
     */
    function handleItemsPerPageChange(newLimit) {
        state.pagination.itemsPerPage = newLimit;
        state.pagination.currentPage = 1; // 件数が変わったら1ページ目に戻す
        renderRecipientRows(state.recipients, state.currentStatus, handleRowCheckboxChange, state.pagination);
        document.getElementById('recipientTableWrapper').scrollTop = 0;
    }

    async function applyScenario(status) {
        if (state.recipients.length === 0 && (status === 'after_event_ready' || status === 'after_event_sent' || status === 'after_event_processing')) {
            state.recipients = await getRecipientsData(state.surveyId);
        }

        // STEP 2 (after_event_processing) の場合は、デモ用に一部のデータを隠す
        if (status === 'after_event_processing') {
            state.recipients.forEach((r, index) => {
                // 80%の確率でデータ化完了、20%の確率でデータ化中として扱う（ランダム）
                const isDigitized = Math.random() < 0.8;
                
                if (!isDigitized) {
                    r._originalCompany = r._originalCompany || r.company;
                    r._originalName = r._originalName || r.name;
                    r.company = '';
                    r.name = '';
                } else {
                    // 完了している場合は元のデータを復元
                    if (r._originalCompany) r.company = r._originalCompany;
                    if (r._originalName) r.name = r._originalName;
                }
            });
        } else {
            // 他のステータスに戻った時はデータを復元する
            state.recipients.forEach(r => {
                if (r._originalCompany) r.company = r._originalCompany;
                if (r._originalName) r.name = r._originalName;
            });
        }
        
        const isEmailEnabled = document.querySelector('input[name="sendMethod"]:checked')?.value !== 'none';
        updateUI(isEmailEnabled, status);
        
        const tableWrapper = document.getElementById('recipientTableWrapper');
        const conditionMsg = document.getElementById('recipientConditionMessage');
        const globalAlert = document.getElementById('globalStatusAlert');
        const resultCountDisplay = document.getElementById('sendResultCountDisplay');

        // 安全装置：要素が見つからない場合は処理をスキップ
        if (tableWrapper) tableWrapper.classList.add('hidden');
        if (conditionMsg) conditionMsg.classList.add('hidden');
        if (globalAlert) globalAlert.classList.add('hidden');
        if (resultCountDisplay) resultCountDisplay.classList.add('hidden');

        if (status === 'before_or_during_event') {
            if (conditionMsg) {
                conditionMsg.classList.remove('hidden');
                const msg = conditionMsg.querySelector('p');
                if (msg) msg.textContent = '会期終了後、名刺データ化が完了すると対象者が表示されます。';
            }
            updateCostFromState();
        } else if (status === 'period_expired') {
            if (globalAlert) {
                globalAlert.classList.remove('hidden');
                globalAlert.className = 'px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 bg-error-container text-on-error-container';
                globalAlert.innerHTML = '<span class="material-icons text-sm">error</span>期限切れ';
            }
            // テーブルが存在すれば表示しつつグレーアウト（参照可能・操作不可）
            if (state.recipients.length > 0) {
                if (tableWrapper) {
                    tableWrapper.classList.remove('hidden');
                    tableWrapper.style.opacity = '0.5';
                    tableWrapper.style.pointerEvents = 'none';
                }
                renderRecipientRows(state.recipients, status, handleRowCheckboxChange, state.pagination);
            } else {
                if (conditionMsg) conditionMsg.classList.remove('hidden');
            }
            updateCostFromState();
        } else {
            // ready or sent - グレーアウト解除
            if (tableWrapper) {
                tableWrapper.style.opacity = '';
                tableWrapper.style.pointerEvents = '';
                tableWrapper.classList.remove('hidden');
            }
            // ページネーション情報を渡して描画
            renderRecipientRows(state.recipients, status, handleRowCheckboxChange, state.pagination);
            updateCostFromState();
        }

        if (status === 'after_event_sent') {
            if (globalAlert) {
                globalAlert.classList.remove('hidden');
                globalAlert.className = 'px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 bg-success-container text-on-success-container';
                globalAlert.innerHTML = '<span class="material-icons text-sm">check_circle</span>送信完了';
            }
            
            if (resultCountDisplay) {
                resultCountDisplay.classList.remove('hidden');
                const successCount = state.recipients.filter(r => r.status === 'sent').length;
                resultCountDisplay.textContent = `結果：${successCount}件`;
            }
        }

        handleRealtimePreview(status);
    }

    /**
     * ページ変更を処理します。
     */
    function handlePageChange(target) {
        const totalPages = Math.ceil(state.recipients.length / state.pagination.itemsPerPage);
        
        if (target === 'prev') {
            state.pagination.currentPage = Math.max(1, state.pagination.currentPage - 1);
        } else if (target === 'next') {
            state.pagination.currentPage = Math.min(totalPages, state.pagination.currentPage + 1);
        } else if (typeof target === 'number') {
            state.pagination.currentPage = target;
        }

        renderRecipientRows(state.recipients, state.currentStatus, handleRowCheckboxChange, state.pagination);
        
        // ページ移動時にテーブルトップへスクロール
        document.getElementById('recipientTableWrapper').scrollTop = 0;
    }

    function handleRowCheckboxChange(id, isChecked) {
        const rec = state.recipients.find(r => r.id === id);
        if (rec) {
            rec.sendEnabled = isChecked;
            rec.status = isChecked ? 'pending' : 'excluded';
        }
        
        // Update Select All checkbox state
        const enabledRecs = state.recipients.filter(r => r.status !== 'excluded');
        selectAllCb.checked = enabledRecs.length > 0 && enabledRecs.every(r => r.sendEnabled);
        
        // ステータスバッジの表示もあるのでテーブルを再描画
        renderRecipientRows(state.recipients, state.currentStatus, handleRowCheckboxChange, state.pagination);
        
        updateCostFromState();
        handleRealtimePreview();
    }

    function updateCostFromState() {
        const activeCount = state.recipients.filter(r => r.sendEnabled && r.status !== 'excluded').length;
        const estimate = calculateThankYouEmailEstimate(activeCount, state.appliedCoupon);
        renderEstimate(estimate, state.currentStatus);
    }

    /**
     * クーポン適用セクションのUIを更新します。
     */
    function updateCouponSectionUI() {
        const couponLoadingIndicator = document.getElementById('couponLoadingIndicator');
        if (!couponCodeInput || !applyCouponBtn || !couponLoadingIndicator) return;

        const trimmedValue = couponCodeInput.value.trim();
        const appliedCoupon = state.appliedCoupon;
        const hasAppliedCoupon = Boolean(appliedCoupon);

        let mode = 'apply';
        if (hasAppliedCoupon) {
            const appliedCode = appliedCoupon.code || '';
            if (trimmedValue && trimmedValue !== appliedCode) {
                mode = 'change';
            } else {
                mode = 'remove';
            }
        }

        state.isCouponApplied = hasAppliedCoupon;
        state.couponButtonMode = mode;

        const labels = { apply: '適用', change: '変更', remove: '削除' };

        couponCodeInput.disabled = state.isCouponProcessing;

        if (state.isCouponProcessing) {
            applyCouponBtn.classList.add('hidden');
            couponLoadingIndicator.classList.remove('hidden');
        } else {
            applyCouponBtn.classList.remove('hidden');
            couponLoadingIndicator.classList.add('hidden');
            applyCouponBtn.textContent = labels[mode];
            
            applyCouponBtn.classList.remove('coupon-action-button--apply', 'coupon-action-button--change', 'coupon-action-button--remove');
            applyCouponBtn.classList.add(`coupon-action-button--${mode}`);
        }
    }

    /**
     * クーポン適用ボタンのクリックを処理します。
     */
    async function handleApplyCoupon() {
        if (state.isCouponProcessing) return;

        const currentMode = state.couponButtonMode;

        if (currentMode === 'remove' && state.appliedCoupon) {
            state.appliedCoupon = null;
            state.isCouponApplied = false;
            couponCodeInput.value = '';
            displayCouponResult({ success: true, message: 'クーポンを削除しました' });
            updateCouponSectionUI();
            updateCostFromState();
            return;
        }

        const code = couponCodeInput.value.trim();
        if (!code) {
            displayCouponResult({ success: false, message: 'クーポンコードを入力してください。' });
            return;
        }

        state.isCouponProcessing = true;
        updateCouponSectionUI();

        try {
            const result = await validateCoupon(code);
            displayCouponResult(result);
            if (result.success) {
                state.appliedCoupon = { ...result, code };
            } else {
                state.appliedCoupon = null;
            }
        } catch (error) {
            console.error('クーポン検証エラー:', error);
            displayCouponResult({ success: false, message: 'クーポンの検証中にエラーが発生しました。' });
            state.appliedCoupon = null;
        } finally {
            state.isCouponProcessing = false;
            updateCouponSectionUI();
            updateCostFromState();
        }
    }

    function handleVariableClick(variableName) {
        insertTextAtCursor(emailBodyTextarea, `{{${variableName}}}`);
        handleRealtimePreview();
    }

    function handleRealtimePreview(statusOverride = null) {
        const bodyText = emailBodyTextarea.value;
        const subjectText = emailSubjectInput.value;
        const previewSubject = document.getElementById('previewSubject');
        const previewBody = document.getElementById('previewBody');
        const noticeAlert = document.getElementById('variableNoticeAlert');
        const missingVarsSpan = document.getElementById('missingVariablesText');

        const status = statusOverride || state.currentStatus;

        if (!previewBody || !previewSubject) return;

        let previewHTML = bodyText
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
            
        let missingVarsSet = new Set();

        // 宛先データがある場合は1件目のデータを使用、ない場合はプレースホルダーを使用
        const rec = (state.recipients && state.recipients.length > 0) ? state.recipients[0] : null;
        
        const dataMap = {
            '会社名': rec?.company || '（株式会社サンプル）',
            '部署名': rec?.department || '（営業部）',
            '役職': rec?.title || '（課長）',
            '氏名': rec?.name || '（山田 太郎）',
            'アンケート名': state.surveyData?.name?.ja || state.surveyData?.surveyName || '（展示会名）'
        };
        
        // 変数置換 (本文)
        previewHTML = previewHTML.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
            const val = dataMap[p1];
            return val !== undefined ? val : match;
        });

        // 変数置換 (件名)
        let subjectHTML = subjectText
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
        subjectHTML = subjectHTML.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
            const val = dataMap[p1];
            return val !== undefined ? val : match;
        });

        // データ不足項目のスキャン (送信待機中のみ)
        if (status === 'after_event_ready' && state.recipients.length > 0) {
            const varsUsed = [...`${subjectText} ${bodyText}`.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]);
            state.recipients.forEach(r => {
                if (!r.sendEnabled) return;
                varsUsed.forEach(v => {
                    const key = v === '会社名' ? 'company' : v === '氏名' ? 'name' : v === '部署名' ? 'department' : v === '役職' ? 'title' : '';
                    if (key && (r[key] === undefined || r[key] === null || r[key].trim() === '')) {
                        missingVarsSet.add(v);
                    }
                });
            });
        }

        previewSubject.innerHTML = subjectHTML || '<span class="text-on-surface-variant/50 font-normal">（件名が未入力です）</span>';
        previewBody.innerHTML = previewHTML;
        
        if (missingVarsSet.size > 0 && noticeAlert) {
            missingVarsSpan.textContent = Array.from(missingVarsSet).join('、');
            noticeAlert.classList.remove('hidden');
        } else if (noticeAlert) {
            noticeAlert.classList.add('hidden');
        }
    }

    function handleFormChange() {
        const selectedMethod = document.querySelector('input[name="sendMethod"]:checked')?.value;
        const isEnabled = selectedMethod !== 'none';
        updateUI(isEnabled, state.currentStatus);
        handleRealtimePreview();
        updateCostFromState();
    }

    function handleTemplateChange() {
        const selectedTemplate = state.emailTemplates.find(t => t.id === emailTemplateSelect.value);
        if (selectedTemplate) {
            emailSubjectInput.value = selectedTemplate.subject || '';
            emailBodyTextarea.value = selectedTemplate.body || '';
            emailBodyTextarea.dispatchEvent(new Event('input'));
            emailSubjectInput.dispatchEvent(new Event('input'));
        }
    }

    async function handleSaveSettings() {
        setButtonLoading(saveButton, true);
        const selectedMethod = document.querySelector('input[name="sendMethod"]:checked').value;
        const settings = {
            thankYouEmailEnabled: selectedMethod !== 'none',
            sendMethod: selectedMethod === 'none' ? 'manual' : selectedMethod,
            emailTemplateId: emailTemplateSelect.value,
            emailSubject: emailSubjectInput.value,
            emailBody: emailBodyTextarea.value,
            couponCode: state.appliedCoupon ? state.appliedCoupon.code : null
        };
        
        try {
            await saveThankYouEmailSettings({ ...settings, surveyId: state.surveyId });
            showToast('設定を保存しました。', 'success');
        } catch (e) {
            showToast('保存に失敗しました。', 'error');
        } finally {
            setButtonLoading(saveButton, false);
        }
    }

    function handleSendEmails() {
        const activeCount = state.recipients.filter(r => r.sendEnabled).length;
        if (activeCount === 0) return showToast('送信対象がいません。', 'info');

        const estimate = calculateThankYouEmailEstimate(activeCount, state.appliedCoupon);

        document.getElementById('modalActiveCount').textContent = activeCount;
        document.getElementById('modalCost').textContent = `¥${estimate.totalWithTax.toLocaleString()}`;
        document.getElementById('sendConfirmModal').classList.remove('hidden');
    }

    async function executeSendEmails() {
        const sendConfirmExecuteBtn = document.getElementById('sendConfirmExecuteBtn');
        const defaultText = sendConfirmExecuteBtn.querySelector('span:not(.material-icons)').textContent;
        
        sendConfirmExecuteBtn.querySelector('span:not(.material-icons)').textContent = '送信中...';
        setButtonLoading(sendConfirmExecuteBtn, true);
        
        try {
            await sendThankYouEmails(state.surveyId);
        } catch (e) {
            console.warn('API error ignored for mock demonstration:', e);
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));

        showToast('送信を開始しました。', 'success');
        state.currentStatus = 'after_event_sent';
        
        state.recipients.forEach(r => {
            if (!r.sendEnabled) {
                r.status = 'excluded';
            } else {
                const rand = Math.random();
                // 95%成功、5%失敗
                if (rand < 0.95) r.status = 'sent';
                else {
                    r.status = 'failed';
                    r.errorMsg = '宛先不明またはドメインエラー';
                }
            }
        });

        scenarioSelector.value = 'after_event_sent';
        await applyScenario('after_event_sent');
        
        setButtonLoading(sendConfirmExecuteBtn, false);
        sendConfirmExecuteBtn.querySelector('span:not(.material-icons)').textContent = defaultText;
        document.getElementById('sendConfirmModal').classList.add('hidden');
    }

    initializePage();
}
