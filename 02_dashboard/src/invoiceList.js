export function initInvoiceListPage() {
    const invoiceListBody = document.getElementById('invoice-table-body');
    const loadingOverlay = document.getElementById('invoice-loading-overlay');
    const messageOverlay = document.getElementById('invoice-message-overlay');
    const applyFilterBtn = document.getElementById('applyFilterBtn');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    const searchBoxInput = document.getElementById('searchBox');
    const invoiceTable = document.getElementById('invoiceTable');
    const paginationContainer = document.getElementById('invoice-pagination-container');

    let currentSortColumn = 'issueDate'; // デフォルトのソートカラム
    let currentSortDirection = 'desc'; // デフォルトのソート方向
    let currentPage = 1; // 現在のページ
    const itemsPerPage = 10; // 1ページあたりの表示件数

    // flatpickrの初期化
    if (startDateInput) {
        flatpickr(startDateInput, {
            dateFormat: "Y-m-d",
            locale: "ja"
        });
    }
    if (endDateInput) {
        flatpickr(endDateInput, {
            dateFormat: "Y-m-d",
            locale: "ja"
        });
    }

    // 仮のデータ読み込み関数
    async function fetchInvoices(filters = {}, sort = {}, page = 1) {
        loadingOverlay.classList.remove('hidden');
        messageOverlay.classList.add('hidden');
        invoiceListBody.innerHTML = ''; // 既存の行をクリア

        currentPage = page; // 現在のページを更新

        try {
            const response = await fetch('data/invoices.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            let invoices = await response.json();

            // フィルタリングとソートを適用
            invoices = applyFiltersAndSort(invoices, filters, sort);

            const totalPages = Math.ceil(invoices.length / itemsPerPage);
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedInvoices = invoices.slice(startIndex, endIndex);

            if (paginatedInvoices.length === 0) {
                showMessage('表示する請求書がありません。');
            } else {
                renderInvoices(paginatedInvoices);
                renderPagination(totalPages);
            }
        } catch (error) {
            console.error('請求書データの読み込みに失敗しました:', error);
            showMessage('請求書データの読み込みに失敗しました。再試行してください。');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    }

    // フィルタリングとソートを適用する関数
    function applyFiltersAndSort(invoices, filters, sort) {
        let filteredInvoices = [...invoices];

        // フィルタリング
        if (filters.startDate) {
            const start = new Date(filters.startDate);
            filteredInvoices = filteredInvoices.filter(invoice => new Date(invoice.issueDate) >= start);
        }
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            filteredInvoices = filteredInvoices.filter(invoice => new Date(invoice.issueDate) <= end);
        }
        if (filters.searchTerm) {
            const searchTermLower = filters.searchTerm.toLowerCase();
            filteredInvoices = filteredInvoices.filter(invoice =>
                invoice.invoiceId.toLowerCase().includes(searchTermLower) ||
                invoice.totalAmount.toString().includes(searchTermLower)
            );
        }

        // ソート
        if (sort.column) {
            filteredInvoices.sort((a, b) => {
                let valA = a[sort.column];
                let valB = b[sort.column];

                if (sort.column === 'issueDate') {
                    valA = new Date(valA);
                    valB = new Date(valB);
                }

                if (valA < valB) {
                    return sort.direction === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sort.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return filteredInvoices;
    }

    function renderInvoices(invoices) {
        invoiceListBody.innerHTML = ''; // 既存の行をクリア
        invoices.forEach(invoice => {
            const row = document.createElement('tr');
            row.classList.add('hover:bg-surface-variant', 'cursor-pointer');

            // 発行月 (issueDateからYYYY年MM月形式に変換)
            const issueDate = new Date(invoice.issueDate);
            const year = issueDate.getFullYear();
            const month = issueDate.getMonth() + 1; // 月は0から始まるため+1
            const formattedMonth = `${year}年${month}月`;

            // 請求金額 (カンマ区切りにフォーマット)
            const formattedAmount = invoice.totalAmount.toLocaleString();

            row.innerHTML = `
                <td class="px-4 py-3 whitespace-nowrap">${formattedMonth}</td>
                <td class="px-4 py-3 whitespace-nowrap">¥${formattedAmount}</td>
                <td class="px-4 py-3 whitespace-nowrap">
                    <button class="button-secondary btn-sm view-detail-btn" data-invoice-id="${invoice.invoiceId}">
                        詳細
                    </button>
                </td>
            `;
            invoiceListBody.appendChild(row);
        });

        // 詳細ボタンにイベントリスナーを追加
        document.querySelectorAll('.view-detail-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                const invoiceId = event.target.dataset.invoiceId;
                // 請求書詳細画面へ遷移
                window.location.href = `invoice-detail.html?invoiceId=${invoiceId}`;
            });
        });
    }

    function showMessage(msg) {
        messageOverlay.classList.remove('hidden');
        messageOverlay.querySelector('p').textContent = msg;
    }

    // ページネーションUIを生成する関数
    function renderPagination(totalPages) {
        paginationContainer.innerHTML = ''; // 既存のページネーションをクリア

        if (totalPages <= 1) {
            return; // ページが1つ以下の場合はページネーションを表示しない
        }

        const ul = document.createElement('ul');
        ul.classList.add('flex', 'items-center', 'space-x-2');

        // Prevボタン
        const prevLi = document.createElement('li');
        const prevButton = document.createElement('button');
        prevButton.textContent = '前へ';
        prevButton.classList.add('px-3', 'py-1', 'rounded-md', 'border', 'border-outline-variant', 'bg-surface', 'text-on-surface', 'hover:bg-surface-variant');
        if (currentPage === 1) {
            prevButton.disabled = true;
            prevButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
        prevButton.addEventListener('click', () => {
            if (currentPage > 1) {
                fetchInvoices(
                    { startDate: startDateInput.value, endDate: endDateInput.value, searchTerm: searchBoxInput.value },
                    { column: currentSortColumn, direction: currentSortDirection },
                    currentPage - 1
                );
            }
        });
        prevLi.appendChild(prevButton);
        ul.appendChild(prevLi);

        // ページ番号
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.textContent = i;
            button.classList.add('px-3', 'py-1', 'rounded-md', 'border', 'border-outline-variant', 'bg-surface', 'text-on-surface', 'hover:bg-surface-variant');
            if (i === currentPage) {
                button.classList.add('bg-primary', 'text-on-primary', 'font-bold');
            }
            button.addEventListener('click', () => {
                fetchInvoices(
                    { startDate: startDateInput.value, endDate: endDateInput.value, searchTerm: searchBoxInput.value },
                    { column: currentSortColumn, direction: currentSortDirection },
                    i
                );
            });
            li.appendChild(button);
            ul.appendChild(li);
        }

        // Nextボタン
        const nextLi = document.createElement('li');
        const nextButton = document.createElement('button');
        nextButton.textContent = '次へ';
        nextButton.classList.add('px-3', 'py-1', 'rounded-md', 'border', 'border-outline-variant', 'bg-surface', 'text-on-surface', 'hover:bg-surface-variant');
        if (currentPage === totalPages) {
            nextButton.disabled = true;
            nextButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
        nextButton.addEventListener('click', () => {
            if (currentPage < totalPages) {
                fetchInvoices(
                    { startDate: startDateInput.value, endDate: endDateInput.value, searchTerm: searchBoxInput.value },
                    { column: currentSortColumn, direction: currentSortDirection },
                    currentPage + 1
                );
            }
        });
        nextLi.appendChild(nextButton);
        ul.appendChild(nextLi);

        paginationContainer.appendChild(ul);
    }

    // フィルタ適用ボタンのイベントリスナー
    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => {
            const filters = {
                startDate: startDateInput.value,
                endDate: endDateInput.value,
                searchTerm: searchBoxInput.value
            };
            fetchInvoices(filters, { column: currentSortColumn, direction: currentSortDirection }, 1); // フィルタ適用時は1ページ目に戻る
        });
    }

    // テーブルヘッダーのソートイベントリスナー
    invoiceTable.querySelectorAll('th').forEach(header => {
        const column = header.dataset.sortColumn;
        if (column) {
            header.classList.add('cursor-pointer');
            header.addEventListener('click', () => {
                if (currentSortColumn === column) {
                    currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    currentSortColumn = column;
                    currentSortDirection = 'asc'; // デフォルトは昇順
                }
                // ソートアイコンを更新
                updateSortIcons();
                // データを再フェッチ（フィルタも適用）
                const filters = {
                    startDate: startDateInput.value,
                    endDate: endDateInput.value,
                    searchTerm: searchBoxInput.value
                };
                fetchInvoices(filters, { column: currentSortColumn, direction: currentSortDirection }, 1); // ソート時も1ページ目に戻る
            });
        }
    });

    // ソートアイコンを更新する関数
    function updateSortIcons() {
        invoiceTable.querySelectorAll('th').forEach(header => {
            header.querySelector('.sort-icon')?.remove(); // 既存のアイコンを削除
            const column = header.dataset.sortColumn;
            if (column) { // columnがundefinedでないことを確認
                if (column === currentSortColumn) {
                    const icon = document.createElement('span');
                    icon.classList.add('sort-icon', 'ml-2');
                    icon.innerHTML = currentSortDirection === 'asc' ? '&#9650;' : '&#9660;'; // ▲ または ▼
                    header.appendChild(icon);
                }
            }
        });
    }

    // 請求書データを読み込む (初期表示)
    fetchInvoices({}, { column: currentSortColumn, direction: currentSortDirection });
}