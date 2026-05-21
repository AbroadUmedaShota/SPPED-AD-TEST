
/**
 * 日付ピッカーを初期化する
 */
export function initializeDatepickers(isNewSurvey = false) {
    const flatpickrInstance = window.flatpickr;
    if (!flatpickrInstance) {
        console.warn('flatpickr is not loaded.');
        return;
    }
    const JAPANESE_LOCALE = flatpickrInstance?.l10ns?.ja ?? flatpickrInstance?.l10ns?.default ?? {};
    if (Object.keys(JAPANESE_LOCALE).length > 0) {
        flatpickrInstance.localize(JAPANESE_LOCALE);
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const rangeOptions = {
        mode: 'range',
        dateFormat: 'Y-m-d',
        locale: JAPANESE_LOCALE,
    };

    if (isNewSurvey) {
        rangeOptions.minDate = tomorrow;
    }

    const periodInput = document.getElementById('periodRange');
    if (periodInput && !periodInput._flatpickr) {
        const fp = flatpickrInstance(periodInput, rangeOptions);

        // カレンダーアイコンクリックでピッカーを開く
        const calendarIcon = periodInput.parentElement?.querySelector('[aria-label="カレンダーを開く"]');
        if (calendarIcon) {
            calendarIcon.addEventListener('click', () => fp.open());
        }
    }

    // Keep the deadline picker initialization
    const deadlineWrapper = document.getElementById('deadlineWrapper');
    if (deadlineWrapper && !deadlineWrapper.querySelector('input')?._flatpickr) {
        flatpickrInstance('#deadlineWrapper', {
            wrap: true,
            dateFormat: 'Y-m-d',
        });
    }
}
