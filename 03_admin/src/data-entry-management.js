
document.addEventListener('DOMContentLoaded', () => {
    const surveyFiles = [
        "sv_0001_25019.json", "sv_0001_25020.json", "sv_0001_25022.json",
        "sv_0001_25023.json", "sv_0001_25024.json", "sv_0001_25025.json",
        "sv_0001_25026.json", "sv_0001_25027.json", "sv_0001_25028.json",
        "sv_0001_25031.json", "sv_0001_25032.json", "sv_0001_25035.json",
        "sv_0001_25039.json", "sv_0001_25040.json", "sv_0001_25043.json",
        "sv_0001_25044.json", "sv_0001_25045.json", "sv_0001_25047.json",
        "sv_0001_25049.json", "sv_0001_25050.json", "sv_0001_25051.json",
        "sv_0001_25052.json", "sv_0001_25053.json", "sv_0001_25054.json",
        "sv_0001_25055.json", "sv_0001_25056.json", "sv_0001_25057.json",
        "sv_0001_25058.json", "sv_0001_25059.json", "sv_0001_25060.json",
        "sv_0001_25061.json", "sv_0001_25062.json"
    ];

    const truncateString = (str, maxLength) => {
        if (str.length > maxLength) {
            return str.substring(0, maxLength) + '...';
        }
        return str;
    };

    const tableBody = document.getElementById('reconciliation-table-body');
    const paginationContainer = document.getElementById('reconciliation-pagination');
    const pageInfo = document.getElementById('pageInfo');
    const rowsPerPageSelect = document.getElementById('rows-per-page');
    const keywordInput = document.getElementById('keyword-search');
    const statusInput = document.getElementById('status-filter');
    const startDateInput = document.getElementById('start-date-filter');
    const endDateInput = document.getElementById('end-date-filter');
    const resetFiltersButton = document.getElementById('resetFiltersButton');

    // Initialize flatpickr
    flatpickr.localize(flatpickr.l10ns.ja);
    const endDatePicker = flatpickr("#endDatePickerWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
        onChange: function() { handleFilterChange(); }
    });
    const startDatePicker = flatpickr("#startDatePickerWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr, instance) {
            endDatePicker.set('minDate', dateStr);
            handleFilterChange();
        }
    });

    let allSurveyData = [];
    let currentPage = 1;
    let rowsPerPage = 10;
    let currentSortKey = 'name';
    let currentSortDirection = 'asc';

    const fetchData = async () => {
        const promises = surveyFiles.map(file => fetch(`../data/demo_surveys/${file}`).then(res => res.json()));
        const results = await Promise.all(promises);
        allSurveyData = results.map(survey => {
            const statuses = ['会期前', '会期中', '会期中オンデマンド', '会期終了（データ化無し）', '会期終了（データ化中）', '会期終了（照合待ち）', 'エスカレ有'];
            const total = Math.floor(Math.random() * 200) + 50;
            const completed = Math.floor(Math.random() * total);
            const matchCount = Math.floor(Math.random() * (completed + 1));
            const mismatchCount = completed - matchCount;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
            return {
                ...survey,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                totalCount: total,
                completedCount: completed,
                matchCount: matchCount,
                mismatchCount: mismatchCount,
                progress: progress,
                option: Math.random() > 0.5 ? '有' : '無',
            };
        });
        renderTable();
        setupSortListeners();
    };

    const renderTable = () => {
        tableBody.innerHTML = '';
        const filteredData = applyFilters();
        const totalPages = Math.ceil(filteredData.length / rowsPerPage);
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const paginatedData = filteredData.slice(start, end);

        paginatedData.forEach(survey => {
            const row = `
                <tr class="hover:bg-surface-variant/60">
                    <td class="px-4 py-3 text-on-surface truncate" title="${survey.name.ja}">${truncateString(survey.name.ja, 17)}</td>
                    <td class="px-4 py-3 text-center"><span class="inline-flex items-center justify-center gap-1 rounded-full px-2.5 py-1 text-xs ${getStatusClass(survey.status)} whitespace-nowrap">${getShortStatus(survey.status)}</span></td>
                    <td class="px-4 py-3 text-on-surface-variant font-medium whitespace-nowrap">${survey.periodEnd}</td>
                    <td class="px-4 py-3 text-on-surface-variant whitespace-nowrap text-center">${survey.option}</td>
                    <td class="px-4 py-3 text-on-surface-variant whitespace-nowrap">${survey.totalCount}</td>
                    <td class="px-4 py-3 text-on-surface-variant whitespace-nowrap">${survey.matchCount}</td>
                    <td class="px-4 py-3 text-on-surface-variant whitespace-nowrap">${survey.mismatchCount}</td>
                    <td class="px-4 py-3 whitespace-nowrap">
                        <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                            <div class="bg-blue-600 h-2.5 rounded-full" style="width: ${survey.progress}%"></div>
                        </div>
                        <span class="text-xs text-on-surface-variant">${survey.progress}%</span>
                    </td>
                    <td class="px-4 py-3 text-left space-x-1 whitespace-nowrap">
                        <button class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="照合作業"><span class="material-icons text-base">fact_check</span></button>
                        <button class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="エスカレーション"><span class="material-icons text-base">gpp_maybe</span></button>
                        <button class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="データ確認"><span class="material-icons text-base">preview</span></button>
                        <button class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" title="全レコードDL"><span class="material-icons text-base">download</span></button>
                    </td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
        renderPagination(totalPages, filteredData.length);
        updateSortIcons();
    };

    const setupSortListeners = () => {
        document.querySelectorAll('.sortable-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const newSortKey = e.currentTarget.dataset.sortKey;

                if (currentSortKey === newSortKey) {
                    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortKey = newSortKey;
                    currentSortDirection = 'asc';
                }

                currentPage = 1;
                renderTable();
            });
        });
    };

    const updateSortIcons = () => {
        document.querySelectorAll('.sortable-header').forEach(header => {
            const key = header.dataset.sortKey;
            const iconSpan = header.querySelector('.sort-icon');

            // デフォルト状態 (薄いunfold_more)
            iconSpan.classList.add('text-on-surface-variant/50');
            iconSpan.classList.remove('text-primary');
            iconSpan.textContent = 'unfold_more';

            if (key === currentSortKey) {
                // ソートされている場合 (濃い矢印)
                iconSpan.classList.remove('text-on-surface-variant/50');
                iconSpan.classList.add('text-primary');
                iconSpan.textContent = currentSortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward';
            }
        });
    };

    const getShortStatus = (status) => {
        switch (status) {
            case '会期中オンデマンド': return 'ｵﾝﾃﾞﾏﾝﾄﾞ';
            case '会期終了（データ化無し）': return 'データ化無';
            case '会期終了（データ化中）': return 'データ化中';
            case '会期終了（照合待ち）': return '照合待ち';
            case 'エスカレ有': return 'エスカレ有';
            default: return status;
        }
    };

    const getStatusClass = (status) => {
        switch (status) {
            case '会期前': return 'bg-gray-100 text-gray-800';
            case '会期中': return 'bg-blue-100 text-blue-800';
            case '会期中オンデマンド': return 'bg-purple-100 text-purple-800';
            case '会期終了（データ化無し）': return 'bg-green-100 text-green-800';
            case '会期終了（データ化中）': return 'bg-yellow-100 text-yellow-800';
            case '会期終了（照合待ち）': return 'bg-indigo-100 text-indigo-800';
            case 'エスカレ有': return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const renderPagination = (totalPages, totalItems) => {
        // Clear previous state
        paginationContainer.innerHTML = '';
        pageInfo.innerHTML = '';

        if (totalItems === 0) {
            paginationContainer.innerHTML = '<span class="text-on-surface-variant">対象のレコードがありません</span>';
            return;
        }

        // Page Info
        const startItem = (currentPage - 1) * rowsPerPage + 1;
        const endItem = Math.min(currentPage * rowsPerPage, totalItems);
        pageInfo.textContent = `${startItem} - ${endItem} / 全 ${totalItems} 件`;

        // Create and append elements
        const prevPageBtn = document.createElement('button');
        prevPageBtn.className = "p-1 rounded-full hover:bg-surface-variant transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
        prevPageBtn.title = "前へ";
        prevPageBtn.id = "prevPageBtn";
        prevPageBtn.setAttribute('aria-label', '前のページへ');
        prevPageBtn.innerHTML = '<span class="material-icons text-lg">chevron_left</span>';
        prevPageBtn.disabled = currentPage === 1;
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });

        const paginationNumbers = document.createElement('div');
        paginationNumbers.id = 'pagination-numbers';
        paginationNumbers.className = 'flex items-center gap-1';

        // Page Numbers (a more advanced implementation would use ellipses for many pages)
        for (let i = 1; i <= totalPages; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.dataset.page = i;
            pageButton.className = `px-3 py-1 rounded-md text-sm transition-colors ${i === currentPage ? 'bg-primary text-on-primary' : 'hover:bg-surface-variant'}`;
            pageButton.addEventListener('click', (e) => {
                currentPage = parseInt(e.currentTarget.dataset.page);
                renderTable();
            });
            paginationNumbers.appendChild(pageButton);
        }

        const nextPageBtn = document.createElement('button');
        nextPageBtn.className = "p-1 rounded-full hover:bg-surface-variant transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
        nextPageBtn.title = "次へ";
        nextPageBtn.id = "nextPageBtn";
        nextPageBtn.setAttribute('aria-label', '次のページへ');
        nextPageBtn.innerHTML = '<span class="material-icons text-lg">chevron_right</span>';
        nextPageBtn.disabled = currentPage === totalPages;
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });

        paginationContainer.appendChild(prevPageBtn);
        paginationContainer.appendChild(paginationNumbers);
        paginationContainer.appendChild(nextPageBtn);
    };

    const applyFilters = () => {
        const keyword = keywordInput.value.toLowerCase();
        const status = statusInput.value;
        const startDate = startDateInput.value;
        const endDate = endDateInput.value;

        let filteredData = allSurveyData.filter(survey => {
            const nameMatch = survey.name.ja.toLowerCase().includes(keyword);
            const statusMatch = status === 'すべて' || survey.status === status;
            const dateMatch = (!startDate || survey.periodStart >= startDate) && (!endDate || survey.periodEnd <= endDate);
            return nameMatch && statusMatch && dateMatch;
        });

        // ソートロジックの適用
        if (currentSortKey) {
            const STATUS_ORDER = ['会期前', '会期中', '会期中オンデマンド', '会期終了（データ化無し）', '会期終了（データ化中）', '会期終了（照合待ち）', 'エスカレ有'];
            filteredData.sort((a, b) => {
                let aValue, bValue;

                if (currentSortKey === 'name') {
                    aValue = (a.name && a.name.ja) ? a.name.ja : '';
                    bValue = (b.name && b.name.ja) ? b.name.ja : '';
                } else {
                    aValue = a[currentSortKey];
                    bValue = b[currentSortKey];
                }

                let comparison = 0;
                
                if (currentSortKey === 'status') {
                    const aIndex = STATUS_ORDER.indexOf(aValue);
                    const bIndex = STATUS_ORDER.indexOf(bValue);
                    comparison = aIndex - bIndex;
                } else if (currentSortKey === 'periodEnd') {
                    // Convert YYYY-MM-DD to YYYYMMDD for numerical comparison
                    const aDate = parseInt(aValue ? aValue.replace(/-/g, '') : '0');
                    const bDate = parseInt(bValue ? bValue.replace(/-/g, '') : '0');
                    comparison = aDate - bDate;
                } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                    comparison = aValue - bValue;
                } else if (aValue > bValue) {
                    comparison = 1;
                } else if (aValue < bValue) {
                    comparison = -1;
                }

                return currentSortDirection === 'asc' ? comparison : comparison * -1;
            });
        }

        return filteredData;
    };

    const handleFilterChange = () => {
        currentPage = 1;
        renderTable();
    };

    rowsPerPageSelect.addEventListener('change', handleFilterChange);
    keywordInput.addEventListener('input', handleFilterChange);
    statusInput.addEventListener('change', handleFilterChange);
    startDateInput.addEventListener('change', handleFilterChange);
    endDateInput.addEventListener('change', handleFilterChange);

    resetFiltersButton.addEventListener('click', () => {
        keywordInput.value = '';
        statusInput.selectedIndex = 0;
        startDatePicker.clear();
        endDatePicker.clear();
        handleFilterChange();
    });

    fetchData();
});
