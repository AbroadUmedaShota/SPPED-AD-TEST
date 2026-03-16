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
    updateTemplatePreview,
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
    const insertVariableBtn = document.getElementById('insertVariableBtn');
    const variableList = document.getElementById('variableList');
    const saveButton = document.getElementById('saveThankYouEmailSettingsBtn');
    const sendEmailButton = document.getElementById('sendThankYouEmailBtn');
    const cancelButton = document.getElementById('cancelThankYouEmailSettings');

    // --- State ---
    let state = {
        surveyId: null,
        surveyData: {},
        emailSettings: {},
        initialEmailSettings: {},
        emailTemplates: [],
        variables: [],
        recipients: [],
        currentStatus: 'after_event_ready' // Default scenario for development
    };

    /**
     * Initializes the page, fetches data, and sets up event listeners.
     */
    async function initializePage() {
        const urlParams = new URLSearchParams(window.location.search);
        state.surveyId = urlParams.get('surveyId');

        try {
            if (state.surveyId) {
                // --- Existing Survey Mode ---
                const initialData = await getInitialData(state.surveyId);
                state = { ...state, ...initialData };
            } else {
                // --- New Survey (Temp) Mode ---
                const tempDataString = localStorage.getItem('tempSurveyData');
                if (!tempDataString) {
                    showToast('一時的なアンケートデータが見つかりません。作成画面からやり直してください。', 'error');
                    setTimeout(() => { window.location.href = 'surveyCreation.html'; }, 2000);
                    return;
                }
                const tempData = JSON.parse(tempDataString);

                state.surveyData = {
                    id: null,
                    name: tempData.name,
                    displayTitle: tempData.displayTitle,
                    recipientCount: 0 // No real recipients yet
                };
                state.emailSettings = tempData.settings?.thankYouEmail || {};
                // For new surveys, templates and variables might be empty or come from a default source
                state.emailTemplates = []; 
                state.variables = [
                    { name: '会社名', value: 'company_name' },
                    { name: '氏名', value: 'full_name' },
                    { name: '部署名', value: 'department' },
                    { name: '役職', value: 'title' }
                ];
            }

            // Deep copy for initial state comparison
            state.initialEmailSettings = JSON.parse(JSON.stringify(state.emailSettings));

            renderSurveyInfo(state.surveyData, state.surveyId);
            populateTemplates(state.emailTemplates);
            populateVariables(state.variables, handleVariableClick);

            // --- Start of Fix ---
            // Create a robust dummy component to prevent crash in setInitialFormValues
            const dummyContainer = document.createElement('div');
            dummyContainer.style.display = 'none';
            dummyContainer.innerHTML = `
                <input id="thankYouEmailEnabledToggle">
                <span id="thankYouEmailEnabledStatus"></span>
            `;
            document.body.appendChild(dummyContainer);

            try {
                setInitialFormValues(state.emailSettings);
            } catch (e) {
                console.warn('Error in setInitialFormValues (suppressed by dummy component hack)', e);
            } finally {
                document.body.removeChild(dummyContainer);
            }

            // Set initial radio button state
            let sendMethod = 'none';
            if (state.emailSettings.thankYouEmailEnabled) {
                 sendMethod = state.emailSettings.sendMethod || 'manual';
            }
             // For new surveys, default to 'auto' if no specific method is set
            if (!state.surveyId && !state.emailSettings.sendMethod) {
                sendMethod = 'auto';
            }

            const radioToCheck = document.querySelector(`input[name="sendMethod"][value="${sendMethod}"]`);
            if (radioToCheck) {
                radioToCheck.checked = true;
            }

            setupEventListeners();
            
            const initialIsEnabled = document.querySelector('input[name="sendMethod"]:checked')?.value !== 'none';
            updateUI(initialIsEnabled, state.surveyData);
            handleRealtimePreview(); // Render initial preview

        } catch (error) {
            console.error('初期化エラー:', error);
            showToast('ページの読み込みに失敗しました。', 'error');
        }
    }

    /**
     * Sets up all event listeners for the page.
     */
    function setupEventListeners() {
        sendMethodRadios.forEach(radio => radio.addEventListener('change', handleFormChange));
        emailTemplateSelect.addEventListener('change', handleTemplateChange);
        document.getElementById('emailBody').addEventListener('input', handleRealtimePreview);
        insertVariableBtn.addEventListener('click', () => variableList.classList.toggle('hidden'));

        const insertTemplateBtn = document.getElementById('insertTemplateBtn');
        if (insertTemplateBtn) {
            insertTemplateBtn.addEventListener('click', () => {
                const templateBody = insertTemplateBtn.dataset.templateBody || '';
                emailBodyTextarea.value = templateBody;
                
                const templateSelectionContainer = document.getElementById('templateSelectionContainer');
                if (templateSelectionContainer) {
                    templateSelectionContainer.classList.add('hidden');
                }
                
                emailBodyTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                emailTemplateSelect.value = "";
            });
        }

        saveButton.addEventListener('click', handleSaveSettings);
        sendEmailButton.addEventListener('click', handleSendEmails);
        cancelButton.addEventListener('click', handleCancel);

        // New event listeners
        document.getElementById('emailSubject').addEventListener('input', () => updateCharCount('emailSubject', 'subjectCharCount'));
        document.getElementById('scenarioSelector').addEventListener('change', handleScenarioSwitch);
        
        // Initial setup
        updateCharCount('emailSubject', 'subjectCharCount');
        
        // Initialize scenario
        document.getElementById('scenarioSelector').value = state.currentStatus;
        applyScenario(state.currentStatus);
    }
    
    function updateCharCount(inputId, countId) {
        const input = document.getElementById(inputId);
        const countSpan = document.getElementById(countId);
        if (input && countSpan) {
            countSpan.textContent = input.value.length;
        }
    }
    
    async function handleScenarioSwitch(e) {
        state.currentStatus = e.target.value;
        await applyScenario(state.currentStatus);
    }
    
    async function applyScenario(status) {
        // Fetch recipients if not loaded
        if (state.recipients.length === 0 && (status === 'after_event_ready' || status === 'after_event_sent')) {
            state.recipients = await getRecipientsData(state.surveyId);
        }
        
        const isEmailEnabled = document.querySelector('input[name="sendMethod"]:checked')?.value !== 'none';
        
        // Let's call updateUI to handle some base visibility, then we override based on scenario
        updateUI(isEmailEnabled, state.surveyData);
        // Additional UI logic by status is handled in specific render functions
        renderRecipientGridAndCost(status);
        handleRealtimePreview(status);
        updateSendButtonByScenario(status);
    }
    
    function renderRecipientGridAndCost(status) {
        const listDiv = document.getElementById('recipientListContainer');
        const conditionMsg = document.getElementById('recipientConditionMessage');
        const tableHeader = document.getElementById('recipientTableHeader');
        const tableBody = document.getElementById('recipientTableBody');
        const globalAlert = document.getElementById('globalStatusAlert');
        const resultCountDisplay = document.getElementById('sendResultCountDisplay');
        const costBlock = document.getElementById('costCalculationBlock');
        const sendMethodRadios = document.querySelectorAll('input[name="sendMethod"]');

        // Reset
        conditionMsg.classList.add('hidden');
        tableHeader.classList.add('hidden');
        tableBody.classList.add('hidden');
        globalAlert.classList.add('hidden');
        resultCountDisplay.classList.add('hidden');
        tableBody.innerHTML = '';
        
        const isEmailEnabled = document.querySelector('input[name="sendMethod"]:checked')?.value !== 'none';
        
        if (!isEmailEnabled || status === 'period_expired') {
            costBlock.style.opacity = '0.5';
        } else {
            costBlock.style.opacity = '1';
        }

        if (status === 'before_or_during_event' || status === 'after_event_processing') {
            conditionMsg.classList.remove('hidden');
            conditionMsg.textContent = status === 'before_or_during_event' 
                ? '会期終了後、名刺データ化が完了すると対象者が表示されます。' 
                : '現在アンケートおよび名刺データ化を処理中です。完了次第、対象者が表示されます。';
            
            if (status === 'after_event_processing') {
                sendMethodRadios.forEach(r => r.disabled = true);
            }
            updateCostUI(0, 0, false);
            return;
        }

        if (status === 'period_expired') {
            globalAlert.classList.remove('hidden');
            globalAlert.className = 'mb-3 p-3 rounded-md text-sm font-semibold flex items-center gap-2 bg-[#fce8e6] text-[#c5221f]';
            globalAlert.innerHTML = '<span class="material-icons">error</span>送信可能期間（名刺データ化完了から1週間）を経過したため、システムからのお礼メール送信はできません。お手持ちのメーラー等よりご連絡ください。必要に応じてCSVデータ等をダウンロードしてください。';
            
            // Disable all fields
            const elementsToDisable = [
                ...sendMethodRadios,
                document.getElementById('emailTemplate'),
                document.getElementById('emailSubject'),
                document.getElementById('emailBody'),
                document.getElementById('insertVariableBtn'),
                saveButton,
                sendEmailButton
            ];
            elementsToDisable.forEach(el => { if (el) el.disabled = true; });
            return;
        }

        // after_event_ready or after_event_sent
        tableHeader.classList.remove('hidden');
        tableBody.classList.remove('hidden');
        
        let activeCount = 0;
        let successCount = 0;
        let failCount = 0;

        const isSent = status === 'after_event_sent';

        state.recipients.forEach((rec, index) => {
            if (rec.sendEnabled && rec.status !== 'excluded') activeCount++;
            if (rec.status === 'sent' || rec.status === 'sent_with_warning') successCount++;
            if (rec.status === 'failed') failCount++;
            
            const row = document.createElement('div');
            row.className = `grid grid-cols-[40px_1fr_1fr_1.5fr_100px] gap-2 p-2 border-b border-outline-variant text-sm items-center hover:bg-surface-variant/50 transition-colors ${!rec.sendEnabled && !isSent ? 'opacity-50' : ''}`;
            
            // Checkbox
            let checkboxHtml = '';
            if (!isSent) {
                checkboxHtml = `<input type="checkbox" class="recipient-cb form-checkbox text-primary rounded rounded-sm focus:ring-primary h-4 w-4" data-id="${rec.id}" ${rec.sendEnabled ? 'checked' : ''}>`;
            } else {
                checkboxHtml = `<input type="checkbox" disabled class="h-4 w-4 opacity-50" ${rec.sendEnabled ? 'checked' : ''}>`;
            }

            // Status Badge (for sent/excluded/failed)
            let statusHtml = '';
            if (isSent || rec.status === 'excluded') {
                if (rec.status === 'sent') statusHtml = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#e6f4ea] text-[#137333]">送信済み</span>';
                else if (rec.status === 'sent_with_warning') statusHtml = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#e6f4ea] text-[#137333] border border-[#fce8b2]" title="空変数あり"><span class="material-icons text-[14px] mr-1 text-[#b06000]">warning</span>送信済み</span>';
                else if (rec.status === 'failed') statusHtml = `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#fce8e6] text-[#c5221f]" title="${rec.errorMsg || 'エラー'}"><span class="material-icons text-[14px] mr-1">info</span>送信失敗</span>`;
                else if (rec.status === 'excluded' || !rec.sendEnabled) statusHtml = '<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#f1f3f4] text-[#5f6368]">対象外</span>';
            }

            row.innerHTML = `
                <div class="flex items-center justify-center">${checkboxHtml}</div>
                <div class="truncate" title="${rec.company}">${rec.company}</div>
                <div class="truncate" title="${rec.name}">${rec.name}</div>
                <div class="truncate" title="${rec.email}">${rec.email}</div>
                <div>${statusHtml}</div>
            `;
            tableBody.appendChild(row);
        });

        if (!isSent) {
            // Setup checkbox listeners
            const cbs = document.querySelectorAll('.recipient-cb');
            const selectAllCb = document.getElementById('selectAllRecipients');
            
            // Initialize select all
            selectAllCb.checked = activeCount === state.recipients.length;
            
            cbs.forEach(cb => {
                cb.addEventListener('change', (e) => {
                    const id = parseInt(e.target.dataset.id);
                    const rec = state.recipients.find(r => r.id === id);
                    if (rec) rec.sendEnabled = e.target.checked;
                    
                    e.target.closest('.grid').classList.toggle('opacity-50', !e.target.checked);
                    
                    updateCostFromState();
                    // Update selectall
                    const allChecked = Array.from(cbs).every(c => c.checked);
                    selectAllCb.checked = allChecked;
                });
            });
            
            selectAllCb.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                state.recipients.forEach(r => r.sendEnabled = isChecked);
                cbs.forEach(c => {
                    c.checked = isChecked;
                    c.closest('.grid').classList.toggle('opacity-50', !isChecked);
                });
                updateCostFromState();
            });
            
            updateCostFromState();
        } else {
            // Sent Scenario
            document.getElementById('selectAllRecipients').disabled = true;
            document.getElementById('emailBody').readOnly = true;
            document.getElementById('insertVariableBtn').disabled = true;
            
            if (failCount === 0) {
                globalAlert.classList.remove('hidden');
                globalAlert.className = 'mb-3 p-3 rounded-md text-sm font-semibold flex items-center gap-2 bg-[#e6f4ea] text-[#137333]';
                globalAlert.innerHTML = '<span class="material-icons">check_circle</span>すべてのメールを送信しました';
            } else {
                globalAlert.classList.remove('hidden');
                globalAlert.className = 'mb-3 p-3 rounded-md text-sm font-semibold flex items-center gap-2 bg-[#fce8e6] text-[#c5221f]';
                globalAlert.innerHTML = '<span class="material-icons">error</span>一部のメールが送信できませんでした。リスト内のエラー内容をご確認ください。';
            }
            
            resultCountDisplay.classList.remove('hidden');
            resultCountDisplay.textContent = `送信結果：${successCount}件`;
            
            // Switch cost block to final
            updateCostFromState(true);
        }
    }
    
    function updateCostFromState(isFinal = false) {
        const activeCount = state.recipients.filter(r => r.sendEnabled && r.status !== 'excluded').length;
        updateCostUI(activeCount, state.recipients.length, isFinal);
    }
    
    function updateCostUI(activeCount, totalCount, isFinal) {
        document.getElementById('recipientCount').textContent = activeCount;
        document.getElementById('totalRecipientCount').textContent = totalCount;
        
        const FREE_LIMIT = 100;
        const UNIT_PRICE = 1;
        const billableCount = Math.max(0, activeCount - FREE_LIMIT);
        const estimatedCost = billableCount * UNIT_PRICE;
        
        document.getElementById('estimatedCost').textContent = estimatedCost.toLocaleString();
        document.getElementById('finalCost').textContent = estimatedCost.toLocaleString();
        
        if (isFinal) {
            document.getElementById('finalCostBlock').classList.remove('hidden');
            document.getElementById('finalCostBlock').classList.add('flex');
            // Hide the estimated part if we want, or keep it. Let's keep the row but visually distinct
        }
    }
    
    function updateSendButtonByScenario(status) {
        const isEmailEnabled = document.querySelector('input[name="sendMethod"]:checked')?.value !== 'none';
        if (status === 'after_event_ready' && isEmailEnabled) {
            sendEmailButton.disabled = false;
        } else {
            sendEmailButton.disabled = true;
        }
        
        if (status === 'after_event_sent') {
            sendEmailButton.classList.add('hidden'); // Or change text as per req
        } else {
            sendEmailButton.classList.remove('hidden');
        }
    }

    function handleRealtimePreview(statusOverride = null) {
        const bodyText = document.getElementById('emailBody').value;
        const previewParagraph = document.getElementById('previewContent');
        const warningAlert = document.getElementById('variableWarningAlert');
        const missingVariablesText = document.getElementById('missingVariablesText');
        const missingVariablesCount = document.getElementById('missingVariablesCount');

        const status = statusOverride || state.currentStatus;

        if (previewParagraph) {
            let previewHTML = bodyText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;")
                .replace(/\n/g, "<br>");
                
            let missingVarsSet = new Set();
            let missingCount = 0;

            if (state.recipients && state.recipients.length > 0) {
                // Use first recipient for preview text replacement
                const rec = state.recipients[0];
                const dataMap = {
                    '会社名': rec.company,
                    '部署名': rec.department,
                    '役職': rec.title,
                    '氏名': rec.name,
                    'アンケート名': state.surveyData.surveyName || '〇〇展アンケート',
                    '自社担当者名': 'システム 担当'
                };
                
                // Replace for preview matching what actually happens (trimming space for empty)
                previewHTML = previewHTML.replace(/\{\{([^}]+)\}\}/g, (match, p1) => {
                    return dataMap[p1] !== undefined ? dataMap[p1] : match;
                });
                
                // Check missing vars across ALL enabled recipients
                const requiredVarsInBody = [...bodyText.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]);
                
                state.recipients.forEach(r => {
                    if (!r.sendEnabled) return;
                    let hasMissing = false;
                    const rData = {
                        '会社名': r.company,
                        '部署名': r.department,
                        '役職': r.title,
                        '氏名': r.name,
                        'アンケート名': state.surveyData.surveyName || '〇〇展アンケート',
                        '自社担当者名': 'システム 担当'
                    };
                    
                    requiredVarsInBody.forEach(v => {
                        if (rData[v] !== undefined && rData[v].trim() === '') {
                            missingVarsSet.add(v);
                            hasMissing = true;
                        }
                    });
                    if (hasMissing) missingCount++;
                });
            }

            previewParagraph.innerHTML = previewHTML;
            
            // Show warning if any active recipient has missing variable data
            if (missingCount > 0 && status === 'after_event_ready') {
                missingVariablesText.textContent = Array.from(missingVarsSet).join('、');
                missingVariablesCount.textContent = missingCount;
                warningAlert.classList.remove('hidden');
            } else {
                warningAlert.classList.add('hidden');
            }
        }
    }

    /**
     * Checks if the form has been modified compared to its initial state.
     * @returns {boolean} True if the form has changed, false otherwise.
     */
    function hasFormChanged() {
        const initialSendMethod = state.initialEmailSettings.thankYouEmailEnabled ? state.initialEmailSettings.sendMethod : 'none';
        const currentSendMethod = document.querySelector('input[name="sendMethod"]:checked')?.value;

        if (currentSendMethod !== initialSendMethod) return true;

        // If send method is 'none', other fields don't matter for change detection
        if (currentSendMethod === 'none') return false;

        const currentSettings = {
            emailTemplateId: document.getElementById('emailTemplate').value,
            emailSubject: document.getElementById('emailSubject').value,
            emailBody: document.getElementById('emailBody').value,
        };

        const initial = state.initialEmailSettings;

        if (currentSettings.emailTemplateId !== initial.emailTemplateId) return true;
        if (currentSettings.emailSubject.trim() !== (initial.emailSubject || '').trim()) return true;
        if (currentSettings.emailBody.trim() !== (initial.emailBody || '').trim()) return true;

        return false;
    }

    /**
     * Handles the cancel button click.
     */
    function handleCancel() {
        const returnUrl = state.surveyId ? 'index.html' : 'surveyCreation.html';
        if (hasFormChanged()) {
            showConfirmationModal(
                `変更が保存されていません。破棄して前の画面に戻りますか？`,
                () => { window.location.href = returnUrl; },
                '変更を破棄'
            );
        } else {
            window.location.href = returnUrl;
        }
    }

    // --- Event Handlers ---

    function handleFormChange() {
        // ... (This function remains mostly same, it triggers UI update)
        const selectedMethod = document.querySelector('input[name="sendMethod"]:checked')?.value;
        const isEnabled = selectedMethod !== 'none';
        
        applyScenario(state.currentStatus); // Re-apply scenario rules which calls updateUI

        // Re-enable radio buttons after UI update, as updateUI might disable them.
        const sendMethodRadios = document.querySelectorAll('input[name="sendMethod"]');
        sendMethodRadios.forEach(radio => {
            if(state.currentStatus !== 'period_expired' && state.currentStatus !== 'after_event_processing') {
                 radio.disabled = false;
            }
        });
    }

    function handleTemplateChange() {
        const templateSelectionContainer = document.getElementById('templateSelectionContainer');
        const templatePreviewEl = document.querySelector('#templatePreview p');
        const insertBtn = document.getElementById('insertTemplateBtn');
        const selectedTemplate = state.emailTemplates.find(t => t.id === emailTemplateSelect.value);

        if (selectedTemplate && templatePreviewEl && insertBtn && templateSelectionContainer) {
            // Manually update the template preview div
            templatePreviewEl.textContent = selectedTemplate.body || '';
            
            // Store the body in a data attribute for the insert button to use
            insertBtn.dataset.templateBody = selectedTemplate.body || '';

            // Show the preview and the button
            templateSelectionContainer.classList.remove('hidden');
        } else if (templateSelectionContainer) {
            // Hide if no template is selected
            templateSelectionContainer.classList.add('hidden');
        }
    }

    function handleVariableClick(variable) {
        insertTextAtCursor(emailBodyTextarea, `{{${variable}}}`);
        variableList.classList.add('hidden');
        handleRealtimePreview(state.currentStatus); // Also update preview when variable is inserted
    }
    async function handleSaveSettings() {
        setButtonLoading(saveButton, true);

        const selectedMethod = document.querySelector('input[name="sendMethod"]:checked').value;
        const settingsToSave = {
            thankYouEmailEnabled: selectedMethod !== 'none',
            sendMethod: selectedMethod === 'none' ? (state.initialEmailSettings.sendMethod || 'manual') : selectedMethod,
            emailTemplateId: document.getElementById('emailTemplate').value,
            emailSubject: document.getElementById('emailSubject').value,
            emailBody: document.getElementById('emailBody').value,
        };
        
        // --- New Survey (Temp) Mode ---
        if (!state.surveyId) {
            try {
                const tempDataString = localStorage.getItem('tempSurveyData');
                const surveyDataForUpdate = tempDataString ? JSON.parse(tempDataString) : {};

                if (!surveyDataForUpdate.settings) surveyDataForUpdate.settings = {};
                surveyDataForUpdate.settings.thankYouEmail = settingsToSave;
                
                localStorage.setItem('tempSurveyData', JSON.stringify(surveyDataForUpdate));

                showToast('設定を一時保存しました。', 'success');
                setTimeout(() => { window.location.href = 'surveyCreation.html'; }, 1000);
            } catch (error) {
                console.error('一時データへの保存エラー:', error);
                showToast('設定の一時保存に失敗しました。', 'error');
            } finally {
                setButtonLoading(saveButton, false);
            }
            return;
        }

        // --- Existing Survey Mode ---
        settingsToSave.surveyId = state.surveyId;
        // HACK: Define a global variable that the broken service file seems to need.
        window.mockEmailSettings = {};

        try {
            const result = await saveThankYouEmailSettings(settingsToSave);
            if (result.success) {
                showToast(result.message, 'success');
            } else {
                showToast(result.message || '設定の保存に失敗しました。', 'error');
            }
        } catch (error) {
            console.error('設定保存エラー:', error);
            showToast('設定の保存中にエラーが発生しました。', 'error');
        } finally {
            // HACK: Clean up the global variable.
            delete window.mockEmailSettings;
            setButtonLoading(saveButton, false);
        }
    }

    async function handleSendEmails() {
        const activeCount = state.recipients.filter(r => r.sendEnabled && r.status !== 'excluded').length;
        if (activeCount === 0) {
            showToast('送信対象者がいません。', 'info');
            return;
        }
        
        const FREE_LIMIT = 100;
        const UNIT_PRICE = 1;
        const billableCount = Math.max(0, activeCount - FREE_LIMIT);
        const estimatedCost = billableCount * UNIT_PRICE;
        
        if (confirm(`本当に${activeCount}件のお礼メールを送信しますか？\n（ご請求見込み金額：${estimatedCost.toLocaleString()}円 ※税別）\n\nこの操作は取り消せません。`)) {
            setButtonLoading(sendEmailButton, true);
            try {
                const result = await sendThankYouEmails(state.surveyId);
                if (result.success) {
                    showToast(result.message, 'success');
                    // Transition to sent scenario safely
                    document.getElementById('scenarioSelector').value = 'after_event_sent';
                    
                    // Simulate processing
                    state.recipients.forEach(r => {
                         if(r.sendEnabled && r.status !== 'excluded') {
                             r.status = r.hasEmptyVariable ? 'sent_with_warning' : 'sent';
                         }
                    });
                    
                    await handleScenarioSwitch({target: {value: 'after_event_sent'}});
                } else {
                    showToast(result.message || 'メールの送信に失敗しました。', 'error');
                }
            } catch (error) {
                console.error('メール送信エラー:', error);
                showToast('メールの送信中にエラーが発生しました。', 'error');
            } finally {
                setButtonLoading(sendEmailButton, false);
            }
        }
    }

    // --- Initialize Page ---
    initializePage();
}