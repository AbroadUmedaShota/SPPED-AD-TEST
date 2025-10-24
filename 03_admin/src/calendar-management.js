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
        urgencyOverrides: {},
        assignmentOverrides: {},
        currentModalDate: null,
        // Additions for drag selection
        isDragging: false,
        dragStartDate: null,
        dragEndDate: null,
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
        deleteConfirmModalContainer, cancelDeleteButton, confirmDeleteButton,
        // Additions for bulk modal
        bulkModal, bulkModalContainer, bulkModalDateRangeDisplay, bulkCloseModalButton,
        bulkCancelButton, bulkSettingForm, bulkReasonInput, bulkReasonError,
        bulkAssignmentForm, bulkSaveAssignmentButton, bulkCancelAssignmentButton,
        bulkCloseAssignmentTabButton;


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
            let dayInfoHTML = '';

            // --- Survey Period Highlighting & Info ---
            const surveysForDay = getSurveysForDay(dateString);
            const isUrgent = state.urgencyOverrides[dateString]; // Manual override
            const dayAssignments = state.assignmentOverrides[dateString];
            const onDemandSurveys = surveysForDay.filter(s => s.type === 'on-demand');
            const regularSurveys = surveysForDay.filter(s => s.type === 'normal');

            let surveyBgClass = ''; // Initialize background class

            // 1. Manual urgency override has the highest priority
            if (isUrgent) {
                surveyBgClass = ' bg-red-200';
            } 
            // 2. Logic for on-demand surveys if no manual override
            else if (onDemandSurveys.length > 0) {
                const isAssigned = dayAssignments && dayAssignments.surveyIds.length > 0;
                const isToday = new Date().toISOString().split('T')[0] === dateString;

                if (isAssigned) {
                    surveyBgClass = ' bg-green-200'; // Green for assigned
                } else if (isToday) {
                    surveyBgClass = ' bg-red-200';   // Red for unassigned & today
                } else {
                    surveyBgClass = ' bg-yellow-200';// Yellow for unassigned & not today
                }
            }
            // Normal (non-on-demand) surveys do not get a background color.

            cellClasses += surveyBgClass; // Add the determined background class

            if (surveysForDay.length > 0) {
                // Only show total counts if there are on-demand surveys
                if (onDemandSurveys.length > 0) {
                    const totalCards = surveysForDay.reduce((sum, survey) => sum + (survey.expected_cards || 0), 0);
                    dayInfoHTML += `
                        <div class="mt-1 text-xs text-on-surface-variant">
                            <p>件数: ${surveysForDay.length}</p>
                            <p>見込枚数: ${totalCards.toLocaleString()}</p>
                        </div>
                    `;
                }

                // Display On-demand surveys with a lightning icon
                onDemandSurveys.forEach(survey => {
                    const surveyName = survey.name.length > 8 ? survey.name.substring(0, 8) + '...' : survey.name;
                    dayInfoHTML += `<p class="text-xs text-gray-900 mt-1 truncate" title="${survey.name}">⚡ ${surveyName}</p>`;
                });

                // Display Regular surveys with conditional checkmark
                if (regularSurveys.length > 0) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); // Normalize today to the beginning of the day

                    regularSurveys.forEach(survey => {
                        const surveyDate = new Date(dateString);
                        const diffTime = surveyDate.getTime() - today.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                        let textColorClass = 'text-gray-900'; // Default black color
                        if (survey.status !== "assigned" && diffDays >= 0 && diffDays <= 3) {
                            textColorClass = 'text-red-600 font-semibold';
                        }

                        const assignedIcon = survey.status === "assigned" ? '<span class="text-green-600">☑</span> ' : '';
                        const surveyName = survey.name.length > 8 ? survey.name.substring(0, 8) + '...' : survey.name;
                        dayInfoHTML += `<p class="text-xs ${textColorClass} mt-1 truncate" title="${survey.name}">${assignedIcon}${surveyName}</p>`;
                    });
                }

                const surveyTitles = surveysForDay.map(s => s.name).join(', ');
                cellTitle = surveyTitles;
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
                ${dayInfoHTML}
            `;
            
            calendarGrid.appendChild(dayCell);
        }
        updateSelectionHighlight();
    }

    function getSurveysForDay(dateString) {
        if (!state.surveys) return [];
        return state.surveys.filter(survey => {
            return dateString >= survey.startDate && dateString <= survey.endDate;
        });
    }

    function getSurveysForRange(startDate, endDate) {
        if (!state.surveys) return [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        const surveysInRange = new Map();

        let currentDate = new Date(start);
        while (currentDate <= end) {
            const dateString = currentDate.toISOString().split('T')[0];
            const surveysForDay = getSurveysForDay(dateString);
            surveysForDay.forEach(survey => surveysInRange.set(survey.id, survey));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return Array.from(surveysInRange.values());
    }

    function renderManualSettings() {
        manualSettingsList.innerHTML = '';
        
        const sortedSettings = state.manualSettings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const totalPages = Math.ceil(sortedSettings.length / state.manualSettingsItemsPerPage);
        settingPageInfo.textContent = `${state.manualSettingsCurrentPage} / ${totalPages || 1}`;

        if (sortedSettings.length === 0) {
            manualSettingsList.innerHTML = '<li>個別設定はありません。</li>';
            settingPrevButton.disabled = true;
            settingNextButton.disabled = true;
            return;
        }

        const start = (state.manualSettingsCurrentPage - 1) * state.manualSettingsItemsPerPage;
        const end = start + state.manualSettingsItemsPerPage;
        const pageItems = sortedSettings.slice(start, end);

        pageItems.forEach(setting => {
            const li = document.createElement('li');
            li.className = 'flex items-center justify-between p-2 rounded-lg';
            
            const reasonText = `${setting.reason} (${setting.event_type === 'HOLIDAY' ? '特別休業日' : '振替営業日'})`;
            let reasonHTML;
            const maxLength = 40;

            if (reasonText.length > maxLength) {
                const shortText = reasonText.substring(0, maxLength) + '...';
                reasonHTML = `
                    <div class="expandable-text">
                        <p class="short-text">${shortText}</p>
                        <p class="full-text hidden">${reasonText}</p>
                        <button class="toggle-text-button text-sm text-primary hover:underline">続きを読む</button>
                    </div>
                `;
            } else {
                reasonHTML = `<p>${reasonText}</p>`;
            }

            li.innerHTML = `
                <div class="flex-1">
                    <p class="text-on-surface font-medium">${setting.event_date}</p>
                    ${reasonHTML}
                </div>
                <div class="flex gap-2 pl-4">
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
        
        const sortedLog = state.updateLog.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const totalPages = Math.ceil(sortedLog.length / state.logItemsPerPage);
        logPageInfo.textContent = `${state.logCurrentPage} / ${totalPages || 1}`;

        if (sortedLog.length === 0) {
            updateLogList.innerHTML = '<li>更新ログはありません。</li>';
            logPrevButton.disabled = true;
            logNextButton.disabled = true;
            return;
        }

        const start = (state.logCurrentPage - 1) * state.logItemsPerPage;
        const end = start + state.logItemsPerPage;
        const pageItems = sortedLog.slice(start, end);

        pageItems.forEach(log => {
            const li = document.createElement('li');

            const actionText = log.action;
            let actionHTML;
            const maxLength = 40;

            if (actionText.length > maxLength) {
                const shortText = actionText.substring(0, maxLength) + '...';
                actionHTML = `
                    <div class="expandable-text">
                        <p class="short-text">${shortText}</p>
                        <p class="full-text hidden">${actionText}</p>
                        <button class="toggle-text-button text-sm text-primary hover:underline">続きを読む</button>
                    </div>
                `;
            } else {
                actionHTML = `<p>${actionText}</p>`;
            }

            li.innerHTML = `
                <p class="text-on-surface font-medium">${new Date(log.timestamp).toLocaleString('ja-JP')} ${log.user}</p>
                ${actionHTML}
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
        // Deactivate all buttons and hide all content
        ['settings', 'survey-details', 'reassign'].forEach(tab => {
            const tabBtn = document.getElementById(`tab-btn-${tab}`);
            const tabContent = document.getElementById(`tab-content-${tab}`);
            if (tabBtn) {
                tabBtn.className = 'tab-button shrink-0 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-on-surface-variant hover:border-gray-300 hover:text-on-surface';
            }
            if (tabContent) {
                tabContent.classList.add('hidden');
            }
        });

        // Activate the target tab
        const activeBtn = document.getElementById(`tab-btn-${targetTab}`);
        if (activeBtn) {
            activeBtn.classList.remove('border-transparent', 'text-on-surface-variant');
            activeBtn.classList.add('border-primary', 'text-primary');
        }
        const activeContent = document.getElementById(`tab-content-${targetTab}`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }
    }

    function openModal(data = {}) {
        state.currentModalDate = data.date;
        // Reset forms
        settingForm.reset();
        if (assignmentForm) assignmentForm.reset();

        // Set common display
        modalDateDisplay.textContent = data.date || '';
        eventDateInput.value = data.date || '';
        
        // Populate Holiday Settings Tab
        if (data.manualSetting) {
            settingIdInput.value = data.manualSetting.id || '';
            reasonInput.value = data.manualSetting.reason || '';
            const typeRadio = settingForm.querySelector(`input[name="event_type"][value="${data.manualSetting.event_type}"]`);
            if (typeRadio) typeRadio.checked = true;
        } else {
            const holidayRadio = settingForm.querySelector(`input[name="event_type"][value="HOLIDAY"]`);
            if (holidayRadio) holidayRadio.checked = true;
        }

        const surveyDetailsTab = document.getElementById('tab-btn-survey-details');
        const reassignTab = document.getElementById('tab-btn-reassign');
        const assignmentSurveysList = document.getElementById('assignment-surveys-list');
        const dayUrgencyButton = document.getElementById('toggle-day-urgency-button');

        const assignView = document.getElementById('assign-view');
        const cancelAssignView = document.getElementById('cancel-assign-view');

        const dayAssignments = state.assignmentOverrides[data.date];
        const isAssigned = dayAssignments && dayAssignments.surveyIds.length > 0;

        if (isAssigned) {
            assignView.classList.add('hidden');
            cancelAssignView.classList.remove('hidden');
        } else {
            assignView.classList.remove('hidden');
            cancelAssignView.classList.add('hidden');
        }

        // Handle Survey-related Tabs
        if (data.surveys && data.surveys.length > 0) {
            [surveyDetailsTab, reassignTab].forEach(tab => tab.style.display = 'block');

            // --- Populate Survey Details Tab ---
            assignmentSurveysList.innerHTML = data.surveys.map(survey => `
                <div class="p-3 rounded-lg bg-surface-container">
                    <p class="font-semibold text-on-surface">${survey.name}</p>
                    <p class="text-sm text-on-surface-variant">見込枚数: ${(survey.expected_cards || 0).toLocaleString()}</p>
                </div>
            `).join('');
            
            // --- Set Day Urgency Button State ---
            const isUrgent = state.urgencyOverrides[data.date];
            dayUrgencyButton.textContent = isUrgent ? '緊急を解除' : '緊急に設定';
            dayUrgencyButton.className = `toggle-day-urgency-button text-white text-xs font-bold py-1 px-2 rounded ${isUrgent ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-500 hover:bg-red-600'}`;
            dayUrgencyButton.dataset.date = data.date;

            // --- Populate Re-assign Tab ---
            const assignmentCompanyDisplay = document.getElementById('assignment-company');
            const assignmentDateText = document.getElementById('assignment-date-text');
            if (assignmentDateText) {
                assignmentDateText.textContent = `${data.date}にアサインしますか？`;
            }
            if (assignmentCompanyDisplay) {
                const companyName = state.operators.length > 0 ? state.operators[0].company : 'N/A';
                assignmentCompanyDisplay.textContent = companyName;
            }

            switchTab('survey-details');
        } else {
            [surveyDetailsTab, reassignTab].forEach(tab => tab.style.display = 'none');
            assignmentSurveysList.innerHTML = '';
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

    // --- Drag Selection Functions ---

    function handleDragStart(e) {
        const dayCell = e.target.closest('[data-date]');
        if (dayCell) {
            e.preventDefault();
            state.isDragging = true;
            state.dragStartDate = dayCell.dataset.date;
            state.dragEndDate = dayCell.dataset.date;
            updateSelectionHighlight();
        }
    }

    function handleDrag(e) {
        if (state.isDragging) {
            const dayCell = e.target.closest('[data-date]');
            if (dayCell && dayCell.dataset.date !== state.dragEndDate) {
                state.dragEndDate = dayCell.dataset.date;
                updateSelectionHighlight();
            }
        }
    }

    function handleDragEnd() {
        if (!state.isDragging) return;

        const wasDragging = state.dragStartDate !== state.dragEndDate;
        state.isDragging = false;

        if (wasDragging) {
            const { start, end } = getOrderedDateRange();
            openBulkSettingModal(start, end);
        } else {
            // This is a single click, handle it here
            const date = state.dragStartDate;
            const manualSetting = state.manualSettings.find(s => s.event_date === date);
            const surveys = getSurveysForDay(date);
            openModal({
                date: date,
                manualSetting: manualSetting,
                surveys: surveys
            });
            // Reset selection visuals after a short delay
            setTimeout(() => {
                state.dragStartDate = null;
                state.dragEndDate = null;
                updateSelectionHighlight();
            }, 100);
        }
    }

    function getOrderedDateRange() {
        const start = state.dragStartDate;
        const end = state.dragEndDate;
        if (!start || !end) return { start: null, end: null };
        return new Date(start) > new Date(end) ? { start: end, end: start } : { start: start, end: end };
    }

    function updateSelectionHighlight() {
        calendarGrid.querySelectorAll('.selection').forEach(cell => {
            cell.classList.remove('selection', 'bg-blue-300');
        });

        if (!state.dragStartDate || !state.dragEndDate) return;

        const { start, end } = getOrderedDateRange();
        if (!start || !end) return;

        let currentDate = new Date(start);
        const lastDate = new Date(end);

        while (currentDate <= lastDate) {
            const dateString = currentDate.toISOString().split('T')[0];
            const cell = calendarGrid.querySelector(`[data-date="${dateString}"]`);
            if (cell) {
                cell.classList.add('selection', 'bg-blue-300');
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    // --- Bulk Setting Modal Functions ---
    function switchBulkTab(targetTab) {
        // Deactivate all buttons and hide all content
        ['settings', 'survey-details', 'reassign'].forEach(tab => {
            const tabBtn = document.getElementById(`bulk-tab-btn-${tab}`);
            const tabContent = document.getElementById(`bulk-tab-content-${tab}`);
            if (tabBtn) {
                tabBtn.className = 'tab-button shrink-0 border-b-2 border-transparent px-1 py-3 text-sm font-medium text-on-surface-variant hover:border-gray-300 hover:text-on-surface';
            }
            if (tabContent) {
                tabContent.classList.add('hidden');
            }
        });

        // Activate the target tab
        const activeBtn = document.getElementById(`bulk-tab-btn-${targetTab}`);
        if (activeBtn) {
            activeBtn.classList.remove('border-transparent', 'text-on-surface-variant');
            activeBtn.classList.add('border-primary', 'text-primary');
        }
        const activeContent = document.getElementById(`bulk-tab-content-${targetTab}`);
        if (activeContent) {
            activeContent.classList.remove('hidden');
        }
    }

    function openBulkSettingModal(startDate, endDate) {
        bulkModalDateRangeDisplay.textContent = `${startDate} から ${endDate}`;
        bulkSettingForm.reset();
        if(bulkAssignmentForm) bulkAssignmentForm.reset();
        bulkReasonError.textContent = '';

        const surveysInRange = getSurveysForRange(startDate, endDate);
        const surveyDetailsTab = document.getElementById('bulk-tab-btn-survey-details');
        const reassignTab = document.getElementById('bulk-tab-btn-reassign');
        const assignmentSurveysList = document.getElementById('bulk-assignment-surveys-list');

        const bulkAssignView = document.getElementById('bulk-assign-view');
        const bulkCancelAssignView = document.getElementById('bulk-cancel-assign-view');

        let isRangeAssigned = false;
        let currentDate = new Date(startDate);
        const lastDate = new Date(endDate);
        while (currentDate <= lastDate) {
            const dateString = currentDate.toISOString().split('T')[0];
            const dayAssignments = state.assignmentOverrides[dateString];
            if (dayAssignments && dayAssignments.surveyIds.length > 0) {
                isRangeAssigned = true;
                break;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        if (isRangeAssigned) {
            bulkAssignView.classList.add('hidden');
            bulkCancelAssignView.classList.remove('hidden');
        } else {
            bulkAssignView.classList.remove('hidden');
            bulkCancelAssignView.classList.add('hidden');
        }

        if (surveysInRange.length > 0) {
            [surveyDetailsTab, reassignTab].forEach(tab => tab.style.display = 'block');

            assignmentSurveysList.innerHTML = surveysInRange.map(survey => `
                <div class="p-3 rounded-lg bg-surface-container">
                    <p class="font-semibold text-on-surface">${survey.name}</p>
                    <p class="text-sm text-on-surface-variant">見込枚数: ${(survey.expected_cards || 0).toLocaleString()}</p>
                </div>
            `).join('');

            const bulkAssignmentCompanyDisplay = document.getElementById('bulk-assignment-company');
            const bulkAssignmentDateText = document.getElementById('bulk-assignment-date-text');
            if (bulkAssignmentDateText) {
                bulkAssignmentDateText.textContent = `${startDate}～${endDate}にアサインしますか？`;
            }
            if (bulkAssignmentCompanyDisplay) {
                const companyName = state.operators.length > 0 ? state.operators[0].company : 'N/A';
                bulkAssignmentCompanyDisplay.textContent = companyName;
            }
            switchBulkTab('survey-details');
        } else {
            [surveyDetailsTab, reassignTab].forEach(tab => tab.style.display = 'none');
            assignmentSurveysList.innerHTML = '';
            switchBulkTab('settings');
        }

        bulkModal.classList.remove('hidden');
        setTimeout(() => bulkModalContainer.classList.add('opacity-100', 'translate-y-0'), 10);
    }

    function closeBulkSettingModal() {
        bulkModalContainer.classList.remove('opacity-100', 'translate-y-0');
        setTimeout(() => {
            bulkModal.classList.add('hidden');
            // Clear selection after closing modal
            state.dragStartDate = null;
            state.dragEndDate = null;
            updateSelectionHighlight();
        }, 200);
    }

    function handleBulkSave(e) {
        e.preventDefault();
        bulkReasonError.textContent = '';
        const bulkReasonInput = document.getElementById('bulk_reason');
        if (!bulkReasonInput.value) {
            bulkReasonError.textContent = '理由は必須です。';
            return;
        }

        const { start, end } = getOrderedDateRange();
        if (!start || !end) return;

        const eventType = bulkSettingForm.querySelector('input[name="bulk_event_type"]:checked').value;
        const reason = bulkReasonInput.value;

        let currentDate = new Date(start);
        const lastDate = new Date(end);

        while (currentDate <= lastDate) {
            const dateString = currentDate.toISOString().split('T')[0];

            const existingSettingIndex = state.manualSettings.findIndex(s => s.event_date === dateString);
            const newSetting = {
                id: existingSettingIndex > -1 ? state.manualSettings[existingSettingIndex].id : Date.now() + Math.random(),
                event_date: dateString,
                event_type: eventType,
                reason: reason,
                created_by: '現在のユーザー',
                created_at: new Date().toISOString(),
            };

            if (existingSettingIndex > -1) {
                state.manualSettings[existingSettingIndex] = newSetting;
            } else {
                state.manualSettings.push(newSetting);
            }

            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log(`Bulk saving for ${start} to ${end}`);
        closeBulkSettingModal();
        renderAll();
    }
    
    function handleBulkAssignmentSave(e) {
        e.preventDefault();
        const { start, end } = getOrderedDateRange();
        if (!start || !end) return;

        const surveysInRange = getSurveysForRange(start, end);
        if (surveysInRange.length === 0) {
            closeBulkSettingModal();
            return;
        }

        let currentDate = new Date(start);
        const lastDate = new Date(end);

        while (currentDate <= lastDate) {
            const dateString = currentDate.toISOString().split('T')[0];
            const surveysForDay = getSurveysForDay(dateString);

            if (surveysForDay.length > 0) {
                if (!state.assignmentOverrides[dateString]) {
                    state.assignmentOverrides[dateString] = { surveyIds: [] };
                }
                surveysForDay.forEach(survey => {
                    if (!state.assignmentOverrides[dateString].surveyIds.includes(survey.id)) {
                        state.assignmentOverrides[dateString].surveyIds.push(survey.id);
                    }
                });
            }

            if (state.urgencyOverrides[dateString]) {
                state.urgencyOverrides[dateString] = false;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        renderAll();

        const companyName = document.getElementById('bulk-assignment-company').textContent;
        const message = `${start}から${end}に ${companyName} をアサインしました。`;
        
        closeBulkSettingModal();
        showConfirmationModal(message);
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
        const tabBtnSurveyDetails = document.getElementById('tab-btn-survey-details');
        const tabBtnReassign = document.getElementById('tab-btn-reassign');
        tabContentSettings = document.getElementById('tab-content-settings');
        const tabContentSurveyDetails = document.getElementById('tab-content-survey-details');
        const tabContentReassign = document.getElementById('tab-content-reassign');
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

        // Additions for bulk modal
        bulkModal = document.getElementById('bulk-setting-modal');
        bulkModalContainer = document.getElementById('bulk-setting-modal-container');
        bulkModalDateRangeDisplay = document.getElementById('bulk-modal-date-range-display');
        bulkCloseModalButton = document.getElementById('bulk-close-modal-button');
        bulkCancelButton = document.getElementById('bulk-cancel-button');
        bulkSettingForm = document.getElementById('bulk-setting-form');
        bulkReasonError = document.getElementById('bulk_reason-error');
        bulkAssignmentForm = document.getElementById('bulk-assignment-form');
        bulkSaveAssignmentButton = document.getElementById('bulk-save-assignment-button');
        bulkCancelAssignmentButton = document.getElementById('bulk-cancel-assignment-button');
        bulkCloseAssignmentTabButton = document.getElementById('bulk-close-assignment-tab-button');

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
        
        // Drag and drop listeners for calendar
        calendarGrid.addEventListener('mousedown', handleDragStart);
        calendarGrid.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', handleDragEnd); // Listen on document to catch mouseup outside grid

        manualSettingsList.addEventListener('click', (e) => {
            const button = e.target.closest('button');
            if (!button) return;

            if (button.classList.contains('toggle-text-button')) {
                const container = button.closest('.expandable-text');
                if (!container) return;

                const shortText = container.querySelector('.short-text');
                const fullText = container.querySelector('.full-text');

                shortText.classList.toggle('hidden');
                fullText.classList.toggle('hidden');

                button.textContent = fullText.classList.contains('hidden') ? '続きを読む' : '閉じる';
                return;
            }
            
            const id = parseInt(button.dataset.id, 10);
            if (button.classList.contains('edit-setting-button')) {
                const setting = state.manualSettings.find(s => s.id === id);
                openModal({ date: setting.event_date, manualSetting: setting });
            }
            if (button.classList.contains('delete-setting-button')) {
                showDeleteConfirmModal(id);
            }
        });

        updateLogList.addEventListener('click', (e) => {
            const button = e.target.closest('.toggle-text-button');
            if (!button) return;

            const container = button.closest('.expandable-text');
            if (!container) return;

            const shortText = container.querySelector('.short-text');
            const fullText = container.querySelector('.full-text');

            shortText.classList.toggle('hidden');
            fullText.classList.toggle('hidden');

            button.textContent = fullText.classList.contains('hidden') ? '続きを読む' : '閉じる';
        });

        // Modal and Tab Listeners
        const closeAssignmentTabButton = document.getElementById('close-assignment-tab-button');
        closeModalButton.addEventListener('click', closeModal);
        cancelButton.addEventListener('click', closeModal);
        if(closeAssignmentTabButton) {
            closeAssignmentTabButton.addEventListener('click', closeModal);
        }
        if(cancelAssignmentButton) {
            cancelAssignmentButton.addEventListener('click', closeModal);
        }
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        settingForm.addEventListener('submit', handleSave);

        if (assignmentForm) {
            assignmentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const date = state.currentModalDate;
                if (!date) return;

                const surveysForDay = getSurveysForDay(date);
                if (surveysForDay.length === 0) {
                    closeModal();
                    return;
                }

                if (!state.assignmentOverrides[date]) {
                    state.assignmentOverrides[date] = { surveyIds: [] };
                }

                surveysForDay.forEach(survey => {
                    if (!state.assignmentOverrides[date].surveyIds.includes(survey.id)) {
                        state.assignmentOverrides[date].surveyIds.push(survey.id);
                    }
                });

                if (state.urgencyOverrides[date]) {
                    state.urgencyOverrides[date] = false;
                }

                renderAll();

                const companyName = assignmentCompanyDisplay.textContent;
                const message = `${date}に ${companyName} をアサインしました。`;
                
                closeModal();
                showConfirmationModal(message);
            });
        }

        const dayUrgencyButton = document.getElementById('toggle-day-urgency-button');
        if (dayUrgencyButton) {
            dayUrgencyButton.addEventListener('click', (e) => {
                const date = e.target.dataset.date;
                if (!date) return;

                state.urgencyOverrides[date] = !state.urgencyOverrides[date];
                renderAll();

                const isUrgent = state.urgencyOverrides[date];
                e.target.textContent = isUrgent ? '緊急を解除' : '緊急に設定';
                e.target.className = `toggle-day-urgency-button text-white text-xs font-bold py-1 px-2 rounded ${isUrgent ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-500 hover:bg-red-600'}`;
            });
        }

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

        // Tab listeners
        tabBtnSettings.addEventListener('click', () => switchTab('settings'));
        if (tabBtnSurveyDetails) tabBtnSurveyDetails.addEventListener('click', () => switchTab('survey-details'));
        if (tabBtnReassign) tabBtnReassign.addEventListener('click', () => switchTab('reassign'));

        // Bulk modal listeners
        bulkCloseModalButton.addEventListener('click', closeBulkSettingModal);
        bulkCancelButton.addEventListener('click', closeBulkSettingModal);
        bulkSettingForm.addEventListener('submit', handleBulkSave);
        if(bulkCancelAssignmentButton) bulkCancelAssignmentButton.addEventListener('click', closeBulkSettingModal);
        if(bulkCloseAssignmentTabButton) bulkCloseAssignmentTabButton.addEventListener('click', closeBulkSettingModal);
        if(bulkAssignmentForm) bulkAssignmentForm.addEventListener('submit', handleBulkAssignmentSave);
        bulkModal.addEventListener('click', (e) => {
            if (e.target === bulkModal) closeBulkSettingModal();
        });
        document.getElementById('bulk-tab-btn-settings').addEventListener('click', () => switchBulkTab('settings'));
        document.getElementById('bulk-tab-btn-survey-details').addEventListener('click', () => switchBulkTab('survey-details'));
        document.getElementById('bulk-tab-btn-reassign').addEventListener('click', () => switchBulkTab('reassign'));

        const cancelAssignmentBtn = document.getElementById('cancel-assignment-btn');
        if (cancelAssignmentBtn) {
            cancelAssignmentBtn.addEventListener('click', () => {
                const date = state.currentModalDate;
                if (date && state.assignmentOverrides[date]) {
                    delete state.assignmentOverrides[date];
                    renderAll();
                    closeModal();
                    showConfirmationModal(`${date}のアサインを解除しました。`);
                }
            });
        }

        const bulkCancelAssignmentBtn = document.getElementById('bulk-cancel-assignment-btn');
        if (bulkCancelAssignmentBtn) {
            bulkCancelAssignmentBtn.addEventListener('click', () => {
                const { start, end } = getOrderedDateRange();
                if (!start || !end) return;

                let currentDate = new Date(start);
                const lastDate = new Date(end);

                while (currentDate <= lastDate) {
                    const dateString = currentDate.toISOString().split('T')[0];
                    if (state.assignmentOverrides[dateString]) {
                        delete state.assignmentOverrides[dateString];
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }

                renderAll();
                closeBulkSettingModal();
                showConfirmationModal(`${start}から${end}のアサインを解除しました。`);
            });
        }

        const cancelModalButton = document.getElementById('cancel-modal-button');
        if(cancelModalButton) {
            cancelModalButton.addEventListener('click', closeModal);
        }

        const bulkCancelModalButton = document.getElementById('bulk-cancel-modal-button');
        if(bulkCancelModalButton) {
            bulkCancelModalButton.addEventListener('click', closeBulkSettingModal);
        }

        document.getElementById('export-csv-button').addEventListener('click', () => alert('CSVエクスポート機能は現在開発中です。'));
        document.getElementById('import-csv-button').addEventListener('click', () => alert('CSVインポート機能は現在開発中です。'));
        document.getElementById('sync-holidays-button').addEventListener('click', () => alert('祝日API同期を実行しました（シミュレーション）。'));
    }

    init();
}
