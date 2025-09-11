import { speedReviewService } from '../02_dashboard/src/services/speedReviewService.js';

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
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId') || 'SURVEY8j2l0x'; // Default to CSV demo

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
        if (surveyId === 'SURVEY8j2l0x') {
            const csvPaths = [
                './0008000154.csv',
                './0008000154ncd.csv'
            ];
            const csvData = await speedReviewService.loadAndCombineCsvData(csvPaths);
            const transformedData = speedReviewService.transformCsvToCombinedData(csvData, surveyId);
            currentSurvey = transformedData.length > 0 ? transformedData[0].survey : null;
            originalAnswers = transformedData;
        } else {
            const [surveys, answers] = await Promise.all([
                fetch('../02_dashboard/data/surveys-with-details.json').then(res => res.json()),
                fetch('../02_dashboard/data/survey-answers.json').then(res => res.json())
            ]);
            currentSurvey = surveys.find(s => s.id === surveyId);
            originalAnswers = answers.filter(a => a.surveyId === surveyId);
        }

        if (!currentSurvey) {
            throw new Error(`アンケートID「${surveyId}」の定義が見つかりません。`);
        }

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
        if (question.options) {
            question.options.forEach(opt => counts[opt] = 0);
        }

        let answeredCount = 0;
        answers.forEach(answer => {
            const answerDetail = answer.details.find(d => d.question === question.text);
            
            if (answerDetail && answerDetail.answer && answerDetail.answer !== '') {
                answeredCount++;
                const answerValue = answerDetail.answer;
                if (Array.isArray(answerValue)) { // Multi-choice
                    answerValue.forEach(ans => {
                        if (counts[ans] !== undefined) counts[ans]++;
                    });
                } else { // Single-choice
                    if (counts[answerValue] !== undefined) counts[answerValue]++;
                }
            }
        });

        return {
            questionId: question.id,
            questionText: question.text,
            labels: Object.keys(counts),
            data: Object.values(counts),
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
            <h3 class="text-lg font-bold mb-4">${chartData.questionText}</h3>
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

    document.querySelectorAll('.chart-type-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const { chartId, chartType } = e.currentTarget.dataset;
            const data = chartsData.find(d => `chart-${d.questionId}` === chartId);
            createChart(chartId, data, chartType);
            e.currentTarget.parentElement.querySelectorAll('.chart-type-btn').forEach(btn => btn.classList.remove('active'));
            e.currentTarget.classList.add('active');
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

    chartInstances[chartId] = new Chart(ctx, {
        type: type,
        data: {
            labels: chartData.labels,
            datasets: [{
                label: '回答数',
                data: chartData.data,
                backgroundColor: colors,
                borderColor: type === 'bar' ? colors : '#fff',
                borderWidth: type === 'bar' ? 0 : 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: type === 'pie' ? 'right' : 'top',
                    display: type === 'pie' || chartData.data.length > 1
                }
            },
            scales: type === 'bar' ? {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            } : {}
        }
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
