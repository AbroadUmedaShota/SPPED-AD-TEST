// Simplified for debugging

export async function initCouponBulkCreate() {
    const placeholder = document.getElementById('bulkCreateCouponModalPlaceholder');
    if (!placeholder) return;

    try {
        const modalUrl = new URL('../modals/bulkCreateCouponModal.html', import.meta.url);
        const response = await fetch(modalUrl);
        if (!response.ok) throw new Error('Failed to load modal');
        placeholder.innerHTML = await response.text();
        
        const bulkCreateModal = document.getElementById('bulk-create-coupon-modal');
        const openBtn = document.getElementById('bulkCreateCouponButton');
        const closeBtn = bulkCreateModal.querySelector('[data-action="close"]');

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                bulkCreateModal.dataset.state = 'open';
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                bulkCreateModal.dataset.state = 'closed';
            });
        }
        console.log('Bulk create modal initialized successfully.');

    } catch (error) {
        console.error('Error in initCouponBulkCreate:', error);
    }
}
