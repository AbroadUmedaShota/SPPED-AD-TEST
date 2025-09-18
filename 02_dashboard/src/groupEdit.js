import { showConfirmationModal } from './confirmationModal.js';
import { handleOpenModal, closeModal } from './modalHandler.js';

export function initGroupEditPage() {
    // --- DOM要素の取得 ---
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

    // --- 状態管理 ---
    let isDirty = false;
    let members = [];

    // --- モックデータ ---
    const mockGroup = {
        id: 'GROUP001',
        name: '営業第1チーム',
        description: '新規顧客開拓を担当するチームです。',
        members: [
            { email: 'sato@example.com', role: 'admin', name: '佐藤 太郎', company: '株式会社サンプル', department: '営業部', title: 'マネージャー', phone: '03-1234-5678', postalCode: '100-0001', address: '東京都千代田区千代田1-1' },
            { email: 'suzuki@example.com', role: 'member', name: '鈴木 花子', company: '株式会社サンプル', department: '営業部', title: 'スタッフ', phone: '03-1234-5679', postalCode: '100-0002', address: '東京都千代田区皇居外苑1-2' },
            { email: 'takahashi@example.com', role: 'member', name: '高橋 一郎', company: '株式会社サンプル', department: 'マーケティング部', title: 'リーダー', phone: '03-1234-5680', postalCode: '100-0003', address: '東京都千代田区大手町1-1' },
            { email: 'tanaka@example.com', role: 'member', name: '田中 裕子', company: '株式会社テスト', department: '開発部', title: 'エンジニア', phone: '03-2345-6789', postalCode: '200-0001', address: '神奈川県横浜市中区日本大通1' },
            { email: 'watanabe@example.com', role: 'member', name: '渡辺 健', company: '株式会社サンプル', department: '営業部', title: 'スタッフ', phone: '03-1234-5681', postalCode: '100-0004', address: '東京都千代田区丸の内1-1' },
            { email: 'ito@example.com', role: 'admin', name: '伊藤 さくら', company: '株式会社デモ', department: '人事部', title: '部長', phone: '03-3456-7890', postalCode: '300-0001', address: '埼玉県さいたま市浦和区高砂3-15-1' },
            { email: 'yamamoto@example.com', role: 'member', name: '山本 浩二', company: '株式会社テスト', department: '開発部', title: 'シニアエンジニア', phone: '03-2345-6790', postalCode: '200-0002', address: '神奈川県横浜市西区みなとみらい2-2-1' },
            { email: 'nakamura@example.com', role: 'member', name: '中村 美咲', company: '株式会社サンプル', department: 'マーケティング部', title: 'スタッフ', phone: '03-1234-5682', postalCode: '100-0005', address: '東京都千代田区霞が関1-1' },
            { email: 'kobayashi@example.com', role: 'member', name: '小林 誠', company: '株式会社デモ', department: '総務部', title: 'スタッフ', phone: '03-3456-7891', postalCode: '300-0002', address: '埼玉県川口市青木2-1-1' },
            { email: 'kato@example.com', role: 'member', name: '加藤 あゆみ', company: '株式会社サンプル', department: '営業部', title: 'リーダー', phone: '03-1234-5683', postalCode: '100-0006', address: '東京都港区赤坂1-1-1' }
        ]
    };

    // --- 関数 ---

    const setDirty = () => {
        isDirty = true;
        updateSaveButtonState();
    };

    const updateSaveButtonState = () => {
        const isGroupNameValid = groupNameInput.value.trim() !== '';
        saveBtn.disabled = !isDirty || !isGroupNameValid;
    };

    const renderMemberList = () => {
        memberListContainer.innerHTML = '';
        if (members.length === 0) {
            noMemberMessage.classList.remove('hidden');
        } else {
            noMemberMessage.classList.add('hidden');
            members.forEach((member, index) => {
                const memberCard = document.createElement('div');
                memberCard.className = 'flex items-center justify-between p-3 bg-background rounded-md border border-divider cursor-pointer hover:bg-gray-50';
                memberCard.dataset.id = member.email;

                memberCard.innerHTML = `
                    <div class="flex items-center gap-3">
                        <span class="material-icons drag-handle text-gray-400 cursor-grab">drag_indicator</span>
                        <img class="w-8 h-8 rounded-full" src="https://i.pravatar.cc/40?u=${member.email}" alt="avatar">
                        <div>
                            <p class="font-semibold">${member.name} <span class="text-xs text-gray-500">(${member.company})</span></p>
                            <p class="text-sm text-gray-600">${member.email}</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <select data-index="${index}" class="role-select input-field text-sm py-1 w-32">
                            <option value="member" ${member.role === 'member' ? 'selected' : ''}>一般メンバー</option>
                            <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>管理者</option>
                        </select>
                        <button data-index="${index}" class="delete-member-btn text-gray-400 hover:text-red-500">
                            <span class="material-icons">delete_outline</span>
                        </button>
                    </div>
                `;
                memberListContainer.appendChild(memberCard);
            });
        }
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
        } else if (members.some(m => m.email === email)) {
            newMemberEmailError.textContent = 'このメンバーは既に追加されています。';
            newMemberEmailError.classList.remove('hidden');
            isValid = false;
        }
        return isValid;
    };

    // --- イベントハンドラ ---

    addMemberBtn.addEventListener('click', () => {
        if (!validateNewMember()) return;
        const newMember = {
            email: newMemberEmailInput.value.trim(),
            role: newMemberRoleSelect.value,
            name: '新しいメンバー', company: '所属会社', department: '未設定', title: '未設定', phone: '未設定', postalCode: '未設定', address: '未設定'
        };
        members.push(newMember);
        renderMemberList();
        setDirty();
        newMemberEmailInput.value = '';
        newMemberRoleSelect.value = 'member';
        newMemberEmailInput.focus();
        console.log(`${newMember.email} を追加しました。`);
    });

    memberListContainer.addEventListener('click', (e) => {
        const targetElement = e.target;
        const memberCard = targetElement.closest('[data-id]');
        if (!memberCard) return;

        if (targetElement.closest('.delete-member-btn') || targetElement.closest('.role-select') || targetElement.closest('.drag-handle')) {
            const deleteBtn = targetElement.closest('.delete-member-btn');
            if (deleteBtn) {
                const index = deleteBtn.dataset.index;
                const member = members[index];
                showConfirmationModal(`本当に ${member.name} さんをグループから削除しますか？`, () => {
                    members.splice(index, 1);
                    renderMemberList();
                    setDirty();
                    console.log(`${member.email} を削除しました。`);
                });
            }
            return;
        }

        const email = memberCard.dataset.id;
        const member = members.find(m => m.email === email);
        if (member) {
            handleOpenModal('memberDetailModal', 'modals/memberDetailModal.html', () => {
                const contentEl = document.getElementById('member-details-content');
                contentEl.innerHTML = `
                    <dl class="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-3 text-sm">
                        <dt class="font-semibold text-gray-500">氏名</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.name || '-'}</dd>
                        <dt class="font-semibold text-gray-500">会社名</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.company || '-'}</dd>
                        <dt class="font-semibold text-gray-500">部署</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.department || '-'}</dd>
                        <dt class="font-semibold text-gray-500">役職</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.title || '-'}</dd>
                        <dt class="font-semibold text-gray-500">メール</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.email || '-'}</dd>
                        <dt class="font-semibold text-gray-500">電話番号</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.phone || '-'}</dd>
                        <dt class="font-semibold text-gray-500">郵便番号</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.postalCode || '-'}</dd>
                        <dt class="font-semibold text-gray-500">住所</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.address || '-'}</dd>
                        <dt class="font-semibold text-gray-500">権限</dt>
                        <dd class="md:col-span-2 text-on-surface">${member.role === 'admin' ? '管理者' : '一般メンバー'}</dd>
                    </dl>
                `;
                const modalElement = document.getElementById('memberDetailModal');
                const closeButtons = modalElement.querySelectorAll('[data-modal-close="memberDetailModal"]');
                closeButtons.forEach(btn => {
                    btn.addEventListener('click', () => closeModal('memberDetailModal'));
                });
            });
        }
    });

    memberListContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('role-select')) {
            const index = e.target.dataset.index;
            members[index].role = e.target.value;
            setDirty();
            console.log(`${members[index].email} の役割を ${e.target.value} に変更`);
        }
    });

    saveBtn.addEventListener('click', () => {
        if (validateForm()) {
            isDirty = false;
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';
            setTimeout(() => {
                console.log('保存されたデータ:', { name: groupNameInput.value, description: groupDescriptionInput.value, members: members });
                alert('グループ情報を更新しました。');
                saveBtn.textContent = '保存';
            }, 1000);
        }
    });

    cancelBtn.addEventListener('click', () => {
        if (isDirty) {
            showConfirmationModal('編集中の内容があります。変更を保存せずに終了しますか？', () => {
                alert('変更を破棄しました。');
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

    // --- 初期化処理 ---
    const init = () => {
        groupNameInput.value = mockGroup.name;
        groupDescriptionInput.value = mockGroup.description;
        members = [...mockGroup.members];
        renderMemberList();

        [groupNameInput, groupDescriptionInput].forEach(input => {
            input.addEventListener('input', () => {
                validateForm();
                setDirty();
            });
        });

        new Sortable(memberListContainer, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: () => {
                const newOrder = [];
                memberListContainer.querySelectorAll('[data-id]').forEach(card => {
                    const email = card.dataset.id;
                    const member = members.find(m => m.email === email);
                    if(member) newOrder.push(member);
                });
                members = newOrder;
                renderMemberList();
                setDirty();
            }
        });
    };

    init();
}



