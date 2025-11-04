// Mock data - replace with actual API calls
const MOCK_GROUPS = [
    { id: 1, name: '東京営業部' },
    { id: 2, name: '大阪支社' },
    { id: 3, name: '開発チーム' },
];

const MOCK_OPERATORS = [
    { id: 101, name: '田中 太郎', groupId: 1 },
    { id: 102, name: '鈴木 一郎', groupId: 1 },
    { id: 103, name: '佐藤 花子', groupId: 2 },
    { id: 104, name: '高橋 次郎', groupId: 3 },
    { id: 105, name: '伊藤 三郎', groupId: 1 },
];

export async function initGroupManagement() {
    const openModalBtn = document.getElementById('open-group-modal-btn');
    const modal = document.getElementById('group-management-modal');

    if (!openModalBtn || !modal) {
        console.error('Group management modal elements not found');
        return;
    }

    // Load modal content
    try {
        const modalUrl = new URL('../modals/groupManagementModal.html', import.meta.url);
        const response = await fetch(modalUrl);
        if (!response.ok) throw new Error('Failed to load modal content');
        modal.innerHTML = await response.text();
        setupModalEventListeners();
    } catch (error) {
        console.error('Error loading group management modal:', error);
        modal.innerHTML = '<p class="text-red-500">モーダルの読み込みに失敗しました。</p>';
        return;
    }


    openModalBtn.addEventListener('click', () => {
        modal.dataset.state = 'open';
        loadGroups();
    });
}

function setupModalEventListeners() {
    const modal = document.getElementById('group-management-modal');
    const closeModalBtn = document.getElementById('close-group-modal-btn');
    const createGroupBtn = document.getElementById('create-group-btn');
    const selectGroup = document.getElementById('select-group');
    const updateGroupBtn = document.getElementById('update-group-btn');
    const deleteGroupBtn = document.getElementById('delete-group-btn');

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.dataset.state = 'closed';
        }
    });

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.dataset.state = 'closed';
        });
    }

    if (createGroupBtn) {
        createGroupBtn.addEventListener('click', createGroup);
    }

    if (selectGroup) {
        selectGroup.addEventListener('change', handleGroupSelection);
    }
    
    // These buttons are inside the modal, so they should be present
    // after the modal content is loaded.
    if(updateGroupBtn) {
        updateGroupBtn.addEventListener('click', updateGroup);
    }

    if(deleteGroupBtn) {
        deleteGroupBtn.addEventListener('click', deleteGroup);
    }
}

async function loadGroups() {
    const selectGroup = document.getElementById('select-group');
    if (!selectGroup) return;

    // Simulate API call
    const groups = await new Promise(resolve => setTimeout(() => resolve(MOCK_GROUPS), 200));

    selectGroup.innerHTML = '<option value="">グループを選択してください</option>';
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        selectGroup.appendChild(option);
    });
}

async function handleGroupSelection(event) {
    const groupId = event.target.value;
    const membersSection = document.getElementById('group-members-section');
    const membersList = document.getElementById('group-members-list');

    if (!groupId) {
        membersSection.classList.add('hidden');
        return;
    }

    // Simulate API call
    const members = await new Promise(resolve => {
        setTimeout(() => {
            resolve(MOCK_OPERATORS.filter(op => op.groupId === parseInt(groupId, 10)));
        }, 200);
    });

    membersList.innerHTML = '';
    if (members.length === 0) {
        membersList.innerHTML = '<p class="text-sm text-gray-500">このグループにはメンバーがいません。</p>';
    } else {
        members.forEach(member => {
            const memberEl = document.createElement('div');
            memberEl.className = 'flex items-center justify-between bg-gray-100 p-2 rounded';
            memberEl.innerHTML = `
                <span class="text-sm">${member.name}</span>
                <button class="remove-member-btn text-red-500 hover:text-red-700" data-member-id="${member.id}">
                    <span class="material-icons text-base">delete</span>
                </button>
            `;
            membersList.appendChild(memberEl);
        });
        
        // Add event listeners to new remove buttons
        membersList.querySelectorAll('.remove-member-btn').forEach(btn => {
            btn.addEventListener('click', removeMember);
        });
    }

    membersSection.classList.remove('hidden');
}

function createGroup() {
    const groupNameInput = document.getElementById('new-group-name');
    const groupName = groupNameInput.value.trim();
    if (!groupName) {
        alert('グループ名を入力してください。');
        return;
    }
    console.log('Creating group:', groupName);
    // TODO: Implement API call to create group
    alert(`グループ「${groupName}」を作成しました。（実際には作成されません）`);
    groupNameInput.value = '';
    // Reload groups to include the new one
    loadGroups();
}

function updateGroup() {
    const selectedGroupId = document.getElementById('select-group').value;
    if (!selectedGroupId) {
        alert('グループを選択してください。');
        return;
    }
    console.log('Updating group:', selectedGroupId);
    // TODO: Implement API call to update group (e.g., rename, change members)
    alert(`グループID「${selectedGroupId}」を更新しました。（実際には更新されません）`);
}

function deleteGroup() {
    const selectedGroupId = document.getElementById('select-group').value;
    if (!selectedGroupId) {
        alert('グループを選択してください。');
        return;
    }
    if (confirm('本当にこのグループを削除しますか？メンバーはどのグループにも所属しない状態になります。')) {
        console.log('Deleting group:', selectedGroupId);
        // TODO: Implement API call to delete group
        alert(`グループID「${selectedGroupId}」を削除しました。（実際には削除されません）`);
        // Reload groups
        loadGroups();
        document.getElementById('group-members-section').classList.add('hidden');
    }
}

function removeMember(event) {
    const memberId = event.currentTarget.dataset.memberId;
    const memberName = event.currentTarget.previousElementSibling.textContent;
    if (confirm(`${memberName}をグループから削除しますか？`)) {
        console.log('Removing member:', memberId);
        // TODO: Implement API call to remove member from group
        alert(`${memberName}を削除しました。（実際には削除されません）`);
        // Visually remove the member from the list
        event.currentTarget.parentElement.remove();
    }
}
