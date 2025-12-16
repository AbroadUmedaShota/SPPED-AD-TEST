/**
 * Shared logic for handling help popovers in modals.
 * Ensures only one popover is open at a time and handles closing on outside clicks.
 */

let activeHelpPopover = null;

function closeActiveHelpPopover() {
    if (!activeHelpPopover) return;
    const { button, popover } = activeHelpPopover;
    popover.classList.add('hidden');
    button.setAttribute('aria-expanded', 'false');
    activeHelpPopover = null;
}

function toggleHelpPopover(button, rootElement) {
    if (!button) return;
    const tooltipId = button.dataset.tooltipId;
    if (!tooltipId) return;

    // Search for popover within the rootElement first, fallback to document
    let popover = null;
    if (rootElement) {
        popover = rootElement.querySelector(`#${tooltipId}`);
    }
    if (!popover) {
        popover = document.getElementById(tooltipId);
    }

    if (!popover) return;

    if (activeHelpPopover && activeHelpPopover.popover === popover) {
        closeActiveHelpPopover();
        return;
    }

    closeActiveHelpPopover();
    popover.classList.remove('hidden');
    button.setAttribute('aria-expanded', 'true');
    activeHelpPopover = { button, popover };
}

// Global click/key handler
// We add these listeners only once.
if (typeof window !== 'undefined' && !window.__helpPopoverListenersAttached) {
    document.addEventListener('click', (event) => {
        if (!activeHelpPopover) return;
        const { button, popover } = activeHelpPopover;
        if (button.contains(event.target) || popover.contains(event.target)) {
            return;
        }
        closeActiveHelpPopover();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeActiveHelpPopover();
        }
    });
    window.__helpPopoverListenersAttached = true;
}

/**
 * Initializes help popovers within a given root element.
 * @param {HTMLElement} rootElement The container to search for help buttons.
 */
export function initHelpPopovers(rootElement) {
    if (!rootElement) return;

    // Close any active popover when initializing a new modal or section
    // (Optional: depending on UX preference, but safer to avoid stale references)
    // closeActiveHelpPopover(); 

    const buttons = rootElement.querySelectorAll('.help-icon-button');
    buttons.forEach((button) => {
        // Prevent attaching multiple listeners
        if (button.dataset.helpPopoverBound === 'true') return;

        button.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent global click from closing immediately
            toggleHelpPopover(button, rootElement);
        });

        button.dataset.helpPopoverBound = 'true';
    });
}
