document.addEventListener('DOMContentLoaded', () => {
    const state = {
        currentDate: new Date(),
        holidays: {},
        manualSettings: [],
        updateLog: [],
        manualSettingsCurrentPage: 1,
        manualSettingsItemsPerPage: 5,
        logCurrentPage: 1,
        logItemsPerPage: 5,
    };

    // DOM Elements
    const calendarTitle = document.getElementById('calendar-title');
    const calendarGrid = document.getElementById('calendar-grid');
    const prevMonthButton = document.getElementById('prev-month-button');
    const nextMonthButton = document.getElementById('next-month-button');
    const manualSettingsList = document.getElementById('manual-settings-list');
    const settingPageInfo = document.getElementById('setting-page-info');
    const settingPrevButton = document.getElementById('setting-prev-button');
    const settingNextButton = document.getElementById('setting-next-button');
    const updateLogList = document.getElementById('update-log-list');
    const logPageInfo = document.getElementById('log-page-info');
    const logPrevButton = document.getElementById('log-prev-button');
    const logNextButton = document.getElementById('log-next-button');
    const kpiHolidays = document.getElementById('kpi-holidays');
    const kpiSubstituteWorkdays = document.getElementById('kpi-substitute-workdays');
    const kpiSlaAlerts = document.getElementById('kpi-sla-alerts');

    // Modal Elements
    const modal = document.getElementById('setting-modal');
    const modalContainer = document.getElementById('setting-modal-container');
    const closeModalButton = document.getElementById('close-modal-button');
    const cancelButton = document.getElementById('cancel-button');
    const settingForm = document.getElementById('setting-form');
    const modalTitle = document.getElementById('modal-title');
    const settingIdInput = document.getElementById('setting-id');
    const eventDateInput = document.getElementById('event_date');
    const reasonInput = document.getElementById('reason');

    // --- Data Fetching ---
    async function fetchData() {
        try {
            const [holidaysRes, manualSettingsRes, logRes] = await Promise.all([
                fetch('../../data/admin/holidays.json'),
                fetch('../../data/admin/manual_calendar_settings.json'),
                fetch('../../data/admin/calendar_update_log.json'),
            ]);
            state.holidays = await holidaysRes.json();
            state.manualSettings = await manualSettingsRes.json();
            state.updateLog = await logRes.json();
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
            dayCell.className = 'border border-outline-variant rounded-lg min-h-[96px] p-2 cursor-pointer hover:bg-surface-variant/60';
            dayCell.dataset.date = date.toISOString().split('T')[0];

            const { status, reason } = getDayStatus(date);
            
            let textColor = 'text-on-surface';
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
            
            if (date.getDay() === 0) textColor = 'text-error';
            if (date.getDay() === 6) textColor = 'text-primary';

            dayCell.innerHTML = `
                <div class="flex justify-between ${textColor} font-medium">
                    ${day}
                    <span class="text-xs text-on-surface-variant">${['日', '月', '火', '水', '木', '金', '土'][date.getDay()]}</span>
                </div>
                <div class="mt-1">
                    <span style="${statusStyle}" class="inline-flex items-center gap-1 text-xs border px-2 py-0.5 rounded-full">
                        <span class="material-icons text-base !text-sm">${statusIcon}</span>
                        ${statusText}
                    </span>
                    ${reason ? `<p class="text-xs text-on-surface-variant mt-1 truncate">${reason}</p>` : ''}
                </div>
            `;
            calendarGrid.appendChild(dayCell);
        }
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
            const { status } = getDayStatus(date);
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

    function openModal(data = {}) {
        settingForm.reset();
        settingIdInput.value = data.id || '';
        eventDateInput.value = data.date || '';
        reasonInput.value = data.reason || '';
        
        if (data.type) {
            settingForm.querySelector(`input[name="event_type"][value="${data.type}"]`).checked = true;
        } else {
             settingForm.querySelector(`input[name="event_type"][value="HOLIDAY"]`).checked = true;
        }

        modalTitle.textContent = data.id ? '設定を編集' : '個別設定を追加';
        modal.classList.remove('hidden');
        setTimeout(() => modalContainer.classList.add('opacity-100', 'translate-y-0'), 10);
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
        const id = parseInt(settingIdInput.value, 10);
        const newSetting = {
            id: id || Date.now(),
            event_date: eventDateInput.value,
            event_type: settingForm.querySelector('input[name="event_type"]:checked').value,
            reason: reasonInput.value,
            created_by: '現在のユーザー',
            created_at: new Date().toISOString(),
        };

        if (!newSetting.event_date || !newSetting.reason) {
            alert('日付と理由は必須です。');
            return;
        }

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

    function getDayStatus(date) {
        const dateString = date.toISOString().split('T')[0];
        const year = date.getFullYear().toString();

        const manualSetting = state.manualSettings.find(s => s.event_date === dateString);
        if (manualSetting) {
            return { status: manualSetting.event_type, reason: manualSetting.reason };
        }

        const nationalHoliday = state.holidays[year]?.find(h => h.date === dateString);
        if (nationalHoliday) {
            return { status: 'HOLIDAY', reason: nationalHoliday.name };
        }

        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            return { status: 'HOLIDAY', reason: '週末' };
        }

        return { status: 'WORKDAY', reason: null };
    }

    async function init() {
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

        document.getElementById('add-setting-button').addEventListener('click', () => openModal());
        
        calendarGrid.addEventListener('click', (e) => {
            const dayCell = e.target.closest('[data-date]');
            if (dayCell) {
                const date = dayCell.dataset.date;
                const existingSetting = state.manualSettings.find(s => s.event_date === date);
                if (existingSetting) {
                     openModal({ id: existingSetting.id, date: existingSetting.event_date, reason: existingSetting.reason, type: existingSetting.event_type });
                } else {
                     openModal({ date });
                }
            }
        });

        manualSettingsList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;
            
            const id = parseInt(button.dataset.id, 10);
            if (button.classList.contains('edit-setting-button')) {
                const setting = state.manualSettings.find(s => s.id === id);
                openModal({ id: setting.id, date: setting.event_date, reason: setting.reason, type: setting.event_type });
            }
            if (button.classList.contains('delete-setting-button')) {
                if (confirm('この設定を削除してもよろしいですか？')) {
                    state.manualSettings = state.manualSettings.filter(s => s.id !== id);
                    console.log("Deleted setting:", id);
                    renderAll();
                }
            }
        });

        closeModalButton.addEventListener('click', closeModal);
        cancelButton.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        settingForm.addEventListener('submit', handleSave);

        document.getElementById('export-csv-button').addEventListener('click', () => alert('CSVエクスポート機能は現在開発中です。'));
        document.getElementById('import-csv-button').addEventListener('click', () => alert('CSVインポート機能は現在開発中です。'));
        document.getElementById('sync-holidays-button').addEventListener('click', () => alert('祝日API同期を実行しました（シミュレーション）。'));
    }

    init();
});