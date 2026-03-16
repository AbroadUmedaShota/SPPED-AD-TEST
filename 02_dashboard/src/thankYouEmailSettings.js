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
    setupPaginationListeners,
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
        currentStatus: 'after_event_ready',
        pagination: {
            currentPage: 1,
            itemsPerPage: 20
        }
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
        const closeBtn = document.getElementById('closeEstimateSidebarBtn');

        if (!sidebar || !toggleBtn) {
            return;
        }

        // アニメーション用のクラスを追加
        sidebar.classList.add('transition-all', 'duration-500', 'ease-in-out', 'transform');

        const applySidebarState = () => {
            // 被り防止：コンテンツエリア(max-w-1024px)の右端 + サイドバー幅 + バッファ が画面幅に収まるか動的に判定
            // ※ main-content は flex-1 で画面幅いっぱいになるので、実際のコンテンツ幅基準の main-container を使用
            const mainContainer = document.getElementById('main-container');
            const sidebarWidth = sidebar.offsetWidth || 350;
            const BUFFER = 16; // 余白バッファ（px）

            let mainRight = 0;
            if (mainContainer) {
                const mainRect = mainContainer.getBoundingClientRect();
                // コンテンツエリアのright端（画面左端からの距離）
                mainRight = mainRect.right;
            }

            // 画面右端からメイン右端までの残りスペース
            const availableSpace = window.innerWidth - mainRight;
            const hasEnoughSpace = availableSpace >= sidebarWidth + BUFFER;

            if (!hasEnoughSpace) {
                // スペース不足: サイドバーを右に隠す
                sidebar.classList.add('translate-x-full', 'opacity-0', 'pointer-events-none');
                sidebar.classList.remove('translate-x-0', 'opacity-100');
                sidebar.style.right = '';
            } else {
                // スペース十分: 余白の中央に配置
                const rightOffset = (availableSpace - sidebarWidth) / 2;
                sidebar.style.right = Math.max(0, rightOffset) + 'px';
                sidebar.classList.remove('hidden', 'translate-x-full', 'opacity-0', 'pointer-events-none');
                sidebar.classList.add('fixed', 'translate-x-0', 'opacity-100');
            }
        };

        // ウィンドウリサイズ時にも適用
        window.addEventListener('resize', applySidebarState);

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebar.classList.add('translate-x-full', 'opacity-0');
            });
        }

        // 初期実行
        applySidebarState();
    }

    async function handleScenarioSwitch(e) {
        state.currentStatus = e.target.value;
        
        // デモ用：送信完了シナリオに切り替えた際、ステータスをランダムに割り振る
        if (state.currentStatus === 'after_event_sent') {
            state.recipients.forEach((r, index) => {
                if (!r.sendEnabled) {
                    r.status = 'excluded';
                } else {
                    // 90%成功、5%警告、5%失敗の割合でシミュレート
                    const rand = Math.random();
                    if (rand < 0.90) r.status = 'sent';
                    else if (rand < 0.95) r.status = 'sent_with_warning';
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
        if (state.recipients.length === 0 && (status === 'after_event_ready' || status === 'after_event_sent')) {
            state.recipients = await getRecipientsData(state.surveyId);
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

        if (status === 'before_or_during_event' || status === 'after_event_processing') {
            if (conditionMsg) {
                conditionMsg.classList.remove('hidden');
                const msg = conditionMsg.querySelector('p');
                if (msg) msg.textContent = status === 'before_or_during_event' 
                    ? '会期終了後、名刺データ化が完了すると対象者が表示されます。' 
                    : '現在アンケートおよび名刺データ化を処理中です。完了次第、対象者が表示されます。';
            }
            updateCostUI(0, 0, status);
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
            updateCostUI(0, 0, status);
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
                const successCount = state.recipients.filter(r => r.status === 'sent' || r.status === 'sent_with_warning').length;
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
        
        // ページ移動時にテーブルトップへスクロール（親切設計！）
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
        updateCostUI(activeCount, state.recipients.length, state.currentStatus);
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
        const warningAlert = document.getElementById('variableWarningAlert');
        const missingVarsSpan = document.getElementById('missingVariablesText');
        const missingCountSpan = document.getElementById('missingVariablesCount');

        const status = statusOverride || state.currentStatus;

        if (!previewBody || !previewSubject) return;

        let previewHTML = bodyText
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
            
        let missingVarsSet = new Set();
        let missingCount = 0;

        // 宛先データがある場合は1件目のデータを使用、ない場合はプレースホルダーを使用
        const rec = (state.recipients && state.recipients.length > 0) ? state.recipients[0] : null;
        
        const repName = window.dummyUserData 
            ? `${window.dummyUserData.lastName || ''} ${window.dummyUserData.firstName || ''}`.trim()
            : '';
            
        const dataMap = {
            '会社名': rec?.company || '（株式会社サンプル）',
            '部署名': rec?.department || '（営業部）',
            '役職': rec?.title || '（課長）',
            '氏名': rec?.name || '（山田 太郎）',
            'アンケート名': state.surveyData?.name?.ja || state.surveyData?.surveyName || '（展示会名）',
            '自社担当者名': repName || '（担当者名）'
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

        // 未設定項目のチェック (送信待機中のみ)
        if (status === 'after_event_ready' && state.recipients.length > 0) {
            const varsInBody = [...`${subjectText} ${bodyText}`.matchAll(/\{\{([^}]+)\}\}/g)].map(m => m[1]);
            state.recipients.forEach(r => {
                if (!r.sendEnabled) return;
                let hasMissing = false;
                varsInBody.forEach(v => {
                    const key = v === '会社名' ? 'company' : v === '氏名' ? 'name' : v === '部署名' ? 'department' : v === '役職' ? 'title' : '';
                    if (key && (r[key] === undefined || r[key] === null || r[key].trim() === '')) {
                        missingVarsSet.add(v);
                        hasMissing = true;
                    }
                });
                if (hasMissing) missingCount++;
            });
        }

        previewSubject.innerHTML = subjectHTML || '<span class="text-on-surface-variant/50 font-normal">（件名が未入力です）</span>';
        previewBody.innerHTML = previewHTML;
        
        if (missingCount > 0 && warningAlert) {
            missingVarsSpan.textContent = Array.from(missingVarsSet).join('、');
            missingCountSpan.textContent = missingCount;
            warningAlert.classList.remove('hidden');
        } else if (warningAlert) {
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

    function handleSendEmails() {
        const activeCount = state.recipients.filter(r => r.sendEnabled).length;
        if (activeCount === 0) return showToast('送信対象がいません。', 'info');

        const FREE_LIMIT = 100;
        const billableCount = Math.max(0, activeCount - FREE_LIMIT);
        const cost = billableCount * 1;

        document.getElementById('modalActiveCount').textContent = activeCount;
        document.getElementById('modalCost').textContent = `¥${cost.toLocaleString()}`;
        document.getElementById('sendConfirmModal').classList.remove('hidden');
    }

    async function executeSendEmails() {
        const sendConfirmExecuteBtn = document.getElementById('sendConfirmExecuteBtn');
        const defaultText = sendConfirmExecuteBtn.querySelector('span:not(.material-icons)').textContent;
        
        // ボタンのテキストを送信中に変更し、ローディング状態に
        sendConfirmExecuteBtn.querySelector('span:not(.material-icons)').textContent = '送信中...';
        setButtonLoading(sendConfirmExecuteBtn, true);
        
        try {
            await sendThankYouEmails(state.surveyId);
        } catch (e) {
            // モック用：APIからエラーが返っても、フロントでは成功扱いにする
            console.warn('API error ignored for mock demonstration:', e);
        }
        
        // モック用の意図的なタイムラグ（送信中の通信状態を演出）
        await new Promise(resolve => setTimeout(resolve, 2000));

        showToast('送信を開始しました。', 'success');
        state.currentStatus = 'after_event_sent';
        
        // 成功したていでステータスを更新する
        state.recipients.forEach(r => {
            if (!r.sendEnabled) {
                r.status = 'excluded';
            } else {
                const rand = Math.random();
                if (rand < 0.90) r.status = 'sent';
                else if (rand < 0.95) r.status = 'sent_with_warning';
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
