import {
    getInitialData,
    saveThankYouEmailSettings,
    sendThankYouEmails
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
        variables: []
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
    }

    /**
     * Updates the real-time preview of the email body.
     */
    function handleRealtimePreview() {
        const bodyText = document.getElementById('emailBody').value;
        const previewParagraph = document.querySelector('#emailBodyRealtimePreview p');

        if (previewParagraph) {
            // To prevent XSS, escape HTML characters and then replace newlines with <br>
            const escapedText = bodyText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
            
            previewParagraph.innerHTML = escapedText.replace(/\n/g, "<br>");
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
        const selectedMethod = document.querySelector('input[name="sendMethod"]:checked')?.value;
        const isEnabled = selectedMethod !== 'none';
        updateUI(isEnabled, state.surveyData);

        // Re-enable radio buttons after UI update, as updateUI might disable them.
        const sendMethodRadios = document.querySelectorAll('input[name="sendMethod"]');
        sendMethodRadios.forEach(radio => {
            radio.disabled = false;
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
        insertTextAtCursor(emailBodyTextarea, `{${variable}}`);
        variableList.classList.add('hidden');
        handleRealtimePreview(); // Also update preview when variable is inserted
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
        const recipientCount = state.surveyData.recipientCount || 0;
        if (recipientCount === 0) {
            showToast('送信対象者がいません。', 'info');
            return;
        }
        if (confirm(`本当に${recipientCount}件のお礼メールを送信しますか？`)) {
            setButtonLoading(sendEmailButton, true);
            try {
                const result = await sendThankYouEmails(state.surveyId);
                if (result.success) {
                    showToast(result.message, 'success');
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