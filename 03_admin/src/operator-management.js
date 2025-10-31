/**
 * operator-management.js
 * Operator management page specific javascript
 */
import { debounce } from '../../02_dashboard/src/utils.js';

// --- DUMMY DATA ---
const firstNames = ['太郎', '花子', '次郎', '三郎', '陽葵', '凛', '蒼', '蓮', '湊', '結衣'];
const lastNames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
const roles = ['入力専任', '照合兼任', '管理者'];
const statuses = ['active', 'idle', 'suspended'];
const groups = ['A', 'B', 'C'];

const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

const dummyOperators = [];
for (let i = 1; i <= 200; i++) {
    const id = `op-${String(i).padStart(3, '0')}`;
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const role = roles[Math.floor(Math.random() * roles.length)];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const group = groups[Math.floor(Math.random() * groups.length)];
    const accuracy = (Math.random() * 10 + 90).toFixed(1);
    const todayCompleted = Math.floor(Math.random() * 50);
    const totalCompleted = Math.floor(Math.random() * 1000) + 50;
    const avgProcessingTime = Math.floor(Math.random() * 120) + 30;
    const registrationDate = randomDate(new Date(2023, 0, 1), new Date());
    const lastLoginDate = randomDate(registrationDate, new Date());

    dummyOperators.push({
        id: id,
        name: `${lastName} ${firstName}`,
        email: `user${i}@example.com`,
        role: role,
        group: group,
        currentTaskName: status === 'active' ? `タスク #${Math.floor(Math.random() * 1000)}` : null,
        todayCompleted: status === 'suspended' ? 0 : todayCompleted,
        accuracy: status === 'suspended' ? 0 : parseFloat(accuracy),
        status: status,
        registrationDate: registrationDate.toISOString().split('T')[0],
        lastLoginDate: lastLoginDate.toISOString().split('T')[0],
        totalCompleted: totalCompleted,
        avgProcessingTime: avgProcessingTime,
    });
}

const activeOperators = dummyOperators.filter(op => op.status === 'active').length;
const idleOperators = dummyOperators.filter(op => op.status === 'idle').length;

const dummyKpiData = {
    active: activeOperators,
    idle: idleOperators,
    avgPerDay: 36.4,
    accuracy: 97.3,
};

const dummyHistory = [
    { type: '権限変更', actor: '田中 太郎', message: '山田 向日葵の権限を「照合兼任」に変更しました。', timestamp: '2025/10/30 09:15', color: 'blue-500' },
    { type: '新規招待', actor: '佐藤 花子', message: '新規オペレーター (a.suzuki@example.com) を招待しました。', timestamp: '2025/10/29 17:40', color: 'purple-500' },
];

let currentPage = 1;
let rowsPerPage = 50;
let filteredOperators = [...dummyOperators];
let sortState = { key: null, direction: 'none' };

function displayTablePage() {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedOperators = filteredOperators.slice(start, end);
    renderOperatorTable(paginatedOperators);
    updateSortIcons();
    updatePaginationUI();
}

function renderHistory(history) {
    const panelContent = document.getElementById('history-panel-content');
    if (!panelContent) return;
    panelContent.innerHTML = history.map(item => `
        <div class="border-l-4 border-${item.color} pl-3 py-1">
            <p class="font-semibold text-on-surface text-sm">${item.type}</p>
            <p class="text-on-surface-variant text-sm">${item.message}</p>
            <p class="text-xs text-on-surface-variant/70 mt-1">${item.timestamp}</p>
        </div>
    `).join('');
}

function renderKpi(data) {
    document.getElementById('kpi-active').textContent = data.active;
    document.getElementById('kpi-idle').textContent = data.idle;
    document.getElementById('kpi-avg-per-day').textContent = data.avgPerDay.toFixed(1);
    document.getElementById('kpi-accuracy').textContent = `${data.accuracy.toFixed(1)}%`;
}

function getStatusBadge(status) {
    switch (status) {
        case 'active': return '<span class="status-badge bg-green-100 text-green-800">稼働中</span>';
        case 'idle': return '<span class="status-badge bg-yellow-100 text-yellow-800">待機中</span>';
        case 'suspended': return '<span class="status-badge bg-gray-200 text-gray-700">停止中</span>';
        default: return '';
    }
}

function renderOperatorTable(operators) {
    const tableBody = document.getElementById('operator-table-body');
    if (!tableBody) return;
    if (operators.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="10" class="text-center py-12 text-on-surface-variant">該当するオペレーターが見つかりません。</td></tr>`;
        return;
    }
    tableBody.innerHTML = operators.map(op => `
        <tr class="hover:bg-surface-variant/60" data-operator-id="${op.id}">
            <td class="w-12 px-4 py-3 text-center"><input type="checkbox" class="row-checkbox form-checkbox" data-operator-id="${op.id}"></td>
            <td class="w-32 px-4 py-3 font-medium text-on-surface">${op.name}</td>
            <td class="px-4 py-3 text-on-surface-variant">${op.email}</td>
            <td class="w-24 px-4 py-3 text-on-surface-variant">${op.role}</td>
            <td class="w-32 px-4 py-3 text-on-surface-variant">${op.currentTaskName || '-'}</td>
            <td class="w-24 px-4 py-3 text-on-surface-variant text-right">${op.todayCompleted}</td>
            <td class="w-20 px-4 py-3 text-on-surface-variant text-right">${op.accuracy}%</td>
            <td class="w-24 px-4 py-3 text-on-surface-variant">${getStatusBadge(op.status)}</td>
            <td class="w-80 px-4 py-3 text-center space-x-1">
                <button class="action-btn detail-btn">詳細</button>
                <button class="action-btn suspend-btn">稼働停止</button>
                <button class="action-btn assign-btn">割当</button>
                <button class="action-btn delete-btn text-red-600">削除</button>
            </td>
        </tr>
    `).join('');
}

function updateSortIcons() {
    document.querySelectorAll('.sort-btn').forEach(btn => {
        const icon = btn.querySelector('.material-icons');
        const key = btn.dataset.sortKey;
        if (key === sortState.key) {
            icon.textContent = sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
        } else {
            icon.textContent = 'unfold_more';
        }
    });
}

function updatePaginationUI() {
    const paginationContainer = document.querySelector('nav[aria-label="ページネーション"] ul');
    if (!paginationContainer) return;
    const totalPages = Math.ceil(filteredOperators.length / rowsPerPage);
    paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;
    // Simplified pagination logic
    const createPageLink = (page, text = page, isActive = false, isDisabled = false) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = text;
        a.dataset.page = page;
        a.className = `flex items-center justify-center px-3 h-8 leading-tight `;
        if (isActive) {
            a.className += 'text-blue-600 border border-gray-300 bg-blue-50 hover:bg-blue-100 hover:text-blue-700';
            a.setAttribute('aria-current', 'page');
        } else {
            a.className += 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-100 hover:text-gray-700';
        }
        if (isDisabled) {
            a.classList.add('opacity-50', 'cursor-not-allowed');
            a.removeAttribute('data-page');
        }
        li.appendChild(a);
        return li;
    };
    paginationContainer.appendChild(createPageLink(currentPage - 1, '前へ', false, currentPage === 1));
    for (let i = 1; i <= totalPages; i++) {
        paginationContainer.appendChild(createPageLink(i, i, i === currentPage));
    }
    paginationContainer.appendChild(createPageLink(currentPage + 1, '次へ', false, currentPage === totalPages));
}

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.toggle('hidden', !show);
        modal.classList.toggle('flex', show);
    }
}

export function initOperatorManagementPage() {
    flatpickr.localize(flatpickr.l10ns.ja);
    flatpickr("#registrationDate-range", { mode: "range", dateFormat: "Y-m-d" });
    flatpickr("#lastLoginDate-range", { mode: "range", dateFormat: "Y-m-d" });

    renderKpi(dummyKpiData);
    displayTablePage();
    renderHistory(dummyHistory);

    const historyContainer = document.getElementById('history-container');
    const historyArrowIcon = document.getElementById('history-arrow-icon');
    const filterContainer = document.getElementById('filter-container');
    const filterArrowIcon = document.getElementById('filter-arrow-icon');
    const filterTrigger = document.getElementById('filter-trigger');
    const historyTrigger = document.getElementById('history-trigger');
    const filterForm = document.getElementById('filter-form');

    const openPanel = (panelToShow) => {
        if (panelToShow === 'filter') {
            filterContainer.classList.remove('translate-x-full');
            historyContainer.classList.add('translate-x-full');
            filterArrowIcon.textContent = 'chevron_right';
            historyArrowIcon.textContent = 'chevron_left';
            filterTrigger.style.transform = 'translateX(-28rem)';
            historyTrigger.classList.add('hidden');
            filterTrigger.classList.remove('hidden');
        } else if (panelToShow === 'history') {
            historyContainer.classList.remove('translate-x-full');
            filterContainer.classList.add('translate-x-full');
            historyArrowIcon.textContent = 'chevron_right';
            filterArrowIcon.textContent = 'chevron_left';
            historyTrigger.style.transform = 'translateX(-28rem)';
            filterTrigger.classList.add('hidden');
            historyTrigger.classList.remove('hidden');
        }
    };

    const closeAllPanels = () => {
        filterContainer.classList.add('translate-x-full');
        historyContainer.classList.add('translate-x-full');
        filterArrowIcon.textContent = 'chevron_left';
        historyArrowIcon.textContent = 'chevron_left';
        filterTrigger.style.transform = 'translateX(0)';
        historyTrigger.style.transform = 'translateX(0)';
        filterTrigger.classList.remove('hidden');
        historyTrigger.classList.remove('hidden');
    };

    document.getElementById('open-filter-panel-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isClosed = filterContainer.classList.contains('translate-x-full');
        if (isClosed) {
            openPanel('filter');
        } else {
            closeAllPanels();
        }
    });

    document.getElementById('open-history-panel-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const isClosed = historyContainer.classList.contains('translate-x-full');
        if (isClosed) {
            openPanel('history');
        } else {
            closeAllPanels();
        }
    });

    document.addEventListener('click', (e) => {
        const isFilterOpen = !filterContainer.classList.contains('translate-x-full');
        const isHistoryOpen = !historyContainer.classList.contains('translate-x-full');

        if (!isFilterOpen && !isHistoryOpen) return;

        const filterTriggerBtn = document.getElementById('open-filter-panel-btn');
        const historyTriggerBtn = document.getElementById('open-history-panel-btn');

        const clickedOnFilterTrigger = filterTriggerBtn.contains(e.target);
        const clickedOnHistoryTrigger = historyTriggerBtn.contains(e.target);
        const clickedInFilterPanel = filterContainer.contains(e.target);
        const clickedInHistoryPanel = historyContainer.contains(e.target);

        if (!clickedOnFilterTrigger && !clickedOnHistoryTrigger && !clickedInFilterPanel && !clickedInHistoryPanel) {
            closeAllPanels();
        }
    });

    const applyFiltersAndSearch = () => {
        const formData = new FormData(filterForm);
        const searchTerm = formData.get('search-input')?.toLowerCase() || '';
        const operatorId = formData.get('operator-id')?.toLowerCase() || '';
        const roles = formData.getAll('role');
        const statuses = formData.getAll('status');
        const groups = formData.getAll('group');
        const hasTask = formData.get('hasTask');
        const [regDateStart, regDateEnd] = (formData.get('registrationDate-range') || '').split(' to ');
        const [loginDateStart, loginDateEnd] = (formData.get('lastLoginDate-range') || '').split(' to ');
        const completedMin = formData.get('todayCompleted_min');
        const completedMax = formData.get('todayCompleted_max');
        const totalCompletedMin = formData.get('totalCompleted_min');
        const totalCompletedMax = formData.get('totalCompleted_max');
        const accuracyMin = formData.get('accuracy_min');
        const accuracyMax = formData.get('accuracy_max');
        const avgTimeMin = formData.get('avgProcessingTime_min');
        const avgTimeMax = formData.get('avgProcessingTime_max');

        filteredOperators = dummyOperators.filter(op => {
            const searchMatch = !searchTerm || op.name.toLowerCase().includes(searchTerm) || op.email.toLowerCase().includes(searchTerm);
            const idMatch = !operatorId || op.id.toLowerCase() === operatorId;
            const roleMatch = roles.length === 0 || roles.includes(op.role);
            const statusMatch = statuses.length === 0 || statuses.includes(op.status);
            const groupMatch = groups.length === 0 || groups.includes(op.group);
            const hasTaskMatch = !hasTask || (hasTask === 'yes' && op.currentTaskName) || (hasTask === 'no' && !op.currentTaskName);
            const regDateMatch = (!regDateStart || op.registrationDate >= regDateStart) && (!regDateEnd || op.registrationDate <= regDateEnd);
            const loginDateMatch = (!loginDateStart || op.lastLoginDate >= loginDateStart) && (!loginDateEnd || op.lastLoginDate <= loginDateEnd);
            const completedMinMatch = completedMin === '' || op.todayCompleted >= parseInt(completedMin);
            const completedMaxMatch = completedMax === '' || op.todayCompleted <= parseInt(completedMax);
            const totalCompletedMinMatch = totalCompletedMin === '' || op.totalCompleted >= parseInt(totalCompletedMin);
            const totalCompletedMaxMatch = totalCompletedMax === '' || op.totalCompleted <= parseInt(totalCompletedMax);
            const accuracyMinMatch = accuracyMin === '' || op.accuracy >= parseInt(accuracyMin);
            const accuracyMaxMatch = accuracyMax === '' || op.accuracy <= parseInt(accuracyMax);
            const avgTimeMinMatch = avgTimeMin === '' || op.avgProcessingTime >= parseInt(avgTimeMin);
            const avgTimeMaxMatch = avgTimeMax === '' || op.avgProcessingTime <= parseInt(avgTimeMax);
            return searchMatch && idMatch && roleMatch && statusMatch && groupMatch && hasTaskMatch && regDateMatch && loginDateMatch && completedMinMatch && completedMaxMatch && totalCompletedMinMatch && totalCompletedMaxMatch && accuracyMinMatch && accuracyMaxMatch && avgTimeMinMatch && avgTimeMaxMatch;
        });
        currentPage = 1;
        sortState = { key: null, direction: 'none' };
        displayTablePage();
    };

    filterForm?.addEventListener('input', debounce(applyFiltersAndSearch, 300));

    document.getElementById('reset-filter-btn')?.addEventListener('click', () => {
        filterForm.reset();
        flatpickr("#registrationDate-range", {}).clear();
        flatpickr("#lastLoginDate-range", {}).clear();
        applyFiltersAndSearch();
    });

    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.dataset.sortKey;
            let direction = 'asc';
            if (sortState.key === key) {
                if (sortState.direction === 'asc') direction = 'desc';
                else if (sortState.direction === 'desc') direction = 'none';
            }
            sortState = { key: direction === 'none' ? null : key, direction };
            if (direction === 'none') {
                applyFiltersAndSearch();
            } else {
                filteredOperators.sort((a, b) => {
                    const valA = a[key];
                    const valB = b[key];
                    if (valA === null) return 1;
                    if (valB === null) return -1;
                    if (typeof valA === 'string') {
                        return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
                    } else if (typeof valA === 'number') {
                        return direction === 'asc' ? valA - valB : valB - valA;
                    }
                    return 0;
                });
            }
            currentPage = 1;
            displayTablePage();
        });
    });

    document.getElementById('rows-per-page')?.addEventListener('change', (e) => {
        rowsPerPage = parseInt(e.target.value, 10);
        currentPage = 1;
        displayTablePage();
    });

    document.querySelector('nav[aria-label="ページネーション"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.target.closest('a');
        if (target && target.dataset.page) {
            currentPage = parseInt(target.dataset.page, 10);
            displayTablePage();
        }
    });

    document.getElementById('invite-operator-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('ダミーの招待を送信しました');
        toggleModal('invite-operator-modal', false);
        e.target.reset();
    });

    document.getElementById('operator-table-body')?.addEventListener('click', (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;
        const operatorId = target.closest('tr').dataset.operatorId;
        const operatorName = target.closest('tr').children[1].textContent;
        if (target.classList.contains('delete-btn')) {
            const confirmModalMsg = document.getElementById('confirmation-modal-message');
            if (confirmModalMsg) {
                confirmModalMsg.textContent = `${operatorName}さんの情報を完全に削除します。よろしいですか？`;
            }
            toggleModal('confirmation-modal', true);
        } else {
            alert(`「${target.textContent.trim()}」がクリックされました (ID: ${operatorId})`);
        }
    });
    
    document.getElementById('modal-confirm-action-btn')?.addEventListener('click', () => {
        alert('削除を実行しました（仮）');
        toggleModal('confirmation-modal', false);
    });

    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    selectAllCheckbox?.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.querySelectorAll('.row-checkbox').forEach(checkbox => {
            checkbox.checked = isChecked;
        });
    });

    document.getElementById('operator-table-body')?.addEventListener('change', (e) => {
        if (e.target.classList.contains('row-checkbox')) {
            const allChecked = Array.from(document.querySelectorAll('.row-checkbox')).every(checkbox => checkbox.checked);
            selectAllCheckbox.checked = allChecked;
        }
    });
}
