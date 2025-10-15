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
    const thankYouEmailEnabledToggle = document.getElementById('thankYouEmailEnabledToggle');
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

        if (!state.surveyId) {
            document.getElementById('pageTitle').textContent = 'アンケートIDが見つかりません';
            showToast('有効なアンケートIDが指定されていません。', 'error');
            return;
        }

        try {
            const initialData = await getInitialData(state.surveyId);
            state = { ...state, ...initialData };

            // Deep copy for initial state comparison
            state.initialEmailSettings = JSON.parse(JSON.stringify(state.emailSettings));

            renderSurveyInfo(state.surveyData, state.surveyId);
            populateTemplates(state.emailTemplates);
            populateVariables(state.variables, handleVariableClick);
            setInitialFormValues(state.emailSettings);

            setupEventListeners();
            updateUI(state.emailSettings.thankYouEmailEnabled, state.surveyData);
            updateTemplatePreview(state.emailTemplates.find(t => t.id === state.emailSettings.emailTemplateId));
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
        thankYouEmailEnabledToggle.addEventListener('change', handleFormChange);
        sendMethodRadios.forEach(radio => radio.addEventListener('change', handleFormChange));
        emailTemplateSelect.addEventListener('change', handleTemplateChange);
        document.getElementById('emailBody').addEventListener('input', handleRealtimePreview);
        insertVariableBtn.addEventListener('click', () => variableList.classList.toggle('hidden'));
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
        const currentSettings = {
            thankYouEmailEnabled: thankYouEmailEnabledToggle.checked,
            sendMethod: document.querySelector('input[name="sendMethod"]:checked')?.value,
            emailTemplateId: document.getElementById('emailTemplate').value,
            emailSubject: document.getElementById('emailSubject').value,
            emailBody: document.getElementById('emailBody').value,
        };

        const initial = state.initialEmailSettings;

        if (currentSettings.thankYouEmailEnabled !== initial.thankYouEmailEnabled) return true;
        if (currentSettings.sendMethod !== initial.sendMethod) return true;
        if (currentSettings.emailTemplateId !== initial.emailTemplateId) return true;
        if (currentSettings.emailSubject.trim() !== (initial.emailSubject || '').trim()) return true;
        if (currentSettings.emailBody.trim() !== (initial.emailBody || '').trim()) return true;

        return false;
    }

    /**
     * Handles the cancel button click.
     */
    function handleCancel() {
        if (hasFormChanged()) {
            showConfirmationModal(
                '変更が保存されていません。破棄してアンケート一覧に戻りますか？',
                () => { window.location.href = 'index.html'; },
                '変更を破棄'
            );
        } else {
            window.location.href = 'index.html';
        }
    }

    // --- Event Handlers ---

    function handleFormChange() {
        const isEnabled = thankYouEmailEnabledToggle.checked;
        updateUI(isEnabled, state.surveyData);
    }

    function handleTemplateChange() {
        const selectedTemplate = state.emailTemplates.find(t => t.id === emailTemplateSelect.value);
        updateTemplatePreview(selectedTemplate);
        handleRealtimePreview(); // Also update preview when template changes
    }

    function handleVariableClick(variable) {
        insertTextAtCursor(emailBodyTextarea, `{${variable}}`);
        variableList.classList.add('hidden');
        handleRealtimePreview(); // Also update preview when variable is inserted
    }
    async function handleSaveSettings() {
        setButtonLoading(saveButton, true);
        const settingsToSave = {
            surveyId: state.surveyId,
            thankYouEmailEnabled: thankYouEmailEnabledToggle.checked,
            sendMethod: document.querySelector('input[name="sendMethod"]:checked').value,
            emailTemplateId: document.getElementById('emailTemplate').value,
            emailSubject: document.getElementById('emailSubject').value,
            emailBody: document.getElementById('emailBody').value,
        };

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