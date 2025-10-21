document.addEventListener('DOMContentLoaded', () => {
    const completedCountEl = document.getElementById('completed-count');
    const avgTimeEl = document.getElementById('avg-time');
    const chartCanvas = document.getElementById('hourly-performance-chart');

    if (!completedCountEl || !avgTimeEl || !chartCanvas) return;

    let hourlyPerformanceChart = null;

    // --- Dummy Data ---
    let completedCount = 0;
    let totalTime = 0;
    const hourlyData = Array(12).fill(0); // last 60 minutes in 5-min intervals
    // ------------------

    function updateKPIs() {
        completedCountEl.textContent = completedCount;
        avgTimeEl.textContent = completedCount > 0 ? `${(totalTime / completedCount).toFixed(1)}s` : '0.0s';
    }

    function renderChart() {
        const ctx = chartCanvas.getContext('2d');
        const labels = Array.from({ length: 12 }, (_, i) => `${(i + 1) * 5}`);

        if (hourlyPerformanceChart) {
            hourlyPerformanceChart.data.datasets[0].data = hourlyData;
            hourlyPerformanceChart.update();
            return;
        }

        hourlyPerformanceChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '処理件数',
                    data: hourlyData,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        display: false
                    },
                    x: {
                        display: false
                    }
                }
            }
        });
    }

    // --- Simulate real-time updates ---
    function simulateUpdate() {
        // Add a new completed item
        completedCount++;
        const timeTaken = Math.random() * 5 + 5; // 5-10 seconds
        totalTime += timeTaken;

        // Update hourly data
        const currentInterval = Math.floor(new Date().getMinutes() / 5) % 12;
        hourlyData[currentInterval]++;

        updateKPIs();
        renderChart();
    }

    // Initial render
    updateKPIs();
    renderChart();

    // Simulate an update every 8 seconds
    setInterval(simulateUpdate, 8000);
});
