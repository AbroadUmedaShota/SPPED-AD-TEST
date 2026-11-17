import { initTableManager, applyFiltersAndPagination } from './tableManager.js';
import { initSurveyListResponsive } from './ui/surveyListResponsive.js';



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

    // 1023px 以下で使う、一覧の上のツールバー（表示件数・絞り込み・並べ替え）
    initSurveyListResponsive();

    // フィルターとページネーションを適用
    applyFiltersAndPagination();

    // Listen for language changes and re-apply filters and pagination
    document.addEventListener('languagechange', () => {
        applyFiltersAndPagination();
    });
}