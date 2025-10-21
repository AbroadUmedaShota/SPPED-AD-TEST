let performanceChartInstance = null; // Chart.js インスタンスを保持

/**
 * カード内に簡易的な折れ線グラフ（スパークライン）を作成する
 * @param {string} canvasId - canvas要素のID
 * @param {number[]} data - グラフに表示するデータ配列
 * @param {boolean} isPositiveGood - 上昇傾向が良い傾向であるか（良い場合は緑、悪い場合は赤）
 */
function createSparkline(canvasId, data, isPositiveGood = true) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const trendColor = data[data.length - 1] >= data[0] 
        ? (isPositiveGood ? 'rgba(75, 192, 192, 1)' : 'rgba(255, 99, 132, 1)') 
        : (isPositiveGood ? 'rgba(255, 99, 132, 1)' : 'rgba(75, 192, 192, 1)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map((_, i) => i),
            datasets: [{
                data: data,
                borderColor: trendColor,
                borderWidth: 2,
                pointRadius: 0, // 点を非表示に
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}

/**
 * 個人のパフォーマンスKPIカードを描画する
 */
function renderPersonalPerformance() {
    // --- Dummy Data ---
    const completedCount = Math.floor(Math.random() * 50) + 10;
    const avgTimeSeconds = Math.floor(Math.random() * 20) + 5;
    const perHourCount = Math.floor(Math.random() * 15) + 5;

    const completedData = [12, 15, 10, 18, 22, 25, completedCount];
    const avgTimeData = [15.2, 14.8, 16.1, 14.5, 13.9, 14.2, avgTimeSeconds];
    const perHourData = [8, 10, 9, 11, 14, 12, perHourCount];
    // ------------------

    document.getElementById('personal-completed-count').textContent = completedCount.toLocaleString();
    document.getElementById('personal-avg-time').textContent = `${avgTimeSeconds.toFixed(1)}s`;
    document.getElementById('personal-per-hour-count').textContent = perHourCount.toLocaleString();

    createSparkline('sparkline-completed', completedData, true); // 件数は多い方が良い
    createSparkline('sparkline-avg-time', avgTimeData, false); // 平均時間は少ない方が良い
    createSparkline('sparkline-per-hour', perHourData, true); // 時間あたり件数は多い方が良い
}

/**
 * モーダル内に詳細なパフォーマンスグラフを描画する
 * @param {'completed' | 'avgTime' | 'perHour'} type - グラフの種類
 */
function renderPerformanceChart(type) {
    if (performanceChartInstance) {
        performanceChartInstance.destroy();
    }
    const chartContainer = document.getElementById('myPerformanceChart').parentNode;
    chartContainer.innerHTML = '<canvas id="myPerformanceChart"></canvas>';
    const ctx = document.getElementById('myPerformanceChart').getContext('2d');

    let title = '';
    let data = [];
    const labels = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });

    switch (type) {
        case 'completed':
            title = '過去7日間の完了件数';
            data = [12, 15, 10, 18, 22, 25, Math.floor(Math.random() * 50) + 10];
            break;
        case 'avgTime':
            title = '過去7日間の平均処理時間 (秒)';
            data = [15.2, 14.8, 16.1, 14.5, 13.9, 14.2, Math.floor(Math.random() * 20) + 5];
            break;
        case 'perHour':
            title = '過去7日間の時間あたり処理件数';
            data = [8, 10, 9, 11, 14, 12, Math.floor(Math.random() * 15) + 5];
            break;
    }

    performanceChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: data,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }, title: { display: true, text: title } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

async function fetchData() {
    try {
        const response = await fetch('../../data/admin/data_entry_status.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error("Could not fetch data:", error);
        const mainContent = document.querySelector('main');
        if(mainContent) {
            mainContent.innerHTML = `<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-center" role="alert">
                <strong class="font-bold">データの読み込みに失敗しました。</strong>
                <span class="block sm:inline">時間をおいて再度お試しください。</span>
            </div>`;
        }
        return null;
    }
}

function renderTaskTable(tasks) {
    const tbody = document.getElementById('task-list-body');
    tbody.innerHTML = ''; // Clear existing rows

    if (tasks.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-8 text-gray-500">表示対象のタスクはありません。</td></tr>';
        return;
    }

    tasks.forEach(task => {
        const progress = task.total > 0 ? (task.completed / task.total) * 100 : 0;
        const progressBarColorClass = progress === 100 ? 'bg-green-500' : 'bg-blue-500';
        
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-100 cursor-pointer';
        row.onclick = () => {
            // This is a simplified navigation. In a real app, you might want to go to a detailed task page.
            console.log(`Navigating to task ${task.id}`);
        };

        row.innerHTML = `
            <td class="px-6 py-4">
                <div class="text-sm font-medium text-gray-900">${task.name}</div>
                <div class="text-xs text-gray-500 mt-1">${task.description}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-full bg-gray-200 rounded-full h-2.5 mr-3">
                        <div class="${progressBarColorClass} h-2.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-sm text-gray-600">${Math.round(progress)}%</span>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">${task.operatorCount}人</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex justify-between items-center">
                    <span class="text-sm text-gray-500">${new Date(task.lastUpdatedAt).toLocaleString('ja-JP')}</span>
                    ${task.completed < task.total ? `<button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-xs ml-4 flex-shrink-0" onclick="event.stopPropagation(); window.location.href = 'BY-211_オペレーター入力画面/BY-213/BY-213.html?groupId=${task.id}'">作業開始</button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

export async function initDataEntryPage() {
    const data = await fetchData();
    if (!data) return;

    renderPersonalPerformance();
    renderTaskTable(data.tasks);

    // Event listeners for personal performance cards to open modal
    document.getElementById('kpi-completed-card').addEventListener('click', () => {
        document.getElementById('graphModalTitle').textContent = '今日の完了件数 詳細';
        document.getElementById('graphModal').classList.remove('hidden');
        renderPerformanceChart('completed');
    });

    document.getElementById('kpi-avg-time-card').addEventListener('click', () => {
        document.getElementById('graphModalTitle').textContent = '平均処理時間 詳細';
        document.getElementById('graphModal').classList.remove('hidden');
        renderPerformanceChart('avgTime');
    });

    document.getElementById('kpi-per-hour-card').addEventListener('click', () => {
        document.getElementById('graphModalTitle').textContent = '時間あたり処理件数 詳細';
        document.getElementById('graphModal').classList.remove('hidden');
        renderPerformanceChart('perHour');
    });

    // Event listeners to close modal
    document.getElementById('closeGraphModal').addEventListener('click', () => {
        document.getElementById('graphModal').classList.add('hidden');
    });
    document.getElementById('modalCloseBtn').addEventListener('click', () => {
        document.getElementById('graphModal').classList.add('hidden');
    });

    document.getElementById('graphModal').addEventListener('click', (event) => {
        if (event.target.id === 'graphModal') {
            document.getElementById('graphModal').classList.add('hidden');
        }
    });
}