let myChart = null;

// Function to fetch data
async function fetchData() {
    try {
        const response = await fetch('../../data/admin/data_entry_status.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Could not fetch data:", error);
        // Display an error message on the page
        const mainContent = document.querySelector('main .max-w-6xl');
        if(mainContent) {
            mainContent.innerHTML = `
                <div class="bg-gray-800 p-6 rounded-lg text-center">
                    <h2 class="text-xl font-semibold text-red-400 mb-2">データの読み込みに失敗しました。</h2>
                    <p class="text-gray-400">時間をおいて再度お試しください。</p>
                    <button onclick="location.reload()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">再試行</button>
                </div>`;
        }
        return null;
    }
}

// Function to render KPI cards
function renderKpiCards(summary) {
    document.getElementById('kpi-total-value').textContent = summary.totalItems.toLocaleString();
    document.getElementById('kpi-escalated-value').textContent = summary.escalatedItems.toLocaleString();
    document.getElementById('kpi-locked-value').textContent = summary.lockedItems.toLocaleString();
    document.getElementById('kpi-completed-value').textContent = summary.completedItems.toLocaleString();
}



// Function to render the task table
function renderTaskTable(tasks) {
    const tbody = document.getElementById('task-list-body');
    tbody.innerHTML = ''; // Clear existing rows

    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-400">表示対象のタスクはありません。</td></tr>';
        return;
    }

    tasks.forEach(task => {
        const progress = task.total > 0 ? (task.completed / task.total) * 100 : 0;
        const row = document.createElement('tr');
        row.className = 'hover:bg-surface-variant cursor-pointer';
        row.onclick = () => {
            if (task.id === 'admin') {
                window.location.href = `sample/data_entry_admin_form.html`;
            } else {
                window.location.href = `BY-211_オペレーター入力画面/BY-213/BY-213.html?groupId=${task.id}`;
            }
        };

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-on-surface">${task.name}</div>
                <div class="text-xs text-on-surface-variant">${task.description}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-24 bg-surface-variant rounded-full h-2.5 mr-3">
                        <div class="bg-blue-500 h-2.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-sm text-on-surface-variant">${Math.round(progress)}%</span>
                </div>
                <div class="text-xs text-on-surface-variant">${task.completed.toLocaleString()} / ${task.total.toLocaleString()} 件</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">${task.operatorCount}人</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">${new Date(task.lastUpdatedAt).toLocaleString('ja-JP')}</td>
        `;
        tbody.appendChild(row);
    });
}

export async function initDataEntryPage() {
    const data = await fetchData();
    if (!data) return; // Stop if data fetch failed

    renderKpiCards(data.summary);
    renderTaskTable(data.tasks);

    // TODO: Add event listeners for KPI cards and chart period selector
}
