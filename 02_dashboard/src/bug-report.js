const ReportType = {
    Simple: 'Simple',
    Detailed: 'Detailed',
};

const BugCategory = {
    Display: 'Display',
    Functionality: 'Functionality',
    Data: 'Data',
    Error: 'Error',
    Other: 'Other',
};

const Severity = {
    Critical: 'Critical',
    High: 'High',
    Medium: 'Medium',
    Low: 'Low',
};


const REPORT_TYPE_OPTIONS = [
  { value: ReportType.Simple, label: '簡易報告' },
  { value: ReportType.Detailed, label: '詳細報告' },
];

const BUG_CATEGORY_OPTIONS = [
  { value: '', label: '選択してください' },
  { value: BugCategory.Display, label: '表示崩れ' },
  { value: BugCategory.Functionality, label: '機能しない' },
  { value: BugCategory.Data, label: 'データ不整合' },
  { value: BugCategory.Error, label: 'エラーメッセージ表示' },
  { value: BugCategory.Other, label: 'その他' },
];

const SEVERITY_OPTIONS = [
  { value: Severity.Critical, label: '緊急 (サービス停止、データ損失)' },
  { value: Severity.High, label: '高 (主要機能に影響、業務継続困難)' },
  { value: Severity.Medium, label: '中 (一部機能に影響、回避策あり)' },
  { value: Severity.Low, label: '低 (軽微な表示崩れ、改善提案)' },
];

const DEVICE_OPTIONS = [
  { value: '', label: '選択してください' },
  { value: 'pc', label: 'PC' },
  { value: 'smartphone', label: 'スマートフォン' },
  { value: 'tablet', label: 'タブレット' },
  { value: 'other', label: 'その他' },
];

const OS_OPTIONS = [
  { value: '', label: '選択してください' },
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'macOS' },
  { value: 'ios', label: 'iOS' },
  { value: 'android', label: 'Android' },
  { value: 'other', label: 'その他' },
];

const BROWSER_OPTIONS = [
  { value: '', label: '選択してください' },
  { value: 'chrome', label: 'Chrome' },
  { value: 'firefox', label: 'Firefox' },
  { value: 'edge', label: 'Edge' },
  { value: 'safari', label: 'Safari' },
  { value: 'other', label: 'その他' },
];

const AFFECTED_SCREEN_OPTIONS = [
  { value: '', label: '選択してください' },
  { value: 'user_header', label: '--- ユーザー向け画面 ---', disabled: true },
  { value: 'login', label: 'ログイン画面' },
  { value: 'password', label: 'パスワード関連画面' },
  { value: 'user_edit', label: 'アカウント編集画面' },
  { value: 'top', label: 'トップ画面' },
  { value: 'questionnaire_create', label: 'アンケート作成画面' },
  { value: 'questionnaire_answer', label: 'アンケート回答画面' },
  { value: 'questionnaire_confirm', label: 'アンケート回答確認画面' },
  { value: 'thanks', label: 'サンクス画面' },
  { value: 'questionnaire_preview', label: 'アンケートプレビュー画面' },
  { value: 'questionnaire_copy', label: 'アンケートコピー画面' },
  { value: 'bizcard', label: '名刺データ設定画面' },
  { value: 'thanks_mail', label: 'お礼メール設定画面' },
  { value: 'group_create', label: 'グループ作成画面' },
  { value: 'group_setting_done', label: 'グループ設定画面_申し込み完了画面' },
  { value: 'group_join', label: 'グループ参加画面' },
  { value: 'user_admin', label: 'ユーザー管理画面' },
  { value: 'user_admin_add', label: 'ユーザー追加画面' },
  { value: 'terms', label: '利用規約画面' },
  { value: 'tokushou', label: '特定商取引法画面' },
  { value: 'help', label: 'ヘルプ画面' },
  { value: 'admin_header', label: '--- 管理者向け画面 ---', disabled: true },
  { value: 'admin_login', label: '管理者ログイン画面' },
  { value: 'admin_top', label: '管理者トップ画面' },
  { value: 'admin_user_list', label: 'ユーザー一覧画面' },
  { value: 'admin_questionnaire_list', label: 'アンケート一覧画面' },
  { value: 'admin_payment', label: '請求管理画面' },
  { value: 'admin_invoice', label: '請求書画面' },
  { value: 'admin_coupon', label: 'クーポン管理画面' },
  { value: 'admin_calendar', label: '営業日カレンダー管理画面' },
  { value: 'admin_data_input_list', label: 'データ入力一覧画面' },
  { value: 'admin_data_input_screen', label: 'データ入力画面' },
  { value: 'admin_matching_list', label: '照合一覧画面' },
  { value: 'admin_matching_screen', label: '照合画面' },
  { value: 'admin_operator_list', label: 'オペレーター一覧画面' },
  { value: 'admin_achievements', label: '実績画面' },
  { value: 'other', label: 'その他' },
];

const AFFECTED_MODULE_OPTIONS = [
  { value: '', label: '選択してください' },
  { value: 'reporting', label: 'レポート作成' },
  { value: 'campaign_settings', label: 'キャンペーン設定' },
  { value: 'api_integration', label: 'API連携' },
  { value: 'user_management', label: 'ユーザー管理' },
  { value: 'other', label: 'その他' },
];

const GOOGLE_FORM_RESPONSE_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSck94R-6gC24A-a4-3gUhEOHsEq-w4jjNw7lNxrWae0JYSflQ/formResponse';

const GOOGLE_FORM_ENTRY_MAP = {
  reportType: 'entry.380334184',
  bugCategory: 'entry.2115928213',
  bugSummary: 'entry.62193751',
  questionnaireId: 'entry.190511267',
  reproductionSteps: 'entry.1520710833',
  actualBehavior: 'entry.1082578203',
  expectedBehavior: 'entry.213381702',
  errorMessage: 'entry.484776830',
  reporterName: 'entry.908834656',
  reporterEmail: 'entry.1094668055',
  reporterCompany: 'entry.1579476750',
  occurrenceDateTime: 'entry.1132942488',
  device: 'entry.1209857462',
  os: 'entry.1190375092',
  browser: 'entry.1884963090',
  speedAdEnvironment: 'entry.130013099',
  internalProjectId: 'entry.2098474443',
  affectedModule: 'entry.233073011',
  severity: 'entry.304064915',
  internalNotes: 'entry.2135905601',
  assigneeSuggestion: 'entry.677635520',
  deviceName: 'entry.1599683027',
  browserVersion: 'entry.1153774805',
  screenshotFilename: 'entry.1454262670',
  screenshot: 'entry.1559286548',
};

const initialFormData = {
    reportType: ReportType.Simple,
    reporterName: '',
    reporterEmail: '',
    reporterCompany: '',
    occurrenceDate: '',
    occurrenceTime: '',
    device: '',
    deviceName: '',
    deviceOther: '',
    os: '',
    osOther: '',
    browser: '',
    browserVersion: '',
    browserOther: '',
    speedAdEnvironment: '',
    speedAdEnvironmentOther: '',
    bugCategory: '',
    bugSummary: '',
    questionnaireId: '',
    reproductionSteps: '',
    screenshot: '',
    screenshotFilename: '',
    expectedBehavior: '',
    actualBehavior: '',
    hasErrorMessage: false,
    errorMessage: '',
    internalProjectId: '',
    affectedModule: '',
    affectedModuleOther: '',
    severity: '',
    internalNotes: '',
    assigneeSuggestion: '',
};

let formData = { ...initialFormData };

function populateSelect(selectId, options) {
    const select = document.getElementById(selectId);
    if (!select) return;
    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.label;
        if (opt.disabled) {
            option.disabled = true;
        }
        select.appendChild(option);
    });
}

function createRadioGroup(groupId, name, options, selectedValue) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.innerHTML = '';
    options.forEach(opt => {
        const isChecked = opt.value === selectedValue;
        const div = document.createElement('div');
        div.className = 'flex items-center';
        div.innerHTML = `
            <input id="${name}-${opt.value}" name="${name}" type="radio" value="${opt.value}" ${isChecked ? 'checked' : ''} class="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500">
            <label for="${name}-${opt.value}" class="ml-3 block text-sm font-medium text-slate-700">${opt.label}</label>
        `;
        group.appendChild(div);
    });
}

function updateReportTypeDescription() {
    const descriptionEl = document.getElementById('reportType-description');
    if (formData.reportType === ReportType.Simple) {
        descriptionEl.textContent = '「簡易報告」では、必要最低限の情報で素早く報告できます。';
    } else {
        descriptionEl.textContent = '「詳細報告」では、発生環境や期待される動作など、より詳細な情報を提供いただけます。';
    }
}

function toggleDetailedSection() {
    const detailedSection = document.getElementById('detailed-report-section');
    if (formData.reportType === ReportType.Detailed) {
        detailedSection.classList.remove('hidden');
    } else {
        detailedSection.classList.add('hidden');
    }
}

function clearDetailedFields() {
    const detailedFields = [
        'reporterName', 'reporterEmail', 'reporterCompany',
        'occurrenceDate', 'occurrenceTime', 'device', 'deviceOther',
        'os', 'osOther', 'browser', 'browserOther',
        'speedAdEnvironment', 'speedAdEnvironmentOther',
        'expectedBehavior', 'errorMessage',
        'internalProjectId', 'affectedModule', 'affectedModuleOther',
        'severity', 'internalNotes', 'assigneeSuggestion',
        'deviceName', 'browserVersion', 'screenshot', 'screenshotFilename',
    ];
    detailedFields.forEach(field => {
        formData[field] = initialFormData[field];
        const el = document.getElementById(field);
        if (el) {
            if (el.type === 'checkbox') el.checked = false;
            else el.value = '';
        }
    });
    formData.hasErrorMessage = false;
    document.getElementById('hasErrorMessage').checked = false;
    
    // Also clear UI state for dependent fields
    ['device', 'os', 'browser', 'speedAdEnvironment', 'affectedModule'].forEach(f => {
        const otherWrapper = document.getElementById(`${f}Other-wrapper`);
        if(otherWrapper) otherWrapper.classList.add('hidden');
    });
    const errorMessageWrapper = document.getElementById('errorMessage-wrapper');
    if(errorMessageWrapper) errorMessageWrapper.classList.add('hidden');
    clearScreenshot();
}

function handleInputChange(e) {
    const { name, value, type, checked } = e.target;
    
    const oldReportType = formData.reportType;

    if (type === 'checkbox') {
        formData[name] = checked;
    } else {
        formData[name] = value;
    }

    // Handle conditional fields
    if (name === 'reportType') {
        if (value === ReportType.Simple && oldReportType === ReportType.Detailed) {
            clearDetailedFields();
        }
        toggleDetailedSection();
        updateReportTypeDescription();
    }
    if (name === 'hasErrorMessage') {
        document.getElementById('errorMessage-wrapper').classList.toggle('hidden', !checked);
        if(!checked) formData.errorMessage = '';
    }
    if (['device', 'os', 'browser', 'speedAdEnvironment', 'affectedModule'].includes(name)) {
        const otherWrapper = document.getElementById(`${name}Other-wrapper`);
        if (otherWrapper) {
            otherWrapper.classList.toggle('hidden', value !== 'other');
        }
        if (value !== 'other') {
            formData[`${name}Other`] = '';
            const otherInput = document.getElementById(`${name}Other`);
            if(otherInput) otherInput.value = '';
        }
    }
}

function handleFileChange(e) {
    const file = e.target.files?.[0];
    const errorEl = document.getElementById('screenshot-error');
    hideError('screenshot');

    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError('screenshot', 'ファイルサイズは5MBを超えることはできません。');
        e.target.value = '';
        return;
    }

    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type)) {
        showError('screenshot', 'PNG, JPG, GIF形式の画像のみアップロードできます。');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        formData.screenshot = reader.result;
        formData.screenshotFilename = file.name;
        document.getElementById('screenshot-filename').textContent = file.name;
        document.getElementById('screenshot-dropzone').classList.add('hidden');
        document.getElementById('screenshot-preview').classList.remove('hidden');
    };
    reader.onerror = () => {
        showError('screenshot', 'ファイルの読み込みに失敗しました。');
    }
    reader.readAsDataURL(file);
}

function clearScreenshot() {
    formData.screenshot = '';
    formData.screenshotFilename = '';
    const fileInput = document.getElementById('screenshot-upload');
    if (fileInput) fileInput.value = '';
    document.getElementById('screenshot-dropzone').classList.remove('hidden');
    document.getElementById('screenshot-preview').classList.add('hidden');
    document.getElementById('screenshot-filename').textContent = '';
    hideError('screenshot');
}

function showError(field, message) {
    const errorEl = document.getElementById(`${field}-error`);
    const fieldEl = document.getElementById(field);
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
    if (fieldEl) {
        fieldEl.classList.add('form-field-error');
    }
}

function hideError(field) {
    const errorEl = document.getElementById(`${field}-error`);
    const fieldEl = document.getElementById(field);
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
    if (fieldEl) {
        fieldEl.classList.remove('form-field-error');
    }
}

function hideAllErrors() {
    Object.keys(initialFormData).forEach(field => hideError(field));
    hideError('form');
}

function validateForm() {
    hideAllErrors();
    let isValid = true;

    if (!formData.bugCategory) {
        showError('bugCategory', '不具合の種別は必須です。');
        isValid = false;
    }
    if (!formData.bugSummary.trim()) {
        showError('bugSummary', '不具合の概要は必須です。');
        isValid = false;
    }
    if (!formData.reproductionSteps.trim()) {
        showError('reproductionSteps', '再現手順は必須です。');
        isValid = false;
    }
    if (!formData.actualBehavior.trim()) {
        showError('actualBehavior', '実際の動作は必須です。');
        isValid = false;
    }
    
    if (formData.reportType === ReportType.Detailed) {
        if (!formData.expectedBehavior.trim()) {
            showError('expectedBehavior', '期待される動作は必須です。');
            isValid = false;
        }
        if (formData.hasErrorMessage && !formData.errorMessage.trim()) {
            showError('errorMessage', 'エラーメッセージの内容を記載してください。');
            isValid = false;
        }
        if (formData.device === 'other' && !formData.deviceOther.trim()) {
            showError('deviceOther', '利用デバイスを具体的に入力してください。');
            isValid = false;
        }
        if (formData.os === 'other' && !formData.osOther.trim()) {
            showError('osOther', 'OSを具体的に入力してください。');
            isValid = false;
        }
        if (formData.browser === 'other' && !formData.browserOther.trim()) {
            showError('browserOther', 'ブラウザ名を具体的に入力してください。');
            isValid = false;
        }
        if (formData.speedAdEnvironment === 'other' && !formData.speedAdEnvironmentOther.trim()) {
            showError('speedAdEnvironmentOther', '利用画面を具体的に入力してください。');
            isValid = false;
        }
        if (formData.affectedModule === 'other' && !formData.affectedModuleOther.trim()) {
            showError('affectedModuleOther', '影響を受けるモジュール/機能を具体的に入力してください。');
            isValid = false;
        }
    }
    
    return isValid;
}

function handleSubmit(e) {
    e.preventDefault();
    if (!validateForm()) {
        showError('form', '入力内容にエラーがあります。各項目をご確認ください。');
        document.getElementById('form-error').textContent = '入力内容にエラーがあります。各項目をご確認ください。';
        document.getElementById('form-error').classList.remove('hidden');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    const btnText = document.getElementById('submit-btn-text');
    const btnSpinner = document.getElementById('submit-btn-spinner');

    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnSpinner.classList.remove('hidden');
    hideError('form');

    const iframeName = `hidden_iframe_${new Date().getTime()}`;
    const iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.id = iframeName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.action = GOOGLE_FORM_RESPONSE_URL;
    form.method = 'POST';
    form.target = iframeName;
    
    const appendInput = (name, value) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
    };

    const appendParam = (key, value) => {
        if (typeof value === 'string' && value && GOOGLE_FORM_ENTRY_MAP[key]) {
            appendInput(GOOGLE_FORM_ENTRY_MAP[key], value);
        }
    };

    const getSelectValueAsText = (fieldKey, otherFieldKey, options) => {
        const value = formData[fieldKey];
        if (value === 'other') {
            return formData[otherFieldKey];
        }
        const option = options.find(o => o.value === value);
        return option ? option.label : '';
    };

    const reportTypeLabel = REPORT_TYPE_OPTIONS.find(o => o.value === formData.reportType)?.label;
    appendParam('reportType', reportTypeLabel || formData.reportType);

    const bugCategoryLabel = BUG_CATEGORY_OPTIONS.find(o => o.value === formData.bugCategory)?.label;
    appendParam('bugCategory', bugCategoryLabel || formData.bugCategory);
    
    appendParam('bugSummary', formData.bugSummary);
    appendParam('questionnaireId', formData.questionnaireId);
    appendParam('reproductionSteps', formData.reproductionSteps);
    appendParam('actualBehavior', formData.actualBehavior);

    if (formData.reportType === ReportType.Detailed) {
        appendParam('reporterName', formData.reporterName);
        appendParam('reporterEmail', formData.reporterEmail);
        appendParam('reporterCompany', formData.reporterCompany);

        if (formData.occurrenceDate && formData.occurrenceTime) {
            appendParam('occurrenceDateTime', `${formData.occurrenceDate} ${formData.occurrenceTime}`);
        } else if (formData.occurrenceDate) {
            appendParam('occurrenceDateTime', formData.occurrenceDate);
        } else {
             appendParam('occurrenceDateTime', '');
        }

        appendParam('device', getSelectValueAsText('device', 'deviceOther', DEVICE_OPTIONS));
        appendParam('deviceName', formData.deviceName);
        appendParam('os', getSelectValueAsText('os', 'osOther', OS_OPTIONS));
        const browserText = getSelectValueAsText('browser', 'browserOther', BROWSER_OPTIONS);
        appendParam('browser', browserText);
        appendParam('browserVersion', formData.browserVersion);
        appendParam('speedAdEnvironment', getSelectValueAsText('speedAdEnvironment', 'speedAdEnvironmentOther', AFFECTED_SCREEN_OPTIONS));
        
        appendParam('expectedBehavior', formData.expectedBehavior);
        
        appendParam('errorMessage', formData.hasErrorMessage ? formData.errorMessage : '');

        appendParam('screenshot', formData.screenshot);
        appendParam('screenshotFilename', formData.screenshotFilename);
        
        appendParam('internalProjectId', formData.internalProjectId);
        
        appendParam('affectedModule', getSelectValueAsText('affectedModule', 'affectedModuleOther', AFFECTED_MODULE_OPTIONS));

        const severityLabel = SEVERITY_OPTIONS.find(o => o.value === formData.severity)?.label;
        appendParam('severity', severityLabel || formData.severity);
        
        appendParam('internalNotes', formData.internalNotes);
        appendParam('assigneeSuggestion', formData.assigneeSuggestion);
    }
    
    document.body.appendChild(form);

    const timeout = setTimeout(() => {
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
        showError('form', '送信がタイムアウトしました。インターネット接続を確認し、再度お試しください。');
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        if (document.body.contains(form)) document.body.removeChild(form);
    }, 15000);

    iframe.onload = () => {
        clearTimeout(timeout);
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnSpinner.classList.add('hidden');
        document.getElementById('form-container').classList.add('hidden');
        document.getElementById('success-message').classList.remove('hidden');
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        if (document.body.contains(form)) document.body.removeChild(form);
    };
    
    form.submit();
}

function resetForm() {
    formData = { ...initialFormData };
    document.getElementById('bugReportForm').reset();
    hideAllErrors();
    
    // Reset UI state
    toggleDetailedSection();
    updateReportTypeDescription();
    clearScreenshot();
    
    document.getElementById('form-container').classList.remove('hidden');
    document.getElementById('success-message').classList.add('hidden');
    
    // Re-initialize radio buttons to default state
    createRadioGroup('reportType-group', 'reportType', REPORT_TYPE_OPTIONS, formData.reportType);
    createRadioGroup('severity-group', 'severity', SEVERITY_OPTIONS, formData.severity);
    
    // Re-add event listeners for the new radio buttons
    document.querySelectorAll('input[name="reportType"]').forEach(radio => {
        radio.addEventListener('change', handleInputChange);
    });
    document.querySelectorAll('input[name="severity"]').forEach(radio => {
        radio.addEventListener('change', handleInputChange);
    });
}

export function initBugReportPage() {
    if (document.body.dataset.pageId !== 'bug-report') return;

    // Populate select options
    populateSelect('bugCategory', BUG_CATEGORY_OPTIONS);
    populateSelect('device', DEVICE_OPTIONS);
    populateSelect('os', OS_OPTIONS);
    populateSelect('browser', BROWSER_OPTIONS);
    populateSelect('speedAdEnvironment', AFFECTED_SCREEN_OPTIONS);
    populateSelect('affectedModule', AFFECTED_MODULE_OPTIONS);

    // Create radio buttons
    createRadioGroup('reportType-group', 'reportType', REPORT_TYPE_OPTIONS, formData.reportType);
    createRadioGroup('severity-group', 'severity', SEVERITY_OPTIONS, formData.severity);

    // Set initial UI state
    updateReportTypeDescription();
    toggleDetailedSection();

    // Add event listeners
    const formEl = document.getElementById('bugReportForm');
    formEl.addEventListener('submit', handleSubmit);

    const inputs = formEl.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type === 'radio') { // Radio buttons are handled separately
             input.addEventListener('change', handleInputChange);
        } else {
            input.addEventListener('input', handleInputChange);
        }
    });
    
    document.getElementById('screenshot-upload').addEventListener('change', handleFileChange);
    document.getElementById('clear-screenshot-btn').addEventListener('click', clearScreenshot);
    document.getElementById('new-report-btn').addEventListener('click', resetForm);
}
