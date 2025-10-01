
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
            if (callback && typeof callback === 'function') {
                callback();
            }
        }
    } catch (error) {
        console.error(`Error loading common HTML from ${filePath}:`, error);
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
    // Placeholder for future logic like theme toggling
    console.log("Admin sidebar handler initialized.");
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load common elements for the admin page
    await loadCommonHtml('header-placeholder', 'common/header.html');
    await loadCommonHtml('sidebar-placeholder', 'common/sidebar.html', initAdminSidebarHandler);
    await loadCommonHtml('footer-placeholder', 'common/footer.html');
});
