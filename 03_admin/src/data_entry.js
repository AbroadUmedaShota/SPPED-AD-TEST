let performanceChartInstance = null; // Chart.js インスタンスを保持

// Function to render personal performance cards
function renderPersonalPerformance(summary) {
    // Use real data for center-wide completions
    const centerCompletedCount = summary.completedItems;

    // Dummy data for consistency and average time for demonstration
    const consistencyRate = (Math.random() * 5 + 95).toFixed(1); // 95.0-100.0%
    const avgTimeSeconds = Math.floor(Math.random() * 20) + 5; // 5-25 seconds

    const centerCompletedEl = document.getElementById('center-completed-count');
    if (centerCompletedEl) centerCompletedEl.textContent = centerCompletedCount.toLocaleString();

    const consistencyEl = document.getElementById('data-consistency-rate');
    if (consistencyEl) consistencyEl.textContent = `${consistencyRate}%`;

    const personalAvgTime = document.getElementById('personal-avg-time');
    if (personalAvgTime) personalAvgTime.textContent = `${avgTimeSeconds.toFixed(1)}s`;

    // Dummy trend data
    const centerTrend = Math.random() > 0.5 ? 'up' : 'down';
    const centerTrendValue = (Math.random() * 10).toFixed(1);
    const consistencyTrend = Math.random() < 0.5 ? 'up' : 'down';
    const consistencyTrendValue = (Math.random() * 2).toFixed(1);
    const avgTimeTrend = Math.random() > 0.5 ? 'up' : 'down';
    const avgTimeTrendValue = (Math.random() * 2).toFixed(1);

    // Update Center Trend
    const centerTrendIcon = document.getElementById('center-trend-icon');
    const centerTrendText = document.getElementById('center-trend-text');
    if (centerTrendIcon && centerTrendText) {
        centerTrendIcon.textContent = centerTrend === 'up' ? 'trending_up' : 'trending_down';
        centerTrendIcon.className = `material-icons text-base ${centerTrend === 'up' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`;
        centerTrendText.textContent = `前日比 ${centerTrend === 'up' ? '+' : '-'}${centerTrendValue}%`;
    }

    // Update Consistency Trend
    const consistencyTrendIcon = document.getElementById('consistency-trend-icon');
    const consistencyTrendText = document.getElementById('consistency-trend-text');
    if (consistencyTrendIcon && consistencyTrendText) {
        consistencyTrendIcon.textContent = consistencyTrend === 'up' ? 'trending_up' : 'trending_down';
        consistencyTrendIcon.className = `material-icons text-base ${consistencyTrend === 'up' ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`;
        consistencyTrendText.textContent = `前日比 ${consistencyTrend === 'up' ? '+' : '-'}${consistencyTrendValue}%`;
    }

    // Update Avg Time Trend
    const avgTimeTrendIcon = document.getElementById('avg-time-trend-icon');
    const avgTimeTrendText = document.getElementById('avg-time-trend-text');
    if (avgTimeTrendIcon && avgTimeTrendText) {
        avgTimeTrendIcon.textContent = avgTimeTrend === 'up' ? 'trending_up' : 'trending_down';
        avgTimeTrendIcon.className = `material-icons text-base ${avgTimeTrend === 'up' ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`;
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
    let borderColor = 'rgb(75, 192, 192)';

    // Dummy data for the last 7 days
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        labels.push(`${d.getMonth() + 1}/${d.getDate()}`);

        if (type === 'completed') {
            data.push(Math.floor(Math.random() * 30) + 20); // 20-50 completed items
            title = '過去7日間の完了件数';
            borderColor = 'rgb(75, 192, 192)';
        } else if (type === 'avgTime') {
            data.push((Math.random() * 10 + 10).toFixed(1)); // 10-20 seconds avg time
            title = '過去7日間の平均処理時間 (秒)';
            borderColor = 'rgb(255, 99, 132)';
        } else if (type === 'consistency') {
            data.push((Math.random() * 5 + 95).toFixed(1)); // 95-100%
            title = '過去7日間のデータ入力整合性 (%)';
            borderColor = 'rgb(153, 102, 255)';
        }
    }

    performanceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: title,
                data: data,
                borderColor: borderColor,
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
                    beginAtZero: false
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

    const statuses = [
        { text: '未着手', color: 'text-gray-500 dark:text-gray-400' },
        { text: '作業中', color: 'text-blue-600 dark:text-blue-400' },
        { text: '保留', color: 'text-yellow-600 dark:text-yellow-400' },
        { text: '完了', color: 'text-green-600 dark:text-green-400' }
    ];

    tasks.forEach(task => {
        const progress = task.total > 0 ? (task.completed / task.total) * 100 : 0;
        const progressBarColorClass = progress === 100 ? 'bg-green-500 dark:bg-green-600' : 'bg-blue-500 dark:bg-blue-600';
        
        // Select a random status for mock purposes
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
        const statusText = randomStatus.text;
        const statusColorClass = randomStatus.color;

        const row = document.createElement('tr');
        row.className = 'hover:bg-surface-variant cursor-pointer';
        row.onclick = () => {
            if (task.id === 'admin') {
                window.location.href = `sample/data_entry_admin_form.html`;
            } else {
                window.location.href = `BY-211_オペレーター入力画面/BY-213/BY-213.html?groupId=${task.id}`;
            }
        };

        let buttonHtml = '';
        if (task.completed < task.total || task.id === 'admin') {
            const destination = task.id === 'admin'
                ? 'sample/data_entry_admin_form.html'
                : `BY-211_オペレーター入力画面/BY-213/BY-213.html?groupId=${task.id}`;
            buttonHtml = `<button class="bg-blue-500 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-xs" onclick="event.stopPropagation(); window.location.href = '${destination}'">作業開始</button>`;
        }

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-on-surface">${task.name}</div>
                <div class="text-xs ${statusColorClass} mt-1">${statusText}</div>
                <div class="text-xs text-on-surface-variant">${task.description}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center justify-center">
                    <div class="w-24 bg-surface-variant rounded-full h-2.5 mr-3">
                        <div class="${progressBarColorClass} h-2.5 rounded-full" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-sm text-on-surface-variant">${Math.round(progress)}%</span>
                </div>
                <div class="text-xs text-on-surface-variant text-center">${task.completed.toLocaleString()} / ${task.total.toLocaleString()} 件</div>
            </td>
            <td class="py-4 pl-6 pr-0 whitespace-nowrap text-sm text-on-surface-variant">${new Date(task.lastUpdatedAt).toLocaleString('ja-JP')}</td>
            <td class="py-4 pl-2 pr-6 whitespace-nowrap text-left">
                ${buttonHtml}
            </td>
        `;
        tbody.appendChild(row);
    });
}

export async function initDataEntryPage() {
    const data = await fetchData();
    if (!data) return; // Stop if data fetch failed

    renderPersonalPerformance(data.summary);
    renderTaskTable(data.tasks);

    // Event listeners for personal performance cards to open modal
    document.getElementById('center-completed-count').closest('.kpi-card').addEventListener('click', () => {
        document.getElementById('graphModalTitle').textContent = 'センター全体の完了数 詳細';
        document.getElementById('graphModal').classList.remove('hidden');
        renderPerformanceChart('completed');
    });

    document.getElementById('personal-avg-time').closest('.kpi-card').addEventListener('click', () => {
        document.getElementById('graphModalTitle').textContent = '平均処理時間 詳細';
        document.getElementById('graphModal').classList.remove('hidden');
        renderPerformanceChart('avgTime');
    });

    document.getElementById('kpi-consistency-card').addEventListener('click', () => {
        document.getElementById('graphModalTitle').textContent = 'データ入力整合性 詳細';
        document.getElementById('graphModal').classList.remove('hidden');
        renderPerformanceChart('consistency');
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
