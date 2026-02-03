import { initBreadcrumbs } from './breadcrumb.js';
import { resolveDemoDataPath, showToast } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    initGraphPage();
});

// --- Global State ---
const chartInstances = {};
const chartDataStore = new Map();
let originalAnswers = [];
let currentSurvey = null;
let startDatePicker = null;
let endDatePicker = null;
let currentDateFilter = null;
let chartSequence = 0;

// 表示オプションの状態管理
const displayOptions = {
    showSummary: true,
    showDataLabels: true,
    showCenterText: true,
    showGrid: false
};

const SINGLE_CHOICE_TYPES = new Set(['single_choice', 'dropdown']);
const MULTI_CHOICE_TYPES = new Set(['multi_choice']);
const MATRIX_SINGLE_TYPES = new Set(['matrix_sa', 'matrix_single']);
const MATRIX_MULTI_TYPES = new Set(['matrix_ma', 'matrix_multi', 'matrix_multiple']);
const BLANK_TYPES = new Set([
    'text',
    'free_text',
    'number',
    'date',
    'datetime',
    'datetime_local',
    'time',
    'handwriting',
    'explanation'
]);

/**
 * Initializes the graph page.
 */
async function initGraphPage() {
    initBreadcrumbs();
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId') || 'sv_0001_24001';

    setupFilterEventListeners();
    await loadAndRenderCharts(surveyId);
}

/**
 * Sets up all filter related event listeners.
 */
function setupFilterEventListeners() {
    flatpickr.localize(flatpickr.l10ns.ja);

    const startEl = document.getElementById('startDateInput');
    const endEl = document.getElementById('endDateInput');
    const daySelect = document.getElementById('dayFilterSelect');
    const simpleTab = document.getElementById('simple-search-tab');
    const detailedTab = document.getElementById('detailed-search-tab');
    const simpleContent = document.getElementById('simple-search-content');
    const detailedContent = document.getElementById('detailed-search-content');
    const resetBtn = document.getElementById('resetFiltersButton');

    // --- Search Tab Logic ---
    if (simpleTab && detailedTab && simpleContent && detailedContent) {
        const switchTab = (mode) => {
            if (mode === 'simple') {
                simpleTab.classList.add('bg-surface', 'text-primary', 'shadow-sm');
                simpleTab.classList.remove('text-on-surface-variant', 'hover:text-on-surface');
                detailedTab.classList.remove('bg-surface', 'text-primary', 'shadow-sm');
                detailedTab.classList.add('text-on-surface-variant', 'hover:text-on-surface');
                simpleContent.classList.remove('hidden');
                detailedContent.classList.add('hidden');
            } else {
                detailedTab.classList.add('bg-surface', 'text-primary', 'shadow-sm');
                detailedTab.classList.remove('text-on-surface-variant', 'hover:text-on-surface');
                simpleTab.classList.remove('bg-surface', 'text-primary', 'shadow-sm');
                simpleTab.classList.add('text-on-surface-variant', 'hover:text-on-surface');
                detailedContent.classList.remove('hidden');
                simpleContent.classList.add('hidden');
            }
        };
        simpleTab.addEventListener('click', () => switchTab('simple'));
        detailedTab.addEventListener('click', () => switchTab('detailed'));
    }

    const fpConfig = {
        enableTime: true,
        dateFormat: "Y-m-d H:i",
        minDate: "2026-01-04",
        maxDate: "2026-01-17",
        onChange: () => {
            if (startDatePicker && endDatePicker) {
                const start = startDatePicker.selectedDates[0];
                const end = endDatePicker.selectedDates[0];
                if (start && end) {
                    currentDateFilter = [start, end];
                    if (daySelect && daySelect.value !== 'custom' && valFromSelectChange !== true) {
                        daySelect.value = 'custom';
                    }
                    triggerChartUpdate();
                }
            }
        }
    };

    let valFromSelectChange = false;

    if (startEl && endEl) {
        startDatePicker = flatpickr(startEl, fpConfig);
        endDatePicker = flatpickr(endEl, fpConfig);
    }

    if (daySelect) {
        daySelect.addEventListener('change', (e) => {
            const val = e.target.value;
            valFromSelectChange = true;
            if (val === 'all') {
                startDatePicker.setDate("2026-01-04 00:00");
                endDatePicker.setDate("2026-01-17 23:59");
                currentDateFilter = [new Date(2026, 0, 3, 15, 0), new Date(2026, 0, 17, 23, 59)]; // Note: Timezone consideration if necessary, but following speed-review logic
                // Using exact dates for filter
                currentDateFilter = [new Date(2026, 0, 4, 0, 0), new Date(2026, 0, 17, 23, 59)];
            } else if (val === 'custom') {
                valFromSelectChange = false;
                return;
            } else {
                startDatePicker.setDate(`${val} 00:00`);
                endDatePicker.setDate(`${val} 23:59`);
                const d = val.split('-');
                currentDateFilter = [new Date(d[0], d[1] - 1, d[2], 0, 0), new Date(d[0], d[1] - 1, d[2], 23, 59)];
            }
            triggerChartUpdate();
            valFromSelectChange = false;
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', handleResetFilters);
    }

    // --- Display Options Logic ---
    const optIds = {
        'opt-show-summary': 'showSummary',
        'opt-show-datalabels': 'showDataLabels',
        'opt-show-center-text': 'showCenterText',
        'opt-show-grid': 'showGrid'
    };

    Object.entries(optIds).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                displayOptions[key] = e.target.checked;
                triggerChartUpdate();
            });
        }
    });
}

/**
 * Handles the reset filters button click.
 */
function handleResetFilters() {
    currentDateFilter = null;
    if (startDatePicker) startDatePicker.clear();
    if (endDatePicker) endDatePicker.clear();
    const daySelect = document.getElementById('dayFilterSelect');
    if (daySelect) daySelect.value = 'all';
    triggerChartUpdate();
}

/**
 * Triggers a chart update based on the current date filter.
 */
function triggerChartUpdate() {
    let answersToProcess = originalAnswers;

    if (currentDateFilter && currentDateFilter.length === 2) {
        const [startDate, endDate] = currentDateFilter;
        answersToProcess = originalAnswers.filter(answer => {
            if (!answer.answeredAt) return false;
            const itemDate = new Date(answer.answeredAt);
            return itemDate >= startDate && itemDate <= endDate;
        });
    }
    
    const chartData = processDataForCharts(currentSurvey, answersToProcess);
    renderCharts(chartData);
}

/**
 * Fetches all necessary data and renders the charts.
 * @param {string} surveyId The ID of the survey to display.
 */
async function loadAndRenderCharts(surveyId) {
    showLoading(true);
    try {
        if (!surveyId) {
            throw new Error("アンケートIDが指定されていません。");
        }

        // 1. Fetch survey definition and answer data in parallel
        const [surveyDefinition, answers] = await Promise.all([
            fetch(resolveDemoDataPath(`surveys/${surveyId}.json`)).then(res => {
                if (!res.ok) throw new Error(`アンケート定義ファイルが見つかりません: ${surveyId}.json`);
                return res.json();
            }),
            fetch(resolveDemoDataPath(`answers/${surveyId}.json`)).then(res => {
                if (!res.ok) return [];
                return res.json();
            })
        ]);

        // 2. Set the current survey definition
        currentSurvey = surveyDefinition;
        if (!currentSurvey) {
            throw new Error(`アンケートID「${surveyId}」の定義が見つかりません。`);
        }
        
        originalAnswers = answers;

        if (originalAnswers.length === 0) {
             console.warn(`アンケートID「${surveyId}」に対する回答データが見つかりませんでした。`);
        }

        // 3. Set survey name and render charts
        document.getElementById('survey-title').textContent = `グラフ分析: ${currentSurvey.name.ja}`;
        
        const chartData = processDataForCharts(currentSurvey, originalAnswers);
        renderCharts(chartData);

    } catch (error) {
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

/**
 * Processes raw survey data into a format suitable for charting.
 * @param {object} survey The survey definition object.
 * @param {Array} answers The array of answer objects.
 * @returns {Array} An array of objects, each representing a chart.
 */
function processDataForCharts(survey, answers) {
    if (!survey.details) return [];

    const charts = [];
    chartSequence = 0;

    survey.details.forEach((question, index) => {
        const questionId = question.id || `q${index + 1}`;

        if (MATRIX_SINGLE_TYPES.has(question.type)) {
            const matrixCharts = buildMatrixCharts(question, questionId, answers, false);
            charts.push(...matrixCharts);
            return;
        }

        if (MATRIX_MULTI_TYPES.has(question.type)) {
            const matrixCharts = buildMatrixCharts(question, questionId, answers, true);
            charts.push(...matrixCharts);
            return;
        }

        if (SINGLE_CHOICE_TYPES.has(question.type)) {
            const summary = buildChoiceSummary(question, answers, false);
            charts.push(buildChartData({
                questionId,
                questionText: question.text,
                chartType: 'pie',
                summaryType: 'table',
                includeTotalRow: true,
                allowToggle: true,
                ...summary
            }));
            return;
        }

        if (MULTI_CHOICE_TYPES.has(question.type)) {
            const summary = buildChoiceSummary(question, answers, true);
            charts.push(buildChartData({
                questionId,
                questionText: question.text,
                chartType: 'bar',
                summaryType: 'table',
                includeTotalRow: false,
                allowToggle: true,
                ...summary
            }));
            return;
        }

        if (BLANK_TYPES.has(question.type)) {
            charts.push(buildBlankChart(questionId, question.text, getBlankReason(question.type)));
            return;
        }

        charts.push(buildBlankChart(questionId, question.text, '未対応の設問タイプ'));
    });

    return charts;
}

/**
 * Renders all charts onto the page.
 * @param {Array} chartsData Data for all charts to be rendered.
 */
function renderCharts(chartsData) {
    const container = document.getElementById('charts-container');
    container.innerHTML = '';
    chartDataStore.clear();

    Object.keys(chartInstances).forEach(key => {
        chartInstances[key].destroy();
        delete chartInstances[key];
    });

    if (chartsData.length === 0) {
        container.innerHTML = '<p class="text-on-surface-variant lg:col-span-2">このアンケートにグラフ化可能な質問がありません。</p>';
        return;
    }

    chartsData.forEach(chartData => {
        const chartId = `chart-${chartData.chartId}`;
        const card = document.createElement('div');
        card.className = 'bg-surface p-6 rounded-2xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow';

        const actionButtons = buildActionButtons(chartData, chartId);
        const chartArea = buildChartArea(chartData, chartId);
        const questionTitle = escapeHtml(chartData.questionText);
        
        // アイコン判定
        const isBlank = chartData.chartType === 'blank';
        const iconName = isBlank ? 'subject' : 'analytics';
        const iconColor = isBlank ? 'text-on-surface-variant/60' : 'text-primary';

        // クイックインサイト（Top回答）の算出
        let insightHtml = '';
        if (displayOptions.showSummary && !isBlank && chartData.labels.length > 0) {
            const maxIdx = chartData.data.indexOf(Math.max(...chartData.data));
            const topLabel = chartData.labels[maxIdx];
            const topVal = chartData.data[maxIdx];
            const topPercent = chartData.totalAnswers > 0 ? Math.round((topVal / chartData.totalAnswers) * 100) : 0;
            
            insightHtml = `
                <div class="flex items-center gap-2 bg-primary/5 border border-primary/10 px-3 py-1.5 rounded-full">
                    <span class="text-[10px] font-bold text-primary uppercase tracking-wider">Top Result</span>
                    <span class="text-sm font-bold text-on-surface">${escapeHtml(topLabel)}</span>
                    <span class="text-xs font-medium text-primary">${topPercent}%</span>
                </div>
            `;
        }

        const summaryArea = chartData.summaryType === 'table'
            ? `<div id="summary-${chartId}" class="text-sm"></div>`
            : '';
        const contentArea = chartData.summaryType === 'table'
            ? `
                <div class="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                    <div class="lg:col-span-2">${summaryArea}</div>
                    <div class="lg:col-span-3">${chartArea}</div>
                </div>
            `
            : `
                <div class="space-y-4">
                    ${summaryArea}
                    ${chartArea}
                </div>
            `;

        card.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-start gap-4 mb-6">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center shrink-0">
                        <span class="material-icons ${iconColor}">${iconName}</span>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-on-surface leading-tight">${questionTitle}</h3>
                        <p class="text-xs text-on-surface-variant mt-1">有効回答数: ${chartData.totalAnswers}件</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 self-end sm:self-start">
                    ${insightHtml}
                    ${actionButtons}
                </div>
            </div>
            <div class="flex justify-between items-center mb-4">
                ${buildChartTypeButtons(chartData, chartId)}
            </div>
            ${contentArea}
        `;

        container.appendChild(card);
        chartDataStore.set(chartId, chartData);

        if (chartData.chartType !== 'blank') {
            createChart(chartId, chartData, chartData.chartType);
        }

        if (chartData.summaryType === 'table') {
            renderChartSummaryTable(`summary-${chartId}`, chartData);
        }
    });

    // ... (以下イベントリスナー部分は変更なし) ...
    // Add event listeners for chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const { chartId, chartType } = e.currentTarget.dataset;
            const data = chartDataStore.get(chartId);
            if (!data) return;
            createChart(chartId, data, chartType);
            
            const buttons = e.currentTarget.parentElement.querySelectorAll('.chart-type-btn');
            buttons.forEach(btn => {
                btn.classList.remove('active', 'bg-primary', 'text-on-primary');
                btn.classList.add('bg-surface', 'text-primary');
            });
            
            e.currentTarget.classList.add('active', 'bg-primary', 'text-on-primary');
            e.currentTarget.classList.remove('bg-surface', 'text-primary');
        });
    });

    // Add event listeners for download buttons
    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const buttonEl = e.currentTarget;
            const chartId = buttonEl.dataset.chartId;
            const chartData = chartDataStore.get(chartId);
            if (!chartData) return;
            const questionText = chartData.questionText;
            const chartCard = buttonEl.closest('.bg-surface');

            if (chartCard && window.html2canvas) {
                const elementsToHide = [buttonEl];
                const groupEl = chartCard.querySelector('[role="group"]');
                if (groupEl) elementsToHide.push(groupEl);
                elementsToHide.forEach(el => el && (el.style.visibility = 'hidden'));

                html2canvas(chartCard, {
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    scale: 2
                }).then(canvas => {
                    elementsToHide.forEach(el => el && (el.style.visibility = 'visible'));
                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    const sanitizedQuestion = questionText.replace(/[<>:"/\\|?*]/g, '_');
                    link.download = `${sanitizedQuestion}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }).catch(err => {
                    elementsToHide.forEach(el => el && (el.style.visibility = 'visible'));
                    console.error('html2canvas failed:', err);
                });
            }
        });
    });

    const exportAllButton = document.getElementById('excel-export-all');
    if (exportAllButton) {
        exportAllButton.onclick = () => exportAllChartsToExcel(chartsData);
    }
}

/**
 * Creates or updates a Chart.js instance.
 * @param {string} chartId The ID of the canvas element.
 * @param {object} chartData The data for the chart.
 * @param {string} type The type of chart ('bar' or 'pie'/'doughnut').
 */
function createChart(chartId, chartData, type) {
    const ctx = document.getElementById(chartId).getContext('2d');
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
    }

    const colors = ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#AB47BC', '#00ACC1', '#FF7043', '#9E9D24'];

    const whiteBgPlugin = {
        id: 'whiteBg',
        beforeDraw: (chart) => {
            const {ctx} = chart;
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, chart.width, chart.height);
            ctx.restore();
        }
    };

    // ドーナツグラフの中央に合計値を表示するプラグイン
    const centerTextPlugin = {
        id: 'centerText',
        beforeDraw: (chart) => {
            if (displayOptions.showCenterText && chart.config.type === 'doughnut') {
                const { ctx, width, height } = chart;
                ctx.restore();
                const fontSize = (height / 160).toFixed(2);
                ctx.font = `bold ${fontSize}em sans-serif`;
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#1A1A1A";

                const text = chartData.totalAnswers.toLocaleString();
                const textX = Math.round((width - ctx.measureText(text).width) / 2);
                const textY = height / 2;

                ctx.fillText(text, textX, textY);

                ctx.font = `500 ${(height / 400).toFixed(2)}em sans-serif`;
                ctx.fillStyle = "#6B6B6B";
                const subText = "Total";
                const subTextX = Math.round((width - ctx.measureText(subText).width) / 2);
                const subTextY = textY + 25;
                ctx.fillText(subText, subTextX, subTextY);
                ctx.save();
            }
        }
    };

    let chartConfigType = type === 'pie' ? 'doughnut' : 'bar';
    let chartConfigData;
    let chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: type === 'bar' ? 'y' : 'x', // 横棒グラフに
        plugins: {
            legend: {
                position: chartConfigType === 'doughnut' ? 'right' : 'top',
                display: chartConfigType === 'doughnut',
                labels: {
                    boxWidth: 12,
                    padding: 15,
                    font: { size: 11 }
                }
            },
            datalabels: {
                display: displayOptions.showDataLabels,
                color: (context) => {
                    return chartConfigType === 'doughnut' ? '#fff' : '#1A1A1A';
                },
                anchor: (context) => {
                    return chartConfigType === 'doughnut' ? 'center' : 'end';
                },
                align: (context) => {
                    return chartConfigType === 'doughnut' ? 'center' : 'right';
                },
                offset: 8,
                font: {
                    weight: 'bold',
                    size: 11
                },
                formatter: (value, context) => {
                    if (chartConfigType === 'doughnut') {
                        const total = context.dataset.data.reduce((acc, curr) => acc + curr, 0);
                        const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                        return percentage > 8 ? `${percentage}%` : '';
                    }
                    return value > 0 ? `${value}件` : '';
                }
            },
            tooltip: {
                backgroundColor: 'rgba(26, 26, 26, 0.9)',
                padding: 12,
                titleFont: { size: 13 },
                bodyFont: { size: 13 },
                cornerRadius: 8
            }
        },
        scales: {
            x: {
                display: chartConfigType === 'bar',
                grid: { display: displayOptions.showGrid },
                ticks: { font: { size: 10 } }
            },
            y: {
                display: chartConfigType === 'bar',
                grid: { 
                    display: displayOptions.showGrid,
                    borderDash: [2, 2], 
                    color: '#E0E0E0' 
                },
                ticks: { font: { size: 11 } }
            }
        }
    };

    if (chartConfigType === 'doughnut') {
        chartConfigData = {
            labels: chartData.labels,
            datasets: [{
                data: chartData.data,
                backgroundColor: chartData.labels.map((_, index) => colors[index % colors.length]),
                borderWidth: 0,
                hoverOffset: 10
            }]
        };
        chartOptions.cutout = '70%';
    } else {
        chartConfigData = {
            labels: chartData.labels,
            datasets: [{
                label: '件数',
                data: chartData.data,
                backgroundColor: colors[0],
                borderRadius: 6,
                barThickness: 24
            }]
        };
        chartOptions.plugins.legend.display = false; // 横棒グラフ時は凡例不要（軸でわかるため）
    }

    chartInstances[chartId] = new Chart(ctx, {
        type: chartConfigType,
        data: chartConfigData,
        options: chartOptions,
        plugins: [whiteBgPlugin, centerTextPlugin, ChartDataLabels]
    });
}

/**
 * Renders the summary table for a chart.
 * @param {string} summaryId The ID of the summary container element.
 * @param {object} chartData The data for the chart.
 */
function renderChartSummaryTable(summaryId, chartData) {
    const container = document.getElementById(summaryId);
    if (!container) return;

    const totalVotes = chartData.totalAnswers || 0;

    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm border border-outline-variant">
                <thead class="bg-surface-variant text-on-surface-variant">
                    <tr>
                        <th class="px-3 py-2 border-b border-outline-variant">項目</th>
                        <th class="px-3 py-2 border-b border-outline-variant text-right">件数</th>
                        <th class="px-3 py-2 border-b border-outline-variant text-right">割合</th>
                    </tr>
                </thead>
                <tbody>
    `;

    chartData.labels.forEach((label, index) => {
        const count = chartData.data[index] || 0;
        const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0';
        html += `
            <tr>
                <td class="px-3 py-2 border-b border-outline-variant">${escapeHtml(label)}</td>
                <td class="px-3 py-2 border-b border-outline-variant text-right">${count}件</td>
                <td class="px-3 py-2 border-b border-outline-variant text-right">${percentage}%</td>
            </tr>
        `;
    });

    if (chartData.includeTotalRow) {
        const totalPercentage = totalVotes > 0 ? '100.0%' : '0.0%';
        html += `
            <tr class="font-semibold">
                <td class="px-3 py-2">合計</td>
                <td class="px-3 py-2 text-right">${totalVotes}件</td>
                <td class="px-3 py-2 text-right">${totalPercentage}</td>
            </tr>
        `;
    }

    html += `
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML = html;
}

// --- Utility Functions ---
function showLoading(isLoading) {
    document.getElementById('loading-indicator').style.display = isLoading ? 'block' : 'none';
    if (isLoading) {
        document.getElementById('charts-container').innerHTML = '';
        showError('', false);
    }
}

function showError(message, show = true) {
    const container = document.getElementById('error-display');
    const msgElem = document.getElementById('error-message');
    if (show) {
        msgElem.textContent = message;
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
    }
}

function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getBlankReason(type) {
    switch (type) {
        case 'text':
        case 'free_text':
            return '自由記述のため';
        case 'number':
            return '数値入力のため';
        case 'date':
        case 'datetime':
        case 'datetime_local':
        case 'time':
            return '日付・時刻入力のため';
        case 'handwriting':
            return '手書き入力のため';
        case 'explanation':
            return '説明カードのため';
        default:
            return '未対応の設問タイプ';
    }
}

function normalizeQuestionText(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .replace(/^[\s　]*q[0-9０-９]+[._、:：\s-]*/i, '')
        .replace(/\s+/g, '');
}

function findAnswerDetail(answer, question) {
    if (!answer || !answer.details) return null;
    const normalizedTarget = normalizeQuestionText(question.text);
    return answer.details.find(detail => {
        if (!detail || !detail.question) return false;
        if (detail.question === question.text) return true;
        return normalizeQuestionText(detail.question) === normalizedTarget;
    }) || null;
}

function normalizeChoiceOptions(options = []) {
    const labels = [];
    const map = new Map();

    options.forEach((opt, index) => {
        if (opt && typeof opt === 'object') {
            const value = opt.value ?? opt.id ?? opt.text ?? `option_${index + 1}`;
            const text = opt.text ?? opt.label ?? opt.value ?? opt.id ?? String(value);
            labels.push(text);
            map.set(String(value), text);
            map.set(String(text), text);
        } else if (opt !== undefined && opt !== null) {
            const text = String(opt);
            labels.push(text);
            map.set(text, text);
        }
    });

    return { labels, map };
}

function resolveOptionLabel(value, optionsInfo) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object') {
        const raw = value.value ?? value.text ?? value.label ?? value.id;
        if (raw !== undefined && raw !== null) {
            return optionsInfo.map.get(String(raw)) || String(raw);
        }
        return null;
    }
    return optionsInfo.map.get(String(value)) || String(value);
}

function buildChoiceSummary(question, answers, isMulti) {
    const counts = {};
    let answeredCount = 0;
    const optionsInfo = normalizeChoiceOptions(question.options || []);

    answers.forEach(answer => {
        const detail = findAnswerDetail(answer, question);
        if (!detail || detail.answer === undefined || detail.answer === null || detail.answer === '') return;

        const answerValue = detail.answer;
        const selections = Array.isArray(answerValue) ? answerValue : [answerValue];
        if (selections.length === 0) return;

        answeredCount += 1;
        selections.forEach(selection => {
            const label = resolveOptionLabel(selection, optionsInfo);
            if (!label) return;
            counts[label] = (counts[label] || 0) + 1;
        });
    });

    const labels = optionsInfo.labels.length > 0
        ? optionsInfo.labels
        : Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

    const data = labels.map(label => counts[label] || 0);

    return {
        labels,
        data,
        totalAnswers: answeredCount
    };
}

function normalizeMatrixRows(rows = []) {
    return rows.map((row, index) => {
        if (row && typeof row === 'object') {
            const id = row.id ?? row.value ?? row.text ?? `row_${index + 1}`;
            const text = row.text ?? row.label ?? row.value ?? row.id ?? String(id);
            return { id: String(id), text: String(text) };
        }
        const text = row !== undefined && row !== null ? String(row) : `row_${index + 1}`;
        return { id: text, text };
    });
}

function normalizeMatrixColumns(columns = []) {
    return columns.map((column, index) => {
        if (column && typeof column === 'object') {
            const value = column.value ?? column.id ?? column.text ?? `col_${index + 1}`;
            const text = column.text ?? column.label ?? column.value ?? column.id ?? String(value);
            return { value: String(value), text: String(text) };
        }
        const text = column !== undefined && column !== null ? String(column) : `col_${index + 1}`;
        return { value: text, text };
    });
}

function extractMatrixRowResponses(answerValue, row) {
    if (!answerValue) return [];

    const rowKeys = [row.id, row.text].filter(Boolean);

    if (Array.isArray(answerValue)) {
        const matched = answerValue.filter(item => {
            if (!item || typeof item !== 'object') return false;
            const rowId = item.rowId ?? item.row ?? item.key ?? item.id;
            const rowText = item.rowText ?? item.label ?? item.text;
            return rowKeys.includes(String(rowId)) || rowKeys.includes(String(rowText));
        });

        if (matched.length === 0) return [];

        return matched.flatMap(item => normalizeMatrixValue(item.value ?? item.column ?? item.answer ?? item.selection));
    }

    if (typeof answerValue === 'object') {
        for (const key of rowKeys) {
            if (Object.prototype.hasOwnProperty.call(answerValue, key)) {
                return normalizeMatrixValue(answerValue[key]);
            }
        }
    }

    return [];
}

function normalizeMatrixValue(value) {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) {
        return value.filter(item => item !== undefined && item !== null && item !== '');
    }
    return [value];
}

function resolveMatrixColumnLabel(value, columns) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object') {
        const raw = value.value ?? value.text ?? value.label ?? value.id;
        if (raw !== undefined && raw !== null) {
            return resolveMatrixColumnLabel(raw, columns);
        }
        return null;
    }
    const valueStr = String(value);
    const column = columns.find(col => col.value === valueStr || col.text === valueStr);
    return column ? column.text : valueStr;
}

function buildMatrixCharts(question, questionId, answers, isMulti) {
    const rows = normalizeMatrixRows(question.rows || []);
    const columns = normalizeMatrixColumns(question.columns || []);

    if (rows.length === 0 || columns.length === 0) {
        return [buildBlankChart(questionId, question.text)];
    }

    return rows.map((row, rowIndex) => {
        const counts = {};
        columns.forEach(col => {
            counts[col.text] = 0;
        });

        let answeredCount = 0;

        answers.forEach(answer => {
            const detail = findAnswerDetail(answer, question);
            if (!detail || detail.answer === undefined || detail.answer === null || detail.answer === '') return;

            const responses = extractMatrixRowResponses(detail.answer, row);
            if (responses.length === 0) return;

            answeredCount += 1;
            responses.forEach(response => {
                const label = resolveMatrixColumnLabel(response, columns);
                if (!label) return;
                if (!Object.prototype.hasOwnProperty.call(counts, label)) {
                    counts[label] = 0;
                }
                counts[label] += 1;
            });
        });

        const labels = columns.map(col => col.text);
        const data = labels.map(label => counts[label] || 0);

        return buildChartData({
            questionId: `${questionId}_${rowIndex + 1}`,
            questionText: `${question.text} - ${row.text}`,
            chartType: isMulti ? 'bar' : 'pie',
            summaryType: isMulti ? 'none' : 'table',
            includeTotalRow: !isMulti,
            allowToggle: false,
            labels,
            data,
            totalAnswers: answeredCount
        });
    });
}

function buildChartData(data) {
    chartSequence += 1;
    return {
        chartId: `${data.questionId}_${chartSequence}`,
        questionId: data.questionId,
        questionText: data.questionText,
        labels: data.labels || [],
        data: data.data || [],
        totalAnswers: data.totalAnswers || 0,
        chartType: data.chartType || 'blank',
        summaryType: data.summaryType || 'none',
        includeTotalRow: Boolean(data.includeTotalRow),
        allowToggle: Boolean(data.allowToggle),
        blankMessage: data.blankMessage || '',
        blankReason: data.blankReason || ''
    };
}

function buildBlankChart(questionId, questionText, reason) {
    return buildChartData({
        questionId,
        questionText,
        chartType: 'blank',
        summaryType: 'none',
        blankMessage: reason ? `この設問は現在グラフ対象外です。理由: ${reason}` : 'この設問は現在グラフ対象外です。',
        blankReason: reason || ''
    });
}

function buildActionButtons(chartData, chartId) {
    if (chartData.chartType === 'blank') {
        return '';
    }

    return `
        <div class="flex items-center gap-2">
            <button type="button" data-chart-id="${chartId}" class="download-btn button-secondary p-2 rounded-md" title="グラフをダウンロード">
                <span class="material-icons">download</span>
            </button>
        </div>
    `;
}

function buildChartTypeButtons(chartData, chartId) {
    if (!chartData.allowToggle) {
        return '';
    }

    const isBar = chartData.chartType === 'bar';
    const isPie = chartData.chartType === 'pie';

    return `
        <div class="mb-4">
            <div class="inline-flex rounded-md shadow-sm" role="group">
                <button type="button" data-chart-id="${chartId}" data-chart-type="bar" 
                    class="chart-type-btn ${isBar ? 'active bg-primary text-on-primary' : 'bg-surface text-primary'} px-4 py-2 text-sm font-medium border border-primary rounded-l-lg hover:bg-primary hover:text-on-primary focus:z-10 focus:ring-2 focus:ring-primary transition-colors">
                    棒グラフ
                </button>
                <button type="button" data-chart-id="${chartId}" data-chart-type="pie" 
                    class="chart-type-btn ${isPie ? 'active bg-primary text-on-primary' : 'bg-surface text-primary'} px-4 py-2 text-sm font-medium border border-primary rounded-r-lg hover:bg-primary hover:text-on-primary focus:z-10 focus:ring-2 focus:ring-primary transition-colors">
                    円グラフ
                </button>
            </div>
        </div>
    `;
}

function buildChartArea(chartData, chartId) {
    if (chartData.chartType === 'blank') {
        return `
            <div class="p-6 rounded-lg bg-surface-variant text-on-surface-variant text-sm">
                ${escapeHtml(chartData.blankMessage)}
            </div>
        `;
    }

    return `
        <div class="chart-wrapper h-64">
            <canvas id="${chartId}"></canvas>
        </div>
    `;
}

async function exportAllChartsToExcel(chartsData) {
    const ExcelJSInstance = window.ExcelJS || (typeof ExcelJS !== 'undefined' ? ExcelJS : null);
    
    if (!ExcelJSInstance || typeof ExcelJSInstance.Workbook !== 'function') {
        alert('Excelエクスポート用のライブラリ(ExcelJS)が読み込めませんでした。');
        return;
    }

    showToast('分析レポート(Excel)を生成しています...', 'info');

    const workbook = new ExcelJSInstance.Workbook();
    const usedNames = new Map();
    const blankQuestions = [];

    for (const chartData of chartsData) {
        if (chartData.chartType === 'blank') {
            blankQuestions.push([chartData.questionId, chartData.questionText, chartData.blankReason || '現在グラフ対象外']);
            continue;
        }

        const baseName = sanitizeSheetName(chartData.questionText);
        const sheetName = ensureUniqueSheetName(baseName, usedNames);
        const sheet = workbook.addWorksheet(sheetName, {
            views: [{ showGridLines: false }]
        });

        // タイトル
        const titleRow = sheet.addRow([chartData.questionText]);
        titleRow.font = { bold: true, size: 16 };
        sheet.addRow([]); // 空行

        const totalAnswers = chartData.totalAnswers || 0;
        const rows = chartData.labels.map((label, index) => {
            const count = chartData.data[index] || 0;
            const percentage = totalAnswers > 0 ? (count / totalAnswers) : 0;
            return [label, count, percentage];
        });

        // --- 1. Excelテーブルの追加 ---
        sheet.addTable({
            name: `Table_${chartData.chartId.replace(/[^a-zA-Z0-9]/g, '_')}`,
            ref: 'A3',
            headerRow: true,
            totalsRow: chartData.includeTotalRow,
            style: {
                theme: 'TableStyleMedium2',
                showRowStripes: true,
            },
            columns: [
                { name: '項目', filterButton: true, totalsRowLabel: '合計' },
                { name: '回答数', filterButton: false, totalsRowFunction: 'sum' },
                { name: '割合', filterButton: false, totalsRowFunction: 'none' }
            ],
            rows: rows
        });

        // 列幅と書式の設定
        sheet.getColumn(1).width = 40; // 項目
        sheet.getColumn(2).width = 15; // 回答数
        sheet.getColumn(3).width = 15; // 割合

        sheet.getColumn(2).numFmt = '#,##0"件"';
        sheet.getColumn(3).numFmt = '0.0%';
        sheet.getColumn(3).alignment = { horizontal: 'right' };

        // --- 2. 高画質グラフ画像のキャプチャと埋め込み ---
        try {
            const chartCanvas = document.getElementById(`chart-${chartData.chartId}`);

            if (chartCanvas) {
                // グラフ（Canvas）部分のみをピンポイントでキャプチャ
                const canvas = await html2canvas(chartCanvas, {
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    scale: 3 // 超高解像度（擬似SVG品質）
                });

                const base64Image = canvas.toDataURL('image/png');
                const imageId = workbook.addImage({
                    base64: base64Image,
                    extension: 'png',
                });

                // テーブルの右側に配置
                sheet.addImage(imageId, {
                    tl: { col: 4.5, row: 2 },
                    ext: { width: 500, height: 350 }
                });
            }
        } catch (err) {
            console.error(`画像キャプチャ失敗 (${chartData.questionText}):`, err);
        }

        if (chartData.includeTotalRow) {
            const totalRowNumber = 3 + rows.length + 1;
            sheet.getCell(`B${totalRowNumber}`).value = totalAnswers;
            sheet.getCell(`C${totalRowNumber}`).value = 1;
        }
    }

    // 対象外シート
    if (blankQuestions.length > 0) {
        const sheet = workbook.addWorksheet('対象外', {
            views: [{ showGridLines: false }]
        });
        sheet.addRow(['グラフ化対象外の設問一覧']).font = { bold: true, size: 14 };
        sheet.addRow([]);
        sheet.addTable({
            name: 'Table_Exclusions',
            ref: 'A3',
            headerRow: true,
            columns: [{ name: '設問ID' }, { name: '設問文' }, { name: '理由' }],
            rows: blankQuestions
        });
        sheet.getColumn(1).width = 20;
        sheet.getColumn(2).width = 60;
        sheet.getColumn(3).width = 30;
    }

    if (workbook.worksheets.length === 0) {
        alert('出力対象の設問がありません。');
        return;
    }

    // --- 3. ファイルの書き出し ---
    try {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        const filename = `${sanitizeFilename(currentSurvey?.name?.ja || 'survey')}_分析レポート.xlsx`;
        
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        
        setTimeout(() => {
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(url);
        }, 100);

        showToast('分析レポート(Excel)を出力しました。', 'success');
    } catch (writeError) {
        console.error('Excelファイルの書き出しに失敗しました:', writeError);
        alert('Excelファイルの生成中にエラーが発生しました。');
        showToast('Excelファイルの生成に失敗しました。', 'error');
    }
}

function buildExcelRows(chartData) {
    const rows = [['項目', '件数', '割合(%)', '設問ID', '設問文']];
    const totalAnswers = chartData.totalAnswers || 0;

    chartData.labels.forEach((label, index) => {
        const count = chartData.data[index] || 0;
        const percentage = totalAnswers > 0 ? ((count / totalAnswers) * 100).toFixed(1) : '0.0';
        rows.push([label, count, percentage, chartData.questionId, chartData.questionText]);
    });

    if (chartData.includeTotalRow) {
        const totalPercentage = totalAnswers > 0 ? '100.0' : '0.0';
        rows.push(['合計', totalAnswers, totalPercentage, chartData.questionId, chartData.questionText]);
    }

    return rows;
}

function sanitizeFilename(name) {
    return String(name || 'chart')
        .replace(/[<>:"/\\|?*]/g, '_')
        .slice(0, 80);
}

function sanitizeSheetName(name) {
    const sanitized = String(name || 'Sheet1')
        .replace(/[\[\]\*\/\\\?\:]/g, '_')
        .slice(0, 31);
    return sanitized || 'Sheet1';
}

function ensureUniqueSheetName(baseName, usedNames) {
    const base = baseName || 'Sheet1';
    const count = usedNames.get(base) || 0;
    usedNames.set(base, count + 1);
    if (count === 0) return base;
    const suffix = `_${count + 1}`;
    const trimmedBase = base.slice(0, 31 - suffix.length);
    return `${trimmedBase}${suffix}`;
}

