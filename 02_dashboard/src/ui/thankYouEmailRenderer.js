/**
 * @file thankYouEmailRenderer.js
 * お礼メール設定画面のUI描画と更新を扱うモジュール
 */

// DOM要素をこのモジュール内で管理
const dom = {};

/**
 * レンダラーに必要なDOM要素をキャッシュします。
 */
function cacheDOMElements() {
    dom.pageTitle = document.getElementById('pageTitle');
    dom.surveyNameDisplay = document.getElementById('surveyNameDisplay');
    dom.surveyIdDisplay = document.getElementById('surveyIdDisplay');
    dom.surveyPeriodDisplay = document.getElementById('surveyPeriodDisplay');
    dom.thankYouEmailEnabledToggle = document.getElementById('thankYouEmailEnabledToggle');
    dom.thankYouEmailEnabledStatus = document.getElementById('thankYouEmailEnabledStatus');
    dom.thankYouEmailSettingsFields = document.getElementById('thankYouEmailSettingsFields');
    dom.emailTemplateSelect = document.getElementById('emailTemplate');
    dom.templatePreview = document.getElementById('templatePreview');
    dom.emailSubjectInput = document.getElementById('emailSubject');
    dom.emailBodyTextarea = document.getElementById('emailBody');
    dom.variableList = document.getElementById('variableList');
    dom.recipientListDiv = document.getElementById('recipientList');
    dom.sendEmailButton = document.getElementById('sendThankYouEmailBtn');
    dom.saveButton = document.getElementById('saveThankYouEmailSettingsBtn');
}

/**
 * アンケート情報をページに描画します。
 * @param {object} surveyData - アンケートデータ。
 * @param {string} surveyId - アンケートID。
 */
export function renderSurveyInfo(surveyData, surveyId) {
    if (!dom.pageTitle) cacheDOMElements();
    document.getElementById('surveyNameInTitle').textContent = surveyData.surveyName;
    dom.surveyNameDisplay.textContent = surveyData.surveyName;
    dom.surveyIdDisplay.textContent = surveyId;
    dom.surveyPeriodDisplay.textContent = `${surveyData.periodStart} - ${surveyData.periodEnd}`;
}

/**
 * 設定フォームの初期値を設定します。
 * @param {object} settings - 設定データ。
 */
export function setInitialFormValues(settings) {
    if (!dom.thankYouEmailEnabledToggle) cacheDOMElements();
    dom.thankYouEmailEnabledToggle.checked = settings.thankYouEmailEnabled;
    document.querySelector(`input[name="sendMethod"][value="${settings.sendMethod}"]`).checked = true;
    dom.emailTemplateSelect.value = settings.emailTemplateId;
    dom.emailSubjectInput.value = settings.emailSubject;
    dom.emailBodyTextarea.value = settings.emailBody;
}

/**
 * メールテンプレートの選択肢を描画します。
 * @param {Array<object>} templates - テンプレートの配列。
 */
export function populateTemplates(templates) {
    if (!dom.emailTemplateSelect) cacheDOMElements();
    dom.emailTemplateSelect.innerHTML = '';
    templates.forEach(template => {
        const option = document.createElement('option');
        option.value = template.id;
        option.textContent = template.name;
        dom.emailTemplateSelect.appendChild(option);
    });
}

/**
 * 挿入可能な変数のリストを描画します。
 * @param {Array<string>} variables - 変数名の配列。
 * @param {function} onVariableClick - 変数がクリックされたときのコールバック。
 */
export function populateVariables(variables, onVariableClick) {
    if (!dom.variableList) cacheDOMElements();
    dom.variableList.innerHTML = '';
    variables.forEach(variable => {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'block px-4 py-2 text-sm text-on-surface hover:bg-surface-variant';
        item.textContent = `{${variable}}`;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            onVariableClick(variable);
        });
        dom.variableList.appendChild(item);
    });
}

/**
 * UI全体の表示状態を更新します。
 * @param {boolean} isEnabled - お礼メールが有効かどうか。
 * @param {object} surveyData - アンケートの状態データ。
 */
export function updateUI(isEnabled, surveyData) {
    if (!dom.thankYouEmailEnabledToggle) cacheDOMElements();
    dom.thankYouEmailEnabledStatus.textContent = isEnabled ? '有効' : '無効';
    dom.thankYouEmailSettingsFields.style.display = isEnabled ? 'block' : 'none';
    if (isEnabled) {
        updateRecipientList(surveyData);
        updateSendButtonState(surveyData);
    }
}

/**
 * テンプレートプレビューを更新します。
 * @param {object} template - 選択されたテンプレート。
 */
export function updateTemplatePreview(template) {
    if (!dom.templatePreview) cacheDOMElements();
    if (template) {
        dom.templatePreview.innerHTML = `<h4 class="font-bold mb-2 text-on-surface-variant">テンプレートプレビュー</h4><p class="text-on-surface-variant whitespace-pre-wrap">${template.body}</p>`;
        dom.emailSubjectInput.value = template.subject;
        dom.emailBodyTextarea.value = template.body;
    }
}

function updateRecipientList(surveyData) {
    if (!surveyData.isEventFinished || !surveyData.isBizcardDataReady) {
        dom.recipientListDiv.innerHTML = '<p class="text-on-surface-variant">会期終了後、名刺データ化が完了すると対象者が表示されます。</p>';
    } else {
        dom.recipientListDiv.innerHTML = `<p class="font-semibold">送信対象者: <span class="text-primary text-lg">${surveyData.recipientCount}</span> 件</p>`;
    }
}

function updateSendButtonState(surveyData) {
    const selectedMethod = document.querySelector('input[name="sendMethod"]:checked').value;
    const conditionsMet = selectedMethod === 'manual' &&
                          surveyData.isEventFinished &&
                          surveyData.isBizcardDataReady &&
                          surveyData.recipientCount > 0;
    dom.sendEmailButton.disabled = !conditionsMet;
}

/**
 * ボタンのローディング状態を切り替えます。
 * @param {HTMLButtonElement} button - 対象のボタン。
 * @param {boolean} isLoading - ローディング中かどうか。
 */
export function setButtonLoading(button, isLoading) {
    if (!button) return;
    const textSpan = button.querySelector('span:not(.material-icons)');
    const loadingIcon = button.querySelector('.material-icons');
    button.disabled = isLoading;
    if (textSpan) textSpan.classList.toggle('hidden', isLoading);
    if (loadingIcon) loadingIcon.classList.toggle('hidden', !isLoading);
}
