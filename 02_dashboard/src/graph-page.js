import { initBreadcrumbs } from './breadcrumb.js';
import { resolveDemoDataPath, showToast } from './utils.js';
import { getSurveyPeriodRange, buildDateFilterOptions, applyDateFilterOptions, resolveDateRangeFromValue } from './services/dateFilterService.js';

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
let availableDateRange = null;
let chartSequence = 0;
let isExporting = false; // 書き出し中フラグ

// 表示オプションの状態管理
const displayOptions = {
    showSummary: true,
    showDataLabels: true,
    showCenterText: true,
    showTable: true,
    showGrid: false
};
const GRAPH_CHART_DONUT_PALETTE = [
    '#1a73e8',
    '#e91e63',
    '#9c27b0',
    '#673ab7',
    '#3f51b5',
    '#2196f3',
    '#03a9f4',
    '#00bcd4',
    '#009688',
    '#4caf50',
    '#8bc34a',
    '#cddc39',
    '#ffeb3b',
    '#ffc107',
    '#ff9800',
    '#ff5722',
    '#795548',
    '#9e9e9e',
    '#607d8b'
];
const GRAPH_CHART_MUTED_TEXT = '#6B6B6B';
const GRAPH_CHART_TEXT = '#1A1A1A';
const GRAPH_CHART_GRID = '#F1F1F1';

const SINGLE_CHOICE_TYPES = new Set(['single_choice', 'dropdown', 'rating']);
const MULTI_CHOICE_TYPES = new Set(['multi_choice', 'ranking']);
const MATRIX_SINGLE_TYPES = new Set(['matrix_sa', 'matrix_single']);
const MATRIX_MULTI_TYPES = new Set(['matrix_ma', 'matrix_multi', 'matrix_multiple']);
const BLANK_TYPES = new Set([
    'text',
    'free_text',
    'free_answer',
    'number',
    'date',
    'datetime',
    'datetime_local',
    'time',
    'handwriting',
    'image',
    'photo',
    'file',
    'file_upload',
    'upload',
    'explanation'
]);

/**
 * Initializes the graph page.
 */
async function initGraphPage() {
    initBreadcrumbs();
    const urlParams = new URLSearchParams(window.location.search);
    const surveyId = urlParams.get('surveyId') || 'sv_0001_24001';

    // 離脱防止イベント
    window.addEventListener('beforeunload', (event) => {
        if (isExporting) {
            event.preventDefault();
            event.returnValue = ''; // ブラウザ標準の警告を表示
        }
    });

    await loadAndRenderCharts(surveyId);
    setupFilterEventListeners();
}

/**
 * Sets up all filter related event listeners.
 */
function setupFilterEventListeners() {
    flatpickr.localize(flatpickr.l10ns.ja);

    const startEl = document.getElementById('startDateInput');
    const endEl = document.getElementById('endDateInput');
    const daySelect = document.getElementById('dayFilterSelect');
    const detailedContent = document.getElementById('detailed-search-content');
    const resetBtn = document.getElementById('resetFiltersButton');

    if (daySelect) {
        const options = buildDateFilterOptions(availableDateRange);
        applyDateFilterOptions(daySelect, options);
    }

    const fpConfig = {
        enableTime: true,
        dateFormat: 'Y-m-d H:i',
        minDate: availableDateRange?.start || null,
        maxDate: availableDateRange?.end || null,
        onChange: () => {
            if (startDatePicker && endDatePicker) {
                const start = startDatePicker.selectedDates[0];
                const end = endDatePicker.selectedDates[0];
                if (start && end) {
                    currentDateFilter = [start, end];
                    triggerChartUpdate();
                }
            }
        }
    };

    if (startEl && endEl) {
        startDatePicker = flatpickr(startEl, fpConfig);
        endDatePicker = flatpickr(endEl, fpConfig);
    }

    if (daySelect) {
        daySelect.addEventListener('change', (e) => {
            const val = e.target.value;
            
            if (val === 'custom') {
                if (detailedContent) detailedContent.classList.remove('hidden');
                return;
            } else {
                if (detailedContent) detailedContent.classList.add('hidden');
            }

            const range = resolveDateRangeFromValue(val, availableDateRange);
            currentDateFilter = range;
            if (range && startDatePicker && endDatePicker) {
                startDatePicker.setDate(range[0], false);
                endDatePicker.setDate(range[1], false);
            }
            triggerChartUpdate();
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
        'opt-show-table': 'showTable',
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

    const initialRange = resolveDateRangeFromValue('all', availableDateRange);
    if (daySelect && daySelect.querySelector('option[value="all"]')) {
        daySelect.value = 'all';
    }
    if (initialRange) {
        currentDateFilter = initialRange;
        if (startDatePicker && endDatePicker) {
            startDatePicker.setDate(initialRange[0], false);
            endDatePicker.setDate(initialRange[1], false);
        }
    }
}

/**
 * Handles the reset filters button click.
 */
function handleResetFilters() {
    currentDateFilter = null;
    const allRange = resolveDateRangeFromValue('all', availableDateRange);
    if (allRange) {
        currentDateFilter = allRange;
        if (startDatePicker) startDatePicker.setDate(allRange[0], false);
        if (endDatePicker) endDatePicker.setDate(allRange[1], false);
    } else {
        if (startDatePicker) startDatePicker.clear();
        if (endDatePicker) endDatePicker.clear();
    }
    const daySelect = document.getElementById('dayFilterSelect');
    if (daySelect) daySelect.value = 'all';
    
    const detailedContent = document.getElementById('detailed-search-content');
    if (detailedContent) detailedContent.classList.add('hidden');
    
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

        currentSurvey = surveyDefinition;
        if (!currentSurvey) {
            throw new Error(`アンケートID「${surveyId}」の定義が見つかりません。`);
        }
        
        originalAnswers = answers;
        availableDateRange = getSurveyPeriodRange(currentSurvey, originalAnswers);

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
                allowToggle: false,
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
                allowToggle: false,
                ...summary
            }));
            return;
        }

        if (BLANK_TYPES.has(question.type)) {
            charts.push(buildListChart(question, questionId, answers));
            return;
        }

        charts.push(buildListChart(question, questionId, answers, '未対応の設問タイプ'));
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
        if (chartInstances[key] && typeof chartInstances[key].destroy === 'function') {
            chartInstances[key].destroy();
        }
        delete chartInstances[key];
    });

    if (chartsData.length === 0) {
        container.innerHTML = '<p class="text-on-surface-variant lg:col-span-2">このアンケートにグラフ化可能な質問がありません。</p>';
        return;
    }

    chartsData.forEach(chartData => {
        const chartId = `chart-${chartData.chartId}`;
        const card = document.createElement('div');
        card.dataset.chartCardId = chartId;
        const isMatrix = Boolean(chartData.isMatrix);
        const matrixBorder = isMatrix ? '<div class="absolute left-0 top-0 bottom-0 w-1 bg-primary/40"></div>' : '';
        card.className = `${isMatrix ? 'relative ' : ''}bg-surface rounded-2xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col`;

        const actionButtons = buildActionButtons(chartData, chartId);
        const chartArea = buildChartArea(chartData, chartId);
        const questionTitle = escapeHtml(chartData.questionText);
        const parentTitle = escapeHtml(chartData.matrixParentText || chartData.questionText);
        const rowTitle = escapeHtml(chartData.matrixRowText || '');
        const baseChip = formatQuestionChip(chartData.questionBaseId || chartData.questionId);
        const questionChip = isMatrix
            ? `${baseChip} [${chartData.matrixIndex}/${chartData.matrixTotal}]`
            : baseChip;
        
        const isBlank = chartData.chartType === 'blank';
        const isList = chartData.chartType === 'list';
        const iconName = isBlank ? 'subject' : 'analytics';
        const iconColor = isBlank ? 'text-on-surface-variant/60' : 'text-primary';

        let insightHtml = '';
        if (displayOptions.showSummary && !isBlank && !isList && !isMatrix && chartData.labels.length > 0) {
            const maxIdx = chartData.data.indexOf(Math.max(...chartData.data));
            const topLabel = chartData.labels[maxIdx];
            const topVal = chartData.data[maxIdx];
            const topPercent = chartData.totalAnswers > 0 ? Math.round((topVal / chartData.totalAnswers) * 100) : 0;
            
            insightHtml = `
                <div class="flex items-center gap-2 bg-primary/5 border border-primary/10 px-3 py-1 rounded-full">
                    <span class="text-[10px] font-bold text-primary uppercase tracking-wider">Top</span>
                    <span class="text-xs font-bold text-on-surface truncate max-w-[100px]">${escapeHtml(topLabel)}</span>
                    <span class="text-xs font-black text-primary">${topPercent}%</span>
                </div>
            `;
        }

        const hasSummaryTable = chartData.summaryType === 'table' || chartData.summaryType === 'matrix_table';
        const summaryArea = hasSummaryTable
            ? `<div id="summary-${chartId}" class="text-sm ${isList ? 'flex-1 min-h-0' : ''}"></div>`
            : '';

        const titleHtml = isMatrix
            ? `<span class="font-bold text-on-surface block mb-1">${parentTitle}</span><span class="font-normal text-on-surface" data-role="matrix-row-title">${rowTitle}</span>`
            : questionTitle;
        const matrixSelectorHtml = buildMatrixRowSelector(chartData, chartId);

        const shouldShowSummary = Boolean(summaryArea) && (displayOptions.showTable || isList);
        const summarySectionClass = isList
            ? 'flex-1 flex flex-col min-h-0'
            : 'mt-2 pt-6 border-t border-outline-variant/30';
        const summarySectionStyle = isList ? ' style="min-height: 350px;"' : '';
        const controlsRowHtml = isList
            ? ''
            : `
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex justify-start">
                        ${buildChartTypeButtons(chartData, chartId)}
                    </div>
                    ${matrixSelectorHtml}
                </div>
            `;
        const chartAreaBlock = chartArea
            ? `
                <div class="w-full">
                    ${chartArea}
                </div>
            `
            : '';

        card.innerHTML = `
            ${matrixBorder}
            <div class="p-5 border-b border-outline-variant/50 bg-surface-variant/10">
                <div class="flex justify-between items-start gap-4">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-8 h-8 rounded-lg bg-white shadow-sm border border-outline-variant flex items-center justify-center shrink-0">
                            <span class="material-icons text-lg ${iconColor}">${iconName}</span>
                        </div>
                        <div class="min-w-0">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-variant text-on-surface-variant border border-outline-variant mb-1" data-role="question-chip">${questionChip}</span>
                            <h3 class="text-base ${isMatrix ? '' : 'font-bold '}text-on-surface leading-tight line-clamp-2" title="${questionTitle}">${titleHtml}</h3>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        ${actionButtons}
                    </div>
                </div>
                <div class="flex items-center justify-between mt-4">
                    <p class="text-[11px] font-medium text-on-surface-variant uppercase tracking-widest" data-role="valid-answers">有効回答: ${chartData.totalAnswers}件</p>
                    ${insightHtml}
                </div>
            </div>

            <div class="p-5 flex-1 flex flex-col gap-6">
                ${controlsRowHtml}

                ${chartAreaBlock}

                ${shouldShowSummary ? `
                <div class="${summarySectionClass}"${summarySectionStyle}>
                    <div class="flex items-center gap-2 mb-4 text-on-surface-variant">
                        <span class="material-icons text-sm">list_alt</span>
                        <span class="text-xs font-bold uppercase tracking-wider">詳細データ</span>
                    </div>
                    ${summaryArea}
                </div>` : ''}
            </div>
        `;

        container.appendChild(card);
        chartDataStore.set(chartId, chartData);

        if (chartData.chartType !== 'blank' && chartData.chartType !== 'list') {
            try {
                createChart(chartId, chartData, chartData.chartType);
            } catch (error) {
                console.error('チャート描画に失敗しました:', chartData.questionId, error);
                const chartContainer = document.getElementById(chartId);
                if (chartContainer) {
                    chartContainer.innerHTML = '<div class="p-4 text-sm text-error">チャート描画に失敗しました。</div>';
                }
            }
        }

        if (chartData.summaryType === 'table' || chartData.summaryType === 'matrix_table') {
            try {
                renderChartSummaryTable(`summary-${chartId}`, chartData);
            } catch (error) {
                console.error('サマリー描画に失敗しました:', chartData.questionId, error);
            }
        }
    });

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
    bindMatrixRowSelectorEvents();

    const exportAllButton = document.getElementById('excel-export-all');
    if (exportAllButton) {
        exportAllButton.onclick = () => exportAllChartsToExcel(chartsData);
    }
}

function buildMatrixRowSelector(chartData, chartId) {
    if (!chartData.isMatrix || !Array.isArray(chartData.matrixRows) || chartData.matrixRows.length <= 1) {
        return '';
    }
    const currentIndex = Math.max(0, Number(chartData.matrixSelectedIndex || 0));
    const optionsHtml = chartData.matrixRows.map((row, index) => `
        <option value="${index}" ${index === currentIndex ? 'selected' : ''}>${escapeHtml(row.text)}</option>
    `).join('');
    return `
        <label class="inline-flex items-center gap-2 text-xs text-on-surface-variant font-medium">
            <span>表示項目</span>
            <select
                class="px-2 py-1.5 rounded-md border border-outline-variant bg-surface text-on-surface text-xs"
                data-role="matrix-row-selector"
                data-chart-id="${chartId}"
                aria-label="マトリクス表示項目"
            >
                ${optionsHtml}
            </select>
        </label>
    `;
}

function bindMatrixRowSelectorEvents() {
    document.querySelectorAll('[data-role="matrix-row-selector"]').forEach(select => {
        select.addEventListener('change', (event) => {
            const chartId = event.currentTarget.dataset.chartId;
            const rowIndex = Number(event.currentTarget.value);
            if (!chartId || Number.isNaN(rowIndex)) return;
            applyMatrixRowSelection(chartId, rowIndex);
        });
    });
}

function applyMatrixRowSelection(chartId, rowIndex) {
    const chartData = chartDataStore.get(chartId);
    if (!chartData || !chartData.isMatrix || !Array.isArray(chartData.matrixRowDetails)) return;

    const selected = chartData.matrixRowDetails[rowIndex];
    if (!selected) return;

    chartData.matrixSelectedIndex = rowIndex;
    chartData.matrixIndex = rowIndex + 1;
    chartData.matrixRowText = selected.rowText;
    chartData.labels = selected.labels;
    chartData.data = selected.data;
    chartData.totalAnswers = selected.totalAnswers;

    const card = document.querySelector(`[data-chart-card-id="${chartId}"]`);
    if (card) {
        const chip = card.querySelector('[data-role="question-chip"]');
        if (chip) {
            const baseChip = formatQuestionChip(chartData.questionBaseId || chartData.questionId);
            chip.textContent = `${baseChip} [${chartData.matrixIndex}/${chartData.matrixTotal}]`;
        }
        const title = card.querySelector('[data-role="matrix-row-title"]');
        if (title) {
            title.textContent = selected.rowText;
        }
        const answers = card.querySelector('[data-role="valid-answers"]');
        if (answers) {
            answers.textContent = `有効回答: ${chartData.totalAnswers}件`;
        }
    }

    createChart(chartId, chartData, chartData.chartType);
    renderChartSummaryTable(`summary-${chartId}`, chartData);
}

/**
 * Creates or updates an ApexCharts instance.
 */
function createChart(chartId, chartData, type) {
    const container = document.getElementById(chartId);
    if (!container) return;

    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
    }

    const isMatrixStacked = type === 'matrix_stacked';
    const isDoughnut = type === 'pie';
    const categoryLabels = isMatrixStacked
        ? (chartData.matrixRows || []).map(row => row.text)
        : chartData.labels;
    const legendConfig = getLegendConfig(categoryLabels);
    const chartHeight = isDoughnut ? legendConfig.chartHeight : (isMatrixStacked ? 420 : 350);
    const matrixRowTotals = chartData.matrixRowTotals || [];
    const tooltipForStacked = ({ series, seriesIndex, dataPointIndex, w }) => {
        const rowLabel = w.globals.labels?.[dataPointIndex] || '';
        const seriesLabel = w.globals.seriesNames?.[seriesIndex] || '';
        const count = Number(series?.[seriesIndex]?.[dataPointIndex] || 0);
        const total = Number(matrixRowTotals[dataPointIndex] || 0);
        const ratio = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
        return `<div class="apexcharts-tooltip-series-group apexcharts-active"><span>${escapeHtml(rowLabel)} &gt; ${escapeHtml(seriesLabel)}: ${count}件 (${ratio}%)</span></div>`;
    };

    const options = {
        series: isMatrixStacked
            ? (chartData.matrixSeries || [])
            : (isDoughnut ? chartData.data : [{ name: '件数', data: chartData.data }]),
        chart: {
            type: isDoughnut ? 'donut' : 'bar',
            height: chartHeight,
            width: '100%',
            fontFamily: "'Noto Sans JP', sans-serif",
            toolbar: { show: false },
            animations: { enabled: true, easing: 'easeinout', speed: 800 },
            padding: { top: 10, right: 10, bottom: 10, left: 10 },
            stacked: isMatrixStacked,
            stackType: isMatrixStacked ? '100%' : undefined
        },
        colors: GRAPH_CHART_DONUT_PALETTE,
        labels: categoryLabels,
        plotOptions: {
            pie: {
                donut: {
                    size: '72%',
                    labels: {
                        show: displayOptions.showCenterText,
                        total: {
                            show: true,
                            label: '有効回答数',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: GRAPH_CHART_MUTED_TEXT,
                            formatter: () => chartData.totalAnswers.toLocaleString()
                        },
                        value: {
                            fontSize: '32px',
                            fontWeight: 800,
                            color: GRAPH_CHART_TEXT,
                            offsetY: 5
                        }
                    }
                }
            },
            bar: {
                horizontal: true,
                distributed: !isDoughnut && !isMatrixStacked,
                borderRadius: 8,
                barHeight: '75%',
                dataLabels: { position: 'top' }
            }
        },
        dataLabels: {
            enabled: isMatrixStacked ? false : displayOptions.showDataLabels,
            formatter: (val) => isDoughnut ? Math.round(val) + "%" : val + "件",
            style: {
                fontSize: '13px',
                fontWeight: 700,
                colors: isDoughnut ? ['#fff'] : [GRAPH_CHART_TEXT]
            },
            offsetX: isDoughnut ? 0 : 40
        },
        legend: {
            show: isDoughnut || isMatrixStacked,
            position: isMatrixStacked ? 'top' : legendConfig.position,
            height: legendConfig.height,
            fontSize: '13px',
            fontFamily: "'Noto Sans JP', sans-serif",
            markers: { radius: 12, width: 12, height: 12 },
            itemMargin: legendConfig.itemMargin
        },
        grid: {
            show: displayOptions.showGrid,
            borderColor: GRAPH_CHART_GRID,
            padding: { left: 20, right: 40 }
        },
        xaxis: {
            categories: categoryLabels,
            labels: { show: !isDoughnut, style: { fontSize: '12px', fontWeight: 500 } }
        },
        yaxis: {
            labels: { show: !isDoughnut, maxWidth: 200, style: { fontSize: '13px', fontWeight: 600 } }
        },
        stroke: { show: true, width: isDoughnut ? 3 : 0, colors: ['#fff'] },
        tooltip: isMatrixStacked
            ? { shared: false, intersect: true, custom: tooltipForStacked }
            : { shared: false, intersect: true }
    };

    chartInstances[chartId] = new ApexCharts(container, options);
    chartInstances[chartId].render();
}

/**
 * Renders the summary table for a chart.
 */
function renderChartSummaryTable(summaryId, chartData) {
    const container = document.getElementById(summaryId);
    if (!container) return;

    if (chartData.summaryType === 'matrix_table') {
        const rows = chartData.matrixRows || [];
        const columns = chartData.matrixColumns || [];
        const series = chartData.matrixSeries || [];
        const totalAll = (chartData.matrixRowTotals || []).reduce((sum, total) => sum + total, 0);

        if (rows.length === 0 || columns.length === 0 || series.length === 0) {
            container.innerHTML = '<p class="text-on-surface-variant text-sm">集計データがありません。</p>';
            return;
        }

        const countByColumn = new Map(series.map(item => [item.name, item.data || []]));
        const headerCells = columns.map(col => `
            <th class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums w-[84px]">${escapeHtml(col.text)}</th>
        `).join('');
        const bodyRows = rows.map((row, rowIndex) => {
            const total = Number(chartData.matrixRowTotals[rowIndex] || 0);
            const cells = columns.map(col => {
                const values = countByColumn.get(col.text) || [];
                const count = Number(values[rowIndex] || 0);
                const ratio = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                return `<td class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums align-top">${count}件<span class="text-[10px] text-on-surface-variant ml-1">(${ratio}%)</span></td>`;
            }).join('');
            return `
                <tr>
                    <td class="px-3 py-2 border-b border-outline-variant align-top">
                        <div class="cell-truncate-container" title="${escapeHtml(row.text)}">${escapeHtml(row.text)}</div>
                    </td>
                    ${cells}
                    <td class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums align-top">${total}件</td>
                </tr>
            `;
        }).join('');
        const totalRow = columns.map(col => {
            const values = countByColumn.get(col.text) || [];
            const subtotal = values.reduce((sum, count) => sum + Number(count || 0), 0);
            return `<td class="px-3 py-2 text-right font-mono tabular-nums">${subtotal}件</td>`;
        }).join('');

        container.innerHTML = `
            <div class="chart-summary-scroll-area border border-outline-variant rounded-lg">
                <table class="table-layout-fixed text-left text-sm">
                    <thead class="bg-surface-variant-soft text-on-surface-variant sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        <tr>
                            <th class="px-3 py-2 border-b border-outline-variant w-full">行項目</th>
                            ${headerCells}
                            <th class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums w-[84px]">合計</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bodyRows}
                        <tr class="font-semibold bg-surface-variant/5">
                            <td class="px-3 py-2">合計</td>
                            ${totalRow}
                            <td class="px-3 py-2 text-right font-mono tabular-nums">${totalAll}件</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        return;
    }

    if (chartData.chartType === 'list') {
        const rows = chartData.listAll || [];
        const itemsHtml = rows.length > 0
            ? rows.map(item => `
                <tr>
                    <td class="px-3 py-2 border-b border-outline-variant align-top">
                        <div class="cell-truncate-container" title="${escapeHtml(item.value)}">${escapeHtml(item.value)}</div>
                    </td>
                    <td class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums align-top whitespace-nowrap text-on-surface-variant text-[11px]">${escapeHtml(item.answeredAtLabel)}</td>
                </tr>
            `).join('')
            : `
                <tr>
                    <td class="px-3 py-3 text-on-surface-variant" colspan="2">回答がありません。</td>
                </tr>
            `;
        const shownCount = rows.length;
        const footerHtml = `<p class="pt-3 text-xs text-on-surface-variant text-right">${shownCount} / ${rows.length}件を表示中</p>`;

        container.innerHTML = `
            <div class="chart-summary-scroll-area chart-summary-scroll-area--list-15 border border-outline-variant rounded-lg">
                <table class="table-layout-fixed text-left text-sm">
                    <thead class="bg-surface-variant-soft text-on-surface-variant sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        <tr>
                            <th class="px-3 py-2 border-b border-outline-variant w-full">回答</th>
                            <th class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums w-[100px]">回答日時</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
            </div>
            ${footerHtml}
        `;
        return;
    }

    const totalVotes = chartData.totalAnswers || 0;

    let html = `
        <div class="chart-summary-scroll-area border border-outline-variant rounded-lg">
            <table class="table-layout-fixed text-left text-sm">
                <thead class="bg-surface-variant-soft text-on-surface-variant sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                    <tr>
                        <th class="px-3 py-2 border-b border-outline-variant w-full">項目</th>
                        <th class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums w-[80px]">件数</th>
                        <th class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums w-[80px]">割合</th>
                    </tr>
                </thead>
                <tbody>
    `;

    chartData.labels.forEach((label, index) => {
        const count = chartData.data[index] || 0;
        const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : '0.0';
        html += `
            <tr>
                <td class="px-3 py-2 border-b border-outline-variant align-top">
                    <div class="cell-truncate-container" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
                </td>
                <td class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums align-top">${count}件</td>
                <td class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums align-top">${percentage}%</td>
            </tr>
        `;
    });

    if (chartData.includeTotalRow) {
        const totalPercentage = totalVotes > 0 ? '100.0%' : '0.0%';
        html += `
            <tr class="font-semibold bg-surface-variant/5">
                <td class="px-3 py-2">合計</td>
                <td class="px-3 py-2 text-right font-mono tabular-nums">${totalVotes}件</td>
                <td class="px-3 py-2 text-right font-mono tabular-nums">${totalPercentage}</td>
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

async function exportAllChartsToExcel(chartsData) {
    const ExcelJSInstance = window.ExcelJS || (typeof ExcelJS !== 'undefined' ? ExcelJS : null);
    if (!ExcelJSInstance || typeof ExcelJSInstance.Workbook !== 'function') {
        alert('Excelエクスポート用のライブラリ(ExcelJS)が読み込めませんでした。');
        return;
    }

    const exportBtn = document.getElementById('excel-export-all');
    const originalBtnHtml = exportBtn.innerHTML;
    const overlay = document.getElementById('export-progress-overlay');
    const progressText = document.getElementById('export-progress-text');
    const progressBar = document.getElementById('export-progress-bar');
    const progressPercent = document.getElementById('export-progress-percent');
    const progressIcon = document.getElementById('export-progress-icon');
    const successIconClass = 'text-success';
    let exportSucceeded = false;

    // スレッド解放用のヘルパー
    const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 50));

    try {
        isExporting = true; // 書き出し開始
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.style.opacity = '0.7';
            exportBtn.innerHTML = `
                <span class="material-icons animate-spin text-sm mr-2">sync</span>
                <span>出力タスク実行中</span>
            `;
        }
        if (overlay) {
            overlay.classList.remove('hidden', 'opacity-0');
            overlay.classList.add('opacity-100');
        }
        if (progressIcon) {
            progressIcon.textContent = 'sync';
            progressIcon.classList.add('animate-spin', 'text-primary');
            progressIcon.classList.remove(successIconClass);
        }
        if (progressPercent) progressPercent.textContent = '0%';

        const workbook = new ExcelJSInstance.Workbook();
        const usedNames = new Map();
        const blankQuestions = [];
        const totalCharts = chartsData.length;
        let processedCount = 0;

        for (const chartData of chartsData) {
            processedCount++;
            const percent = Math.round((processedCount / totalCharts) * 100);
            if (progressText) progressText.textContent = `${totalCharts}件中 ${processedCount}件目を処理中...`;
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (progressPercent) progressPercent.textContent = `${percent}%`;

            // ブラウザに操作権限を一度戻す（バックグラウンド感の演出とフリーズ防止）
            await yieldToMain();

            if (chartData.chartType === 'blank') {
                blankQuestions.push([chartData.questionId, chartData.questionText, chartData.blankReason || '現在グラフ対象外']);
                continue;
            }

            const baseName = sanitizeSheetName(chartData.questionText);
            const sheetName = ensureUniqueSheetName(baseName, usedNames);
            const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: false }] });

            const titleRow = sheet.addRow([chartData.questionText]);
            titleRow.font = { bold: true, size: 16 };
            sheet.addRow([]);

            if (chartData.summaryType === 'matrix_table') {
                const rows = chartData.matrixRows || [];
                const columns = chartData.matrixColumns || [];
                const series = chartData.matrixSeries || [];
                const countByColumn = new Map(series.map(item => [item.name, item.data || []]));

                if (rows.length > 0 && columns.length > 0) {
                    const tableRows = rows.map((row, rowIndex) => {
                        const rowCounts = columns.map(col => {
                            const values = countByColumn.get(col.text) || [];
                            return Number(values[rowIndex] || 0);
                        });
                        const total = rowCounts.reduce((sum, count) => sum + count, 0);
                        return [row.text, ...rowCounts, total];
                    });

                    sheet.addTable({
                        name: `Table_${chartData.chartId.replace(/[^a-zA-Z0-9]/g, '_')}`,
                        ref: 'A3',
                        headerRow: true,
                        totalsRow: false,
                        style: { theme: 'TableStyleMedium2', showRowStripes: true },
                        columns: [
                            { name: '行項目', filterButton: true },
                            ...columns.map(col => ({ name: col.text, filterButton: false })),
                            { name: '合計', filterButton: false }
                        ],
                        rows: tableRows
                    });

                    sheet.getColumn(1).width = 30;
                    for (let colIdx = 0; colIdx < columns.length; colIdx += 1) {
                        sheet.getColumn(2 + colIdx).width = 12;
                        sheet.getColumn(2 + colIdx).numFmt = '#,##0"件"';
                    }
                    const totalColumnIndex = 2 + columns.length;
                    sheet.getColumn(totalColumnIndex).width = 12;
                    sheet.getColumn(totalColumnIndex).numFmt = '#,##0"件"';
                } else {
                    sheet.addRow(['集計データがありません。']);
                }
            } else if (chartData.chartType === 'list') {
                const listRows = (chartData.listAll || []).map(item => [item.value, item.answeredAtLabel]);
                const tableRows = listRows.length > 0 ? listRows : [['回答がありません。', '']];

                sheet.addTable({
                    name: `Table_${chartData.chartId.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    ref: 'A3',
                    headerRow: true,
                    totalsRow: false,
                    style: { theme: 'TableStyleMedium2', showRowStripes: true },
                    columns: [
                        { name: '回答', filterButton: true },
                        { name: '回答日時', filterButton: true }
                    ],
                    rows: tableRows
                });

                sheet.getColumn(1).width = 60;
                sheet.getColumn(2).width = 24;
                sheet.getColumn(2).alignment = { horizontal: 'right' };
            } else {
                const totalAnswers = chartData.totalAnswers || 0;
                const rows = chartData.labels.map((label, index) => {
                    const count = chartData.data[index] || 0;
                    const percentage = totalAnswers > 0 ? (count / totalAnswers) : 0;
                    return [label, count, percentage];
                });

                sheet.addTable({
                    name: `Table_${chartData.chartId.replace(/[^a-zA-Z0-9]/g, '_')}`,
                    ref: 'A3',
                    headerRow: true,
                    totalsRow: chartData.includeTotalRow,
                    style: { theme: 'TableStyleMedium2', showRowStripes: true },
                    columns: [
                        { name: '項目', filterButton: true, totalsRowLabel: '合計' },
                        { name: '回答数', filterButton: false, totalsRowFunction: 'sum' },
                        { name: '割合', filterButton: false, totalsRowFunction: 'none' }
                    ],
                    rows: rows
                });

                sheet.getColumn(1).width = 40;
                sheet.getColumn(2).width = 15;
                sheet.getColumn(3).width = 15;
                sheet.getColumn(2).numFmt = '#,##0"件"';
                sheet.getColumn(3).numFmt = '0.0%';
                sheet.getColumn(3).alignment = { horizontal: 'right' };

                if (chartData.includeTotalRow) {
                    const totalRowNumber = 3 + rows.length + 1;
                    sheet.getCell(`B${totalRowNumber}`).value = totalAnswers;
                    sheet.getCell(`C${totalRowNumber}`).value = 1;
                }
            }

            try {
                const chartElement = document.getElementById(`chart-${chartData.chartId}`);
                if (chartElement) {
                    const canvas = await html2canvas(chartElement, { useCORS: true, backgroundColor: '#ffffff', scale: 3 });
                    
                    // アスペクト比の維持
                    const imgWidth = canvas.width;
                    const imgHeight = canvas.height;
                    const ratio = imgHeight / imgWidth;
                    
                    // Excel上での表示サイズ（基準幅500pxに対し比率を適用）
                    const displayWidth = 500;
                    const displayHeight = displayWidth * ratio;

                    const base64Image = canvas.toDataURL('image/png');
                    const imageId = workbook.addImage({
                        base64: base64Image,
                        extension: 'png',
                    });

                    sheet.addImage(imageId, {
                        tl: { col: 4.5, row: 2 },
                        ext: { width: displayWidth, height: displayHeight }
                    });
                }
            } catch (err) { console.error(`画像キャプチャ失敗:`, err); }

        }

        if (progressText) progressText.textContent = `レポートを保存中...`;
        await yieldToMain();

        if (blankQuestions.length > 0) {
            const sheet = workbook.addWorksheet('対象外', { views: [{ showGridLines: false }] });
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
        setTimeout(() => { document.body.removeChild(anchor); window.URL.revokeObjectURL(url); }, 100);
        showToast('分析レポートの出力が完了しました！', 'success');
        exportSucceeded = true;
    } catch (error) {
        console.error('Excel出力エラー:', error);
        showToast('Excelの生成中にエラーが発生しました。', 'error');
    } finally {
        isExporting = false; // 書き出し終了
        if (exportBtn) {
            exportBtn.disabled = false;
            exportBtn.style.opacity = '1';
            exportBtn.innerHTML = originalBtnHtml;
        }
        if (overlay) {
            if (exportSucceeded) {
                showExportCompletion(overlay, progressIcon, progressText, progressPercent);
            } else {
                overlay.classList.add('hidden');
                overlay.classList.remove('opacity-0', 'opacity-100');
            }
        }
    }
}

// --- Utility Functions ---
function showLoading(isLoading) {
    document.getElementById('loading-indicator').style.display = isLoading ? 'block' : 'none';
    if (isLoading) {
        const container = document.getElementById('charts-container');
        const skeletonCard = `
            <div class="bg-surface rounded-2xl border border-outline-variant shadow-sm overflow-hidden flex flex-col animate-pulse">
                <div class="p-5 border-b border-outline-variant/50 bg-surface-variant/5">
                    <div class="flex justify-between items-start gap-4">
                        <div class="flex items-center gap-3 w-full">
                            <div class="w-8 h-8 rounded-lg bg-surface-variant/50 shrink-0"></div>
                            <div class="flex-1">
                                <div class="h-2 w-12 bg-surface-variant/50 rounded-full mb-2"></div>
                                <div class="h-4 w-3/4 bg-surface-variant/50 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="p-5 flex-1 flex flex-col gap-6">
                    <div class="w-full h-48 bg-surface-variant/30 rounded-xl"></div>
                    <div class="space-y-3">
                        <div class="h-3 w-full bg-surface-variant/20 rounded-full"></div>
                        <div class="h-3 w-5/6 bg-surface-variant/20 rounded-full"></div>
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = skeletonCard.repeat(4);
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

function toHalfWidthDigits(value) {
    return String(value).replace(/[０-９]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0));
}

function formatQuestionChip(questionId) {
    if (!questionId) return 'Q';
    const raw = String(questionId);
    const match = raw.match(/q\s*([0-9０-９]+)/i);
    if (match) {
        return `Q${toHalfWidthDigits(match[1])}`;
    }
    return raw.toUpperCase();
}

function getLegendConfig(labels = []) {
    const labelStrings = labels.map(label => String(label ?? ''));
    const totalLength = labelStrings.reduce((sum, label) => sum + label.length, 0);
    const maxLength = Math.max(0, ...labelStrings.map(label => label.length));
    const shouldPlaceRight = labelStrings.length > 6 || maxLength >= 12 || totalLength >= 60;
    return {
        position: shouldPlaceRight ? 'right' : 'bottom',
        height: shouldPlaceRight ? 220 : undefined,
        itemMargin: shouldPlaceRight ? { horizontal: 8, vertical: 6 } : { horizontal: 15, vertical: 8 },
        chartHeight: shouldPlaceRight ? 380 : 350
    };
}

function showExportCompletion(overlay, progressIcon, progressText, progressPercent) {
    if (!overlay) return;
    if (progressIcon) {
        progressIcon.textContent = 'check_circle';
        progressIcon.classList.remove('animate-spin');
        progressIcon.classList.add('text-success');
        progressIcon.classList.remove('text-primary');
    }
    if (progressText) progressText.textContent = '完了しました';
    if (progressPercent) progressPercent.textContent = '100%';

    overlay.classList.remove('hidden');
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');

    setTimeout(() => {
        overlay.classList.add('opacity-0');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('opacity-0');
            overlay.classList.remove('opacity-100');
        }, 700);
    }, 2500);
}

function escapeHtml(value) {
    if (value === undefined || value === null) return '';
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getBlankReason(type) {
    switch (type) {
        case 'text': case 'free_text': return '自由記述のため';
        case 'number': return '数値入力のため';
        case 'date': case 'datetime': case 'datetime_local': case 'time': return '日付・時刻入力のため';
        case 'handwriting': return '手書き入力のため';
        case 'explanation': return '説明カードのため';
        default: return '未対応の設問タイプ';
    }
}

function normalizeQuestionText(text) {
    if (!text) return '';
    return String(text)
        .toLowerCase()
        .replace(/^[\s　]*q[0-9０-９]+[._、:：\s-]*/i, '')
        .replace(/[()（）【】\[\]「」『』]/g, '')
        .replace(/matrix|single|multi|choice|rating|sa|ma/gi, '')
        .replace(/\s+/g, '')
        .trim();
}

function findAnswerDetail(answer, question) {
    if (!answer || !answer.details) return null;
    const targetText = question.text || question.question || '';
    const normalizedTarget = normalizeQuestionText(targetText);
    const details = answer.details.filter(detail => detail && detail.question);

    const exact = details.find(detail => detail.question === targetText);
    if (exact) return exact;

    const normalizedMatch = details.find(detail => normalizeQuestionText(detail.question) === normalizedTarget);
    if (normalizedMatch) return normalizedMatch;

    if (normalizedTarget.length < 2) return null;

    const fuzzyCandidates = details
        .map(detail => ({ detail, normalized: normalizeQuestionText(detail.question) }))
        .filter(item => item.normalized && (item.normalized.includes(normalizedTarget) || normalizedTarget.includes(item.normalized)))
        .sort((a, b) => b.normalized.length - a.normalized.length);

    if (fuzzyCandidates.length > 0) {
        return fuzzyCandidates[0].detail;
    }

    if (MATRIX_SINGLE_TYPES.has(question.type) || MATRIX_MULTI_TYPES.has(question.type)) {
        const matrixDetail = details.find(detail => detail.type === question.type || String(detail.type || '').startsWith('matrix_'));
        if (matrixDetail) return matrixDetail;
    }

    return null;
}

function normalizeChoiceOptions(options = [], type = '') {
    const isRating = type === 'rating';
    const numericValues = [];
    const labels = [];
    const map = new Map();
    options.forEach((opt, index) => {
        if (opt && typeof opt === 'object') {
            const value = opt.value ?? opt.id ?? opt.text ?? `option_${index + 1}`;
            const text = opt.text ?? opt.label ?? opt.value ?? opt.id ?? String(value);
            const label = isRating ? formatRatingLabel(value, options.length) : text;
            if (isRating && !Number.isNaN(Number(value))) numericValues.push(Number(value));
            labels.push(label);
            map.set(String(value), label);
            map.set(String(text), label);
        } else if (opt !== undefined && opt !== null) {
            const text = String(opt);
            const label = isRating ? formatRatingLabel(opt, options.length) : text;
            if (isRating && !Number.isNaN(Number(opt))) numericValues.push(Number(opt));
            labels.push(label);
            map.set(text, label);
        }
    });
    if (isRating && numericValues.length > 0) {
        const maxStars = Math.max(...numericValues);
        labels.forEach((label, index) => {
            const raw = options[index];
            if (raw === undefined || raw === null) return;
            const rawValue = typeof raw === 'object' ? (raw.value ?? raw.id ?? raw.text) : raw;
            const rebuilt = formatRatingLabel(rawValue, maxStars);
            labels[index] = rebuilt;
            map.set(String(rawValue), rebuilt);
        });
    }
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
    const optionsInfo = normalizeChoiceOptions(question.options || [], question.type);
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
    const labels = optionsInfo.labels.length > 0 ? optionsInfo.labels : Object.keys(counts);
    const entries = labels.map((label, index) => ({
        label,
        count: counts[label] || 0,
        index
    }));
    if (isMulti) {
        entries.sort((a, b) => (b.count - a.count) || (a.index - b.index));
    }
    return {
        labels: entries.map(entry => entry.label),
        data: entries.map(entry => entry.count),
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

function normalizeMatrixKey(value) {
    if (value === undefined || value === null) return '';
    return String(value).toLowerCase().replace(/[\s　._-]+/g, '');
}

function getMatrixRowKeyCandidates(row) {
    const candidates = new Set();
    const add = (value) => {
        if (value === undefined || value === null || value === '') return;
        candidates.add(String(value));
    };
    add(row?.id);
    add(row?.text);

    const rawId = String(row?.id || '');
    const rMatch = rawId.match(/^r(\d+)$/i);
    const rowMatch = rawId.match(/^row(\d+)$/i);
    const numberMatch = rawId.match(/^(\d+)$/);

    if (rMatch) {
        add(`row${rMatch[1]}`);
        add(rMatch[1]);
    }
    if (rowMatch) {
        add(`r${rowMatch[1]}`);
        add(rowMatch[1]);
    }
    if (numberMatch) {
        add(`r${numberMatch[1]}`);
        add(`row${numberMatch[1]}`);
    }

    return candidates;
}

function extractMatrixRowResponses(answerValue, row) {
    if (!answerValue) return [];
    const rowKeySet = new Set(Array.from(getMatrixRowKeyCandidates(row)).map(normalizeMatrixKey));
    if (Array.isArray(answerValue)) {
        const matched = answerValue.filter(item => {
            if (!item || typeof item !== 'object') return false;
            const rowId = item.rowId ?? item.row ?? item.key ?? item.id;
            const rowText = item.rowText ?? item.label ?? item.text;
            return rowKeySet.has(normalizeMatrixKey(rowId)) || rowKeySet.has(normalizeMatrixKey(rowText));
        });
        if (matched.length === 0) return [];
        return matched.flatMap(item => normalizeMatrixValue(item.value ?? item.column ?? item.answer ?? item.selection));
    }
    if (typeof answerValue === 'object') {
        for (const [key, value] of Object.entries(answerValue)) {
            if (rowKeySet.has(normalizeMatrixKey(key))) {
                return normalizeMatrixValue(value);
            }
        }
    }
    return [];
}

function normalizeMatrixValue(value) {
    if (value === undefined || value === null || value === '') return [];
    if (Array.isArray(value)) return value.filter(item => item !== undefined && item !== null && item !== '');
    return [value];
}

function resolveMatrixColumnLabel(value, columns) {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object') {
        const raw = value.value ?? value.text ?? value.label ?? value.id;
        if (raw !== undefined && raw !== null) return resolveMatrixColumnLabel(raw, columns);
        return null;
    }
    const valueStr = String(value);
    const column = columns.find(col => col.value === valueStr || col.text === valueStr);
    return column ? column.text : valueStr;
}

function buildMatrixCharts(question, questionId, answers, isMulti) {
    const rows = normalizeMatrixRows(question.rows || []);
    const columns = normalizeMatrixColumns(question.columns || question.options || []);
    if (rows.length === 0 || columns.length === 0) return [buildBlankChart(questionId, question.text)];
    const matrixTotal = rows.length;
    const rowDetails = rows.map((row, rowIndex) => {
        const counts = {};
        columns.forEach(col => { counts[col.text] = 0; });
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
                if (!Object.prototype.hasOwnProperty.call(counts, label)) { counts[label] = 0; }
                counts[label] += 1;
            });
        });

        const labels = columns.map(col => col.text);
        const data = labels.map(label => counts[label] || 0);
        let sortedLabels = labels;
        let sortedData = data;
        if (isMulti) {
            const entries = labels.map((label, index) => ({
                label,
                count: data[index] || 0,
                index
            }));
            entries.sort((a, b) => (b.count - a.count) || (a.index - b.index));
            sortedLabels = entries.map(entry => entry.label);
            sortedData = entries.map(entry => entry.count);
        }
        return {
            rowIndex,
            rowId: row.id,
            rowText: row.text,
            labels: sortedLabels,
            data: sortedData,
            totalAnswers: answeredCount
        };
    });

    const initialIndex = 0;
    const initial = rowDetails[initialIndex];
    if (!initial) return [buildBlankChart(questionId, question.text)];

    return [buildChartData({
        questionId,
        questionText: question.text,
        questionBaseId: questionId,
        isMatrix: true,
        matrixIndex: initialIndex + 1,
        matrixTotal,
        matrixParentText: question.text,
        matrixRowText: initial.rowText,
        matrixSelectedIndex: initialIndex,
        matrixRows: rows,
        matrixRowDetails: rowDetails,
        chartType: isMulti ? 'bar' : 'pie',
        summaryType: 'table',
        includeTotalRow: !isMulti,
        allowToggle: false,
        labels: initial.labels,
        data: initial.data,
        totalAnswers: initial.totalAnswers
    })];
}

function buildChartData(data) {
    chartSequence += 1;
    return {
        chartId: `${data.questionId}_${chartSequence}`,
        questionId: data.questionId,
        questionBaseId: data.questionBaseId || '',
        questionText: data.questionText,
        isMatrix: Boolean(data.isMatrix),
        matrixIndex: data.matrixIndex || 0,
        matrixTotal: data.matrixTotal || 0,
        matrixParentText: data.matrixParentText || '',
        matrixRowText: data.matrixRowText || '',
        labels: data.labels || [],
        data: data.data || [],
        totalAnswers: data.totalAnswers || 0,
        chartType: data.chartType || 'blank',
        summaryType: data.summaryType || 'none',
        includeTotalRow: Boolean(data.includeTotalRow),
        allowToggle: Boolean(data.allowToggle),
        blankMessage: data.blankMessage || '',
        blankReason: data.blankReason || '',
        listItems: data.listItems || [],
        listAll: data.listAll || [],
        matrixRows: data.matrixRows || [],
        matrixColumns: data.matrixColumns || [],
        matrixSeries: data.matrixSeries || [],
        matrixRowTotals: data.matrixRowTotals || [],
        matrixSelectedIndex: Number.isFinite(data.matrixSelectedIndex) ? data.matrixSelectedIndex : 0,
        matrixRowDetails: data.matrixRowDetails || []
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

function buildListChart(question, questionId, answers, fallbackReason = '') {
    const listEntries = collectListEntries(question, answers);
    const listAll = listEntries.map(entry => ({
        value: entry.value,
        answeredAtLabel: entry.answeredAtLabel
    }));
    return buildChartData({
        questionId,
        questionText: question.text,
        chartType: 'list',
        summaryType: 'table',
        includeTotalRow: false,
        allowToggle: false,
        listItems: listAll.slice(0, 3),
        listAll,
        blankReason: fallbackReason
    });
}

function buildActionButtons(chartData, chartId) {
    return '';
}

function buildChartTypeButtons(chartData, chartId) {
    if (!chartData.allowToggle) return '';
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
        return `<div class="p-6 rounded-xl bg-surface-variant/50 text-on-surface-variant text-sm border border-outline-variant/30 italic">${escapeHtml(chartData.blankMessage)}</div>`;
    }
    if (chartData.chartType === 'list') {
        return '';
    }
    return `<div class="w-full min-h-[350px]"><div id="${chartId}" class="w-full h-full"></div></div>`;
}

function buildChartAreaStatic(chartData, chartId) {
    // This was duplicated, merged into buildChartArea
}

function sanitizeFilename(name) {
    return String(name || 'chart').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80);
}

function sanitizeSheetName(name) {
    const sanitized = String(name || 'Sheet1').replace(/[\[\]\*\/\\?\:]/g, '_').slice(0, 31);
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

function collectListEntries(question, answers) {
    const entries = [];
    answers.forEach(answer => {
        const detail = findAnswerDetail(answer, question);
        if (!detail || detail.answer === undefined || detail.answer === null || detail.answer === '') return;
        const value = formatListValue(detail.answer);
        if (!value) return;
        const answeredAt = answer.answeredAt ? new Date(answer.answeredAt) : null;
        entries.push({
            value,
            answeredAt,
            answeredAtLabel: formatAnsweredAt(answeredAt)
        });
    });
    entries.sort((a, b) => {
        const aTime = a.answeredAt ? a.answeredAt.getTime() : 0;
        const bTime = b.answeredAt ? b.answeredAt.getTime() : 0;
        return bTime - aTime;
    });
    return entries;
}

function formatListValue(value) {
    if (Array.isArray(value)) {
        const items = value.map(item => formatListValue(item)).filter(Boolean);
        return items.length > 0 ? items.join('、') : null;
    }
    if (typeof value === 'object') {
        const named = value.fileName || value.filename || value.name || value.title;
        if (named) return String(named);

        const rawUrl = value.url || value.src || value.path || value.fileUrl || value.imageUrl;
        if (rawUrl) {
            const urlText = String(rawUrl);
            const cleanUrl = urlText.split('?')[0];
            const fileName = cleanUrl.split('/').filter(Boolean).pop();
            return fileName || cleanUrl;
        }

        const mime = String(value.mimeType || value.type || '').toLowerCase();
        if (mime.includes('image') || Object.prototype.hasOwnProperty.call(value, 'image')) {
            return '（画像回答）';
        }

        const text = value.text || value.label || value.value;
        if (text !== undefined && text !== null && String(text).trim() !== '') {
            return String(text).trim();
        }

        return '（添付・オブジェクト回答）';
    }
    const text = String(value).trim();
    return text === '' ? null : text;
}

function formatAnsweredAt(dateValue) {
    if (!dateValue || Number.isNaN(dateValue.getTime())) return '—';
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    const hour = String(dateValue.getHours()).padStart(2, '0');
    const minute = String(dateValue.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
}

function formatRatingLabel(value, maxStars = 5) {
    const num = Number(value);
    if (Number.isNaN(num)) return String(value);
    const stars = '★'.repeat(Math.max(0, Math.min(num, maxStars)));
    return `${num} (${stars})`;
}
