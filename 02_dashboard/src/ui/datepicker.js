

const flatpickrInstance = window.flatpickr;
const JAPANESE_LOCALE = flatpickrInstance?.l10ns?.ja ?? flatpickrInstance?.l10ns?.default ?? {};

/**
 * 日付ピッカーを初期化する
 */
export function initializeDatepickers() {
    if (!flatpickrInstance) {
        console.warn('flatpickr is not loaded.');
        return;
    }
    if (Object.keys(JAPANESE_LOCALE).length > 0) {
        flatpickrInstance.localize(JAPANESE_LOCALE);
    }

    const endDatePicker = flatpickrInstance('#periodEndWrapper', {
        wrap: true,
        dateFormat: 'Y-m-d',
    });

    flatpickrInstance('#periodStartWrapper', {
        wrap: true,
        dateFormat: 'Y-m-d',
        onChange(selectedDates, dateStr) {
            endDatePicker.set('minDate', dateStr);
        }
    });

    flatpickrInstance('#deadlineWrapper', {
        wrap: true,
        dateFormat: 'Y-m-d',
    });
}
