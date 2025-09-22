import { showConfirmationModal } from './confirmationModal.js';
import { handleOpenModal, closeModal } from './modalHandler.js';
import { fetchGroups, updateGroup } from './groupService.js';
import { showToast } from './utils.js';
import { initBreadcrumbs } from './breadcrumb.js';

export function initGroupEditPage() {
    initBreadcrumbs();
    const groupNameInput = document.getElementById('groupName');
    const groupDescriptionInput = document.getElementById('groupDescription');
    const newMemberEmailInput = document.getElementById('newMemberEmail');
    const newMemberRoleSelect = document.getElementById('newMemberRole');
    const addMemberBtn = document.getElementById('add-member-btn');
    const memberListContainer = document.getElementById('member-list');
    const noMemberMessage = document.getElementById('no-member-message');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const groupNameError = document.getElementById('groupNameError');
    const newMemberEmailError = document.getElementById('newMemberEmailError');

    const memberActionControls = [
        newMemberEmailInput,
        newMemberRoleSelect,
        addMemberBtn,
    ];

    let isDirty = false;
    let isLoading = true;
    let members = [];
    let currentGroupId = null;
    let allGroups = [];

    const urlParams = new URLSearchParams(window.location.search);
    const requestedGroupId = urlParams.get('groupId');

    const generateMemberKey = (() => {
        let counter = 0;
        return () => {
            counter += 1;
            return `member-${Date.now()}-${counter}`;
        };
    })();

    const cloneMember = (member = {}) => {
        const cloned = {
            email: member.email || '',
            role: member.role || 'member',
            name: member.name || '',
            company: member.company || '',
            department: member.department || '',
            title: member.title || '',
            phone: member.phone || '',
            postalCode: member.postalCode || '',
            address: member.address || '',
        };
        cloned.__memberKey = member.email || member.__memberKey || generateMemberKey();
        return cloned;
    };

    const updateFormAvailability = () => {
        const disableGroupFields = isLoading || !currentGroupId;
        [groupNameInput, groupDescriptionInput].forEach((el) => {
            if (el) {
                el.disabled = disableGroupFields;
            }
        });

        const disableMemberActions = isLoading || !currentGroupId;
        memberActionControls.forEach((el) => {
            if (el) {
                el.disabled = disableMemberActions;
            }
        });

        cancelBtn.disabled = isLoading && !isDirty;
        updateSaveButtonState();
    };

    const setDirty = () => {
        if (isLoading || !currentGroupId) {
            return;
        }
        isDirty = true;
        updateSaveButtonState();
    };

    const updateSaveButtonState = () => {
        const isGroupNameValid = groupNameInput.value.trim() !== '';
        const canSave = Boolean(currentGroupId);
        saveBtn.disabled = isLoading || !canSave || !isDirty || !isGroupNameValid;
    };

    const applyGroupToForm = (group) => {
        currentGroupId = group?.id ?? null;
        groupNameInput.value = group?.name ?? '';
        groupDescriptionInput.value = group?.description ?? '';
        members = Array.isArray(group?.members) ? group.members.map(cloneMember) : [];
        isDirty = false;
    };

    const renderMemberList = () => {
        memberListContainer.innerHTML = '';
        memberListContainer.appendChild(noMemberMessage);

        if (isLoading) {
            noMemberMessage.textContent = '読み込み中...';
            noMemberMessage.classList.remove('hidden');
            return;
        }

        if (!currentGroupId) {
            noMemberMessage.textContent = 'グループが読み込まれていません。';
            noMemberMessage.classList.remove('hidden');
            return;
        }

        if (!members.length) {
            noMemberMessage.textContent = 'メンバーがいません。';
            noMemberMessage.classList.remove('hidden');
            return;
        }

        noMemberMessage.classList.add('hidden');

        members.forEach((member, index) => {
            const memberCard = document.createElement('div');
            memberCard.className = 'flex items-center justify-between p-3 bg-background rounded-md border border-divider cursor-pointer hover:bg-gray-50';
            memberCard.dataset.memberKey = member.__memberKey;
            memberCard.dataset.id = member.__memberKey;
            memberCard.dataset.index = String(index);
            const avatarSeed = encodeURIComponent(member.email || member.name || member.__memberKey);
            memberCard.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="material-icons drag-handle text-gray-400 cursor-grab">drag_indicator</span>
                    <img class="w-8 h-8 rounded-full" src="https://i.pravatar.cc/40?u=${avatarSeed}" alt="avatar">
                    <div class="max-w-[240px]">
                        <p class="font-semibold truncate">${member.name || '未設定'} <span class="text-xs text-gray-500">${member.company || ''}</span></p>
                        <p class="text-sm text-gray-600 truncate" title="${member.email || 'メール未登録'}">${member.email || 'メール未登録'}</p>
                    </div>
                </div>
                <div class="flex items-center gap-4">
                    <select data-index="${index}" class="role-select input-field text-sm py-1 w-32">
                        <option value="member" ${member.role === 'member' ? 'selected' : ''}>一般メンバー</option>
                        <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>管理者</option>
                    </select>
                    <button data-index="${index}" class="delete-member-btn text-gray-400 hover:text-red-500" aria-label="メンバーを削除">
                        <span class="material-icons">delete_outline</span>
                    </button>
                </div>
            `;
            memberListContainer.appendChild(memberCard);
        });
    };

    const validateForm = () => {
        let isValid = true;
        if (groupNameInput.value.trim() === '') {
            groupNameError.classList.remove('hidden');
            isValid = false;
        } else {
            groupNameError.classList.add('hidden');
        }
        updateSaveButtonState();
        return isValid;
    };

    const validateNewMember = () => {
        if (isLoading || !currentGroupId) {
            return false;
        }
        let isValid = true;
        newMemberEmailError.textContent = '';
        newMemberEmailError.classList.add('hidden');
        const email = newMemberEmailInput.value.trim();
        if (email === '') {
            newMemberEmailError.textContent = 'メールアドレスを入力してください。';
            newMemberEmailError.classList.remove('hidden');
            isValid = false;
        } else if (!/^\S+@\S+\.\S+$/.test(email)) {
            newMemberEmailError.textContent = '有効なメールアドレス形式で入力してください。';
            newMemberEmailError.classList.remove('hidden');
            isValid = false;
        } else if (members.some((m) => m.email === email)) {
            newMemberEmailError.textContent = 'このメンバーは既に追加されています。';
            newMemberEmailError.classList.remove('hidden');
            isValid = false;
        }
        return isValid;
    };

    const loadGroups = async () => {
        isLoading = true;
        updateFormAvailability();
        renderMemberList();

        try {
            allGroups = await fetchGroups();
            if (!Array.isArray(allGroups) || allGroups.length === 0) {
                throw new Error('グループデータは空です');
            }

            let targetGroup = requestedGroupId
                ? allGroups.find((group) => group.id === requestedGroupId)
                : allGroups[0];

            if (!targetGroup && requestedGroupId) {
                showToast(`指定されたグループが見つかりませんでした (groupId=${requestedGroupId})。先頭のグループを表示します。`, 'info');
                targetGroup = allGroups[0];
            }

            applyGroupToForm(targetGroup || null);
        } catch (error) {
            console.error('Failed to load group data:', error);
            showToast('グループデータの読み込みに失敗しました。', 'error');
            applyGroupToForm(null);
        } finally {
            isLoading = false;
            updateFormAvailability();
            renderMemberList();
        }
    };

    addMemberBtn.addEventListener('click', () => {
        if (!validateNewMember()) {
            return;
        }
        const newMember = cloneMember({
            email: newMemberEmailInput.value.trim(),
            role: newMemberRoleSelect.value,
            name: '新しいメンバー',
            company: '所属会社',
            department: '未設定',
            title: '未設定',
            phone: '未設定',
            postalCode: '未設定',
            address: '未設定',
        });
        members.push(newMember);
        renderMemberList();
        setDirty();
        newMemberEmailInput.value = '';
        newMemberRoleSelect.value = 'member';
        newMemberEmailInput.focus();
        
    });

    memberListContainer.addEventListener('click', (e) => {
        if (isLoading || !currentGroupId) {
            return;
        }
        const targetElement = e.target;
        const memberCard = targetElement.closest('[data-member-key]');
        if (!memberCard) {
            return;
        }

        if (targetElement.closest('.delete-member-btn') || targetElement.closest('.role-select') || targetElement.closest('.drag-handle')) {
            const deleteBtn = targetElement.closest('.delete-member-btn');
            if (deleteBtn) {
                const index = Number(deleteBtn.dataset.index);
                const member = members[index];
                showConfirmationModal(`本当に ${member?.name || 'このメンバー'} さんをグループから削除しますか？`, () => {
                    members.splice(index, 1);
                    renderMemberList();
                    setDirty();
                    
                });
            }
            return;
        }

        const memberKey = memberCard.dataset.memberKey;
        const member = members.find((m) => m.__memberKey === memberKey);
        if (member) {
            handleOpenModal('memberDetailModal', 'modals/memberDetailModal.html', () => {
                const contentEl = document.getElementById('member-details-content');
                if (!contentEl) {
                    return;
                }
                const safe = (value) => value || '-';
                contentEl.innerHTML = `
                    <dl class="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <dt class="font-semibold text-gray-500">氏名</dt>
                        <dd class="md:col-span-2 text-on-surface">${safe(member.name)}</dd>
                        <dt class="font-semibold text-gray-500">会社名</dt>
                        <dd class="md:col-span-2 text-on-surface">${safe(member.company)}</dd>
                        <dt class="font-semibold text-gray-500">部署</dt>
                        <dd class="md:col-span-2 text-on-surface">${safe(member.department)}</dd>
                        <dt class="font-semibold text-gray-500">役職</dt>
                        <dd class="md:col-span-2 text-on-surface">${safe(member.title)}</dd>
                        <dt class="font-semibold text-gray-500">メール</dt>
                        <dd class="md:col-span-2 text-on-surface">${safe(member.email)}</dd>
                        <dt class="font-semibold text-gray-500">電話番号</dt>
                        <dd class="md:col-span-2 text-on-surface">${safe(member.phone)}</dd>
                        <dt class="font-semibold text-gray-500">郵便番号</dt>
                        <dd class="md:col-span-2 text-on-surface">${safe(member.postalCode)}</dd>
                        <dt class="font-semibold text-gray-500">住所</dt>
                        <dd class="md:col-span-2 text-on-surface">${safe(member.address)}</dd>
                        <dt class="font-semibold text-gray-500">権限</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.role === 'admin' ? '管理者' : '一般メンバー'}</dd>
                    </dl>
                `;
                const modalElement = document.getElementById('memberDetailModal');
                if (!modalElement) {
                    return;
                }
                const closeButtons = modalElement.querySelectorAll('[data-modal-close="memberDetailModal"]');
                closeButtons.forEach((btn) => {
                    btn.addEventListener('click', () => closeModal('memberDetailModal'));
                });
            });
        }
    });

    memberListContainer.addEventListener('change', (e) => {
        if (isLoading || !currentGroupId) {
            return;
        }
        if (e.target.classList.contains('role-select')) {
            const index = Number(e.target.dataset.index);
            members[index].role = e.target.value;
            setDirty();
            
        }
    });

    saveBtn.addEventListener('click', async () => {
        if (!currentGroupId) {
            showToast('グループが読み込まれていません。', 'error');
            return;
        }
        if (!validateForm()) {
            return;
        }
        const originalLabel = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.textContent = '保存中...';
        try {
            const payloadMembers = members.map(({ __memberKey, ...rest }) => rest);
            const payload = {
                name: groupNameInput.value.trim(),
                description: groupDescriptionInput.value.trim(),
                members: payloadMembers,
            };
            const updated = await updateGroup(currentGroupId, payload);
            if (!updated) {
                throw new Error('updateGroup returned null');
            }
            const groupIndex = allGroups.findIndex((group) => group.id === currentGroupId);
            if (groupIndex !== -1) {
                allGroups[groupIndex] = { ...allGroups[groupIndex], ...payload };
            }
            applyGroupToForm({ id: currentGroupId, ...payload });
            renderMemberList();
            showToast('グループ情報を更新しました。', 'success');
        } catch (error) {
            console.error('Failed to save group data:', error);
            showToast('グループ情報の保存に失敗しました。', 'error');
        } finally {
            saveBtn.textContent = originalLabel;
            updateFormAvailability();
        }
    });

    cancelBtn.addEventListener('click', () => {
        if (isDirty) {
            showConfirmationModal('編集中の内容があります。変更を保存せずに終了しますか？', () => {
                showToast('変更を破棄しました。', 'info');
                window.history.back();
            });
        } else {
            window.history.back();
        }
    });

    window.addEventListener('beforeunload', (e) => {
        if (isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    const init = async () => {
        await loadGroups();
        new Sortable(memberListContainer, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: () => {
                const newOrder = [];
                memberListContainer.querySelectorAll('[data-member-key]').forEach((card) => {
                    const key = card.dataset.memberKey;
                    const member = members.find((m) => m.__memberKey === key);
                    if (member) {
                        newOrder.push(member);
                    }
                });
                members = newOrder;
                renderMemberList();
                setDirty();
            },
        });
    };

    init();
}
