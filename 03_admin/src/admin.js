
/**
 * Loads HTML content from a specified file and inserts it into a placeholder element.
 * This version is adapted for the admin area to correctly resolve paths.
 * @param {string} placeholderId The ID of the HTML element to insert the content into.
 * @param {string} filePath The path to the HTML file to load.
 * @param {function|null} callback An optional callback function to execute after the HTML is loaded.
 */
async function loadCommonHtml(placeholderId, filePath, callback = null) {
    try {
        const response = await fetch(filePath);
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
 * Initializes sidebar-related functionalities for the admin panel.
 */
function initAdminSidebarHandler() {
    // This is a placeholder for admin-specific sidebar logic.
    // For now, it's just a log, but can be expanded for theme toggling, etc.
    console.log("Admin sidebar handler initialized.");
}

document.addEventListener('DOMContentLoaded', async () => {
    // Load common elements for the admin page
    await loadCommonHtml('header-placeholder', '../02_dashboard/common/header.html');
    await loadCommonHtml('sidebar-placeholder', 'common/sidebar.html', initAdminSidebarHandler);
    await loadCommonHtml('footer-placeholder', '../02_dashboard/common/footer.html');
});
