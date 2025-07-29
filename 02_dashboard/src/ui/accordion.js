/**
 * アコーディオンの開閉状態をlocalStorageに保存する
 * @param {string} id - アコーディオンコンテンツのID
 * @param {boolean} isOpen - 開いているかどうか
 */
function saveAccordionState(id, isOpen) {
    localStorage.setItem(`accordionState_${id}`, isOpen);
}

/**
 * localStorageからアコーディオンの開閉状態を復元する
 */
export function restoreAccordionState() {
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const contentId = header.dataset.accordionTarget;
        const content = document.getElementById(contentId);
        const icon = header.querySelector('.expand-icon');
        if (content && localStorage.getItem(`accordionState_${contentId}`) === 'false') {
            content.style.display = 'none';
            icon.textContent = 'expand_more';
        } else if (content) {
            content.style.display = 'block';
            icon.textContent = 'expand_less';
        }
    });
}

/**
 * アコーディオンの開閉処理を初期化する
 */
export function initializeAccordion() {
    document.body.addEventListener('click', (event) => {
        const header = event.target.closest('.accordion-header, .group-header');
        if (header) {
            const contentId = header.dataset.accordionTarget;
            const content = document.getElementById(contentId);
            const icon = header.querySelector('.expand-icon');
            if (content) {
                const isVisible = getComputedStyle(content).display !== 'none';
                content.style.display = isVisible ? 'none' : 'block';
                icon.textContent = isVisible ? 'expand_more' : 'expand_less';
                saveAccordionState(contentId, !isVisible); // 状態を保存
            }
        }
    });
}