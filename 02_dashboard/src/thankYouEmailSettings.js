import {
    getInitialData,
    saveThankYouEmailSettings,
    sendThankYouEmails,
    getRecipientsData
} from './services/thankYouEmailService.js';
import {
    renderSurveyInfo,
    setInitialFormValues,
    populateTemplates,
    populateVariables,
    updateUI,
    renderRecipientRows,
    updateCostUI,
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
    const cancelButton = document.getElementById('cancelThankYouEmailSettings');

    // Sidebar elements
    const estimateSidebar = document.getElementById('estimateSidebar');
    const estimateSidebarOverlay = document.getElementById('estimateSidebarOverlay');
    const toggleSidebarBtn = document.getElementById('toggleEstimateSidebarBtn');

    // --- State ---
    let state = {
        surveyId: null,
        surveyData: {},
        emailSettings: {},
        initialEmailSettings: {},
        emailTemplates: [],
        variables: [],
        recipients: [],
        currentStatus: 'after_event_ready'
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
                    { name: '会社名', value: 'company_name' },
                    { name: '氏名', value: 'full_name' },
                    { name: '部署名', value: 'department' },
                    { name: '役職', value: 'title' }
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
        cancelButton.addEventListener('click', handleCancel);
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
                    if (r.status !== 'excluded') r.sendEnabled = isChecked;
                });
                renderRecipientRows(state.recipients, state.currentStatus, handleRowCheckboxChange);
                updateCostFromState();
            });
        }
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

        // Initialize state (start as collapsed to be consistent)
        applySidebarState(true);
        
        // Show then auto-collapse after a short delay (like bizcardSettings)
        setTimeout(() => {
            applySidebarState(false); // Briefly show
            setTimeout(() => {
                if (hasUserInteracted) return;
                applySidebarState(true); // Automatically collapse
            }, 800);
        }, 100);
    }

    async function handleScenarioSwitch(e) {
        state.currentStatus = e.target.value;
        await applyScenario(state.currentStatus);
    }

    async function applyScenario(status) {
        if (state.recipients.length === 0 && (status === 'after_event_ready' || status === 'after_event_sent')) {
            state.recipients = await getRecipientsData(state.surveyId);
        }
        
        const isEmailEnabled = document.querySelector('input[name="sendMethod"]:checked')?.value !== 'none';
        updateUI(isEmailEnabled, status);
        
        const tableWrapper = document.getElementById('recipientTableWrapper');
        const conditionMsg = document.getElementById('recipientConditionMessage');
        const globalAlert = document.getElementById('globalStatusAlert');
        const resultCountDisplay = document.getElementById('sendResultCountDisplay');

        // Reset display
        tableWrapper.classList.add('hidden');
        conditionMsg.classList.add('hidden');
        globalAlert.classList.add('hidden');
        resultCountDisplay.classList.add('hidden');

        if (status === 'before_or_during_event' || status === 'after_event_processing') {
            conditionMsg.classList.remove('hidden');
            const msg = conditionMsg.querySelector('p');
            if (msg) msg.textContent = status === 'before_or_during_event' 
                ? '会期終了後、名刺データ化が完了すると対象者が表示されます。' 
                : '現在アンケートおよび名刺データ化を処理中です。完了次第、対象者が表示されます。';
            updateCostUI(0, 0, status);
        } else if (status === 'period_expired') {
            globalAlert.classList.remove('hidden');
            globalAlert.className = 'px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 bg-error-container text-on-error-container';
            globalAlert.innerHTML = '<span class="material-icons text-sm">error</span>期限切れ';
            updateCostUI(0, 0, status);
        } else {
            // ready or sent
            tableWrapper.classList.remove('hidden');
            renderRecipientRows(state.recipients, status, handleRowCheckboxChange);
            updateCostFromState();

            if (status === 'after_event_sent') {
                globalAlert.classList.remove('hidden');
                globalAlert.className = 'px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 bg-success-container text-on-success-container';
                globalAlert.innerHTML = '<span class="material-icons text-sm">check_circle</span>送信完了';
                
                resultCountDisplay.classList.remove('hidden');
                const successCount = state.recipients.filter(r => r.status === 'sent' || r.status === 'sent_with_warning').length;
                resultCountDisplay.textContent = `結果：${successCount}件`;
            }
        }

        handleRealtimePreview(status);
    }

    function handleRowCheckboxChange(id, isChecked) {
        const rec = state.recipients.find(r => r.id === id);
        if (rec) rec.sendEnabled = isChecked;
        
        // Update Select All checkbox state
        const enabledRecs = state.recipients.filter(r => r.status !== 'excluded');
        selectAllCb.checked = enabledRecs.every(r => r.sendEnabled);
        
        updateCostFromState();
        handleRealtimePreview();
    }

    function updateCostFromState() {
        const activeCount = state.recipients.filter(r => r.sendEnabled && r.status !== 'excluded').length;
        updateCostUI(activeCount, state.recipients.length, state.currentStatus);
    }

    function handleVariableClick(variableName) {
        insertTextAtCursor(emailBodyTextarea, `{{${variableName}}}`);
        handleRealtimePreview();
    }

    function handleRealtimePreview(statusOverride = null) {
        const bodyText = emailBodyTextarea.value;
        const previewArea = document.getElementById('previewArea');
        const warningAlert = document.getElementById('variableWarningAlert');
        const missingVarsSpan = document.getElementById('missingVariablesText');
        const missingCountSpan = document.getElementById('missingVariablesCount');

        const status = statusOverride || state.currentStatus;

        if (!previewArea) return;

        let previewHTML = bodyText
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
            
        let missingVarsSet = new Set();
        let missingCount = 0;

        if (state.recipients && state.recipients.length > 0) {
            const rec = state.recipients[0];
            const dataMap = {
                '会社名': rec.company, '部署名': rec.department, '役職': rec.title,
                '氏名': rec.name, 'アンケート名': state.surveyData.name?.ja || '展示会名',
                '自社担当者名': '担当 太郎'
            };
            
            previewHTML = previewHTML.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
                return dataMap[p1] !== undefined ? dataMap[p1] : match;
            });
            
            // Check missing vars across enabled recipients
            if (status === 'after_event_ready') {
                const varsInBody = [...bodyText.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]);
                state.recipients.forEach(r => {
                    if (!r.sendEnabled) return;
                    let hasMissing = false;
                    varsInBody.forEach(v => {
                        const val = r[v === '会社名' ? 'company' : v === '氏名' ? 'name' : v === '部署名' ? 'department' : v === '役職' ? 'title' : ''];
                        if (val !== undefined && val.trim() === '') {
                            missingVarsSet.add(v);
                            hasMissing = true;
                        }
                    });
                    if (hasMissing) missingCount++;
                });
            }
        }

        previewArea.innerHTML = previewHTML;
        
        if (missingCount > 0) {
            missingVarsSpan.textContent = Array.from(missingVarsSet).join('、');
            missingCountSpan.textContent = missingCount;
            warningAlert.classList.remove('hidden');
        } else {
            warningAlert.classList.add('hidden');
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

    async function handleSendEmails() {
        const activeCount = state.recipients.filter(r => r.sendEnabled).length;
        if (activeCount === 0) return showToast('送信対象がいません。', 'info');

        const FREE_LIMIT = 100;
        const billableCount = Math.max(0, activeCount - FREE_LIMIT);
        const cost = billableCount * 1;

        if (confirm(`お礼メールを${activeCount}件送信しますか？\n合計金額（予想）: ¥${cost.toLocaleString()} (税別)\nこの操作は取り消せません。`)) {
            setButtonLoading(sendEmailButton, true);
            try {
                await sendThankYouEmails(state.surveyId);
                showToast('送信を開始しました。', 'success');
                state.currentStatus = 'after_event_sent';
                scenarioSelector.value = 'after_event_sent';
                state.recipients.forEach(r => { if(r.sendEnabled) r.status = 'sent'; });
                await applyScenario('after_event_sent');
            } catch (e) {
                showToast('送信に失敗しました。', 'error');
            } finally {
                setButtonLoading(sendEmailButton, false);
            }
        }
    }

    function handleCancel() {
        const returnUrl = state.surveyId ? 'index.html' : 'surveyCreation.html';
        window.location.href = returnUrl;
    }

    initializePage();
}
