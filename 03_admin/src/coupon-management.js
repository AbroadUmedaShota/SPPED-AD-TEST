import { showToast } from '../../02_dashboard/src/utils.js';
import { handleOpenModal, closeModal } from '../../02_dashboard/src/modalHandler.js';

export function initCouponManagementPage() {
    let allCouponsData = [];
    let displayedCoupons = [];

    let currentPage = 1;
    let itemsPerPage = 10;
    let sortKey = 'createdAt';
    let sortDirection = 'desc';

    const tableBody = document.getElementById('coupon-list-body');
    const searchForm = document.getElementById('couponSearchForm');
    const itemsPerPageSelect = document.getElementById('itemsPerPageSelect');
    const tableHeader = document.querySelector('#coupon-list-body').previousElementSibling;

    loadCoupons();
    setupEventListeners();

    function setupEventListeners() {
        document.getElementById('newCouponButton').addEventListener('click', () => {
            handleOpenModal('newCouponModal', '/03_admin/modals/newCouponModal.html', setupNewCouponModal);
        });

        // ... (other event listeners)

            if (button.classList.contains('detail-btn')) {
                handleOpenModal('couponDetailModal', '/03_admin/modals/couponDetailModal.html', () => setupCouponDetailModal(coupon));
            } else if (button.classList.contains('edit-btn')) {
                handleOpenModal('editCouponModal', '/03_admin/modals/editCouponModal.html', () => setupCouponEditModal(coupon));
            }
        });

        if (itemsPerPageSelect) {
            itemsPerPageSelect.addEventListener('change', e => {
                itemsPerPage = parseInt(e.target.value, 10);
                currentPage = 1;
                renderAll();
            });
        }

        const csvExportButton = document.getElementById('csvExportButton');
        if (csvExportButton) {
            csvExportButton.addEventListener('click', () => {
                exportToCsv('coupons.csv', displayedCoupons);
            });
        }
    }

    function exportToCsv(filename, data) {
        const headers = ['id', 'code', 'name', 'discountRate', 'validFrom', 'validTo', 'usageLimit', 'usageCount', 'targetType', 'targetUserEmail', 'status', 'memo', 'createdBy', 'createdAt', 'updatedAt'];
        const csvRows = [headers.join(',')];
        for (const row of data) {
            const values = headers.map(header => {
                let value = row[header];
                if (value === null || value === undefined) value = '';
                else if (typeof value === 'string') value = `"${value.replace(/"/g, '""')}"`;
                return value;
            });
            csvRows.push(values.join(','));
        }
        const blob = new Blob(["\uFEFF" + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSVファイルをエクスポートしました。', 'success');
    }

    async function loadCoupons() {
        try {
            const response = await fetch('../../data/admin/coupons.json');
            allCouponsData = await response.json();
            applyFiltersAndRender();
        } catch (error) {
            console.error('Failed to load coupons:', error);
            tableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4">読込失敗</td></tr>`;
        }
    }

    function applyFiltersAndRender() {
        const keyword = document.getElementById('searchKeyword').value.toLowerCase();
        const status = document.getElementById('searchStatus').value;
        const startDate = document.getElementById('searchDateStart').value;
        const endDate = document.getElementById('searchDateEnd').value;
        displayedCoupons = allCouponsData.filter(c => {
            const keywordMatch = !keyword || [c.code, c.name, c.targetUserEmail].some(s => s && s.toLowerCase().includes(keyword));
            const statusMatch = !status || c.status === status;
            const dateMatch = (!startDate || c.validTo >= startDate) && (!endDate || c.validFrom <= endDate);
            return keywordMatch && statusMatch && dateMatch;
        });
        currentPage = 1;
        renderAll();
    }

    function renderAll() {
        const sortedData = [...displayedCoupons].sort((a, b) => {
            let valA = a[sortKey];
            let valB = b[sortKey];
            if (valA === null || valA === undefined) valA = '';
            if (valB === null || valB === undefined) valB = '';
            if (sortDirection === 'asc') return valA > valB ? 1 : -1;
            return valA < valB ? 1 : -1;
        });
        renderCoupons(sortedData);
        renderPagination(sortedData.length);
    }

    function renderCoupons(dataToRender) {
        const start = (currentPage - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const paginatedData = dataToRender.slice(start, end);
        tableBody.innerHTML = paginatedData.map(coupon => `
            <tr class="hover:bg-surface-variant/60 transition-colors">
                 <td class="px-4 py-3 font-mono text-on-surface">${coupon.code}</td>
                 <td class="px-4 py-3 text-on-surface-variant">${coupon.name}</td>
                 <td class="px-4 py-3 text-on-surface-variant flex items-center">${coupon.targetType === 'SPECIFIC_EMAIL' ? '<span class="material-icons text-base mr-1">person</span>' : ''}${coupon.targetUserEmail || '-'}</td>
                 <td class="px-4 py-3 text-on-surface-variant text-right">${coupon.discountRate}%</td>
                 <td class="px-4 py-3 text-on-surface-variant">${new Date(coupon.validFrom).toLocaleDateString()} 〜 ${new Date(coupon.validTo).toLocaleDateString()}</td>
                 <td class="px-4 py-3 text-on-surface-variant">${coupon.usageCount} / ${coupon.usageLimit === -1 ? '∞' : coupon.usageLimit}</td>
                 <td class="px-4 py-3"><span class="inline-flex items-center rounded-full ${getStatusClass(coupon.status)} px-2.5 py-1 text-xs">${getStatusText(coupon.status)}</span></td>
                 <td class="px-4 py-3 text-right space-x-2">
                    <button class="inline-flex items-center gap-1 rounded border border-outline px-3 py-1 text-xs detail-btn" data-coupon-id="${coupon.id}">詳細</button>
                    <button class="inline-flex items-center gap-1 rounded border border-outline px-3 py-1 text-xs edit-btn" data-coupon-id="${coupon.id}">編集</button>
                </td>
            </tr>
        `).join('');
    }

    function renderPagination(totalItems) {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const infoEl = document.getElementById('pagination-info');
        const controlsEl = document.getElementById('pagination-controls');
        if (totalItems === 0) {
            infoEl.textContent = '0件中 0〜0件を表示';
            controlsEl.innerHTML = '';
            return;
        }
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);
        infoEl.textContent = `${totalItems}件中 ${startItem}〜${endItem}件を表示`;
        let buttons = `<button class="px-3 py-1 rounded border border-outline" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">前へ</button>`;
        for (let i = 1; i <= totalPages; i++) {
            buttons += `<button class="px-3 py-1 rounded ${i === currentPage ? 'bg-primary text-primary-on' : 'border border-outline'}" data-page="${i}">${i}</button>`;
        }
        buttons += `<button class="px-3 py-1 rounded border border-outline" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">次へ</button>`;
        controlsEl.innerHTML = buttons;
        controlsEl.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', e => {
                const page = parseInt(e.target.dataset.page, 10);
                if (page) {
                    currentPage = page;
                    renderAll();
                }
            });
        });
    }

    function getStatusText(status) {
        const map = { ACTIVE: '有効', LIMIT_REACHED: '利用上限到達', INACTIVE: '利用停止', EXPIRED: '期限切れ' };
        return map[status] || '不明';
    }

    function getStatusClass(status) {
        const map = { ACTIVE: 'bg-success/20 text-success', LIMIT_REACHED: 'bg-warning/20 text-warning', INACTIVE: 'bg-outline/20 text-on-surface-variant', EXPIRED: 'bg-error/20 text-error' };
        return map[status] || 'bg-outline/20 text-on-surface-variant';
    }

    function setupNewCouponModal() {
        const form = document.getElementById('newCouponForm');
        if (!form) return;
        form.onsubmit = e => {
            e.preventDefault();
            const newCoupon = { id: `c_${Date.now()}`, code: form.couponCode.value, name: form.couponName.value, discountRate: parseInt(form.discountRate.value), validFrom: new Date(form.validFrom.value).toISOString(), validTo: new Date(form.validTo.value).toISOString(), usageLimit: form.unlimitedUsage.checked ? -1 : parseInt(form.usageLimit.value), usageCount: 0, targetType: form.couponType.value === 'private' ? 'SPECIFIC_EMAIL' : 'ALL', targetUserEmail: form.couponType.value === 'private' ? form.targetUserEmail.value : null, targetPlan: [], status: 'ACTIVE', memo: form.couponMemo.value, createdBy: 'admin', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
            allCouponsData.unshift(newCoupon);
            applyFiltersAndRender();
            closeModal('newCouponModal');
            showToast('クーポンを正常に作成しました。', 'success');
        };
    }

    function setupCouponEditModal(coupon) {
        const form = document.getElementById('editCouponForm');
        if (!form) return;
        form.id.value = coupon.id;
        document.getElementById('edit-couponType').textContent = coupon.targetType === 'SPECIFIC_EMAIL' ? 'プライベートクーポン' : '通常クーポン';
        document.getElementById('edit-couponCode').textContent = coupon.code;
        document.getElementById('edit-discountRate').textContent = `${coupon.discountRate}%`;
        form.couponName.value = coupon.name;
        form.validFrom.value = new Date(coupon.validFrom).toISOString().split('T')[0];
        form.validTo.value = new Date(form.validTo.value).toISOString().split('T')[0];
        form.couponMemo.value = coupon.memo || '';
        const usageLimitInput = document.getElementById('edit-usageLimit');
        const unlimitedUsageCheckbox = document.getElementById('edit-unlimitedUsage');
        if (coupon.usageLimit === -1) {
            unlimitedUsageCheckbox.checked = true;
            usageLimitInput.disabled = true;
        } else {
            unlimitedUsageCheckbox.checked = false;
            usageLimitInput.value = coupon.usageLimit;
        }
        unlimitedUsageCheckbox.onchange = e => { usageLimitInput.disabled = e.target.checked; if (e.target.checked) usageLimitInput.value = ''; };
        form.onsubmit = e => {
            e.preventDefault();
            const couponIndex = allCouponsData.findIndex(c => c.id === coupon.id);
            if (couponIndex > -1) {
                const updatedCoupon = { ...allCouponsData[couponIndex], name: form.couponName.value, validFrom: new Date(form.validFrom.value).toISOString(), validTo: new Date(form.validTo.value).toISOString(), usageLimit: form.unlimitedUsage.checked ? -1 : parseInt(form.usageLimit.value, 10), memo: form.couponMemo.value, updatedAt: new Date().toISOString() };
                allCouponsData[couponIndex] = updatedCoupon;
                applyFiltersAndRender();
                closeModal('editCouponModal');
                showToast('クーポン情報を更新しました。', 'success');
            }
        };
    }

    function setupCouponDetailModal() {
        document.getElementById('detail-code').textContent = coupon.code;
        document.getElementById('detail-name').textContent = coupon.name;
        document.getElementById('detail-status').innerHTML = `<span class="inline-flex items-center rounded-full ${getStatusClass(coupon.status)} px-2.5 py-1 text-xs">${getStatusText(coupon.status)}</span>`;
        document.getElementById('detail-discountRate').textContent = `${coupon.discountRate}%`;
        document.getElementById('detail-usage').textContent = `${coupon.usageCount} / ${coupon.usageLimit === -1 ? '∞' : coupon.usageLimit}`;
        document.getElementById('detail-validPeriod').textContent = `${new Date(coupon.validFrom).toLocaleDateString()} 〜 ${new Date(coupon.validTo).toLocaleDateString()}`;
        document.getElementById('detail-target').textContent = coupon.targetUserEmail || '全てのユーザー';
        document.getElementById('detail-memo').textContent = coupon.memo || '-';
        document.getElementById('detail-createdBy').textContent = coupon.createdBy;
        document.getElementById('detail-createdAt').textContent = new Date(coupon.createdAt).toLocaleString();
        document.getElementById('detail-updatedAt').textContent = new Date(coupon.updatedAt).toLocaleString();
        document.getElementById('detail-log-body').innerHTML = `<tr><td colspan="4" class="text-center py-4">ログはありません</td></tr>`;
        const deactivateBtn = document.getElementById('deactivateCouponBtn');
        deactivateBtn.onclick = () => {
            if (confirm('このクーポンを停止します。よろしいですか？')) {
                coupon.status = 'INACTIVE';
                applyFiltersAndRender();
                closeModal('couponDetailModal');
                showToast('クーポンを停止しました。', 'info');
            }
        };
    }
}
