let myChart = null;
let performanceChartInstance = null; // Chart.js インスタンスを保持
let currentTaskTimeSeconds = 0; // 現在の作業時間を追跡

// Function to format time (HH:MM:SS)
function formatTime(totalSeconds) {
    const seconds = totalSeconds % 60;
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const hours = Math.floor(totalSeconds / 3600);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Function to update only the current time display
function updateCurrentTimeDisplay() {
    const personalCurrentTime = document.getElementById('personal-current-time');
    if (personalCurrentTime) {
        personalCurrentTime.textContent = formatTime(currentTaskTimeSeconds);
        currentTaskTimeSeconds++; // 1秒ごとに時間を増加
    }
}

// Function to render personal performance cards
function renderPersonalPerformance() {
    // Dummy data for demonstration
    const completedCount = Math.floor(Math.random() * 50) + 10; // 10-60
    const avgTimeSeconds = Math.floor(Math.random() * 20) + 5; // 5-25 seconds
    const currentTaskTimeSeconds = Math.floor(Math.random() * 300) + 60; // 1-6 minutes

    const personalCompletedCount = document.getElementById('personal-completed-count');
    if (personalCompletedCount) personalCompletedCount.textContent = completedCount.toLocaleString();

    const personalAvgTime = document.getElementById('personal-avg-time');
    if (personalAvgTime) personalAvgTime.textContent = `${avgTimeSeconds.toFixed(1)}s`;

    const personalCurrentTime = document.getElementById('personal-current-time');
    if (personalCurrentTime) {
        personalCurrentTime.textContent = formatTime(currentTaskTimeSeconds);
    }

    // Start the timer for current working time
    setInterval(updateCurrentTimeDisplay, 1000);

    // Dummy trend data
    const completedTrend = Math.random() > 0.5 ? 'up' : 'down';
    const completedTrendValue = (Math.random() * 10).toFixed(1);
    const avgTimeTrend = Math.random() > 0.5 ? 'up' : 'down';
    const avgTimeTrendValue = (Math.random() * 2).toFixed(1);

    const completedTrendIcon = document.getElementById('completed-trend-icon');
    const completedTrendText = document.getElementById('completed-trend-text');
    if (completedTrendIcon && completedTrendText) {
        completedTrendIcon.textContent = completedTrend === 'up' ? 'trending_up' : 'trending_down';
        completedTrendIcon.className = `material-icons text-base ${completedTrend === 'up' ? 'text-green-500' : 'text-red-500'}`;
        completedTrendText.textContent = `前日比 ${completedTrend === 'up' ? '+' : '-'}${completedTrendValue}%`;
    }

    const avgTimeTrendIcon = document.getElementById('avg-time-trend-icon');
    const avgTimeTrendText = document.getElementById('avg-time-trend-text');
    if (avgTimeTrendIcon && avgTimeTrendText) {
        avgTimeTrendIcon.textContent = avgTimeTrend === 'up' ? 'trending_up' : 'trending_down';
        avgTimeTrendIcon.className = `material-icons text-base ${avgTimeTrend === 'up' ? 'text-red-500' : 'text-green-500'}`;
        avgTimeTrendText.textContent = `前日比 ${avgTimeTrend === 'up' ? '+' : '-'}${avgTimeTrendValue}s`;
    }
}

// Function to render chart in modal
function renderPerformanceChart(type) {
    if (performanceChartInstance) {
        performanceChartInstance.destroy(); // 既存のグラフがあれば破棄
        performanceChartInstance = null; // インスタンスをリセット
    }
    const chartContainer = document.getElementById('myPerformanceChart').parentNode;
    chartContainer.innerHTML = '<canvas id="myPerformanceChart"></canvas>';
    const ctx = document.getElementById('myPerformanceChart').getContext('2d');

    let labels = [];
    let data = [];
    let title = '';

    // Dummy data for the last 7 days
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(`${d.getMonth() + 1}/${d.getDate()}`);

        if (type === 'completed') {
            data.push(Math.floor(Math.random() * 30) + 20); // 20-50 completed items
            title = '過去7日間の完了件数';
        } else if (type === 'avgTime') {
            data.push((Math.random() * 10 + 10).toFixed(1)); // 10-20 seconds avg time
            title = '過去7日間の平均処理時間 (秒)';
        }
    }

    performanceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: data,
                borderColor: type === 'completed' ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: title
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

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
        const progressBarColorClass = progress === 100 ? 'bg-green-500' : 'bg-blue-500';
        const statusText = progress === 100 ? '完了' : (task.completed > 0 ? '作業中' : '未着手');
        const statusColorClass = progress === 100 ? 'text-green-600' : (task.completed > 0 ? 'text-blue-600' : 'text-gray-500');

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
                <div class="text-xs ${statusColorClass} mt-1">${statusText}</div>
                <div class="text-xs text-on-surface-variant">${task.description}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="w-24 bg-surface-variant rounded-full h-2.5 mr-3">
                        <div class="${progressBarColorClass} h-2.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-sm text-on-surface-variant">${Math.round(progress)}%</span>
                </div>
                <div class="text-xs text-on-surface-variant">${task.completed.toLocaleString()} / ${task.total.toLocaleString()} 件</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">${task.operatorCount}人</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-on-surface-variant">${new Date(task.lastUpdatedAt).toLocaleString('ja-JP')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-right">
                ${task.completed < task.total ? `<button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-xs" onclick="event.stopPropagation(); window.location.href = 'BY-211_オペレーター入力画面/BY-213/BY-213.html?groupId=${task.id}'">作業開始</button>` : ''}
            </td>
        `;
        tbody.appendChild(row);
    });
}

export async function initDataEntryPage() {
    const data = await fetchData();
    if (!data) return; // Stop if data fetch failed

    renderPersonalPerformance();
    renderTaskTable(data.tasks);

    // Event listeners for personal performance cards to open modal
    document.getElementById('personal-completed-count').closest('.kpi-card').addEventListener('click', () => {
        document.getElementById('graphModalTitle').textContent = '今日の完了件数 詳細';
        document.getElementById('graphModal').classList.remove('hidden');
        renderPerformanceChart('completed');
    });

    document.getElementById('personal-avg-time').closest('.kpi-card').addEventListener('click', () => {
        document.getElementById('graphModalTitle').textContent = '平均処理時間 詳細';
        document.getElementById('graphModal').classList.remove('hidden');
        renderPerformanceChart('avgTime');
    });

    document.getElementById('kpi-current-time-card').addEventListener('click', () => {
        document.getElementById('graphModalTitle').textContent = '現在の作業時間 詳細';
        document.getElementById('graphModal').classList.remove('hidden');
        // 現在の作業時間は折れ線グラフではないので、ここではグラフは描画しないか、別の情報を表示する
        // renderPerformanceChart('currentTime'); // 必要であれば実装
    });

    // Event listeners to close modal
    document.getElementById('closeGraphModal').addEventListener('click', () => {
        document.getElementById('graphModal').classList.add('hidden');
    });
    document.getElementById('modalCloseBtn').addEventListener('click', () => {
        document.getElementById('graphModal').classList.add('hidden');
    });

    // Close modal when clicking outside of it
    document.getElementById('graphModal').addEventListener('click', (event) => {
        if (event.target.id === 'graphModal') {
            document.getElementById('graphModal').classList.add('hidden');
        }
    });

    // TODO: Add event listeners for KPI cards and chart period selector
}
