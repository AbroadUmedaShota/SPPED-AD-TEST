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

            renderSurveyInfo(state.surveyData, state.surveyId);
            populateTemplates(state.emailTemplates);
            populateVariables(state.variables, handleVariableClick);
            setInitialFormValues(state.emailSettings);

            setupEventListeners();
            updateUI(state.emailSettings.thankYouEmailEnabled, state.surveyData);
            updateTemplatePreview(state.emailTemplates.find(t => t.id === state.emailSettings.emailTemplateId));

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
        insertVariableBtn.addEventListener('click', () => variableList.classList.toggle('hidden'));
        saveButton.addEventListener('click', handleSaveSettings);
        sendEmailButton.addEventListener('click', handleSendEmails);
        cancelButton.addEventListener('click', () => {
            if (confirm('変更を破棄してアンケート一覧に戻りますか？')) {
                window.location.href = 'index.html';
            }
        });
    }

    // --- Event Handlers ---

    function handleFormChange() {
        const isEnabled = thankYouEmailEnabledToggle.checked;
        updateUI(isEnabled, state.surveyData);
    }

    function handleTemplateChange() {
        const selectedTemplate = state.emailTemplates.find(t => t.id === emailTemplateSelect.value);
        updateTemplatePreview(selectedTemplate);
    }

    function handleVariableClick(variable) {
        insertTextAtCursor(emailBodyTextarea, `{${variable}}`);
        variableList.classList.add('hidden');
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
