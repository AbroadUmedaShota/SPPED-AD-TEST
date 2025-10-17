import { speedReviewService } from './services/speedReviewService.js';
import { initBreadcrumbs } from './breadcrumb.js';
import { resolveDemoDataPath } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
    initGraphPage();
});

// --- Global State ---
const chartInstances = {};
let originalAnswers = [];
let currentSurvey = null;
let dateRangePicker = null;

/**
 * Initializes the graph page.
 */
async function initGraphPage() {
    initBreadcrumbs(); // Add this line
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId') || 'sv_0001_24001'; // Default to sample survey ID

    initializeDatePicker();
    await loadAndRenderCharts(surveyId);
}

/**
 * Sets up the date range picker.
 */
function initializeDatePicker() {
    flatpickr.localize(flatpickr.l10ns.ja);
    const datePickerConfig = {
        wrap: true,
        dateFormat: "Y-m-d",
        onChange: () => triggerChartUpdate()
    };

    const startDatePicker = flatpickr("#startDatePickerWrapper", {
        ...datePickerConfig,
        onChange: (selectedDates) => {
            if (selectedDates[0]) {
                endDatePicker.set('minDate', selectedDates[0]);
            }
            triggerChartUpdate();
        }
    });
    const endDatePicker = flatpickr("#endDatePickerWrapper", datePickerConfig);

    dateRangePicker = { start: startDatePicker, end: endDatePicker };
}

/**
 * Triggers a chart update based on the current date filter.
 */
function triggerChartUpdate() {
    const startDate = dateRangePicker.start.selectedDates[0];
    const endDate = dateRangePicker.end.selectedDates[0];

    let answersToProcess = originalAnswers;

    if (startDate && endDate) {
        answersToProcess = originalAnswers.filter(answer => {
            if (!answer.answeredAt) return false;
            const answeredDate = new Date(answer.answeredAt.split(' ')[0]);
            return answeredDate >= startDate && answeredDate <= endDate;
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

    const graphableQuestions = survey.details.filter(q => q.type === 'single_choice' || q.type === 'multi_choice');

    return graphableQuestions.map(question => {
        const counts = {};
        let answeredCount = 0;

        answers.forEach(answer => {
            const answerDetail = answer.details.find(d => d.question === question.text);
            
            if (answerDetail && answerDetail.answer && answerDetail.answer !== '') {
                answeredCount++;
                const answerValue = answerDetail.answer;
                if (Array.isArray(answerValue)) { // Multi-choice
                    answerValue.forEach(ans => {
                        if (ans) { // Ensure the answer string is not empty
                           counts[ans] = (counts[ans] || 0) + 1;
                        }
                    });
                } else { // Single-choice
                    if (answerValue) { // Ensure the answer string is not empty
                        counts[answerValue] = (counts[answerValue] || 0) + 1;
                    }
                }
            }
        });

        // Ensure all predefined options are present in the chart, even with 0 count
        if (question.options) {
            question.options.forEach(opt => {
                if (!counts.hasOwnProperty(opt)) {
                    counts[opt] = 0;
                }
            });
        }

        const sortedLabels = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

        return {
            questionId: question.id,
            questionText: question.text,
            labels: sortedLabels,
            data: sortedLabels.map(label => counts[label]),
            totalAnswers: answeredCount
        };
    });
}

/**
 * Renders all charts onto the page.
 * @param {Array} chartsData Data for all charts to be rendered.
 */
function renderCharts(chartsData) {
    const container = document.getElementById('charts-container');
    container.innerHTML = '';

    if (chartsData.length === 0) {
        container.innerHTML = '<p class="text-on-surface-variant lg:col-span-2">このアンケートにグラフ化可能な質問がありません。</p>';
        return;
    }

    chartsData.forEach(chartData => {
        const chartId = `chart-${chartData.questionId}`;
        const card = document.createElement('div');
        card.className = 'bg-surface p-6 rounded-xl border border-outline-variant';

        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <h3 class="text-lg font-bold">${chartData.questionText}</h3>
                <button type="button" data-chart-id="${chartId}" data-question-text="${chartData.questionText}" class="download-btn button-secondary p-2 rounded-md" title="グラフをダウンロード">
                    <span class="material-icons">download</span>
                </button>
            </div>
            <div class="mb-4">
                <div class="inline-flex rounded-md shadow-sm" role="group">
                    <button type="button" data-chart-id="${chartId}" data-chart-type="bar" class="chart-type-btn active px-4 py-2 text-sm font-medium text-primary bg-surface border border-primary rounded-l-lg hover:bg-primary hover:text-on-primary focus:z-10 focus:ring-2 focus:ring-primary">
                        棒グラフ
                    </button>
                    <button type="button" data-chart-id="${chartId}" data-chart-type="pie" class="chart-type-btn px-4 py-2 text-sm font-medium text-primary bg-surface border border-primary rounded-r-lg hover:bg-primary hover:text-on-primary focus:z-10 focus:ring-2 focus:ring-primary">
                        円グラフ
                    </button>
                </div>
            </div>
            <div class="chart-wrapper h-64">
                <canvas id="${chartId}"></canvas>
            </div>
            <div id="summary-${chartId}" class="mt-4 text-sm space-y-1"></div>
        `;

        container.appendChild(card);
        createChart(chartId, chartData, 'bar');
        renderChartSummary(`summary-${chartId}`, chartData);
    });

    // Add event listeners for chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const { chartId, chartType } = e.currentTarget.dataset;
            const data = chartsData.find(d => `chart-${d.questionId}` === chartId);
            createChart(chartId, data, chartType);
            e.currentTarget.parentElement.querySelectorAll('.chart-type-btn').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // Add event listeners for download buttons
    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const buttonEl = e.currentTarget;
            const questionText = buttonEl.dataset.questionText;
            const chartCard = buttonEl.closest('.bg-surface'); // Find the parent card element

            if (chartCard && window.html2canvas) {
                // Temporarily hide the download button and type switchers from the capture
                const elementsToHide = [
                    buttonEl,
                    chartCard.querySelector('[role="group"]'),
                ];
                elementsToHide.forEach(el => el.style.visibility = 'hidden');

                html2canvas(chartCard, {
                    useCORS: true,
                    backgroundColor: '#ffffff', // Explicitly set a white background
                    onrendered: function() {
                        // Show the elements again after capture
                        elementsToHide.forEach(el => el.style.visibility = 'visible');
                    }
                }).then(canvas => {
                    // Show the elements again in case of promise resolution before onrendered
                    elementsToHide.forEach(el => el.style.visibility = 'visible');

                    const dataUrl = canvas.toDataURL('image/png');
                    const link = document.createElement('a');
                    link.href = dataUrl;
                    const sanitizedQuestion = questionText.replace(/[<>:"/\\|?*]/g, '_');
                    link.download = `${sanitizedQuestion}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }).catch(err => {
                    // Ensure elements are visible even if there's an error
                    elementsToHide.forEach(el => el.style.visibility = 'visible');
                    console.error('html2canvas failed:', err);
                });
            }
        });
    });
}

/**
 * Creates or updates a Chart.js instance.
 * @param {string} chartId The ID of the canvas element.
 * @param {object} chartData The data for the chart.
 * @param {string} type The type of chart ('bar' or 'pie').
 */
function createChart(chartId, chartData, type) {
    const ctx = document.getElementById(chartId).getContext('2d');
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
    }

    const colors = ['#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#AB47BC', '#00ACC1', '#FF7043', '#9E9D24'];

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

    let chartConfigData;
    let chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top',
                display: true
            }
        },
        scales: {}
    };

    if (type === 'pie') {
        chartConfigData = {
            labels: chartData.labels,
            datasets: [{
                data: chartData.data,
                backgroundColor: chartData.labels.map((_, index) => colors[index % colors.length]),
            }]
        };
        chartOptions.plugins.legend.position = 'right';
    } else { // type === 'bar'
        chartConfigData = {
            labels: [chartData.questionText], // X軸のラベルは質問名など一つに
            datasets: chartData.labels.map((label, index) => ({
                label: label, // これが凡例になる
                data: [chartData.data[index]],
                backgroundColor: colors[index % colors.length]
            }))
        };
        chartOptions.scales = {
            y: {
                beginAtZero: true,
                ticks: { 
                    stepSize: 1,
                    precision: 0
                }
            }
        };
    }

    chartInstances[chartId] = new Chart(ctx, {
        type: type,
        data: chartConfigData,
        options: chartOptions,
        plugins: [whiteBgPlugin]
    });
}

/**
 * Renders the text summary for a chart.
 * @param {string} summaryId The ID of the summary container element.
 * @param {object} chartData The data for the chart.
 */
function renderChartSummary(summaryId, chartData) {
    const container = document.getElementById(summaryId);
    if (!container) return;

    let totalVotes = chartData.data.reduce((sum, current) => sum + current, 0);

    let html = '<ul class="list-disc list-inside">';
    chartData.labels.forEach((label, index) => {
        const count = chartData.data[index];
        const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : 0;
        html += `<li><strong>${label}:</strong> ${count}件 (${percentage}%)</li>`;
    });
    html += '</ul>';
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

