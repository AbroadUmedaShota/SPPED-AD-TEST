let allCombinedData = []; // 全データを保持する配列

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [answersRes, cardsRes] = await Promise.all([
            fetch('../data/survey-answers.json'),
            fetch('../data/business-cards.json')
        ]);

        allCombinedData = await processData(answersRes, cardsRes);
        populateTable(allCombinedData);
        setupEventListeners();

    } catch (error) {
        console.error('データの読み込みまたは処理中にエラーが発生しました:', error);
    }
});

async function processData(answersRes, cardsRes) {
    const answers = await answersRes.json();
    const businessCards = await cardsRes.json();
    const businessCardsMap = new Map(businessCards.map(card => [card.answerId, card]));

    return answers.map(answer => ({
        ...answer,
        businessCard: businessCardsMap.get(answer.answerId) || null
    }));
}

function setupEventListeners() {
    // 検索イベント
    const searchInput = document.getElementById('searchKeyword');
    searchInput.addEventListener('input', handleSearch);

    // モーダル関連
    const modal = document.getElementById('reviewDetailModal');
    const closeModalBtn = document.getElementById('closeDetailModalBtn');
    closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const filteredData = allCombinedData.filter(item => {
        if (!item.businessCard) return false;
        const fullName = `${item.businessCard.group2.lastName} ${item.businessCard.group2.firstName}`.toLowerCase();
        const companyName = item.businessCard.group3.companyName.toLowerCase();
        return fullName.includes(searchTerm) || companyName.includes(searchTerm);
    });
    populateTable(filteredData);
}

function populateTable(data) {
    const tableBody = document.getElementById('reviewTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = ''; // クリア

    data.forEach(item => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-surface-bright transition-colors';

        const lastName = item.businessCard ? item.businessCard.group2.lastName : '';
        const firstName = item.businessCard ? item.businessCard.group2.firstName : '';
        const companyName = item.businessCard ? item.businessCard.group3.companyName : '';

        const getAnswer = (questionText) => {
            const detail = item.details.find(d => d.question === questionText);
            return detail ? (Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer) : '';
        };

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap">
                <button data-answer-id="${item.answerId}" class="detail-btn text-primary hover:text-primary-dark text-sm font-semibold">詳細</button>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${item.answerId}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${item.answeredAt}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${lastName} ${firstName}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${companyName}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${getAnswer('Q.02_お客様の主な業界')}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-on-surface">${getAnswer('Q.06_【打合せ内容】緊急度（複数選択可）')}</td>
        `;
        tableBody.appendChild(row);
    });

    // 詳細ボタンにイベントリスナーを追加
    document.querySelectorAll('.detail-btn').forEach(button => {
        button.addEventListener('click', showDetailModal);
    });
}

function showDetailModal(e) {
    const answerId = e.target.dataset.answerId;
    const itemData = allCombinedData.find(item => item.answerId === answerId);

    if (!itemData) return;

    // モーダルにデータを投入
    populateModal(itemData);

    // モーダル表示
    const modal = document.getElementById('reviewDetailModal');
    modal.classList.remove('hidden');
}

function populateModal(item) {
    const cardDetailsContainer = document.getElementById('modal-business-card-details');
    const answerDetailsContainer = document.getElementById('modal-survey-answer-details');

    // 名刺情報
    cardDetailsContainer.innerHTML = '';
    if (item.businessCard) {
        const card = item.businessCard;
        const fields = {
            '会社名': card.group3.companyName,
            '氏名': `${card.group2.lastName} ${card.group2.firstName}`,
            '部署・役職': `${card.group3.department} ${card.group3.position}`,
            'メールアドレス': card.group1.email,
            '電話番号': card.group5.mobile || card.group5.tel1,
            '住所': `${card.group4.address1} ${card.group4.address2}`
        };

        for (const [label, value] of Object.entries(fields)) {
            cardDetailsContainer.innerHTML += `
                <div>
                    <p class="text-sm text-on-surface-variant">${label}</p>
                    <p class="text-lg font-semibold text-on-surface">${value || '-'}</p>
                </div>`;
        }
    }

    // アンケート回答
    answerDetailsContainer.innerHTML = '';
    item.details.forEach(detail => {
        const answer = Array.isArray(detail.answer) ? detail.answer.join(', ') : detail.answer;
        answerDetailsContainer.innerHTML += `
            <div>
                <p class="font-semibold text-on-surface">${detail.question}</p>
                <p class="mt-1 p-3 bg-surface-bright rounded-md text-on-surface">${answer || '（無回答）'}</p>
            </div>`;
    });
}