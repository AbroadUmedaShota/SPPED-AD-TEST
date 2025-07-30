import { initTableManager, applyFiltersAndPagination } from './tableManager.js';
import flatpickr from 'https://cdn.jsdelivr.net/npm/flatpickr';


/**
 * アンケート一覧ページを初期化します。
 */
export function initIndexPage() {
    initTableManager();

    // flatpickrの初期化
    flatpickr.localize(flatpickr.l10ns.ja);

    const endDatePicker = flatpickr("#endDatePickerWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
    });

    flatpickr("#startDatePickerWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr) {
            endDatePicker.set('minDate', dateStr);
        }
    });

    // フィルターとページネーションを適用
    applyFiltersAndPagination();
}