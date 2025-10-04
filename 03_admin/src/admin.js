
let adminBasePath = '';

function resolveAdminBasePath() {
    if (adminBasePath !== '') {
        return adminBasePath;
    }
    const scriptElement = document.querySelector('script[type="module"][src*="admin.js"]');
    const defaultSrc = 'src/admin.js';
    const scriptSrc = scriptElement ? scriptElement.getAttribute('src') : defaultSrc;
    const marker = 'src/admin.js';
    const index = scriptSrc ? scriptSrc.lastIndexOf(marker) : -1;
    adminBasePath = index !== -1 ? scriptSrc.slice(0, index) : '';
    if (adminBasePath && !adminBasePath.endsWith('/')) {
        adminBasePath += '/';
    }
    return adminBasePath;
}

function getAdminBaseUrl() {
    const basePath = resolveAdminBasePath();
    const normalizedBasePath = basePath || './';
    return new URL(normalizedBasePath, window.location.href);
}

function isRelativeResourcePath(value) {
    if (!value) {
        return false;
    }
    return !/^(?:[a-z][a-z0-9+\-.]*:|[#/])/i.test(value);
}

function resolveResourcePath(value) {
    const baseUrl = getAdminBaseUrl();
    const normalizedValue = value.startsWith('./') ? value.slice(2) : value;
    const resolvedUrl = new URL(normalizedValue, baseUrl);
    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
}

function adjustRelativePaths(container) {
    if (!container) {
        return;
    }

    const targets = [
        { selector: 'a[href]', attribute: 'href' },
        { selector: 'img[src]', attribute: 'src' },
        { selector: 'link[href]', attribute: 'href' }
    ];

    targets.forEach(({ selector, attribute }) => {
        container.querySelectorAll(selector).forEach(element => {
            const originalValue = element.getAttribute(attribute);

            if (!isRelativeResourcePath(originalValue)) {
                return;
            }

            const adjustedValue = resolveResourcePath(originalValue);
            element.setAttribute(attribute, adjustedValue);
        });
    });
}

/**
 * Loads HTML content from a specified file and inserts it into a placeholder element.
 * @param {string} placeholderId The ID of the HTML element to insert the content into.
 * @param {string} filePath The path to the HTML file to load.
 * @param {function|null} callback An optional callback function to execute after the HTML is loaded.
 */
async function loadCommonHtml(placeholderId, filePath, callback = null) {
    try {
        const basePath = resolveAdminBasePath();
        const response = await fetch(`${basePath}${filePath}`);
        if (!response.ok) {
            throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
        }
        const html = await response.text();
        const placeholder = document.getElementById(placeholderId);
        if (placeholder) {
            placeholder.innerHTML = html;
            adjustRelativePaths(placeholder);
            if (callback && typeof callback === 'function') {
                callback();
            }
        }
    } catch (error) {
        console.error(`Error loading common HTML from ${filePath}:`, error);
    }
}

function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
    if (!sidebar || !mobileSidebarOverlay) {
        return;
    }

    const isOpen = sidebar.classList.contains('is-open-mobile');
    if (isOpen) {
        sidebar.classList.remove('is-open-mobile');
        mobileSidebarOverlay.classList.remove('is-visible');
        document.body.classList.remove('sidebar-locked');
    } else {
        sidebar.classList.add('is-open-mobile');
        mobileSidebarOverlay.classList.add('is-visible');
        document.body.classList.add('sidebar-locked');
    }
}

function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
    if (!sidebar || !mobileSidebarOverlay) {
        return;
    }

    sidebar.classList.remove('is-open-mobile');
    mobileSidebarOverlay.classList.remove('is-visible');
    document.body.classList.remove('sidebar-locked');
}

function handleResizeForSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
    if (!sidebar || !mobileSidebarOverlay) {
        return;
    }

    if (window.innerWidth >= 1024) {
        closeMobileSidebar();
    }
}

/**
 * Sets the active state for the current page in the sidebar navigation.
 */
function setActiveSidebarLink() {
    const currentPage = window.location.pathname.split('/').pop();
    const sidebarLinks = document.querySelectorAll('.admin-sidebar .nav-link');
    
    sidebarLinks.forEach(link => {
        const linkPage = link.getAttribute('href').split('/').pop();
        if (linkPage === currentPage) {
            link.classList.add('active');
        }
    });
}

/**
 * Initializes sidebar-related functionalities for the admin panel.
 */
function initAdminSidebarHandler() {
    setActiveSidebarLink();

    const mobileToggleButton = document.getElementById('mobile-sidebar-toggle');
    const mobileSidebarOverlay = document.getElementById('mobileSidebarOverlay');
    const sidebar = document.getElementById('sidebar');

    if (mobileToggleButton) {
        mobileToggleButton.addEventListener('click', toggleMobileSidebar);
    }

    if (mobileSidebarOverlay) {
        mobileSidebarOverlay.addEventListener('click', closeMobileSidebar);
    }

    if (sidebar) {
        sidebar.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth < 1024) {
                    closeMobileSidebar();
                }
            });
        });
    }

    handleResizeForSidebar();
    window.addEventListener('resize', handleResizeForSidebar);
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load common elements for the admin page
    await loadCommonHtml('header-placeholder', 'common/header.html');
    await loadCommonHtml('sidebar-placeholder', 'common/sidebar.html', initAdminSidebarHandler);
    await loadCommonHtml('footer-placeholder', 'common/footer.html');

    // Page-specific initialization
    const page = window.location.pathname.split('/').pop();
    switch (page) {
        case 'data_entry.html':
            const { initDataEntryPage } = await import('./data_entry.js');
            initDataEntryPage();
            break;
        // Add other admin pages here
        // case 'some_other_page.html':
        //     const { initSomeOtherPage } = await import('./some_other_page.js');
        //     initSomeOtherPage();
        //     break;
    }
});
