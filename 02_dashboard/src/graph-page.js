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
let isExporting = false; // 書き出し中フラグ

// 表示オプションの状態管理
const displayOptions = {
    showSummary: true,
    showDataLabels: true,
    showCenterText: true,
    showTable: true,
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

    // 離脱防止イベント
    window.addEventListener('beforeunload', (event) => {
        if (isExporting) {
            event.preventDefault();
            event.returnValue = ''; // ブラウザ標準の警告を表示
        }
    });

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
    const detailedContent = document.getElementById('detailed-search-content');
    const resetBtn = document.getElementById('resetFiltersButton');

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
                detailedContent.classList.remove('hidden');
                return;
            } else {
                detailedContent.classList.add('hidden');
            }

            if (val === 'all') {
                if (startDatePicker) startDatePicker.setDate("2026-01-04 00:00");
                if (endDatePicker) endDatePicker.setDate("2026-01-17 23:59");
                currentDateFilter = [new Date(2026, 0, 4, 0, 0), new Date(2026, 0, 17, 23, 59)];
            } else {
                if (startDatePicker) startDatePicker.setDate(`${val} 00:00`);
                if (endDatePicker) endDatePicker.setDate(`${val} 23:59`);
                const d = val.split('-');
                currentDateFilter = [new Date(d[0], d[1] - 1, d[2], 0, 0), new Date(d[0], d[1] - 1, d[2], 23, 59)];
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
        card.className = 'bg-surface rounded-2xl border border-outline-variant shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col';

        const actionButtons = buildActionButtons(chartData, chartId);
        const chartArea = buildChartArea(chartData, chartId);
        const questionTitle = escapeHtml(chartData.questionText);
        const questionChip = formatQuestionChip(chartData.questionId);
        
        const isBlank = chartData.chartType === 'blank';
        const iconName = isBlank ? 'subject' : 'analytics';
        const iconColor = isBlank ? 'text-on-surface-variant/60' : 'text-primary';

        let insightHtml = '';
        if (displayOptions.showSummary && !isBlank && chartData.labels.length > 0) {
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

        const summaryArea = chartData.summaryType === 'table'
            ? `<div id="summary-${chartId}" class="text-sm"></div>`
            : '';

        card.innerHTML = `
            <div class="p-5 border-b border-outline-variant/50 bg-surface-variant/10">
                <div class="flex justify-between items-start gap-4">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-8 h-8 rounded-lg bg-white shadow-sm border border-outline-variant flex items-center justify-center shrink-0">
                            <span class="material-icons text-lg ${iconColor}">${iconName}</span>
                        </div>
                        <div class="min-w-0">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-variant text-on-surface-variant border border-outline-variant mb-1">${questionChip}</span>
                            <h3 class="text-base font-bold text-on-surface leading-tight line-clamp-2" title="${questionTitle}">${questionTitle}</h3>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                        ${actionButtons}
                    </div>
                </div>
                <div class="flex items-center justify-between mt-4">
                    <p class="text-[11px] font-medium text-on-surface-variant uppercase tracking-widest">有効回答: ${chartData.totalAnswers}件</p>
                    ${insightHtml}
                </div>
            </div>

            <div class="p-5 flex-1 flex flex-col gap-6">
                <div class="flex justify-start">
                    ${buildChartTypeButtons(chartData, chartId)}
                </div>

                <div class="w-full">
                    ${chartArea}
                </div>

                ${(summaryArea && displayOptions.showTable) ? `
                <div class="mt-2 pt-6 border-t border-outline-variant/30">
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

        if (chartData.chartType !== 'blank') {
            createChart(chartId, chartData, chartData.chartType);
        }

        if (chartData.summaryType === 'table') {
            renderChartSummaryTable(`summary-${chartId}`, chartData);
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

    document.querySelectorAll('.download-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const buttonEl = e.currentTarget;
            const chartId = buttonEl.dataset.chartId;
            const chartInstance = chartInstances[chartId];
            
            if (chartInstance) {
                try {
                    buttonEl.disabled = true;
                    buttonEl.style.opacity = '0.5';

                    await chartInstance.dataURI().then(({ imgURI }) => {
                        const link = document.createElement('a');
                        link.href = imgURI;
                        const sanitizedQuestion = chartDataStore.get(chartId).questionText.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
                        link.download = `${sanitizedQuestion}.png`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    });

                    showToast('画像を保存しました。', 'success');
                } catch (err) {
                    console.error('保存失敗:', err);
                    showToast('画像の保存に失敗しました。', 'error');
                } finally {
                    buttonEl.disabled = false;
                    buttonEl.style.opacity = '1';
                }
            }
        });
    });

    const exportAllButton = document.getElementById('excel-export-all');
    if (exportAllButton) {
        exportAllButton.onclick = () => exportAllChartsToExcel(chartsData);
    }
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

    const colors = ['#4285F4', '#34A853', '#FBBC05', '#EA4335', '#AB47BC', '#00ACC1', '#FF7043', '#9E9D24'];
    const isDoughnut = type === 'pie';
    const legendConfig = getLegendConfig(chartData.labels);
    const chartHeight = isDoughnut ? legendConfig.chartHeight : 350;

    const options = {
        series: isDoughnut ? chartData.data : [{ name: '件数', data: chartData.data }],
        chart: {
            type: isDoughnut ? 'donut' : 'bar',
            height: chartHeight,
            width: '100%',
            fontFamily: "'Noto Sans JP', sans-serif",
            toolbar: { show: false },
            animations: { enabled: true, easing: 'easeinout', speed: 800 },
            padding: { top: 10, right: 10, bottom: 10, left: 10 }
        },
        colors: colors,
        labels: chartData.labels,
        plotOptions: {
            pie: {
                donut: {
                    size: '72%',
                    labels: {
                        show: displayOptions.showCenterText,
                        total: {
                            show: true,
                            label: 'Total',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#6B6B6B',
                            formatter: () => chartData.totalAnswers.toLocaleString()
                        },
                        value: {
                            fontSize: '32px',
                            fontWeight: 800,
                            color: '#1A1A1A',
                            offsetY: 5
                        }
                    }
                }
            },
            bar: {
                horizontal: true,
                borderRadius: 8,
                barHeight: '75%',
                dataLabels: { position: 'top' }
            }
        },
        dataLabels: {
            enabled: displayOptions.showDataLabels,
            formatter: (val) => isDoughnut ? Math.round(val) + "%" : val + "件",
            style: {
                fontSize: '13px',
                fontWeight: 700,
                colors: isDoughnut ? ['#fff'] : ['#1A1A1A']
            },
            offsetX: isDoughnut ? 0 : 40
        },
        legend: {
            show: isDoughnut,
            position: legendConfig.position,
            height: legendConfig.height,
            fontSize: '13px',
            fontFamily: "'Noto Sans JP', sans-serif",
            markers: { radius: 12, width: 12, height: 12 },
            itemMargin: legendConfig.itemMargin
        },
        grid: {
            show: displayOptions.showGrid,
            borderColor: '#F1F1F1',
            padding: { left: 20, right: 40 }
        },
        xaxis: {
            categories: chartData.labels,
            labels: { show: !isDoughnut, style: { fontSize: '12px', fontWeight: 500 } }
        },
        yaxis: {
            labels: { show: !isDoughnut, maxWidth: 200, style: { fontSize: '13px', fontWeight: 600 } }
        },
        stroke: { show: true, width: isDoughnut ? 3 : 0, colors: ['#fff'] }
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

    const totalVotes = chartData.totalAnswers || 0;

    let html = `
        <div class="overflow-x-auto">
            <table class="min-w-full text-left text-sm border border-outline-variant">
                <thead class="bg-surface-variant-soft text-on-surface-variant">
                    <tr>
                        <th class="px-3 py-2 border-b border-outline-variant">項目</th>
                        <th class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums">件数</th>
                        <th class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums">割合</th>
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
                <td class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums">${count}件</td>
                <td class="px-3 py-2 border-b border-outline-variant text-right font-mono tabular-nums">${percentage}%</td>
            </tr>
        `;
    });

    if (chartData.includeTotalRow) {
        const totalPercentage = totalVotes > 0 ? '100.0%' : '0.0%';
        html += `
            <tr class="font-semibold">
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

            if (chartData.includeTotalRow) {
                const totalRowNumber = 3 + rows.length + 1;
                sheet.getCell(`B${totalRowNumber}`).value = totalAnswers;
                sheet.getCell(`C${totalRowNumber}`).value = 1;
            }
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
    return String(text).toLowerCase().replace(/^[\\s　]*q[0-9０-９]+[._、:：\\s-]*/i, '').replace(/\\s+/g, '');
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
    const labels = optionsInfo.labels.length > 0 ? optionsInfo.labels : Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const data = labels.map(label => counts[label] || 0);
    return { labels, data, totalAnswers: answeredCount };
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
            if (Object.prototype.hasOwnProperty.call(answerValue, key)) { return normalizeMatrixValue(answerValue[key]); }
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
    const columns = normalizeMatrixColumns(question.columns || []);
    if (rows.length === 0 || columns.length === 0) return [buildBlankChart(questionId, question.text)];
    return rows.map((row, rowIndex) => {
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
        return buildChartData({
            questionId: `${questionId}_${rowIndex + 1}`,
            questionText: `${question.text} - ${row.text}`,
            chartType: isMulti ? 'bar' : 'pie',
            summaryType: isMulti ? 'none' : 'table',
            includeTotalRow: !isMulti,
            allowToggle: false,
            labels, data, totalAnswers: answeredCount
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
    if (chartData.chartType === 'blank') return '';
    return `
        <div class="flex items-center gap-2">
            <button type="button" data-chart-id="${chartId}" class="download-btn button-secondary p-2 rounded-md" title="グラフをダウンロード">
                <span class="material-icons">download</span>
            </button>
        </div>
    `;
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