/**
 * operator-management.js
 * Operator management page specific javascript
 */
import { debounce, showToast } from '../../02_dashboard/src/utils.js';
import { showConfirmationModal } from '../../02_dashboard/src/confirmationModal.js';

// --- DUMMY DATA & CONFIG ---
const affiliations = ['社内', 'Abroad'];
const roles = ['オペレーター(Lv1)', 'オペレーター管理者(Lv2)', 'Abroadスタッフ(Lv3)', 'Abroadマネージャー(Lv4)'];
const statuses = ['active', 'suspended'];
const firstNames = ['太郎', '花子', '次郎', '三郎', '陽葵', '凛', '蒼', '蓮', '湊', '結衣'];
const lastNames = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '山本', '中村', '小林', '加藤'];
const groups = ['A', 'B', 'C'];

const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

let dummyOperators = [];
let opCounter = 0;
let abCounter = 0;

for (let i = 1; i <= 200; i++) {
    const affiliation = affiliations[Math.floor(Math.random() * affiliations.length)];
    let id;
    if (affiliation === 'Abroad') {
        abCounter++;
        id = `ab-${String(abCounter).padStart(3, '0')}`;
    } else {
        opCounter++;
        id = `op-${String(opCounter).padStart(3, '0')}`;
    }

    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    
    let role;
    if (affiliation === 'Abroad') {
        role = roles[Math.floor(Math.random() * 2) + 2];
    } else {
        role = roles[Math.floor(Math.random() * 2)];
    }

    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const group = groups[Math.floor(Math.random() * groups.length)];
    const totalCompleted = Math.floor(Math.random() * 1000) + 50;

    dummyOperators.push({
        id: id,
        name: `${lastName} ${firstName}`,
        email: `user${i}@example.com`,
        affiliation: affiliation,
        role: role,
        group: group,
        status: status,
        registrationDate: randomDate(new Date(2023, 0, 1), new Date()).toISOString().split('T')[0],
        lastLoginDate: randomDate(new Date(2023, 0, 1), new Date()).toISOString().split('T')[0],
        totalCompleted: totalCompleted,
    });
}

const dummyHistory = [
    { type: '権限変更', actor: '田中 太郎', message: '山田 向日葵の権限を「オペレーター管理者(Lv2)」に変更しました。', timestamp: '2025/10/30 09:15', color: 'blue-500' },
    { type: '新規招待', actor: '佐藤 花子', message: '新規オペレーター (a.suzuki@example.com) を招待しました。', timestamp: '2025/10/29 17:40', color: 'purple-500' },
    { type: '削除', actor: 'システム管理者', message: 'オペレーター「伊藤 三郎」を削除しました。', timestamp: '2025/10/29 15:20', color: 'red-500' },
    { type: '情報変更', actor: '田中 太郎', message: 'オペレーター「渡辺 陽葵」の所属を「Abroad」に変更しました。', timestamp: '2025/10/28 11:05', color: 'blue-500' },
    { type: '新規招待', actor: '佐藤 花子', message: '新規オペレーター (y.watanabe@example.com) を招待しました。', timestamp: '2025/10/28 10:00', color: 'purple-500' },
    { type: '権限変更', actor: 'システム管理者', message: '中村 凛の権限を「オペレーター(Lv1)」に変更しました。', timestamp: '2025/10/27 18:00', color: 'blue-500' },
    { type: '削除', actor: 'システム管理者', message: 'オペレーター「小林 蒼」を削除しました。', timestamp: '2025/10/27 14:30', color: 'red-500' },
    { type: '新規招待', actor: '田中 太郎', message: '新規オペレーター (s.kobayashi@example.com) を招待しました。', timestamp: '2025/10/26 09:00', color: 'purple-500' },
    { type: '情報変更', actor: '佐藤 花子', message: 'オペレーター「加藤 蓮」のメールアドレスを変更しました。', timestamp: '2025/10/25 16:20', color: 'blue-500' },
    { type: '権限変更', actor: '田中 太郎', message: '山本 湊の権限を「オペレーター管理者(Lv2)」に変更しました。', timestamp: '2025/10/25 10:10', color: 'blue-500' },
];

let currentPage = 1;
let rowsPerPage = 25;
let filteredOperators = [...dummyOperators];
let sortState = { key: null, direction: 'none' };
let applyFiltersAndSearch;

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
    // Show latest history first
    panelContent.innerHTML = [...history].reverse().map(item => `
        <div class="border-l-4 border-${item.color} pl-3 py-1">
            <p class="font-semibold text-on-surface text-sm">${item.type}</p>
            <p class="text-on-surface-variant text-sm">${item.message}</p>
            <p class="text-xs text-on-surface-variant/70 mt-1">${item.timestamp}</p>
        </div>
    `).join('');
}

function getStatusBadge(status) {
    switch (status) {
        case 'active': return '<span class="status-badge bg-green-100 text-green-800">稼働中</span>';
        case 'suspended': return '<span class="status-badge bg-gray-200 text-gray-700">停止中</span>';
        default: return '';
    }
}

function renderOperatorTable(operators) {
    const tableBody = document.getElementById('operator-table-body');
    if (!tableBody) return;
    if (operators.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-12 text-on-surface-variant">該当するオペレーターが見つかりません。</td></tr>`;
        return;
    }
    tableBody.innerHTML = operators.map(op => `
        <tr class="hover:bg-surface-variant/60" data-operator-id="${op.id}">
            <td class="w-12 px-4 py-3 text-center"><input type="checkbox" class="row-checkbox form-checkbox" data-operator-id="${op.id}"></td>
            <td class="px-4 py-3 font-medium text-on-surface">${op.name}</td>
            <td class="px-4 py-3 text-on-surface-variant">${op.email}</td>
            <td class="w-48 px-4 py-3 text-on-surface-variant">${op.role}</td>
            <td class="w-32 px-4 py-3 text-on-surface-variant text-right">${op.totalCompleted}</td>
            <td class="w-32 px-4 py-3 text-on-surface-variant">${getStatusBadge(op.status)}</td>
            <td class="w-40 px-4 py-3 text-center space-x-1">
                <button class="action-btn detail-btn border border-outline-variant bg-surface text-on-surface-variant px-3 py-1.5 rounded-md text-sm">詳細</button>
                <button class="action-btn delete-btn border border-outline-variant bg-surface text-red-600 px-3 py-1.5 rounded-md text-sm">削除</button>
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

function initToolboxTabs() {
    const tabs = document.querySelectorAll('.toolbox-tab');
    const tabPanels = document.querySelectorAll('[role="tabpanel"]');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            tabPanels.forEach(p => p.classList.add('hidden'));
            document.getElementById(tab.getAttribute('aria-controls')).classList.remove('hidden');
        });
    });
}

function populateFilterRoles() {
    const container = document.getElementById('filter-roles-container');
    if (!container) return;
    container.innerHTML = roles.map(role => `
        <label class="form-check-label">
            <input type="checkbox" class="form-checkbox" name="role" value="${role}"> ${role}
        </label>
    `).join('');
}

function initInviteOperatorModal() {
    const modalContainer = document.getElementById('invite-operator-modal');
    if (!modalContainer) return;

    const modalHTML = `
        <div class="relative bg-surface rounded-xl shadow-2xl w-full max-w-lg p-6 m-4">
            <button id="close-invite-modal-btn" class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"><span class="material-icons">close</span></button>
            <h3 class="text-headline-small font-semibold mb-4">新規オペレーター招待</h3>
            <form id="invite-operator-form">
                <div class="space-y-4">
                    <div class="space-y-1">
                        <label for="affiliation" class="form-label">所属</label>
                        <select id="affiliation" name="affiliation" class="form-select w-full">
                            ${affiliations.map(a => `<option value="${a}">${a}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label for="role" class="form-label">権限</label>
                        <select id="role" name="role" class="form-select w-full">
                             ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label for="email" class="form-label">メールアドレス</label>
                        <input type="email" id="email" name="email" class="form-input w-full" required>
                    </div>
                    <div class="space-y-1">
                        <label for="name" class="form-label">オペレーター名</label>
                        <input type="text" id="name" name="name" class="form-input w-full" required>
                    </div>
                </div>
                <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-outline-variant">
                    <button type="button" id="cancel-invite-btn" class="border border-outline-variant bg-surface text-on-surface-variant px-3 py-1.5 rounded-md text-sm">キャンセル</button>
                    <button type="submit" class="button-primary text-on-primary py-2 px-4 rounded-md shadow-sm text-sm font-semibold leading-normal transition-colors">招待を送信</button>
                </div>
            </form>
        </div>
    `;
    modalContainer.innerHTML = modalHTML;

    document.getElementById('open-invite-modal-btn')?.addEventListener('click', () => toggleModal('invite-operator-modal', true));
    document.getElementById('close-invite-modal-btn')?.addEventListener('click', () => toggleModal('invite-operator-modal', false));
    document.getElementById('cancel-invite-btn')?.addEventListener('click', () => toggleModal('invite-operator-modal', false));
    
    document.getElementById('invite-operator-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const affiliation = formData.get('affiliation');
        
        let newId;
        if (affiliation === 'Abroad') {
            abCounter++;
            newId = `ab-${String(abCounter).padStart(3, '0')}`;
        } else {
            opCounter++;
            newId = `op-${String(opCounter).padStart(3, '0')}`;
        }

        const newOperator = {
            id: newId,
            name: formData.get('name'),
            email: formData.get('email'),
            affiliation: affiliation,
            role: formData.get('role'),
            group: groups[Math.floor(Math.random() * groups.length)],
            status: 'active',
            registrationDate: new Date().toISOString().split('T')[0],
            lastLoginDate: new Date().toISOString().split('T')[0],
            totalCompleted: 0,
        };

        dummyOperators.unshift(newOperator);

        // Add to history
        dummyHistory.push({
            type: '新規招待',
            actor: '（現在の管理者）', // Replace with actual admin user later
            message: `新規オペレーター「${newOperator.name}」(${newOperator.email}) を招待しました。`,
            timestamp: new Date().toLocaleString('ja-JP'),
            color: 'purple-500'
        });
        renderHistory(dummyHistory);

        applyFiltersAndSearch();
        
        alert(`新規オペレーター「${newOperator.name}」を招待しました。(ID: ${newOperator.id})`);
        toggleModal('invite-operator-modal', false);
        e.target.reset();
    });
}

function initEditOperatorModal() {
    const modalContainer = document.getElementById('edit-operator-modal');
    if (!modalContainer) return;

    const modalHTML = `
        <div class="relative bg-surface rounded-xl shadow-2xl w-full max-w-2xl p-6 m-4">
            <button id="close-edit-modal-btn" class="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface"><span class="material-icons">close</span></button>
            <h3 class="text-headline-small font-semibold mb-4">オペレーター情報編集</h3>
            <form id="edit-operator-form">
                <input type="hidden" name="id">
                <div class="grid grid-cols-1 gap-6">
                    <div class="space-y-1">
                        <label for="edit-name" class="form-label">オペレーター名</label>
                        <input type="text" id="edit-name" name="name" class="form-input w-full">
                    </div>
                    <div class="space-y-1">
                        <label for="edit-email" class="form-label">メールアドレス</label>
                        <input type="email" id="edit-email" name="email" class="form-input w-full">
                    </div>
                    <div class="space-y-1">
                        <label for="edit-affiliation" class="form-label">所属</label>
                        <select id="edit-affiliation" name="affiliation" class="form-select w-full">
                            ${affiliations.map(a => `<option value="${a}">${a}</option>`).join('')}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label for="edit-role" class="form-label">権限</label>
                        <select id="edit-role" name="role" class="form-select w-full">
                            ${roles.map(r => `<option value="${r}">${r}</option>`).join('')}
                        </select>
                    </div>
                </div>

                <div class="mt-6 pt-6 border-t border-outline-variant">
                    <h4 class="text-title-medium font-semibold mb-4">パスワード管理</h4>
                    <div class="flex flex-wrap gap-4 items-center">
                        <button type="button" id="password-change-btn" class="border border-outline-variant bg-surface text-on-surface-variant px-3 py-1.5 rounded-md text-sm">パスワード変更</button>
                        <button type="button" id="password-reset-btn" class="border border-outline-variant bg-surface text-on-surface-variant px-3 py-1.5 rounded-md text-sm">パスワード初期化メール送信</button>
                    </div>
                </div>

                <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-outline-variant">
                    <button type="button" id="cancel-edit-btn" class="border border-outline-variant bg-surface text-on-surface-variant px-3 py-1.5 rounded-md text-sm">キャンセル</button>
                    <button type="submit" class="button-primary text-on-primary py-2 px-4 rounded-md shadow-sm text-sm font-semibold leading-normal transition-colors">変更を保存</button>
                </div>
            </form>
        </div>
    `;
    modalContainer.innerHTML = modalHTML;

    document.getElementById('close-edit-modal-btn')?.addEventListener('click', () => toggleModal('edit-operator-modal', false));
    document.getElementById('cancel-edit-btn')?.addEventListener('click', () => toggleModal('edit-operator-modal', false));

    document.getElementById('password-change-btn')?.addEventListener('click', () => {
        showConfirmationModal('新しいパスワードを入力してください。', (newPassword) => {
            if (newPassword) { // Check if user entered a password
                // In a real app, you would send this to the server.
                console.log(`New password for operator: ${newPassword}`); // For demonstration
                showToast('パスワードが変更されました。', 'success');
            }
        }, {
            title: 'パスワード変更',
            confirmText: '保存',
            cancelText: 'キャンセル',
            prompt: {
                type: 'password',
                label: '新しいパスワード'
            }
        });
    });

    document.getElementById('password-reset-btn')?.addEventListener('click', () => {
        showConfirmationModal('パスワードリセットメールを送信します。よろしいですか？', () => {
            showToast('パスワードリセットメールを送信しました。', 'success');
            // In a real app, you would trigger a server-side email action.
        }, {
            title: 'パスワードリセットメール送信の確認',
            confirmText: '送信',
            cancelText: 'キャンセル',
        });
    });

    document.getElementById('edit-operator-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const operatorId = formData.get('id');
        const operatorIndex = dummyOperators.findIndex(op => op.id === operatorId);
        if (operatorIndex === -1) return;

        const originalOperator = { ...dummyOperators[operatorIndex] };

        const updatedFields = {
            name: formData.get('name'),
            email: formData.get('email'),
            affiliation: formData.get('affiliation'),
            role: formData.get('role'),
        };

        dummyOperators[operatorIndex] = { ...dummyOperators[operatorIndex], ...updatedFields };

        // --- History Logging ---
        const changes = [];
        if (originalOperator.name !== updatedFields.name) changes.push(`氏名を「${updatedFields.name}」に変更`);
        if (originalOperator.email !== updatedFields.email) changes.push(`メールを「${updatedFields.email}」に変更`);
        if (originalOperator.affiliation !== updatedFields.affiliation) changes.push(`所属を「${updatedFields.affiliation}」に変更`);
        if (originalOperator.role !== updatedFields.role) changes.push(`権限を「${updatedFields.role}」に変更`);

        if (changes.length > 0) {
            dummyHistory.push({
                type: '情報変更',
                actor: '（現在の管理者）',
                message: `オペレーター「${originalOperator.name}」(ID: ${operatorId}) の情報を変更しました：\n- ${changes.join('\n- ')}`,
                timestamp: new Date().toLocaleString('ja-JP'),
                color: 'blue-500'
            });
            renderHistory(dummyHistory);
        }
        
        applyFiltersAndSearch();
        toggleModal('edit-operator-modal', false);
        showToast('オペレーター情報が更新されました。', 'success');
    });
}

function openEditModal(operator) {
    const form = document.getElementById('edit-operator-form');
    if (!form) return;

    form.elements.id.value = operator.id;
    form.elements.name.value = operator.name;
    form.elements.email.value = operator.email;
    form.elements.affiliation.value = operator.affiliation;
    form.elements.role.value = operator.role;

    toggleModal('edit-operator-modal', true);
}

function adjustHistoryPanelHeight() {
    const historyPanel = document.getElementById('history-panel-content');
    if (!historyPanel) return;

    const topOffset = historyPanel.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    
    // Calculate available height considering some bottom padding (24px)
    const availableHeight = viewportHeight - topOffset - 24;
    
    // Set a reasonable minimum height
    const minHeight = 150; // 150px

    historyPanel.style.height = `${Math.max(availableHeight, minHeight)}px`;
}

export function initOperatorManagementPage() {
    rowsPerPage = parseInt(document.getElementById('rows-per-page')?.value || '25', 10);
    flatpickr.localize(flatpickr.l10ns.ja);
    flatpickr("#registrationDate-range", { mode: "range", dateFormat: "Y-m-d" });

    // Adjust history panel height on load and resize
    adjustHistoryPanelHeight();
    window.addEventListener('resize', debounce(adjustHistoryPanelHeight, 150));

    const filterForm = document.getElementById('filter-form');

    applyFiltersAndSearch = () => {
        const formData = new FormData(filterForm);
        const searchTerm = formData.get('search-input')?.toLowerCase() || '';
        const roles = formData.getAll('role');
        const statuses = formData.getAll('status');
        const groups = formData.getAll('group');
        const [regDateStart, regDateEnd] = (formData.get('registrationDate-range') || '').split(' to ');
        const totalCompletedMin = formData.get('totalCompleted_min');
        const totalCompletedMax = formData.get('totalCompleted_max');

        filteredOperators = dummyOperators.filter(op => {
            const searchMatch = !searchTerm || 
                op.name.toLowerCase().includes(searchTerm) || 
                op.email.toLowerCase().includes(searchTerm) ||
                op.id.toLowerCase().includes(searchTerm);
            const roleMatch = roles.length === 0 || roles.includes(op.role);
            const statusMatch = statuses.length === 0 || statuses.includes(op.status);
            const groupMatch = groups.length === 0 || groups.includes(op.group);
            const regDateMatch = (!regDateStart || op.registrationDate >= regDateStart) && (!regDateEnd || op.registrationDate <= regDateEnd);
            const totalCompletedMinMatch = totalCompletedMin === '' || op.totalCompleted >= parseInt(totalCompletedMin);
            const totalCompletedMaxMatch = totalCompletedMax === '' || op.totalCompleted <= parseInt(totalCompletedMax);
            
            return searchMatch && roleMatch && statusMatch && groupMatch && regDateMatch && totalCompletedMinMatch && totalCompletedMaxMatch;
        });
        currentPage = 1;
        sortState = { key: null, direction: 'none' };
        displayTablePage();
    };

    displayTablePage();
    renderHistory(dummyHistory);
    
    initToolboxTabs();
    populateFilterRoles();
    initInviteOperatorModal();
    initEditOperatorModal();
    initCollapsibleToolbox(); // Keep the sliding panel logic
    adjustPagePaddingForFooter(); // Add padding for footer

    filterForm?.addEventListener('input', debounce(applyFiltersAndSearch, 300));

    document.getElementById('reset-filter-btn')?.addEventListener('click', () => {
        filterForm.reset();
        flatpickr("#registrationDate-range", {}).clear();
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
                filteredOperators = [...dummyOperators];
                 applyFiltersAndSearch();
            } else {
                filteredOperators.sort((a, b) => {
                    const valA = a[key];
                    const valB = b[key];
                    if (valA === null || valA === undefined) return 1;
                    if (valB === null || valB === undefined) return -1;
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

    document.getElementById('operator-table-body')?.addEventListener('click', (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;
        const operatorId = target.closest('tr').dataset.operatorId;
        const operatorName = target.closest('tr').children[1].textContent;
        if (target.classList.contains('delete-btn')) {
            const message = `${operatorName}さんの情報を完全に削除します。よろしいですか？`;
            const onConfirm = () => {
                const operatorToDelete = dummyOperators.find(op => op.id === operatorId);
                dummyOperators = dummyOperators.filter(op => op.id !== operatorId);
                
                // Add to history
                if(operatorToDelete){
                    dummyHistory.push({
                        type: '削除',
                        actor: '（現在の管理者）', // Replace with actual admin user later
                        message: `オペレーター「${operatorToDelete.name}」(ID: ${operatorId}) を削除しました。`,
                        timestamp: new Date().toLocaleString('ja-JP'),
                        color: 'red-500'
                    });
                    renderHistory(dummyHistory);
                }

                applyFiltersAndSearch();
                showToast('削除を実行しました', 'success');
            };

            showConfirmationModal(message, onConfirm, {
                title: '削除の確認',
                confirmText: '削除',
                cancelText: 'キャンセル',
            });
        } else if (target.classList.contains('detail-btn')) {
            const operator = dummyOperators.find(op => op.id === operatorId);
            if (operator) {
                openEditModal(operator);
            }
        }
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
            if (!e.target.checked) {
                selectAllCheckbox.checked = false;
            } else {
                const allChecked = Array.from(document.querySelectorAll('.row-checkbox')).every(checkbox => checkbox.checked);
                selectAllCheckbox.checked = allChecked;
            }
        }
    });
}

/**
 * Initializes the collapsible toolbox functionality.
 */
function initCollapsibleToolbox() {
    const toggleBtn = document.getElementById('toolbox-toggle-btn');
    const toolboxAside = document.getElementById('toolbox-aside');
    const mainContent = document.getElementById('main-content');
    const btnIcon = toggleBtn.querySelector('.material-icons');

    if (!toggleBtn || !toolboxAside || !mainContent || !btnIcon) {
        console.error('Toolbox elements not found');
        return;
    }

    // Default state is open
    let isToolboxOpen = true;

    const updateToolboxState = () => {
        if (isToolboxOpen) {
            // OPEN STATE
            toolboxAside.classList.remove('translate-x-full');
            toggleBtn.style.right = '36rem';
            btnIcon.textContent = 'chevron_left';
        } else {
            // CLOSED STATE
            toolboxAside.classList.add('translate-x-full');
            toggleBtn.style.right = '0';
            btnIcon.textContent = 'chevron_right';
        }
    };

    toggleBtn.addEventListener('click', () => {
        isToolboxOpen = !isToolboxOpen;
        updateToolboxState();
    });

    // Initial setup
    updateToolboxState();
}

/**
 * Adjusts the main content padding to prevent the static footer from overlapping content.
 */
function adjustPagePaddingForFooter() {
    const mainContent = document.querySelector('main');
    const footer = document.getElementById('main-footer');

    if (!mainContent || !footer) {
        return;
    }

    const adjustPadding = () => {
        const footerHeight = footer.offsetHeight;
        mainContent.style.paddingBottom = `${footerHeight}px`;
    };

    // Adjust on initial load, after a short delay to ensure footer is rendered.
    setTimeout(adjustPadding, 200);

    // Adjust on window resize.
    window.addEventListener('resize', debounce(adjustPadding, 150));
}
