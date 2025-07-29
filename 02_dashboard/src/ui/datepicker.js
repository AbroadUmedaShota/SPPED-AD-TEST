import flatpickr from 'https://cdn.jsdelivr.net/npm/flatpickr';
import { Japanese } from 'https://cdn.jsdelivr.net/npm/flatpickr/dist/l10n/ja.js';

/**
 * 日付ピッカーを初期化する
 */
export function initializeDatepickers() {
    flatpickr.localize(Japanese);

    const endDatePicker = flatpickr("#periodEndWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
    });

    flatpickr("#periodStartWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr) {
            endDatePicker.set('minDate', dateStr);
        }
    });

    flatpickr("#deadlineWrapper", {
        wrap: true,
        dateFormat: "Y-m-d",
    });
}