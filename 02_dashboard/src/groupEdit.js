import { showToast } from './utils.js';
import { showConfirmationModal } from './confirmationModal.js';
import { handleOpenModal, closeModal } from './modalHandler.js';

// DOM要素
const elements = {
    groupSelector: document.getElementById('groupSelector'),
    groupName: document.getElementById('groupName'),
    groupDescription: document.getElementById('groupDescription'),
    useCreatorBillingBtn: document.getElementById('use-creator-billing-btn'),
    useGroupBillingBtn: document.getElementById('use-group-billing-btn'),
    creatorBillingInfo: document.getElementById('creator-billing-info'),
    groupBillingInfo: document.getElementById('group-billing-info'),
    groupBillingDisplay: document.getElementById('group-billing-display'),
    groupBillingForm: document.getElementById('group-billing-form'),
    editGroupBillingBtn: document.getElementById('edit-group-billing-btn'),
    saveGroupBillingBtn: document.getElementById('save-group-billing-btn'),
    cancelGroupBillingBtn: document.getElementById('cancel-group-billing-btn'),
    memberList: document.getElementById('member-list'),
    newMemberEmail: document.getElementById('newMemberEmail'),
    newMemberRole: document.getElementById('newMemberRole'),
    addMemberBtn: document.getElementById('add-member-btn'),
    saveBtn: document.getElementById('save-btn'),
    cancelBtn: document.getElementById('cancel-btn'),
    sortByRoleBtn: document.getElementById('sort-by-role-btn'),
    sortByStatusBtn: document.getElementById('sort-by-status-btn'),
    resetSortBtn: document.getElementById('reset-sort-btn'),
    sortIndicatorRole: document.getElementById('sort-indicator-role'),
    sortIndicatorStatus: document.getElementById('sort-indicator-status'),
    creatorBilling: {
        contactName: document.querySelector('#creator-billing-info [data-field="contactName"]'),
        department: document.querySelector('#creator-billing-info [data-field="department"]'),
        phone: document.querySelector('#creator-billing-info [data-field="phone"]'),
        postalCode: document.querySelector('#creator-billing-info [data-field="postalCode"]'),
        address: document.querySelector('#creator-billing-info [data-field="address"]'),
    },
    groupBillingDisplayFields: {
        contactName: document.querySelector('#group-billing-display [data-field="contactName"]'),
        department: document.querySelector('#group-billing-display [data-field="department"]'),
        phone: document.querySelector('#group-billing-display [data-field="phone"]'),
        postalCode: document.querySelector('#group-billing-display [data-field="postalCode"]'),
        address: document.querySelector('#group-billing-display [data-field="address"]'),
    },
    groupBillingFormFields: {
        contactName: document.getElementById('group-billing-contact-name'),
        department: document.getElementById('group-billing-department'),
        phone: document.getElementById('group-billing-phone'),
        postalCode: document.getElementById('group-billing-postal-code'),
        address1: document.getElementById('group-billing-address1'),
    }
};

// アプリケーションの状態
let state = {
    isDirty: false,
    isBillingFormDirty: false,
    allGroupsData: {},
    currentGroupId: null,
    creatorBillingInfo: null,
    currentSort: { key: null, order: 'asc' },
};

function setDirty(dirty) {
    if (state.isDirty === dirty) return;
    state.isDirty = dirty;
    elements.saveBtn.disabled = !dirty;
}

function setBillingDirty(dirty) {
    state.isBillingFormDirty = dirty;
}

function createMemberCardHTML(member) {
    const roleOptions = ['管理者', '一般']
        .map(r => `<option value="${r}" ${member.role === r ? 'selected' : ''}>${r}</option>`).join('');
    let statusBadge;
    switch (member.status) {
        case 'グループ加入済':
            statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">${member.status}</span>`;
            break;
        case 'グループ招待中':
            statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">${member.status}</span>`;
            break;
        case 'アドレスエラー':
            statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-200 text-red-800">${member.status}</span>`;
            break;
        default:
            statusBadge = `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">${member.status}</span>`;
    }
    return `
        <div class="member-card flex items-center gap-4 p-3 bg-surface-bright rounded-lg border border-outline-variant hover:bg-surface-container-low transition-colors cursor-pointer" data-member-id="${member.email}">
            <span class="material-icons drag-handle text-on-surface-variant">drag_indicator</span>
            <img src="${member.avatarUrl}" alt="アバター" class="w-10 h-10 rounded-full">
            <div class="flex-grow">
                <p class="font-semibold text-on-surface">${member.name}</p>
                <p class="text-sm text-on-surface-variant">${member.email}</p>
            </div>
            <div class="input-group w-32">
                <select class="input-field">${roleOptions}</select>
                <label class="input-label">権限</label>
            </div>
            ${statusBadge}
            <button class="icon-button delete-member-btn" aria-label="メンバーを削除" data-email="${member.email}">
                <span class="material-icons">delete_outline</span>
            </button>
        </div>
    `;
}

function renderMemberList(members) {
    if (!elements.memberList) return;
    elements.memberList.innerHTML = members.map(createMemberCardHTML).join('');
    new Sortable(elements.memberList, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        onEnd: () => {
            state.currentSort.key = null; // Reset sort on manual drag
            updateSortIndicators();
            setDirty(true);
        },
    });
}

function renderBillingInfo() {
    const currentGroupData = state.allGroupsData[state.currentGroupId];
    const { creatorBillingInfo } = state;

    elements.creatorBilling.contactName.textContent = creatorBillingInfo.name;
    elements.creatorBilling.department.textContent = creatorBillingInfo.department;
    elements.creatorBilling.phone.textContent = creatorBillingInfo.phone;
    elements.creatorBilling.postalCode.textContent = creatorBillingInfo.postalCode;
    elements.creatorBilling.address.textContent = creatorBillingInfo.address;

    elements.groupBillingDisplayFields.contactName.textContent = currentGroupData.billingInfo.contactName;
    elements.groupBillingDisplayFields.department.textContent = currentGroupData.billingInfo.department;
    elements.groupBillingDisplayFields.phone.textContent = currentGroupData.billingInfo.phone;
    elements.groupBillingDisplayFields.postalCode.textContent = currentGroupData.billingInfo.postalCode;
    elements.groupBillingDisplayFields.address.textContent = currentGroupData.billingInfo.address1;
    
    elements.groupBillingFormFields.contactName.value = currentGroupData.billingInfo.contactName;
    elements.groupBillingFormFields.department.value = currentGroupData.billingInfo.department;
    elements.groupBillingFormFields.phone.value = currentGroupData.billingInfo.phone;
    elements.groupBillingFormFields.postalCode.value = currentGroupData.billingInfo.postalCode;
    elements.groupBillingFormFields.address1.value = currentGroupData.billingInfo.address1;
}

function renderPage() {
    const currentGroupData = state.allGroupsData[state.currentGroupId];
    if (!currentGroupData) return;

    elements.groupName.value = currentGroupData.name;
    elements.groupDescription.value = currentGroupData.description;

    updateBillingToggleUI(currentGroupData.useGroupBilling, false);
    renderBillingInfo();
    renderMemberList(currentGroupData.members);
    toggleGroupBillingForm(false);
    state.currentSort = { key: null, order: 'asc' };
    updateSortIndicators();
    setDirty(false);
    setBillingDirty(false);
}

function updateBillingToggleUI(showGroupBilling, isUserAction = true) {
    const currentGroupData = state.allGroupsData[state.currentGroupId];
    currentGroupData.useGroupBilling = showGroupBilling;

    if (showGroupBilling) {
        elements.useGroupBillingBtn.classList.add('bg-secondary-container', 'text-on-secondary-container');
        elements.useGroupBillingBtn.classList.remove('text-on-surface-variant');
        elements.useCreatorBillingBtn.classList.remove('bg-secondary-container', 'text-on-secondary-container');
        elements.useCreatorBillingBtn.classList.add('text-on-surface-variant');
        elements.creatorBillingInfo.classList.add('hidden');
        elements.groupBillingInfo.classList.remove('hidden');
    } else {
        elements.useCreatorBillingBtn.classList.add('bg-secondary-container', 'text-on-secondary-container');
        elements.useCreatorBillingBtn.classList.remove('text-on-surface-variant');
        elements.useGroupBillingBtn.classList.remove('bg-secondary-container', 'text-on-secondary-container');
        elements.useGroupBillingBtn.classList.add('text-on-surface-variant');
        elements.creatorBillingInfo.classList.remove('hidden');
        elements.groupBillingInfo.classList.add('hidden');
    }
    if (isUserAction) setDirty(true);
}

function toggleGroupBillingForm(showForm) {
    if (showForm) {
        setBillingDirty(false);
        elements.groupBillingDisplay.classList.add('hidden');
        elements.groupBillingForm.classList.remove('hidden');
    } else {
        elements.groupBillingDisplay.classList.remove('hidden');
        elements.groupBillingForm.classList.add('hidden');
    }
}

function populateMemberDetailModal(member) {
    const contentEl = document.getElementById('member-details-content');
    if (!contentEl) return;

    const detailItem = (label, value) => value ? `<div class="py-2"><p class="text-sm text-on-surface-variant">${label}</p><p class="text-on-surface font-medium">${value}</p></div>` : '';

    contentEl.innerHTML = `
        <div class="flex items-center gap-4 mb-6 pb-4 border-b border-outline-variant">
            <img src="${member.avatarUrl}" alt="アバター" class="w-16 h-16 rounded-full">
            <div class="flex-grow">
                <p class="text-xl font-bold text-on-surface">${member.name}</p>
                <p class="text-sm text-on-surface-variant">${member.email}</p>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-x-6 gap-y-1">
            ${detailItem('権限', member.role)}
            ${detailItem('ステータス', member.status)}
            <div class="col-span-2">${detailItem('会社名', member.companyName)}</div>
            ${detailItem('部署名', member.departmentName)}
            ${detailItem('役職', member.positionName)}
            <div class="col-span-2">${detailItem('電話番号', member.phoneNumber)}</div>
            <div class="col-span-2">${detailItem('住所', member.address)}</div>
        </div>
    `;
}

function initAccordions() {
    const headers = document.querySelectorAll('.section-header');
    headers.forEach(header => {
        header.addEventListener('click', () => {
            const content = header.nextElementSibling;
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', !isExpanded);
            content.classList.toggle('hidden');
        });
    });
}

function updateSortIndicators() {
    const { key, order } = state.currentSort;
    elements.sortIndicatorRole.textContent = '';
    elements.sortIndicatorStatus.textContent = '';

    if (key === 'role') {
        elements.sortIndicatorRole.textContent = order === 'asc' ? 'arrow_upward' : 'arrow_downward';
    } else if (key === 'status') {
        elements.sortIndicatorStatus.textContent = order === 'asc' ? 'arrow_upward' : 'arrow_downward';
    }
}

function handleSort(key) {
    if (state.currentSort.key === key) {
        state.currentSort.order = state.currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        state.currentSort.key = key;
        state.currentSort.order = 'asc';
    }

    const currentGroupData = state.allGroupsData[state.currentGroupId];
    const members = currentGroupData.members;
    const orderFactor = state.currentSort.order === 'asc' ? 1 : -1;

    if (key === 'role') {
        members.sort((a, b) => {
            if (a.role === b.role) return 0;
            return (a.role === '管理者' ? -1 : 1) * orderFactor;
        });
    } else if (key === 'status') {
        const statusOrder = { 'グループ加入済': 1, 'グループ招待中': 2, 'アドレスエラー': 3 };
        members.sort((a, b) => {
            const orderA = statusOrder[a.status] || 99;
            const orderB = statusOrder[b.status] || 99;
            return (orderA - orderB) * orderFactor;
        });
    }

    renderMemberList(members);
    updateSortIndicators();
    setDirty(true);
}

function setupEventListeners() {
    // Dirty state listeners
    ['groupName', 'groupDescription'].forEach(id => elements[id]?.addEventListener('input', () => setDirty(true)));
    Object.values(elements.groupBillingFormFields).forEach(el => el?.addEventListener('input', () => setBillingDirty(true)));
    elements.memberList.addEventListener('change', e => e.target.tagName === 'SELECT' && setDirty(true));

    // Group selector
    elements.groupSelector.addEventListener('change', (e) => {
        const newGroupId = e.target.value;
        const switchGroup = () => {
            state.currentGroupId = newGroupId;
            renderPage();
        };

        if (state.isDirty) {
            showConfirmationModal('変更が保存されていません。切り替えますか？', switchGroup);
        } else {
            switchGroup();
        }
    });

    // Billing section listeners
    elements.useCreatorBillingBtn.addEventListener('click', () => updateBillingToggleUI(false));
    elements.useGroupBillingBtn.addEventListener('click', () => updateBillingToggleUI(true));
    elements.editGroupBillingBtn.addEventListener('click', () => toggleGroupBillingForm(true));
    
    elements.cancelGroupBillingBtn.addEventListener('click', () => {
        const cancelAction = () => {
            renderBillingInfo(); 
            toggleGroupBillingForm(false);
        };
        if (state.isBillingFormDirty) {
            showConfirmationModal('編集中の内容を破棄しますか？', cancelAction);
        } else {
            cancelAction();
        }
    });

    elements.saveGroupBillingBtn.addEventListener('click', () => {
        const form = elements.groupBillingFormFields;
        const currentGroupData = state.allGroupsData[state.currentGroupId];
        currentGroupData.billingInfo = {
            contactName: form.contactName.value,
            department: form.department.value,
            phone: form.phone.value,
            postalCode: form.postalCode.value,
            address1: form.address1.value,
            address2: ''
        };
        renderBillingInfo();
        toggleGroupBillingForm(false);
        setDirty(true);
        showToast('請求先情報を更新しました。', 'success');
    });

    // Member list listeners
    elements.memberList.addEventListener('click', e => {
        const target = e.target;
        const memberCard = target.closest('.member-card');
        if (!memberCard) return;

        const memberId = memberCard.dataset.memberId;
        const currentGroupData = state.allGroupsData[state.currentGroupId];
        const member = currentGroupData.members.find(m => m.email === memberId);

        if (target.closest('.delete-member-btn')) {
            showConfirmationModal(`メンバー「${member.name}」を削除しますか？`, () => {
                currentGroupData.members = currentGroupData.members.filter(m => m.email !== memberId);
                currentGroupData.originalMembers = currentGroupData.originalMembers.filter(m => m.email !== memberId);
                renderMemberList(currentGroupData.members);
                setDirty(true);
                showToast('メンバーを削除しました。', 'success');
            });
        } else if (!target.closest('select, button, a')) {
            handleOpenModal('memberDetailModal', 'modals/memberDetailModal.html').then(() => {
                if (member) populateMemberDetailModal(member);
            });
        }
    });

    // Add member button
    elements.addMemberBtn.addEventListener('click', () => {
        const email = elements.newMemberEmail.value.trim();
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            showToast('有効なメールアドレスを入力してください。', 'error');
            return;
        }
        const newMember = {
            email,
            role: elements.newMemberRole.value,
            name: email.split('@')[0],
            status: 'グループ招待中',
            avatarUrl: `https://i.pravatar.cc/40?u=${email}`,
        };
        state.allGroupsData[state.currentGroupId].members.push(newMember);
        state.allGroupsData[state.currentGroupId].originalMembers.push(newMember);
        renderMemberList(state.allGroupsData[state.currentGroupId].members);
        elements.newMemberEmail.value = '';
        setDirty(true);
    });

    // Main action buttons
    elements.saveBtn.addEventListener('click', () => {
        if (!state.isDirty) return;
        console.log('Saving data:', state.allGroupsData[state.currentGroupId]);
        showToast('グループ情報を保存しました。', 'success');
        setDirty(false);
    });
    elements.cancelBtn.addEventListener('click', () => {
        if (state.isDirty) {
            showConfirmationModal('編集内容を破棄しますか？', () => window.location.reload());
        } else {
            window.location.reload();
        }
    });

    // Sort buttons
    elements.sortByRoleBtn.addEventListener('click', () => handleSort('role'));
    elements.sortByStatusBtn.addEventListener('click', () => handleSort('status'));
    elements.resetSortBtn.addEventListener('click', () => {
        const currentGroupData = state.allGroupsData[state.currentGroupId];
        currentGroupData.members = [...currentGroupData.originalMembers];
        state.currentSort = { key: null, order: 'asc' };
        renderMemberList(currentGroupData.members);
        updateSortIndicators();
        setDirty(true);
    });
}

const generateDummyMembers = (count, startIndex = 1) => {
    const members = [];
    const roles = ['一般', '一般', '一般', '管理者'];
    const statuses = ['グループ加入済', 'グループ加入済', 'グループ加入済', 'グループ招待中', 'アドレスエラー'];
    const surnames = ['佐藤', '鈴木', '高橋', '田中', '渡辺', '伊藤', '山本', '中村', '小林', '加藤'];
    const givenNames = ['太郎', '花子', '一郎', '美咲', '健太', '彩', '大輔', '真由美', '誠', '恵'];
    const companies = ['株式会社A', '合同会社B', '株式会社C', '有限会社D', '株式会社E'];
    const departments = ['営業部', '開発部', 'マーケティング部', '人事部', '総務部'];
    const positions = ['部長', '課長', '係長', '主任', '一般社員'];

    for (let i = 0; i < count; i++) {
        const userIndex = startIndex + i;
        const email = `user${userIndex}@example.com`;
        const name = `${surnames[userIndex % surnames.length]} ${givenNames[userIndex % givenNames.length]}`;
        members.push({
            email,
            role: roles[userIndex % roles.length],
            name,
            status: statuses[userIndex % statuses.length],
            avatarUrl: `https://i.pravatar.cc/40?u=${email}`,
            companyName: companies[userIndex % companies.length],
            departmentName: departments[userIndex % departments.length],
            positionName: positions[userIndex % positions.length],
            phoneNumber: `03-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
            address: `東京都千代田区${userIndex}丁目`,
        });
    }
    return members;
};

export async function initGroupEditPage() {
    state.creatorBillingInfo = {
        name: '山田 太郎',
        department: '営業部',
        phone: '03-1111-1234',
        postalCode: '100-0001',
        address: '東京都千代田区千代田1-1 ビルディング 10F'
    };
    state.allGroupsData = {
        'GROUP001': {
            id: 'GROUP001',
            name: '営業部',
            description: '第一営業部のメンバーが所属するグループです。',
            useGroupBilling: false,
            billingInfo: { contactName: '佐藤 花子', department: '経理部', phone: '03-9999-0011', postalCode: '101-0001', address1: '東京都千代田区神田 請求ビル 5F', address2: '' },
            members: generateDummyMembers(20, 1)
        },
        'GROUP002': {
            id: 'GROUP002',
            name: 'マーケティング部',
            description: 'Webマーケティングとイベント企画を担当します。',
            useGroupBilling: true,
            billingInfo: { contactName: 'マーケ部 請求担当', department: 'マーケティング部', phone: '03-8888-1111', postalCode: '150-0002', address1: '東京都渋谷区渋谷 渋谷ビル 8F', address2: '' },
            members: generateDummyMembers(20, 21)
        },
        'GROUP003': {
            id: 'GROUP003',
            name: 'BPO部',
            description: 'BPO事業部の運用チームです。',
            useGroupBilling: false,
            billingInfo: { contactName: '', department: '', phone: '', postalCode: '', address1: '', address2: '' },
            members: generateDummyMembers(20, 41)
        }
    };

    // Store original order for resetting
    for (const groupId in state.allGroupsData) {
        state.allGroupsData[groupId].originalMembers = [...state.allGroupsData[groupId].members];
    }
    
    state.currentGroupId = elements.groupSelector.value;

    initAccordions();
    renderPage();
    setupEventListeners();
}