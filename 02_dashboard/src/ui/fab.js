/**
 * Attaches functionality to an existing FAB (Floating Action Button) in the DOM.
 * @param {string} containerId - The ID of the FAB's main container element.
 * @param {object} actions - Callbacks for menu actions (onAddQuestion, onAddGroup).
 */
export function initializeFab(containerId, actions) {
    const fabContainer = document.getElementById(containerId);
    if (!fabContainer) {
        console.error(`FAB container with id '${containerId}' not found.`);
        return;
    }

    const mainButton = fabContainer.querySelector('#fab-main-button');
    const menu = fabContainer.querySelector('#fab-menu');
    const icon = mainButton ? mainButton.querySelector('span') : null;

    if (!mainButton || !menu || !icon) {
        console.error('FAB button, menu, or icon not found within the container.');
        return;
    }

    setupFabMenuActions(mainButton, menu, icon, actions);
    makeFabDraggable(fabContainer, mainButton, menu, icon);
}

/**
 * Sets up click handlers for the menu items.
 */
function setupFabMenuActions(mainButton, menu, icon, actions) {
    menu.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-question-type]');
        if (!button) return;

        const questionType = button.dataset.questionType;

        if (questionType === 'group' && actions.onAddGroup) {
            actions.onAddGroup();
        } else if (actions.onAddQuestion) {
            actions.onAddQuestion(questionType);
        }

        toggleMenu(mainButton, menu, icon, true); // Force close menu after action
    });
}

/**
 * Toggles the visibility of the FAB menu.
 */
function toggleMenu(mainButton, menu, icon, forceClose = null) {
    const isExpanded = mainButton.getAttribute('aria-expanded') === 'true';
    let shouldOpen;
    if (forceClose) {
        shouldOpen = false;
    } else {
        shouldOpen = !isExpanded;
    }

    mainButton.setAttribute('aria-expanded', String(shouldOpen));
    
    // アイコンのテキストを切り替え、回転クラスを適用
    icon.textContent = shouldOpen ? 'close' : 'add';
    icon.classList.toggle('rotate-45', shouldOpen);

    if (shouldOpen) { // Open menu
        menu.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
    } else { // Close menu
        menu.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
    }
}

/**
 * Makes the FAB draggable and handles click vs. drag distinction.
 */
function makeFabDraggable(fabContainer, mainButton, menu, icon) {
    let isDragging = false;
    let hasDragged = false;
    let offsetX, offsetY;

    mainButton.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        hasDragged = false;
        const rect = fabContainer.getBoundingClientRect();
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        // Do not prevent default, allow focus
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        if (!hasDragged) {
            // Start dragging only after moving a certain threshold
            hasDragged = true;
        }
        mainButton.style.cursor = 'grabbing';

        let newLeft = e.clientX - offsetX;
        let newTop = e.clientY - offsetY;

        const { width, height } = fabContainer.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (newLeft < 0) newLeft = 0;
        if (newTop < 0) newTop = 0;
        if (newLeft + width > viewportWidth) newLeft = viewportWidth - width;
        if (newTop + height > viewportHeight) newTop = viewportHeight - height;

        fabContainer.style.left = `${newLeft}px`;
        fabContainer.style.top = `${newTop}px`;
        fabContainer.style.bottom = 'auto';
        fabContainer.style.right = 'auto';
    });

    document.addEventListener('mouseup', (e) => {
        if (!isDragging) return;
        e.preventDefault(); // Prevent potential text selection issues
        isDragging = false;
        mainButton.style.cursor = 'pointer';
    });

    mainButton.addEventListener('click', (e) => {
        if (hasDragged) {
            e.stopPropagation(); // Prevent click if it was a drag
            return;
        }
        toggleMenu(mainButton, menu, icon);
    });

    // Close menu on outside click
    document.addEventListener('click', (event) => {
        if (mainButton.contains(event.target) || menu.contains(event.target)) {
            return;
        }
        if (mainButton.getAttribute('aria-expanded') === 'true') {
            toggleMenu(mainButton, menu, icon, true); // Force close
        }
    });

    mainButton.addEventListener('dragstart', (e) => e.preventDefault());
}