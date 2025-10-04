

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

    // Initialize for the new period range input
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    flatpickrInstance('#periodRange', {
        mode: 'range',
        dateFormat: 'Y-m-d',
        locale: JAPANESE_LOCALE, // Ensure locale is applied
        minDate: tomorrow
    });

    // Keep the deadline picker initialization
    flatpickrInstance('#deadlineWrapper', {
        wrap: true, // This one still uses a wrapper
        dateFormat: 'Y-m-d',
    });
}
