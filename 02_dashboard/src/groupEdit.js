import { showConfirmationModal } from './confirmationModal.js';
import { handleOpenModal } from './modalHandler.js';
import { showToast } from './utils.js';
import { initBreadcrumbs } from './breadcrumb.js';

// --- Mock Data ---
const mockCreatorAccount = {
    billingContactName: '山田 太郎',
    billingDepartment: '経理部',
    billingPhone: '03-1234-5678',
    billingPostalCode: '100-0001',
    billingAddress1: '東京都千代田区千代田1-1',
    billingAddress2: '皇居',
};

const allGroupsMock = [
    {
        id: 'group001',
        name: 'サンプルグループA',
        description: 'これはサンプルグループAの説明です。',
        useGroupBilling: false,
        billingContactName: '',
        billingDepartment: '',
        billingPhone: '',
        billingPostalCode: '',
        billingAddress1: '',
        billingAddress2: '',
        members: [
            { email: 'admin@example.com', role: 'admin', name: '佐藤 管理者', status: 'グループ加入済' },
            { email: 'member1@example.com', role: 'member', name: '鈴木 一郎', status: 'グループ加入済' },
            { email: 'member2@example.com', role: 'member', name: '高橋 次郎', status: 'グループ加入済' },
            { email: 'member3@example.com', role: 'member', name: '田中 三郎', status: 'グループ加入済' },
            { email: 'member4@example.com', role: 'member', name: '伊藤 四郎', status: 'グループ招待中' },
            { email: 'member5@example.com', role: 'member', name: '渡辺 五郎', status: 'グループ招待中' },
            { email: 'member6@example.com', role: 'member', name: '山本 六郎', status: 'アドレスエラー' },
            { email: 'member7@example.com', role: 'member', name: '中村 七郎', status: 'グループ加入済' },
            { email: 'member8@example.com', role: 'member', name: '小林 八郎', status: 'グループ加入済' },
            { email: 'member9@example.com', role: 'member', name: '加藤 九郎', status: 'グループ招待中' },
        ]
    },
    {
        id: 'group002',
        name: 'サンプルグループB',
        description: 'グループBは請求先が異なります。',
        useGroupBilling: true,
        billingContactName: '田中 花子',
        billingDepartment: '営業企画部',
        billingPhone: '06-9876-5432',
        billingPostalCode: '530-0001',
        billingAddress1: '大阪府大阪市北区梅田2-2-2',
        billingAddress2: 'ヒルトンプラザウエストオフィスタワー18F',
        members: [
            { email: 'invited@example.com', role: 'member', name: '招待中', status: 'グループ招待中' },
            { email: 'error@example.com', role: 'member', name: '招待中', status: 'アドレスエラー' },
            { email: 'tanaka@example.com', role: 'admin', name: '田中 管理者', status: 'グループ加入済' },
            { email: 'watanabe@example.com', role: 'member', name: '渡辺 健', status: 'グループ加入済' },
            { email: 'ito@example.com', role: 'member', name: '伊藤 優子', status: 'グループ加入済' },
            { email: 'yamamoto@example.com', role: 'member', name: '山本 明', status: 'グループ招待中' },
            { email: 'nakamura@example.com', role: 'member', name: '中村 静香', status: 'グループ招待中' },
            { email: 'kobayashi@example.com', role: 'member', name: '小林 誠', status: 'アドレスエラー' },
            { email: 'kato@example.com', role: 'member', name: '加藤 浩', status: 'グループ加入済' },
            { email: 'yoshida@example.com', role: 'member', name: '吉田 美紀', status: 'グループ加入済' }
        ]
    }
];

export function initGroupEditPage() {
    // --- Mock Data ---
    const creatorAccountBillingInfo = {
        contactName: '山田 太郎 (オーナー)',
        department: '経理部',
        phone: '03-1234-5678',
        postalCode: '100-0001',
        address1: '東京都千代田区千代田1-1',
        address2: '皇居',
    };

    const allGroupsMock = [
        {
            id: 'group001',
            name: 'サンプルグループA',
            description: 'これはサンプルグループAの説明です。',
            useGroupBilling: false, // 作成者の情報を使う
            billingInfo: {
                contactName: '',
                department: '',
                phone: '',
                postalCode: '',
                address1: '',
                address2: '',
            },
            members: [
                { email: 'admin@example.com', role: 'admin', name: '佐藤 管理者', status: 'グループ加入済', avatarUrl: 'https://i.pravatar.cc/40?u=admin@example.com' },
                { email: 'member1@example.com', role: 'member', name: '鈴木 一郎', status: 'グループ加入済', avatarUrl: 'https://i.pravatar.cc/40?u=member1@example.com' },
                { email: 'member2@example.com', role: 'member', name: '高橋 次郎', status: 'グループ加入済', avatarUrl: null },
                { email: 'member3@example.com', role: 'member', name: '田中 三郎', status: 'グループ加入済', avatarUrl: 'https://i.pravatar.cc/40?u=member3@example.com' },
                { email: 'member4@example.com', role: 'member', name: '伊藤 四郎', status: 'グループ招待中', avatarUrl: 'https://i.pravatar.cc/40?u=member4@example.com' },
                { email: 'member5@example.com', role: 'member', name: '渡辺 五郎', status: 'グループ招待中', avatarUrl: null },
                { email: 'member6@example.com', role: 'member', name: '山本 六郎', status: 'アドレスエラー', avatarUrl: 'https://i.pravatar.cc/40?u=member6@example.com' },
                { email: 'member7@example.com', role: 'member', name: '中村 七郎', status: 'グループ加入済', avatarUrl: 'https://i.pravatar.cc/40?u=member7@example.com' },
                { email: 'member8@example.com', role: 'member', name: '小林 八郎', status: 'グループ招待中', avatarUrl: 'https://i.pravatar.cc/40?u=member8@example.com' },
                { email: 'member9@example.com', role: 'member', name: '加藤 九郎', status: 'グループ加入済', avatarUrl: null },
            ]
        },
        {
            id: 'group002',
            name: 'サンプルグループB',
            description: 'グループBは請求先が異なります。',
            useGroupBilling: true, // グループ専用情報を使う
            billingInfo: {
                contactName: '田中 花子',
                department: '営業企画部',
                phone: '06-9876-5432',
                postalCode: '530-0001',
                address1: '大阪府大阪市北区梅田2-2-2',
                address2: 'ヒルトンプラザウエストオフィスタワー18F',
            },
            members: [
                { email: 'tanaka@example.com', role: 'admin', name: '田中 管理者', status: 'グループ加入済', avatarUrl: 'https://i.pravatar.cc/40?u=tanaka@example.com' },
                { email: 'watanabe@example.com', role: 'member', name: '渡辺 健', status: 'グループ加入済', avatarUrl: 'https://i.pravatar.cc/40?u=watanabe@example.com' },
                { email: 'ito@example.com', role: 'member', name: '伊藤 優子', status: 'グループ加入済', avatarUrl: null },
                { email: 'yamamoto@example.com', role: 'member', name: '山本 明', status: 'グループ招待中', avatarUrl: 'https://i.pravatar.cc/40?u=yamamoto@example.com' },
                { email: 'nakamura.b@example.com', role: 'member', name: '中村 美咲', status: 'グループ加入済', avatarUrl: 'https://i.pravatar.cc/40?u=nakamura.b@example.com' },
                { email: 'kobayashi.b@example.com', role: 'member', name: '小林 太郎', status: 'アドレスエラー', avatarUrl: 'https://i.pravatar.cc/40?u=kobayashi.b@example.com' },
                { email: 'saito.b@example.com', role: 'member', name: '斎藤 誠', status: 'グループ招待中', avatarUrl: null },
                { email: 'hashimoto.b@example.com', role: 'member', name: '橋本 奈々', status: 'グループ加入済', avatarUrl: 'https://i.pravatar.cc/40?u=hashimoto.b@example.com' },
                { email: 'inoue.b@example.com', role: 'member', name: '井上 大輔', status: 'グループ加入済', avatarUrl: 'https://i.pravatar.cc/40?u=inoue.b@example.com' },
                { email: 'okada.b@example.com', role: 'member', name: '岡田 直樹', status: 'グループ招待中', avatarUrl: 'https://i.pravatar.cc/40?u=okada.b@example.com' },
            ]
        }
    ];

    // --- DOM Elements ---
    const groupNameInput = document.getElementById('groupName');
    const groupDescriptionInput = document.getElementById('groupDescription');
    const memberListContainer = document.getElementById('member-list');
    const noMemberMessage = document.getElementById('no-member-message');
    const groupSelector = document.getElementById('groupSelector');
    const useCreatorBillingBtn = document.getElementById('use-creator-billing-btn');
    const useGroupBillingBtn = document.getElementById('use-group-billing-btn');
    const creatorBillingInfoDiv = document.getElementById('creator-billing-info');
    const groupBillingInfoDiv = document.getElementById('group-billing-info');
    const groupBillingInputs = groupBillingInfoDiv.querySelectorAll('input');

    let currentGroup = {};

    // --- Functions ---

    const getStatusBadge = (status) => {
        const baseClasses = 'px-2 py-0.5 text-xs font-medium rounded-full';
        switch (status) {
            case 'グループ加入済': return `<span class="${baseClasses} bg-green-100 text-green-800">${status}</span>`;
            case 'グループ招待中': return `<span class="${baseClasses} bg-blue-100 text-blue-800">${status}</span>`;
            case 'アドレスエラー': return `<span class="${baseClasses} bg-red-100 text-red-800">${status}</span>`;
            default: return `<span class="${baseClasses} bg-gray-100 text-gray-800">${status || '不明'}</span>`;
        }
    };

    const createMemberCard = (member) => {
        const card = document.createElement('div');
        card.className = 'member-card flex items-center justify-between p-3 bg-background rounded-md border border-divider hover:bg-gray-50/50';
        card.dataset.email = member.email;

        const avatarHtml = member.avatarUrl
            ? `<img src="${member.avatarUrl}" alt="アバター" class="w-10 h-10 rounded-full object-cover flex-shrink-0">`
            : `<span class="material-icons text-gray-400 w-10 h-10 flex items-center justify-center flex-shrink-0">account_circle</span>`;

        card.innerHTML = `
            <div class="flex items-center gap-3 flex-grow min-w-0">
                <span class="material-icons text-gray-400 cursor-grab drag-handle">drag_indicator</span>
                ${avatarHtml}
                <div class="flex-grow min-w-0">
                    <div class="flex items-center gap-2">
                        <p class="font-semibold truncate">${member.name}</p>
                        ${getStatusBadge(member.status)}
                    </div>
                    <p class="text-sm text-gray-500 truncate">${member.email}</p>
                </div>
            </div>
            <div class="flex items-center gap-2 ml-4 flex-shrink-0">
                <select class="role-select input-field text-sm py-1 w-32" data-email="${member.email}">
                    <option value="member" ${member.role === 'member' ? 'selected' : ''}>一般メンバー</option>
                    <option value="admin" ${member.role === 'admin' ? 'selected' : ''}>管理者</option>
                </select>
                <button class="delete-member-btn text-gray-400 hover:text-red-500" aria-label="メンバーを削除" data-email="${member.email}">
                    <span class="material-icons">delete_outline</span>
                </button>
            </div>
        `;
        return card;
    };

    const renderMembers = (members) => {
        memberListContainer.innerHTML = '';
        if (!members || members.length === 0) {
            noMemberMessage.classList.remove('hidden');
            return;
        }
        noMemberMessage.classList.add('hidden');
        members.forEach(member => {
            memberListContainer.appendChild(createMemberCard(member));
        });
    };

    const updateBillingUI = (useGroupBilling) => {
        const activeClasses = ['bg-blue-600', 'text-white', 'z-10', 'border-blue-600'];
        const inactiveClasses = ['bg-white', 'text-gray-700', 'hover:bg-gray-50'];
        
        if (useGroupBilling) {
            useGroupBillingBtn.classList.add(...activeClasses);
            useGroupBillingBtn.classList.remove(...inactiveClasses);
            useCreatorBillingBtn.classList.add(...inactiveClasses);
            useCreatorBillingBtn.classList.remove(...activeClasses);
            groupBillingInfoDiv.classList.remove('hidden');
            creatorBillingInfoDiv.classList.add('hidden');
        } else {
            useCreatorBillingBtn.classList.add(...activeClasses);
            useCreatorBillingBtn.classList.remove(...inactiveClasses);
            useGroupBillingBtn.classList.add(...inactiveClasses);
            useGroupBillingBtn.classList.remove(...activeClasses);
            creatorBillingInfoDiv.classList.remove('hidden');
            groupBillingInfoDiv.classList.add('hidden');
        }
    };

    const applyGroupToForm = (group) => {
        if (!group) return;
        currentGroup = group; // Keep a reference to the current group

        groupNameInput.value = group.name;
        groupDescriptionInput.value = group.description;
        renderMembers(group.members);

        // 請求先情報の適用
        updateBillingUI(group.useGroupBilling);
        
        // 作成者情報の表示
        document.getElementById('creator-billing-contact-name').textContent = creatorAccountBillingInfo.contactName;
        document.getElementById('creator-billing-department').textContent = creatorAccountBillingInfo.department;
        document.getElementById('creator-billing-phone').textContent = creatorAccountBillingInfo.phone;
        document.getElementById('creator-billing-postal-code').textContent = creatorAccountBillingInfo.postalCode;
        document.getElementById('creator-billing-address').textContent = `${creatorAccountBillingInfo.address1} ${creatorAccountBillingInfo.address2}`;

        // グループ専用情報のフォームに値を設定
        groupBillingInputs.forEach(input => {
            const key = input.id.replace('group-billing-', '').replace(/-([a-z])/g, g => g[1].toUpperCase());
            input.value = group.billingInfo[key] || '';
        });
    };
    
    const populateGroupSelector = (groups, selectedGroupId) => {
        groupSelector.innerHTML = '';
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            if (group.id === selectedGroupId) option.selected = true;
            groupSelector.appendChild(option);
        });
        groupSelector.disabled = false;
    };

    // --- Main Logic ---
    const main = () => {
        const allGroups = allGroupsMock;
        const urlParams = new URLSearchParams(window.location.search);
        const requestedGroupId = urlParams.get('groupId') || allGroups[0].id;
        
        const targetGroup = allGroups.find(g => g.id === requestedGroupId) || allGroups[0];

        populateGroupSelector(allGroups, targetGroup.id);
        applyGroupToForm(targetGroup);

        // --- Event Listeners ---
        groupSelector.addEventListener('change', (e) => {
            const selectedGroupId = e.target.value;
            const newTargetGroup = allGroups.find(g => g.id === selectedGroupId);
            applyGroupToForm(newTargetGroup);
        });

        useCreatorBillingBtn.addEventListener('click', () => {
            if (currentGroup) currentGroup.useGroupBilling = false;
            updateBillingUI(false);
        });

        useGroupBillingBtn.addEventListener('click', () => {
            if (currentGroup) currentGroup.useGroupBilling = true;
            updateBillingUI(true);
        });

        new Sortable(memberListContainer, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
        });
    };

    main();
}
