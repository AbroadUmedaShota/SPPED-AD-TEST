export function initCalendarManagementPage() {
    const state = {
        currentDate: new Date(),
        holidays: {},
        manualSettings: [],
        updateLog: [],
        surveys: [],
        operators: [],
        manualSettingsCurrentPage: 1,
        manualSettingsItemsPerPage: 5,
        logCurrentPage: 1,
        logItemsPerPage: 7,
        settingToDeleteId: null,
    };

    // Declare variables for DOM elements
    let calendarTitle, calendarGrid, prevMonthButton, nextMonthButton, manualSettingsList,
        settingPageInfo, settingPrevButton, settingNextButton, updateLogList, logPageInfo,
        logPrevButton, logNextButton, kpiHolidays, kpiSubstituteWorkdays, kpiSlaAlerts,
        modal, modalContainer, modalDateDisplay, closeModalButton, cancelButton,
        cancelAssignmentButton, tabBtnSettings, tabBtnAssignment, tabContentSettings,
        tabContentAssignment, settingForm, settingIdInput, eventDateInput, reasonInput,
        eventDateError, reasonError, assignmentForm, assignmentSurveySelect,
        assignmentCompanyDisplay, confirmationModal, confirmationModalContainer,
        confirmationModalMessage, closeConfirmationModalButton, deleteConfirmModal,
        deleteConfirmModalContainer, cancelDeleteButton, confirmDeleteButton;


    // --- Data Fetching ---
    async function fetchData() {
        try {
            const [holidaysRes, manualSettingsRes, logRes, surveysRes, operatorsRes] = await Promise.all([
                fetch('../../data/admin/holidays.json'),
                fetch('../../data/admin/manual_calendar_settings.json'),
                fetch('../../data/admin/calendar_update_log.json'),
                fetch('../../data/admin/surveys.json'),
                fetch('../../data/admin/operators.json'),
            ]);
            state.holidays = await holidaysRes.json();
            state.manualSettings = await manualSettingsRes.json();
            state.updateLog = await logRes.json();
            state.surveys = await surveysRes.json();
            state.operators = await operatorsRes.json();
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
        }
    }

    // --- Rendering ---
    function renderAll() {
        renderCalendar();
        renderManualSettings();
        renderUpdateLog();
        updateKPIs();
    }

    function renderCalendar() {
        calendarGrid.innerHTML = '';
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        calendarTitle.textContent = `${year}年${month + 1}月`;

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const firstDayOfWeek = firstDayOfMonth.getDay();
        const totalDays = lastDayOfMonth.getDate();

        for (let i = 0; i < firstDayOfWeek; i++) {
            calendarGrid.appendChild(document.createElement('div'));
        }

        for (let day = 1; day <= totalDays; day++) {
            const date = new Date(year, month, day);
            const dayCell = document.createElement('div');
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

            let cellClasses = 'border border-outline-variant rounded-lg min-h-[120px] p-2 cursor-pointer hover:bg-surface-variant/60 relative';
            let cellTitle = '';

            // --- Survey Period Highlighting ---
            const surveysForDay = getSurveysForDay(dateString);
            if (surveysForDay.length > 0) {
                cellClasses += ' bg-blue-100'; // Apply a light background highlight
                const surveyTitles = surveysForDay.map(s => `${s.name} (${s.startDate} - ${s.endDate})`).join('\n');
                cellTitle = surveyTitles;

                surveysForDay.forEach(survey => {
                    if (survey.startDate === dateString) {
                        cellClasses += ' border-l-4 border-l-primary';
                    }
                    if (survey.endDate === dateString) {
                        cellClasses += ' border-r-4 border-r-primary';
                    }
                });
            }

            dayCell.className = cellClasses;
            dayCell.dataset.date = dateString;
            if (cellTitle) {
                dayCell.title = cellTitle;
            }

            // --- Build Holiday Status HTML ---
            const { status, reason } = getDayStatus(dateString, date.getDay());
            let statusIcon = 'event_available';
            let statusText = '営業日';
            let statusStyle = 'color: var(--color-state-success); border-color: var(--color-state-success);';
            if (status === 'HOLIDAY') {
                statusIcon = 'event_busy';
                statusText = '休業日';
                statusStyle = 'color: var(--color-state-error); border-color: var(--color-state-error);';
            } else if (status === 'SUBSTITUTE_WORKDAY') {
                statusIcon = 'event_available';
                statusText = '振替営業';
                statusStyle = 'color: var(--color-state-warning); border-color: var(--color-state-warning);';
            }
            const holidayStatusHTML = `
                <span style="${statusStyle}" class="inline-flex items-center gap-1 text-xs border px-2 py-0.5 rounded-full">
                    <span class="material-icons text-base !text-sm">${statusIcon}</span>
                    ${statusText}
                </span>
                ${reason ? `<p class="text-xs text-on-surface-variant mt-1 truncate">${reason}</p>` : ''}
            `;

            // --- Build Surveys HTML ---
            let surveysHTML = '<div class="mt-1 space-y-1">';
            surveysForDay.forEach(survey => {
                surveysHTML += `<div class="text-xs text-gray-700 truncate" title="${survey.name}">${survey.name}</div>`;
            });
            surveysHTML += '</div>';

            // --- Set Final Cell HTML ---
            let textColor = 'text-on-surface';
            if (date.getDay() === 0) textColor = 'text-error';
            if (date.getDay() === 6) textColor = 'text-primary';

            dayCell.innerHTML = `
                <div class="flex justify-between ${textColor} font-medium">
                    ${day}
                    <span class="text-xs text-on-surface-variant">${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]}</span>
                </div>
                <div class="mt-1">
                    ${holidayStatusHTML}
                </div>
                ${surveysHTML}
            `;
            
            calendarGrid.appendChild(dayCell);
        }
    }

    function getSurveysForDay(dateString) {
        if (!state.surveys) return [];
        return state.surveys.filter(survey => {
            return dateString >= survey.startDate && dateString <= survey.endDate;
        });
    }

    function renderManualSettings() {
        manualSettingsList.innerHTML = '';
        const totalPages = Math.ceil(state.manualSettings.length / state.manualSettingsItemsPerPage);
        settingPageInfo.textContent = `${state.manualSettingsCurrentPage} / ${totalPages || 1}`;

        if (state.manualSettings.length === 0) {
            manualSettingsList.innerHTML = '<li>個別設定はありません。</li>';
            settingPrevButton.disabled = true;
            settingNextButton.disabled = true;
            return;
        }

        const start = (state.manualSettingsCurrentPage - 1) * state.manualSettingsItemsPerPage;
        const end = start + state.manualSettingsItemsPerPage;
        const pageItems = state.manualSettings.slice(start, end);

        pageItems.forEach(setting => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between p-2 rounded-lg hover:bg-surface-variant/60';
            li.innerHTML = `
                <div>
                    <p class="text-on-surface font-medium">${setting.event_date}</p>
                    <p>${setting.reason} (${setting.event_type === 'HOLIDAY' ? '特別休業日' : '振替営業日'})</p>
                </div>
                <div class="flex gap-2">
                    <button data-id="${setting.id}" class="edit-setting-button inline-flex items-center gap-1 rounded border border-outline px-3 py-1 text-xs">編集</button>
                    <button data-id="${setting.id}" class="delete-setting-button inline-flex items-center gap-1 rounded border border-error/50 text-error px-3 py-1 text-xs">削除</button>
                </div>
            `;
            manualSettingsList.appendChild(li);
        });

        settingPrevButton.disabled = state.manualSettingsCurrentPage === 1;
        settingNextButton.disabled = state.manualSettingsCurrentPage === totalPages;
    }

    function renderUpdateLog() {
        updateLogList.innerHTML = '';
        const totalPages = Math.ceil(state.updateLog.length / state.logItemsPerPage);
        logPageInfo.textContent = `${state.logCurrentPage} / ${totalPages || 1}`;

        if (state.updateLog.length === 0) {
            updateLogList.innerHTML = '<li>更新ログはありません。</li>';
            logPrevButton.disabled = true;
            logNextButton.disabled = true;
            return;
        }

        const start = (state.logCurrentPage - 1) * state.logItemsPerPage;
        const end = start + state.logItemsPerPage;
        const pageItems = state.updateLog.slice(start, end);

        pageItems.forEach(log => {
            const li = document.createElement('li');
            li.innerHTML = `
                <p class="text-on-surface font-medium">${new Date(log.timestamp).toLocaleString('ja-JP')} ${log.user}</p>
                <p>${log.action}</p>
            `;
            updateLogList.appendChild(li);
        });

        logPrevButton.disabled = state.logCurrentPage === 1;
        logNextButton.disabled = state.logCurrentPage === totalPages;
    }
    
    function updateKPIs() {
        const year = state.currentDate.getFullYear();
        const month = state.currentDate.getMonth();
        
        let holidayCount = 0;
        let substituteCount = 0;

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const { status } = getDayStatus(dateString, date.getDay());
            if (status === 'HOLIDAY') {
                holidayCount++;
            } else if (status === 'SUBSTITUTE_WORKDAY') {
                substituteCount++;
            }
        }
        kpiHolidays.textContent = `${holidayCount}日`;
        kpiSubstituteWorkdays.textContent = `${substituteCount}日`;
        kpiSlaAlerts.textContent = '3件';
    }

    function switchTab(targetTab) {
        const isAssignment = targetTab === 'assignment';

        // Reset both buttons to inactive state
        tabBtnSettings.className = 'tab-button shrink-0 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-on-surface-variant hover:border-gray-300 hover:text-on-surface';
        tabBtnAssignment.className = 'tab-button shrink-0 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-on-surface-variant hover:border-gray-300 hover:text-on-surface';

        // Activate the target button
        const activeBtn = isAssignment ? tabBtnAssignment : tabBtnSettings;
        activeBtn.classList.remove('border-transparent', 'text-on-surface-variant');
        activeBtn.classList.add('border-primary', 'text-primary');

        // Toggle content visibility
        tabContentSettings.classList.toggle('hidden', isAssignment);
        tabContentAssignment.classList.toggle('hidden', !isAssignment);
    }

    function openModal(data = {}) {
        // Clear previous validation
        eventDateError.textContent = '';
        reasonError.textContent = '';
        settingForm.reset();
        assignmentForm.reset();

        modalDateDisplay.textContent = data.date || '';
        eventDateInput.value = data.date || '';
        
        if (data.manualSetting) {
            settingIdInput.value = data.manualSetting.id || '';
            reasonInput.value = data.manualSetting.reason || '';
            const typeRadio = settingForm.querySelector(`input[name="event_type"][value="${data.manualSetting.event_type}"]`);
            if (typeRadio) typeRadio.checked = true;
        } else {
            const holidayRadio = settingForm.querySelector(`input[name="event_type"][value="HOLIDAY"]`);
            if (holidayRadio) holidayRadio.checked = true;
        }

        if (data.surveys && data.surveys.length > 0) {
            tabBtnAssignment.style.display = 'block';
            assignmentSurveySelect.innerHTML = data.surveys.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
            
            const companyName = state.operators.length > 0 ? state.operators[0].company : 'N/A';
            assignmentCompanyDisplay.textContent = companyName;

            switchTab('assignment');
        } else {
            tabBtnAssignment.style.display = 'none';
            switchTab('settings');
        }

        modal.classList.remove('hidden');
        setTimeout(() => modalContainer.classList.add('opacity-100', 'translate-y-0'), 10);
    }

    function showConfirmationModal(message) {
        confirmationModalMessage.textContent = message;
        confirmationModal.classList.remove('hidden');
        setTimeout(() => confirmationModalContainer.classList.add('opacity-100', 'translate-y-0'), 10);
    }

    function closeConfirmationModal() {
        confirmationModalContainer.classList.remove('opacity-100', 'translate-y-0');
        setTimeout(() => confirmationModal.classList.add('hidden'), 200);
    }

    function showDeleteConfirmModal(settingId) {
        state.settingToDeleteId = settingId;
        deleteConfirmModal.classList.remove('hidden');
        setTimeout(() => deleteConfirmModalContainer.classList.add('opacity-100', 'translate-y-0'), 10);
    }

    function closeDeleteConfirmModal() {
        deleteConfirmModalContainer.classList.remove('opacity-100', 'translate-y-0');
        setTimeout(() => {
            deleteConfirmModal.classList.add('hidden');
            state.settingToDeleteId = null;
        }, 200);
    }

    function closeModal() {
        modalContainer.classList.remove('opacity-100', 'translate-y-0');
        setTimeout(() => modal.classList.add('hidden'), 200);
    }

    function handleMonthChange(offset) {
        state.currentDate.setMonth(state.currentDate.getMonth() + offset);
        renderAll();
    }

    function handleSave(e) {
        e.preventDefault();
        // Clear previous errors
        eventDateError.textContent = '';
        reasonError.textContent = '';

        let isValid = true;
        if (!eventDateInput.value) {
            eventDateError.textContent = '日付は必須です。';
            isValid = false;
        }
        if (!reasonInput.value) {
            reasonError.textContent = '理由は必須です。';
            isValid = false;
        }

        if (!isValid) return;

        const id = parseInt(settingIdInput.value, 10);
        const newSetting = {
            id: id || Date.now(),
            event_date: eventDateInput.value,
            event_type: settingForm.querySelector('input[name="event_type"]:checked').value,
            reason: reasonInput.value,
            created_by: '現在のユーザー',
            created_at: new Date().toISOString(),
        };

        if (id) {
            const index = state.manualSettings.findIndex(s => s.id === id);
            state.manualSettings[index] = newSetting;
        } else {
            state.manualSettings.push(newSetting);
        }
        
        console.log("Saving setting:", newSetting);
        closeModal();
        renderAll();
    }

    function getDayStatus(dateString, dayOfWeek) {
        const year = dateString.substring(0, 4);

        const manualSetting = state.manualSettings.find(s => s.event_date === dateString);
        if (manualSetting) {
            return { status: manualSetting.event_type, reason: manualSetting.reason };
        }

        const nationalHoliday = state.holidays[year]?.find(h => h.date === dateString);
        if (nationalHoliday) {
            return { status: 'HOLIDAY', reason: null };
        }

        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return { status: 'HOLIDAY', reason: null };
        }

        return { status: 'WORKDAY', reason: null };
    }

    async function init() {
        // Assign DOM elements
        calendarTitle = document.getElementById('calendar-title');
        calendarGrid = document.getElementById('calendar-grid');
        prevMonthButton = document.getElementById('prev-month-button');
        nextMonthButton = document.getElementById('next-month-button');
        manualSettingsList = document.getElementById('manual-settings-list');
        settingPageInfo = document.getElementById('setting-page-info');
        settingPrevButton = document.getElementById('setting-prev-button');
        settingNextButton = document.getElementById('setting-next-button');
        updateLogList = document.getElementById('update-log-list');
        logPageInfo = document.getElementById('log-page-info');
        logPrevButton = document.getElementById('log-prev-button');
        logNextButton = document.getElementById('log-next-button');
        kpiHolidays = document.getElementById('kpi-holidays');
        kpiSubstituteWorkdays = document.getElementById('kpi-substitute-workdays');
        kpiSlaAlerts = document.getElementById('kpi-sla-alerts');
        modal = document.getElementById('setting-modal');
        modalContainer = document.getElementById('setting-modal-container');
        modalDateDisplay = document.getElementById('modal-date-display');
        closeModalButton = document.getElementById('close-modal-button');
        cancelButton = document.getElementById('cancel-button');
        cancelAssignmentButton = document.getElementById('cancel-assignment-button');
        tabBtnSettings = document.getElementById('tab-btn-settings');
        tabBtnAssignment = document.getElementById('tab-btn-assignment');
        tabContentSettings = document.getElementById('tab-content-settings');
        tabContentAssignment = document.getElementById('tab-content-assignment');
        settingForm = document.getElementById('setting-form');
        settingIdInput = document.getElementById('setting-id');
        eventDateInput = document.getElementById('event_date');
        reasonInput = document.getElementById('reason');
        eventDateError = document.getElementById('event_date-error');
        reasonError = document.getElementById('reason-error');
        assignmentForm = document.getElementById('assignment-form');
        assignmentSurveySelect = document.getElementById('assignment-survey');
        assignmentCompanyDisplay = document.getElementById('assignment-company');
        confirmationModal = document.getElementById('confirmation-modal');
        confirmationModalContainer = document.getElementById('confirmation-modal-container');
        confirmationModalMessage = document.getElementById('confirmation-modal-message');
        closeConfirmationModalButton = document.getElementById('close-confirmation-modal-button');
        deleteConfirmModal = document.getElementById('delete-confirm-modal');
        deleteConfirmModalContainer = document.getElementById('delete-confirm-modal-container');
        cancelDeleteButton = document.getElementById('cancel-delete-button');
        confirmDeleteButton = document.getElementById('confirm-delete-button');

        await fetchData();
        renderAll();

        prevMonthButton.addEventListener('click', () => handleMonthChange(-1));
        nextMonthButton.addEventListener('click', () => handleMonthChange(1));
        
        settingPrevButton.addEventListener('click', () => {
            if (state.manualSettingsCurrentPage > 1) {
                state.manualSettingsCurrentPage--;
                renderManualSettings();
            }
        });
        settingNextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(state.manualSettings.length / state.manualSettingsItemsPerPage);
            if (state.manualSettingsCurrentPage < totalPages) {
                state.manualSettingsCurrentPage++;
                renderManualSettings();
            }
        });

        logPrevButton.addEventListener('click', () => {
            if (state.logCurrentPage > 1) {
                state.logCurrentPage--;
                renderUpdateLog();
            }
        });
        logNextButton.addEventListener('click', () => {
            const totalPages = Math.ceil(state.updateLog.length / state.logItemsPerPage);
            if (state.logCurrentPage < totalPages) {
                state.logCurrentPage++;
                renderUpdateLog();
            }
        });

        document.getElementById('add-setting-button').addEventListener('click', () => openModal({ date: new Date().toISOString().split('T')[0] }));
        
        calendarGrid.addEventListener('click', (e) => {
            const dayCell = e.target.closest('[data-date]');
            if (dayCell) {
                const date = dayCell.dataset.date;
                const manualSetting = state.manualSettings.find(s => s.event_date === date);
                const surveys = getSurveysForDay(date);
                openModal({
                    date: date, 
                    manualSetting: manualSetting,
                    surveys: surveys
                });
            }
        });

        manualSettingsList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            
            const id = parseInt(button.dataset.id, 10);
            if (button.classList.contains('edit-setting-button')) {
                const setting = state.manualSettings.find(s => s.id === id);
                openModal({ date: setting.event_date, manualSetting: setting });
            }
            if (button.classList.contains('delete-setting-button')) {
                showDeleteConfirmModal(id);
            }
        });

        // Modal and Tab Listeners
        closeModalButton.addEventListener('click', closeModal);
        cancelButton.addEventListener('click', closeModal);
        cancelAssignmentButton.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        settingForm.addEventListener('submit', handleSave);

        assignmentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const surveyName = assignmentSurveySelect.options[assignmentSurveySelect.selectedIndex].text;
            const companyName = assignmentCompanyDisplay.textContent;
            const message = `${surveyName}に ${companyName} をアサインしました。`;
            
            closeModal(); // Close the main modal
            showConfirmationModal(message); // Show the custom confirmation modal
        });

        if (closeConfirmationModalButton) {
            closeConfirmationModalButton.addEventListener('click', closeConfirmationModal);
        }
        confirmationModal.addEventListener('click', (e) => {
            if (e.target === confirmationModal) {
                closeConfirmationModal();
            }
        });

        // Delete confirmation listeners
        deleteConfirmModal.addEventListener('click', (e) => {
            if (e.target === deleteConfirmModal) {
                closeDeleteConfirmModal();
            }
        });
        cancelDeleteButton.addEventListener('click', closeDeleteConfirmModal);
        confirmDeleteButton.addEventListener('click', () => {
            if (state.settingToDeleteId) {
                state.manualSettings = state.manualSettings.filter(s => s.id !== state.settingToDeleteId);
                console.log("Deleted setting:", state.settingToDeleteId);
                closeDeleteConfirmModal();
                renderAll();
            }
        });

        tabBtnSettings.addEventListener('click', () => switchTab('settings'));
        tabBtnAssignment.addEventListener('click', () => switchTab('assignment'));

        document.getElementById('export-csv-button').addEventListener('click', () => alert('CSVエクスポート機能は現在開発中です。'));
        document.getElementById('import-csv-button').addEventListener('click', () => alert('CSVインポート機能は現在開発中です。'));
        document.getElementById('sync-holidays-button').addEventListener('click', () => alert('祝日API同期を実行しました（シミュレーション）。'));
    }

    init();
}
